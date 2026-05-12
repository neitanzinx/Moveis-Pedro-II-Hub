import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, TrendingDown, DollarSign, AlertCircle,
  Target, Users, ShoppingCart, ArrowUp, ArrowDown
} from "lucide-react";
import {
  calcularDRE,
  calcularReceitaRecebida,
  calcularContasReceber,
  calcularTotalFolha,
  calcularTotalComissoes,
  filtrarPorMes,
  normalizeTipo,
} from "@/services/financeiroAggregation";
import { isVendaCancelada } from "@/utils/vendaStatus";

const fmt = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function KPICard({ titulo, valor, subtitulo, icon: Icon, cor, variante = "default" }) {
  const cores = {
    green:  { bg: "bg-green-50 dark:bg-green-900/20", icon: "text-green-600", valor: "text-green-700 dark:text-green-400" },
    red:    { bg: "bg-red-50 dark:bg-red-900/20",     icon: "text-red-600",   valor: "text-red-700 dark:text-red-400" },
    orange: { bg: "bg-orange-50 dark:bg-orange-900/20", icon: "text-orange-600", valor: "text-orange-700 dark:text-orange-400" },
    blue:   { bg: "bg-blue-50 dark:bg-blue-900/20",   icon: "text-blue-600",  valor: "text-blue-700 dark:text-blue-400" },
    gray:   { bg: "bg-gray-50 dark:bg-neutral-800",   icon: "text-gray-500",  valor: "text-gray-700 dark:text-gray-300" },
  };
  const c = cores[cor] || cores.gray;

  return (
    <Card className="border-0 shadow-md">
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
  mesAno,
}) {
  const dre = useMemo(
    () => calcularDRE({ vendas, lancamentos, folhas, comissoes, mesAno }),
    [vendas, lancamentos, folhas, comissoes, mesAno]
  );

  const receitaRecebida = useMemo(
    () => calcularReceitaRecebida(vendas, mesAno),
    [vendas, mesAno]
  );

  const { total: totalReceber, itens: itensReceber } = useMemo(
    () => calcularContasReceber(vendas),
    [vendas]
  );

  const lancamentosDoMes = useMemo(
    () => lancamentos.filter((l) => l.data_lancamento?.slice(0, 7) === mesAno),
    [lancamentos, mesAno]
  );

  const totalEntradasLancamentos = lancamentosDoMes
    .filter((l) => normalizeTipo(l.tipo) === "entrada")
    .reduce((s, l) => s + Math.abs(l.valor || 0), 0);

  const totalSaidasLancamentos = lancamentosDoMes
    .filter((l) => normalizeTipo(l.tipo) === "saida")
    .reduce((s, l) => s + Math.abs(l.valor || 0), 0);

  const saldoCaixa = totalEntradasLancamentos - totalSaidasLancamentos;

  const totalFolhaMes = useMemo(
    () => calcularTotalFolha(folhas, mesAno),
    [folhas, mesAno]
  );

  const totalComissoesMes = useMemo(
    () => calcularTotalComissoes(comissoes, mesAno),
    [comissoes, mesAno]
  );

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
          subtitulo={`${vendas.filter((v) => v.data_venda?.slice(0, 7) === mesAno && !isVendaCancelada(v)).length} pedido(s)`}
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
          titulo="Folha do Mês"
          valor={totalFolhaMes}
          subtitulo={`${folhas.filter((f) => {
            const [a, m2] = mesAno.split("-").map(Number);
            return f.ano_referencia === a && f.mes_referencia === m2;
          }).length} colaborador(es)`}
          icon={Users}
          cor="gray"
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
              DRE Simplificado — {mesAno}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0.5">
            <DRELinha label="(+) Receita Bruta de Vendas" valor={dre.receitaBruta} />
            {dre.descontos > 0 && (
              <DRELinha label="(–) Descontos Concedidos" valor={dre.descontos} negativo nivel={1} />
            )}
            <DRELinha label="(=) Receita Líquida" valor={dre.receitaLiquida} destaque />
            {dre.despesasLancadas > 0 && (
              <DRELinha label="(–) Despesas Operacionais" valor={dre.despesasLancadas} negativo nivel={1} />
            )}
            {totalFolhaMes > 0 && (
              <DRELinha label="(–) Folha de Pagamento" valor={totalFolhaMes} negativo nivel={1} />
            )}
            {totalComissoesMes > 0 && (
              <DRELinha label="(–) Comissões de Vendas" valor={totalComissoesMes} negativo nivel={1} />
            )}
            <DRELinha label="(=) Resultado Operacional" valor={dre.resultadoOperacional} destaque />
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
              {totalFolhaMes > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <ArrowUp className="w-3.5 h-3.5 text-red-500" />
                    <span className="text-gray-600 dark:text-gray-400">Folha de Pagamento</span>
                  </div>
                  <span className="font-semibold text-red-600">R$ {fmt(totalFolhaMes)}</span>
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
              {totalReceber === 0 && totalContasPagarCompras === 0 && totalFolhaMes === 0 && totalComissoesMes === 0 && (
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
                  + {itensReceber.length - 5} pedido(s) — veja tudo em "Contas a Receber"
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
