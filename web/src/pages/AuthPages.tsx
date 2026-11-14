import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { ApiError } from '../lib/api';

function useRedirect() {
  const loc = useLocation();
  return (loc.state as { from?: string } | null)?.from ?? '/';
}

export function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const to = useRedirect();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
      nav(to, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao entrar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card mx-auto mt-8 max-w-sm space-y-4 p-6">
      <h1 className="text-xl font-bold">Entrar</h1>
      <div>
        <label className="label" htmlFor="email">E-mail</label>
        <input id="email" type="email" className="input" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="pw">Senha</label>
        <input id="pw" type="password" className="input" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
      <p className="text-center text-sm text-slate-600">
        Não tem conta? <Link to="/cadastro" state={{ from: to }} className="font-semibold text-brand-600">Cadastre-se</Link>
      </p>
    </form>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const nav = useNavigate();
  const to = useRedirect();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await register(displayName, email, password);
      nav(to, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao cadastrar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card mx-auto mt-8 max-w-sm space-y-4 p-6">
      <h1 className="text-xl font-bold">Criar conta</h1>
      <div>
        <label className="label" htmlFor="name">Nome de exibição</label>
        <input id="name" className="input" required minLength={2} maxLength={60} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="email">E-mail</label>
        <input id="email" type="email" className="input" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="pw">Senha (mín. 8 caracteres)</label>
        <input id="pw" type="password" className="input" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? 'Criando…' : 'Criar conta'}</button>
      <p className="text-center text-sm text-slate-600">
        Já tem conta? <Link to="/entrar" state={{ from: to }} className="font-semibold text-brand-600">Entrar</Link>
      </p>
    </form>
  );
}
