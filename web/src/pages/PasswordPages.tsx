import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError, post } from '../lib/api';
import { AuthShell, authButton, authInput } from '../components/AuthShell';

// Esqueci minha senha (D41): pede o e-mail; a resposta é sempre a mesma, exista a conta ou não.
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await post<{ message: string }>('/api/auth/forgot', { email });
      setSent(r.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar agora. Tente de novo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Esqueci minha senha">
      {sent ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">📬 {sent}</div>
          <p className="text-xs text-slate-500">
            O link vale por 30 minutos e só pode ser usado uma vez. Nesta simulação não há envio de e-mail de verdade:
            a mensagem fica na caixa de saída do servidor (<code>./rodar.sh emails</code>).
          </p>
          <Link to="/entrar" className={`${authButton} block text-center`}>Voltar para o login</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-slate-600">Informe o e-mail da sua conta. Vamos enviar um link para você criar uma nova senha.</p>
          <input type="email" required placeholder="E-mail" autoComplete="email" className={authInput}
            value={email} onChange={(e) => setEmail(e.target.value)} />
          {error && <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-600">{error}</div>}
          <button className={authButton} disabled={busy}>{busy ? 'Enviando…' : 'Enviar link'}</button>
          <p className="text-center text-xs text-slate-500">
            Lembrou? <Link to="/entrar" className="font-semibold text-brand-600 hover:underline">Voltar para o login</Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}

// Página aberta pelo link do e-mail: /redefinir-senha?token=...
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) return setError('A confirmação não confere com a nova senha.');
    setBusy(true);
    try {
      await post('/api/auth/reset', { token, password });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível redefinir a senha.');
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <AuthShell title="Link inválido">
        <p className="text-sm text-slate-600">Este endereço não tem um link de redefinição válido.</p>
        <Link to="/esqueci-senha" className={`${authButton} block text-center`}>Pedir um novo link</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Criar nova senha">
      {done ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            ✅ Senha redefinida. Por segurança, todas as sessões abertas da conta foram encerradas.
          </div>
          <Link to="/entrar" className={`${authButton} block text-center`}>Entrar com a nova senha</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <input type="password" required minLength={8} placeholder="Nova senha (mín. 8 caracteres)" autoComplete="new-password"
            className={authInput} value={password} onChange={(e) => setPassword(e.target.value)} />
          <input type="password" required minLength={8} placeholder="Confirme a nova senha" autoComplete="new-password"
            className={authInput} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-600">
              {error} {error.includes('expirou') && <Link to="/esqueci-senha" className="font-semibold underline">Pedir um novo link</Link>}
            </div>
          )}
          <button className={authButton} disabled={busy}>{busy ? 'Salvando…' : 'Salvar nova senha'}</button>
        </form>
      )}
    </AuthShell>
  );
}
