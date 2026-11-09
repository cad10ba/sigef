import React, { useEffect, useState } from 'react';
import { sigefStorage } from '../services/storage';
import { UserProfile } from '../types/sigef';
import { useToast } from './Toast';
import {
  Shield,
  Lock,
  User,
  Eye,
  EyeOff,
  UserPlus,
  LogIn,
  CheckCircle,
  School,
  ArrowRight,
} from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { showToast } = useToast();
  // A lista de usuários não é mais guardada no navegador: o servidor informa
  // apenas se já existe alguma conta, para decidir entre login e a primeira
  // configuração. Em qualquer dúvida (RLS, rede) mostra o login — nunca o
  // formulário de cadastro. A validação de credenciais é só no servidor.
  const [hasUsers, setHasUsers] = useState(true);
  useEffect(() => {
    let active = true;
    sigefStorage.systemHasAccounts().then((has) => {
      if (active) setHasUsers(has);
    });
    return () => {
      active = false;
    };
  }, []);

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Register form state (only used for initial Admin setup when no users exist)
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regRegistration, setRegRegistration] = useState('');
  const [regDepartment, setRegDepartment] = useState('Coordenação de Educação Física (COEF)');
  const [regPhone, setRegPhone] = useState('(73) 9');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

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

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!regName.trim() || !regEmail.trim() || !regRegistration.trim() || !regPassword.trim()) {
      showToast('Por favor, preencha todos os campos obrigatórios (*).', 'error');
      return;
    }

    if (regPassword.length < 4) {
      showToast('A senha deve conter no mínimo 4 caracteres.', 'error');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      showToast('A confirmação de senha não confere com a senha digitada.', 'error');
      return;
    }

    setIsSubmitting(true);
    const res = await sigefStorage.registerUser({
      name: regName,
      email: regEmail,
      registration: regRegistration,
      role: 'admin',
      password: regPassword,
      department: regDepartment,
      phone: regPhone,
    });
    setIsSubmitting(false);

    if (res.success && res.user) {
      showToast(res.message, 'success');
      setRegName('');
      setRegEmail('');
      setRegRegistration('');
      setRegPassword('');
      setRegConfirmPassword('');
      setRegPhone('(73) 9');
      onLoginSuccess(res.user);
    } else {
      showToast(res.message, 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1418] text-slate-100 flex flex-col items-center justify-center p-4 selection:bg-[#1B8A4B] selection:text-white">
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
          {/* Initial Setup Banner when system is fresh (no users registered yet) */}
          {!hasUsers ? (
            <div>
              <div className="mb-5 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs flex items-start gap-2.5">
                <Shield className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" />
                <div>
                  <span className="font-bold block text-white">Configuração Inicial do SIGEF:</span>
                  <span className="text-[11px] text-slate-300 leading-relaxed block mt-0.5">
                    Nenhum usuário cadastrado no sistema. Cadastre a conta do <strong>Administrador (COEF)</strong> abaixo para definir o login institucional da Coordenação. Os demais usuários serão cadastrados internamente pelo Administrador.
                  </span>
                </div>
              </div>

              <div className="mb-4">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-emerald-400" />
                  <span>Cadastrar Administrador da Coordenação</span>
                </h2>
              </div>
            </div>
          ) : (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-1.5">
                <LogIn className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-bold text-white tracking-tight">Acesso ao SIGEF</h2>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Informe sua matrícula, SIAPE ou e-mail institucional e senha para entrar.
              </p>
            </div>
          )}

          {/* Form: Login when users exist, or Initial Admin Setup when database is fresh */}
          {hasUsers ? (
            <div>
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
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Nome Completo <span className="text-emerald-400">*</span>
                </label>
                <input
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Ex: Prof. Dr. André Silva"
                  className="w-full h-9 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Matrícula ou SIAPE <span className="text-emerald-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={regRegistration}
                    onChange={(e) => setRegRegistration(e.target.value)}
                    placeholder="Ex: SIAPE 1984210"
                    className="w-full h-9 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 font-mono placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Função Institucional
                  </label>
                  <div className="w-full h-9 px-3 bg-[#0B1418] border border-emerald-500/30 rounded-xl text-emerald-400 font-semibold flex items-center text-xs">
                    Coordenação COEF (Administrador)
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  E-mail Institucional <span className="text-emerald-400">*</span>
                </label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="nome.sobrenome@ifcampus.edu.br"
                  className="w-full h-9 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Telefone / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="(73) 9..."
                    className="w-full h-9 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 font-mono placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Setor ou Departamento
                  </label>
                  <input
                    type="text"
                    value={regDepartment}
                    onChange={(e) => setRegDepartment(e.target.value)}
                    placeholder="COEF / Diretoria de Ensino"
                    className="w-full h-9 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Definir Senha <span className="text-emerald-400">*</span>
                  </label>
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Mínimo 4 caracteres"
                    className="w-full h-9 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Confirmar Senha <span className="text-emerald-400">*</span>
                  </label>
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="Repita a mesma senha"
                    className="w-full h-9 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="showRegPass"
                  checked={showRegPassword}
                  onChange={(e) => setShowRegPassword(e.target.checked)}
                  className="rounded text-emerald-500 focus:ring-0 bg-[#0B1418] border-white/20"
                />
                <label htmlFor="showRegPass" className="text-slate-400 cursor-pointer select-none">
                  Mostrar caracteres da senha
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-10 mt-2 bg-[#1B8A4B] hover:bg-[#22A55B] text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50"
              >
                <span>{isSubmitting ? 'Criando conta...' : 'Cadastrar Usuário e Acessar'}</span>
                <CheckCircle className="w-4 h-4" />
              </button>
            </form>
          )}
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
