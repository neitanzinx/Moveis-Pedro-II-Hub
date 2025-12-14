import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Package, AlertTriangle, Archive, MoreHorizontal, Trash2, Edit, ArrowRightLeft, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import ProdutoModal from "../produtos/ProdutoModal";
import MovimentacaoModal from "./MovimentacaoModal";

export default function EstoqueTab({ user }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFornecedor, setSelectedFornecedor] = useState("todos");
  const [editingProduto, setEditingProduto] = useState(null);
  const [movingProduto, setMovingProduto] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  
  const queryClient = useQueryClient();

  const { data: produtos, isLoading } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => base44.entities.Produto.list('nome'),
    initialData: [],
  });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ['fornecedores'],
    queryFn: () => base44.entities.Fornecedor.list('nome'),
    initialData: [],
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Produto.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['produtos'] })
  });

  const isWarehouse = user?.cargo === 'Estoque';
  const isAdmin = user?.cargo === 'Administrador';
  const isManager = user?.cargo === 'Gerente';
  const canEdit = isAdmin || isManager || isWarehouse;

  const filteredProdutos = (produtos || []).filter(produto => {
    const matchesSearch = 
      produto.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      produto.categoria?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      produto.fornecedor_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      produto.codigo_barras?.includes(searchTerm);
    
    const matchesFornecedor = selectedFornecedor === "todos" || produto.fornecedor_id === selectedFornecedor;
    
    return matchesSearch && matchesFornecedor;
  });

  const produtosEstoqueBaixo = filteredProdutos.filter(
    p => p.quantidade_estoque <= p.estoque_minimo && p.ativo
  );

  const estoqueTotal = filteredProdutos.reduce((sum, p) => sum + (p.quantidade_estoque || 0), 0);
  const estoqueReservado = filteredProdutos.reduce((sum, p) => sum + (p.quantidade_reservada || 0), 0);
  const estoqueDisponivel = estoqueTotal - estoqueReservado;

  const handleDelete = (id) => {
    if(confirm("Tem certeza que deseja excluir este produto?")) {
        deleteMutation.mutate(id);
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-green-600">
                <Package className="w-6 h-6" />
            </div>
            <div>
                <p className="text-xs text-gray-500 uppercase font-medium">Total em Estoque</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{estoqueTotal}</p>
            </div>
        </div>
        <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600">
                <Archive className="w-6 h-6" />
            </div>
            <div>
                <p className="text-xs text-gray-500 uppercase font-medium">Disponível</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{estoqueDisponivel}</p>
            </div>
        </div>
        <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-orange-600">
                <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
                <p className="text-xs text-gray-500 uppercase font-medium">Críticos / Baixos</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{produtosEstoqueBaixo.length}</p>
            </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-800">
        <div className="p-4 border-b border-gray-100 dark:border-neutral-800 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
                <div className="relative w-full sm:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input 
                        placeholder="Buscar por nome, código ou categoria..." 
                        className="pl-9 border-gray-200 dark:border-neutral-700"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <Button 
                    variant="outline" 
                    className="border-gray-200 dark:border-neutral-700"
                    onClick={() => { setEditingProduto(null); setIsModalOpen(true); }}
                >
                    Novo Produto
                </Button>
            </div>
            <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <Select value={selectedFornecedor} onValueChange={setSelectedFornecedor}>
                    <SelectTrigger className="w-64 border-gray-200 dark:border-neutral-700">
                        <SelectValue placeholder="Filtrar por fornecedor" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="todos">Todos os Fornecedores</SelectItem>
                        {fornecedores.map(f => (
                            <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {selectedFornecedor !== "todos" && (
                    <Button variant="ghost" size="sm" onClick={() => setSelectedFornecedor("todos")}>
                        Limpar
                    </Button>
                )}
            </div>
        </div>

        <Table>
            <TableHeader className="bg-gray-50 dark:bg-neutral-950">
                <TableRow>
                    <TableHead className="w-[300px]">Produto</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">Reservado</TableHead>
                    <TableHead className="text-center">Disponível</TableHead>
                    <TableHead className="text-right">Preço Venda</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-500">Carregando estoque...</TableCell></TableRow>
                ) : filteredProdutos.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-500">Nenhum produto encontrado.</TableCell></TableRow>
                ) : (
                    filteredProdutos.map(produto => {
                        const disponivel = (produto.quantidade_estoque || 0) - (produto.quantidade_reservada || 0);
                        const isLowStock = produto.quantidade_estoque <= produto.estoque_minimo;
                        
                        return (
                            <TableRow key={produto.id} className="hover:bg-gray-50 dark:hover:bg-neutral-800/50 group">
                                <TableCell>
                                    <div>
                                        <p className="font-medium text-gray-900 dark:text-white">{produto.nome}</p>
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            <span>SKU: {produto.codigo_barras || 'N/A'}</span>
                                            {isLowStock && <Badge variant="destructive" className="h-4 px-1 text-[10px]">Estoque Baixo</Badge>}
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="secondary" className="font-normal bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400">
                                        {produto.categoria}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-center font-medium text-gray-700 dark:text-gray-300">
                                    {produto.quantidade_estoque}
                                </TableCell>
                                <TableCell className="text-center">
                                    {produto.quantidade_reservada > 0 ? (
                                        <span className="text-orange-600 font-medium">{produto.quantidade_reservada}</span>
                                    ) : <span className="text-gray-300">-</span>}
                                </TableCell>
                                <TableCell className="text-center">
                                    <span className={`font-bold ${disponivel > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                        {disponivel}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right font-medium text-gray-900 dark:text-white">
                                    R$ {produto.preco_venda?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell>
                                    {canEdit && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => { setMovingProduto(produto); setIsMoveModalOpen(true); }}>
                                                    <ArrowRightLeft className="mr-2 h-4 w-4 text-blue-600" /> Movimentar
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => { setEditingProduto(produto); setIsModalOpen(true); }}>
                                                    <Edit className="mr-2 h-4 w-4" /> Editar
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(produto.id)}>
                                                    <Trash2 className="mr-2 h-4 w-4" /> Excluir
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                </TableCell>
                            </TableRow>
                        );
                    })
                )}
            </TableBody>
        </Table>
      </div>

      <ProdutoModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        produto={editingProduto}
        onSave={() => {
            queryClient.invalidateQueries({ queryKey: ['produtos'] });
            setIsModalOpen(false);
        }}
      />

      <MovimentacaoModal 
        isOpen={isMoveModalOpen}
        onClose={() => setIsMoveModalOpen(false)}
        produto={movingProduto}
      />
    </div>
  );
}