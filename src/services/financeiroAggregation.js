/**
 * financeiroAggregation.js
 * Funções utilitárias de agregação e normalização para o módulo financeiro.
 * Centraliza cálculos de DRE, KPIs e helpers de tipo.
 */

// ─── Tipo Normalize ────────────────────────────────────────────────────────────
/**
 * Normaliza variações de tipo de lançamento para "entrada" ou "saida".
 * @param {string} tipo
 * @returns {"entrada"|"saida"|null}
 */
export function normalizeTipo(tipo) {
  if (!tipo) return null;
  const t = tipo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (t === "entrada" || t === "receita") return "entrada";
  if (t === "saida" || t === "saída" || t === "despesa") return "saida";
  return null;
}

// ─── Filtros de Período ────────────────────────────────────────────────────────
/** Filtra lista por campo de data no formato "YYYY-MM-DD" para o mês/ano dado. */
export function filtrarPorMes(lista, campoData, mesAno) {
  if (!Array.isArray(lista) || !mesAno) return [];
  return lista.filter((item) => item[campoData]?.slice(0, 7) === mesAno);
}

/** Filtra folhas de pagamento pelo mês/ano "YYYY-MM". */
export function filtrarFolhasPorMes(folhas, mesAno) {
  if (!Array.isArray(folhas) || !mesAno) return [];
  const [ano, mes] = mesAno.split("-").map(Number);
  return folhas.filter(
    (f) => f.ano_referencia === ano && f.mes_referencia === mes
  );
}

// ─── Receita de Vendas ─────────────────────────────────────────────────────────
/** Receita bruta: soma valor_total de vendas não canceladas no mês. */
export function calcularReceitaBruta(vendas, mesAno) {
  return filtrarPorMes(vendas, "data_venda", mesAno)
    .filter((v) => v.status !== "Cancelada")
    .reduce((s, v) => s + (v.valor_total || 0), 0);
}

/** Total de descontos das vendas do mês. */
export function calcularTotalDescontos(vendas, mesAno) {
  return filtrarPorMes(vendas, "data_venda", mesAno)
    .filter((v) => v.status !== "Cancelada")
    .reduce((s, v) => s + (v.desconto || 0), 0);
}

/** Total efetivamente recebido das vendas do mês (valor_pago). */
export function calcularReceitaRecebida(vendas, mesAno) {
  return filtrarPorMes(vendas, "data_venda", mesAno)
    .filter((v) => v.status !== "Cancelada")
    .reduce((s, v) => s + (v.valor_pago || 0), 0);
}

// ─── Contas a Receber ──────────────────────────────────────────────────────────
/**
 * Retorna vendas com saldo em aberto (valor_restante > 0) como A/R.
 * Exclui canceladas.
 */
export function calcularContasReceber(vendas) {
  if (!Array.isArray(vendas)) return { total: 0, itens: [] };
  const itens = vendas.filter(
    (v) => v.status !== "Cancelada" && (v.valor_restante || 0) > 0
  );
  const total = itens.reduce((s, v) => s + (v.valor_restante || 0), 0);
  return { total, itens };
}

/** Classifica A/R em: em_dia, vencidas (prazo_entrega passado), sem_prazo. */
export function classificarContasReceber(itens) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  return itens.reduce(
    (acc, v) => {
      if (!v.prazo_entrega) {
        acc.sem_prazo.push(v);
      } else {
        const prazo = new Date(v.prazo_entrega + "T00:00:00");
        if (prazo < hoje) {
          acc.vencidas.push(v);
        } else {
          acc.em_dia.push(v);
        }
      }
      return acc;
    },
    { em_dia: [], vencidas: [], sem_prazo: [] }
  );
}

// ─── Despesas de RH ────────────────────────────────────────────────────────────
/** Soma salário_liquido das folhas do mês. */
export function calcularTotalFolha(folhas, mesAno) {
  return filtrarFolhasPorMes(folhas, mesAno).reduce(
    (s, f) => s + (f.salario_liquido || 0),
    0
  );
}

/** Soma de comissões com status Calculada no mês pelo campo data_calculo. */
export function calcularTotalComissoes(comissoes, mesAno) {
  return filtrarPorMes(comissoes, "data_calculo", mesAno)
    .filter((c) => c.status === "Calculada" || c.status === "Pendente")
    .reduce((s, c) => s + (c.valor_comissao || 0), 0);
}

// ─── Lançamentos Manuais ───────────────────────────────────────────────────────
export function calcularTotalEntradas(lancamentos, mesAno) {
  return filtrarPorMes(lancamentos, "data_lancamento", mesAno)
    .filter((l) => normalizeTipo(l.tipo) === "entrada")
    .reduce((s, l) => s + Math.abs(l.valor || 0), 0);
}

export function calcularTotalSaidas(lancamentos, mesAno) {
  return filtrarPorMes(lancamentos, "data_lancamento", mesAno)
    .filter((l) => normalizeTipo(l.tipo) === "saida")
    .reduce((s, l) => s + Math.abs(l.valor || 0), 0);
}

// ─── DRE Simplificado ──────────────────────────────────────────────────────────
/**
 * Gera o DRE simplificado do mês.
 * @returns {{ receitaBruta, descontos, receitaLiquida, despesasLancadas,
 *             totalFolha, totalComissoes, resultadoOperacional }}
 */
export function calcularDRE({ vendas, lancamentos, folhas, comissoes, mesAno }) {
  const receitaBruta = calcularReceitaBruta(vendas, mesAno);
  const descontos = calcularTotalDescontos(vendas, mesAno);
  const receitaLiquida = receitaBruta - descontos;

  const despesasLancadas = calcularTotalSaidas(lancamentos, mesAno);
  const totalFolha = calcularTotalFolha(folhas, mesAno);
  const totalComissoes = calcularTotalComissoes(comissoes, mesAno);

  const resultadoOperacional =
    receitaLiquida - despesasLancadas - totalFolha - totalComissoes;

  return {
    receitaBruta,
    descontos,
    receitaLiquida,
    despesasLancadas,
    totalFolha,
    totalComissoes,
    resultadoOperacional,
  };
}
