// backend/server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

const config = require('./config');
const db = require('./db');
const wallet = require('./wallet');
const dailyReward = require('./daily-reward');
const diceToken = require('./dice-token');
const { createAdminRouter } = require('./admin-routes');

const app = express();

// ============================================================
// CORS CONFIGURATION - Firebase + Render
// ============================================================

const allowedOrigins = [
    'https://test-9a5e3.web.app',
    'https://test-9a5e3.firebaseapp.com',
    'https://ludo-test.onrender.com',
    'http://localhost:3000',
    'http://localhost:8080',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://localhost:7700'
];


app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            // Log blocked origins for debugging
            console.log('Blocked CORS origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '100kb' }));

// ============================================================
// STATIC FILES (for local testing)
// ============================================================
const frontendPath = fs.existsSync(path.join(__dirname, '../frontend'))
    ? path.join(__dirname, '../frontend')
    : (fs.existsSync(path.join(__dirname, 'frontend')) ? path.join(__dirname, 'frontend') : __dirname);

app.use(express.static(frontendPath));

const adminPath = path.join(__dirname, '../admin');
if (fs.existsSync(adminPath)) app.use('/admin', express.static(adminPath));

const server = http.createServer(app);

// ============================================================
// SOCKET.IO WITH PRODUCTION SETTINGS
// ============================================================
const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
});

const JWT_SECRET = config.JWT_SECRET;
const ADMIN_PHONE = config.ADMIN_PHONE;
const ADMIN_USERNAME = config.ADMIN_USERNAME;
const ADMIN_PASSWORD = config.ADMIN_PASSWORD;

const TURN_TIMEOUT_MS = Number(process.env.TURN_TIMEOUT_MS) || 30000;
const DISCONNECT_GRACE_MS = Number(process.env.DISCONNECT_GRACE_MS) || 60000;

const rooms = new Map();
const roomTimers = new Map();
const activeSoloMatches = new Map();
const disconnectGraceTimers = new Map();

// ============================================================
// HELPER FUNCTIONS
// ============================================================
function verifyAdminToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Admin Token Missing!' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role !== 'admin') return res.status(403).json({ success: false, message: 'Forbidden.' });
        req.adminUser = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ success: false, message: 'Invalid Admin Token.' });
    }
}

function verifyUserToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Authorization Token Missing.' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ success: false, message: 'Invalid or Expired Token.' });
    }
}

function playerIdentifier(p) {
    return p.walletId || p.mobile || p.username || p.name;
}

function isUserBanned(identifier) {
    const u = db.findUserByIdentifier(identifier);
    return Boolean(u && u.banned);
}

function isPlayerActive(room, p) {
    if (!p || p.forfeited) return false;
    if (diceToken.hasFinishedAllTokens(room, p.color)) return false;
    return true;
}

function clearRoomTurnTimer(roomCode) {
    if (roomTimers.has(roomCode)) {
        clearTimeout(roomTimers.get(roomCode));
        roomTimers.delete(roomCode);
    }
}

function clearRoomGraceTimers(roomCode) {
    disconnectGraceTimers.forEach((timer, key) => {
        if (key.startsWith(`${roomCode}_`)) {
            clearTimeout(timer);
            disconnectGraceTimers.delete(key);
        }
    });
}

function destroyRoom(roomCode) {
    clearRoomTurnTimer(roomCode);
    clearRoomGraceTimers(roomCode);
    const room = rooms.get(roomCode);
    if (room) {
        room.status = 'finished';
        room.players.forEach(p => {
            const s = io.sockets.sockets.get(p.socketId);
            if (s) {
                s.currentRoom = null;
                s.leave(roomCode);
            }
        });
    }
    rooms.delete(roomCode);
}

function sanitizeRoom(room) {
    return {
        id: room.id,
        hostId: room.hostId,
        betAmount: room.betAmount,
        gameType: room.gameType,
        status: room.status,
        currentTurnIndex: room.currentTurnIndex,
        totalPot: room.totalPot,
        players: room.players.map(p => ({
            socketId: p.socketId,
            name: p.name,
            username: p.username,
            avatarId: p.avatarId,
            color: p.color,
            isHost: p.isHost,
            disconnected: p.disconnected,
            forfeited: p.forfeited
        }))
    };
}

function handleLobbyLeave(socket, room, roomCode) {
    if (room.hostId === socket.id) {
        io.to(roomCode).emit('room_disbanded', { message: 'Host left the room.' });
        destroyRoom(roomCode);
        return;
    }
    room.players = room.players.filter(p => p.socketId !== socket.id);
    socket.leave(roomCode);
    io.to(roomCode).emit('lobby_updated', { roomData: sanitizeRoom(room), roomCode });
}

function emitBoardSync(roomCode) {
    const room = rooms.get(roomCode);
    if (!room || !room.boardState) return;
    io.to(roomCode).emit('board_sync', {
        tokens: room.boardState.tokens,
        currentTurnColor: room.players[room.currentTurnIndex] ? room.players[room.currentTurnIndex].color : null
    });
}

function startRoomTurnTimer(roomCode) {
    clearRoomTurnTimer(roomCode);
    const room = rooms.get(roomCode);
    if (!room || room.status !== 'playing') return;

    const timer = setTimeout(() => {
        roomTimers.delete(roomCode);
        autoPlayForActivePlayer(roomCode);
    }, TURN_TIMEOUT_MS);

    roomTimers.set(roomCode, timer);
}

function scheduleSwitch(roomCode, delayMs) {
    const room = rooms.get(roomCode);
    if (!room) return;
    const seqAtSchedule = room.turnSeq || 0;
    setTimeout(() => {
        const r = rooms.get(roomCode);
        if (!r || r.status !== 'playing') return;
        if ((r.turnSeq || 0) !== seqAtSchedule) return;
        switchNextTurnServer(roomCode);
    }, delayMs);
}

function switchNextTurnServer(roomCode) {
    const room = rooms.get(roomCode);
    if (!room || room.status !== 'playing') return;

    room.turnSeq = (room.turnSeq || 0) + 1;

    room.boardState.diceRolled = false;
    room.boardState.currentDiceValue = 0;
    room.boardState.consecutiveSixes = 0;

    const total = room.players.length;
    let count = 0;
    let nextPlayer = null;

    do {
        room.currentTurnIndex = (room.currentTurnIndex + 1) % total;
        nextPlayer = room.players[room.currentTurnIndex];
        count++;
    } while (!isPlayerActive(room, nextPlayer) && count <= total);

    if (!isPlayerActive(room, nextPlayer)) {
        const survivors = room.players.filter(p => !p.forfeited);
        const winner = survivors[0] || room.players[0];
        if (winner) finishMatch(roomCode, winner.color, ' (Match Completed)');
        return;
    }

    io.to(roomCode).emit('turn_switched', {
        nextPlayerColor: nextPlayer.color,
        isDisconnected: Boolean(nextPlayer.disconnected)
    });

    startRoomTurnTimer(roomCode);
}

function finishMatch(roomCode, winnerColor, extraNameSuffix = '') {
    const room = rooms.get(roomCode);
    if (!room || room.payoutDone) return;

    room.payoutDone = true;
    clearRoomTurnTimer(roomCode);

    const winner = room.players.find(p => p.color === winnerColor);
    const potPrize = room.totalPot || (room.betAmount * room.players.length);

    if (winner) {
        wallet.creditWinnerPot(playerIdentifier(winner), potPrize, roomCode);
    }

    io.to(roomCode).emit('match_finished', {
        winnerColor,
        winnerName: (winner ? winner.name : 'Player') + extraNameSuffix,
        prize: potPrize
    });

    destroyRoom(roomCode);
}

function autoPlayForActivePlayer(roomCode) {
    const room = rooms.get(roomCode);
    if (!room || room.status !== 'playing') return;

    const activePlayer = room.players[room.currentTurnIndex];
    if (!isPlayerActive(room, activePlayer)) {
        switchNextTurnServer(roomCode);
        return;
    }

    if (room.boardState.diceRolled) {
        const movable = diceToken.getServerMovableTokens(room, activePlayer.color, room.boardState.currentDiceValue);
        if (movable.length === 0) {
            switchNextTurnServer(roomCode);
            return;
        }
        applyServerMove(roomCode, activePlayer.color, movable[0], room.boardState.currentDiceValue, true);
        return;
    }

    const { diceValue, isCancelled } = diceToken.rollServerDice(room);
    const movableTokens = diceToken.getServerMovableTokens(room, activePlayer.color, diceValue);

    io.to(roomCode).emit('server_dice_rolled', {
        color: activePlayer.color,
        diceValue,
        movableTokens,
        isCancelled,
        autoPlayed: true
    });

    if (isCancelled || movableTokens.length === 0) {
        scheduleSwitch(roomCode, 1200);
        return;
    }

    const seqAtRoll = room.turnSeq || 0;
    setTimeout(() => {
        const stillThere = rooms.get(roomCode);
        if (!stillThere || stillThere.status !== 'playing') return;
        if ((stillThere.turnSeq || 0) !== seqAtRoll) return;
        applyServerMove(roomCode, activePlayer.color, movableTokens[0], diceValue, true);
    }, 900);
}

function applyServerMove(roomCode, color, tokenIndex, steps, autoPlayed = false) {
    const room = rooms.get(roomCode);
    if (!room || room.status !== 'playing') return { valid: false };

    const moveResult = diceToken.executeServerTokenMove(room, color, tokenIndex, steps);
    if (!moveResult.valid) return moveResult;

    clearRoomTurnTimer(roomCode);

    io.to(roomCode).emit('server_token_moved', {
        color,
        tokenIndex,
        steps,
        captured: moveResult.capturedOpponent,
        isWinner: moveResult.isWinner,
        rank: moveResult.rank,
        hasExtraTurn: moveResult.hasExtraTurn,
        autoPlayed
    });

    emitBoardSync(roomCode);

    if (moveResult.isWinner && moveResult.rank === 1) {
        finishMatch(roomCode, color);
        return moveResult;
    }

    if (moveResult.hasExtraTurn && !diceToken.hasFinishedAllTokens(room, color)) {
        startRoomTurnTimer(roomCode);
    } else {
        switchNextTurnServer(roomCode);
    }
    return moveResult;
}

function forfeitMatchForPlayer(roomCode, forfeitingPlayer, reason = "Left Match") {
    const room = rooms.get(roomCode);
    if (!room || !forfeitingPlayer || forfeitingPlayer.forfeited) return;

    forfeitingPlayer.forfeited = true;
    forfeitingPlayer.disconnected = true;

    const graceKey = `${roomCode}_${forfeitingPlayer.username}`;
    if (disconnectGraceTimers.has(graceKey)) {
        clearTimeout(disconnectGraceTimers.get(graceKey));
        disconnectGraceTimers.delete(graceKey);
    }

    if (room.boardState && room.boardState.tokens && room.boardState.tokens[forfeitingPlayer.color]) {
        room.boardState.tokens[forfeitingPlayer.color].forEach(tok => {
            tok.status = 'base';
            tok.pos = -1;
            tok.stepCount = 0;
        });
    }

    const wasActiveTurn = room.players[room.currentTurnIndex] &&
        room.players[room.currentTurnIndex].username === forfeitingPlayer.username;

    const remainingActivePlayers = room.players.filter(p => !p.forfeited);

    if (remainingActivePlayers.length <= 1) {
        const winner = remainingActivePlayers[0];
        if (winner) {
            finishMatch(roomCode, winner.color, ' (All Opponents Left)');
        } else {
            destroyRoom(roomCode);
        }
        return;
    }

    io.to(roomCode).emit('player_forfeited_continue', {
        color: forfeitingPlayer.color,
        name: forfeitingPlayer.name,
        reason: reason,
        remainingCount: remainingActivePlayers.length
    });

    emitBoardSync(roomCode);

    if (wasActiveTurn) {
        switchNextTurnServer(roomCode);
    } else {
        if (!roomTimers.has(roomCode)) startRoomTurnTimer(roomCode);
    }
}

function resolveSocketIdentity(authToken, fallbackUsername, fallbackMobile) {
    if (authToken) {
        try {
            const decoded = jwt.verify(authToken, JWT_SECRET);
            return {
                verified: true,
                walletId: decoded.id || decoded.mobile,
                username: decoded.username || decoded.id,
                mobile: decoded.mobile || ''
            };
        } catch (e) { /* invalid token -> fallback */ }
    }
    return {
        verified: false,
        walletId: fallbackMobile || fallbackUsername,
        username: fallbackUsername,
        mobile: fallbackMobile || ''
    };
}

// ============================================================
// API ROUTES
// ============================================================
app.get('/api/health', (req, res) => {
    res.json({ success: true, uptime: process.uptime(), activeRooms: rooms.size });
});

// FIX: extra ultra-lightweight endpoint purely for the keep-alive pinger
// below (and for external cron services like GitHub Actions / UptimeRobot).
// Kept separate from /api/health so it never fails even if DB/room state
// has an issue - it just proves the process is awake.
app.get('/ping', (req, res) => {
    res.status(200).type('text/plain').send('pong');
});

app.post('/api/social-login', async (req, res) => {
    try {
        const { id, name, username, provider, avatarId, coins } = req.body;
        if (!id || !name) {
            return res.status(400).json({ success: false, message: 'ID and Name are required.' });
        }

        let user = db.findUserByIdentifier(id);
        if (!user) {
            const signupCoins = config.SIGNUP_BONUS_COINS;
            user = {
                id: String(id),
                name: String(name).slice(0, 40),
                username: username || String(name).toLowerCase().replace(/[^a-z0-9_]/g, '') + '_' + Math.floor(1000 + Math.random() * 9000),
                mobile: '',
                coins: signupCoins,
                diamonds: config.SIGNUP_BONUS_DIAMONDS,
                level: 1,
                avatarId: Number(avatarId) || 1,
                provider: provider || 'Guest',
                createdAt: Date.now()
            };
            db.saveUserRecord(user, true);
            user = db.findUserByIdentifier(id) || user;
        }

        if (user.banned) {
            return res.status(403).json({ success: false, message: 'Aapka account ban kar diya gaya hai. Support se sampark karein.' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, mobile: user.mobile || user.id },
            JWT_SECRET,
            { expiresIn: '30d' }
        );
        const { password: _, ...safeUser } = user;

        return res.json({ success: true, user: safeUser, token });
    } catch (e) {
        return res.status(500).json({ success: false, message: 'Social/Guest login server error.' });
    }
});

app.post('/api/account/upgrade-guest', verifyUserToken, (req, res) => {
    try {
        const { googleId, name, email, avatarId } = req.body || {};
        if (!googleId) {
            return res.status(400).json({ success: false, message: 'Google ID required.' });
        }

        const currentIdentifier = req.user.id || req.user.mobile;
        const database = db.readDB();
        const oldKey = db.findUserKeyIn(database, currentIdentifier);
        if (!oldKey) {
            return res.status(404).json({ success: false, message: 'Account not found. Please login again.' });
        }

        const oldRecord = database.users[oldKey];
        if (oldRecord.provider && oldRecord.provider !== 'Guest') {
            return res.status(400).json({ success: false, message: 'Sirf Guest account ko Google me upgrade kiya ja sakta hai.' });
        }

        const newKey = String(googleId).trim().toLowerCase();

        if (newKey !== oldKey && database.users[newKey]) {
            return res.status(409).json({
                success: false,
                message: 'Ye Google account pehle se kisi aur profile se juda hai. Us account se seedha Gmail login karein.'
            });
        }

        const upgradedRecord = {
            ...oldRecord,
            id: String(googleId),
            firebaseUid: String(googleId).replace(/^G_/, ''),
            name: (name || oldRecord.name || 'Player').toString().slice(0, 40),
            email: email || oldRecord.email || '',
            avatarId: Number(avatarId) || oldRecord.avatarId || 1,
            provider: 'Google',
            updatedAt: Date.now()
        };

        database.users[newKey] = upgradedRecord;
        if (newKey !== oldKey) delete database.users[oldKey];

        const writeOk = db.writeDBSync(database);
        if (!writeOk) {
            return res.status(500).json({ success: false, message: 'Account upgrade save nahi ho paya, dobara try karein.' });
        }

        const token = jwt.sign(
            { id: upgradedRecord.id, username: upgradedRecord.username, mobile: upgradedRecord.mobile || upgradedRecord.id },
            JWT_SECRET,
            { expiresIn: '30d' }
        );
        const { password: _, ...safeUser } = upgradedRecord;

        return res.json({ success: true, user: safeUser, token });
    } catch (e) {
        console.error('[upgrade-guest error]', e);
        return res.status(500).json({ success: false, message: 'Server error while upgrading account.' });
    }
});

app.post('/api/user/sync', verifyUserToken, (req, res) => {
    const { name, username, avatarId, age } = req.body;
    const userIdentifier = req.user.id || req.user.mobile;

    const existing = db.findUserByIdentifier(userIdentifier);
    if (existing) {
        existing.name = name || existing.name;
        if (username) existing.username = username.replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9_.]/g, '');
        existing.avatarId = avatarId || existing.avatarId;
        existing.age = age || existing.age;
        db.saveUserRecord(existing, false);
    }

    const balance = db.getUserWalletBalance(userIdentifier);
    if (!balance.found) {
        return res.json({ success: true, wallet: null, found: false });
    }
    return res.json({ success: true, wallet: balance, found: Boolean(existing) });
});

// Daily Reward
app.get('/api/wallet/daily-reward', verifyUserToken, (req, res) => {
    const userIdentifier = req.user.id || req.user.mobile;
    const status = dailyReward.getStatus(userIdentifier);
    if (!status.success) return res.status(404).json(status);
    return res.json(status);
});

app.post('/api/wallet/daily-reward/claim', verifyUserToken, (req, res) => {
    const userIdentifier = req.user.id || req.user.mobile;
    const result = dailyReward.claim(userIdentifier);
    if (!result.success) return res.status(400).json(result);

    try {
        const key = String(userIdentifier).trim().toLowerCase();
        io.to('user:' + key).emit('wallet_updated', { coins: result.newBalance });
    } catch (e) { /* socket optional */ }

    return res.json(result);
});

// Solo Match
app.post('/api/wallet/solo-bet', verifyUserToken, (req, res) => {
    const { betAmount, playerCount } = req.body;
    const bet = Math.abs(Number(betAmount)) || 100;
    const count = [2, 3, 4].includes(Number(playerCount)) ? Number(playerCount) : 2;
    const userIdentifier = req.user.id || req.user.mobile;

    const previous = activeSoloMatches.get(userIdentifier);
    if (previous) activeSoloMatches.delete(userIdentifier);

    const result = wallet.deductMatchEntryFee(userIdentifier, bet, 'COMPUTER_MATCH');
    if (!result.success) {
        return res.status(400).json(result);
    }

    const matchId = 'solo_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const matchToken = jwt.sign({ matchId, userIdentifier, bet, count }, JWT_SECRET, { expiresIn: '3h' });

    activeSoloMatches.set(userIdentifier, {
        matchId,
        betAmount: bet,
        playerCount: count,
        startedAt: Date.now(),
        movesCount: 0
    });

    return res.json({ success: true, newBalance: result.newBalance, matchToken });
});

app.post('/api/wallet/solo-step', verifyUserToken, (req, res) => {
    const userIdentifier = req.user.id || req.user.mobile;
    const match = activeSoloMatches.get(userIdentifier);
    if (match) {
        match.movesCount = (match.movesCount || 0) + 1;
    }
    return res.json({ success: true });
});

app.post('/api/wallet/solo-abandon', verifyUserToken, (req, res) => {
    const userIdentifier = req.user.id || req.user.mobile;
    const match = activeSoloMatches.get(userIdentifier);
    if (!match) return res.json({ success: true, refunded: false });

    activeSoloMatches.delete(userIdentifier);
    const balance = db.getUserWalletBalance(userIdentifier);
    return res.json({ success: true, refunded: false, newBalance: balance.coins });
});

app.post('/api/wallet/solo-win', verifyUserToken, (req, res) => {
    const userIdentifier = req.user.id || req.user.mobile;
    const match = activeSoloMatches.get(userIdentifier);
    const { matchToken } = req.body;

    if (!match) {
        return res.status(400).json({ success: false, message: "No active solo match found on server." });
    }

    try {
        const decoded = jwt.verify(matchToken, JWT_SECRET);
        if (decoded.matchId !== match.matchId || decoded.userIdentifier !== userIdentifier) {
            return res.status(403).json({ success: false, message: "Invalid match session token." });
        }
    } catch (e) {
        return res.status(403).json({ success: false, message: "Invalid or expired match token." });
    }

    const durationMs = Date.now() - match.startedAt;
    const isAdmin = req.user.role === 'admin';

    if (!isAdmin) {
        if (durationMs < 15000 || match.movesCount < 4) {
            activeSoloMatches.delete(userIdentifier);
            return res.status(400).json({
                success: false,
                message: "Match finished unrealistically fast. Anti-cheat triggered."
            });
        }
    }

    const prize = Math.max(
        0,
        Math.round(match.betAmount * match.playerCount * (config.SOLO_PRIZE_MULTIPLIER || 1))
    );
    activeSoloMatches.delete(userIdentifier);

    const result = wallet.creditWinnerPot(userIdentifier, prize, 'COMPUTER_MATCH');
    if (!result.success) return res.status(400).json(result);
    return res.json({ success: true, newBalance: result.newBalance, prizeAmount: prize });
});

// Admin Login
app.post('/api/admin-login', (req, res) => {
    const { identifier, password } = req.body;
    const isMatch = (identifier === ADMIN_PHONE || identifier === ADMIN_USERNAME) && (password === ADMIN_PASSWORD);

    if (isMatch) {
        const token = jwt.sign({ role: 'admin', username: ADMIN_USERNAME, phone: ADMIN_PHONE }, JWT_SECRET, { expiresIn: '24h' });
        return res.json({
            success: true,
            adminToken: token,
            user: {
                id: 'admin_' + ADMIN_PHONE,
                name: 'Loki Admin',
                username: ADMIN_USERNAME,
                mobile: ADMIN_PHONE,
                coins: 999999,
                diamonds: 9999,
                level: 99,
                isAdmin: true
            }
        });
    }
    return res.status(401).json({ success: false, message: 'Invalid Admin Credentials' });
});

// Admin Routes
app.use('/api/admin', createAdminRouter({
    rooms,
    io,
    activeSoloMatches,
    destroyRoom: (code) => destroyRoom(code)
}));

// ============================================================
// SOCKET.IO EVENTS
// ============================================================
io.on('connection', (socket) => {

    // ADMIN PORTAL LIVE SYNC
    socket.on('identify_user', ({ authToken } = {}) => {
        try {
            if (!authToken) return;
            const decoded = jwt.verify(authToken, JWT_SECRET);
            const database = db.readDB();
            const key = db.findUserKeyIn(database, decoded.username)
                     || db.findUserKeyIn(database, decoded.mobile)
                     || db.findUserKeyIn(database, decoded.id);
            if (!key) return;
            socket.walletKey = key;
            socket.join('user:' + key);
        } catch (e) { /* invalid token - ignore */ }
    });

    socket.on('create_room', ({ playerName, avatarId, username, betAmount, mobile, gameType, authToken }) => {
        if (socket.currentRoom && rooms.has(socket.currentRoom)) {
            return socket.emit('join_error', { message: 'Already connected to an active room.' });
        }
        socket.currentRoom = null;

        const bet = Math.abs(Number(betAmount)) || 100;
        const identity = resolveSocketIdentity(authToken, username || playerName, mobile);

        if (isUserBanned(identity.walletId)) {
            return socket.emit('join_error', { message: 'Aapka account ban hai. Match nahi khel sakte.' });
        }

        if (!wallet.checkBalance(identity.walletId, bet)) {
            return socket.emit('join_error', { message: `Insufficient coins! Need ${bet.toLocaleString()} coins.` });
        }

        const roomCode = diceToken.generateServerRoomCode(rooms);
        const hostPlayer = {
            socketId: socket.id,
            name: playerName || 'Host',
            username: identity.username || 'host',
            mobile: identity.mobile || '',
            walletId: identity.walletId,
            avatarId: Number(avatarId) || 1,
            color: 'red',
            isHost: true,
            disconnected: false,
            forfeited: false
        };

        const newRoom = {
            id: roomCode,
            hostId: socket.id,
            hostUsername: hostPlayer.username,
            betAmount: bet,
            gameType: gameType === 'quick' ? 'quick' : 'classic',
            status: 'lobby',
            players: [hostPlayer],
            currentTurnIndex: 0,
            boardState: null,
            totalPot: 0,
            payoutDone: false
        };

        rooms.set(roomCode, newRoom);
        socket.join(roomCode);
        socket.currentRoom = roomCode;

        socket.emit('room_created', { roomCode, roomData: sanitizeRoom(newRoom) });
    });

    socket.on('join_room', ({ roomCode, playerName, avatarId, username, mobile, authToken }) => {
        if (socket.currentRoom && rooms.has(socket.currentRoom)) {
            return socket.emit('join_error', { message: 'Already connected to an active room.' });
        }
        socket.currentRoom = null;

        const code = roomCode ? roomCode.toString().trim() : '';
        const room = rooms.get(code);

        if (!room) return socket.emit('join_error', { message: 'Room code not found.' });
        if (room.status !== 'lobby') return socket.emit('join_error', { message: 'Match already in progress.' });
        if (room.players.length >= 4) return socket.emit('join_error', { message: 'Room is full (Max 4).' });

        const identity = resolveSocketIdentity(authToken, username || playerName, mobile);

        const already = room.players.find(p =>
            (identity.walletId && p.walletId === identity.walletId) ||
            (identity.username && p.username === identity.username)
        );
        if (already) return socket.emit('join_error', { message: 'You are already in this room.' });

        if (isUserBanned(identity.walletId)) {
            return socket.emit('join_error', { message: 'Aapka account ban hai. Match nahi khel sakte.' });
        }

        if (!wallet.checkBalance(identity.walletId, room.betAmount)) {
            return socket.emit('join_error', { message: `Need ${room.betAmount.toLocaleString()} coins on server to join.` });
        }

        const usedColors = room.players.map(p => p.color);
        const assignedColor = ['red', 'green', 'yellow', 'blue'].find(c => !usedColors.includes(c));
        if (!assignedColor) return socket.emit('join_error', { message: 'Room is full (Max 4).' });

        const newPlayer = {
            socketId: socket.id,
            name: playerName || `Player ${room.players.length + 1}`,
            username: identity.username || `player_${room.players.length + 1}`,
            mobile: identity.mobile || '',
            walletId: identity.walletId,
            avatarId: Number(avatarId) || 2,
            color: assignedColor,
            isHost: false,
            disconnected: false,
            forfeited: false
        };

        room.players.push(newPlayer);
        socket.join(code);
        socket.currentRoom = code;

        io.to(code).emit('lobby_updated', { roomData: sanitizeRoom(room), roomCode: code });
    });

    socket.on('host_start_game', ({ roomCode }) => {
        const code = roomCode ? roomCode.toString().trim() : '';
        const room = rooms.get(code);
        if (!room || room.hostId !== socket.id) return;

        if (room.status !== 'lobby') return;
        if (room.players.length < 2) {
            return socket.emit('join_error', { message: 'Minimum 2 players required.' });
        }

        for (const p of room.players) {
            if (!wallet.checkBalance(playerIdentifier(p), room.betAmount)) {
                return io.to(code).emit('join_error', { message: `${p.name} does not have enough coins!` });
            }
        }

        const charged = [];
        let failedPlayer = null;
        for (const p of room.players) {
            const res = wallet.deductMatchEntryFee(playerIdentifier(p), room.betAmount, code);
            if (!res.success) { failedPlayer = p; break; }
            charged.push(p);
        }

        if (failedPlayer) {
            charged.forEach(p => wallet.refundMatchEntryFee(playerIdentifier(p), room.betAmount, code));
            return io.to(code).emit('join_error', { message: `${failedPlayer.name} does not have enough coins!` });
        }

        room.status = 'playing';
        room.boardState = diceToken.initRoomBoardState();
        room.currentTurnIndex = 0;
        room.totalPot = room.betAmount * room.players.length;
        room.payoutDone = false;
        room.feesCharged = true;
        room.turnSeq = 0;

        io.to(code).emit('start_multiplayer_game', {
            roomData: sanitizeRoom(room),
            betAmount: room.betAmount,
            firstTurn: room.players[0],
            yourColor: null
        });

        room.players.forEach(p => {
            io.to(p.socketId).emit('your_color', { color: p.color, roomCode: code });
        });

        startRoomTurnTimer(code);
    });

    socket.on('forfeit_match', ({ roomCode }) => {
        const code = (roomCode ? roomCode.toString().trim() : '') || socket.currentRoom;
        const room = rooms.get(code);
        socket.currentRoom = null;
        if (!room) return;

        const leavingPlayer = room.players.find(p => p.socketId === socket.id);
        if (!leavingPlayer) return;

        if (room.status === 'lobby') {
            handleLobbyLeave(socket, room, code);
            return;
        }
        forfeitMatchForPlayer(code, leavingPlayer, "Exited Match");
    });

    socket.on('reconnect_room', ({ roomCode, username, authToken }) => {
        const code = roomCode ? roomCode.toString().trim() : '';
        const room = rooms.get(code);
        if (!room || room.status !== 'playing') {
            return socket.emit('reconnect_failed', { message: 'Game has already concluded.' });
        }

        const identity = resolveSocketIdentity(authToken, username, '');

        const player = room.players.find(p =>
            (identity.walletId && p.walletId === identity.walletId) ||
            (p.username && p.username === identity.username) ||
            (p.mobile && p.mobile === username)
        );

        if (!player || player.forfeited) {
            return socket.emit('reconnect_failed', { message: 'Match forfeit time expired.' });
        }

        const timerKey = `${code}_${player.username}`;
        if (disconnectGraceTimers.has(timerKey)) {
            clearTimeout(disconnectGraceTimers.get(timerKey));
            disconnectGraceTimers.delete(timerKey);
        }

        player.socketId = socket.id;
        player.disconnected = false;
        if (player.isHost) room.hostId = socket.id;
        socket.join(code);
        socket.currentRoom = code;

        socket.emit('reconnect_success', {
            roomData: sanitizeRoom(room),
            boardState: room.boardState,
            yourColor: player.color,
            betAmount: room.betAmount,
            gameType: room.gameType,
            currentTurnColor: room.players[room.currentTurnIndex] ? room.players[room.currentTurnIndex].color : null,
            currentDiceValue: room.boardState.currentDiceValue,
            diceRolled: room.boardState.diceRolled
        });

        socket.to(code).emit('opponent_reconnected', {
            name: player.name,
            color: player.color
        });

        if (!roomTimers.has(code)) startRoomTurnTimer(code);
    });

    socket.on('request_server_dice_roll', ({ roomCode, color }) => {
        const code = (roomCode ? roomCode.toString().trim() : '') || socket.currentRoom;
        const room = rooms.get(code);
        if (!room || room.status !== 'playing') return;

        const activePlayer = room.players[room.currentTurnIndex];
        if (!activePlayer || activePlayer.color !== color || activePlayer.socketId !== socket.id) return;
        if (!isPlayerActive(room, activePlayer)) return;
        if (room.boardState.diceRolled) return;

        clearRoomTurnTimer(code);
        const { diceValue, isCancelled } = diceToken.rollServerDice(room);
        const movableTokens = diceToken.getServerMovableTokens(room, color, diceValue);

        io.to(code).emit('server_dice_rolled', {
            color,
            diceValue,
            movableTokens,
            isCancelled
        });

        if (movableTokens.length === 0 || isCancelled) {
            scheduleSwitch(code, 1200);
        } else {
            startRoomTurnTimer(code);
        }
    });

    socket.on('request_server_token_move', ({ roomCode, color, tokenIndex, steps }) => {
        const code = (roomCode ? roomCode.toString().trim() : '') || socket.currentRoom;
        const room = rooms.get(code);
        if (!room || room.status !== 'playing') return;

        const activePlayer = room.players[room.currentTurnIndex];
        if (!activePlayer || activePlayer.color !== color || activePlayer.socketId !== socket.id) return;
        if (!isPlayerActive(room, activePlayer)) return;
        if (!room.boardState.diceRolled) return;

        const idx = Number(tokenIndex);
        const movable = diceToken.getServerMovableTokens(room, color, room.boardState.currentDiceValue);
        if (!movable.includes(idx)) return;

        applyServerMove(code, color, idx, room.boardState.currentDiceValue);
    });

    socket.on('request_switch_turn', ({ roomCode }) => {
        const code = (roomCode ? roomCode.toString().trim() : '') || socket.currentRoom;
        const room = rooms.get(code);
        if (!room || room.status !== 'playing') return;

        const activePlayer = room.players[room.currentTurnIndex];
        if (!activePlayer || activePlayer.socketId !== socket.id) return;
        if (room.boardState.diceRolled) {
            const movable = diceToken.getServerMovableTokens(room, activePlayer.color, room.boardState.currentDiceValue);
            if (movable.length > 0) return;
        }
        switchNextTurnServer(code);
    });

    socket.on('admin_request_live_players', ({ adminToken }) => {
        try {
            const decoded = jwt.verify(adminToken, JWT_SECRET);
            if (decoded.role !== 'admin') return;

            const list = [];
            rooms.forEach((r, c) => list.push({
                id: c,
                status: r.status,
                betAmount: r.betAmount,
                players: r.players.map(p => ({
                    name: p.name, username: p.username, color: p.color,
                    disconnected: p.disconnected, forfeited: p.forfeited
                }))
            }));
            socket.emit('admin_live_players_data', list);
        } catch (e) {}
    });

    socket.on('leave_lobby', () => {
        const code = socket.currentRoom;
        const room = code ? rooms.get(code) : null;
        socket.currentRoom = null;
        if (room && room.status === 'lobby') handleLobbyLeave(socket, room, code);
    });

    socket.on('disconnect', () => {
        const roomCode = socket.currentRoom;
        if (!roomCode) return;
        const room = rooms.get(roomCode);
        socket.currentRoom = null;
        if (!room) return;

        if (room.status === 'lobby') {
            handleLobbyLeave(socket, room, roomCode);
            return;
        }

        if (room.status !== 'playing') return;

        const player = room.players.find(p => p.socketId === socket.id);
        if (!player || player.forfeited || player.disconnected) return;

        player.disconnected = true;

        io.to(roomCode).emit('opponent_disconnected', {
            color: player.color,
            name: player.name,
            graceSeconds: Math.round(DISCONNECT_GRACE_MS / 1000)
        });

        const isTheirTurn = room.players[room.currentTurnIndex] &&
            room.players[room.currentTurnIndex].username === player.username;

        if (isTheirTurn) {
            clearRoomTurnTimer(roomCode);
            setTimeout(() => autoPlayForActivePlayer(roomCode), 1500);
        } else if (!roomTimers.has(roomCode)) {
            startRoomTurnTimer(roomCode);
        }

        const timerKey = `${roomCode}_${player.username}`;
        if (disconnectGraceTimers.has(timerKey)) clearTimeout(disconnectGraceTimers.get(timerKey));

        const timeout = setTimeout(() => {
            disconnectGraceTimers.delete(timerKey);
            const stillRoom = rooms.get(roomCode);
            if (!stillRoom || stillRoom.status !== 'playing') return;
            const stillPlayer = stillRoom.players.find(p => p.username === player.username);
            if (!stillPlayer || !stillPlayer.disconnected || stillPlayer.forfeited) return;
            forfeitMatchForPlayer(roomCode, stillPlayer, "Connection Lost (60s Timed Out)");
        }, DISCONNECT_GRACE_MS);

        disconnectGraceTimers.set(timerKey, timeout);
    });
});

// ============================================================
// START SERVER
// ============================================================
const PORT = config.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Ludo Server running on: http://localhost:${PORT}`);
    console.log(`CORS allowed origins:`, allowedOrigins);
    startKeepAlivePinger();
});

// ============================================================
// FIX: KEEP-ALIVE SELF-PING (prevents Render free-tier spin-down)
// ============================================================
// Render's free tier spins the service down after ~15 minutes with no
// inbound HTTP request. This worker makes the running process request its
// own /ping endpoint at a random interval well inside that window, so the
// inbound hit keeps resetting Render's inactivity timer.
//
// Notes:
// - Only runs when RENDER_EXTERNAL_URL is present (Render sets this
//   automatically) OR SELF_PING_URL is set manually, so it never spams
//   localhost during local development.
// - Interval is randomized between 5 and 14 minutes (both under the 15
//   minute spin-down window) so the pings don't look like a fixed bot
//   pattern and so a single missed tick still leaves margin.
// - This is a *supplement*, not a total replacement for external
//   monitoring - see the GitHub Actions workflow provided alongside this
//   file for a second, independent keep-alive path.
const KEEP_ALIVE_MIN_MS = 5 * 60 * 1000;  // 5 minutes
const KEEP_ALIVE_MAX_MS = 14 * 60 * 1000; // 14 minutes

function getSelfPingUrl() {
    const explicit = process.env.SELF_PING_URL;
    const renderUrl = process.env.RENDER_EXTERNAL_URL; // auto-set by Render
    const base = explicit || renderUrl;
    if (!base) return null;
    return base.replace(/\/+$/, '') + '/ping';
}

function randomKeepAliveDelay() {
    return KEEP_ALIVE_MIN_MS + Math.floor(Math.random() * (KEEP_ALIVE_MAX_MS - KEEP_ALIVE_MIN_MS));
}

function startKeepAlivePinger() {
    const pingUrl = getSelfPingUrl();

    if (!pingUrl) {
        console.log('Keep-alive pinger disabled (no RENDER_EXTERNAL_URL / SELF_PING_URL set - assuming local dev).');
        return;
    }

    const scheduleNextPing = () => {
        const delay = randomKeepAliveDelay();
        setTimeout(async () => {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);
                const res = await fetch(pingUrl, { signal: controller.signal });
                clearTimeout(timeoutId);
                console.log(`Keep-alive self-ping OK (${res.status}) -> ${pingUrl}`);
            } catch (err) {
                console.warn('Keep-alive self-ping failed:', err.message);
            } finally {
                scheduleNextPing();
            }
        }, delay);
    };

    console.log(`Keep-alive pinger started for ${pingUrl} (5-14 min random interval).`);
    scheduleNextPing();
}