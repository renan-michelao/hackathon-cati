# FGR Leilões

Plataforma de leilão online em tempo real, feita pela equipe **Kernel Panic** (Renan, Gustavo e Francini) no Hackathon Cati Jr.
É uma simulação: nenhuma transação é real.

**Sistema publicado:** http://200.18.99.113:8083

## Contas de demonstração

Senha de todas: `demo1234`

| E-mail | Papel |
|---|---|
| `ana@demo.com` | Comitente (dona dos leilões de demonstração) |
| `bruno@demo.com` | Comprador |
| `carla@demo.com` | Comprador |
| `diego@demo.com` | Comprador |

Os dados de demonstração incluem leilões nos 5 estados: Em andamento (com e sem lances), Agendado (abre em 2 min e em 1 dia), Vendido, Encerrado sem lances e Cancelado.

## Arquitetura

```
Navegador ──HTTP/WebSocket──▶ web (Nginx :8080) ──▶ api (Node.js :3000) ──▶ db (PostgreSQL)
                                  └─ arquivos do React                          ▲
                                                         worker (Node.js) ──────┘
                                                         api ──▶ volume "fotos" no disco da VM
```

- **web:** Nginx na porta 8080 (a única exposta pela VM). Serve o React e repassa `/api` e `/socket.io` para a API.
- **api:** Fastify + Socket.IO. Cuida de login, leilões, lances e da sala em tempo real.
- **worker:** abre e fecha leilões a cada segundo usando o relógio do banco.
- **db:** PostgreSQL. Garante a consistência dos lances com trava de linha e avisa as mudanças por `LISTEN/NOTIFY`.
- **Fotos:** arquivos no disco da VM, num volume Docker (`fotos`), entregues pela API. Ver D29 em `docs/DECISOES.md`.

## Como recriar o ambiente do zero

Pré-requisito: Docker com Docker Compose.

```bash
git clone https://github.com/renan-michelao/hackathon-cati.git
cd hackathon-cati
./rodar.sh
```

O `rodar.sh` faz tudo com um comando: cria o `.env` com uma senha aleatória para o banco (só na primeira vez), constrói e sobe os contêineres, espera o sistema responder, cria os dados de demonstração (sem duplicar) e mostra o endereço. Outros usos:

| Comando | O que faz |
|---|---|
| `./rodar.sh parar` | Para os contêineres (banco e fotos continuam guardados) |
| `./rodar.sh logs` | Acompanha os logs da API e do worker |
| `./rodar.sh status` | Mostra o que está rodando |
| `./rodar.sh verificar` | Roda as 55 verificações automáticas contra o sistema no ar (precisa de Node.js) |

Sem o script, o equivalente manual é: `cp .env.example .env` (e trocar a senha), `docker compose up -d --build` e `docker compose exec api node dist/seed.js`.

O sistema fica em `http://<ip-da-vm>:8080`. Na VM do hackathon, a porta 8080 é publicada como `http://200.18.99.113:8083`.

### Desenvolvimento local

```bash
# banco local
podman run -d --name kp-db -e POSTGRES_USER=leilao -e POSTGRES_PASSWORD=leilao -e POSTGRES_DB=leilao -p 5433:5432 postgres:16-alpine

# API e worker (em terminais separados)
cd api && npm install
export DATABASE_URL=postgres://leilao:leilao@localhost:5433/leilao   # fotos vão para api/data/fotos
npm run dev            # API em :3000
npm run dev:worker     # worker
npm run seed:dev       # dados de demonstração

# front
cd web && npm install && npm run dev   # http://localhost:5173
```

### Verificação automática das garantias

```bash
cd api && BASE_URL=http://localhost:3000 npx tsx scripts/verificar.ts
```

O script cria usuários e um leilão curto, entra na sala pelo Socket.IO como o navegador, dispara 8 lances simultâneos de mesmo valor (só 1 pode ser aceito), testa o reenvio do mesmo lance, o limite de frequência, as permissões do comitente e do líder e a prorrogação (22 verificações).

```bash
cd api && BASE_URL=http://localhost:3000 npx tsx scripts/verificar-nivel2.ts
```

O segundo script cobre o Nível 2 (33 verificações): edição conforme a situação do leilão, relistagem (inclusive duas simultâneas), perfil público, modo espectador, contagem de presença, aviso de lance superado e "Minhas participações".

## Limites configuráveis

Todos ficam no `.env` (veja `.env.example`). Para a demo, use leilões curtos: o início pode ser a partir de 30 s no futuro e a duração a partir de 1 min.

## Decisões da equipe

O registro completo, com alternativas e custos, está em [docs/DECISOES.md](docs/DECISOES.md). Resumo:

| Requisito | Decisão | Por quê |
|---|---|---|
| RF02 Sessão | Token aleatório em cookie `httpOnly`; expira após 2h sem uso e se renova a cada requisição | Revogável no servidor e inacessível ao JavaScript; ninguém é deslogado no meio de uma disputa |
| RF05/RF06 Limites | Nome 3–120 caracteres; descrição 10–5000; 3–8 fotos; início de 30 s a 30 dias; duração de 1 min a 7 dias; 10 categorias fixas | Todos em variáveis de ambiente, o que permite leilões curtos na demo |
| RF07 Fotos | JPEG/PNG/WebP de até 5 MB, validados pelo conteúdo do arquivo; gravados no disco da VM (volume `fotos`); entrega via API | Um arquivo renomeado não passa; mais simples e leve numa VM de 1 GB (o RF07 foi corrigido pela equipe, ver D29) |
| RF09 Sala | Socket.IO; últimos 10 lances; líder mascarado ("Re***o") | Reconexão automática e nome nunca exposto por completo |
| RF11 Concorrência | `SELECT ... FOR UPDATE` na linha do leilão + aviso por `pg_notify`, entregue só após o COMMIT | Lances do mesmo leilão entram em fila no banco; correto mesmo com várias instâncias |
| RF12 Reenvio | Chave única por tentativa, gerada no navegador, com índice único no banco | Clique duplo ou falha de rede devolvem o lance original |
| RF13 Frequência | Mínimo de 500 ms entre tentativas do mesmo usuário, controlado no banco | Um usuário não bloqueia outro e reenvios legítimos não são punidos |
| RF14 Lance mínimo | Tabela de incrementos de referência do edital | Previsível e calculada só no servidor |
| RF15 Prorrogação | Lance com menos de 2 min no relógio leva o término para 2 min depois dele; teto de 30 min acumulados | Todos têm chance de resposta e o leilão sempre termina |
| RF17/RF18 Tempo | Worker a cada 1 s com `UPDATE` condicional usando o relógio do banco | Nada em memória: sobrevive a reinícios e fechar duas vezes não duplica |
| RF20 Listagem | Em andamento primeiro (termina antes no topo), depois agendados; 20 por página; busca e filtros | Destaca o que está acontecendo agora e aguenta muitos leilões |
| RNF01 VM | Docker Compose: Nginx, API, worker e Postgres | Sobe com um comando e cabe na única porta exposta |
