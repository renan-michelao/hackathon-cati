import type { AuctionStatus } from './api';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Centavos inteiros -> "R$ 1.234,56" (RF19: nada de ponto flutuante nas contas). */
export const money = (cents: number | null | undefined) => (cents == null ? '—' : brl.format(cents / 100));

/** "1.234,56" ou "1234.56" -> centavos inteiros, sem passar por float. */
export function parseMoneyToCents(input: string): number | null {
  const s = input.trim().replace(/[R$\s]/g, '');
  if (!s) return null;
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const m = normalized.match(/^(\d+)(?:\.(\d{0,2}))?$/);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
}

/** Data/hora no fuso de quem está vendo (RF19). */
export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });

export const STATUS_LABEL: Record<AuctionStatus, string> = {
  SCHEDULED: 'Agendado',
  LIVE: 'Em andamento',
  SOLD: 'Vendido',
  ENDED_NO_BIDS: 'Encerrado sem lances',
  CANCELLED: 'Cancelado',
};

export function formatDuration(ms: number): string {
  if (ms <= 0) return '00:00';
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (d > 0) return `${d}d ${pad(h)}h ${pad(m)}m`;
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}
