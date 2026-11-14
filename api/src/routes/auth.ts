import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db.js';
import {
  SESSION_COOKIE, createSession, destroySession, hashPassword, requireUser, setSessionCookie, verifyPassword,
} from '../auth.js';

const registerBody = z.object({
  displayName: z.string().trim().min(2, 'Nome muito curto').max(60, 'Nome muito longo'),
  email: z.string().trim().toLowerCase().email('E-mail inválido').max(200),
  password: z.string().min(8, 'A senha precisa ter ao menos 8 caracteres').max(200),
});

const loginBody = z.object({
  email: z.string().trim().toLowerCase(),
  password: z.string(),
});

export async function authRoutes(app: FastifyInstance) {
  // RF01: cadastro (já entra logado)
  app.post('/api/auth/register', async (req, reply) => {
    const body = registerBody.parse(req.body);
    const hash = await hashPassword(body.password);
    try {
      const { rows } = await pool.query(
        `INSERT INTO users (display_name, email, password_hash) VALUES ($1,$2,$3)
         RETURNING id, display_name, email, created_at`,
        [body.displayName, body.email, hash],
      );
      const u = rows[0];
      setSessionCookie(reply, await createSession(u.id));
      return reply.code(201).send({
        user: { id: u.id, displayName: u.display_name, email: u.email, createdAt: u.created_at.toISOString() },
      });
    } catch (e: any) {
      if (e?.code === '23505') return reply.code(409).send({ error: 'EMAIL_TAKEN', message: 'Este e-mail já tem uma conta.' });
      throw e;
    }
  });

  app.post('/api/auth/login', async (req, reply) => {
    const body = loginBody.parse(req.body);
    const { rows } = await pool.query(
      'SELECT id, display_name, email, password_hash, created_at FROM users WHERE lower(email) = $1',
      [body.email],
    );
    const u = rows[0];
    if (!u || !(await verifyPassword(body.password, u.password_hash))) {
      return reply.code(401).send({ error: 'BAD_CREDENTIALS', message: 'E-mail ou senha incorretos.' });
    }
    setSessionCookie(reply, await createSession(u.id));
    return { user: { id: u.id, displayName: u.display_name, email: u.email, createdAt: u.created_at.toISOString() } };
  });

  app.post('/api/auth/logout', async (req, reply) => {
    await destroySession(req.cookies[SESSION_COOKIE]);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/api/auth/me', { preHandler: requireUser }, async (req) => ({ user: req.user }));
}
