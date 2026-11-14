// RF17/RF18: processo de fundo que abre e fecha leilões pelo relógio do banco.
// Não guarda nada em memória: tudo vem do banco a cada ciclo, então um reinício não perde
// nenhum leilão — no primeiro ciclo depois de voltar, abre e fecha o que estiver atrasado.
import { config } from './config.js';
import { runScheduler } from './auctions.js';

let running = true;
process.on('SIGTERM', () => (running = false));
process.on('SIGINT', () => (running = false));

console.log(`[worker] iniciado, ciclo de ${config.workerTickMs} ms`);
while (running) {
  try {
    const r = await runScheduler();
    if (r.opened || r.closed) console.log(`[worker] abertos=${r.opened} fechados=${r.closed}`);
  } catch (e) {
    // banco fora do ar ou tabelas ainda não criadas: tenta de novo no próximo ciclo
    console.error('[worker] erro no ciclo:', (e as Error).message);
  }
  await new Promise((r) => setTimeout(r, config.workerTickMs));
}
process.exit(0);
