// RF09/RF24: sala em tempo real com Socket.IO.
// Fluxo: alguma mudança no banco faz pg_notify('auction_events', id) -> cada instância da API
// recebe pelo LISTEN -> lê o estado atual da sala no banco -> envia para todos na sala.
// Como o estado é sempre lido do banco, quem reconecta recebe o snapshot completo e nada se perde.
import type { Server as HttpServer } from 'node:http';
import pg from 'pg';
import { Server } from 'socket.io';
import { config } from './config.js';
import { AUCTION_CHANNEL } from './db.js';
import { getRoomState } from './auctions.js';
import { tokenFromCookieHeader, userFromToken } from './auth.js';

const room = (id: string) => `auction:${id}`;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function setupRealtime(httpServer: HttpServer) {
  const io = new Server(httpServer, { path: '/socket.io', serveClient: false });

  // Só entra na sala quem tem sessão válida (RF04).
  io.use(async (socket, next) => {
    const user = await userFromToken(tokenFromCookieHeader(socket.handshake.headers.cookie)).catch(() => null);
    if (!user) return next(new Error('UNAUTHENTICATED'));
    socket.data.user = user;
    next();
  });

  io.on('connection', (socket) => {
    socket.on('room:join', async (payload: { auctionId?: string }, ack?: (r: unknown) => void) => {
      const id = payload?.auctionId;
      if (!id || !UUID_RE.test(id)) return ack?.({ ok: false, error: 'NOT_FOUND' });
      const state = await getRoomState(id);
      if (!state) return ack?.({ ok: false, error: 'NOT_FOUND' });
      await socket.join(room(id));
      ack?.({ ok: true, state });
    });

    socket.on('room:leave', async (payload: { auctionId?: string }) => {
      if (payload?.auctionId) await socket.leave(room(payload.auctionId));
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

  // Conexão dedicada ao LISTEN, com reconexão automática.
  async function listen() {
    const client = new pg.Client({ connectionString: config.databaseUrl });
    client.on('notification', (msg) => {
      if (msg.channel === AUCTION_CHANNEL && msg.payload) schedule(msg.payload);
    });
    client.on('error', (e) => {
      console.error('[realtime] LISTEN caiu, reconectando...', e.message);
      client.end().catch(() => {});
      setTimeout(listen, 1000);
    });
    try {
      await client.connect();
      await client.query(`LISTEN ${AUCTION_CHANNEL}`);
      console.log('[realtime] escutando', AUCTION_CHANNEL);
    } catch (e) {
      console.error('[realtime] falha ao conectar LISTEN', (e as Error).message);
      client.end().catch(() => {});
      setTimeout(listen, 1000);
    }
  }
  void listen();

  return io;
}
