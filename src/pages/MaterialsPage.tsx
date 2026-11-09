import React, { useState } from 'react';
import { Material, MaterialCategory, ConservationState } from '../types/sigef';
import { sigefStorage } from '../services/storage';
import { getConservationBadge, downloadCSV, formatDateTimeBR } from '../utils/formatters';
import {
  exportMaterialsToExcel,
  downloadMaterialsExcelTemplate,
  downloadMaterialsCSVTemplate,
} from '../utils/excelMaterials';
import { useToast } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';
import { MaterialImportModal } from '../components/MaterialImportModal';
import { ClearStockModal } from '../components/ClearStockModal';
import {
  Dumbbell,
  Search,
  Plus,
  Download,
  Upload,
  AlertTriangle,
  History,
  Edit2,
  Trash2,
  Filter,
  CheckCircle,
  X,
  Package,
  FileSpreadsheet,
  CheckSquare,
  Square,
  Check,
  ChevronDown,
  Layers,
  ShieldAlert,
} from 'lucide-react';

interface MaterialsPageProps {
  onOpenNewMaterial: (materialToEdit?: Material | null) => void;
  userRole: string;
}

export const MaterialsPage: React.FC<MaterialsPageProps> = ({ onOpenNewMaterial, userRole }) => {
  const { showToast } = useToast();
  const materials = sigefStorage.getMaterials();
  const loans = sigefStorage.getLoans();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedState, setSelectedState] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'qty' | 'patrimony'>('name');

  // Modals
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
  const [materialToDelete, setMaterialToDelete] = useState<Material | null>(null);
  const [selectedMaterialHistory, setSelectedMaterialHistory] = useState<Material | null>(null);

  // Quick Stock Adjustment modal
  const [adjustingMaterial, setAdjustingMaterial] = useState<Material | null>(null);
  const [adjustDelta, setAdjustDelta] = useState<number>(1);
  const [adjustType, setAdjustType] = useState<
    'entrada' | 'baixa' | 'emprestimo' | 'devolucao' | 'manutencao' | 'ajuste'
  >('entrada');
  const [adjustReason, setAdjustReason] = useState('');

  // Multi-selection for batch actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchDeleteModalOpen, setIsBatchDeleteModalOpen] = useState(false);

  // Dropdown menus
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);

  // Filtered & Sorted items
  const filteredMaterials = materials
    .filter((m) => {
      const matchSearch =
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.patrimonyNumber.toLowerCase().includes(search.toLowerCase()) ||
        m.storageLocation.toLowerCase().includes(search.toLowerCase()) ||
        m.technicalDescription.toLowerCase().includes(search.toLowerCase());

      const matchCategory = selectedCategory === 'all' || m.category === selectedCategory;
      const matchState = selectedState === 'all' || m.conservationState === selectedState;

      return matchSearch && matchCategory && matchState;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'qty') return b.availableQuantity - a.availableQuantity;
      if (sortBy === 'patrimony') return a.patrimonyNumber.localeCompare(b.patrimonyNumber);
      return 0;
    });

  // Checkbox selection handlers
  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredMaterials.length && filteredMaterials.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredMaterials.map((m) => m.id)));
    }
  };

  const handleToggleSelectItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Individual Delete confirmation
  const handleConfirmDeleteIndividual = () => {
    if (!materialToDelete) return;
    const name = materialToDelete.name;
    sigefStorage.deleteMaterial(materialToDelete.id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(materialToDelete.id);
      return next;
    });
    setMaterialToDelete(null);
    showToast(`Material "${name}" removido com sucesso.`, 'info');
  };

  // Batch delete confirmation
  const handleConfirmDeleteBatch = () => {
    const count = selectedIds.size;
    if (count === 0) return;

    sigefStorage.deleteMultipleMaterials(Array.from(selectedIds));
    setSelectedIds(new Set());
    setIsBatchDeleteModalOpen(false);
    showToast(`${count} materiais selecionados foram removidos do acervo.`, 'info');
  };

  // Clear all materials confirmation
  const handleConfirmClearAll = () => {
    const count = materials.length;
    sigefStorage.clearAllMaterials();
    setSelectedIds(new Set());
    showToast(`Todo o estoque (${count} materiais) foi excluído com sucesso.`, 'info');
  };

  // Import handler
  const handleImportComplete = (importedMaterials: Material[], mode: 'add' | 'replace') => {
    sigefStorage.saveMaterialsBatch(importedMaterials, mode);
    setSelectedIds(new Set());
    showToast(
      mode === 'replace'
        ? `Estoque substituído com sucesso por ${importedMaterials.length} materiais!`
        : `${importedMaterials.length} materiais cadastrados no acervo com sucesso!`,
      'success'
    );
  };

  // Export handlers
  const handleExportCSV = () => {
    const headers = [
      'Nº de Patrimônio',
      'Nome do Material',
      'Categoria',
      'Qtd Total',
      'Qtd Disponível',
      'Estado',
      'Local de Guarda',
      'Alerta Estoque Mínimo',
      'Descrição Técnica',
    ];

    const rows = materials.map((m) => [
      `"${m.patrimonyNumber}"`,
      `"${m.name.replace(/"/g, '""')}"`,
      `"${m.category}"`,
      m.totalQuantity,
      m.availableQuantity,
      `"${m.conservationState}"`,
      `"${m.storageLocation.replace(/"/g, '""')}"`,
      m.minStockAlert,
      `"${m.technicalDescription.replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    downloadCSV(`inventario_sigef_coef_${new Date().toISOString().split('T')[0]}.csv`, csvContent);
    showToast('Planilha CSV exportada com sucesso!', 'success');
    setShowExportMenu(false);
  };

  const handleExportExcel = () => {
    exportMaterialsToExcel(materials);
    showToast('Planilha Excel (.xlsx) exportada com sucesso!', 'success');
    setShowExportMenu(false);
  };

  const handleSaveStockAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingMaterial) return;

    const delta = adjustType === 'baixa' ? -Math.abs(adjustDelta) : Math.abs(adjustDelta);
    const currentUser = sigefStorage.getCurrentUser();

    sigefStorage.adjustMaterialStock(
      adjustingMaterial.id,
      delta,
      adjustType,
      adjustReason.trim() || 'Ajuste manual de estoque',
      currentUser.name
    );

    showToast(`Estoque do material "${adjustingMaterial.name}" atualizado!`, 'success');
    setAdjustingMaterial(null);
    setAdjustReason('');
  };

  // Check if item has active loans
  const hasActiveLoans = (materialId: string) => {
    return loans.some(
      (l) => l.status !== 'devolvido' && l.items.some((item) => item.materialId === materialId)
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              <Dumbbell className="w-6 h-6 text-emerald-400" />
              <span>Acervo Patrimonial & Materiais Esportivos</span>
            </h2>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              {materials.length} {materials.length === 1 ? 'item' : 'itens'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Controle de tombamento, estoque disponível, importação via Excel/CSV e exclusão individual ou total
          </p>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex items-center gap-2 self-start lg:self-auto flex-wrap">
          {/* Import Button */}
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-semibold rounded-xl transition-all shadow-sm active:scale-[0.98]"
            title="Importar materiais via planilha Excel (.xlsx) ou CSV com modelo oficial"
          >
            <Upload className="w-4 h-4" />
            <span>Importar Planilha</span>
          </button>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowExportMenu(!showExportMenu);
                setShowTemplateMenu(false);
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-semibold rounded-xl transition-colors"
              title="Exportar inventário"
            >
              <Download className="w-4 h-4 text-slate-400" />
              <span>Exportar</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-1.5 w-48 rounded-2xl bg-[#102027] border border-white/15 shadow-2xl py-1.5 z-40 text-xs">
                <button
                  onClick={handleExportExcel}
                  className="w-full px-3.5 py-2 text-left text-slate-200 hover:bg-white/5 flex items-center gap-2 hover:text-emerald-400 transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>Exportar Excel (.xlsx)</span>
                </button>
                <button
                  onClick={handleExportCSV}
                  className="w-full px-3.5 py-2 text-left text-slate-200 hover:bg-white/5 flex items-center gap-2 hover:text-sky-400 transition-colors"
                >
                  <Download className="w-4 h-4 text-sky-400" />
                  <span>Exportar CSV</span>
                </button>
              </div>
            )}
          </div>

          {/* Template Download Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowTemplateMenu(!showTemplateMenu);
                setShowExportMenu(false);
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-semibold rounded-xl transition-colors"
              title="Baixar planilha modelo de cadastro"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Baixar Modelo</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showTemplateMenu && (
              <div className="absolute right-0 mt-1.5 w-52 rounded-2xl bg-[#102027] border border-white/15 shadow-2xl py-1.5 z-40 text-xs">
                <button
                  onClick={() => {
                    downloadMaterialsExcelTemplate();
                    setShowTemplateMenu(false);
                    showToast('Modelo Excel (.xlsx) baixado com sucesso!', 'success');
                  }}
                  className="w-full px-3.5 py-2 text-left text-slate-200 hover:bg-white/5 flex items-center gap-2 hover:text-emerald-400 transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>Modelo Excel (.xlsx)</span>
                </button>
                <button
                  onClick={() => {
                    downloadMaterialsCSVTemplate();
                    setShowTemplateMenu(false);
                    showToast('Modelo CSV baixado com sucesso!', 'success');
                  }}
                  className="w-full px-3.5 py-2 text-left text-slate-200 hover:bg-white/5 flex items-center gap-2 hover:text-sky-400 transition-colors"
                >
                  <Download className="w-4 h-4 text-sky-400" />
                  <span>Modelo CSV</span>
                </button>
              </div>
            )}
          </div>

          {/* Clear All Stock Button */}
          {materials.length > 0 && (
            <button
              onClick={() => setIsClearAllModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold rounded-xl transition-all shadow-sm active:scale-[0.98]"
              title="Excluir todos os materiais do acervo de uma vez"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Excluir Todo o Estoque</span>
            </button>
          )}

          {/* New Material Button */}
          <button
            onClick={() => onOpenNewMaterial()}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#1B8A4B] hover:bg-[#22A55B] text-white text-xs font-semibold rounded-xl shadow-md shadow-emerald-950/40 transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar Material</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-[#102027] border border-white/10 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, tombo, armário..."
            className="w-full h-9 pl-9 pr-3 bg-[#0B1418] border border-white/15 rounded-xl text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-9 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-xs text-slate-200 focus:outline-none"
          >
            <option value="all">Todas as Modalidades ({sigefStorage.getCategories().length})</option>
            {sigefStorage.getCategories().map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.isCustom ? ' (Personalizada)' : ''}
              </option>
            ))}
          </select>

          {/* Conservation State Filter */}
          <select
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            className="h-9 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-xs text-slate-200 focus:outline-none"
          >
            <option value="all">Todos os Estados</option>
            <option value="novo">Novo</option>
            <option value="bom">Bom</option>
            <option value="regular">Regular</option>
            <option value="danificado">Danificado</option>
            <option value="baixado">Baixado</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="h-9 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-xs text-slate-200 focus:outline-none"
          >
            <option value="name">Ordenar por Nome</option>
            <option value="qty">Ordenar por Quantidade</option>
            <option value="patrimony">Ordenar por Patrimônio</option>
          </select>
        </div>
      </div>

      {/* Batch Action Bar (when items are selected) */}
      {selectedIds.size > 0 && (
        <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-emerald-500/30 flex items-center justify-between gap-3 shadow-xl animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold flex items-center justify-center text-xs">
              {selectedIds.size}
            </span>
            <span className="text-xs text-slate-200 font-medium">
              {selectedIds.size === 1 ? 'material selecionado' : 'materiais selecionados'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
            >
              Desmarcar Todos
            </button>

            <button
              onClick={() => setIsBatchDeleteModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl transition-all shadow-md active:scale-[0.98]"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Excluir Selecionados ({selectedIds.size})</span>
            </button>
          </div>
        </div>
      )}

      {/* Materials Table */}
      <div className="rounded-2xl border border-white/10 bg-[#102027] overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#0B1418] text-slate-400 font-bold border-b border-white/10 uppercase tracking-wider text-[11px]">
              <tr>
                {/* Select All Checkbox */}
                <th className="p-3.5 pl-4 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={
                      filteredMaterials.length > 0 &&
                      selectedIds.size === filteredMaterials.length
                    }
                    onChange={handleToggleSelectAll}
                    className="rounded bg-[#0B1418] border-white/20 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    title="Selecionar todos os materiais listados"
                  />
                </th>
                <th className="p-3.5 w-32">
                  Tombo / Patrimônio
                </th>
                <th className="p-3.5">Material & Especificação</th>
                <th className="p-3.5 w-28">Modalidade</th>
                <th className="p-3.5 w-24 text-center">Disponível / Total</th>
                <th className="p-3.5 w-28 text-center">Estado</th>
                <th className="p-3.5 w-36">Local de Guarda</th>
                <th className="p-3.5 pr-4 w-32 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredMaterials.map((mat) => {
                const badge = getConservationBadge(mat.conservationState);
                const isLowStock = mat.availableQuantity <= mat.minStockAlert;
                const isDamaged = mat.conservationState === 'danificado';
                const isSelected = selectedIds.has(mat.id);

                return (
                  <tr
                    key={mat.id}
                    className={`hover:bg-white/[0.02] transition-colors ${
                      isSelected
                        ? 'bg-emerald-950/20'
                        : isDamaged
                        ? 'bg-rose-950/20'
                        : isLowStock
                        ? 'bg-amber-950/15'
                        : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="p-3.5 pl-4 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectItem(mat.id)}
                        className="rounded bg-[#0B1418] border-white/20 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </td>

                    {/* Patrimony */}
                    <td className="p-3.5 font-mono font-bold text-slate-200">
                      {mat.patrimonyNumber}
                    </td>

                    {/* Name & Tech Description */}
                    <td className="p-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-sm block">{mat.name}</span>
                        {isLowStock && (
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1"
                            title="Estoque abaixo ou no limite mínimo estipulado"
                          >
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                            <span>Mínimo</span>
                          </span>
                        )}
                        {isDamaged && (
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30"
                            title="Material avariado aguardando reparo técnico"
                          >
                            Danificado
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                        {mat.technicalDescription}
                      </p>
                    </td>

                    {/* Category */}
                    <td className="p-3.5">
                      <span className="text-slate-300 font-medium">
                        {sigefStorage.getCategoryLabel(mat.category)}
                      </span>
                    </td>

                    {/* Quantities */}
                    <td className="p-3.5 text-center">
                      <div className="font-mono">
                        <span
                          className={`font-bold text-sm ${
                            mat.availableQuantity === 0
                              ? 'text-rose-400'
                              : isLowStock
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {mat.availableQuantity}
                        </span>
                        <span className="text-slate-500 text-xs"> / {mat.totalQuantity}</span>
                      </div>
                    </td>

                    {/* Conservation State */}
                    <td className="p-3.5 text-center">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${badge.colorClass}`}
                      >
                        {badge.label}
                      </span>
                    </td>

                    {/* Storage Location */}
                    <td className="p-3.5 text-[11px] text-slate-300 font-medium">
                      {mat.storageLocation}
                    </td>

                    {/* Actions */}
                    <td className="p-3.5 pr-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* History */}
                        <button
                          onClick={() => setSelectedMaterialHistory(mat)}
                          className="p-1.5 text-slate-400 hover:text-sky-300 rounded-lg hover:bg-white/5 transition-colors"
                          title="Histórico de Movimentações"
                        >
                          <History className="w-4 h-4" />
                        </button>

                        {/* Adjust Stock */}
                        <button
                          onClick={() => {
                            setAdjustingMaterial(mat);
                            setAdjustDelta(1);
                            setAdjustType('entrada');
                            setAdjustReason('');
                          }}
                          className="p-1.5 text-slate-400 hover:text-emerald-300 rounded-lg hover:bg-white/5 transition-colors"
                          title="Ajuste Rápido de Estoque"
                        >
                          <Package className="w-4 h-4" />
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => onOpenNewMaterial(mat)}
                          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                          title="Editar Material"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Individual Delete */}
                        <button
                          onClick={() => setMaterialToDelete(mat)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-white/5 transition-colors"
                          title="Excluir Material Individualmente"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredMaterials.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <Dumbbell className="w-10 h-10 mx-auto opacity-30 mb-2" />
                    <p className="text-sm font-semibold">Nenhum material encontrado no acervo.</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Você pode cadastrar manualmente ou importar via planilha Excel (.xlsx) / CSV.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Material Import Modal (Excel & CSV) */}
      <MaterialImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportComplete={handleImportComplete}
        currentStockCount={materials.length}
      />

      {/* Clear All Stock Modal */}
      <ClearStockModal
        isOpen={isClearAllModalOpen}
        onClose={() => setIsClearAllModalOpen(false)}
        onConfirmClearAll={handleConfirmClearAll}
        totalMaterialsCount={materials.length}
      />

      {/* Individual Material Delete Confirmation Modal */}
      {materialToDelete && (
        <ConfirmModal
          isOpen={Boolean(materialToDelete)}
          title="Excluir Material do Acervo"
          message={`Tem certeza de que deseja remover permanentemente o material "${materialToDelete.name}" (Patrimônio: ${materialToDelete.patrimonyNumber})? ${
            hasActiveLoans(materialToDelete.id)
              ? 'ATENÇÃO: Este material possui empréstimos ativos vinculados!'
              : 'O registro será apagado do sistema e da nuvem Supabase.'
          }`}
          confirmLabel="Excluir Material"
          cancelLabel="Cancelar"
          isDestructive={true}
          onConfirm={handleConfirmDeleteIndividual}
          onCancel={() => setMaterialToDelete(null)}
        />
      )}

      {/* Batch Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isBatchDeleteModalOpen}
        title="Excluir Materiais Selecionados"
        message={`Deseja remover permanentemente os ${selectedIds.size} materiais selecionados do acervo patrimonial? Esta ação atualizará o sistema e o banco de dados Supabase.`}
        confirmLabel={`Excluir ${selectedIds.size} Materiais`}
        cancelLabel="Cancelar"
        isDestructive={true}
        onConfirm={handleConfirmDeleteBatch}
        onCancel={() => setIsBatchDeleteModalOpen(false)}
      />

      {/* Material Movement History Modal */}
      {selectedMaterialHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-[#102027] text-slate-100 rounded-2xl border border-white/10 p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-sky-400" />
                  <span>Histórico de Movimentações</span>
                </h3>
                <p className="text-xs text-slate-400">
                  {selectedMaterialHistory.name} ({selectedMaterialHistory.patrimonyNumber})
                </p>
              </div>
              <button
                onClick={() => setSelectedMaterialHistory(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-2.5 max-h-80 overflow-y-auto pr-1 text-xs">
              {selectedMaterialHistory.history && selectedMaterialHistory.history.length > 0 ? (
                selectedMaterialHistory.history.map((mov) => (
                  <div
                    key={mov.id}
                    className="p-3 rounded-xl bg-[#0B1418] border border-white/5 flex items-start justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                            mov.type === 'entrada'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : mov.type === 'baixa'
                              ? 'bg-rose-500/20 text-rose-300'
                              : mov.type === 'emprestimo'
                              ? 'bg-sky-500/20 text-sky-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {mov.type}
                        </span>
                        <span className="font-bold text-white font-mono">
                          {mov.type === 'baixa' || mov.type === 'emprestimo' ? '-' : '+'}
                          {mov.quantity} unidade(s)
                        </span>
                      </div>
                      <p className="text-slate-300 mt-1">{mov.reason}</p>
                      <span className="text-[10px] text-slate-500 mt-0.5 block">
                        Responsável: {mov.responsible}
                      </span>
                    </div>

                    <span className="text-[11px] font-mono text-slate-400 shrink-0">
                      {formatDateTimeBR(mov.date)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-center py-6 text-slate-500 text-xs">
                  Nenhuma movimentação registrada para este item.
                </p>
              )}
            </div>

            <div className="pt-4 mt-4 border-t border-white/10 flex justify-end">
              <button
                onClick={() => setSelectedMaterialHistory(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold"
              >
                Fechar Histórico
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stock Adjustment Modal */}
      {adjustingMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-[#102027] text-slate-100 rounded-2xl border border-white/10 p-5 sm:p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">
              Ajuste de Estoque: {adjustingMaterial.name}
            </h3>
            <p className="text-xs text-slate-400 mb-4 font-mono">
              Atual: {adjustingMaterial.availableQuantity} disp. / {adjustingMaterial.totalQuantity} total
            </p>

            <form onSubmit={handleSaveStockAdjustment} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Tipo de Ajuste</label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value as any)}
                  className="w-full h-9 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none"
                >
                  <option value="entrada">Entrada / Reposição de Estoque</option>
                  <option value="baixa">Baixa Definitiva (Extravio / Descarte)</option>
                  <option value="ajuste">Ajuste de Inventário / Conferência</option>
                  <option value="manutencao">Retirada para Manutenção Técnica</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Quantidade</label>
                <input
                  type="number"
                  min="1"
                  value={adjustDelta}
                  onChange={(e) => setAdjustDelta(Number(e.target.value))}
                  className="w-full h-9 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 font-mono text-center font-bold focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Motivo / Justificativa</label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Ex: Aquisição suplementar, contagem periódica..."
                  className="w-full h-9 px-3 bg-[#0B1418] border border-white/15 rounded-xl text-slate-100 focus:outline-none"
                  required
                />
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustingMaterial(null)}
                  className="px-3 py-2 text-slate-400 hover:text-white rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1B8A4B] hover:bg-[#22A55B] text-white font-semibold rounded-xl"
                >
                  Confirmar Ajuste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
