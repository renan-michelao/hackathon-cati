import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireUser } from '../auth.js';
import { listAuctions } from '../auctions.js';
import { containsPattern, minNextBid } from '../rules.js';
import { photoUrl } from '../storage.js';

const uuid = z.string().uuid();

const searchQuery = z.object({
  q: z.string().trim().min(1).max(60),
  page: z.coerce.number().int().min(1).default(1),
});

export async function userRoutes(app: FastifyInstance) {
  // RF22: busca de comitentes pelo nome de exibição (sem diferenciar acentos e maiúsculas).
  // Só aparecem usuários que já anunciaram algo: quem nunca anunciou não é comitente.
  app.get('/api/users', async (req) => {
    const q = searchQuery.parse(req.query);
    const pageSize = 20;
    const { rows } = await pool.query(
      `SELECT u.id, u.display_name, u.created_at, u.avatar_key, count(a.id)::int AS auctions
         FROM users u JOIN auctions a ON a.seller_id = u.id
        WHERE unaccent(u.display_name) ILIKE unaccent($1)
        GROUP BY u.id
        ORDER BY u.display_name
        LIMIT $2 OFFSET $3`,
      [containsPattern(q.q), pageSize, (q.page - 1) * pageSize],
    );
    return {
      items: rows.map((r) => ({
        id: r.id,
        displayName: r.display_name,
        createdAt: r.created_at.toISOString(),
        avatarUrl: r.avatar_key ? photoUrl(r.avatar_key) : null,
        auctionCount: r.auctions,
      })),
      page: q.page,
      pageSize,
    };
  });

  // RF22: perfil público — nome, data de entrada e leilões agendados, em andamento e passados.
  // Sem e-mail, sem avaliações, sem reputação.
  app.get<{ Params: { id: string } }>('/api/users/:id', async (req, reply) => {
    if (!uuid.safeParse(req.params.id).success) return reply.code(404).send({ error: 'NOT_FOUND' });
    const { rows } = await pool.query('SELECT id, display_name, created_at, avatar_key FROM users WHERE id = $1', [req.params.id]);
    const u = rows[0];
    if (!u) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Usuário não encontrado.' });
    const base = { sellerId: u.id, page: 1, pageSize: 50 };
    const [scheduled, live, past] = await Promise.all([
      listAuctions({ ...base, statuses: ['SCHEDULED'] }),
      listAuctions({ ...base, statuses: ['LIVE'] }),
      listAuctions({ ...base, statuses: ['SOLD', 'ENDED_NO_BIDS', 'CANCELLED'] }),
    ]);
    return {
      id: u.id,
      displayName: u.display_name,
      createdAt: u.created_at.toISOString(),
      avatarUrl: u.avatar_key ? photoUrl(u.avatar_key) : null,
      auctions: { scheduled: scheduled.items, live: live.items, past: past.items },
    };
  });

  // RF27: leilões em que eu dei lances e a minha situação em cada um.
  //   leader   = em andamento e eu sou o líder
  //   outbid   = alguém passou o meu lance (em andamento) ou o leilão terminou com outro vencedor
  //   winner   = vendido para mim
  app.get('/api/me/participations', { preHandler: requireUser }, async (req) => {
    const me = req.user!.id;
    const { rows } = await pool.query(
      `SELECT a.*, i.name, i.category,
              mb.my_best, mb.my_bids, mb.last_bid_at,
              (SELECT p.storage_key FROM item_photos p WHERE p.item_id = i.id ORDER BY p.position LIMIT 1) AS cover_key
         FROM (SELECT auction_id, max(amount_cents) AS my_best, count(*)::int AS my_bids, max(created_at) AS last_bid_at
                 FROM bids WHERE bidder_id = $1 GROUP BY auction_id) mb
         JOIN auctions a ON a.id = mb.auction_id
         JOIN items i ON i.id = a.item_id
        ORDER BY CASE a.status WHEN 'LIVE' THEN 0 ELSE 1 END, mb.last_bid_at DESC`,
      [me],
    );
    return {
      items: rows.map((r) => ({
        auctionId: r.id,
        name: r.name,
        category: r.category,
        status: r.status,
        coverUrl: r.cover_key ? photoUrl(r.cover_key) : null,
        myBestCents: r.my_best,
        myBidCount: r.my_bids,
        currentPriceCents: r.current_price_cents,
        minNextCents: minNextBid(r),
        endsAt: r.ends_at.toISOString(),
        situation: r.status === 'SOLD'
          ? (r.winner_id === me ? 'winner' : 'outbid')
          : r.leader_id === me ? 'leader' : 'outbid',
      })),
    };
  });
}
