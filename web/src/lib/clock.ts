import { useEffect, useState } from 'react';

// RF16: o horário que vale é o do servidor. Guardamos a diferença entre o relógio do
// servidor e o do navegador e usamos só para a contagem regressiva (que é visual).
let offsetMs = 0;

export function syncServerClock(serverNowIso: string) {
  offsetMs = new Date(serverNowIso).getTime() - Date.now();
}

export const serverNow = () => Date.now() + offsetMs;

/** Re-renderiza a cada `intervalMs` e devolve o "agora" estimado do servidor. */
export function useServerNow(intervalMs = 250) {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const t = setInterval(() => setNow(serverNow()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
