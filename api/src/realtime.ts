// RF09/RF24/RF25/RF26: sala em tempo real com Socket.IO.
// Fluxo: alguma mudança no banco faz pg_notify -> cada instância da API recebe pelo LISTEN ->
// lê o estado atual no banco -> envia para quem precisa.
//   auction_events: payload = id do leilão  -> estado da sala para todos nela
//   user_events:    payload = JSON {type, userId, ...} -> aviso pessoal (ex.: lance superado)
// Como o estado é sempre lido do banco, quem reconecta recebe o snapshot completo e nada se perde.
import type { Server as HttpServer } from 'node:http';
import pg from 'pg';
import { Server } from 'socket.io';
import { config } from './config.js';
import { AUCTION_CHANNEL, USER_CHANNEL, pool } from './db.js';
import { getRoomState } from './auctions.js';
import { tokenFromCookieHeader, userFromToken } from './auth.js';

const room = (id: string) => `auction:${id}`;
const userRoom = (id: string) => `user:${id}`;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type RoomMode = 'participant' | 'spectator';

// ---------- presença (RF25) ----------
// auctionId -> socketId -> { userId, mode }. Fica na memória desta instância da API (ver D33).
const presence = new Map<string, Map<string, { userId: string; mode: RoomMode }>>();

/** RF10.1: o autor do lance está na sala do leilão como participante? */
export function isParticipant(userId: string, auctionId: string): boolean {
  for (const p of presence.get(auctionId)?.values() ?? []) {
    if (p.userId === userId && p.mode === 'participant') return true;
  }
  return false;
}

/** Contagem por pessoa (não por aba): quem tem ao menos uma aba como participante conta como participante. */
function presenceCounts(auctionId: string) {
  const byUser = new Map<string, RoomMode>();
  for (const p of presence.get(auctionId)?.values() ?? []) {
    if (byUser.get(p.userId) !== 'participant') byUser.set(p.userId, p.mode);
  }
  let participants = 0;
  let spectators = 0;
  for (const m of byUser.values()) m === 'participant' ? participants++ : spectators++;
  return { auctionId, participants, spectators };
}

export function setupRealtime(httpServer: HttpServer) {
  const io = new Server(httpServer, { path: '/socket.io', serveClient: false });

  // Só conecta quem tem sessão válida (RF04).
  io.use(async (socket, next) => {
    const user = await userFromToken(tokenFromCookieHeader(socket.handshake.headers.cookie)).catch(() => null);
    if (!user) return next(new Error('UNAUTHENTICATED'));
    socket.data.user = user;
    next();
  });

  const emitPresence = (auctionId: string) => io.to(room(auctionId)).emit('room:presence', presenceCounts(auctionId));

  function setPresence(socketId: string, auctionId: string, userId: string, mode: RoomMode | null) {
    let m = presence.get(auctionId);
    if (mode === null) {
      m?.delete(socketId);
      if (m && m.size === 0) presence.delete(auctionId);
    } else {
      if (!m) presence.set(auctionId, (m = new Map()));
      m.set(socketId, { userId, mode });
    }
    emitPresence(auctionId);
  }

  io.on('connection', (socket) => {
    const user = socket.data.user as { id: string };
    void socket.join(userRoom(user.id)); // avisos pessoais (RF26), em qualquer página
    const joined = new Set<string>();

    async function sellerOf(auctionId: string): Promise<string | null> {
      const r = await pool.query('SELECT seller_id FROM auctions WHERE id = $1', [auctionId]);
      return r.rows[0]?.seller_id ?? null;
    }

    // RF25: entra como participante (padrão) ou espectador. O comitente só assiste.
    socket.on('room:join', async (payload: { auctionId?: string; mode?: RoomMode }, ack?: (r: unknown) => void) => {
      const id = payload?.auctionId;
      if (!id || !UUID_RE.test(id)) return ack?.({ ok: false, error: 'NOT_FOUND' });
      const state = await getRoomState(id);
      if (!state) return ack?.({ ok: false, error: 'NOT_FOUND' });
      const mode: RoomMode = state.sellerId === user.id ? 'spectator' : payload.mode === 'spectator' ? 'spectator' : 'participant';
      await socket.join(room(id));
      joined.add(id);
      setPresence(socket.id, id, user.id, mode);
      ack?.({ ok: true, state, mode, presence: presenceCounts(id) });
    });

    // RF25: vira participante (ou volta a espectador) sem sair da sala.
    socket.on('room:mode', async (payload: { auctionId?: string; mode?: RoomMode }, ack?: (r: unknown) => void) => {
      const id = payload?.auctionId;
      if (!id || !joined.has(id)) return ack?.({ ok: false, error: 'NOT_IN_ROOM' });
      const mode: RoomMode = payload.mode === 'participant' ? 'participant' : 'spectator';
      if (mode === 'participant' && (await sellerOf(id)) === user.id) {
        return ack?.({ ok: false, error: 'IS_SELLER', message: 'O comitente só pode assistir ao próprio leilão.' });
      }
      setPresence(socket.id, id, user.id, mode);
      ack?.({ ok: true, mode, presence: presenceCounts(id) });
    });

    socket.on('room:leave', async (payload: { auctionId?: string }, ack?: (r: unknown) => void) => {
      const id = payload?.auctionId;
      if (!id || !joined.has(id)) return ack?.({ ok: true });
      joined.delete(id);
      await socket.leave(room(id));
      setPresence(socket.id, id, user.id, null);
      ack?.({ ok: true });
    });

    socket.on('disconnect', () => {
      for (const id of joined) setPresence(socket.id, id, user.id, null);
      joined.clear();
    });
  });

  // Agrupa notificações próximas do mesmo leilão (rajada de lances) em um único envio.
  const pending = new Map<string, NodeJS.Timeout>();
  async function broadcast(id: string) {
    pending.delete(id);
    const state = await getRoomState(id).catch((e) => {
      console.error('[realtime] erro lendo estado', e);
      return null;
    });
    if (state) io.to(room(id)).emit('auction:state', state);
    io.emit('listing:changed', { id });
  }
  function schedule(id: string) {
    if (pending.has(id)) return;
    pending.set(id, setTimeout(() => void broadcast(id), 30));
  }

  // RF26: aviso pessoal. O nome do item é lido aqui para não pesar a transação do lance.
  async function deliverUserEvent(raw: string) {
    try {
      const ev = JSON.parse(raw) as { type: string; userId: string; auctionId: string; [k: string]: unknown };
      if (ev.type === 'outbid') {
        const r = await pool.query('SELECT i.name FROM auctions a JOIN items i ON i.id = a.item_id WHERE a.id = $1', [ev.auctionId]);
        io.to(userRoom(ev.userId)).emit('user:outbid', { ...ev, name: r.rows[0]?.name ?? null });
      }
    } catch (e) {
      console.error('[realtime] evento de usuário inválido', e);
    }
  }

  // Conexão dedicada ao LISTEN, com reconexão automática.
  async function listen() {
    const client = new pg.Client({ connectionString: config.databaseUrl });
    client.on('notification', (msg) => {
      if (!msg.payload) return;
      if (msg.channel === AUCTION_CHANNEL) schedule(msg.payload);
      else if (msg.channel === USER_CHANNEL) void deliverUserEvent(msg.payload);
    });
    client.on('error', (e) => {
      console.error('[realtime] LISTEN caiu, reconectando...', e.message);
      client.end().catch(() => {});
      setTimeout(listen, 1000);
    });
    try {
      await client.connect();
      await client.query(`LISTEN ${AUCTION_CHANNEL}`);
      await client.query(`LISTEN ${USER_CHANNEL}`);
      console.log('[realtime] escutando', AUCTION_CHANNEL, USER_CHANNEL);
    } catch (e) {
      console.error('[realtime] falha ao conectar LISTEN', (e as Error).message);
      client.end().catch(() => {});
      setTimeout(listen, 1000);
    }
  }
  void listen();

  return io;
}
