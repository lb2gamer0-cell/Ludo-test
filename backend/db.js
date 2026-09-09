// backend/db.js
// ==========================================================================
// SECTION 1: SECURE PERSISTENT DATABASE ENGINE (ATOMIC STORAGE)
// ==========================================================================
const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DB_DIR, 'ludo_database.json');

if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

if (!fs.existsSync(DB_FILE)) {
    const initialSchema = {
        users: {},
        wallets: {},
        transactions: [],
        otpDailyLimits: {}
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialSchema, null, 2), 'utf-8');
}

function readDB() {
    try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(raw);
    } catch (err) {
        console.error('[DB Read Error]:', err);
        return { users: {}, wallets: {}, transactions: [], otpDailyLimits: {} };
    }
}

function writeDBSync(data) {
    try {
        const tempFile = `${DB_FILE}.tmp`;
        fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
        fs.renameSync(tempFile, DB_FILE);
        return true;
    } catch (err) {
        console.error('[DB Sync Write Error]:', err);
        return false;
    }
}

// ==========================================================================
// SECTION 2: USER & WALLET OPERATIONS
// ==========================================================================
// FIX: pehle ye function sirf user object return karta tha, key nahi.
// Isse save karte waqt nayi key ban jati thi aur duplicate records bante the.
function findUserKeyIn(database, identifier) {
    if (identifier === undefined || identifier === null) return null;
    const cleanId = identifier.toString().trim().toLowerCase();
    if (!cleanId) return null;

    if (database.users[cleanId]) return cleanId;

    for (const key in database.users) {
        const u = database.users[key] || {};
        if (
            (u.id && String(u.id).toLowerCase() === cleanId) ||
            (u.username && String(u.username).toLowerCase() === cleanId) ||
            (u.mobile && String(u.mobile).toLowerCase() === cleanId)
        ) {
            return key;
        }
    }
    return null;
}

function findUserByIdentifier(identifier) {
    const database = readDB();
    const key = findUserKeyIn(database, identifier);
    return key ? database.users[key] : null;
}

function saveUserRecord(userData, isWalletInternal = false) {
    const db = readDB();
    const newKey = (userData.id || userData.mobile || userData.username || '').toString().trim().toLowerCase();
    if (!newKey) return false;

    // FIX: pehle jo record maujood hai usi key par update karo, warna username
    // ya mobile badalne par purana record orphan ho jata tha (coins gum ho jate the).
    const existingKey =
        findUserKeyIn(db, userData.id) ||
        findUserKeyIn(db, userData.mobile) ||
        findUserKeyIn(db, userData.username) ||
        findUserKeyIn(db, newKey);

    const key = existingKey || newKey;
    const existing = db.users[key] || {};

    // FIX (coin audit): naya record banne par default 2500 coins mil jate the.
    // Matlab kisi bhi code path se record create hote hi free coins ban jate the.
    // Ab default 0 hai - signup bonus sirf /api/social-login server side deta hai.
    let finalCoins = existing.coins ?? 0;
    let finalDiamonds = existing.diamonds ?? 0;

    if (isWalletInternal) {
        if (userData.coins !== undefined) finalCoins = Number(userData.coins);
        if (userData.diamonds !== undefined) finalDiamonds = Number(userData.diamonds);
    }

    // FIX: coins/diamonds ko kabhi NaN/negative set na hone do
    if (!Number.isFinite(finalCoins)) finalCoins = existing.coins ?? 0;
    if (!Number.isFinite(finalDiamonds)) finalDiamonds = existing.diamonds ?? 0;

    const merged = { ...existing, ...userData };
    delete merged.coins;
    delete merged.diamonds;

    db.users[key] = {
        ...merged,
        coins: Math.max(0, finalCoins),
        diamonds: Math.max(0, finalDiamonds),
        updatedAt: Date.now()
    };

    return writeDBSync(db);
}

// FIX (coin audit): pehle unknown user ke liye phantom 2500 coins return hote the.
// UI par balance dikh jata tha jo server par exist hi nahi karta - phir bet lagane
// par "insufficient balance" aata tha. Ab 0 aur found:false milta hai.
function getUserWalletBalance(identifier) {
    const user = findUserByIdentifier(identifier);
    if (!user) return { coins: 0, diamonds: 0, found: false };
    return {
        coins: Math.max(0, Number(user.coins ?? 0)),
        diamonds: Math.max(0, Number(user.diamonds ?? 0)),
        found: true
    };
}

// ==========================================================================
// SECTION 3: DAILY OTP LIMIT TRACKER (MAX 5 ATTEMPTS PER DAY)
// ==========================================================================
function checkAndRecordDailyOtp(mobile) {
    const db = readDB();
    if (!db.otpDailyLimits) db.otpDailyLimits = {};

    const today = new Date().toISOString().split('T')[0];
    const record = db.otpDailyLimits[mobile] || { count: 0, date: today };

    if (record.date !== today) {
        record.count = 0;
        record.date = today;
    }

    if (record.count >= 5) {
        return { allowed: false, count: record.count };
    }

    record.count += 1;
    db.otpDailyLimits[mobile] = record;
    writeDBSync(db);
    return { allowed: true, count: record.count };
}

module.exports = {
    readDB,
    writeDBSync,
    findUserKeyIn,
    findUserByIdentifier,
    saveUserRecord,
    getUserWalletBalance,
    checkAndRecordDailyOtp
};
