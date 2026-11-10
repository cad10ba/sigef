import React, { useState, useEffect } from 'react';
import { Loan, ReturnItemState } from '../types/sigef';
import { sigefStorage } from '../services/storage';
import { useToast } from './Toast';
import { CheckCircle2, X, AlertTriangle, ShieldAlert, FileText, Check } from 'lucide-react';

interface ReturnLoanModalProps {
  loan: Loan | null;
  isOpen: boolean;
  onClose: () => void;
  onReturned: () => void;
}

export const ReturnLoanModal: React.FC<ReturnLoanModalProps> = ({
  loan,
  isOpen,
  onClose,
  onReturned,
}) => {
  const { showToast } = useToast();

  const [inspections, setInspections] = useState<
    { materialId: string; returnStatus: ReturnItemState; note: string }[]
  >([]);

  const [generalNotes, setGeneralNotes] = useState('');

  // A vistoria parte sempre do estado inicial do empréstimo selecionado.
  const resetForm = () => {
    setInspections(
      (loan?.items || []).map((item) => ({
        materialId: item.materialId,
        returnStatus: item.returnStatus === 'pendente' ? 'devolvido_ok' : item.returnStatus,
        note: item.inspectionNote || '',
      }))
    );
    setGeneralNotes('');
  };

  useEffect(() => {
    if (isOpen && loan) resetForm();
  }, [isOpen, loan]);

  if (!isOpen || !loan) return null;

  const handleCancelar = () => {
    resetForm();
    onClose();
  };

  const handleStatusChange = (materialId: string, status: ReturnItemState) => {
    setInspections(
      inspections.map((i) => (i.materialId === materialId ? { ...i, returnStatus: status } : i))
    );
  };

  const handleNoteChange = (materialId: string, note: string) => {
    setInspections(
      inspections.map((i) => (i.materialId === materialId ? { ...i, note } : i))
    );
  };

  const handleConfirmReturn = (e: React.FormEvent) => {
    e.preventDefault();

    const formattedInspections = inspections.map((i) => ({
      materialId: i.materialId,
      returnStatus: i.returnStatus,
      inspectionNote: i.note.trim() || undefined,
    }));

    sigefStorage.returnLoan(loan.id, formattedInspections, generalNotes.trim() || undefined);

    const hasDamaged = inspections.some((i) => i.returnStatus === 'danificado');
    const hasLost = inspections.some((i) => i.returnStatus === 'extraviado');

    if (hasDamaged || hasLost) {
      showToast('Devolução registrada com registro de avarias/baixa no acervo.', 'info');
    } else {
      showToast('Todos os materiais foram devolvidos em perfeito estado!', 'success');
    }

    resetForm();
    onReturned();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#102027] text-slate-100 rounded-2xl border border-white/10 p-5 sm:p-6 shadow-2xl my-6">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>Vistoria e Devolução do Empréstimo {loan.termNumber}</span>
            </h2>
            <p className="text-xs text-slate-400">
              Solicitante: <strong className="text-slate-200">{loan.requesterName}</strong> ({loan.requesterRegistration})
            </p>
          </div>
          <button
            onClick={handleCancelar}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleConfirmReturn} className="mt-4 space-y-4 text-xs sm:text-sm">
          <div className="p-3 bg-[#0B1418] rounded-xl border border-white/10 text-xs text-slate-300">
            Realize a conferência física de cada item devolvido ao balcão. Caso algum item apresente avarias ou tenha sido extraviado, o status será atualizado no acervo patrimonial automaticamente.
          </div>

          {/* List of items to inspect */}
          <div className="space-y-3">
            <span className="text-xs font-semibold text-slate-200 block uppercase tracking-wider">
              Conferência dos Itens:
            </span>

            {loan.items.map((item) => {
              const currentInsp = inspections.find((i) => i.materialId === item.materialId);
              const status = currentInsp?.returnStatus || 'devolvido_ok';

              return (
                <div
                  key={item.materialId}
                  className={`p-3 rounded-xl border transition-colors ${
                    status === 'devolvido_ok'
                      ? 'bg-[#0B1418] border-white/10'
                      : status === 'danificado'
                      ? 'bg-amber-950/30 border-amber-500/40'
                      : 'bg-rose-950/30 border-rose-500/40'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-white/10">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{item.materialName}</span>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/5 text-slate-300">
                          Qtd: {item.quantity}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">
                        Patrimônio: {item.patrimonyNumber}
                      </span>
                    </div>

                    {/* Vistoria Radio Buttons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleStatusChange(item.materialId, 'devolvido_ok')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                          status === 'devolvido_ok'
                            ? 'bg-emerald-600 text-white shadow'
                            : 'bg-white/5 text-slate-400 hover:text-white'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Em Perfeito Estado (OK)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStatusChange(item.materialId, 'danificado')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                          status === 'danificado'
                            ? 'bg-amber-600 text-white shadow'
                            : 'bg-white/5 text-slate-400 hover:text-white'
                        }`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Danificado</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStatusChange(item.materialId, 'extraviado')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                          status === 'extraviado'
                            ? 'bg-rose-600 text-white shadow'
                            : 'bg-white/5 text-slate-400 hover:text-white'
                        }`}
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Extraviado</span>
                      </button>
                    </div>
                  </div>

                  {/* Optional inspection note if damaged or lost */}
                  {status !== 'devolvido_ok' && (
                    <div className="mt-2.5 pt-1">
                      <label className="block text-[11px] font-semibold text-amber-300 mb-1">
                        Relatório da avaria / ocorrência técnica:
                      </label>
                      <input
                        type="text"
                        value={currentInsp?.note || ''}
                        onChange={(e) => handleNoteChange(item.materialId, e.target.value)}
                        placeholder="Ex: Válvula furada, costura lateral rompida, ausente..."
                        className="w-full h-8 px-2.5 bg-[#0B1418] border border-white/20 rounded-lg text-xs text-white focus:outline-none"
                        required
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* General Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Observações Gerais de Encerramento (Opcional)
            </label>
            <input
              type="text"
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              placeholder="Ex: Devolvido antes do prazo, conferido com bolsista..."
              className="w-full h-9 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 text-xs focus:outline-none"
            />
          </div>

          {/* Submit */}
          <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleCancelar}
              className="px-4 py-2 text-xs sm:text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors rounded-xl"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-[#1B8A4B] hover:bg-[#22A55B] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-lg shadow-emerald-950/40 transition-all flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Concluir Devolução</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
