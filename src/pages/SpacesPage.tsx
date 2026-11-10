import React, { useState } from 'react';
import { Space, Reservation, SpaceType, SpaceStatus, UseType } from '../types/sigef';
import { sigefStorage } from '../services/storage';
import { formatDateBR, getSpaceStatusBadge, getUseTypeBadge } from '../utils/formatters';
import { useToast } from '../components/Toast';
import { EditReservationModal } from '../components/EditReservationModal';
import {
  CalendarDays,
  Plus,
  Wrench,
  Clock,
  Users,
  CheckCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Filter,
  Edit2,
  Lock,
  Layers,
  Info,
} from 'lucide-react';

interface SpacesPageProps {
  onOpenNewReservation: (spaceId?: string, date?: string, time?: string) => void;
  userRole: string;
}

export const SpacesPage: React.FC<SpacesPageProps> = ({ onOpenNewReservation, userRole }) => {
  const { showToast } = useToast();
  const spaces = sigefStorage.getSpaces();
  const reservations = sigefStorage.getReservations();

  const [selectedSpaceId, setSelectedSpaceId] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'semana' | 'dia'>('semana');

  // Reservation Edit/Delete Modal state
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);

  // Weekly date navigation (defaults to current week)
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const d = new Date();
    const day = d.getDay(); // 0 is Sunday
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    return new Date(d.setDate(diff));
  });

  // Calculate the 6 days of the week (Mon - Sat)
  const weekDays = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date(currentWeekStart);
    d.setDate(currentWeekStart.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const dayName = d.toLocaleDateString('pt-BR', { weekday: 'short' });
    return { dateStr, dayName, dayNum: d.getDate(), fullDate: d };
  });

  const [selectedSingleDay, setSelectedSingleDay] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Time slots from 07:00 to 22:00
  const timeSlots = [
    '07:00',
    '08:00',
    '09:00',
    '10:00',
    '11:00',
    '12:00',
    '13:00',
    '14:00',
    '15:00',
    '16:00',
    '17:00',
    '18:00',
    '19:00',
    '20:00',
    '21:00',
  ];

  // Maintenance Modal state
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);
  const [targetSpaceId, setTargetSpaceId] = useState('');
  const [maintenanceOs, setMaintenanceOs] = useState('');
  const [maintenanceReason, setMaintenanceReason] = useState('');
  const [maintenanceUntil, setMaintenanceUntil] = useState('');

  // Space Edit Modal state
  const [isSpaceModalOpen, setIsSpaceModalOpen] = useState(false);
  const [editingSpace, setEditingSpace] = useState<Space | null>(null);
  const [spaceForm, setSpaceForm] = useState<{
    name: string;
    type: SpaceType | '';
    capacity: number | '';
    openHours: string;
    allowedSports: string;
    notes: string;
  }>({
    name: '',
    type: '',
    capacity: '',
    openHours: '',
    allowedSports: '',
    notes: '',
  });

  const handlePrevWeek = () => {
    const prev = new Date(currentWeekStart);
    prev.setDate(prev.getDate() - 7);
    setCurrentWeekStart(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(currentWeekStart);
    next.setDate(next.getDate() + 7);
    setCurrentWeekStart(next);
  };

  const handleOpenMaintenance = (space: Space) => {
    setTargetSpaceId(space.id);
    setMaintenanceOs(space.maintenanceOs || `OS-2026/${Math.floor(100 + Math.random() * 900)}`);
    setMaintenanceReason(space.maintenanceReason || '');
    setMaintenanceUntil(space.maintenanceUntil || '');
    setIsMaintenanceModalOpen(true);
  };

  const handleSaveMaintenance = (e: React.FormEvent) => {
    e.preventDefault();
    const space = spaces.find((s) => s.id === targetSpaceId);
    if (!space) return;

    if (space.status === 'manutencao') {
      // Liberar espaço
      space.status = 'livre';
      space.maintenanceOs = undefined;
      space.maintenanceReason = undefined;
      space.maintenanceUntil = undefined;
      sigefStorage.saveSpace(space);
      showToast(`O espaço "${space.name}" foi liberado da manutenção!`, 'success');
    } else {
      // Bloquear em manutenção
      space.status = 'manutencao';
      space.maintenanceOs = maintenanceOs.trim();
      space.maintenanceReason = maintenanceReason.trim() || 'Manutenção técnica';
      space.maintenanceUntil = maintenanceUntil;
      sigefStorage.saveSpace(space);
      showToast(`Espaço "${space.name}" bloqueado para manutenção (${maintenanceOs}).`, 'info');
    }

    setIsMaintenanceModalOpen(false);
  };

  const handleOpenNewSpace = () => {
    setEditingSpace(null);
    setSpaceForm({
      name: '',
      type: '',
      capacity: '',
      openHours: '',
      allowedSports: '',
      notes: '',
    });
    setIsSpaceModalOpen(true);
  };

  const handleOpenEditSpace = (space: Space) => {
    setEditingSpace(space);
    setSpaceForm({
      name: space.name,
      type: space.type,
      capacity: space.capacity,
      openHours: space.openHours,
      allowedSports: space.allowedSports.join(', '),
      notes: space.notes,
    });
    setIsSpaceModalOpen(true);
  };

  const handleSaveSpace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!spaceForm.name.trim()) {
      showToast('Informe o nome do espaço esportivo.', 'error');
      return;
    }

    if (!spaceForm.type) {
      showToast('Selecione o tipo de espaço.', 'error');
      return;
    }

    if (!spaceForm.capacity || Number(spaceForm.capacity) < 1) {
      showToast('Informe a capacidade do espaço.', 'error');
      return;
    }

    const space: Space = {
      id: editingSpace ? editingSpace.id : 'espaco-' + Date.now(),
      name: spaceForm.name.trim(),
      type: spaceForm.type as SpaceType,
      capacity: Number(spaceForm.capacity),
      openHours: spaceForm.openHours.trim(),
      allowedSports: spaceForm.allowedSports
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      photo: editingSpace?.photo || '',
      notes: spaceForm.notes.trim(),
      status: editingSpace ? editingSpace.status : 'livre',
    };

    sigefStorage.saveSpace(space);
    showToast(editingSpace ? 'Espaço atualizado com sucesso!' : 'Novo espaço cadastrado!', 'success');
    setIsSpaceModalOpen(false);
  };

  // Helper to match reservations to a slot
  const getSlotReservations = (dateStr: string, time: string, spaceIdFilter?: string) => {
    const slotHour = parseInt(time.split(':')[0], 10);

    return reservations.filter((r) => {
      if (r.date !== dateStr) return false;
      if (spaceIdFilter && spaceIdFilter !== 'all' && r.spaceId !== spaceIdFilter) return false;

      const [startH] = r.startTime.split(':').map(Number);
      const [endH] = r.endTime.split(':').map(Number);

      // Matches if slot falls within start and end hour
      return slotHour >= startH && slotHour < endH;
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-emerald-400" />
            <span>Gestão dos Espaços & Mapa de Ocupação</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Controle de quadras, salas, campos, validação de sobreposição de horários e manutenção
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {userRole === 'admin' && (
            <button
              onClick={handleOpenNewSpace}
              className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-semibold rounded-xl transition-colors"
            >
              + Novo Espaço
            </button>
          )}

          <button
            onClick={() => onOpenNewReservation()}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#1B8A4B] hover:bg-[#22A55B] text-white text-xs font-semibold rounded-xl shadow-md shadow-emerald-950/40 transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Reserva</span>
          </button>
        </div>
      </div>

      {/* Spaces Overview Cards (Horizontal Scroll or Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {spaces.length === 0 ? (
          <div className="col-span-full p-8 text-center rounded-2xl bg-[#102027] border border-white/10">
            <CalendarDays className="w-10 h-10 mx-auto text-slate-500 mb-2 opacity-50" />
            <p className="text-sm font-semibold text-white">Nenhum espaço esportivo cadastrado ainda.</p>
            <p className="text-xs text-slate-400 mt-1 mb-4">
              Cadastre as quadras, campos de futebol, salas de dança ou musculação para iniciar a gestão do campus.
            </p>
            <button
              onClick={handleOpenNewSpace}
              className="px-4 py-2 bg-[#1B8A4B] hover:bg-[#22A55B] text-white text-xs font-semibold rounded-xl shadow-md transition-colors"
            >
              + Cadastrar Primeiro Espaço
            </button>
          </div>
        ) : (
          spaces.map((s) => {
          const badge = getSpaceStatusBadge(s.status);
          const isSelected = selectedSpaceId === s.id;

          return (
            <div
              key={s.id}
              className={`p-3.5 rounded-xl border transition-all ${
                isSelected
                  ? 'bg-[#102027] border-emerald-500 shadow-md ring-1 ring-emerald-500/50'
                  : 'bg-[#102027] border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-bold text-xs sm:text-sm text-white">{s.name}</h4>
                  <p className="text-[11px] text-slate-400">Capacidade: {s.capacity} pessoas</p>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.bgClass} ${badge.textClass} ${badge.borderClass}`}
                >
                  {badge.label}
                </span>
              </div>

              <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Horário: {s.openHours}</span>
                <span className="font-mono text-emerald-400">
                  {reservations.filter((r) => r.spaceId === s.id && r.date === weekDays[0]?.dateStr).length} reservas esta semana
                </span>
              </div>

              <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between">
                <button
                  onClick={() => setSelectedSpaceId(isSelected ? 'all' : s.id)}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                    isSelected
                      ? 'bg-emerald-500 text-white'
                      : 'bg-white/5 text-slate-300 hover:text-white'
                  }`}
                >
                  {isSelected ? 'Filtrando Este' : 'Filtrar na Grade'}
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleOpenMaintenance(s)}
                    className="p-1.5 text-slate-400 hover:text-amber-400 rounded-lg hover:bg-white/5 transition-colors"
                    title="Ordem de Serviço / Manutenção"
                  >
                    <Wrench className="w-4 h-4" />
                  </button>
                  {userRole === 'admin' && (
                    <button
                      onClick={() => handleOpenEditSpace(s)}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                      title="Editar Espaço"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        }))}
      </div>

      {/* Calendar Controls & Filter Header */}
      <div className="p-4 rounded-2xl bg-[#102027] border border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Week navigation */}
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrevWeek}
            className="p-2 rounded-xl bg-[#0B1418] border border-white/10 hover:border-white/20 text-slate-300 hover:text-white transition-colors"
            title="Semana anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="text-xs sm:text-sm font-semibold text-white">
            Semana: {formatDateBR(weekDays[0]?.dateStr)} até {formatDateBR(weekDays[5]?.dateStr)}
          </span>

          <button
            onClick={handleNextWeek}
            className="p-2 rounded-xl bg-[#0B1418] border border-white/10 hover:border-white/20 text-slate-300 hover:text-white transition-colors"
            title="Próxima semana"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* View Switcher & Space Filter */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Space filter dropdown */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedSpaceId}
              onChange={(e) => setSelectedSpaceId(e.target.value)}
              className="h-9 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-xs text-slate-200 focus:outline-none"
            >
              <option value="all">Todos os Espaços</option>
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center bg-[#0B1418] p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setViewMode('semana')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                viewMode === 'semana'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Visão Semana
            </button>
            <button
              onClick={() => setViewMode('dia')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                viewMode === 'dia'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Visão Dia
            </button>
          </div>
        </div>
      </div>

      {/* Legend of Use Types */}
      <div className="flex items-center gap-3 flex-wrap text-[11px] text-slate-300 px-1">
        <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Legenda:</span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Aula Curricular
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" /> Treino / Seleção JIF
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-400" /> Extensão / Projeto
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Evento / Interclasses
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-400" /> Uso Livre
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Manutenção / Bloqueio
        </span>
      </div>

      {/* WEEKLY GRID VIEW */}
      {viewMode === 'semana' ? (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#102027] shadow-xl">
          <div className="min-w-[850px]">
            {/* Table Header: Days of the week */}
            <div className="grid grid-cols-7 border-b border-white/10 bg-[#0B1418] text-xs font-bold text-slate-300">
              <div className="p-3 text-center border-r border-white/5 text-slate-400">Horário</div>
              {weekDays.map((w) => (
                <div key={w.dateStr} className="p-3 text-center border-r border-white/5">
                  <span className="block uppercase text-[10px] text-emerald-400">{w.dayName}</span>
                  <span className="text-sm font-mono text-white">{w.dayNum}</span>
                </div>
              ))}
            </div>

            {/* Time Slot Rows */}
            <div className="divide-y divide-white/5 text-xs">
              {timeSlots.map((time) => (
                <div key={time} className="grid grid-cols-7 hover:bg-white/[0.01] transition-colors">
                  {/* Time label column */}
                  <div className="p-3 text-center font-mono font-semibold text-slate-400 border-r border-white/5 bg-[#0B1418]/60 flex items-center justify-center">
                    {time}
                  </div>

                  {/* 6 Day Columns */}
                  {weekDays.map((w) => {
                    const matches = getSlotReservations(w.dateStr, time, selectedSpaceId);

                    return (
                      <div
                        key={w.dateStr}
                        onClick={() => {
                          if (matches.length === 0) {
                            onOpenNewReservation(
                              selectedSpaceId !== 'all' ? selectedSpaceId : undefined,
                              w.dateStr,
                              time
                            );
                          }
                        }}
                        className={`p-1.5 border-r border-white/5 min-h-[58px] relative transition-colors ${
                          matches.length === 0 ? 'hover:bg-emerald-500/5 cursor-pointer' : ''
                        }`}
                      >
                        {matches.map((res) => {
                          const badge = getUseTypeBadge(res.useType);
                          return (
                            <div
                              key={res.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingReservation(res);
                              }}
                              className={`p-2 rounded-lg border text-[11px] leading-tight mb-1 shadow-sm cursor-pointer hover:ring-1 hover:ring-white/40 transition-shadow ${badge.colorClass}`}
                              title={`${res.sport} - ${res.groupOrClass} (${res.teacherName}) [${res.startTime} às ${res.endTime}] — clique para editar`}
                            >
                              <div className="flex items-center justify-between font-bold">
                                <span className="truncate">{res.sport}</span>
                                <span className="text-[10px] font-mono">{res.startTime}</span>
                              </div>
                              <p className="truncate text-slate-200 mt-0.5">{res.groupOrClass}</p>
                              <span className="text-[9px] text-slate-300 block truncate">
                                {res.spaceName.split(' ')[0]}
                              </span>
                            </div>
                          );
                        })}

                        {matches.length === 0 && (
                          <div className="h-full flex items-center justify-center text-slate-700 hover:text-emerald-500/60 opacity-0 hover:opacity-100 transition-opacity">
                            <Plus className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* DAILY VIEW */
        <div className="space-y-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {weekDays.map((w) => (
              <button
                key={w.dateStr}
                onClick={() => setSelectedSingleDay(w.dateStr)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold shrink-0 transition-colors ${
                  selectedSingleDay === w.dateStr
                    ? 'bg-emerald-600 text-white shadow'
                    : 'bg-[#102027] text-slate-300 hover:bg-[#102027]/80 border border-white/10'
                }`}
              >
                <span className="block uppercase text-[10px]">{w.dayName}</span>
                <span className="text-sm font-mono">{formatDateBR(w.dateStr)}</span>
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#102027] p-4 divide-y divide-white/5 space-y-3">
            {timeSlots.map((time) => {
              const matches = getSlotReservations(selectedSingleDay, time, selectedSpaceId);

              return (
                <div key={time} className="pt-3 first:pt-0 flex items-start gap-4">
                  <div className="w-16 font-mono font-bold text-slate-400 text-xs text-center py-2 bg-[#0B1418] rounded-lg border border-white/5">
                    {time}
                  </div>

                  <div className="flex-1 space-y-2">
                    {matches.length > 0 ? (
                      matches.map((res) => {
                        const badge = getUseTypeBadge(res.useType);
                        return (
                          <div
                            key={res.id}
                            onClick={() => setEditingReservation(res)}
                            className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer hover:ring-1 hover:ring-white/40 transition-shadow ${badge.colorClass}`}
                            title="Clique para editar ou excluir esta reserva"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-white">{res.sport}</span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 font-bold">
                                  {res.startTime} às {res.endTime}
                                </span>
                                <span className="text-xs uppercase font-semibold text-emerald-300">
                                  {res.spaceName}
                                </span>
                              </div>
                              <p className="text-xs text-slate-200 mt-1">
                                Turma: <strong className="text-white">{res.groupOrClass}</strong> • Docente: {res.teacherName}
                              </p>
                              {res.notes && (
                                <p className="text-[11px] text-slate-300 mt-0.5 italic">{res.notes}</p>
                              )}
                            </div>

                            <div className="flex items-center gap-2 self-start sm:self-auto">
                              <span className="text-xs font-mono text-slate-300">
                                {res.participantsCount} participantes
                              </span>
                              <Edit2 className="w-4 h-4 text-slate-400" />
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div
                        onClick={() =>
                          onOpenNewReservation(
                            selectedSpaceId !== 'all' ? selectedSpaceId : undefined,
                            selectedSingleDay,
                            time
                          )
                        }
                        className="p-2.5 rounded-xl border border-dashed border-white/10 text-xs text-slate-500 hover:text-emerald-400 hover:border-emerald-500/40 hover:bg-emerald-500/5 cursor-pointer flex items-center justify-between transition-colors"
                      >
                        <span>Horário livre. Clique para agendar uma reserva neste bloco.</span>
                        <Plus className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Maintenance OS Modal */}
      {isMaintenanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-[#102027] text-slate-100 rounded-2xl border border-white/10 p-5 sm:p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
              <Wrench className="w-5 h-5 text-amber-400" />
              <span>Controle de Manutenção do Espaço</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Bloqueia o espaço na grade e gera registro oficial de Ordem de Serviço (OS).
            </p>

            <form onSubmit={handleSaveMaintenance} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Nº Ordem de Serviço (OS)</label>
                <input
                  type="text"
                  value={maintenanceOs}
                  onChange={(e) => setMaintenanceOs(e.target.value)}
                  placeholder="Ex: OS-2026/042"
                  className="w-full h-9 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Motivo / Tipo de Manutenção</label>
                <textarea
                  rows={2}
                  value={maintenanceReason}
                  onChange={(e) => setMaintenanceReason(e.target.value)}
                  placeholder="Ex: Nivelamento de solo, troca de iluminação LED, conserto de tabela hidráulica..."
                  className="w-full p-2.5 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Previsão de Conclusão / Retorno</label>
                <input
                  type="date"
                  value={maintenanceUntil}
                  onChange={(e) => setMaintenanceUntil(e.target.value)}
                  className="w-full h-9 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsMaintenanceModalOpen(false)}
                  className="px-3 py-2 text-slate-400 hover:text-white rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl"
                >
                  Salvar Estado de Manutenção
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reservation Edit/Delete Modal */}
      {editingReservation && (
        <EditReservationModal
          reservation={editingReservation}
          onClose={() => setEditingReservation(null)}
          onSaved={() => setEditingReservation(null)}
        />
      )}

      {/* Space Create/Edit Modal */}
      {isSpaceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-[#102027] text-slate-100 rounded-2xl border border-white/10 p-5 sm:p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">
              {editingSpace ? 'Editar Espaço Esportivo' : 'Cadastrar Novo Espaço Físico'}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Configuração das dependências do complexo de Educação Física do campus.
            </p>

            <form onSubmit={handleSaveSpace} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Nome do Espaço</label>
                <input
                  type="text"
                  value={spaceForm.name}
                  onChange={(e) => setSpaceForm({ ...spaceForm, name: e.target.value })}
                  placeholder="Ex: Ginásio Poliesportivo Coberto (G1)"
                  className="w-full h-9 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Tipo de Espaço</label>
                  <select
                    value={spaceForm.type}
                    onChange={(e) => setSpaceForm({ ...spaceForm, type: e.target.value as SpaceType })}
                    className="w-full h-9 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none"
                    required
                  >
                    <option value="">Selecione o tipo</option>
                    <option value="quadra">Quadra Poliesportiva</option>
                    <option value="campo">Campo Society / Futebol</option>
                    <option value="areia">Quadra de Areia</option>
                    <option value="danca">Sala de Dança</option>
                    <option value="tatame">Sala de Lutas / Tatame</option>
                    <option value="musculacao">Sala de Musculação</option>
                    <option value="outro">Outro Espaço</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Capacidade (Pessoas)</label>
                  <input
                    type="number"
                    min="1"
                    value={spaceForm.capacity}
                    onChange={(e) =>
                      setSpaceForm({
                        ...spaceForm,
                        capacity: e.target.value === '' ? '' : Number(e.target.value),
                      })
                    }
                    placeholder="Ex: 50"
                    className="w-full h-9 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Horário de Funcionamento</label>
                <input
                  type="text"
                  value={spaceForm.openHours}
                  onChange={(e) => setSpaceForm({ ...spaceForm, openHours: e.target.value })}
                  placeholder="Ex: 07:00 às 22:00"
                  className="w-full h-9 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Modalidades Permitidas (separadas por vírgula)
                </label>
                <input
                  type="text"
                  value={spaceForm.allowedSports}
                  onChange={(e) => setSpaceForm({ ...spaceForm, allowedSports: e.target.value })}
                  placeholder="Ex: Futsal, Basquete, Voleibol, Badminton"
                  className="w-full h-9 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Observações Técnicas / Equipamentos</label>
                <textarea
                  rows={2}
                  value={spaceForm.notes}
                  onChange={(e) => setSpaceForm({ ...spaceForm, notes: e.target.value })}
                  placeholder="Piso de madeira flutuante, iluminação LED..."
                  className="w-full p-2.5 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSpaceModalOpen(false)}
                  className="px-3 py-2 text-slate-400 hover:text-white rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1B8A4B] hover:bg-[#22A55B] text-white font-semibold rounded-xl"
                >
                  Salvar Espaço
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
