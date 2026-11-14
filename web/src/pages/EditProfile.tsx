import { useState, type FormEvent, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { api, ApiError } from '../lib/api';
import { useToast } from '../lib/toast';

const joinedAt = (iso?: string) => {
  if (!iso) return 'novembro de 2026';
  return new Date(iso).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};

export function EditProfilePage() {
  const { user, refresh, logout } = useAuth();
  const nav = useNavigate();
  const toast = useToast();

  const [displayName, setDisplayName] = useState(user?.displayName ?? 'Gustavo');
  const [email, setEmail] = useState(user?.email ?? 'gustavo@email.com');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>(
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80'
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Manipulador de upload de foto de perfil
  const handlePhotoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAvatarUrl(url);
      toast('ok', 'Foto de perfil atualizada!');
    }
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (isChangingPassword) {
      if (newPassword.length < 8) {
        setError('A nova senha precisa ter no mínimo 8 caracteres.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('As senhas digitadas não coincidem.');
        return;
      }
    }

    setBusy(true);
    try {
      const payload: { displayName?: string; email?: string; password?: string } = {
        displayName: displayName.trim(),
        email: email.trim(),
      };
      if (isChangingPassword && newPassword) {
        payload.password = newPassword;
      }

      await api('/api/auth/me', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      await refresh();
      setSuccess(true);
      toast('ok', 'Perfil atualizado com sucesso!');
      setIsChangingPassword(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar dados.');
    } finally {
      setBusy(false);
    }
  }

  const handleCancel = () => {
    setDisplayName(user?.displayName ?? 'Gustavo');
    setEmail(user?.email ?? 'gustavo@email.com');
    setIsChangingPassword(false);
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    nav(-1);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-2">
      {/* Título da Página */}
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
        Editar Perfil
      </h1>

      {/* Grid de 2 Colunas */}
      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Coluna Esquerda: Card de Identificação do Perfil */}
        <div className="w-full md:w-80 lg:w-[320px] shrink-0 card rounded-3xl p-8 border border-slate-200/80 bg-white shadow-xs flex flex-col items-center text-center space-y-4">
          {/* Avatar com Badge de Câmera */}
          <div className="relative group">
            <img
              src={avatarUrl}
              alt={displayName}
              className="h-32 w-32 rounded-full object-cover shadow-sm ring-4 ring-slate-100"
            />
            <label
              htmlFor="avatar-input"
              className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-xs hover:bg-slate-100 transition cursor-pointer"
              title="Alterar foto"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </label>
            <input
              id="avatar-input"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
            />
          </div>

          <label
            htmlFor="avatar-input"
            className="text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-700 transition cursor-pointer"
          >
            Alterar foto de perfil
          </label>

          {/* Nome e Data de Entrada */}
          <div className="space-y-1 pt-1">
            <h2 className="text-xl font-bold text-slate-900">{displayName}</h2>
            <p className="text-xs text-slate-500">
              Na plataforma desde {joinedAt(user?.createdAt)}
            </p>
          </div>

          {/* Botão Sair com borda vermelha suave */}
          <div className="w-full pt-4">
            <button
              type="button"
              onClick={async () => {
                await logout();
                nav('/');
              }}
              className="w-full rounded-full border border-red-300 bg-white py-2 px-4 text-xs sm:text-sm font-semibold text-red-600 hover:bg-red-50 hover:border-red-400 transition cursor-pointer shadow-2xs"
            >
              Sair
            </button>
          </div>
        </div>

        {/* Coluna Direita: Card de Configurações da Conta */}
        <div className="flex-1 w-full card rounded-3xl p-7 sm:p-9 border border-slate-200/80 bg-white shadow-xs space-y-6">
          <h2 className="text-xl font-bold text-slate-900">
            Configurações da conta
          </h2>

          <form onSubmit={submit} className="space-y-5">
            {/* Campo 1: Nome de exibição */}
            <div>
              <label className="block text-xs sm:text-sm font-bold text-slate-800 mb-1.5">
                Nome de exibição
              </label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={60}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* Campo 2: E-mail */}
            <div>
              <label className="block text-xs sm:text-sm font-bold text-slate-800 mb-1.5">
                E-mail
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* Campo 3: Senha */}
            <div>
              <label className="block text-xs sm:text-sm font-bold text-slate-800 mb-1.5">
                Senha
              </label>
              {!isChangingPassword ? (
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    disabled
                    value="••••••••••••"
                    className="w-full rounded-xl border border-slate-300 bg-slate-100/80 px-4 py-2.5 text-sm text-slate-500 cursor-not-allowed select-none"
                  />
                  <button
                    type="button"
                    onClick={() => setIsChangingPassword(true)}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs whitespace-nowrap cursor-pointer"
                  >
                    Alterar senha
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    type="password"
                    placeholder="Digite a nova senha (mínimo 8 caracteres)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsChangingPassword(false);
                      setNewPassword('');
                      setConfirmPassword('');
                    }}
                    className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
                  >
                    Cancelar alteração de senha
                  </button>
                </div>
              )}
            </div>

            {/* Campo 4: Confirmar nova senha */}
            <div>
              <label className="block text-xs sm:text-sm font-bold text-slate-800 mb-1.5">
                Confirmar nova senha (caso queira alterar)
              </label>
              <input
                type="password"
                placeholder=""
                disabled={!isChangingPassword}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none transition ${
                  !isChangingPassword
                    ? 'bg-slate-50 text-slate-400 cursor-not-allowed'
                    : 'bg-white text-slate-800 focus:border-blue-600 focus:ring-2 focus:ring-blue-100'
                }`}
              />
            </div>

            {/* Mensagens de Feedback */}
            {error && (
              <div className="rounded-xl bg-red-50 p-3 text-xs text-red-600 border border-red-200">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 border border-emerald-200">
                ✅ Dados atualizados com sucesso!
              </div>
            )}

            {/* Botões de Ação */}
            <div className="flex items-center justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-blue-700 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
              >
                {busy ? 'Salvando…' : 'Salvar alterações'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Botão Flutuante de Ajuda (?) */}
      <button
        type="button"
        title="Ajuda"
        className="fixed bottom-6 right-6 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md hover:bg-slate-50 transition font-bold text-sm cursor-pointer"
      >
        ?
      </button>
    </div>
  );
}