import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from '../db.js';
import { createApp } from '../server.js';
import { stickers } from '../static/stickers.js';

function createTestServer() {
    const db = createDatabase(':memory:');
    const app = createApp({
        db,
        isProduction: false,
        cookieSecret: 'test-cookie-secret-with-at-least-32-chars',
        adminUser: 'admin',
        adminPass: 'secret123',
        logger: false,
    });
    return { db, app };
}

function cookieHeader(res, name) {
    const found = res.cookies.find(c => c.name === name);
    assert.ok(found, `Expected cookie ${name}`);
    return `${found.name}=${found.value}`;
}

test('database manages profiles, sticker imports, and fair sticker earning', () => {
    const db = createDatabase(':memory:');
    try {
        const leo = db.createProfile('  Leo  ');
        assert.equal(leo.name, 'Leo');
        assert.ok(leo.token.length >= 16);
        assert.deepEqual(leo.counts, {});

        const replaced = db.setProfileStickers(leo.id, { fox: 2, invalid: 5, lion: -1 }, 'replace');
        assert.deepEqual(replaced, { fox: 2 });

        const merged = db.setProfileStickers(leo.id, { fox: 1, lion: 3 }, 'merge');
        assert.deepEqual(merged, { fox: 2, lion: 3 });

        const earnedSet = new Set(Object.keys(merged));
        for (let i = 0; i < stickers.length - 2; i++) {
            const earned = db.earnProfileSticker(leo.id);
            assert.ok(!earnedSet.has(earned.sticker.id), `Expected unseen sticker before duplicate: ${earned.sticker.id}`);
            earnedSet.add(earned.sticker.id);
        }
        assert.equal(earnedSet.size, stickers.length);

        const loaded = db.getProfileByToken(leo.token);
        assert.equal(Object.keys(loaded.counts).length, stickers.length);

        assert.equal(db.deleteProfile(leo.id), true);
        assert.equal(db.getProfileByToken(leo.token), null);
    } finally {
        db.close();
    }
});

test('admin routes require authentication and manage kid profiles', async () => {
    const { db, app } = createTestServer();
    try {
        const unauth = await app.inject({ method: 'GET', url: '/api/admin/profiles' });
        assert.equal(unauth.statusCode, 401);

        const login = await app.inject({
            method: 'POST',
            url: '/api/login',
            payload: { username: 'admin', password: 'secret123' },
        });
        assert.equal(login.statusCode, 200);
        const adminCookie = cookieHeader(login, 'admin_session');

        const created = await app.inject({
            method: 'POST',
            url: '/api/admin/profiles',
            headers: { cookie: adminCookie },
            payload: { name: 'Leo' },
        });
        assert.equal(created.statusCode, 201);
        const profile = created.json();
        assert.equal(profile.name, 'Leo');

        const updated = await app.inject({
            method: 'PUT',
            url: `/api/admin/profiles/${profile.id}/stickers`,
            headers: { cookie: adminCookie },
            payload: { counts: { fox: 2, owl: 1 }, mode: 'replace' },
        });
        assert.equal(updated.statusCode, 200);
        assert.deepEqual(updated.json().counts, { fox: 2, owl: 1 });

        const listed = await app.inject({
            method: 'GET',
            url: '/api/admin/profiles',
            headers: { cookie: adminCookie },
        });
        assert.equal(listed.statusCode, 200);
        assert.equal(listed.json().length, 1);
        assert.deepEqual(listed.json()[0].counts, { fox: 2, owl: 1 });
    } finally {
        await app.close();
        db.close();
    }
});

test('kid profile links set session cookie, earn stickers, and merge localStorage idempotently', async () => {
    const { db, app } = createTestServer();
    try {
        const profile = db.createProfile('Leo');
        db.setProfileStickers(profile.id, { fox: 2 }, 'replace');

        const noSession = await app.inject({ method: 'GET', url: '/api/kid/stickers' });
        assert.equal(noSession.statusCode, 200);
        assert.deepEqual(noSession.json(), { active: false, counts: {} });

        const blockedEarn = await app.inject({ method: 'POST', url: '/api/kid/stickers/earn' });
        assert.equal(blockedEarn.statusCode, 401);

        const badLink = await app.inject({ method: 'GET', url: '/?kid=nonexistent-token' });
        assert.equal(badLink.statusCode, 200);
        assert.equal(badLink.cookies.some(c => c.name === 'kid_session'), false);

        const goodLink = await app.inject({ method: 'GET', url: `/?kid=${encodeURIComponent(profile.token)}` });
        assert.equal(goodLink.statusCode, 200);
        const kidCookie = cookieHeader(goodLink, 'kid_session');

        const merged = await app.inject({
            method: 'POST',
            url: '/api/kid/stickers/merge',
            headers: { cookie: kidCookie },
            payload: { counts: { fox: 1, lion: 3, bogus: 9 } },
        });
        assert.equal(merged.statusCode, 200);
        assert.deepEqual(merged.json().counts, { fox: 2, lion: 3 });

        const earned = await app.inject({
            method: 'POST',
            url: '/api/kid/stickers/earn',
            headers: { cookie: kidCookie },
        });
        assert.equal(earned.statusCode, 200);
        const body = earned.json();
        assert.ok(!['fox', 'lion'].includes(body.sticker.id));
        assert.equal(body.counts[body.sticker.id], 1);

        const fetched = await app.inject({
            method: 'GET',
            url: '/api/kid/stickers',
            headers: { cookie: kidCookie },
        });
        assert.equal(fetched.statusCode, 200);
        assert.equal(fetched.json().active, true);
        assert.equal(fetched.json().profile.name, 'Leo');
        assert.equal(fetched.json().counts[body.sticker.id], 1);
    } finally {
        await app.close();
        db.close();
    }
});
