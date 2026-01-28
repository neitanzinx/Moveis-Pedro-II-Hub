/**
 * Serviço de Sugestão de NCM via IA Gemini
 * 
 * Consulta a Edge Function suggest-ncm para obter códigos NCM
 * sugeridos para produtos importados.
 */

import { supabase } from '@/lib/supabase';

// Mapa de fallback local (usado quando Edge Function falha completamente)
const NCM_FALLBACK_LOCAL = {
    "Sofás": "9401.61.00",
    "Sofá": "9401.61.00",
    "Estofados": "9401.61.00",
    "Poltronas": "9401.61.00",
    "Mesas": "9403.60.00",
    "Mesa": "9403.60.00",
    "Cadeiras": "9401.71.00",
    "Cadeira": "9401.71.00",
    "Racks": "9403.60.00",
    "Rack": "9403.60.00",
    "Painéis": "9403.60.00",
    "Camas": "9403.50.00",
    "Cama": "9403.50.00",
    "Colchões": "9404.21.00",
    "Colchão": "9404.21.00",
    "Guarda-Roupas": "9403.50.00",
    "Armários": "9403.60.00",
    "Cômodas": "9403.50.00",
    "Estantes": "9403.60.00",
    "Buffets": "9403.60.00",
};

/**
 * Busca NCM de fallback local baseado na categoria ou nome
 */
function getLocalFallback(nome, categoria) {
    // Tentar categoria
    const catKey = Object.keys(NCM_FALLBACK_LOCAL).find(
        key => categoria?.toLowerCase().includes(key.toLowerCase())
    );
    if (catKey) return NCM_FALLBACK_LOCAL[catKey];

    // Tentar nome
    const nomeKey = Object.keys(NCM_FALLBACK_LOCAL).find(
        key => nome?.toLowerCase().includes(key.toLowerCase())
    );
    if (nomeKey) return NCM_FALLBACK_LOCAL[nomeKey];

    // Default
    return "9403.60.00";
}

/**
 * Sugere NCMs para uma lista de produtos usando IA Gemini
 * 
 * @param {Array<{nome: string, categoria: string}>} produtos - Lista de produtos
 * @param {Function} onProgress - Callback para atualizar progresso (opcional)
 * @returns {Promise<{success: boolean, sugestoes: Array, erros?: Array}>}
 */
export async function sugerirNCMsComIA(produtos, onProgress = null) {
    if (!produtos || produtos.length === 0) {
        return { success: false, sugestoes: [], erros: ["Nenhum produto fornecido"] };
    }

    try {
        // Preparar payload
        const payload = produtos.map(p => ({
            nome: p.nome || p.MODELO || '',
            categoria: p.categoria || 'Móveis'
        }));

        if (onProgress) onProgress(0, produtos.length, "Conectando à IA...");

        // Chamar Edge Function
        const { data, error } = await supabase.functions.invoke('suggest-ncm', {
            body: { produtos: payload }
        });

        if (error) {
            console.error('Erro na Edge Function:', error);
            throw new Error(error.message || 'Erro ao conectar com IA');
        }

        if (!data.success) {
            throw new Error(data.error || 'Resposta inválida da IA');
        }

        if (onProgress) onProgress(produtos.length, produtos.length, "Concluído!");

        return {
            success: true,
            sugestoes: data.sugestoes,
            erros: data.erros,
            stats: {
                total: data.total,
                gemini: data.gemini,
                fallback: data.fallback
            }
        };

    } catch (error) {
        console.error('Erro ao sugerir NCMs:', error);

        // Fallback local: gerar sugestões sem IA
        const sugestoesLocais = produtos.map(p => ({
            nome: p.nome || p.MODELO || '',
            ncm: getLocalFallback(p.nome || p.MODELO, p.categoria),
            descricao: "NCM padrão da categoria (IA offline)",
            confianca: 0.3,
            fonte: "fallback"
        }));

        return {
            success: true,
            sugestoes: sugestoesLocais,
            erros: [`IA indisponível: ${error.message}. Usando fallback local.`],
            stats: {
                total: sugestoesLocais.length,
                gemini: 0,
                fallback: sugestoesLocais.length
            }
        };
    }
}

/**
 * Aplica sugestões de NCM a uma lista de produtos processados
 * 
 * @param {Array} produtos - Lista de produtos do CSV processado
 * @param {Array} sugestoes - Sugestões retornadas pela IA
 * @returns {Array} Produtos com NCM aplicado e marcação de fonte
 */
export function aplicarSugestoesNCM(produtos, sugestoes) {
    if (!sugestoes || sugestoes.length === 0) return produtos;

    return produtos.map((produto, index) => {
        const sugestao = sugestoes[index];
        if (!sugestao) return produto;

        return {
            ...produto,
            ncm: sugestao.ncm,
            ncm_descricao: sugestao.descricao,
            ncm_confianca: sugestao.confianca,
            ncm_fonte: sugestao.fonte, // 'gemini' ou 'fallback'
        };
    });
}

/**
 * Verifica se um NCM foi sugerido pela IA
 */
export function isNCMSugeridoPorIA(produto) {
    return produto?.ncm_fonte === 'gemini';
}

/**
 * Verifica se um NCM é de fallback
 */
export function isNCMFallback(produto) {
    return produto?.ncm_fonte === 'fallback';
}

export default {
    sugerirNCMsComIA,
    aplicarSugestoesNCM,
    isNCMSugeridoPorIA,
    isNCMFallback
};
