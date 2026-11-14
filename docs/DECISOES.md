# Registro de decisões — Kernel Panic

Cada decisão traz o requisito que ela atende, o que escolhemos, por quê e o que custou.
As mais importantes vão para o README (seção 8 do edital) e para o pitch.

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

## D15 · Fotos: armazenamento S3, validação pelo conteúdo, entrega pela API
**Requisito:** RF07 (Decisão da equipe)
**Escolha:** usamos qualquer serviço compatível com S3 (endpoint configurável). A API recebe o upload em memória, nunca no disco. Aceitamos JPEG, PNG e WebP, **identificados pelos primeiros bytes do arquivo** e não pela extensão. São de 3 a 8 fotos de até 5 MB cada. O banco guarda só a chave do objeto. As fotos chegam ao navegador por `/api/photos/...`, que busca no armazenamento e repassa.
**Por quê:** checar o conteúdo impede que alguém envie um executável renomeado para `.jpg`. Repassar pela API funciona mesmo com bucket privado e com a VM expondo só a porta 8080.
**Custo:** o tráfego das fotos passa pela VM. Mitigamos com cache longo (as fotos não mudam).

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
**Interpretação:** "estar na sala" (RF10.1) = estar logado com a página da sala aberta.

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

## D22 · Armazenamento local para desenvolvimento
**Escolha:** em desenvolvimento usamos SeaweedFS (compatível com S3) num contêiner. As imagens oficiais do MinIO deixaram de ser distribuídas publicamente.
**Observação:** na VM **não** usamos armazenamento local, porque o RF07 proíbe fotos no disco da VM. Lá usamos o serviço de nuvem da organização.
