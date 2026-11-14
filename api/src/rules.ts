// Regras de negócio puras (sem banco): fáceis de testar e de explicar no pitch.
import { config } from './config.js';

/** RF14: incremento pela faixa de preço (tabela de referência do documento). */
export function incrementFor(priceCents: number): number {
  if (priceCents < 100_00) return 1_00;
  if (priceCents < 500_00) return 5_00;
  if (priceCents < 1_000_00) return 10_00;
  if (priceCents < 5_000_00) return 50_00;
  if (priceCents < 25_000_00) return 100_00;
  return 500_00;
}

/**
 * RF14: lance mínimo atual. Depende só do estado do leilão:
 * sem lances = preço inicial; com lances = preço atual + incremento da faixa.
 */
export function minNextBid(a: { bid_count: number; start_price_cents: number; current_price_cents: number | null }): number {
  if (a.bid_count === 0 || a.current_price_cents === null) return a.start_price_cents;
  return a.current_price_cents + incrementFor(a.current_price_cents);
}

/**
 * RF15: se o lance deixa menos de EXTENSION_WINDOW no relógio, o término vai para
 * EXTENSION_WINDOW depois do lance, mas nunca além de término original + EXTENSION_MAX_TOTAL.
 */
export function extendedEnd(endsAt: Date, originalEndsAt: Date, now: Date): Date {
  const windowMs = config.extensionWindowSec * 1000;
  if (endsAt.getTime() - now.getTime() >= windowMs) return endsAt;
  const cap = originalEndsAt.getTime() + config.extensionMaxTotalSec * 1000;
  const candidate = Math.min(now.getTime() + windowMs, cap);
  return new Date(Math.max(candidate, endsAt.getTime()));
}

/** RF05: antecedência do início em relação a "agora". Devolve a mensagem de erro ou null. */
export function leadTimeError(startsAt: Date, now: Date): string | null {
  const leadSec = (startsAt.getTime() - now.getTime()) / 1000;
  if (leadSec < config.limits.leadMinSec) return `O início precisa ser pelo menos ${config.limits.leadMinSec}s no futuro.`;
  if (leadSec > config.limits.leadMaxDays * 86400) return `O início pode ser no máximo ${config.limits.leadMaxDays} dias à frente.`;
  return null;
}

export type EditPolicy = 'ALL' | 'APPEND_DESCRIPTION' | 'NONE';

/**
 * RF23: quanto mais perto do início e quanto mais lances, menos se pode mudar.
 *   Agendado, faltando mais de EDIT_LOCK_MIN  -> todos os campos
 *   Agendado, faltando EDIT_LOCK_MIN ou menos -> nada
 *   Em andamento (com ou sem lances)           -> só acrescentar texto à descrição
 *   Vendido, Encerrado sem lances, Cancelado   -> nada
 * Acrescentar texto não muda preço, horário nem o item em si: não prejudica quem já deu lance.
 */
export function editPolicy(a: { status: string; starts_at: Date }, now: Date): EditPolicy {
  if (a.status === 'SCHEDULED') {
    return a.starts_at.getTime() - now.getTime() > config.editLockMin * 60_000 ? 'ALL' : 'NONE';
  }
  if (a.status === 'LIVE') return 'APPEND_DESCRIPTION';
  return 'NONE';
}

/** RF08/RF23: cancela se Agendado (a qualquer momento) ou Em andamento sem lances. */
export function canCancel(a: { status: string; bid_count: number }): boolean {
  return a.status === 'SCHEDULED' || (a.status === 'LIVE' && a.bid_count === 0);
}

/** RF28: só Encerrado sem lances ou Cancelado podem ser relistados. */
export function canRelist(a: { status: string }): boolean {
  return a.status === 'ENDED_NO_BIDS' || a.status === 'CANCELLED';
}

/**
 * RF21/RF22: padrão de busca "contém o texto". Escapa % e _ (curingas do LIKE) para que buscar
 * "%" procure o caractere "%" em vez de trazer tudo.
 */
export function containsPattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** RF09: identifica o líder sem expor o nome completo. "Renan Michelão" -> "Re***o". */
export function maskName(name: string | null | undefined): string | null {
  if (!name) return null;
  const n = name.trim();
  if (n.length <= 2) return n[0] + '*';
  return n.slice(0, 2) + '***' + n.slice(-1);
}
