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
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-/|_.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
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