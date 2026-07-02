import { describe, it, expect } from 'vitest';
import { buildUniqueCodigoBarras } from './importProdutosUtils';

describe('buildUniqueCodigoBarras', () => {
  it('keeps the base code when it is still free', () => {
    const usedCodes = new Set(['other-code']);

    expect(buildUniqueCodigoBarras('ABC123', 1, usedCodes, new Set())).toBe('ABC123');
  });

  it('adds a line-based suffix when the base code already exists', () => {
    const usedCodes = new Set(['abc123']);

    expect(buildUniqueCodigoBarras('ABC123', 42, usedCodes, new Set())).toBe('ABC123-42');
  });

  it('keeps appending a suffix until it finds a free code', () => {
    const usedCodes = new Set(['abc123', 'abc123-42']);

    expect(buildUniqueCodigoBarras('ABC123', 42, usedCodes, new Set())).toBe('ABC123-42-2');
  });

  it('reuses the existing code on re-import so the same product is updated instead of duplicated', () => {
    const usedCodes = new Set();
    const existingCodes = new Set(['abc123']);

    expect(buildUniqueCodigoBarras('ABC123', 7, usedCodes, existingCodes)).toBe('ABC123');
  });
});
