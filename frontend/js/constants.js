const GAME_VIEWS = {
    MENU: 'main-menu-view',
    SETUP: 'computer-setup-view',
    GAME_PLAY: 'game-play-view'
};

const UI_ELEMENTS = {
    TOP_BAR: 'main-top-bar',
    LOGO: 'main-logo',
    BOTTOM_BAR: 'main-bottom-bar',
    TURN_STATUS: 'turn-status'
};

const DICE_3D_ROTATIONS = {
    1: 'rotateX(0deg) rotateY(0deg)',
    2: 'rotateX(0deg) rotateY(-90deg)',
    3: 'rotateX(90deg) rotateY(0deg)',
    4: 'rotateX(-90deg) rotateY(0deg)',
    5: 'rotateX(0deg) rotateY(90deg)',
    6: 'rotateX(0deg) rotateY(180deg)'
};

// 8 Safe Positions on 52 Track (4 Starts + 4 Stars)
const SAFE_POSITIONS = [0, 8, 13, 21, 26, 34, 39, 47];

// Standard Starting Points & Home Track Configurations
const PLAYER_CONFIGS = {
    red:    { startPos: 0,  homePathPrefix: 'home-red-' },
    green:  { startPos: 13, homePathPrefix: 'home-green-' },
    yellow: { startPos: 26, homePathPrefix: 'home-yellow-' },
    blue:   { startPos: 39, homePathPrefix: 'home-blue-' }
};
