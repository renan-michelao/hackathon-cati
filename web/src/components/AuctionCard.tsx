import { Link } from 'react-router-dom';
import type { AuctionSummary } from '../lib/api';
import { dateTime, money } from '../lib/format';
import { Countdown } from './Countdown';
import { StatusBadge } from './StatusBadge';

export function AuctionCard({ a }: { a: AuctionSummary }) {
  return (
    <Link to={`/leiloes/${a.id}`} className="card group flex flex-col overflow-hidden transition hover:shadow-md">
      <div className="aspect-[4/3] bg-slate-100">
        {a.coverUrl && <img src={a.coverUrl} alt={a.name} className="h-full w-full object-cover" loading="lazy" />}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <StatusBadge status={a.status} />
          <span className="text-xs text-slate-500">{a.category}</span>
        </div>
        <h3 className="line-clamp-2 font-semibold group-hover:text-brand-600">{a.name}</h3>
        <div className="mt-auto flex items-end justify-between gap-2 text-sm">
          <div>
            <div className="text-xs text-slate-500">{a.bidCount > 0 ? `Atual · ${a.bidCount} lance(s)` : 'Preço inicial'}</div>
            <div className="text-lg font-bold">{money(a.currentPriceCents ?? a.startPriceCents)}</div>
          </div>
          <div className="text-right text-xs text-slate-500">
            {a.status === 'LIVE' && (
              <>
                termina em
                <br />
                <Countdown targetIso={a.endsAt} className="text-sm font-semibold text-slate-800" />
              </>
            )}
            {a.status === 'SCHEDULED' && (
              <>
                abre em
                <br />
                <Countdown targetIso={a.startsAt} className="text-sm font-semibold text-slate-800" />
              </>
            )}
            {a.status !== 'LIVE' && a.status !== 'SCHEDULED' && <>terminou {dateTime(a.endsAt)}</>}
          </div>
        </div>
      </div>
    </Link>
  );
}
