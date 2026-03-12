import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { FileText, Copy, Tag, Check, X, Clock, AlertCircle, Plus, Send, MessageSquare, History, Phone } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { comprasService } from "@/services/comprasService";
import { ApprovalEngine } from '@/services/ApprovalEngine';
import AprovacaoBadge from './AprovacaoBadge';
import { useAuth } from "@/hooks/useAuth";
import { base44, supabase } from "@/api/base44Client";
import MarkupCalculator from "./MarkupCalculator";

export default function OCDetailModal({ open, onClose, pedido, fornecedores = [] }) {
    const queryClient = useQueryClient();
    const { user, can } = useAuth();

    const [solicitandoAprovacao, setSolicitandoAprovacao] = React.useState(false);
    const [usuarioSelecionadoId, setUsuarioSelecionadoId] = React.useState('');
    const [novoComentario, setNovoComentario] = React.useState('');

    // Communication fields state
    const [showCommEdit, setShowCommEdit] = React.useState(false);
    const [commData, setCommData] = React.useState({
        quem_aceitou: pedido?.quem_aceitou || '',
        tipo_comunicacao: pedido?.tipo_comunicacao || 'WHATSAPP',
        data_hora_comunicacao: pedido?.data_hora_comunicacao || new Date().toISOString(),
        devolutiva: pedido?.devolutiva || ''
    });

    const handleDecision = useMutation({
        mutationFn: async ({ status, justification }) => {
            const currentLevelApv = (pedido.aprovacoes_novas || []).find(a => a.status === 'PENDENTE' && a.nivel === pedido.aprovacao_nivel_atual);
            if (!currentLevelApv) throw new Error("Aprovação pendente não encontrada no nível atual.");

            const { data: { user: authUser } } = await supabase.auth.getUser();

            return ApprovalEngine.processDecision(
                currentLevelApv.id,
                pedido.id,
                authUser.id,
                status,
                justification
            );
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pedidos-compra-kanban'] });
            queryClient.invalidateQueries({ queryKey: ['compras_ordens'] });
            toast.success("Decisão processada com sucesso!");
        },
        onError: (err) => {
            toast.error("Erro ao processar decisão: " + err.message);
        }
    });

    React.useEffect(() => {
        if (pedido) {
            setCommData({
                quem_aceitou: pedido.quem_aceitou || '',
                tipo_comunicacao: pedido.tipo_comunicacao || 'WHATSAPP',
                data_hora_comunicacao: pedido.data_hora_comunicacao || new Date().toISOString(),
                devolutiva: pedido.devolutiva || ''
            });
        }
    }, [pedido]);

    // Status badges config
    const statusConfig = {
        'NÃO FATURADO': { cor: 'bg-red-100 text-red-800' },
        'APROVADO': { cor: 'bg-purple-100 text-purple-800' },
        'CONFIRMADO': { cor: 'bg-blue-100 text-blue-800' },
        'BOLETO ENVIADO': { cor: 'bg-yellow-100 text-yellow-800' },
        'VALOR PAGO': { cor: 'bg-green-100 text-green-800' },
        'Rascunho': { cor: 'bg-gray-100 text-gray-800' },
        'Enviado': { cor: 'bg-blue-100 text-blue-800' },
        'Cancelado': { cor: 'bg-red-100 text-red-800' }
    };

    const statusOptions = [
        'NÃO FATURADO',
        'APROVADO',
        'CONFIRMADO',
        'BOLETO ENVIADO',
        'VALOR PAGO',
        'Cancelado'
    ];

    const gerarTextoPedido = (pedidoData) => {
        const fornecedor = fornecedores.find(f => f.id === pedidoData.fornecedor_id);
        const dataFormatada = pedidoData.data_pedido ? format(new Date(pedidoData.data_pedido), 'dd/MM/yyyy') : 'Não informada';
        const previsaoFormatada = pedidoData.data_previsao_entrega ? format(new Date(pedidoData.data_previsao_entrega), 'dd/MM/yyyy') : 'A combinar';

        let texto = `*PEDIDO DE COMPRA*\n`;
        texto += `Nº: ${pedidoData.numero_pedido || 'Novo'}\n`;
        texto += `Data: ${dataFormatada}\n\n`;

        texto += `*FORNECEDOR:*\n`;
        texto += `${pedidoData.fornecedor_nome || (fornecedor?.nome_empresa || fornecedor?.razao_social || 'Desconhecido')}\n`;
        if (fornecedor?.telefone) texto += `Tel: ${fornecedor.telefone}\n`;
        if (fornecedor?.email) texto += `Email: ${fornecedor.email}\n`;
        texto += `\n`;

        texto += `*ITENS DO PEDIDO:*\n`;
        texto += `━━━━━━━━━━━━━━━━━━━━━━\n`;

        (pedidoData.itens || []).forEach((item, index) => {
            const total = item.quantidade_pedida * item.preco_unitario;
            texto += `${index + 1}. ${item.produto_nome}\n`;
            texto += `   Qtd: ${item.quantidade_pedida} | R$ ${(item.preco_unitario || 0).toFixed(2)} = R$ ${total.toFixed(2)}\n`;
        });

        texto += `━━━━━━━━━━━━━━━━━━━━━━\n`;

        if (pedidoData.valor_frete > 0) {
            texto += `Frete: R$ ${pedidoData.valor_frete.toFixed(2)}\n`;
        }
        if (pedidoData.valor_desconto > 0) {
            texto += `Desconto: R$ ${pedidoData.valor_desconto.toFixed(2)}\n`;
        }

        texto += `*TOTAL: R$ ${(pedidoData.valor_total || 0).toFixed(2)}*\n\n`;

        if (pedidoData.tipo_preco === 'promocional') {
            texto += `🏷️ *Preço Promocional*\n`;
            if (pedidoData.promocao_observacao) texto += `   ${pedidoData.promocao_observacao}\n`;
            texto += `   Economia: R$ ${(pedidoData.economia_total || 0).toFixed(2)}\n\n`;
        }

        texto += `*Previsão de Entrega:* ${previsaoFormatada}\n`;
        if (pedidoData.condicoes_pagamento) {
            texto += `*Pagamento:* ${pedidoData.condicoes_pagamento}\n`;
        }

        if (pedidoData.observacoes) {
            texto += `\n*Observações:*\n${pedidoData.observacoes}\n`;
        }

        texto += `\n---\n_Móveis Pedro II - Gestão de Compras_`;

        return texto;
    };

    const handleCopiar = async () => {
        const texto = gerarTextoPedido(pedido);
        try {
            await navigator.clipboard.writeText(texto);
            toast.success("Listagem do pedido copiada para a área de transferência!");
        } catch (err) {
            toast.error("Erro ao copiar listagem. Tente manualmente.");
        }
    };

    // --- Queries & Mutations ---
    const { data: aprovacoes = [], isLoading: loadingAprovacoes } = useQuery({
        queryKey: ['compras_aprovacoes', pedido?.id],
        queryFn: () => comprasService.getAprovacoesDaOrdem(pedido.id),
        enabled: open && !!pedido?.id
    });

    const { data: usuarios = [] } = useQuery({
        queryKey: ['funcionarios_ativos'],
        queryFn: async () => {
            return base44.entities.Funcionario.list();
        },
        select: (data) => data.filter(u => u.ativo && u.cargo !== 'Vendedor' && u.id !== user?.id),
        enabled: open && solicitandoAprovacao
    });

    const solicitarAprovacao = useMutation({
        mutationFn: (userId) => comprasService.requestApproval(pedido?.id, userId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['compras_aprovacoes', pedido?.id] });
            toast.success("Solicitação de aprovação enviada!");
            setSolicitandoAprovacao(false);
            setUsuarioSelecionadoId('');
        },
        onError: (err) => {
            toast.error("Erro ao solicitar aprovação: " + err.message);
        }
    });

    const aprovarReprovar = useMutation({
        mutationFn: ({ aprovacaoId, status, comentarios }) =>
            comprasService.respondApproval(aprovacaoId, status, comentarios),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['compras_aprovacoes', pedido?.id] });
            queryClient.invalidateQueries({ queryKey: ['compras_ordens'] });
            toast.success("Resposta enviada com sucesso!");
        },
        onError: (err) => {
            toast.error("Erro ao responder aprovação: " + err.message);
        }
    });

    const updateOrdemMutation = useMutation({
        mutationFn: async (data) => {
            // Se mudou a devolutiva, registrar no histórico
            if (data.devolutiva !== undefined && data.devolutiva !== pedido.devolutiva) {
                await comprasService.logComunicacaoChange(pedido.id, 'devolutiva', pedido.devolutiva, data.devolutiva, user?.id);
            }
            return comprasService.updateOrdem(pedido.id, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['compras_ordens'] });
            queryClient.invalidateQueries({ queryKey: ['pedidos-compra-kanban'] });
            queryClient.invalidateQueries({ queryKey: ['compras_comunicacoes_historico', pedido.id] });
            toast.success("Pedido atualizado com sucesso!");
            setShowCommEdit(false);
        },
        onError: (err) => toast.error("Erro ao atualizar pedido: " + err.message)
    });

    const { data: centrosCusto = [] } = useQuery({
        queryKey: ['centros-custo-select'],
        queryFn: () => comprasService.getCentrosCusto(),
        enabled: open
    });

    // --- TIMELINE ---
    const { data: comunicacoes = [], isLoading: loadingComunicacoes } = useQuery({
        queryKey: ['compras_comunicacoes', pedido?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('compras_comunicacoes')
                .select('*')
                .eq('ordem_compra_id', pedido?.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        },
        enabled: open && !!pedido?.id
    });

    const { data: commHistorico = [] } = useQuery({
        queryKey: ['compras_comunicacoes_historico', pedido?.id],
        queryFn: () => comprasService.getComunicacaoHistorico(pedido?.id),
        enabled: open && !!pedido?.id
    });

    const enviarComentario = useMutation({
        mutationFn: async (texto) => {
            return comprasService.addComunicacao({
                ordem_compra_id: pedido?.id,
                tipo: 'nota_interna',
                remetente: user?.full_name || 'Usuário',
                conteudo: { mensagem: texto }
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['compras_comunicacoes', pedido?.id] });
            setNovoComentario('');
            toast.success("Nota interna adicionada.");
        },
        onError: (err) => {
            toast.error("Erro ao adicionar nota: " + err.message);
        }
    });

    const { data: markupConfig } = useQuery({
        queryKey: ['markup_config', pedido?.fornecedor_id],
        queryFn: () => comprasService.getMarkupConfig(pedido?.fornecedor_id),
        enabled: open && !!pedido?.fornecedor_id
    });

    const fatorMarkup = markupConfig?.fator_calculado || 0;

    const handleSaveComm = () => {
        updateOrdemMutation.mutate(commData);
    };

    if (!pedido) return null;

    return (
        <Dialog open={open} onOpenChange={onClose} >
            <DialogContent className="max-w-3xl text-left">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xl font-black">
                            <FileText className="w-6 h-6 text-blue-600" />
                            OC {pedido.numero_pedido}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={handleCopiar} className="gap-2 text-purple-600 border-purple-200 hover:bg-purple-50">
                                <Copy className="w-4 h-4" />
                                Copiar Pedido
                            </Button>
                        </div>
                    </DialogTitle>
                </DialogHeader>
                <div className="mt-4">
                    <Tabs defaultValue="detalhes">
                        <TabsList className="mb-4 bg-gray-100 p-1">
                            <TabsTrigger value="detalhes" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Detalhes</TabsTrigger>
                            <TabsTrigger value="itens" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Itens</TabsTrigger>
                            <TabsTrigger value="aprovacoes" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                Aprovações
                                {aprovacoes.filter(a => a.status === 'pendente').length > 0 && (
                                    <Badge variant="destructive" className="ml-2 w-5 h-5 flex items-center justify-center p-0 text-[10px] rounded-full">
                                        {aprovacoes.filter(a => a.status === 'pendente').length}
                                    </Badge>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="historico" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Histórico & Notas</TabsTrigger>
                            <TabsTrigger value="markup_config" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Config. Markup</TabsTrigger>
                        </TabsList>

                        <TabsContent value="detalhes" className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <Card className="p-4 bg-gray-50/50 border-gray-100">
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-sm text-gray-500">Fornecedor</p>
                                            <p className="font-bold text-lg">{pedido.fornecedor_nome}</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-xs text-gray-500 mb-1">Status Interno</p>
                                                <Select
                                                    value={pedido.status}
                                                    onValueChange={(v) => updateOrdemMutation.mutate({ status: v })}
                                                >
                                                    <SelectTrigger className="h-8 py-0">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {statusOptions.map(opt => (
                                                            <SelectItem key={opt} value={opt}>
                                                                <Badge className={statusConfig[opt]?.cor || 'bg-gray-100'}>
                                                                    {opt}
                                                                </Badge>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500 mb-1">Canal/Vendedor</p>
                                                <Select
                                                    value={pedido.centro_custo_id}
                                                    onValueChange={(v) => updateOrdemMutation.mutate({ centro_custo_id: v })}
                                                >
                                                    <SelectTrigger className="h-8 py-0">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {centrosCusto.map(cc => (
                                                            <SelectItem key={cc.id} value={cc.id}>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cc.cor }} />
                                                                    {cc.nome}
                                                                </div>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>
                                </Card>

                                <Card className="p-4 bg-gray-50/50 border-gray-100">
                                    <div className="grid grid-cols-2 gap-4 h-full">
                                        <div>
                                            <p className="text-sm text-gray-500">Data do Pedido</p>
                                            <p className="font-medium">
                                                {pedido.data_pedido ? format(new Date(pedido.data_pedido), 'dd/MM/yyyy') : '-'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500">Previsão Entrega</p>
                                            <p className="font-medium">
                                                {pedido.data_previsao_entrega ? format(new Date(pedido.data_previsao_entrega), 'dd/MM/yyyy') : '-'}
                                            </p>
                                        </div>
                                        <div className="col-span-2 pt-2 border-t mt-auto">
                                            <p className="text-xs text-gray-500">Valor Total</p>
                                            <p className="text-2xl font-black text-green-700">
                                                R$ {(pedido.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </p>
                                        </div>
                                    </div>
                                </Card>
                            </div>

                            {/* Template Comunicação (Edilene Style) */}
                            <Card className="border-blue-200">
                                <CardHeader className="bg-blue-50/50 py-3 border-b flex flex-row items-center justify-between">
                                    <CardTitle className="text-sm font-black text-blue-800 flex items-center gap-2">
                                        <Phone className="w-4 h-4" /> COMUNICAÇÃO E DEVOLUTIVA
                                    </CardTitle>
                                    <Button variant="ghost" size="sm" onClick={() => setShowCommEdit(!showCommEdit)} className="h-8 text-blue-700">
                                        {showCommEdit ? 'Cancelar' : 'Editar Info'}
                                    </Button>
                                </CardHeader>
                                <CardContent className="pt-4 space-y-4">
                                    {showCommEdit ? (
                                        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] uppercase font-bold text-gray-500">Quem Aceitou</Label>
                                                    <Input
                                                        value={commData.quem_aceitou}
                                                        onChange={e => setCommData(prev => ({ ...prev, quem_aceitou: e.target.value }))}
                                                        placeholder="Nome do contato..."
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] uppercase font-bold text-gray-500">Canal</Label>
                                                    <Select
                                                        value={commData.tipo_comunicacao}
                                                        onValueChange={v => setCommData(prev => ({ ...prev, tipo_comunicacao: v }))}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="WHATSAPP">WHATSAPP</SelectItem>
                                                            <SelectItem value="EMAIL">EMAIL</SelectItem>
                                                            <SelectItem value="TELEFONE">TELEFONE</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] uppercase font-bold text-gray-500">Devolutiva do Fornecedor (Histórico)</Label>
                                                <Textarea
                                                    value={commData.devolutiva}
                                                    onChange={e => setCommData(prev => ({ ...prev, devolutiva: e.target.value }))}
                                                    placeholder="Previsão, atrasos, confirmações..."
                                                    className="min-h-[100px]"
                                                />
                                            </div>
                                            <div className="flex justify-end">
                                                <Button onClick={handleSaveComm} disabled={updateOrdemMutation.isPending} className="bg-blue-600">
                                                    Salvar Devolutiva
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Quem Aceitou</p>
                                                    <p className="text-sm font-semibold">{pedido.quem_aceitou || '-'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Canal / Data</p>
                                                    <p className="text-sm flex items-center gap-2 font-semibold">
                                                        <Badge variant="outline" className="text-[9px] h-4 px-1">{pedido.tipo_comunicacao || 'N/A'}</Badge>
                                                        {pedido.data_hora_comunicacao ? format(new Date(pedido.data_hora_comunicacao), 'dd/MM HH:mm') : '-'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1.5 flex items-center gap-2">
                                                    Devolutiva Atual
                                                    {!pedido.devolutiva && (
                                                        <Badge variant="destructive" className="text-[8px] h-3.5 px-1 animate-pulse">REQUER ATENÇÃO</Badge>
                                                    )}
                                                </p>
                                                <div className="bg-gray-50 border rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap min-h-[60px]">
                                                    {pedido.devolutiva || 'Nenhuma devolutiva registrada.'}
                                                </div>
                                            </div>

                                            {/* Mini timeline of devolutiva changes */}
                                            {commHistorico.length > 0 && (
                                                <div className="pt-2">
                                                    <p className="text-[9px] text-gray-400 uppercase font-bold mb-2 flex items-center gap-1">
                                                        <History className="w-3 h-3" /> Histórico de Devolutivas
                                                    </p>
                                                    <div className="space-y-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                                                        {commHistorico.map((log) => (
                                                            <div key={log.id} className="text-[11px] border-l-2 border-blue-200 pl-2 py-0.5">
                                                                <span className="font-bold text-gray-500">{format(new Date(log.created_at), 'dd/MM HH:mm')}</span>
                                                                <span className="text-gray-400 mx-1">•</span>
                                                                <span className="text-gray-600">{log.valor_novo}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Promotion Banner */}
                            {pedido.tipo_preco === 'promocional' && (
                                <Card className="bg-amber-50 border-amber-200">
                                    <CardContent className="p-4 flex items-center gap-4">
                                        <div className="bg-amber-100 p-2 rounded-full">
                                            <Tag className="w-5 h-5 text-amber-600" />
                                        </div>
                                        <div>
                                            <p className="text-amber-900 font-black text-sm uppercase">Pedido Promocional</p>
                                            <p className="text-xs text-amber-700">{pedido.promocao_observacao || 'Itens com preço de tabela diferenciado'}</p>
                                        </div>
                                        <div className="ml-auto text-right">
                                            <p className="text-[10px] text-amber-600 uppercase font-bold">Economia Gerada</p>
                                            <p className="text-lg font-black text-amber-900">R$ {pedido.economia_total?.toFixed(2)}</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </TabsContent>

                        <TabsContent value="itens" className="space-y-4">
                            <div className="border rounded-xl overflow-hidden shadow-sm">
                                <Table>
                                    <TableHeader className="bg-gray-50">
                                        <TableRow>
                                            <TableHead className="font-bold">Produto / Descrição</TableHead>
                                            <TableHead className="text-center font-bold">Qtd</TableHead>
                                            <TableHead className="text-right font-bold">Custo Unit.</TableHead>
                                            {fatorMarkup > 0 && (
                                                <TableHead className="text-right text-blue-700 bg-blue-50/50 font-black">PV Sugerido</TableHead>
                                            )}
                                            <TableHead className="text-right font-bold">Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {(pedido.itens || []).map((item, index) => {
                                            const resMarkup = fatorMarkup > 0 ? comprasService.calcularPrecoVenda(item.preco_unitario, markupConfig) : null;
                                            return (
                                                <TableRow key={index} className="hover:bg-gray-50/50 transition-colors">
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-gray-800">{item.produto_nome}</span>
                                                            <span className="text-[11px] text-gray-500 uppercase">{item.descricao_personalizada || '-'}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center font-medium">{item.quantidade_pedida}</TableCell>
                                                    <TableCell className="text-right">
                                                        R$ {(item.preco_unitario || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </TableCell>
                                                    {fatorMarkup > 0 && (
                                                        <TableCell className="text-right text-blue-700 font-black bg-blue-50/20">
                                                            R$ {(resMarkup?.precoVenda || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                        </TableCell>
                                                    )}
                                                    <TableCell className="text-right font-bold text-gray-900">
                                                        R$ {((item.quantidade_pedida || 0) * (item.preco_unitario || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </TabsContent>

                        <TabsContent value="aprovacoes" className="space-y-4">
                            {/* New Multi-level Approval System */}
                            {pedido.aprovacao_status && (
                                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl mb-4 text-left">
                                    <h3 className="text-sm font-black text-amber-800 uppercase tracking-widest flex items-center gap-2 mb-3">
                                        <Clock className="w-4 h-4" />
                                        Fluxo de Aprovação Multinível
                                    </h3>

                                    <div className="space-y-3">
                                        {(pedido.aprovacoes_novas || []).sort((a, b) => a.nivel - b.nivel).map((apv) => (
                                            <div key={apv.id} className={cn(
                                                "flex items-center justify-between p-3 rounded-lg border",
                                                apv.status === 'APROVADO' ? "bg-green-50/50 border-green-100" :
                                                    apv.status === 'REJEITADO' ? "bg-red-50/50 border-red-100" :
                                                        "bg-white border-gray-100"
                                            )}>
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold",
                                                        apv.status === 'APROVADO' ? "bg-green-500 text-white" :
                                                            apv.status === 'PENDENTE' ? "bg-amber-500 text-white animate-pulse" :
                                                                "bg-gray-200 text-gray-500"
                                                    )}>
                                                        {apv.nivel}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold text-gray-800">
                                                            {apv.nivel === 1 ? 'Nível 1: Gerência' :
                                                                apv.nivel === 2 ? 'Nível 2: Eduardo' :
                                                                    apv.nivel === 3 ? 'Nível 3: Diretor' : `Nível ${apv.nivel}`}
                                                        </p>
                                                        {apv.user && (
                                                            <p className="text-[10px] text-gray-500">{apv.user.email} • {format(new Date(apv.data || apv.created_at), 'dd/MM HH:mm')}</p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <AprovacaoBadge status={apv.status} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {pedido.aprovacao_status === 'PENDENTE' && (
                                        <div className="mt-6 p-4 bg-white border border-amber-200 rounded-xl shadow-sm">
                                            <p className="text-sm font-bold text-gray-800 mb-3">Sua decisão é necessária:</p>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                                                    onClick={() => {
                                                        const just = prompt("Justificativa para rejeição:");
                                                        if (just) handleDecision.mutate({ status: 'REJEITADO', justification: just });
                                                    }}
                                                >
                                                    <X className="w-4 h-4 mr-2" /> Rejeitar
                                                </Button>
                                                <Button
                                                    className="flex-1 bg-green-600 hover:bg-green-700"
                                                    onClick={() => handleDecision.mutate({ status: 'APROVADO' })}
                                                >
                                                    <Check className="w-4 h-4 mr-2" /> Aprovar OC
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex justify-between items-center bg-gray-50 p-3 rounded border text-left">
                                <div>
                                    <h3 className="font-medium text-gray-800 uppercase text-xs font-black">Histórico Manual</h3>
                                    <p className="text-xs text-gray-500">
                                        Solicitações de aprovação legadas/manuais
                                    </p>
                                </div>
                                {can('Gerenciar Pedidos de Compra') && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setSolicitandoAprovacao(!solicitandoAprovacao)}
                                        className="bg-white"
                                    >
                                        <Plus className="w-4 h-4 mr-1" /> Solicitar Aprovação
                                    </Button>
                                )}
                            </div>

                            {solicitandoAprovacao && (
                                <Card className="border-blue-200 bg-blue-50/50">
                                    <CardContent className="p-4 flex items-end gap-3">
                                        <div className="flex-1 space-y-1">
                                            <p className="text-sm font-medium text-gray-700">Selecione o usuário para aprovação</p>
                                            <Select value={usuarioSelecionadoId} onValueChange={setUsuarioSelecionadoId}>
                                                <SelectTrigger className="bg-white">
                                                    <SelectValue placeholder="Selecione um gestor/diretor..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {usuarios.map(u => (
                                                        <SelectItem key={u.id} value={u.id}>
                                                            {u.full_name} ({u.cargo || 'Funcionario'})
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <Button
                                            onClick={() => solicitarAprovacao.mutate(usuarioSelecionadoId)}
                                            disabled={!usuarioSelecionadoId || solicitarAprovacao.isPending}
                                            className="bg-blue-600 hover:bg-blue-700 text-white"
                                        >
                                            <Send className="w-4 h-4 mr-2" /> Enviar
                                        </Button>
                                    </CardContent>
                                </Card>
                            )}

                            {loadingAprovacoes ? (
                                <div className="text-center py-4 text-gray-500">Carregando aprovações...</div>
                            ) : aprovacoes.length === 0 ? (
                                <div className="text-center py-8 text-gray-500 border rounded-lg bg-gray-50 border-dashed">
                                    Nenhuma solicitação de aprovação para este pedido.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {aprovacoes.map(apv => (
                                        <Card key={apv.id} className={apv.status === 'aprovado' ? 'border-green-200 bg-green-50/30' : apv.status === 'rejeitado' ? 'border-red-200 bg-red-50/30' : ''}>
                                            <CardContent className="p-4">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold overflow-hidden">
                                                            {apv.users?.avatar_url ? (
                                                                <img src={apv.users.avatar_url} alt={apv.users.full_name} className="w-full h-full object-cover" />
                                                            ) : (
                                                                apv.users?.full_name?.substring(0, 2).toUpperCase() || 'US'
                                                            )}
                                                        </div>
                                                        <div>
                                                            <p className="font-medium">Solicitado para: {apv.users?.full_name}</p>
                                                            <p className="text-xs text-gray-500 flex items-center gap-1">
                                                                <Clock className="w-3 h-3" />
                                                                {format(new Date(apv.created_at), "dd/MM/yyyy 'às' HH:mm")}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        {apv.status === 'pendente' && (
                                                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                                                                <AlertCircle className="w-3 h-3 mr-1" />
                                                                Aguardando
                                                            </Badge>
                                                        )}
                                                        {apv.status === 'aprovado' && (
                                                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                                                <Check className="w-3 h-3 mr-1" />
                                                                Aprovado
                                                            </Badge>
                                                        )}
                                                        {apv.status === 'rejeitado' && (
                                                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                                                <X className="w-3 h-3 mr-1" />
                                                                Rejeitado
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>

                                                {apv.comentarios && (
                                                    <div className="mt-3 bg-white p-3 rounded border text-sm text-gray-700 shadow-sm">
                                                        <span className="font-semibold block mb-1">Comentário:</span>
                                                        {apv.comentarios}
                                                    </div>
                                                )}

                                                {apv.status === 'pendente' && user?.id === apv.user_id && (
                                                    <div className="mt-4 flex gap-2 justify-end border-t pt-3">
                                                        <Button
                                                            variant="outline"
                                                            className="text-red-600 border-red-200 hover:bg-red-50"
                                                            onClick={() => {
                                                                const obs = prompt("Justificativa para rejeição:");
                                                                if (obs !== null) {
                                                                    aprovarReprovar.mutate({ aprovacaoId: apv.id, status: 'rejeitado', comentarios: obs });
                                                                }
                                                            }}
                                                            disabled={aprovarReprovar.isPending}
                                                        >
                                                            <X className="w-4 h-4 mr-2" />
                                                            Rejeitar
                                                        </Button>
                                                        <Button
                                                            className="bg-green-600 hover:bg-green-700 text-white"
                                                            onClick={() => {
                                                                const obs = prompt("Comentário (Opcional):");
                                                                if (obs !== null) {
                                                                    aprovarReprovar.mutate({ aprovacaoId: apv.id, status: 'aprovado', comentarios: obs });
                                                                }
                                                            }}
                                                            disabled={aprovarReprovar.isPending}
                                                        >
                                                            <Check className="w-4 h-4 mr-2" />
                                                            Aprovar Pedido
                                                        </Button>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="historico" className="space-y-4">
                            <div className="flex justify-between items-center bg-gray-50 p-3 rounded border">
                                <div>
                                    <h3 className="font-medium text-gray-800">Comunicações e Notas</h3>
                                    <p className="text-sm text-gray-500">
                                        Histórico consolidado de interações
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-2 items-start mt-4 mb-6">
                                <div className="w-10 h-10 rounded-full bg-blue-100 flex-shrink-0 flex items-center justify-center text-blue-700 font-bold overflow-hidden">
                                    {user?.avatar_url ? (
                                        <img src={user.avatar_url} alt="You" className="w-full h-full object-cover" />
                                    ) : (
                                        user?.full_name?.substring(0, 2).toUpperCase() || 'EU'
                                    )}
                                </div>
                                <div className="flex-1">
                                    <Textarea
                                        placeholder="Adicionar uma nota interna sobre o pedido..."
                                        className="min-h-[80px] bg-white resize-none"
                                        value={novoComentario}
                                        onChange={(e) => setNovoComentario(e.target.value)}
                                    />
                                    <div className="flex justify-end mt-2">
                                        <Button
                                            size="sm"
                                            onClick={() => enviarComentario.mutate(novoComentario)}
                                            disabled={!novoComentario.trim() || enviarComentario.isPending}
                                            className="bg-blue-600 hover:bg-blue-700 text-white"
                                        >
                                            <Send className="w-4 h-4 mr-2" /> Salvar Nota
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <div className="relative border-l border-gray-200 ml-5 space-y-6 pb-4">
                                {loadingComunicacoes ? (
                                    <div className="pl-6 text-sm text-gray-500">Carregando histórico...</div>
                                ) : (
                                    [...comunicacoes, ...commHistorico].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map((com, idx) => (
                                        <div key={com.id} className="relative pl-6">
                                            <div className="absolute -left-2 top-1.5 w-4 h-4 rounded-full bg-white border-2 border-blue-400" />
                                            <Card className="border-gray-100 shadow-sm overflow-hidden">
                                                <CardContent className="p-3">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-semibold text-sm text-gray-800">
                                                                {com.remetente || com.usuario?.email || 'Sistema'}
                                                            </span>
                                                            <Badge variant="secondary" className="text-[10px] uppercase font-semibold h-5 px-1.5 bg-gray-100">
                                                                {com.tipo || 'HISTÓRICO'}
                                                            </Badge>
                                                        </div>
                                                        <span className="text-xs text-gray-400 flex items-center">
                                                            <Clock className="w-3 h-3 mr-1" />
                                                            {format(new Date(com.created_at), "dd/MM HH:mm")}
                                                        </span>
                                                    </div>

                                                    {com.valor_novo ? (
                                                        <p className="text-xs text-gray-600 italic">
                                                            Alterou <span className="font-bold">{com.campo}</span> para: "{com.valor_novo}"
                                                        </p>
                                                    ) : (
                                                        <div className="mt-2 text-sm text-gray-700">
                                                            {com.tipo === 'nota_interna' && com.conteudo?.mensagem}
                                                            {com.tipo === 'whatsapp' && (
                                                                <div className="bg-green-50 border border-green-100 rounded p-2 text-green-800">
                                                                    <span className="block font-bold mb-1 opacity-70">Enviado por WhatsApp</span>
                                                                    {com.conteudo?.mensagem}
                                                                </div>
                                                            )}
                                                            {com.tipo === 'email' && (
                                                                <div className="bg-blue-50 border border-blue-100 rounded p-2 text-blue-800">
                                                                    <span className="block font-bold mb-1 opacity-70">Enviado por Email</span>
                                                                    {com.conteudo?.mensagem}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        </div>
                                    ))
                                )}
                            </div>
                        </TabsContent>

                        <TabsContent value="markup_config">
                            <MarkupCalculator
                                fornecedorId={pedido.fornecedor_id}
                                fornecedorNome={pedido.fornecedor_nome}
                            />
                        </TabsContent>
                    </Tabs>
                </div>
            </DialogContent>
        </Dialog >
    );
}
