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
| GET | `/api/auctions/:id` | não | detalhe com `photos[]` e `description` |
| GET | `/api/auctions/:id/room` | sim | estado da sala (o mesmo do WebSocket) |
| POST | `/api/auctions` | sim | multipart: `name, description, category, startPriceCents, startsAt (ISO), durationSec, photos[]` |
| POST | `/api/auctions/:id/cancel` | sim | `409` se não puder cancelar |
| POST | `/api/auctions/:id/bids` | sim | `{ amountCents, idempotencyKey }` |
| GET | `/api/photos/<chave>` | não | a imagem |

Estados: `SCHEDULED` (Agendado), `LIVE` (Em andamento), `SOLD` (Vendido), `ENDED_NO_BIDS` (Encerrado sem lances), `CANCELLED` (Cancelado).

### Resposta do lance

```jsonc
// aceito (201) ou reenvio da mesma chave (200, replay: true)
{ "accepted": true, "replay": false, "bid": { "id", "amountCents", "at" }, "minNextCents": 10500 }
// recusado (409 / 429 / 404)
{ "accepted": false, "code": "TOO_LOW", "message": "…", "minNextCents": 10500 }
```
Códigos de recusa: `NOT_LIVE`, `ENDED`, `IS_SELLER`, `ALREADY_LEADER`, `TOO_LOW`, `RATE_LIMITED`, `NOT_FOUND`.

## Tempo real (Socket.IO, path `/socket.io`)

A conexão exige o cookie de sessão.

| Direção | Evento | Dados |
|---|---|---|
| cliente → servidor | `room:join` | `{ auctionId }`; o ack devolve `{ ok, state }` |
| cliente → servidor | `room:leave` | `{ auctionId }` |
| servidor → sala | `auction:state` | `RoomState` (a cada mudança) |
| servidor → todos | `listing:changed` | `{ id }` (para a listagem atualizar) |

```ts
RoomState = {
  id, status, startPriceCents, currentPriceCents, minNextCents, bidCount,
  startsAt, endsAt, sellerId, leaderId, leaderAlias, winnerId, winnerAlias, finalPriceCents,
  recentBids: [{ id, amountCents, at, bidderId, bidderAlias }],
  serverNow
}
```
Ao reconectar, o cliente envia `room:join` de novo e recebe o estado completo.
