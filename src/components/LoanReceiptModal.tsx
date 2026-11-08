import React from 'react';
import { Loan } from '../types/sigef';
import { formatDateBR, formatDateTimeBR } from '../utils/formatters';
import { Printer, X, ShieldCheck } from 'lucide-react';

interface LoanReceiptModalProps {
  loan: Loan | null;
  isOpen: boolean;
  onClose: () => void;
}

export const LoanReceiptModal: React.FC<LoanReceiptModalProps> = ({ loan, isOpen, onClose }) => {
  if (!isOpen || !loan) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#102027] text-slate-100 rounded-2xl border border-slate-700/60 p-5 sm:p-7 shadow-2xl my-6">
        {/* Controls - hidden on print */}
        <div className="no-print flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider font-semibold text-[#22A55B] bg-[#1B8A4B]/20 px-2 py-0.5 rounded-md">
              Documento Oficial
            </span>
            <span className="text-sm font-medium text-slate-300">Termo {loan.termNumber}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1B8A4B] hover:bg-[#22A55B] text-white text-xs sm:text-sm font-semibold rounded-lg transition-colors shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Sheet */}
        <div className="mt-4 p-5 sm:p-6 bg-white text-slate-900 rounded-xl shadow-inner font-sans text-xs sm:text-sm border border-slate-200">
          {/* Header */}
          <div className="text-center pb-4 border-b-2 border-slate-900">
            <p className="font-bold text-xs uppercase tracking-wider text-slate-600">
              MINISTÉRIO DA EDUCAÇÃO • REDE FEDERAL DE EDUCAÇÃO PROFISSIONAL E TECNOLÓGICA
            </p>
            <h1 className="text-base sm:text-lg font-black text-slate-950 mt-1">
              INSTITUTO FEDERAL DE EDUCAÇÃO, CIÊNCIA E TECNOLOGIA
            </h1>
            <p className="text-xs font-semibold text-slate-800">
              DIRETORIA DE ENSINO • COORDENAÇÃO DE EDUCAÇÃO FÍSICA (COEF)
            </p>
            <div className="mt-2 inline-block bg-slate-100 px-3 py-1 rounded border border-slate-300">
              <span className="font-bold text-slate-900">
                TERMO DE EMPRÉSTIMO E GUARDA DE MATERIAL ESPORTIVO {loan.termNumber}
              </span>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-4 py-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div>
              <span className="text-slate-500 font-semibold block text-[11px] uppercase">Solicitante:</span>
              <p className="font-bold text-slate-900 text-sm">{loan.requesterName}</p>
              <p className="text-slate-600 text-xs">
                Matrícula/SIAPE: <span className="font-mono font-bold text-slate-800">{loan.requesterRegistration}</span> (
                {loan.requesterType === 'estagiario'
                  ? 'ESTAGIÁRIO DE ED. FÍSICA'
                  : loan.requesterType === 'monitor'
                  ? 'MONITOR DE ED. FÍSICA'
                  : loan.requesterType === 'docente'
                  ? 'DOCENTE'
                  : loan.requesterType === 'servidor'
                  ? 'SERVIDOR / TAE'
                  : 'DISCENTE'}
                )
              </p>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block text-[11px] uppercase">Finalidade do Empréstimo:</span>
              <p className="font-medium text-slate-800 text-xs">{loan.purpose || 'Aula / Treino Institucional'}</p>
              {loan.supervisorTeacherName && (
                <p className="text-slate-600 text-xs mt-1">
                  Docente Responsável: <span className="font-semibold text-slate-900">{loan.supervisorTeacherName}</span>
                </p>
              )}
            </div>
            <div>
              <span className="text-slate-500 font-semibold block text-[11px] uppercase">Data / Hora de Retirada:</span>
              <p className="font-bold text-slate-900">{formatDateTimeBR(loan.loanDate)}</p>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block text-[11px] uppercase">Prazo Limite para Devolução:</span>
              <p className="font-bold text-rose-700">{formatDateTimeBR(loan.expectedReturnDate)}</p>
            </div>
          </div>

          {/* Items Table */}
          <div className="my-3">
            <span className="text-xs uppercase font-bold text-slate-700 block mb-1">
              Relação de Materiais Alocados ({loan.kitName ? `Kit: ${loan.kitName}` : 'Itens Avulsos'}):
            </span>
            <table className="w-full text-left border-collapse border border-slate-300 text-xs">
              <thead>
                <tr className="bg-slate-200 text-slate-900">
                  <th className="p-2 border border-slate-300 font-bold w-12 text-center">Qtd</th>
                  <th className="p-2 border border-slate-300 font-bold">Discriminação do Item</th>
                  <th className="p-2 border border-slate-300 font-bold w-32">Nº Patrimônio/Tombo</th>
                  <th className="p-2 border border-slate-300 font-bold w-24 text-center">Estado Inicial</th>
                </tr>
              </thead>
              <tbody>
                {loan.items.map((item, idx) => (
                  <tr key={idx} className="border-b border-slate-200">
                    <td className="p-2 border border-slate-300 text-center font-bold font-mono">
                      {item.quantity}
                    </td>
                    <td className="p-2 border border-slate-300 font-medium text-slate-900">
                      {item.materialName}
                    </td>
                    <td className="p-2 border border-slate-300 font-mono text-slate-700">
                      {item.patrimonyNumber}
                    </td>
                    <td className="p-2 border border-slate-300 text-center font-semibold text-emerald-800">
                      Regular/Bom
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legal Responsibility Statement */}
          <div className="my-4 p-3 bg-slate-100 rounded border border-slate-300 text-[11px] leading-relaxed text-slate-700">
            <div className="flex items-start gap-2 mb-1">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <p className="font-bold text-slate-900 uppercase">Declaração de Compromisso e Responsabilidade:</p>
            </div>
            Declaro ter recebido os materiais esportivos discriminados neste termo em perfeito estado de funcionamento e conservação. Comprometo-me a zelar pela sua integridade física, utilizá-los estritamente nos limites do campus e nas atividades autorizadas, e devolvê-los no balcão da COEF até o prazo estipulado. Reconheço que o atraso injustificado implica suspensão temporária de novos empréstimos e que eventuais danos, avarias dolosas ou extravios exigirão a imediata reposição do bem ou ressarcimento ao patrimônio público nos termos do regulamento da instituição.
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-8 pt-8 mt-6 border-t border-slate-300 text-center text-xs">
            <div>
              <div className="border-b border-slate-400 mx-6 mb-1 h-8"></div>
              <p className="font-bold text-slate-900">{loan.requesterName}</p>
              <p className="text-slate-500 text-[11px]">Assinatura do Solicitante</p>
            </div>
            <div>
              <div className="border-b border-slate-400 mx-6 mb-1 h-8"></div>
              <p className="font-bold text-slate-900">{loan.attendantName}</p>
              <p className="text-slate-500 text-[11px]">Atendente / Coordenação de Ed. Física</p>
            </div>
          </div>

          <div className="text-center pt-4 text-[10px] text-slate-400">
            Emitido via SIGEF – Sistema Integrado de Gestão da Educação Física • Campus IF em {formatDateBR(new Date().toISOString())}
          </div>
        </div>

        {/* Action Buttons in Modal footer */}
        <div className="no-print mt-5 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
          >
            Fechar
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-[#1B8A4B] hover:bg-[#22A55B] rounded-xl shadow transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Comprovante</span>
          </button>
        </div>
      </div>
    </div>
  );
};
