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

function isStatusCancelado(status) {
  return String(status || "").trim().toLowerCase().startsWith("cancelad");
}

function parseDateValue(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function getMonthBoundariesFromMesAno(mesAno) {
  if (!mesAno || !/^\d{4}-\d{2}$/.test(mesAno)) {
    return { start: null, end: null };
  }
  const [ano, mes] = mesAno.split("-").map(Number);
  const start = new Date(ano, mes - 1, 1, 0, 0, 0, 0);
  const end = new Date(ano, mes, 0, 23, 59, 59, 999);
  return { start, end };
}

function isDateInRange(dateValue, start, end) {
  const d = parseDateValue(dateValue);
  if (!d || !start || !end) return false;
  return d >= start && d <= end;
}

function getLancamentoCompetenciaDate(lancamento) {
  return lancamento?.data_vencimento || lancamento?.data_lancamento || lancamento?.created_at || null;
}

function getPeriodoRange(periodo = {}) {
  if (periodo?.modo === "intervalo") {
    const start = parseDateValue(periodo.dataInicio);
    const end = parseDateValue(periodo.dataFim);
    if (!start || !end) return { start: null, end: null };
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  return getMonthBoundariesFromMesAno(periodo?.mesAno);
}

function filtrarPorPeriodoLista(lista, getDate, periodo) {
  if (!Array.isArray(lista)) return [];
  const { start, end } = getPeriodoRange(periodo);
  if (!start || !end) return [];
  return lista.filter((item) => isDateInRange(getDate(item), start, end));
}

function shiftMonth(mesAno, offset) {
  const { start } = getMonthBoundariesFromMesAno(mesAno);
  const base = start || new Date();
  const shifted = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  const ano = shifted.getFullYear();
  const mes = String(shifted.getMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}`;
}

function formatMesLabel(mesAno) {
  const { start } = getMonthBoundariesFromMesAno(mesAno);
  if (!start) return mesAno || "";
  return start.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

// ─── Filtros de Período ────────────────────────────────────────────────────────
/** Filtra lista por campo de data no formato "YYYY-MM-DD" para o mês/ano dado. */
export function filtrarPorMes(lista, campoData, mesAno) {
  if (!Array.isArray(lista) || !mesAno) return [];
  return lista.filter((item) => item[campoData]?.slice(0, 7) === mesAno);
}

/** Filtra lista por intervalo de datas (inclusivo), usando o campo informado. */
export function filtrarPorIntervalo(lista, campoData, dataInicio, dataFim) {
  if (!Array.isArray(lista) || !dataInicio || !dataFim) return [];
  const inicio = parseDateValue(dataInicio);
  const fim = parseDateValue(dataFim);
  if (!inicio || !fim) return [];
  fim.setHours(23, 59, 59, 999);
  return lista.filter((item) => isDateInRange(item[campoData], inicio, fim));
}

/** Filtra folhas de pagamento pelo mês/ano "YYYY-MM". */
export function filtrarFolhasPorMes(folhas, mesAno) {
  if (!Array.isArray(folhas) || !mesAno) return [];
  const [ano, mes] = mesAno.split("-").map(Number);
  return folhas.filter(
    (f) => f.ano_referencia === ano && f.mes_referencia === mes
  );
}

/** Filtra folhas de pagamento por período (mensal ou intervalo). */
export function filtrarFolhasPorPeriodo(folhas, periodo = {}) {
  if (!Array.isArray(folhas)) return [];

  if (periodo?.modo !== "intervalo") {
    return filtrarFolhasPorMes(folhas, periodo?.mesAno);
  }

  const { start, end } = getPeriodoRange(periodo);
  if (!start || !end) return [];

  return folhas.filter((f) => {
    const mesRef = String(f.mes_referencia || "").padStart(2, "0");
    const anoRef = Number(f.ano_referencia);
    if (!anoRef || !mesRef) return false;
    const competencia = parseDateValue(`${anoRef}-${mesRef}-01`);
    return competencia && competencia >= new Date(start.getFullYear(), start.getMonth(), 1) && competencia <= new Date(end.getFullYear(), end.getMonth(), 1);
  });
}

// ─── Receita de Vendas ─────────────────────────────────────────────────────────
/** Receita bruta: soma valor_total de vendas não canceladas no mês. */
export function calcularReceitaBruta(vendas, mesAno) {
  return filtrarPorMes(vendas, "data_venda", mesAno)
    .filter((v) => !isStatusCancelado(v.status))
    .reduce((s, v) => s + (v.valor_total || 0), 0);
}

/** Total de descontos das vendas do mês. */
export function calcularTotalDescontos(vendas, mesAno) {
  return filtrarPorMes(vendas, "data_venda", mesAno)
    .filter((v) => !isStatusCancelado(v.status))
    .reduce((s, v) => s + (v.desconto || 0), 0);
}

/** Total efetivamente recebido das vendas do mês (valor_pago). */
export function calcularReceitaRecebida(vendas, mesAno) {
  return filtrarPorMes(vendas, "data_venda", mesAno)
    .filter((v) => !isStatusCancelado(v.status))
    .reduce((s, v) => s + (v.valor_pago || 0), 0);
}

/** Total recebido por período (mensal ou intervalo). */
export function calcularReceitaRecebidaPorPeriodo(vendas, periodo = {}) {
  const vendasPeriodo = filtrarPorPeriodoLista(vendas, (v) => v.data_venda, periodo);
  return vendasPeriodo
    .filter((v) => !isStatusCancelado(v.status))
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
    (v) => !isStatusCancelado(v.status) && (v.valor_restante || 0) > 0
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

/** Soma de comissões por período (mensal ou intervalo). */
export function calcularTotalComissoesPorPeriodo(comissoes, periodo = {}) {
  return filtrarPorPeriodoLista(comissoes, (c) => c.data_calculo, periodo)
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

export function calcularTotalEntradasPorPeriodo(lancamentos, periodo = {}, getDate = getLancamentoCompetenciaDate) {
  return filtrarPorPeriodoLista(lancamentos, getDate, periodo)
    .filter((l) => normalizeTipo(l.tipo) === "entrada")
    .reduce((s, l) => s + Math.abs(l.valor || 0), 0);
}

export function calcularTotalSaidasPorPeriodo(lancamentos, periodo = {}, getDate = getLancamentoCompetenciaDate) {
  return filtrarPorPeriodoLista(lancamentos, getDate, periodo)
    .filter((l) => normalizeTipo(l.tipo) === "saida")
    .reduce((s, l) => s + Math.abs(l.valor || 0), 0);
}

export function calcularDREPorPeriodo({
  vendas = [],
  lancamentos = [],
  folhas = [],
  comissoes = [],
  periodo,
  getLancamentoDate = getLancamentoCompetenciaDate,
}) {
  const periodoBase = periodo?.modo ? periodo : { modo: "mensal", mesAno: periodo?.mesAno || periodo };
  const vendasPeriodo = filtrarPorPeriodoLista(vendas, (v) => v.data_venda, periodoBase)
    .filter((v) => !isStatusCancelado(v.status));

  const receitaBruta = vendasPeriodo.reduce((s, v) => s + (v.valor_total || 0), 0);
  const descontos = vendasPeriodo.reduce((s, v) => s + (v.desconto || 0), 0);
  const receitaLiquida = receitaBruta - descontos;

  const despesasLancadas = calcularTotalSaidasPorPeriodo(lancamentos, periodoBase, getLancamentoDate);
  const totalFolha = filtrarFolhasPorPeriodo(folhas, periodoBase).reduce((s, f) => s + (f.salario_liquido || 0), 0);
  const totalComissoes = calcularTotalComissoesPorPeriodo(comissoes, periodoBase);

  const resultadoOperacional = receitaLiquida - despesasLancadas - totalFolha - totalComissoes;

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

export function calcularDRECompleto({
  vendas = [],
  lancamentos = [],
  produtos = [],
  periodo,
  getLancamentoDate = getLancamentoCompetenciaDate,
}) {
  const periodoBase = periodo?.modo ? periodo : { modo: "mensal", mesAno: periodo?.mesAno || periodo };
  const vendasPeriodo = filtrarPorPeriodoLista(vendas, (v) => v.data_venda, periodoBase);
  const produtosMap = {};
  produtos.forEach((p) => {
    produtosMap[p.id] = p;
  });

  const receitaBruta = vendasPeriodo.reduce((sum, v) => sum + (v.valor_total || 0), 0);
  const descontos = vendasPeriodo.reduce((sum, v) => sum + (v.desconto || 0) + (v.cupom_desconto || 0), 0);
  const vendasCanceladas = vendasPeriodo
    .filter((v) => isStatusCancelado(v.status))
    .reduce((sum, v) => sum + (v.valor_total || 0), 0);
  const deducoes = descontos + vendasCanceladas;
  const receitaLiquida = receitaBruta - deducoes;

  let cmv = 0;
  vendasPeriodo.forEach((v) => {
    if (!isStatusCancelado(v.status)) {
      v.itens?.forEach((item) => {
        const produto = produtosMap[item.produto_id];
        const custoProduto = produto?.preco_custo || (item.preco_unitario * 0.6);
        cmv += custoProduto * (item.quantidade || 1);
      });
    }
  });

  const lucroBruto = receitaLiquida - cmv;

  const lancamentosFiltrados = filtrarPorPeriodoLista(lancamentos, getLancamentoDate, periodoBase);
  const despesasOperacionais = lancamentosFiltrados
    .filter((l) => normalizeTipo(l.tipo) === "saida")
    .reduce((sum, l) => sum + Math.abs(l.valor || 0), 0);

  const despesasPorCategoria = {};
  lancamentosFiltrados
    .filter((l) => normalizeTipo(l.tipo) === "saida")
    .forEach((l) => {
      const categoria = l.categoria_nome || "Outras Despesas";
      despesasPorCategoria[categoria] = (despesasPorCategoria[categoria] || 0) + Math.abs(l.valor || 0);
    });

  const lucroOperacional = lucroBruto - despesasOperacionais;
  const margemBruta = receitaLiquida > 0 ? (lucroBruto / receitaLiquida) * 100 : 0;
  const margemLiquida = receitaLiquida > 0 ? (lucroOperacional / receitaLiquida) * 100 : 0;

  return {
    receitaBruta,
    descontos,
    vendasCanceladas,
    deducoes,
    receitaLiquida,
    cmv,
    lucroBruto,
    despesasOperacionais,
    despesasPorCategoria: Object.entries(despesasPorCategoria)
      .map(([nome, valor]) => ({ nome, valor }))
      .sort((a, b) => b.valor - a.valor),
    lucroOperacional,
    margemBruta,
    margemLiquida,
  };
}

export function calcularDRESerieMensal12Meses({
  vendas = [],
  lancamentos = [],
  produtos = [],
  mesAnoFinal,
  getLancamentoDate = getLancamentoCompetenciaDate,
}) {
  const fim = mesAnoFinal && /^\d{4}-\d{2}$/.test(mesAnoFinal)
    ? mesAnoFinal
    : new Date().toISOString().slice(0, 7);

  const serie = [];
  for (let i = 11; i >= 0; i -= 1) {
    const mesAno = shiftMonth(fim, -i);
    const dreMes = calcularDRECompleto({
      vendas,
      lancamentos,
      produtos,
      periodo: { modo: "mensal", mesAno },
      getLancamentoDate,
    });

    serie.push({
      mesAno,
      label: formatMesLabel(mesAno),
      receitaLiquida: dreMes.receitaLiquida,
      despesasOperacionais: dreMes.despesasOperacionais,
      lucroOperacional: dreMes.lucroOperacional,
    });
  }

  return serie;
}

// ─── DRE Simplificado ──────────────────────────────────────────────────────────
/**
 * Gera o DRE simplificado do mês.
 * @returns {{ receitaBruta, descontos, receitaLiquida, despesasLancadas,
 *             totalFolha, totalComissoes, resultadoOperacional }}
 */
export function calcularDRE({ vendas, lancamentos, folhas, comissoes, mesAno }) {
  return calcularDREPorPeriodo({
    vendas,
    lancamentos,
    folhas,
    comissoes,
    periodo: { modo: "mensal", mesAno },
    getLancamentoDate: (l) => l?.data_lancamento,
  });
}
