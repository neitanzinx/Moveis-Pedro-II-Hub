import { CAMPOS_ESTOQUE_LOJA, LOJAS_MOSTRUARIO } from "@/constants/productConstants";

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

    const normalized = lojaNome.trim().toLowerCase();

    // Direct match by LOJAS_MOSTRUARIO name
    const loja = LOJAS_MOSTRUARIO.find(
        (l) => l.nome.toLowerCase() === normalized
    );
    if (loja) return CAMPOS_ESTOQUE_LOJA[loja.id] || null;

    // Common aliases
    const aliases = {
        "cd": "cd",
        "depósito / cd": "cd",
        "deposito / cd": "cd",
        "centro de distribuição": "cd",
        "centro": "centro",
        "loja centro": "centro",
        "mega store": "mega_store",
        "megastore": "mega_store",
        "ponte branca": "ponte_branca",
        "loja ponte branca": "ponte_branca",
        "futura": "futura",
        "loja futura": "futura",
    };

    const lojaId = aliases[normalized];
    if (lojaId) return CAMPOS_ESTOQUE_LOJA[lojaId] || null;

    // Fallback: try matching by loja id directly
    if (CAMPOS_ESTOQUE_LOJA[normalized]) return CAMPOS_ESTOQUE_LOJA[normalized];

    return null;
}

/**
 * Resolves the LOJAS_MOSTRUARIO id from a human-readable store name.
 * @param {string} lojaNome
 * @returns {string|null} The loja id (e.g. "centro", "cd"), or null
 */
export function resolveLojaId(lojaNome) {
    if (!lojaNome) return null;

    const normalized = lojaNome.trim().toLowerCase();

    const loja = LOJAS_MOSTRUARIO.find(
        (l) => l.nome.toLowerCase() === normalized
    );
    if (loja) return loja.id;

    const aliases = {
        "cd": "cd",
        "depósito / cd": "cd",
        "deposito / cd": "cd",
        "centro de distribuição": "cd",
        "centro": "centro",
        "loja centro": "centro",
        "mega store": "mega_store",
        "megastore": "mega_store",
        "ponte branca": "ponte_branca",
        "loja ponte branca": "ponte_branca",
        "futura": "futura",
        "loja futura": "futura",
    };

    return aliases[normalized] || null;
}
