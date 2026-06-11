import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  TrendingUp, TrendingDown, DollarSign, AlertCircle,
  Target, Users, ShoppingCart, ArrowUp, ArrowDown, Calendar
} from "lucide-react";
import {
  calcularDREPorPeriodo,
  calcularReceitaRecebidaPorPeriodo,
  calcularContasReceber,
  calcularTotalEntradasPorPeriodo,
  calcularTotalSaidasPorPeriodo,
  calcularDRESerieMensal12Meses,
} from "@/services/financeiroAggregation";
import { calcularFolhaCompleta } from "@/utils/calculosTrabalhistas";
import { isVendaCancelada } from "@/utils/vendaStatus";

const fmt = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function KPICard({ titulo, valor, subtitulo, icon: Icon, cor, onClick }) {
  const cores = {
    green:  { bg: "bg-green-50 dark:bg-green-900/20", icon: "text-green-600", valor: "text-green-700 dark:text-green-400" },
    red:    { bg: "bg-red-50 dark:bg-red-900/20",     icon: "text-red-600",   valor: "text-red-700 dark:text-red-400" },
    orange: { bg: "bg-orange-50 dark:bg-orange-900/20", icon: "text-orange-600", valor: "text-orange-700 dark:text-orange-400" },
    blue:   { bg: "bg-blue-50 dark:bg-blue-900/20",   icon: "text-blue-600",  valor: "text-blue-700 dark:text-blue-400" },
    gray:   { bg: "bg-gray-50 dark:bg-neutral-800",   icon: "text-gray-500",  valor: "text-gray-700 dark:text-gray-300" },
  };
  const c = cores[cor] || cores.gray;

  return (
    <Card 
      className={`border-0 shadow-md transition-all duration-200 ${onClick ? "cursor-pointer hover:shadow-lg hover:-translate-y-0.5" : ""}`}
      onClick={onClick}
    >
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              {titulo}
            </p>
            <p className={`text-2xl font-bold ${c.valor}`}>R$ {fmt(valor)}</p>
            {subtitulo && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtitulo}</p>
            )}
          </div>
          <div className={`p-2.5 rounded-xl ${c.bg}`}>
            <Icon className={`w-5 h-5 ${c.icon}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DRELinha({ label, valor, destaque = false, negativo = false, nivel = 0 }) {
  const indent = nivel > 0 ? `pl-${nivel * 4}` : "";
  const colorClass = destaque
    ? valor >= 0 ? "text-green-700 dark:text-green-400 font-bold" : "text-red-600 dark:text-red-400 font-bold"
    : negativo ? "text-red-600 dark:text-red-400" : "text-gray-800 dark:text-gray-200";

  return (
    <div className={`flex justify-between items-center py-1.5 ${indent} ${destaque ? "border-t border-gray-200 dark:border-neutral-700 mt-1 pt-2" : ""}`}>
      <span className={`text-sm ${destaque ? "font-semibold" : "text-gray-600 dark:text-gray-400"}`}>
        {label}
      </span>
      <span className={`text-sm tabular-nums ${colorClass}`}>
        {negativo && valor > 0 ? "– " : ""}R$ {fmt(Math.abs(valor))}
      </span>
    </div>
  );
}

export default function VisaoGeral({
  vendas = [],
  lancamentos = [],
  folhas = [],
  comissoes = [],
  contasPagarCompras = [],
  metas = [],
  colaboradores = [],
  mesAno,
  dreModo = "mensal",
  dreDataInicio,
  dreDataFim,
}) {
  const [modalPagamentosAberto, setModalPagamentosAberto] = useState(false);

  const periodoDre = useMemo(
    () => (dreModo === "intervalo"
      ? { modo: "intervalo", dataInicio: dreDataInicio, dataFim: dreDataFim }
      : { modo: "mensal", mesAno }),
    [dreModo, dreDataInicio, dreDataFim, mesAno]
  );

  const dre = useMemo(
    () => calcularDREPorPeriodo({ vendas, lancamentos, folhas, comissoes, periodo: periodoDre }),
    [vendas, lancamentos, folhas, comissoes, periodoDre]
  );

  const receitaRecebida = useMemo(
    () => calcularReceitaRecebidaPorPeriodo(vendas, periodoDre),
    [vendas, periodoDre]
  );

  const { total: totalReceber, itens: itensReceber } = useMemo(
    () => calcularContasReceber(vendas),
    [vendas]
  );

  const totalEntradasLancamentos = useMemo(
    () => calcularTotalEntradasPorPeriodo(lancamentos, periodoDre),
    [lancamentos, periodoDre]
  );

  const totalSaidasLancamentos = useMemo(
    () => calcularTotalSaidasPorPeriodo(lancamentos, periodoDre),
    [lancamentos, periodoDre]
  );

  const saldoCaixa = totalEntradasLancamentos - totalSaidasLancamentos;
  const totalFolhaDRE = dre.totalFolha;
  const totalComissoesMes = dre.totalComissoes;

  // Estimativa de folha a partir dos colaboradores ativos (fallback quando nenhuma folha foi gerada)
  const folhaEstimada = useMemo(() => {
    const colabAtivos = colaboradores.filter(c => c.status === 'Ativo' && Number(c.salario_base) > 0);
    if (colabAtivos.length === 0) return { total: 0, count: 0 };
    const total = colabAtivos.reduce((sum, c) => {
      const folha = calcularFolhaCompleta(c);
      return sum + (folha.salario_liquido || 0);
    }, 0);
    return { total, count: colabAtivos.length };
  }, [colaboradores]);

  // Folhas geradas no período
  const folhasNoPeriodo = useMemo(() => {
    const [a, m2] = mesAno.split("-").map(Number);
    return folhas.filter(f => f.ano_referencia === a && f.mes_referencia === m2);
  }, [folhas, mesAno]);

  const temFolhaGerada = folhasNoPeriodo.length > 0;
  const totalFolhaMes = temFolhaGerada ? totalFolhaDRE : folhaEstimada.total;
  const folhaLabel = temFolhaGerada
    ? `${folhasNoPeriodo.length} colaborador(es)`
    : folhaEstimada.count > 0
      ? `${folhaEstimada.count} colaborador(es) · estimativa`
      : "Sem dados";

  const totalFolhaMesPendente = useMemo(() => {
    if (!temFolhaGerada) return folhaEstimada.total;
    return folhasNoPeriodo.reduce((s, f) => {
      if (f.status === 'Pago' || f.status === 'Cancelado') return s;

      const colab = colaboradores.find(c => c.nome_completo === f.colaborador_nome || c.id === f.colaborador_id);
      const recebeVale = colab?.recebe_vale === true;
      const valorDiaPagamento = Number(colab?.valor_dia_pagamento) || 0;
      const valorDiaVale = Number(colab?.valor_dia_vale) || 0;
      const temDistribuicao = recebeVale && (valorDiaPagamento + valorDiaVale) > 0;

      if (temDistribuicao) {
        const salPendente = f.salario_pago === true ? 0 : valorDiaPagamento;
        const valePendente = f.vale_pago === true ? 0 : valorDiaVale;
        return s + salPendente + valePendente;
      } else {
        return s + (f.salario_pago === true ? 0 : (f.salario_liquido || 0));
      }
    }, 0);
  }, [folhasNoPeriodo, colaboradores, temFolhaGerada, folhaEstimada.total]);

  const MESES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const formatMesAno = (mesAnoStr) => {
    if (!mesAnoStr) return "";
    const [ano, mes] = mesAnoStr.split("-").map(Number);
    if (!mes || !ano) return mesAnoStr;
    return `${MESES[mes - 1]} de ${ano}`;
  };

  const pagamentosAgrupados = useMemo(() => {
    const listaPagamentos = [];

    if (temFolhaGerada) {
      folhasNoPeriodo.forEach((folha) => {
        const colab = colaboradores.find((c) => c.id === folha.colaborador_id);
        const recebeVale = colab?.recebe_vale === true;
        const valorDiaPagamento = Number(colab?.valor_dia_pagamento) || 0;
        const valorDiaVale = Number(colab?.valor_dia_vale) || 0;
        const temDistribuicao = recebeVale && (valorDiaPagamento + valorDiaVale) > 0;

        if (temDistribuicao) {
          if (valorDiaVale > 0) {
            listaPagamentos.push({
              colaborador_nome: folha.colaborador_nome || colab?.nome_completo || "Colaborador",
              tipo: "Vale",
              valor: valorDiaVale,
              dia: colab.dia_vale || 20,
              tipo_dia: colab.tipo_dia_vale || "fixo",
              pago: folha.vale_pago === true || folha.status === 'Pago',
            });
          }
          if (valorDiaPagamento > 0) {
            listaPagamentos.push({
              colaborador_nome: folha.colaborador_nome || colab?.nome_completo || "Colaborador",
              tipo: "Salário",
              valor: valorDiaPagamento,
              dia: colab.dia_pagamento || 5,
              tipo_dia: colab.tipo_dia_pagamento || "fixo",
              pago: folha.salario_pago === true || folha.status === 'Pago',
            });
          }
        } else {
          listaPagamentos.push({
            colaborador_nome: folha.colaborador_nome || colab?.nome_completo || "Colaborador",
            tipo: "Salário",
            valor: Number(folha.salario_liquido) || 0,
            dia: colab?.dia_pagamento || 5,
            tipo_dia: colab?.tipo_dia_pagamento || "fixo",
            pago: folha.salario_pago === true || folha.status === 'Pago',
          });
        }
      });
    } else {
      // Usar colaboradores ativos como estimativa
      const colabAtivos = colaboradores.filter(
        (c) => c.status === "Ativo" && Number(c.salario_base) > 0
      );

      colabAtivos.forEach((colab) => {
        const folha = calcularFolhaCompleta(colab);
        const recebeVale = colab.recebe_vale === true;
        const valorDiaPagamento = Number(colab.valor_dia_pagamento) || 0;
        const valorDiaVale = Number(colab.valor_dia_vale) || 0;
        const temDistribuicao = recebeVale && (valorDiaPagamento + valorDiaVale) > 0;

        if (temDistribuicao) {
          if (valorDiaVale > 0) {
            listaPagamentos.push({
              colaborador_nome: colab.nome_completo || "Colaborador",
              tipo: "Vale",
              valor: valorDiaVale,
              dia: colab.dia_vale || 20,
              tipo_dia: colab.tipo_dia_vale || "fixo",
              pago: false,
            });
          }
          if (valorDiaPagamento > 0) {
            listaPagamentos.push({
              colaborador_nome: colab.nome_completo || "Colaborador",
              tipo: "Salário",
              valor: valorDiaPagamento,
              dia: colab.dia_pagamento || 5,
              tipo_dia: colab.tipo_dia_pagamento || "fixo",
              pago: false,
            });
          }
        } else {
          listaPagamentos.push({
            colaborador_nome: colab.nome_completo || "Colaborador",
            tipo: "Salário",
            valor: folha.salario_liquido || 0,
            dia: colab.dia_pagamento || 5,
            tipo_dia: colab.tipo_dia_pagamento || "fixo",
            pago: false,
          });
        }
      });
    }

    // Agrupar por dia de pagamento
    const grupos = {};
    listaPagamentos.forEach((pag) => {
      const key = pag.dia;
      if (!grupos[key]) {
        grupos[key] = {
          dia: pag.dia,
          tipo_dia: pag.tipo_dia,
          total: 0,
          pagamentos: [],
        };
      }
      grupos[key].total += pag.valor;
      grupos[key].pagamentos.push(pag);
    });

    const arrayGrupos = Object.values(grupos).sort((a, b) => a.dia - b.dia);
    return arrayGrupos;
  }, [folhasNoPeriodo, colaboradores, temFolhaGerada]);

  // Contas a pagar de compras: apenas pendentes/vencidas
  const totalContasPagarCompras = useMemo(() => {
    if (!Array.isArray(contasPagarCompras)) return 0;
    return contasPagarCompras
      .filter((c) => c.status === "Pendente" || c.status === "Em aberto" || c.status === "Vencida")
      .reduce((s, c) => s + (c.valor_total || c.valor || 0), 0);
  }, [contasPagarCompras]);

  // Meta do mês
  const [ano, mes] = mesAno.split("-").map(Number);
  const metaMes = useMemo(() => {
    if (!Array.isArray(metas)) return null;
    return metas.find((m) => m.mes === mes && m.ano === ano);
  }, [metas, mes, ano]);

  const percentualMeta = metaMes?.valor_meta > 0
    ? Math.round((dre.receitaBruta / metaMes.valor_meta) * 100)
    : null;

  const vendasNoPeriodo = useMemo(() => {
    if (dreModo !== "intervalo") {
      return vendas.filter((v) => v.data_venda?.slice(0, 7) === mesAno && !isVendaCancelada(v));
    }

    const inicio = dreDataInicio ? new Date(dreDataInicio) : null;
    const fim = dreDataFim ? new Date(dreDataFim) : null;
    if (!inicio || !fim) return [];
    fim.setHours(23, 59, 59, 999);

    return vendas.filter((v) => {
      if (isVendaCancelada(v)) return false;
      const dataVenda = new Date(v.data_venda);
      if (Number.isNaN(dataVenda.getTime())) return false;
      return dataVenda >= inicio && dataVenda <= fim;
    });
  }, [vendas, dreModo, mesAno, dreDataInicio, dreDataFim]);

  const mesAnoFinalTendencia = useMemo(() => {
    if (dreModo === "mensal") return mesAno;
    if (dreDataFim?.length >= 7) return dreDataFim.slice(0, 7);
    return new Date().toISOString().slice(0, 7);
  }, [dreModo, mesAno, dreDataFim]);

  const dreTendencia = useMemo(
    () => calcularDRESerieMensal12Meses({ vendas, lancamentos, mesAnoFinal: mesAnoFinalTendencia }),
    [vendas, lancamentos, mesAnoFinalTendencia]
  );

  const maxLucroAbsoluto = useMemo(() => {
    const valores = dreTendencia.map((m) => Math.abs(m.lucroOperacional || 0));
    return Math.max(1, ...valores);
  }, [dreTendencia]);

  const descricaoPeriodoDre = dreModo === "mensal"
    ? mesAno
    : `${dreDataInicio || "--"} até ${dreDataFim || "--"}`;

  // Qtd de vendas atrasadas A/R
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const receiverVencidas = itensReceber.filter((v) => {
    if (!v.prazo_entrega) return false;
    return new Date(v.prazo_entrega + "T00:00:00") < hoje;
  }).length;

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard
          titulo="Receita Bruta"
          valor={dre.receitaBruta}
          subtitulo={`${vendasNoPeriodo.length} pedido(s)`}
          icon={ShoppingCart}
          cor="green"
        />
        <KPICard
          titulo="Recebido"
          valor={receitaRecebida}
          subtitulo={`${Math.round(dre.receitaBruta > 0 ? (receitaRecebida / dre.receitaBruta) * 100 : 0)}% da receita`}
          icon={TrendingUp}
          cor="blue"
        />
        <KPICard
          titulo="A Receber"
          valor={totalReceber}
          subtitulo={receiverVencidas > 0 ? `${receiverVencidas} vencido(s)` : `${itensReceber.length} pedido(s)`}
          icon={AlertCircle}
          cor={receiverVencidas > 0 ? "red" : "orange"}
        />
        <KPICard
          titulo="Saldo de Caixa"
          valor={saldoCaixa}
          subtitulo={saldoCaixa >= 0 ? "Positivo no mês" : "Negativo no mês"}
          icon={DollarSign}
          cor={saldoCaixa >= 0 ? "green" : "red"}
        />
        <KPICard
          titulo={temFolhaGerada ? "Folha do Mês" : "Folha do Mês (est.)"}
          valor={totalFolhaMes}
          subtitulo={folhaLabel}
          icon={Users}
          cor="gray"
          onClick={() => setModalPagamentosAberto(true)}
        />
        <KPICard
          titulo="Comissões"
          valor={totalComissoesMes}
          subtitulo="A pagar no mês"
          icon={Target}
          cor="orange"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* DRE Simplificado */}
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-gray-800 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              DRE Simplificado — {descricaoPeriodoDre}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DRELinha label="(+) Receita Bruta de Vendas" valor={dre.receitaBruta} />
            {dre.descontos > 0 && (
              <DRELinha label="(–) Descontos Concedidos" valor={dre.descontos} negativo nivel={1} />
            )}
            <DRELinha label="(=) Receita Líquida" valor={dre.receitaLiquida} destaque />
            {dre.despesasLancadas > 0 && (
              <DRELinha label="(–) Despesas Operacionais" valor={dre.despesasLancadas} negativo nivel={1} />
            )}
            {totalFolhaMes > 0 && (
              <DRELinha label={temFolhaGerada ? "(–) Folha de Pagamento" : "(–) Folha de Pagamento (est.)"} valor={totalFolhaMes} negativo nivel={1} />
            )}
            {totalComissoesMes > 0 && (
              <DRELinha label="(–) Comissões de Vendas" valor={totalComissoesMes} negativo nivel={1} />
            )}
            <DRELinha label="(=) Resultado Operacional" valor={temFolhaGerada ? dre.resultadoOperacional : dre.resultadoOperacional - folhaEstimada.total + totalFolhaDRE} destaque />

            <div className="pt-3 border-t border-gray-200 dark:border-neutral-700">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                Tendência de Resultado Operacional (12 meses)
              </p>
              <div className="space-y-1.5">
                {dreTendencia.map((item) => {
                  const valor = item.lucroOperacional || 0;
                  const percentual = (Math.abs(valor) / maxLucroAbsoluto) * 100;
                  const positivo = valor >= 0;
                  return (
                    <div key={item.mesAno} className="grid grid-cols-[56px_1fr_112px] items-center gap-2 text-xs">
                      <span className="text-gray-500 dark:text-gray-400">{item.label}</span>
                      <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-neutral-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${positivo ? "bg-emerald-500" : "bg-red-500"}`}
                          style={{ width: `${Math.min(100, percentual)}%` }}
                        />
                      </div>
                      <span className={`text-right tabular-nums font-medium ${positivo ? "text-emerald-600" : "text-red-600"}`}>
                        R$ {fmt(valor)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Meta + Alertas */}
        <div className="space-y-4">
          {/* Meta de Vendas */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-orange-500" />
                Meta do Mês
              </CardTitle>
            </CardHeader>
            <CardContent>
              {metaMes ? (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Meta:</span>
                    <span className="font-semibold">R$ {fmt(metaMes.valor_meta)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Realizado:</span>
                    <span className={`font-semibold ${dre.receitaBruta >= metaMes.valor_meta ? "text-green-600" : "text-orange-600"}`}>
                      R$ {fmt(dre.receitaBruta)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-neutral-700 rounded-full h-2 mt-2">
                    <div
                      className={`h-2 rounded-full transition-all ${percentualMeta >= 100 ? "bg-green-500" : percentualMeta >= 70 ? "bg-orange-400" : "bg-red-400"}`}
                      style={{ width: `${Math.min(percentualMeta, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 text-right">{percentualMeta}% atingido</p>
                </div>
              ) : (
                <p className="text-sm text-gray-400 py-2">Nenhuma meta cadastrada para este mês.</p>
              )}
            </CardContent>
          </Card>

          {/* Resumo de Pendências */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                Pendências Financeiras
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                  <ArrowDown className="w-3.5 h-3.5 text-orange-500" />
                  <span className="text-gray-600 dark:text-gray-400">A Receber (vendas)</span>
                </div>
                <span className="font-semibold text-orange-600">R$ {fmt(totalReceber)}</span>
              </div>
              {totalContasPagarCompras > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <ArrowUp className="w-3.5 h-3.5 text-red-500" />
                    <span className="text-gray-600 dark:text-gray-400">A Pagar (compras)</span>
                  </div>
                  <span className="font-semibold text-red-600">R$ {fmt(totalContasPagarCompras)}</span>
                </div>
              )}
              {totalFolhaMesPendente > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <ArrowUp className="w-3.5 h-3.5 text-red-500" />
                    <span className="text-gray-600 dark:text-gray-400">Folha de Pagamento</span>
                  </div>
                  <span className="font-semibold text-red-600">R$ {fmt(totalFolhaMesPendente)}</span>
                </div>
              )}
              {totalComissoesMes > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <ArrowUp className="w-3.5 h-3.5 text-red-500" />
                    <span className="text-gray-600 dark:text-gray-400">Comissões a Pagar</span>
                  </div>
                  <span className="font-semibold text-red-600">R$ {fmt(totalComissoesMes)}</span>
                </div>
              )}
              {totalReceber === 0 && totalContasPagarCompras === 0 && totalFolhaMesPendente === 0 && totalComissoesMes === 0 && (
                <p className="text-sm text-gray-400 py-1">Sem pendências no período.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Próximas vendas com saldo em aberto (top 5) */}
      {itensReceber.length > 0 && (
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-gray-800 dark:text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-500" />
                Saldo Pendente por Pedido
              </div>
              <Badge variant="outline" className="text-xs font-normal">
                {itensReceber.length} pedido(s) • R$ {fmt(totalReceber)}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {itensReceber
                .sort((a, b) => (b.valor_restante || 0) - (a.valor_restante || 0))
                .slice(0, 5)
                .map((v) => {
                  const vencida = v.prazo_entrega && new Date(v.prazo_entrega) < hoje;
                  return (
                    <div
                      key={v.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-neutral-800 gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                          {v.cliente_nome || "—"}
                        </p>
                        <p className="text-xs text-gray-400">
                          Pedido #{v.numero_pedido}
                          {v.prazo_entrega ? ` • prazo ${new Date(v.prazo_entrega).toLocaleDateString("pt-BR")}` : ""}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-semibold ${vencida ? "text-red-600" : "text-orange-600"}`}>
                          R$ {fmt(v.valor_restante)}
                        </p>
                        {vencida && (
                          <Badge className="text-xs bg-red-100 text-red-700 border-0">Vencido</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              {itensReceber.length > 5 && (
                <p className="text-xs text-center text-gray-400 pt-1">
                  + {itensReceber.length - 5} pedido(s) - veja tudo em &quot;Contas a Receber&quot;
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal de Detalhamento da Folha */}
      <Dialog open={modalPagamentosAberto} onOpenChange={setModalPagamentosAberto}>
        <DialogContent className="sm:max-w-[600px] border-0 shadow-xl bg-white dark:bg-neutral-900 rounded-xl overflow-hidden p-0">
          <DialogHeader className="p-6 pb-4 border-b border-gray-100 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-900/50">
            <DialogTitle className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Detalhamento de Pagamentos — {formatMesAno(mesAno)}
            </DialogTitle>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {temFolhaGerada 
                ? "Demonstrativo dos pagamentos baseados na folha fechada do mês." 
                : "Estimativa baseada nos colaboradores ativos e suas configurações de contrato."}
            </p>
          </DialogHeader>

          <div className="p-6 max-h-[60vh] overflow-y-auto space-y-6">
            {!temFolhaGerada && (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/30 flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-amber-800 dark:text-amber-300">
                  <span className="font-semibold block mb-0.5">Valores Estimados</span>
                  A folha deste mês ainda não foi gerada no módulo de RH. Exibindo estimativa com base nos salários e vales contratuais dos colaboradores ativos.
                </div>
              </div>
            )}

            {pagamentosAgrupados.length === 0 ? (
              <div className="text-center py-10 text-gray-500 dark:text-gray-400">
                <Users className="w-10 h-10 mx-auto text-gray-300 dark:text-neutral-700 mb-2" />
                <p className="text-sm font-medium">Nenhum pagamento previsto para este período.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {pagamentosAgrupados.map((grupo) => (
                  <div key={grupo.dia} className="border border-gray-100 dark:border-neutral-800 rounded-xl overflow-hidden shadow-sm">
                    {/* Header do Grupo por Data */}
                    <div className="bg-gray-50 dark:bg-neutral-800/40 px-4 py-3 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                          Dia {grupo.dia} {grupo.tipo_dia === "util" ? "(Dia Útil)" : ""}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-gray-400 dark:text-gray-500 mr-1.5 uppercase font-medium tracking-wider">Total do Dia:</span>
                        <span className="text-sm font-extrabold text-gray-900 dark:text-white">
                          R$ {fmt(grupo.total)}
                        </span>
                      </div>
                    </div>

                    {/* Lista de Pagamentos do Grupo */}
                    <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                      {grupo.pagamentos.map((pag, idx) => (
                        <div key={idx} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50/50 dark:hover:bg-neutral-800/10 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                              {pag.colaborador_nome}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge 
                                variant="outline" 
                                className={`text-[10px] py-0 px-2 font-semibold ${
                                  pag.tipo === "Vale"
                                    ? "bg-purple-50 text-purple-700 border-purple-200/50 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/30"
                                    : "bg-blue-50 text-blue-700 border-blue-200/50 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30"
                                }`}
                              >
                                {pag.tipo}
                              </Badge>
                              <span className="text-xs text-gray-400 dark:text-gray-500">
                                {pag.tipo_dia === "util" ? `${pag.dia}º dia útil` : `todo dia ${pag.dia}`}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-sm font-bold text-gray-800 dark:text-gray-200 tabular-nums">
                              R$ {fmt(pag.valor)}
                            </span>
                            {temFolhaGerada ? (
                              <Badge 
                                className={`text-[10px] py-0.5 px-2 font-semibold border-0 ${
                                  pag.pago
                                    ? "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                                    : "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400"
                                }`}
                              >
                                {pag.pago ? "Pago" : "Pendente"}
                              </Badge>
                            ) : (
                              <Badge className="text-[10px] py-0.5 px-2 font-semibold bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-0">
                                Previsto
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer com o Somatório Geral */}
          <div className="p-6 bg-gray-50 dark:bg-neutral-800/20 border-t border-gray-100 dark:border-neutral-800">
            {temFolhaGerada ? (
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-gray-100/50 dark:bg-neutral-800/20 p-2.5 rounded-lg">
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold tracking-wider block">
                    Total da Folha
                  </span>
                  <span className="text-base font-extrabold text-gray-800 dark:text-gray-250 tabular-nums block mt-1">
                    R$ {fmt(totalFolhaMes)}
                  </span>
                </div>
                <div className="bg-green-50/50 dark:bg-green-950/10 p-2.5 rounded-lg">
                  <span className="text-[10px] text-green-600 dark:text-green-500 uppercase font-bold tracking-wider block">
                    Total Pago
                  </span>
                  <span className="text-base font-extrabold text-green-600 dark:text-green-400 tabular-nums block mt-1">
                    R$ {fmt(totalFolhaMes - totalFolhaMesPendente)}
                  </span>
                </div>
                <div className="bg-red-50/50 dark:bg-red-950/10 p-2.5 rounded-lg">
                  <span className="text-[10px] text-red-600 dark:text-red-500 uppercase font-bold tracking-wider block">
                    A Pagar
                  </span>
                  <span className="text-base font-extrabold text-red-600 dark:text-red-400 tabular-nums block mt-1">
                    R$ {fmt(totalFolhaMesPendente)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-gray-400 dark:text-gray-500 uppercase font-semibold tracking-wider block">
                    Total Geral da Folha (est.)
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 block">
                    Valor total estimado
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
                    R$ {fmt(totalFolhaMes)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
