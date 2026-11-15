import { DatabaseSync } from 'node:sqlite';

const dbPath = process.env.DB_PATH || './kidwrite.db';
let db;
try {
    db = new DatabaseSync(dbPath);
} catch (e) {
    console.error("Failed to open DB:", e);
    process.exit(1);
}

// Create table if not exists
db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('letter', 'word')),
    content TEXT NOT NULL,
    animal TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed database if empty
const countStmt = db.prepare('SELECT COUNT(*) as count FROM items');
const { count } = countStmt.get();

if (count === 0) {
    const insertStmt = db.prepare('INSERT INTO items (type, content, animal, display_order) VALUES (?, ?, ?, ?)');

    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    // Simple words and animals
    const words = [
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

    // Also assign random animals to sequence of letters just to have variety
    const animals = ['T-Rex', 'Triceratops', 'Elephant', 'Giraffe', 'Cat', 'Dog', 'Frog', 'Owl', 'Bee', 'Fish'];

    let order = 1;
    for (let i = 0; i < letters.length; i++) {
        insertStmt.run('letter', letters[i], animals[i % animals.length], order++);
    }
    for (let i = 0; i < words.length; i++) {
        insertStmt.run('word', words[i].c, words[i].a, order++);
    }
}

export function getItems() {
    const stmt = db.prepare('SELECT * FROM items ORDER BY display_order ASC, id ASC');
    return stmt.all();
}

export function addItem(type, content, animal) {
    const maxStmt = db.prepare('SELECT MAX(display_order) as m FROM items');
    const res = maxStmt.get();
    const maxOrder = res.m || 0;

    const stmt = db.prepare('INSERT INTO items (type, content, animal, display_order) VALUES (?, ?, ?, ?)');
    const info = stmt.run(type, content, animal, maxOrder + 1);
    return info.lastInsertRowid;
}

export function deleteItem(id) {
    const stmt = db.prepare('DELETE FROM items WHERE id = ?');
    stmt.run(id);
}

export function reorderItems(updates) {
    const stmt = db.prepare('UPDATE items SET display_order = ? WHERE id = ?');
    updates.forEach(u => {
        stmt.run(u.display_order, u.id);
    });
}
