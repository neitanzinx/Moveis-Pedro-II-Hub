import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Filter, RotateCcw, Trash2, Edit, Loader2 } from "lucide-react";
import DevolucaoModal from "../components/devolucoes/DevolucaoModal";

export default function Devolucoes() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDevolucao, setEditingDevolucao] = useState(null);
  const queryClient = useQueryClient();

  const { data: devolucoes = [], isLoading } = useQuery({ queryKey: ['devolucoes'], queryFn: () => base44.entities.Devolucao.list('-created_date') });
  const { data: vendas = [] } = useQuery({ queryKey: ['vendas'], queryFn: () => base44.entities.Venda.list() });
  const { data: produtos = [] } = useQuery({ queryKey: ['produtos'], queryFn: () => base44.entities.Produto.list() });

  const createMutation = useMutation({ mutationFn: (data) => base44.entities.Devolucao.create(data), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['devolucoes'] }); setIsModalOpen(false); setEditingDevolucao(null); }});
  const updateMutation = useMutation({ mutationFn: ({ id, data }) => base44.entities.Devolucao.update(id, data), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['devolucoes'] }); setIsModalOpen(false); setEditingDevolucao(null); }});
  const deleteMutation = useMutation({ mutationFn: (id) => base44.entities.Devolucao.delete(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['devolucoes'] })});

  const filtered = devolucoes.filter(dev =>
    dev.numero_pedido?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dev.cliente_nome?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Devoluções e Trocas</h1>
            <p className="text-sm text-gray-500">Gestão de devoluções de mercadoria</p>
        </div>
        <Button onClick={() => { setEditingDevolucao(null); setIsModalOpen(true); }} className="bg-green-700 hover:bg-green-800 text-white">
            <Plus className="w-4 h-4 mr-2" /> Nova Devolução
        </Button>
      </div>

      <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800">
        <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input 
                placeholder="Buscar por pedido ou cliente..." 
                className="pl-9 border-gray-200 dark:border-neutral-700"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 overflow-hidden">
        <Table>
            <TableHeader className="bg-gray-50 dark:bg-neutral-950">
                <TableRow>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></TableCell></TableRow>
                ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-500">Nenhuma devolução encontrada.</TableCell></TableRow>
                ) : (
                    filtered.map(dev => (
                        <TableRow key={dev.id}>
                            <TableCell className="font-medium">#{dev.numero_pedido}</TableCell>
                            <TableCell>{dev.cliente_nome}</TableCell>
                            <TableCell className="text-sm text-gray-500">{new Date(dev.data_devolucao).toLocaleDateString('pt-BR')}</TableCell>
                            <TableCell><Badge variant="outline">{dev.tipo}</Badge></TableCell>
                            <TableCell className="font-bold">R$ {(dev.valor_devolvido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell><StatusBadge status={dev.status} /></TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon" onClick={() => { setEditingDevolucao(dev); setIsModalOpen(true); }}>
                                        <Edit className="w-4 h-4 text-blue-600" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => { if(confirm('Excluir registro?')) deleteMutation.mutate(dev.id) }}>
                                        <Trash2 className="w-4 h-4 text-red-600" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))
                )}
            </TableBody>
        </Table>
      </div>

      <DevolucaoModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingDevolucao(null); }}
        onSave={(data) => editingDevolucao ? updateMutation.mutate({ id: editingDevolucao.id, data }) : createMutation.mutate(data)}
        devolucao={editingDevolucao}
        vendas={vendas}
        produtos={produtos}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}

function StatusBadge({ status }) {
    const styles = {
        "Aprovada": "bg-green-100 text-green-800 border-green-200",
        "Pendente": "bg-yellow-100 text-yellow-800 border-yellow-200",
        "Rejeitada": "bg-red-100 text-red-800 border-red-200",
        "Processada": "bg-blue-100 text-blue-800 border-blue-200"
    };
    return <Badge className={`${styles[status] || "bg-gray-100 text-gray-800"} border px-2 py-0.5 text-[10px] uppercase tracking-wider`}>{status}</Badge>;
}