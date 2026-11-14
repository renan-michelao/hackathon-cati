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
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showDemoUsers, setShowDemoUsers] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
      nav(to, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'E-mail ou senha incorretos.');
    } finally {
      setBusy(false);
    }
  }

  const fillDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('demo1234');
    setError('');
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-between px-4 py-8 relative">
      <div className="mx-auto w-full max-w-[400px] pt-4 sm:pt-10 space-y-5">
        {/* Título Principal */}
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 text-left">
          Entrar na conta
        </h1>

        {/* Card: Novo no FGR Leilões? */}
        <div className="flex items-center justify-between rounded-2xl bg-slate-100/80 px-4 py-2.5 text-xs sm:text-sm text-slate-700">
          <span>Novo no Kernel Panic?</span>
          <Link
            to="/cadastro"
            state={{ from: to }}
            className="rounded-full border border-slate-300 bg-white px-3.5 py-1 text-xs font-semibold text-slate-800 shadow-2xs hover:bg-slate-50 transition"
          >
            Criar conta
          </Link>
        </div>

        {/* Formulário de Login */}
        <form onSubmit={submit} className="space-y-4">
          <div>
            <input
              id="email"
              type="email"
              placeholder="E-mail"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <input
              id="pw"
              type="password"
              placeholder="Senha"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-600 border border-red-200">
              {error}
            </div>
          )}

          {/* Botão Entrar */}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-blue-600 py-3 px-4 text-sm font-semibold text-white shadow-xs transition hover:bg-blue-700 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
          >
            {busy ? 'Entrando…' : 'Entrar'}
          </button>

          {/* Checkbox Permanecer conectado */}
          <div className="flex items-center gap-2 pt-1 text-xs sm:text-sm text-slate-700 select-none">
            <input
              type="checkbox"
              id="remember"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="remember" className="cursor-pointer font-medium">
              Permanecer conectado
            </label>
            <span
              className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:text-slate-600 cursor-help text-xs"
              title="Sua sessão será preservada neste navegador."
            >
              ⓘ
            </span>
          </div>
        </form>

        {/* Atalhos de Contas Demo (Prático para o Hackathon) */}
        <div className="pt-4 text-center">
          <button
            type="button"
            onClick={() => setShowDemoUsers(!showDemoUsers)}
            className="text-[11px] font-medium text-slate-400 hover:text-slate-600 transition underline cursor-pointer"
          >
            {showDemoUsers ? 'Ocultar contas demo' : 'Preencher com conta de demonstração'}
          </button>

          {showDemoUsers && (
            <div className="mt-2 flex flex-wrap justify-center gap-1.5 animate-in fade-in">
              <button
                type="button"
                onClick={() => fillDemo('ana@demo.com')}
                className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
              >
                Ana (Comitente)
              </button>
              <button
                type="button"
                onClick={() => fillDemo('bruno@demo.com')}
                className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
              >
                Bruno (Comprador)
              </button>
              <button
                type="button"
                onClick={() => fillDemo('carla@demo.com')}
                className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
              >
                Carla (Compradora)
              </button>
              <button
                type="button"
                onClick={() => fillDemo('diego@demo.com')}
                className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
              >
                Diego (Comprador)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Rodapé da Página */}
      <footer className="mt-12 text-center text-[10px] sm:text-[11px] text-slate-400 leading-relaxed max-w-2xl mx-auto">
        Copyright © 1995-2026 Kernel Panic Leilões Inc. Todos os direitos reservados.{' '}
        <span className="underline cursor-pointer hover:text-slate-600">Contrato do Usuário</span>,{' '}
        <span className="underline cursor-pointer hover:text-slate-600">Privacidade</span>,{' '}
        <span className="underline cursor-pointer hover:text-slate-600">Termos de Uso de Pagamentos</span>,{' '}
        <span className="underline cursor-pointer hover:text-slate-600">Cookies</span> e{' '}
        <span className="underline cursor-pointer hover:text-slate-600">AdChoice</span>.
      </footer>

      {/* Botão Flutuante de Ajuda (?) */}
      <button
        type="button"
        title="Ajuda"
        className="fixed bottom-6 right-6 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md hover:bg-slate-50 transition font-bold text-sm cursor-pointer"
      >
        ?
      </button>
    </div>
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
    <div className="min-h-screen bg-white flex flex-col justify-between px-4 py-8 relative">
      <div className="mx-auto w-full max-w-[400px] pt-4 sm:pt-10 space-y-5">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 text-left">
          Criar conta
        </h1>

        <div className="flex items-center justify-between rounded-2xl bg-slate-100/80 px-4 py-2.5 text-xs sm:text-sm text-slate-700">
          <span>Já tem conta no Kernel Panic?</span>
          <Link
            to="/entrar"
            state={{ from: to }}
            className="rounded-full border border-slate-300 bg-white px-3.5 py-1 text-xs font-semibold text-slate-800 shadow-2xs hover:bg-slate-50 transition"
          >
            Entrar
          </Link>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <input
              id="name"
              type="text"
              placeholder="Nome de exibição"
              required
              minLength={2}
              maxLength={60}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <input
              id="email"
              type="email"
              placeholder="E-mail"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <input
              id="pw"
              type="password"
              placeholder="Senha (mín. 8 caracteres)"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-600 border border-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-blue-600 py-3 px-4 text-sm font-semibold text-white shadow-xs transition hover:bg-blue-700 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
          >
            {busy ? 'Criando…' : 'Criar conta'}
          </button>
        </form>
      </div>

      <footer className="mt-12 text-center text-[10px] sm:text-[11px] text-slate-400 leading-relaxed max-w-2xl mx-auto">
        Copyright © 1995-2026 Kernel Panic Leilões Inc. Todos os direitos reservados.{' '}
        <span className="underline cursor-pointer hover:text-slate-600">Contrato do Usuário</span>,{' '}
        <span className="underline cursor-pointer hover:text-slate-600">Privacidade</span>,{' '}
        <span className="underline cursor-pointer hover:text-slate-600">Termos de Uso de Pagamentos</span>,{' '}
        <span className="underline cursor-pointer hover:text-slate-600">Cookies</span> e{' '}
        <span className="underline cursor-pointer hover:text-slate-600">AdChoice</span>.
      </footer>

      <button
        type="button"
        title="Ajuda"
        className="fixed bottom-6 right-6 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md hover:bg-slate-50 transition font-bold text-sm cursor-pointer"
      >
        ?
      </button>
    </div>
  );
}
