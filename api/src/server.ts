import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import { ZodError } from 'zod';
import { config } from './config.js';
import { migrate } from './migrate.js';
import { SESSION_COOKIE, userFromToken } from './auth.js';
import { authRoutes } from './routes/auth.js';
import { auctionRoutes } from './routes/auctions.js';
import { HttpError } from './errors.js';
import { userRoutes } from './routes/users.js';
import { setupRealtime } from './realtime.js';
import { initStorage } from './storage.js';
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
  const status = (err as any).statusCode as number | undefined;
  if (status && status < 500) {
    // Erros do próprio Fastify/multipart vêm em inglês: traduz os que o usuário pode provocar pela tela.
    const code = (err as any).code as string | undefined;
    const L = config.limits;
    const message =
      code === 'FST_FILES_LIMIT' ? `Envie no máximo ${L.photosMax} fotos.`
      : code === 'FST_REQ_FILE_TOO_LARGE' ? `Cada foto pode ter no máximo ${L.photoMaxBytes / 1024 / 1024} MB.`
      : status === 413 ? 'O envio passou do tamanho permitido.'
      : 'Requisição inválida.';
    return reply.code(status).send({ error: code ?? 'BAD_REQUEST', message });
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
await app.register(userRoutes);

await migrate();
await initStorage();
setupRealtime(app.server);

await app.listen({ port: config.port, host: '0.0.0.0' });
