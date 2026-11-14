// RNF04: dados de demonstração — 1 comitente, 3 compradores e leilões em todos os estados.
// Uso: docker compose exec api node dist/seed.js   (ou: npm run seed:dev)
// Se as contas de demo já existem, não faz nada (pode rodar de novo sem duplicar).
import { pool, tx } from './db.js';
import { migrate } from './migrate.js';
import { hashPassword } from './auth.js';
import { ensureBucket, uploadPhoto } from './storage.js';
import { makePng } from './png.js';

const PASSWORD = 'demo1234';
const USERS = [
  { key: 'ana', name: 'Ana Comitente', email: 'ana@demo.com' },
  { key: 'bruno', name: 'Bruno Comprador', email: 'bruno@demo.com' },
  { key: 'carla', name: 'Carla Compradora', email: 'carla@demo.com' },
  { key: 'diego', name: 'Diego Comprador', email: 'diego@demo.com' },
] as const;

const min = 60_000;
const PALETTE: [number, number, number][] = [[176, 58, 46], [36, 113, 163], [30, 132, 73], [183, 149, 11], [118, 68, 138], [52, 73, 94], [202, 111, 30]];

type Bid = { by: 'bruno' | 'carla' | 'diego'; cents: number; agoMin: number };
const AUCTIONS: {
  name: string; description: string; category: string; startCents: number;
  startOffsetMin: number; durationMin: number; status: string; bids?: Bid[];
}[] = [
  { name: 'Câmera Fujifilm X100V', description: 'Câmera compacta em ótimo estado, com carregador e duas baterias.', category: 'Eletrônicos', startCents: 450000, startOffsetMin: -5, durationMin: 25, status: 'LIVE',
    bids: [{ by: 'bruno', cents: 450000, agoMin: 4 }, { by: 'carla', cents: 455000, agoMin: 3 }, { by: 'bruno', cents: 460000, agoMin: 1 }] },
  { name: 'Bicicleta Caloi Elite', description: 'Bicicleta speed aro 700, revisada recentemente.', category: 'Esportes', startCents: 120000, startOffsetMin: -1, durationMin: 4, status: 'LIVE' },
  { name: 'Notebook ThinkPad T14', description: 'Ryzen 7, 16 GB de RAM, SSD de 512 GB. Bateria com 90% de saúde.', category: 'Informática', startCents: 300000, startOffsetMin: 2, durationMin: 5, status: 'SCHEDULED' },
  { name: 'Quadro a óleo — Paisagem', description: 'Pintura original 60x40 cm, assinada pelo artista.', category: 'Arte', startCents: 80000, startOffsetMin: 24 * 60, durationMin: 60, status: 'SCHEDULED' },
  { name: 'Vinil Clube da Esquina', description: 'LP original de 1972, capa dupla, disco sem riscos.', category: 'Colecionáveis', startCents: 25000, startOffsetMin: -26 * 60, durationMin: 60, status: 'SOLD',
    bids: [{ by: 'carla', cents: 25000, agoMin: 25 * 60 + 50 }, { by: 'diego', cents: 26000, agoMin: 25 * 60 + 30 }] },
  { name: 'Cadeira gamer reclinável', description: 'Cadeira com apoio lombar e braços ajustáveis.', category: 'Casa e Decoração', startCents: 60000, startOffsetMin: -3 * 60, durationMin: 60, status: 'ENDED_NO_BIDS' },
  { name: 'Relógio de bolso antigo', description: 'Relógio de bolso em prata, funcionando.', category: 'Colecionáveis', startCents: 150000, startOffsetMin: 3 * 60, durationMin: 60, status: 'CANCELLED' },
];

await migrate();
await ensureBucket();

const exists = await pool.query("SELECT 1 FROM users WHERE lower(email) = 'ana@demo.com'");
if (exists.rowCount) {
  console.log('Dados de demonstração já existem. Nada a fazer.');
  await pool.end();
  process.exit(0);
}

const hash = await hashPassword(PASSWORD);
await tx(async (c) => {
  const ids: Record<string, string> = {};
  for (const u of USERS) {
    // Ana tem conta antiga (útil para a pontuação do Bônus, que usa dias de conta)
    const created = u.key === 'ana' ? new Date(Date.now() - 200 * 24 * 60 * min) : new Date();
    const r = await c.query(
      'INSERT INTO users (display_name, email, password_hash, created_at) VALUES ($1,$2,$3,$4) RETURNING id',
      [u.name, u.email, hash, created],
    );
    ids[u.key] = r.rows[0].id;
  }

  for (const [n, a] of AUCTIONS.entries()) {
    const item = await c.query(
      'INSERT INTO items (seller_id, name, description, category) VALUES ($1,$2,$3,$4) RETURNING id',
      [ids.ana, a.name, a.description, a.category],
    );
    const itemId = item.rows[0].id;
    for (let p = 0; p < 3; p++) {
      const key = await uploadPhoto(makePng(PALETTE[(n + p) % PALETTE.length]), { mime: 'image/png', ext: 'png' });
      await c.query('INSERT INTO item_photos (item_id, storage_key, position) VALUES ($1,$2,$3)', [itemId, key, p]);
    }

    const startsAt = new Date(Date.now() + a.startOffsetMin * min);
    const endsAt = new Date(startsAt.getTime() + a.durationMin * min);
    const bids = a.bids ?? [];
    const last = bids.at(-1);
    const sold = a.status === 'SOLD';
    const auction = await c.query(
      `INSERT INTO auctions (item_id, seller_id, status, start_price_cents, starts_at, original_ends_at, ends_at,
                             current_price_cents, leader_id, bid_count, winner_id, final_price_cents, closed_at, cancelled_at)
       VALUES ($1,$2,$3,$4,$5,$6,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [
        itemId, ids.ana, a.status, a.startCents, startsAt, endsAt,
        last?.cents ?? null, last ? ids[last.by] : null, bids.length,
        sold && last ? ids[last.by] : null, sold && last ? last.cents : null,
        sold || a.status === 'ENDED_NO_BIDS' ? endsAt : null,
        a.status === 'CANCELLED' ? new Date() : null,
      ],
    );
    for (const b of bids) {
      await c.query(
        'INSERT INTO bids (auction_id, bidder_id, amount_cents, idempotency_key, created_at) VALUES ($1,$2,$3,$4,$5)',
        [auction.rows[0].id, ids[b.by], b.cents, `seed-${crypto.randomUUID()}`, new Date(Date.now() - b.agoMin * min)],
      );
    }
  }
});

console.log('Dados de demonstração criados. Senha de todas as contas:', PASSWORD);
for (const u of USERS) console.log(`  ${u.email}  (${u.name})`);
await pool.end();
