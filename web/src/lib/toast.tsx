import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

export type ToastKind = 'ok' | 'err' | 'warn';
interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
  link?: { to: string; label: string };
}
type Push = (kind: ToastKind, text: string, link?: Toast['link']) => void;

const Ctx = createContext<Push>(() => {});

const STYLE: Record<ToastKind, string> = {
  ok: 'bg-emerald-600 text-white',
  warn: 'bg-amber-500 text-white',
  err: 'bg-red-600 text-white',
};

/** Avisos flutuantes usados pelo site inteiro (lance aceito/recusado, lance superado...). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const push = useCallback<Push>((kind, text, link) => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-3), { id, kind, text, link }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }, []);

  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed right-4 top-20 z-30 flex w-full max-w-sm flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`pointer-events-auto rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${STYLE[t.kind]}`}>
            {t.text}
            {t.link && (
              <Link to={t.link.to} className="ml-2 underline underline-offset-2">{t.link.label}</Link>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
