# Registro de decisões — Kernel Panic

Cada decisão traz o requisito que ela atende, o que escolhemos, por quê e o que custou.
As mais importantes vão para o README (seção 8 do edital) e para o pitch.

---

## Como rodar o projeto

### Pré-requisito: Docker
- **Fedora:** `bash scripts/instalar-docker-fedora.sh`. O script instala o Docker Engine e o Compose do repositório oficial, liga o serviço no boot e coloca o usuário no grupo `docker`. Depois, faça logout e login (ou rode `newgrp docker`) para usar `docker` sem `sudo`.
- **Ubuntu (VM):** `sudo apt-get install -y docker.io docker-compose-v2 && sudo usermod -aG docker $USER` (pacotes oficiais do Ubuntu, ver D28)

### Opção A: tudo em Docker na sua máquina
Sobe banco, API, worker e front. As fotos ficam no volume Docker `fotos`.
```bash
./rodar.sh                 # cria o .env, sobe tudo, espera ficar pronto e cria os dados de demo
```
Equivalente manual: `cp .env.example .env`, `docker compose up -d --build` e `docker compose exec api node dist/seed.js`.
Abra **http://localhost:8080** e entre com `bruno@demo.com` / `demo1234`. As outras contas estão no README.

Comandos do dia a dia:
```bash
docker compose ps                 # o que está rodando
docker compose logs -f api worker # logs ao vivo
docker compose restart worker     # reinicia só o worker (teste do RF18)
docker compose down               # para tudo (banco e fotos continuam nos volumes)
docker compose down -v            # para tudo e APAGA banco e fotos
```

### Opção B: na VM do hackathon
Os mesmos comandos da opção A. A chave privada fica em `~/.ssh/hackathon` com permissão `600`, **nunca** dentro do repositório (o `.gitignore` bloqueia).
```bash
ssh -i ~/.ssh/hackathon -p 8023 ubuntu@200.18.99.113
git clone https://github.com/renan-michelao/hackathon-cati.git && cd hackathon-cati
cp .env.example .env          # troque a senha do banco: openssl rand -hex 16
docker compose up -d --build
docker compose exec api node dist/seed.js
```
Para atualizar depois de novos commits: `cd ~/hackathon-cati && git switch main && git pull && docker compose up -d --build` (a VM ainda está na branch `feat/estrutura-base` do primeiro deploy).
Fica público em **http://200.18.99.113:8083**: a organização repassa a porta 8083 para a 8080 da VM.

### Opção C: desenvolvimento com recarga automática (sem Docker para o código)
Melhor para programar: cada alteração aparece na hora.
```bash
podman start kp-db                              # Postgres na porta 5433 (comando de criação no README)
cd api && npm install && npm run dev            # API :3000; fotos em api/data/fotos
cd api && npm run dev:worker                    # worker
cd web && npm install && npm run dev            # front :5173
```

### Problemas conhecidos (e já resolvidos)
- **`permission denied` ao rodar `docker`:** faltou entrar no grupo `docker` depois da instalação. Faça logout e login, rode `newgrp docker` ou use `sg docker -c "docker compose ..."`.
- **API "unhealthy" no compose:** no Alpine, `localhost` resolve para IPv6 (`::1`) e a API escuta em IPv4. O teste de saúde usa `127.0.0.1`.
- **`no configuration file provided`:** o comando rodou fora da pasta do projeto. Entre em `~/hackathon` (ou `~/hackathon-cati` na VM) antes.

### Conferir as garantias
```bash
cd api && BASE_URL=http://localhost:3000 npx tsx scripts/verificar-nivel2.ts   # requisitos de Nível 2
cd api && BASE_URL=http://localhost:8080 npx tsx scripts/verificar.ts   # contra o Docker (opção A)
cd api && BASE_URL=http://localhost:3000 npx tsx scripts/verificar.ts   # contra a opção C
```

---

## D01 · Arquitetura na VM
**Requisitos:** RNF01, RNF03, Bônus 7.2
**Escolha:** Docker Compose com 4 serviços: `web` (Nginx na porta 8080 servindo o React e repassando `/api` e `/socket.io`), `api` (Node.js), `worker` (Node.js, mesmo código, outro processo) e `db` (PostgreSQL).
**Por quê:** a organização só expõe a porta 8080 da VM (pública como `200.18.99.113:8083`). Com o Nginx na frente, o navegador fala com uma única origem: sem CORS e com cookies simples. Com o Compose, o ambiente sobe com um comando (`docker compose up -d`), o que atende o RNF03 e um item do Bônus.
**Custo:** mais uma peça (o Nginx) para configurar, incluindo o repasse de WebSocket.

## D02 · Stack: TypeScript de ponta a ponta
**Escolha:** API em Node.js 22 + Fastify + TypeScript; front em React + Vite + TypeScript.
**Por quê:** uma única linguagem para os 3 membros. Qualquer um consegue ler qualquer parte, e a banca pode chamar qualquer pessoa para responder. Fastify é leve e o Socket.IO se acopla ao mesmo servidor HTTP.
**Custo:** Node tem uma única thread, mas a carga pesada é do banco, então isso não limita aqui.

## D03 · Banco: PostgreSQL com SQL escrito à mão
**Requisitos:** RF11, RF17, RF18, RF19
**Escolha:** PostgreSQL acessado pelo driver `pg`, com SQL explícito, sem ORM.
**Por quê:** as garantias centrais (lances concorrentes, fechamento sem duplicar) dependem de recursos específicos do Postgres: `SELECT ... FOR UPDATE`, `UPDATE` condicional, `clock_timestamp()` e `pg_notify`. Com o SQL à vista, fica fácil mostrar e explicar para a banca exatamente onde cada garantia mora.
**Custo:** mais código repetitivo do que com um ORM.

## D04 · Dinheiro em centavos inteiros
**Requisito:** RF19
**Escolha:** todos os valores são `BIGINT` em centavos, tanto no banco quanto na API (`amountCents`). Só a tela formata para R$.
**Por quê:** inteiros não têm erro de arredondamento (0,1 + 0,2 ≠ 0,3 em ponto flutuante).

## D05 · Horários: relógio do banco, UTC no armazenamento, fuso de quem vê na tela
**Requisitos:** RF16, RF19
**Escolha:** colunas `TIMESTAMPTZ`; toda decisão de tempo (o lance chegou antes do fim? já é hora de abrir ou fechar?) usa `clock_timestamp()` do Postgres. A API devolve horários em ISO-8601 UTC junto com `serverNow`; o front calcula a diferença para o relógio local e exibe no fuso do navegador.
**Por quê:** existe uma única fonte de verdade para o tempo, mesmo com várias instâncias da API. A contagem regressiva na tela é só visual.
**Custo:** a contagem pode divergir em frações de segundo da decisão real, o que é esperado e aceito pelo RF16.

## D06 · Sessão: token opaco em cookie httpOnly, expiração deslizante de 2h
**Requisito:** RF02 (Decisão da equipe)
**Escolha:** no login, geramos um token aleatório de 256 bits e o enviamos num cookie `httpOnly` com `SameSite=Lax`. No banco fica só o hash SHA-256 do token. A sessão expira após **120 min sem uso** e **se renova a cada requisição** (configurável em `SESSION_TTL_MIN`).
**Por quê:** é simples de revogar (logout apaga a linha), o JavaScript da página não acessa o token (protege contra XSS) e quem está numa disputa não é deslogado no meio dela. Guardar o hash significa que um vazamento do banco não entrega sessões válidas.
**Custo:** uma consulta ao banco por requisição. Usamos JWT? Não: JWT dificulta revogar e expirar no servidor.

## D07 · Senhas com scrypt
**Escolha:** `crypto.scrypt` nativo do Node, com salt aleatório por usuário e comparação em tempo constante.
**Por quê:** é um algoritmo próprio para senhas e não precisa de dependência nativa, que costuma quebrar o build no Docker.

## D08 · Concorrência dos lances: trava de linha no Postgres
**Requisitos:** RF10, RF11
**Escolha:** cada lance roda numa transação que faz `SELECT ... FROM auctions WHERE id = $1 FOR UPDATE`. Lances simultâneos no mesmo leilão entram numa fila do próprio banco e são processados **um de cada vez, na ordem de chegada**. As validações (status, horário, comitente, líder, valor ≥ lance mínimo **vigente agora**) acontecem depois de obter a trava, com o relógio lido também depois da trava.
**Por quê:** é a forma mais simples de garantir que dois lances nunca sejam aceitos juntos, e continua correta com várias instâncias da API, porque a coordenação está no banco e não na memória do Node. Leilões diferentes não se bloqueiam entre si.
**Alternativas consideradas:** fila em memória por leilão (quebra com mais de uma instância) e isolamento `SERIALIZABLE` (exige repetir transações que falham, o que é mais complexo).
**Custo:** lances do mesmo leilão são sequenciais. Cada transação leva poucos milissegundos, então isso aguenta com folga o volume de uma demo.

## D09 · A sala só vê o lance depois do COMMIT
**Requisitos:** RF09, RF11
**Escolha:** a mudança é anunciada com `pg_notify` **dentro** da transação do lance. O Postgres só entrega a notificação depois do COMMIT. Cada instância da API escuta (`LISTEN`) e então lê o estado no banco e envia para a sala.
**Por quê:** é impossível a sala mostrar um lance que não foi gravado. Isso também funciona com várias instâncias da API sem precisar de Redis.

## D10 · Reenvio do mesmo lance (idempotência)
**Requisito:** RF12
**Escolha:** o navegador gera uma chave única (UUID) por tentativa de lance e a reenvia em caso de clique duplo ou falha de rede. O banco tem índice único em `(bidder_id, idempotency_key)`. Se a chave já existe, a API devolve o lance original com HTTP 200 em vez de 201.
**Detalhe:** a transação primeiro trava a linha do usuário. Assim, duas cópias simultâneas da mesma tentativa são serializadas e a segunda encontra a primeira já gravada. O índice único é uma segunda proteção.

## D11 · Limite de frequência: 500 ms por usuário
**Requisito:** RF13 (Decisão da equipe)
**Escolha:** no mínimo 500 ms entre tentativas do mesmo usuário (`BID_MIN_INTERVAL_MS`). O controle fica no banco (`users.last_bid_attempt_at`, com a linha travada), então vale para todas as instâncias. Um reenvio legítimo (mesma chave) é respondido antes dessa checagem e nunca é punido. Por ser por usuário, um usuário nunca bloqueia outro.

## D12 · Lance mínimo: tabela de referência do edital
**Requisito:** RF14 (Decisão da equipe)
**Escolha:** sem lances, o mínimo é o preço inicial. Com lances, é o preço atual mais o incremento da faixa (R$ 1 até R$ 99,99; R$ 5 até R$ 499,99; … R$ 500 a partir de R$ 25.000). O cálculo fica só no servidor (`rules.ts`) e depende só do estado do leilão.
**Por quê:** é previsível para quem dá lance e já foi validado pela organização.

## D13 · Prorrogação: 2 min, com teto de 30 min acumulados
**Requisito:** RF15 (Decisão da equipe)
**Escolha:** um lance aceito que deixe menos de 2 min no relógio leva o término para 2 min depois do lance, sem passar de término original + 30 min. Os valores ficam em `EXTENSION_WINDOW_SEC` e `EXTENSION_MAX_TOTAL_SEC`.
**Por quê:** dá a todos a chance de responder a um lance de último segundo e garante que o leilão termine.

## D14 · Abertura e fechamento: worker que lê o banco a cada 1 s
**Requisitos:** RF17, RF18
**Escolha:** um processo separado (`worker`) roda a cada segundo dois `UPDATE` condicionais:
`SCHEDULED → LIVE` onde `starts_at <= agora`, e `LIVE → SOLD / ENDED_NO_BIDS` onde `ends_at <= agora`.
**Por quê:**
- **Nada em memória:** depois de reiniciar, o primeiro ciclo abre e fecha tudo o que ficou para trás.
- **Idempotente:** a condição `WHERE status = 'LIVE'` faz um segundo fechamento não encontrar nada. Fechar duas vezes não duplica o resultado.
- **Sem fechar no meio de um lance:** o `UPDATE` disputa a mesma trava de linha do lance. Se um lance está sendo gravado, o fechamento espera e reavalia `ends_at`, que pode ter sido prorrogado. O lance que chega depois do fechamento vê `status ≠ LIVE` e é recusado.
**Custo:** até ~1 s de atraso para a sala *ver* a abertura ou o fechamento. A *regra* não atrasa: o lance compara com `ends_at` usando o relógio do banco, então nenhum lance é aceito depois do horário.

## D15 · Fotos: validação pelo conteúdo e entrega pela API
**Requisito:** RF07 (Decisão da equipe). O local de armazenamento está em D29.
**Escolha:** a API recebe o upload em memória e só grava o arquivo depois de validar tudo. Aceitamos JPEG, PNG e WebP, **identificados pelos primeiros bytes do arquivo** e não pela extensão. São de 3 a 8 fotos de até 5 MB cada. O nome do arquivo é gerado pelo servidor (`fotos/<uuid>.<ext>`) e o banco guarda só essa chave. As fotos chegam ao navegador por `/api/photos/...`, que aceita apenas chaves nesse formato, o que impede ler outros arquivos do servidor (ex.: `../../etc/passwd` responde 404).
**Por quê:** checar o conteúdo impede que alguém envie um executável renomeado para `.jpg`. Gerar o nome no servidor evita colisões e nomes maliciosos.
**Custo:** o tráfego das fotos passa pela API. Mitigamos com cache longo no navegador (as fotos não mudam).

## D16 · Identificação do líder sem expor o nome
**Requisito:** RF09 (Decisão da equipe)
**Escolha:** mostramos as 2 primeiras letras, `***` e a última letra do nome de exibição (ex.: "Renan Michelão" → "Re***o"). A sala mostra os **10 últimos lances** (`RECENT_BIDS_SHOWN`). O front compara `leaderId` com o próprio id para mostrar "Você é o líder".

## D17 · Listagem pública
**Requisito:** RF20 (Decisão da equipe)
**Escolha:** a página inicial mostra os leilões Em andamento primeiro (os que terminam antes no topo) e depois os Agendados (os que começam antes no topo). É paginada (20 por página) para funcionar com muitos leilões. A API já aceita busca por nome (sem diferenciar acentos, via `unaccent`), categoria e estado, adiantando o RF21.

## D18 · Limites e categorias
**Requisitos:** RF05, RF06 (Decisão da equipe)
**Escolha:** todos os limites são variáveis de ambiente (`LIMIT_*`). Os valores padrão:

| Limite | Valor |
|---|---|
| Nome | 3–120 caracteres |
| Descrição | 10–5000 caracteres |
| Fotos | 3–8, até 5 MB cada |
| Antecedência do início | 30 s a 30 dias |
| Duração | 1 min a 7 dias |
| Preço inicial | R$ 1,00 a R$ 100 milhões |

As categorias são uma lista fixa de 10: Eletrônicos, Informática, Casa e Decoração, Moda, Esportes, Colecionáveis, Arte, Livros, Veículos e Outros.
**Por quê:** permitem a demo com leilões curtos (abrir em 1 min e durar 3) sem mudar código.

## D19 · Um item, um leilão ativo
**Requisito:** RF28
**Escolha:** índice único parcial `auctions(item_id) WHERE status IN ('SCHEDULED','LIVE')`. Quem garante a regra é o banco, mesmo sob concorrência.

## D20 · Cancelamento atômico
**Requisito:** RF08
**Escolha:** um único `UPDATE ... WHERE seller_id = eu AND (status = 'SCHEDULED' OR (status = 'LIVE' AND bid_count = 0))`. Se um lance entrar no mesmo instante, a trava de linha garante que ou o lance entra e o cancelamento falha, ou o cancelamento entra e o lance é recusado. Nada é apagado: o estado vira `CANCELLED`.

## D21 · Lances por HTTP, estado da sala por WebSocket
**Requisitos:** RF09, RF10, RF24
**Escolha:** o lance é um `POST /api/auctions/:id/bids` (resposta imediata e explícita com o motivo da recusa e o lance mínimo atual). O estado da sala chega por Socket.IO. Ao reconectar, o cliente entra de novo na sala e recebe o estado completo lido do banco.
**Por quê:** com HTTP, validar sessão, aplicar idempotência e mostrar o erro ficam triviais. A reconexão automática do Socket.IO mais o "estado completo a cada entrada" resolvem o RF24 sem precisar reconstruir eventos perdidos.
**Interpretação:** "estar na sala" (RF10.1) = ter a sala aberta, conectada pelo Socket.IO, **como participante**. Isso passou a ser verificado no servidor a partir da D33.

## D23 · Front: React como página única (SPA) servida pelo Nginx
**Escolha:** React + Vite + Tailwind, compilado em arquivos estáticos que o Nginx serve. Não usamos Next.js nem renderização no servidor.
**Por quê:** o front não precisa de SEO nem de servidor próprio. Os arquivos estáticos ficam no mesmo Nginx que já repassa a API, então é um processo a menos na VM.

## D24 · Reenvio seguro no navegador
**Requisito:** RF12
**Escolha:** a chave de idempotência é gerada no clique e **reaproveitada** enquanto não houver uma resposta definitiva (falha de rede ou sessão expirada). Ela só é descartada quando o servidor responde aceito ou recusado. A tela avisa: "Tente de novo: o mesmo lance não será duplicado."

## D25 · Aviso de lance superado
**Requisito:** RF26 (Nível 2)
**Escolha:** a sala compara o líder anterior com o novo a cada `auction:state`. Se eu era o líder e deixei de ser, aparece um aviso com o novo lance mínimo. Funciona para quem está com a sala aberta.

## D26 · Listagem atualizada ao vivo
**Escolha:** usuários logados recebem `listing:changed` pelo WebSocket e a lista é recarregada, no máximo uma vez a cada 0,5 s. Visitantes recarregam a cada 10 s, porque a conexão em tempo real exige login.

## D22 · ~~Armazenamento S3 local para desenvolvimento~~ (substituída pela D29)
Usávamos SeaweedFS (compatível com S3) num contêiner. Com a D29, as fotos vão para uma pasta e o SeaweedFS saiu do projeto.

## D27 · O mesmo docker compose para a máquina local e para a VM
**Requisito:** RNF03
**Escolha:** um único `docker-compose.yml` e um único `.env.example`, usados igualmente no computador e na VM.
**Por quê:** o que testamos localmente é o mesmo arquivo que roda na VM, então descobrimos problemas de build e rede antes de publicar (foi assim que achamos o problema do teste de saúde em IPv6).

## D28 · Preparação da VM (1 vCPU, 961 MB de RAM)
**Requisito:** RNF01
**Situação:** Ubuntu 24.04, 1 vCPU, 961 MB de RAM e 19 GB de disco. O usuário `ubuntu` tem `sudo` sem senha.
**Escolha:**
- **Swap de 2 GB** (`/swapfile`, persistente no `/etc/fstab`). Compilar o front e a API com `npm` pode passar de 1 GB de RAM; sem swap, o kernel mataria o build.
- **Docker dos pacotes do Ubuntu** (`docker.io` e `docker-compose-v2`). Vêm do repositório oficial da distribuição, sem precisar adicionar um repositório de terceiros nem rodar script baixado da internet como root.
- **Build na própria VM** (`docker compose up -d --build`). Prova o RNF03: o ambiente se recria do zero só com o repositório e o `.env`.
- **`.env` da VM criado lá mesmo**, com senha do banco aleatória (`openssl rand -hex 16`) e permissão `600`. A senha nunca passa pelo Git nem pelo chat.
**Custo:** o primeiro build é lento (1 CPU). Os seguintes reaproveitam o cache do Docker.
**Memória em uso:** Postgres, API, worker e Nginx juntos cabem com folga em ~1 GB; o swap é só a margem de segurança.
**Verificado no endereço público (14/11, ~15h):** o script de verificação passou em 19 de 19; o lance de outro usuário chegou ao vivo na sala (o WebSocket atravessa o repasse de porta da organização); depois de `docker compose restart`, tudo voltou sozinho, o worker retomou o ciclo e os lances continuaram no banco. Os contêineres usam `restart: unless-stopped` e o Docker sobe no boot, então o sistema também volta se a VM reiniciar.

## D29 · Fotos no disco da VM (correção do RF07)
**Requisito:** RF07
**Contexto:** o documento pedia as fotos num armazenamento em nuvem fornecido pela organização, nunca no disco da VM. O líder da equipe (Renan) informou que esse requisito está errado e que **as imagens devem ficar na própria VM**.
**Escolha:** as fotos são gravadas como arquivos numa pasta (`/data/fotos` dentro do contêiner da API), montada num **volume Docker nomeado** (`fotos`). A API grava num arquivo temporário e renomeia, então nunca existe uma foto pela metade. O código de S3 continua disponível com `STORAGE_DRIVER=s3`, caso o requisito volte a valer.
**Por quê:**
- **Mais simples e mais leve:** removemos o SeaweedFS, um processo a menos numa VM de 961 MB de RAM.
- **Durável:** o volume sobrevive a `docker compose restart`, a rebuilds e a reinícios da VM; só `docker compose down -v` apaga.
- **Seguro:** a pasta só é lida pela rota `/api/photos/`, que aceita apenas chaves `fotos/<uuid>.<ext>` geradas pelo servidor.
**Custo:** as fotos ocupam o disco da VM (17 GB livres; com 8 fotos de 5 MB por leilão, cabem ~400 leilões cheios) e não ficam replicadas. Também não dá para rodar mais de uma instância da API em máquinas diferentes sem um armazenamento compartilhado, mas várias instâncias na mesma VM podem montar o mesmo volume.
**Verificado:** localmente, o script de verificação passou em 19 de 19; as 21 fotos do seed foram gravadas no volume e continuaram acessíveis depois de reiniciar a API; a tentativa de ler `../../etc/passwd` respondeu 404.

## ~~Pendência P01 · Armazenamento de fotos na VM~~ (resolvida pela D29)
Antes, a VM rodava provisoriamente com o SeaweedFS para contornar a falta de credenciais de nuvem. Com a correção do RF07, gravar as fotos na VM passou a ser o comportamento correto, e o SeaweedFS saiu.

## D30 · Perfil público e busca de comitentes
**Requisito:** RF22
**Escolha:** `GET /api/users?q=` busca pelo nome de exibição sem diferenciar acentos e maiúsculas (`unaccent` + `ILIKE`). `GET /api/users/:id` mostra nome, data de entrada e os leilões separados em agendados, em andamento e passados. Em "passados" entram Vendido, Encerrado sem lances e Cancelado.
**Por quê:**
- **Só aparece quem já anunciou:** o requisito fala em buscar *comitentes*, e quem nunca anunciou não é comitente. Isso também evita expor a lista de todos os usuários cadastrados.
- **Cancelados aparecem nos passados:** dá transparência sobre o histórico do comitente sem criar reputação, que o requisito proíbe.
- **O e-mail nunca sai na resposta.**

## D31 · Minhas participações
**Requisito:** RF27
**Escolha:** `GET /api/me/participations` lista os leilões em que dei lance, com o meu maior lance e uma `situation`: `leader` (em andamento e sou o líder), `winner` (vendido para mim) ou `outbid` (alguém passou meu lance, ou o leilão terminou com outro vencedor). Os em andamento aparecem primeiro, depois os mais recentes.
**Por quê:** tudo vem de uma única consulta agregada sobre `bids`, sem tabela extra. A situação é derivada do estado do leilão, então nunca fica desatualizada.

## D32 · Política de edição e cancelamento
**Requisito:** RF23 (Decisão da equipe)
**Escolha:** adotamos a tabela de referência do edital, com o limite de 30 min configurável em `EDIT_LOCK_MIN`:

| Situação | Edição | Cancelamento |
|---|---|---|
| Agendado, faltando mais de 30 min | Todos os campos, incluindo trocar as fotos | Sim |
| Agendado, faltando 30 min ou menos | Nenhuma | Sim |
| Em andamento, sem lances | Só acrescentar texto à descrição | Sim |
| Em andamento, com lances | Só acrescentar texto à descrição | Não |
| Vendido, Encerrado sem lances, Cancelado | Nenhuma | Não |

**Como:** `PATCH /api/auctions/:id` trava a linha do leilão e decide a política com o relógio do banco (`rules.editPolicy`). Assim um lance ou a abertura automática não acontecem no meio de uma edição. O texto acrescentado entra como "— Atualização do comitente: …" no fim da descrição e chega na hora a quem está na sala. O detalhe do leilão informa `editPolicy`, `canCancel` e `canRelist` para o front mostrar só os botões possíveis; o servidor revalida em cada ação.
**Por quê:** acrescentar texto não muda preço, horário nem o item, então não prejudica quem já deu lance. Travar a edição 30 min antes do início protege quem já se programou para o leilão.
**Custo:** se o comitente errar algo grave com o leilão em andamento, só resta cancelar (se ainda não houver lances).

## D33 · Espectador, participante e presença na sala
**Requisitos:** RF25, RF10.1
**Escolha:** ao entrar (`room:join`) o usuário escolhe `participant` (padrão) ou `spectator` e pode trocar com `room:mode` sem sair. **O comitente sempre entra como espectador.** A sala recebe `room:presence` com quantos participantes e espectadores estão nela, contando **pessoas**, não abas: quem tem ao menos uma aba como participante conta como participante. O servidor só aceita lance de quem está na sala como participante (`NOT_IN_ROOM`).
**Detalhe importante:** a checagem de presença vem **depois** da checagem de reenvio. Se a conexão cair e o navegador reenviar um lance já gravado, a resposta continua sendo o lance original (RF12).
**Custo:** a presença fica na memória da instância da API. Com várias instâncias, ela teria de ir para um lugar compartilhado (Redis ou uma tabela). Registramos isso como limitação conhecida, porque hoje rodamos uma instância.

## D34 · Aviso de lance superado pelo servidor
**Requisito:** RF26
**Escolha:** quando um lance é aceito, a mesma transação faz `pg_notify('user_events', …)` para o líder anterior. Cada socket conectado entra numa sala pessoal (`user:<id>`), e a API repassa como `user:outbid`, com o nome do item e o novo lance mínimo.
**Por quê:** o aviso só sai depois do COMMIT, então ninguém é avisado de um lance que não existiu. Chega em qualquer página do site, não só na sala. Funciona com várias instâncias, pelo mesmo mecanismo da D09. (A sala também mostra o aviso localmente, como na D25.)

## D35 · Relistagem
**Requisito:** RF28
**Escolha:** `POST /api/auctions/:id/relist`, a partir de um leilão Encerrado sem lances ou Cancelado, cria um **novo** leilão para o **mesmo item**. O antigo continua registrado como estava. Início e duração são obrigatórios (os antigos já passaram); nome, descrição, categoria, preço e fotos são opcionais, e o que não vier é mantido.
**Por quê:** guardar o histórico completo é o que o RF08 já pede para cancelamentos. A regra "um item nunca tem dois leilões ativos" fica no índice único parcial do banco (D19), então duas relistagens simultâneas resultam em uma criada e outra recusada (`ALREADY_ACTIVE`). O script de verificação testa exatamente esse caso.
**Custo:** nome, descrição e fotos pertencem ao item. Editá-los na relistagem também muda como o leilão antigo aparece. Aceitamos isso para manter o modelo simples (item → vários leilões).

## D36 · Cliente de teste que imita o navegador
**Escolha:** `api/scripts/cliente.ts` é usado pelos dois scripts de verificação. Ele faz HTTP com o cookie de sessão e conecta o Socket.IO para entrar nas salas e receber eventos, como o front faz.
**Por quê:** as garantias do Nível 2 (presença, avisos, estado em tempo real) só podem ser provadas com uma conexão em tempo real de verdade. Hoje são 22 verificações do Núcleo e 33 do Nível 2, que passam tanto direto na API quanto pelo Nginx do Docker.

## D37 · Front do Nível 2
**Requisitos:** RF22, RF23, RF25, RF26, RF27, RF28
**Escolha:**
- **Uma conexão de tempo real por aba** (`SocketProvider`), compartilhada pela listagem, pela sala e por "Minhas participações". Antes, cada página abria a sua. Assim o aviso de lance superado (RF26) chega em **qualquer página**, com um link "Ver sala".
- **Avisos globais** (`ToastProvider`) para lance aceito ou recusado, edição salva e lance superado, no lugar dos avisos locais de cada página.
- **Os botões seguem a política que vem da API:** a sala mostra "Editar" (agendado com mais de 30 min), "Acrescentar à descrição" (em andamento), "Cancelar" e "Relistar" conforme `editPolicy`, `canCancel` e `canRelist`. A tela de edição muda sozinha: formulário completo, só um campo para acrescentar texto, ou uma mensagem explicando por que não dá para editar. O servidor revalida tudo; o front só evita oferecer o que vai ser recusado.
- **Um formulário só** (`AuctionForm`) para criar, editar e relistar. Editar e relistar começam preenchidos; as fotos são opcionais e, se enviadas, substituem as atuais.
- **Sala:** contagem de participantes e espectadores, botões "Só assistir" e "Quero participar" (RF25), descrição atualizada ao vivo e link para o perfil do comitente. Ao reconectar, a sala volta no modo que o usuário tinha escolhido.
- **Páginas novas:** Comitentes (busca), Perfil público e Minhas participações, que se atualiza sozinha quando algum leilão muda.
**Verificado no navegador (localhost):** acrescentar texto, editar o preço de um agendado, relistar um encerrado sem lances, alternar entre espectador e participante, aviso de lance superado recebido na página de Comitentes, busca sem acento, perfil e participações.

## D38 · Um único comando para subir tudo
**Requisitos:** RNF03, Bônus 7.2 ("todo o ambiente sobe com um único comando")
**Escolha:** `./rodar.sh`, na raiz do projeto. Ele:
1. confere se o Docker está instalado e acessível e, se o usuário ainda não estiver no grupo `docker`, usa `sudo`;
2. cria o `.env` a partir do `.env.example` na primeira vez, com uma senha aleatória para o banco e permissão `600`;
3. roda `docker compose up -d --build`, espera `/api/health` responder (até 3 min) e roda o seed, que não duplica dados.
Também tem `parar`, `logs`, `status` e `verificar` (as 55 verificações automáticas).
**Proteção:** se existir um banco de uma execução anterior mas o `.env` tiver sumido, o script **para** em vez de gerar uma senha nova, que não abriria o banco existente. Ele explica as duas saídas: restaurar o `.env` ou apagar o volume.
**Verificado:** num clone limpo do repositório, `./rodar.sh` levou do zero ao sistema no ar em ~12 s (com as camadas do Docker já em cache) e `./rodar.sh verificar` passou nas 55 verificações. Também testamos a proteção do `.env` e as mensagens de "sem permissão no Docker" e "comando desconhecido".

## D39 · Integração do novo design e refinamento
**Contexto:** o time redesenhou a listagem, os cards, o cabeçalho e as telas de login e cadastro com o nome **FGR Leilões** (nome fictício escolhido pelo grupo). Integramos esse trabalho na `main` com as demais branches.
**Escolha 1 — nada de dado inventado na tela.** Alguns elementos visuais mostravam números fixos no código como se fossem reais. Trocamos cada um por um dado verdadeiro ou o removemos:

| Antes | Depois |
|---|---|
| Cabeçalho com "Crédito R$ 8.500 / 72 XP / Nível Comitente" para qualquer usuário | "Ver meu perfil" (o Bônus de pontuação e crédito não está implementado) |
| Botão "Quero Vender" com habilitação fictícia (RF30) | Removido; "+ Anunciar" leva direto ao formulário (no Núcleo, todo usuário anuncia) |
| "N participantes assistindo" no card (conta inventada) | Nome do comitente, com link para o perfil (RF22) |
| "Fotos: 1/3", carrossel e favorito que não salvava | Removidos |
| Abas com "(12)", "(5)", "(15)" fixos | Total real da aba selecionada, vindo da API |
| "Horário de Brasília" | Removido (os horários são exibidos no fuso de quem vê, RF19) |
| "Permanecer conectado", botão "?" e rodapé de copyright | Removidos; uma linha explica que é uma simulação |

**Por quê:** a banca testa o sistema e pergunta sobre o código. Um número fixo apresentado como real é pior do que não mostrar o número, e o pitch já tem espaço para "o que ficou de fora".

**Escolha 2 — filtro por comitente no servidor.** O filtro da Home filtrava só a página carregada (20 itens), então deixava de achar leilões nas outras páginas. Agora `GET /api/auctions?sellerName=` filtra no banco, sem diferenciar acentos, e funciona com a paginação.

**Escolha 3 — um visual só.** A cor da marca (`brand-*`) passou a ser o índigo do design do time, e os componentes reutilizáveis (`card`, `btn-*`, `input`, `label`) ganharam os mesmos cantos arredondados. Assim a sala, os formulários, o perfil e "Minhas participações" combinam com a Home sem precisar reescrever cada tela. As telas de login, que usavam azul, também passaram para o índigo.

**Escolha 4 — navegação completa, inclusive no celular.** O menu tinha perdido "Leilões" e "Comitentes" e ficava escondido no celular. Agora tem os quatro itens e, no celular, aparece numa linha com rolagem lateral; o cabeçalho caiu de 175 px para cerca de 115 px.

## D40 · Minha conta: apelido, senha, foto e saída
**Escolha:** o perfil do **próprio** usuário mostra um painel "Minha conta" com o e-mail (só ele vê), a data de entrada, a troca de apelido, a troca de senha, a foto de perfil e o botão "Sair da conta". O "Sair" deixou o cabeçalho, que agora só leva à conta pelo avatar. Para os outros usuários, o perfil continua público (sem e-mail). "Minhas participações" continua numa página própria.
**Regras:**
- **Apelido:** de 2 a 60 caracteres. Nas salas, o líder continua mascarado (D16), já com o apelido novo, porque o nome é lido na hora.
- **Troca de senha:** exige a senha atual. Se ela estiver errada, a API responde `400 WRONG_PASSWORD`, e não `401`: no front, `401` significa "sessão expirada". Depois da troca, **as sessões em outros navegadores caem** e a sessão de quem trocou continua.
- **Foto de perfil:** as mesmas regras das fotos dos itens (JPEG, PNG ou WebP validados pelo conteúdo, até 5 MB, gravados no volume `fotos`, D15/D29). Sem foto, aparece a inicial. A foto também aparece no perfil público e na busca de comitentes.
**Custo:** quando a foto é trocada, o arquivo antigo fica no disco sem uso. Aceitamos isso pela simplicidade; uma limpeza periódica resolveria.

## D41 · Esqueci minha senha com e-mail simulado
**Escolha:** o usuário informa o e-mail e recebe um **link de uso único, válido por 30 min** (`PASSWORD_RESET_TTL_MIN`). Como o projeto não tem serviço de e-mail, a mensagem vai para uma **caixa de saída simulada** (tabela `email_outbox` e log da API), que só quem opera o servidor lê: `./rodar.sh emails`. Para usar um SMTP de verdade, só a função `sendEmail` (`api/src/mailer.ts`) muda.
**Segurança:**
- A resposta é **sempre a mesma**, exista ou não a conta, para não revelar quais e-mails estão cadastrados.
- O banco guarda só o **hash** do token (como nas sessões, D06). Quem lê a tabela não consegue usar o link.
- No máximo **um link por minuto** por conta, para impedir que o formulário seja usado para lotar a caixa de alguém.
- Ao redefinir, o link e qualquer outro pendente da conta são invalidados, e **todas as sessões da conta caem**.
- A validação do link trava a linha (`FOR UPDATE`): dois cliques simultâneos no mesmo link não redefinem duas vezes.
**Na demo:** pedir o link na tela, mostrar o e-mail com `./rodar.sh emails`, abrir o link e entrar com a senha nova.
**Verificado:** `api/scripts/verificar-conta.ts` cobre a conta e a redefinição com 26 verificações, todas aprovadas. Também testamos no navegador: foto, apelido, sair, pedido do link e redefinição.
