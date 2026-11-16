import test from 'node:test';
import assert from 'node:assert/strict';
import { createStickerCollection, collectionKey, stickers } from '../static/stickers.js';

function memoryStorage() {
    const data = new Map();
    return { getItem: key => data.get(key) || null, setItem: (key, value) => data.set(key, value) };
}
test('the expanded album has at least 50 distinct, translated stickers', () => {
    assert.ok(stickers.length >= 50);
    assert.equal(new Set(stickers.map(sticker => sticker.emoji)).size, stickers.length);
    for (const sticker of stickers) assert.ok(sticker.es && sticker.de, sticker.id);
});

test('the expanded album preserves all original stickers and awards a new one', () => {
    const storage = memoryStorage();
    const originalIds = ['fox', 'lion', 'butterfly', 'panda', 'dinosaur', 'whale', 'owl', 'bee', 'turtle', 'octopus', 'rabbit', 'unicorn'];
    const counts = Object.fromEntries(originalIds.map(id => [id, 2]));
    storage.setItem(collectionKey, JSON.stringify(counts));
    const collection = createStickerCollection(() => storage);
    assert.deepEqual(collection.read().counts, counts);
    const { sticker } = collection.earn();
    assert.ok(!originalIds.includes(sticker.id));
    assert.deepEqual(collection.read().counts, { ...counts, [sticker.id]: 1 });
});
test('collects every animal before duplicates, preserves counts after reloading', () => {
    const storage = memoryStorage();
    const collection = createStickerCollection(() => storage);
    const earned = new Set();
    for (let i = 0; i < stickers.length; i++) earned.add(collection.earn().sticker.id);
    assert.equal(earned.size, stickers.length);
    collection.earn();
    const restored = createStickerCollection(() => storage).read();
    assert.equal(restored.persistent, true);
    assert.equal(Object.values(restored.counts).reduce((sum, n) => sum + n, 0), stickers.length + 1);
});
test('filters invalid saved counts and unknown sticker IDs', () => {
    const storage = memoryStorage();
    storage.setItem(collectionKey, JSON.stringify({ fox: 2, lion: -1, panda: '4', bee: 1.5, unknown: 6 }));
    assert.deepEqual(createStickerCollection(() => storage).read().counts, { fox: 2 });
});
test('corrupt storage recovers when a sticker is earned', () => {
    const storage = memoryStorage();
    storage.setItem(collectionKey, '{broken');
    const collection = createStickerCollection(() => storage);
    assert.doesNotThrow(() => collection.earn());
    assert.equal(Object.keys(collection.read().counts).length, 1);
});
test('blocked storage keeps session rewards and reports that saving failed', () => {
    const collection = createStickerCollection(() => { throw new Error('Blocked'); });
    collection.earn();
    collection.earn();
    const state = collection.read();
    assert.equal(state.persistent, false);
    assert.equal(Object.keys(state.counts).length, 2);
});
test('quota errors do not discard session rewards on the next read', () => {
    const collection = createStickerCollection(() => ({ getItem: () => '{}', setItem: () => { throw new Error('Quota'); } }));
    collection.earn();
    collection.earn();
    assert.equal(Object.keys(collection.read().counts).length, 2);
    assert.equal(collection.read().persistent, false);
});
