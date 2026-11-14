import { useCallback, useEffect, useState } from 'react';
import { api, type AppConfig, type AuctionSummary, type Paged } from '../lib/api';
import { syncServerClock } from '../lib/clock';
import { AuctionCard } from '../components/AuctionCard';
import { useSocket } from '../lib/socket';

const FILTERS = [
  { value: 'LIVE,SCHEDULED', label: 'Ativos' },
  { value: 'LIVE', label: 'Em andamento' },
  { value: 'SCHEDULED', label: 'Agendados' },
  { value: 'SOLD,ENDED_NO_BIDS,CANCELLED', label: 'Encerrados' },
];

// RF20: listagem pública de leilões (com filtros que adiantam o RF21).
export function Home() {
  const socket = useSocket();
  const [data, setData] = useState<Paged<AuctionSummary> | null>(null);
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  const [status, setStatus] = useState(FILTERS[0].value);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ status, page: String(page) });
    if (q.trim()) params.set('q', q.trim());
    if (category) params.set('category', category);
    const r = await api<Paged<AuctionSummary>>(`/api/auctions?${params}`);
    setData(r);
  }, [status, q, category, page]);

  useEffect(() => {
    api<AppConfig>('/api/config').then((c) => {
      setCfg(c);
      syncServerClock(c.serverNow);
    });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  // Atualiza a lista quando algum leilão muda (abre, fecha, recebe lance).
  // Visitantes não têm conexão em tempo real (exige login): recarregam a cada 10 s.
  useEffect(() => {
    if (!socket) {
      const t = setInterval(() => void load(), 10_000);
      return () => clearInterval(t);
    }
    let pending: ReturnType<typeof setTimeout> | null = null;
    const onChange = () => {
      if (pending) return;
      pending = setTimeout(() => { pending = null; void load(); }, 500);
    };
    socket.on('listing:changed', onChange);
    return () => { socket.off('listing:changed', onChange); if (pending) clearTimeout(pending); };
  }, [socket, load]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leilões</h1>
          <p className="text-sm text-slate-500">Lances ao vivo, abertura e fechamento automáticos.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input className="input sm:w-64" placeholder="Buscar pelo nome…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          <select className="input sm:w-48" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
            <option value="">Todas as categorias</option>
            {cfg?.categories.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f.value} onClick={() => { setStatus(f.value); setPage(1); }}
            className={`rounded-full px-3 py-1 text-sm font-medium ${status === f.value ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {!data ? (
        <p className="text-slate-500">Carregando…</p>
      ) : data.items.length === 0 ? (
        <div className="card p-10 text-center text-slate-500">Nenhum leilão encontrado.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.items.map((a) => <AuctionCard key={a.id} a={a} />)}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button>
          <span className="text-sm text-slate-600">Página {page} de {pages}</span>
          <button className="btn-secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>Próxima</button>
        </div>
      )}
    </div>
  );
}
