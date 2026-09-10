// frontend/js/app.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. Check User Session Safely (FIXED: Root URL redirect logic)
    const rawUser = localStorage.getItem('currentUser');
    const isLoginPage = window.location.pathname === '/' || window.location.href.includes('index.html');
    
    if (!rawUser && !isLoginPage) {
        window.location.replace('index.html');
        return;
    }

    try {
        if (rawUser) JSON.parse(rawUser);
    } catch (e) {
        localStorage.removeItem('currentUser');
        if (!isLoginPage) {
            window.location.replace('index.html');
            return;
        }
    }

    // 2. Initialize Sockets
    if (typeof initSocketConnection === 'function') initSocketConnection();

    // 3. Hardware / Browser Back Button Handler
    initNativeBackButton();
    initBrowserBackGuard();
});

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

function initBrowserBackGuard() {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) return;
    if (!window.history || typeof window.history.pushState !== 'function') return;

    history.pushState({ ludoBackGuard: true }, '', location.href);
    window.addEventListener('popstate', () => {
        const handled = handleAppBackAction();
        if (handled) {
            history.pushState({ ludoBackGuard: true }, '', location.href);
        }
    });
}
