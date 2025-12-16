import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Filter, FileText, Trash2, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { abrirNotaPedidoPDF } from "../components/vendas/NotaPedidoPDF";
import { useAuth } from "@/components/hooks/useAuth";

export default function Vendas() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Hook de Autenticação e Controle de Acesso
  const { user, filterData, can } = useAuth();

  const { data: vendas = [], isLoading } = useQuery({ 
      queryKey: ['vendas'], 
      queryFn: () => base44.entities.Venda.list('-created_date'), 
      initialData: [] 
  });

  const deleteMutation = useMutation({
      mutationFn: (id) => base44.entities.Venda.delete(id),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendas'] })
  });

  // 1. Filtra pelo Escopo do Usuário (Dono / Loja / Tudo)
  const vendasPermitidas = filterData(vendas, { userField: 'responsavel_id' });

  // 2. Filtros de Busca e Status da Tela
  const filtered = vendasPermitidas.filter(v => {
      if(statusFilter !== 'all' && v.status !== statusFilter) return false;
      if(search && !v.cliente_nome?.toLowerCase().includes(search.toLowerCase()) && !v.numero_pedido?.includes(search)) return false;
      return true;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Vendas</h1>
            <p className="text-sm text-gray-500">Gerencie suas vendas e pedidos</p>
        </div>
        
        {/* Só mostra botão se puder criar vendas */}
        {can('create_vendas') && (
            <Button 
                onClick={() => navigate('/PDV')} 
                className="bg-green-700 hover:bg-green-800 text-white font-medium"
            >
                <Plus className="w-4 h-4 mr-2" /> Nova Venda (PDV)
            </Button>
        )}
      </div>

      <div className="flex gap-4 items-center bg-white dark:bg-neutral-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800">
        <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input 
                placeholder="Buscar por cliente ou nº do pedido..." 
                className="pl-9 border-gray-200 dark:border-neutral-700"
                value={search}
                onChange={e => setSearch(e.target.value)}
            />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px] border-gray-200 dark:border-neutral-700">
                <div className="flex items-center gap-2 text-gray-500">
                    <Filter className="w-4 h-4" />
                    <SelectValue placeholder="Status" />
                </div>
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="Pagamento Pendente">Pendente</SelectItem>
                <SelectItem value="Pago">Pago</SelectItem>
                <SelectItem value="Cancelado">Cancelado</SelectItem>
            </SelectContent>
        </Select>
      </div>

      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 overflow-hidden">
        <Table>
            <TableHeader className="bg-gray-50 dark:bg-neutral-950">
                <TableRow>
                    <TableHead className="w-[100px]">Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Loja</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? (
                    <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                            Carregando vendas...
                        </TableCell>
                    </TableRow>
                ) : filtered.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                            Nenhuma venda encontrada.
                        </TableCell>
                    </TableRow>
                ) : (
                    filtered.map(venda => (
                        <TableRow key={venda.id}>
                            <TableCell className="font-medium">#{venda.numero_pedido}</TableCell>
                            <TableCell>
                                <div className="flex flex-col">
                                    <span className="font-medium text-gray-900 dark:text-white">{venda.cliente_nome}</span>
                                    <span className="text-xs text-gray-500">{venda.cliente_telefone}</span>
                                </div>
                            </TableCell>
                            <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                                {new Date(venda.data_venda).toLocaleDateString('pt-BR')}
                            </TableCell>
                            <TableCell>
                                <Badge variant="outline" className="font-normal text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-neutral-800">
                                    {venda.loja}
                                </Badge>
                            </TableCell>
                            <TableCell className="font-bold text-gray-900 dark:text-white">
                                R$ {venda.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell>
                                <StatusBadge status={venda.status} />
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon" onClick={() => abrirNotaPedidoPDF(venda, { nome_completo: venda.cliente_nome, telefone: venda.cliente_telefone }, user?.full_name)}>
                                        <FileText className="w-4 h-4 text-blue-600" />
                                    </Button>
                                    
                                    {/* Só mostra botão de excluir se tiver permissão de Gerente/Admin */}
                                    {can('manage_vendas') && (
                                        <Button variant="ghost" size="icon" onClick={() => { if(confirm('Excluir venda?')) deleteMutation.mutate(venda.id) }}>
                                            <Trash2 className="w-4 h-4 text-red-600" />
                                        </Button>
                                    )}
                                </div>
                            </TableCell>
                        </TableRow>
                    ))
                )}
            </TableBody>
        </Table>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
    const styles = {
        "Pago": "bg-green-100 text-green-800 border-green-200",
        "Pagamento Pendente": "bg-yellow-100 text-yellow-800 border-yellow-200",
        "Cancelado": "bg-red-100 text-red-800 border-red-200"
    };
    return (
        <Badge className={`${styles[status] || "bg-gray-100 text-gray-800"} border px-2 py-0.5 text-[10px] uppercase tracking-wider`}>
            {status}
        </Badge>
    );
}