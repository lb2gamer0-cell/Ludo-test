// frontend/js/app.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. Check User Session Safely
    const rawUser = localStorage.getItem('currentUser');
    if (!rawUser && !window.location.href.includes('index.html')) {
        window.location.replace('index.html');
        return;
    }

    try {
        if (rawUser) JSON.parse(rawUser);
    } catch (e) {
        localStorage.removeItem('currentUser');
        if (!window.location.href.includes('index.html')) {
            window.location.replace('index.html');
            return;
        }
    }

    // 2. Initialize Sockets
    // FIX: initUserSession() yahan aur ui-controller ke DOMContentLoaded me
    // dono jagah call hota tha -> har page load par /api/user/sync do baar
    // jata tha aur coin display kabhi-kabhi purani value par flicker karta tha.
    if (typeof initSocketConnection === 'function') initSocketConnection();

    // 3. Hardware / Browser Back Button Handler (native app + normal browser dono)
    initNativeBackButton();
    initBrowserBackGuard();
});

// FIX: back button dabane par ab pehle open modal/view ko "app jaisa" band
// karta hai (profile -> setup -> game confirm -> exit), seedha browser/OS
// history par nahi jaata. Native Capacitor build aur normal Chrome browser
// dono is single function se decide karte hain ki back press ka kya karna hai.
// Returns true agar kuch handle ho gaya (modal/view band hua), false agar
// app already apni "base" screen (main menu) par hai aur real back/exit hona chahiye.
function handleAppBackAction() {
    const logoutModal = document.getElementById('logout-modal-overlay');
    const editProfileModal = document.getElementById('edit-profile-modal-overlay');
    const profileModal = document.getElementById('profile-modal-overlay');
    const feedbackModal = document.getElementById('feedback-modal-overlay');
    const rateModal = document.getElementById('rate-modal-overlay');
    const exitModal = document.getElementById('exit-modal-overlay');
    const friendsLobbyView = document.getElementById('friends-lobby-view');
    const friendsSetupView = document.getElementById('friends-setup-view');
    const setupView = document.getElementById('computer-setup-view');
    const gamePlayView = document.getElementById('game-play-view');

    if (logoutModal && logoutModal.style.display === 'flex') {
        closeLogoutConfirm();
    } else if (editProfileModal && editProfileModal.style.display === 'flex') {
        closeEditProfileModal();
    } else if (profileModal && profileModal.style.display === 'flex') {
        closeProfileMenu();
    } else if (feedbackModal && feedbackModal.style.display === 'flex') {
        closeFeedbackModal();
    } else if (rateModal && rateModal.style.display === 'flex') {
        closeRateUsModal();
    } else if (exitModal && exitModal.style.display === 'flex') {
        closeExitConfirm();
    } else if (gamePlayView && gamePlayView.style.display === 'flex') {
        openExitConfirm();
    } else if (friendsLobbyView && friendsLobbyView.style.display === 'flex') {
        if (typeof leaveFriendsLobby === 'function') leaveFriendsLobby();
        else showMainMenu();
    } else if (friendsSetupView && friendsSetupView.style.display === 'flex') {
        showMainMenu();
    } else if (setupView && setupView.style.display === 'flex') {
        showMainMenu();
    } else {
        return false;
    }
    return true;
}

function initNativeBackButton() {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
        const { App } = window.Capacitor.Plugins;
        App.addListener('backButton', () => {
            const handled = handleAppBackAction();
            if (!handled) App.exitApp();
        });
    }
}

// FIX (back-button bug): normal browser/WebView me pehle back button seedha
// page history navigate kar deta tha, jisse login ke turant baad user
// purane OAuth/redirect pages par pahunch jata tha aur game bhi turant band
// ho jati thi. Ab ek "guard" history entry push ki jaati hai; back press us
// entry ko consume karta hai aur humein ek popstate event milta hai jismein
// hum decide karte hain ki kaunsa modal/view band karna hai. Jab app pehle
// se hi apni base "main menu" screen par ho (kuch band karne ko na ho), tab
// hi hum guard dobara push nahi karte, taaki agla back press normal tarike
// se page/app se bahar le jaye.
function initBrowserBackGuard() {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) return; // native handler upar se hi cover karta hai
    if (!window.history || typeof window.history.pushState !== 'function') return;

    history.pushState({ ludoBackGuard: true }, '', location.href);
    window.addEventListener('popstate', () => {
        const handled = handleAppBackAction();
        if (handled) {
            history.pushState({ ludoBackGuard: true }, '', location.href);
        }
    });
}
