// frontend/js/auth-manager.js

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

document.addEventListener('DOMContentLoaded', () => {
    const rootHtml = document.documentElement;
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const gmailBtn = document.getElementById('gmailBtn');
    const fbBtn = document.getElementById('fbBtn');
    const guestBtn = document.getElementById('guestBtn');
    const toast = document.getElementById('toast');
    const diceScene = document.getElementById('diceScene');
    const cube3d = document.getElementById('cube3d');

    // 1. 3D DICE ROTATION & INTERACTION
    let rotX = 15;
    let rotY = 25;
    let rotZ = 0;
    const baseSpeedX = 0.12;
    const baseSpeedY = 0.18;
    const baseSpeedZ = 0.05;

    let isPointerDown = false;
    let isDragging = false;
    let startX = 0, startY = 0;
    let lastX = 0, lastY = 0;
    let lastTime = 0;
    let velX = 0, velY = 0;

    const animate = () => {
        if (!isPointerDown) {
            rotY += velY;
            rotX += velX;
            velX *= 0.94;
            velY *= 0.94;

            if (Math.abs(velX) < 0.04 && Math.abs(velY) < 0.04) {
                velX = 0;
                velY = 0;
                rotX += baseSpeedX;
                rotY += baseSpeedY;
                rotZ += baseSpeedZ;
            }
        }
        if (cube3d) {
            cube3d.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg) rotateZ(${rotZ}deg)`;
        }
        requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);

    const onPointerDown = (e) => {
        isPointerDown = true;
        isDragging = false;
        const pt = e.touches ? e.touches[0] : e;
        startX = lastX = pt.clientX;
        startY = lastY = pt.clientY;
        lastTime = performance.now();
        velX = 0;
        velY = 0;
    };

    const onPointerMove = (e) => {
        if (!isPointerDown) return;
        const pt = e.touches ? e.touches[0] : e;
        const now = performance.now();
        const dt = Math.max(now - lastTime, 8);
        const dx = pt.clientX - lastX;
        const dy = pt.clientY - lastY;

        if (Math.abs(pt.clientX - startX) > 3 || Math.abs(pt.clientY - startY) > 3) {
            isDragging = true;
        }

        if (isDragging) {
            rotY += dx * 0.75;
            rotX -= dy * 0.75;
            velY = Math.max(-28, Math.min(28, (dx / dt) * 16 * 0.85));
            velX = Math.max(-28, Math.min(28, (-dy / dt) * 16 * 0.85));
        }

        lastX = pt.clientX;
        lastY = pt.clientY;
        lastTime = now;
    };

    const onPointerUp = () => {
        isPointerDown = false;
        isDragging = false;
    };

    if (diceScene) {
        diceScene.addEventListener('mousedown', onPointerDown);
        window.addEventListener('mousemove', onPointerMove);
        window.addEventListener('mouseup', onPointerUp);

        diceScene.addEventListener('touchstart', onPointerDown, { passive: true });
        window.addEventListener('touchmove', onPointerMove, { passive: true });
        window.addEventListener('touchend', onPointerUp);
    }

    // 2. THEME CONTROLLER
    const savedTheme = localStorage.getItem('app_theme') || localStorage.getItem('ludo_theme') || 'dark';
    const initialTheme = (savedTheme === 'light' || savedTheme === 'day') ? 'light' : 'dark';
    rootHtml.setAttribute('data-theme', initialTheme);

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = rootHtml.getAttribute('data-theme');
            const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
            rootHtml.setAttribute('data-theme', nextTheme);
            localStorage.setItem('ludo_theme', nextTheme);
            localStorage.setItem('app_theme', nextTheme === 'light' ? 'day' : 'night');
        });
    }

    // 3. TOAST NOTIFICATION
    let toastTimer;
    const showToast = (message, icon = 'fa-circle-check') => {
        if (!toast) return;
        clearTimeout(toastTimer);
        toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
        toast.classList.add('active');
        toastTimer = setTimeout(() => {
            toast.classList.remove('active');
        }, 1800);
    };

    // 4. CLEAN USER LOGIN & SAFE REDIRECT
    async function completeUserLogin(userData) {
        localStorage.setItem('currentUser', JSON.stringify(userData));
        localStorage.setItem('ludo_user', JSON.stringify(userData));

        try {
            const targetUrl = `${getBackendUrl()}/api/social-login`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const res = await fetch(targetUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            const data = await res.json();
            if (data && data.success && data.user) {
                localStorage.setItem('currentUser', JSON.stringify(data.user));
                localStorage.setItem('ludo_user', JSON.stringify(data.user));
                if (data.token) localStorage.setItem('userToken', data.token);
            }
        } catch (e) {
            console.log("Local session initialized:", e.message);
        }

        window.location.replace('game.html');
    }

    // 5. SOCIAL LOGIN HANDLER
    async function handleSocialResult(result, providerName, avatarId) {
        if (!result || !result.user) return;
        const user = result.user;

        const upgradeIntent = sessionStorage.getItem('ludo_upgrade_intent') === '1';
        if (upgradeIntent && providerName === 'Google') {
            sessionStorage.removeItem('ludo_upgrade_intent');
            await performGuestUpgrade(user, avatarId);
            return;
        }

        const cleanName = (user.displayName || providerName + ' User').replace(/[^a-zA-Z0-9 ]/g, '').trim() || providerName.toLowerCase();
        const uData = {
            id: (providerName === 'Google' ? 'G_' : 'FB_') + user.uid,
            firebaseUid: user.uid,
            name: user.displayName || providerName + ' User',
            username: cleanName.toLowerCase().replace(/\s+/g, '_') + '_' + user.uid.substring(0, 4),
            email: user.email || '',
            coins: 2500, diamonds: 50, level: 1, avatarId, provider: providerName
        };
        showToast(providerName + ' Connected!', providerName === 'Google' ? 'fa-brands fa-google' : 'fa-brands fa-facebook-f');
        await completeUserLogin(uData);
    }

    async function performGuestUpgrade(user, avatarId) {
        let existingUser = {};
        try { existingUser = JSON.parse(localStorage.getItem('currentUser') || '{}'); } catch (e) {}
        const token = localStorage.getItem('userToken');

        try {
            const res = await fetch(`${getBackendUrl()}/api/account/upgrade-guest`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token || ''}`
                },
                body: JSON.stringify({
                    googleId: 'G_' + user.uid,
                    name: user.displayName || existingUser.name,
                    email: user.email || '',
                    avatarId: existingUser.avatarId || avatarId
                })
            });
            const data = await res.json();

            if (data && data.success && data.user) {
                localStorage.setItem('currentUser', JSON.stringify(data.user));
                localStorage.setItem('ludo_user', JSON.stringify(data.user));
                if (data.token) localStorage.setItem('userToken', data.token);
                showToast('Account Google se link ho gaya!', 'fa-circle-check');
            } else {
                showToast((data && data.message) || 'Link nahi ho paya, dobara try karein', 'fa-circle-xmark');
                try { await auth.signOut(); } catch (e) {}
            }
        } catch (e) {
            console.error('Guest upgrade error:', e);
            showToast('Server error, dobara try karein', 'fa-circle-xmark');
        }

        window.location.replace('game.html');
    }

    // 6. START SOCIAL LOGIN (using redirect - more reliable)
    async function startSocialLogin(provider, button, providerName, avatarId) {
        if (!auth || !provider) {
            showToast('Firebase is not configured', 'fa-circle-xmark');
            return;
        }
        try {
            if (firebase && firebase.auth && firebase.auth.Auth && firebase.auth.Auth.Persistence) {
                try {
                    await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
                } catch (pErr) {
                    console.warn('Auth persistence warning:', pErr);
                }
            }
            await auth.signInWithRedirect(provider);
        } catch (err) {
            console.error(providerName + ' login error:', err);
            showToast((err.code || 'Login failed') + ': ' + (err.message || ''), 'fa-circle-xmark');
            button.style.pointerEvents = 'auto';
        }
    }

    // 7. COMPLETE OAUTH REDIRECT
    if (auth) {
        auth.getRedirectResult().then(result => {
            if (result && result.user) {
                const providerId = result.credential && result.credential.providerId;
                const isGoogle = providerId === 'google.com' || (result.user.providerData[0] && result.user.providerData[0].providerId === 'google.com');
                return handleSocialResult(result, isGoogle ? 'Google' : 'Facebook', isGoogle ? 1 : 3);
            }
        }).catch(err => {
            console.error('OAuth redirect error:', err);
            showToast((err.code || 'Login failed') + ': ' + (err.message || ''), 'fa-circle-xmark');
        });
    }

    if (gmailBtn) gmailBtn.addEventListener('click', () => startSocialLogin(googleProvider, gmailBtn, 'Google', 1));
    if (fbBtn) fbBtn.addEventListener('click', () => startSocialLogin(facebookProvider, fbBtn, 'Facebook', 3));

    // 8. GUEST LOGIN
    if (guestBtn) {
        guestBtn.addEventListener('click', async () => {
            guestBtn.style.pointerEvents = 'none';
            guestBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>Entering...</span>`;

            let guestId = localStorage.getItem('ludo_guest_id');
            if (!guestId) {
                guestId = 'Guest_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
                localStorage.setItem('ludo_guest_id', guestId);
            }

            const guestData = {
                id: guestId,
                name: 'Guest ' + guestId.replace('Guest_', '').slice(-5).toUpperCase(),
                username: guestId.toLowerCase(),
                coins: 2500,
                diamonds: 50,
                level: 1,
                avatarId: 8,
                provider: 'Guest'
            };

            showToast(`Welcome ${guestData.name}!`, 'fa-solid fa-gamepad');
            await completeUserLogin(guestData);
        });
    }
});