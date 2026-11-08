import React, { useState } from 'react';
import { Loan, Requester } from '../types/sigef';
import { sigefStorage } from '../services/storage';
import {
  formatDateBR,
  formatDateTimeBR,
  calculateDelayDays,
  getLoanStatusBadge,
} from '../utils/formatters';
import { useToast } from '../components/Toast';
import {
  ClipboardList,
  ScanLine,
  Search,
  Plus,
  Clock,
  Printer,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  AlertOctagon,
  Calendar,
  X,
  FileCheck,
} from 'lucide-react';

interface LoansPageProps {
  onOpenNewLoan: (requesterId?: string) => void;
  onOpenReturnLoan: (loan: Loan) => void;
  onOpenReceipt: (loan: Loan) => void;
  userRole: string;
}

export const LoansPage: React.FC<LoansPageProps> = ({
  onOpenNewLoan,
  onOpenReturnLoan,
  onOpenReceipt,
  userRole,
}) => {
  const { showToast } = useToast();
  const loans = sigefStorage.getLoans();
  const requesters = sigefStorage.getRequesters();

  const [activeTab, setActiveTab] = useState<'ativos' | 'atrasados' | 'devolvidos'>('ativos');
  const [searchFilter, setSearchFilter] = useState('');

  // Terminal Balcão Search state
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalResult, setTerminalResult] = useState<Requester | null>(null);

  const handleTerminalSearch = (val: string) => {
    setTerminalInput(val);
    if (!val.trim()) {
      setTerminalResult(null);
      return;
    }
    const found = sigefStorage.findRequester(val);
    setTerminalResult(found || null);
  };

  // Filter loans by tab and search
  const filteredLoans = loans.filter((loan) => {
    // Tab match
    if (activeTab === 'ativos' && loan.status !== 'ativo') return false;
    if (activeTab === 'atrasados' && loan.status !== 'atrasado') return false;
    if (activeTab === 'devolvidos' && loan.status !== 'devolvido') return false;

    // Search match
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      const matchTerm = loan.termNumber.toLowerCase().includes(q);
      const matchName = loan.requesterName.toLowerCase().includes(q);
      const matchReg = loan.requesterRegistration.toLowerCase().includes(q);
      const matchItems = loan.items.some((i) => i.materialName.toLowerCase().includes(q));
      return matchTerm || matchName || matchReg || matchItems;
    }

    return true;
  });

  const activeCount = loans.filter((l) => l.status === 'ativo').length;
  const overdueCount = loans.filter((l) => l.status === 'atrasado').length;
  const returnedCount = loans.filter((l) => l.status === 'devolvido').length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-sky-400" />
            <span>Terminal de Empréstimos & Devoluções</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Balcão de atendimento rápido, controle de termos, vistorias técnicas e notificações de atraso
          </p>
        </div>

        <button
          onClick={() => onOpenNewLoan()}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1B8A4B] hover:bg-[#22A55B] text-white text-xs font-semibold rounded-xl shadow-md shadow-emerald-950/40 transition-all active:scale-[0.98] self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Empréstimo</span>
        </button>
      </div>

      {/* Terminal de Balcão (Fast barcode reader / registration input) */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-[#102027] to-[#0E1E24] border border-sky-500/30 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-sky-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Terminal de Balcão Express (Leitor de Código / Matrícula)
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">Pronto para leitura</span>
        </div>

        <div className="relative">
          <input
            type="text"
            value={terminalInput}
            onChange={(e) => handleTerminalSearch(e.target.value)}
            placeholder="Passe o leitor ou digite a Matrícula do Aluno ou SIAPE do Servidor..."
            className="w-full h-12 pl-4 pr-10 bg-[#0B1418] border border-sky-500/50 rounded-xl text-white font-mono text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-sky-500/40"
          />
          {terminalInput && (
            <button
              onClick={() => {
                setTerminalInput('');
                setTerminalResult(null);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Live Terminal Solicitante Card */}
        {terminalResult && (
          <div
            className={`mt-4 p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all animate-in fade-in ${
              terminalResult.isBlocked
                ? 'bg-rose-950/40 border-rose-500/50 text-rose-200'
                : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-100'
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-white">{terminalResult.name}</span>
                <span className="text-xs uppercase font-bold px-2 py-0.5 rounded bg-white/10 text-slate-200 font-mono">
                  {terminalResult.registration}
                </span>
                <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-300">
                  ({terminalResult.type})
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                {terminalResult.courseOrDepartment} {terminalResult.classGroup ? `• ${terminalResult.classGroup}` : ''} • Tel: {terminalResult.phone}
              </p>

              {terminalResult.isBlocked ? (
                <div className="mt-2 flex items-center gap-2 text-rose-300 text-xs font-semibold">
                  <AlertOctagon className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>BLOQUEIO ATIVO: {terminalResult.blockReason}</span>
                </div>
              ) : (
                <div className="mt-2 flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Regular • Nenhuma pendência na Coordenação de Ed. Física</span>
                </div>
              )}
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <button
                onClick={() => {
                  onOpenNewLoan(terminalResult.id);
                  setTerminalInput('');
                  setTerminalResult(null);
                }}
                disabled={terminalResult.isBlocked}
                className={`px-4 py-2 text-xs font-semibold rounded-xl shadow transition-all ${
                  terminalResult.isBlocked
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-[#1B8A4B] hover:bg-[#22A55B] text-white active:scale-95'
                }`}
              >
                Iniciar Empréstimo
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tabs and Search Bar */}
      <div className="p-4 rounded-2xl bg-[#102027] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Tabs */}
        <div className="flex items-center bg-[#0B1418] p-1 rounded-xl border border-white/10">
          <button
            onClick={() => setActiveTab('ativos')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'ativos'
                ? 'bg-sky-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>Ativos</span>
            <span className="font-mono bg-black/20 px-1.5 py-0.2 rounded text-[10px]">
              {activeCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('atrasados')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'atrasados'
                ? 'bg-rose-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>Atrasados</span>
            <span className="font-mono bg-black/20 px-1.5 py-0.2 rounded text-[10px]">
              {overdueCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('devolvidos')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'devolvidos'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>Devolvidos</span>
            <span className="font-mono bg-black/20 px-1.5 py-0.2 rounded text-[10px]">
              {returnedCount}
            </span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Filtrar por termo, aluno, material..."
            className="w-full h-9 pl-9 pr-3 bg-[#0B1418] border border-white/15 rounded-xl text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
          />
          {searchFilter && (
            <button
              onClick={() => setSearchFilter('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Loans Cards / List */}
      <div className="space-y-3">
        {filteredLoans.map((loan) => {
          const badge = getLoanStatusBadge(loan.status);
          const delayDays = calculateDelayDays(loan.expectedReturnDate);
          const isOverdue = loan.status === 'atrasado';

          return (
            <div
              key={loan.id}
              className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                isOverdue
                  ? 'bg-rose-950/25 border-rose-500/40 shadow-lg'
                  : 'bg-[#102027] border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-white/10">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-white text-base">
                      {loan.termNumber}
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${badge.badgeClass}`}
                    >
                      {badge.label}
                    </span>
                    {loan.kitName && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        {loan.kitName}
                      </span>
                    )}
                  </div>

                  <p className="font-semibold text-slate-200 text-sm mt-1">
                    {loan.requesterName}{' '}
                    <span className="text-slate-400 font-mono text-xs">
                      ({loan.requesterRegistration})
                    </span>
                  </p>

                  <p className="text-xs text-slate-400 mt-0.5">
                    Finalidade: <span className="text-slate-300">{loan.purpose}</span>
                    {loan.supervisorTeacherName && (
                      <span> • Docente Responsável: {loan.supervisorTeacherName}</span>
                    )}
                  </p>
                </div>

                {/* Overdue alert badge if overdue */}
                {isOverdue && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600/30 border border-rose-500/40 text-rose-200 text-xs font-bold self-start sm:self-auto">
                    <Clock className="w-4 h-4 text-rose-400" />
                    <span>Atraso de {delayDays} dia(s)</span>
                  </div>
                )}
              </div>

              {/* Items List */}
              <div className="my-3 py-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                  Itens Alocados:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {loan.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-lg bg-[#0B1418] border border-white/5 text-xs flex items-center justify-between"
                    >
                      <div className="truncate pr-2">
                        <span className="text-white font-medium block truncate">
                          {item.materialName}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {item.patrimonyNumber}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-white bg-white/10 px-2 py-0.5 rounded shrink-0">
                        {item.quantity} un
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer info & Actions */}
              <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
                <div className="flex items-center gap-4 flex-wrap text-[11px]">
                  <span>
                    Retirado em: <strong className="text-slate-300">{formatDateTimeBR(loan.loanDate)}</strong>
                  </span>
                  <span>
                    Prazo Devolução:{' '}
                    <strong
                      className={isOverdue ? 'text-rose-400 font-bold' : 'text-slate-300'}
                    >
                      {formatDateTimeBR(loan.expectedReturnDate)}
                    </strong>
                  </span>
                  {loan.actualReturnDate && (
                    <span className="text-emerald-400 font-semibold">
                      Devolvido em: {formatDateTimeBR(loan.actualReturnDate)}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {/* Comprovante / Print receipt */}
                  <button
                    onClick={() => onOpenReceipt(loan)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-semibold rounded-lg transition-colors"
                    title="Imprimir Comprovante / Termo de Responsabilidade"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Termo Oficial</span>
                  </button>

                  {/* Devolver button if active or overdue */}
                  {loan.status !== 'devolvido' && (
                    <button
                      onClick={() => onOpenReturnLoan(loan)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1B8A4B] hover:bg-[#22A55B] text-white text-xs font-semibold rounded-lg shadow transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Registrar Devolução</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filteredLoans.length === 0 && (
          <div className="text-center py-12 rounded-2xl bg-[#102027] border border-white/10 text-slate-400">
            <ClipboardList className="w-12 h-12 mx-auto opacity-30 mb-2" />
            <p className="text-base font-bold text-white">Nenhum empréstimo encontrado nesta aba.</p>
            <p className="text-xs text-slate-400 mt-1">
              Todos os materiais estão no almoxarifado ou tente mudar os filtros de busca.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
