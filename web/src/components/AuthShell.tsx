import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/** Moldura das telas de conta (mesmo visual do login): barra com a marca, card central e rodapé. */
export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col justify-between bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200/90 bg-white px-6 py-3.5 sm:px-12">
        <Link to="/" className="inline-flex items-center gap-2.5 text-lg font-bold text-slate-900 hover:opacity-90">
          <span className="text-xl">🔨</span>
          <span className="tracking-tight">FGR Leilões</span>
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-[440px] space-y-5 rounded-3xl border border-slate-200/70 bg-white p-7 shadow-sm sm:p-9">
          <h1 className="text-left text-2xl font-extrabold tracking-tight text-slate-900 sm:text-[26px]">{title}</h1>
          {children}
        </div>
      </main>
      <footer className="mx-auto max-w-2xl px-4 py-6 text-center text-[10px] leading-relaxed text-slate-400 sm:text-[11px]">
        FGR Leilões · simulação de leilão online feita pela equipe Kernel Panic no Hackathon Cati Jr. Nenhuma transação é real.
      </footer>
    </div>
  );
}

/** Campo no estilo das telas de login. */
export const authInput =
  'w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100';
export const authButton =
  'w-full cursor-pointer rounded-full bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-xs transition hover:bg-brand-700 active:scale-[0.99] disabled:opacity-50';
