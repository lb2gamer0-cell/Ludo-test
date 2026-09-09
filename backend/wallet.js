// backend/wallet.js

const db = require('./db');

// FIX: single shared lookup helper (pehle 3 jagah duplicate logic thi aur
// har jagah alag-alag key nikalti thi -> duplicate user records ban jate the)
function findUserKey(database, identifier) {
    if (identifier === undefined || identifier === null) return null;
    const cleanId = identifier.toString().trim().toLowerCase();
    if (!cleanId) return null;

    if (database.users[cleanId]) return cleanId;

    for (const key in database.users) {
        const u = database.users[key] || {};
        if (
            (u.mobile && String(u.mobile).toLowerCase() === cleanId) ||
            (u.username && String(u.username).toLowerCase() === cleanId) ||
            (u.id && String(u.id).toLowerCase() === cleanId)
        ) {
            return key;
        }
    }
    return null;
}

function logTransaction(database, entry) {
    if (!Array.isArray(database.transactions)) database.transactions = [];
    database.transactions.push({ ...entry, timestamp: Date.now() });
    // FIX: transactions array infinite grow hoti thi (DB file MBs me chali jati thi)
    if (database.transactions.length > 5000) {
        database.transactions = database.transactions.slice(-5000);
    }
}

function checkBalance(identifier, requiredCoins) {
    const database = db.readDB();
    const key = findUserKey(database, identifier);
    // FIX: pehle unknown user ke liye default 2500 return hota tha, isliye
    // koi bhi fake identifier bhej kar match join kar sakta tha.
    if (!key) return false;
    const coins = Number(database.users[key].coins ?? 0);
    return coins >= Math.abs(Number(requiredCoins) || 0);
}

function deductMatchEntryFee(identifier, betAmount, roomCode) {
    const bet = Math.abs(Number(betAmount)) || 100;
    const database = db.readDB();
    const userKey = findUserKey(database, identifier);

    // FIX: pehle user na milne par naya account 2500 free coins ke saath ban
    // jata tha -> koi bhi random username bhej kar free coins farm kar sakta tha.
    if (!userKey) {
        return { success: false, message: 'User account not found. Please login again.' };
    }

    const currentCoins = Number(database.users[userKey].coins ?? 0);
    if (currentCoins < bet) {
        return { success: false, message: 'Insufficient balance on server.' };
    }

    database.users[userKey].coins = currentCoins - bet;
    database.users[userKey].updatedAt = Date.now();

    logTransaction(database, {
        type: 'BET_DEDUCTION',
        userId: database.users[userKey].username || identifier,
        amount: bet,
        roomCode: roomCode || 'SOLO'
    });

    db.writeDBSync(database);
    return { success: true, newBalance: database.users[userKey].coins };
}

// FIX: naya function - match start hote hi fee kat jati thi, lekin agar
// baaki player ki fee fail ho jaye to refund ka koi rasta nahi tha.
function refundMatchEntryFee(identifier, betAmount, roomCode) {
    const bet = Math.abs(Number(betAmount)) || 0;
    const database = db.readDB();
    const userKey = findUserKey(database, identifier);
    if (!userKey || bet <= 0) return { success: false };

    database.users[userKey].coins = Number(database.users[userKey].coins ?? 0) + bet;
    database.users[userKey].updatedAt = Date.now();

    logTransaction(database, {
        type: 'BET_REFUND',
        userId: database.users[userKey].username || identifier,
        amount: bet,
        roomCode: roomCode || 'SOLO'
    });

    db.writeDBSync(database);
    return { success: true, newBalance: database.users[userKey].coins };
}

function creditWinnerPot(identifier, totalPrize, roomCode) {
    const prize = Math.abs(Number(totalPrize)) || 0;
    const database = db.readDB();
    const userKey = findUserKey(database, identifier);

    if (!userKey) {
        return { success: false, message: 'Winner account not found.' };
    }

    database.users[userKey].coins = Number(database.users[userKey].coins ?? 0) + prize;
    database.users[userKey].updatedAt = Date.now();

    logTransaction(database, {
        type: 'WINNER_PRIZE_CREDIT',
        userId: database.users[userKey].username || identifier,
        amount: prize,
        roomCode: roomCode || 'SOLO'
    });

    db.writeDBSync(database);
    return { success: true, newBalance: database.users[userKey].coins };
}

function adminModifyWallet(targetQuery, type, amount) {
    const database = db.readDB();
    const userKey = findUserKey(database, targetQuery);
    if (!userKey) return { success: false, message: 'Target user not found.' };

    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount)) return { success: false, message: 'Invalid amount.' };

    const user = database.users[userKey];

    if (type === 'coins') {
        user.coins = Math.max(0, Number(user.coins || 0) + numAmount);
    } else if (type === 'diamonds') {
        user.diamonds = Math.max(0, Number(user.diamonds || 0) + numAmount);
    } else {
        return { success: false, message: 'Invalid type. Use coins or diamonds.' };
    }

    user.updatedAt = Date.now();

    logTransaction(database, {
        type: 'ADMIN_ADJUSTMENT',
        userId: user.username || targetQuery,
        amount: numAmount,
        roomCode: 'ADMIN_' + type
    });

    // FIX: pehle saveUserRecord() call hota tha jo key dobara calculate karta tha
    // aur username badalne par duplicate record bana deta tha. Ab wahi key update hoti hai.
    db.writeDBSync(database);
    return { success: true, user };
}

module.exports = {
    findUserKey,
    checkBalance,
    deductMatchEntryFee,
    refundMatchEntryFee,
    creditWinnerPot,
    adminModifyWallet
};
