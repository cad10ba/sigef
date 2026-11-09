import React, { useState, useEffect } from 'react';
import { SportKit, SportKitItem, MaterialCategory } from '../types/sigef';
import { sigefStorage } from '../services/storage';
import { useToast } from './Toast';
import { Boxes, X, Plus, Trash2, Check, AlertCircle } from 'lucide-react';

interface NewKitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  kitToEdit?: SportKit | null;
}

export const NewKitModal: React.FC<NewKitModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  kitToEdit,
}) => {
  const { showToast } = useToast();
  const materials = sigefStorage.getMaterials();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<MaterialCategory>('volei');
  const [items, setItems] = useState<SportKitItem[]>([]);

  // Dynamic Category
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const categories = sigefStorage.getCategories();

  const handleCreateCategory = () => {
    if (!newCategoryName.trim()) {
      showToast('Digite o nome da nova modalidade.', 'error');
      return;
    }
    const created = sigefStorage.addCategory(newCategoryName);
    setCategory(created.id);
    setNewCategoryName('');
    setIsAddingCategory(false);
    showToast(`Modalidade "${created.name}" cadastrada com sucesso!`, 'success');
  };

  useEffect(() => {
    if (kitToEdit) {
      setName(kitToEdit.name);
      setDescription(kitToEdit.description);
      setCategory(kitToEdit.category);
      setItems(kitToEdit.items);
    } else {
      setName('');
      setDescription('');
      setCategory('volei');
      setItems([]);
    }
  }, [kitToEdit, isOpen]);

  if (!isOpen) return null;

  const handleAddItem = (materialId: string) => {
    const mat = materials.find((m) => m.id === materialId);
    if (!mat) return;
    const exists = items.find((i) => i.materialId === materialId);
    if (exists) {
      setItems(
        items.map((i) => (i.materialId === materialId ? { ...i, quantity: i.quantity + 1 } : i))
      );
    } else {
      setItems([...items, { materialId: mat.id, materialName: mat.name, quantity: 1 }]);
    }
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleQuantityChange = (index: number, qty: number) => {
    const updated = [...items];
    updated[index].quantity = Math.max(1, qty);
    setItems(updated);
  };

  // Calculate live preview status
  let isReady = items.length > 0;
  for (const item of items) {
    const mat = materials.find((m) => m.id === item.materialId);
    if (!mat || mat.availableQuantity < item.quantity) {
      isReady = false;
      break;
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      showToast('Informe o nome do kit.', 'error');
      return;
    }

    if (items.length === 0) {
      showToast('Adicione pelo menos um material ao kit.', 'error');
      return;
    }

    const newKit: SportKit = {
      id: kitToEdit ? kitToEdit.id : 'kit-' + Date.now(),
      name: name.trim(),
      description: description.trim(),
      category,
      items,
      status: isReady ? 'pronto' : 'incompleto',
    };

    sigefStorage.saveKit(newKit);
    showToast(kitToEdit ? 'Kit esportivo atualizado!' : 'Novo kit esportivo montado!', 'success');
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl bg-[#102027] text-slate-100 rounded-2xl border border-white/10 p-5 sm:p-6 shadow-2xl my-6">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Boxes className="w-5 h-5 text-purple-400" />
              <span>{kitToEdit ? 'Editar Kit Esportivo' : 'Montar Novo Kit de Materiais'}</span>
            </h2>
            <p className="text-xs text-slate-400">
              Conjunto pré-montado para aulas práticas e treinos da COEF
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs sm:text-sm">
          {/* Name & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nome do Kit <span className="text-emerald-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Kit Vôlei Completo para Treino"
                className="w-full h-10 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none focus:border-purple-500"
                required
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-300">
                  Modalidade
                </label>
                {!isAddingCategory && (
                  <button
                    type="button"
                    onClick={() => setIsAddingCategory(true)}
                    className="text-[11px] font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors px-1 py-0.5 rounded hover:bg-purple-500/10"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ Nova</span>
                  </button>
                )}
              </div>

              {isAddingCategory ? (
                <div className="p-2.5 rounded-xl bg-[#0B1418] border border-purple-500/30 space-y-2 animate-in fade-in zoom-in-95 duration-100">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      autoFocus
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleCreateCategory();
                        }
                      }}
                      placeholder="Ex: Badminton, Natação..."
                      className="flex-1 h-9 px-2.5 bg-[#102027] border border-white/20 rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
                    />
                    <button
                      type="button"
                      onClick={handleCreateCategory}
                      className="px-2.5 h-9 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 shrink-0"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Salvar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingCategory(false);
                        setNewCategoryName('');
                      }}
                      className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <select
                  value={category}
                  onChange={(e) => {
                    if (e.target.value === '__NEW__') {
                      setIsAddingCategory(true);
                    } else {
                      setCategory(e.target.value);
                    }
                  }}
                  className="w-full h-10 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none focus:border-purple-500 text-xs"
                >
                  <optgroup label="Modalidades Disponíveis">
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} {cat.isCustom ? ' (Personalizada)' : ''}
                      </option>
                    ))}
                  </optgroup>
                  <option value="__NEW__" className="text-purple-400 font-bold bg-[#0B1418]">
                    ➕ + Cadastrar nova modalidade...
                  </option>
                </select>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Finalidade / Descrição do Kit
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Contém 6 bolas oficiais, 1 rede reforçada e 12 coletes numerados para aula."
              className="w-full p-2.5 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Items Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Adicionar Materiais do Acervo ao Kit <span className="text-emerald-400">*</span>
            </label>
            {materials.length > 0 ? (
              <select
                className="w-full h-9 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    handleAddItem(e.target.value);
                    e.target.value = '';
                  }
                }}
              >
                <option value="">+ Selecionar material patrimonial...</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.patrimonyNumber}) — Disp: {m.availableQuantity}/{m.totalQuantity}
                  </option>
                ))}
              </select>
            ) : (
              <div className="p-2.5 bg-amber-950/30 border border-amber-500/30 rounded-xl text-amber-300 text-xs">
                Nenhum material cadastrado no acervo ainda. Cadastre materiais na aba "Materiais" antes de montar kits.
              </div>
            )}
          </div>

          {/* Items list */}
          {items.length > 0 ? (
            <div className="space-y-2 border border-white/10 rounded-xl p-2.5 bg-[#0B1418]">
              {items.map((item, idx) => {
                const mat = materials.find((m) => m.id === item.materialId);
                const hasSufficient = mat && mat.availableQuantity >= item.quantity;

                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-[#102027] border border-white/5 text-xs"
                  >
                    <div className="flex-1 pr-2">
                      <span className="font-semibold text-white block">{item.materialName}</span>
                      <span
                        className={`text-[11px] font-mono ${
                          hasSufficient ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        Estoque disponível: {mat?.availableQuantity ?? 0} {hasSufficient ? '✓' : '(insuficiente)'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400 text-xs">Qtd no Kit:</span>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleQuantityChange(idx, Number(e.target.value))}
                          className="w-14 h-8 px-2 bg-[#0B1418] border border-white/15 rounded-lg text-center font-bold text-white text-xs focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-white/5 transition-colors"
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
              Nenhum material adicionado a este kit.
            </p>
          )}

          {/* Live Status Pill */}
          <div className="p-3 bg-[#0B1418] rounded-xl border border-white/10 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">
              Status automático do Kit:
            </span>
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                isReady
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              }`}
            >
              {isReady ? 'Kit Pronto para Empréstimo' : 'Kit Incompleto (Estoque Insuficiente)'}
            </span>
          </div>

          {/* Submit */}
          <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-3">
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
              <Check className="w-4 h-4" />
              <span>Salvar Kit</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
