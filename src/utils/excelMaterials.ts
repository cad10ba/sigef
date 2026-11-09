import * as XLSX from 'xlsx';
import { Material, MaterialCategory, ConservationState } from '../types/sigef';

// Canonical categories with user-friendly names
export const VALID_CATEGORIES: { key: MaterialCategory; label: string }[] = [
  { key: 'volei', label: 'Voleibol' },
  { key: 'futsal', label: 'Futsal' },
  { key: 'futebol', label: 'Futebol' },
  { key: 'basquete', label: 'Basquetebol' },
  { key: 'handebol', label: 'Handebol' },
  { key: 'atletismo', label: 'Atletismo' },
  { key: 'lutas', label: 'Lutas & Artes Marciais' },
  { key: 'danca', label: 'Dança & Ginástica' },
  { key: 'musculacao', label: 'Musculação' },
  { key: 'recreacao', label: 'Recreação & Geral' },
];

export const VALID_STATES: { key: ConservationState; label: string }[] = [
  { key: 'novo', label: 'Novo' },
  { key: 'bom', label: 'Bom' },
  { key: 'regular', label: 'Regular' },
  { key: 'danificado', label: 'Danificado' },
  { key: 'baixado', label: 'Baixado' },
];

// Normalize category string from spreadsheet
export function normalizeCategory(input?: string): MaterialCategory {
  if (!input) return 'recreacao';
  const clean = input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  if (clean.includes('volei') || clean.includes('vol')) return 'volei';
  if (clean.includes('futsal') || clean.includes('salao')) return 'futsal';
  if (clean.includes('futebol') || clean.includes('campo') || clean.includes('society')) return 'futebol';
  if (clean.includes('basquete') || clean.includes('basket')) return 'basquete';
  if (clean.includes('hand') || clean.includes('handebol') || clean.includes('handball')) return 'handebol';
  if (clean.includes('atlet') || clean.includes('corrida') || clean.includes('salto')) return 'atletismo';
  if (clean.includes('luta') || clean.includes('judo') || clean.includes('karate') || clean.includes('tatame'))
    return 'lutas';
  if (clean.includes('danc') || clean.includes('dança') || clean.includes('ginast') || clean.includes('ritm'))
    return 'danca';
  if (clean.includes('muscul') || clean.includes('peso') || clean.includes('halter') || clean.includes('academia'))
    return 'musculacao';

  return 'recreacao';
}

// Normalize conservation state
export function normalizeConservationState(input?: string): ConservationState {
  if (!input) return 'bom';
  const clean = input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  if (clean.includes('nov')) return 'novo';
  if (clean.includes('bom') || clean.includes('otim')) return 'bom';
  if (clean.includes('regul') || clean.includes('medio')) return 'regular';
  if (clean.includes('danif') || clean.includes('avari') || clean.includes('quebr') || clean.includes('ruim'))
    return 'danificado';
  if (clean.includes('baix') || clean.includes('descart') || clean.includes('inserv')) return 'baixado';

  return 'bom';
}

// Sample template rows
const TEMPLATE_SAMPLE_ROWS = [
  {
    'Nº de Patrimônio': 'PAT-2026-001',
    'Nome do Material': 'Bola de Vôlei Penalty Pro 8.0',
    'Categoria': 'volei',
    'Quantidade Total': 12,
    'Quantidade Disponível': 12,
    'Estado': 'novo',
    'Local de Guarda': 'Almoxarifado COEF - Armário 01',
    'Estoque Mínimo': 3,
    'Descrição Técnica': 'Bola oficial de voleibol em microfibra, termotec, peso e medidas FIVB.',
  },
  {
    'Nº de Patrimônio': 'PAT-2026-002',
    'Nome do Material': 'Rede de Voleibol com Faixa Superior e Cabo de Aço',
    'Categoria': 'volei',
    'Quantidade Total': 3,
    'Quantidade Disponível': 3,
    'Estado': 'bom',
    'Local de Guarda': 'Almoxarifado COEF - Prateleira A',
    'Estoque Mínimo': 1,
    'Descrição Técnica': 'Rede em polietileno com 4 faixas brancas e cabo de aço galvanizado 4mm.',
  },
  {
    'Nº de Patrimônio': 'PAT-2026-003',
    'Nome do Material': 'Bola de Futsal Penalty Max 1000',
    'Categoria': 'futsal',
    'Quantidade Total': 10,
    'Quantidade Disponível': 8,
    'Estado': 'bom',
    'Local de Guarda': 'Almoxarifado COEF - Cesto de Bolas',
    'Estoque Mínimo': 2,
    'Descrição Técnica': 'Bola profissional de futsal com câmara 6D e dupla colagem.',
  },
  {
    'Nº de Patrimônio': 'PAT-2026-004',
    'Nome do Material': 'Colete de Treino Dupla Face (Verde/Amarelo)',
    'Categoria': 'recreacao',
    'Quantidade Total': 30,
    'Quantidade Disponível': 30,
    'Estado': 'bom',
    'Local de Guarda': 'Almoxarifado COEF - Gaveta de Coletes',
    'Estoque Mínimo': 10,
    'Descrição Técnica': 'Coletes em tecido dry fit 100% poliéster, elástico lateral reforçado.',
  },
  {
    'Nº de Patrimônio': 'PAT-2026-005',
    'Nome do Material': 'Cone de Agilidade Furado 50cm',
    'Categoria': 'atletismo',
    'Quantidade Total': 24,
    'Quantidade Disponível': 24,
    'Estado': 'novo',
    'Local de Guarda': 'Almoxarifado COEF - Prateleira C',
    'Estoque Mínimo': 6,
    'Descrição Técnica': 'Cone rígido para treinamento funcional e atletismo com suporte para barreiras.',
  },
  {
    'Nº de Patrimônio': 'PAT-2026-006',
    'Nome do Material': 'Bola de Basquete Spalding TF-1000 Classic nº 7',
    'Categoria': 'basquete',
    'Quantidade Total': 8,
    'Quantidade Disponível': 7,
    'Estado': 'bom',
    'Local de Guarda': 'Almoxarifado COEF - Cesto de Basquete',
    'Estoque Mínimo': 2,
    'Descrição Técnica': 'Bola para quadras internas com revestimento em microfibra ZK de alta aderência.',
  },
  {
    'Nº de Patrimônio': 'PAT-2026-007',
    'Nome do Material': 'Tatame em EVA 100x100x4cm c/ Encaixe',
    'Categoria': 'lutas',
    'Quantidade Total': 40,
    'Quantidade Disponível': 40,
    'Estado': 'bom',
    'Local de Guarda': 'Sala de Tatame / Depósito',
    'Estoque Mínimo': 10,
    'Descrição Técnica': 'Placas de tatame bicolor azul/vermelho com textura antiderrapante e absorção de impacto.',
  },
];

// Instructions sheet rows
const INSTRUCTIONS_ROWS = [
  { Campo: 'Nº de Patrimônio', Obrigatório: 'Não', Descrição: 'Código de tombo institucional. Se deixar em branco, o SIGEF gera um código automático (ex: PAT-2026-XXXX).' },
  { Campo: 'Nome do Material', Obrigatório: 'SIM', Descrição: 'Nome claro do item (Ex: Bola de Vôlei, Cone 50cm, Halter 5kg).' },
  { Campo: 'Categoria', Obrigatório: 'Não', Descrição: 'Opções válidas: volei, futsal, futebol, basquete, handebol, atletismo, lutas, danca, musculacao, recreacao.' },
  { Campo: 'Quantidade Total', Obrigatório: 'SIM', Descrição: 'Número total de unidades existentes no campus (número inteiro maior ou igual a 0).' },
  { Campo: 'Quantidade Disponível', Obrigatório: 'Não', Descrição: 'Quantidade disponível para empréstimo imediato. Se omitido, assume o total.' },
  { Campo: 'Estado', Obrigatório: 'Não', Descrição: 'Estado de conservação: novo, bom, regular, danificado, baixado (padrão: bom).' },
  { Campo: 'Local de Guarda', Obrigatório: 'Não', Descrição: 'Onde o material fica armazenado (Ex: Almoxarifado COEF, Armário 02, Sala de Tatame).' },
  { Campo: 'Estoque Mínimo', Obrigatório: 'Não', Descrição: 'Quantidade mínima para disparar alerta de reposição (padrão: 2).' },
  { Campo: 'Descrição Técnica', Obrigatório: 'Não', Descrição: 'Detalhes, marca, dimensões e observações técnicas do item.' },
];

/**
 * Downloads the official Excel (.xlsx) template for registering materials
 */
export function downloadMaterialsExcelTemplate(): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Model
  const wsModel = XLSX.utils.json_to_sheet(TEMPLATE_SAMPLE_ROWS);
  wsModel['!cols'] = [
    { wch: 18 }, // Patrimônio
    { wch: 45 }, // Nome
    { wch: 14 }, // Categoria
    { wch: 16 }, // Qtd Total
    { wch: 20 }, // Qtd Disponível
    { wch: 12 }, // Estado
    { wch: 32 }, // Local
    { wch: 15 }, // Estoque Min
    { wch: 55 }, // Descrição
  ];
  XLSX.utils.book_append_sheet(wb, wsModel, 'Modelo de Materiais');

  // Sheet 2: Instructions & Categories
  const wsInstructions = XLSX.utils.json_to_sheet(INSTRUCTIONS_ROWS);
  wsInstructions['!cols'] = [
    { wch: 24 },
    { wch: 14 },
    { wch: 75 },
  ];
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instruções de Preenchimento');

  // Write file
  XLSX.writeFile(wb, `modelo_cadastro_materiais_sigef_${new Date().getFullYear()}.xlsx`);
}

/**
 * Downloads the official CSV template
 */
export function downloadMaterialsCSVTemplate(): void {
  const headers = [
    'Nº de Patrimônio',
    'Nome do Material',
    'Categoria',
    'Quantidade Total',
    'Quantidade Disponível',
    'Estado',
    'Local de Guarda',
    'Estoque Mínimo',
    'Descrição Técnica',
  ];

  const rows = TEMPLATE_SAMPLE_ROWS.map((r) => [
    `"${r['Nº de Patrimônio']}"`,
    `"${r['Nome do Material']}"`,
    `"${r['Categoria']}"`,
    r['Quantidade Total'],
    r['Quantidade Disponível'],
    `"${r['Estado']}"`,
    `"${r['Local de Guarda']}"`,
    r['Estoque Mínimo'],
    `"${r['Descrição Técnica']}"`,
  ]);

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((row) => row.join(';'))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `modelo_cadastro_materiais_sigef_${new Date().getFullYear()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exports current inventory to an Excel (.xlsx) spreadsheet
 */
export function exportMaterialsToExcel(materials: Material[], campusName = 'Campus IF'): void {
  const rows = materials.map((m) => {
    const catObj = VALID_CATEGORIES.find((c) => c.key === m.category);
    const stateObj = VALID_STATES.find((s) => s.key === m.conservationState);
    return {
      'Nº de Patrimônio': m.patrimonyNumber,
      'Nome do Material': m.name,
      'Categoria / Modalidade': catObj ? catObj.label : m.category,
      'Qtd Total': m.totalQuantity,
      'Qtd Disponível': m.availableQuantity,
      'Emprestados / Em Uso': Math.max(0, m.totalQuantity - m.availableQuantity),
      'Estado de Conservação': stateObj ? stateObj.label : m.conservationState,
      'Local de Guarda': m.storageLocation,
      'Alerta Estoque Mínimo': m.minStockAlert,
      'Status Estoque': m.availableQuantity <= 0 ? 'Zerado' : m.availableQuantity <= m.minStockAlert ? 'Crítico' : 'Normal',
      'Descrição Técnica': m.technicalDescription,
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  ws['!cols'] = [
    { wch: 18 },
    { wch: 40 },
    { wch: 22 },
    { wch: 12 },
    { wch: 14 },
    { wch: 20 },
    { wch: 22 },
    { wch: 30 },
    { wch: 20 },
    { wch: 14 },
    { wch: 50 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Inventário SIGEF');

  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `inventario_materiais_sigef_${dateStr}.xlsx`);
}

/**
 * Parses any uploaded spreadsheet file (Excel .xlsx, .xls or CSV) into structured Material objects
 */
export async function parseMaterialsSpreadsheet(
  file: File
): Promise<{
  success: boolean;
  materials: Material[];
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const materials: Material[] = [];

  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return { success: false, materials: [], errors: ['A planilha está vazia ou não contém abas válidas.'], warnings };
    }

    // Read the first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    if (!rawRows || rawRows.length === 0) {
      return {
        success: false,
        materials: [],
        errors: ['Nenhum dado encontrado na primeira aba da planilha. Verifique se há cabeçalhos e linhas preenchidas.'],
        warnings,
      };
    }

    const timestamp = Date.now();

    rawRows.forEach((row, idx) => {
      const rowNum = idx + 2; // considering 1-based + 1 for header

      // Find fields matching known headers
      const getVal = (...keys: string[]): any => {
        for (const k of keys) {
          // direct match
          if (row[k] !== undefined && row[k] !== '') return row[k];
          // case and accent insensitive match
          const foundKey = Object.keys(row).find((rk) => {
            const cleanRk = rk.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
            const cleanK = k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
            return cleanRk === cleanK || cleanRk.includes(cleanK);
          });
          if (foundKey && row[foundKey] !== undefined && row[foundKey] !== '') {
            return row[foundKey];
          }
        }
        return '';
      };

      const rawName = getVal('Nome do Material', 'Nome', 'Material', 'Item', 'Descricao do Material', 'name');
      const name = String(rawName).trim();

      if (!name) {
        warnings.push(`Linha ${rowNum}: ignorada pois o campo 'Nome do Material' está em branco.`);
        return;
      }

      const rawPatrimony = getVal('Nº de Patrimônio', 'Patrimônio', 'Patrimonio', 'Tombo', 'Nº Tombo', 'Codigo', 'Código', 'patrimonyNumber');
      const patrimonyNumber =
        String(rawPatrimony).trim() ||
        `PAT-${new Date().getFullYear()}-${String(100 + idx + 1).padStart(4, '0')}`;

      const rawCategory = getVal('Categoria', 'Modalidade', 'Esporte', 'category');
      const category = normalizeCategory(String(rawCategory));

      const rawTotal = getVal('Quantidade Total', 'Qtd Total', 'Total', 'Quantidade', 'Qtd', 'totalQuantity');
      const parsedTotal = parseInt(String(rawTotal).replace(/[^\d]/g, ''), 10);
      const totalQuantity = isNaN(parsedTotal) || parsedTotal < 0 ? 1 : parsedTotal;

      const rawAvail = getVal('Quantidade Disponível', 'Qtd Disponível', 'Disponível', 'Disponivel', 'Qtd Disp', 'availableQuantity');
      let availableQuantity = parseInt(String(rawAvail).replace(/[^\d]/g, ''), 10);
      if (isNaN(availableQuantity)) {
        availableQuantity = totalQuantity;
      } else {
        availableQuantity = Math.min(totalQuantity, Math.max(0, availableQuantity));
      }

      const rawState = getVal('Estado', 'Estado de Conservação', 'Conservação', 'Conservacao', 'conservationState');
      const conservationState = normalizeConservationState(String(rawState));

      const rawLoc = getVal('Local de Guarda', 'Local', 'Almoxarifado', 'storageLocation');
      const storageLocation = String(rawLoc).trim() || 'Almoxarifado COEF';

      const rawMinStock = getVal('Estoque Mínimo', 'Estoque Minimo', 'Alerta Estoque Mínimo', 'minStockAlert');
      const parsedMin = parseInt(String(rawMinStock).replace(/[^\d]/g, ''), 10);
      const minStockAlert = isNaN(parsedMin) || parsedMin < 0 ? 2 : parsedMin;

      const rawDesc = getVal('Descrição Técnica', 'Descricao Tecnica', 'Descrição', 'Descricao', 'Observações', 'Observacoes', 'technicalDescription');
      const technicalDescription = String(rawDesc).trim() || `Material cadastrado via importação de planilha em ${new Date().toLocaleDateString('pt-BR')}.`;

      const materialItem: Material = {
        id: `mat-imp-${timestamp}-${idx + 1}`,
        patrimonyNumber,
        name,
        category,
        totalQuantity,
        availableQuantity,
        conservationState,
        storageLocation,
        minStockAlert,
        technicalDescription,
        history: [
          {
            id: `mov-imp-${timestamp}-${idx + 1}`,
            date: new Date().toISOString(),
            type: 'entrada',
            quantity: totalQuantity,
            reason: `Importação em lote de planilha (${file.name})`,
            responsible: 'Coordenação de Ed. Física',
          },
        ],
      };

      materials.push(materialItem);
    });

    if (materials.length === 0) {
      errors.push('Nenhum item válido pôde ser importado. Certifique-se de que a coluna com o nome do material está preenchida.');
      return { success: false, materials: [], errors, warnings };
    }

    return {
      success: true,
      materials,
      errors,
      warnings,
    };
  } catch (err: any) {
    return {
      success: false,
      materials: [],
      errors: [`Falha ao processar arquivo: ${err?.message || 'Arquivo corrompido ou formato inválido'}`],
      warnings,
    };
  }
}
