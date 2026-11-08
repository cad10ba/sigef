import React, { useState } from 'react';
import { Requester, RequesterType, Loan, Reservation } from '../types/sigef';
import { sigefStorage } from '../services/storage';
import { formatDateBR, formatDateTimeBR } from '../utils/formatters';
import { useToast } from '../components/Toast';
import {
  Users,
  Search,
  Plus,
  UserCheck,
  AlertOctagon,
  Calendar,
  ClipboardList,
  Edit2,
  Trash2,
  X,
  Phone,
  Mail,
  GraduationCap,
  Shield,
} from 'lucide-react';

interface UsersPageProps {
  onOpenNewLoanWithRequester: (requesterId: string) => void;
  userRole: string;
}

export const UsersPage: React.FC<UsersPageProps> = ({
  onOpenNewLoanWithRequester,
  userRole,
}) => {
  const { showToast } = useToast();
  const requesters = sigefStorage.getRequesters();
  const loans = sigefStorage.getLoans();
  const reservations = sigefStorage.getReservations();

  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedUserDetail, setSelectedUserDetail] = useState<Requester | null>(null);

  // User form modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Requester | null>(null);
  const [userForm, setUserForm] = useState<{
    name: string;
    type: RequesterType;
    registration: string;
    courseOrDepartment: string;
    classGroup: string;
    email: string;
    phone: string;
    supervisorName: string;
    shift: string;
    workloadHours: number;
    assignedArea: string;
  }>({
    name: '',
    type: 'aluno',
    registration: '',
    courseOrDepartment: '',
    classGroup: '',
    email: '',
    phone: '',
    supervisorName: '',
    shift: 'Matutino',
    workloadHours: 20,
    assignedArea: '',
  });

  const filteredRequesters = requesters.filter((r) => {
    const matchSearch =
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.registration.toLowerCase().includes(search.toLowerCase()) ||
      r.courseOrDepartment.toLowerCase().includes(search.toLowerCase()) ||
      (r.assignedArea && r.assignedArea.toLowerCase().includes(search.toLowerCase())) ||
      r.email.toLowerCase().includes(search.toLowerCase());

    const matchType = selectedType === 'all' || r.type === selectedType;
    return matchSearch && matchType;
  });

  const handleOpenNewUser = () => {
    setEditingUser(null);
    setUserForm({
      name: '',
      type: 'estagiario',
      registration: `EST-${Math.floor(1000 + Math.random() * 9000)}`,
      courseOrDepartment: 'Licenciatura em Educação Física',
      classGroup: '',
      email: '',
      phone: '(85) 9',
      supervisorName: '',
      shift: 'Matutino',
      workloadHours: 20,
      assignedArea: 'Apoio às Aulas Práticas e Ginásio',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditUser = (req: Requester) => {
    setEditingUser(req);
    setUserForm({
      name: req.name,
      type: req.type,
      registration: req.registration,
      courseOrDepartment: req.courseOrDepartment,
      classGroup: req.classGroup || '',
      email: req.email,
      phone: req.phone,
      supervisorName: req.supervisorName || '',
      shift: req.shift || 'Matutino',
      workloadHours: req.workloadHours || 20,
      assignedArea: req.assignedArea || '',
    });
    setIsModalOpen(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.name.trim() || !userForm.registration.trim()) {
      showToast('Preencha os campos obrigatórios.', 'error');
      return;
    }

    const newUser: Requester = {
      id: editingUser ? editingUser.id : 'req-' + Date.now(),
      name: userForm.name.trim(),
      type: userForm.type,
      registration: userForm.registration.trim(),
      courseOrDepartment: userForm.courseOrDepartment.trim(),
      classGroup: userForm.type === 'aluno' ? userForm.classGroup.trim() || undefined : undefined,
      email: userForm.email.trim() || `${userForm.name.toLowerCase().replace(/\s+/g, '.')}@ifcampus.edu.br`,
      phone: userForm.phone.trim(),
      supervisorName:
        userForm.type === 'estagiario' || userForm.type === 'monitor'
          ? userForm.supervisorName.trim() || undefined
          : undefined,
      shift:
        userForm.type === 'estagiario' || userForm.type === 'monitor'
          ? userForm.shift
          : undefined,
      workloadHours:
        userForm.type === 'estagiario' || userForm.type === 'monitor'
          ? Number(userForm.workloadHours) || 20
          : undefined,
      assignedArea:
        userForm.type === 'estagiario' || userForm.type === 'monitor'
          ? userForm.assignedArea.trim() || undefined
          : undefined,
      isBlocked: editingUser ? editingUser.isBlocked : false,
      blockReason: editingUser ? editingUser.blockReason : undefined,
    };

    sigefStorage.saveRequester(newUser);
    showToast(editingUser ? 'Cadastro atualizado com sucesso!' : 'Novo usuário cadastrado na COEF!', 'success');
    setIsModalOpen(false);
  };

  const handleDeleteUser = (id: string, name: string) => {
    if (confirm(`Deseja remover o cadastro de "${name}"?`)) {
      sigefStorage.deleteRequester(id);
      showToast(`Usuário "${name}" removido.`, 'info');
      if (selectedUserDetail?.id === id) setSelectedUserDetail(null);
    }
  };

  // Get user history for modal
  const getUserLoans = (userId: string) => loans.filter((l) => l.requesterId === userId);
  const getUserReservations = (userName: string) =>
    reservations.filter((r) => r.teacherName.toLowerCase().includes(userName.toLowerCase()));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-400" />
            <span>Docentes, Estagiários, Monitores & Alunos</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Cadastro unificado da equipe de Educação Física, estagiários, monitores, discentes e servidores do campus
          </p>
        </div>

        <button
          onClick={handleOpenNewUser}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1B8A4B] hover:bg-[#22A55B] text-white text-xs font-semibold rounded-xl shadow-md shadow-emerald-950/40 transition-all active:scale-[0.98] self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Usuário</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-[#102027] border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, matrícula, SIAPE, curso..."
            className="w-full h-9 pl-9 pr-3 bg-[#0B1418] border border-white/15 rounded-xl text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="h-9 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-xs text-slate-200 focus:outline-none w-full sm:w-auto"
          >
            <option value="all">Todos os Vínculos</option>
            <option value="docente">Docentes de Ed. Física</option>
            <option value="estagiario">Estagiários de Ed. Física</option>
            <option value="monitor">Monitores / Bolsistas de Ed. Física</option>
            <option value="aluno">Alunos (Discentes)</option>
            <option value="servidor">Servidores / TAEs</option>
          </select>
        </div>
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRequesters.map((req) => {
          const userLoans = getUserLoans(req.id);
          const activeLoans = userLoans.filter((l) => l.status === 'ativo' || l.status === 'atrasado');

          const getTypeBadge = (type: RequesterType) => {
            switch (type) {
              case 'docente':
                return { label: 'Docente', color: 'bg-sky-500/20 text-sky-300 border-sky-500/30' };
              case 'estagiario':
                return { label: 'Estagiário', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
              case 'monitor':
                return { label: 'Monitor', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' };
              case 'servidor':
                return { label: 'Servidor', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' };
              case 'aluno':
              default:
                return { label: 'Aluno', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
            }
          };

          const badge = getTypeBadge(req.type);

          return (
            <div
              key={req.id}
              className={`rounded-2xl border p-5 flex flex-col justify-between transition-all ${
                req.isBlocked
                  ? 'bg-rose-950/20 border-rose-500/40'
                  : 'bg-[#102027] border-white/10 hover:border-white/20 shadow-xl'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 pb-3 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#0B1418] border border-white/10 text-emerald-400 font-bold flex items-center justify-center text-sm">
                      {req.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-white">{req.name}</h3>
                      <span className="text-[11px] font-mono text-slate-400">
                        {req.registration}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                      req.isBlocked
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                        : badge.color
                    }`}
                  >
                    {req.isBlocked ? 'Bloqueado' : badge.label}
                  </span>
                </div>

                <div className="mt-3 space-y-1.5 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="truncate">
                      {req.courseOrDepartment} {req.classGroup ? `(${req.classGroup})` : ''}
                    </span>
                  </div>

                  {(req.type === 'estagiario' || req.type === 'monitor') && (
                    <>
                      {req.assignedArea && (
                        <div className="flex items-center gap-2 text-emerald-300 font-medium">
                          <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span className="truncate">Área: {req.assignedArea}</span>
                        </div>
                      )}
                      {(req.shift || req.workloadHours) && (
                        <div className="text-[11px] text-slate-400 pl-6">
                          Turno: <strong className="text-slate-200">{req.shift || 'Geral'}</strong>
                          {req.workloadHours ? ` • ${req.workloadHours}h/semana` : ''}
                        </div>
                      )}
                      {req.supervisorName && (
                        <div className="text-[11px] text-slate-400 pl-6 italic">
                          Supervisor: <strong className="text-slate-300">{req.supervisorName}</strong>
                        </div>
                      )}
                    </>
                  )}

                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="truncate text-slate-400">{req.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-mono text-slate-400">{req.phone}</span>
                  </div>
                </div>

                {req.isBlocked && (
                  <div className="mt-3 p-2 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-[11px]">
                    <strong>Pendência:</strong> {req.blockReason}
                  </div>
                )}
              </div>

              {/* Card Footer Actions */}
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                <button
                  onClick={() => setSelectedUserDetail(req)}
                  className="text-xs font-semibold text-sky-400 hover:text-sky-300"
                >
                  Ver Histórico ({userLoans.length})
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleOpenEditUser(req)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                    title="Editar Cadastro"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  {userRole === 'admin' && (
                    <button
                      onClick={() => handleDeleteUser(req.id, req.name)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-white/5 transition-colors"
                      title="Excluir Usuário"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {!req.isBlocked && (
                    <button
                      onClick={() => onOpenNewLoanWithRequester(req.id)}
                      className="px-2.5 py-1.5 bg-[#1B8A4B] hover:bg-[#22A55B] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
                    >
                      Emprestar
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filteredRequesters.length === 0 && (
          <div className="col-span-full p-8 text-center rounded-2xl bg-[#102027] border border-white/10 text-slate-400">
            <Users className="w-12 h-12 mx-auto opacity-30 mb-2" />
            <p className="text-base font-bold text-white">Nenhum profissional ou estudante cadastrado.</p>
            <p className="text-xs text-slate-400 mt-1 mb-4">
              Cadastre docentes, bolsistas de monitoria, servidores e discentes do campus.
            </p>
            <button
              onClick={handleOpenNewUser}
              className="px-4 py-2 bg-[#1B8A4B] hover:bg-[#22A55B] text-white text-xs font-semibold rounded-xl shadow-md transition-colors"
            >
              + Cadastrar Primeiro Usuário
            </button>
          </div>
        )}
      </div>

      {/* User Details & History Modal */}
      {selectedUserDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl bg-[#102027] text-slate-100 rounded-2xl border border-white/10 p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-emerald-400" />
                  <span>Prontuário COEF: {selectedUserDetail.name}</span>
                </h3>
                <p className="text-xs text-slate-400">
                  {selectedUserDetail.registration} • {selectedUserDetail.courseOrDepartment}
                </p>
              </div>
              <button
                onClick={() => setSelectedUserDetail(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              {(selectedUserDetail.type === 'estagiario' || selectedUserDetail.type === 'monitor') && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1.5">
                  <div className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                    {selectedUserDetail.type === 'estagiario' ? 'Termo de Estágio em Educação Física' : 'Plano de Monitoria / Bolsista'}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-slate-300">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Supervisor / Orientador:</span>
                      <span className="font-semibold text-white">{selectedUserDetail.supervisorName || 'Coordenação COEF'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Turno & Carga Horária:</span>
                      <span className="font-semibold text-white">{selectedUserDetail.shift || 'Matutino'} ({selectedUserDetail.workloadHours || 20}h/sem)</span>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <span className="text-slate-500 block text-[10px]">Área de Atuação:</span>
                      <span className="font-semibold text-white">{selectedUserDetail.assignedArea || 'Apoio às Atividades Físicas'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Empréstimos Realizados */}
              <div>
                <h4 className="font-bold text-white text-sm mb-2 flex items-center gap-1.5">
                  <ClipboardList className="w-4 h-4 text-sky-400" />
                  <span>Histórico de Empréstimos ({getUserLoans(selectedUserDetail.id).length})</span>
                </h4>

                <div className="space-y-2">
                  {getUserLoans(selectedUserDetail.id).map((l) => (
                    <div
                      key={l.id}
                      className="p-3 rounded-xl bg-[#0B1418] border border-white/5 flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white font-mono">{l.termNumber}</span>
                          <span
                            className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                              l.status === 'atrasado'
                                ? 'bg-rose-500/20 text-rose-300'
                                : l.status === 'ativo'
                                ? 'bg-sky-500/20 text-sky-300'
                                : 'bg-emerald-500/20 text-emerald-300'
                            }`}
                          >
                            {l.status}
                          </span>
                        </div>
                        <p className="text-slate-300 mt-1">
                          Itens: {l.items.map((i) => `${i.quantity}x ${i.materialName}`).join(', ')}
                        </p>
                        <span className="text-[10px] text-slate-500">
                          Retirada em {formatDateBR(l.loanDate)}
                        </span>
                      </div>
                      <span className="font-mono text-slate-400 text-[11px]">
                        Prazo: {formatDateBR(l.expectedReturnDate)}
                      </span>
                    </div>
                  ))}

                  {getUserLoans(selectedUserDetail.id).length === 0 && (
                    <p className="text-slate-500 italic py-2">Nenhum empréstimo registrado.</p>
                  )}
                </div>
              </div>

              {/* Reservas vinculadas */}
              {selectedUserDetail.type === 'docente' && (
                <div>
                  <h4 className="font-bold text-white text-sm mb-2 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-emerald-400" />
                    <span>Reservas de Espaço como Responsável</span>
                  </h4>

                  <div className="space-y-2">
                    {getUserReservations(selectedUserDetail.name).map((r) => (
                      <div
                        key={r.id}
                        className="p-3 rounded-xl bg-[#0B1418] border border-white/5 flex items-center justify-between"
                      >
                        <div>
                          <span className="font-bold text-white">{r.sport}</span>
                          <p className="text-slate-300">
                            {r.spaceName} • {r.groupOrClass}
                          </p>
                        </div>
                        <span className="font-mono text-emerald-400 font-bold">
                          {formatDateBR(r.date)} ({r.startTime} - {r.endTime})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 mt-4 border-t border-white/10 flex justify-end">
              <button
                onClick={() => setSelectedUserDetail(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-[#102027] text-slate-100 rounded-2xl border border-white/10 p-5 sm:p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">
              {editingUser ? 'Editar Cadastro de Usuário' : 'Novo Cadastro no SIGEF COEF'}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Registro para liberação de empréstimos e agendamentos.
            </p>

            <form onSubmit={handleSaveUser} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Nome Completo</label>
                <input
                  type="text"
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  placeholder="Ex: Carlos Eduardo de Oliveira"
                  className="w-full h-9 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Tipo de Vínculo</label>
                  <select
                    value={userForm.type}
                    onChange={(e) => setUserForm({ ...userForm, type: e.target.value as RequesterType })}
                    className="w-full h-9 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none"
                  >
                    <option value="estagiario">Estagiário de Ed. Física</option>
                    <option value="monitor">Monitor / Bolsista de Ed. Física</option>
                    <option value="docente">Docente de Educação Física</option>
                    <option value="aluno">Aluno (Discente)</option>
                    <option value="servidor">Servidor / TAE</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    {userForm.type === 'docente' || userForm.type === 'servidor'
                      ? 'Matrícula / SIAPE'
                      : userForm.type === 'estagiario'
                      ? 'Nº Termo de Estágio / Matrícula'
                      : userForm.type === 'monitor'
                      ? 'Matrícula / Portaria de Monitoria'
                      : 'Matrícula Institucional'}
                  </label>
                  <input
                    type="text"
                    value={userForm.registration}
                    onChange={(e) => setUserForm({ ...userForm, registration: e.target.value })}
                    className="w-full h-9 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  {userForm.type === 'estagiario' || userForm.type === 'monitor'
                    ? 'Curso de Graduação / Instituição de Ensino'
                    : 'Curso ou Departamento'}
                </label>
                <input
                  type="text"
                  value={userForm.courseOrDepartment}
                  onChange={(e) => setUserForm({ ...userForm, courseOrDepartment: e.target.value })}
                  placeholder={
                    userForm.type === 'estagiario' || userForm.type === 'monitor'
                      ? 'Ex: Licenciatura/Bacharelado em Educação Física'
                      : 'Ex: Técnico em Agropecuária, COEF...'
                  }
                  className="w-full h-9 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              {userForm.type === 'aluno' && (
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Turma / Ano</label>
                  <input
                    type="text"
                    value={userForm.classGroup}
                    onChange={(e) => setUserForm({ ...userForm, classGroup: e.target.value })}
                    placeholder="Ex: Turma 202 - 2º Ano"
                    className="w-full h-9 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none"
                  />
                </div>
              )}

              {(userForm.type === 'estagiario' || userForm.type === 'monitor') && (
                <div className="p-3 bg-white/[0.03] border border-white/10 rounded-xl space-y-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <span>Dados de Atuação ({userForm.type === 'estagiario' ? 'Estágio Curricular / Extracurricular' : 'Monitoria / Bolsa'})</span>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Área de Atuação / Atribuição no Campus
                    </label>
                    <input
                      type="text"
                      value={userForm.assignedArea}
                      onChange={(e) => setUserForm({ ...userForm, assignedArea: e.target.value })}
                      placeholder="Ex: Apoio a Aulas Práticas, Sala de Musculação, Almoxarifado de Materiais"
                      className="w-full h-9 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">Docente Supervisor</label>
                      <input
                        type="text"
                        value={userForm.supervisorName}
                        onChange={(e) => setUserForm({ ...userForm, supervisorName: e.target.value })}
                        placeholder="Ex: Prof. Dr. André Silva"
                        className="w-full h-9 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">Turno de Atuação</label>
                      <select
                        value={userForm.shift}
                        onChange={(e) => setUserForm({ ...userForm, shift: e.target.value })}
                        className="w-full h-9 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none"
                      >
                        <option value="Matutino">Matutino</option>
                        <option value="Vespertino">Vespertino</option>
                        <option value="Noturno">Noturno</option>
                        <option value="Integral">Integral</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">Carga Horária Semanal</label>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          max="40"
                          value={userForm.workloadHours}
                          onChange={(e) => setUserForm({ ...userForm, workloadHours: Number(e.target.value) })}
                          className="w-full h-9 px-3 pr-8 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">h/sem</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">E-mail Institucional</label>
                  <input
                    type="email"
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    placeholder="nome@ifcampus.edu.br"
                    className="w-full h-9 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Telefone / WhatsApp</label>
                  <input
                    type="text"
                    value={userForm.phone}
                    onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                    placeholder="(85) 9..."
                    className="w-full h-9 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-2 text-slate-400 hover:text-white rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1B8A4B] hover:bg-[#22A55B] text-white font-semibold rounded-xl"
                >
                  Salvar Usuário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
