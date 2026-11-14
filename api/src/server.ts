import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import { ZodError } from 'zod';
import { config } from './config.js';
import { migrate } from './migrate.js';
import { SESSION_COOKIE, userFromToken } from './auth.js';
import { authRoutes } from './routes/auth.js';
import { auctionRoutes, HttpError } from './routes/auctions.js';
import { setupRealtime } from './realtime.js';
import { ensureBucket } from './storage.js';
import { pool } from './db.js';

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' }, trustProxy: true });

await app.register(cookie);
await app.register(multipart);

// Toda requisição descobre o usuário pela sessão (e a renova — RF02).
app.decorateRequest('user', null);
app.addHook('onRequest', async (req) => {
  req.user = await userFromToken(req.cookies[SESSION_COOKIE]);
});

app.setErrorHandler((err: Error, _req, reply) => {
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return reply.code(400).send({ error: 'VALIDATION', message: first?.message ?? 'Dados inválidos', issues: err.issues });
  }
  if (err instanceof HttpError) return reply.code(err.status).send({ error: err.code, message: err.message });
  if ((err as any).statusCode && (err as any).statusCode < 500) {
    return reply.code((err as any).statusCode).send({ error: 'BAD_REQUEST', message: err.message });
  }
  app.log.error(err);
  return reply.code(500).send({ error: 'INTERNAL', message: 'Erro interno.' });
});

app.get('/api/health', async () => {
  await pool.query('SELECT 1');
  return { ok: true, serverNow: new Date().toISOString() };
});

await app.register(authRoutes);
await app.register(auctionRoutes);

await migrate();
await ensureBucket();
setupRealtime(app.server);

await app.listen({ port: config.port, host: '0.0.0.0' });
