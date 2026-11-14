import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type AppConfig, type AuctionSummary, type Paged } from '../lib/api';
import { syncServerClock } from '../lib/clock';
import { AuctionCard } from '../components/AuctionCard';
import { useSocket } from '../lib/socket';
import { useAuth } from '../lib/auth';

interface StatusFilter {
  id: string;
  label: string;
  value: string;
}

export function Home() {
  const socket = useSocket();
  const { user } = useAuth();
  const nav = useNavigate();

  const [data, setData] = useState<Paged<AuctionSummary> | null>(null);
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  const [activeTab, setActiveTab] = useState('ativos');
  const [status, setStatus] = useState('LIVE,SCHEDULED');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [sellerSearch, setSellerSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(true);

  // Estados dos checkboxes dos Filtros Avançados
  const [checkedStates, setCheckedStates] = useState({
    agendado: true,
    emAndamento: true,
    vendido: false,
    cancelados: false,
  });

  useEffect(() => {
    api<AppConfig>('/api/config').then((c) => {
      setCfg(c);
      syncServerClock(c.serverNow);
    });
  }, []);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ status, page: String(page) });
    if (q.trim()) params.set('q', q.trim());
    if (category) params.set('category', category);
    // filtro por comitente feito no servidor: funciona com paginação e ignora acentos
    if (sellerSearch.trim()) params.set('sellerName', sellerSearch.trim());

    const r = await api<Paged<AuctionSummary>>(`/api/auctions?${params}`);
    setData(r);
  }, [status, q, category, sellerSearch, page]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    if (!socket) {
      const t = setInterval(() => void load(), 10_000);
      return () => clearInterval(t);
    }
    let pending: ReturnType<typeof setTimeout> | null = null;
    const onChange = () => {
      if (pending) return;
      pending = setTimeout(() => {
        pending = null;
        void load();
      }, 500);
    };
    socket.on('listing:changed', onChange);
    return () => {
      socket.off('listing:changed', onChange);
      if (pending) clearTimeout(pending);
    };
  }, [socket, load]);

  const handleCheckboxChange = (key: keyof typeof checkedStates) => {
    const next = { ...checkedStates, [key]: !checkedStates[key] };
    setCheckedStates(next);

    const activeList: string[] = [];
    if (next.emAndamento) activeList.push('LIVE');
    if (next.agendado) activeList.push('SCHEDULED');
    if (next.vendido) activeList.push('SOLD', 'ENDED_NO_BIDS');
    if (next.cancelados) activeList.push('CANCELLED');

    setStatus(activeList.length ? activeList.join(',') : 'LIVE,SCHEDULED');
    setPage(1);
  };

  const tabs: StatusFilter[] = [
    { id: 'ativos', label: 'Ativos', value: 'LIVE,SCHEDULED' },
    { id: 'andamento', label: 'Em andamento', value: 'LIVE' },
    { id: 'agendados', label: 'Agendados', value: 'SCHEDULED' },
    { id: 'encerrados', label: 'Encerrados', value: 'SOLD,ENDED_NO_BIDS' },
    { id: 'cancelados', label: 'Cancelados', value: 'CANCELLED' },
    { id: 'meus-lances', label: 'Meus Lances', value: 'meus-lances' },
  ];

  const handleTabClick = (tab: StatusFilter) => {
    if (tab.id === 'meus-lances') {
      if (!user) {
        nav('/entrar');
        return;
      }
      nav('/minhas-participacoes');
      return;
    }
    setActiveTab(tab.id);
    setStatus(tab.value);
    setPage(1);

    setCheckedStates({
      agendado: tab.value.includes('SCHEDULED'),
      emAndamento: tab.value.includes('LIVE'),
      vendido: tab.value.includes('SOLD') || tab.value.includes('ENDED_NO_BIDS'),
      cancelados: tab.value.includes('CANCELLED'),
    });
  };

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Leilões
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Disputas em tempo real, transparência em cada lance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Campo de Busca com Ícone */}
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-3.5 pr-9 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              placeholder="Buscar pelo nome..."
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
            <span className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
          </div>

          {/* Botão Filtros Avançados */}
          <button
            type="button"
            onClick={() => setShowAdvancedFilters((v) => !v)}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition cursor-pointer shadow-xs ${
              showAdvancedFilters
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <svg className="h-4 w-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <span>Filtros Avançados</span>
          </button>
        </div>
      </div>

      {/* Abas Rápidas (Pills) */}
      <div className="flex flex-wrap items-center gap-2 pb-1 overflow-x-auto">
        {tabs.map((t) => {
          const isSelected = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => handleTabClick(t)}
              className={`rounded-full px-4 py-1.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                isSelected
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              {t.label}
              {/* total real, vindo da API, só na aba selecionada */}
              {isSelected && data && <span className="ml-1 opacity-90">({data.total})</span>}
            </button>
          );
        })}
      </div>

      {/* Layout Principal: Grid de Cards + Painel Lateral */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Coluna dos Cards */}
        <div className="flex-1 w-full space-y-6">
          {!data ? (
            <div className="flex h-64 items-center justify-center text-slate-400">
              <div className="text-center space-y-2">
                <span className="inline-block animate-spin text-2xl">⏳</span>
                <p className="text-sm font-medium">Carregando leilões...</p>
              </div>
            </div>
          ) : data.items.length === 0 ? (
            <div className="card p-12 text-center text-slate-500 rounded-2xl">
              <span className="text-4xl block mb-2">🔍</span>
              <p className="font-semibold text-slate-700">Nenhum leilão encontrado</p>
              <p className="text-xs text-slate-400 mt-1">Tente remover alguns filtros para ver mais resultados.</p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
              {data.items.map((a) => (
                <AuctionCard key={a.id} a={a} />
              ))}
            </div>
          )}

          {/* Paginação */}
          {pages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-4">
              <button
                className="btn-secondary text-xs"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Anterior
              </button>
              <span className="text-xs font-semibold text-slate-600">
                Página {page} de {pages}
              </span>
              <button
                className="btn-secondary text-xs"
                disabled={page >= pages}
                onClick={() => setPage(page + 1)}
              >
                Próxima
              </button>
            </div>
          )}
        </div>

        {/* Coluna Direita: Card de Filtros Avançados */}
        {showAdvancedFilters && (
          <aside className="w-full lg:w-64 xl:w-72 shrink-0 card rounded-2xl p-5 border border-slate-200/90 bg-white shadow-xs space-y-5 animate-in fade-in duration-200">
            {/* Filtro: Categoria */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Categoria
              </label>
              <div className="relative">
                <select
                  className="w-full appearance-none rounded-xl border border-slate-300 bg-white py-2 pl-3 pr-8 text-xs sm:text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Categoria</option>
                  {cfg?.categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400 text-xs">
                  ▼
                </div>
              </div>
            </div>

            {/* Filtro: Estado */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Estado
              </label>
              <div className="space-y-2 text-xs sm:text-sm text-slate-700">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkedStates.agendado}
                    onChange={() => handleCheckboxChange('agendado')}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>Agendado</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkedStates.emAndamento}
                    onChange={() => handleCheckboxChange('emAndamento')}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>Em andamento</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkedStates.vendido}
                    onChange={() => handleCheckboxChange('vendido')}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>Vendido</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkedStates.cancelados}
                    onChange={() => handleCheckboxChange('cancelados')}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>Cancelados</span>
                </label>
              </div>
            </div>

            {/* Filtro: Comitente */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Comitente
              </label>
              <input
                type="text"
                placeholder="Comitente..."
                value={sellerSearch}
                onChange={(e) => {
                  setSellerSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs sm:text-sm text-slate-700 placeholder-slate-400 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}