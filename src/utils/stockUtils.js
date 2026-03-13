import { obterCampoEstoqueDaLoja } from "@/constants/productConstants";

/**
 * Maps a human-readable store name (as used in Venda.loja, TransferenciaEstoque, etc.)
 * to the corresponding product database field name.
 *
 * Examples:
 *   "Centro"       → "estoque_mostruario_centro"
 *   "Mega Store"   → "estoque_mostruario_mega_store"
 *   "CD"           → "estoque_cd"
 *   "Ponte Branca" → "estoque_mostruario_ponte_branca"
 *   "Futura"       → "estoque_mostruario_futura"
 *   "Depósito / CD" → "estoque_cd"
 *
 * @param {string} lojaNome - The store name as displayed in the UI
 * @returns {string|null} The DB field name, or null if not found
 */
export function resolveStockField(lojaNome) {
    if (!lojaNome) return null;
    return obterCampoEstoqueDaLoja(lojaNome);
}

/**
 * Resolves the LOJAS_MOSTRUARIO id from a human-readable store name.
 * @param {string} lojaNome
 * @returns {string|null} The loja id (e.g. "centro", "cd"), or null
 */
export function resolveLojaId(lojaNome) {
    if (!lojaNome) return null;
    const field = obterCampoEstoqueDaLoja(lojaNome);
    if (field.startsWith('estoque_mostruario_')) return field.replace('estoque_mostruario_', '');
    if (field.startsWith('estoque_')) return field.replace('estoque_', '');
    return null;
}
