import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCookie from '@fastify/cookie';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createDatabase } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KID_COOKIE = 'kid_session';
const KID_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function createApp({
    db,
    isProduction = process.env.NODE_ENV === 'production',
    cookieSecret = process.env.COOKIE_SECRET || (isProduction ? '' : 'development-only-kidwrite-cookie-secret'),
    adminUser = process.env.ADMIN_USER || 'admin',
    adminPass = process.env.ADMIN_PASS || 'kidwrite2024',
    logger = true,
} = {}) {
    if (!db) throw new Error('Database instance is required');
    if (cookieSecret.length < 32) {
        throw new Error('COOKIE_SECRET must contain at least 32 characters');
    }

    const fastify = Fastify({ logger });

    fastify.register(fastifyCookie, {
        secret: cookieSecret,
    });

    const setKidCookie = (reply, token) => {
        reply.setCookie(KID_COOKIE, token, {
            path: '/',
            httpOnly: true,
            secure: isProduction,
            signed: true,
            sameSite: 'lax',
            maxAge: KID_COOKIE_MAX_AGE,
        });
    };

    const getKidProfile = (request) => {
        const cookie = request.cookies?.[KID_COOKIE];
        const unsigned = cookie ? request.unsignCookie(cookie) : null;
        if (!unsigned?.valid || !unsigned.value) return null;
        return db.getProfileByToken(unsigned.value);
    };

    fastify.addHook('onRequest', async (request, reply) => {
        if (request.method !== 'GET' || request.url.startsWith('/api/')) return;
        const kidToken = new URL(request.url, 'http://localhost').searchParams.get('kid');
        if (!kidToken) return;
        const profile = db.getProfileByToken(kidToken);
        if (profile) setKidCookie(reply, profile.token);
    });

    fastify.register(fastifyStatic, {
        root: path.join(__dirname, 'static'),
        prefix: '/',
    });

    fastify.get('/admin', async (request, reply) => {
        return reply.sendFile('admin.html');
    });
    fastify.get('/trace', async (request, reply) => {
        return reply.sendFile('trace.html');
    });

    fastify.get('/healthz', async () => {
        return { status: 'ok' };
    });

    const verifyAdmin = async (request, reply) => {
        const session = request.cookies.admin_session;
        const unsigned = session ? request.unsignCookie(session) : null;
        if (!unsigned?.valid || unsigned.value !== 'valid-session-token') {
            return reply.code(401).send({ error: 'Unauthorized' });
        }
    };

    // Public Content Routes
    fastify.get('/api/items', async () => {
        return db.getItems();
    });

    // Kid Profile & Sticker Routes
    fastify.post('/api/kid/activate', async (request, reply) => {
        const { token } = request.body || {};
        const profile = db.getProfileByToken(token);
        if (!profile) {
            return reply.code(404).send({ error: 'Profile not found' });
        }
        setKidCookie(reply, profile.token);
        return { active: true, profile: { name: profile.name }, counts: profile.counts };
    });

    fastify.get('/api/kid/stickers', async (request) => {
        const profile = getKidProfile(request);
        if (!profile) {
            return { active: false, counts: {} };
        }
        return { active: true, profile: { name: profile.name }, counts: profile.counts };
    });

    fastify.post('/api/kid/stickers/earn', async (request, reply) => {
        const profile = getKidProfile(request);
        if (!profile) {
            return reply.code(401).send({ error: 'No active profile' });
        }
        const earned = db.earnProfileSticker(profile.id);
        return { sticker: earned.sticker, counts: earned.counts };
    });

    fastify.post('/api/kid/stickers/merge', async (request, reply) => {
        const profile = getKidProfile(request);
        if (!profile) {
            return reply.code(401).send({ error: 'No active profile' });
        }
        const { counts } = request.body || {};
        if (!counts || typeof counts !== 'object' || Array.isArray(counts)) {
            return reply.code(400).send({ error: 'Invalid counts payload' });
        }
        const updated = db.setProfileStickers(profile.id, counts, 'merge');
        return { counts: updated };
    });

    // Admin Auth Routes
    fastify.post('/api/login', async (request, reply) => {
        const { username, password } = request.body || {};
        if (username === adminUser && password === adminPass) {
            reply.setCookie('admin_session', 'valid-session-token', {
                path: '/',
                httpOnly: true,
                secure: isProduction,
                signed: true,
                sameSite: 'strict',
                maxAge: 60 * 60 * 24 // 1 day
            }).send({ success: true });
        } else {
            reply.code(401).send({ success: false, error: 'Invalid credentials' });
        }
    });

    fastify.post('/api/logout', async (request, reply) => {
        reply.clearCookie('admin_session', {
            path: '/',
            httpOnly: true,
            secure: isProduction,
            sameSite: 'strict'
        }).send({ success: true });
    });

    fastify.get('/api/admin/me', { preHandler: verifyAdmin }, async () => {
        return { authenticated: true };
    });

    // Admin Content Routes
    fastify.post('/api/admin/items', { preHandler: verifyAdmin }, async (request, reply) => {
        const { type, content, animal } = request.body || {};
        if (!['letter', 'word'].includes(type) || !content || !animal) {
            return reply.code(400).send({ error: 'Invalid input' });
        }
        const id = db.addItem(type, content, animal);
        return { success: true, id };
    });

    fastify.delete('/api/admin/items/:id', { preHandler: verifyAdmin }, async (request) => {
        const id = parseInt(request.params.id, 10);
        db.deleteItem(id);
        return { success: true };
    });

    fastify.put('/api/admin/items/reorder', { preHandler: verifyAdmin }, async (request, reply) => {
        const { updates } = request.body || {}; // Array of {id, display_order}
        if (!Array.isArray(updates)) {
            return reply.code(400).send({ error: 'Expected array of updates' });
        }
        db.reorderItems(updates);
        return { success: true };
    });

    // Admin Profile Routes
    fastify.get('/api/admin/profiles', { preHandler: verifyAdmin }, async () => {
        return db.listProfiles();
    });

    fastify.post('/api/admin/profiles', { preHandler: verifyAdmin }, async (request, reply) => {
        const { name } = request.body || {};
        const trimmed = typeof name === 'string' ? name.trim() : '';
        if (!trimmed || trimmed.length > 40) {
            return reply.code(400).send({ error: 'Profile name must be between 1 and 40 characters' });
        }
        const profile = db.createProfile(trimmed);
        return reply.code(201).send(profile);
    });

    fastify.delete('/api/admin/profiles/:id', { preHandler: verifyAdmin }, async (request, reply) => {
        const id = Number(request.params.id);
        if (!Number.isSafeInteger(id) || id <= 0) {
            return reply.code(400).send({ error: 'Invalid profile id' });
        }
        const deleted = db.deleteProfile(id);
        if (!deleted) {
            return reply.code(404).send({ error: 'Profile not found' });
        }
        return { success: true };
    });

    fastify.put('/api/admin/profiles/:id/stickers', { preHandler: verifyAdmin }, async (request, reply) => {
        const id = Number(request.params.id);
        if (!Number.isSafeInteger(id) || id <= 0) {
            return reply.code(400).send({ error: 'Invalid profile id' });
        }
        const { counts, mode = 'replace' } = request.body || {};
        if (!counts || typeof counts !== 'object' || Array.isArray(counts) || !['replace', 'merge'].includes(mode)) {
            return reply.code(400).send({ error: 'Invalid sticker update payload' });
        }
        const updated = db.setProfileStickers(id, counts, mode);
        if (!updated) {
            return reply.code(404).send({ error: 'Profile not found' });
        }
        return { success: true, counts: updated };
    });

    return fastify;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
    const db = createDatabase();
    const fastify = createApp({ db });
    try {
        const port = parseInt(process.env.PORT || '3000', 10);
        const host = process.env.HOST || '0.0.0.0';
        await fastify.listen({ port, host });
        console.log(`Server listening on ${fastify.server.address().port}`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
}
