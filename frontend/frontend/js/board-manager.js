// frontend/js/board-manager.js

function generateBoardTracks() {
    const trackTop = document.getElementById('trackTop');
    const trackLeft = document.getElementById('trackLeft');
    const trackRight = document.getElementById('trackRight');
    const trackBottom = document.getElementById('trackBottom');

    if (!trackTop || !trackLeft || !trackRight || !trackBottom) return;

    trackTop.innerHTML = '';
    trackLeft.innerHTML = '';
    trackRight.innerHTML = '';
    trackBottom.innerHTML = '';

    createTrackGrid(trackTop, 6, 3, 'top');
    createTrackGrid(trackLeft, 3, 6, 'left');
    createTrackGrid(trackRight, 3, 6, 'right');
    createTrackGrid(trackBottom, 6, 3, 'bottom');

    assignCommonPathIndexes();
    initializeTokensForActivePlayers();
}

function createTrackGrid(container, rows, cols, type) {
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.track = type;
            cell.dataset.row = r;
            cell.dataset.col = c;

            if (type === 'top') {
                if (c === 1 && r >= 1 && r <= 5) cell.classList.add('cell-path-yellow', `home-yellow-${r-1}`);
                if (r === 1 && c === 2) cell.classList.add('cell-path-yellow');
                if (r === 2 && c === 0) cell.classList.add('cell-star');
            } else if (type === 'left') {
                if (r === 1 && c >= 1 && c <= 5) cell.classList.add('cell-path-green', `home-green-${c-1}`);
                if (r === 0 && c === 1) cell.classList.add('cell-path-green');
                if (r === 2 && c === 2) cell.classList.add('cell-star');
            } else if (type === 'right') {
                if (r === 1 && c >= 0 && c <= 4) cell.classList.add('cell-path-blue', `home-blue-${4-c}`);
                if (r === 2 && c === 4) cell.classList.add('cell-path-blue');
                if (r === 0 && c === 3) cell.classList.add('cell-star');
            } else if (type === 'bottom') {
                if (c === 1 && r >= 0 && r <= 4) cell.classList.add('cell-path-red', `home-red-${4-r}`);
                if (r === 4 && c === 0) cell.classList.add('cell-path-red');
                if (r === 3 && c === 2) cell.classList.add('cell-star');
            }

            container.appendChild(cell);
        }
    }
}

function assignCommonPathIndexes() {
    const pathMapping = [
        { track: 'bottom', r: 4, c: 0 }, { track: 'bottom', r: 3, c: 0 }, { track: 'bottom', r: 2, c: 0 }, { track: 'bottom', r: 1, c: 0 }, { track: 'bottom', r: 0, c: 0 },
        { track: 'left', r: 2, c: 5 }, { track: 'left', r: 2, c: 4 }, { track: 'left', r: 2, c: 3 }, { track: 'left', r: 2, c: 2 }, { track: 'left', r: 2, c: 1 }, { track: 'left', r: 2, c: 0 },
        { track: 'left', r: 1, c: 0 }, { track: 'left', r: 0, c: 0 },
        { track: 'left', r: 0, c: 1 }, { track: 'left', r: 0, c: 2 }, { track: 'left', r: 0, c: 3 }, { track: 'left', r: 0, c: 4 }, { track: 'left', r: 0, c: 5 },
        { track: 'top', r: 5, c: 0 }, { track: 'top', r: 4, c: 0 }, { track: 'top', r: 3, c: 0 }, { track: 'top', r: 2, c: 0 }, { track: 'top', r: 1, c: 0 }, { track: 'top', r: 0, c: 0 },
        { track: 'top', r: 0, c: 1 }, { track: 'top', r: 0, c: 2 },
        { track: 'top', r: 1, c: 2 }, { track: 'top', r: 2, c: 2 }, { track: 'top', r: 3, c: 2 }, { track: 'top', r: 4, c: 2 }, { track: 'top', r: 5, c: 2 },
        { track: 'right', r: 0, c: 0 }, { track: 'right', r: 0, c: 1 }, { track: 'right', r: 0, c: 2 }, { track: 'right', r: 0, c: 3 }, { track: 'right', r: 0, c: 4 }, { track: 'right', r: 0, c: 5 },
        { track: 'right', r: 1, c: 5 }, { track: 'right', r: 2, c: 5 },
        { track: 'right', r: 2, c: 4 }, { track: 'right', r: 2, c: 3 }, { track: 'right', r: 2, c: 2 }, { track: 'right', r: 2, c: 1 }, { track: 'right', r: 2, c: 0 },
        { track: 'bottom', r: 0, c: 2 }, { track: 'bottom', r: 1, c: 2 }, { track: 'bottom', r: 2, c: 2 }, { track: 'bottom', r: 3, c: 2 }, { track: 'bottom', r: 4, c: 2 }, { track: 'bottom', r: 5, c: 2 },
        { track: 'bottom', r: 5, c: 1 }, { track: 'bottom', r: 5, c: 0 }
    ];

    pathMapping.forEach((pos, idx) => {
        const cell = document.querySelector(`.cell[data-track="${pos.track}"][data-row="${pos.r}"][data-col="${pos.c}"]`);
        if (cell) cell.id = `path-cell-${idx}`;
    });
}

function initializeTokensForActivePlayers() {
    const allColors = ['red', 'green', 'yellow', 'blue'];
    const activeColors = playersList.map(p => p.color);

    allColors.forEach(color => {
        for (let i = 0; i < 4; i++) {
            const slot = document.getElementById(`slot-${color}-${i}`);
            if (slot) {
                if (activeColors.includes(color)) {
                    slot.innerHTML = `<div class="goti-piece piece-${color}" id="token-${color}-${i}" onclick="handleTokenClick('${color}', ${i})"></div>`;
                } else {
                    slot.innerHTML = '';
                }
            }
        }
    });
    updateAllCellTokenCounts();
}

function updateAllCellTokenCounts() {
    document.querySelectorAll('.cell, .home-triangle').forEach(cell => {
        const gotiCount = cell.querySelectorAll('.goti-piece').length;
        cell.setAttribute('data-tokens', gotiCount.toString());
    });
}
