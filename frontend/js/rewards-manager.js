// frontend/js/rewards-manager.js
// ==========================================================================
// DAILY LOGIN REWARD (Day 1..7 -> 500, 1000, 1500, 2000, 2500, 3000, 5000)
// Din me sirf EK BAAR claim. Asli hisaab server par hota hai
// (/api/wallet/daily-reward). Offline / guest mode me localStorage fallback.
// ==========================================================================

// ============================================================
// BACKEND URL - Auto-detects Firebase Hosting
// ============================================================
function getBackendUrl() {
    // Production: Firebase Hosting → Render Backend
    if (window.location.hostname.includes('web.app') || 
        window.location.hostname.includes('firebaseapp.com')) {
        return 'https://your-app-name.onrender.com'; // ← CHANGE THIS TO YOUR RENDER URL
    }
    
    // Local development
    if (window.location.port && window.location.port !== '3000') {
        return 'http://localhost:3000';
    }
    if (window.location.origin && !window.location.origin.includes('file://')) {
        return window.location.origin;
    }
    return 'http://localhost:3000';
}

const DAILY_REWARD_TIERS = [500, 1000, 1500, 2000, 2500, 3000, 5000];
const DAILY_LOCAL_KEY = 'daily_reward_local';

let dailyRewardState = null;
let dailyRewardTimer = null;
let dailyClaimInFlight = false;

function isOnlineSession() {
    const token = localStorage.getItem('userToken');
    return Boolean(token) && !token.startsWith('offline_token_');
}

function localDayString(ts = Date.now()) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function localNextMidnight() {
    const d = new Date();
    d.setHours(24, 0, 0, 0);
    return d.getTime();
}

function readLocalDaily() {
    try {
        return JSON.parse(localStorage.getItem(DAILY_LOCAL_KEY) || '{}');
    } catch (e) {
        return {};
    }
}

function buildLocalStatus() {
    const saved = readLocalDaily();
    const today = localDayString();
    const todayNum = Math.floor(Date.now() / 86400000);
    const lastNum = Number(saved.lastClaimDayNum || 0);
    const streak = Number(saved.streak || 0);

    let dayIndex = 1;
    if (lastNum) {
        if (todayNum - lastNum === 1) dayIndex = (streak % DAILY_REWARD_TIERS.length) + 1;
        else if (todayNum - lastNum > 1) dayIndex = 1;
        else dayIndex = streak || 1;
    }

    return {
        success: true,
        offline: true,
        rewards: DAILY_REWARD_TIERS,
        dayIndex,
        streak,
        alreadyClaimed: saved.lastClaimDate === today,
        amount: DAILY_REWARD_TIERS[dayIndex - 1],
        nextResetAt: localNextMidnight()
    };
}

function claimLocalDaily() {
    const status = buildLocalStatus();
    if (status.alreadyClaimed) {
        return { success: false, alreadyClaimed: true, message: 'Aaj ka reward already mil chuka hai.' };
    }

    const raw = localStorage.getItem('currentUser');
    if (!raw) return { success: false, message: 'Login required.' };

    const user = JSON.parse(raw);
    user.coins = Number(user.coins || 0) + status.amount;
    localStorage.setItem('currentUser', JSON.stringify(user));

    localStorage.setItem(DAILY_LOCAL_KEY, JSON.stringify({
        lastClaimDate: localDayString(),
        lastClaimDayNum: Math.floor(Date.now() / 86400000),
        streak: status.dayIndex
    }));

    return {
        success: true,
        offline: true,
        amount: status.amount,
        dayIndex: status.dayIndex,
        newBalance: user.coins,
        nextResetAt: localNextMidnight()
    };
}

// --------------------------------------------------------------------------
// STATUS FETCH + BADGE
// --------------------------------------------------------------------------
function fetchDailyStatus() {
    if (!isOnlineSession()) return Promise.resolve(buildLocalStatus());

    return fetch(`${getBackendUrl()}/api/wallet/daily-reward`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('userToken')}` }
    })
        .then(r => r.json())
        .then(data => (data && data.success ? data : buildLocalStatus()))
        .catch(() => buildLocalStatus());
}

function paintDailyBadge() {
    const dot = document.getElementById('daily-reward-dot');
    const btn = document.getElementById('btn-daily-reward');
    if (!dot || !btn || !dailyRewardState) return;

    const ready = !dailyRewardState.alreadyClaimed;
    dot.style.display = ready ? 'block' : 'none';
    btn.classList.toggle('reward-ready', ready);
}

function refreshDailyRewardBadge() {
    fetchDailyStatus().then(status => {
        dailyRewardState = status;
        paintDailyBadge();
        if (document.getElementById('daily-reward-overlay') &&
            document.getElementById('daily-reward-overlay').style.display === 'flex') {
            renderDailyRewardModal();
        }
    });
}

// --------------------------------------------------------------------------
// MODAL RENDER
// --------------------------------------------------------------------------
function renderDailyRewardModal() {
    const grid = document.getElementById('daily-reward-grid');
    const btn = document.getElementById('btn-claim-daily');
    const note = document.getElementById('daily-reward-note');
    if (!grid || !dailyRewardState) return;

    const s = dailyRewardState;
    const tiers = s.rewards || DAILY_REWARD_TIERS;
    const currentDay = s.dayIndex || 1;

    grid.innerHTML = tiers.map((amount, i) => {
        const day = i + 1;
        let cls = 'reward-day';
        if (day < currentDay || (day === currentDay && s.alreadyClaimed)) cls += ' claimed';
        if (day === currentDay && !s.alreadyClaimed) cls += ' today';
        if (day === tiers.length) cls += ' mega';
        return `<div class="${cls}">
            <span class="reward-day-label">Day ${day}</span>
            <span class="reward-coin-icon">🪙</span>
            <span class="reward-day-amount">${amount.toLocaleString()}</span>
            ${day < currentDay || (day === currentDay && s.alreadyClaimed) ? '<span class="reward-check">✓</span>' : ''}
        </div>`;
    }).join('');

    if (btn) {
        if (s.alreadyClaimed) {
            btn.disabled = true;
            btn.classList.add('claimed-state');
            btn.innerText = 'Aaj ka reward claim ho gaya';
        } else {
            btn.disabled = false;
            btn.classList.remove('claimed-state');
            btn.innerText = `Claim ${Number(s.amount || tiers[currentDay - 1]).toLocaleString()} Coins`;
        }
    }

    if (note) {
        note.innerText = s.alreadyClaimed
            ? 'Agla reward:'
            : `Day ${currentDay} ka reward ready hai. Roz aake streak badhayein - Day 7 par 5,000 coins.`;
    }

    startDailyCountdown();
}

function startDailyCountdown() {
    clearInterval(dailyRewardTimer);
    const el = document.getElementById('daily-reward-timer');
    if (!el || !dailyRewardState) return;

    if (!dailyRewardState.alreadyClaimed) {
        el.innerText = '';
        return;
    }

    const target = Number(dailyRewardState.nextResetAt || localNextMidnight());
    const tick = () => {
        let diff = target - Date.now();
        if (diff <= 0) {
            clearInterval(dailyRewardTimer);
            el.innerText = 'Naya reward ready!';
            refreshDailyRewardBadge();
            return;
        }
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const sec = Math.floor((diff % 60000) / 1000);
        el.innerText = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    };
    tick();
    dailyRewardTimer = setInterval(tick, 1000);
}

function openDailyRewardModal() {
    const overlay = document.getElementById('daily-reward-overlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
    if (typeof playSound === 'function') playSound('move');

    if (dailyRewardState) renderDailyRewardModal();
    fetchDailyStatus().then(status => {
        dailyRewardState = status;
        paintDailyBadge();
        renderDailyRewardModal();
    });
}

function closeDailyRewardModal() {
    const overlay = document.getElementById('daily-reward-overlay');
    if (overlay) overlay.style.display = 'none';
    clearInterval(dailyRewardTimer);
}

// --------------------------------------------------------------------------
// CLAIM
// --------------------------------------------------------------------------
function applyNewBalance(newBalance) {
    if (typeof newBalance !== 'number') return;
    try {
        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
        user.coins = newBalance;
        localStorage.setItem('currentUser', JSON.stringify(user));
    } catch (e) {}
    const coinsEl = document.getElementById('display-user-coins');
    if (coinsEl) coinsEl.innerText = Number(newBalance).toLocaleString();
}

function showRewardBurst(amount) {
    const el = document.getElementById('reward-burst');
    if (!el) return;
    el.innerHTML = `<span>🪙 +${Number(amount).toLocaleString()}</span>`;
    el.classList.remove('burst-play');
    void el.offsetWidth;
    el.classList.add('burst-play');
}

function claimDailyReward() {
    if (dailyClaimInFlight) return;
    if (dailyRewardState && dailyRewardState.alreadyClaimed) return;

    dailyClaimInFlight = true;
    const btn = document.getElementById('btn-claim-daily');
    if (btn) { btn.disabled = true; btn.innerText = 'Claiming...'; }

    const finish = (result) => {
        dailyClaimInFlight = false;
        if (result && result.success) {
            applyNewBalance(result.newBalance);
            showRewardBurst(result.amount);
            if (typeof playSound === 'function') playSound('win');
            dailyRewardState = Object.assign({}, dailyRewardState, {
                alreadyClaimed: true,
                dayIndex: result.dayIndex,
                streak: result.streak || result.dayIndex,
                amount: result.amount,
                nextResetAt: result.nextResetAt || localNextMidnight()
            });
        } else {
            dailyRewardState = Object.assign({}, dailyRewardState, {
                alreadyClaimed: true,
                nextResetAt: (result && result.nextResetAt) || localNextMidnight()
            });
            if (result && result.message && !result.alreadyClaimed) alert(result.message);
        }
        paintDailyBadge();
        renderDailyRewardModal();
    };

    if (!isOnlineSession()) {
        finish(claimLocalDaily());
        return;
    }

    fetch(`${getBackendUrl()}/api/wallet/daily-reward/claim`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('userToken')}`
        }
    })
        .then(r => r.json())
        .then(finish)
        .catch(() => {
            dailyClaimInFlight = false;
            if (btn) { btn.disabled = false; }
            alert('Server se connect nahi ho paya. Thodi der baad try karein.');
        });
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('btn-daily-reward')) {
        setTimeout(refreshDailyRewardBadge, 900);
    }
});