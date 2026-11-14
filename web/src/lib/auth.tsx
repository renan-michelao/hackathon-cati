import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, post, type User } from './api';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (displayName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Atualiza o usuário logado depois de alterar apelido ou foto (o cabeçalho muda na hora). */
  setCurrentUser: (u: User) => void;
}

const Ctx = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const r = await api<{ user: User }>('/api/auth/me');
      setUser(r.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = async (email: string, password: string) => {
    const r = await post<{ user: User }>('/api/auth/login', { email, password });
    setUser(r.user);
  };
  const register = async (displayName: string, email: string, password: string) => {
    const r = await post<{ user: User }>('/api/auth/register', { displayName, email, password });
    setUser(r.user);
  };
  const logout = async () => {
    await post('/api/auth/logout');
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, loading, login, register, logout, refresh, setCurrentUser: setUser }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
