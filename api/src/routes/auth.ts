import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool, tx } from '../db.js';
import { config } from '../config.js';
import { HttpError } from '../errors.js';
import { sendEmail } from '../mailer.js';
import { detectImage, uploadPhoto } from '../storage.js';
import {
  SESSION_COOKIE, createSession, destroySession, hashPassword, requireUser, revokeSessions, setSessionCookie,
  sha256, toSessionUser, verifyPassword,
} from '../auth.js';

const USER_COLUMNS = 'id, display_name, email, created_at, avatar_key';

const displayName = z.string().trim().min(2, 'Nome muito curto').max(60, 'Nome muito longo');
const newPassword = z.string().min(8, 'A senha precisa ter ao menos 8 caracteres').max(200);

const registerBody = z.object({
  displayName,
  email: z.string().trim().toLowerCase().email('E-mail inválido').max(200),
  password: newPassword,
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
        `INSERT INTO users (display_name, email, password_hash) VALUES ($1,$2,$3) RETURNING ${USER_COLUMNS}`,
        [body.displayName, body.email, hash],
      );
      setSessionCookie(reply, await createSession(rows[0].id));
      return reply.code(201).send({ user: toSessionUser(rows[0]) });
    } catch (e: any) {
      if (e?.code === '23505') return reply.code(409).send({ error: 'EMAIL_TAKEN', message: 'Este e-mail já tem uma conta.' });
      throw e;
    }
  });

  app.post('/api/auth/login', async (req, reply) => {
    const body = loginBody.parse(req.body);
    const { rows } = await pool.query(
      `SELECT ${USER_COLUMNS}, password_hash FROM users WHERE lower(email) = $1`,
      [body.email],
    );
    const u = rows[0];
    if (!u || !(await verifyPassword(body.password, u.password_hash))) {
      return reply.code(401).send({ error: 'BAD_CREDENTIALS', message: 'E-mail ou senha incorretos.' });
    }
    setSessionCookie(reply, await createSession(u.id));
    return { user: toSessionUser(u) };
  });

  app.post('/api/auth/logout', async (req, reply) => {
    await destroySession(req.cookies[SESSION_COOKIE]);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/api/auth/me', { preHandler: requireUser }, async (req) => ({ user: req.user }));

  // ---------- Minha conta ----------

  // Alterar o apelido (nome de exibição). O líder mascarado da sala muda junto, porque é lido na hora.
  app.patch('/api/me', { preHandler: requireUser }, async (req) => {
    const body = z.object({ displayName }).parse(req.body);
    const { rows } = await pool.query(
      `UPDATE users SET display_name = $2 WHERE id = $1 RETURNING ${USER_COLUMNS}`,
      [req.user!.id, body.displayName],
    );
    return { user: toSessionUser(rows[0]) };
  });

  // Alterar a senha: exige a senha atual e derruba as OUTRAS sessões (outros navegadores).
  app.post('/api/me/password', { preHandler: requireUser }, async (req) => {
    const body = z.object({ currentPassword: z.string(), newPassword }).parse(req.body);
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user!.id]);
    if (!(await verifyPassword(body.currentPassword, rows[0].password_hash))) {
      // 400, e não 401: 401 significa "sessão expirada" para o front
      throw new HttpError(400, 'WRONG_PASSWORD', 'A senha atual está incorreta.');
    }
    await pool.query('UPDATE users SET password_hash = $2 WHERE id = $1', [req.user!.id, await hashPassword(body.newPassword)]);
    await revokeSessions(req.user!.id, req.cookies[SESSION_COOKIE]);
    return { ok: true };
  });

  // Foto de perfil: uma imagem, validada pelo conteúdo, gravada como as fotos dos itens.
  app.put('/api/me/avatar', { preHandler: requireUser }, async (req) => {
    const maxBytes = config.limits.photoMaxBytes;
    const file = await req.file({ limits: { fileSize: maxBytes, files: 1 } });
    if (!file) throw new HttpError(400, 'NO_FILE', 'Escolha uma imagem.');
    const buf = await file.toBuffer();
    const type = detectImage(buf);
    if (!type) throw new HttpError(400, 'PHOTO_TYPE', 'A foto precisa ser JPEG, PNG ou WebP.');
    const key = await uploadPhoto(buf, type);
    const { rows } = await pool.query(
      `UPDATE users SET avatar_key = $2 WHERE id = $1 RETURNING ${USER_COLUMNS}`,
      [req.user!.id, key],
    );
    return { user: toSessionUser(rows[0]) };
  });

  app.delete('/api/me/avatar', { preHandler: requireUser }, async (req) => {
    const { rows } = await pool.query(
      `UPDATE users SET avatar_key = NULL WHERE id = $1 RETURNING ${USER_COLUMNS}`,
      [req.user!.id],
    );
    return { user: toSessionUser(rows[0]) };
  });

  // ---------- Esqueci minha senha (D41) ----------

  // Sempre responde igual, exista ou não a conta: ninguém descobre quais e-mails estão cadastrados.
  app.post('/api/auth/forgot', async (req) => {
    const body = z.object({ email: z.string().trim().toLowerCase().max(200) }).parse(req.body);
    const answer = { ok: true, message: 'Se existir uma conta com esse e-mail, enviamos um link para redefinir a senha.' };

    const { rows } = await pool.query('SELECT id, display_name, email FROM users WHERE lower(email) = $1', [body.email]);
    const u = rows[0];
    if (!u) return answer;

    // no máximo um link por minuto por conta (evita usar o formulário para lotar a caixa de alguém)
    const recent = await pool.query(
      `SELECT 1 FROM password_resets WHERE user_id = $1 AND created_at > now() - interval '1 minute'`,
      [u.id],
    );
    if (recent.rowCount) return answer;

    const token = crypto.randomBytes(32).toString('base64url');
    await pool.query(
      `INSERT INTO password_resets (token_hash, user_id, expires_at)
       VALUES ($1, $2, now() + make_interval(mins => $3))`,
      [sha256(token), u.id, config.passwordResetTtlMin],
    );
    const link = `${config.appUrl}/redefinir-senha?token=${token}`;
    await sendEmail(
      u.email,
      'Redefinição de senha — FGR Leilões',
      `Olá, ${u.display_name}!\n\nRecebemos um pedido para redefinir a sua senha. Use o link abaixo ` +
        `(vale por ${config.passwordResetTtlMin} minutos e só pode ser usado uma vez):\n\n${link}\n\n` +
        'Se não foi você, ignore este e-mail: sua senha continua a mesma.',
    );
    return answer;
  });

  // Redefine a senha com o token do e-mail. Uso único; derruba todas as sessões da conta.
  app.post('/api/auth/reset', async (req) => {
    const body = z.object({ token: z.string().min(10).max(200), password: newPassword }).parse(req.body);
    const hash = await hashPassword(body.password);
    await tx(async (c) => {
      const { rows } = await c.query(
        `SELECT user_id FROM password_resets
          WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
          FOR UPDATE`,
        [sha256(body.token)],
      );
      if (!rows[0]) throw new HttpError(400, 'INVALID_TOKEN', 'Este link é inválido ou expirou. Peça um novo.');
      const userId = rows[0].user_id;
      await c.query('UPDATE users SET password_hash = $2 WHERE id = $1', [userId, hash]);
      // invalida este e qualquer outro link pendente da conta
      await c.query('UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [userId]);
      await c.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
    });
    return { ok: true, message: 'Senha redefinida. Entre com a nova senha.' };
  });
}
