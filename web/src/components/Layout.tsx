import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  // Nas páginas de login e cadastro, delega o layout para a página correspondente
  const isAuthPage = loc.pathname === '/entrar' || loc.pathname === '/cadastro';
  if (isAuthPage) {
    return <Outlet />;
  }

  const link = ({ isActive }: { isActive: boolean }) =>
    `inline-flex shrink-0 items-center rounded-lg px-3 py-1.5 text-sm font-medium transition ${
      isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-xs backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5">
          {/* Logo & Marca */}
          <Link to="/" className="flex items-center gap-2 text-lg font-bold text-slate-900 hover:opacity-90">
            <span className="text-xl">🔨</span>
            <span className="tracking-tight">FGR Leilões</span>
          </Link>

          {/* Área do Usuário (à direita no computador; na mesma linha do logo no celular) */}
          <div className="ml-auto flex items-center gap-2 sm:order-last">
            {user ? (
              <>
                <Link to={`/usuarios/${user.id}`} className="group flex items-center gap-2.5" title="Meu perfil público">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-brand-500 to-purple-600 text-sm font-bold text-white shadow-inner ring-2 ring-white">
                    {user.displayName.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="hidden text-xs sm:block">
                    <div className="font-semibold text-slate-800 transition group-hover:text-brand-600">Olá, {user.displayName}</div>
                    <div className="text-[11px] text-slate-500">Ver meu perfil</div>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                    nav('/');
                  }}
                  className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  Sair
                </button>
              </>
            ) : (
              <>
                <Link to="/entrar" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  Entrar
                </Link>
                <Link to="/cadastro" className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-700">
                  Criar conta
                </Link>
              </>
            )}
          </div>

          {/* Menu: em linha própria e com rolagem lateral no celular */}
          <nav className="-mx-1 flex w-full items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none] sm:mx-0 sm:w-auto sm:flex-1 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
            <NavLink to="/" end className={link}>Leilões</NavLink>
            <NavLink to="/comitentes" className={link}>Comitentes</NavLink>
            {user && <NavLink to="/minhas-participacoes" className={link}>Minhas participações</NavLink>}
            {user && (
              <NavLink
                to="/leiloes/novo"
                className={({ isActive }) =>
                  `inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                    isActive ? 'bg-brand-600 text-white' : 'border border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100'
                  }`
                }
              >
                + Anunciar
              </NavLink>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
