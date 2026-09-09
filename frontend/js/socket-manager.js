// frontend/js/socket-manager.js

// ============================================================
// BACKEND URL - Auto-detects Firebase Hosting
// ============================================================
const BACKEND_SERVER_URL = (function() {
    // Production: Firebase Hosting → Render Backend
    if (window.location.hostname.includes('web.app') || 
        window.location.hostname.includes('firebaseapp.com')) {
        return 'https://your-app-name.onrender.com'; // ← CHANGE THIS TO YOUR RENDER URL
    }
    
    // Local development
    if (window.location.port && window.location.port !== '3000') {
        return 'https://ludo-game-cojp.onrender.com';
    }
    if (window.location.origin && !window.location.origin.includes('file://')) {
        return window.location.origin;
    }
    return 'https://ludo-game-cojp.onrender.com';
})();

let socket = null;
window.currentRoomCode = null;
window.isMultiplayerGame = false;

// Toast for admin wallet updates
function showCoinToast(diff) {
    let el = document.getElementById('admin-coin-toast');
    if (!el) {
        el = document.createElement('div');
        el.id = 'admin-coin-toast';
        el.style.cssText = 'position:fixed;left:50%;top:86px;transform:translate(-50%,-140px);' +
            'background:rgba(20,22,30,.95);color:#fff;padding:11px 20px;border-radius:12px;' +
            'font-size:15px;font-weight:700;z-index:99999;transition:transform .3s;' +
            'box-shadow:0 8px 26px rgba(0,0,0,.5);pointer-events:none;';
        document.body.appendChild(el);
    }
    el.textContent = diff > 0
        ? `🪙 +${diff.toLocaleString()} coins mile!`
        : `🪙 ${diff.toLocaleString()} coins kate.`;
    el.style.color = diff > 0 ? '#7ee2a4' : '#ff8b8b';
    el.style.transform = 'translate(-50%, 0)';
    clearTimeout(window.__coinToastTimer);
    window.__coinToastTimer = setTimeout(() => {
        el.style.transform = 'translate(-50%, -140px)';
    }, 3200);
}

function initSocketConnection() {
    try {
        if (typeof io !== 'undefined') {
            socket = io(BACKEND_SERVER_URL, {
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionAttempts: 10,
                reconnectionDelay: 1000,
                timeout: 20000
            });
            
            socket.on('connect', () => {
                // ADMIN PORTAL LIVE SYNC
                const tk = localStorage.getItem('userToken');
                if (tk && !tk.startsWith('offline_token_')) {
                    socket.emit('identify_user', { authToken: tk });
                }

                const savedRoom = localStorage.getItem('active_multiplayer_room');
                const rawUser = localStorage.getItem('currentUser');
                if (savedRoom && rawUser) {
                    try {
                        const user = JSON.parse(rawUser);
                        socket.emit('reconnect_room', {
                            roomCode: savedRoom,
                            username: user.username || user.mobile,
                            authToken: localStorage.getItem('userToken') || null
                        });
                    } catch(e){}
                }
            });

            // ADMIN LIVE SYNC: wallet updated
            socket.on('wallet_updated', (data) => {
                if (!data) return;
                try {
                    const raw = localStorage.getItem('currentUser');
                    if (!raw) return;
                    const user = JSON.parse(raw);
                    const oldCoins = Number(user.coins || 0);

                    if (typeof data.coins === 'number') user.coins = data.coins;
                    if (typeof data.diamonds === 'number') user.diamonds = data.diamonds;
                    localStorage.setItem('currentUser', JSON.stringify(user));

                    const coinsEl = document.getElementById('display-user-coins');
                    const diaEl = document.getElementById('display-user-diamonds');
                    if (coinsEl) coinsEl.innerText = Number(user.coins || 0).toLocaleString();
                    if (diaEl) diaEl.innerText = Number(user.diamonds || 0).toLocaleString();

                    if (data.reason === 'admin') {
                        const diff = Number(user.coins || 0) - oldCoins;
                        if (diff !== 0) showCoinToast(diff);
                    }
                } catch (e) {}
            });

            socket.on('account_status_changed', (data) => {
                if (data && data.banned) {
                    alert('Aapka account ban kar diya gaya hai. Support se sampark karein.');
                }
            });

            socket.on('admin_broadcast', (data) => {
                if (data && data.message) alert('📢 ' + data.message);
            });

            socket.on('admin_kicked', (data) => {
                alert((data && data.message) || 'Aapka account ban kar diya gaya hai.');
                localStorage.removeItem('active_multiplayer_room');
                if (typeof showMainMenu === 'function') showMainMenu();
            });

            socket.on('room_disbanded', (data) => {
                alert((data && data.message) || 'Match admin dwara band kar diya gaya.');
                window.isMultiplayerGame = false;
                window.currentRoomCode = null;
                localStorage.removeItem('active_multiplayer_room');
                if (typeof showMainMenu === 'function') showMainMenu();
            });

            socket.on('connect_error', () => {
                if (typeof updateTurnStatus === 'function' && window.isMultiplayerGame) {
                    updateTurnStatus('⚠️ Server se connection nahi ho pa raha...');
                }
            });

            socket.on('disconnect', () => {
                if (window.isMultiplayerGame && typeof updateTurnStatus === 'function') {
                    updateTurnStatus('⚠️ Connection toot gaya. Dobara jud rahe hain...');
                }
            });

            registerLobbyListeners();
            registerServerGameListeners();
        }
    } catch (err) {
        console.warn("Socket initialization error:", err);
    }
}

function registerLobbyListeners() {
    if (!socket) return;
    
    socket.on('room_created', ({ roomCode, roomData }) => {
        window.currentRoomCode = roomCode;
        window.isMultiplayerGame = true;
        selectedGameTypeMode = roomData.gameType || 'classic';
        localStorage.setItem('active_multiplayer_room', roomCode);
        if (typeof openFriendsLobbyUI === 'function') {
            openFriendsLobbyUI(roomData, true);
        }
    });
    
    socket.on('lobby_updated', ({ roomData, roomCode }) => {
        window.currentRoomCode = roomCode;
        window.isMultiplayerGame = true;
        selectedGameTypeMode = roomData.gameType || 'classic';
        localStorage.setItem('active_multiplayer_room', roomCode);
        const isHost = socket.id === roomData.hostId;
        if (typeof openFriendsLobbyUI === 'function') {
            openFriendsLobbyUI(roomData, isHost);
        }
    });
    
    socket.on('room_disbanded', ({ message }) => {
        alert(message);
        localStorage.removeItem('active_multiplayer_room');
        if (typeof showMainMenu === 'function') showMainMenu();
    });
    
    socket.on('your_color', ({ color, roomCode }) => {
        window.myPlayerColor = color;
        window.selectedUserColor = color;
        if (roomCode) window.currentRoomCode = roomCode;
    });

    socket.on('board_sync', ({ tokens }) => {
        if (typeof applyBoardSync === 'function') applyBoardSync(tokens);
    });

    socket.on('start_multiplayer_game', ({ roomData, betAmount }) => {
        window.isMultiplayerGame = true;
        window.activeMatchBet = betAmount;
        currentGameMode = 'friends';
        selectedGameTypeMode = roomData.gameType || 'classic';
        localStorage.setItem('active_multiplayer_room', roomData.id);
        const lobby = document.getElementById('friends-lobby-view');
        if (lobby) lobby.style.display = 'none';
        if (typeof startGame === 'function') startGame(roomData);
    });
    
    socket.on('join_error', ({ message }) => {
        const err = document.getElementById('join-error-msg');
        if (err) { 
            err.innerText = message;
            err.style.display = 'block'; 
        } else {
            alert(message);
        }
    });

    socket.on('admin_live_players_data', (roomsData) => {
        if (typeof renderAdminLivePlayers === 'function') {
            renderAdminLivePlayers(roomsData);
        }
    });
}

function registerServerGameListeners() {
    if (!socket) return;
    
    socket.on('server_dice_rolled', ({ color, diceValue, movableTokens, isCancelled }) => {
        if (typeof handleServerDiceResult === 'function') {
            handleServerDiceResult(color, diceValue, movableTokens, isCancelled);
        }
    });
    
    socket.on('server_token_moved', ({ color, tokenIndex, steps, captured, isWinner, rank, hasExtraTurn }) => {
        if (typeof handleServerMoveResult === 'function') {
            handleServerMoveResult(color, tokenIndex, steps, captured, isWinner, rank, hasExtraTurn);
        }
    });
    
    socket.on('turn_switched', ({ nextPlayerColor, isDisconnected }) => {
        if (typeof handleServerTurnSwitched === 'function') {
            handleServerTurnSwitched(nextPlayerColor);
        }
        if (isDisconnected && typeof updateTurnStatus === 'function') {
            updateTurnStatus('⌛ Opponent disconnected hai - server auto-play kar raha hai...');
        }
    });

    socket.on('player_forfeited_continue', ({ color, name, reason, remainingCount }) => {
        clearInterval(window.reconnectCountdown);

        document.querySelectorAll(`.piece-${color}`).forEach(el => el.remove());
        if (typeof updateAllCellTokenCounts === 'function') updateAllCellTokenCounts();

        if (typeof tokensState !== 'undefined' && tokensState[color]) {
            tokensState[color] = [
                { pos: -1, stepCount: 0, status: 'base' },
                { pos: -1, stepCount: 0, status: 'base' },
                { pos: -1, stepCount: 0, status: 'base' },
                { pos: -1, stepCount: 0, status: 'base' }
            ];
        }

        const playerObj = playersList.find(p => p.color === color);
        if (playerObj) {
            playerObj.forfeited = true;
            const card = document.getElementById(playerObj.cardId);
            if (card) {
                card.classList.add('disabled-player');
                card.classList.remove('active-turn');
            }
        }

        if (typeof updateTurnStatus === 'function') {
            updateTurnStatus(`⚠️ ${name} left! (${remainingCount} players remaining)`);
        }
    });

    socket.on('opponent_disconnected', ({ name, graceSeconds }) => {
        let remaining = graceSeconds || 60;
        if (typeof updateTurnStatus === 'function') {
            updateTurnStatus(`⚠️ ${name} disconnected! Reconnecting... (${remaining}s)`);
        }
        clearInterval(window.reconnectCountdown);
        window.reconnectCountdown = setInterval(() => {
            remaining--;
            if (remaining > 0) {
                if (typeof updateTurnStatus === 'function') {
                    updateTurnStatus(`⚠️ ${name} disconnected! Reconnecting... (${remaining}s)`);
                }
            } else {
                clearInterval(window.reconnectCountdown);
            }
        }, 1000);
    });

    socket.on('opponent_reconnected', ({ name }) => {
        clearInterval(window.reconnectCountdown);
        if (typeof updateTurnStatus === 'function') {
            updateTurnStatus(`✅ ${name} reconnected! Game resumed.`);
        }
    });

    socket.on('reconnect_success', ({ roomData, boardState, yourColor, betAmount, gameType, currentTurnColor }) => {
        window.isMultiplayerGame = true;
        window.currentRoomCode = roomData.id;
        currentGameMode = 'friends';
        if (yourColor) {
            window.myPlayerColor = yourColor;
            window.selectedUserColor = yourColor;
        }
        if (betAmount) window.activeMatchBet = betAmount;
        selectedGameTypeMode = gameType || roomData.gameType || 'classic';
        localStorage.setItem('active_multiplayer_room', roomData.id);

        const setupPanel = document.getElementById('computer-setup-view');
        const friendsSetup = document.getElementById('friends-setup-view');
        const mainMenu = document.getElementById('main-menu-view');
        const gamePlay = document.getElementById('game-play-view');

        if (setupPanel) setupPanel.style.display = 'none';
        if (friendsSetup) friendsSetup.style.display = 'none';
        if (mainMenu) mainMenu.style.display = 'none';
        if (gamePlay) gamePlay.style.display = 'flex';

        if (typeof setupGameOrientation === 'function') {
            setupGameOrientation(window.selectedUserColor, roomData.players.length, roomData);
        }
        if (typeof generateBoardTracks === 'function') {
            generateBoardTracks();
        }

        if (boardState && boardState.tokens) {
            Object.keys(boardState.tokens).forEach(color => {
                if (tokensState[color]) {
                    boardState.tokens[color].forEach((tok, idx) => {
                        tokensState[color][idx] = { ...tok };
                        const tokenEl = document.getElementById(`token-${color}-${idx}`);
                        if (!tokenEl) return;

                        if (tok.status === 'board' && tok.stepCount > 50 && tok.stepCount < 56) {
                            const config = PLAYER_CONFIGS[color];
                            const homeCell = document.querySelector(`.${config.homePathPrefix}${tok.stepCount - 51}`);
                            if (homeCell) homeCell.appendChild(tokenEl);
                        } else if (tok.status === 'board' && tok.pos !== -1) {
                            const cell = document.getElementById(`path-cell-${tok.pos}`);
                            if (cell) cell.appendChild(tokenEl);
                        } else if (tok.status === 'home') {
                            const tri = document.getElementById(`home-triangle-${color}`);
                            if (tri) tri.appendChild(tokenEl);
                        } else {
                            const slot = document.getElementById(`slot-${color}-${idx}`);
                            if (slot) slot.appendChild(tokenEl);
                        }
                    });
                }
            });
            if (typeof updateAllCellTokenCounts === 'function') {
                updateAllCellTokenCounts();
            }
        }

        if (currentTurnColor && typeof handleServerTurnSwitched === 'function') {
            handleServerTurnSwitched(currentTurnColor);
        }

        if (typeof updateTurnStatus === 'function') {
            updateTurnStatus(`Reconnected successfully!`);
        }
    });

    socket.on('reconnect_failed', () => {
        localStorage.removeItem('active_multiplayer_room');
    });

    socket.on('match_finished', ({ winnerColor, winnerName, prize }) => {
        clearInterval(window.reconnectCountdown);
        localStorage.removeItem('active_multiplayer_room');
        const pot = prize || ((window.activeMatchBet || 100) * (playersList.length || 2));

        if (window.activeMoveInterval) {
            clearInterval(window.activeMoveInterval);
            window.activeMoveInterval = null;
        }
        window.isTokenAnimating = false;

        const finalColor = winnerColor ||
            (playersList.find(p => p.name === winnerName) || {}).color ||
            window.myPlayerColor || 'red';

        if (typeof showWinnerScreen === 'function') {
            showWinnerScreen(finalColor, pot);
        } else {
            const modal = document.getElementById('winner-modal-overlay');
            if (modal) modal.style.display = 'flex';
        }

        if (typeof updateTurnStatus === 'function') {
            updateTurnStatus(`🏆 Winner: ${winnerName}`);
        }
        window.isMultiplayerGame = false;
        window.currentRoomCode = null;

        if (typeof initUserSession === 'function') {
            setTimeout(initUserSession, 1000);
        }
    });
}

function adminFetchLivePlayers() {
    const adminToken = localStorage.getItem('adminToken');
    if (socket && adminToken) {
        socket.emit('admin_request_live_players', { adminToken });
    }
}

function requestServerDiceRoll(color) {
    if (socket && window.currentRoomCode) {
        socket.emit('request_server_dice_roll', { roomCode: window.currentRoomCode, color });
    }
}

function requestServerTokenMove(color, tokenIndex, steps) {
    if (socket && window.currentRoomCode) {
        socket.emit('request_server_token_move', { roomCode: window.currentRoomCode, color, tokenIndex, steps });
    }
}

function requestServerSwitchTurn() {
    if (socket && window.currentRoomCode) {
        socket.emit('request_switch_turn', { roomCode: window.currentRoomCode });
    }
}

function forfeitMultiplayerMatch(roomCode) {
    if (socket && roomCode) {
        socket.emit('forfeit_match', { roomCode });
    }
    window.isMultiplayerGame = false;
    window.currentRoomCode = null;
    localStorage.removeItem('active_multiplayer_room');
}

function createPrivateRoom(playerName, avatarId, username, betAmount = 100, mobile = '', gameType = 'classic') {
    if (!socket || !socket.connected) return alert("Server offline!");
    socket.emit('create_room', {
        playerName, avatarId, username, betAmount, mobile, gameType,
        authToken: localStorage.getItem('userToken') || null
    });
}

function joinPrivateRoom(roomCode, playerName, avatarId, username, userCoins = 0, mobile = '') {
    if (!socket || !socket.connected) return alert("Server offline!");
    socket.emit('join_room', {
        roomCode: roomCode.toString().trim(), playerName, avatarId, username, userCoins, mobile,
        authToken: localStorage.getItem('userToken') || null
    });
}

function hostStartMatchEmit(roomCode) {
    if (socket && roomCode) socket.emit('host_start_game', { roomCode });
}

function leaveFriendsLobbyEmit() {
    if (socket) socket.emit('leave_lobby');
    window.isMultiplayerGame = false;
    window.currentRoomCode = null;
    localStorage.removeItem('active_multiplayer_room');
}
