import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
    Sofa, Plus, Search, Clock, Wrench, Check, Package,
    RefreshCw, Eye, Calendar, Store, User, AlertCircle
} from "lucide-react";

export default function Mostruario() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [abaAtiva, setAbaAtiva] = useState('pendentes');
    const [busca, setBusca] = useState('');
    const [modalAberto, setModalAberto] = useState(false);
    const [detalhesAberto, setDetalhesAberto] = useState(false);
    const [pedidoSelecionado, setPedidoSelecionado] = useState(null);
    const [novoPedido, setNovoPedido] = useState({
        produto_id: null,
        produto_nome: '',
        quantidade: 1,
        observacoes: ''
    });

    // Queries
    const { data: pedidos = [], isLoading, refetch } = useQuery({
        queryKey: ['pedidos-mostruario'],
        queryFn: () => base44.entities.PedidoMostruario.list('-created_at'),
        enabled: !!user
    });

    const { data: produtos = [] } = useQuery({
        queryKey: ['produtos-mostruario'],
        queryFn: () => base44.entities.Produto.list(),
        enabled: !!user
    });

    // Mutations
    const criarPedido = useMutation({
        mutationFn: (pedido) => base44.entities.PedidoMostruario.create(pedido),
        onSuccess: () => {
            queryClient.invalidateQueries(['pedidos-mostruario']);
            setModalAberto(false);
            setNovoPedido({ produto_id: null, produto_nome: '', quantidade: 1, observacoes: '' });
            toast.success('Pedido de mostruário criado com sucesso!');
        },
        onError: (error) => {
            toast.error('Erro ao criar pedido: ' + error.message);
        }
    });

    const atualizarPedido = useMutation({
        mutationFn: ({ id, data }) => base44.entities.PedidoMostruario.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries(['pedidos-mostruario']);
            toast.success('Pedido atualizado!');
        }
    });

    // Filtrar pedidos por status
    const pedidosFiltrados = useMemo(() => {
        let filtrados = pedidos;

        // Filtro por busca
        if (busca) {
            const termoBusca = busca.toLowerCase();
            filtrados = filtrados.filter(p =>
                p.produto_nome?.toLowerCase().includes(termoBusca) ||
                p.loja?.toLowerCase().includes(termoBusca) ||
                p.solicitante_nome?.toLowerCase().includes(termoBusca)
            );
        }

        // Filtro por aba
        switch (abaAtiva) {
            case 'pendentes':
                return filtrados.filter(p => p.status === 'Pendente');
            case 'em-montagem':
                return filtrados.filter(p => p.status === 'Em Montagem');
            case 'montados':
                return filtrados.filter(p => p.status === 'Montado');
            case 'concluidos':
                return filtrados.filter(p => p.status === 'Entregue');
            default:
                return filtrados;
        }
    }, [pedidos, busca, abaAtiva]);

    // Contadores por status
    const contadores = useMemo(() => ({
        pendentes: pedidos.filter(p => p.status === 'Pendente').length,
        emMontagem: pedidos.filter(p => p.status === 'Em Montagem').length,
        montados: pedidos.filter(p => p.status === 'Montado').length,
        concluidos: pedidos.filter(p => p.status === 'Entregue').length
    }), [pedidos]);

    // Criar pedido
    const handleCriarPedido = () => {
        if (!novoPedido.produto_id || !novoPedido.produto_nome) {
            toast.error('Selecione um produto');
            return;
        }

        criarPedido.mutate({
            ...novoPedido,
            loja: user?.loja || 'Centro',
            solicitante_id: user?.id,
            solicitante_nome: user?.full_name || user?.email,
            status: 'Pendente',
            data_solicitacao: new Date().toISOString()
        });
    };

    // Iniciar montagem
    const iniciarMontagem = (pedido) => {
        atualizarPedido.mutate({
            id: pedido.id,
            data: {
                status: 'Em Montagem',
                montador_id: user?.id,
                montador_nome: user?.full_name || user?.email,
                data_montagem: new Date().toISOString()
            }
        });
    };

    // Finalizar montagem
    const finalizarMontagem = (pedido) => {
        atualizarPedido.mutate({
            id: pedido.id,
            data: { status: 'Montado' }
        });
    };

    // Marcar como entregue
    const marcarEntregue = (pedido) => {
        atualizarPedido.mutate({
            id: pedido.id,
            data: {
                status: 'Entregue',
                data_entrega: new Date().toISOString()
            }
        });
    };

    const formatarData = (data) => {
        if (!data) return '-';
        return new Date(data).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'Pendente':
                return <Badge className="bg-yellow-100 text-yellow-700"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
            case 'Em Montagem':
                return <Badge className="bg-blue-100 text-blue-700"><Wrench className="w-3 h-3 mr-1" />Em Montagem</Badge>;
            case 'Montado':
                return <Badge className="bg-green-100 text-green-700"><Check className="w-3 h-3 mr-1" />Montado</Badge>;
            case 'Entregue':
                return <Badge className="bg-emerald-100 text-emerald-700"><Package className="w-3 h-3 mr-1" />Entregue</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Sofa className="w-7 h-7 text-indigo-600" />
                        Gerenciamento de Mostruário
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Controle de montagem e entrega de itens de mostruário
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={() => refetch()}>
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                    <Button onClick={() => setModalAberto(true)} className="bg-indigo-600 hover:bg-indigo-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Novo Pedido
                    </Button>
                </div>
            </div>

            {/* Cards de resumo */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="border-l-4 border-l-yellow-500">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Pendentes</p>
                                <p className="text-2xl font-bold text-yellow-600">{contadores.pendentes}</p>
                            </div>
                            <Clock className="w-8 h-8 text-yellow-500 opacity-50" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Em Montagem</p>
                                <p className="text-2xl font-bold text-blue-600">{contadores.emMontagem}</p>
                            </div>
                            <Wrench className="w-8 h-8 text-blue-500 opacity-50" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-green-500">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Montados</p>
                                <p className="text-2xl font-bold text-green-600">{contadores.montados}</p>
                            </div>
                            <Check className="w-8 h-8 text-green-500 opacity-50" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-emerald-500">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Concluídos</p>
                                <p className="text-2xl font-bold text-emerald-600">{contadores.concluidos}</p>
                            </div>
                            <Package className="w-8 h-8 text-emerald-500 opacity-50" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Busca e Tabs */}
            <Card>
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="w-full">
                            <TabsList className="grid grid-cols-4 w-full max-w-lg">
                                <TabsTrigger value="pendentes">
                                    Pendentes {contadores.pendentes > 0 && `(${contadores.pendentes})`}
                                </TabsTrigger>
                                <TabsTrigger value="em-montagem">
                                    Em Montagem {contadores.emMontagem > 0 && `(${contadores.emMontagem})`}
                                </TabsTrigger>
                                <TabsTrigger value="montados">
                                    Montados {contadores.montados > 0 && `(${contadores.montados})`}
                                </TabsTrigger>
                                <TabsTrigger value="concluidos">Concluídos</TabsTrigger>
                            </TabsList>
                        </Tabs>
                        <div className="relative ml-4">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                placeholder="Buscar..."
                                value={busca}
                                onChange={(e) => setBusca(e.target.value)}
                                className="pl-9 w-64"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {pedidosFiltrados.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <Sofa className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>Nenhum pedido de mostruário encontrado</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Produto</TableHead>
                                    <TableHead>Qtd</TableHead>
                                    <TableHead>Loja</TableHead>
                                    <TableHead>Solicitante</TableHead>
                                    <TableHead>Data</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pedidosFiltrados.map((pedido) => (
                                    <TableRow key={pedido.id}>
                                        <TableCell className="font-medium">{pedido.produto_nome}</TableCell>
                                        <TableCell>{pedido.quantidade}x</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <Store className="w-3 h-3" />
                                                {pedido.loja}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <User className="w-3 h-3" />
                                                {pedido.solicitante_nome || '-'}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm text-gray-500">
                                            {formatarData(pedido.data_solicitacao)}
                                        </TableCell>
                                        <TableCell>{getStatusBadge(pedido.status)}</TableCell>
                                        <TableCell>
                                            <div className="flex gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        setPedidoSelecionado(pedido);
                                                        setDetalhesAberto(true);
                                                    }}
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </Button>
                                                {pedido.status === 'Pendente' && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => iniciarMontagem(pedido)}
                                                    >
                                                        <Wrench className="w-4 h-4 mr-1" />
                                                        Iniciar
                                                    </Button>
                                                )}
                                                {pedido.status === 'Em Montagem' && (
                                                    <Button
                                                        size="sm"
                                                        className="bg-green-600 hover:bg-green-700"
                                                        onClick={() => finalizarMontagem(pedido)}
                                                    >
                                                        <Check className="w-4 h-4 mr-1" />
                                                        Concluir
                                                    </Button>
                                                )}
                                                {pedido.status === 'Montado' && (
                                                    <Button
                                                        size="sm"
                                                        className="bg-emerald-600 hover:bg-emerald-700"
                                                        onClick={() => marcarEntregue(pedido)}
                                                    >
                                                        <Package className="w-4 h-4 mr-1" />
                                                        Entregar
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Modal Novo Pedido */}
            <Dialog open={modalAberto} onOpenChange={setModalAberto}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sofa className="w-5 h-5 text-indigo-600" />
                            Novo Pedido de Mostruário
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <Label>Produto</Label>
                            <Select
                                value={novoPedido.produto_id?.toString() || ''}
                                onValueChange={(value) => {
                                    const produto = produtos.find(p => p.id.toString() === value);
                                    setNovoPedido({
                                        ...novoPedido,
                                        produto_id: produto?.id,
                                        produto_nome: produto?.nome || ''
                                    });
                                }}
                            >
                                <SelectTrigger className="mt-1">
                                    <SelectValue placeholder="Selecione um produto..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {produtos.filter(p => p.ativo).map(produto => (
                                        <SelectItem key={produto.id} value={produto.id.toString()}>
                                            {produto.nome}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Quantidade</Label>
                            <Input
                                type="number"
                                min="1"
                                value={novoPedido.quantidade}
                                onChange={(e) => setNovoPedido({ ...novoPedido, quantidade: parseInt(e.target.value) || 1 })}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label>Observações</Label>
                            <Textarea
                                value={novoPedido.observacoes}
                                onChange={(e) => setNovoPedido({ ...novoPedido, observacoes: e.target.value })}
                                placeholder="Informações adicionais sobre a montagem..."
                                className="mt-1"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
                        <Button
                            onClick={handleCriarPedido}
                            disabled={criarPedido.isPending}
                            className="bg-indigo-600 hover:bg-indigo-700"
                        >
                            {criarPedido.isPending ? 'Criando...' : 'Criar Pedido'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal Detalhes */}
            <Dialog open={detalhesAberto} onOpenChange={setDetalhesAberto}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Detalhes do Pedido</DialogTitle>
                    </DialogHeader>
                    {pedidoSelecionado && (
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-gray-500">Produto</p>
                                    <p className="font-medium">{pedidoSelecionado.produto_nome}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Quantidade</p>
                                    <p className="font-medium">{pedidoSelecionado.quantidade}x</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Loja</p>
                                    <p className="font-medium">{pedidoSelecionado.loja}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Status</p>
                                    {getStatusBadge(pedidoSelecionado.status)}
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Solicitante</p>
                                    <p className="font-medium">{pedidoSelecionado.solicitante_nome || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Data Solicitação</p>
                                    <p className="font-medium">{formatarData(pedidoSelecionado.data_solicitacao)}</p>
                                </div>
                                {pedidoSelecionado.montador_nome && (
                                    <div>
                                        <p className="text-sm text-gray-500">Montador</p>
                                        <p className="font-medium">{pedidoSelecionado.montador_nome}</p>
                                    </div>
                                )}
                                {pedidoSelecionado.data_montagem && (
                                    <div>
                                        <p className="text-sm text-gray-500">Início Montagem</p>
                                        <p className="font-medium">{formatarData(pedidoSelecionado.data_montagem)}</p>
                                    </div>
                                )}
                                {pedidoSelecionado.data_entrega && (
                                    <div>
                                        <p className="text-sm text-gray-500">Data Entrega</p>
                                        <p className="font-medium">{formatarData(pedidoSelecionado.data_entrega)}</p>
                                    </div>
                                )}
                            </div>
                            {pedidoSelecionado.observacoes && (
                                <div>
                                    <p className="text-sm text-gray-500">Observações</p>
                                    <p className="text-sm bg-gray-50 dark:bg-neutral-800 p-3 rounded-lg mt-1">
                                        {pedidoSelecionado.observacoes}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDetalhesAberto(false)}>Fechar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
