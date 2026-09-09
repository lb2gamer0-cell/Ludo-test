// backend/admin-routes.js
// Admin Portal ke saare API endpoints. server.js isko mount karta hai.

const express = require('express');
const jwt = require('jsonwebtoken');

const config = require('./config');
const db = require('./db');
const wallet = require('./wallet');

const JWT_SECRET = config.JWT_SECRET;

// Har admin route par token check
function requireAdmin(req, res, next) {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Admin token missing.' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin access only.' });
        req.admin = decoded;
        next();
    } catch (e) {
        return res.status(403).json({ success: false, message: 'Session expired. Dobara login karein.' });
    }
}

function safeUser(key, u) {
    return {
        key,
        id: u.id || key,
        name: u.name || '-',
        username: u.username || '-',
        mobile: u.mobile || '',
        coins: Number(u.coins || 0),
        diamonds: Number(u.diamonds || 0),
        level: Number(u.level || 1),
        provider: u.provider || '-',
        banned: Boolean(u.banned),
        createdAt: u.createdAt || null,
        updatedAt: u.updatedAt || null
    };
}

/**
 * @param {object} ctx  { rooms, io, activeSoloMatches }
 */
function createAdminRouter(ctx) {
    const router = express.Router();
    const { rooms, io, activeSoloMatches } = ctx;

    // ---------- DASHBOARD STATS ----------
    router.get('/stats', requireAdmin, (req, res) => {
        const database = db.readDB();
        const users = Object.entries(database.users || {});
        const tx = database.transactions || [];

        const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

        let liveRooms = 0, playingRooms = 0, playersOnline = 0;
        rooms.forEach(r => {
            liveRooms++;
            if (r.status === 'playing') playingRooms++;
            playersOnline += (r.players || []).filter(p => !p.disconnected && !p.forfeited).length;
        });

        const bets = tx.filter(t => t.type === 'BET_DEDUCTION');
        const prizes = tx.filter(t => t.type === 'WINNER_PRIZE_CREDIT');
        const sum = arr => arr.reduce((a, t) => a + Math.abs(Number(t.amount) || 0), 0);

        res.json({
            success: true,
            stats: {
                totalUsers: users.length,
                bannedUsers: users.filter(([, u]) => u.banned).length,
                newUsers24h: users.filter(([, u]) => (u.createdAt || 0) > dayAgo).length,
                activeUsers7d: users.filter(([, u]) => (u.updatedAt || 0) > weekAgo).length,
                totalCoins: users.reduce((a, [, u]) => a + Number(u.coins || 0), 0),
                totalDiamonds: users.reduce((a, [, u]) => a + Number(u.diamonds || 0), 0),
                liveRooms,
                playingRooms,
                playersOnline,
                soloMatches: activeSoloMatches ? activeSoloMatches.size : 0,
                totalMatches: bets.length,
                betVolume: sum(bets),
                prizePaid: sum(prizes),
                houseBalance: sum(bets) - sum(prizes),
                transactions: tx.length
            }
        });
    });

    // ---------- USER LIST (search + sort + pagination) ----------
    router.get('/users', requireAdmin, (req, res) => {
        const database = db.readDB();
        const q = (req.query.q || '').toString().trim().toLowerCase();
        const sort = (req.query.sort || 'updatedAt').toString();
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Number(req.query.limit) || 20);

        let list = Object.entries(database.users || {}).map(([k, u]) => safeUser(k, u));

        if (q) {
            list = list.filter(u =>
                u.username.toLowerCase().includes(q) ||
                u.name.toLowerCase().includes(q) ||
                String(u.mobile).includes(q) ||
                u.id.toLowerCase().includes(q)
            );
        }

        const dir = sort === 'coins' || sort === 'createdAt' || sort === 'updatedAt' ? -1 : 1;
        list.sort((a, b) => {
            const av = a[sort] ?? 0, bv = b[sort] ?? 0;
            if (typeof av === 'string') return av.localeCompare(bv) * (dir === -1 ? 1 : 1);
            return (av - bv) * dir;
        });

        const total = list.length;
        const start = (page - 1) * limit;

        res.json({
            success: true,
            total,
            page,
            pages: Math.max(1, Math.ceil(total / limit)),
            users: list.slice(start, start + limit)
        });
    });

    // ---------- SINGLE USER + uske transactions ----------
    router.get('/user/:key', requireAdmin, (req, res) => {
        const database = db.readDB();
        const key = db.findUserKeyIn(database, req.params.key);
        if (!key) return res.status(404).json({ success: false, message: 'User nahi mila.' });

        const user = safeUser(key, database.users[key]);
        const tx = (database.transactions || [])
            .filter(t => String(t.userId || '').toLowerCase() === String(user.username).toLowerCase() ||
                         String(t.userId || '').toLowerCase() === key)
            .slice(-50).reverse();

        res.json({ success: true, user, transactions: tx });
    });

    // ---------- WALLET ADJUST (add / remove) ----------
    router.post('/update-wallet', requireAdmin, (req, res) => {
        const { targetQuery, type, amount } = req.body || {};
        const num = Number(amount);
        if (!targetQuery) return res.status(400).json({ success: false, message: 'User select karein.' });
        if (!Number.isFinite(num) || num === 0) return res.status(400).json({ success: false, message: 'Amount galat hai.' });
        if (!['coins', 'diamonds'].includes(type)) return res.status(400).json({ success: false, message: 'Type coins ya diamonds hona chahiye.' });

        const result = wallet.adminModifyWallet(targetQuery, type, num);
        if (!result.success) return res.status(400).json(result);

        // LIVE SYNC: player abhi app me hai to uska balance turant update ho jaye
        const database = db.readDB();
        const key = db.findUserKeyIn(database, targetQuery);
        if (io && key) {
            io.to('user:' + key).emit('wallet_updated', {
                coins: Number(result.user.coins || 0),
                diamonds: Number(result.user.diamonds || 0),
                reason: 'admin'
            });
        }

        res.json({ success: true, user: safeUser(targetQuery, result.user) });
    });

    // ---------- BAN / UNBAN ----------
    router.post('/user/ban', requireAdmin, (req, res) => {
        const { targetQuery, banned } = req.body || {};
        const database = db.readDB();
        const key = db.findUserKeyIn(database, targetQuery);
        if (!key) return res.status(404).json({ success: false, message: 'User nahi mila.' });

        database.users[key].banned = Boolean(banned);
        database.users[key].updatedAt = Date.now();
        db.writeDBSync(database);

        // Ban/unban ki khabar us player ko turant do
        if (io) io.to('user:' + key).emit('account_status_changed', { banned: Boolean(banned) });

        // Agar ban kiya hai to us player ko live match se nikaal do
        if (banned && io) {
            rooms.forEach((room) => {
                (room.players || []).forEach(p => {
                    if (p.username === database.users[key].username || p.walletId === key) {
                        const sock = io.sockets.sockets.get(p.socketId);
                        if (sock) {
                            sock.emit('admin_kicked', { message: 'Aapka account admin dwara ban kar diya gaya hai.' });
                            sock.disconnect(true);
                        }
                    }
                });
            });
        }

        res.json({ success: true, banned: Boolean(banned) });
    });

    // ---------- LIVE ROOMS ----------
    router.get('/rooms', requireAdmin, (req, res) => {
        const list = [];
        rooms.forEach((r, code) => {
            list.push({
                code,
                status: r.status,
                gameType: r.gameType,
                betAmount: r.betAmount,
                pot: r.totalPot || (r.betAmount * (r.players || []).length),
                turnColor: (r.players && r.players[r.currentTurnIndex]) ? r.players[r.currentTurnIndex].color : '-',
                players: (r.players || []).map(p => ({
                    name: p.name, username: p.username, color: p.color,
                    isHost: p.isHost, disconnected: p.disconnected, forfeited: p.forfeited
                }))
            });
        });
        res.json({ success: true, rooms: list });
    });

    // ---------- ROOM FORCE CLOSE ----------
    router.post('/room/close', requireAdmin, (req, res) => {
        const { code, refund } = req.body || {};
        const room = rooms.get(String(code || '').trim());
        if (!room) return res.status(404).json({ success: false, message: 'Room nahi mila.' });

        if (refund && room.status === 'playing' && !room.payoutDone) {
            room.players.forEach(p => {
                wallet.refundMatchEntryFee(p.walletId || p.mobile || p.username, room.betAmount, room.id);
            });
            room.payoutDone = true;
        }

        if (io) io.to(room.id).emit('room_disbanded', { message: 'Match admin dwara band kar diya gaya.' });
        if (typeof ctx.destroyRoom === 'function') ctx.destroyRoom(room.id);
        else rooms.delete(room.id);

        res.json({ success: true, refunded: Boolean(refund) });
    });

    // ---------- TRANSACTIONS ----------
    router.get('/transactions', requireAdmin, (req, res) => {
        const database = db.readDB();
        const type = (req.query.type || '').toString();
        const limit = Math.min(300, Number(req.query.limit) || 100);

        let tx = (database.transactions || []).slice().reverse();
        if (type) tx = tx.filter(t => t.type === type);

        res.json({ success: true, total: tx.length, transactions: tx.slice(0, limit) });
    });

    // ---------- BROADCAST MESSAGE ----------
    router.post('/broadcast', requireAdmin, (req, res) => {
        const message = (req.body && req.body.message || '').toString().trim().slice(0, 200);
        if (!message) return res.status(400).json({ success: false, message: 'Message khali hai.' });
        if (io) io.emit('admin_broadcast', { message });
        res.json({ success: true, sentTo: io ? io.engine.clientsCount : 0 });
    });

    return router;
}

module.exports = { createAdminRouter, requireAdmin };
