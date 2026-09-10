// In frontend/js/ui-controller.js - replace the existing getBackendUrl function
/*function getBackendUrl() {
    // Production: Firebase Hosting → Render Backend
    if (window.location.hostname.includes('web.app') ||
        window.location.hostname.includes('firebaseapp.com')) {
        return 'https://ludo-test.onrender.com'; // ← CHANGE THIS TO YOUR RENDER URL
    }
    
    // Local development
    if (window.location.port && window.location.port !== '3000') {
        return 'https://ludo-test.onrender.com';
    }
    if (window.location.origin && !window.location.origin.includes('file://')) {
        return window.location.origin;
    }
    return 'https://ludo-test.onrender.com';
} */

function getBackendUrl() {
    if (window.location.hostname.includes('web.app') ||
        window.location.hostname.includes('firebaseapp.com')) {
        return 'https://ludo-test.onrender.com';
    }
    if (window.location.port && window.location.port !== '3000') {
        return 'https://ludo-test.onrender.com';
    }
    if (window.location.origin && !window.location.origin.includes('file://')) {
        return window.location.origin;
    }
    return 'https://ludo-test.onrender.com';
}


let selectedPlayerCount = 2;
window.selectedUserColor = 'red';
let selectedStarsCount = 0;
let tempSelectedAvatarId = 1;
let currentGameMode = 'computer'; 
let selectedGameTypeMode = 'classic'; 
let friendsSelectedMode = 'classic';
window.activeMatchBet = 100;
window.currentSoloMatchToken = null;

const BET_TIERS = [100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];
let compBetIndex = 0;
let friendsBetIndex = 0;

const AVATAR_PRESETS = {
    1: { icon: '👑', bgClass: 'av-bg-1' },
    2: { icon: '🦁', bgClass: 'av-bg-2' },
    3: { icon: '⚡', bgClass: 'av-bg-3' },
    4: { icon: '🔥', bgClass: 'av-bg-4' },
    5: { icon: '💎', bgClass: 'av-bg-5' },
    6: { icon: '🎯', bgClass: 'av-bg-6' },
    7: { icon: '🚀', bgClass: 'av-bg-7' },
    8: { icon: '🎲', bgClass: 'av-bg-8' }
};

const TRANSLATIONS = {
    en: {
        modeComputer: "Vs Computer",
        modeFaceToFace: "Face To Face",
        modeFriends: "With Friends",
        modeOnline: "Online",
        navHome: "Home",
        navRank: "Rank",
        navShop: "Shop",
        navHistory: "History",
        setupTitle: "VS COMPUTER",
        labelColor: "Select Your Goti Color",
        labelPlayers: "Select Players",
        labelBet: "Select Coin Bet",
        btnStart: "START GAME",
        headerProfile: "Profile & Settings",
        headerEditProfile: "Edit Profile",
        btnEditProfile: "✏️ Edit Profile",
        titleAccount: "Account & Preferences",
        subtitleTheme: "Display Theme",
        themeDay: "☀️ Day",
        themeNight: "🌙 Night",
        themeSystem: "⚙️ System",
        subtitleLang: "App Language / भाषा",
        notifTitle: "🔔 Game Notifications",
        notifDesc: "Game updates & Turn alerts",
        subtitleSupport: "Support & App Feedback",
        btnRate: "⭐ Rate Us",
        btnFeedback: "💬 Send Feedback",
        btnLogout: "Logout Account",
        subtitleAvatar: "Choose Profile Avatar",
        subtitleUserInfo: "Personal Information",
        labelFullName: "Full Name",
        labelUsername: "Username (@handle)",
        labelAge: "Select Age Group",
        btnSaveChanges: "Save Changes"
    },
    hi: {
        modeComputer: "कंप्यूटर",
        modeFaceToFace: "फेस टू फेस",
        modeFriends: "दोस्तों के साथ",
        modeOnline: "ऑनलाइन",
        navHome: "होम",
        navRank: "रैंक",
        navShop: "शॉप",
        navHistory: "इतिहास",
        setupTitle: "बनाम कंप्यूटर",
        labelColor: "गोटी का रंग चुनें",
        labelPlayers: "खिलाड़ी चुनें",
        labelBet: "कॉइन बेट चुनें",
        btnStart: "खेल शुरू करें",
        headerProfile: "प्रोफ़ाइल और सेटिंग्स",
        headerEditProfile: "प्रोफ़ाइल संपादित करें",
        btnEditProfile: "✏️ एडिट करें",
        titleAccount: "खाता और प्राथमिकताएं",
        subtitleTheme: "थीम चुनें",
        themeDay: "☀️ दिन",
        themeNight: "🌙 रात",
        themeSystem: "⚙️ सिस्टम",
        subtitleLang: "App Language / भाषा",
        notifTitle: "🔔 गेम नोटिफिकेशन",
        notifDesc: "अपडेट और अलर्ट",
        subtitleSupport: "सपोर्ट और फीडबैक",
        btnRate: "⭐ हमें रेटिंग दें",
        btnFeedback: "💬 फीडबैक भेजें",
        btnLogout: "लॉगआउट करें",
        subtitleAvatar: "अवतार चुनें",
        subtitleUserInfo: "व्यक्तिगत जानकारी",
        labelFullName: "पूरा नाम",
        labelUsername: "यूज़रनेम (@handle)",
        labelAge: "आयु वर्ग चुनें",
        btnSaveChanges: "सुरक्षित करें"
    }
};

document.addEventListener('DOMContentLoaded', () => {
    initUserSession();
    initThemeState();
    applyAppLanguageUI();
    updateBetStepperUI('computer');
    updateBetStepperUI('friends');
});

function changeBet(mode, delta) {
    if (mode === 'computer') {
        const nextIndex = compBetIndex + delta;
        if (nextIndex >= 0 && nextIndex < BET_TIERS.length) {
            compBetIndex = nextIndex;
            updateBetStepperUI('computer');
        }
    } else if (mode === 'friends') {
        const nextIndex = friendsBetIndex + delta;
        if (nextIndex >= 0 && nextIndex < BET_TIERS.length) {
            friendsBetIndex = nextIndex;
            updateBetStepperUI('friends');
        }
    }
}

function updateBetStepperUI(mode) {
    if (mode === 'computer') {
        const amount = BET_TIERS[compBetIndex];
        const displayEl = document.getElementById('display-bet-amount-comp');
        const minusBtn = document.getElementById('btn-bet-minus-comp');
        const plusBtn = document.getElementById('btn-bet-plus-comp');
        if (displayEl) displayEl.innerText = amount.toLocaleString();
        if (minusBtn) minusBtn.disabled = (compBetIndex === 0);
        if (plusBtn) plusBtn.disabled = (compBetIndex === BET_TIERS.length - 1);
    } else if (mode === 'friends') {
        const amount = BET_TIERS[friendsBetIndex];
        const displayEl = document.getElementById('display-bet-amount-friends');
        const minusBtn = document.getElementById('btn-bet-minus-friends');
        const plusBtn = document.getElementById('btn-bet-plus-friends');
        if (displayEl) displayEl.innerText = amount.toLocaleString();
        if (minusBtn) minusBtn.disabled = (friendsBetIndex === 0);
        if (plusBtn) plusBtn.disabled = (friendsBetIndex === BET_TIERS.length - 1);
    }
}

function validateUserCoinBalance(betAmount) {
    const rawUser = localStorage.getItem('currentUser');
    if (!rawUser) return false;
    let user = JSON.parse(rawUser);
    const userCoins = user.coins || 0;
    if (userCoins < betAmount) {
        alert(`Insufficient Coins! You have ${userCoins.toLocaleString()} coins, but entry is ${betAmount.toLocaleString()} coins.`);
        return false;
    }
    return true;
}

function deductCoinsFromUser(betAmount) {
    const rawUser = localStorage.getItem('currentUser');
    const token = localStorage.getItem('userToken');
    if (!rawUser) return;
    let user = JSON.parse(rawUser);
    user.coins = Math.max(0, (user.coins || 0) - betAmount);
    
    localStorage.setItem('currentUser', JSON.stringify(user));
    const coinDisplay = document.getElementById('display-user-coins');
    if (coinDisplay) coinDisplay.innerText = user.coins.toLocaleString();

    if (token && !token.startsWith('offline_token_')) {
        fetch(`${getBackendUrl()}/api/wallet/solo-bet`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
                betAmount,
                playerCount: selectedPlayerCount 
            })
        }).then(r => r.json()).then(data => {
            if (data.success && data.matchToken) {
                window.currentSoloMatchToken = data.matchToken;
                if (typeof data.newBalance === 'number') {
                    let u = JSON.parse(localStorage.getItem('currentUser') || '{}');
                    u.coins = data.newBalance;
                    localStorage.setItem('currentUser', JSON.stringify(u));
                    const cd = document.getElementById('display-user-coins');
                    if (cd) cd.innerText = (u.coins || 0).toLocaleString();
                }
            } else {
                let u = JSON.parse(localStorage.getItem('currentUser') || '{}');
                u.coins = (u.coins || 0) + betAmount;
                localStorage.setItem('currentUser', JSON.stringify(u));
                const cd = document.getElementById('display-user-coins');
                if (cd) cd.innerText = (u.coins || 0).toLocaleString();
                window.currentSoloMatchToken = null;
                alert((data && data.message) || 'Server ne bet accept nahi ki. Dobara try karein.');
            }
        }).catch(() => {
            let u = JSON.parse(localStorage.getItem('currentUser') || '{}');
            u.coins = (u.coins || 0) + betAmount;
            localStorage.setItem('currentUser', JSON.stringify(u));
            const cd = document.getElementById('display-user-coins');
            if (cd) cd.innerText = (u.coins || 0).toLocaleString();
        });
    }
}

function creditWinningsToUser(prizeAmount) {
    const rawUser = localStorage.getItem('currentUser');
    const token = localStorage.getItem('userToken');
    if (!rawUser) return;

    if (token && window.currentSoloMatchToken && !token.startsWith('offline_token_')) {
        fetch(`${getBackendUrl()}/api/wallet/solo-win`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                matchToken: window.currentSoloMatchToken
            })
        }).then(r => r.json()).then(data => {
            if (data.success) {
                let user = JSON.parse(localStorage.getItem('currentUser') || '{}');
                user.coins = data.newBalance;
                localStorage.setItem('currentUser', JSON.stringify(user));
                const coinDisplay = document.getElementById('display-user-coins');
                if (coinDisplay) coinDisplay.innerText = user.coins.toLocaleString();
                window.currentSoloMatchToken = null;
            } else {
                window.currentSoloMatchToken = null;
                if (typeof initUserSession === 'function') initUserSession();
            }
        }).catch(() => {
            window.currentSoloMatchToken = null;
            if (typeof initUserSession === 'function') initUserSession();
        });
    } else {
        let user = JSON.parse(rawUser);
        user.coins = (user.coins || 0) + prizeAmount;
        localStorage.setItem('currentUser', JSON.stringify(user));
        const coinDisplay = document.getElementById('display-user-coins');
        if (coinDisplay) coinDisplay.innerText = user.coins.toLocaleString();
    }
}

function formatUserHandle(user) {
    if (!user) return '@player';
    let rawUsername = user.username;
    if (!rawUsername || rawUsername === user.mobile || /^\d{10}$/.test(rawUsername)) {
        if (user.name) rawUsername = user.name.toLowerCase().replace(/[^a-z0-9_]/g, '');
        else rawUsername = 'player';
    }
    return `@${rawUsername.replace(/^@+/, '')}`;
}

function applyAvatarToElement(elementId, iconSpanId, avatarId) {
    const preset = AVATAR_PRESETS[avatarId] || AVATAR_PRESETS[8];
    const el = document.getElementById(elementId);
    const iconSpan = document.getElementById(iconSpanId);
    if (el) el.className = `avatar circle-avatar ${preset.bgClass}`;
    if (iconSpan) iconSpan.innerText = preset.icon;
}

function initUserSession() {
    const rawUser = localStorage.getItem('currentUser');
    const token = localStorage.getItem('userToken');
    if (!rawUser) return;
    try {
        const user = JSON.parse(rawUser);
        const nameEl = document.getElementById('display-user-name');
        const levelEl = document.getElementById('display-user-level');
        const coinsEl = document.getElementById('display-user-coins');
        const diamondsEl = document.getElementById('display-user-diamonds');

        if (nameEl) {
            nameEl.innerText = formatUserHandle(user);
            // Dynamic Ticker Detection: Text container se bada hai ya nahi
            setTimeout(() => {
                const parent = nameEl.parentElement;
                if (parent && nameEl.scrollWidth > parent.clientWidth) {
                    nameEl.classList.add('marquee-active');
                } else {
                    nameEl.classList.remove('marquee-active');
                }
            }, 120);
        }

        if (levelEl) levelEl.innerText = `Lvl ${user.level || 1}`;
        // FIX (coin audit): fallback 2500/50 tha, isliye jis account me coins
        // set nahi the usme UI par jhoothe 2,500 coins dikh jate the.
        if (coinsEl) coinsEl.innerText = Number(user.coins ?? 0).toLocaleString();
        if (diamondsEl) diamondsEl.innerText = Number(user.diamonds ?? 0).toLocaleString();
        
        applyAvatarToElement('main-user-avatar', 'main-avatar-icon', user.avatarId || 1);

        if (token && !token.startsWith('offline_token_')) {
            fetch(`${getBackendUrl()}/api/user/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: user.name,
                    username: user.username,
                    avatarId: user.avatarId,
                    age: user.age
                })
            }).then(r => r.json()).then(data => {
                if (data.success && data.wallet) {
                    user.coins = Number(data.wallet.coins || 0);
                    user.diamonds = Number(data.wallet.diamonds || 0);
                    localStorage.setItem('currentUser', JSON.stringify(user));
                    if (coinsEl) coinsEl.innerText = user.coins.toLocaleString();
                    if (diamondsEl) diamondsEl.innerText = user.diamonds.toLocaleString();
                }
                if (typeof refreshDailyRewardBadge === 'function') refreshDailyRewardBadge();
            }).catch(() => {});
        }
    } catch (err) {
        console.error("Session render error:", err);
    }
}

function openFriendsSetup() {
    currentGameMode = 'friends';
    document.getElementById(UI_ELEMENTS.TOP_BAR).style.display = 'none';
    document.getElementById(UI_ELEMENTS.LOGO).style.display = 'none';
    document.getElementById(UI_ELEMENTS.BOTTOM_BAR).style.display = 'none';
    document.getElementById(GAME_VIEWS.MENU).style.display = 'none';
    document.getElementById('computer-setup-view').style.display = 'none';
    document.getElementById('friends-setup-view').style.display = 'flex';
    document.getElementById('friends-lobby-view').style.display = 'none';
    switchFriendsTab('create');
}

function switchFriendsTab(tabName) {
    const btnCreate = document.getElementById('tab-btn-create');
    const btnJoin = document.getElementById('tab-btn-join');
    const secCreate = document.getElementById('friends-create-section');
    const secJoin = document.getElementById('friends-join-section');
    const joinErr = document.getElementById('join-error-msg');
    if (joinErr) joinErr.style.display = 'none';

    if (tabName === 'create') {
        btnCreate.classList.add('active');
        btnJoin.classList.remove('active');
        secCreate.style.display = 'block';
        secJoin.style.display = 'none';
        backToFriendsBetStep();
    } else {
        btnJoin.classList.add('active');
        btnCreate.classList.remove('active');
        secJoin.style.display = 'block';
        secCreate.style.display = 'none';
        const input = document.getElementById('input-join-room-code');
        if (input) { input.value = ''; input.focus(); }
    }
}

function goToFriendsModeStep() {
    const secBet = document.getElementById('friends-step-bet');
    const secMode = document.getElementById('friends-step-mode');
    if (secBet && secMode) {
        secBet.style.display = 'none';
        secMode.style.display = 'block';
    }
}

function backToFriendsBetStep() {
    const secBet = document.getElementById('friends-step-bet');
    const secMode = document.getElementById('friends-step-mode');
    if (secBet && secMode) {
        secMode.style.display = 'none';
        secBet.style.display = 'block';
    }
}

function selectFriendsGameMode(mode) {
    friendsSelectedMode = mode;
    const classicBtn = document.getElementById('friends-mode-classic');
    const quickBtn = document.getElementById('friends-mode-quick');
    if (classicBtn) classicBtn.classList.toggle('active', mode === 'classic');
    if (quickBtn) quickBtn.classList.toggle('active', mode === 'quick');
}

function executeCreateFriendRoom() {
    const selectedBet = BET_TIERS[friendsBetIndex];
    if (!validateUserCoinBalance(selectedBet)) return;

    let user = {};
    try { user = JSON.parse(localStorage.getItem('currentUser') || '{}'); } catch(e){}

    window.activeMatchBet = selectedBet;
    if (typeof createPrivateRoom === 'function') {
        createPrivateRoom(
            user.name || 'Player',
            user.avatarId || 1,
            user.username || 'player',
            selectedBet,
            user.mobile || '',
            friendsSelectedMode
        );
    }
}

function executeJoinFriendRoom() {
    const input = document.getElementById('input-join-room-code');
    const code = input ? input.value.trim() : '';
    const errorEl = document.getElementById('join-error-msg');
    
    if (!/^00\d{6}$/.test(code)) {
        if (errorEl) {
            errorEl.innerText = 'Please enter a valid 8-digit Room Code starting with 00 (e.g. 00123456)';
            errorEl.style.display = 'block';
        }
        return;
    }
    if (errorEl) errorEl.style.display = 'none';

    let user = {};
    try { user = JSON.parse(localStorage.getItem('currentUser') || '{}'); } catch(e){}

    if (typeof joinPrivateRoom === 'function') {
        joinPrivateRoom(code, user.name || 'Player', user.avatarId || 1, user.username || 'player', user.coins || 0, user.mobile || '');
    }
}

function openFriendsLobbyUI(roomData, isHost) {
    document.getElementById('friends-setup-view').style.display = 'none';
    const lobbyView = document.getElementById('friends-lobby-view');
    lobbyView.style.display = 'flex';

    document.getElementById('lobby-display-code').innerText = roomData.id;
    document.getElementById('lobby-player-count').innerText = `${roomData.players.length} / 4 Players`;
    
    const betTag = document.getElementById('lobby-bet-display');
    const modeLabel = (roomData.gameType === 'quick') ? '⚡ Quick' : '👑 Classic';
    if (betTag) betTag.innerText = `Entry: ${roomData.betAmount.toLocaleString()} Coins | ${modeLabel}`;
    window.activeMatchBet = roomData.betAmount;

    const host = roomData.players[0];
    if (host) {
        document.getElementById('lobby-host-name').innerText = host.name;
        document.getElementById('lobby-host-handle').innerText = `@${host.username || 'host'}`;
        applyAvatarToElement('lobby-host-avatar', 'lobby-host-icon', host.avatarId || 1);
    }

    for (let i = 1; i <= 3; i++) {
        const slotEl = document.getElementById(`lobby-slot-${i}`);
        const player = roomData.players[i];
        if (player) {
            const preset = AVATAR_PRESETS[player.avatarId || 1] || AVATAR_PRESETS[8];
            slotEl.innerHTML = `
                <div class="lobby-avatar-wrap">
                    <div class="circle-avatar ${preset.bgClass}">
                        <span>${preset.icon}</span>
                    </div>
                    <span class="goti-color-badge color-${player.color}"></span>
                </div>
                <div class="lobby-player-details">
                    <span class="lobby-player-name">${player.name}</span>
                    <span class="lobby-player-handle">@${player.username || 'player'}</span>
                </div>
            `;
        } else {
            slotEl.innerHTML = `
                <div class="lobby-slot-empty">
                    <div class="spinner-ring"></div>
                    <span>Waiting for Player ${i + 1}...</span>
                </div>
            `;
        }
    }

    const hostBtn = document.getElementById('lobby-host-start-btn');
    const waitBar = document.getElementById('lobby-joined-wait-bar');

    if (isHost) {
        waitBar.style.display = 'none';
        hostBtn.style.display = 'block';
        if (roomData.players.length >= 2) {
            hostBtn.disabled = false;
            hostBtn.innerText = `START MATCH (${roomData.players.length} PLAYERS)`;
        } else {
            hostBtn.disabled = true;
            hostBtn.innerText = 'WAITING FOR PLAYERS (MIN 2)';
        }
    } else {
        hostBtn.style.display = 'none';
        waitBar.style.display = 'flex';
    }
}

function executeHostStartMatch() {
    if (window.currentRoomCode && typeof hostStartMatchEmit === 'function') {
        hostStartMatchEmit(window.currentRoomCode);
    }
}

function copyFriendsRoomCode() {
    const code = document.getElementById('lobby-display-code').innerText;
    if (!code || code === '00------') return;
    navigator.clipboard.writeText(code).then(() => {
        const btn = document.querySelector('.lobby-copy-btn');
        if (btn) {
            btn.innerText = '✓ Copied!';
            setTimeout(() => { btn.innerText = '📋 Copy Code'; }, 2000);
        }
    });
}

function leaveFriendsLobby() {
    if (typeof leaveFriendsLobbyEmit === 'function') {
        leaveFriendsLobbyEmit();
    }
    localStorage.removeItem('active_multiplayer_room');
    window.currentRoomCode = null;
    window.isMultiplayerGame = false;
    showMainMenu();
}

function selectMode(mode) {
    if (mode === 'FaceToFace') openFaceToFaceSetup();
    else if (mode === 'Computer') openComputerSetup();
    else if (mode === 'Friends') openFriendsSetup();
    else if (mode === 'Online') {
        alert("Online Quick Matchmaking is coming in the next update! Please use 'With Friends' to play online.");
    }
}

function openComputerSetup() {
    currentGameMode = 'computer';
    selectedGameTypeMode = 'classic';
    document.getElementById('txt-setup-title').innerText = "VS COMPUTER";
    document.getElementById('section-goti-select').style.display = 'block';
    document.getElementById('section-bet-select').style.display = 'block';
    document.getElementById('section-game-mode').style.display = 'none';

    document.querySelectorAll('.option-grid .opt-btn').forEach(el => el.classList.remove('active'));
    ['btn-player-2', 'btn-player-3', 'btn-player-4'].forEach(id => {
        const b = document.getElementById(id);
        if (b) { b.classList.remove('disabled'); b.disabled = false; }
    });
    document.getElementById('btn-player-2').classList.add('active');
    selectedPlayerCount = 2;

    document.getElementById(UI_ELEMENTS.TOP_BAR).style.display = 'none';
    document.getElementById(UI_ELEMENTS.LOGO).style.display = 'none';
    document.getElementById(UI_ELEMENTS.BOTTOM_BAR).style.display = 'none';
    document.getElementById(GAME_VIEWS.MENU).style.display = 'none';
    document.getElementById('friends-setup-view').style.display = 'none';
    document.getElementById('friends-lobby-view').style.display = 'none';
    document.getElementById(GAME_VIEWS.SETUP).style.display = 'flex';
}

function openFaceToFaceSetup() {
    currentGameMode = 'facetoface';
    document.getElementById('txt-setup-title').innerText = "FACE TO FACE";
    document.getElementById('section-goti-select').style.display = 'none';
    document.getElementById('section-bet-select').style.display = 'none';
    document.getElementById('section-game-mode').style.display = 'block';
    selectGameType('classic');

    document.getElementById(UI_ELEMENTS.TOP_BAR).style.display = 'none';
    document.getElementById(UI_ELEMENTS.LOGO).style.display = 'none';
    document.getElementById(UI_ELEMENTS.BOTTOM_BAR).style.display = 'none';
    document.getElementById(GAME_VIEWS.MENU).style.display = 'none';
    document.getElementById('friends-setup-view').style.display = 'none';
    document.getElementById('friends-lobby-view').style.display = 'none';
    document.getElementById(GAME_VIEWS.SETUP).style.display = 'flex';
}

function showMainMenu() {
    if (typeof clearTurnTimer === 'function') clearTurnTimer();
    document.getElementById(UI_ELEMENTS.TOP_BAR).style.display = 'flex';
    document.getElementById(UI_ELEMENTS.LOGO).style.display = 'block';
    document.getElementById(UI_ELEMENTS.BOTTOM_BAR).style.display = 'flex';
    document.getElementById(GAME_VIEWS.SETUP).style.display = 'none';
    document.getElementById(GAME_VIEWS.GAME_PLAY).style.display = 'none';
    document.getElementById('friends-setup-view').style.display = 'none';
    document.getElementById('friends-lobby-view').style.display = 'none';
    document.getElementById(GAME_VIEWS.MENU).style.display = 'grid';

    document.getElementById('exit-modal-overlay').style.display = 'none';
    document.getElementById('profile-modal-overlay').style.display = 'none';
    document.getElementById('logout-modal-overlay').style.display = 'none';

    const wOverlay = document.getElementById('winner-modal-overlay');
    const wSheet = document.getElementById('winner-bottom-sheet');
    if (wOverlay) { wOverlay.classList.remove('overlay-active'); wOverlay.style.display = 'none'; }
    if (wSheet) wSheet.classList.remove('sheet-active');

    window.isMultiplayerGame = false;
    window.currentRoomCode = null;
    window.myPlayerColor = null;
    clearInterval(window.reconnectCountdown);
    if (window.diceResponseTimer) { clearTimeout(window.diceResponseTimer); window.diceResponseTimer = null; }
    localStorage.removeItem('active_multiplayer_room');
    if (typeof resetAllTokens === 'function') resetAllTokens();
}

function startGame(roomData = null) {
    if (currentGameMode === 'computer') {
        const betToDeduct = BET_TIERS[compBetIndex];
        if (!validateUserCoinBalance(betToDeduct)) return;
        deductCoinsFromUser(betToDeduct);
        window.activeMatchBet = betToDeduct;
    } else if (currentGameMode === 'friends' && roomData) {
        window.activeMatchBet = roomData.betAmount || 100;
        selectedGameTypeMode = roomData.gameType || 'classic';
        if (typeof initUserSession === 'function') setTimeout(initUserSession, 600);
    }

    document.getElementById(GAME_VIEWS.SETUP).style.display = 'none';
    document.getElementById(GAME_VIEWS.MENU).style.display = 'none';
    document.getElementById('friends-setup-view').style.display = 'none';
    document.getElementById('friends-lobby-view').style.display = 'none';
    document.getElementById(UI_ELEMENTS.TOP_BAR).style.display = 'none';
    document.getElementById(UI_ELEMENTS.LOGO).style.display = 'none';
    document.getElementById(UI_ELEMENTS.BOTTOM_BAR).style.display = 'none';
    
    document.getElementById(GAME_VIEWS.GAME_PLAY).style.display = 'flex';
    if (typeof resetAllTokens === 'function') resetAllTokens();
    setupGameOrientation(window.selectedUserColor, selectedPlayerCount, roomData);
    if (typeof generateBoardTracks === 'function') generateBoardTracks();
}

function openExitConfirm() { document.getElementById('exit-modal-overlay').style.display = 'flex'; }
function closeExitConfirm() { document.getElementById('exit-modal-overlay').style.display = 'none'; }

function confirmExitGame() {
    if (typeof clearTurnTimer === 'function') clearTurnTimer();
    if (window.isMultiplayerGame && window.currentRoomCode) {
        if (typeof forfeitMultiplayerMatch === 'function') {
            forfeitMultiplayerMatch(window.currentRoomCode);
        }
        localStorage.removeItem('active_multiplayer_room');
    } else if (currentGameMode === 'computer' && window.currentSoloMatchToken) {
        const token = localStorage.getItem('userToken');
        if (token && !token.startsWith('offline_token_')) {
            fetch(`${getBackendUrl()}/api/wallet/solo-abandon`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
            }).catch(() => {});
        }
        window.currentSoloMatchToken = null;
    }
    closeExitConfirm();
    showMainMenu();
}

function setupGameOrientation(userColor, playerCount, roomData = null) {
    const colorSlots = {
        red:    { id: 0, color: 'red',    cardId: 'card-player-0', containerId: 'dice-container-0' },
        green:  { id: 1, color: 'green',  cardId: 'card-player-1', containerId: 'dice-container-1' },
        yellow: { id: 2, color: 'yellow', cardId: 'card-player-2', containerId: 'dice-container-2' },
        blue:   { id: 3, color: 'blue',   cardId: 'card-player-3', containerId: 'dice-container-3' }
    };

    Object.values(colorSlots).forEach(slot => {
        const card = document.getElementById(slot.cardId);
        if (card) {
            card.classList.add('disabled-player');
            card.classList.remove('active-turn');
        }
    });

    let activeSlots = [];
    if (roomData && currentGameMode === 'friends') {
        const count = roomData.players.length;
        if (count === 2) activeSlots = [colorSlots['red'], colorSlots['green']];
        else if (count === 3) activeSlots = [colorSlots['red'], colorSlots['green'], colorSlots['yellow']];
        else activeSlots = [colorSlots['red'], colorSlots['green'], colorSlots['yellow'], colorSlots['blue']];
    } else if (playerCount === 2) {
        const oppositeMap = { red: 'yellow', yellow: 'red', green: 'blue', blue: 'green' };
        activeSlots = [colorSlots[userColor], colorSlots[oppositeMap[userColor]]];
    } else if (playerCount === 3) {
        const turnOrder = ['red', 'green', 'yellow', 'blue'];
        const uIdx = turnOrder.indexOf(userColor);
        activeSlots = [colorSlots[userColor], colorSlots[turnOrder[(uIdx + 1) % 4]], colorSlots[turnOrder[(uIdx + 2) % 4]]];
    } else {
        const turnOrder = ['red', 'green', 'yellow', 'blue'];
        const uIdx = turnOrder.indexOf(userColor);
        activeSlots = [colorSlots[userColor], colorSlots[turnOrder[(uIdx + 1) % 4]], colorSlots[turnOrder[(uIdx + 2) % 4]], colorSlots[turnOrder[(uIdx + 3) % 4]]];
    }

    let currentUser = {};
    try { currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}'); } catch(e) {}
    const userHandle = formatUserHandle(currentUser);

    let compCounter = 1;
    playersList = activeSlots.map((slot, index) => {
        let name = '';
        let type = 'user';

        if (roomData && (currentGameMode === 'online' || currentGameMode === 'friends')) {
            const pObj = roomData.players.find(p => p.color === slot.color);
            if (pObj) {
                name = pObj.name;
                if (window.myPlayerColor) {
                    type = (slot.color === window.myPlayerColor) ? "user" : "remote";
                } else {
                    type = (socket && pObj.socketId === socket.id) ? "user" : "remote";
                }
            } else {
                name = `Player ${index + 1}`;
                type = "remote";
            }
        } else if (currentGameMode === 'computer') {
            const isUser = slot.color === userColor;
            if (isUser) { name = userHandle; type = "user"; }
            else { name = `Computer ${compCounter++}`; type = "bot"; }
        } else if (currentGameMode === 'facetoface') {
            name = `Player ${index + 1}`;
            type = "user";
        }

        const card = document.getElementById(slot.cardId);
        if (card) {
            card.classList.remove('disabled-player');
            const nameSpan = card.querySelector('.player-name');
            nameSpan.innerHTML = `${name} <span class="heart-icon heart-${slot.color}">♥</span>`;
        }
        return { ...slot, name, type };
    });

    if (typeof render3DDiceCubes === 'function') render3DDiceCubes();

    currentTurnIndex = 0;
    const firstPlayerCard = document.getElementById(playersList[0].cardId);
    if (firstPlayerCard) firstPlayerCard.classList.add('active-turn');
    
    if (typeof updateActiveBaseHighlight === 'function') {
        updateActiveBaseHighlight(playersList[0].color);
    }

    if (currentGameMode === 'facetoface' && typeof startTurnTimer === 'function') {
        startTurnTimer();
    } else if (typeof updateTurnStatus === 'function') {
        updateTurnStatus(`${playersList[0].name}: -`);
    }
}

function selectGoti(element) {
    document.querySelectorAll('.goti').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
    if (element.classList.contains('red')) window.selectedUserColor = 'red';
    else if (element.classList.contains('green')) window.selectedUserColor = 'green';
    else if (element.classList.contains('yellow')) window.selectedUserColor = 'yellow';
    else if (element.classList.contains('blue')) window.selectedUserColor = 'blue';
}

function selectGameType(type) {
    selectedGameTypeMode = type;
    const classicCard = document.getElementById('mode-card-classic');
    const teamupCard = document.getElementById('mode-card-teamup');
    const quickCard = document.getElementById('mode-card-quick');
    const btn2P = document.getElementById('btn-player-2');
    const btn3P = document.getElementById('btn-player-3');
    const btn4P = document.getElementById('btn-player-4');

    if (classicCard) classicCard.classList.remove('active');
    if (teamupCard) teamupCard.classList.remove('active');
    if (quickCard) quickCard.classList.remove('active');

    if (type === 'teamup') {
        if (teamupCard) teamupCard.classList.add('active');
        if (btn2P) { btn2P.classList.add('disabled'); btn2P.classList.remove('active'); }
        if (btn3P) { btn3P.classList.add('disabled'); btn3P.classList.remove('active'); }
        if (btn4P) btn4P.classList.add('active');
        selectedPlayerCount = 4;
    } else if (type === 'quick') {
        if (quickCard) quickCard.classList.add('active');
        if (btn2P) btn2P.classList.remove('disabled');
        if (btn3P) btn3P.classList.remove('disabled');
        if (btn4P) btn4P.classList.remove('disabled');
    } else {
        if (classicCard) classicCard.classList.add('active');
        if (btn2P) btn2P.classList.remove('disabled');
        if (btn3P) btn3P.classList.remove('disabled');
        if (btn4P) btn4P.classList.remove('disabled');
        document.querySelectorAll('.option-grid .opt-btn').forEach(el => el.classList.remove('active'));
        if (btn2P) btn2P.classList.add('active');
        selectedPlayerCount = 2;
    }
}

function selectPlayerCount(count, element) {
    if (element.classList.contains('disabled')) return;
    document.querySelectorAll('.option-grid .opt-btn').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
    selectedPlayerCount = count;
}

function openSettings() { openProfileMenu(); }
function openHistory() { alert("Match History is empty."); }

function openProfileMenu() {
    const rawUser = localStorage.getItem('currentUser');
    if (!rawUser) return;
    let user = {};
    try { user = JSON.parse(rawUser); } catch(e) { return; }

    const modal = document.getElementById('profile-modal-overlay');
    const cardFullName = document.getElementById('card-display-fullname');
    const cardHandle = document.getElementById('card-display-handle');

    let cleanHandle = user.username ? user.username.replace(/^@+/, '') : '';
    if (!cleanHandle && user.name) cleanHandle = user.name.toLowerCase().replace(/[^a-z0-9_]/g, '');

    if (cardFullName) cardFullName.innerText = user.name || 'Ludo Player';
    if (cardHandle) cardHandle.innerText = `@${cleanHandle || 'player'}`;

    applyAvatarToElement('modal-user-avatar', 'modal-avatar-icon', user.avatarId || 1);
    updateThemeButtonsUI();
    updateLanguageButtonsUI();

    // FIX (feature): Guest ke liye "Edit Profile" hide, uski jagah "Login"
    // button dikhta hai (dono ek hi jagah, ek time par sirf ek visible).
    const editProfileBtn = document.getElementById('txt-btn-editprofile');
    const linkGoogleBtn = document.getElementById('txt-btn-linkgoogle');
    const isGuest = user.provider === 'Guest';
    if (editProfileBtn) editProfileBtn.style.display = isGuest ? 'none' : 'inline-block';
    if (linkGoogleBtn) linkGoogleBtn.style.display = isGuest ? 'inline-block' : 'none';

    if (modal) modal.style.display = 'flex';
}

// FIX (feature): Guest apna account Google se link/upgrade karna chahe to
// yahan se login page par bheja jata hai (index.html) - wahi ek jagah pura
// Google sign-in flow (reliable redirect wala) reuse hota hai. sessionStorage
// flag index.html ko batata hai ki ye "upgrade" hai, "fresh login" nahi.
function goToLoginForUpgrade() {
    sessionStorage.setItem('ludo_upgrade_intent', '1');
    window.location.href = 'index.html';
}

function closeProfileMenu() { document.getElementById('profile-modal-overlay').style.display = 'none'; }
function openEditProfileModal() { document.getElementById('edit-profile-modal-overlay').style.display = 'flex'; }
function closeEditProfileModal() { document.getElementById('edit-profile-modal-overlay').style.display = 'none'; }

function selectAvatarPreset(avatarId) {
    tempSelectedAvatarId = avatarId;
    document.querySelectorAll('.avatar-picker-item').forEach(item => item.classList.remove('active'));
    const selectedItem = document.getElementById(`avatar-opt-${avatarId}`);
    if (selectedItem) selectedItem.classList.add('active');
}

function saveProfileDetails() {
    const rawUser = localStorage.getItem('currentUser');
    const token = localStorage.getItem('userToken');
    if (!rawUser) return;

    let user = JSON.parse(rawUser);
    const newFullName = document.getElementById('setting-user-name').value.trim();
    let newUsername = document.getElementById('setting-user-username').value.trim();
    const newAge = document.getElementById('setting-user-age').value;

    if (!newFullName) return alert('Please enter your Full Name!');
    if (!newUsername) newUsername = newFullName.toLowerCase().replace(/[^a-z0-9_]/g, '');

    user.name = newFullName;
    user.username = newUsername.replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9_.]/g, '');
    user.age = newAge;
    user.avatarId = tempSelectedAvatarId;

    localStorage.setItem('currentUser', JSON.stringify(user));
    initUserSession();

    if (token && !token.startsWith('offline_token_')) {
        fetch(`${getBackendUrl()}/api/user/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                name: user.name,
                username: user.username,
                avatarId: user.avatarId,
                age: user.age
            })
        }).catch(() => {});
    }

    alert('Profile updated successfully!');
    closeEditProfileModal();
}

function setAppLanguage(lang) {
    localStorage.setItem('app_language', lang);
    updateLanguageButtonsUI();
    applyAppLanguageUI();
}

function applyAppLanguageUI() {
    const currentLang = localStorage.getItem('app_language') || 'en';
    const dict = TRANSLATIONS[currentLang] || TRANSLATIONS.en;

    const map = {
        'txt-mode-computer': dict.modeComputer,
        'txt-mode-facetoface': dict.modeFaceToFace,
        'txt-mode-friends': dict.modeFriends,
        'txt-mode-online': dict.modeOnline,
        'txt-setup-title': currentGameMode === 'facetoface' ? (currentLang === 'hi' ? 'फेस टू फेस' : 'FACE TO FACE') : dict.setupTitle
    };

    Object.keys(map).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = map[id];
    });
}

function updateLanguageButtonsUI() {
    const currentLang = localStorage.getItem('app_language') || 'en';
    document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.remove('active'));
    const activeLangBtn = document.getElementById(`lang-btn-${currentLang}`);
    if (activeLangBtn) activeLangBtn.classList.add('active');
}

function toggleNotifications(checkbox) {
    localStorage.setItem('app_notifications', checkbox.checked ? 'true' : 'false');
}

function openRateUsModal() { document.getElementById('rate-modal-overlay').style.display = 'flex'; }
function closeRateUsModal() { document.getElementById('rate-modal-overlay').style.display = 'none'; }
function selectRatingStar(count) {
    selectedStarsCount = count;
    document.querySelectorAll('.rating-star').forEach((star, idx) => {
        if (idx < count) star.classList.add('active');
        else star.classList.remove('active');
    });
}
function submitGameRating() { closeRateUsModal(); alert(`Thank you for rating us ${selectedStarsCount} Stars!`); }

function openFeedbackModal() { document.getElementById('feedback-modal-overlay').style.display = 'flex'; }
function closeFeedbackModal() { document.getElementById('feedback-modal-overlay').style.display = 'none'; }
function submitUserFeedback() { closeFeedbackModal(); alert('Thank you for your feedback!'); }

function initThemeState() {
    const currentTheme = localStorage.getItem('app_theme') || 'system';
    applyThemeToDOM(currentTheme);
    updateThemeButtonsUI();
}

function setAppTheme(themeMode) {
    localStorage.setItem('app_theme', themeMode);
    applyThemeToDOM(themeMode);
    updateThemeButtonsUI();
}

function applyThemeToDOM(themeMode) {
    if (themeMode === 'day') document.documentElement.setAttribute('data-theme', 'day');
    else if (themeMode === 'night') document.documentElement.setAttribute('data-theme', 'night');
    else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', prefersDark ? 'night' : 'day');
    }
}

function updateThemeButtonsUI() {
    const currentTheme = localStorage.getItem('app_theme') || 'system';
    document.querySelectorAll('.theme-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`theme-btn-${currentTheme}`);
    if (activeBtn) activeBtn.classList.add('active');
}

function openLogoutConfirm() { document.getElementById('logout-modal-overlay').style.display = 'flex'; }
function closeLogoutConfirm() { document.getElementById('logout-modal-overlay').style.display = 'none'; }

function confirmLogout() {
    const profileModal = document.getElementById('profile-modal-overlay');
    const logoutModal = document.getElementById('logout-modal-overlay');
    if (profileModal) profileModal.style.display = 'none';
    if (logoutModal) logoutModal.style.display = 'none';

    if (window.isMultiplayerGame && window.currentRoomCode && typeof forfeitMultiplayerMatch === 'function') {
        forfeitMultiplayerMatch(window.currentRoomCode);
    }
    localStorage.removeItem('active_multiplayer_room');

    localStorage.removeItem('currentUser');
    localStorage.removeItem('userToken');
    localStorage.removeItem('adminToken');
    localStorage.removeItem('ludo_user');

    if (typeof firebase !== 'undefined' && firebase.auth) {
        try { firebase.auth().signOut(); } catch (e) {}
    }
    window.location.replace('index.html');
}
