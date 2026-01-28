import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useConfirm } from "@/hooks/useConfirm";
import {
  TrendingUp,
  TrendingDown,
  Trash2,
  Eye,
  DollarSign,
  Search,
  Filter,
  Receipt,
  Loader2
} from "lucide-react";

export default function LancamentosList({ lancamentos, categorias, isLoading }) {
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  // Filtros
  const [busca, setBusca] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("todos");
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [categoriaFiltro, setCategoriaFiltro] = useState("todos");

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.LancamentoFinanceiro.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lancamentos-financeiros'] });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.LancamentoFinanceiro.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lancamentos-financeiros'] });
    }
  });

  const handleStatusChange = (id, newStatus) => {
    updateMutation.mutate({ id, data: { status: newStatus } });
  };

  const handleDelete = async (id) => {
    const confirmed = await confirm({
      title: "Excluir Lançamento",
      message: "Tem certeza que deseja excluir este lançamento?",
      confirmText: "Excluir",
      variant: "destructive"
    });
    if (confirmed) deleteMutation.mutate(id);
  };

  // Separar impostos/taxas por categoria
  const isImpostoOuTaxa = (lanc) => {
    const categoriaNome = (lanc.categoria_nome || "").toLowerCase();
    return categoriaNome.includes("imposto") || categoriaNome.includes("taxa") || categoriaNome.includes("tributo");
  };

  // Aplicar filtros
  const filtrarLancamentos = (lista) => {
    return lista.filter(lanc => {
      // Busca
      if (busca) {
        const termo = busca.toLowerCase();
        const matchDescricao = lanc.descricao?.toLowerCase().includes(termo);
        const matchCategoria = lanc.categoria_nome?.toLowerCase().includes(termo);
        if (!matchDescricao && !matchCategoria) return false;
      }
      // Tipo
      if (tipoFiltro !== "todos") {
        const isEntrada = lanc.tipo === 'Entrada' || lanc.tipo === 'receita';
        if (tipoFiltro === "entrada" && !isEntrada) return false;
        if (tipoFiltro === "saida" && isEntrada) return false;
      }
      // Status
      if (statusFiltro !== "todos" && lanc.status !== statusFiltro) return false;
      // Categoria
      if (categoriaFiltro !== "todos" && lanc.categoria_nome !== categoriaFiltro) return false;
      return true;
    });
  };

  const lancamentosNormais = filtrarLancamentos(lancamentos.filter(l => !isImpostoOuTaxa(l)));
  const impostosTaxas = filtrarLancamentos(lancamentos.filter(l => isImpostoOuTaxa(l)));

  const totalImpostos = impostosTaxas.reduce((sum, l) => sum + Math.abs(l.valor || 0), 0);

  const getStatusBadge = (status) => {
    const styles = {
      'Pago': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      'Pendente': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      'Cancelado': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    };
    return <Badge className={`text-[10px] ${styles[status] || ''}`}>{status}</Badge>;
  };

  // Componente de Select editável para status
  const StatusSelect = ({ lanc }) => {
    // Bloquear edição se lançamento está vinculado a uma venda
    const isVinculadoVenda = lanc.venda_id || lanc.numero_pedido;

    if (isVinculadoVenda) {
      return (
        <div
          className="flex items-center gap-1 cursor-not-allowed"
          title="Status vinculado à venda. Para alterar, cancele a venda."
        >
          {getStatusBadge(lanc.status)}
          <span className="text-[8px] text-gray-400">🔒</span>
        </div>
      );
    }

    return (
      <Select
        value={lanc.status || 'Pendente'}
        onValueChange={(value) => handleStatusChange(lanc.id, value)}
        disabled={updateMutation.isPending}
      >
        <SelectTrigger className="h-7 w-[100px] text-[10px] border-0 bg-transparent hover:bg-gray-100 dark:hover:bg-neutral-800">
          <SelectValue>
            {getStatusBadge(lanc.status)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="Pago">
            <Badge className="bg-green-100 text-green-800 text-[10px]">Pago</Badge>
          </SelectItem>
          <SelectItem value="Pendente">
            <Badge className="bg-yellow-100 text-yellow-800 text-[10px]">Pendente</Badge>
          </SelectItem>
          <SelectItem value="Cancelado">
            <Badge className="bg-red-100 text-red-800 text-[10px]">Cancelado</Badge>
          </SelectItem>
        </SelectContent>
      </Select>
    );
  };

  const formatDate = (date) => date ? new Date(date).toLocaleDateString('pt-BR') : '-';
  const formatMoney = (valor) => `R$ ${Math.abs(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-green-600" />
      </div>
    );
  }

  // Tabela compacta
  const TabelaLancamentos = ({ dados, titulo, icone: Icone, corIcone }) => (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-3 border-b">
        <CardTitle className="text-base flex items-center gap-2">
          <Icone className={`w-4 h-4 ${corIcone}`} />
          {titulo}
          <Badge variant="secondary" className="ml-2">{dados.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {dados.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <DollarSign className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm">Nenhum lançamento encontrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 dark:bg-neutral-800">
                  <TableHead className="w-[100px] text-xs">Data</TableHead>
                  <TableHead className="text-xs">Descrição</TableHead>
                  <TableHead className="text-xs">Categoria</TableHead>
                  <TableHead className="text-xs text-right">Valor</TableHead>
                  <TableHead className="text-xs text-center">Status</TableHead>
                  <TableHead className="text-xs text-right w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dados.map((lanc) => {
                  const isEntrada = lanc.tipo === 'Entrada' || lanc.tipo === 'receita';
                  return (
                    <TableRow key={lanc.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800/50">
                      <TableCell className="text-xs text-gray-600 dark:text-gray-400">
                        {formatDate(lanc.data_lancamento)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${isEntrada ? 'bg-green-100' : 'bg-red-100'}`}>
                            {isEntrada ? <TrendingUp className="w-3 h-3 text-green-600" /> : <TrendingDown className="w-3 h-3 text-red-600" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{lanc.descricao}</p>
                            {lanc.observacao && <p className="text-[10px] text-gray-400 truncate">{lanc.observacao}</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-gray-500">{lanc.categoria_nome || '-'}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`text-sm font-bold ${isEntrada ? 'text-green-600' : 'text-red-600'}`}>
                          {isEntrada ? '+' : '-'}{formatMoney(lanc.valor)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusSelect lanc={lanc} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {lanc.anexo_url && (
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => window.open(lanc.anexo_url, '_blank')}>
                              <Eye className="w-3 h-3 text-blue-500" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDelete(lanc.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      {/* Barra de Busca e Filtros */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar por descrição ou categoria..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
              <SelectTrigger className="w-[130px] h-9">
                <Filter className="w-3 h-3 mr-1" />
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="entrada">Entradas</SelectItem>
                <SelectItem value="saida">Saídas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFiltro} onValueChange={setStatusFiltro}>
              <SelectTrigger className="w-[130px] h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="Pago">Pago</SelectItem>
                <SelectItem value="Pendente">Pendente</SelectItem>
                <SelectItem value="Cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas Categorias</SelectItem>
                {categorias.map(cat => (
                  <SelectItem key={cat.id} value={cat.nome}>{cat.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Lançamentos Normais */}
      <TabelaLancamentos
        dados={lancamentosNormais}
        titulo="Lançamentos"
        icone={DollarSign}
        corIcone="text-green-600"
      />

      {/* Tabela de Impostos & Taxas */}
      {impostosTaxas.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              Impostos & Taxas
            </h3>
            <span className="text-sm font-bold text-red-600">
              Total: {formatMoney(totalImpostos)}
            </span>
          </div>
          <TabelaLancamentos
            dados={impostosTaxas}
            titulo="Impostos & Taxas"
            icone={Receipt}
            corIcone="text-orange-600"
          />
        </div>
      )}
    </div>
  );
}