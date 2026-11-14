import { useServerNow } from '../lib/clock';
import { formatDuration } from '../lib/format';

/** Contagem regressiva visual até `targetIso`, usando o relógio estimado do servidor (RF16). */
export function Countdown({ targetIso, className = '' }: { targetIso: string; className?: string }) {
  const now = useServerNow();
  const ms = new Date(targetIso).getTime() - now;
  const urgent = ms > 0 && ms < 120_000;
  return (
    <span className={`font-mono tabular-nums ${urgent ? 'text-red-600' : ''} ${className}`}>{formatDuration(ms)}</span>
  );
}
