// frontend/js/dice-manager.js

let currentTurnIndex = 0;
let isDiceRolling = false;
let isMovePending = false;
let hasRolledThisTurn = false;
let sixCountThisTurn = 0;

let playersList = [];
let currentTurnDiceRolls = [];
let consecutiveSixCount = 0;

let turnTimerInterval = null;
let turnTimeRemaining = 30;

function startTurnTimer() {
    clearTurnTimer();
    if (typeof currentGameMode !== 'undefined' && currentGameMode !== 'facetoface') return;

    turnTimeRemaining = 30;
    const activePlayer = playersList[currentTurnIndex];
    if (!activePlayer) return;

    turnTimerInterval = setInterval(() => {
        turnTimeRemaining--;
        if (typeof updateTurnStatus === 'function') {
            updateTurnStatus(`${activePlayer.name}: ${currentTurnDiceRolls.join(', ') || '-'} (${turnTimeRemaining}s)`);
        }
        if (turnTimeRemaining <= 0) {
            clearTurnTimer();
            handleTurnTimeout(activePlayer);
        }
    }, 1000);
}

function clearTurnTimer() {
    if (turnTimerInterval) {
        clearInterval(turnTimerInterval);
        turnTimerInterval = null;
    }
}

function handleTurnTimeout(player) {
    if (window.isTokenAnimating) return;

    if (!hasRolledThisTurn && !isDiceRolling && !isMovePending) {
        executeDiceRoll(player);
        return;
    }

    // FIX (bada bug): agar player dice roll kar chuka tha lekin goti nahi chali,
    // to timeout par kuch nahi hota tha aur face-to-face game hamesha ke liye
    // atak jata tha. Ab timeout par khud ek valid chaal chal di jati hai.
    if (isMovePending && typeof getMovableTokens === 'function') {
        const movable = getMovableTokens(player.color, currentDiceValue);
        if (movable.length > 0) {
            const idx = (typeof chooseBestBotToken === 'function')
                ? chooseBestBotToken(player.color, movable, currentDiceValue)
                : movable[0];
            isMovePending = false;
            clearHighlights();
            updateTurnStatus(`${player.name}: Time out! Auto move.`);
            executeLocalTokenTurn(player.color, idx, currentDiceValue);
        } else {
            nextTurn();
        }
        return;
    }

    nextTurn();
}

function render3DDiceCubes() {
    ['dice-container-0', 'dice-container-1', 'dice-container-2', 'dice-container-3'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
    });

    playersList.forEach(player => {
        const container = document.getElementById(player.containerId);
        if (!container) return;

        container.onclick = () => handleUserDiceClick(player.id);
        container.innerHTML = `
            <div class="cube" id="cube-${player.id}">
                <div class="cube__face cube__face--1"><div class="pip"></div></div>
                <div class="cube__face cube__face--2"><div class="pip"></div><div class="pip"></div></div>
                <div class="cube__face cube__face--3"><div class="pip"></div><div class="pip"></div><div class="pip"></div></div>
                <div class="cube__face cube__face--4"><div class="pip"></div><div class="pip"></div><div class="pip"></div><div class="pip"></div></div>
                <div class="cube__face cube__face--5"><div class="pip"></div><div class="pip"></div><div class="pip"></div><div class="pip"></div><div class="pip"></div></div>
                <div class="cube__face cube__face--6"><div class="pip"></div><div class="pip"></div><div class="pip"></div><div class="pip"></div><div class="pip"></div><div class="pip"></div></div>
            </div>
        `;
    });
}

function handleUserDiceClick(clickedPlayerId) {
    if (isDiceRolling || isMovePending || hasRolledThisTurn || window.isTokenAnimating) return;

    const activePlayer = playersList[currentTurnIndex];
    if (!activePlayer || activePlayer.id !== clickedPlayerId || activePlayer.type !== 'user') return;

    if (window.isMultiplayerGame) {
        hasRolledThisTurn = true;
        isDiceRolling = true;
        requestServerDiceRoll(activePlayer.color);

        // FIX: agar server ka jawab nahi aaya (network drop) to ye flags hamesha
        // ke liye lock ho jate the aur player dobara dice nahi chala pata tha.
        if (window.diceResponseTimer) clearTimeout(window.diceResponseTimer);
        window.diceResponseTimer = setTimeout(() => {
            if (isDiceRolling && !isMovePending && !window.isTokenAnimating) {
                isDiceRolling = false;
                hasRolledThisTurn = false;
                const cubeEl = document.getElementById(`cube-${activePlayer.id}`);
                if (cubeEl) cubeEl.classList.remove('rolling');
                updateTurnStatus('Server se jawab nahi mila. Dobara try karein.');
            }
        }, 8000);
    } else {
        executeDiceRoll(activePlayer);
    }
}

function executeDiceRoll(player, forcedValue = null) {
    if (!player) return;
    clearTurnTimer();

    isDiceRolling = true;
    hasRolledThisTurn = true;

    const cubeEl = document.getElementById(`cube-${player.id}`);
    if (cubeEl) cubeEl.classList.add('rolling');
    if (typeof playSound === 'function') playSound('roll');

    setTimeout(() => {
        const rolled = (forcedValue && forcedValue >= 1 && forcedValue <= 6)
            ? forcedValue
            : Math.floor(Math.random() * 6) + 1;

        if (rolled === 6) {
            consecutiveSixCount++;
            sixCountThisTurn++;
        } else {
            consecutiveSixCount = 0;
        }

        applyDiceAnimationAndLogic(player, rolled, consecutiveSixCount >= 3);
    }, 600);
}

function handleServerDiceResult(color, diceValue, movableTokens, isCancelled) {
    const player = playersList.find(p => p.color === color);
    if (!player) return;

    if (window.diceResponseTimer) {
        clearTimeout(window.diceResponseTimer);
        window.diceResponseTimer = null;
    }

    // FIX: server se aane wale 6 par sixCountThisTurn kabhi badhta hi nahi tha,
    // isliye multiplayer me "6 aaya, dobara roll" ka hisaab galat ho jata tha.
    if (diceValue === 6) sixCountThisTurn++;
    else sixCountThisTurn = 0;

    isDiceRolling = true;
    hasRolledThisTurn = true;
    const cubeEl = document.getElementById(`cube-${player.id}`);
    if (cubeEl) cubeEl.classList.add('rolling');
    if (typeof playSound === 'function') playSound('roll');

    setTimeout(() => {
        applyDiceAnimationAndLogic(player, diceValue, isCancelled, movableTokens);
    }, 600);
}

function chooseBestBotToken(color, movableIndices, steps) {
    if (movableIndices.length === 1) return movableIndices[0];

    const config = PLAYER_CONFIGS[color];

    for (let idx of movableIndices) {
        const tok = tokensState[color][idx];
        let targetPos = -1;
        if (tok.status === 'base' && steps === 6) {
            targetPos = config.startPos;
        } else if (tok.status === 'board' && tok.stepCount + steps <= 50) {
            targetPos = (config.startPos + tok.stepCount + steps) % 52;
        }
        if (targetPos !== -1 && !SAFE_POSITIONS.includes(targetPos)) {
            for (let oppColor of Object.keys(tokensState)) {
                if (oppColor !== color) {
                    if (tokensState[oppColor].some(t => t.status === 'board' && t.pos === targetPos)) {
                        return idx;
                    }
                }
            }
        }
    }

    for (let idx of movableIndices) {
        const tok = tokensState[color][idx];
        if (tok.status === 'board' && tok.stepCount + steps === 56) {
            return idx;
        }
    }

    if (steps === 6) {
        const baseIdx = movableIndices.find(idx => tokensState[color][idx].status === 'base');
        if (baseIdx !== undefined) return baseIdx;
    }

    let bestIdx = movableIndices[0];
    let maxSteps = -1;
    for (let idx of movableIndices) {
        const tok = tokensState[color][idx];
        if (tok.status === 'board' && tok.stepCount > maxSteps) {
            maxSteps = tok.stepCount;
            bestIdx = idx;
        }
    }
    return bestIdx;
}

function applyDiceAnimationAndLogic(player, diceValue, isCancelled, serverMovable = null) {
    currentDiceValue = diceValue;
    const cubeEl = document.getElementById(`cube-${player.id}`);
    if (cubeEl) {
        cubeEl.classList.remove('rolling');
        if (typeof DICE_3D_ROTATIONS !== 'undefined') {
            cubeEl.style.transform = `translateZ(-13px) ${DICE_3D_ROTATIONS[diceValue]}`;
        }
    }

    if (isCancelled) {
        updateTurnStatus(`⚠️ ${player.name}: 3 Sixes in a row! Turn Cancelled.`);
        setTimeout(nextTurn, 1000);
        return;
    }

    currentTurnDiceRolls.push(diceValue);
    updateTurnStatus(`${player.name}: ${currentTurnDiceRolls.join(', ')}`);

    const movable = serverMovable || getMovableTokens(player.color, diceValue);

    if (movable.length === 0) {
        setTimeout(() => {
            if (diceValue === 6 && sixCountThisTurn < 3) {
                hasRolledThisTurn = false;
                isDiceRolling = false;
                isMovePending = false;
                if (player.type === 'bot') {
                    updateTurnStatus(`${player.name}: 6 Aaya! Dusra roll ho raha hai...`);
                    setTimeout(() => executeDiceRoll(player), 800);
                } else {
                    updateTurnStatus(`${player.name}: 6 Aaya! Goti open nahi ho sakti, 1 roll aur karein.`);
                    if (currentGameMode === 'facetoface') startTurnTimer();
                }
            } else {
                nextTurn();
            }
        }, 1000);
    } else {
        if (player.type === 'user') {
            isMovePending = true;
            isDiceRolling = true;
            highlightMovableTokens(player.color, movable);
            if (movable.length === 1) {
                setTimeout(() => handleTokenClick(player.color, movable[0]), 350);
            }
        } else if (player.type === 'bot') {
            isMovePending = false;
            isDiceRolling = true;
            clearHighlights();

            setTimeout(() => {
                const bestTokenIndex = chooseBestBotToken(player.color, movable, diceValue);
                if (typeof executeLocalTokenTurn === 'function') {
                    executeLocalTokenTurn(player.color, bestTokenIndex, diceValue);
                }
            }, 700);
        }
    }
}

function nextTurn() {
    clearTurnTimer();
    isMovePending = false;
    isDiceRolling = false;
    hasRolledThisTurn = false;
    sixCountThisTurn = 0;
    window.isTokenAnimating = false;
    clearHighlights();
    currentTurnDiceRolls = [];
    consecutiveSixCount = 0;

    // FIX (bada bug): pehle har client apne aap se request_switch_turn bhejta
    // tha, jabki server bhi khud turn switch karta hai -> ek-ek turn skip ho
    // jata tha. Ab multiplayer me client sirf server ke 'turn_switched' ka
    // intezaar karta hai; request sirf tab jaati hai jab sach me meri turn ho.
    if (window.isMultiplayerGame) {
        const activePlayer = playersList[currentTurnIndex];
        const isMyTurn = activePlayer && window.myPlayerColor && activePlayer.color === window.myPlayerColor;
        if (isMyTurn && typeof requestServerSwitchTurn === 'function') {
            requestServerSwitchTurn();
        }
        return;
    }

    if (!playersList.length) return;

    // FIX: jo player apni saari gotiyan ghar pahucha chuka hai use bar-bar turn
    // milta rehta tha aur classic mode me game aage nahi badhta tha.
    let guard = 0;
    do {
        currentTurnIndex = (currentTurnIndex + 1) % playersList.length;
        guard++;
    } while (guard <= playersList.length && isPlayerFinished(playersList[currentTurnIndex]));

    activateCurrentPlayerTurn();
}

function isPlayerFinished(player) {
    if (!player || typeof tokensState === 'undefined' || !tokensState[player.color]) return false;
    return tokensState[player.color].every(t => t.status === 'home');
}

function handleServerTurnSwitched(nextPlayerColor) {
    const idx = playersList.findIndex(p => p.color === nextPlayerColor);
    // FIX: agar color list me na mile to currentTurnIndex -1 ho jata tha aur
    // poora turn system toot jata tha.
    if (idx === -1) return;
    currentTurnIndex = idx;
    activateCurrentPlayerTurn();
}

function activateCurrentPlayerTurn() {
    document.querySelectorAll('.player-card').forEach(c => c.classList.remove('active-turn'));
    const nextPlayer = playersList[currentTurnIndex];
    if (!nextPlayer) return;

    hasRolledThisTurn = false;
    isDiceRolling = false;
    isMovePending = false;
    sixCountThisTurn = 0;
    window.isTokenAnimating = false;

    const card = document.getElementById(nextPlayer.cardId);
    if (card) card.classList.add('active-turn');

    if (typeof updateActiveBaseHighlight === 'function') {
        updateActiveBaseHighlight(nextPlayer.color);
    }

    currentTurnDiceRolls = [];
    consecutiveSixCount = 0;

    // FIX: multiplayer me bot type ka koi player nahi hota, lekin purane game ka
    // playersList reh jane par bot auto-roll kar deta tha.
    if (nextPlayer.type === 'bot' && !window.isMultiplayerGame) {
        setTimeout(() => executeDiceRoll(nextPlayer), 900);
    } else if (currentGameMode === 'facetoface') {
        startTurnTimer();
    }
}
