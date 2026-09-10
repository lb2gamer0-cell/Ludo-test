// backend/daily-reward.js
// ==========================================================================
// DAILY LOGIN REWARD ENGINE (SERVER AUTHORITATIVE)
// Day 1..7 -> 500, 1000, 1500, 2000, 2500, 3000, 5000
// Ek din me sirf ek baar claim ho sakta hai. Din IST (Asia/Kolkata) ke
// hisaab se badalta hai, client ki device clock par bharosa nahi kiya jata.
// ==========================================================================

const db = require('./db');

const DAILY_REWARDS = [500, 1000, 1500, 2000, 2500, 3000, 5000];
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function istDayString(ts = Date.now()) {
    return new Date(ts + IST_OFFSET_MS).toISOString().split('T')[0];
}

function istDayNumber(ts = Date.now()) {
    return Math.floor((ts + IST_OFFSET_MS) / 86400000);
}

// Agla IST midnight epoch ms me
function nextResetTs(ts = Date.now()) {
    return (istDayNumber(ts) + 1) * 86400000 - IST_OFFSET_MS;
}

function readState(user) {
    const raw = user && user.dailyReward ? user.dailyReward : {};
    return {
        lastClaimDate: raw.lastClaimDate || null,
        lastClaimDayNum: Number(raw.lastClaimDayNum || 0),
        streak: Number(raw.streak || 0),
        totalClaimed: Number(raw.totalClaimed || 0)
    };
}

// Aaj konsa din slot milega (1..7) - claim kiye bina
function computeNextDayIndex(state, now = Date.now()) {
    const todayNum = istDayNumber(now);
    if (!state.lastClaimDayNum) return 1;
    if (todayNum - state.lastClaimDayNum === 1) {
        // lagatar din -> streak aage badhega, 7 ke baad wapas 1
        return (state.streak % DAILY_REWARDS.length) + 1;
    }
    if (todayNum - state.lastClaimDayNum > 1) return 1; // streak toot gayi
    return state.streak || 1; // aaj already claim ho chuka
}

function getStatus(identifier) {
    const database = db.readDB();
    const key = db.findUserKeyIn(database, identifier);
    if (!key) return { success: false, message: 'User account not found.' };

    const user = database.users[key];
    const state = readState(user);
    const now = Date.now();
    const today = istDayString(now);
    const alreadyClaimed = state.lastClaimDate === today;
    const dayIndex = computeNextDayIndex(state, now);

    return {
        success: true,
        rewards: DAILY_REWARDS,
        dayIndex,
        streak: state.streak,
        alreadyClaimed,
        amount: DAILY_REWARDS[dayIndex - 1],
        nextResetAt: nextResetTs(now),
        serverTime: now,
        coins: Number(user.coins || 0)
    };
}

function claim(identifier) {
    const database = db.readDB();
    const key = db.findUserKeyIn(database, identifier);
    if (!key) return { success: false, message: 'User account not found. Please login again.' };

    const user = database.users[key];
    const state = readState(user);
    const now = Date.now();
    const today = istDayString(now);

    if (state.lastClaimDate === today) {
        return {
            success: false,
            alreadyClaimed: true,
            message: 'Aaj ka reward already claim ho chuka hai. Kal phir aayein.',
            nextResetAt: nextResetTs(now),
            dayIndex: state.streak || 1,
            coins: Number(user.coins || 0)
        };
    }

    const dayIndex = computeNextDayIndex(state, now);
    const amount = DAILY_REWARDS[dayIndex - 1];

    user.coins = Math.max(0, Number(user.coins || 0)) + amount;
    user.dailyReward = {
        lastClaimDate: today,
        lastClaimDayNum: istDayNumber(now),
        streak: dayIndex,
        totalClaimed: state.totalClaimed + amount
    };
    user.updatedAt = now;

    if (!Array.isArray(database.transactions)) database.transactions = [];
    database.transactions.push({
        type: 'DAILY_REWARD',
        userId: user.username || identifier,
        amount,
        roomCode: 'DAILY_DAY_' + dayIndex,
        timestamp: now
    });
    if (database.transactions.length > 5000) {
        database.transactions = database.transactions.slice(-5000);
    }

    db.writeDBSync(database);

    return {
        success: true,
        amount,
        dayIndex,
        streak: dayIndex,
        newBalance: user.coins,
        rewards: DAILY_REWARDS,
        nextResetAt: nextResetTs(now),
        serverTime: now
    };
}

module.exports = { DAILY_REWARDS, getStatus, claim, istDayString, nextResetTs };
