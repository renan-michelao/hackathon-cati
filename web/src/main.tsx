import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import './index.css';
import { AuthProvider, useAuth } from './lib/auth';
import { ToastProvider } from './lib/toast';
import { SocketProvider } from './lib/socket';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import { NewAuction } from './pages/NewAuction';
import { AuctionPage } from './pages/AuctionPage';
import { EditAuction, RelistAuction } from './pages/ManageAuction';
import { ParticipationsPage, ProfilePage, SellersPage } from './pages/People';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return null;
  if (!user) return <Navigate to="/entrar" state={{ from: loc.pathname }} replace />;
  return <>{children}</>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <SocketProvider>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="entrar" element={<LoginPage />} />
                <Route path="cadastro" element={<RegisterPage />} />
                <Route path="leiloes/novo" element={<RequireAuth><NewAuction /></RequireAuth>} />
                <Route path="leiloes/:id" element={<AuctionPage />} />
                <Route path="leiloes/:id/editar" element={<RequireAuth><EditAuction /></RequireAuth>} />
                <Route path="leiloes/:id/relistar" element={<RequireAuth><RelistAuction /></RequireAuth>} />
                <Route path="comitentes" element={<SellersPage />} />
                <Route path="usuarios/:id" element={<ProfilePage />} />
                <Route path="minhas-participacoes" element={<RequireAuth><ParticipationsPage /></RequireAuth>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </SocketProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
