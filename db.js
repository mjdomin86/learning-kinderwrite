import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { sanitizeStickerCounts, pickNextSticker } from './static/stickers.js';

const defaultLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const defaultWords = [
    { c: 'cat', a: 'Cat' },
    { c: 'dog', a: 'Dog' },
    { c: 'sun', a: 'Bee' },
    { c: 'hat', a: 'T-Rex' },
    { c: 'cup', a: 'Triceratops' },
    { c: 'bus', a: 'Elephant' },
    { c: 'ant', a: 'Frog' },
    { c: 'egg', a: 'Owl' },
    { c: 'fig', a: 'Fish' },
    { c: 'jam', a: 'Giraffe' }
];
const defaultAnimals = ['T-Rex', 'Triceratops', 'Elephant', 'Giraffe', 'Cat', 'Dog', 'Frog', 'Owl', 'Bee', 'Fish'];

function withTransaction(db, fn) {
    db.exec('BEGIN IMMEDIATE');
    try {
        const result = fn();
        db.exec('COMMIT');
        return result;
    } catch (error) {
        try { db.exec('ROLLBACK'); } catch { /* ignore rollback errors */ }
        throw error;
    }
}

export function createDatabase(dbPath = process.env.DB_PATH || './kidwrite.db') {
    const db = new DatabaseSync(dbPath);
    db.exec('PRAGMA foreign_keys = ON;');

    db.exec(`
      CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL CHECK(type IN ('letter', 'word')),
        content TEXT NOT NULL,
        animal TEXT NOT NULL,
        display_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS profile_stickers (
        profile_id INTEGER NOT NULL,
        sticker_id TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0 CHECK(count >= 0),
        PRIMARY KEY (profile_id, sticker_id),
        FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
      );
    `);

    const { count } = db.prepare('SELECT COUNT(*) as count FROM items').get();
    if (count === 0) {
        const insertStmt = db.prepare('INSERT INTO items (type, content, animal, display_order) VALUES (?, ?, ?, ?)');
        let order = 1;
        for (let i = 0; i < defaultLetters.length; i++) {
            insertStmt.run('letter', defaultLetters[i], defaultAnimals[i % defaultAnimals.length], order++);
        }
        for (let i = 0; i < defaultWords.length; i++) {
            insertStmt.run('word', defaultWords[i].c, defaultWords[i].a, order++);
        }
    }

    function getStickerCounts(profileId) {
        const rows = db.prepare('SELECT sticker_id, count FROM profile_stickers WHERE profile_id = ? AND count > 0').all(profileId);
        const raw = {};
        for (const row of rows) raw[row.sticker_id] = row.count;
        return sanitizeStickerCounts(raw);
    }

    function formatProfile(row) {
        if (!row) return null;
        return {
            id: row.id,
            name: row.name,
            token: row.token,
            created_at: row.created_at,
            counts: getStickerCounts(row.id),
        };
    }

    return {
        getItems() {
            return db.prepare('SELECT * FROM items ORDER BY display_order ASC, id ASC').all();
        },
        addItem(type, content, animal) {
            const res = db.prepare('SELECT MAX(display_order) as m FROM items').get();
            const maxOrder = res.m || 0;
            const info = db.prepare('INSERT INTO items (type, content, animal, display_order) VALUES (?, ?, ?, ?)').run(type, content, animal, maxOrder + 1);
            return info.lastInsertRowid;
        },
        deleteItem(id) {
            db.prepare('DELETE FROM items WHERE id = ?').run(id);
        },
        reorderItems(updates) {
            const stmt = db.prepare('UPDATE items SET display_order = ? WHERE id = ?');
            updates.forEach(u => stmt.run(u.display_order, u.id));
        },
        createProfile(rawName) {
            const name = typeof rawName === 'string' ? rawName.trim() : '';
            if (!name || name.length > 40) {
                throw new Error('Profile name must be between 1 and 40 characters');
            }
            const token = crypto.randomBytes(16).toString('base64url');
            const info = db.prepare('INSERT INTO profiles (name, token) VALUES (?, ?)').run(name, token);
            return formatProfile(db.prepare('SELECT * FROM profiles WHERE id = ?').get(info.lastInsertRowid));
        },
        listProfiles() {
            const rows = db.prepare('SELECT * FROM profiles ORDER BY created_at ASC, id ASC').all();
            return rows.map(formatProfile);
        },
        getProfileByToken(token) {
            if (typeof token !== 'string' || !token) return null;
            return formatProfile(db.prepare('SELECT * FROM profiles WHERE token = ?').get(token));
        },
        getProfileById(id) {
            return formatProfile(db.prepare('SELECT * FROM profiles WHERE id = ?').get(id));
        },
        deleteProfile(id) {
            const info = db.prepare('DELETE FROM profiles WHERE id = ?').run(id);
            return info.changes > 0;
        },
        setProfileStickers(profileId, rawCounts, mode = 'replace') {
            return withTransaction(db, () => {
                const profile = db.prepare('SELECT id FROM profiles WHERE id = ?').get(profileId);
                if (!profile) return null;
                const clean = sanitizeStickerCounts(rawCounts);
                if (mode === 'replace') {
                    db.prepare('DELETE FROM profile_stickers WHERE profile_id = ?').run(profileId);
                    const insert = db.prepare('INSERT INTO profile_stickers (profile_id, sticker_id, count) VALUES (?, ?, ?)');
                    for (const [stickerId, stickerCount] of Object.entries(clean)) {
                        insert.run(profileId, stickerId, stickerCount);
                    }
                } else {
                    const upsert = db.prepare(`
                      INSERT INTO profile_stickers (profile_id, sticker_id, count)
                      VALUES (?, ?, ?)
                      ON CONFLICT(profile_id, sticker_id) DO UPDATE SET count = MAX(profile_stickers.count, excluded.count)
                    `);
                    for (const [stickerId, stickerCount] of Object.entries(clean)) {
                        upsert.run(profileId, stickerId, stickerCount);
                    }
                }
                return getStickerCounts(profileId);
            });
        },
        earnProfileSticker(profileId, random = Math.random) {
            return withTransaction(db, () => {
                const profile = db.prepare('SELECT id FROM profiles WHERE id = ?').get(profileId);
                if (!profile) return null;
                const counts = getStickerCounts(profileId);
                const sticker = pickNextSticker(counts, random);
                const nextCount = Math.min((counts[sticker.id] || 0) + 1, Number.MAX_SAFE_INTEGER);
                db.prepare(`
                  INSERT INTO profile_stickers (profile_id, sticker_id, count)
                  VALUES (?, ?, ?)
                  ON CONFLICT(profile_id, sticker_id) DO UPDATE SET count = excluded.count
                `).run(profileId, sticker.id, nextCount);
                return { sticker, counts: { ...counts, [sticker.id]: nextCount } };
            });
        },
        close() {
            db.close();
        },
    };
}
