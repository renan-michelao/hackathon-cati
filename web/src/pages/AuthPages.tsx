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
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between text-slate-900 relative">
      {/* Topo Limpo com Logo FGR Leilões */}
      <header className="border-b border-slate-200/90 bg-white py-3.5 px-6 sm:px-12">
        <Link to="/" className="inline-flex items-center gap-2.5 text-lg font-bold text-slate-900 hover:opacity-90">
          <span className="text-xl">🔨</span>
          <span className="tracking-tight">FGR Leilões</span>
        </Link>
      </header>

      {/* Conteúdo Central: Card Branco Flutuante */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-[440px] bg-white rounded-3xl p-7 sm:p-9 shadow-sm border border-slate-200/70 space-y-5">
          {/* Título Principal */}
          <h1 className="text-2xl sm:text-[26px] font-extrabold tracking-tight text-slate-900 text-left">
            Entrar na conta
          </h1>

          {/* Card: Novo no FGR Leilões? */}
          <div className="flex items-center justify-between rounded-2xl bg-slate-100/90 px-4 py-2.5 text-xs sm:text-sm text-slate-700">
            <span>Novo no FGR Leilões?</span>
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
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
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
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
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
              className="w-full rounded-full bg-brand-600 py-3 px-4 text-sm font-semibold text-white shadow-xs transition hover:bg-brand-700 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
            >
              {busy ? 'Entrando…' : 'Entrar'}
            </button>

            {/* Sessão: dura 2h sem uso e se renova sozinha enquanto a pessoa usa o site (RF02) */}
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>A sessão se renova enquanto você usa o site.</span>
              <Link to="/esqueci-senha" className="font-semibold text-brand-600 hover:underline">Esqueci minha senha</Link>
            </div>
          </form>

          {/* Atalho Contas de Demonstração */}
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => setShowDemoUsers(!showDemoUsers)}
              className="text-xs text-slate-500 hover:text-slate-800 underline transition cursor-pointer"
            >
              Preencher com conta de demonstração
            </button>

            {showDemoUsers && (
              <div className="mt-3 flex flex-wrap justify-center gap-1.5 animate-in fade-in">
                <button
                  type="button"
                  onClick={() => fillDemo('ana@demo.com')}
                  className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                >
                  Ana (Comitente)
                </button>
                <button
                  type="button"
                  onClick={() => fillDemo('bruno@demo.com')}
                  className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                >
                  Bruno (Comprador)
                </button>
                <button
                  type="button"
                  onClick={() => fillDemo('carla@demo.com')}
                  className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                >
                  Carla (Compradora)
                </button>
                <button
                  type="button"
                  onClick={() => fillDemo('diego@demo.com')}
                  className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                >
                  Diego (Comprador)
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Rodapé da Página */}
      <footer className="py-6 px-4 text-center text-[10px] sm:text-[11px] text-slate-400 leading-relaxed max-w-2xl mx-auto">
        FGR Leilões · simulação de leilão online feita pela equipe Kernel Panic no Hackathon Cati Jr. Nenhuma transação é real.
      </footer>
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
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between text-slate-900 relative">
      <header className="border-b border-slate-200/90 bg-white py-3.5 px-6 sm:px-12">
        <Link to="/" className="inline-flex items-center gap-2.5 text-lg font-bold text-slate-900 hover:opacity-90">
          <span className="text-xl">🔨</span>
          <span className="tracking-tight">FGR Leilões</span>
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-[440px] bg-white rounded-3xl p-7 sm:p-9 shadow-sm border border-slate-200/70 space-y-5">
          <h1 className="text-2xl sm:text-[26px] font-extrabold tracking-tight text-slate-900 text-left">
            Criar conta
          </h1>

          <div className="flex items-center justify-between rounded-2xl bg-slate-100/90 px-4 py-2.5 text-xs sm:text-sm text-slate-700">
            <span>Já tem conta no FGR Leilões?</span>
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
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
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
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
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
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
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
              className="w-full rounded-full bg-brand-600 py-3 px-4 text-sm font-semibold text-white shadow-xs transition hover:bg-brand-700 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
            >
              {busy ? 'Criando…' : 'Criar conta'}
            </button>
          </form>
        </div>
      </main>

      <footer className="py-6 px-4 text-center text-[10px] sm:text-[11px] text-slate-400 leading-relaxed max-w-2xl mx-auto">
        FGR Leilões · simulação de leilão online feita pela equipe Kernel Panic no Hackathon Cati Jr. Nenhuma transação é real.
      </footer>

    </div>
  );
}