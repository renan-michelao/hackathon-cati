import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError, type AppConfig } from '../lib/api';
import { parseMoneyToCents } from '../lib/format';

export interface AuctionFormValues {
  name: string;
  description: string;
  category: string;
  priceCents: number | null;
  startsAt: Date;
  durationMin: number;
}

/** valor para <input type="datetime-local"> no fuso do navegador */
function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const centsToInput = (c: number | null) => (c == null ? '' : (c / 100).toFixed(2).replace('.', ','));

/**
 * Formulário de leilão usado em três lugares (RF05, RF23, RF28):
 *  - create: tudo obrigatório, inclusive as fotos;
 *  - edit:   começa preenchido; fotos opcionais (se enviadas, substituem as atuais);
 *  - relist: começa preenchido com o item; início e duração novos; fotos opcionais.
 */
export function AuctionForm({ mode, initial, title, submitLabel, onSubmit }: {
  mode: 'create' | 'edit' | 'relist';
  initial?: Partial<AuctionFormValues>;
  title: string;
  submitLabel: string;
  onSubmit: (fd: FormData) => Promise<void>;
}) {
  const nav = useNavigate();
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [price, setPrice] = useState(centsToInput(initial?.priceCents ?? null));
  const [startsAt, setStartsAt] = useState(toLocalInput(initial?.startsAt ?? new Date(Date.now() + 2 * 60_000)));
  const [durationMin, setDurationMin] = useState(String(initial?.durationMin ?? 3));
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<AppConfig>('/api/config').then(setCfg);
  }, []);

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach(URL.revokeObjectURL), [previews]);

  const L = cfg?.limits;
  const photosRequired = mode === 'create';

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const cents = parseMoneyToCents(price);
    if (cents == null) return setError('Preço inicial inválido. Ex.: 150,00');
    if (L && (photosRequired || files.length > 0) && files.length < L.photosMin) {
      return setError(`Envie pelo menos ${L.photosMin} fotos.`);
    }
    const fd = new FormData();
    fd.set('name', name);
    fd.set('description', description);
    fd.set('category', category);
    fd.set('startPriceCents', String(cents));
    fd.set('startsAt', new Date(startsAt).toISOString()); // fuso local -> UTC
    fd.set('durationSec', String(Math.round(Number(durationMin) * 60)));
    files.forEach((f) => fd.append('photos', f));
    setBusy(true);
    try {
      await onSubmit(fd);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card mx-auto max-w-2xl space-y-5 p-6">
      <h1 className="text-xl font-bold">{title}</h1>

      <div>
        <label className="label" htmlFor="name">Nome do item</label>
        <input id="name" className="input" required minLength={3} maxLength={L?.nameMax} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="desc">Descrição</label>
        <textarea id="desc" className="input min-h-28" required minLength={10} maxLength={L?.descriptionMax} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="cat">Categoria</label>
          <select id="cat" className="input" required value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="" disabled>Escolha…</option>
            {cfg?.categories.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="price">Preço inicial (R$)</label>
          <input id="price" className="input" required inputMode="decimal" placeholder="150,00" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="start">Início</label>
          <input id="start" type="datetime-local" className="input" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          {L && <p className="mt-1 text-xs text-slate-500">Pelo menos {L.leadMinSec}s no futuro.</p>}
        </div>
        <div>
          <label className="label" htmlFor="dur">Duração (minutos)</label>
          <input id="dur" type="number" className="input" required step="1"
            min={L ? L.durationMinSec / 60 : 1} max={L ? L.durationMaxSec / 60 : undefined}
            value={durationMin} onChange={(e) => setDurationMin(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="photos">
          {photosRequired ? 'Fotos' : 'Fotos novas (opcional: substituem as atuais)'}
          {L && ` — ${L.photosMin} a ${L.photosMax}, até ${L.photoMaxBytes / 1024 / 1024} MB cada; JPEG, PNG ou WebP`}
        </label>
        <input id="photos" type="file" multiple accept="image/jpeg,image/png,image/webp" className="input"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
        {previews.length > 0 && (
          <div className="mt-3 grid grid-cols-4 gap-2">
            {previews.map((src, i) => <img key={src} src={src} alt={`foto ${i + 1}`} className="aspect-square rounded-lg object-cover" />)}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={() => nav(-1)}>Voltar</button>
        <button className="btn-primary" disabled={busy}>{busy ? 'Enviando…' : submitLabel}</button>
      </div>
    </form>
  );
}
