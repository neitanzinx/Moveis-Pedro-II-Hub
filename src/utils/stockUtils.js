import { CAMPOS_ESTOQUE_LOJA, obterCampoEstoqueDaLoja } from "@/constants/productConstants";

const EXCLUDED_STOCK_FIELDS = new Set([
    'estoque_minimo',
    'estoque_ideal'
]);

/**
 * Maps a human-readable store name (as used in Venda.loja, TransferenciaEstoque, etc.)
 * to the corresponding product database field name.
 *
 * Examples:
 *   "Centro"       → "estoque_centro" (legacy field)
 *   "Mega Store"   → "estoque_mega_store" (legacy field)
 *   "CD"           → "estoque_cd"
 *   "Ponte Branca" → "estoque_ponte_branca" (legacy field)
 *   "Futura"       → "estoque_futura" (legacy field)
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
 * Resolves a store id slug from a human-readable store name.
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

/**
 * Lista os campos de estoque por unidade presentes em um produto.
 * Considera os campos fixos conhecidos e tambem campos dinamicos estoque_*.
 *
 * @param {Object} produto
 * @returns {string[]}
 */
export function getProductStockFields(produto) {
    if (!produto || typeof produto !== 'object') return [];

    const fixedFields = Object.values(CAMPOS_ESTOQUE_LOJA);
    const dynamicFields = Object.keys(produto).filter((key) => {
        if (!key.startsWith('estoque_')) return false;
        if (EXCLUDED_STOCK_FIELDS.has(key)) return false;
        if (key === 'estoque_cd') return true;
        if (key.startsWith('estoque_mostruario_')) return true;
        return produto[key] !== undefined && produto[key] !== null;
    });

    return Array.from(new Set([...fixedFields, ...dynamicFields])).filter((field) => field in produto);
}

/**
 * Soma o estoque agregado de um produto com base nos campos reais por unidade.
 *
 * @param {Object} produto
 * @returns {number}
 */
export function getProductTotalStock(produto) {
    return getProductStockFields(produto).reduce((total, field) => {
        return total + (Number(produto?.[field]) || 0);
    }, 0);
}
