/**
 * Motor de Cálculos Trabalhistas Brasileiros (CLT)
 * Tabelas atualizadas para 2025
 * 
 * Cada função é pura — recebe parâmetros e retorna valor calculado.
 * Nenhum estado, nenhum side-effect.
 */

// ============================================================================
// CONSTANTES — Tabelas Oficiais 2025
// ============================================================================

export const SALARIO_MINIMO_2025 = 1518.00;

/** Tabela INSS 2025 — Faixas progressivas com parcela a deduzir */
export const TABELA_INSS_2025 = [
    { ate: 1518.00, aliquota: 0.075, deducao: 0 },
    { ate: 2793.88, aliquota: 0.09, deducao: 22.77 },
    { ate: 4190.83, aliquota: 0.12, deducao: 106.59 },
    { ate: 8157.41, aliquota: 0.14, deducao: 190.40 },
];

/** Tabela IRRF 2025 (a partir de maio 2025) */
export const TABELA_IRRF_2025 = [
    { ate: 2259.20, aliquota: 0, deducao: 0 },
    { ate: 2826.65, aliquota: 0.075, deducao: 169.44 },
    { ate: 3751.05, aliquota: 0.15, deducao: 381.44 },
    { ate: 4664.68, aliquota: 0.225, deducao: 662.77 },
    { ate: Infinity, aliquota: 0.275, deducao: 896.00 },
];

/** Dedução por dependente para IRRF */
export const DEDUCAO_DEPENDENTE_IRRF = 189.59;

/** Salário Família 2025 */
export const SALARIO_FAMILIA_VALOR = 62.04;
export const SALARIO_FAMILIA_TETO = 1819.26;

/** Percentuais fixos */
export const ALIQUOTA_FGTS = 0.08;
export const ALIQUOTA_VT_DESCONTO = 0.06;
export const ALIQUOTA_ADICIONAL_NOTURNO = 0.20;
export const ALIQUOTA_PERICULOSIDADE = 0.30;

/** Insalubridade — % sobre o salário mínimo */
export const INSALUBRIDADE_GRAUS = {
    minimo: 0.10,
    medio: 0.20,
    maximo: 0.40,
};

/** Hora extra */
export const ALIQUOTA_HORA_EXTRA_NORMAL = 0.50;   // 50% dia útil
export const ALIQUOTA_HORA_EXTRA_FERIADO = 1.00;  // 100% dom/feriado

// ============================================================================
// FUNÇÕES DE CÁLCULO
// ============================================================================

/**
 * INSS Progressivo (2025)
 * Usa parcela a deduzir para simplificar o cálculo por faixa.
 * 
 * @param {number} salarioBruto - Salário bruto (incluindo adicionais)
 * @returns {{ valor: number, aliquotaEfetiva: number, faixa: string }}
 */
export function calcularINSS(salarioBruto) {
    if (!salarioBruto || salarioBruto <= 0) {
        return { valor: 0, aliquotaEfetiva: 0, faixa: 'Isento' };
    }

    const teto = TABELA_INSS_2025[TABELA_INSS_2025.length - 1].ate;
    const base = Math.min(salarioBruto, teto);

    for (const faixa of TABELA_INSS_2025) {
        if (base <= faixa.ate) {
            const valor = Math.round((base * faixa.aliquota - faixa.deducao) * 100) / 100;
            const aliquotaEfetiva = base > 0 ? valor / base : 0;
            return {
                valor: Math.max(0, valor),
                aliquotaEfetiva,
                faixa: `${(faixa.aliquota * 100).toFixed(1)}%`
            };
        }
    }

    // Fallback (não deveria chegar aqui)
    const ultima = TABELA_INSS_2025[TABELA_INSS_2025.length - 1];
    const valor = Math.round((teto * ultima.aliquota - ultima.deducao) * 100) / 100;
    return { valor, aliquotaEfetiva: valor / base, faixa: `${(ultima.aliquota * 100).toFixed(1)}%` };
}

/**
 * IRRF — Imposto de Renda Retido na Fonte (2025)
 * Base = Salário Bruto - INSS - (Dependentes × R$189,59)
 * 
 * @param {number} salarioBruto
 * @param {number} inss - Valor do INSS já calculado
 * @param {number} numeroDependentes - Quantidade de dependentes
 * @param {number} pensaoAlimenticia - Valor de pensão alimentícia (se houver)
 * @returns {{ valor: number, aliquota: number, faixa: string, baseCalculo: number }}
 */
export function calcularIRRF(salarioBruto, inss, numeroDependentes = 0, pensaoAlimenticia = 0) {
    if (!salarioBruto || salarioBruto <= 0) {
        return { valor: 0, aliquota: 0, faixa: 'Isento', baseCalculo: 0 };
    }

    const deducaoDependentes = numeroDependentes * DEDUCAO_DEPENDENTE_IRRF;
    const baseCalculo = salarioBruto - inss - deducaoDependentes - pensaoAlimenticia;

    if (baseCalculo <= 0) {
        return { valor: 0, aliquota: 0, faixa: 'Isento', baseCalculo: 0 };
    }

    for (const faixa of TABELA_IRRF_2025) {
        if (baseCalculo <= faixa.ate) {
            if (faixa.aliquota === 0) {
                return { valor: 0, aliquota: 0, faixa: 'Isento', baseCalculo };
            }
            const valor = Math.round((baseCalculo * faixa.aliquota - faixa.deducao) * 100) / 100;
            return {
                valor: Math.max(0, valor),
                aliquota: faixa.aliquota,
                faixa: `${(faixa.aliquota * 100).toFixed(1)}%`,
                baseCalculo
            };
        }
    }

    return { valor: 0, aliquota: 0, faixa: 'Isento', baseCalculo };
}

/**
 * FGTS — 8% sobre a remuneração bruta
 * 
 * @param {number} remuneracaoBruta - Inclui salário + adicionais
 * @returns {number}
 */
export function calcularFGTS(remuneracaoBruta) {
    if (!remuneracaoBruta || remuneracaoBruta <= 0) return 0;
    return Math.round(remuneracaoBruta * ALIQUOTA_FGTS * 100) / 100;
}

/**
 * Desconto Vale Transporte — CLT Lei 7.418/1985
 * Desconto = menor entre 6% do salário base e o valor real do VT
 * 
 * @param {number} salarioBase
 * @param {number} valorVT - Valor total do VT fornecido pela empresa
 * @returns {number}
 */
export function calcularDescontoVT(salarioBase, valorVT) {
    if (!valorVT || valorVT <= 0) return 0;
    if (!salarioBase || salarioBase <= 0) return 0;
    const limite = salarioBase * ALIQUOTA_VT_DESCONTO;
    return Math.round(Math.min(limite, valorVT) * 100) / 100;
}

/**
 * Adicional Noturno — 20% sobre a hora diurna
 * Período noturno: 22h às 5h (CLT Art. 73)
 * Simplificado: aplica 20% sobre o salário base proporcional
 * 
 * @param {number} salarioBase
 * @param {boolean} ativo - Se o colaborador tem adicional noturno
 * @returns {number}
 */
export function calcularAdicionalNoturno(salarioBase, ativo) {
    if (!ativo || !salarioBase || salarioBase <= 0) return 0;
    return Math.round(salarioBase * ALIQUOTA_ADICIONAL_NOTURNO * 100) / 100;
}

/**
 * Insalubridade — % sobre o salário mínimo
 * Graus: mínimo (10%), médio (20%), máximo (40%)
 * CLT Art. 192
 * 
 * @param {string|null} grau - 'minimo' | 'medio' | 'maximo' | null
 * @returns {number}
 */
export function calcularInsalubridade(grau) {
    if (!grau || !INSALUBRIDADE_GRAUS[grau]) return 0;
    return Math.round(SALARIO_MINIMO_2025 * INSALUBRIDADE_GRAUS[grau] * 100) / 100;
}

/**
 * Periculosidade — 30% sobre o salário base
 * CLT Art. 193
 * 
 * @param {number} salarioBase
 * @param {boolean} ativo
 * @returns {number}
 */
export function calcularPericulosidade(salarioBase, ativo) {
    if (!ativo || !salarioBase || salarioBase <= 0) return 0;
    return Math.round(salarioBase * ALIQUOTA_PERICULOSIDADE * 100) / 100;
}

/**
 * Salário Família — por dependente (até 14 anos)
 * Pago se salário ≤ teto (R$1.819,26 em 2025)
 * 
 * @param {number} salarioBruto
 * @param {number} numeroDependentes
 * @returns {number}
 */
export function calcularSalarioFamilia(salarioBruto, numeroDependentes) {
    if (!numeroDependentes || numeroDependentes <= 0) return 0;
    if (!salarioBruto || salarioBruto > SALARIO_FAMILIA_TETO) return 0;
    return Math.round(SALARIO_FAMILIA_VALOR * numeroDependentes * 100) / 100;
}

/**
 * Hora Extra
 * Normal (dia útil): + 50% sobre hora normal
 * Feriado/Domingo: + 100% sobre hora normal
 * 
 * @param {number} salarioBase
 * @param {number} cargaHorariaMensal - Ex: 220h (44h/sem × 5)
 * @param {number} horasNormais - Qtd de horas extras normais
 * @param {number} horasFeriado - Qtd de horas extras em feriado/dom
 * @returns {{ valor: number, valorHoraNormal: number }}
 */
export function calcularHorasExtras(salarioBase, cargaHorariaMensal = 220, horasNormais = 0, horasFeriado = 0) {
    if (!salarioBase || salarioBase <= 0) return { valor: 0, valorHoraNormal: 0 };

    const valorHora = salarioBase / cargaHorariaMensal;
    const extraNormal = horasNormais * valorHora * (1 + ALIQUOTA_HORA_EXTRA_NORMAL);
    const extraFeriado = horasFeriado * valorHora * (1 + ALIQUOTA_HORA_EXTRA_FERIADO);

    return {
        valor: Math.round((extraNormal + extraFeriado) * 100) / 100,
        valorHoraNormal: Math.round(valorHora * 100) / 100
    };
}

/**
 * 13º Salário — proporcional aos meses trabalhados no ano
 * 
 * @param {number} salarioBase
 * @param {number} mesesTrabalhados - 1 a 12
 * @returns {number}
 */
export function calcular13Salario(salarioBase, mesesTrabalhados = 12) {
    if (!salarioBase || salarioBase <= 0 || !mesesTrabalhados) return 0;
    const meses = Math.min(Math.max(mesesTrabalhados, 0), 12);
    return Math.round((salarioBase * meses / 12) * 100) / 100;
}

/**
 * Férias + 1/3 constitucional
 * 
 * @param {number} salarioBase
 * @param {number} diasFerias - Normalmente 30
 * @returns {{ valor: number, tercoConstitucional: number, total: number }}
 */
export function calcularFerias(salarioBase, diasFerias = 30) {
    if (!salarioBase || salarioBase <= 0) return { valor: 0, tercoConstitucional: 0, total: 0 };

    const valor = Math.round((salarioBase * diasFerias / 30) * 100) / 100;
    const terco = Math.round((valor / 3) * 100) / 100;

    return {
        valor,
        tercoConstitucional: terco,
        total: valor + terco
    };
}

// ============================================================================
// CÁLCULO COMPLETO DA FOLHA
// ============================================================================

/**
 * Calcula a folha completa de pagamento de um colaborador.
 * Aplica apenas as regras ativas (baseado nos flags do colaborador).
 * 
 * @param {Object} colaborador - Dados do colaborador
 * @param {Object} extras - Dados extras do mês (horas extras etc.)
 * @returns {Object} - Resultado completo da folha
 */
export function calcularFolhaCompleta(colaborador, extras = {}) {
    const salarioBase = Number(colaborador.salario_base) || 0;

    // 1. ADICIONAIS (somam ao bruto)
    const adicNoturno = calcularAdicionalNoturno(salarioBase, colaborador.adicional_noturno);
    const insalubridade = calcularInsalubridade(colaborador.insalubridade_grau);
    const periculosidade = calcularPericulosidade(salarioBase, colaborador.periculosidade);
    const horasExtras = calcularHorasExtras(
        salarioBase,
        (Number(colaborador.carga_horaria) || 44) * 5,
        Number(extras.horas_extras_normais) || 0,
        Number(extras.horas_extras_feriado) || 0
    );

    // 2. SALÁRIO BRUTO (base + adicionais)
    const salarioBruto = salarioBase + adicNoturno + insalubridade + periculosidade + horasExtras.valor;

    // 3. DESCONTOS OBRIGATÓRIOS
    const inssResult = calcularINSS(salarioBruto);
    const irrfResult = calcularIRRF(
        salarioBruto,
        inssResult.valor,
        Number(colaborador.numero_dependentes) || 0
    );
    const descontoVT = calcularDescontoVT(salarioBase, Number(colaborador.vale_transporte) || 0);
    const outrosDescontos = Number(extras.outros_descontos) || 0;

    // 4. BENEFÍCIOS
    const salarioFamilia = calcularSalarioFamilia(salarioBruto, Number(colaborador.numero_dependentes) || 0);

    // 5. FGTS (a recolher pela empresa, não desconta do funcionário)
    const fgts = calcularFGTS(salarioBruto);

    // 6. SALÁRIO LÍQUIDO
    const totalDescontos = inssResult.valor + irrfResult.valor + descontoVT + outrosDescontos;
    const totalBeneficios = salarioFamilia;
    const salarioLiquido = salarioBruto - totalDescontos + totalBeneficios;

    return {
        // Base
        salario_base: salarioBase,
        salario_bruto: Math.round(salarioBruto * 100) / 100,

        // Adicionais
        adicional_noturno: adicNoturno,
        insalubridade: insalubridade,
        periculosidade: periculosidade,
        horas_extras: horasExtras.valor,
        valor_hora: horasExtras.valorHoraNormal,

        // Descontos
        inss: inssResult.valor,
        inss_faixa: inssResult.faixa,
        inss_aliquota_efetiva: inssResult.aliquotaEfetiva,
        irrf: irrfResult.valor,
        irrf_faixa: irrfResult.faixa,
        irrf_base_calculo: irrfResult.baseCalculo,
        vale_transporte: descontoVT,
        outros_descontos: outrosDescontos,

        // Benefícios
        salario_familia: salarioFamilia,

        // Encargos (empresa)
        fgts: fgts,

        // Totais
        total_descontos: Math.round(totalDescontos * 100) / 100,
        total_beneficios: Math.round(totalBeneficios * 100) / 100,
        salario_liquido: Math.round(salarioLiquido * 100) / 100,
    };
}

/**
 * Gera um resumo estimado para preview (usada no ColaboradorModal e ContratacaoResumoModal)
 * 
 * @param {Object} colaborador - Dados do formulário do colaborador
 * @returns {Object} - Resumo com estimativas
 */
export function gerarResumoEstimado(colaborador) {
    const folha = calcularFolhaCompleta(colaborador);

    // Benefícios fornecidos pela empresa (não são descontos)
    const valeTransporte = Number(colaborador.vale_transporte) || 0;
    const valeAlimentacao = Number(colaborador.vale_alimentacao) || 0;
    const valeRefeicao = Number(colaborador.vale_refeicao) || 0;
    const planoSaude = Number(colaborador.plano_saude) || 0;
    const planoOdontologico = Number(colaborador.plano_odontologico) || 0;
    const bonusMensal = Number(colaborador.bonus_mensal) || 0;
    const outrosBeneficios = Number(colaborador.outros_beneficios) || 0;

    const totalBeneficiosEmpresa = valeTransporte + valeAlimentacao + valeRefeicao +
        planoSaude + planoOdontologico + bonusMensal + outrosBeneficios;

    return {
        ...folha,
        beneficios_empresa: totalBeneficiosEmpresa,
        custo_total_empresa: folha.salario_bruto + folha.fgts + totalBeneficiosEmpresa,
    };
}
