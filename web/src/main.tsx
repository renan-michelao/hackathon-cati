import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import './index.css';
import { AuthProvider, useAuth } from './lib/auth';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import { NewAuction } from './pages/NewAuction';
import { AuctionPage } from './pages/AuctionPage';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return null;
  if (!user) return <Navigate to="/entrar" state={{ from: loc.pathname }} replace />;
  return <>{children}</>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="entrar" element={<LoginPage />} />
            <Route path="cadastro" element={<RegisterPage />} />
            <Route path="leiloes/novo" element={<RequireAuth><NewAuction /></RequireAuth>} />
            <Route path="leiloes/:id" element={<AuctionPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
);
