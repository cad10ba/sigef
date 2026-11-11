import React, { useState, useEffect } from 'react';
import { Reservation, UseType } from '../types/sigef';
import { sigefStorage } from '../services/storage';
import { useToast } from './Toast';
import { X, Calendar, CheckCircle, Trash2, AlertTriangle, Users } from 'lucide-react';

interface EditReservationModalProps {
  reservation: Reservation;
  onClose: () => void;
  onSaved: () => void;
}

export const EditReservationModal: React.FC<EditReservationModalProps> = ({
  reservation,
  onClose,
  onSaved,
}) => {
  const { showToast } = useToast();
  const spaces = sigefStorage.getSpaces();
  const requesters = sigefStorage.getRequesters().filter(
    (r) => r.type === 'docente' || r.type === 'servidor' || r.type === 'estagiario' || r.type === 'monitor'
  );

  const [spaceId, setSpaceId] = useState(reservation.spaceId);
  const [date, setDate] = useState(reservation.date);
  const [startTime, setStartTime] = useState(reservation.startTime);
  const [endTime, setEndTime] = useState(reservation.endTime);
  const [useType, setUseType] = useState<UseType>(reservation.useType);
  const [sport, setSport] = useState(reservation.sport);
  const [groupOrClass, setGroupOrClass] = useState(reservation.groupOrClass);
  const [teacherId, setTeacherId] = useState(reservation.teacherId);
  const [teacherName, setTeacherName] = useState(reservation.teacherName);
  const [participantsCount, setParticipantsCount] = useState(reservation.participantsCount);
  const [notes, setNotes] = useState(reservation.notes || '');
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const currentTeacher = requesters.find((r) => r.id === teacherId);

  // Live conflict evaluation for the edited slot (ignores this reservation)
  useEffect(() => {
    const conflict = sigefStorage.checkReservationConflict(
      spaceId,
      date,
      startTime,
      endTime,
      reservation.id
    );
    setConflictWarning(
      conflict
        ? `Conflito de horário: "${conflict.groupOrClass}" já reservou este espaço das ${conflict.startTime} às ${conflict.endTime} (${conflict.teacherName}).`
        : null
    );
  }, [spaceId, date, startTime, endTime, reservation.id]);

  const handleDelete = () => {
    sigefStorage.deleteReservation(reservation.id);
    showToast('Reserva excluída!', 'info');
    onSaved();
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!groupOrClass.trim()) {
      showToast('Por favor, informe a turma ou grupo responsável.', 'error');
      return;
    }

    if (startTime >= endTime) {
      showToast('O horário de término deve ser após o horário de início.', 'error');
      return;
    }

    const space = spaces.find((s) => s.id === spaceId);
    const updated: Reservation = {
      ...reservation,
      spaceId,
      spaceName: space?.name || reservation.spaceName,
      date,
      startTime,
      endTime,
      useType,
      sport: sport.trim() || 'Geral',
      groupOrClass: groupOrClass.trim(),
      teacherId: currentTeacher?.id || reservation.teacherId,
      teacherName: currentTeacher?.name || teacherName,
      participantsCount: Number(participantsCount) || reservation.participantsCount,
      notes: notes.trim(),
    };

    const result = sigefStorage.saveReservation(updated);
    if (!result.success) {
      showToast(result.conflictError || 'Erro ao salvar a reserva.', 'error');
      return;
    }

    showToast('Reserva atualizada com sucesso!', 'success');
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#102027] text-slate-100 rounded-2xl border border-white/10 p-5 sm:p-6 shadow-2xl my-auto">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-400" />
              <span>Editar Reserva</span>
            </h2>
            <p className="text-xs text-slate-400">
              Altere os dados do agendamento ou exclua a reserva
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="p-2 -m-1 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {conflictWarning && (
          <div className="mt-4 p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-rose-200 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-snug">{conflictWarning}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs sm:text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Espaço Esportivo <span className="text-emerald-400">*</span>
              </label>
              <select
                value={spaceId}
                onChange={(e) => setSpaceId(e.target.value)}
                className="w-full h-10 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                {spaces.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} (Cap. {s.capacity})
                  </option>
                ))}
              </select>
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
              <label className="block text-xs font-semibold text-slate-300 mb-1">Tipo de Uso</label>
              <select
                value={useType}
                onChange={(e) => setUseType(e.target.value as UseType)}
                className="w-full h-10 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                <option value="aula">Aula Curricular</option>
                <option value="treino">Treino / Seleção</option>
                <option value="extensao">Extensão / Projeto</option>
                <option value="evento">Evento / Interclasse</option>
                <option value="livre">Uso Livre</option>
                <option value="manutencao">Manutenção</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Modalidade</label>
              <input
                type="text"
                value={sport}
                onChange={(e) => setSport(e.target.value)}
                placeholder="Ex: Futsal, Judô..."
                className="w-full h-10 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

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
                >
                  {currentTeacher ? null : (
                    <option value={reservation.teacherId}>{reservation.teacherName}</option>
                  )}
                  {requesters.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.registration})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  className="w-full h-10 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                  required
                />
              )}
            </div>
          </div>

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
                onChange={(e) => setParticipantsCount(Number(e.target.value))}
                className="w-full h-10 pl-9 pr-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

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

          <div className="pt-3 border-t border-white/10 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2">
            {confirmDelete ? (
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xs text-rose-200 font-semibold">Excluir esta reserva?</span>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="px-3 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl transition-colors"
                  >
                    Sim, excluir
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-3 py-2 text-xs text-slate-300 hover:text-white rounded-xl"
                  >
                    Voltar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-rose-300 bg-rose-950/40 border border-rose-500/30 hover:bg-rose-900/40 rounded-xl transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Excluir Reserva</span>
                </button>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs sm:text-sm text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-[#1B8A4B] hover:bg-[#22A55B] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-lg shadow-emerald-950/40 transition-all flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Salvar Alterações</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
