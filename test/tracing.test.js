import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWord, measureCoverage, bindDrawingInput } from '../static/tracing-core.js';
import { messages } from '../static/translations.js';

const pixels = values => Uint8ClampedArray.from(values.flatMap(alpha => [0, 0, 0, alpha]));
test('Spanish and German words preserve case, accents, umlauts and sharp S', () => {
    for (const word of ['mamá', 'niño', 'pingüino', 'Bär', 'Fuß', 'ÄÖÜẞ', 'Kindergarten']) assert.equal(normalizeWord(word), word);
    assert.equal(normalizeWord('  nin\u0303o  '), 'niño');
    for (const word of ['', '  ', 'two words', '123', '<script>', 'abcdefghijklmnop']) assert.equal(normalizeWord(word), '');
});
test('Spanish and German have matching UI messages and valid word examples', () => {
    assert.deepEqual(Object.keys(messages.es).sort(), Object.keys(messages.de).sort());
    for (const translation of Object.values(messages)) for (const word of translation.examples) assert.equal(normalizeWord(word), word);
});
test('empty drawings and empty masks never report progress', () => {
    assert.equal(measureCoverage(pixels([255, 255, 0]), pixels([0, 0, 0]), pixels([255, 255, 0])).coverage, 0);
    assert.equal(measureCoverage(pixels([0, 0]), pixels([255, 255]), pixels([0, 0])).coverage, 0);
});
test('only letter pixels count; unrelated ink cannot inflate the percentage', () => {
    const target = pixels([255, 255, 0, 0]);
    assert.equal(measureCoverage(target, pixels([0, 0, 255, 255]), target).coverage, 0);
    assert.equal(measureCoverage(target, pixels([255, 0, 255, 255]), target).coverage, 50);
    assert.equal(measureCoverage(target, target, target).coverage, 100);
});
test('full-page scribbling does not unlock a completed letter', () => {
    const target = pixels([255, 0, 0, 0, 0, 0]);
    const result = measureCoverage(target, pixels([255, 255, 255, 255, 255, 255]), pixels([255, 255, 0, 0, 0, 0]));
    assert.equal(result.coverage, 100);
    assert.equal(result.complete, false);
});
test('generous coverage threshold and edge tolerance allow an imperfect trace', () => {
    const target = pixels([255, 255, 255, 255, 255, 0, 0]);
    const result = measureCoverage(target, pixels([255, 255, 255, 255, 0, 255, 0]), pixels([255, 255, 255, 255, 255, 255, 0]));
    assert.equal(result.coverage, 80);
    assert.equal(result.complete, true);
});

class Surface extends EventTarget {
    captures = new Set();
    setPointerCapture(id) { this.captures.add(id); }
    hasPointerCapture(id) { return this.captures.has(id); }
    releasePointerCapture(id) { this.captures.delete(id); }
    contains(target) { return target === this; }
}
function setup() {
    const canvas = new Surface();
    const host = new Surface();
    const calls = [];
    const input = bindDrawingInput(canvas, {
        start: e => calls.push(['start', e.pointerId]),
        move: e => calls.push(['move', e.pointerId]),
        end: () => calls.push(['end']),
    }, host);
    function send(type, id = 1, properties = {}) {
        const event = new Event(type, { cancelable: true });
        Object.assign(event, { pointerId: id, isPrimary: true, button: 0, ...properties });
        canvas.dispatchEvent(event);
    }
    return { canvas, host, calls, input, send };
}
test('a second touch cannot hijack, move, cancel or end the first stroke', () => {
    const { send, calls, input, canvas } = setup();
    send('pointerdown');
    assert.equal(canvas.hasPointerCapture(1), true);
    send('pointerdown', 2, { isPrimary: false });
    send('pointermove', 2);
    send('pointercancel', 2);
    send('pointerup', 2);
    assert.equal(input.isDrawing(), true);
    send('pointermove');
    send('pointerup');
    assert.deepEqual(calls, [['start', 1], ['move', 1], ['move', 1], ['end']]);
    assert.equal(canvas.hasPointerCapture(1), false);
});
test('a pen marked primary cannot replace an active finger', () => {
    const { send, calls } = setup();
    send('pointerdown');
    send('pointerdown', 7, { isPrimary: true, pointerType: 'pen' });
    send('pointermove', 7);
    send('pointerup', 7);
    send('pointerup');
    assert.deepEqual(calls, [['start', 1], ['move', 1], ['end']]);
});
test('the remaining finger never joins the next stroke after the first lifts', () => {
    const { send, calls } = setup();
    send('pointerdown');
    send('pointerdown', 2, { isPrimary: false });
    send('pointerup');
    send('pointermove', 2);
    send('pointerup', 2);
    send('pointerdown', 3);
    send('pointerup', 3);
    assert.deepEqual(calls, [['start', 1], ['move', 1], ['end'], ['start', 3], ['move', 3], ['end']]);
});
test('cancel, lost capture, window blur and explicit reset finish exactly once', () => {
    for (const reason of ['pointercancel', 'lostpointercapture', 'blur', 'reset']) {
        const { send, calls, host, input } = setup();
        send('pointerdown');
        if (reason === 'blur') host.dispatchEvent(new Event('blur'));
        else if (reason === 'reset') input.cancel();
        else send(reason);
        send('pointermove');
        send('pointerup');
        assert.deepEqual(calls, [['start', 1], ['end']], reason);
        assert.equal(input.isDrawing(), false);
    }
});
test('leaving the canvas does not break a captured stroke; right click never draws', () => {
    const { send, calls } = setup();
    send('pointerdown', 9, { button: 2 });
    assert.equal(calls.length, 0);
    send('pointerdown');
    send('pointerout');
    send('pointermove');
    send('pointerup');
    assert.deepEqual(calls, [['start', 1], ['move', 1], ['move', 1], ['end']]);
});
test('extra toolbar touches are blocked during drawing and released afterward', () => {
    const { send, host } = setup();
    send('pointerdown');
    const during = new Event('pointerdown', { cancelable: true });
    host.dispatchEvent(during);
    assert.equal(during.defaultPrevented, true);
    send('pointerup');
    const after = new Event('pointerdown', { cancelable: true });
    host.dispatchEvent(after);
    assert.equal(after.defaultPrevented, false);
});
test('coalesced input samples are preserved', () => {
    const { send, calls } = setup();
    send('pointerdown');
    send('pointermove', 1, { getCoalescedEvents: () => [{ pointerId: 1 }, { pointerId: 1 }] });
    send('pointercancel');
    assert.deepEqual(calls, [['start', 1], ['move', 1], ['move', 1], ['end']]);
});

test('an accidental toolbar click stays blocked after the drawing finger lifts', () => {
    const { send, host } = setup();
    const event = type => Object.assign(new Event(type, { cancelable: true }), { pointerId: 2 });
    send('pointerdown');
    host.dispatchEvent(event('pointerdown'));
    send('pointerup');
    const delayedClick = event('click');
    host.dispatchEvent(delayedClick);
    assert.equal(delayedClick.defaultPrevented, true);
    host.dispatchEvent(event('pointerdown'));
    const intentionalClick = event('click');
    host.dispatchEvent(intentionalClick);
    assert.equal(intentionalClick.defaultPrevented, false);
});
