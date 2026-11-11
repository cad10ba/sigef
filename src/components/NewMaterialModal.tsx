import React, { useState, useEffect } from 'react';
import { Material, MaterialCategory, ConservationState } from '../types/sigef';
import { sigefStorage } from '../services/storage';
import { useToast } from './Toast';
import { PackagePlus, X, Check, Dumbbell, Plus } from 'lucide-react';

interface NewMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  materialToEdit?: Material | null;
}

// Estado inicial de um cadastro novo: todos os campos abrem em branco.
const EMPTY_MATERIAL_FORM = {
  patrimonyNumber: '',
  name: '',
  technicalDescription: '',
  category: '' as MaterialCategory | '',
  totalQuantity: '' as number | '',
  availableQuantity: '' as number | '',
  conservationState: '' as ConservationState | '',
  storageLocation: '',
  minStockAlert: '' as number | '',
};

export const NewMaterialModal: React.FC<NewMaterialModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  materialToEdit,
}) => {
  const { showToast } = useToast();

  const [patrimonyNumber, setPatrimonyNumber] = useState('');
  const [name, setName] = useState('');
  const [technicalDescription, setTechnicalDescription] = useState('');
  const [category, setCategory] = useState<MaterialCategory | ''>('');
  const [totalQuantity, setTotalQuantity] = useState<number | ''>('');
  const [availableQuantity, setAvailableQuantity] = useState<number | ''>('');
  const [conservationState, setConservationState] = useState<ConservationState | ''>('');
  const [storageLocation, setStorageLocation] = useState('');
  const [minStockAlert, setMinStockAlert] = useState<number | ''>('');

  // Custom Category creation
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const categories = sigefStorage.getCategories();

  // Modo "editar" recebe o item selecionado; modo "novo" sempre parte do estado vazio.
  const resetForm = (material?: Material | null) => {
    const values = material
      ? {
          patrimonyNumber: material.patrimonyNumber,
          name: material.name,
          technicalDescription: material.technicalDescription,
          category: material.category,
          totalQuantity: material.totalQuantity,
          availableQuantity: material.availableQuantity,
          conservationState: material.conservationState,
          storageLocation: material.storageLocation,
          minStockAlert: material.minStockAlert,
        }
      : { ...EMPTY_MATERIAL_FORM };

    setPatrimonyNumber(values.patrimonyNumber);
    setName(values.name);
    setTechnicalDescription(values.technicalDescription);
    setCategory(values.category);
    setTotalQuantity(values.totalQuantity);
    setAvailableQuantity(values.availableQuantity);
    setConservationState(values.conservationState);
    setStorageLocation(values.storageLocation);
    setMinStockAlert(values.minStockAlert);
    setIsAddingCategory(false);
    setNewCategoryName('');
  };

  useEffect(() => {
    if (isOpen) resetForm(materialToEdit);
  }, [materialToEdit, isOpen]);

  if (!isOpen) return null;

  const handleCancelar = () => {
    resetForm(null);
    onClose();
  };

  const handleCreateCategory = () => {
    if (!newCategoryName.trim()) {
      showToast('Digite o nome da nova modalidade.', 'error');
      return;
    }
    const created = sigefStorage.addCategory(newCategoryName);
    setCategory(created.id);
    setNewCategoryName('');
    setIsAddingCategory(false);
    showToast(`Modalidade "${created.name}" cadastrada com sucesso e salva para usos futuros!`, 'success');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      showToast('Informe o nome do material.', 'error');
      return;
    }

    if (!category) {
      showToast('Selecione a categoria/modalidade do material.', 'error');
      return;
    }

    if (!conservationState) {
      showToast('Selecione o estado de conservação.', 'error');
      return;
    }

    if (!totalQuantity || Number(totalQuantity) < 1) {
      showToast('Informe a quantidade total do material.', 'error');
      return;
    }

    const currentUser = sigefStorage.getCurrentUser();

    const newMat: Material = {
      id: materialToEdit ? materialToEdit.id : 'mat-' + Date.now(),
      patrimonyNumber: patrimonyNumber.trim(),
      name: name.trim(),
      technicalDescription: technicalDescription.trim(),
      category: category as MaterialCategory,
      totalQuantity: Number(totalQuantity),
      availableQuantity: Math.min(
        availableQuantity === '' ? Number(totalQuantity) : Number(availableQuantity),
        Number(totalQuantity)
      ),
      conservationState: conservationState as ConservationState,
      storageLocation: storageLocation.trim(),
      minStockAlert: Number(minStockAlert) || 0,
      history: materialToEdit
        ? materialToEdit.history
        : [
            {
              id: 'mov-' + Date.now(),
              date: new Date().toISOString(),
              type: 'entrada',
              quantity: Number(totalQuantity),
              reason: 'Cadastro inicial de patrimônio no SIGEF',
              responsible: currentUser.name,
            },
          ],
    };

    sigefStorage.saveMaterial(newMat);
    showToast(
      materialToEdit ? 'Material atualizado com sucesso!' : 'Novo material cadastrado no acervo!',
      'success'
    );
    resetForm(null);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl bg-[#102027] text-slate-100 rounded-2xl border border-white/10 p-5 sm:p-6 shadow-2xl my-auto">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <PackagePlus className="w-5 h-5 text-amber-400" />
              <span>{materialToEdit ? 'Editar Material Patrimonial' : 'Cadastrar Material no Acervo'}</span>
            </h2>
            <p className="text-xs text-slate-400">
              Controle de inventário e tombamento da Coordenação de Educação Física
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
          {/* Tombo & Name */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nº Tombo/Patrimônio <span className="text-emerald-400">*</span>
              </label>
              <input
                type="text"
                value={patrimonyNumber}
                onChange={(e) => setPatrimonyNumber(e.target.value)}
                className="w-full h-10 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 font-mono text-xs focus:outline-none focus:border-amber-500"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nome do Material Esportivo <span className="text-emerald-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Bola de Basquete Spalding TF-500 #7"
                className="w-full h-10 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500"
                required
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Descrição Técnica e Especificações
            </label>
            <textarea
              rows={2}
              value={technicalDescription}
              onChange={(e) => setTechnicalDescription(e.target.value)}
              placeholder="Material de fabricação, tamanho oficial, costura, marca e recomendações..."
              className="w-full p-2.5 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Category & State */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-300">
                  Categoria / Modalidade Esportiva
                </label>
                {!isAddingCategory && (
                  <button
                    type="button"
                    onClick={() => setIsAddingCategory(true)}
                    className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors px-1 py-0.5 rounded hover:bg-emerald-500/10"
                    title="Adicionar nova categoria/modalidade esportiva"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ Nova Modalidade</span>
                  </button>
                )}
              </div>

              {isAddingCategory ? (
                <div className="p-2.5 rounded-xl bg-[#0B1418] border border-emerald-500/30 space-y-2 animate-in fade-in zoom-in-95 duration-100">
                  <span className="text-[11px] font-bold text-emerald-300 block">
                    Cadastrar Nova Modalidade:
                  </span>
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
                      className="flex-1 h-9 px-2.5 bg-[#102027] border border-white/20 rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={handleCreateCategory}
                      className="px-2.5 h-9 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 shrink-0"
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
                      title="Cancelar"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-400 block">
                    Esta modalidade ficará salva no sistema para todos os futuros cadastros.
                  </span>
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
                  className="w-full h-10 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500 text-xs"
                >
                  <option value="">Selecione a modalidade</option>
                  <optgroup label="Modalidades Disponíveis">
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} {cat.isCustom ? ' (Personalizada)' : ''}
                      </option>
                    ))}
                  </optgroup>
                  <option value="__NEW__" className="text-emerald-400 font-bold bg-[#0B1418]">
                    ➕ + Cadastrar nova modalidade...
                  </option>
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Estado de Conservação
              </label>
              <select
                value={conservationState}
                onChange={(e) => setConservationState(e.target.value as ConservationState)}
                className="w-full h-10 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500"
                required
              >
                <option value="">Selecione o estado</option>
                <option value="novo">Novo (Sem uso / Perfeito)</option>
                <option value="bom">Bom (Uso regular excelente)</option>
                <option value="regular">Regular (Desgaste natural)</option>
                <option value="danificado">Danificado (Necessita reparo)</option>
                <option value="baixado">Baixado (Inservível / Descarte)</option>
              </select>
            </div>
          </div>

          {/* Quantities & Min stock */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Qtd Total
              </label>
              <input
                type="number"
                min="1"
                value={totalQuantity}
                onChange={(e) => setTotalQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="0"
                className="w-full h-10 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 text-center font-bold text-sm font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Qtd Disponível
              </label>
              <input
                type="number"
                min="0"
                max={totalQuantity}
                value={availableQuantity}
                onChange={(e) =>
                  setAvailableQuantity(e.target.value === '' ? '' : Number(e.target.value))
                }
                placeholder="0"
                className="w-full h-10 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 text-center font-bold text-sm font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Estoque Mínimo
              </label>
              <input
                type="number"
                min="0"
                value={minStockAlert}
                onChange={(e) => setMinStockAlert(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="0"
                className="w-full h-10 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 text-center font-bold text-sm font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Storage Location */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Local de Guarda / Almoxarifado
            </label>
            <input
              type="text"
              value={storageLocation}
              onChange={(e) => setStorageLocation(e.target.value)}
              placeholder="Ex: Armário A1 - Prateleira 2, Caixa 04..."
              className="w-full h-10 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Submit */}
          <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-3">
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
              <Check className="w-4 h-4" />
              <span>Salvar Material</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
