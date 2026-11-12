import React, { useState, useEffect } from 'react';
import { Space, Reservation, UseType, MaterialAllocation } from '../types/sigef';
import { sigefStorage } from '../services/storage';
import { useToast } from './Toast';
import { X, Calendar, Clock, AlertTriangle, CheckCircle, Repeat, Users, Dumbbell } from 'lucide-react';

interface NewReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  preselectedSpaceId?: string;
  preselectedDate?: string;
  preselectedTime?: string;
}

export const NewReservationModal: React.FC<NewReservationModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  preselectedSpaceId,
  preselectedDate,
  preselectedTime,
}) => {
  const { showToast } = useToast();
  const spaces = sigefStorage.getSpaces();
  const requesters = sigefStorage.getRequesters().filter(
    (r) => r.type === 'docente' || r.type === 'servidor' || r.type === 'estagiario' || r.type === 'monitor'
  );
  const kits = sigefStorage.getKits();

  const [spaceId, setSpaceId] = useState(preselectedSpaceId || '');
  const [date, setDate] = useState(preselectedDate || '');
  const [startTime, setStartTime] = useState(preselectedTime || '');
  const [endTime, setEndTime] = useState('');
  const [useType, setUseType] = useState<UseType | ''>('');
  const [sport, setSport] = useState('');
  const [groupOrClass, setGroupOrClass] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [customTeacherName, setCustomTeacherName] = useState('');
  const [participantsCount, setParticipantsCount] = useState<number | ''>('');
  const [selectedKitId, setSelectedKitId] = useState('');
  const [recurrence, setRecurrence] = useState<'none' | 'weekly'>('none');
  const [recurrenceUntil, setRecurrenceUntil] = useState('');
  const [notes, setNotes] = useState('');

  // Conflict warning
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  // Estado inicial vazio: nada da última reserva permanece no formulário.
  const resetForm = () => {
    setSpaceId(preselectedSpaceId || '');
    setDate(preselectedDate || '');
    setStartTime(preselectedTime || '');
    setEndTime('');
    setUseType('');
    setSport('');
    setGroupOrClass('');
    setTeacherId('');
    setCustomTeacherName('');
    setParticipantsCount('');
    setSelectedKitId('');
    setRecurrence('none');
    setRecurrenceUntil('');
    setNotes('');
    setConflictWarning(null);
  };

  useEffect(() => {
    if (isOpen) resetForm();
  }, [isOpen, preselectedSpaceId, preselectedDate, preselectedTime]);

  // Live conflict evaluation
  useEffect(() => {
    if (!spaceId || !date || !startTime || !endTime) {
      setConflictWarning(null);
      return;
    }

    // Check space status
    const selectedSpace = spaces.find((s) => s.id === spaceId);
    if (selectedSpace?.status === 'manutencao' || selectedSpace?.status === 'interditado') {
      setConflictWarning(
        `Atenção: O espaço "${selectedSpace.name}" está marcado como ${selectedSpace.status.toUpperCase()}! ${selectedSpace.maintenanceReason ? `(${selectedSpace.maintenanceReason})` : ''}`
      );
      return;
    }

    const conflict = sigefStorage.checkReservationConflict(spaceId, date, startTime, endTime);
    if (conflict) {
      setConflictWarning(
        `Conflito de horário detectado: "${conflict.groupOrClass}" já reservou este espaço das ${conflict.startTime} às ${conflict.endTime} (${conflict.teacherName}).`
      );
    } else {
      setConflictWarning(null);
    }
  }, [spaceId, date, startTime, endTime, spaces]);

  if (!isOpen) return null;

  const handleCancelar = () => {
    resetForm();
    onClose();
  };

  const currentSpace = spaces.find((s) => s.id === spaceId);
  const currentTeacher = requesters.find((r) => r.id === teacherId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (spaces.length === 0) {
      showToast('Cadastre ao menos um espaço esportivo antes de criar reservas.', 'error');
      return;
    }

    if (!spaceId) {
      showToast('Selecione um espaço esportivo.', 'error');
      return;
    }

    if (!date) {
      showToast('Selecione a data do agendamento.', 'error');
      return;
    }

    if (!startTime || !endTime) {
      showToast('Informe o horário de início e término.', 'error');
      return;
    }

    if (!useType) {
      showToast('Selecione o tipo de uso.', 'error');
      return;
    }

    if (!groupOrClass.trim()) {
      showToast('Por favor, informe a turma ou grupo responsável.', 'error');
      return;
    }

    const teacherNameResolved =
      currentTeacher?.name || customTeacherName.trim() || 'Docente Responsável';

    if (requesters.length === 0 && !customTeacherName.trim()) {
      showToast('Por favor, informe o nome do docente/responsável.', 'error');
      return;
    }

    if (startTime >= endTime) {
      showToast('O horário de término deve ser após o horário de início.', 'error');
      return;
    }

    if (recurrence === 'weekly' && !recurrenceUntil) {
      showToast('Informe a data limite para a recorrência semanal.', 'error');
      return;
    }

    const materialAllocations: MaterialAllocation[] = [];
    if (selectedKitId) {
      const kit = kits.find((k) => k.id === selectedKitId);
      if (kit) {
        kit.items.forEach((item) => {
          materialAllocations.push({
            materialId: item.materialId,
            materialName: item.materialName,
            quantity: item.quantity,
          });
        });
      }
    }

    const newRes: Reservation = {
      id: 'res-' + Date.now(),
      spaceId,
      spaceName: currentSpace?.name || 'Espaço Esportivo',
      date,
      startTime,
      endTime,
      useType: useType as UseType,
      sport: sport || 'Geral',
      groupOrClass: groupOrClass.trim(),
      teacherId: currentTeacher?.id || 'doc-custom',
      teacherName: teacherNameResolved,
      participantsCount: Number(participantsCount) || 0,
      kitIds: selectedKitId ? [selectedKitId] : [],
      materialAllocations,
      recurrence,
      recurrenceUntil: recurrence === 'weekly' ? recurrenceUntil : undefined,
      status: 'confirmada',
      notes: notes.trim(),
    };

    const result = sigefStorage.saveReservation(newRes);
    if (!result.success) {
      showToast(result.conflictError || 'Erro ao registrar reserva.', 'error');
      return;
    }

    showToast('Reserva de espaço agendada com sucesso!', 'success');
    resetForm();
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-xs">
      <div className="sigef-modal relative w-full max-h-[100dvh] sm:max-h-[92vh] overflow-y-auto overscroll-contain max-w-2xl bg-[#102027] text-slate-100 rounded-2xl border border-white/10 p-5 sm:p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-400" />
              <span>Nova Reserva de Espaço Esportivo</span>
            </h2>
            <p className="text-xs text-slate-400">
              Agendamento de quadras, campos e salas do complexo poliesportivo
            </p>
          </div>
          <button
            onClick={handleCancelar}
            className="inline-flex items-center justify-center min-w-10 min-h-10 sm:min-w-0 sm:min-h-0 p-1.5 shrink-0 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conflict Warning Banner */}
        {conflictWarning && (
          <div className="mt-4 p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-rose-200 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-snug">{conflictWarning}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs sm:text-sm">
          {/* Space & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Espaço Esportivo <span className="text-emerald-400">*</span>
              </label>
              {spaces.length > 0 ? (
                <select
                  value={spaceId}
                  onChange={(e) => setSpaceId(e.target.value)}
                  className="w-full h-10 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                  required
                >
                  <option value="">Selecione o espaço esportivo</option>
                  {spaces.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Cap. {s.capacity})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-2 bg-amber-950/30 border border-amber-500/30 rounded-xl text-amber-300 text-xs">
                  Nenhum espaço cadastrado ainda. Cadastre um espaço físico na aba "Espaços".
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Data do Agendamento <span className="text-emerald-400">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-10 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                required
              />
            </div>
          </div>

          {/* Time range */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Hora Início <span className="text-emerald-400">*</span>
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full h-10 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Hora Término <span className="text-emerald-400">*</span>
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full h-10 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Tipo de Uso
              </label>
              <select
                value={useType}
                onChange={(e) => setUseType(e.target.value as UseType)}
                className="w-full h-10 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                required
              >
                <option value="">Selecione o tipo</option>
                <option value="aula">Aula Curricular</option>
                <option value="treino">Treino / Seleção</option>
                <option value="extensao">Extensão / Projeto</option>
                <option value="evento">Evento / Interclasse</option>
                <option value="livre">Uso Livre</option>
                <option value="manutencao">Manutenção</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Modalidade
              </label>
              <input
                type="text"
                value={sport}
                onChange={(e) => setSport(e.target.value)}
                placeholder="Ex: Futsal, Judô..."
                className="w-full h-10 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Group & Teacher */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Turma / Grupo Solicitante <span className="text-emerald-400">*</span>
              </label>
              <input
                type="text"
                value={groupOrClass}
                onChange={(e) => setGroupOrClass(e.target.value)}
                placeholder="Ex: Técnico em Agropecuária - Turma 101"
                className="w-full h-10 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Docente / Responsável <span className="text-emerald-400">*</span>
              </label>
              {requesters.length > 0 ? (
                <select
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  className="w-full h-10 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                  required
                >
                  <option value="">Selecione o docente/responsável</option>
                  {requesters.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.type === 'docente' ? 'Docente' : r.type === 'estagiario' ? 'Estagiário' : r.type === 'monitor' ? 'Monitor' : 'Servidor'} - {r.registration})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={customTeacherName}
                  onChange={(e) => setCustomTeacherName(e.target.value)}
                  placeholder="Digite o nome do professor responsável"
                  className="w-full h-10 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                  required
                />
              )}
            </div>
          </div>

          {/* Participants & Linked Kit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nº Estimado de Participantes
              </label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={participantsCount}
                  onChange={(e) =>
                    setParticipantsCount(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  placeholder="Ex: 30"
                  className="w-full h-10 pl-9 pr-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Vincular Kit de Materiais (Opcional)
              </label>
              <select
                value={selectedKitId}
                onChange={(e) => setSelectedKitId(e.target.value)}
                className="w-full h-10 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                <option value="">Nenhum kit vinculado</option>
                {kits.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name} ({k.status === 'pronto' ? 'Pronto' : 'Incompleto'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Recurrence */}
          <div className="p-3 bg-[#0B1418] rounded-xl border border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Repeat className="w-3.5 h-3.5 text-emerald-400" />
                Recorrência Semanal
              </span>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400 cursor-pointer">
                  <input
                    type="radio"
                    name="recurrence"
                    checked={recurrence === 'none'}
                    onChange={() => setRecurrence('none')}
                    className="mr-1 accent-emerald-500"
                  />
                  Apenas nesta data
                </label>
                <label className="text-xs text-slate-400 cursor-pointer">
                  <input
                    type="radio"
                    name="recurrence"
                    checked={recurrence === 'weekly'}
                    onChange={() => setRecurrence('weekly')}
                    className="mr-1 accent-emerald-500"
                  />
                  Semanalmente
                </label>
              </div>
            </div>

            {recurrence === 'weekly' && (
              <div className="pt-2 border-t border-white/10 flex items-center gap-2">
                <span className="text-xs text-slate-400">Repetir semanalmente até:</span>
                <input
                  type="date"
                  value={recurrenceUntil}
                  min={date}
                  onChange={(e) => setRecurrenceUntil(e.target.value)}
                  className="h-8 px-2 bg-[#102027] border border-white/15 rounded-lg text-xs text-slate-100 focus:outline-none"
                  required={recurrence === 'weekly'}
                />
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Observações / Requisitos Especiais
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Necessário arquibancada aberta, ligar exaustores..."
              className="w-full p-2.5 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Submit */}
          <div className="sigef-modal-footer pt-3 border-t border-white/10 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleCancelar}
              className="px-4 py-2 text-xs sm:text-sm text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-[#1B8A4B] hover:bg-[#22A55B] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-lg shadow-emerald-950/40 transition-all flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Confirmar Reserva</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
