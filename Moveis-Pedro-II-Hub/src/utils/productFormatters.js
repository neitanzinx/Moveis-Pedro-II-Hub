/**
 * Funções utilitárias para formatação e validação de produtos
 * Garante padronização e evita duplicatas
 */

import { CORES_PADRAO } from '@/constants/productConstants';

/**
 * Normaliza o nome do produto
 * - Remove espaços extras
 * - Capitaliza primeira letra de cada palavra
 * - Remove caracteres especiais desnecessários
 */
export function normalizeProductName(name) {
    if (!name) return '';

    return name
        .trim()
        .replace(/\s+/g, ' ') // Remove espaços múltiplos
        .split(' ')
        .map(word => {
            // Palavras que devem ficar em minúsculo
            const minusculas = ['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'com', 'para', 'por'];
            const wordLower = word.toLowerCase();

            if (minusculas.includes(wordLower) && word.length <= 4) {
                return wordLower;
            }

            // Capitaliza primeira letra
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(' ')
        // Garante que a primeira palavra começa com maiúscula
        .replace(/^./, str => str.toUpperCase());
}

/**
 * Normaliza nome de cor
 * - Busca correspondência nas cores padrão
 * - Capitaliza corretamente
 */
export function normalizeColor(color) {
    if (!color) return '';

    const colorNormalized = color.trim().toLowerCase();

    // Busca correspondência exata nas cores padrão
    const corPadrao = CORES_PADRAO.find(
        c => c.nome.toLowerCase() === colorNormalized
    );

    if (corPadrao) {
        return corPadrao.nome;
    }

    // Se não encontrar, aplica capitalização padrão
    return color
        .trim()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

/**
 * Normaliza tamanho/dimensão
 * - Padroniza formato de medidas
 * - Converte vírgulas para pontos
 */
export function normalizeSize(size) {
    if (!size) return '';

    return size
        .trim()
        .replace(/,/g, '.') // Substitui vírgula por ponto
        .replace(/\s*x\s*/gi, ' x ') // Padroniza "x" com espaços
        .replace(/\s*X\s*/gi, ' x ') // Minúsculo
        .replace(/metros?/gi, 'm')
        .replace(/centímetros?|centimetros?|cm/gi, 'cm')
        .replace(/\s+/g, ' ');
}

/**
 * Gera SKU único para uma variação
 * Formato: CAT-NOME-COR-TAM (tudo em maiúsculo, sem acentos)
 */
export function generateSKU(produto, variacao = null) {
    const removeAcentos = (str) => {
        return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    };

    const toSKUPart = (str, maxLen = 8) => {
        if (!str) return '';
        return removeAcentos(str)
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '')
            .substring(0, maxLen);
    };

    const partes = [];

    // Categoria (3 primeiras letras)
    if (produto.categoria) {
        partes.push(toSKUPart(produto.categoria, 3));
    }

    // Nome (primeiras 6 letras)
    if (produto.nome) {
        partes.push(toSKUPart(produto.nome, 6));
    }

    // Variação: cor
    if (variacao?.cor) {
        partes.push(toSKUPart(variacao.cor, 4));
    }

    // Variação: tamanho
    if (variacao?.tamanho) {
        partes.push(toSKUPart(variacao.tamanho, 4));
    }

    // Adiciona número aleatório para unicidade
    const randomSuffix = Math.random().toString(36).substring(2, 5).toUpperCase();
    partes.push(randomSuffix);

    return partes.join('-');
}

/**
 * Calcula similaridade entre duas strings (algoritmo de Levenshtein normalizado)
 * Retorna valor entre 0 e 1 (1 = idêntico)
 */
export function calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;

    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    if (s1 === s2) return 1;

    const len1 = s1.length;
    const len2 = s2.length;

    // Matriz de distância
    const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null));

    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let j = 0; j <= len2; j++) matrix[j][0] = j;

    for (let j = 1; j <= len2; j++) {
        for (let i = 1; i <= len1; i++) {
            const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
            matrix[j][i] = Math.min(
                matrix[j][i - 1] + 1,      // inserção
                matrix[j - 1][i] + 1,      // deleção
                matrix[j - 1][i - 1] + cost // substituição
            );
        }
    }

    const distance = matrix[len2][len1];
    const maxLen = Math.max(len1, len2);

    return 1 - (distance / maxLen);
}

/**
 * Verifica se existe produto duplicado ou similar
 * Retorna array de possíveis duplicatas com score de similaridade
 */
export function checkDuplicateProduct(nomeProduto, produtosExistentes, threshold = 0.75) {
    if (!nomeProduto || !produtosExistentes?.length) return [];

    const nomeNormalizado = normalizeProductName(nomeProduto).toLowerCase();

    const duplicatas = produtosExistentes
        .map(produto => {
            const produtoNome = (produto.nome || '').toLowerCase();
            const similarity = calculateSimilarity(nomeNormalizado, produtoNome);

            return {
                produto,
                similarity,
                isExact: similarity === 1
            };
        })
        .filter(item => item.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity);

    return duplicatas;
}

/**
 * Formata preço para exibição (R$ 0.000,00)
 */
export function formatPrice(value) {
    if (value === null || value === undefined) return 'R$ 0,00';

    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

/**
 * Formata dimensões para exibição
 */
export function formatDimensions(largura, altura, profundidade) {
    const parts = [];

    if (largura) parts.push(`L: ${largura}cm`);
    if (altura) parts.push(`A: ${altura}cm`);
    if (profundidade) parts.push(`P: ${profundidade}cm`);

    return parts.join(' × ') || '-';
}

/**
 * Valida se o produto tem informações mínimas obrigatórias
 */
export function validateProduct(produto) {
    const errors = [];

    if (!produto.nome || produto.nome.trim().length < 3) {
        errors.push('Nome deve ter pelo menos 3 caracteres');
    }

    if (!produto.categoria) {
        errors.push('Categoria é obrigatória');
    }

    const precoVenda = parseFloat(produto.preco_venda);
    if (!precoVenda || precoVenda <= 0) {
        errors.push('Preço de venda deve ser maior que zero');
    }

    const precoCusto = parseFloat(produto.preco_custo);
    if (precoCusto && precoCusto > precoVenda) {
        errors.push('Preço de custo não pode ser maior que o de venda');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Valida variações do produto
 */
export function validateVariations(variacoes) {
    const errors = [];

    if (!variacoes || variacoes.length === 0) {
        return { isValid: true, errors: [] }; // Variações são opcionais
    }

    variacoes.forEach((variacao, index) => {
        if (!variacao.cor && !variacao.tamanho && !variacao.tecido) {
            errors.push(`Variação ${index + 1}: deve ter pelo menos cor, tamanho ou tecido`);
        }

        if (variacao.estoque !== undefined && variacao.estoque < 0) {
            errors.push(`Variação ${index + 1}: estoque não pode ser negativo`);
        }
    });

    // Verifica duplicatas de variação
    const variacoesKey = variacoes.map(v =>
        `${v.cor || ''}-${v.tamanho || ''}-${v.tecido || ''}`
    );

    const duplicadas = variacoesKey.filter((item, index) =>
        variacoesKey.indexOf(item) !== index
    );

    if (duplicadas.length > 0) {
        errors.push('Existem variações duplicadas');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Gera ID único para variação
 */
export function generateVariationId() {
    return `var-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Cria uma nova variação vazia
 */
export function createEmptyVariation() {
    return {
        id: generateVariationId(),
        sku: '',
        cor: '',
        tamanho: '',
        tecido: '',
        estoque: 0,
        preco_diferenciado: null,
        foto_url: ''
    };
}
