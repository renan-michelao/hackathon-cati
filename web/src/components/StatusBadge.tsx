import type { AuctionStatus } from '../lib/api';
import { STATUS_LABEL } from '../lib/format';

const STYLE: Record<AuctionStatus, string> = {
  SCHEDULED: 'bg-amber-100 text-amber-800',
  LIVE: 'bg-emerald-100 text-emerald-800',
  SOLD: 'bg-brand-100 text-brand-700',
  ENDED_NO_BIDS: 'bg-slate-200 text-slate-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

export function StatusBadge({ status }: { status: AuctionStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLE[status]}`}>
      {status === 'LIVE' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-600" />}
      {STATUS_LABEL[status]}
    </span>
  );
}
