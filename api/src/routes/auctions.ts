import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config, CATEGORIES } from '../config.js';
import { requireUser } from '../auth.js';
import type { FastifyRequest } from 'fastify';
import {
  cancelAuction, createAuction, editAuction, getAuctionDetail, getRoomState, listAuctions, placeBid, relistAuction,
  type AuctionFields, type AuctionStatus,
} from '../auctions.js';
import { detectImage, getPhoto, isValidPhotoKey, uploadPhoto, type ImageType } from '../storage.js';
import { HttpError } from '../errors.js';
import { leadTimeError } from '../rules.js';
import { isParticipant } from '../realtime.js';

const ALL_STATUSES: AuctionStatus[] = ['SCHEDULED', 'LIVE', 'SOLD', 'ENDED_NO_BIDS', 'CANCELLED'];
const uuid = z.string().uuid();

const listQuery = z.object({
  status: z.string().optional(), // ex.: "LIVE,SCHEDULED"
  q: z.string().trim().max(100).optional(),
  category: z.string().optional(),
  seller: z.string().uuid().optional(),
  sellerName: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

const bidBody = z.object({
  amountCents: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  idempotencyKey: z.string().min(8).max(100),
});

// Campos de um leilão (RF05). Na criação todos são obrigatórios; na edição e na relistagem, opcionais.
function fieldsSchema() {
  const L = config.limits;
  return z.object({
    name: z.string().trim().min(3, 'Nome muito curto').max(L.nameMax, 'Nome muito longo'),
    description: z.string().trim().min(10, 'Descrição muito curta').max(L.descriptionMax, 'Descrição muito longa'),
    category: z.enum(CATEGORIES as unknown as [string, ...string[]], { message: 'Categoria inválida' }),
    startPriceCents: z.coerce.number().int().min(L.startPriceMinCents, 'Preço inicial muito baixo').max(L.startPriceMaxCents, 'Preço inicial muito alto'),
    startsAt: z.string().datetime({ offset: true, message: 'Data de início inválida' }).transform((v) => new Date(v)),
    durationSec: z.coerce.number().int().min(L.durationMinSec, 'Duração muito curta').max(L.durationMaxSec, 'Duração muito longa'),
  });
}

/** Lê um formulário multipart: campos de texto + fotos validadas pelo conteúdo, tudo em memória. */
async function readAuctionForm(req: FastifyRequest) {
  const L = config.limits;
  const fields: Record<string, string> = {};
  const files: { buf: Buffer; type: ImageType }[] = [];
  for await (const part of req.parts({ limits: { fileSize: L.photoMaxBytes, files: L.photosMax } })) {
    if (part.type === 'file') {
      const buf = await part.toBuffer();
      if ((part.file as any).truncated) throw new HttpError(400, 'PHOTO_TOO_BIG', `Cada foto pode ter no máximo ${L.photoMaxBytes / 1024 / 1024} MB.`);
      if (buf.length === 0) continue; // campo de arquivo vazio no formulário
      const type = detectImage(buf);
      if (!type) throw new HttpError(400, 'PHOTO_TYPE', `"${part.filename}" não é JPEG, PNG ou WebP.`);
      files.push({ buf, type });
    } else {
      const v = String(part.value);
      if (v !== '') fields[part.fieldname] = v; // campo vazio = "não alterar"
    }
  }
  if (files.length > 0 && files.length < L.photosMin) {
    throw new HttpError(400, 'PHOTOS_MIN', `Envie pelo menos ${L.photosMin} fotos.`);
  }
  return { fields, files };
}

async function uploadAll(files: { buf: Buffer; type: ImageType }[]) {
  const keys: string[] = [];
  for (const f of files) keys.push(await uploadPhoto(f.buf, f.type));
  return keys;
}

export async function auctionRoutes(app: FastifyInstance) {
  app.get('/api/config', async () => ({
    categories: CATEGORIES,
    limits: config.limits,
    extensionWindowSec: config.extensionWindowSec,
    extensionMaxTotalSec: config.extensionMaxTotalSec,
    serverNow: new Date().toISOString(),
  }));

  // RF20 (+ filtros do RF21): pública
  app.get('/api/auctions', async (req) => {
    const q = listQuery.parse(req.query);
    const statuses = q.status
      ? (q.status.split(',').filter((s) => ALL_STATUSES.includes(s as AuctionStatus)) as AuctionStatus[])
      : (['LIVE', 'SCHEDULED'] as AuctionStatus[]);
    return listAuctions({
      statuses: statuses.length ? statuses : ['LIVE', 'SCHEDULED'],
      q: q.q || undefined,
      category: q.category || undefined,
      sellerId: q.seller,
      sellerName: q.sellerName || undefined,
      page: q.page,
      pageSize: q.pageSize,
    });
  });

  app.get<{ Params: { id: string } }>('/api/auctions/:id', async (req, reply) => {
    if (!uuid.safeParse(req.params.id).success) return reply.code(404).send({ error: 'NOT_FOUND' });
    const d = await getAuctionDetail(req.params.id);
    if (!d) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Leilão não encontrado.' });
    return d;
  });

  // Estado da sala via HTTP (o tempo real usa o Socket.IO, ver realtime.ts). Exige login (RF04).
  app.get<{ Params: { id: string } }>('/api/auctions/:id/room', { preHandler: requireUser }, async (req, reply) => {
    if (!uuid.safeParse(req.params.id).success) return reply.code(404).send({ error: 'NOT_FOUND' });
    const s = await getRoomState(req.params.id);
    if (!s) return reply.code(404).send({ error: 'NOT_FOUND' });
    return s;
  });

  // RF05/RF07: criação com fotos (multipart: campos + arquivos "photos")
  app.post('/api/auctions', { preHandler: requireUser }, async (req, reply) => {
    const { fields, files } = await readAuctionForm(req);
    const body = fieldsSchema().parse(fields);
    if (files.length === 0) throw new HttpError(400, 'PHOTOS_MIN', `Envie pelo menos ${config.limits.photosMin} fotos.`);
    const err = leadTimeError(body.startsAt, new Date());
    if (err) throw new HttpError(400, 'VALIDATION', err);
    const photoKeys = await uploadAll(files);
    const id = await createAuction({ sellerId: req.user!.id, ...body, photoKeys });
    return reply.code(201).send(await getAuctionDetail(id));
  });

  // RF23: edição (multipart; só os campos enviados mudam; "appendDescription" acrescenta texto)
  app.patch<{ Params: { id: string } }>('/api/auctions/:id', { preHandler: requireUser }, async (req, reply) => {
    if (!uuid.safeParse(req.params.id).success) return reply.code(404).send({ error: 'NOT_FOUND' });
    const { fields, files } = await readAuctionForm(req);
    const { appendDescription, ...rest } = fields;
    const parsed = fieldsSchema().partial().parse(rest) as Partial<AuctionFields>;
    const photoKeys = files.length ? await uploadAll(files) : undefined;
    await editAuction(req.params.id, req.user!.id, { fields: parsed, photoKeys, appendDescription });
    return getAuctionDetail(req.params.id);
  });

  // RF28: relistagem (multipart; início e duração obrigatórios, o resto opcional)
  app.post<{ Params: { id: string } }>('/api/auctions/:id/relist', { preHandler: requireUser }, async (req, reply) => {
    if (!uuid.safeParse(req.params.id).success) return reply.code(404).send({ error: 'NOT_FOUND' });
    const { fields, files } = await readAuctionForm(req);
    const parsed = fieldsSchema().partial().required({ startsAt: true, durationSec: true }).parse(fields);
    const photoKeys = files.length ? await uploadAll(files) : undefined;
    const newId = await relistAuction(req.params.id, req.user!.id, { fields: parsed, photoKeys });
    return reply.code(201).send(await getAuctionDetail(newId));
  });

  // RF08
  app.post<{ Params: { id: string } }>('/api/auctions/:id/cancel', { preHandler: requireUser }, async (req, reply) => {
    if (!uuid.safeParse(req.params.id).success) return reply.code(404).send({ error: 'NOT_FOUND' });
    const ok = await cancelAuction(req.params.id, req.user!.id);
    if (!ok) {
      return reply.code(409).send({
        error: 'CANNOT_CANCEL',
        message: 'Só o comitente cancela, e só enquanto o leilão está Agendado ou Em andamento sem lances.',
      });
    }
    return getAuctionDetail(req.params.id);
  });

  // RF10–RF13
  app.post<{ Params: { id: string } }>('/api/auctions/:id/bids', { preHandler: requireUser }, async (req, reply) => {
    if (!uuid.safeParse(req.params.id).success) return reply.code(404).send({ error: 'NOT_FOUND' });
    const body = bidBody.parse(req.body);
    const inRoom = isParticipant(req.user!.id, req.params.id);
    const r = await placeBid(req.user!.id, req.params.id, body.amountCents, body.idempotencyKey, inRoom);
    if (r.accepted) return reply.code(r.replay ? 200 : 201).send(r);
    const status = r.code === 'NOT_FOUND' ? 404 : r.code === 'RATE_LIMITED' ? 429 : 409;
    return reply.code(status).send(r);
  });

  // Proxy das fotos (o navegador só enxerga a porta 8080 da VM)
  app.get<{ Params: { '*': string } }>('/api/photos/*', async (req, reply) => {
    const key = req.params['*'];
    if (!isValidPhotoKey(key)) return reply.code(404).send();
    try {
      const p = await getPhoto(key);
      reply.header('Content-Type', p.contentType).header('Cache-Control', 'public, max-age=86400, immutable');
      return reply.send(p.body);
    } catch {
      return reply.code(404).send();
    }
  });
}

