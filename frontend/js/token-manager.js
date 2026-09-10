// frontend/js/token-manager.js

window.selectedUserColor = 'red';
window.isTokenAnimating = false;
let winnersList = [];
let currentDiceValue = 0;

const tokensState = {
    red:    [{ pos: -1, stepCount: 0, status: 'base' }, { pos: -1, stepCount: 0, status: 'base' }, { pos: -1, stepCount: 0, status: 'base' }, { pos: -1, stepCount: 0, status: 'base' }],
    green:  [{ pos: -1, stepCount: 0, status: 'base' }, { pos: -1, stepCount: 0, status: 'base' }, { pos: -1, stepCount: 0, status: 'base' }, { pos: -1, stepCount: 0, status: 'base' }],
    yellow: [{ pos: -1, stepCount: 0, status: 'base' }, { pos: -1, stepCount: 0, status: 'base' }, { pos: -1, stepCount: 0, status: 'base' }, { pos: -1, stepCount: 0, status: 'base' }],
    blue:   [{ pos: -1, stepCount: 0, status: 'base' }, { pos: -1, stepCount: 0, status: 'base' }, { pos: -1, stepCount: 0, status: 'base' }, { pos: -1, stepCount: 0, status: 'base' }]
};

function updateActiveBaseHighlight(color) {
    document.querySelectorAll('.ludo-base').forEach(base => base.classList.remove('active-base-turn'));
    if (color) {
        const target = document.querySelector(`.base-${color}`);
        if (target) target.classList.add('active-base-turn');
    }
}

function resetAllTokens() {
    winnersList = [];
    isMovePending = false;
    isDiceRolling = false;
    hasRolledThisTurn = false;
    sixCountThisTurn = 0;
    currentDiceValue = 0;
    window.isTokenAnimating = false;

    // FIX: purani move animation ka interval kabhi rukta hi nahi tha. Game exit
    // karne par bhi chalta rehta tha aur removed elements par error deta tha.
    if (window.activeMoveInterval) {
        clearInterval(window.activeMoveInterval);
        window.activeMoveInterval = null;
    }

    // FIX: winner overlay ki classes reset nahi hoti thi, isliye nayi game
    // shuru karne par screen par purana winner overlay chipka reh jata tha.
    const wOverlay = document.getElementById('winner-modal-overlay');
    const wSheet = document.getElementById('winner-bottom-sheet');
    if (wOverlay) { wOverlay.classList.remove('overlay-active'); wOverlay.style.display = 'none'; }
    if (wSheet) wSheet.classList.remove('sheet-active');

    Object.keys(tokensState).forEach(color => {
        tokensState[color] = [
            { pos: -1, stepCount: 0, status: 'base' },
            { pos: -1, stepCount: 0, status: 'base' },
            { pos: -1, stepCount: 0, status: 'base' },
            { pos: -1, stepCount: 0, status: 'base' }
        ];
    });

    document.querySelectorAll('.goti-piece').forEach(el => el.remove());
    document.querySelectorAll('.cell, .home-triangle').forEach(cell => cell.setAttribute('data-tokens', '0'));
    updateActiveBaseHighlight(null);
}

function getMovableTokens(color, diceNum) {
    const movable = [];
    tokensState[color].forEach((tok, idx) => {
        if (tok.status === 'base' && diceNum === 6) movable.push(idx);
        else if (tok.status === 'board' && (tok.stepCount + diceNum) <= 56) movable.push(idx);
    });
    return movable;
}

function highlightMovableTokens(color, movableIndices) {
    clearHighlights();
    movableIndices.forEach(idx => {
        const tokenEl = document.getElementById(`token-${color}-${idx}`);
        if (tokenEl) tokenEl.classList.add('token-movable');
    });
}

function clearHighlights() {
    document.querySelectorAll('.goti-piece').forEach(el => el.classList.remove('token-movable'));
}

function handleTokenClick(color, tokenIndex) {
    const activePlayer = playersList[currentTurnIndex];

    if (!isMovePending || window.isTokenAnimating) return;
    if (!activePlayer || activePlayer.type !== 'user') return;
    if (activePlayer.color !== color) return;

    const movable = getMovableTokens(color, currentDiceValue);
    if (!movable.includes(tokenIndex)) return;

    clearHighlights();
    isMovePending = false;
    isDiceRolling = true;

    if (window.isMultiplayerGame) {
        requestServerTokenMove(color, tokenIndex, currentDiceValue);
    } else {
        executeLocalTokenTurn(color, tokenIndex, currentDiceValue);
    }
}

function executeLocalTokenTurn(color, tokenIndex, steps) {
    const activePlayer = playersList[currentTurnIndex];

    // FIX: pehle bot ki chaal par bhi solo-step count hota tha, jisse server ka
    // anti-cheat move-count galat ho jata tha. Ab sirf asli user ki chaal ginti hai.
    if (currentGameMode === 'computer' && activePlayer && activePlayer.type === 'user') {
        const token = localStorage.getItem('userToken');
        if (token && !token.startsWith('offline_token_')) {
            fetch('/api/wallet/solo-step', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            }).catch(e => {});
        }
    }

    moveToken(color, tokenIndex, steps, () => {
        const movedTok = tokensState[color][tokenIndex];
        let captured = false;

        if (movedTok.status === 'board' && movedTok.pos !== -1 && !SAFE_POSITIONS.includes(movedTok.pos)) {
            Object.keys(tokensState).forEach(oppColor => {
                if (oppColor !== color) {
                    tokensState[oppColor].forEach((oppTok, oppIdx) => {
                        if (oppTok.status === 'board' && oppTok.pos === movedTok.pos) {
                            oppTok.status = 'base';
                            oppTok.pos = -1;
                            oppTok.stepCount = 0;

                            const slot = document.getElementById(`slot-${oppColor}-${oppIdx}`);
                            const el = document.getElementById(`token-${oppColor}-${oppIdx}`);
                            if (slot && el) slot.appendChild(el);
                            captured = true;
                        }
                    });
                }
            });
        }

        if (captured && typeof playSound === 'function') {
            playSound('capture');
        }

        const isQuick = (selectedGameTypeMode === 'quick');
        const isWinner = isQuick 
            ? tokensState[color].some(t => t.status === 'home') 
            : tokensState[color].every(t => t.status === 'home');

        if (isWinner) {
            const pot = (window.activeMatchBet || 100) * playersList.length;
            if (currentGameMode === 'computer' && activePlayer && activePlayer.type === 'user' && typeof creditWinningsToUser === 'function') {
                creditWinningsToUser(pot);
            }
            showWinnerScreen(color, currentGameMode === 'facetoface' ? 0 : pot);
            return;
        }

        const gotExtraRollFromSix = (steps === 6 && sixCountThisTurn < 3);
        const reachedHome = (movedTok.status === 'home');
        // FIX: jis player ki saari gotiyan ghar pahunch chuki hain use extra turn
        // dene se turn wahin atak jata tha.
        const allDone = tokensState[color].every(t => t.status === 'home');
        const hasExtraTurn = (gotExtraRollFromSix || captured || reachedHome) && !allDone;

        if (hasExtraTurn) {
            hasRolledThisTurn = false;
            isDiceRolling = false;
            isMovePending = false;

            if (activePlayer.type === 'bot') {
                if (captured) updateTurnStatus(`${activePlayer.name}: Goti Kaati! Ek roll aur mila.`);
                else if (reachedHome) updateTurnStatus(`${activePlayer.name}: Goti Ghar Pahuchi! Ek roll aur mila.`);
                else if (gotExtraRollFromSix) updateTurnStatus(`${activePlayer.name}: 6 Aaya! Dusra roll ho raha hai...`);
                setTimeout(() => executeDiceRoll(activePlayer), 800);
            } else {
                if (captured) updateTurnStatus(`${activePlayer.name}: Goti Kaati! Ek roll aur karein.`);
                else if (reachedHome) updateTurnStatus(`${activePlayer.name}: Goti Ghar Pahuchi! Ek roll aur karein.`);
                else if (gotExtraRollFromSix) updateTurnStatus(`${activePlayer.name}: 6 Aaya! Dusra roll karein.`);
                if (currentGameMode === 'facetoface') startTurnTimer();
            }
        } else {
            nextTurn();
        }
    });
}

function handleServerMoveResult(color, tokenIndex, steps, captured, isWinner, rank, hasExtraTurn) {
    moveToken(color, tokenIndex, steps, () => {
        if (captured && tokensState[captured.color] && tokensState[captured.color][captured.tokenIndex]) {
            const oppTok = tokensState[captured.color][captured.tokenIndex];
            oppTok.status = 'base';
            oppTok.pos = -1;
            oppTok.stepCount = 0;
            const slot = document.getElementById(`slot-${captured.color}-${captured.tokenIndex}`);
            const el = document.getElementById(`token-${captured.color}-${captured.tokenIndex}`);
            if (slot && el) slot.appendChild(el);
            if (typeof playSound === 'function') playSound('capture');
            // FIX: capture ke baad cell counts update nahi hote the, isliye cell
            // par purana stacked-token number dikhta rehta tha.
            updateAllCellTokenCounts();
        }

        if (isWinner && rank === 1) {
            // Winner screen server ke 'match_finished' se aayegi (asli prize ke saath)
            hasRolledThisTurn = false;
            isDiceRolling = false;
            isMovePending = false;
            return;
        }

        // FIX (bada bug): pehle yahan se nextTurn() call hota tha jo server ko
        // request_switch_turn bhejta tha, jabki server khud hi turn switch kar
        // chuka hota tha -> har move par ek turn skip ho jata tha.
        // Ab multiplayer me turn hamesha server ke 'turn_switched' se badalta hai.
        hasRolledThisTurn = false;
        isDiceRolling = false;
        isMovePending = false;
        clearHighlights();

        if (hasExtraTurn && window.myPlayerColor === color) {
            if (typeof updateTurnStatus === 'function') {
                updateTurnStatus('Aapko ek aur chaal mili! Dice rolls karein.');
            }
        }
    });
}

// FIX: naya function - server har turn ke baad authoritative board bhejta hai,
// jisse client ka board kabhi desync na ho (pehle animation miss hone par
// dono taraf ka board alag ho jata tha).
function applyBoardSync(serverTokens) {
    if (!serverTokens) return;
    if (window.isTokenAnimating) return;

    Object.keys(serverTokens).forEach(color => {
        if (!tokensState[color]) return;
        serverTokens[color].forEach((srvTok, idx) => {
            const localTok = tokensState[color][idx];
            if (!localTok) return;
            if (localTok.stepCount === srvTok.stepCount && localTok.status === srvTok.status) return;

            localTok.stepCount = srvTok.stepCount;
            localTok.status = srvTok.status;
            localTok.pos = srvTok.pos;

            const tokenEl = document.getElementById(`token-${color}-${idx}`);
            if (!tokenEl) return;
            const config = PLAYER_CONFIGS[color];

            if (srvTok.status === 'base') {
                const slot = document.getElementById(`slot-${color}-${idx}`);
                if (slot) slot.appendChild(tokenEl);
            } else if (srvTok.status === 'home') {
                const tri = document.getElementById(`home-triangle-${color}`);
                if (tri) tri.appendChild(tokenEl);
            } else if (srvTok.stepCount <= 50) {
                const cell = document.getElementById(`path-cell-${(config.startPos + srvTok.stepCount) % 52}`);
                if (cell) cell.appendChild(tokenEl);
            } else {
                const homeCell = document.querySelector(`.${config.homePathPrefix}${srvTok.stepCount - 51}`);
                if (homeCell) homeCell.appendChild(tokenEl);
            }
        });
    });

    updateAllCellTokenCounts();
}

function moveToken(color, tokenIndex, steps, onComplete = null) {
    const token = tokensState[color][tokenIndex];
    const config = PLAYER_CONFIGS[color];
    const tokenEl = document.getElementById(`token-${color}-${tokenIndex}`);

    window.isTokenAnimating = true;

    if (token.status === 'base' && steps === 6) {
        token.status = 'board';
        token.pos = config.startPos;
        token.stepCount = 0;
        const cell = document.getElementById(`path-cell-${config.startPos}`);
        if (cell && tokenEl) cell.appendChild(tokenEl);
        updateAllCellTokenCounts();
        if (typeof playSound === 'function') playSound('move');
        window.isTokenAnimating = false;
        if (onComplete) onComplete();
        return;
    }

    // FIX: agar pehli animation abhi chal rahi hai to use rok do, warna do
    // interval ek saath chalte the aur token do jagah teleport hota tha.
    if (window.activeMoveInterval) {
        clearInterval(window.activeMoveInterval);
        window.activeMoveInterval = null;
    }

    let remaining = steps;
    const interval = setInterval(() => {
        // FIX: game beech me chhod dene par element hat jata tha aur interval
        // error throw karta rehta tha.
        if (!document.body.contains(tokenEl)) {
            clearInterval(interval);
            window.activeMoveInterval = null;
            window.isTokenAnimating = false;
            return;
        }

        if (remaining <= 0) {
            clearInterval(interval);
            window.activeMoveInterval = null;
            window.isTokenAnimating = false;
            updateAllCellTokenCounts();
            if (onComplete) onComplete();
            return;
        }

        token.stepCount++;
        remaining--;

        if (token.stepCount <= 50) {
            token.pos = (config.startPos + token.stepCount) % 52;
            const target = document.getElementById(`path-cell-${token.pos}`);
            if (target && tokenEl) target.appendChild(tokenEl);
        } else if (token.stepCount < 56) {
            // FIX (bada bug): home column me ghusne par token.pos purani ring
            // wali value par atka reh jata tha. Isse home column me baithi goti
            // par bhi "capture" lag jata tha aur server se board desync hota tha.
            token.pos = -1;
            const homeCell = document.querySelector(`.${config.homePathPrefix}${token.stepCount - 51}`);
            if (homeCell && tokenEl) homeCell.appendChild(tokenEl);
        } else if (token.stepCount === 56) {
            token.status = 'home';
            token.pos = -1;
            const tri = document.getElementById(`home-triangle-${color}`);
            if (tri && tokenEl) {
                tri.appendChild(tokenEl);
            }
        }

        updateAllCellTokenCounts();
        if (typeof playSound === 'function') playSound('move');
    }, 180);

    window.activeMoveInterval = interval;
}

function showWinnerScreen(color, pot = 0) {
    const overlay = document.getElementById('winner-modal-overlay');
    const sheet = document.getElementById('winner-bottom-sheet');
    const dynamicBody = document.getElementById('winner-dynamic-body');
    const prizeBanner = document.getElementById('winner-prize-banner');
    const prizeAmt = document.getElementById('winner-prize-amount');

    if (!overlay || !sheet || !dynamicBody) return;

    if (typeof playSound === 'function') {
        playSound('win');
    }

    if (pot > 0 && prizeBanner && prizeAmt) {
        prizeAmt.innerText = `+${pot.toLocaleString()}`;
        prizeBanner.style.display = 'flex';
    } else if (prizeBanner) {
        prizeBanner.style.display = 'none';
    }

    // FIX: multiplayer me kabhi-kabhi winner color playersList me nahi milta tha
    // (forfeit ke baad) aur poora winner screen crash ho jata tha.
    const winnerPlayer = playersList.find(p => p.color === color) ||
        playersList[0] ||
        { color: color, name: 'Player', type: 'bot' };

    const remainingPlayers = playersList.filter(p => p.color !== color);
    remainingPlayers.sort((a, b) => {
        const homeA = tokensState[a.color].filter(t => t.status === 'home').length;
        const homeB = tokensState[b.color].filter(t => t.status === 'home').length;
        if (homeB !== homeA) return homeB - homeA;
        const stepsA = tokensState[a.color].reduce((sum, t) => sum + t.stepCount, 0);
        const stepsB = tokensState[b.color].reduce((sum, t) => sum + t.stepCount, 0);
        return stepsB - stepsA;
    });

    // FIX: agar kisi player ka name undefined ho to poora winner screen crash
    // hota tha (p.name.startsWith). Ab har entry safe ki jati hai.
    const safePlayer = (p, fallbackColor) => ({
        color: (p && p.color) || fallbackColor || 'red',
        name: (p && p.name) ? String(p.name) : 'Player',
        type: (p && p.type) || 'bot'
    });

    let rankedPlayers = [winnerPlayer, ...remainingPlayers].map(p => safePlayer(p));

    // FIX: 3/4-player layout p2/p3 ke bina crash ho jata tha (jab opponent
    // forfeit karke list se nikal jate the).
    if (rankedPlayers.length === 0) rankedPlayers = [safePlayer(null, color)];

    const getAvatarInfo = (player) => {
        if (player.type === 'user') {
            try {
                const u = JSON.parse(localStorage.getItem('currentUser') || '{}');
                return (typeof AVATAR_PRESETS !== 'undefined' && AVATAR_PRESETS[u.avatarId]) 
                    ? AVATAR_PRESETS[u.avatarId] 
                    : { icon: '👑', bgClass: 'av-bg-1' };
            } catch(e) {}
        }
        const avatarMap = { red: 1, green: 2, yellow: 5, blue: 3 };
        const id = avatarMap[player.color] || 8;
        return (typeof AVATAR_PRESETS !== 'undefined' && AVATAR_PRESETS[id]) 
            ? AVATAR_PRESETS[id] 
            : { icon: '👤', bgClass: 'av-bg-8' };
    };

    if (rankedPlayers.length <= 2) {
        const p1 = rankedPlayers[0];
        const p2 = rankedPlayers[1] || safePlayer(null, 'blue');
        const av1 = getAvatarInfo(p1);
        const av2 = getAvatarInfo(p2);

        dynamicBody.innerHTML = `
            <div class="h2h-container">
                <div class="h2h-card h2h-winner">
                    <div class="h2h-profile">
                        <div class="h2h-avatar-wrap">
                            <span class="h2h-crown-badge">👑</span>
                            <div class="circle-avatar ${av1.bgClass}">
                                <span>${av1.icon}</span>
                            </div>
                            <span class="goti-color-badge color-${p1.color}"></span>
                        </div>
                        <div class="h2h-name-info">
                            <span class="h2h-fullname">${p1.name}</span>
                            <span class="h2h-username">${p1.name.startsWith('@') ? p1.name : '@' + p1.color}</span>
                        </div>
                    </div>
                    <span class="h2h-badge badge-win">WINNER 🏆</span>
                </div>

                <div class="h2h-card h2h-loser">
                    <div class="h2h-profile">
                        <div class="h2h-avatar-wrap">
                            <div class="circle-avatar ${av2.bgClass}">
                                <span>${av2.icon}</span>
                            </div>
                            <span class="goti-color-badge color-${p2.color}"></span>
                        </div>
                        <div class="h2h-name-info">
                            <span class="h2h-fullname">${p2.name}</span>
                            <span class="h2h-username">${p2.name.startsWith('@') ? p2.name : '@' + p2.color}</span>
                        </div>
                    </div>
                    <span class="h2h-badge badge-loss">RUNNER UP</span>
                </div>
            </div>
        `;
    } else {
        const p1 = rankedPlayers[0];
        const p2 = rankedPlayers[1] || safePlayer(null, 'green');
        const p3 = rankedPlayers[2] || safePlayer(null, 'yellow');
        const p4 = rankedPlayers[3] || null;

        const av1 = getAvatarInfo(p1);
        const av2 = getAvatarInfo(p2);
        const av3 = getAvatarInfo(p3);

        let fourthHtml = '';
        if (p4) {
            const av4 = getAvatarInfo(p4);
            fourthHtml = `
                <div class="fourth-player-row">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 11px; font-weight: 800; color: #94a3b8;">#4</span>
                        <div class="circle-avatar ${av4.bgClass}" style="width: 28px; height: 28px; font-size: 14px;">
                            <span>${av4.icon}</span>
                        </div>
                        <span style="font-size: 11.5px; font-weight: 700; color: #ffffff;">${p4.name}</span>
                    </div>
                    <span style="font-size: 10px; color: #94a3b8; font-weight: 700;">4th Place</span>
                </div>
            `;
        }

        dynamicBody.innerHTML = `
            <div class="podium-container">
                <div class="podium-column podium-pos-2">
                    <div class="podium-avatar-box">
                        <div class="circle-avatar ${av2.bgClass} podium-avatar">
                            <span>${av2.icon}</span>
                        </div>
                        <span class="goti-color-badge color-${p2.color}"></span>
                    </div>
                    <span class="podium-player-name">${p2.name}</span>
                    <div class="podium-bar bar-rank-2">
                        <span class="podium-rank-num">2</span>
                        <span class="podium-rank-label">ND</span>
                    </div>
                </div>

                <div class="podium-column podium-pos-1">
                    <div class="podium-avatar-box">
                        <span class="podium-crown">👑</span>
                        <div class="circle-avatar ${av1.bgClass} podium-avatar">
                            <span>${av1.icon}</span>
                        </div>
                        <span class="goti-color-badge color-${p1.color}"></span>
                    </div>
                    <span class="podium-player-name">${p1.name}</span>
                    <div class="podium-bar bar-rank-1">
                        <span class="podium-rank-num">1</span>
                        <span class="podium-rank-label">ST</span>
                    </div>
                </div>

                <div class="podium-column podium-pos-3">
                    <div class="podium-avatar-box">
                        <div class="circle-avatar ${av3.bgClass} podium-avatar">
                            <span>${av3.icon}</span>
                        </div>
                        <span class="goti-color-badge color-${p3.color}"></span>
                    </div>
                    <span class="podium-player-name">${p3.name}</span>
                    <div class="podium-bar bar-rank-3">
                        <span class="podium-rank-num">3</span>
                        <span class="podium-rank-label">RD</span>
                    </div>
                </div>
            </div>
            ${fourthHtml}
        `;
    }

    overlay.style.display = 'flex';
    requestAnimationFrame(() => {
        overlay.classList.add('overlay-active');
        sheet.classList.add('sheet-active');
    });
}
