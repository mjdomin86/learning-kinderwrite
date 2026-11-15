// Geometry and input rules shared by the browser and regression tests.
export function normalizeWord(value) {
    const word = value.normalize('NFC').trim();
    return /^\p{L}[\p{L}\p{M}]*$/u.test(word) && Array.from(word).length <= 12 ? word : '';
}

export function measureCoverage(target, ink, tolerance) {
    let total = 0, covered = 0, drawn = 0, onTrack = 0;
    for (let i = 3; i < target.length; i += 4) {
        const hasInk = ink[i] > 32;
        if (target[i] > 128) {
            total++;
            if (hasInk) covered++;
        }
        if (hasInk) {
            drawn++;
            if (tolerance[i] > 32) onTrack++;
        }
    }
    const coverage = total ? Math.floor(covered / total * 100) : 0;
    const precision = drawn ? onTrack / drawn : 1;
    return { coverage, precision, complete: coverage >= 80 && precision >= 0.55 };
}

// A captured pointer owns the entire stroke. Other fingers cannot move,
// finish, or take over that stroke, even if they belong to another device.
export function bindDrawingInput(canvas, { start, move, end }, host = window) {
    let activeId = null;
    const blockedPointers = new Set();
    function finish(event) {
        if (activeId === null || (event && event.pointerId !== activeId)) return;
        const id = activeId;
        activeId = null;
        if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
        end();
    }
    canvas.addEventListener('pointerdown', event => {
        event.preventDefault();
        if (activeId !== null || !event.isPrimary || event.button !== 0) return;
        activeId = event.pointerId;
        canvas.setPointerCapture(activeId);
        start(event);
    });
    canvas.addEventListener('pointermove', event => {
        if (event.pointerId !== activeId) return;
        event.preventDefault();
        const samples = event.getCoalescedEvents?.();
        for (const sample of samples?.length ? samples : [event]) move(sample);
    });
    canvas.addEventListener('pointerup', event => {
        if (event.pointerId !== activeId) return;
        move(event);
        finish(event);
    });
    canvas.addEventListener('pointercancel', finish);
    canvas.addEventListener('lostpointercapture', finish);
    canvas.addEventListener('contextmenu', event => event.preventDefault());
    host.addEventListener('blur', () => finish());
    host.addEventListener('pagehide', () => finish());
    host.document?.addEventListener('visibilitychange', () => {
        if (host.document.hidden) finish();
    });
    // Block accidental toolbar touches while a finger is on the board.
    const blockExtraTouch = event => {
        if (event.type === 'pointerdown') blockedPointers.delete(event.pointerId);
        const blockedClick = event.type === 'click' && blockedPointers.has(event.pointerId);
        if (blockedClick || (activeId !== null && !canvas.contains(event.target))) {
            if (event.type === 'pointerdown') {
                // A click may arrive after the drawing finger has lifted.
                if (blockedPointers.size >= 32) blockedPointers.delete(blockedPointers.values().next().value);
                blockedPointers.add(event.pointerId);
            }
            event.preventDefault();
            event.stopImmediatePropagation();
        }
        if (event.type === 'click') blockedPointers.delete(event.pointerId);
    };
    host.addEventListener('pointerdown', blockExtraTouch, true);
    host.addEventListener('click', blockExtraTouch, true);
    return { cancel: () => finish(), isDrawing: () => activeId !== null };
}
