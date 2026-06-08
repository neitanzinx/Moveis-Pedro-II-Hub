import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Percent, Users, TrendingDown, Tag, Key, Store, Calendar, ChevronDown, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { isVendaCancelada } from "@/utils/vendaStatus";

const ORIGEM_LABELS = {
  margem_negociavel: { label: "Margem Livre", color: "bg-green-100 text-green-700" },
  token: { label: "Token Gerencial", color: "bg-amber-100 text-amber-700" },
  cupom: { label: "Cupom", color: "bg-purple-100 text-purple-700" },
  arredondamento: { label: "Arredondamento", color: "bg-blue-100 text-blue-700" },
  desconto_produto: { label: "Desc. por Produto", color: "bg-emerald-100 text-emerald-700" },
};

export default function RelatorioDescontos() {
  const { user, can, filterData } = useAuth();

  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [dataFim, setDataFim] = useState(() => new Date().toISOString().slice(0, 10));
  const [filtroVendedor, setFiltroVendedor] = useState("todos");
  const [filtroLoja, setFiltroLoja] = useState("todas");
  const [filtroOrigem, setFiltroOrigem] = useState("todas");
  const [linhasExpandidas, setLinhasExpandidas] = useState({});

  const { data: todasVendas = [], isLoading } = useQuery({
    queryKey: ["vendas"],
    queryFn: () => base44.entities.Venda.list("-data_venda"),
  });

  const { data: lojasData = [] } = useQuery({
    queryKey: ["lojas-ativas"],
    queryFn: () => base44.entities.Loja.list("nome"),
  });

  // Aplica filtro de escopo (RBAC)
  const vendasEscopo = useMemo(() => filterData(todasVendas, "store"), [todasVendas, filterData]);

  // Filtra vendas com desconto > 0, não canceladas, no período
  const vendasComDesconto = useMemo(() => {
    return vendasEscopo.filter(v => {
      if (isVendaCancelada(v)) return false;
      if ((v.desconto || 0) <= 0) return false;
      if (v.data_venda < dataInicio || v.data_venda > dataFim) return false;
      if (filtroVendedor !== "todos" && v.responsavel_id !== filtroVendedor) return false;
      if (filtroLoja !== "todas" && v.loja !== filtroLoja) return false;
      if (filtroOrigem !== "todas" && v.desconto_origem !== filtroOrigem) return false;
      return true;
    });
  }, [vendasEscopo, dataInicio, dataFim, filtroVendedor, filtroLoja, filtroOrigem]);

  // KPIs
  const kpis = useMemo(() => {
    const totalDescontos = vendasComDesconto.reduce((acc, v) => acc + (v.desconto || 0), 0);
    const percentMedio = vendasComDesconto.length > 0
      ? vendasComDesconto.reduce((acc, v) => acc + (v.desconto_percentual || 0), 0) / vendasComDesconto.length
      : 0;
    const totalVendas = vendasComDesconto.length;
    const valorMedio = totalVendas > 0 ? totalDescontos / totalVendas : 0;
    return { totalDescontos, percentMedio, totalVendas, valorMedio };
  }, [vendasComDesconto]);

  // Agrupamento por vendedor
  const porVendedor = useMemo(() => {
    const map = {};
    for (const v of vendasComDesconto) {
      const key = v.responsavel_id || "desconhecido";
      if (!map[key]) {
        map[key] = {
          id: key,
          nome: v.responsavel_nome || "Desconhecido",
          vendas: [],
        };
      }
      map[key].vendas.push(v);
    }
    return Object.values(map)
      .map(entry => {
        const totalDesconto = entry.vendas.reduce((acc, v) => acc + (v.desconto || 0), 0);
        const percentMedio = entry.vendas.length > 0
          ? entry.vendas.reduce((acc, v) => acc + (v.desconto_percentual || 0), 0) / entry.vendas.length
          : 0;
        const valorMedio = entry.vendas.length > 0 ? totalDesconto / entry.vendas.length : 0;
        return { ...entry, totalDesconto, percentMedio, valorMedio };
      })
      .sort((a, b) => b.totalDesconto - a.totalDesconto);
  }, [vendasComDesconto]);

  // Vendedores únicos para filtro
  const vendedoresUnicos = useMemo(() => {
    const map = {};
    vendasEscopo.forEach(v => {
      if (v.responsavel_id) map[v.responsavel_id] = v.responsavel_nome || v.responsavel_id;
    });
    return Object.entries(map).map(([id, nome]) => ({ id, nome }));
  }, [vendasEscopo]);

  const toggleExpandir = (id) => {
    setLinhasExpandidas(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const fmt = (v) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <TrendingDown className="w-6 h-6 text-green-600" />
          Relatório de Descontos
        </h1>
        <p className="text-sm text-gray-500 mt-1">Análise de descontos concedidos por vendedor, período e origem</p>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <Label className="text-xs mb-1 block">Data Início</Label>
              <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Data Fim</Label>
              <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Vendedor</Label>
              <Select value={filtroVendedor} onValueChange={setFiltroVendedor}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {vendedoresUnicos.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Loja</Label>
              <Select value={filtroLoja} onValueChange={setFiltroLoja}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {lojasData.map(l => (
                    <SelectItem key={l.id} value={l.nome}>{l.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Origem</Label>
              <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="margem_negociavel">Margem Livre</SelectItem>
                  <SelectItem value="token">Token Gerencial</SelectItem>
                  <SelectItem value="cupom">Cupom</SelectItem>
                  <SelectItem value="arredondamento">Arredondamento</SelectItem>
                  <SelectItem value="desconto_produto">Desc. por Produto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                size="sm"
                className="h-9 w-full"
                onClick={() => {
                  const d = new Date();
                  d.setDate(1);
                  setDataInicio(d.toISOString().slice(0, 10));
                  setDataFim(new Date().toISOString().slice(0, 10));
                  setFiltroVendedor("todos");
                  setFiltroLoja("todas");
                  setFiltroOrigem("todas");
                }}
              >
                Limpar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Descontos</p>
              <p className="text-lg font-bold text-red-600">R$ {fmt(kpis.totalDescontos)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
              <Percent className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500">% Médio</p>
              <p className="text-lg font-bold text-orange-600">{kpis.percentMedio.toFixed(1)}%</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Tag className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Vendas com Desconto</p>
              <p className="text-lg font-bold text-blue-600">{kpis.totalVendas}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Desconto Médio/Venda</p>
              <p className="text-lg font-bold text-purple-600">R$ {fmt(kpis.valorMedio)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela por Vendedor */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-500" />
            Resumo por Vendedor
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-gray-400">Carregando...</div>
          ) : porVendedor.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <TrendingDown className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p>Nenhum desconto encontrado no período</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead className="text-right">Qtd. Vendas</TableHead>
                  <TableHead className="text-right">Total R$</TableHead>
                  <TableHead className="text-right">% Médio</TableHead>
                  <TableHead className="text-right">Valor Médio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {porVendedor.map(entry => (
                  <React.Fragment key={entry.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-800/50"
                      onClick={() => toggleExpandir(entry.id)}
                    >
                      <TableCell className="pr-0">
                        {linhasExpandidas[entry.id]
                          ? <ChevronDown className="w-4 h-4 text-gray-400" />
                          : <ChevronRight className="w-4 h-4 text-gray-400" />}
                      </TableCell>
                      <TableCell className="font-medium">{entry.nome}</TableCell>
                      <TableCell className="text-right">{entry.vendas.length}</TableCell>
                      <TableCell className="text-right font-semibold text-red-600">
                        R$ {fmt(entry.totalDesconto)}
                      </TableCell>
                      <TableCell className="text-right">{entry.percentMedio.toFixed(1)}%</TableCell>
                      <TableCell className="text-right">R$ {fmt(entry.valorMedio)}</TableCell>
                    </TableRow>

                    {linhasExpandidas[entry.id] && entry.vendas.map(v => (
                      <TableRow key={v.id} className="bg-gray-50/50 dark:bg-neutral-900/50 text-xs">
                        <TableCell></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-gray-500">
                            <span className="font-mono">#{v.numero_pedido}</span>
                            <span>{v.cliente_nome}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-gray-500">
                          {new Date(v.data_venda + "T12:00:00").toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right text-red-500 font-semibold">
                          - R$ {fmt(v.desconto || 0)}
                        </TableCell>
                        <TableCell className="text-right text-gray-500">
                          {v.desconto_percentual != null ? `${parseFloat(v.desconto_percentual).toFixed(1)}%` : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {v.desconto_origem ? (
                            <Badge className={`text-[10px] px-1.5 py-0 ${ORIGEM_LABELS[v.desconto_origem]?.color || 'bg-gray-100 text-gray-700'}`}>
                              {ORIGEM_LABELS[v.desconto_origem]?.label || v.desconto_origem}
                            </Badge>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
