import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, TrendingDown, DollarSign, CheckCircle2, Clock } from "lucide-react";
import { normalizeTipo } from "@/services/financeiroAggregation";

const fmt = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const EPSILON = 0.01;

const STATUS_COLORS = {
  vencida:   { bg: "bg-red-100 dark:bg-red-900/30",    text: "text-red-700 dark:text-red-400",    label: "Vencido" },
  em_dia:    { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400", label: "Em dia" },
  sem_prazo: { bg: "bg-gray-100 dark:bg-neutral-700",   text: "text-gray-600 dark:text-gray-400",  label: "Sem prazo" },
};

// ─── Já Entrou ──────────────────────────────────────────────────────────────────
function SecaoJaEntrou({ vendas, lancamentos, mesAno }) {
  const [busca, setBusca] = useState("");

  const vendasPagas = useMemo(() =>
    vendas.filter(
      (v) =>
        v.status !== "Cancelada" &&
        (v.valor_pago || 0) > EPSILON &&
        (v.valor_restante || 0) <= EPSILON &&
        v.data_venda?.slice(0, 7) === mesAno
    ), [vendas, mesAno]);

  const lancsEntradaPagos = useMemo(() =>
    lancamentos.filter(
      (l) =>
        normalizeTipo(l.tipo) === "entrada" &&
        l.status === "Pago" &&
        l.data_lancamento?.slice(0, 7) === mesAno
    ), [lancamentos, mesAno]);

  const totalVendas = vendasPagas.reduce((s, v) => s + (v.valor_pago || 0), 0);
  const totalLancs  = lancsEntradaPagos.reduce((s, l) => s + Math.abs(l.valor || 0), 0);

  const vendasFiltradas = useMemo(() => {
    if (!busca) return vendasPagas;
    const t = busca.toLowerCase();
    return vendasPagas.filter(
      (v) => v.cliente_nome?.toLowerCase().includes(t) || v.numero_pedido?.toLowerCase().includes(t)
    );
  }, [vendasPagas, busca]);

  const lancsFiltrados = useMemo(() => {
    if (!busca) return lancsEntradaPagos;
    const t = busca.toLowerCase();
    return lancsEntradaPagos.filter(
      (l) => l.descricao?.toLowerCase().includes(t) || l.categoria_nome?.toLowerCase().includes(t)
    );
  }, [lancsEntradaPagos, busca]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Vendas recebidas",      total: totalVendas,              count: vendasPagas.length,        cor: "text-green-600" },
          { label: "Lançamentos recebidos", total: totalLancs,               count: lancsEntradaPagos.length,  cor: "text-blue-600" },
          { label: "Total entrado",         total: totalVendas + totalLancs, count: vendasPagas.length + lancsEntradaPagos.length, cor: "text-green-700" },
        ].map((item) => (
          <Card key={item.label} className="border-0 shadow-md">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide">{item.label}</p>
              <p className={`text-xl font-bold ${item.cor}`}>R$ {fmt(item.total)}</p>
              <p className="text-xs text-gray-400">{item.count} item(ns)</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <Input placeholder="Buscar cliente, pedido ou descrição..." value={busca}
              onChange={(e) => setBusca(e.target.value)} className="pl-9 text-sm" />
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-6">
          {vendasFiltradas.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-green-700 mb-2 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Vendas recebidas
              </p>
              <Table>
                <TableHeader>
                  <TableRow className="text-xs text-gray-400 uppercase">
                    <TableHead>Pedido</TableHead><TableHead>Cliente</TableHead><TableHead>Loja</TableHead>
                    <TableHead>Forma</TableHead><TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right text-green-600">Recebido</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendasFiltradas.map((v) => (
                    <TableRow key={v.id} className="text-sm hover:bg-gray-50 dark:hover:bg-neutral-800">
                      <TableCell className="font-medium text-green-700 dark:text-green-400">#{v.numero_pedido || "—"}</TableCell>
                      <TableCell>{v.cliente_nome || "—"}</TableCell>
                      <TableCell className="text-gray-500">{v.loja || "—"}</TableCell>
                      <TableCell className="text-gray-500 text-xs">{v.forma_pagamento || "—"}</TableCell>
                      <TableCell className="text-right">R$ {fmt(v.valor_total)}</TableCell>
                      <TableCell className="text-right font-semibold text-green-600">R$ {fmt(v.valor_pago)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {lancsFiltrados.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 mb-2 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5" /> Lançamentos de entrada
              </p>
              <Table>
                <TableHeader>
                  <TableRow className="text-xs text-gray-400 uppercase">
                    <TableHead>Descrição</TableHead><TableHead>Categoria</TableHead>
                    <TableHead>Forma</TableHead><TableHead>Data</TableHead>
                    <TableHead className="text-right text-green-600">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lancsFiltrados.map((l) => (
                    <TableRow key={l.id} className="text-sm hover:bg-gray-50 dark:hover:bg-neutral-800">
                      <TableCell className="font-medium">{l.descricao || "—"}</TableCell>
                      <TableCell className="text-gray-500">{l.categoria_nome || "—"}</TableCell>
                      <TableCell className="text-gray-500 text-xs">{l.forma_pagamento || "—"}</TableCell>
                      <TableCell className="text-gray-500 text-xs">
                        {l.data_lancamento ? new Date(l.data_lancamento + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-600">R$ {fmt(l.valor)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {vendasFiltradas.length === 0 && lancsFiltrados.length === 0 && (
            <div className="text-center py-10 text-gray-400">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>Nenhuma entrada registrada neste mês.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Para Entrar ────────────────────────────────────────────────────────────────
function SecaoParaEntrar({ vendas, lancamentos, entregas }) {
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [ordenacao, setOrdenacao] = useState("valor_desc");

  const hoje = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  const vendasPendentes = useMemo(() =>
    vendas.filter((v) => v.status !== "Cancelada" && (v.valor_restante || 0) > EPSILON),
    [vendas]);

  const lancsEntradaPendentes = useMemo(() =>
    lancamentos.filter((l) => normalizeTipo(l.tipo) === "entrada" && l.status === "Pendente"),
    [lancamentos]);

  // Build a map of venda_id -> entrega for fast lookup
  const entregaMap = useMemo(() => {
    const map = {};
    for (const e of entregas) {
      if (e.venda_id && !map[e.venda_id]) map[e.venda_id] = e;
    }
    return map;
  }, [entregas]);

  const vendasComStatus = useMemo(() =>
    vendasPendentes.map((v) => {
      const entrega = entregaMap[v.id];
      const dataAgendada = entrega?.data_agendada ? entrega.data_agendada.slice(0, 10) : null;
      const vencida  = dataAgendada && new Date(dataAgendada + "T00:00:00") < hoje;
      const semPrazo = !dataAgendada;
      return { ...v, _status: vencida ? "vencida" : semPrazo ? "sem_prazo" : "em_dia", _dataAgendada: dataAgendada || null };
    }), [vendasPendentes, entregaMap, hoje]);

  const vendasFiltradas = useMemo(() => {
    let lista = vendasComStatus;
    if (busca) {
      const t = busca.toLowerCase();
      lista = lista.filter(
        (v) => v.cliente_nome?.toLowerCase().includes(t) || v.numero_pedido?.toLowerCase().includes(t)
      );
    }
    if (filtroStatus !== "todos") lista = lista.filter((v) => v._status === filtroStatus);
    switch (ordenacao) {
      case "valor_desc": lista = [...lista].sort((a,b) => (b.valor_restante||0) - (a.valor_restante||0)); break;
      case "valor_asc":  lista = [...lista].sort((a,b) => (a.valor_restante||0) - (b.valor_restante||0)); break;
      case "data_asc":   lista = [...lista].sort((a,b) => (a._dataAgendada||"").localeCompare(b._dataAgendada||"")); break;
      case "cliente":    lista = [...lista].sort((a,b) => (a.cliente_nome||"").localeCompare(b.cliente_nome||"")); break;
    }
    return lista;
  }, [vendasComStatus, busca, filtroStatus, ordenacao]);

  const lancsFiltrados = useMemo(() => {
    if (!busca) return lancsEntradaPendentes;
    const t = busca.toLowerCase();
    return lancsEntradaPendentes.filter(
      (l) => l.descricao?.toLowerCase().includes(t) || l.categoria_nome?.toLowerCase().includes(t)
    );
  }, [lancsEntradaPendentes, busca]);

  const totalVendas = vendasPendentes.reduce((s, v) => s + (v.valor_restante || 0), 0);
  const totalLancs  = lancsEntradaPendentes.reduce((s, l) => s + Math.abs(l.valor || 0), 0);
  const vencidas    = vendasComStatus.filter((v) => v._status === "vencida").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Vendas pendentes",       total: totalVendas,              count: vendasPendentes.length,        cor: "text-orange-600" },
          { label: "Lançamentos pendentes",  total: totalLancs,               count: lancsEntradaPendentes.length,  cor: "text-blue-600" },
          { label: "Total a entrar",         total: totalVendas + totalLancs, count: vendasPendentes.length + lancsEntradaPendentes.length, cor: "text-orange-700" },
        ].map((item) => (
          <Card key={item.label} className="border-0 shadow-md">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide">{item.label}</p>
              <p className={`text-xl font-bold ${item.cor}`}>R$ {fmt(item.total)}</p>
              <p className="text-xs text-gray-400">{item.count} item(ns)</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <Input placeholder="Buscar cliente, pedido ou descrição..." value={busca}
                onChange={(e) => setBusca(e.target.value)} className="pl-9 text-sm" />
            </div>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-36 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="vencida">Vencidos</SelectItem>
                <SelectItem value="em_dia">Em dia</SelectItem>
                <SelectItem value="sem_prazo">Sem prazo</SelectItem>
              </SelectContent>
            </Select>
            <Select value={ordenacao} onValueChange={setOrdenacao}>
              <SelectTrigger className="w-40 text-sm"><SelectValue placeholder="Ordenar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="valor_desc">Maior valor</SelectItem>
                <SelectItem value="valor_asc">Menor valor</SelectItem>
                <SelectItem value="data_asc">Prazo mais próximo</SelectItem>
                <SelectItem value="cliente">Cliente A-Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-6">
          {vendasFiltradas.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-600 mb-2 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" /> Vendas com saldo em aberto
                {vencidas > 0 && <Badge className="bg-red-100 text-red-700 text-[10px]">{vencidas} vencida(s)</Badge>}
              </p>
              <Table>
                <TableHeader>
                  <TableRow className="text-xs text-gray-400 uppercase">
                    <TableHead>Pedido</TableHead><TableHead>Cliente</TableHead><TableHead>Loja</TableHead>
                    <TableHead>Total</TableHead><TableHead>Pago</TableHead>
                    <TableHead className="text-orange-600">Saldo</TableHead>
                    <TableHead>Prazo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendasFiltradas.map((v) => {
                    const c = STATUS_COLORS[v._status] || STATUS_COLORS.sem_prazo;
                    return (
                      <TableRow key={v.id} className="text-sm hover:bg-gray-50 dark:hover:bg-neutral-800">
                        <TableCell className="font-medium text-green-700 dark:text-green-400">#{v.numero_pedido || "—"}</TableCell>
                        <TableCell>{v.cliente_nome || "—"}</TableCell>
                        <TableCell className="text-gray-500">{v.loja || "—"}</TableCell>
                        <TableCell>R$ {fmt(v.valor_total)}</TableCell>
                        <TableCell className="text-green-600">R$ {fmt(v.valor_pago)}</TableCell>
                        <TableCell className="font-semibold text-orange-600">R$ {fmt(v.valor_restante)}</TableCell>
                        <TableCell className="text-gray-500 text-xs">
                          {v._dataAgendada
                            ? new Date(v._dataAgendada.slice(0, 10) + "T00:00:00").toLocaleDateString("pt-BR")
                            : <span className="text-gray-400 italic">Ainda não definido</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <p className="text-xs text-gray-400 text-right pt-2">
                {vendasFiltradas.length} pedido(s) · Saldo: R$ {fmt(vendasFiltradas.reduce((s,v) => s + (v.valor_restante||0), 0))}
              </p>
            </div>
          )}
          {lancsFiltrados.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 mb-2 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5" /> Lançamentos de entrada pendentes
              </p>
              <Table>
                <TableHeader>
                  <TableRow className="text-xs text-gray-400 uppercase">
                    <TableHead>Descrição</TableHead><TableHead>Categoria</TableHead>
                    <TableHead>Forma</TableHead><TableHead>Data</TableHead>
                    <TableHead className="text-right text-orange-600">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lancsFiltrados.map((l) => (
                    <TableRow key={l.id} className="text-sm hover:bg-gray-50 dark:hover:bg-neutral-800">
                      <TableCell className="font-medium">{l.descricao || "—"}</TableCell>
                      <TableCell className="text-gray-500">{l.categoria_nome || "—"}</TableCell>
                      <TableCell className="text-gray-500 text-xs">{l.forma_pagamento || "—"}</TableCell>
                      <TableCell className="text-gray-500 text-xs">
                        {l.data_lancamento ? new Date(l.data_lancamento + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-orange-600">R$ {fmt(l.valor)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {vendasFiltradas.length === 0 && lancsFiltrados.length === 0 && (
            <div className="text-center py-10 text-gray-400">
              <TrendingDown className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>Nenhuma entrada pendente encontrada.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Componente principal ───────────────────────────────────────────────────────
export default function ContasReceber({ vendas = [], lancamentos = [], entregas = [], mesAno = "", isLoading = false }) {
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
    <Tabs defaultValue="para-entrar">
      <TabsList className="mb-4">
        <TabsTrigger value="para-entrar" className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" /> Para Entrar
        </TabsTrigger>
        <TabsTrigger value="ja-entrou" className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" /> Já Entrou
        </TabsTrigger>
      </TabsList>
      <TabsContent value="para-entrar">
        <SecaoParaEntrar vendas={vendas} lancamentos={lancamentos} entregas={entregas} />
      </TabsContent>
      <TabsContent value="ja-entrou">
        <SecaoJaEntrou vendas={vendas} lancamentos={lancamentos} mesAno={mesAno} />
      </TabsContent>
    </Tabs>
  );
}
