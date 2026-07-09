import { describe, it, expect } from 'vitest';

// Simulação das duas regras de negócio:
// 1. Módulos tradicionais (isModuleActive): ausente = ATIVADO (padrão)
// 2. Módulos pagos (isPaidModuleActive): ausente = DESATIVADO (fail-safe)

const isModuleActive = (settings, moduleName) => {
  if (!settings?.modulos_ativos) return true; // padrão: ativo
  return settings.modulos_ativos[moduleName] !== false;
};

const isPaidModuleActive = (settings, moduleName) => {
  if (!settings?.modulos_ativos) return false; // sem settings = desativado
  return settings.modulos_ativos[moduleName] === true;
};

describe('Module activation strategies (Standard vs Paid)', () => {
  describe('Standard Modules (isModuleActive) - Absent equals ENABLED', () => {
    it('should return true when modulos_ativos is undefined or null', () => {
      expect(isModuleActive(null, 'montagem')).toBe(true);
      expect(isModuleActive(undefined, 'montagem')).toBe(true);
    });

    it('should return true when the key is absent in modulos_ativos', () => {
      expect(isModuleActive({ modulos_ativos: {} }, 'montagem')).toBe(true);
    });

    it('should return true when explicitly set to true', () => {
      expect(isModuleActive({ modulos_ativos: { montagem: true } }, 'montagem')).toBe(true);
    });

    it('should return false when explicitly set to false', () => {
      expect(isModuleActive({ modulos_ativos: { montagem: false } }, 'montagem')).toBe(false);
    });
  });

  describe('Paid Modules (isPaidModuleActive) - Absent equals DISABLED (Fail-Safe)', () => {
    it('should return false when modulos_ativos is undefined or null', () => {
      expect(isPaidModuleActive(null, 'whatsapp')).toBe(false);
      expect(isPaidModuleActive(undefined, 'whatsapp')).toBe(false);
    });

    it('should return false when the key is absent in modulos_ativos', () => {
      expect(isPaidModuleActive({ modulos_ativos: {} }, 'whatsapp')).toBe(false);
      expect(isPaidModuleActive({ modulos_ativos: { montagem: true } }, 'whatsapp')).toBe(false);
    });

    it('should return true when explicitly set to true', () => {
      expect(isPaidModuleActive({ modulos_ativos: { whatsapp: true } }, 'whatsapp')).toBe(true);
    });

    it('should return false when explicitly set to false', () => {
      expect(isPaidModuleActive({ modulos_ativos: { whatsapp: false } }, 'whatsapp')).toBe(false);
    });
  });
});
