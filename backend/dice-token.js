// backend/dice-token.js
// ==========================================================================
// SECTION 1: SERVER-AUTHORITATIVE DICE & BOARD ENGINE
// ==========================================================================
const SAFE_POSITIONS = [0, 8, 13, 21, 26, 34, 39, 47];

const PLAYER_CONFIGS = {
    red:    { startPos: 0,  homePathPrefix: 'home-red-' },
    green:  { startPos: 13, homePathPrefix: 'home-green-' },
    yellow: { startPos: 26, homePathPrefix: 'home-yellow-' },
    blue:   { startPos: 39, homePathPrefix: 'home-blue-' }
};

// FIX: pehle code collision check nahi hota tha - do rooms ka same code ban
// sakta tha aur dusra room pehle wale ko Map me overwrite kar deta tha.
function generateServerRoomCode(existingRooms = null) {
    for (let attempt = 0; attempt < 50; attempt++) {
        const code = `00${Math.floor(100000 + Math.random() * 900000)}`;
        if (!existingRooms || !existingRooms.has(code)) return code;
    }
    return `00${Date.now().toString().slice(-6)}`;
}

function initRoomBoardState() {
    return {
        tokens: {
            red:    [{ pos: -1, stepCount: 0, status: 'base' }, { pos: -1, stepCount: 0, status: 'base' }, { pos: -1, stepCount: 0, status: 'base' }, { pos: -1, stepCount: 0, status: 'base' }],
            green:  [{ pos: -1, stepCount: 0, status: 'base' }, { pos: -1, stepCount: 0, status: 'base' }, { pos: -1, stepCount: 0, status: 'base' }, { pos: -1, stepCount: 0, status: 'base' }],
            yellow: [{ pos: -1, stepCount: 0, status: 'base' }, { pos: -1, stepCount: 0, status: 'base' }, { pos: -1, stepCount: 0, status: 'base' }, { pos: -1, stepCount: 0, status: 'base' }],
            blue:   [{ pos: -1, stepCount: 0, status: 'base' }, { pos: -1, stepCount: 0, status: 'base' }, { pos: -1, stepCount: 0, status: 'base' }, { pos: -1, stepCount: 0, status: 'base' }]
        },
        currentDiceValue: 0,
        diceRolled: false,
        consecutiveSixes: 0,
        winners: []
    };
}

function rollServerDice(room, forcedValue = null) {
    if (forcedValue !== null && forcedValue >= 1 && forcedValue <= 6) {
        room.boardState.currentDiceValue = forcedValue;
    } else {
        room.boardState.currentDiceValue = Math.floor(Math.random() * 6) + 1;
    }

    room.boardState.diceRolled = true;

    if (room.boardState.currentDiceValue === 6) {
        room.boardState.consecutiveSixes++;
    } else {
        room.boardState.consecutiveSixes = 0;
    }

    const isCancelled = room.boardState.consecutiveSixes >= 3;
    if (isCancelled) {
        room.boardState.consecutiveSixes = 0;
        room.boardState.diceRolled = false;
        room.boardState.currentDiceValue = 0;
    }

    return {
        diceValue: room.boardState.currentDiceValue,
        isCancelled
    };
}

function getServerMovableTokens(room, color, diceValue) {
    const movable = [];
    const tokens = room.boardState.tokens[color];
    if (!tokens) return movable;

    tokens.forEach((tok, idx) => {
        if (tok.status === 'base' && diceValue === 6) {
            movable.push(idx);
        } else if (tok.status === 'board' && (tok.stepCount + diceValue) <= 56) {
            movable.push(idx);
        }
    });
    return movable;
}

// FIX: server par turn skip karte waqt ye check chahiye tha - jo player apni
// saari gotiyan ghar pahucha chuka hai use aur turn nahi milna chahiye.
function hasFinishedAllTokens(room, color) {
    const tokens = room.boardState && room.boardState.tokens ? room.boardState.tokens[color] : null;
    if (!tokens) return false;
    return tokens.every(t => t.status === 'home');
}

function executeServerTokenMove(room, color, tokenIndex, steps) {
    const token = room.boardState.tokens[color][tokenIndex];
    if (!token) return { valid: false };

    if (steps !== room.boardState.currentDiceValue) {
        return { valid: false, message: "Step mismatch with dice." };
    }

    const config = PLAYER_CONFIGS[color];
    let capturedOpponent = null;
    let reachedHome = false;

    if (token.status === 'base' && steps === 6) {
        token.status = 'board';
        token.pos = config.startPos;
        token.stepCount = 0;
    } else if (token.status === 'board') {
        if (token.stepCount + steps > 56) {
            return { valid: false, message: "Move exceeds destination." };
        }

        token.stepCount += steps;

        if (token.stepCount === 56) {
            token.status = 'home';
            token.pos = -1;
            reachedHome = true;
        } else if (token.stepCount <= 50) {
            token.pos = (config.startPos + token.stepCount) % 52;
        } else {
            // Home column (51-55): common track par nahi hai, isliye pos = -1
            token.pos = -1;
        }
    } else {
        return { valid: false, message: "Invalid token state." };
    }

    room.boardState.diceRolled = false;
    room.boardState.currentDiceValue = 0;

    if (token.pos !== -1 && !SAFE_POSITIONS.includes(token.pos)) {
        for (const oppColor in room.boardState.tokens) {
            if (oppColor !== color) {
                room.boardState.tokens[oppColor].forEach((oppTok, oppIdx) => {
                    if (oppTok.status === 'board' && oppTok.pos === token.pos) {
                        oppTok.status = 'base';
                        oppTok.pos = -1;
                        oppTok.stepCount = 0;
                        capturedOpponent = { color: oppColor, tokenIndex: oppIdx };
                    }
                });
            }
        }
    }

    // SERVER WIN CHECK: Quick Mode me 1 goti, Classic me 4 gotiyan
    const isQuick = (room.gameType === 'quick');
    const hasWon = isQuick
        ? room.boardState.tokens[color].some(t => t.status === 'home')
        : room.boardState.tokens[color].every(t => t.status === 'home');

    const isWinner = hasWon && !room.boardState.winners.includes(color);
    if (isWinner) {
        room.boardState.winners.push(color);
    }

    const hasExtraTurn = steps === 6 || Boolean(capturedOpponent) || reachedHome;

    return {
        valid: true,
        updatedToken: token,
        capturedOpponent,
        isWinner,
        rank: room.boardState.winners.length,
        hasExtraTurn
    };
}

module.exports = {
    SAFE_POSITIONS,
    PLAYER_CONFIGS,
    generateServerRoomCode,
    initRoomBoardState,
    rollServerDice,
    getServerMovableTokens,
    hasFinishedAllTokens,
    executeServerTokenMove
};
