# Contrato da API

Combinado entre front, back e infra. Base: `/api`. Valores em **centavos** (inteiros). Horários em ISO-8601 UTC.
A sessão vai no cookie `sid` (httpOnly), que o navegador envia sozinho.

## Erros

```json
{ "error": "CODIGO", "message": "Texto para mostrar ao usuário" }
```
`400` validação · `401` sem sessão · `404` não existe · `409` conflito de regra · `429` limite de frequência

## Contas

| Método | Rota | Corpo | Resposta |
|---|---|---|---|
| POST | `/api/auth/register` | `{ displayName, email, password }` | `201 { user }` + cookie |
| POST | `/api/auth/login` | `{ email, password }` | `{ user }` + cookie |
| POST | `/api/auth/logout` | — | `{ ok: true }` |
| GET | `/api/auth/me` | — | `{ user }` ou `401` |

`user = { id, displayName, email, createdAt }`

## Leilões

| Método | Rota | Login | Descrição |
|---|---|---|---|
| GET | `/api/config` | não | categorias, limites e `serverNow` |
| GET | `/api/auctions?status=LIVE,SCHEDULED&q=&category=&seller=&page=1&pageSize=20` | não | listagem paginada `{ items, total, page, pageSize }` |
| GET | `/api/auctions/:id` | não | detalhe com `photos[]`, `description`, `editPolicy` (`ALL` / `APPEND_DESCRIPTION` / `NONE`), `canCancel`, `canRelist` |
| GET | `/api/auctions/:id/room` | sim | estado da sala (o mesmo do WebSocket) |
| POST | `/api/auctions` | sim | multipart: `name, description, category, startPriceCents, startsAt (ISO), durationSec, photos[]` |
| PATCH | `/api/auctions/:id` | sim | **RF23** multipart; só os campos enviados mudam; `photos[]` (3–8) substitui as fotos; `appendDescription` acrescenta texto. `409 EDIT_NOT_ALLOWED` fora da política, `403 NOT_OWNER` |
| POST | `/api/auctions/:id/cancel` | sim | `409` se não puder cancelar |
| POST | `/api/auctions/:id/relist` | sim | **RF28** multipart; `startsAt` e `durationSec` obrigatórios, o resto opcional (sem `photos[]`, mantém as do item). `201` com o novo leilão; `409 CANNOT_RELIST` / `ALREADY_ACTIVE` |
| POST | `/api/auctions/:id/bids` | sim | `{ amountCents, idempotencyKey }` |
| GET | `/api/photos/<chave>` | não | a imagem |

## Usuários

| Método | Rota | Login | Descrição |
|---|---|---|---|
| GET | `/api/users?q=&page=1` | não | **RF22** busca comitentes pelo nome (sem acento/maiúscula): `{ items: [{ id, displayName, createdAt, auctionCount }] }` |
| GET | `/api/users/:id` | não | **RF22** perfil público: `{ id, displayName, createdAt, auctions: { scheduled[], live[], past[] } }` (sem e-mail) |
| GET | `/api/me/participations` | sim | **RF27** `{ items: [{ auctionId, name, status, coverUrl, myBestCents, myBidCount, currentPriceCents, minNextCents, endsAt, situation }] }`; `situation` = `leader` / `outbid` / `winner` |

Estados: `SCHEDULED` (Agendado), `LIVE` (Em andamento), `SOLD` (Vendido), `ENDED_NO_BIDS` (Encerrado sem lances), `CANCELLED` (Cancelado).

### Resposta do lance

```jsonc
// aceito (201) ou reenvio da mesma chave (200, replay: true)
{ "accepted": true, "replay": false, "bid": { "id", "amountCents", "at" }, "minNextCents": 10500 }
// recusado (409 / 429 / 404)
{ "accepted": false, "code": "TOO_LOW", "message": "…", "minNextCents": 10500 }
```
Códigos de recusa: `NOT_LIVE`, `ENDED`, `IS_SELLER`, `NOT_IN_ROOM` (precisa estar na sala como participante), `ALREADY_LEADER`, `TOO_LOW`, `RATE_LIMITED`, `NOT_FOUND`.

## Tempo real (Socket.IO, path `/socket.io`)

A conexão exige o cookie de sessão.

| Direção | Evento | Dados |
|---|---|---|
| cliente → servidor | `room:join` | `{ auctionId, mode?: 'participant' \| 'spectator' }`; ack `{ ok, state, mode, presence }`. O comitente sempre entra como `spectator` |
| cliente → servidor | `room:mode` | **RF25** `{ auctionId, mode }`; troca de modo sem sair; ack `{ ok, mode, presence }` ou `{ ok: false, error: 'IS_SELLER' }` |
| cliente → servidor | `room:leave` | `{ auctionId }`; ack `{ ok }` |
| servidor → sala | `auction:state` | `RoomState` (a cada mudança) |
| servidor → sala | `room:presence` | **RF25** `{ auctionId, participants, spectators }` (contagem por pessoa) |
| servidor → usuário | `user:outbid` | **RF26** `{ auctionId, name, amountCents, minNextCents }`; chega em qualquer página do site |
| servidor → todos | `listing:changed` | `{ id }` (para a listagem atualizar) |

```ts
RoomState = {
  id, name, description, status, startPriceCents, currentPriceCents, minNextCents, bidCount,
  startsAt, endsAt, sellerId, leaderId, leaderAlias, winnerId, winnerAlias, finalPriceCents,
  recentBids: [{ id, amountCents, at, bidderId, bidderAlias }],
  serverNow
}
```
Ao reconectar, o cliente envia `room:join` de novo (com o mesmo `mode`) e recebe o estado completo.

**Para dar lance, o usuário precisa estar com a sala aberta como participante.** O front deve entrar na sala (`room:join`) antes de habilitar o botão de lance.
