import { describe, it, expect } from 'vitest';
import {
  normalizeCategory,
  normalizeConservationState,
  validateSpreadsheetFile,
  MAX_SPREADSHEET_BYTES,
} from '../excelMaterials';

describe('normalizeCategory', () => {
  it('ignora acentos e maiúsculas', () => {
    expect(normalizeCategory('Vôlei')).toBe('volei');
    expect(normalizeCategory('FUTSAL')).toBe('futsal');
    expect(normalizeCategory('Basquetebol')).toBe('basquete');
  });
  it('usa recreação como padrão', () => {
    expect(normalizeCategory(undefined)).toBe('recreacao');
    expect(normalizeCategory('')).toBe('recreacao');
  });
});

describe('normalizeConservationState', () => {
  it('reconhece estados comuns', () => {
    expect(normalizeConservationState('Novo')).toBe('novo');
    expect(normalizeConservationState('Ótimo')).toBe('bom');
    expect(normalizeConservationState('Regular')).toBe('regular');
    expect(normalizeConservationState('Quebrado')).toBe('danificado');
  });
  it('usa "bom" como padrão', () => {
    expect(normalizeConservationState(undefined)).toBe('bom');
  });
});

describe('validateSpreadsheetFile', () => {
  it('aceita xlsx, xls e csv', () => {
    for (const n of ['a.xlsx', 'a.XLS', 'a.csv']) {
      expect(validateSpreadsheetFile({ name: n, size: 100 })).toBeNull();
    }
  });
  it('rejeita extensão inválida, vazio e grande demais', () => {
    expect(validateSpreadsheetFile({ name: 'a.exe', size: 100 })).not.toBeNull();
    expect(validateSpreadsheetFile({ name: 'a.xlsx', size: 0 })).not.toBeNull();
    expect(
      validateSpreadsheetFile({ name: 'a.xlsx', size: MAX_SPREADSHEET_BYTES + 1 }),
    ).not.toBeNull();
  });
});
