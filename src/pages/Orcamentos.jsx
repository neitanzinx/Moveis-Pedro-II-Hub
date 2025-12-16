import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Filter, FileText, Trash2, Edit, Loader2 } from "lucide-react";
import OrcamentoModal from "../components/orcamentos/OrcamentoModal";

export default function Orcamentos() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrcamento, setEditingOrcamento] = useState(null);
  const queryClient = useQueryClient();

  const { data: orcamentos = [], isLoading } = useQuery({
    queryKey: ['orcamentos'],
    queryFn: () => base44.entities.Orcamento.list('-created_date'),
    initialData: [],
  });

  const { data: clientes = [] } = useQuery({ queryKey: ['clientes'], queryFn: () => base44.entities.Cliente.list(), initialData: [] });
  const { data: produtos = [] } = useQuery({ queryKey: ['produtos'], queryFn: () => base44.entities.Produto.list(), initialData: [] });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Orcamento.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['orcamentos'] }); setIsModalOpen(false); setEditingOrcamento(null); }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Orcamento.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['orcamentos'] }); setIsModalOpen(false); setEditingOrcamento(null); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Orcamento.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orcamentos'] })
  });

  const filtered = orcamentos.filter(orc => {
    const matchesSearch = orc.numero_orcamento?.toLowerCase().includes(searchTerm.toLowerCase()) || orc.cliente_nome?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || orc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Orçamentos</h1>
            <p className="text-sm text-gray-500">Gerencie orçamentos e propostas</p>
        </div>
        <Button 
            onClick={() => { setEditingOrcamento(null); setIsModalOpen(true); }} 
            className="bg-green-700 hover:bg-green-800 text-white font-medium"
        >
            <Plus className="w-4 h-4 mr-2" /> Novo Orçamento
        </Button>
      </div>

      <div className="flex gap-4 items-center bg-white dark:bg-neutral-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800">
        <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input 
                placeholder="Buscar por número ou cliente..." 
                className="pl-9 border-gray-200 dark:border-neutral-700"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
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
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="Pendente">Pendente</SelectItem>
                <SelectItem value="Aprovado">Aprovado</SelectItem>
                <SelectItem value="Rejeitado">Rejeitado</SelectItem>
                <SelectItem value="Convertido">Convertido</SelectItem>
                <SelectItem value="Expirado">Expirado</SelectItem>
            </SelectContent>
        </Select>
      </div>

      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 overflow-hidden">
        <Table>
            <TableHeader className="bg-gray-50 dark:bg-neutral-950">
                <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Validade</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></TableCell></TableRow>
                ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-500">Nenhum orçamento encontrado.</TableCell></TableRow>
                ) : (
                    filtered.map(orc => (
                        <TableRow key={orc.id}>
                            <TableCell className="font-medium">#{orc.numero_orcamento}</TableCell>
                            <TableCell>
                                <div className="flex flex-col">
                                    <span className="font-medium text-gray-900 dark:text-white">{orc.cliente_nome}</span>
                                    <span className="text-xs text-gray-500">{orc.cliente_telefone}</span>
                                </div>
                            </TableCell>
                            <TableCell className="text-sm text-gray-600 dark:text-gray-400">{new Date(orc.data_orcamento).toLocaleDateString('pt-BR')}</TableCell>
                            <TableCell className="text-sm text-gray-600 dark:text-gray-400">{new Date(orc.validade).toLocaleDateString('pt-BR')}</TableCell>
                            <TableCell className="font-bold text-gray-900 dark:text-white">R$ {orc.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell><StatusBadge status={orc.status} /></TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon" onClick={() => { setEditingOrcamento(orc); setIsModalOpen(true); }}>
                                        <Edit className="w-4 h-4 text-blue-600" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => { if(confirm('Excluir orçamento?')) deleteMutation.mutate(orc.id) }}>
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

      <OrcamentoModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingOrcamento(null); }}
        onSave={(data) => editingOrcamento ? updateMutation.mutate({ id: editingOrcamento.id, data }) : createMutation.mutate(data)}
        orcamento={editingOrcamento}
        clientes={clientes}
        produtos={produtos}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}

function StatusBadge({ status }) {
    const styles = {
        "Aprovado": "bg-green-100 text-green-800 border-green-200",
        "Convertido": "bg-blue-100 text-blue-800 border-blue-200",
        "Pendente": "bg-yellow-100 text-yellow-800 border-yellow-200",
        "Rejeitado": "bg-red-100 text-red-800 border-red-200",
        "Expirado": "bg-gray-100 text-gray-800 border-gray-200"
    };
    return <Badge className={`${styles[status] || "bg-gray-100 text-gray-800"} border px-2 py-0.5 text-[10px] uppercase tracking-wider`}>{status}</Badge>;
}