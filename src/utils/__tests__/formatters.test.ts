import { describe, it, expect } from 'vitest';
import { calculateDelayDays } from '../formatters';

describe('calculateDelayDays', () => {
  it('retorna 0 antes do prazo', () => {
    expect(calculateDelayDays(new Date(Date.now() + 86_400_000).toISOString())).toBe(0);
  });
  it('conta dias de atraso arredondando para cima', () => {
    expect(calculateDelayDays(new Date(Date.now() - 36 * 3_600_000).toISOString())).toBe(2);
  });
});
