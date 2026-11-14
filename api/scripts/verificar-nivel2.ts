// Verificação ponta a ponta dos requisitos de Nível 2 contra um sistema rodando.
// Uso: BASE_URL=http://localhost:3000 npx tsx scripts/verificar-nivel2.ts
import { Client, auctionForm, check, finish, inSec, sleep } from './cliente.js';

const base = { description: 'Item usado nos testes de Nível 2.', category: 'Outros', startPriceCents: '5000', durationSec: '120' };

const seller = new Client();
const b1 = new Client();
const b2 = new Client();
await seller.register('Comitente');
await b1.register('Comprador');
await b2.register('Compradora');

// ---------- RF23: edição ----------
const soon = await seller.req('POST', '/api/auctions', undefined, auctionForm({ ...base, name: 'Abre logo', startsAt: inSec(31) }));
const far = await seller.req('POST', '/api/auctions', undefined, auctionForm({ ...base, name: 'Abre depois', startsAt: inSec(40 * 60) }));
check(soon.status === 201 && far.status === 201, 'cria dois leilões (31 s e 40 min)');
check(far.body.editPolicy === 'ALL' && soon.body.editPolicy === 'NONE', 'detalhe informa a política de edição (ALL / NONE)');

const e1 = await seller.req('PATCH', `/api/auctions/${soon.body.id}`, undefined, auctionForm({ name: 'Novo nome' }, 0));
check(e1.status === 409 && e1.body.error === 'EDIT_NOT_ALLOWED', 'agendado faltando ≤ 30 min: edição recusada');

const e2 = await seller.req('PATCH', `/api/auctions/${far.body.id}`, undefined,
  auctionForm({ name: 'Nome editado', startPriceCents: '7000', durationSec: '300' }, 0));
check(e2.status === 200 && e2.body.name === 'Nome editado' && e2.body.startPriceCents === 7000, 'agendado faltando > 30 min: edita campos');
check(new Date(e2.body.endsAt).getTime() - new Date(e2.body.startsAt).getTime() === 300_000, 'mudar a duração recalcula o término');

const e3 = await seller.req('PATCH', `/api/auctions/${far.body.id}`, undefined, auctionForm({}, 3));
check(e3.status === 200 && e3.body.photos.length === 3, 'agendado faltando > 30 min: troca as fotos');

const e4 = await b1.req('PATCH', `/api/auctions/${far.body.id}`, undefined, auctionForm({ name: 'Invasor' }, 0));
check(e4.status === 403, 'quem não é o comitente não edita');

const e5 = await seller.req('PATCH', `/api/auctions/${far.body.id}`, undefined, auctionForm({ startsAt: inSec(5) }, 0));
check(e5.status === 400, 'edição respeita a antecedência mínima do início');

// ---------- RF28: relistagem ----------
const cancel = await seller.req('POST', `/api/auctions/${far.body.id}/cancel`);
check(cancel.status === 200 && cancel.body.status === 'CANCELLED' && cancel.body.canRelist, 'cancelado pode ser relistado');
const e6 = await seller.req('PATCH', `/api/auctions/${far.body.id}`, undefined, auctionForm({ appendDescription: 'x' }, 0));
check(e6.status === 409, 'cancelado não pode ser editado');

check((await b1.req('POST', `/api/auctions/${far.body.id}/relist`, undefined, auctionForm({ startsAt: inSec(60), durationSec: '60' }, 0))).status === 403,
  'quem não é o comitente não relista');

// duas relistagens simultâneas do mesmo item: só uma pode criar leilão
const relistForm = () => auctionForm({ startsAt: inSec(60), durationSec: '60', name: 'Relistado' }, 0);
const [r1, r2] = await Promise.all([
  seller.req('POST', `/api/auctions/${far.body.id}/relist`, undefined, relistForm()),
  seller.req('POST', `/api/auctions/${far.body.id}/relist`, undefined, relistForm()),
]);
const created = [r1, r2].filter((r) => r.status === 201);
const conflict = [r1, r2].find((r) => r.status === 409);
check(created.length === 1 && conflict?.body.error === 'ALREADY_ACTIVE', 'relistagens simultâneas: 1 criada, a outra recusada (um item, um leilão ativo)');
const relisted = created[0]?.body;
check(relisted?.status === 'SCHEDULED' && relisted.itemId === far.body.itemId && relisted.name === 'Relistado', 'novo leilão agendado para o mesmo item, com campos editados');
check(relisted?.photos.length === 3, 'relistagem sem fotos novas mantém as fotos do item');
check((await seller.req('GET', `/api/auctions/${far.body.id}`)).body.status === 'CANCELLED', 'o leilão antigo continua registrado como Cancelado');

// ---------- RF22: perfil público ----------
const prof = await b1.req('GET', `/api/users/${seller.id}`);
check(prof.status === 200 && !('email' in prof.body), 'perfil público sem e-mail');
check(prof.body.auctions.scheduled.length === 2 && prof.body.auctions.past.length === 1, 'perfil separa agendados e passados');
const found = await b1.req('GET', `/api/users?q=${encodeURIComponent(seller.name.toUpperCase())}`);
check(found.body.items.some((u: any) => u.id === seller.id), 'busca o comitente pelo nome (sem diferenciar maiúsculas)');

// ---------- RF25: espectador e participante ----------
const live = soon.body.id;
const sj = await seller.join(live, 'participant');
check(sj.ok && sj.mode === 'spectator', 'comitente pede para participar e entra como espectador');
const sm = await seller.setMode(live, 'participant');
check(!sm.ok && sm.error === 'IS_SELLER', 'comitente não vira participante no próprio leilão');
const j1 = await b1.join(live, 'spectator');
check(j1.ok && j1.mode === 'spectator', 'comprador entra só para assistir');
const j2 = await b2.join(live, 'participant');
check(j2.ok && j2.presence.participants === 1 && j2.presence.spectators === 2, `sala conta participantes e espectadores (${j2.presence.participants}/${j2.presence.spectators})`);

console.log('aguardando abertura...');
while ((await seller.req('GET', `/api/auctions/${live}`)).body.status !== 'LIVE') await sleep(500);

const asSpectator = await b1.bid(live, 5000);
check(!asSpectator.body.accepted && asSpectator.body.code === 'NOT_IN_ROOM', 'espectador não dá lance');
const m1 = await b1.setMode(live, 'participant');
check(m1.ok && m1.presence.participants === 2 && m1.presence.spectators === 1, 'vira participante sem sair da sala');
const pres = await b2.waitFor('room:presence', (p) => p.participants === 2);
check(pres !== null, 'os outros na sala recebem a nova contagem');

// ---------- RF23 em andamento ----------
const e7 = await seller.req('PATCH', `/api/auctions/${live}`, undefined, auctionForm({ appendDescription: 'Acompanha caixa original.' }, 0));
check(e7.status === 200 && e7.body.description.endsWith('Acompanha caixa original.'), 'em andamento: acrescenta texto à descrição');
const st = await b2.waitFor('auction:state', (s) => s.description?.endsWith('Acompanha caixa original.'));
check(st !== null, 'o texto acrescentado chega na sala em tempo real');
const e8 = await seller.req('PATCH', `/api/auctions/${live}`, undefined, auctionForm({ startPriceCents: '9000' }, 0));
check(e8.status === 409 && e8.body.error === 'EDIT_NOT_ALLOWED', 'em andamento: não muda outros campos');

// ---------- RF26 e RF27 ----------
await sleep(600);
check((await b1.bid(live, 5000)).body.accepted === true, 'participante dá lance');
let p1 = await b1.req('GET', '/api/me/participations');
check(p1.body.items[0]?.situation === 'leader', 'minhas participações: líder');

await b1.socket!.timeout(3000).emitWithAck('room:leave', { auctionId: live }); // sai da sala, mas continua no site
await b2.bid(live, 5100);
const outbid = await b1.waitFor('user:outbid', (e) => e.auctionId === live);
check(outbid?.amountCents === 5100 && outbid?.minNextCents === 5200 && outbid?.name === 'Abre logo', 'quem foi superado é avisado na hora, mesmo fora da sala');

p1 = await b1.req('GET', '/api/me/participations');
check(p1.body.items[0]?.situation === 'outbid' && p1.body.items[0]?.myBestCents === 5000, 'minhas participações: superado, com meu maior lance');
check((await seller.req('POST', `/api/auctions/${live}/cancel`)).status === 409, 'com lances, não cancela');

for (const c of [seller, b1, b2]) c.close();
finish();
