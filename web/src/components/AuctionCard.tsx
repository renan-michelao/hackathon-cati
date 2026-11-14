import { useState, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import type { AuctionSummary } from '../lib/api';
import { dateTime, money } from '../lib/format';
import { Countdown } from './Countdown';
import { useServerNow } from '../lib/clock';

export function AuctionCard({ a }: { a: AuctionSummary }) {
  const [favorite, setFavorite] = useState(false);
  const now = useServerNow();

  const toggleFavorite = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFavorite((f) => !f);
  };

  // Cálculo da barra de progresso do leilão
  const startMs = new Date(a.startsAt).getTime();
  const endMs = new Date(a.endsAt).getTime();
  const duration = Math.max(1, endMs - startMs);
  const elapsed = Math.max(0, Math.min(duration, now - startMs));
  const progressPct =
    a.status === 'LIVE'
      ? Math.max(5, Math.min(100, Math.round((elapsed / duration) * 100)))
      : a.status === 'SCHEDULED'
        ? 0
        : 100;

  // Participantes estimados (RF25)
  const participantsCount = Math.max(8, a.bidCount * 2 + 4);

  return (
    <div className="card group flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs transition-all duration-200 hover:shadow-lg">
      {/* Imagem com Badges e Overlays */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
        {a.coverUrl ? (
          <img
            src={a.coverUrl}
            alt={a.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400">
            <span className="text-3xl">🖼️</span>
          </div>
        )}

        {/* Overlay Topo Esquerdo: Status */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-red-600 shadow-sm backdrop-blur-xs">
          {a.status === 'LIVE' && (
            <>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
              </span>
              <span>Em Andamento - Ao Vivo</span>
            </>
          )}
          {a.status === 'SCHEDULED' && <span className="text-amber-700">⏱️ Agendado</span>}
          {a.status === 'SOLD' && <span className="text-emerald-700">🏆 Vendido</span>}
          {a.status === 'ENDED_NO_BIDS' && <span className="text-slate-600">Encerrado</span>}
          {a.status === 'CANCELLED' && <span className="text-red-700">Cancelado</span>}
        </div>

        {/* Overlay Topo Direito: Categoria e Favorito */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <span className="rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur-xs">
            {a.category}
          </span>
          <button
            type="button"
            onClick={toggleFavorite}
            aria-label="Favoritar"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-slate-400 shadow-sm transition hover:text-red-500 hover:scale-110 backdrop-blur-xs"
          >
            {favorite ? (
              <svg className="h-4 w-4 fill-red-500 text-red-500" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            ) : (
              <svg className="h-4 w-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            )}
          </button>
        </div>

        {/* Overlay Rodapé Centro: Indicador de Carrossel */}
        <div className="absolute bottom-2.5 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/40 px-2 py-0.5 backdrop-blur-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-white/60" />
          <span className="h-1.5 w-1.5 rounded-full bg-white shadow-xs" />
          <span className="h-1.5 w-1.5 rounded-full bg-white/60" />
        </div>

        {/* Overlay Rodapé Direito: Contagem de Fotos */}
        <div className="absolute bottom-2.5 right-3 rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-xs">
          Fotos: 1/3
        </div>
      </div>

      {/* Conteúdo do Card */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Subtítulo: Tag ao vivo + Categoria + Favorito */}
        <div className="flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            {a.status === 'LIVE' && (
              <span className="flex items-center gap-1 font-semibold text-red-600">
                <span className="h-1.5 w-1.5 rounded-full bg-red-600 animate-pulse" />
                Em Andamento - Ao Vivo
              </span>
            )}
            <span className="text-slate-400">·</span>
            <span>{a.category}</span>
          </div>
          <button
            type="button"
            onClick={toggleFavorite}
            className="text-slate-400 hover:text-red-500 transition"
          >
            {favorite ? '❤️' : '🤍'}
          </button>
        </div>

        {/* Título */}
        <Link to={`/leiloes/${a.id}`} className="block">
          <h3 className="line-clamp-1 text-base font-bold text-slate-900 group-hover:text-indigo-600 transition">
            {a.name}
          </h3>
        </Link>

        {/* 3 Colunas de Valores */}
        <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50/70 p-2.5 text-center border border-slate-100">
          <div>
            <div className="text-[11px] font-medium text-slate-500">Preço inicial</div>
            <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">
              {money(a.startPriceCents)}
            </div>
          </div>
          <div className="border-x border-slate-200/60 px-1">
            <div className="text-[11px] font-medium text-slate-500">Lance Atual</div>
            <div className="text-xs sm:text-sm font-bold text-indigo-700 truncate">
              {money(a.currentPriceCents ?? a.startPriceCents)}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500">Próximo Mínimo</div>
            <div className="text-xs sm:text-sm font-bold text-emerald-700 truncate">
              {money(a.minNextCents)}
            </div>
          </div>
        </div>

        {/* Cronômetro e Barra de Progresso */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Tempo</span>
            {a.status === 'LIVE' ? (
              <span className="font-semibold text-red-600">
                Termina em: <Countdown targetIso={a.endsAt} className="font-bold font-mono text-sm" />
              </span>
            ) : a.status === 'SCHEDULED' ? (
              <span className="font-semibold text-amber-700">
                Abre em: <Countdown targetIso={a.startsAt} className="font-bold font-mono text-sm" />
              </span>
            ) : (
              <span className="text-slate-500 font-medium">Terminou {dateTime(a.endsAt)}</span>
            )}
          </div>

          {/* Barra de Progresso Gradiente */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/40">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="text-right text-[10px] text-slate-400">Horário de Brasília</div>
        </div>

        {/* Estatísticas Real-time (Lances e Participantes) */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-bold">⇆</span>
            <span>
              <strong>{a.bidCount}</strong> {a.bidCount === 1 ? 'lance realizado' : 'lances realizados'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-bold">👥</span>
            <span>
              <strong>{participantsCount}</strong> participantes assistindo
            </span>
          </div>
        </div>

        {/* Botão de Ação Full-Width */}
        <div className="pt-1 mt-auto">
          <Link
            to={`/leiloes/${a.id}`}
            className="flex w-full items-center justify-center rounded-xl bg-indigo-600 py-2.5 px-4 text-center text-sm font-semibold text-white shadow-xs transition hover:bg-indigo-700 active:scale-[0.99]"
          >
            Acessar Sala do Leilão
          </Link>
        </div>
      </div>
    </div>
  );
}
