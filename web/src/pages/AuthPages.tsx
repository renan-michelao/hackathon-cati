import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { ApiError } from '../lib/api';
import { GavelIcon } from '../components/GavelIcon';

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
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showDemoMenu, setShowDemoMenu] = useState(false);

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

  function fillDemo(userEmail: string) {
    setEmail(userEmail);
    setPassword('demo1234');
    setError('');
    setShowDemoMenu(false);
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between text-slate-900 relative">
      {/* Topo Limpo com Logo FGR Leilões */}
      <header className="border-b border-slate-200/90 bg-white py-3.5 px-6 sm:px-12">
        <Link to="/" className="inline-flex items-center gap-2.5 text-lg font-bold text-slate-900 hover:opacity-90">
          <GavelIcon className="h-6 w-6 text-slate-900" />
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
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => alert('Para a demonstração do hackathon, utilize uma das contas de teste (senha demo1234).')}
                  className="text-xs text-slate-600 hover:text-slate-900 hover:underline cursor-pointer"
                >
                  Esqueci minha senha
                </button>
              </div>
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
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 accent-blue-600 cursor-pointer"
              />
              <label htmlFor="remember" className="cursor-pointer">
                Permanecer conectado
              </label>
              <span
                className="text-slate-400 hover:text-slate-600 cursor-help text-xs"
                title="Sua sessão renova automaticamente a cada requisição."
              >
                ⓘ
              </span>
            </div>

            {/* Preencher com conta de demonstração */}
            <div className="pt-2 text-center">
              <div className="relative inline-block text-left">
                <button
                  type="button"
                  onClick={() => setShowDemoMenu(!showDemoMenu)}
                  className="text-xs text-slate-500 hover:text-slate-800 underline transition cursor-pointer"
                >
                  Preencher com conta de demonstração
                </button>

                {showDemoMenu && (
                  <div className="absolute left-1/2 -translate-x-1/2 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-lg z-20 text-left">
                    <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Selecione uma conta:
                    </div>
                    <button
                      type="button"
                      onClick={() => fillDemo('ana@demo.com')}
                      className="w-full rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 text-left block"
                    >
                      👩‍💼 <strong>Ana</strong> (Comitente/Vendedora)
                    </button>
                    <button
                      type="button"
                      onClick={() => fillDemo('bruno@demo.com')}
                      className="w-full rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 text-left block"
                    >
                      🙋‍♂️ <strong>Bruno</strong> (Comprador)
                    </button>
                    <button
                      type="button"
                      onClick={() => fillDemo('carla@demo.com')}
                      className="w-full rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 text-left block"
                    >
                      🙋‍♀️ <strong>Carla</strong> (Comprador)
                    </button>
                    <button
                      type="button"
                      onClick={() => fillDemo('diego@demo.com')}
                      className="w-full rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 text-left block"
                    >
                      🙋‍♂️ <strong>Diego</strong> (Comprador)
                    </button>
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>
      </main>

      {/* Rodapé com Termos Legais */}
      <footer className="py-6 px-4 text-center text-[10px] sm:text-[11px] text-slate-400 leading-relaxed max-w-2xl mx-auto">
        Copyright © 1995-2026 FGR Leilões Inc. Todos os direitos reservados.{' '}
        <span className="underline cursor-pointer hover:text-slate-600">Contrato do Usuário</span>,{' '}
        <span className="underline cursor-pointer hover:text-slate-600">Privacidade</span>,{' '}
        <span className="underline cursor-pointer hover:text-slate-600">Termos de Uso de Pagamentos</span>,{' '}
        <span className="underline cursor-pointer hover:text-slate-600">Cookies</span> e{' '}
        <span className="underline cursor-pointer hover:text-slate-600">AdChoice</span>.
      </footer>

      {/* Botão de Ajuda Flutuante */}
      <button
        type="button"
        title="Ajuda"
        onClick={() => alert('Dúvidas com o login? Utilize as contas demo (senha: demo1234).')}
        className="fixed bottom-6 right-6 flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 shadow-xs hover:bg-slate-50 transition font-bold text-xs cursor-pointer"
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
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between text-slate-900 relative">
      <header className="border-b border-slate-200/90 bg-white py-3.5 px-6 sm:px-12">
        <Link to="/" className="inline-flex items-center gap-2.5 text-lg font-bold text-slate-900 hover:opacity-90">
          <GavelIcon className="h-6 w-6 text-slate-900" />
          <span className="tracking-tight">FGR Leilões</span>
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-[440px] bg-white rounded-3xl p-7 sm:p-9 shadow-sm border border-slate-200/70 space-y-5">
          <h1 className="text-2xl sm:text-[26px] font-extrabold tracking-tight text-slate-900 text-left">
            Criar conta
          </h1>

          <div className="flex items-center justify-between rounded-2xl bg-slate-100/90 px-4 py-2.5 text-xs sm:text-sm text-slate-700">
            <span>Já tem uma conta?</span>
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
                placeholder="Senha (mínimo de 8 caracteres)"
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
      </main>

      <footer className="py-6 px-4 text-center text-[10px] sm:text-[11px] text-slate-400 leading-relaxed max-w-2xl mx-auto">
        Copyright © 1995-2026 FGR Leilões Inc. Todos os direitos reservados.{' '}
        <span className="underline cursor-pointer hover:text-slate-600">Contrato do Usuário</span>,{' '}
        <span className="underline cursor-pointer hover:text-slate-600">Privacidade</span>,{' '}
        <span className="underline cursor-pointer hover:text-slate-600">Termos de Uso de Pagamentos</span>,{' '}
        <span className="underline cursor-pointer hover:text-slate-600">Cookies</span> e{' '}
        <span className="underline cursor-pointer hover:text-slate-600">AdChoice</span>.
      </footer>

      <button
        type="button"
        title="Ajuda"
        onClick={() => alert('Dúvidas com o cadastro? Preencha os campos para criar uma conta.')}
        className="fixed bottom-6 right-6 flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 shadow-xs hover:bg-slate-50 transition font-bold text-xs cursor-pointer"
      >
        ?
      </button>
    </div>
  );
}
