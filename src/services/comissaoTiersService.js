import { normalizePaymentMethod } from "@/services/paymentOrchestrator";

const normalizeKey = (v = "") =>
  String(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

/**
 * Serviço de cálculo de comissões por faixas (tiers) de meta.
 * Funções puras — sem side-effects, sem chamadas de API.
 */

/**
 * Calcula o valor líquido total de um array de vendas, aplicando o
 * desconto_vendedor configurado por forma de pagamento.
 *
 * @param {Array} vendasArr  - Registros de venda (cada um com .pagamentos[])
 * @param {Array} configTaxas - Linhas de configuracao_taxas com .desconto_vendedor
 * @returns {number} Soma dos valores líquidos
 */
export function calcularVendasLiquidas(vendasArr, configTaxas) {
  return vendasArr.reduce((totalAcc, venda) => {
    const pagamentos = venda.pagamentos;
    if (!Array.isArray(pagamentos) || pagamentos.length === 0) {
      return totalAcc + (venda.valor_total || 0);
    }
    const liquidoVenda = pagamentos.reduce((sum, pag) => {
      const taxa = configTaxas.find(
        (t) =>
          normalizeKey(normalizePaymentMethod(t.forma_pagamento || "")) ===
          normalizeKey(normalizePaymentMethod(pag.forma_pagamento || ""))
      );
      const desconto = taxa?.desconto_vendedor ?? 0;
      return sum + (pag.valor || 0) * (1 - desconto / 100);
    }, 0);
    return totalAcc + liquidoVenda;
  }, 0);
}

/**
 * Aplica a lógica de faixas escalonadas para calcular a comissão.
 *
 * Regra: a faixa ativa é aquela com o maior `percentual_meta_min`
 * que ainda seja <= ao percentual da meta atingido.
 *
 * @param {object} params
 * @param {number} params.vendasBrutas    - Total bruto de vendas do período
 * @param {number} params.vendasLiquidas  - Total líquido de vendas do período
 * @param {number} params.meta            - Meta mensal configurada (R$)
 * @param {Array}  params.faixas          - Faixas de niveis_comissao_faixas
 * @returns {{ percentualMeta, faixaAplicada, percentualComissao, valorComissao }}
 */
export function calcularComissaoTiered({ vendasBrutas, vendasLiquidas, meta, faixas, percentualMetaOverride }) {
  const zero = { percentualMeta: 0, faixaAplicada: null, percentualComissao: 0, valorComissao: 0 };
  if (!faixas || faixas.length === 0) return zero;

  const percentualMeta = percentualMetaOverride !== undefined ? percentualMetaOverride : (meta > 0 ? (vendasBrutas / meta) * 100 : 0);

  // Faixa qualificada = a de maior min% que ainda <= % atingido
  const faixaAplicada = [...faixas]
    .map((f) => ({ ...f, percentual_meta_min: Number(f.percentual_meta_min ?? 0) }))
    .sort((a, b) => b.percentual_meta_min - a.percentual_meta_min)
    .find((f) => percentualMeta >= f.percentual_meta_min) ?? null;

  if (!faixaAplicada) return { percentualMeta, faixaAplicada: null, percentualComissao: 0, valorComissao: 0 };

  const base = faixaAplicada.base_calculo === 'bruto' ? vendasBrutas : vendasLiquidas;
  const percentualComissao = Number(faixaAplicada.percentual_comissao ?? 0);
  const valorComissao = base * (percentualComissao / 100);

  return { percentualMeta, faixaAplicada, percentualComissao, valorComissao };
}
