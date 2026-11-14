// Envio de e-mail SIMULADO (D41): a plataforma não tem serviço de e-mail, então as mensagens
// vão para a tabela email_outbox (e para o log da API). Só quem opera o servidor consegue lê-las:
//   ./rodar.sh emails
// Para usar um SMTP de verdade, basta trocar o corpo de sendEmail; quem chama não muda.
import { pool, type Tx } from './db.js';

export async function sendEmail(to: string, subject: string, body: string, c: Tx | typeof pool = pool) {
  await c.query('INSERT INTO email_outbox (to_email, subject, body) VALUES ($1, $2, $3)', [to, subject, body]);
  console.log(`[e-mail simulado] para=${to} assunto="${subject}" (veja com ./rodar.sh emails)`);
}
