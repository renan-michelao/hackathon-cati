// Verificação ponta a ponta das garantias do Núcleo contra um sistema rodando.
// Uso: BASE_URL=http://localhost:3000 npx tsx scripts/verificar.ts
// Cria usuários, um leilão curto, dispara lances simultâneos e confere os resultados.
import { Client, auctionForm, check, finish, inSec, sleep } from './cliente.js';

const seller = new Client();
const buyers = Array.from({ length: 8 }, () => new Client());
await seller.register('Vendedor');
for (const [i, b] of buyers.entries()) await b.register(`Comprador${i}`);

// RF04: visitante vê a listagem, mas não a sala
const visitor = new Client();
check((await visitor.req('GET', '/api/auctions')).status === 200, 'visitante vê a listagem');

// RF05: criação com 3 fotos
const created = await seller.req('POST', '/api/auctions', undefined, auctionForm({
  name: 'Teste de concorrência',
  description: 'Leilão criado pelo script de verificação.',
  category: 'Outros',
  startPriceCents: '10000',
  startsAt: inSec(31),
  durationSec: '60',
}));
check(created.status === 201, `cria leilão com 3 fotos (${created.status} ${created.body?.message ?? ''})`);
const id = created.body.id;
check(created.body.status === 'SCHEDULED', 'leilão começa Agendado');

check((await visitor.req('GET', `/api/auctions/${id}/room`)).status === 401, 'visitante não entra na sala');
check(await visitor.connect().then(() => false, () => true), 'visitante não conecta no tempo real');

check((await seller.req('POST', '/api/auctions', undefined, auctionForm({ name: 'x' }, 0))).status === 400, 'recusa leilão inválido');

// Todos entram na sala (RF10.1: lance só vale para quem está na sala como participante)
for (const b of buyers) await b.join(id);
const sellerJoin = await seller.join(id);
check(sellerJoin.ok && sellerJoin.mode === 'spectator', 'comitente entra na sala só como espectador');

const early = await buyers[0].bid(id, 10000);
check(!early.body.accepted && early.body.code === 'NOT_LIVE', 'recusa lance antes de abrir');

console.log('aguardando abertura...');
while ((await visitor.req('GET', `/api/auctions/${id}`)).body.status !== 'LIVE') await sleep(500);
check(true, 'abriu sozinho no horário');

// RF04: comitente não dá lance
const own = await seller.bid(id, 10000);
check(!own.body.accepted && own.body.code === 'IS_SELLER', 'comitente é recusado no próprio leilão');

// RF10.1: quem não está na sala não dá lance
const outsider = new Client();
await outsider.register('Fora');
const out = await outsider.bid(id, 10000);
check(!out.body.accepted && out.body.code === 'NOT_IN_ROOM', 'quem não entrou na sala é recusado');

// RF11: 8 compradores dão o MESMO lance ao mesmo tempo -> exatamente 1 aceito
const results = await Promise.all(buyers.map((b) => b.bid(id, 10000)));
const accepted = results.filter((r) => r.body.accepted);
check(accepted.length === 1, `lances simultâneos de mesmo valor: ${accepted.length} aceito(s) (esperado 1)`);
const rejected = results.find((r) => !r.body.accepted);
check(rejected?.body.code === 'TOO_LOW' && rejected.body.minNextCents === 10500, 'recusado informa motivo e lance mínimo atual (R$ 105,00)');

// RF09: a sala recebeu o novo estado depois do lance gravado
const pushed = await buyers[0].waitFor('auction:state', (s) => s.id === id && s.bidCount === 1);
check(pushed?.currentPriceCents === 10000, 'a sala recebeu o lance em tempo real');

// RF12: reenvio com a mesma chave não cria segundo lance
await sleep(600);
const key = crypto.randomUUID();
const leaderIdx = results.findIndex((r) => r.body.accepted);
const other = buyers[(leaderIdx + 1) % buyers.length];
const [r1, r2] = await Promise.all([other.bid(id, 10500, key), other.bid(id, 10500, key)]);
check(r1.body.accepted && r2.body.accepted && r1.body.bid.id === r2.body.bid.id, 'reenvio simultâneo devolve o mesmo lance');
await sleep(600);
other.close(); // mesmo fora da sala (conexão caiu), o reenvio devolve o resultado original
const r3 = await other.bid(id, 10500, key);
check(r3.status === 200 && r3.body.replay && r3.body.bid.id === r1.body.bid.id, 'reenvio posterior devolve o resultado original');
await other.join(id);

// RF10.3: líder não dá lance de novo
const again = await other.bid(id, 20000);
check(!again.body.accepted && again.body.code === 'ALREADY_LEADER', 'líder atual é recusado');

// RF13: rajada
const third = buyers[(leaderIdx + 2) % buyers.length];
const burst = await Promise.all([third.bid(id, 11000), third.bid(id, 11500)]);
check(burst.some((r) => r.body.code === 'RATE_LIMITED' || r.body.code === 'ALREADY_LEADER'), 'rajada do mesmo usuário é contida');

// Sala
const room = await other.req('GET', `/api/auctions/${id}/room`);
check(room.status === 200 && room.body.bidCount === 3, `sala mostra total de lances (${room.body.bidCount})`);

// RF08: não cancela com lances
check((await seller.req('POST', `/api/auctions/${id}/cancel`)).status === 409, 'não cancela leilão com lances');

// RF15: lance perto do fim prorroga
const before = new Date(room.body.endsAt).getTime();
check(before - Date.now() < 120_000, 'leilão de 60 s está dentro da janela de prorrogação');
await sleep(600);
const ext = await buyers[(leaderIdx + 3) % buyers.length].bid(id, room.body.minNextCents);
const after = await other.req('GET', `/api/auctions/${id}/room`);
check(ext.body.accepted && new Date(after.body.endsAt).getTime() > before, 'lance na janela final prorroga o término');

for (const c of [seller, ...buyers]) c.close();
finish();
