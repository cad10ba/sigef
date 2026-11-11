import React, { useState, useEffect } from 'react';
import { Loan, Requester, SportKit, LoanItem, RequesterType } from '../types/sigef';
import { sigefStorage } from '../services/storage';
import { useToast } from './Toast';
import {
  ClipboardPenLine,
  X,
  ScanLine,
  AlertOctagon,
  Check,
  Plus,
  Trash2,
  Boxes,
  ShieldCheck,
  Calendar,
  Clock,
  Printer,
} from 'lucide-react';

interface NewLoanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoanCreated: (loan: Loan) => void;
  initialRequesterId?: string;
}

// Estado inicial vazio do empréstimo: nenhum item ou solicitante do último registro é mantido.
const EMPTY_LOAN_FORM = {
  searchReg: '',
  selectedRequester: null,
  supervisorTeacherId: '',
  purpose: '',
  loanItems: [] as { materialId: string; quantity: number }[],
  selectedKitId: '',
  acceptedTerms: false,
};

export const NewLoanModal: React.FC<NewLoanModalProps> = ({
  isOpen,
  onClose,
  onLoanCreated,
  initialRequesterId,
}) => {
  const { showToast } = useToast();
  const requesters = sigefStorage.getRequesters();
  const materials = sigefStorage.getMaterials();
  const kits = sigefStorage.getKits();
  const currentUser = sigefStorage.getCurrentUser();

  const [searchReg, setSearchReg] = useState('');
  const [selectedRequester, setSelectedRequester] = useState<Requester | null>(null);
  const [supervisorTeacherId, setSupervisorTeacherId] = useState('');
  const [purpose, setPurpose] = useState('');

  // Items
  const [loanItems, setLoanItems] = useState<{ materialId: string; quantity: number }[]>([]);
  const [selectedKitId, setSelectedKitId] = useState('');

  // Return deadline
  const [returnDeadline, setReturnDeadline] = useState('');

  // Term acceptance
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const resetForm = () => {
    setSearchReg(EMPTY_LOAN_FORM.searchReg);
    setSelectedRequester(EMPTY_LOAN_FORM.selectedRequester);
    setSupervisorTeacherId(EMPTY_LOAN_FORM.supervisorTeacherId);
    setPurpose(EMPTY_LOAN_FORM.purpose);
    setLoanItems([...EMPTY_LOAN_FORM.loanItems]);
    setSelectedKitId(EMPTY_LOAN_FORM.selectedKitId);
    setReturnDeadline('');
    setAcceptedTerms(EMPTY_LOAN_FORM.acceptedTerms);
  };

  useEffect(() => {
    if (!isOpen) return;
    resetForm();
    if (initialRequesterId) {
      const found = requesters.find((r) => r.id === initialRequesterId);
      if (found) {
        setSelectedRequester(found);
        setSearchReg(found.registration);
      }
    }
  }, [isOpen, initialRequesterId]);

  if (!isOpen) return null;

  const handleCancelar = () => {
    resetForm();
    onClose();
  };

  // Search by registration or name
  const handleSearchRequester = (query: string) => {
    setSearchReg(query);
    const found = sigefStorage.findRequester(query);
    if (found) {
      setSelectedRequester(found);
    }
  };

  const handleSelectKit = (kitId: string) => {
    setSelectedKitId(kitId);
    if (!kitId) return;
    const kit = kits.find((k) => k.id === kitId);
    if (kit) {
      const itemsFromKit = kit.items.map((i) => ({
        materialId: i.materialId,
        quantity: i.quantity,
      }));
      setLoanItems(itemsFromKit);
    }
  };

  const handleAddItem = (materialId: string) => {
    if (!materialId) return;
    const existing = loanItems.find((i) => i.materialId === materialId);
    if (existing) {
      setLoanItems(
        loanItems.map((i) => (i.materialId === materialId ? { ...i, quantity: i.quantity + 1 } : i))
      );
    } else {
      setLoanItems([...loanItems, { materialId, quantity: 1 }]);
    }
  };

  const handleRemoveItem = (index: number) => {
    setLoanItems(loanItems.filter((_, idx) => idx !== index));
  };

  const handleQuantityChange = (index: number, qty: number) => {
    const updated = [...loanItems];
    updated[index].quantity = Math.max(1, qty);
    setLoanItems(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedRequester) {
      showToast('Selecione ou bipe a matrícula/SIAPE do solicitante.', 'error');
      return;
    }

    if (selectedRequester.isBlocked) {
      showToast(`Solicitante BLOQUEADO: ${selectedRequester.blockReason}`, 'error');
      return;
    }

    if (loanItems.length === 0) {
      showToast('Adicione pelo menos um material ou kit esportivo.', 'error');
      return;
    }

    if (!returnDeadline) {
      showToast('Informe o prazo de devolução.', 'error');
      return;
    }

    if (!purpose.trim()) {
      showToast('Informe a finalidade do empréstimo.', 'error');
      return;
    }

    if (!acceptedTerms) {
      showToast('É obrigatório o aceite do Termo de Responsabilidade.', 'error');
      return;
    }

    const supervisors = requesters.filter((r) => r.type === 'docente');
    const supervisorTeacher = supervisors.find((s) => s.id === supervisorTeacherId);

    // Build items with patrimony & name
    const finalItems: LoanItem[] = [];
    for (const item of loanItems) {
      const mat = materials.find((m) => m.id === item.materialId);
      if (!mat) continue;
      if (mat.availableQuantity < item.quantity) {
        showToast(`Estoque insuficiente de "${mat.name}". Disponível: ${mat.availableQuantity}.`, 'error');
        return;
      }
      finalItems.push({
        materialId: mat.id,
        materialName: mat.name,
        patrimonyNumber: mat.patrimonyNumber,
        quantity: item.quantity,
        returnStatus: 'pendente',
      });
    }

    const kit = kits.find((k) => k.id === selectedKitId);
    const newTermNumber = sigefStorage.generateTermNumber();

    const newLoan: Loan = {
      id: 'loan-' + Date.now(),
      termNumber: newTermNumber,
      requesterId: selectedRequester.id,
      requesterName: selectedRequester.name,
      requesterType: selectedRequester.type,
      requesterRegistration: selectedRequester.registration,
      supervisorTeacherId: selectedRequester.type === 'aluno' ? supervisorTeacher?.id : undefined,
      supervisorTeacherName: selectedRequester.type === 'aluno' ? supervisorTeacher?.name : undefined,
      items: finalItems,
      kitId: kit?.id,
      kitName: kit?.name,
      loanDate: new Date().toISOString(),
      expectedReturnDate: new Date(returnDeadline).toISOString(),
      purpose,
      status: 'ativo',
      responsibilityAccepted: true,
      attendantName: currentUser.name,
    };

    const res = sigefStorage.createLoan(newLoan);
    if (!res.success) {
      showToast(res.error || 'Erro ao registrar empréstimo.', 'error');
      return;
    }

    showToast(`Empréstimo ${newTermNumber} registrado com sucesso!`, 'success');
    resetForm();
    onLoanCreated(newLoan);
  };

  const teachers = requesters.filter((r) => r.type === 'docente');

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#102027] text-slate-100 rounded-2xl border border-white/10 p-5 sm:p-6 shadow-2xl my-auto">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <ClipboardPenLine className="w-5 h-5 text-sky-400" />
              <span>Novo Empréstimo de Materiais / Kits</span>
            </h2>
            <p className="text-xs text-slate-400">
              Terminal de balcão da COEF com geração de Termo de Responsabilidade
            </p>
          </div>
          <button
            onClick={handleCancelar}
            aria-label="Fechar"
            className="p-2 -m-1 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs sm:text-sm">
          {/* Solicitante Bipagem / Lookup */}
          <div className="p-3.5 bg-[#0B1418] rounded-xl border border-white/10">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Identificação do Solicitante (Matrícula ou SIAPE) <span className="text-emerald-400">*</span>
            </label>
            <div className="relative flex items-center gap-2">
              <div className="relative flex-1">
                <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchReg}
                  onChange={(e) => handleSearchRequester(e.target.value)}
                  placeholder="Digite ou bipe a matrícula (Ex: 20231012004, 20231024018, SIAPE...)"
                  className="w-full h-10 pl-9 pr-3 bg-[#102027] border border-white/15 rounded-xl text-slate-100 placeholder:text-slate-500 font-mono text-xs sm:text-sm focus:outline-none focus:border-sky-500"
                  autoFocus
                />
              </div>
              <select
                onChange={(e) => {
                  const req = requesters.find((r) => r.id === e.target.value);
                  if (req) {
                    setSelectedRequester(req);
                    setSearchReg(req.registration);
                  }
                }}
                className="h-10 px-2 bg-[#102027] border border-white/15 rounded-xl text-xs text-slate-300 focus:outline-none max-w-[140px]"
              >
                <option value="">Selecionar da lista...</option>
                {requesters.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name.split(' ')[0]} ({r.registration})
                  </option>
                ))}
              </select>
            </div>

            {/* Requester Preview Card */}
            {selectedRequester && (
              <div
                className={`mt-3 p-3 rounded-xl border ${
                  selectedRequester.isBlocked
                    ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                    : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">{selectedRequester.name}</span>
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                          selectedRequester.type === 'estagiario'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : selectedRequester.type === 'monitor'
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : selectedRequester.type === 'docente'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-white/10 text-slate-200'
                        }`}
                      >
                        {selectedRequester.type === 'estagiario'
                          ? 'Estagiário'
                          : selectedRequester.type === 'monitor'
                          ? 'Monitor'
                          : selectedRequester.type === 'docente'
                          ? 'Docente'
                          : selectedRequester.type === 'servidor'
                          ? 'Servidor'
                          : 'Aluno'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {selectedRequester.courseOrDepartment} {selectedRequester.classGroup ? `• ${selectedRequester.classGroup}` : ''}
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      Registro: {selectedRequester.registration} | Tel: {selectedRequester.phone}
                    </p>
                  </div>

                  {selectedRequester.isBlocked ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-600 text-white text-xs font-bold shrink-0">
                      <AlertOctagon className="w-4 h-4" />
                      <span>BLOQUEADO</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-600/30 text-emerald-300 text-xs font-bold border border-emerald-500/40 shrink-0">
                      <Check className="w-4 h-4" />
                      <span>REGULAR</span>
                    </div>
                  )}
                </div>

                {selectedRequester.isBlocked && (
                  <div className="mt-2 text-xs font-medium text-rose-300 pt-2 border-t border-rose-500/30">
                    Motivo do bloqueio: {selectedRequester.blockReason}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Supervisor teacher if requester is a student */}
          {selectedRequester?.type === 'aluno' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Docente Responsável pela Atividade
              </label>
              <select
                value={supervisorTeacherId}
                onChange={(e) => setSupervisorTeacherId(e.target.value)}
                className="w-full h-10 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none focus:border-sky-500"
              >
                <option value="">Selecione o professor supervisor...</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.registration})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Select Kit or Pick individual items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-300">
                Itens para Empréstimo <span className="text-emerald-400">*</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Kit pronto:</span>
                <select
                  value={selectedKitId}
                  onChange={(e) => handleSelectKit(e.target.value)}
                  className="h-8 px-2 bg-[#0B1418] border border-white/15 rounded-lg text-xs text-slate-200 focus:outline-none"
                >
                  <option value="">Nenhum (avulso)</option>
                  {kits.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name} ({k.status})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Add individual material selector */}
            <div className="flex items-center gap-2">
              {materials.length > 0 ? (
                <select
                  id="select-material"
                  className="flex-1 h-9 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddItem(e.target.value);
                      e.target.value = '';
                    }
                  }}
                >
                  <option value="">+ Adicionar material do acervo...</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id} disabled={m.availableQuantity <= 0}>
                      {m.name} ({m.patrimonyNumber}) — Disp: {m.availableQuantity}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="w-full p-2.5 bg-amber-950/30 border border-amber-500/30 rounded-xl text-amber-300 text-xs">
                  Nenhum material cadastrado no acervo. Cadastre itens na aba "Materiais" antes de efetuar empréstimos.
                </div>
              )}
            </div>

            {/* Items list */}
            {loanItems.length > 0 ? (
              <div className="space-y-2 border border-white/10 rounded-xl p-2.5 bg-[#0B1418]/60">
                {loanItems.map((item, idx) => {
                  const mat = materials.find((m) => m.id === item.materialId);
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-lg bg-[#102027] border border-white/5 text-xs"
                    >
                      <div className="flex-1 pr-2">
                        <span className="font-semibold text-white block">{mat?.name}</span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {mat?.patrimonyNumber} • Disp. atual: {mat?.availableQuantity}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400 text-xs">Qtd:</span>
                          <input
                            type="number"
                            min="1"
                            max={mat?.availableQuantity || 99}
                            value={item.quantity}
                            onChange={(e) => handleQuantityChange(idx, Number(e.target.value))}
                            className="w-14 h-8 px-2 bg-[#0B1418] border border-white/15 rounded-lg text-center font-bold text-white text-xs focus:outline-none focus:border-sky-500"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-white/5 transition-colors"
                          title="Remover"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic p-3 text-center border border-dashed border-white/10 rounded-xl">
                Nenhum material selecionado ainda. Escolha um kit ou adicione itens acima.
              </p>
            )}
          </div>

          {/* Return Deadline & Purpose */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Prazo Limite para Devolução <span className="text-emerald-400">*</span>
              </label>
              <input
                type="datetime-local"
                value={returnDeadline}
                onChange={(e) => setReturnDeadline(e.target.value)}
                className="w-full h-10 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none focus:border-sky-500 font-mono text-xs"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Finalidade / Atividade
              </label>
              <input
                type="text"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Ex: Aula de Handebol no Ginásio G1"
                className="w-full h-10 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none focus:border-sky-500 text-xs"
              />
            </div>
          </div>

          {/* Responsibility Acceptance Checkbox */}
          <div className="p-3 bg-[#0B1418] rounded-xl border border-white/10">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-[#1B8A4B] rounded cursor-pointer"
              />
              <div className="text-xs text-slate-300 leading-snug">
                <span className="font-semibold text-white block">
                  Aceite do Termo de Responsabilidade e Guarda (COEF)
                </span>
                O solicitante declara responsabilidade integral pelos materiais retirados e concorda com as normas de devolução e conservação do patrimônio institucional.
              </div>
            </label>
          </div>

          {/* Submit */}
          <div className="pt-3 border-t border-white/10 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Atendente: <strong className="text-slate-200">{currentUser.name.split(' ')[0]}</strong>
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCancelar}
                className="px-4 py-2 text-xs sm:text-sm text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={selectedRequester?.isBlocked}
                className={`px-5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl shadow-lg transition-all flex items-center gap-2 ${
                  selectedRequester?.isBlocked
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                    : 'bg-[#1B8A4B] hover:bg-[#22A55B] text-white shadow-emerald-950/40'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Gerar Termo de Empréstimo</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
