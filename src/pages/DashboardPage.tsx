import React, { useState } from 'react';
import {
  Space,
  Reservation,
  NoticeBoardItem,
  ActiveTab,
  UserRole,
} from '../types/sigef';
import { sigefStorage } from '../services/storage';
import { getSpaceStatusBadge, formatDateBR } from '../utils/formatters';
import { useToast } from '../components/Toast';
import {
  ScanLine,
  CalendarDays,
  Dumbbell,
  BookOpenText,
  Pin,
  Plus,
  Trash2,
  Users,
  Boxes,
  Clock,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  HelpCircle,
  PhoneCall,
  Activity,
} from 'lucide-react';

interface DashboardPageProps {
  onNavigate: (tab: ActiveTab) => void;
  onOpenTerminalLoan: () => void;
  onOpenNewReservation: (spaceId?: string) => void;
  userRole: UserRole;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigate,
  onOpenTerminalLoan,
  onOpenNewReservation,
  userRole,
}) => {
  const { showToast } = useToast();
  const spaces = sigefStorage.getSpaces();
  const reservations = sigefStorage.getReservations();
  const materials = sigefStorage.getMaterials();
  const kits = sigefStorage.getKits();
  const loans = sigefStorage.getLoans();
  const notices = sigefStorage.getNotices();
  const requesters = sigefStorage.getRequesters();

  // Metrics
  const activeLoans = loans.filter((l) => l.status === 'ativo');
  const overdueLoans = loans.filter((l) => l.status === 'atrasado');
  const readyKits = kits.filter((k) => k.status === 'pronto');
  const totalMaterials = materials.reduce((acc, m) => acc + m.totalQuantity, 0);

  // Today's reservations
  const todayStr = new Date().toISOString().split('T')[0];
  const todayReservations = reservations.filter((r) => r.date === todayStr);

  // Occupancy rate calculation (approx: slots occupied today / total capacity)
  const totalOccupiedSpaces = spaces.filter((s) => s.status === 'em_uso' || s.status === 'reservado').length;
  const occupancyPercentage = spaces.length ? Math.round((totalOccupiedSpaces / spaces.length) * 100) : 0;

  // Mural notice form modal
  const [isNewNoticeOpen, setIsNewNoticeOpen] = useState(false);
  const [newNoticeTitle, setNewNoticeTitle] = useState('');
  const [newNoticeContent, setNewNoticeContent] = useState('');
  const [newNoticePriority, setNewNoticePriority] = useState<'baixa' | 'normal' | 'alta'>('normal');

  const handleTogglePinNotice = (id: string) => {
    sigefStorage.togglePinNotice(id);
    showToast('Aviso atualizado!', 'info');
  };

  const handleDeleteNotice = (id: string) => {
    sigefStorage.deleteNotice(id);
    showToast('Aviso removido do mural.', 'info');
  };

  // Estado inicial vazio do aviso: nada do comunicado anterior é reaproveitado.
  const resetNoticeForm = () => {
    setNewNoticeTitle('');
    setNewNoticeContent('');
    setNewNoticePriority('normal');
  };

  const handleOpenNewNotice = () => {
    resetNoticeForm();
    setIsNewNoticeOpen(true);
  };

  const handleCancelarNotice = () => {
    resetNoticeForm();
    setIsNewNoticeOpen(false);
  };

  const handleCreateNotice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoticeTitle.trim() || !newNoticeContent.trim()) {
      showToast('Preencha o título e o conteúdo do aviso.', 'error');
      return;
    }

    const currentUser = sigefStorage.getCurrentUser();
    const now = new Date();
    const dateFormatted = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

    const item: NoticeBoardItem = {
      id: 'notice-' + Date.now(),
      title: newNoticeTitle.trim(),
      content: newNoticeContent.trim(),
      author: currentUser.name,
      authorRole: currentUser.roleLabel,
      date: dateFormatted,
      isPinned: false,
      priority: newNoticePriority,
    };

    sigefStorage.saveNotice(item);
    showToast('Novo comunicado publicado no Mural da COEF!', 'success');
    resetNoticeForm();
    setIsNewNoticeOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* 2 Big Primary Highlight Action Banners */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Banner 1: Terminal de Empréstimos */}
        <button
          onClick={onOpenTerminalLoan}
          className="group relative flex flex-col justify-between p-4 sm:p-6 rounded-2xl bg-gradient-to-br from-[#102027] to-[#122A2F] border border-emerald-500/30 hover:border-emerald-500/60 shadow-xl shadow-black/30 transition-all text-left overflow-hidden active:scale-[0.99]"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all" />
          <div className="flex items-start justify-between">
            <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <ScanLine className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
              Balcão Rápido
            </span>
          </div>
          <div className="mt-5">
            <h2 className="text-lg sm:text-xl font-bold text-white group-hover:text-emerald-300 transition-colors">
              Terminal de Empréstimos
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed">
              Bipagem rápida por matrícula/SIAPE, verificação de bloqueios e emissão de termo digital.
            </p>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-emerald-400">
            <span>Acessar Balcão Express</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>

        {/* Banner 2: Cronograma dos Espaços */}
        <button
          onClick={() => onNavigate('espacos')}
          className="group relative flex flex-col justify-between p-4 sm:p-6 rounded-2xl bg-gradient-to-br from-[#102027] to-[#162534] border border-sky-500/30 hover:border-sky-500/60 shadow-xl shadow-black/30 transition-all text-left overflow-hidden active:scale-[0.99]"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl group-hover:bg-sky-500/20 transition-all" />
          <div className="flex items-start justify-between">
            <div className="p-3 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-500/30">
              <CalendarDays className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold">
              Grade Semanal
            </span>
          </div>
          <div className="mt-5">
            <h2 className="text-lg sm:text-xl font-bold text-white group-hover:text-sky-300 transition-colors">
              Cronograma dos Espaços
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed">
              Mapa semanal de ocupação de 07:00 às 22:00, reservas de aulas, treinos e bloqueios de manutenção.
            </p>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-sky-400">
            <span>Visualizar Mapa dos Espaços</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>
      </div>

      {/* Quick Shortcuts Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => onNavigate('materiais')}
          className="flex items-center gap-2.5 p-3 min-h-14 rounded-xl bg-[#102027] border border-white/10 hover:border-white/20 transition-colors text-left min-w-0"
        >
          <Dumbbell className="w-4 h-4 text-emerald-400 shrink-0" />
          <div>
            <span className="text-xs font-semibold text-white block">Consultar Acervo</span>
            <span className="text-[10px] text-slate-400">Inventário & Tombo</span>
          </div>
        </button>

        <button
          onClick={() => onNavigate('normas')}
          className="flex items-center gap-2.5 p-3 min-h-14 rounded-xl bg-[#102027] border border-white/10 hover:border-white/20 transition-colors text-left min-w-0"
        >
          <BookOpenText className="w-4 h-4 text-sky-400 shrink-0" />
          <div>
            <span className="text-xs font-semibold text-white block">Normas & Regras</span>
            <span className="text-[10px] text-slate-400">Regulamento COEF</span>
          </div>
        </button>

        <button
          onClick={() => onNavigate('espacos')}
          className="flex items-center gap-2.5 p-3 min-h-14 rounded-xl bg-[#102027] border border-white/10 hover:border-white/20 transition-colors text-left min-w-0"
        >
          <Activity className="w-4 h-4 text-amber-400 shrink-0" />
          <div>
            <span className="text-xs font-semibold text-white block">Status dos Espaços</span>
            <span className="text-[10px] text-slate-400">Tempo real</span>
          </div>
        </button>

        <button
          onClick={() => onNavigate('normas')}
          className="flex items-center gap-2.5 p-3 min-h-14 rounded-xl bg-[#102027] border border-white/10 hover:border-white/20 transition-colors text-left min-w-0"
        >
          <PhoneCall className="w-4 h-4 text-purple-400 shrink-0" />
          <div>
            <span className="text-xs font-semibold text-white block">Atendimento COEF</span>
            <span className="text-[10px] text-slate-400">Coordenação Bloco E</span>
          </div>
        </button>
      </div>

      {/* KPI Stat Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Alunos Atendidos */}
        <div className="p-4 rounded-2xl bg-[#102027] border border-white/10 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
            Alunos Atendidos
          </span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold font-mono text-white tabular-nums">1.280</span>
            <span className="text-[10px] text-emerald-400 font-semibold">Semestre</span>
          </div>
          <span className="mt-1 text-[10px] text-slate-500">Cursos técnicos e sup.</span>
        </div>

        {/* Materiais Cadastrados */}
        <div className="p-4 rounded-2xl bg-[#102027] border border-white/10 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
            Materiais no Acervo
          </span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold font-mono text-white tabular-nums">{totalMaterials}</span>
            <span className="text-[10px] text-slate-400">itens</span>
          </div>
          <span className="mt-1 text-[10px] text-slate-500">{materials.length} categorias</span>
        </div>

        {/* Taxa de Ocupação */}
        <div className="p-4 rounded-2xl bg-[#102027] border border-white/10 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
            Taxa de Ocupação
          </span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
              {occupancyPercentage}%
            </span>
          </div>
          <span className="mt-1 text-[10px] text-slate-500">Média dos 6 espaços</span>
        </div>

        {/* Kits Prontos */}
        <div className="p-4 rounded-2xl bg-[#102027] border border-white/10 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
            Kits Prontos
          </span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold font-mono text-white tabular-nums">
              {readyKits.length}
            </span>
            <span className="text-[10px] text-slate-400">/ {kits.length}</span>
          </div>
          <span className="mt-1 text-[10px] text-slate-500">Com estoque completo</span>
        </div>

        {/* Empréstimos Ativos */}
        <div className="p-4 rounded-2xl bg-[#102027] border border-white/10 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
            Empréstimos Ativos
          </span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold font-mono text-sky-400 tabular-nums">
              {activeLoans.length}
            </span>
            <span className="text-[10px] text-sky-300">em uso</span>
          </div>
          <span className="mt-1 text-[10px] text-slate-500">Dentro do prazo legal</span>
        </div>

        {/* Empréstimos Atrasados (Red highlight) */}
        <div
          className={`p-4 rounded-2xl border flex flex-col justify-between transition-all ${
            overdueLoans.length > 0
              ? 'bg-rose-950/40 border-rose-500/40'
              : 'bg-[#102027] border-white/10'
          }`}
        >
          <span className="text-[11px] font-medium text-rose-300 uppercase tracking-wider block">
            Atrasados
          </span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold font-mono text-rose-400 tabular-nums">
              {overdueLoans.length}
            </span>
            <span className="text-[10px] text-rose-300">bloqueio</span>
          </div>
          <span className="mt-1 text-[10px] text-rose-400/80">Requer notificação</span>
        </div>
      </div>

      {/* Espaços em Atividade Hoje */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white">
              Espaços Esportivos em Atividade Hoje
            </h3>
            <p className="text-xs text-slate-400">
              Acompanhamento em tempo real de ocupação, aulas agendadas e manutenção
            </p>
          </div>
          <button
            onClick={() => onNavigate('espacos')}
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
          >
            <span>Ver grade completa</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {spaces.length === 0 ? (
            <div className="col-span-full p-8 text-center rounded-2xl bg-[#102027] border border-white/10">
              <CalendarDays className="w-10 h-10 mx-auto text-slate-500 mb-2 opacity-50" />
              <p className="text-sm font-semibold text-white">Nenhum espaço esportivo cadastrado no campus.</p>
              <p className="text-xs text-slate-400 mt-1 mb-4">
                Cadastre as quadras, campos e salas do complexo esportivo para acompanhar as atividades.
              </p>
              <button
                onClick={() => onNavigate('espacos')}
                className="px-4 py-2 bg-[#1B8A4B] hover:bg-[#22A55B] text-white text-xs font-semibold rounded-xl shadow-md transition-colors"
              >
                + Cadastrar Espaço Físico
              </button>
            </div>
          ) : (
            spaces.map((space) => {
            const badge = getSpaceStatusBadge(space.status);
            // Check if there is an active reservation right now
            const spaceResToday = todayReservations.filter((r) => r.spaceId === space.id);
            const activeRes = spaceResToday[0];

            return (
              <div
                key={space.id}
                className="rounded-2xl bg-[#102027] border border-white/10 overflow-hidden flex flex-col justify-between shadow-lg hover:border-white/20 transition-all"
              >
                {/* Photo / Visual Fallback */}
                <div className="relative h-36 w-full bg-slate-900 overflow-hidden">
                  {space.photo ? (
                    <img
                      src={space.photo}
                      alt={space.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 text-slate-600">
                      <CalendarDays className="w-12 h-12 opacity-30" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#102027] via-transparent to-black/30" />

                  {/* Status badge */}
                  <div className="absolute top-3 right-3">
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full border backdrop-blur-md ${badge.bgClass} ${badge.textClass} ${badge.borderClass}`}
                    >
                      {badge.label}
                    </span>
                  </div>

                  {/* Capacity */}
                  <div className="absolute bottom-2 left-3 text-[11px] text-slate-300 font-medium">
                    Capacidade: <span className="font-bold text-white font-mono">{space.capacity}</span> pessoas
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h4 className="font-bold text-sm sm:text-base text-white">{space.name}</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{space.notes}</p>
                  </div>

                  {/* Current Activity Box */}
                  <div className="p-2.5 rounded-xl bg-[#0B1418] border border-white/5 text-xs space-y-1">
                    {space.status === 'manutencao' ? (
                      <div className="text-amber-300">
                        <span className="font-semibold block">Em Manutenção Preventiva:</span>
                        <p className="text-[11px] text-slate-400">{space.maintenanceReason || 'Revisão técnica'}</p>
                        {space.maintenanceOs && (
                          <span className="text-[10px] font-mono text-amber-400 font-bold block mt-0.5">
                            {space.maintenanceOs} • Retorno em {formatDateBR(space.maintenanceUntil)}
                          </span>
                        )}
                      </div>
                    ) : activeRes ? (
                      <div>
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="font-semibold text-white">{activeRes.sport}</span>
                          <span className="font-mono text-emerald-400 font-bold">
                            {activeRes.startTime} - {activeRes.endTime}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">{activeRes.groupOrClass}</p>
                        <p className="text-[10px] text-slate-500">Docente: {activeRes.teacherName}</p>
                      </div>
                    ) : (
                      <div className="text-slate-400 text-center py-1">
                        <span>Nenhuma reserva ativa neste momento.</span>
                      </div>
                    )}
                  </div>

                  {/* Card Actions */}
                  <div className="pt-1 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      {space.allowedSports.slice(0, 2).join(', ')}
                      {space.allowedSports.length > 2 && '…'}
                    </span>

                    {space.status === 'livre' ? (
                      <button
                        onClick={() => onOpenNewReservation(space.id)}
                        className="px-3 py-1.5 bg-[#1B8A4B] hover:bg-[#22A55B] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
                      >
                        Reservar Agora
                      </button>
                    ) : (
                      <button
                        onClick={() => onNavigate('espacos')}
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium rounded-lg transition-colors"
                      >
                        Ver Horários
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          }))}
        </div>
      </section>

      {/* Mural da Coordenação (Official Notice Board) */}
      <section className="p-5 sm:p-6 rounded-2xl bg-[#102027] border border-white/10 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Pin className="w-5 h-5 text-emerald-400 rotate-45" />
              <span>Mural Oficial da Coordenação de Ed. Física</span>
            </h3>
            <p className="text-xs text-slate-400">
              Comunicados, avisos de competições (JIF), normas e ordens de serviço da COEF
            </p>
          </div>

          <button
            onClick={handleOpenNewNotice}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold rounded-xl transition-colors self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Comunicado</span>
          </button>
        </div>

        {/* Notices List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {notices.length === 0 ? (
            <div className="col-span-full p-8 text-center rounded-xl bg-[#0B1418] border border-white/5 text-slate-400 text-xs">
              <p className="font-semibold text-slate-300">Nenhum comunicado publicado no mural ainda.</p>
              <p className="mt-1 text-slate-500">Utilize o botão acima para publicar avisos oficiais da COEF.</p>
            </div>
          ) : (
            notices.map((notice) => (
            <div
              key={notice.id}
              className={`p-4 rounded-xl border flex flex-col justify-between transition-colors ${
                notice.isPinned
                  ? 'bg-[#0B1418] border-emerald-500/40 shadow-md'
                  : 'bg-[#0B1418]/60 border-white/5'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span
                    className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                      notice.priority === 'alta'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : notice.priority === 'normal'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-slate-500/20 text-slate-300'
                    }`}
                  >
                    {notice.priority === 'alta' ? 'Urgente' : 'Informativo'}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleTogglePinNotice(notice.id)}
                      className={`p-1 rounded hover:bg-white/10 transition-colors ${
                        notice.isPinned ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                      title={notice.isPinned ? 'Desafixar' : 'Fixar no topo'}
                    >
                      <Pin className={`w-3.5 h-3.5 ${notice.isPinned ? 'fill-emerald-400' : ''}`} />
                    </button>
                    {userRole === 'admin' && (
                      <button
                        onClick={() => handleDeleteNotice(notice.id)}
                        className="p-1 text-slate-500 hover:text-rose-400 rounded hover:bg-white/10 transition-colors"
                        title="Excluir comunicado"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <h4 className="font-bold text-sm text-white leading-snug">{notice.title}</h4>
                <p className="mt-2 text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                  {notice.content}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                <span className="font-medium text-slate-300">{notice.author}</span>
                <span className="font-mono text-slate-500">{notice.date}</span>
              </div>
            </div>
          )))}
        </div>
      </section>

      {/* Modal for creating a new notice */}
      {isNewNoticeOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-xs">
          <div className="sigef-modal relative w-full max-h-[100dvh] sm:max-h-[92vh] overflow-y-auto overscroll-contain max-w-md bg-[#102027] text-slate-100 rounded-2xl border border-white/10 p-5 sm:p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">Publicar Comunicado no Mural</h3>
            <p className="text-xs text-slate-400 mb-4">
              O aviso ficará visível para toda a comunidade acadêmica da COEF.
            </p>

            <form onSubmit={handleCreateNotice} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Título do Aviso</label>
                <input
                  type="text"
                  value={newNoticeTitle}
                  onChange={(e) => setNewNoticeTitle(e.target.value)}
                  placeholder="Ex: Treinos de Seleção de Basquete"
                  className="w-full h-9 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Prioridade</label>
                <select
                  value={newNoticePriority}
                  onChange={(e) => setNewNoticePriority(e.target.value as any)}
                  className="w-full h-9 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none"
                >
                  <option value="normal">Normal (Informativo)</option>
                  <option value="alta">Alta (Importante / Urgente)</option>
                  <option value="baixa">Baixa (Geral)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Conteúdo da Mensagem</label>
                <textarea
                  rows={4}
                  value={newNoticeContent}
                  onChange={(e) => setNewNoticeContent(e.target.value)}
                  placeholder="Descreva as instruções, horários e orientações aos discentes e docentes..."
                  className="w-full p-2.5 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="sigef-modal-footer pt-3 border-t border-white/10 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCancelarNotice}
                  className="px-3 py-2 text-slate-400 hover:text-white rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1B8A4B] hover:bg-[#22A55B] text-white font-semibold rounded-xl"
                >
                  Publicar Aviso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
