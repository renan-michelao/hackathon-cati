// Regras de leilão que tocam o banco: listagem, sala, criação, cancelamento e lances.
import { pool, tx, notifyAuction, notifyUser, type Tx } from './db.js';
import { config } from './config.js';
import { minNextBid, extendedEnd, maskName, editPolicy, canCancel, canRelist, leadTimeError } from './rules.js';
import { photoUrl } from './storage.js';
import { HttpError } from './errors.js';

export type AuctionStatus = 'SCHEDULED' | 'LIVE' | 'SOLD' | 'ENDED_NO_BIDS' | 'CANCELLED';

const BASE_SELECT = /* sql */ `
  SELECT a.*, i.name, i.description, i.category,
         s.display_name AS seller_name,
         l.display_name AS leader_name,
         w.display_name AS winner_name,
         (SELECT p.storage_key FROM item_photos p WHERE p.item_id = i.id ORDER BY p.position LIMIT 1) AS cover_key
    FROM auctions a
    JOIN items i ON i.id = a.item_id
    JOIN users s ON s.id = a.seller_id
    LEFT JOIN users l ON l.id = a.leader_id
    LEFT JOIN users w ON w.id = a.winner_id
`;

function summary(r: any) {
  return {
    id: r.id,
    itemId: r.item_id,
    name: r.name,
    category: r.category,
    status: r.status as AuctionStatus,
    startPriceCents: r.start_price_cents,
    currentPriceCents: r.current_price_cents,
    minNextCents: minNextBid(r),
    bidCount: r.bid_count,
    startsAt: r.starts_at.toISOString(),
    endsAt: r.ends_at.toISOString(),
    coverUrl: r.cover_key ? photoUrl(r.cover_key) : null,
    seller: { id: r.seller_id, displayName: r.seller_name },
  };
}

export interface ListFilters {
  statuses: AuctionStatus[];
  q?: string;
  category?: string;
  sellerId?: string;
  page: number;
  pageSize: number;
}

/**
 * RF20: listagem pública. Ordem: em andamento primeiro (os que terminam antes no topo),
 * depois agendados (os que começam antes no topo), depois os encerrados mais recentes.
 * Paginada para aguentar muitos leilões. Já aceita os filtros do RF21 (Nível 2).
 */
export async function listAuctions(f: ListFilters) {
  const where: string[] = ['a.status = ANY($1)'];
  const params: unknown[] = [f.statuses];
  if (f.q) {
    params.push(`%${f.q}%`);
    where.push(`unaccent(i.name) ILIKE unaccent($${params.length})`);
  }
  if (f.category) {
    params.push(f.category);
    where.push(`i.category = $${params.length}`);
  }
  if (f.sellerId) {
    params.push(f.sellerId);
    where.push(`a.seller_id = $${params.length}`);
  }
  const whereSql = where.join(' AND ');
  params.push(f.pageSize, (f.page - 1) * f.pageSize);
  const { rows } = await pool.query(
    `${BASE_SELECT}
      WHERE ${whereSql}
      ORDER BY CASE a.status WHEN 'LIVE' THEN 0 WHEN 'SCHEDULED' THEN 1 ELSE 2 END,
               CASE WHEN a.status = 'LIVE' THEN a.ends_at END ASC,
               CASE WHEN a.status = 'SCHEDULED' THEN a.starts_at END ASC,
               a.ends_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  const total = await pool.query(
    `SELECT count(*)::int AS n FROM auctions a JOIN items i ON i.id = a.item_id WHERE ${whereSql}`,
    params.slice(0, -2),
  );
  return { items: rows.map(summary), total: total.rows[0].n, page: f.page, pageSize: f.pageSize };
}

/** Detalhe público (sem os lances; esses ficam na sala, que exige login). */
export async function getAuctionDetail(id: string) {
  const { rows } = await pool.query(`${BASE_SELECT} WHERE a.id = $1`, [id]);
  const r = rows[0];
  if (!r) return null;
  const photos = await pool.query('SELECT storage_key FROM item_photos WHERE item_id = $1 ORDER BY position', [r.item_id]);
  const now = new Date();
  return {
    ...summary(r),
    description: r.description,
    photos: photos.rows.map((p) => photoUrl(p.storage_key)),
    // o que o comitente pode fazer agora (RF08, RF23, RF28); o servidor revalida em cada ação
    editPolicy: editPolicy(r, now),
    canCancel: canCancel(r),
    canRelist: canRelist(r),
    serverNow: now.toISOString(),
  };
}

/**
 * RF09: estado da sala. É o mesmo objeto enviado a todos na sala a cada mudança.
 * O líder aparece mascarado; o front compara leaderId com o próprio id para saber "sou eu".
 */
export async function getRoomState(id: string, c: Tx | typeof pool = pool) {
  const { rows } = await c.query(`${BASE_SELECT} WHERE a.id = $1`, [id]);
  const r = rows[0];
  if (!r) return null;
  const bids = await c.query(
    `SELECT b.id, b.amount_cents, b.created_at, b.bidder_id, u.display_name
       FROM bids b JOIN users u ON u.id = b.bidder_id
      WHERE b.auction_id = $1
      ORDER BY b.created_at DESC
      LIMIT $2`,
    [id, config.recentBidsShown],
  );
  return {
    id: r.id,
    name: r.name,
    description: r.description, // RF23: texto acrescentado durante o leilão chega na hora
    status: r.status as AuctionStatus,
    startPriceCents: r.start_price_cents,
    currentPriceCents: r.current_price_cents,
    minNextCents: minNextBid(r),
    bidCount: r.bid_count,
    startsAt: r.starts_at.toISOString(),
    endsAt: r.ends_at.toISOString(),
    sellerId: r.seller_id,
    leaderId: r.leader_id,
    leaderAlias: maskName(r.leader_name),
    winnerId: r.winner_id,
    winnerAlias: maskName(r.winner_name),
    finalPriceCents: r.final_price_cents,
    recentBids: bids.rows.map((b) => ({
      id: b.id,
      amountCents: b.amount_cents,
      at: b.created_at.toISOString(),
      bidderId: b.bidder_id,
      bidderAlias: maskName(b.display_name),
    })),
    serverNow: new Date().toISOString(),
  };
}

export interface NewAuction {
  sellerId: string;
  name: string;
  description: string;
  category: string;
  startPriceCents: number;
  startsAt: Date;
  durationSec: number;
  photoKeys: string[];
}

/** RF05: cria item + fotos + leilão numa transação só. */
export async function createAuction(n: NewAuction) {
  return tx(async (c) => {
    const item = await c.query(
      `INSERT INTO items (seller_id, name, description, category) VALUES ($1,$2,$3,$4) RETURNING id`,
      [n.sellerId, n.name, n.description, n.category],
    );
    const itemId = item.rows[0].id;
    for (const [i, key] of n.photoKeys.entries()) {
      await c.query('INSERT INTO item_photos (item_id, storage_key, position) VALUES ($1,$2,$3)', [itemId, key, i]);
    }
    const endsAt = new Date(n.startsAt.getTime() + n.durationSec * 1000);
    const a = await c.query(
      `INSERT INTO auctions (item_id, seller_id, start_price_cents, starts_at, original_ends_at, ends_at)
       VALUES ($1,$2,$3,$4,$5,$5) RETURNING id`,
      [itemId, n.sellerId, n.startPriceCents, n.startsAt, endsAt],
    );
    return a.rows[0].id as string;
  });
}

/**
 * RF08: o comitente cancela enquanto Agendado ou Em andamento sem lances.
 * É um UPDATE condicional: se um lance entrar antes, bid_count > 0 e o cancelamento falha.
 */
export async function cancelAuction(id: string, sellerId: string) {
  return tx(async (c) => {
    const { rows } = await c.query(
      `UPDATE auctions SET status = 'CANCELLED', cancelled_at = clock_timestamp()
        WHERE id = $1 AND seller_id = $2
          AND (status = 'SCHEDULED' OR (status = 'LIVE' AND bid_count = 0))
        RETURNING id`,
      [id, sellerId],
    );
    if (rows[0]) await notifyAuction(c, id);
    return rows.length > 0;
  });
}

export interface AuctionFields {
  name: string;
  description: string;
  category: string;
  startPriceCents: number;
  startsAt: Date;
  durationSec: number;
}

async function replacePhotos(c: Tx, itemId: string, keys: string[]) {
  await c.query('DELETE FROM item_photos WHERE item_id = $1', [itemId]);
  for (const [i, key] of keys.entries()) {
    await c.query('INSERT INTO item_photos (item_id, storage_key, position) VALUES ($1,$2,$3)', [itemId, key, i]);
  }
}

async function dbNow(c: Tx): Promise<Date> {
  return (await c.query('SELECT clock_timestamp() AS now')).rows[0].now;
}

/**
 * RF23: edição pelo comitente, conforme a política da situação atual (rules.editPolicy).
 * A linha do leilão fica travada durante a edição, então um lance ou a abertura automática
 * não acontecem no meio dela, e a política é decidida com o relógio do banco.
 */
export async function editAuction(
  id: string,
  sellerId: string,
  input: { fields: Partial<AuctionFields>; photoKeys?: string[]; appendDescription?: string },
) {
  await tx(async (c) => {
    const { rows } = await c.query(
      `SELECT a.*, i.description FROM auctions a JOIN items i ON i.id = a.item_id WHERE a.id = $1 FOR UPDATE OF a`,
      [id],
    );
    const a = rows[0];
    if (!a) throw new HttpError(404, 'NOT_FOUND', 'Leilão não encontrado.');
    if (a.seller_id !== sellerId) throw new HttpError(403, 'NOT_OWNER', 'Só o comitente pode editar o leilão.');

    const now = await dbNow(c);
    const policy = editPolicy(a, now);
    const changesFields = Object.keys(input.fields).length > 0 || (input.photoKeys?.length ?? 0) > 0;
    const append = input.appendDescription?.trim();

    if (policy === 'NONE') {
      const why = a.status === 'SCHEDULED'
        ? `Faltam ${config.editLockMin} minutos ou menos para o início: o leilão não pode mais ser editado.`
        : 'Leilões encerrados ou cancelados não podem ser editados.';
      throw new HttpError(409, 'EDIT_NOT_ALLOWED', why);
    }
    if (policy === 'APPEND_DESCRIPTION' && changesFields) {
      throw new HttpError(409, 'EDIT_NOT_ALLOWED', 'Com o leilão em andamento, só é possível acrescentar texto à descrição.');
    }
    if (!changesFields && !append) throw new HttpError(400, 'NOTHING_TO_CHANGE', 'Nada para alterar.');

    let description: string = input.fields.description ?? a.description;
    if (append) {
      if (append.length > config.appendDescriptionMax) {
        throw new HttpError(400, 'VALIDATION', `O texto acrescentado pode ter no máximo ${config.appendDescriptionMax} caracteres.`);
      }
      description = `${description}\n\n— Atualização do comitente: ${append}`;
      if (description.length > config.limits.descriptionMax) {
        throw new HttpError(400, 'VALIDATION', 'A descrição ficaria maior que o limite permitido.');
      }
    }

    const f = input.fields;
    await c.query(
      `UPDATE items SET name = COALESCE($2, name), description = $3, category = COALESCE($4, category) WHERE id = $1`,
      [a.item_id, f.name ?? null, description, f.category ?? null],
    );

    if (policy === 'ALL') {
      if (input.photoKeys?.length) await replacePhotos(c, a.item_id, input.photoKeys);
      const startsAt = f.startsAt ?? a.starts_at;
      if (f.startsAt) {
        const err = leadTimeError(startsAt, now);
        if (err) throw new HttpError(400, 'VALIDATION', err);
      }
      const durationSec = f.durationSec ?? (a.original_ends_at.getTime() - a.starts_at.getTime()) / 1000;
      const endsAt = new Date(startsAt.getTime() + durationSec * 1000);
      await c.query(
        `UPDATE auctions
            SET start_price_cents = COALESCE($2, start_price_cents), starts_at = $3, original_ends_at = $4, ends_at = $4
          WHERE id = $1`,
        [id, f.startPriceCents ?? null, startsAt, endsAt],
      );
    }
    await notifyAuction(c, id);
  });
}

/**
 * RF28: relistagem. Cria um NOVO leilão para o mesmo item a partir de um Encerrado sem lances
 * ou Cancelado; o antigo continua registrado como está. Todos os campos podem mudar; se não
 * vierem fotos novas, as do item são mantidas. O índice único parcial garante no banco que o item
 * nunca tenha dois leilões Agendados/Em andamento, mesmo com duas relistagens simultâneas.
 */
export async function relistAuction(
  id: string,
  sellerId: string,
  input: { fields: Partial<AuctionFields> & { startsAt: Date; durationSec: number }; photoKeys?: string[] },
): Promise<string> {
  try {
    return await tx(async (c) => {
      const { rows } = await c.query('SELECT * FROM auctions WHERE id = $1 FOR UPDATE', [id]);
      const a = rows[0];
      if (!a) throw new HttpError(404, 'NOT_FOUND', 'Leilão não encontrado.');
      if (a.seller_id !== sellerId) throw new HttpError(403, 'NOT_OWNER', 'Só o comitente pode relistar o item.');
      if (!canRelist(a)) {
        throw new HttpError(409, 'CANNOT_RELIST', 'Só leilões Encerrados sem lances ou Cancelados podem ser relistados.');
      }
      const now = await dbNow(c);
      const f = input.fields;
      const err = leadTimeError(f.startsAt, now);
      if (err) throw new HttpError(400, 'VALIDATION', err);

      await c.query(
        `UPDATE items SET name = COALESCE($2, name), description = COALESCE($3, description), category = COALESCE($4, category)
          WHERE id = $1`,
        [a.item_id, f.name ?? null, f.description ?? null, f.category ?? null],
      );
      if (input.photoKeys?.length) await replacePhotos(c, a.item_id, input.photoKeys);

      const endsAt = new Date(f.startsAt.getTime() + f.durationSec * 1000);
      const created = await c.query(
        `INSERT INTO auctions (item_id, seller_id, start_price_cents, starts_at, original_ends_at, ends_at)
         VALUES ($1,$2,$3,$4,$5,$5) RETURNING id`,
        [a.item_id, sellerId, f.startPriceCents ?? a.start_price_cents, f.startsAt, endsAt],
      );
      const newId = created.rows[0].id as string;
      await notifyAuction(c, newId);
      return newId;
    });
  } catch (e: any) {
    if (e?.code === '23505' && String(e?.constraint).includes('auctions_one_active_per_item')) {
      throw new HttpError(409, 'ALREADY_ACTIVE', 'Este item já tem um leilão agendado ou em andamento.');
    }
    throw e;
  }
}

export type BidReject =
  | 'NOT_FOUND'
  | 'NOT_LIVE'
  | 'ENDED'
  | 'IS_SELLER'
  | 'ALREADY_LEADER'
  | 'TOO_LOW'
  | 'RATE_LIMITED'
  | 'NOT_IN_ROOM';

const REJECT_MESSAGES: Record<BidReject, string> = {
  NOT_FOUND: 'Leilão não encontrado.',
  NOT_LIVE: 'O leilão não está em andamento.',
  ENDED: 'O leilão já terminou.',
  IS_SELLER: 'O comitente não pode dar lance no próprio leilão.',
  ALREADY_LEADER: 'Você já é o líder deste leilão.',
  TOO_LOW: 'O valor é menor que o lance mínimo atual.',
  RATE_LIMITED: 'Muitos lances seguidos. Aguarde um instante.',
  NOT_IN_ROOM: 'Entre na sala como participante para dar lances.',
};

export type BidResult =
  | { accepted: true; replay: boolean; bid: { id: string; amountCents: number; at: string }; minNextCents: number }
  | { accepted: false; code: BidReject; message: string; minNextCents: number | null };

/**
 * RF10–RF13: processamento de um lance. Tudo numa transação:
 *  1. trava a linha do usuário (serializa tentativas do mesmo usuário);
 *  2. se a chave de idempotência já existe, devolve o lance original (RF12);
 *  3. limite de frequência (RF13);
 *  4. trava a linha do leilão com SELECT ... FOR UPDATE (RF11): lances simultâneos no mesmo
 *     leilão são processados um por vez, na ordem de chegada ao banco;
 *  5. valida com o relógio do banco (RF16) e o lance mínimo vigente agora (RF10);
 *  6. grava lance + novo estado + prorrogação e dispara pg_notify (entregue só no COMMIT).
 * Funciona com várias instâncias da API porque toda a coordenação está no Postgres.
 */
export async function placeBid(
  userId: string, auctionId: string, amountCents: number, idempotencyKey: string, inRoomAsParticipant: boolean,
): Promise<BidResult> {
  try {
    return await tx((c) => placeBidTx(c, userId, auctionId, amountCents, idempotencyKey, inRoomAsParticipant));
  } catch (e: any) {
    // Corrida rara na chave única: outra requisição idêntica gravou primeiro. Devolve a original.
    if (e?.code === '23505' && String(e?.constraint).includes('bids_idempotency')) {
      const prev = await findBidByKey(pool, userId, idempotencyKey);
      if (prev) return prev;
    }
    throw e;
  }
}

async function findBidByKey(c: Tx | typeof pool, userId: string, key: string): Promise<BidResult | null> {
  const { rows } = await c.query(
    `SELECT b.id, b.amount_cents, b.created_at, a.bid_count, a.start_price_cents, a.current_price_cents
       FROM bids b JOIN auctions a ON a.id = b.auction_id
      WHERE b.bidder_id = $1 AND b.idempotency_key = $2`,
    [userId, key],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    accepted: true,
    replay: true,
    bid: { id: r.id, amountCents: r.amount_cents, at: r.created_at.toISOString() },
    minNextCents: minNextBid(r),
  };
}

async function placeBidTx(
  c: Tx, userId: string, auctionId: string, amountCents: number, key: string, inRoom: boolean,
): Promise<BidResult> {
  // 1. serializa as tentativas do mesmo usuário
  const u = await c.query('SELECT last_bid_attempt_at FROM users WHERE id = $1 FOR UPDATE', [userId]);

  // 2. reenvio (clique duplo, falha de rede, sessão expirada): devolve o resultado original
  const prev = await findBidByKey(c, userId, key);
  if (prev) return prev;

  // 3. limite de frequência: reenvios (passo 2) nunca chegam aqui, então não são punidos
  const { rows: nowRows } = await c.query('SELECT clock_timestamp() AS now');
  let now: Date = nowRows[0].now;
  const last: Date | null = u.rows[0]?.last_bid_attempt_at ?? null;
  if (last && now.getTime() - last.getTime() < config.bidMinIntervalMs) {
    return reject('RATE_LIMITED', null);
  }
  await c.query('UPDATE users SET last_bid_attempt_at = $2 WHERE id = $1', [userId, now]);

  // 4. trava o leilão: a partir daqui ninguém mais mexe nele até o COMMIT
  const { rows } = await c.query('SELECT * FROM auctions WHERE id = $1 FOR UPDATE', [auctionId]);
  const a = rows[0];
  if (!a) return reject('NOT_FOUND', null);

  // 5. relógio do servidor lido DEPOIS de obter a trava (a espera pela trava não conta a favor)
  now = (await c.query('SELECT clock_timestamp() AS now')).rows[0].now;
  const minNext = minNextBid(a);
  if (a.status !== 'LIVE') return reject(a.status === 'SCHEDULED' ? 'NOT_LIVE' : 'ENDED', minNext);
  if (now.getTime() >= a.ends_at.getTime()) return reject('ENDED', minNext);
  if (a.seller_id === userId) return reject('IS_SELLER', minNext);
  // RF10.1/RF25: precisa estar na sala como participante. Fica depois do passo 2 de propósito:
  // o reenvio de um lance já gravado devolve o original mesmo que a conexão da sala tenha caído.
  if (!inRoom) return reject('NOT_IN_ROOM', minNext);
  if (a.leader_id === userId) return reject('ALREADY_LEADER', minNext);
  if (amountCents < minNext) return reject('TOO_LOW', minNext);

  // 6. aceita
  const newEnd = extendedEnd(a.ends_at, a.original_ends_at, now);
  const bid = await c.query(
    `INSERT INTO bids (auction_id, bidder_id, amount_cents, idempotency_key, created_at)
     VALUES ($1,$2,$3,$4,$5) RETURNING id, created_at`,
    [auctionId, userId, amountCents, key, now],
  );
  await c.query(
    `UPDATE auctions
        SET current_price_cents = $2, leader_id = $3, bid_count = bid_count + 1, ends_at = $4
      WHERE id = $1`,
    [auctionId, amountCents, userId, newEnd],
  );
  await notifyAuction(c, auctionId);
  // RF26: avisa o líder anterior (entregue só no COMMIT, como o resto)
  if (a.leader_id && a.leader_id !== userId) {
    await notifyUser(c, { type: 'outbid', userId: a.leader_id, auctionId, amountCents, minNextCents: minNextBid({ bid_count: a.bid_count + 1, start_price_cents: a.start_price_cents, current_price_cents: amountCents }) });
  }

  const after = { bid_count: a.bid_count + 1, start_price_cents: a.start_price_cents, current_price_cents: amountCents };
  return {
    accepted: true,
    replay: false,
    bid: { id: bid.rows[0].id, amountCents, at: bid.rows[0].created_at.toISOString() },
    minNextCents: minNextBid(after),
  };
}

function reject(code: BidReject, minNextCents: number | null): BidResult {
  return { accepted: false, code, message: REJECT_MESSAGES[code], minNextCents };
}

/**
 * RF17/RF18: abertura e fechamento automáticos. Chamado pelo worker a cada segundo.
 * São UPDATEs condicionais e idempotentes: rodar duas vezes não duplica nada, e depois de um
 * reinício o primeiro ciclo já abre/fecha tudo o que passou do horário.
 * O fechamento disputa a mesma trava de linha que o lance: se um lance está sendo gravado,
 * o fechamento espera e reavalia ends_at (que pode ter sido prorrogado).
 */
export async function runScheduler(): Promise<{ opened: number; closed: number }> {
  const opened = await pool.query(
    `WITH changed AS (
       UPDATE auctions SET status = 'LIVE'
        WHERE status = 'SCHEDULED' AND starts_at <= clock_timestamp()
        RETURNING id
     )
     SELECT id, pg_notify('auction_events', id::text) FROM changed`,
  );
  const closed = await pool.query(
    `WITH changed AS (
       UPDATE auctions
          SET status            = CASE WHEN bid_count > 0 THEN 'SOLD' ELSE 'ENDED_NO_BIDS' END,
              winner_id         = CASE WHEN bid_count > 0 THEN leader_id END,
              final_price_cents = CASE WHEN bid_count > 0 THEN current_price_cents END,
              closed_at         = clock_timestamp()
        WHERE status = 'LIVE' AND ends_at <= clock_timestamp()
        RETURNING id
     )
     SELECT id, pg_notify('auction_events', id::text) FROM changed`,
  );
  return { opened: opened.rowCount ?? 0, closed: closed.rowCount ?? 0 };
}
