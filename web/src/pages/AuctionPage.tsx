import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  api, ApiError, post, type AuctionDetail, type BidResponse, type Presence, type RoomMode, type RoomState,
} from '../lib/api';
import { useAuth } from '../lib/auth';
import { useSocket } from '../lib/socket';
import { useToast } from '../lib/toast';
import { syncServerClock } from '../lib/clock';
import { dateTime, money, parseMoneyToCents } from '../lib/format';
import { Countdown } from '../components/Countdown';
import { StatusBadge } from '../components/StatusBadge';

interface JoinAck { ok: boolean; state?: RoomState; mode?: RoomMode; presence?: Presence; error?: string; message?: string }

export function AuctionPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const socket = useSocket();
  const loc = useLocation();
  const [detail, setDetail] = useState<AuctionDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [online, setOnline] = useState(true);
  const [mode, setMode] = useState<RoomMode>('participant');
  const [presence, setPresence] = useState<Presence | null>(null);
  const [photo, setPhoto] = useState(0);
  const wantedMode = useRef<RoomMode>('participant');

  const loadDetail = useCallback(() => {
    api<AuctionDetail>(`/api/auctions/${id}`)
      .then((d) => { setDetail(d); syncServerClock(d.serverNow); })
      .catch(() => setNotFound(true));
  }, [id]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  // Sala em tempo real (RF09), com reconexão (RF24) e modo espectador/participante (RF25).
  // A cada (re)conexão, entra de novo no modo escolhido e recebe o estado completo do banco.
  useEffect(() => {
    if (!socket) return;
    const join = () => {
      socket.emit('room:join', { auctionId: id, mode: wantedMode.current }, (r: JoinAck) => {
        if (!r.ok || !r.state) return;
        applyState(r.state);
        if (r.mode) setMode(r.mode);
        if (r.presence) setPresence(r.presence);
      });
    };
    const onState = (st: RoomState) => { if (st.id === id) applyState(st); };
    const onPresence = (p: Presence) => { if (p.auctionId === id) setPresence(p); };
    const onConnect = () => { setOnline(true); join(); };
    const onDisconnect = () => setOnline(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('auction:state', onState);
    socket.on('room:presence', onPresence);
    if (socket.connected) join();
    return () => {
      socket.emit('room:leave', { auctionId: id });
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('auction:state', onState);
      socket.off('room:presence', onPresence);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, socket]);

  function applyState(st: RoomState) {
    syncServerClock(st.serverNow);
    setRoom(st);
    setDetail((d) => (d ? {
      ...d, name: st.name, description: st.description, status: st.status, endsAt: st.endsAt,
      currentPriceCents: st.currentPriceCents, bidCount: st.bidCount,
      canCancel: st.status === 'SCHEDULED' || (st.status === 'LIVE' && st.bidCount === 0),
      canRelist: st.status === 'ENDED_NO_BIDS' || st.status === 'CANCELLED',
    } : d));
  }

  if (notFound) return <div className="card p-10 text-center">Leilão não encontrado. <Link to="/" className="text-brand-600">Voltar</Link></div>;
  if (!detail) return <p className="text-slate-500">Carregando…</p>;

  const isSeller = user?.id === detail.seller.id;
  const status = room?.status ?? detail.status;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      {/* Coluna do item */}
      <section className="space-y-4">
        <div className="card overflow-hidden">
          <div className="aspect-[4/3] bg-slate-100">
            {detail.photos[photo] && <img src={detail.photos[photo]} alt={detail.name} className="h-full w-full object-contain" />}
          </div>
          <div className="flex gap-2 overflow-x-auto p-3">
            {detail.photos.map((p, i) => (
              <button key={p} onClick={() => setPhoto(i)} className={`h-16 w-20 shrink-0 overflow-hidden rounded-md ring-2 ${i === photo ? 'ring-brand-500' : 'ring-transparent'}`}>
                <img src={p} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
        <div className="card space-y-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={status} />
            <span className="text-sm text-slate-500">{detail.category}</span>
          </div>
          <h1 className="text-2xl font-bold">{detail.name}</h1>
          <p className="whitespace-pre-line text-slate-700">{detail.description}</p>
          <dl className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-sm">
            <div>
              <dt className="text-slate-500">Comitente</dt>
              <dd className="font-medium"><Link to={`/usuarios/${detail.seller.id}`} className="text-brand-600 hover:underline">{detail.seller.displayName}</Link></dd>
            </div>
            <div><dt className="text-slate-500">Preço inicial</dt><dd className="font-medium">{money(detail.startPriceCents)}</dd></div>
            <div><dt className="text-slate-500">Início</dt><dd className="font-medium">{dateTime(detail.startsAt)}</dd></div>
            <div><dt className="text-slate-500">Término</dt><dd className="font-medium">{dateTime(room?.endsAt ?? detail.endsAt)}</dd></div>
          </dl>
          {isSeller && <SellerActions detail={detail} onChanged={loadDetail} />}
        </div>
      </section>

      {/* Coluna da sala */}
      <aside className="space-y-4">
        {!user ? (
          <div className="card space-y-3 p-5 text-center">
            <p className="font-semibold">Entre para acompanhar a sala ao vivo e dar lances.</p>
            <Link to="/entrar" state={{ from: loc.pathname }} className="btn-primary w-full">Entrar</Link>
          </div>
        ) : !room ? (
          <div className="card p-5 text-slate-500">Conectando à sala…</div>
        ) : (
          <>
            {!online && (
              <div className="rounded-lg bg-amber-100 px-4 py-2 text-sm text-amber-900">Conexão perdida. Reconectando… o estado será atualizado ao voltar.</div>
            )}
            <ModeBar
              id={id} mode={mode} presence={presence} isSeller={isSeller} live={room.status === 'LIVE' || room.status === 'SCHEDULED'}
              onMode={(m) => { wantedMode.current = m; setMode(m); }}
            />
            <RoomPanel room={room} me={user.id} isSeller={isSeller} mode={mode} />
          </>
        )}
      </aside>
    </div>
  );
}

/** RF25: participantes x espectadores e troca de modo sem sair da sala. */
function ModeBar({ id, mode, presence, isSeller, live, onMode }: {
  id: string; mode: RoomMode; presence: Presence | null; isSeller: boolean; live: boolean;
  onMode: (m: RoomMode) => void;
}) {
  const socket = useSocket();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  function change(next: RoomMode) {
    if (!socket) return;
    setBusy(true);
    socket.timeout(5000).emit('room:mode', { auctionId: id, mode: next }, (err: Error | null, r: JoinAck) => {
      setBusy(false);
      if (err || !r?.ok) return toast('err', r?.message ?? 'Não foi possível trocar o modo.');
      onMode(r.mode ?? next);
    });
  }

  return (
    <div className="card flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
      <div className="flex gap-3 text-slate-600">
        <span title="Podem dar lances">🙋 <strong>{presence?.participants ?? '—'}</strong> participante(s)</span>
        <span title="Só assistem">👀 <strong>{presence?.spectators ?? '—'}</strong> espectador(es)</span>
      </div>
      {isSeller ? (
        <span className="text-xs text-slate-500">Você assiste como comitente</span>
      ) : live && (
        mode === 'participant'
          ? <button className="btn-secondary px-3 py-1" disabled={busy} onClick={() => change('spectator')}>Só assistir</button>
          : <button className="btn-primary px-3 py-1" disabled={busy} onClick={() => change('participant')}>Quero participar</button>
      )}
    </div>
  );
}

function RoomPanel({ room, me, isSeller, mode }: { room: RoomState; me: string; isSeller: boolean; mode: RoomMode }) {
  const live = room.status === 'LIVE';
  const iAmLeader = room.leaderId === me;

  return (
    <div className="card divide-y divide-slate-100">
      <div className="space-y-3 p-5">
        {room.status === 'SCHEDULED' && (
          <div className="text-center">
            <div className="text-sm text-slate-500">Abre em</div>
            <Countdown targetIso={room.startsAt} className="text-3xl font-bold" />
          </div>
        )}
        {live && (
          <div className="text-center">
            <div className="text-sm text-slate-500">Termina em</div>
            <Countdown targetIso={room.endsAt} className="text-3xl font-bold" />
          </div>
        )}
        {room.status === 'SOLD' && (
          <div className="rounded-lg bg-brand-50 p-4 text-center">
            <div className="text-sm font-semibold text-brand-700">VENDIDO</div>
            <div className="text-2xl font-bold">{money(room.finalPriceCents)}</div>
            <div className="text-sm text-slate-600">
              Vencedor: <strong>{room.winnerId === me ? 'você! 🎉' : room.winnerAlias}</strong>
            </div>
          </div>
        )}
        {room.status === 'ENDED_NO_BIDS' && <div className="rounded-lg bg-slate-100 p-4 text-center font-semibold">Encerrado sem lances</div>}
        {room.status === 'CANCELLED' && <div className="rounded-lg bg-red-50 p-4 text-center font-semibold text-red-700">Leilão cancelado</div>}

        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-xs text-slate-500">{room.bidCount ? 'Preço atual' : 'Preço inicial'}</div>
            <div className="text-xl font-bold">{money(room.currentPriceCents ?? room.startPriceCents)}</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Lance mínimo</div>
            <div className="text-xl font-bold">{money(room.minNextCents)}</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Líder</div>
            <div className="font-semibold">{iAmLeader ? 'Você' : room.leaderAlias ?? '—'}</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Total de lances</div>
            <div className="font-semibold">{room.bidCount}</div>
          </div>
        </div>

        {live && !isSeller && mode === 'participant' && <BidForm room={room} iAmLeader={iAmLeader} />}
        {live && !isSeller && mode === 'spectator' && (
          <p className="text-center text-sm text-slate-500">Você está só assistindo. Clique em “Quero participar” para dar lances.</p>
        )}
        {live && isSeller && <p className="text-center text-sm text-slate-500">Você é o comitente e não pode dar lances neste leilão.</p>}
      </div>

      <div className="p-5">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Últimos lances</h3>
        {room.recentBids.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum lance ainda.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {room.recentBids.map((b, i) => (
              <li key={b.id} className={`flex justify-between rounded-md px-2 py-1 ${i === 0 ? 'bg-emerald-50' : ''}`}>
                <span>{b.bidderId === me ? 'Você' : b.bidderAlias}</span>
                <span className="font-semibold">{money(b.amountCents)}</span>
                <span className="text-slate-500">{new Date(b.at).toLocaleTimeString('pt-BR')}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function BidForm({ room, iAmLeader }: { room: RoomState; iAmLeader: boolean }) {
  const toast = useToast();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  // RF12: a mesma tentativa reaproveita a mesma chave em caso de falha de rede.
  const pending = useRef<{ cents: number; key: string } | null>(null);

  async function send(cents: number) {
    const key = pending.current?.cents === cents ? pending.current.key : crypto.randomUUID();
    pending.current = { cents, key };
    setBusy(true);
    try {
      const r = await post<BidResponse>(`/api/auctions/${room.id}/bids`, { amountCents: cents, idempotencyKey: key });
      pending.current = null;
      if (r.accepted) {
        toast('ok', r.replay ? `Lance de ${money(r.bid.amountCents)} já estava registrado.` : `Lance de ${money(cents)} aceito!`);
        setValue('');
      }
    } catch (e) {
      if (e instanceof ApiError && e.body && (e.body as BidResponse).accepted === false) {
        pending.current = null; // recusa definitiva
        const b = e.body as Extract<BidResponse, { accepted: false }>;
        toast('err', `${b.message}${b.minNextCents ? ` Lance mínimo atual: ${money(b.minNextCents)}.` : ''}`);
      } else if (e instanceof ApiError && e.status === 401) {
        toast('err', 'Sua sessão expirou. Entre de novo e reenvie: o lance não será duplicado.');
      } else {
        toast('err', 'Falha de rede. Tente de novo: o mesmo lance não será duplicado.');
      }
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const cents = parseMoneyToCents(value);
    if (cents == null) return toast('err', 'Valor inválido. Ex.: 150,00');
    void send(cents);
  }

  if (iAmLeader) {
    return <p className="rounded-lg bg-emerald-50 p-3 text-center text-sm font-semibold text-emerald-800">Você é o líder! Aguarde outros lances.</p>;
  }

  return (
    <div className="space-y-2">
      <button className="btn-primary w-full py-3 text-base" disabled={busy} onClick={() => void send(room.minNextCents)}>
        Dar lance de {money(room.minNextCents)}
      </button>
      <form onSubmit={submit} className="flex gap-2">
        <input className="input" inputMode="decimal" placeholder="Outro valor (R$)" value={value} onChange={(e) => setValue(e.target.value)} />
        <button className="btn-secondary shrink-0" disabled={busy}>Enviar</button>
      </form>
    </div>
  );
}

/** RF08, RF23, RF28: só aparecem as ações que a situação atual permite (o servidor revalida). */
function SellerActions({ detail, onChanged }: { detail: AuctionDetail; onChanged: () => void }) {
  const toast = useToast();
  const editLabel = detail.editPolicy === 'APPEND_DESCRIPTION' ? 'Acrescentar à descrição' : 'Editar';
  if (detail.editPolicy === 'NONE' && !detail.canCancel && !detail.canRelist) return null;
  return (
    <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
      {detail.editPolicy !== 'NONE' && <Link to={`/leiloes/${detail.id}/editar`} className="btn-secondary">{editLabel}</Link>}
      {detail.canRelist && <Link to={`/leiloes/${detail.id}/relistar`} className="btn-primary">Relistar item</Link>}
      {detail.canCancel && (
        <button className="btn-danger" onClick={async () => {
          if (!confirm('Cancelar este leilão? Ele continuará registrado como Cancelado.')) return;
          try {
            await post<AuctionDetail>(`/api/auctions/${detail.id}/cancel`);
            toast('ok', 'Leilão cancelado.');
            onChanged();
          } catch (e) {
            toast('err', e instanceof ApiError ? e.message : 'Erro ao cancelar.');
          }
        }}>Cancelar leilão</button>
      )}
      {detail.editPolicy === 'NONE' && detail.status === 'SCHEDULED' && (
        <span className="self-center text-xs text-slate-500">Edição bloqueada: faltam 30 min ou menos para o início.</span>
      )}
    </div>
  );
}
