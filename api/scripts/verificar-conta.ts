// Verificação ponta a ponta da conta do usuário: apelido, senha, foto e "esqueci minha senha".
// Uso: BASE_URL=http://localhost:3000 DATABASE_URL=postgres://... npx tsx scripts/verificar-conta.ts
// O DATABASE_URL é usado só para ler a caixa de saída simulada (o link do e-mail), como faria quem opera o servidor.
import pg from 'pg';
import { Client, check, finish, sleep } from './cliente.js';
import { makePng } from '../src/png.js';

const db = new pg.Client({ connectionString: process.env.DATABASE_URL ?? 'postgres://leilao:leilao@localhost:5433/leilao' });
await db.connect();

async function lastEmailTo(email: string) {
  const r = await db.query('SELECT subject, body FROM email_outbox WHERE to_email = $1 ORDER BY created_at DESC', [email]);
  return r.rows;
}

const pngForm = () => {
  const f = new FormData();
  f.set('avatar', new Blob([makePng([90, 60, 200], 64, 64)], { type: 'image/png' }), 'eu.png');
  return f;
};

const me = new Client();
await me.register('Conta');
const email = (await me.req('GET', '/api/auth/me')).body.user.email as string;
const PW = 'senha12345';

// ---------- apelido ----------
const n1 = await me.req('PATCH', '/api/me', { displayName: 'Novo Apelido' });
check(n1.status === 200 && n1.body.user.displayName === 'Novo Apelido', 'altera o apelido');
check((await me.req('GET', '/api/auth/me')).body.user.displayName === 'Novo Apelido', 'o novo apelido vale na sessão');
check((await me.req('PATCH', '/api/me', { displayName: ' ' })).status === 400, 'recusa apelido vazio');
check((await new Client().req('PATCH', '/api/me', { displayName: 'Invasor' })).status === 401, 'sem login não altera nada');

// ---------- foto de perfil ----------
const a1 = await me.req('PUT', '/api/me/avatar', undefined, pngForm());
check(a1.status === 200 && typeof a1.body.user.avatarUrl === 'string', 'envia foto de perfil');
const img = await fetch((process.env.BASE_URL ?? 'http://localhost:3000') + a1.body.user.avatarUrl);
check(img.status === 200 && img.headers.get('content-type') === 'image/png', 'a foto é servida como imagem');
check((await me.req('GET', `/api/users/${me.id}`)).body.avatarUrl === a1.body.user.avatarUrl, 'a foto aparece no perfil público');
const fake = new FormData();
fake.set('avatar', new Blob([Buffer.from('MZ não sou imagem')], { type: 'image/png' }), 'x.png');
check((await me.req('PUT', '/api/me/avatar', undefined, fake)).status === 400, 'recusa arquivo que não é imagem');
const a2 = await me.req('DELETE', '/api/me/avatar');
check(a2.status === 200 && a2.body.user.avatarUrl === null, 'remove a foto de perfil');

// ---------- alterar senha ----------
const otherDevice = new Client();
await otherDevice.req('POST', '/api/auth/login', { email, password: PW });
check((await otherDevice.req('GET', '/api/auth/me')).status === 200, 'segunda sessão (outro navegador) aberta');
const w = await me.req('POST', '/api/me/password', { currentPassword: 'errada123', newPassword: 'outrasenha1' });
check(w.status === 400 && w.body.error === 'WRONG_PASSWORD', 'recusa troca com senha atual errada');
const p1 = await me.req('POST', '/api/me/password', { currentPassword: PW, newPassword: 'outrasenha1' });
check(p1.status === 200, 'troca a senha com a senha atual correta');
check((await me.req('GET', '/api/auth/me')).status === 200, 'a sessão de quem trocou continua');
check((await otherDevice.req('GET', '/api/auth/me')).status === 401, 'as outras sessões caem');
check((await new Client().req('POST', '/api/auth/login', { email, password: PW })).status === 401, 'a senha antiga não entra mais');
check((await new Client().req('POST', '/api/auth/login', { email, password: 'outrasenha1' })).status === 200, 'a senha nova entra');

// ---------- esqueci minha senha ----------
const before = (await lastEmailTo(email)).length;
const unknown = await new Client().req('POST', '/api/auth/forgot', { email: 'ninguem@nao-existe.com' });
const known = await new Client().req('POST', '/api/auth/forgot', { email: email.toUpperCase() });
check(unknown.status === 200 && known.status === 200 && unknown.body.message === known.body.message,
  'mesma resposta para e-mail existente e inexistente');
const mails = await lastEmailTo(email);
check(mails.length === before + 1 && mails[0].subject.includes('Redefinição'), 'e-mail de redefinição na caixa de saída');
const token = /token=([\w-]+)/.exec(mails[0].body)?.[1] ?? '';
check(token.length > 20, 'o e-mail tem o link com o token');

await new Client().req('POST', '/api/auth/forgot', { email });
check((await lastEmailTo(email)).length === before + 1, 'no máximo um e-mail por minuto por conta');

const loggedIn = new Client();
await loggedIn.req('POST', '/api/auth/login', { email, password: 'outrasenha1' });
check((await new Client().req('POST', '/api/auth/reset', { token: 'token-invalido-123', password: 'nova12345' })).status === 400, 'recusa token inválido');
check((await new Client().req('POST', '/api/auth/reset', { token, password: '123' })).status === 400, 'recusa senha nova curta');
const r1 = await new Client().req('POST', '/api/auth/reset', { token, password: 'redefinida1' });
check(r1.status === 200, 'redefine a senha com o link');
const r2 = await new Client().req('POST', '/api/auth/reset', { token, password: 'denovo12345' });
check(r2.status === 400 && r2.body.error === 'INVALID_TOKEN', 'o link só funciona uma vez');
check((await loggedIn.req('GET', '/api/auth/me')).status === 401, 'redefinir derruba todas as sessões');
check((await new Client().req('POST', '/api/auth/login', { email, password: 'redefinida1' })).status === 200, 'entra com a senha redefinida');

await sleep(10);
await db.end();
finish();
