// Fotos dos itens (RF07, com a correção da equipe: as imagens ficam no disco da VM — ver D29).
// Dois "drivers", escolhidos por STORAGE_DRIVER:
//   local (padrão) — arquivos numa pasta (no Docker, o volume "fotos" montado em /data/fotos);
//   s3             — qualquer serviço compatível com S3 (mantido como alternativa).
// Em ambos, o banco guarda só a chave "fotos/<uuid>.<ext>" e o upload é validado pelo conteúdo.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { S3Client, PutObjectCommand, GetObjectCommand, HeadBucketCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import { config } from './config.js';

export type ImageType = { mime: string; ext: string };

const MIME_BY_EXT: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const KEY_RE = /^fotos\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

/** Detecta o tipo real pelos "magic bytes". Aceitamos JPEG, PNG e WebP. */
export function detectImage(buf: Buffer): ImageType | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return { mime: 'image/png', ext: 'png' };
  if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP')
    return { mime: 'image/webp', ext: 'webp' };
  return null;
}

/** URL que o front usa: a API entrega a foto (só a porta 8080 da VM é exposta). */
export function photoUrl(key: string): string {
  return `/api/photos/${key}`;
}

export function isValidPhotoKey(key: string): boolean {
  return KEY_RE.test(key);
}

interface Driver {
  init(): Promise<void>;
  put(key: string, buf: Buffer, type: ImageType): Promise<void>;
  get(key: string): Promise<{ body: NodeJS.ReadableStream; contentType: string }>;
}

// ---------- disco local ----------
const localDriver: Driver = {
  async init() {
    await fs.promises.mkdir(path.join(config.storage.localDir, 'fotos'), { recursive: true });
  },
  async put(key, buf) {
    const dest = path.join(config.storage.localDir, key);
    // grava num arquivo temporário e renomeia: nunca existe foto pela metade no lugar final
    const tmp = `${dest}.${process.pid}.tmp`;
    await fs.promises.writeFile(tmp, buf, { flag: 'wx' });
    await fs.promises.rename(tmp, dest);
  },
  async get(key) {
    const file = path.join(config.storage.localDir, key);
    await fs.promises.access(file);
    const ext = path.extname(file).slice(1);
    return { body: fs.createReadStream(file), contentType: MIME_BY_EXT[ext] ?? 'application/octet-stream' };
  },
};

// ---------- S3 (alternativa) ----------
function makeS3Driver(): Driver {
  const s3 = new S3Client({
    region: config.s3.region,
    forcePathStyle: config.s3.forcePathStyle,
    endpoint: config.s3.endpoint || undefined,
    credentials: config.s3.accessKeyId
      ? { accessKeyId: config.s3.accessKeyId, secretAccessKey: config.s3.secretAccessKey }
      : undefined,
  });
  const Bucket = config.s3.bucket;
  return {
    async init() {
      try {
        await s3.send(new HeadBucketCommand({ Bucket }));
      } catch {
        await s3.send(new CreateBucketCommand({ Bucket })).catch((e) =>
          console.warn('[storage] não foi possível verificar/criar o bucket:', (e as Error).message));
      }
    },
    async put(key, buf, type) {
      await s3.send(new PutObjectCommand({ Bucket, Key: key, Body: buf, ContentType: type.mime }));
    },
    async get(key) {
      const r = await s3.send(new GetObjectCommand({ Bucket, Key: key }));
      return { body: r.Body as NodeJS.ReadableStream, contentType: r.ContentType ?? 'application/octet-stream' };
    },
  };
}

const driver: Driver = config.storage.driver === 's3' ? makeS3Driver() : localDriver;

export async function initStorage() {
  await driver.init();
  console.log(`[storage] driver=${config.storage.driver}${config.storage.driver === 'local' ? ` pasta=${config.storage.localDir}` : ''}`);
}

export async function uploadPhoto(buf: Buffer, type: ImageType): Promise<string> {
  const key = `fotos/${crypto.randomUUID()}.${type.ext}`;
  await driver.put(key, buf, type);
  return key;
}

/** Lê a foto como stream. Lança erro se a chave for inválida ou a foto não existir. */
export async function getPhoto(key: string) {
  if (!isValidPhotoKey(key)) throw new Error('chave inválida');
  return driver.get(key);
}
