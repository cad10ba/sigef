import React, { useState } from 'react';
import { AlertTriangle, Trash2, X, ShieldAlert, Check } from 'lucide-react';

interface ClearStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmClearAll: () => void;
  totalMaterialsCount: number;
}

export const ClearStockModal: React.FC<ClearStockModalProps> = ({
  isOpen,
  onClose,
  onConfirmClearAll,
  totalMaterialsCount,
}) => {
  const [confirmText, setConfirmText] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);

  if (!isOpen) return null;

  const EXPECTED_TEXT = 'EXCLUIR TUDO';
  const isConfirmed = confirmText.trim().toUpperCase() === EXPECTED_TEXT && acknowledged;

  const resetForm = () => {
    setConfirmText('');
    setAcknowledged(false);
  };

  const handleCancelar = () => {
    resetForm();
    onClose();
  };

  const handleClear = () => {
    if (!isConfirmed) return;
    onConfirmClearAll();
    resetForm();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-[#102027] text-slate-100 rounded-3xl border border-rose-500/30 p-6 shadow-2xl max-h-[90dvh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={handleCancelar}
          className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white">
              Excluir Todo o Estoque de Materiais
            </h3>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 inline-block mt-1">
              {totalMaterialsCount} itens serão excluídos
            </span>
          </div>
        </div>

        <div className="mt-4 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-200 leading-relaxed space-y-2">
          <div className="flex items-center gap-1.5 font-bold text-rose-300">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>Ação irreversível de limpeza total</span>
          </div>
          <p className="text-slate-300">
            Esta operação irá apagar <strong>permanentemente todos os {totalMaterialsCount} materiais</strong> cadastrados no acervo da Coordenação de Educação Física (COEF), tanto na memória local quanto no banco de dados em nuvem Supabase.
          </p>
          <p className="text-slate-400 text-[11px]">
            • Kits esportivos cadastrados que dependiam destes itens ficarão marcados como incompletos.<br />
            • O histórico de tombamento e movimentações dos itens será removido.
          </p>
        </div>

        {/* Security confirmation */}
        <div className="mt-4 space-y-3">
          <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 rounded bg-[#0B1418] border-white/20 text-rose-600 focus:ring-rose-500"
            />
            <span>
              Estou ciente de que todos os {totalMaterialsCount} materiais esportivos serão apagados definitivamente.
            </span>
          </label>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Para confirmar, digite <span className="font-mono text-rose-400 font-bold">EXCLUIR TUDO</span> no campo abaixo:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Digite EXCLUIR TUDO"
              className="w-full h-10 px-3 bg-[#0B1418] border border-white/20 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-rose-500 font-mono tracking-wider uppercase"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-6 flex items-center justify-end gap-2.5 pt-4 border-t border-white/10">
          <button
            type="button"
            onClick={handleCancelar}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={!isConfirmed}
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:bg-rose-950 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl transition-all shadow-md active:scale-[0.98]"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Excluir Todo o Acervo</span>
          </button>
        </div>
      </div>
    </div>
  );
};
