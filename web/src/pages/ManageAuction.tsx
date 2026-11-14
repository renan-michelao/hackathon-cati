import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError, patch, post, type AuctionDetail } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { AuctionForm, type AuctionFormValues } from '../components/AuctionForm';

function useOwnAuction() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const [detail, setDetail] = useState<AuctionDetail | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api<AuctionDetail>(`/api/auctions/${id}`).then(setDetail).catch(() => setError('Leilão não encontrado.'));
  }, [id]);
  const notOwner = detail && user && detail.seller.id !== user.id;
  return { id, detail, error: error || (notOwner ? 'Só o comitente pode alterar este leilão.' : '') };
}

function valuesFrom(d: AuctionDetail): Partial<AuctionFormValues> {
  return {
    name: d.name,
    description: d.description,
    category: d.category,
    priceCents: d.startPriceCents,
    startsAt: new Date(d.startsAt),
    durationMin: Math.round((new Date(d.endsAt).getTime() - new Date(d.startsAt).getTime()) / 60_000),
  };
}

function Message({ text, id }: { text: string; id?: string }) {
  return (
    <div className="card mx-auto max-w-xl space-y-3 p-6 text-center">
      <p>{text}</p>
      {id && <Link to={`/leiloes/${id}`} className="btn-secondary">Voltar ao leilão</Link>}
    </div>
  );
}

// RF23: a tela mostra só o que a política da situação atual permite (o servidor revalida).
export function EditAuction() {
  const { id, detail, error } = useOwnAuction();
  const nav = useNavigate();
  const toast = useToast();
  const [append, setAppend] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  if (error) return <Message text={error} id={detail?.id} />;
  if (!detail) return <p className="text-slate-500">Carregando…</p>;

  if (detail.editPolicy === 'NONE') {
    const why = detail.status === 'SCHEDULED'
      ? 'Faltam 30 minutos ou menos para o início: o leilão não pode mais ser editado. Ainda dá para cancelar.'
      : 'Leilões encerrados ou cancelados não podem ser editados.';
    return <Message text={why} id={id} />;
  }

  if (detail.editPolicy === 'APPEND_DESCRIPTION') {
    async function submit(e: FormEvent) {
      e.preventDefault();
      const fd = new FormData();
      fd.set('appendDescription', append);
      setBusy(true);
      setFormError('');
      try {
        await patch<AuctionDetail>(`/api/auctions/${id}`, fd);
        toast('ok', 'Texto acrescentado à descrição.');
        nav(`/leiloes/${id}`);
      } catch (err) {
        setFormError(err instanceof ApiError ? err.message : 'Erro ao salvar.');
      } finally {
        setBusy(false);
      }
    }
    return (
      <form onSubmit={submit} className="card mx-auto max-w-2xl space-y-4 p-6">
        <h1 className="text-xl font-bold">Acrescentar à descrição</h1>
        <p className="text-sm text-slate-600">
          Com o leilão em andamento, só é possível <strong>acrescentar</strong> informações: nada do que os compradores já viram muda.
        </p>
        <blockquote className="whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{detail.description}</blockquote>
        <textarea className="input min-h-24" required maxLength={1000} placeholder="Ex.: acompanha caixa original." value={append} onChange={(e) => setAppend(e.target.value)} />
        {formError && <p className="text-sm text-red-600">{formError}</p>}
        <div className="flex justify-end gap-2">
          <Link to={`/leiloes/${id}`} className="btn-secondary">Voltar</Link>
          <button className="btn-primary" disabled={busy || !append.trim()}>{busy ? 'Salvando…' : 'Acrescentar'}</button>
        </div>
      </form>
    );
  }

  return (
    <AuctionForm
      mode="edit"
      title="Editar leilão"
      submitLabel="Salvar alterações"
      initial={valuesFrom(detail)}
      onSubmit={async (fd) => {
        await patch<AuctionDetail>(`/api/auctions/${id}`, fd);
        toast('ok', 'Leilão atualizado.');
        nav(`/leiloes/${id}`);
      }}
    />
  );
}

// RF28: novo leilão para o mesmo item, a partir de um Encerrado sem lances ou Cancelado.
export function RelistAuction() {
  const { id, detail, error } = useOwnAuction();
  const nav = useNavigate();
  const toast = useToast();

  if (error) return <Message text={error} id={detail?.id} />;
  if (!detail) return <p className="text-slate-500">Carregando…</p>;
  if (!detail.canRelist) return <Message text="Só leilões Encerrados sem lances ou Cancelados podem ser relistados." id={id} />;

  return (
    <AuctionForm
      mode="relist"
      title="Relistar item"
      submitLabel="Criar novo leilão"
      initial={{ ...valuesFrom(detail), startsAt: new Date(Date.now() + 2 * 60_000) }}
      onSubmit={async (fd) => {
        const a = await post<AuctionDetail>(`/api/auctions/${id}/relist`, fd);
        toast('ok', 'Novo leilão criado. O anterior continua registrado.');
        nav(`/leiloes/${a.id}`);
      }}
    />
  );
}
