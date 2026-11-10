import React, { useState } from 'react';
import { UserProfile } from '../types/sigef';
import { sigefStorage } from '../services/storage';
import { useToast } from './Toast';
import { X, KeyRound, Check, Eye, EyeOff, ShieldCheck } from 'lucide-react';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const { showToast } = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleReset = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswords(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword.trim()) {
      showToast('Informe sua senha atual.', 'error');
      return;
    }

    if (!newPassword.trim()) {
      showToast('Digite a nova senha desejada.', 'error');
      return;
    }

    if (newPassword.length < 4) {
      showToast('A nova senha deve ter no mínimo 4 caracteres.', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast('A confirmação não confere com a nova senha digitada.', 'error');
      return;
    }

    if (currentPassword === newPassword) {
      showToast('A nova senha deve ser diferente da senha atual.', 'error');
      return;
    }

    setIsSubmitting(true);
    const res = await sigefStorage.changeSelfPassword(currentPassword, newPassword);
    setIsSubmitting(false);

    if (res.success) {
      showToast('Senha de acesso atualizada com sucesso!', 'success');
      handleClose();
    } else {
      showToast(res.message, 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-[#102027] text-slate-100 rounded-3xl border border-white/15 p-6 shadow-2xl max-h-[90dvh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Alterar Minha Senha</h3>
              <p className="text-xs text-slate-400">Segurança de acesso ao SIGEF</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Card info */}
        <div className="mt-4 p-3 rounded-2xl bg-[#0B1418] border border-white/10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white font-bold flex items-center justify-center text-xs">
            {currentUser.name
              .split(' ')
              .map((p) => p[0])
              .filter(Boolean)
              .slice(0, 2)
              .join('')}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-xs text-white truncate">{currentUser.name}</p>
            <p className="text-[11px] text-slate-400 font-mono truncate">{currentUser.registration}</p>
          </div>
          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            {currentUser.role}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
          {/* Current Password */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              Senha Atual <span className="text-emerald-400">*</span>
            </label>
            <div className="relative">
              <input
                type={showPasswords ? 'text' : 'password'}
                autoFocus
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Digite sua senha atual"
                className="w-full h-9.5 px-3 pr-10 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowPasswords(!showPasswords)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                title={showPasswords ? 'Ocultar senhas' : 'Exibir senhas'}
              >
                {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              Nova Senha de Acesso <span className="text-emerald-400">*</span>
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 4 caracteres"
              className="w-full h-9.5 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              Confirmar Nova Senha <span className="text-emerald-400">*</span>
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a nova senha digitada"
              className="w-full h-9.5 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>Sua senha atual é conferida no servidor e a nova é gravada com hash (bcrypt). Nada é comparado no navegador.</span>
          </div>

          <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-slate-400 hover:text-white rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-[#1B8A4B] hover:bg-[#22A55B] text-white font-semibold rounded-xl shadow-md transition-all active:scale-[0.98] disabled:opacity-50 flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Atualizando...' : 'Atualizar Senha'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
