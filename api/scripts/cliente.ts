// Cliente de teste que imita o navegador: HTTP com cookie de sessão + Socket.IO para a sala.
import { io, type Socket } from 'socket.io-client';
import { makePng } from '../src/png.js';

export const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const inSec = (s: number) => new Date(Date.now() + s * 1000).toISOString();

let failures = 0;
export function check(cond: boolean, msg: string) {
  console.log(`${cond ? 'OK  ' : 'FALHOU'} ${msg}`);
  if (!cond) failures++;
}
export function finish(): never {
  console.log(failures ? `\n${failures} verificação(ões) falharam` : '\nTodas as verificações passaram');
  process.exit(failures ? 1 : 0);
}

export function auctionForm(fields: Record<string, string>, photos = 3) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  for (let i = 0; i < photos; i++)
    f.append('photos', new Blob([makePng([60 * i, 120, 200], 32, 24)], { type: 'image/png' }), `f${i}.png`);
  return f;
}

export class Client {
  cookie = '';
  id = '';
  name = '';
  socket: Socket | null = null;
  events: { event: string; data: any }[] = [];
  /** salas em que o cliente está e o modo escolhido (para reentrar ao reconectar) */
  rooms = new Map<string, 'participant' | 'spectator'>();

  async req(method: string, path: string, body?: unknown, form?: FormData) {
    const r = await fetch(BASE + path, {
      method,
      headers: { ...(this.cookie ? { cookie: this.cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
      body: form ?? (body ? JSON.stringify(body) : undefined),
    });
    const set = r.headers.get('set-cookie');
    if (set) this.cookie = set.split(';')[0];
    const text = await r.text();
    // com a API fora do ar, o Nginx responde 502 em HTML: devolve o texto em vez de quebrar
    let parsed: any = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
    return { status: r.status, body: parsed };
  }

  async register(name: string) {
    this.name = `${name} ${Math.random().toString(36).slice(2, 6)}`;
    const email = `${name.toLowerCase()}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}@teste.com`;
    const r = await this.req('POST', '/api/auth/register', { displayName: this.name, email, password: 'senha12345' });
    this.id = r.body.user.id;
    return r;
  }

  bid(auctionId: string, amountCents: number, key: string = crypto.randomUUID()) {
    return this.req('POST', `/api/auctions/${auctionId}/bids`, { amountCents, idempotencyKey: key });
  }

  /** Conecta o Socket.IO com o cookie da sessão (uma conexão por cliente, como uma aba). */
  async connect(): Promise<Socket> {
    if (this.socket?.connected) return this.socket;
    const s = io(BASE, { path: '/socket.io', transports: ['websocket'], extraHeaders: { cookie: this.cookie }, forceNew: true });
    s.onAny((event, data) => this.events.push({ event, data }));
    s.on('disconnect', () => this.events.push({ event: 'disconnect', data: null }));
    // Como a página da sala faz (RF24/RF25): ao reconectar, entra de novo em cada sala no mesmo modo
    s.io.on('reconnect', () => {
      for (const [auctionId, mode] of this.rooms) {
        s.emit('room:join', { auctionId, mode }, (ack: any) => this.events.push({ event: 'rejoin', data: { auctionId, ...ack } }));
      }
    });
    await new Promise<void>((resolve, reject) => {
      s.once('connect', () => resolve());
      s.once('connect_error', (e) => reject(e));
    });
    this.socket = s;
    return s;
  }

  async join(auctionId: string, mode: 'participant' | 'spectator' = 'participant'): Promise<any> {
    const s = await this.connect();
    const ack = await s.emitWithAck('room:join', { auctionId, mode });
    if (ack?.ok) this.rooms.set(auctionId, ack.mode ?? mode);
    return ack;
  }

  async setMode(auctionId: string, mode: 'participant' | 'spectator'): Promise<any> {
    const ack = await this.socket!.emitWithAck('room:mode', { auctionId, mode });
    if (ack?.ok) this.rooms.set(auctionId, ack.mode ?? mode);
    return ack;
  }

  /** Espera até `ms` por um evento recebido que satisfaça `pred`. */
  async waitFor(event: string, pred: (d: any) => boolean = () => true, ms = 3000): Promise<any | null> {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const hit = this.events.find((e) => e.event === event && pred(e.data));
      if (hit) return hit.data;
      await sleep(50);
    }
    return null;
  }

  close() {
    this.socket?.disconnect();
  }
}
