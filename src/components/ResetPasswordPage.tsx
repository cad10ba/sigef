import React, { useState } from 'react';
import { Lock, KeyRound } from 'lucide-react';
import { sigefStorage } from '../services/storage';
import { useToast } from './Toast';

interface ResetPasswordPageProps {
  onDone: () => void;
}

// Aberta pelo link de "Esqueci minha senha" enviado pelo Supabase Auth.
export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({ onDone }) => {
  const { showToast } = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim().length < 8) {
      showToast('A nova senha deve ter pelo menos 8 caracteres.', 'error');
      return;
    }
    if (password !== confirm) {
      showToast('As senhas não conferem.', 'error');
      return;
    }
    setIsSubmitting(true);
    const res = await sigefStorage.completePasswordReset(password);
    setIsSubmitting(false);
    showToast(res.message, res.success ? 'success' : 'error');
    if (res.success) {
      window.history.replaceState(null, '', window.location.pathname);
      onDone();
    }
  };

  const inputClass =
    'w-full h-11 pl-10 pr-3 bg-[#0B1418] border border-white/15 rounded-xl text-sm text-slate-100 placeholder:text-slate-500 font-mono focus:outline-none focus:border-emerald-500 transition-colors';

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-[#111D22] border border-white/10 rounded-2xl p-6 space-y-4"
      >
        <div className="flex items-center gap-2 text-white font-semibold">
          <KeyRound className="w-5 h-5 text-emerald-400" />
          Criar nova senha
        </div>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nova senha (mínimo 8 caracteres)"
            className={inputClass}
            autoComplete="new-password"
            required
          />
        </div>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repita a nova senha"
            className={inputClass}
            autoComplete="new-password"
            required
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-11 rounded-xl bg-[#1B8A4B] hover:bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50"
        >
          {isSubmitting ? 'Salvando...' : 'Salvar nova senha'}
        </button>
      </form>
    </div>
  );
};
