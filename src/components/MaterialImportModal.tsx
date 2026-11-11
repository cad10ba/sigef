import React, { useState, useRef } from 'react';
import { Material } from '../types/sigef';
import {
  parseMaterialsSpreadsheet,
  downloadMaterialsExcelTemplate,
  downloadMaterialsCSVTemplate,
  VALID_CATEGORIES,
  VALID_STATES,
} from '../utils/excelMaterials';
import { useToast } from './Toast';
import {
  Upload,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  CheckCircle2,
  X,
  FileText,
  HelpCircle,
  Layers,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

interface MaterialImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (materials: Material[], mode: 'add' | 'replace') => void;
  currentStockCount: number;
}

export const MaterialImportModal: React.FC<MaterialImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
  currentStockCount,
}) => {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isParsing, setIsParsing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedMaterials, setParsedMaterials] = useState<Material[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [importMode, setImportMode] = useState<'add' | 'replace'>('add');
  const [activeTab, setActiveTab] = useState<'upload' | 'guide'>('upload');

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setIsParsing(true);
    setParseErrors([]);
    setParseWarnings([]);
    setParsedMaterials([]);

    try {
      const result = await parseMaterialsSpreadsheet(file);
      setIsParsing(false);

      if (!result.success || result.materials.length === 0) {
        setParseErrors(result.errors.length > 0 ? result.errors : ['Nenhum material válido encontrado na planilha.']);
        setParseWarnings(result.warnings);
        showToast('Não foi possível extrair materiais da planilha.', 'error');
      } else {
        setParsedMaterials(result.materials);
        setParseWarnings(result.warnings);
        showToast(`${result.materials.length} materiais identificados com sucesso!`, 'success');
      }
    } catch (err: any) {
      setIsParsing(false);
      setParseErrors([err?.message || 'Falha ao processar o arquivo.']);
      showToast('Erro ao ler a planilha.', 'error');
    }
  };

  const handleResetFile = () => {
    setSelectedFile(null);
    setParsedMaterials([]);
    setParseErrors([]);
    setParseWarnings([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const resetForm = () => {
    handleResetFile();
    setIsParsing(false);
    setImportMode('add');
    setActiveTab('upload');
  };

  const handleCancelar = () => {
    resetForm();
    onClose();
  };

  const handleConfirmImport = () => {
    if (parsedMaterials.length === 0) {
      showToast('Selecione uma planilha válida com materiais para importar.', 'error');
      return;
    }

    onImportComplete(parsedMaterials, importMode);
    resetForm();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs">
      <div className="relative w-full max-w-3xl bg-[#102027] text-slate-100 rounded-3xl border border-white/15 p-5 sm:p-7 shadow-2xl max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Importar Materiais via Planilha (Excel & CSV)
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  .xlsx • .xls • .csv
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Cadastre dezenas de itens de uma só vez utilizando a planilha modelo do SIGEF
              </p>
            </div>
          </div>
          <button
            onClick={handleCancelar}
            aria-label="Fechar"
            className="p-2 -m-1 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-2 mt-4 pb-2 border-b border-white/5">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'upload'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Enviar Planilha</span>
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'guide'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>Modelo & Instruções</span>
          </button>
        </div>

        {/* TAB 1: Upload & Preview */}
        {activeTab === 'upload' && (
          <div className="mt-4 space-y-4">
            {/* Template Download Banner */}
            <div className="p-4 rounded-2xl bg-[#0B1418] border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-white block">
                  Ainda não tem a planilha preenchida?
                </span>
                <span className="text-[11px] text-slate-400">
                  Baixe o modelo com colunas formatadas e exemplos para preencher no Excel:
                </span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={downloadMaterialsExcelTemplate}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar Modelo (.xlsx)</span>
                </button>
                <button
                  type="button"
                  onClick={downloadMaterialsCSVTemplate}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-xl text-xs font-semibold transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Modelo (.csv)</span>
                </button>
              </div>
            </div>

            {/* Hidden Input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              className="hidden"
            />

            {/* Drop / Select zone */}
            {!selectedFile ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-white/20 hover:border-emerald-500/50 rounded-2xl p-8 text-center cursor-pointer bg-white/[0.02] hover:bg-emerald-500/[0.03] transition-all group"
              >
                <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center group-hover:scale-105 transition-transform mb-3">
                  <Upload className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-white">
                  Clique para selecionar sua planilha Excel ou CSV
                </h4>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Suporta arquivos <strong className="text-slate-200">.xlsx, .xls</strong> e <strong className="text-slate-200">.csv</strong> gerados no Excel, Google Planilhas ou LibreOffice Calc.
                </p>
                <div className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                  <span>Reconhecimento inteligente de colunas ativado</span>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-[#0B1418] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">{selectedFile.name}</span>
                      <span className="text-[11px] text-slate-400">
                        {(selectedFile.size / 1024).toFixed(1)} KB •{' '}
                        {isParsing ? 'Processando linhas...' : `${parsedMaterials.length} materiais válidos`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold"
                    >
                      Trocar Arquivo
                    </button>
                    <button
                      onClick={handleResetFile}
                      className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-white/5"
                      title="Remover arquivo"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {isParsing && (
                  <div className="flex items-center gap-2 text-xs text-emerald-400 py-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Lendo dados e mapeando colunas do Excel...</span>
                  </div>
                )}
              </div>
            )}

            {/* Error alerts */}
            {parseErrors.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-rose-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Erro ao ler planilha:</span>
                </div>
                {parseErrors.map((err, i) => (
                  <p key={i} className="pl-5 text-slate-300">{err}</p>
                ))}
              </div>
            )}

            {/* Warnings */}
            {parseWarnings.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs">
                <span className="font-semibold block mb-0.5">Avisos do processamento:</span>
                <ul className="list-disc pl-4 space-y-0.5 text-slate-300">
                  {parseWarnings.slice(0, 3).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                  {parseWarnings.length > 3 && (
                    <li>... e mais {parseWarnings.length - 3} avisos secundários.</li>
                  )}
                </ul>
              </div>
            )}

            {/* Preview Table if items parsed */}
            {parsedMaterials.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Pré-visualização dos Materiais ({parsedMaterials.length} itens)</span>
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Mostrando os primeiros 5 de {parsedMaterials.length}
                  </span>
                </div>

                <div className="rounded-xl border border-white/10 overflow-hidden bg-[#0B1418]">
                  <div className="overflow-x-auto max-h-48">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-black/30 text-slate-400 text-[10px] uppercase font-bold border-b border-white/10">
                        <tr>
                          <th className="p-2.5 pl-3">Patrimônio</th>
                          <th className="p-2.5">Nome do Material</th>
                          <th className="p-2.5">Modalidade</th>
                          <th className="p-2.5 text-center">Total</th>
                          <th className="p-2.5 text-center">Disponível</th>
                          <th className="p-2.5">Estado</th>
                          <th className="p-2.5 pr-3">Local</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                        {parsedMaterials.slice(0, 5).map((m, idx) => (
                          <tr key={idx} className="hover:bg-white/[0.02]">
                            <td className="p-2.5 pl-3 text-emerald-400 font-semibold">{m.patrimonyNumber}</td>
                            <td className="p-2.5 text-white font-sans font-medium">{m.name}</td>
                            <td className="p-2.5 font-sans capitalize">{m.category}</td>
                            <td className="p-2.5 text-center font-bold text-slate-200">{m.totalQuantity}</td>
                            <td className="p-2.5 text-center text-emerald-300">{m.availableQuantity}</td>
                            <td className="p-2.5 font-sans capitalize">{m.conservationState}</td>
                            <td className="p-2.5 pr-3 font-sans truncate max-w-xs">{m.storageLocation}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Import Mode Selection */}
                <div className="p-3.5 rounded-2xl bg-[#0B1418] border border-white/10 space-y-2">
                  <span className="text-xs font-bold text-white block">
                    Modo de Inclusão no Sistema:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <label
                      onClick={() => setImportMode('add')}
                      className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                        importMode === 'add'
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                          : 'bg-white/[0.02] border-white/10 text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'add'}
                        onChange={() => setImportMode('add')}
                        className="mt-0.5 text-emerald-500 focus:ring-emerald-500"
                      />
                      <div>
                        <span className="font-bold block text-white">Adicionar / Atualizar</span>
                        <span className="text-[11px] text-slate-400">
                          Mantém os {currentStockCount} materiais atuais e soma/cadastra os itens da planilha.
                        </span>
                      </div>
                    </label>

                    <label
                      onClick={() => setImportMode('replace')}
                      className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                        importMode === 'replace'
                          ? 'bg-rose-500/10 border-rose-500/40 text-rose-300'
                          : 'bg-white/[0.02] border-white/10 text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'replace'}
                        onChange={() => setImportMode('replace')}
                        className="mt-0.5 text-rose-500 focus:ring-rose-500"
                      />
                      <div>
                        <span className="font-bold block text-white">Substituir Todo o Estoque</span>
                        <span className="text-[11px] text-slate-400">
                          Substitui os {currentStockCount} itens atuais exclusivamente por esta nova planilha.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Guide & Structure */}
        {activeTab === 'guide' && (
          <div className="mt-4 space-y-4">
            <div className="p-4 rounded-2xl bg-[#0B1418] border border-white/10 text-xs text-slate-300 space-y-3">
              <h4 className="font-bold text-white text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>Colunas Suportadas no Modelo de Importação</span>
              </h4>
              <p className="leading-relaxed">
                O SIGEF aceita planilhas no formato <strong>.xlsx (Excel)</strong>, <strong>.xls</strong> ou <strong>.csv</strong>. O importador mapeia automaticamente os nomes das colunas com flexibilidade para acentos e maiúsculas.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                  <span className="font-bold text-emerald-300 block">Nome do Material (*)</span>
                  <span className="text-[11px] text-slate-400">Único campo estritamente obrigatório. Ex: &quot;Bola de Futsal Penalty Max&quot;.</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                  <span className="font-bold text-emerald-300 block">Nº de Patrimônio / Tombo</span>
                  <span className="text-[11px] text-slate-400">Código de tombo. Se omitido, o sistema gera &quot;PAT-2026-XXXX&quot; automaticamente.</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                  <span className="font-bold text-emerald-300 block">Categoria / Modalidade</span>
                  <span className="text-[11px] text-slate-400">volei, futsal, futebol, basquete, handebol, atletismo, lutas, danca, musculacao, recreacao.</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                  <span className="font-bold text-emerald-300 block">Quantidade Total & Disponível</span>
                  <span className="text-[11px] text-slate-400">Número inteiro maior que zero. Se disponível for omitido, assume o total.</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                  <span className="font-bold text-emerald-300 block">Estado de Conservação</span>
                  <span className="text-[11px] text-slate-400">Opções: novo, bom, regular, danificado, baixado (padrão: bom).</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                  <span className="font-bold text-emerald-300 block">Local de Guarda & Descrição</span>
                  <span className="text-[11px] text-slate-400">Armário, almoxarifado, prateleira e detalhes técnicos adicionais.</span>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={downloadMaterialsExcelTemplate}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs transition-colors shadow-md"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar Planilha Modelo Oficial (.xlsx)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('upload')}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-white/5 hover:bg-white/10 text-slate-200 font-semibold rounded-xl text-xs border border-white/10 transition-colors"
                >
                  <span>Voltar para Enviar Planilha</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={handleCancelar}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
          >
            Cancelar
          </button>

          {parsedMaterials.length > 0 && activeTab === 'upload' && (
            <button
              type="button"
              onClick={handleConfirmImport}
              className="flex items-center gap-1.5 px-5 py-2 bg-[#1B8A4B] hover:bg-[#22A55B] text-white text-xs font-semibold rounded-xl shadow-md shadow-emerald-950/40 transition-all active:scale-[0.98]"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {importMode === 'replace'
                  ? `Substituir por ${parsedMaterials.length} Materiais`
                  : `Cadastrar ${parsedMaterials.length} Materiais`}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
