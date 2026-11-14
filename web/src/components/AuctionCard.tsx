import { Link } from 'react-router-dom';
import type { AuctionSummary } from '../lib/api';
import { dateTime, money } from '../lib/format';
import { Countdown } from './Countdown';
import { useServerNow } from '../lib/clock';

const STATUS_BADGE: Record<AuctionSummary['status'], { label: string; className: string }> = {
  LIVE: { label: 'Ao vivo', className: 'text-red-600' },
  SCHEDULED: { label: '⏱️ Agendado', className: 'text-amber-700' },
  SOLD: { label: '🏆 Vendido', className: 'text-emerald-700' },
  ENDED_NO_BIDS: { label: 'Encerrado sem lances', className: 'text-slate-600' },
  CANCELLED: { label: 'Cancelado', className: 'text-red-700' },
};

export function AuctionCard({ a }: { a: AuctionSummary }) {
  const now = useServerNow();
  const badge = STATUS_BADGE[a.status];
  const open = a.status === 'LIVE' || a.status === 'SCHEDULED';

  // Barra de progresso: quanto do tempo do leilão já passou (relógio do servidor, RF16)
  const startMs = new Date(a.startsAt).getTime();
  const endMs = new Date(a.endsAt).getTime();
  const duration = Math.max(1, endMs - startMs);
  const elapsed = Math.max(0, Math.min(duration, now - startMs));
  const progressPct =
    a.status === 'LIVE' ? Math.max(3, Math.min(100, Math.round((elapsed / duration) * 100)))
      : a.status === 'SCHEDULED' ? 0
        : 100;

  return (
    <div className="card group flex flex-col overflow-hidden transition-all duration-200 hover:shadow-lg">
      {/* Imagem com status e categoria */}
      <Link to={`/leiloes/${a.id}`} className="relative block aspect-[16/10] w-full overflow-hidden bg-slate-100">
        {a.coverUrl ? (
          <img src={a.coverUrl} alt={a.name} loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-3xl text-slate-400">🖼️</div>
        )}

        <div className={`absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold shadow-sm backdrop-blur-xs ${badge.className}`}>
          {a.status === 'LIVE' && (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
            </span>
          )}
          {badge.label}
        </div>
        <span className="absolute right-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur-xs">
          {a.category}
        </span>
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <Link to={`/leiloes/${a.id}`} className="block">
          <h3 className="line-clamp-1 text-base font-bold text-slate-900 transition group-hover:text-brand-600">{a.name}</h3>
        </Link>

        {/* Valores */}
        <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-center">
          <div>
            <div className="text-[11px] font-medium text-slate-500">Preço inicial</div>
            <div className="truncate text-xs font-bold text-slate-900 sm:text-sm">{money(a.startPriceCents)}</div>
          </div>
          <div className="border-x border-slate-200/60 px-1">
            <div className="text-[11px] font-medium text-slate-500">{a.status === 'SOLD' ? 'Vendido por' : 'Lance atual'}</div>
            <div className="truncate text-xs font-bold text-brand-700 sm:text-sm">
              {a.bidCount > 0 ? money(a.currentPriceCents) : '—'}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500">Próximo mínimo</div>
            <div className="truncate text-xs font-bold text-emerald-700 sm:text-sm">{open ? money(a.minNextCents) : '—'}</div>
          </div>
        </div>

        {/* Tempo e progresso */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Tempo</span>
            {a.status === 'LIVE' ? (
              <span className="font-semibold text-red-600">
                Termina em <Countdown targetIso={a.endsAt} className="font-mono text-sm font-bold" />
              </span>
            ) : a.status === 'SCHEDULED' ? (
              <span className="font-semibold text-amber-700">
                Abre em <Countdown targetIso={a.startsAt} className="font-mono text-sm font-bold" />
              </span>
            ) : (
              <span className="font-medium text-slate-500">Terminou {dateTime(a.endsAt)}</span>
            )}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/40">
            <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-brand-600 transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        {/* Lances e comitente (dados reais) */}
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-xs text-slate-500">
          <span>
            <span className="font-bold text-slate-400">⇆</span>{' '}
            <strong>{a.bidCount}</strong> {a.bidCount === 1 ? 'lance' : 'lances'}
          </span>
          <Link to={`/usuarios/${a.seller.id}`} className="truncate hover:text-brand-600" title="Ver perfil do comitente">
            por <strong className="text-slate-700">{a.seller.displayName}</strong>
          </Link>
        </div>

        <div className="mt-auto pt-1">
          <Link
            to={`/leiloes/${a.id}`}
            className="flex w-full items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-xs transition hover:bg-brand-700 active:scale-[0.99]"
          >
            {open ? 'Acessar sala do leilão' : 'Ver resultado'}
          </Link>
        </div>
      </div>
    </div>
  );
}
