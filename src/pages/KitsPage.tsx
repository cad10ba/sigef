import React from 'react';
import { SportKit } from '../types/sigef';
import { sigefStorage } from '../services/storage';
import { getKitStatusBadge } from '../utils/formatters';
import { useToast } from '../components/Toast';
import {
  Boxes,
  Plus,
  CheckCircle,
  AlertCircle,
  ClipboardPenLine,
  Edit2,
  Trash2,
  Package,
  Layers,
} from 'lucide-react';

interface KitsPageProps {
  onOpenNewKit: (kitToEdit?: SportKit | null) => void;
  onOpenNewLoanWithKit: (kitId: string) => void;
  userRole: string;
}

export const KitsPage: React.FC<KitsPageProps> = ({
  onOpenNewKit,
  onOpenNewLoanWithKit,
  userRole,
}) => {
  const { showToast } = useToast();
  const kits = sigefStorage.getKits();
  const materials = sigefStorage.getMaterials();

  const handleDeleteKit = (id: string, name: string) => {
    if (confirm(`Deseja excluir o kit esportivo "${name}"?`)) {
      sigefStorage.deleteKit(id);
      showToast(`Kit "${name}" excluído.`, 'info');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Boxes className="w-6 h-6 text-purple-400" />
            <span>Kits Esportivos Pré-Montados</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Conjuntos pré-configurados para aulas práticas, treinos e interclasses com baixa automática de acervo
          </p>
        </div>

        <button
          onClick={() => onOpenNewKit()}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1B8A4B] hover:bg-[#22A55B] text-white text-xs font-semibold rounded-xl shadow-md shadow-emerald-950/40 transition-all active:scale-[0.98] self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Montar Novo Kit</span>
        </button>
      </div>

      {/* Info card */}
      <div className="p-4 rounded-2xl bg-[#102027] border border-white/10 flex items-start gap-3">
        <Package className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 leading-relaxed">
          <strong className="text-white block font-semibold">Como funcionam os Kits no SIGEF:</strong>
          Ao clicar em <em>"Emprestar Kit"</em>, o sistema aloca simultaneamente todos os materiais que compõem o kit (bolas, coletes, cones, redes), decrementando o saldo no acervo e gerando um único Termo de Responsabilidade com número de tombamento de cada item. O status do kit é recalculado em tempo real com base no estoque livre.
        </div>
      </div>

      {/* Kits Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {kits.map((kit) => {
          const badge = getKitStatusBadge(kit.status);
          const isReady = kit.status === 'pronto';

          return (
            <div
              key={kit.id}
              className="rounded-2xl bg-[#102027] border border-white/10 p-5 flex flex-col justify-between shadow-xl hover:border-white/20 transition-all"
            >
              <div>
                <div className="flex items-start justify-between gap-2 pb-3 border-b border-white/10">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 block mb-0.5">
                      Modalidade: {sigefStorage.getCategoryLabel(kit.category)}
                    </span>
                    <h3 className="font-bold text-base text-white">{kit.name}</h3>
                  </div>

                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full border ${badge.badgeClass}`}
                  >
                    {badge.label}
                  </span>
                </div>

                <p className="text-xs text-slate-300 mt-3 leading-relaxed">{kit.description}</p>

                {/* Items in the kit */}
                <div className="mt-4 space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Composição do Kit ({kit.items.length} materiais):
                  </span>

                  <div className="space-y-1.5">
                    {kit.items.map((item) => {
                      const mat = materials.find((m) => m.id === item.materialId);
                      const hasStock = mat && mat.availableQuantity >= item.quantity;

                      return (
                        <div
                          key={item.materialId}
                          className="flex items-center justify-between p-2 rounded-lg bg-[#0B1418] border border-white/5 text-xs"
                        >
                          <div className="flex-1 pr-2">
                            <span className="text-slate-200 font-medium block">
                              {item.materialName}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              Disponível no acervo: {mat?.availableQuantity ?? 0}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="font-bold text-white font-mono bg-white/10 px-2 py-0.5 rounded">
                              {item.quantity} un
                            </span>
                            {hasStock ? (
                              <span className="text-emerald-400 text-xs font-bold" title="Estoque OK">
                                ✓
                              </span>
                            ) : (
                              <span
                                className="text-amber-400 text-xs font-bold"
                                title="Estoque insuficiente"
                              >
                                !
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onOpenNewKit(kit)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                    title="Editar Composição do Kit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDeleteKit(kit.id, kit.name)}
                    className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-white/5 transition-colors"
                    title="Excluir Kit"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={() => onOpenNewLoanWithKit(kit.id)}
                  disabled={!isReady}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm ${
                    isReady
                      ? 'bg-[#1B8A4B] hover:bg-[#22A55B] text-white shadow-emerald-950/40 active:scale-[0.98]'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <ClipboardPenLine className="w-3.5 h-3.5" />
                  <span>{isReady ? 'Emprestar Kit Completo' : 'Estoque Insuficiente'}</span>
                </button>
              </div>
            </div>
          );
        })}

        {kits.length === 0 && (
          <div className="col-span-full text-center py-12 rounded-2xl bg-[#102027] border border-white/10 text-slate-400">
            <Boxes className="w-12 h-12 mx-auto opacity-30 mb-2" />
            <p className="text-base font-bold text-white">Nenhum kit montado ainda.</p>
            <p className="text-xs text-slate-400 mt-1">
              Monte kits esportivos para agilizar a entrega de materiais em aulas regulares.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
