/**
 * Gera um UUID v4 (chave de idempotência do lance, RF12).
 *
 * `crypto.randomUUID()` só existe em "contexto seguro" (HTTPS ou localhost). O sistema publicado
 * na VM é servido em HTTP puro pelo IP, onde ele NÃO existe. `crypto.getRandomValues()` funciona
 * em qualquer contexto e é igualmente criptográfico, então montamos o UUID com ele.
 */
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; // versão 4
  b[8] = (b[8] & 0x3f) | 0x80; // variante RFC 4122
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0'));
  return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h.slice(8, 10).join('')}-${h.slice(10).join('')}`;
}
