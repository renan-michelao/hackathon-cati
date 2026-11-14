import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type Participation, type PublicProfile, type SellerHit } from '../lib/api';
import { useSocket } from '../lib/socket';
import { dateTime, money, STATUS_LABEL } from '../lib/format';
import { AuctionCard } from '../components/AuctionCard';
import { Countdown } from '../components/Countdown';

const joinedAt = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

// RF22: busca de comitentes pelo nome.
export function SellersPage() {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<SellerHit[] | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (!term) return setItems(null);
    const t = setTimeout(() => {
      api<{ items: SellerHit[] }>(`/api/users?q=${encodeURIComponent(term)}`).then((r) => setItems(r.items));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Comitentes</h1>
      <input className="input" placeholder="Buscar pelo nome de exibição…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      {items === null ? (
        <p className="text-sm text-slate-500">Digite um nome para buscar quem anuncia na plataforma.</p>
      ) : items.length === 0 ? (
        <div className="card p-6 text-center text-slate-500">Nenhum comitente encontrado.</div>
      ) : (
        <ul className="card divide-y divide-slate-100">
          {items.map((u) => (
            <li key={u.id}>
              <Link to={`/usuarios/${u.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                <span className="font-medium">{u.displayName}</span>
                <span className="text-sm text-slate-500">{u.auctionCount} leilão(ões) · desde {joinedAt(u.createdAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// RF22: perfil público (sem e-mail, sem avaliações).
export function ProfilePage() {
  const { id = '' } = useParams();
  const [p, setP] = useState<PublicProfile | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api<PublicProfile>(`/api/users/${id}`).then(setP).catch(() => setNotFound(true));
  }, [id]);

  if (notFound) return <div className="card p-10 text-center">Usuário não encontrado.</div>;
  if (!p) return <p className="text-slate-500">Carregando…</p>;

  const sections = [
    { title: 'Em andamento', items: p.auctions.live },
    { title: 'Agendados', items: p.auctions.scheduled },
    { title: 'Passados', items: p.auctions.past },
  ];

  return (
    <div className="space-y-6">
      <div className="card flex items-center gap-4 p-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-xl font-bold text-brand-700">
          {p.displayName.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <h1 className="text-xl font-bold">{p.displayName}</h1>
          <p className="text-sm text-slate-500">Na plataforma desde {joinedAt(p.createdAt)}</p>
        </div>
      </div>
      {sections.map((s) => (
        <section key={s.title} className="space-y-3">
          <h2 className="text-lg font-semibold">{s.title} <span className="text-slate-400">({s.items.length})</span></h2>
          {s.items.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum leilão.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {s.items.map((a) => <AuctionCard key={a.id} a={a} />)}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

const SITUATION: Record<Participation['situation'], { label: string; style: string }> = {
  leader: { label: 'Você é o líder', style: 'bg-emerald-100 text-emerald-800' },
  outbid: { label: 'Superado', style: 'bg-amber-100 text-amber-800' },
  winner: { label: 'Você venceu 🎉', style: 'bg-brand-100 text-brand-700' },
};

// RF27: leilões em que dei lances e minha situação em cada um (atualiza ao vivo).
export function ParticipationsPage() {
  const socket = useSocket();
  const [items, setItems] = useState<Participation[] | null>(null);

  useEffect(() => {
    const load = () => api<{ items: Participation[] }>('/api/me/participations').then((r) => setItems(r.items));
    void load();
    if (!socket) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => { if (!t) t = setTimeout(() => { t = null; void load(); }, 500); };
    socket.on('listing:changed', refresh);
    socket.on('user:outbid', refresh);
    return () => { socket.off('listing:changed', refresh); socket.off('user:outbid', refresh); if (t) clearTimeout(t); };
  }, [socket]);

  if (!items) return <p className="text-slate-500">Carregando…</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">Minhas participações</h1>
      {items.length === 0 ? (
        <div className="card p-10 text-center text-slate-500">
          Você ainda não deu lances. <Link to="/" className="font-semibold text-brand-600">Ver leilões</Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((p) => (
            <li key={p.auctionId}>
              <Link to={`/leiloes/${p.auctionId}`} className="card flex gap-4 p-3 transition hover:shadow-md">
                <div className="h-20 w-24 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                  {p.coverUrl && <img src={p.coverUrl} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${SITUATION[p.situation].style}`}>{SITUATION[p.situation].label}</span>
                    <span className="text-xs text-slate-500">{STATUS_LABEL[p.status]}</span>
                  </div>
                  <h3 className="truncate font-semibold">{p.name}</h3>
                  <div className="flex flex-wrap gap-x-4 text-sm text-slate-600">
                    <span>Meu maior lance: <strong>{money(p.myBestCents)}</strong></span>
                    <span>Atual: <strong>{money(p.currentPriceCents)}</strong></span>
                    {p.status === 'LIVE'
                      ? <span>Termina em <Countdown targetIso={p.endsAt} className="font-semibold" /></span>
                      : <span>Terminou {dateTime(p.endsAt)}</span>}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
