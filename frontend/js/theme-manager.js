// frontend/js/theme-manager.js
// ==========================================================================
// GOTI THEME + LUDO BOARD THEME MANAGER
// - Goti themes runtime par SVG (data-URI) se bante hain, isliye koi naya
//   image asset add karne ki zarurat nahi (APK size nahi badhta).
// - Board themes sirf CSS variables badalte hain (board.css var() use karta hai).
// - Dono choices localStorage me save hoti hain.
// ==========================================================================

const TOKEN_COLORS = {
    red:    { base: '#e52521', light: '#ff8a7a', dark: '#8d120f' },
    green:  { base: '#00a651', light: '#5ff0a4', dark: '#046b36' },
    yellow: { base: '#ffc20e', light: '#ffe89a', dark: '#9c7300' },
    blue:   { base: '#0072ce', light: '#79bdf7', dark: '#00417a' }
};

const PAWN_BODY = 'M20 3.5c4.3 0 7.8 3.5 7.8 7.8 0 2.4-1.1 4.6-2.9 6 1.5 .9 2.4 2 2.4 3.1 0 1-.7 1.9-1.9 2.6 4.6 4.7 7.2 11.2 7.9 18.5H6.7c.7-7.3 3.3-13.8 7.9-18.5-1.2-.7-1.9-1.6-1.9-2.6 0-1.1 .9-2.2 2.4-3.1a7.78 7.78 0 0 1-2.9-6c0-4.3 3.5-7.8 7.8-7.8z';

const TOKEN_THEMES = {
    classic: { label: 'Classic', desc: 'Original pawn' },
    glossy:  { label: 'Glossy',  desc: '3D shine' },
    neon:    { label: 'Neon',    desc: 'Glow edge' },
    royal:   { label: 'Royal',   desc: 'Crown top' }
};

const BOARD_THEMES = {
    classic:  { label: 'Classic',  swatch: ['#e52521', '#00a651', '#ffc20e', '#0072ce'] },
    midnight: { label: 'Midnight', swatch: ['#ff4d6d', '#22d3a6', '#ffd166', '#4d8dff'] },
    wood:     { label: 'Wood',     swatch: ['#b4442f', '#4f7a3a', '#d99b34', '#3a6a86'] },
    candy:    { label: 'Candy',    swatch: ['#ff7aa2', '#7ee3a6', '#ffd98e', '#8fb8ff'] },
    ocean:    { label: 'Ocean',    swatch: ['#ef476f', '#06d6a0', '#ffd166', '#118ab2'] }
};

function svgUri(inner) {
    const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 56">${inner}</svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function buildTokenSvg(theme, colorKey) {
    const c = TOKEN_COLORS[colorKey];
    const gid = `g_${theme}_${colorKey}`;

    if (theme === 'glossy') {
        return svgUri(`
<defs>
  <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${c.light}"/>
    <stop offset="45%" stop-color="${c.base}"/>
    <stop offset="100%" stop-color="${c.dark}"/>
  </linearGradient>
</defs>
<g>
  <path d="${PAWN_BODY}" fill="url(#${gid})" stroke="#ffffff" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M17.2 6.4c-1.7 1.1-2.6 2.7-2.6 4.6 0 1.1 .3 2.1 .9 3 -0.9-.6-1.6-2-1.6-3.6 0-2 1.3-3.7 3.3-4z" fill="#ffffff" opacity="0.75"/>
  <path d="M14.6 28.5c-2.6 3.6-4.3 8-4.9 12.9h3.4c.5-4.7 2-8.9 4.3-12.4z" fill="#ffffff" opacity="0.35"/>
  <rect x="2" y="41" width="36" height="10.5" rx="5.25" fill="url(#${gid})" stroke="#ffffff" stroke-width="1.6"/>
  <rect x="5.5" y="43.2" width="12" height="2.6" rx="1.3" fill="#ffffff" opacity="0.5"/>
</g>`);
    }

    if (theme === 'neon') {
        return svgUri(`
<defs>
  <filter id="${gid}f" x="-60%" y="-60%" width="220%" height="220%">
    <feGaussianBlur stdDeviation="1.8" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#20213a"/>
    <stop offset="100%" stop-color="#0a0a14"/>
  </linearGradient>
</defs>
<g filter="url(#${gid}f)">
  <path d="${PAWN_BODY}" fill="url(#${gid})" stroke="${c.light}" stroke-width="2.6" stroke-linejoin="round"/>
  <rect x="2.4" y="41.4" width="35.2" height="9.8" rx="4.9" fill="url(#${gid})" stroke="${c.light}" stroke-width="2.6"/>
  <circle cx="20" cy="11.3" r="2.6" fill="${c.light}"/>
</g>`);
    }

    if (theme === 'royal') {
        return svgUri(`
<defs>
  <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${c.light}"/>
    <stop offset="50%" stop-color="${c.base}"/>
    <stop offset="100%" stop-color="${c.dark}"/>
  </linearGradient>
  <linearGradient id="${gid}c" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#fff3b0"/>
    <stop offset="55%" stop-color="#ffcc33"/>
    <stop offset="100%" stop-color="#b8860b"/>
  </linearGradient>
</defs>
<g>
  <path d="${PAWN_BODY}" fill="url(#${gid})" stroke="#2b1a05" stroke-width="1.5" stroke-linejoin="round"/>
  <rect x="2" y="41" width="36" height="10.5" rx="5.25" fill="url(#${gid})" stroke="#2b1a05" stroke-width="1.5"/>
  <path d="M11.5 9.5l3.4 3.1 5.1-6.1 5.1 6.1 3.4-3.1-1.6 9.2H13.1z" fill="url(#${gid}c)" stroke="#7a5200" stroke-width="1.1" stroke-linejoin="round"/>
  <circle cx="20" cy="4.6" r="2" fill="#fff3b0" stroke="#7a5200" stroke-width="0.9"/>
  <path d="M14.6 30c-2.3 3.3-3.8 7.1-4.4 11h3.2c.5-3.8 1.8-7.3 3.7-10.2z" fill="#ffffff" opacity="0.28"/>
</g>`);
    }

    return null; // classic = original PNG
}

function injectTokenThemeStyles() {
    if (document.getElementById('token-theme-styles')) return;
    let css = '';
    Object.keys(TOKEN_THEMES).forEach(theme => {
        if (theme === 'classic') return;
        Object.keys(TOKEN_COLORS).forEach(color => {
            const uri = buildTokenSvg(theme, color);
            if (!uri) return;
            css +=
`[data-token-theme="${theme}"] .piece-${color},
[data-token-theme="${theme}"] .goti.${color},
.token-preview[data-preview-theme="${theme}"][data-preview-color="${color}"]{background-image:url("${uri}") !important;}\n`;
        });
    });
    // Preview swatches inside the picker must always show their OWN theme,
    // never the currently active one.
    Object.keys(TOKEN_COLORS).forEach(color => {
        css += `.token-preview[data-preview-theme="classic"][data-preview-color="${color}"]{background-image:url("assets/image/${color}-pawn.png") !important;}\n`;
    });
    const styleEl = document.createElement('style');
    styleEl.id = 'token-theme-styles';
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
}

// --------------------------------------------------------------------------
// APPLY / SAVE
// --------------------------------------------------------------------------
function getTokenTheme() {
    const v = localStorage.getItem('goti_theme');
    return TOKEN_THEMES[v] ? v : 'classic';
}

function getBoardTheme() {
    const v = localStorage.getItem('board_theme');
    return BOARD_THEMES[v] ? v : 'classic';
}

function applySavedThemes() {
    document.documentElement.setAttribute('data-token-theme', getTokenTheme());
    document.documentElement.setAttribute('data-board-theme', getBoardTheme());
}

function setTokenTheme(name) {
    if (!TOKEN_THEMES[name]) return;
    localStorage.setItem('goti_theme', name);
    document.documentElement.setAttribute('data-token-theme', name);
    markThemeSelection();
    if (typeof playSound === 'function') playSound('move');
}

function setBoardTheme(name) {
    if (!BOARD_THEMES[name]) return;
    localStorage.setItem('board_theme', name);
    document.documentElement.setAttribute('data-board-theme', name);
    markThemeSelection();
    if (typeof playSound === 'function') playSound('move');
}

function markThemeSelection() {
    const tk = getTokenTheme();
    const bd = getBoardTheme();
    document.querySelectorAll('.theme-card[data-token-option]').forEach(el => {
        el.classList.toggle('selected', el.dataset.tokenOption === tk);
    });
    document.querySelectorAll('.theme-card[data-board-option]').forEach(el => {
        el.classList.toggle('selected', el.dataset.boardOption === bd);
    });
}

// --------------------------------------------------------------------------
// MODAL UI
// --------------------------------------------------------------------------
function buildThemeModalContent() {
    const tokenGrid = document.getElementById('token-theme-grid');
    const boardGrid = document.getElementById('board-theme-grid');
    if (!tokenGrid || !boardGrid || tokenGrid.dataset.built === '1') return;

    tokenGrid.innerHTML = Object.keys(TOKEN_THEMES).map(key => {
        const t = TOKEN_THEMES[key];
        const previews = ['red', 'green', 'yellow', 'blue'].map(c =>
            `<span class="token-preview" data-preview-theme="${key}" data-preview-color="${c}"></span>`
        ).join('');
        return `<div class="theme-card" data-token-option="${key}" onclick="setTokenTheme('${key}')">
            <div class="theme-card-preview">${previews}</div>
            <span class="theme-card-title">${t.label}</span>
            <span class="theme-card-desc">${t.desc}</span>
            <span class="theme-tick">✓</span>
        </div>`;
    }).join('');

    boardGrid.innerHTML = Object.keys(BOARD_THEMES).map(key => {
        const b = BOARD_THEMES[key];
        return `<div class="theme-card" data-board-option="${key}" onclick="setBoardTheme('${key}')">
            <div class="board-mini board-mini-${key}">
                <span style="background:${b.swatch[1]}"></span>
                <span style="background:${b.swatch[2]}"></span>
                <span style="background:${b.swatch[0]}"></span>
                <span style="background:${b.swatch[3]}"></span>
            </div>
            <span class="theme-card-title">${b.label}</span>
            <span class="theme-tick">✓</span>
        </div>`;
    }).join('');

    tokenGrid.dataset.built = '1';
}

function openThemeModal() {
    injectTokenThemeStyles();
    buildThemeModalContent();
    markThemeSelection();
    const overlay = document.getElementById('theme-modal-overlay');
    if (overlay) overlay.style.display = 'flex';
    if (typeof playSound === 'function') playSound('move');
}

function closeThemeModal() {
    const overlay = document.getElementById('theme-modal-overlay');
    if (overlay) overlay.style.display = 'none';
}

// --------------------------------------------------------------------------
// QUICK ACTION ROW: top bar ke saath hi dikhe / chhupe
// --------------------------------------------------------------------------
function syncQuickActionsWithTopBar() {
    const topBar = document.getElementById('main-top-bar');
    const row = document.getElementById('quick-actions-row');
    if (!topBar || !row) return;

    const sync = () => {
        const hidden = window.getComputedStyle(topBar).display === 'none';
        row.style.display = hidden ? 'none' : 'flex';
    };
    sync();
    new MutationObserver(sync).observe(topBar, { attributes: true, attributeFilter: ['style', 'class'] });
}

// Themes turant apply karo (DOMContentLoaded ka wait nahi, warna flash hota hai)
applySavedThemes();

document.addEventListener('DOMContentLoaded', () => {
    applySavedThemes();
    injectTokenThemeStyles();
    syncQuickActionsWithTopBar();
});
