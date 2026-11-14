import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const link = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:text-slate-900'}`;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
          <Link to="/" className="mr-4 flex items-center gap-2 text-lg font-bold">
            <span>🔨</span> Kernel Panic <span className="text-brand-600">Leilões</span>
          </Link>
          <nav className="flex flex-1 flex-wrap items-center gap-1">
            <NavLink to="/" end className={link}>Leilões</NavLink>
            {user && <NavLink to="/leiloes/novo" className={link}>Anunciar</NavLink>}
          </nav>
          {user ? (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-slate-600">Olá, <strong>{user.displayName}</strong></span>
              <button className="btn-secondary" onClick={async () => { await logout(); nav('/'); }}>Sair</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/entrar" className="btn-secondary">Entrar</Link>
              <Link to="/cadastro" className="btn-primary">Criar conta</Link>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
