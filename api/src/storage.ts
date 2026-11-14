// RF07: fotos vão para o armazenamento em nuvem (compatível com S3), nunca para o banco
// nem para o disco da VM. O upload é validado pelo conteúdo do arquivo, não pela extensão.
import crypto from 'node:crypto';
import { S3Client, PutObjectCommand, GetObjectCommand, HeadBucketCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from './config.js';

const base = {
  region: config.s3.region,
  forcePathStyle: config.s3.forcePathStyle,
  credentials: config.s3.accessKeyId
    ? { accessKeyId: config.s3.accessKeyId, secretAccessKey: config.s3.secretAccessKey }
    : undefined,
};

const s3 = new S3Client({ ...base, endpoint: config.s3.endpoint || undefined });
// Cliente só para assinar links com o endereço que o navegador enxerga.
const s3Public = new S3Client({ ...base, endpoint: config.s3.publicEndpoint || config.s3.endpoint || undefined });

export type ImageType = { mime: string; ext: string };

/** Detecta o tipo real pelos "magic bytes". Aceitamos JPEG, PNG e WebP. */
export function detectImage(buf: Buffer): ImageType | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return { mime: 'image/png', ext: 'png' };
  if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP')
    return { mime: 'image/webp', ext: 'webp' };
  return null;
}

export async function uploadPhoto(buf: Buffer, type: ImageType): Promise<string> {
  const key = `fotos/${crypto.randomUUID()}.${type.ext}`;
  await s3.send(new PutObjectCommand({ Bucket: config.s3.bucket, Key: key, Body: buf, ContentType: type.mime }));
  return key;
}

/** Link temporário (1h) direto no armazenamento (opcional; o padrão é o proxy abaixo). */
export async function signedPhotoUrl(key: string): Promise<string> {
  return getSignedUrl(s3Public, new GetObjectCommand({ Bucket: config.s3.bucket, Key: key }), { expiresIn: 3600 });
}

/** URL que o front usa: a API busca a foto no armazenamento e repassa (só a porta 8080 é exposta). */
export function photoUrl(key: string): string {
  return `/api/photos/${key}`;
}

/** Lê a foto do armazenamento como stream (sem tocar no disco da VM). */
export async function getPhoto(key: string) {
  const r = await s3.send(new GetObjectCommand({ Bucket: config.s3.bucket, Key: key }));
  return { body: r.Body as NodeJS.ReadableStream, contentType: r.ContentType ?? 'application/octet-stream' };
}

/** Cria o bucket se não existir (útil no ambiente local com MinIO). */
export async function ensureBucket() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: config.s3.bucket }));
  } catch {
    try {
      await s3.send(new CreateBucketCommand({ Bucket: config.s3.bucket }));
    } catch (e) {
      console.warn('[storage] não foi possível verificar/criar o bucket:', (e as Error).message);
    }
  }
}
