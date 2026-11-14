import path from 'node:path';

// Toda configuração vem de variáveis de ambiente (ver .env.example).
// RF06: os limites de leilão ficam aqui para facilitar a demo (ex.: abrir em 1 min e durar 3).

function num(name: string, def: number): number {
  const v = process.env[name];
  if (v === undefined || v === '') return def;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`Variável ${name} inválida: ${v}`);
  return n;
}

function str(name: string, def = ''): string {
  return process.env[name] ?? def;
}

export const config = {
  port: num('PORT', 3000),
  databaseUrl: str('DATABASE_URL', 'postgres://leilao:leilao@localhost:5433/leilao'),

  // RF02: sessão expira após SESSION_TTL_MIN minutos sem uso e se renova a cada requisição.
  sessionTtlMin: num('SESSION_TTL_MIN', 120),
  // Esqueci minha senha: validade do link e endereço do site usado no link do e-mail
  passwordResetTtlMin: num('PASSWORD_RESET_TTL_MIN', 30),
  appUrl: str('APP_URL', 'http://localhost:8080'),
  cookieSecure: str('COOKIE_SECURE', 'false') === 'true',

  limits: {
    nameMax: num('LIMIT_NAME_MAX', 120),
    descriptionMax: num('LIMIT_DESCRIPTION_MAX', 5000),
    photosMin: num('LIMIT_PHOTOS_MIN', 3),
    photosMax: num('LIMIT_PHOTOS_MAX', 8),
    photoMaxBytes: num('LIMIT_PHOTO_MAX_MB', 5) * 1024 * 1024,
    // antecedência entre "agora" e o início do leilão
    leadMinSec: num('LIMIT_LEAD_MIN_SEC', 30),
    leadMaxDays: num('LIMIT_LEAD_MAX_DAYS', 30),
    // duração do leilão
    durationMinSec: num('LIMIT_DURATION_MIN_SEC', 60),
    durationMaxSec: num('LIMIT_DURATION_MAX_SEC', 7 * 24 * 3600),
    startPriceMinCents: num('LIMIT_START_PRICE_MIN_CENTS', 100),
    startPriceMaxCents: num('LIMIT_START_PRICE_MAX_CENTS', 100_000_000_00),
  },

  // RF15: lance com menos de EXTENSION_WINDOW_SEC no relógio leva o término para
  // EXTENSION_WINDOW_SEC depois do lance, com no máximo EXTENSION_MAX_TOTAL_SEC acumulados.
  extensionWindowSec: num('EXTENSION_WINDOW_SEC', 120),
  extensionMaxTotalSec: num('EXTENSION_MAX_TOTAL_SEC', 1800),

  // RF23: a partir de quantos minutos antes do início um leilão agendado não pode mais ser editado.
  editLockMin: num('EDIT_LOCK_MIN', 30),
  appendDescriptionMax: num('LIMIT_APPEND_DESCRIPTION_MAX', 1000),

  // RF13: intervalo mínimo entre tentativas de lance do mesmo usuário.
  bidMinIntervalMs: num('BID_MIN_INTERVAL_MS', 500),

  recentBidsShown: num('RECENT_BIDS_SHOWN', 10),
  workerTickMs: num('WORKER_TICK_MS', 1000),

  // D29: por padrão as fotos ficam no disco da VM (volume Docker em /data/fotos).
  storage: {
    driver: str('STORAGE_DRIVER', 'local') as 'local' | 's3',
    localDir: str('PHOTOS_DIR', path.resolve('data')),
  },

  s3: {
    endpoint: str('S3_ENDPOINT'), // vazio = AWS padrão
    region: str('S3_REGION', 'us-east-1'),
    bucket: str('S3_BUCKET', 'leilao-fotos'),
    accessKeyId: str('S3_ACCESS_KEY'),
    secretAccessKey: str('S3_SECRET_KEY'),
    forcePathStyle: str('S3_FORCE_PATH_STYLE', 'true') === 'true',
  },
};

export const CATEGORIES = [
  'Eletrônicos',
  'Informática',
  'Casa e Decoração',
  'Moda',
  'Esportes',
  'Colecionáveis',
  'Arte',
  'Livros',
  'Veículos',
  'Outros',
] as const;
