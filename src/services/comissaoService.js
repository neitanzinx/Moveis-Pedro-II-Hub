import { base44, supabase } from "@/lib/supabase";

const DEFAULT_SETTINGS = {
  comissao_sobre: "bruto",
  comissao_prioridade_estrategia: "mais_especifica",
  comissao_recalculo_politica: "nao_recalcular",
};

const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeText = (value) => (value || "").toString().trim().toLowerCase();

const getBaseValue = ({ comissaoSobre, venda, pagamento, totalPago }) => {
  const valorTotal = Math.max(0, toNumber(venda.valor_total));
  const valorLiquido = Math.max(0, valorTotal - toNumber(venda.desconto));
  const valorPagamento = Math.max(0, toNumber(pagamento.valor));

  if (comissaoSobre === "recebido") {
    return valorPagamento;
  }

  if (comissaoSobre === "entrada") {
    const primeiroPagamento = (venda.pagamentos || [])[0];
    const primeiroValor = Math.max(0, toNumber(primeiroPagamento?.valor));
    return pagamento === primeiroPagamento ? primeiroValor : 0;
  }

  // Para base bruto/liquido distribuimos proporcionalmente por forma de pagamento.
  if (totalPago <= 0) {
    return 0;
  }

  const proporcao = valorPagamento / totalPago;
  if (comissaoSobre === "liquido") {
    return valorLiquido * proporcao;
  }

  return valorTotal * proporcao;
};

const scoreRuleSpecificity = (rule, venda, pagamento) => {
  let score = 0;
  const formaPagamentoRule = normalizeText(rule.forma_pagamento);
  const formaPagamentoVenda = normalizeText(pagamento.forma_pagamento);

  if (formaPagamentoRule && formaPagamentoRule === formaPagamentoVenda) {
    score += 4;
  }

  if (rule.vendedor_id && rule.vendedor_id === (venda.vendedor_id || venda.responsavel_id)) {
    score += 3;
  }

  if (rule.loja && normalizeText(rule.loja) === normalizeText(venda.loja)) {
    score += 2;
  }

  return score;
};

const matchesRule = (rule, venda, pagamento) => {
  const formaPagamentoRule = normalizeText(rule.forma_pagamento);
  const formaPagamentoVenda = normalizeText(pagamento.forma_pagamento);
  if (formaPagamentoRule && formaPagamentoRule !== formaPagamentoVenda) {
    return false;
  }

  if (rule.vendedor_id && rule.vendedor_id !== (venda.vendedor_id || venda.responsavel_id)) {
    return false;
  }

  if (rule.loja && normalizeText(rule.loja) !== normalizeText(venda.loja)) {
    return false;
  }

  if (rule.ativo === false) {
    return false;
  }

  return true;
};

const selectRulesForPayment = ({ estrategia, rules, venda, pagamento }) => {
  const matchingRules = rules.filter((rule) => matchesRule(rule, venda, pagamento));
  if (!matchingRules.length) {
    return [];
  }

  if (estrategia === "somar_regras") {
    return matchingRules;
  }

  if (estrategia === "maior_percentual") {
    const highest = [...matchingRules].sort((a, b) => toNumber(b.porcentagem) - toNumber(a.porcentagem))[0];
    return highest ? [highest] : [];
  }

  // Padrao: mais_especifica.
  const sorted = [...matchingRules].sort((a, b) => {
    const specificityDiff = scoreRuleSpecificity(b, venda, pagamento) - scoreRuleSpecificity(a, venda, pagamento);
    if (specificityDiff !== 0) {
      return specificityDiff;
    }

    return toNumber(b.prioridade) - toNumber(a.prioridade);
  });

  return sorted[0] ? [sorted[0]] : [];
};

export async function carregarConfiguracaoComissao({ organizationId, settingsOverride } = {}) {
  const orgId = organizationId || DEFAULT_ORG_ID;

  const mergedSettings = {
    ...DEFAULT_SETTINGS,
    ...(settingsOverride || {}),
  };

  if (!settingsOverride) {
    try {
      const { data: orgSettings } = await supabase
        .from("organization_settings")
        .select("comissao_sobre, comissao_prioridade_estrategia, comissao_recalculo_politica")
        .eq("organization_id", orgId)
        .single();

      Object.assign(mergedSettings, orgSettings || {});
    } catch (error) {
      // Se nao houver tabela/campos ainda, usa fallback sem quebrar fluxo.
      console.warn("Falha ao carregar organization_settings para comissao:", error?.message || error);
    }
  }

  let regrasAtivas = [];
  try {
    const regras = await base44.entities.RegraComissao.list("-prioridade");
    regrasAtivas = (regras || []).filter((r) => r.ativo !== false);
  } catch (error) {
    // Fallback para configuracao legada por forma de pagamento.
    try {
      const legado = await base44.entities.ConfiguracaoComissao.list();
      regrasAtivas = (legado || []).map((item) => ({
        id: item.id,
        nome: `Regra ${item.forma_pagamento}`,
        forma_pagamento: item.forma_pagamento,
        porcentagem: item.porcentagem,
        ativo: true,
        prioridade: 0,
      }));
    } catch (legacyError) {
      console.warn("Falha ao carregar configuracao de comissao:", legacyError?.message || legacyError);
      regrasAtivas = [];
    }
  }

  return {
    settings: mergedSettings,
    rules: regrasAtivas,
  };
}

export async function calcularComissaoVenda({ venda, organizationId, settingsOverride } = {}) {
  if (!venda) {
    return {
      comissao_calculada: 0,
      porcentagem_comissao: 0,
      comissao_status: "Calculada",
      comissao_detalhes_json: [],
      comissao_calculada_em: new Date().toISOString(),
    };
  }

  const pagamentos = Array.isArray(venda.pagamentos) ? venda.pagamentos : [];
  if (!pagamentos.length) {
    return {
      comissao_calculada: 0,
      porcentagem_comissao: 0,
      comissao_status: "Calculada",
      comissao_detalhes_json: [],
      comissao_calculada_em: new Date().toISOString(),
    };
  }

  const { settings, rules } = await carregarConfiguracaoComissao({
    organizationId,
    settingsOverride,
  });

  const estrategia = settings.comissao_prioridade_estrategia || "mais_especifica";
  const comissaoSobre = settings.comissao_sobre || "bruto";
  const totalPago = pagamentos.reduce((sum, p) => sum + Math.max(0, toNumber(p.valor)), 0);

  const detalhes = [];
  let totalComissao = 0;

  pagamentos.forEach((pagamento) => {
    const regrasSelecionadas = selectRulesForPayment({
      estrategia,
      rules,
      venda,
      pagamento,
    });

    if (!regrasSelecionadas.length) {
      return;
    }

    const baseCalculo = getBaseValue({
      comissaoSobre,
      venda,
      pagamento,
      totalPago,
    });

    regrasSelecionadas.forEach((regra) => {
      const percentual = Math.max(0, toNumber(regra.porcentagem));
      const valorComissao = (baseCalculo * percentual) / 100;
      totalComissao += valorComissao;

      detalhes.push({
        regra_id: regra.id,
        regra_nome: regra.nome || `Regra ${pagamento.forma_pagamento}`,
        forma_pagamento: pagamento.forma_pagamento,
        valor_pagamento: Math.max(0, toNumber(pagamento.valor)),
        base_calculo: baseCalculo,
        percentual,
        valor_comissao: valorComissao,
        estrategia,
        comissao_sobre: comissaoSobre,
      });
    });
  });

  const valorReferencia = Math.max(0, toNumber(venda.valor_total));
  const percentualMedio = valorReferencia > 0 ? (totalComissao / valorReferencia) * 100 : 0;

  return {
    comissao_calculada: Number(totalComissao.toFixed(2)),
    porcentagem_comissao: Number(percentualMedio.toFixed(4)),
    comissao_status: "Calculada",
    comissao_detalhes_json: detalhes,
    comissao_calculada_em: new Date().toISOString(),
    comissao_recalculo_politica: settings.comissao_recalculo_politica || "nao_recalcular",
    comissao_prioridade_estrategia: estrategia,
    comissao_sobre: comissaoSobre,
  };
}

export async function registrarHistoricoComissao(vendaId, vendaComComissao) {
  if (!vendaId || !vendaComComissao) {
    return;
  }

  const detalhes = Array.isArray(vendaComComissao.comissao_detalhes_json)
    ? vendaComComissao.comissao_detalhes_json
    : [];

  if (!detalhes.length) {
    return;
  }

  try {
    const registros = detalhes.map((item) => ({
      venda_id: vendaId,
      vendedor_id: vendaComComissao.vendedor_id || vendaComComissao.responsavel_id || null,
      regra_comissao_id: item.regra_id || null,
      forma_pagamento: item.forma_pagamento || null,
      valor_base: Number(toNumber(item.base_calculo).toFixed(2)),
      percentual_aplicado: Number(toNumber(item.percentual).toFixed(4)),
      valor_comissao: Number(toNumber(item.valor_comissao).toFixed(2)),
      status: "Calculada",
      data_calculo: vendaComComissao.comissao_calculada_em || new Date().toISOString(),
      detalhes_json: item,
    }));

    await supabase.from("comissoes_historico").insert(registros);
  } catch (error) {
    console.warn("Falha ao registrar historico de comissao:", error?.message || error);
  }
}

/**
 * Recalculates commissions for all sales on or after `dataInicio` (YYYY-MM-DD)
 * using the current active commission settings/rules.
 *
 * Returns { total, processed, updated, failed, errors[] }
 */
export async function recalcularComissoesDesdaData({ dataInicio, organizationId, onProgress } = {}) {
  if (!dataInicio) {
    throw new Error("Data de início é obrigatória para o recálculo.");
  }

  const { data: vendas, error } = await supabase
    .from("vendas")
    .select("*")
    .gte("data_venda", dataInicio)
    .order("data_venda", { ascending: true });

  if (error) {
    throw new Error(`Erro ao buscar vendas: ${error.message}`);
  }

  const total = vendas?.length || 0;
  const results = { total, processed: 0, updated: 0, failed: 0, errors: [] };

  for (const venda of (vendas || [])) {
    try {
      const novaComissao = await calcularComissaoVenda({ venda, organizationId });

      const { error: updateError } = await supabase
        .from("vendas")
        .update({
          comissao_calculada: novaComissao.comissao_calculada,
          porcentagem_comissao: novaComissao.porcentagem_comissao,
          comissao_status: novaComissao.comissao_status,
          comissao_detalhes_json: novaComissao.comissao_detalhes_json,
          comissao_calculada_em: novaComissao.comissao_calculada_em,
        })
        .eq("id", venda.id);

      if (updateError) {
        results.failed++;
        results.errors.push({ venda_id: venda.id, error: updateError.message });
      } else {
        results.updated++;
      }
    } catch (err) {
      results.failed++;
      results.errors.push({ venda_id: venda.id, error: err?.message || String(err) });
    }

    results.processed++;
    if (onProgress) {
      onProgress({ ...results });
    }
  }

  return results;
}
