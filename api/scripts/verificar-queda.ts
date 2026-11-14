// Verificação de QUEDA DO SISTEMA (RF18 + RF24 + RF25): derruba a API e o worker no meio de
// leilões em andamento, deixa um leilão passar do horário de término com tudo fora do ar e liga de novo.
// Confere se sessões, salas, modos, presença, lances e fechamentos voltam corretos.
//
// Precisa rodar na máquina onde está o Docker Compose (ele para e liga os contêineres):
//   BASE_URL=http://localhost:8080 npx tsx scripts/verificar-queda.ts      (ou: ./rodar.sh verificar-queda)
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE, Client, auctionForm, check, finish, inSec, sleep } from './cliente.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// COMPOSE_CMD permite usar "sudo docker compose" quando o usuário não está no grupo docker
const compose = (args: string) => execSync(`${process.env.COMPOSE_CMD ?? 'docker compose'} ${args}`, { cwd: ROOT, stdio: 'pipe' }).toString();
const t0 = Date.now();
const log = (msg: string) => console.log(`     [${Math.round((Date.now() - t0) / 1000)}s] ${msg}`);

async function waitHealthy(ms: number) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return true;
    } catch { /* ainda subindo */ }
    await sleep(500);
  }
  return false;
}

// ---------- preparação ----------
const seller = new Client();
const b1 = new Client();
const b2 = new Client();
const spec = new Client();
await seller.register('Comitente');
await b1.register('Participante1');
await b2.register('Participante2');
await spec.register('Espectador');

const form = (name: string, durationSec: number) => auctionForm({
  name, description: 'Leilão do teste de queda do sistema.', category: 'Outros',
  startPriceCents: '10000', startsAt: inSec(31), durationSec: String(durationSec),
});
const longo = (await seller.req('POST', '/api/auctions', undefined, form('Queda: continua depois', 1800))).body.id as string;
const curto = (await seller.req('POST', '/api/auctions', undefined, form('Queda: termina durante', 60))).body.id as string;
check(!!longo && !!curto, 'cria um leilão longo e um que vai terminar durante a queda');

for (const c of [b1, b2]) { await c.join(longo); await c.join(curto); }
check((await spec.join(longo, 'spectator')).mode === 'spectator', 'espectador entra só para assistir');
check((await seller.join(longo)).mode === 'spectator', 'comitente entra (sempre como espectador)');

log('aguardando os leilões abrirem...');
while ((await b1.req('GET', `/api/auctions/${curto}`)).body.status !== 'LIVE') await sleep(500);

// lances antes da queda
await b1.bid(longo, 10000);
await sleep(600);
const keyB2 = crypto.randomUUID();
const lanceB2 = await b2.bid(longo, 10500, keyB2);
await sleep(600);
await b1.bid(curto, 10000);
check(lanceB2.body.accepted === true, 'lances dados antes da queda');

const antes = (await b1.req('GET', `/api/auctions/${longo}/room`)).body;
const curtoAntes = (await b1.req('GET', `/api/auctions/${curto}/room`)).body;
const presAntes = await b2.waitFor('room:presence', (p) => p.auctionId === longo && p.participants === 2 && p.spectators === 2, 3000);
check(presAntes !== null, 'antes da queda: 2 participantes e 2 espectadores na sala');

// ---------- QUEDA ----------
const fimCurto = new Date(curtoAntes.endsAt).getTime();
log(`derrubando API e worker (o leilão curto termina às ${new Date(fimCurto).toLocaleTimeString('pt-BR')})...`);
compose('stop api worker');
const fora = await fetch(`${BASE}/api/health`).then((r) => r.status).catch(() => 0);
check(fora !== 200, `sistema fora do ar (resposta ${fora})`);

const tentativa = await b1.bid(longo, 11000);
check(tentativa.status !== 201, 'com o sistema fora, nenhum lance é aceito');

const espera = Math.max(0, fimCurto - Date.now()) + 3000;
log(`esperando ${Math.round(espera / 1000)}s com tudo fora do ar, até o leilão curto passar do horário...`);
await sleep(espera);

log('religando API e worker...');
compose('start api worker');
check(await waitHealthy(90_000), 'sistema voltou');
await sleep(3000); // tempo para os sockets reconectarem e o worker rodar um ciclo

// ---------- DEPOIS DA QUEDA ----------
// 1. sessões
for (const [nome, c] of [['participante 1', b1], ['participante 2', b2], ['espectador', spec], ['comitente', seller]] as const) {
  check((await c.req('GET', '/api/auth/me')).status === 200, `sessão do ${nome} continua válida (não precisou logar de novo)`);
}

// 2. reconexão e reentrada nas salas, no mesmo modo
const rejB2 = await b2.waitFor('rejoin', (a) => a.auctionId === longo, 15000);
check(rejB2?.ok === true && rejB2.mode === 'participant', 'participante reconectou sozinho e voltou como participante');
const rejSpec = await spec.waitFor('rejoin', (a) => a.auctionId === longo, 15000);
check(rejSpec?.ok === true && rejSpec.mode === 'spectator', 'espectador reconectou sozinho e voltou como espectador');

// 3. estado da sala recebido na reconexão = estado de antes
const st = rejB2?.state;
check(st?.bidCount === antes.bidCount && st?.currentPriceCents === antes.currentPriceCents && st?.leaderId === antes.leaderId,
  `sala reconstituída com o mesmo estado (${st?.bidCount} lances, líder e preço iguais)`);

// 4. presença reconstituída
const presDepois = await b2.waitFor('room:presence', (p) => p.auctionId === longo && p.participants === 2 && p.spectators === 2, 10000);
check(presDepois !== null, 'presença reconstituída: 2 participantes e 2 espectadores');

// 5. leilão que venceu durante a queda fechou certo
const curtoDepois = (await b1.req('GET', `/api/auctions/${curto}/room`)).body;
check(curtoDepois.status === 'SOLD' && curtoDepois.winnerId === b1.id && curtoDepois.finalPriceCents === 10000,
  'leilão que terminou durante a queda fechou como Vendido, com o vencedor e o valor certos');
const atrasado = await b2.bid(curto, 20000);
check(!atrasado.body.accepted && atrasado.body.code === 'ENDED', 'lance depois do término é recusado');
const part = (await b1.req('GET', '/api/me/participations')).body.items.find((i: any) => i.auctionId === curto);
check(part?.situation === 'winner', '"Minhas participações" mostra o vencedor');

// 6. reenvio do lance de antes da queda devolve o original
const reenvio = await b2.bid(longo, 10500, keyB2);
check(reenvio.status === 200 && reenvio.body.replay && reenvio.body.bid.id === lanceB2.body.bid.id,
  'reenviar o lance de antes da queda devolve o original (não duplica)');

// 7. modo espectador continua valendo
const lanceEsp = await spec.bid(longo, 20000);
check(!lanceEsp.body.accepted && lanceEsp.body.code === 'NOT_IN_ROOM', 'espectador continua sem poder dar lance');

// 8. o leilão longo continua funcionando, inclusive o tempo real
const ultimo = b2.events.length;
const novo = await b1.bid(longo, (await b1.req('GET', `/api/auctions/${longo}/room`)).body.minNextCents);
check(novo.body.accepted === true, 'participante dá lance normalmente depois da volta');
let aoVivo = null;
for (let i = 0; i < 60 && !aoVivo; i++) {
  aoVivo = b2.events.slice(ultimo).find((e) => e.event === 'auction:state' && e.data.id === longo && e.data.bidCount === antes.bidCount + 1) ?? null;
  await sleep(50);
}
check(aoVivo !== null, 'o novo lance chega em tempo real aos outros na sala');
const aviso = await b2.waitFor('user:outbid', (e) => e.auctionId === longo, 3000);
check(aviso !== null, 'quem foi superado recebe o aviso (avisos pessoais voltaram a funcionar)');

for (const c of [seller, b1, b2, spec]) c.close();
log(`teste levou ${Math.round((Date.now() - t0) / 1000)}s`);
finish();
