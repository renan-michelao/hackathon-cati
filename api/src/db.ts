import pg from 'pg';
import { config } from './config.js';

// BIGINT (centavos) volta como number. Seguro até 2^53 centavos (~R$ 90 trilhões).
pg.types.setTypeParser(20, (v) => Number(v));

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 20 });

export type Tx = pg.PoolClient;

/** Executa fn dentro de uma transação. Commit se der certo, rollback se lançar erro. */
export async function tx<T>(fn: (c: Tx) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const r = await fn(c);
    await c.query('COMMIT');
    return r;
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

/**
 * Canal usado para avisar "o leilão X mudou". O pg_notify feito dentro de uma
 * transação só é entregue no COMMIT: a sala nunca vê um lance que não foi gravado (RF11).
 * Todas as instâncias da API escutam o canal, então funciona com várias instâncias.
 */
export const AUCTION_CHANNEL = 'auction_events';

export async function notifyAuction(c: Tx | pg.Pool, auctionId: string) {
  await c.query('SELECT pg_notify($1, $2)', [AUCTION_CHANNEL, auctionId]);
}
