import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCookie from '@fastify/cookie';
import path from 'path';
import { fileURLToPath } from 'url';
import { getItems, addItem, deleteItem, reorderItems } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fastify = Fastify({ logger: true });

// Register static file serving
fastify.register(fastifyStatic, {
    root: path.join(__dirname, 'static'),
    prefix: '/',
});

// For admin routing, if it handles an asset without an extension it could serve index.html,
// but for simplicity our UI will be accessed just at /admin.html
fastify.get('/admin', async (request, reply) => {
    return reply.sendFile('admin.html');
});
fastify.get('/trace', async (request, reply) => {
    return reply.sendFile('trace.html');
});

fastify.get('/healthz', async () => {
    return { status: 'ok' };
});


const isProduction = process.env.NODE_ENV === 'production';
const cookieSecret = process.env.COOKIE_SECRET || (isProduction ? '' : 'development-only-kidwrite-cookie-secret');

if (cookieSecret.length < 32) {
    throw new Error('COOKIE_SECRET must contain at least 32 characters');
}

fastify.register(fastifyCookie, {
    secret: cookieSecret,
});

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'kidwrite2024';

// Middleware to check admin session
const verifyAdmin = async (request, reply) => {
    const session = request.cookies.admin_session;
    const unsigned = session ? request.unsignCookie(session) : null;
    if (!unsigned?.valid || unsigned.value !== 'valid-session-token') {
        return reply.code(401).send({ error: 'Unauthorized' });
    }
};

// API Routes
fastify.get('/api/items', async (request, reply) => {
    return getItems();
});

fastify.post('/api/login', async (request, reply) => {
    const { username, password } = request.body;
    if (username === ADMIN_USER && password === ADMIN_PASS) {
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

fastify.post('/api/admin/items', { preHandler: verifyAdmin }, async (request, reply) => {
    const { type, content, animal } = request.body;
    if (!['letter', 'word'].includes(type) || !content || !animal) {
        return reply.code(400).send({ error: 'Invalid input' });
    }
    const id = addItem(type, content, animal);
    return { success: true, id };
});

fastify.delete('/api/admin/items/:id', { preHandler: verifyAdmin }, async (request, reply) => {
    const id = parseInt(request.params.id, 10);
    deleteItem(id);
    return { success: true };
});

fastify.put('/api/admin/items/reorder', { preHandler: verifyAdmin }, async (request, reply) => {
    const { updates } = request.body; // Array of {id, display_order}
    if (!Array.isArray(updates)) {
        return reply.code(400).send({ error: 'Expected array of updates' });
    }
    reorderItems(updates);
    return { success: true };
});

// Run the server
const start = async () => {
    try {
        const port = parseInt(process.env.PORT || '3000', 10);
        const host = process.env.HOST || '0.0.0.0';
        await fastify.listen({ port, host });
        console.log(`Server listening on ${fastify.server.address().port}`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};
start();
