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

/** RF09: identifica o líder sem expor o nome completo. "Renan Michelão" -> "Re***o". */
export function maskName(name: string | null | undefined): string | null {
  if (!name) return null;
  const n = name.trim();
  if (n.length <= 2) return n[0] + '*';
  return n.slice(0, 2) + '***' + n.slice(-1);
}
