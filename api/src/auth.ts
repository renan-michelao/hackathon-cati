import crypto from 'node:crypto';
import { promisify } from 'node:util';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { pool } from './db.js';
import { config } from './config.js';

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: string, len: number) => Promise<Buffer>;

export const SESSION_COOKIE = 'sid';

export interface SessionUser {
  id: string;
  displayName: string;
  email: string;
  createdAt: string;
}

export async function hashPassword(pw: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await scrypt(pw, salt, 64);
  return `scrypt$${salt}$${hash.toString('hex')}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [, salt, hex] = stored.split('$');
  if (!salt || !hex) return false;
  const hash = await scrypt(pw, salt, 64);
  const expected = Buffer.from(hex, 'hex');
  return expected.length === hash.length && crypto.timingSafeEqual(expected, hash);
}

// Só o hash do token fica no banco: um vazamento da tabela não entrega sessões válidas.
const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url');
  await pool.query(
    `INSERT INTO sessions (token_hash, user_id, expires_at)
     VALUES ($1, $2, now() + make_interval(mins => $3))`,
    [sha256(token), userId, config.sessionTtlMin],
  );
  return token;
}

/**
 * RF02: valida a sessão e a renova com o uso (expiração deslizante).
 * Sessão sem uso por SESSION_TTL_MIN minutos expira.
 */
export async function userFromToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const { rows } = await pool.query(
    `UPDATE sessions s
        SET expires_at = now() + make_interval(mins => $2)
       FROM users u
      WHERE s.token_hash = $1 AND s.expires_at > now() AND u.id = s.user_id
      RETURNING u.id, u.display_name, u.email, u.created_at`,
    [sha256(token), config.sessionTtlMin],
  );
  if (!rows[0]) return null;
  const u = rows[0];
  return { id: u.id, displayName: u.display_name, email: u.email, createdAt: u.created_at.toISOString() };
}

export async function destroySession(token: string | undefined) {
  if (token) await pool.query('DELETE FROM sessions WHERE token_hash = $1', [sha256(token)]);
}

export function setSessionCookie(reply: FastifyReply, token: string) {
  reply.setCookie(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    maxAge: 60 * 60 * 24 * 7, // o cookie dura mais; quem manda na expiração é o banco
  });
}

declare module 'fastify' {
  interface FastifyRequest {
    user: SessionUser | null;
  }
}

/** preHandler para rotas protegidas. */
export async function requireUser(req: FastifyRequest, reply: FastifyReply) {
  if (!req.user) {
    return reply.code(401).send({ error: 'UNAUTHENTICATED', message: 'Faça login para continuar.' });
  }
}

/** Lê o cookie "sid" do cabeçalho bruto (usado no handshake do Socket.IO). */
export function tokenFromCookieHeader(header: string | undefined): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === SESSION_COOKIE) return decodeURIComponent(v.join('='));
  }
  return undefined;
}
