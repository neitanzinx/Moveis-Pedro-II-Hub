// src/utils/markupCalculator.js

/**
 * Default margin targets per category (percentage as decimal).
 */
export function getMarginTarget(category) {
    const defaults = {
        Sofa: 0.30,
        Cama: 0.25,
        Mesa: 0.28,
        Cadeira: 0.27,
        Armario: 0.32,
        Estante: 0.30,
        Rack: 0.30,
        Poltrona: 0.30,
        Escrivaninha: 0.28,
        "Criado-mudo": 0.25,
        Buffet: 0.27,
        Aparador: 0.26,
        Banco: 0.24,
        Colchao: 0.30,
        "Guarda-roupa": 0.33,
        Comoda: 0.28,
        Painel: 0.30,
        Outros: 0.25,
    };
    return defaults[category] ?? 0.25;
}

/**
 * Supplier reliability factor. Placeholder logic: even IDs are trusted.
 */
export function getSupplierFactor(supplierId) {
    if (!supplierId) return 1.0;
    return supplierId % 2 === 0 ? 0.95 : 1.05;
}

/**
 * Adjusts margin based on stock levels (Scarcity vs Excess).
 */
export function getStockAdjustment(product) {
    const { quantidade_estoque = 0, estoque_minimo = 0 } = product;

    // If no minimum stock defined, assume neutral
    if (!estoque_minimo) return 1.0;

    const estoque = parseInt(quantidade_estoque);
    const min = parseInt(estoque_minimo);

    // Scarcity: Stock below minimum -> Increase price to slow sales/maximize profit
    if (estoque < min) {
        // Linear increase up to 10% when stock is near 0
        const shortageRatio = (min - estoque) / min; // 0 to 1
        return 1.0 + Math.min(shortageRatio * 0.10, 0.10);
    }

    // Excess: Stock way above minimum (> 3x) -> Decrease price to clear inventory
    if (estoque > min * 3) {
        // Small discount of 5% to encourage sales
        return 0.95;
    }

    // Normal stock levels
    return 1.0;
}

/**
 * Simplified tax rate (e.g., ICMS 18%).
 */
export function getTaxRate(_product) {
    return 0.18;
}

/**
 * Main function to calculate suggested selling price.
 */
export function calculateSuggestedMarkup(product) {
    const custo = parseFloat(product.preco_custo || 0);
    if (custo <= 0) return 0;

    const multiplierFromProduct = parseFloat(product.markup_multiplicador || 0);
    if (multiplierFromProduct > 0) {
        return Math.round(custo * multiplierFromProduct * 100) / 100;
    }

    const percentFromProduct = parseFloat(product.markup_percentual || 0);
    if (percentFromProduct > 0) {
        return Math.round(custo * (1 + (percentFromProduct / 100)) * 100) / 100;
    }

    const categoria = product.categoria;

    // 1. Base margin target
    const margemAlvo = getMarginTarget(categoria);
    let markup = custo * (1 + margemAlvo);

    // 2. Stock/Market Adjustment
    // Replaced "DemandFactor" with more specific StockAdjustment
    markup *= getStockAdjustment(product);

    // 3. Tax
    markup *= 1 + getTaxRate(product);

    // 4. Round to two decimals
    return Math.round(markup * 100) / 100;
}

/**
 * Returns detailed breakdown of markup calculation for transparency.
 */
export function calculateMarkupDetails(product) {
    const custo = parseFloat(product.preco_custo || 0);
    if (custo <= 0) {
        return null;
    }

    const multiplierFromProduct = parseFloat(product.markup_multiplicador || 0);
    if (multiplierFromProduct > 0) {
        const precoFinalMultiplicador = custo * multiplierFromProduct;
        return {
            custo,
            categoria: product.categoria || 'Outros',
            steps: [
                {
                    label: 'Markup Definido',
                    factor: `${multiplierFromProduct.toFixed(2)}x`,
                    value: Math.round(precoFinalMultiplicador * 100) / 100,
                    description: `R$ ${custo.toFixed(2)} × ${multiplierFromProduct.toFixed(2)}`
                }
            ],
            precoFinal: Math.round(precoFinalMultiplicador * 100) / 100
        };
    }

    const percentFromProduct = parseFloat(product.markup_percentual || 0);
    if (percentFromProduct > 0) {
        const multiplier = 1 + (percentFromProduct / 100);
        const precoFinalPercentual = custo * multiplier;
        return {
            custo,
            categoria: product.categoria || 'Outros',
            steps: [
                {
                    label: 'Markup Definido',
                    factor: `+${percentFromProduct.toFixed(2)}%`,
                    value: Math.round(precoFinalPercentual * 100) / 100,
                    description: `R$ ${custo.toFixed(2)} × ${multiplier.toFixed(4)}`
                }
            ],
            precoFinal: Math.round(precoFinalPercentual * 100) / 100
        };
    }

    const categoria = product.categoria || 'Outros';

    // Step 1: Base margin
    const margemAlvo = getMarginTarget(categoria);
    const margemPercent = Math.round(margemAlvo * 100);
    const precoComMargem = custo * (1 + margemAlvo);

    // Step 2: Stock Adjustment
    const stockFactor = getStockAdjustment(product);
    let stockLabel = 'Estoque Normal';
    let stockFactorLabel = '0%';

    if (stockFactor > 1) {
        stockLabel = 'Escassez (Baixo Estoque)';
        stockFactorLabel = `+${Math.round((stockFactor - 1) * 100)}%`;
    } else if (stockFactor < 1) {
        stockLabel = 'Excesso de Estoque';
        stockFactorLabel = `${Math.round((stockFactor - 1) * 100)}%`;
    }

    const precoComEstoque = precoComMargem * stockFactor;

    // Step 3: Tax
    const taxRate = getTaxRate(product);
    const taxPercent = Math.round(taxRate * 100);
    const precoFinal = precoComEstoque * (1 + taxRate);

    return {
        custo,
        categoria,
        steps: [
            {
                label: `Margem ${categoria}`,
                factor: `+${margemPercent}%`,
                value: Math.round(precoComMargem * 100) / 100,
                description: `R$ ${custo.toFixed(2)} × ${(1 + margemAlvo).toFixed(2)}`
            },
            {
                label: stockLabel,
                factor: stockFactorLabel,
                value: Math.round(precoComEstoque * 100) / 100,
                description: stockFactor === 1 ? 'Sem ajuste' : (stockFactor > 1 ? 'Aumento por escassez' : 'Desconto por excesso')
            },
            {
                label: `Impostos (Estimado)`,
                factor: `+${taxPercent}%`,
                value: Math.round(precoFinal * 100) / 100,
                description: `ICMS ~${taxPercent}%`
            }
        ],
        precoFinal: Math.round(precoFinal * 100) / 100
    };
}

/**
 * Normaliza um valor percentual para fração decimal.
 * - Se contém "%" no texto original, o parseFloat já ignora, mas o valor inteiro (ex: 10) precisa ser dividido por 100.
 * - Valores > 1 são tratados como percentuais inteiros (ex: 10 → 0.10, 12 → 0.12).
 * - Valores <= 1 são tratados como já em fração decimal (ex: 0.10 → 0.10).
 */
function normalizePercent(val) {
    const num = parseFloat(val || 0);
    if (isNaN(num)) return 0;
    return num > 1 ? num / 100 : num;
}

export function toPercentFromMultiplier(multiplier) {
    const numericMultiplier = parseFloat(multiplier || 0);
    if (!numericMultiplier || numericMultiplier <= 0) return 0;
    return Math.round((numericMultiplier - 1) * 10000) / 100;
}

export function toMultiplierFromPercent(percent) {
    const numericPercent = parseFloat(percent || 0);
    if (isNaN(numericPercent)) return 1;
    return Math.round((1 + (numericPercent / 100)) * 10000) / 10000;
}

export function calculateFinalPriceFromMarkup(custo, markupMultiplicador, markupPercentual) {
    const custoNumerico = parseFloat(custo || 0);
    if (custoNumerico <= 0) return 0;

    const multiplicador = parseFloat(markupMultiplicador || 0);
    if (multiplicador > 0) {
        return Math.round(custoNumerico * multiplicador * 100) / 100;
    }

    const percentual = parseFloat(markupPercentual || 0);
    if (percentual > 0) {
        return Math.round(custoNumerico * (1 + (percentual / 100)) * 100) / 100;
    }

    return 0;
}

/**
 * Calcula o preço final de venda usando a fórmula da planilha:
 * =ARREDONDAR.PARA.CIMA(custo × (1+frete%) × (1+IPI%) × (1+grupo%) × markup, 0)
 *
 * - Frete, IPI e Grupo são percentuais (10,00% = 0.10)
 * - Markup é multiplicador direto (ex: 2.70)
 *
 * @param {Object} produto - Dados do produto com campos de custeio
 * @returns {number} Preço final arredondado para cima (inteiro)
 */
export function calcularPrecoFinalImportacao(produto) {
    const custo = parseFloat(produto.preco_custo || 0);
    if (custo <= 0) return 0;

    const frete = normalizePercent(produto.frete_custo);
    const ipi = normalizePercent(produto.ipi_percentual);

    // Usa o grupo de markup ativo (prioridade: grupo preenchido)
    const grupoVal = produto.markup_grupo2_montagem ||
        produto.markup_grupo1_prontos ||
        produto.markup_grupo3_lustre || 0;
    const grupo = normalizePercent(grupoVal);

    // Markup é multiplicador direto (ex: 2.70)
    const markup = parseFloat(produto.markup_aplicado || 0);
    if (markup <= 0) return 0;

    const resultado = custo * (1 + frete) * (1 + ipi) * (1 + grupo) * markup;
    return Math.ceil(resultado); // ARREDONDAR.PARA.CIMA(..., 0)
}

