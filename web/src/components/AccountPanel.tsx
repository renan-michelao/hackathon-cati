import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError, post, type User } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { Avatar } from './Avatar';

const errMsg = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

/** "Minha conta": aparece só no perfil do próprio usuário logado. */
export function AccountPanel({ user }: { user: User }) {
  const { setCurrentUser, logout } = useAuth();
  const toast = useToast();
  const nav = useNavigate();

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <PhotoCard user={user} onChange={setCurrentUser} />
      <div className="card divide-y divide-slate-100">
        <section className="space-y-1 p-5">
          <h2 className="text-lg font-bold">Minha conta</h2>
          <dl className="grid gap-3 pt-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">E-mail</dt>
              <dd className="font-medium text-slate-800">{user.email}</dd>
              <dd className="text-xs text-slate-500">Só você vê o seu e-mail.</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">Na plataforma desde</dt>
              <dd className="font-medium text-slate-800">{new Date(user.createdAt).toLocaleDateString('pt-BR', { dateStyle: 'long' })}</dd>
            </div>
          </dl>
        </section>
        <NameForm user={user} onSaved={(u) => { setCurrentUser(u); toast('ok', 'Apelido atualizado.'); }} />
        <PasswordForm onSaved={() => toast('ok', 'Senha alterada. As sessões em outros navegadores foram encerradas.')} />
        <section className="flex flex-wrap items-center justify-between gap-3 p-5">
          <Link to="/minhas-participacoes" className="btn-secondary">Minhas participações</Link>
          <button className="btn-danger" onClick={async () => { await logout(); nav('/'); }}>Sair da conta</button>
        </section>
      </div>
    </div>
  );
}

function PhotoCard({ user, onChange }: { user: User; onChange: (u: User) => void }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    const fd = new FormData();
    fd.set('avatar', file);
    setBusy(true);
    try {
      const r = await api<{ user: User }>('/api/me/avatar', { method: 'PUT', body: fd });
      onChange(r.user);
      toast('ok', 'Foto de perfil atualizada.');
    } catch (e) {
      toast('err', errMsg(e, 'Não foi possível enviar a foto.'));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const r = await api<{ user: User }>('/api/me/avatar', { method: 'DELETE' });
      onChange(r.user);
      toast('ok', 'Foto removida.');
    } catch (e) {
      toast('err', errMsg(e, 'Não foi possível remover a foto.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card flex flex-col items-center gap-3 p-6 text-center">
      <Avatar name={user.displayName} url={user.avatarUrl} size={112} className="ring-4" />
      <div>
        <div className="text-lg font-bold">{user.displayName}</div>
        <div className="text-xs text-slate-500">JPEG, PNG ou WebP, até 5 MB</div>
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? 'Enviando…' : user.avatarUrl ? 'Trocar foto' : 'Adicionar foto'}
        </button>
        {user.avatarUrl && <button className="btn-secondary" disabled={busy} onClick={() => void remove()}>Remover</button>}
      </div>
    </div>
  );
}

function NameForm({ user, onSaved }: { user: User; onSaved: (u: User) => void }) {
  const [name, setName] = useState(user.displayName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const changed = name.trim() !== user.displayName;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api<{ user: User }>('/api/me', { method: 'PATCH', body: JSON.stringify({ displayName: name }) });
      onSaved(r.user);
    } catch (err) {
      setError(errMsg(err, 'Não foi possível salvar.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2 p-5">
      <label className="label" htmlFor="apelido">Apelido (nome de exibição)</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input id="apelido" className="input" required minLength={2} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary shrink-0" disabled={busy || !changed}>{busy ? 'Salvando…' : 'Salvar apelido'}</button>
      </div>
      <p className="text-xs text-slate-500">Nas salas, os outros veem só parte dele (ex.: "Re***o").</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}

function PasswordForm({ onSaved }: { onSaved: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (next !== confirm) return setError('A confirmação não confere com a nova senha.');
    setBusy(true);
    try {
      await post('/api/me/password', { currentPassword: current, newPassword: next });
      setCurrent(''); setNext(''); setConfirm('');
      onSaved();
    } catch (err) {
      setError(errMsg(err, 'Não foi possível alterar a senha.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 p-5">
      <h3 className="label">Alterar senha</h3>
      <div className="grid gap-2 sm:grid-cols-3">
        <input className="input" type="password" required placeholder="Senha atual" autoComplete="current-password"
          value={current} onChange={(e) => setCurrent(e.target.value)} />
        <input className="input" type="password" required minLength={8} placeholder="Nova senha (mín. 8)" autoComplete="new-password"
          value={next} onChange={(e) => setNext(e.target.value)} />
        <input className="input" type="password" required minLength={8} placeholder="Confirme a nova senha" autoComplete="new-password"
          value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">Ao trocar, as sessões em outros navegadores são encerradas.</p>
        <button className="btn-primary shrink-0" disabled={busy}>{busy ? 'Alterando…' : 'Alterar senha'}</button>
      </div>
    </form>
  );
}
