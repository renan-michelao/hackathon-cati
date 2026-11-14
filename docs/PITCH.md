# Pitch e demo — FGR Leilões (Kernel Panic)

**Slides:** https://claude.ai/artifact/K7AbhX3iTAmGZzUS3XRZqn (9 slides; a fala de cada slide também está nas notas do apresentador)
**Sistema publicado:** http://200.18.99.113:8083

Este arquivo tem as falas de cada slide, o roteiro da demo (seção 10.3 do edital) e respostas curtas para a banca.
Tudo aqui vem de [DECISOES.md](DECISOES.md), [GUIA-DO-CODIGO.md](GUIA-DO-CODIGO.md), [README.md](../README.md) e [API.md](API.md).

**Sumário:** [1. Divisão e tempo](#1-divisão-e-tempo) · [2. Falas](#2-falas-de-cada-slide) · [3. Roteiro da demo](#3-roteiro-da-demo) · [4. Perguntas da banca](#4-perguntas-prováveis-da-banca)

---

## 1. Divisão e tempo

O edital pede que o pitch responda três perguntas (seção 10.2). Cada slide responde a uma delas:

| # | Slide | Responde | Quem fala | Tempo |
|---|---|---|---|---|
| 1 | Capa | — | Renan | 20 s |
| 2 | O que entregamos | — | Renan | 25 s |
| 3 | Arquitetura na VM | 1. Arquitetura | Francini | 35 s |
| 4 | Por que essa arquitetura | 1. Por que | Francini | 30 s |
| 5 | Decisão 1: concorrência | 2. Decisões difíceis | Renan | 40 s |
| 6 | Decisão 2: tempo e reinício | 2. Decisões difíceis | Gustavo | 35 s |
| 7 | Decisão 3: a sala só mostra o que foi gravado | 2. Decisões difíceis | Gustavo | 30 s |
| 8 | O que ficou de fora | 3. O que ficou de fora | Francini | 35 s |
| 9 | Como provamos (passa para a demo) | — | Gustavo | 30 s |
| | | | **Total** | **≈ 4 min 40 s** |

**Se o tempo for menor, corte nesta ordem** (as três perguntas do edital continuam respondidas):
1. **Slide 7** (decisão 3). O edital pede "duas ou três" decisões; os slides 5 e 6 bastam. → ≈ 4 min 10 s
2. **Slide 2** (o que entregamos). Renan diz numa frase, na capa: "Entregamos o Núcleo e o Nível 2 inteiros." → ≈ 3 min 45 s
3. **Slide 9** (provas). Gustavo fecha o slide 8 com: "Temos 105 verificações automáticas. Agora a demo é de vocês." → ≈ 3 min 15 s

Para cortar um slide do deck, abra os slides, selecione o slide e oculte ou apague. As falas abaixo continuam valendo.

---

## 2. Falas de cada slide

As falas são um guia, não um texto para decorar. O importante é a ideia de cada parágrafo.

### Slide 1 · Capa — Renan (20 s)
> Boa tarde. Nós somos a Kernel Panic: eu sou o Renan, este é o Gustavo e esta é a Francini. Construímos o FGR Leilões, um leilão online em tempo real, e ele está no ar agora neste endereço. Vamos responder três perguntas: como o sistema está montado na VM, quais foram as decisões mais difíceis e o que ficou de fora. Depois a demo é de vocês.

### Slide 2 · O que entregamos — Renan (25 s)
> Entregamos o Núcleo inteiro e o Nível 2 inteiro, do RF21 ao RF28 e o RF13. O sistema sobe do zero com um único comando, o `rodar.sh`, que é um dos itens do Bônus. E não pedimos que vocês acreditem na gente: temos 105 verificações automáticas, em quatro scripts que se comportam como o navegador, inclusive com WebSocket. O desafio do edital é manter o sistema correto quando muita gente age ao mesmo tempo e quando o tempo passa. É disso que vamos falar. Francini, a arquitetura.

### Slide 3 · Arquitetura na VM — Francini (35 s)
> São quatro contêineres no Docker Compose. A organização só expõe uma porta da VM, a 8080, que aparece como 8083 por fora. Nela fica o Nginx: ele entrega o React e repassa a API e o WebSocket. Assim o navegador fala com uma única origem, sem CORS e com cookie simples. A API, em Node com Fastify e Socket.IO, cuida de login, leilões e lances. Um worker separado, com o mesmo código, abre e fecha leilões a cada segundo. E o PostgreSQL é quem garante a consistência: trava a linha do leilão e avisa a API quando algo muda, com `pg_notify`, só depois do COMMIT. As fotos ficam num volume Docker, no disco da VM.

### Slide 4 · Por que essa arquitetura — Francini (30 s)
> Por que assim? Primeiro, uma porta só: o Nginx resolve isso e ainda elimina CORS. Segundo, e mais importante: tudo o que decide se um lance vale ou se um leilão fechou mora no Postgres, não na memória do Node. Por isso a API e o worker podem cair e voltar sem perder nada. Terceiro, cabe numa VM de 1 vCPU e 961 MB: os quatro contêineres rodam em cerca de 1 GB, com swap de margem para o build. O custo: mais uma peça para configurar, e as fotos ficam no disco da VM, sem réplica. O documento pedia nuvem, mas esse requisito foi corrigido para a VM; o código para S3 continua lá, é só trocar uma variável. Renan, as decisões difíceis.

### Slide 5 · Decisão 1: concorrência — Renan (40 s)
> A decisão mais difícil foi a concorrência, o centro do desafio. Escolhemos `SELECT ... FOR UPDATE` na linha do leilão: cada lance é uma transação, e lances simultâneos no mesmo leilão entram numa fila do próprio Postgres. Quando chega a vez de um lance, ele é validado com o lance mínimo daquele instante e com o relógio do banco lido depois da trava. Consideramos uma fila em memória, que quebra com mais de uma instância da API; o isolamento SERIALIZABLE, que obriga a repetir transações que falham; e Redis, que seria mais uma peça. O custo: os lances de um mesmo leilão são processados um por vez. Cada um leva poucos milissegundos, e leilões diferentes não se bloqueiam. O script dispara 8 lances iguais ao mesmo tempo e confere que só um é aceito. Gustavo, o tempo.

### Slide 6 · Decisão 2: tempo e reinício — Gustavo (35 s)
> A segunda decisão difícil foi o tempo. Um timer guardado na memória da API se perde quando o sistema reinicia. Então um worker separado roda a cada segundo dois UPDATEs condicionais, usando o relógio do banco: abre o que já devia ter aberto e fecha o que já passou do término. Como nada fica em memória, depois de um reinício o primeiro ciclo põe tudo em dia. E fechar duas vezes não duplica, porque o segundo UPDATE não encontra mais o leilão em andamento. O custo é até um segundo para a sala ver a mudança. Mas a regra não atrasa: o próprio lance compara com o término pelo relógio do banco, então nenhum lance é aceito depois do horário. Testamos derrubando a API e o worker com leilões abertos; o que terminou durante a queda fechou certo.

### Slide 7 · Decisão 3: a sala só mostra o que foi gravado — Gustavo (30 s, primeiro a cortar)
> A terceira decisão: a sala nunca pode mostrar um lance que não foi gravado. O aviso é um `pg_notify` dentro da transação, e o Postgres só entrega depois do COMMIT. Isso funciona com várias instâncias sem precisar de Redis. O lance vai por HTTP, então a resposta é explícita, com o motivo da recusa e o mínimo atual. Se a conexão cai, ao voltar a sala recebe o estado completo lido do banco. E o clique duplo não vira dois lances: o navegador gera uma chave por tentativa e o banco tem índice único. O custo: a presença na sala fica na memória da API. Com várias instâncias, ela teria que ir para o Redis ou para uma tabela. Francini, o que ficou de fora.

### Slide 8 · O que ficou de fora — Francini (35 s)
> O que ficou de fora. O Bônus de pontuação, habilitação e crédito: preferimos entregar o Núcleo e o Nível 2 inteiros, e o crédito com reserva mexeria justamente na transação do lance, a parte mais sensível. HTTPS com domínio não existe porque a organização expõe só HTTP numa porta. Várias instâncias da API: lances, fechamento e avisos já funcionariam, porque a coordenação está no Postgres; o que falta é tirar a presença da memória. Deploy automatizado, métricas e um teste de carga dedicado também ficaram de fora: os nossos scripts provam a concorrência, mas não o volume. E o e-mail é simulado, numa caixa de saída que só o operador vê. Gustavo, como provamos.

### Slide 9 · Como provamos — Gustavo (30 s)
> Para provar tudo isso, escrevemos quatro scripts que se comportam como o navegador, inclusive com WebSocket, e rodam contra o sistema no ar: 22 verificações do Núcleo, 33 do Nível 2, 26 da conta e 24 de queda do sistema, em que a gente derruba a API e o worker no meio de leilões e confere se sessões, salas, presença, fechamento e reenvio voltam corretos. E um aprendizado honesto: no sistema publicado, o lance não saía, porque o `crypto.randomUUID` só existe em HTTPS ou em localhost. Achamos, corrigimos e registramos. Agora a demo é de vocês: lances simultâneos, horário de término, reinício, o que quiserem.

---

## 3. Roteiro da demo

A banca executa os cenários e pode pedir que **qualquer um** conduza (seção 10.3). Todos devem saber os três cenários principais. Sugestão de papéis quando a banca não escolher:
- **Gustavo:** navegadores (lances, sala, telas).
- **Renan:** terminal na VM (reinício, logs, e-mails).
- **Francini:** narra "o que mostrar depois" e aponta cada garantia na tela.

### 3.0 Preparação

**Antes do pitch (com calma):**
1. Conferir que o sistema está no ar: abrir http://200.18.99.113:8083 e entrar com `bruno@demo.com` / `demo1234`.
2. Entrar na VM e deixar o terminal aberto na pasta do projeto:
   ```bash
   ssh -i ~/.ssh/hackathon -p 8023 ubuntu@200.18.99.113
   ```
   ```bash
   cd ~/hackathon-cati && git log -1 --oneline && docker compose ps
   ```
   Os 4 contêineres (`web`, `api`, `worker`, `db`) devem aparecer em execução. Confira que a VM está na `main` atualizada: o `./rodar.sh emails` só existe a partir da integração da conta do usuário.
3. **Abrir 4 sessões independentes** (o login fica num cookie, então cada pessoa precisa de um navegador ou perfil diferente):

   | Janela | Conta | Papel |
   |---|---|---|
   | Chrome normal | `ana@demo.com` | Comitente |
   | Chrome anônimo | `bruno@demo.com` | Comprador |
   | Firefox | `carla@demo.com` | Comprador |
   | Firefox privado ou celular | `diego@demo.com` | Comprador |

   Senha de todas: `demo1234`.
4. Ter **3 fotos** (JPEG, PNG ou WebP, até 5 MB) numa pasta fácil de achar. Todo leilão exige pelo menos 3.

**Logo antes da demo (cerca de 3 min antes):** os leilões "Em andamento" do seed foram criados quando o seed rodou e provavelmente já terminaram. Crie leilões novos como **Ana** ("+ Anunciar"):
- **Leilão A** (lances simultâneos e reinício): início daqui a 1 min, duração **20 min**, preço inicial R$ 100,00.
- **Leilão B** (horário de término): início daqui a 1 min, duração **2 min**, preço inicial R$ 100,00. Crie este por último, perto do cenário 2, para ele não acabar antes.

O início pode ser a partir de 30 s no futuro e a duração a partir de 1 min. O worker abre o leilão sozinho no horário.

### 3.1 Cenário: lances simultâneos (RF10, RF11, RF12)

**Conduzir:**
1. Bruno e Carla abrem a sala do **Leilão A**. Os dois entram como participantes (é o padrão).
2. Ana abre a mesma sala: ela entra como espectadora e a tela diz que o comitente não dá lances no próprio leilão (RF04, RF25).
3. Bruno e Carla digitam **o mesmo valor**: o lance mínimo mostrado na sala (R$ 100,00 no primeiro lance).
4. Alguém conta "3, 2, 1" e os dois clicam juntos.

**O que acontece:** só um lance é aceito. O outro recebe a recusa com o motivo e o novo lance mínimo: "O valor é menor que o lance mínimo atual." Se os cliques não forem exatamente juntos, o resultado é o mesmo, e esse é o ponto: quem chega primeiro tem prioridade e nunca entram dois.

**O que mostrar depois:**
- A sala dos três navegadores mostra **o mesmo estado**: preço, lance mínimo, total de lances, líder mascarado (ex.: "Br***r" para Bruno Comprador) e os últimos lances. Só existe um lance na lista.
- O vencedor da disputa vê "Você é o líder". Quem estava liderando e foi superado recebe o **aviso de lance superado** em qualquer página (RF26).
- Diego tenta um lance abaixo do mínimo: recusado com o motivo e o mínimo atual.
- O líder tenta dar outro lance: "Você já é o líder deste leilão."
- Contagem de participantes e espectadores na sala (RF25). Diego clica em "Só assistir" e a contagem muda; com "Quero participar", volta.
- **Prova com volume de concorrência** (opcional, do notebook): o script do Núcleo dispara 8 lances iguais ao mesmo tempo e confere que só 1 é aceito, além de reenvio e limite de frequência.
  ```bash
  cd api && BASE_URL=http://200.18.99.113:8083 npx tsx scripts/verificar.ts
  ```
  Atenção: o script cria usuários e leilões curtos de teste, que aparecem na listagem do sistema publicado.

**Explicar em uma frase:** "Cada lance trava a linha do leilão com `SELECT ... FOR UPDATE`; o segundo lance espera, vê o preço novo e é recusado. A sala só recebe o estado depois do COMMIT."

### 3.2 Cenário: horário de término e prorrogação (RF15, RF16, RF17)

**Conduzir:**
1. Bruno e Carla entram na sala do **Leilão B** (duração de 2 min).
2. Bruno dá um lance. Como faltam menos de 2 min, o término passa para **2 min depois do lance**: o relógio da sala "pula" para cima (prorrogação).
3. Carla responde; o término é prorrogado de novo.
4. Ninguém mais dá lance. Todos acompanham a contagem regressiva até zero.
5. No último segundo, ou logo depois do zero, alguém tenta dar um lance.

**O que acontece:** em até cerca de 1 s depois do término, a sala dos três mostra **Vendido**, com o vencedor mascarado e o valor final. Um lance que chega depois do horário é recusado: "O leilão já terminou." (ou "O leilão não está em andamento.", se o worker já fechou).

**O que mostrar depois:**
- O leilão saiu de "Em andamento" na listagem.
- Em **Minhas participações**, o vencedor aparece como vencedor e o outro como superado (RF27).
- No perfil público da Ana, o leilão aparece nos passados (RF22).
- Se a banca perguntar sobre a contagem na tela: ela é só visual. Quem decide é o relógio do banco; por isso um lance com "00:01" na tela pode ser recusado (RF16).
- A prorrogação tem teto de 30 min acumulados além do término original, então o leilão sempre termina.

**Explicar em uma frase:** "O worker fecha a cada segundo com um UPDATE condicional pelo relógio do banco, e o lance compara com o término pelo mesmo relógio; por isso nunca existe lance aceito depois do fechamento."

### 3.3 Cenário: reinício do sistema (RF18, RF24)

Se a banca quiser escolher como derrubar, deixe. As opções, da mais rápida para a mais lenta:

**Opção 1 — derrubar API e worker e deixar um leilão terminar com tudo fora do ar (a mais forte):**
1. Prepare um leilão curto que vá terminar **durante** a queda (duração 1 ou 2 min), com um lance dado. Deixe o **Leilão A** com lances e as salas abertas nos navegadores (Diego como espectador).
2. Na VM:
   ```bash
   docker compose stop api worker
   ```
3. Nos navegadores aparece "Conexão perdida. Reconectando… o estado será atualizado ao voltar." Uma tentativa de lance agora falha (o sistema está fora).
4. Espere o leilão curto passar do horário de término.
5. Religue:
   ```bash
   docker compose start api worker
   ```

**Opção 2 — reiniciar todos os contêineres:**
```bash
docker compose restart
```

**Opção 3 — reiniciar a VM** (`sudo reboot`). Demora mais com 1 vCPU. Os contêineres usam `restart: unless-stopped` e o Docker sobe no boot; a VM já foi reiniciada pela organização e o sistema voltou sozinho.

**O que mostrar depois:**
- Ninguém precisou fazer login de novo: a sessão está no banco, não na memória.
- As salas reconectaram sozinhas, **no mesmo modo** (Diego continua espectador), com o mesmo preço, líder e total de lances de antes (RF24, RF25).
- O leilão que terminou durante a queda fechou como **Vendido**, com o vencedor e o valor certos, e só uma vez (RF18). Um lance nele agora é recusado.
- Os lances continuam no **Leilão A** e chegam ao vivo aos outros; o aviso de lance superado volta a funcionar.
- `docker compose ps` mostra tudo de pé; `./rodar.sh logs` mostra o worker de volta ao ciclo.
- A versão automática deste cenário é o script de queda (24 verificações), que derruba API e worker no meio de leilões e confere sessões, salas, modos, presença, fechamento e reenvio. Ele roda onde está o Docker e precisa de Node.js: `./rodar.sh verificar-queda` (leva cerca de 3 min; está na branch `test/queda-do-sistema`, ainda não integrada à `main`).

**Explicar em uma frase:** "O worker não guarda nada em memória; ao voltar, o primeiro ciclo fecha o que passou do horário, e o UPDATE condicional garante que fechar duas vezes não duplica."

### 3.4 Cenário extra: a rede de um navegador cai (RF24)

O edital sugere: "derrubar a rede de um navegador por alguns segundos durante a disputa e religar".
1. No navegador da Carla, desligue a rede (DevTools › Network › Offline, ou o Wi-Fi) por uns 10 s.
2. Enquanto isso, Bruno dá lances.
3. Religue a rede da Carla.

**O que mostrar depois:** a sala da Carla volta sozinha com o estado atualizado (preço, líder, últimos lances), sem recarregar a página. Se a Carla tinha clicado em "dar lance" sem resposta, pode tentar de novo: a tela avisa que o mesmo lance não será duplicado (RF12).

### 3.5 Depois: o que mais queremos mostrar

Se sobrar tempo, em ordem de impacto:
1. **Esqueci minha senha com e-mail simulado:** na tela de login, "Esqueci minha senha" com `diego@demo.com`. Na VM, `./rodar.sh emails` mostra o e-mail com o link. Abrir o link, definir a senha nova e entrar. Lembrar: a resposta é a mesma exista ou não a conta, o link vale 30 min e uma vez, e todas as sessões da conta caem.
2. **Política de edição (RF23):** Ana abre o Leilão A (em andamento, com lances): só "Acrescentar à descrição"; o texto aparece na hora para quem está na sala. "Cancelar" não aparece, porque há lances.
3. **Relistagem (RF28):** num leilão Encerrado sem lances do seed ("Cadeira gamer reclinável"), Ana clica em "Relistar" com novo início e duração.
4. **Busca (RF21) e perfil público (RF22):** buscar sem acento e combinar filtros de categoria e estado; buscar "ana" em Comitentes e abrir o perfil.
5. **Upload malicioso:** tentar anunciar com um arquivo de texto renomeado para `.jpg`: é recusado, porque a foto é validada pelo conteúdo.

### 3.6 Se algo der errado

- **Página não abre:** na VM, `docker compose ps`. Se algo estiver parado, `docker compose up -d`.
- **Lance não sai:** conferir se o usuário está na sala **como participante** ("Quero participar") e se não é o líder ou o comitente.
- **O leilão criado não abre:** ele abre sozinho no horário de início; confira o horário e o fuso mostrado na tela.
- **Fala honesta é melhor que improviso:** se algo falhar, diga o que deveria acontecer, onde isso está no código e qual script prova.

---

## 4. Perguntas prováveis da banca

Respostas curtas. A versão longa está na seção 7 de [GUIA-DO-CODIGO.md](GUIA-DO-CODIGO.md); o "por quê" de cada decisão, em [DECISOES.md](DECISOES.md).

### Arquitetura
- **Por que essa arquitetura?** Uma porta só exposta: o Nginx serve o React e repassa API e WebSocket, sem CORS. O Postgres guarda tudo o que decide (travas, relógio, avisos), então API e worker podem cair e voltar. Sobe com `./rodar.sh` (D01, D38).
- **Por que Postgres com SQL à mão, sem ORM?** As garantias dependem de recursos do Postgres (`FOR UPDATE`, UPDATE condicional, `clock_timestamp()`, `pg_notify`, índice parcial). Com o SQL à vista, mostramos onde cada garantia mora (D03).
- **Por que TypeScript de ponta a ponta?** Uma linguagem para os três: qualquer um lê qualquer parte, e a banca pode chamar qualquer um (D02).
- **A VM de 961 MB aguenta?** Os quatro contêineres cabem em cerca de 1 GB; os 2 GB de swap são margem, principalmente para o build (D28).

### Concorrência
- **Dois lances iguais no mesmo instante?** O primeiro que trava a linha do leilão é aceito. O segundo, na vez dele, vê o preço novo e é recusado com o motivo e o mínimo atual. O script dispara 8 iguais e confere que só 1 entra (D08).
- **Por que não SERIALIZABLE ou fila em memória?** SERIALIZABLE obriga a repetir transações que falham; a fila em memória quebra com mais de uma instância (D08).
- **Lance chegando junto com o fechamento?** Os dois disputam a mesma trava de linha. Se o lance trava primeiro (antes do horário), entra e pode até prorrogar; se o fechamento trava primeiro, o lance vê o leilão encerrado e é recusado (D14).
- **Clique duplo ou rede caindo?** O navegador gera uma chave única por tentativa e reenvia a mesma chave. Se ela já existe, a API devolve o lance original (200 em vez de 201). Índice único no banco como segunda proteção (D10, D24).
- **Como impedem rajada de lances?** No mínimo 500 ms entre tentativas do mesmo usuário, controlado no banco. O reenvio da mesma chave é respondido antes e nunca é punido; um usuário não bloqueia outro (D11).
- **A sala pode mostrar um lance que não foi gravado?** Não. O aviso é um `pg_notify` dentro da transação, e o Postgres só entrega depois do COMMIT (D09).
- **Funciona com várias instâncias?** Lances, fechamento e avisos sim, porque a coordenação está no Postgres. A presença na sala fica em memória; com várias instâncias, iria para o Redis ou uma tabela (D33).
- **Quanto o sistema aguenta?** Não fizemos teste de carga dedicado. Cada transação de lance leva poucos milissegundos e leilões diferentes não se bloqueiam; os scripts provam a concorrência, não o volume.

### Tempo
- **Qual relógio vale?** O do banco (`clock_timestamp()`). A contagem na tela é só visual (D05).
- **E se reiniciar no meio de um leilão?** O worker não guarda nada em memória. Ao voltar, o primeiro ciclo abre e fecha o que estiver atrasado. Fechar duas vezes não duplica, porque o segundo UPDATE não encontra mais `status = 'LIVE'` (D14).
- **E se só o worker cair?** Nenhum lance é aceito depois do horário, porque o próprio lance compara com o término pelo relógio do banco. A sala só vê o "Vendido" quando o worker volta.
- **Por que um worker separado?** Um timer na memória da API se perde no reinício. O worker é um processo próprio, com o mesmo código, que só roda UPDATEs idempotentes (D14).
- **Como é a prorrogação?** Lance com menos de 2 min no relógio leva o término para 2 min depois dele; teto de 30 min acumulados além do término original. Tudo em variáveis de ambiente (D13).

### Regras e dados
- **Lance mínimo?** Sem lances, o preço inicial. Com lances, o preço atual mais o incremento da faixa da tabela do edital. Calculado só no servidor (D12).
- **Por que centavos?** Inteiros não têm erro de arredondamento; só a tela formata em R$ (D04).
- **O comitente pode cancelar logo depois de um lance?** O cancelamento é um único `UPDATE ... WHERE bid_count = 0`; a trava de linha decide quem vence. Cancelar nunca apaga nada (D20).
- **O que o comitente pode editar?** A tabela de referência do edital: tudo até 30 min antes do início; nada nos últimos 30 min; em andamento, só acrescentar texto à descrição (D32).
- **Um item com dois leilões ativos?** Impossível: índice único parcial no banco. Duas relistagens simultâneas: uma criada, a outra recusada (D19, D35).

### Segurança e conta
- **Senhas e sessões?** Senhas com `scrypt` e salt por usuário. Sessão: token aleatório em cookie `httpOnly`, só o hash no banco, 2h sem uso e renovação a cada requisição (D06, D07).
- **Por que não JWT?** JWT dificulta revogar e expirar no servidor (D06).
- **Upload malicioso?** A foto é validada pelos primeiros bytes, não pela extensão. O nome é gerado pelo servidor e a rota de fotos só aceita esse formato; `../../etc/passwd` responde 404 (D15).
- **Esqueci minha senha?** Link de uso único, 30 min, só o hash no banco, mesma resposta exista ou não a conta, todas as sessões caem ao redefinir. E-mail simulado: `./rodar.sh emails` (D41).

### Fotos e o que ficou de fora
- **Onde ficam as fotos?** No disco da VM, num volume Docker. O documento original pedia nuvem; o requisito foi corrigido para a VM. O código S3 continua pronto com `STORAGE_DRIVER=s3` (D29).
- **O que ficou de fora e por quê?** Ver o slide 8: Bônus de pontuação e crédito (RF29–RF32), HTTPS com domínio, várias instâncias, deploy automatizado, métricas, teste de carga, e-mail real e limpeza de fotos órfãs.

### Processo
- **Como provam que funciona?** Quatro scripts que imitam o navegador, inclusive o WebSocket: Núcleo (22), Nível 2 (33), conta (26) e queda do sistema (24), 105 verificações.
- **Qual foi o problema mais difícil de achar?** No publicado, o lance não saía: `crypto.randomUUID` só existe em HTTPS ou localhost, e a VM é HTTP pelo IP. Corrigimos com `crypto.getRandomValues()`. Lição: testar como o usuário acessa de verdade (D42).
- **Usaram IA?** Respondam com a verdade sobre como usaram. O ponto forte é que cada decisão está registrada com alternativas e custos em DECISOES.md, e todos estudaram o guia do código.
