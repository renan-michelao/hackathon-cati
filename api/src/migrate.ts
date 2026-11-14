import { pool } from './db.js';

// Esquema idempotente: pode rodar a cada inicialização sem apagar nada.
// Dinheiro sempre em centavos (BIGINT) e horários sempre TIMESTAMPTZ (UTC) — RF19.
const SCHEMA = /* sql */ `
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name  TEXT NOT NULL,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  last_bid_attempt_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- RF01: um e-mail identifica uma única conta (sem diferenciar maiúsculas).
CREATE UNIQUE INDEX IF NOT EXISTS users_email_uq ON users (lower(email));

CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id),
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id   UUID NOT NULL REFERENCES users(id),
  name        TEXT NOT NULL,
  description TEXT NOT NULL,
  category    TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS item_photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     UUID NOT NULL REFERENCES items(id),
  storage_key TEXT NOT NULL,
  position    INT NOT NULL
);

CREATE TABLE IF NOT EXISTS auctions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id             UUID NOT NULL REFERENCES items(id),
  seller_id           UUID NOT NULL REFERENCES users(id),
  status              TEXT NOT NULL DEFAULT 'SCHEDULED'
                      CHECK (status IN ('SCHEDULED','LIVE','SOLD','ENDED_NO_BIDS','CANCELLED')),
  start_price_cents   BIGINT NOT NULL CHECK (start_price_cents > 0),
  starts_at           TIMESTAMPTZ NOT NULL,
  original_ends_at    TIMESTAMPTZ NOT NULL,
  ends_at             TIMESTAMPTZ NOT NULL,
  current_price_cents BIGINT,
  leader_id           UUID REFERENCES users(id),
  bid_count           INT NOT NULL DEFAULT 0,
  winner_id           UUID REFERENCES users(id),
  final_price_cents   BIGINT,
  closed_at           TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auctions_status_starts ON auctions (status, starts_at);
CREATE INDEX IF NOT EXISTS auctions_status_ends   ON auctions (status, ends_at);
CREATE INDEX IF NOT EXISTS auctions_seller        ON auctions (seller_id);
-- RF28: um item nunca tem mais de um leilão Agendado ou Em andamento ao mesmo tempo.
CREATE UNIQUE INDEX IF NOT EXISTS auctions_one_active_per_item
  ON auctions (item_id) WHERE status IN ('SCHEDULED','LIVE');

CREATE TABLE IF NOT EXISTS bids (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id      UUID NOT NULL REFERENCES auctions(id),
  bidder_id       UUID NOT NULL REFERENCES users(id),
  amount_cents    BIGINT NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
-- RF12: a mesma tentativa (mesma chave do navegador) nunca vira dois lances.
CREATE UNIQUE INDEX IF NOT EXISTS bids_idempotency_uq ON bids (bidder_id, idempotency_key);
CREATE INDEX IF NOT EXISTS bids_auction ON bids (auction_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bids_bidder  ON bids (bidder_id);
`;

export async function migrate() {
  // Trava para duas instâncias não migrarem ao mesmo tempo.
  const c = await pool.connect();
  try {
    await c.query('SELECT pg_advisory_lock(424242)');
    await c.query(SCHEMA);
  } finally {
    await c.query('SELECT pg_advisory_unlock(424242)').catch(() => {});
    c.release();
  }
}
