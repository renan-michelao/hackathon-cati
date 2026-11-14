import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from './auth';
import { useToast } from './toast';
import { money } from './format';
import type { OutbidEvent } from './api';

const Ctx = createContext<Socket | null>(null);

/**
 * Uma conexão de tempo real por aba, compartilhada pelas páginas (só para quem está logado,
 * porque o servidor exige sessão). Aqui também fica o aviso global de lance superado (RF26),
 * que chega em qualquer página do site.
 */
export function SocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const toast = useToast();
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!user) {
      setSocket(null);
      return;
    }
    const s = io({ path: '/socket.io' });
    s.on('user:outbid', (e: OutbidEvent) => {
      toast('warn', `Seu lance em "${e.name ?? 'um leilão'}" foi superado (${money(e.amountCents)}). Novo mínimo: ${money(e.minNextCents)}.`,
        { to: `/leiloes/${e.auctionId}`, label: 'Ver sala' });
    });
    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, [user, toast]);

  return <Ctx.Provider value={socket}>{children}</Ctx.Provider>;
}

export const useSocket = () => useContext(Ctx);
