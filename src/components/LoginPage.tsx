import React, { useState } from 'react';
import { sigefStorage } from '../services/storage';
import { UserProfile } from '../types/sigef';
import { useToast } from './Toast';
import {
  Shield,
  Lock,
  User,
  Eye,
  EyeOff,
  LogIn,
  School,
  ArrowRight,
} from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { showToast } = useToast();
  // A tela de acesso é exclusivamente de login: não há cadastro público.
  // Novos usuários são criados pelos administradores dentro do aplicativo,
  // e as credenciais são validadas apenas no servidor.
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);

  const handleForgotPassword = async () => {
    if (isSendingReset) return;
    setIsSendingReset(true);
    const res = await sigefStorage.requestPasswordReset(loginIdentifier);
    setIsSendingReset(false);
    showToast(res.message, res.success ? 'success' : 'error');
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginIdentifier.trim() || !loginPassword.trim()) {
      showToast('Preencha seu identificador (e-mail ou matrícula/SIAPE) e sua senha.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await sigefStorage.loginAsync(loginIdentifier, loginPassword);
      setIsSubmitting(false);

      if (res.success && res.user) {
        showToast(res.message, 'success');
        onLoginSuccess(res.user);
      } else {
        showToast(res.message, 'error');
      }
    } catch {
      setIsSubmitting(false);
      showToast('Erro ao validar credenciais.', 'error');
    }
  };

  return (
    <div className="min-h-dvh bg-[#0B1418] text-slate-100 flex flex-col items-center justify-center px-4 py-6 selection:bg-[#1B8A4B] selection:text-white">
      {/* Background Glow Effect */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-emerald-600/10 blur-[120px] rounded-full" />
        <div className="absolute -bottom-32 right-10 w-[500px] h-[350px] bg-sky-600/10 blur-[140px] rounded-full" />
      </div>

      <div className="relative w-full max-w-lg z-10 my-8">
        {/* Institutional Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-emerald-400 font-semibold mb-3 tracking-wide">
            <School className="w-3.5 h-3.5" />
            <span>CAMPUS • DIRETORIA DE ENSINO • COEF</span>
          </div>

          <div className="flex items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1B8A4B] to-[#125830] flex items-center justify-center text-white font-black text-xl shadow-lg shadow-emerald-950/50 border border-emerald-400/30">
              IF
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold tracking-tight text-white">SIGEF</h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  COEF
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Sistema Integrado de Gestão da Educação Física
              </p>
            </div>
          </div>
        </div>

        {/* Auth Card Container */}
        <div className="bg-[#102027] border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1.5">
              <LogIn className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-bold text-white tracking-tight">Acesso ao SIGEF</h2>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Informe sua matrícula, SIAPE ou e-mail institucional e senha para entrar.
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Matrícula, SIAPE ou E-mail Institucional
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  placeholder="Ex: Matrícula, SIAPE ou e-mail institucional"
                  className="w-full h-11 pl-10 pr-3 bg-[#0B1418] border border-white/15 rounded-xl text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 font-mono focus:outline-none focus:border-emerald-500 transition-colors"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Senha de Acesso
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Sua senha cadastrada"
                  className="w-full h-11 pl-10 pr-10 bg-[#0B1418] border border-white/15 rounded-xl text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 font-mono focus:outline-none focus:border-emerald-500 transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                  title={showLoginPassword ? 'Ocultar senha' : 'Exibir senha'}
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex justify-end mt-2">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={isSendingReset}
                  className="text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
                >
                  {isSendingReset ? 'Enviando...' : 'Esqueci minha senha'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 mt-2 bg-[#1B8A4B] hover:bg-[#22A55B] text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Verificando credenciais...' : 'Entrar no SIGEF'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Security notice: new registrations only by Admin */}
          <div className="mt-6 pt-4 border-t border-white/10 text-center">
            <p className="text-xs text-slate-300 font-medium">
              Novos cadastros de usuários são realizados exclusivamente pelos <strong>Administradores da COEF</strong>.
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Docentes, monitores e discentes: solicite sua liberação de acesso à Coordenação.
            </p>
          </div>
        </div>

        {/* Security and Institutional Footer */}
        <div className="mt-6 text-center text-[11px] text-slate-500 space-y-1">
          <p className="flex items-center justify-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-500/70" />
            <span>Ambiente Institucional Seguro • Instituto Federal</span>
          </p>
          <p>Coordenação de Educação Física (COEF) • Todos os acessos são registrados</p>
        </div>
      </div>
    </div>
  );
};
