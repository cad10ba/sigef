import React, { useState } from 'react';
import { sigefStorage } from '../services/storage';
import { UserRole } from '../types/sigef';
import { useToast } from './Toast';
import { X, UserPlus, Shield, CheckCircle, Eye, EyeOff } from 'lucide-react';

interface NewSystemUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserCreated?: () => void;
}

const EMPTY_USER_FORM = {
  name: '',
  email: '',
  registration: '',
  role: '' as UserRole | '',
  department: '',
  phone: '',
  password: '',
  showPassword: false,
};

export const NewSystemUserModal: React.FC<NewSystemUserModalProps> = ({
  isOpen,
  onClose,
  onUserCreated,
}) => {
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [registration, setRegistration] = useState('');
  const [role, setRole] = useState<UserRole | ''>('');
  const [department, setDepartment] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setName(EMPTY_USER_FORM.name);
    setEmail(EMPTY_USER_FORM.email);
    setRegistration(EMPTY_USER_FORM.registration);
    setRole(EMPTY_USER_FORM.role);
    setDepartment(EMPTY_USER_FORM.department);
    setPhone(EMPTY_USER_FORM.phone);
    setPassword(EMPTY_USER_FORM.password);
    setShowPassword(EMPTY_USER_FORM.showPassword);
  };

  React.useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !email.trim() || !registration.trim() || !password.trim() || !role) {
      showToast('Preencha os campos obrigatórios (*).', 'error');
      return;
    }

    if (password.length < 8) {
      showToast('A senha provisória deve ter pelo menos 8 caracteres.', 'error');
      return;
    }

    setIsSubmitting(true);
    const res = await sigefStorage.registerUser({
      name,
      email,
      registration,
      role: role as UserRole,
      password,
      department,
      phone,
    });
    setIsSubmitting(false);

    if (res.success) {
      showToast(`Novo usuário ${name} cadastrado com sucesso!`, 'success');
      resetForm();
      onUserCreated?.();
      onClose();
    } else {
      showToast(res.message, 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-[#102027] text-slate-100 rounded-3xl border border-white/15 p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Cadastrar Novo Usuário do Sistema</h3>
              <p className="text-xs text-slate-400">Criar credencial de acesso ao SIGEF</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              Nome Completo <span className="text-emerald-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Carlos Eduardo de Oliveira"
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
                value={registration}
                onChange={(e) => setRegistration(e.target.value)}
                placeholder="Ex: 20241001 ou SIAPE 204891"
                className="w-full h-9 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 font-mono placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Perfil de Acesso <span className="text-emerald-400">*</span>
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full h-9 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none"
                required
              >
                <option value="">Selecione o perfil</option>
                <option value="docente">Docente de Educação Física</option>
                <option value="estagiario">Estagiário de Ed. Física</option>
                <option value="monitor">Monitor / Bolsista de Ed. Física</option>
                <option value="admin">Coordenação COEF (Administrador)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                E-mail Institucional <span className="text-emerald-400">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@ifcampus.edu.br"
                className="w-full h-9 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Telefone / Contato
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(73) 9..."
                className="w-full h-9 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              Departamento / Lotação
            </label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="COEF / Diretoria de Ensino"
              className="w-full h-9 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              Senha Inicial de Acesso <span className="text-emerald-400">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Defina a senha do usuário"
                className="w-full h-9 px-3 pr-10 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              O usuário poderá utilizar esta senha junto com o e-mail ou matrícula no login.
            </p>
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
              <CheckCircle className="w-4 h-4" />
              <span>Salvar Usuário</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
