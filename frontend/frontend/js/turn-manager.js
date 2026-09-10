function updateTurnStatus(text) {
    const statusEl = document.getElementById(UI_ELEMENTS.TURN_STATUS);
    if (statusEl) {
        statusEl.innerText = text;
    }
}
