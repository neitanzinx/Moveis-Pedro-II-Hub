import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
    Plus, Search, Trash2, Edit, Loader2, Wrench,
    AlertCircle, Clock, CheckCircle, Package, Filter, Link as LinkIcon
} from "lucide-react";
import AssistenciaTecnicaModal from "../components/assistencia/AssistenciaTecnicaModal";
import { toast } from "sonner";

const TIPOS_ASSISTENCIA = [
    { value: "Devolução", label: "Devolução", color: "bg-red-100 text-red-800 border-red-200" },
    { value: "Troca", label: "Troca", color: "bg-orange-100 text-orange-800 border-orange-200" },
    { value: "Peça Faltante", label: "Peça Faltante", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
    { value: "Conserto", label: "Conserto", color: "bg-blue-100 text-blue-800 border-blue-200" },
    { value: "Visita Técnica", label: "Visita Técnica", color: "bg-purple-100 text-purple-800 border-purple-200" },
    { value: "Outros", label: "Outros", color: "bg-gray-100 text-gray-800 border-gray-200" }
];

const STATUS_OPTIONS = [
    { value: "Aberta", label: "Aberta", color: "bg-blue-100 text-blue-800 border-blue-200" },
    { value: "Em Andamento", label: "Em Andamento", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
    { value: "Aguardando Peça", label: "Aguardando Peça", color: "bg-orange-100 text-orange-800 border-orange-200" },
    { value: "Aguardando Cliente", label: "Aguardando Cliente", color: "bg-purple-100 text-purple-800 border-purple-200" },
    { value: "Concluída", label: "Concluída", color: "bg-green-100 text-green-800 border-green-200" },
    { value: "Cancelada", label: "Cancelada", color: "bg-red-100 text-red-800 border-red-200" }
];

const PRIORIDADE_OPTIONS = [
    { value: "Baixa", label: "Baixa", color: "bg-gray-100 text-gray-600 border-gray-200" },
    { value: "Normal", label: "Normal", color: "bg-blue-100 text-blue-700 border-blue-200" },
    { value: "Alta", label: "Alta", color: "bg-orange-100 text-orange-700 border-orange-200" },
    { value: "Urgente", label: "Urgente", color: "bg-red-100 text-red-700 border-red-200" }
];

export default function AssistenciaTecnica() {
    const [searchTerm, setSearchTerm] = useState("");
    const [filterTipo, setFilterTipo] = useState("todos");
    const [filterStatus, setFilterStatus] = useState("todos");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAssistencia, setEditingAssistencia] = useState(null);
    const [saving, setSaving] = useState(false);
    const [user, setUser] = useState(null);
    const queryClient = useQueryClient();

    // Get current user
    useEffect(() => {
        base44.auth.me().then(setUser).catch(console.error);
    }, []);

    // Queries
    const { data: assistencias = [], isLoading } = useQuery({
        queryKey: ['assistencias'],
        queryFn: () => base44.entities.AssistenciaTecnica.list('-created_at')
    });

    const { data: vendas = [] } = useQuery({
        queryKey: ['vendas'],
        queryFn: () => base44.entities.Venda.list('-data_venda')
    });

    const { data: produtos = [] } = useQuery({
        queryKey: ['produtos'],
        queryFn: () => base44.entities.Produto.list()
    });

    // ==============================================
    // FUNÇÃO PRINCIPAL DE SAVE COM INTEGRAÇÕES
    // ==============================================
    const handleSave = async (formData) => {
        setSaving(true);
        const isEditing = !!editingAssistencia;
        const statusAnterior = editingAssistencia?.status;
        const mudouParaConcluida = formData.status === 'Concluída' && statusAnterior !== 'Concluída';
        const hoje = new Date().toISOString().split('T')[0];

        try {
            // 1. Adicionar histórico de mudança de status
            const novoHistorico = formData.historico || [];
            if (isEditing && formData.status !== statusAnterior) {
                novoHistorico.push({
                    status_anterior: statusAnterior,
                    status_novo: formData.status,
                    data: new Date().toISOString(),
                    usuario: user?.full_name || user?.email || 'Sistema'
                });
            }
            formData.historico = novoHistorico;

            // 2. Se concluiu, preencher data_resolucao automaticamente
            if (mudouParaConcluida && !formData.data_resolucao) {
                formData.data_resolucao = hoje;
            }

            // 3. Salvar a assistência
            if (isEditing) {
                await base44.entities.AssistenciaTecnica.update(editingAssistencia.id, formData);
            } else {
                // Ao criar, já adicionar o primeiro registro no histórico
                formData.historico = [{
                    status_anterior: null,
                    status_novo: formData.status,
                    data: new Date().toISOString(),
                    usuario: user?.full_name || user?.email || 'Sistema'
                }];
                await base44.entities.AssistenciaTecnica.create(formData);
            }

            // 4. INTEGRAÇÃO FINANCEIRA - Executar quando concluída com valores
            if (mudouParaConcluida) {
                // Se houver valor devolvido, criar lançamento de saída
                if (formData.valor_devolvido > 0) {
                    try {
                        await base44.entities.LancamentoFinanceiro.create({
                            descricao: `Devolução #${formData.numero_pedido} - ${formData.cliente_nome} (${formData.tipo})`,
                            valor: -formData.valor_devolvido,
                            tipo: 'despesa',
                            data_vencimento: hoje,
                            data_lancamento: hoje,
                            pago: true,
                            categoria_nome: 'Devoluções/Assistência',
                            status: 'Pago',
                            observacao: `Assistência técnica: ${formData.descricao_problema?.substring(0, 100)}...`
                        });
                        console.log('✅ Lançamento de devolução criado:', formData.valor_devolvido);
                    } catch (err) {
                        console.error('Erro ao criar lançamento de devolução:', err);
                    }
                }

                // Se houver valor cobrado, criar lançamento de entrada
                if (formData.valor_cobrado > 0) {
                    try {
                        await base44.entities.LancamentoFinanceiro.create({
                            descricao: `Serviço AT #${formData.numero_pedido} - ${formData.cliente_nome} (${formData.tipo})`,
                            valor: formData.valor_cobrado,
                            tipo: 'receita',
                            data_vencimento: hoje,
                            data_lancamento: hoje,
                            pago: true,
                            categoria_nome: 'Serviços/Assistência',
                            status: 'Pago',
                            observacao: `Assistência técnica: ${formData.solucao_aplicada?.substring(0, 100) || 'N/A'}`
                        });
                        console.log('✅ Lançamento de serviço criado:', formData.valor_cobrado);
                    } catch (err) {
                        console.error('Erro ao criar lançamento de serviço:', err);
                    }
                }

                // 5. INTEGRAÇÃO ESTOQUE - Devolver itens ao estoque quando for Devolução
                if ((formData.tipo === 'Devolução' || formData.tipo === 'Troca') && formData.itens_envolvidos?.length > 0) {
                    for (const item of formData.itens_envolvidos) {
                        const produto = produtos.find(p => p.id === item.produto_id);
                        if (produto) {
                            try {
                                await base44.entities.Produto.update(produto.id, {
                                    quantidade_estoque: (produto.quantidade_estoque || 0) + item.quantidade,
                                    quantidade_reservada: Math.max(0, (produto.quantidade_reservada || 0) - item.quantidade)
                                });
                                console.log('✅ Estoque atualizado:', item.produto_nome, '+', item.quantidade);
                            } catch (err) {
                                console.error('Erro ao atualizar estoque:', err);
                            }
                        }
                    }
                }
            }

            // Invalidar queries para atualizar a lista
            queryClient.invalidateQueries({ queryKey: ['assistencias'] });
            queryClient.invalidateQueries({ queryKey: ['produtos'] });
            queryClient.invalidateQueries({ queryKey: ['lancamentos'] });

            setIsModalOpen(false);
            setEditingAssistencia(null);
            toast.success(isEditing ? "Assistência atualizada!" : "Assistência criada!");

        } catch (error) {
            console.error('Erro ao salvar assistência:', error);
            toast.error("Erro ao salvar assistência");
        } finally {
            setSaving(false);
        }
    };

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.AssistenciaTecnica.delete(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assistencias'] })
    });

    // Filtering
    const filtered = assistencias.filter(a => {
        const matchesSearch =
            a.numero_pedido?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.cliente_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.descricao_problema?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesTipo = filterTipo === "todos" || a.tipo === filterTipo;
        const matchesStatus = filterStatus === "todos" || a.status === filterStatus;

        return matchesSearch && matchesTipo && matchesStatus;
    });

    // Statistics
    const stats = {
        abertas: assistencias.filter(a => a.status === 'Aberta').length,
        emAndamento: assistencias.filter(a => a.status === 'Em Andamento').length,
        aguardando: assistencias.filter(a => a.status === 'Aguardando Peça' || a.status === 'Aguardando Cliente').length,
        concluidas: assistencias.filter(a => a.status === 'Concluída').length,
        urgentes: assistencias.filter(a => a.prioridade === 'Urgente' && a.status !== 'Concluída' && a.status !== 'Cancelada').length
    };

    const handleDelete = async (id) => {
        const ok = window.confirm("Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.");
        if (ok) {
            deleteMutation.mutate(id);
        }
    };

    const getTipoBadge = (tipo) => {
        const config = TIPOS_ASSISTENCIA.find(t => t.value === tipo) || TIPOS_ASSISTENCIA[5];
        return <Badge className={`${config.color} border px-2 py-0.5 text-[10px] uppercase tracking-wider`}>{tipo}</Badge>;
    };

    const getStatusBadge = (status) => {
        const config = STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];
        return <Badge className={`${config.color} border px-2 py-0.5 text-[10px] uppercase tracking-wider`}>{status}</Badge>;
    };

    const getPrioridadeBadge = (prioridade) => {
        const config = PRIORIDADE_OPTIONS.find(p => p.value === prioridade) || PRIORIDADE_OPTIONS[1];
        return <Badge className={`${config.color} border px-2 py-0.5 text-[10px] uppercase tracking-wider`}>{prioridade}</Badge>;
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6">

            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Wrench className="w-6 h-6 text-green-700" />
                        Assistência Técnica
                    </h1>
                    <p className="text-sm text-gray-500">Gestão de devoluções, trocas, consertos e suporte pós-venda</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={() => {
                            const link = `${window.location.origin}/assistencia/auto`;
                            navigator.clipboard.writeText(link);
                            toast.success("Link copiado para a área de transferência!");
                        }}
                    >
                        <LinkIcon className="w-4 h-4 mr-2" />
                        Link Autoatendimento
                    </Button>
                    <Button
                        onClick={() => { setEditingAssistencia(null); setIsModalOpen(true); }}
                        className="bg-green-700 hover:bg-green-800 text-white"
                    >
                        <Plus className="w-4 h-4 mr-2" /> Nova Assistência
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-2xl font-bold text-blue-600">{stats.abertas}</p>
                                <p className="text-xs text-gray-500">Abertas</p>
                            </div>
                            <AlertCircle className="w-8 h-8 text-blue-200" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-yellow-500">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-2xl font-bold text-yellow-600">{stats.emAndamento}</p>
                                <p className="text-xs text-gray-500">Em Andamento</p>
                            </div>
                            <Clock className="w-8 h-8 text-yellow-200" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-orange-500">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-2xl font-bold text-orange-600">{stats.aguardando}</p>
                                <p className="text-xs text-gray-500">Aguardando</p>
                            </div>
                            <Package className="w-8 h-8 text-orange-200" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-green-500">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-2xl font-bold text-green-600">{stats.concluidas}</p>
                                <p className="text-xs text-gray-500">Concluídas</p>
                            </div>
                            <CheckCircle className="w-8 h-8 text-green-200" />
                        </div>
                    </CardContent>
                </Card>
                <Card className={`border-l-4 ${stats.urgentes > 0 ? 'border-l-red-500 bg-red-50' : 'border-l-gray-300'}`}>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className={`text-2xl font-bold ${stats.urgentes > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                    {stats.urgentes}
                                </p>
                                <p className="text-xs text-gray-500">Urgentes</p>
                            </div>
                            <AlertCircle className={`w-8 h-8 ${stats.urgentes > 0 ? 'text-red-300' : 'text-gray-200'}`} />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800">
                <div className="flex flex-wrap gap-4 items-center">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                            placeholder="Buscar por pedido, cliente ou descrição..."
                            className="pl-9 border-gray-200 dark:border-neutral-700"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-gray-400" />
                        <Select value={filterTipo} onValueChange={setFilterTipo}>
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="Tipo" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos">Todos os Tipos</SelectItem>
                                {TIPOS_ASSISTENCIA.map(t => (
                                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos">Todos os Status</SelectItem>
                                {STATUS_OPTIONS.map(s => (
                                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-gray-100 dark:border-neutral-800 overflow-hidden">
                <Table>
                    <TableHeader className="bg-gray-50 dark:bg-neutral-950">
                        <TableRow>
                            <TableHead>Pedido</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Problema</TableHead>
                            <TableHead>Prioridade</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-8">
                                    <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                                </TableCell>
                            </TableRow>
                        ) : filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                                    Nenhuma assistência encontrada.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filtered.map(a => (
                                <TableRow key={a.id} className={a.prioridade === 'Urgente' && a.status !== 'Concluída' ? 'bg-red-50' : ''}>
                                    <TableCell className="font-medium">#{a.numero_pedido}</TableCell>
                                    <TableCell>{a.cliente_nome}</TableCell>
                                    <TableCell>{getTipoBadge(a.tipo)}</TableCell>
                                    <TableCell className="max-w-[200px] truncate text-sm text-gray-600">
                                        {a.descricao_problema}
                                    </TableCell>
                                    <TableCell>{getPrioridadeBadge(a.prioridade)}</TableCell>
                                    <TableCell>{getStatusBadge(a.status)}</TableCell>
                                    <TableCell className="text-sm text-gray-500">
                                        {new Date(a.data_abertura).toLocaleDateString('pt-BR')}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => { setEditingAssistencia(a); setIsModalOpen(true); }}
                                            >
                                                <Edit className="w-4 h-4 text-blue-600" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDelete(a.id)}
                                            >
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

            {/* Modal */}
            <AssistenciaTecnicaModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingAssistencia(null); }}
                onSave={handleSave}
                assistencia={editingAssistencia}
                vendas={vendas}
                isLoading={saving}
            />
        </div>
    );
}
