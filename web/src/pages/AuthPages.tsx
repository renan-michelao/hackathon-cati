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

        {/* Card: Novo no Kernel Panic? */}
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
              title="Sua sessão será preservada neste navegador (RF02)."
            >
              ⓘ
            </span>
          </div>
        </form>

        {/* Divisor "ou" */}
        <div className="relative flex items-center justify-center py-2">
          <div className="w-full border-t border-slate-200" />
          <span className="absolute bg-white px-3 text-xs text-slate-400 uppercase tracking-widest font-medium">
            ou
          </span>
        </div>

        {/* Botões Sociais */}
        <div className="space-y-2.5">
          {/* Continuar com Google */}
          <button
            type="button"
            onClick={() => fillDemo('bruno@demo.com')}
            className="flex w-full items-center justify-center gap-3 rounded-full border border-slate-300 bg-white py-2.5 px-4 text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 cursor-pointer"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continuar com Google</span>
          </button>

          {/* Continuar com Apple ID */}
          <button
            type="button"
            onClick={() => fillDemo('carla@demo.com')}
            className="flex w-full items-center justify-center gap-3 rounded-full border border-slate-300 bg-white py-2.5 px-4 text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 cursor-pointer"
          >
            <svg className="h-4 w-4 fill-current text-black" viewBox="0 0 24 24">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.42c.62-.75 1.04-1.8 0.93-2.85-.9.04-1.99.6-2.61 1.33-.55.63-.99 1.67-.86 2.69.99.08 2.02-.52 2.54-1.17z" />
            </svg>
            <span>Continuar com Apple ID</span>
          </button>

          {/* Continuar com Facebook */}
          <button
            type="button"
            onClick={() => fillDemo('ana@demo.com')}
            className="flex w-full items-center justify-center gap-3 rounded-full border border-slate-300 bg-white py-2.5 px-4 text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 cursor-pointer"
          >
            <svg className="h-4 w-4 fill-[#1877F2]" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            <span>Continuar com Facebook</span>
          </button>
        </div>

        {/* Atalhos de Contas Demo (Prático para o Hackathon) */}
        <div className="pt-2 text-center">
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
