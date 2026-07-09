import { describe, it, expect } from 'vitest';
import { isRastreioEnabled } from './deliveryConference';

describe('isRastreioEnabled', () => {
  it('returns true when the module is enabled by default', () => {
    expect(isRastreioEnabled()).toBe(true);
  });

  it('returns true when modulos_ativos.rastreio is not explicitly disabled', () => {
    expect(isRastreioEnabled({ modulos_ativos: {} })).toBe(true);
  });

  it('returns false when the module is disabled', () => {
    expect(isRastreioEnabled({ modulos_ativos: { rastreio: false } })).toBe(false);
  });
});
