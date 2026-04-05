import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, Search, TrendingDown } from "lucide-react";
import { calcularContasReceber, classificarContasReceber } from "@/services/financeiroAggregation";

const fmt = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_COLORS = {
  vencida:  { bg: "bg-red-100 dark:bg-red-900/30",    text: "text-red-700 dark:text-red-400",    label: "Vencido" },
  em_dia:   { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400", label: "Em dia" },
  sem_prazo: { bg: "bg-gray-100 dark:bg-neutral-700",   text: "text-gray-600 dark:text-gray-400",  label: "Sem prazo" },
};

function StatusBadge({ tipo }) {
  const c = STATUS_COLORS[tipo] || STATUS_COLORS.sem_prazo;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

export default function ContasReceber({ vendas = [], isLoading = false }) {
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroLoja, setFiltroLoja] = useState("todas");
  const [ordenacao, setOrdenacao] = useState("valor_desc");

  const hoje = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }, []);

  const { total: totalReceber, itens } = useMemo(
    () => calcularContasReceber(vendas),
    [vendas]
  );
  const classificados = useMemo(() => classificarContasReceber(itens), [itens]);

  const lojas = useMemo(
    () => [...new Set(itens.map((v) => v.loja).filter(Boolean))].sort(),
    [itens]
  );

  const itensFiltrados = useMemo(() => {
    let lista = itens.map((v) => {
      const vencida = v.prazo_entrega && new Date(v.prazo_entrega + "T00:00:00") < hoje;
      const semPrazo = !v.prazo_entrega;
      return { ...v, _statusAR: vencida ? "vencida" : semPrazo ? "sem_prazo" : "em_dia" };
    });

    if (busca) {
      const t = busca.toLowerCase();
      lista = lista.filter(
        (v) =>
          v.cliente_nome?.toLowerCase().includes(t) ||
          v.numero_pedido?.toLowerCase().includes(t)
      );
    }
    if (filtroStatus !== "todos") {
      lista = lista.filter((v) => v._statusAR === filtroStatus);
    }
    if (filtroLoja !== "todas") {
      lista = lista.filter((v) => v.loja === filtroLoja);
    }

    switch (ordenacao) {
      case "valor_desc": lista.sort((a, b) => (b.valor_restante || 0) - (a.valor_restante || 0)); break;
      case "valor_asc":  lista.sort((a, b) => (a.valor_restante || 0) - (b.valor_restante || 0)); break;
      case "data_asc":   lista.sort((a, b) => (a.prazo_entrega || "").localeCompare(b.prazo_entrega || "")); break;
      case "cliente":    lista.sort((a, b) => (a.cliente_nome || "").localeCompare(b.cliente_nome || "")); break;
      default: break;
    }

    return lista;
  }, [itens, busca, filtroStatus, filtroLoja, ordenacao, hoje]);

  const totalFiltrado = itensFiltrados.reduce((s, v) => s + (v.valor_restante || 0), 0);

  if (isLoading) {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: "Em dia",
            count: classificados.em_dia.length,
            total: classificados.em_dia.reduce((s, v) => s + (v.valor_restante || 0), 0),
            cor: "text-green-600",
          },
          {
            label: "Vencidos",
            count: classificados.vencidas.length,
            total: classificados.vencidas.reduce((s, v) => s + (v.valor_restante || 0), 0),
            cor: "text-red-600",
          },
          {
            label: "Sem prazo",
            count: classificados.sem_prazo.length,
            total: classificados.sem_prazo.reduce((s, v) => s + (v.valor_restante || 0), 0),
            cor: "text-gray-500",
          },
        ].map((item) => (
          <Card key={item.label} className="border-0 shadow-md">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide">{item.label}</p>
              <p className={`text-xl font-bold ${item.cor}`}>R$ {fmt(item.total)}</p>
              <p className="text-xs text-gray-400">{item.count} pedido(s)</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar cliente ou pedido..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-36 text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="vencida">Vencidos</SelectItem>
                <SelectItem value="em_dia">Em dia</SelectItem>
                <SelectItem value="sem_prazo">Sem prazo</SelectItem>
              </SelectContent>
            </Select>
            {lojas.length > 1 && (
              <Select value={filtroLoja} onValueChange={setFiltroLoja}>
                <SelectTrigger className="w-36 text-sm">
                  <SelectValue placeholder="Loja" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as lojas</SelectItem>
                  {lojas.map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={ordenacao} onValueChange={setOrdenacao}>
              <SelectTrigger className="w-40 text-sm">
                <SelectValue placeholder="Ordenar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="valor_desc">Maior valor</SelectItem>
                <SelectItem value="valor_asc">Menor valor</SelectItem>
                <SelectItem value="data_asc">Prazo mais próximo</SelectItem>
                <SelectItem value="cliente">Cliente A-Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {itensFiltrados.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <TrendingDown className="w-10 h-10 mx-auto mb-2 opacity-30" />
              {itens.length === 0
                ? "Nenhum pedido com saldo em aberto."
                : "Nenhum resultado para os filtros selecionados."}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="text-xs text-gray-400 uppercase">
                    <TableHead>Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Loja</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Pago</TableHead>
                    <TableHead className="text-orange-600">Saldo</TableHead>
                    <TableHead>Prazo</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itensFiltrados.map((v) => (
                    <TableRow key={v.id} className="text-sm hover:bg-gray-50 dark:hover:bg-neutral-800">
                      <TableCell className="font-medium text-green-700 dark:text-green-400">
                        #{v.numero_pedido || "—"}
                      </TableCell>
                      <TableCell>{v.cliente_nome || "—"}</TableCell>
                      <TableCell className="text-gray-500">{v.loja || "—"}</TableCell>
                      <TableCell>R$ {fmt(v.valor_total)}</TableCell>
                      <TableCell className="text-green-600">R$ {fmt(v.valor_pago)}</TableCell>
                      <TableCell className="font-semibold text-orange-600">
                        R$ {fmt(v.valor_restante)}
                      </TableCell>
                      <TableCell className="text-gray-500 text-xs">
                        {v.prazo_entrega
                          ? new Date(v.prazo_entrega + "T00:00:00").toLocaleDateString("pt-BR")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge tipo={v._statusAR} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-between items-center text-sm text-gray-500 pt-3 border-t border-gray-100 dark:border-neutral-700 mt-2">
                <span>{itensFiltrados.length} pedido(s) exibido(s)</span>
                <span className="font-semibold text-orange-600">
                  Total filtrado: R$ {fmt(totalFiltrado)}
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
