import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/**
 * Normaliza string para busca: remove acentos, colapsa separadores (/ - _ |) em espaço
 * e converte para minúsculas. Permite busca accent-insensitive e separator-insensitive.
 * Exemplo: normSearch("freijó / chumbo") === normSearch("freijo/chumbo") === "freijo chumbo"
 */
export function normSearch(str) {
  if (str == null) return '';
  let normalized = String(str).toLowerCase();
  
  // Substituição manual explícita de acentos comuns para garantir flexibilidade
  // caso o normalize('NFD') falhe em alguns navegadores ou com certos caracteres
  normalized = normalized
    .replace(/[áàãâä]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[íìîï]/g, 'i')
    .replace(/[óòõôö]/g, 'o')
    .replace(/[úùûü]/g, 'u')
    .replace(/[ç]/g, 'c');

  normalized = normalized
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Remove separadores decimais entre números para facilitar busca (ex: 1.83 -> 183, 1,50 -> 150)
    .replace(/(\d)[.,](?=\d)/g, '$1')
    .replace(/[-/|_.,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Normalize feminine color adjectives to masculine to allow gender-insensitive search
  normalized = normalized
    .replace(/\bpreta\b/g, 'preto')
    .replace(/\bbranca\b/g, 'branco')
    .replace(/\bamarela\b/g, 'amarelo')
    .replace(/\bvermelha\b/g, 'vermelho')
    .replace(/\broxa\b/g, 'roxo')
    .replace(/\bcastanha\b/g, 'castanho')
    .replace(/\bclara\b/g, 'claro')
    .replace(/\bescura\b/g, 'escuro')
    .replace(/\bmadeirada\b/g, 'madeirado');

  return normalized;
} 

function normalizeComparableValue(value) {
  if (value === null || value === undefined) return null;
  return String(value).trim();
}

export function canAccessLojaId(lojaId, allowedLojaIds = []) {
  const normalizedLojaId = normalizeComparableValue(lojaId);
  if (!normalizedLojaId) return false;

  return allowedLojaIds
    .map(normalizeComparableValue)
    .filter(Boolean)
    .includes(normalizedLojaId);
}

export function filterDataByLoja(records, allowedLojaIds = [], options = {}) {
  if (!Array.isArray(records)) return [];

  const normalizedAllowedLojaIds = allowedLojaIds
    .map(normalizeComparableValue)
    .filter(Boolean);

  if (!normalizedAllowedLojaIds.length) {
    return [];
  }

  const lojaFields = options.lojaField
    ? [options.lojaField]
    : ['loja', 'loja_id', 'loja_nome', 'loja_venda', 'store'];

  const hasAnyLojaField = records.some((record) =>
    lojaFields.some((field) => normalizeComparableValue(record?.[field]))
  );

  if (!hasAnyLojaField) {
    return records;
  }

  return records.filter((record) =>
    lojaFields.some((field) => canAccessLojaId(record?.[field], normalizedAllowedLojaIds))
  );
}