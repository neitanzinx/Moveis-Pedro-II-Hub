import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    Tag, Plus, Search, Edit, Trash2, Calendar, Building2, Package,
    TrendingDown, Clock, CheckCircle, AlertTriangle, Percent, DollarSign,
    ShoppingCart, Loader2, Filter
} from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays, isAfter, isBefore, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function PromocoesForneceoresTab() {
    const queryClient = useQueryClient();
    const [busca, setBusca] = useState("");
    const [filtroStatus, setFiltroStatus] = useState("ativas");
    const [modalOpen, setModalOpen] = useState(false);
    const [editando, setEditando] = useState(null);
    const [formData, setFormData] = useState({
        fornecedor_id: '',
        fornecedor_nome: '',
        produto_id: '',
        produto_nome: '',
        categoria: '',
        nome_campanha: '',
        preco_tabela: '',
        preco_promocional: '',
        data_inicio: '',
        data_fim: '',
        quantidade_minima: '1',
        observacao: ''
    });

    // Buscar promoções
    const { data: promocoes = [], isLoading } = useQuery({
        queryKey: ['promocoes-fornecedor'],
        queryFn: () => base44.entities.PromocaoFornecedor.list('-created_at')
    });

    // Buscar fornecedores
    const { data: fornecedores = [] } = useQuery({
        queryKey: ['fornecedores'],
        queryFn: () => base44.entities.Fornecedor.list('nome')
    });

    // Buscar produtos
    const { data: produtos = [] } = useQuery({
        queryKey: ['produtos-promocao'],
        queryFn: () => base44.entities.Produto.list('nome')
    });

    // Mutation criar/editar
    const salvarPromocao = useMutation({
        mutationFn: async (data) => {
            const desconto = data.preco_tabela && data.preco_promocional
                ? ((1 - parseFloat(data.preco_promocional) / parseFloat(data.preco_tabela)) * 100).toFixed(2)
                : 0;

            const payload = {
                ...data,
                preco_tabela: parseFloat(data.preco_tabela) || 0,
                preco_promocional: parseFloat(data.preco_promocional) || 0,
                desconto_percentual: parseFloat(desconto),
                quantidade_minima: parseInt(data.quantidade_minima) || 1,
                ativo: true
            };

            if (editando) {
                return base44.entities.PromocaoFornecedor.update(editando.id, payload);
            } else {
                return base44.entities.PromocaoFornecedor.create(payload);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['promocoes-fornecedor'] });
            toast.success(editando ? 'Promoção atualizada!' : 'Promoção cadastrada!');
            fecharModal();
        },
        onError: (err) => {
            toast.error('Erro ao salvar: ' + err.message);
        }
    });

    // Mutation excluir
    const excluirPromocao = useMutation({
        mutationFn: (id) => base44.entities.PromocaoFornecedor.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['promocoes-fornecedor'] });
            toast.success('Promoção excluída');
        }
    });

    // Helpers de status
    const getStatusPromocao = (promo) => {
        const hoje = new Date();
        const inicio = new Date(promo.data_inicio);
        const fim = new Date(promo.data_fim);
        const diasRestantes = differenceInDays(fim, hoje);

        if (!promo.ativo) return { status: 'inativa', label: 'Inativa', cor: 'bg-gray-100 text-gray-600' };
        if (isBefore(fim, hoje)) return { status: 'expirada', label: 'Expirada', cor: 'bg-red-100 text-red-700' };
        if (isAfter(inicio, hoje)) return { status: 'futura', label: 'Futura', cor: 'bg-blue-100 text-blue-700' };
        if (diasRestantes <= 3) return { status: 'expirando', label: `Expira em ${diasRestantes}d`, cor: 'bg-orange-100 text-orange-700' };
        return { status: 'ativa', label: 'Ativa', cor: 'bg-green-100 text-green-700' };
    };

    // Filtrar promoções
    const promocoesFiltradas = useMemo(() => {
        return promocoes.filter(p => {
            const { status } = getStatusPromocao(p);
            const matchBusca = !busca ||
                p.nome_campanha?.toLowerCase().includes(busca.toLowerCase()) ||
                p.fornecedor_nome?.toLowerCase().includes(busca.toLowerCase()) ||
                p.produto_nome?.toLowerCase().includes(busca.toLowerCase());

            if (filtroStatus === 'todas') return matchBusca;
            if (filtroStatus === 'ativas') return matchBusca && (status === 'ativa' || status === 'expirando');
            if (filtroStatus === 'expirando') return matchBusca && status === 'expirando';
            if (filtroStatus === 'futuras') return matchBusca && status === 'futura';
            if (filtroStatus === 'expiradas') return matchBusca && status === 'expirada';
            return matchBusca;
        });
    }, [promocoes, busca, filtroStatus]);

    // Estatísticas
    const stats = useMemo(() => {
        const ativas = promocoes.filter(p => {
            const { status } = getStatusPromocao(p);
            return status === 'ativa' || status === 'expirando';
        });
        const expirando = promocoes.filter(p => getStatusPromocao(p).status === 'expirando');
        const economiaTotal = promocoes.reduce((sum, p) => sum + (p.economia_total_obtida || 0), 0);

        return { ativas: ativas.length, expirando: expirando.length, economiaTotal };
    }, [promocoes]);

    const abrirModal = (promo = null) => {
        if (promo) {
            setEditando(promo);
            setFormData({
                fornecedor_id: promo.fornecedor_id?.toString() || '',
                fornecedor_nome: promo.fornecedor_nome || '',
                produto_id: promo.produto_id?.toString() || '',
                produto_nome: promo.produto_nome || '',
                categoria: promo.categoria || '',
                nome_campanha: promo.nome_campanha || '',
                preco_tabela: promo.preco_tabela?.toString() || '',
                preco_promocional: promo.preco_promocional?.toString() || '',
                data_inicio: promo.data_inicio || '',
                data_fim: promo.data_fim || '',
                quantidade_minima: promo.quantidade_minima?.toString() || '1',
                observacao: promo.observacao || ''
            });
        } else {
            setEditando(null);
            setFormData({
                fornecedor_id: '', fornecedor_nome: '', produto_id: '', produto_nome: '',
                categoria: '', nome_campanha: '', preco_tabela: '', preco_promocional: '',
                data_inicio: '', data_fim: '', quantidade_minima: '1', observacao: ''
            });
        }
        setModalOpen(true);
    };

    const fecharModal = () => {
        setModalOpen(false);
        setEditando(null);
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleFornecedorChange = (value) => {
        const forn = fornecedores.find(f => f.id.toString() === value);
        setFormData(prev => ({
            ...prev,
            fornecedor_id: value,
            fornecedor_nome: forn?.nome || forn?.nome_empresa || ''
        }));
    };

    const handleProdutoChange = (value) => {
        if (value === 'todos') {
            setFormData(prev => ({ ...prev, produto_id: '', produto_nome: 'Todos os produtos' }));
        } else {
            const prod = produtos.find(p => p.id.toString() === value);
            setFormData(prev => ({
                ...prev,
                produto_id: value,
                produto_nome: prod?.nome || ''
            }));
        }
    };

    const handleSubmit = () => {
        if (!formData.nome_campanha || !formData.fornecedor_id || !formData.preco_tabela ||
            !formData.preco_promocional || !formData.data_inicio || !formData.data_fim) {
            toast.error('Preencha todos os campos obrigatórios');
            return;
        }
        salvarPromocao.mutate(formData);
    };

    // Calcular desconto no form
    const descontoCalculado = useMemo(() => {
        const tabela = parseFloat(formData.preco_tabela);
        const promo = parseFloat(formData.preco_promocional);
        if (tabela && promo && tabela > 0) {
            return ((1 - promo / tabela) * 100).toFixed(1);
        }
        return null;
    }, [formData.preco_tabela, formData.preco_promocional]);

    const economiaUnitaria = useMemo(() => {
        const tabela = parseFloat(formData.preco_tabela);
        const promo = parseFloat(formData.preco_promocional);
        if (tabela && promo) {
            return (tabela - promo).toFixed(2);
        }
        return null;
    }, [formData.preco_tabela, formData.preco_promocional]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-green-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <Tag className="w-6 h-6 text-amber-500" />
                        Promoções de Fornecedores
                    </h2>
                    <p className="text-sm text-gray-500">
                        Gerencie condições especiais de compra oferecidas pelos seus fornecedores
                    </p>
                </div>
                <Button onClick={() => abrirModal()} className="gap-2 bg-amber-600 hover:bg-amber-700">
                    <Plus className="w-4 h-4" />
                    Nova Promoção
                </Button>
            </div>

            {/* Cards de resumo */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <CheckCircle className="w-8 h-8 text-green-600" />
                            <span className="text-3xl font-bold text-green-700">{stats.ativas}</span>
                        </div>
                        <p className="text-sm text-green-600 mt-2">Promoções Ativas</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <Clock className="w-8 h-8 text-orange-600" />
                            <span className="text-3xl font-bold text-orange-700">{stats.expirando}</span>
                        </div>
                        <p className="text-sm text-orange-600 mt-2">Expirando em 3 dias</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <TrendingDown className="w-8 h-8 text-blue-600" />
                            <span className="text-3xl font-bold text-blue-700">
                                R$ {stats.economiaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                            </span>
                        </div>
                        <p className="text-sm text-blue-600 mt-2">Economia Total Obtida</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <Building2 className="w-8 h-8 text-purple-600" />
                            <span className="text-3xl font-bold text-purple-700">{promocoes.length}</span>
                        </div>
                        <p className="text-sm text-purple-600 mt-2">Total de Promoções</p>
                    </CardContent>
                </Card>
            </div>

            {/* Filtros */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <Input
                                placeholder="Buscar por campanha, fornecedor ou produto..."
                                value={busca}
                                onChange={(e) => setBusca(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                            <SelectTrigger className="w-[200px]">
                                <Filter className="w-4 h-4 mr-2" />
                                <SelectValue placeholder="Filtrar" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todas">Todas</SelectItem>
                                <SelectItem value="ativas">Ativas</SelectItem>
                                <SelectItem value="expirando">Expirando</SelectItem>
                                <SelectItem value="futuras">Futuras</SelectItem>
                                <SelectItem value="expiradas">Expiradas</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Lista de promoções */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Campanha</TableHead>
                                <TableHead>Fornecedor</TableHead>
                                <TableHead>Produto/Categoria</TableHead>
                                <TableHead className="text-right">Preço Tabela</TableHead>
                                <TableHead className="text-right">Preço Promo</TableHead>
                                <TableHead className="text-center">Desconto</TableHead>
                                <TableHead>Período</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {promocoesFiltradas.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                                        <Tag className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                                        <p>Nenhuma promoção encontrada</p>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                promocoesFiltradas.map((promo) => {
                                    const statusInfo = getStatusPromocao(promo);
                                    const diasRestantes = differenceInDays(new Date(promo.data_fim), new Date());

                                    return (
                                        <TableRow key={promo.id} className="hover:bg-gray-50">
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Tag className="w-4 h-4 text-amber-500" />
                                                    <span className="font-medium">{promo.nome_campanha}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Building2 className="w-4 h-4 text-gray-400" />
                                                    {promo.fornecedor_nome || '-'}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {promo.produto_nome || promo.categoria || 'Geral'}
                                            </TableCell>
                                            <TableCell className="text-right text-gray-500">
                                                R$ {(promo.preco_tabela || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-green-600">
                                                R$ {(promo.preco_promocional || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge className="bg-green-100 text-green-700 gap-1">
                                                    <Percent className="w-3 h-3" />
                                                    {promo.desconto_percentual || 0}%
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm">
                                                    <div className="flex items-center gap-1 text-gray-600">
                                                        <Calendar className="w-3 h-3" />
                                                        {format(new Date(promo.data_inicio), 'dd/MM/yy')} - {format(new Date(promo.data_fim), 'dd/MM/yy')}
                                                    </div>
                                                    {statusInfo.status === 'ativa' && diasRestantes > 3 && (
                                                        <p className="text-xs text-gray-400">{diasRestantes} dias restantes</p>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={statusInfo.cor}>
                                                    {statusInfo.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => abrirModal(promo)}
                                                        title="Editar"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => excluirPromocao.mutate(promo.id)}
                                                        title="Excluir"
                                                        className="text-red-600 hover:text-red-700"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                    {(statusInfo.status === 'ativa' || statusInfo.status === 'expirando') && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="gap-1 text-green-600 border-green-300"
                                                            title="Criar pedido usando esta promoção"
                                                        >
                                                            <ShoppingCart className="w-3 h-3" />
                                                            Comprar
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Modal Nova/Editar Promoção */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Tag className="w-5 h-5 text-amber-600" />
                            {editando ? 'Editar Promoção' : 'Nova Promoção de Fornecedor'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {/* Nome da campanha */}
                        <div>
                            <Label>Nome da Campanha *</Label>
                            <Input
                                value={formData.nome_campanha}
                                onChange={(e) => handleChange('nome_campanha', e.target.value)}
                                placeholder="Ex: Queima de Estoque Janeiro, Black Friday 2024..."
                                className="mt-1"
                            />
                        </div>

                        {/* Fornecedor e Produto */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Fornecedor *</Label>
                                <Select value={formData.fornecedor_id} onValueChange={handleFornecedorChange}>
                                    <SelectTrigger className="mt-1">
                                        <SelectValue placeholder="Selecione o fornecedor" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {fornecedores.map(f => (
                                            <SelectItem key={f.id} value={f.id.toString()}>
                                                {f.nome || f.nome_empresa}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Produto (opcional)</Label>
                                <Select value={formData.produto_id || 'todos'} onValueChange={handleProdutoChange}>
                                    <SelectTrigger className="mt-1">
                                        <SelectValue placeholder="Todos os produtos" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todos">Todos os produtos</SelectItem>
                                        {produtos.filter(p => p.ativo !== false).slice(0, 50).map(p => (
                                            <SelectItem key={p.id} value={p.id.toString()}>
                                                {p.nome}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Preços */}
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label>Preço Tabela (Normal) *</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.preco_tabela}
                                    onChange={(e) => handleChange('preco_tabela', e.target.value)}
                                    placeholder="R$ 0,00"
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label>Preço Promocional *</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.preco_promocional}
                                    onChange={(e) => handleChange('preco_promocional', e.target.value)}
                                    placeholder="R$ 0,00"
                                    className="mt-1 border-green-300"
                                />
                            </div>
                            <div>
                                <Label>Qtd Mínima</Label>
                                <Input
                                    type="number"
                                    value={formData.quantidade_minima}
                                    onChange={(e) => handleChange('quantidade_minima', e.target.value)}
                                    placeholder="1"
                                    className="mt-1"
                                />
                            </div>
                        </div>

                        {/* Indicadores de economia */}
                        {descontoCalculado && (
                            <Alert className="bg-green-50 border-green-200">
                                <TrendingDown className="h-4 w-4 text-green-600" />
                                <AlertDescription className="text-green-800">
                                    <strong>Desconto: {descontoCalculado}%</strong> — Economia de R$ {economiaUnitaria} por unidade
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Período */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Data Início *</Label>
                                <Input
                                    type="date"
                                    value={formData.data_inicio}
                                    onChange={(e) => handleChange('data_inicio', e.target.value)}
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label>Data Fim *</Label>
                                <Input
                                    type="date"
                                    value={formData.data_fim}
                                    onChange={(e) => handleChange('data_fim', e.target.value)}
                                    className="mt-1"
                                />
                            </div>
                        </div>

                        {/* Observação */}
                        <div>
                            <Label>Observação</Label>
                            <Textarea
                                value={formData.observacao}
                                onChange={(e) => handleChange('observacao', e.target.value)}
                                placeholder="Detalhes adicionais sobre a promoção..."
                                rows={2}
                                className="mt-1"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={fecharModal}>Cancelar</Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={salvarPromocao.isPending}
                            className="bg-amber-600 hover:bg-amber-700"
                        >
                            {salvarPromocao.isPending ? (
                                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Salvando...</>
                            ) : (
                                <><Tag className="w-4 h-4 mr-2" /> {editando ? 'Salvar' : 'Cadastrar'}</>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
