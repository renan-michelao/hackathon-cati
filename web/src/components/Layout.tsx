import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { GavelIcon } from './GavelIcon';

export function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [showSellerModal, setShowSellerModal] = useState(false);

  // Nas páginas de login e cadastro, delega o layout para a página correspondente
  const isAuthPage = loc.pathname === '/entrar' || loc.pathname === '/cadastro';
  if (isAuthPage) {
    return <Outlet />;
  }

  const link = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium transition ${
      isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:text-slate-900'
    }`;

  // Layout padrão para as demais páginas (Home, Sala de Leilão, etc.)
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-xs">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2.5">
          {/* Logo & Marca */}
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2 text-lg font-bold text-slate-900 hover:opacity-90">
              <GavelIcon className="h-6 w-6 text-slate-900" />
              <span className="tracking-tight">FGR Leilões</span>
            </Link>

            {/* Menu Central */}
            <nav className="hidden items-center gap-1 sm:flex">
              <NavLink to="/minhas-participacoes" className={link}>
                <span>Minhas Participações</span>
                <span className="ml-1.5 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                  Novo
                </span>
              </NavLink>

              <NavLink to="/leiloes/novo" className={link}>
                Anunciar
              </NavLink>

              <button
                type="button"
                onClick={() => setShowSellerModal(true)}
                className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/70 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 cursor-pointer"
              >
                <span>Quero Vender</span>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </button>
            </nav>
          </div>

          {/* Área do Usuário */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <Link to={`/usuarios/${user.id}`} className="flex items-center gap-2.5 text-left group">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 font-bold text-white text-sm shadow-inner ring-2 ring-white">
                    {user.displayName.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="hidden text-xs sm:block">
                    <div className="font-semibold text-slate-800 group-hover:text-indigo-600 transition">
                      Olá, {user.displayName}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Crédito: <strong className="text-slate-700">R$ 8.500,00</strong> | Pontuação: <strong className="text-slate-700">72 XP</strong> | Nível: <span className="font-medium text-indigo-600">Comitente</span>
                    </div>
                  </div>
                </Link>

                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                    nav('/');
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100 cursor-pointer"
                >
                  Sair
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/entrar" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  Entrar
                </Link>
                <Link to="/cadastro" className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 shadow-sm">
                  Criar conta
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Modal Quero Vender (RF30) */}
      {showSellerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="card w-full max-w-md p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Habilitação de Comitente (RF30)</h3>
              <button
                type="button"
                onClick={() => setShowSellerModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-slate-600">
              Sua pontuação de crédito atual é de <strong className="text-indigo-600">72 XP</strong> (exige 50 ou mais).
            </p>
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">
              ✅ <strong>Parabéns!</strong> Você está habilitado para anunciar novos leilões na plataforma.
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSellerModal(false)}
                className="btn-secondary text-xs"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSellerModal(false);
                  nav('/leiloes/novo');
                }}
                className="btn-primary text-xs"
              >
                Criar Novo Leilão
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
