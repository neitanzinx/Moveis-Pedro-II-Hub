import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import {
    Plus, Trash2, Search, Save, Send, Package, Building2, AlertTriangle,
    Sparkles, Tag, Calendar, TrendingDown, Check, DollarSign, Mail,
    MessageCircle, FileText, Copy, CheckCircle, X
} from "lucide-react";
import { toast } from "sonner";
import ProdutoCadastroCompleto from "@/components/produtos/ProdutoCadastroCompleto";
import { format } from "date-fns";

export default function PedidoCompraModal({ open, onClose, pedido = null, fornecedores = [] }) {
    const queryClient = useQueryClient();

    // Estado do formulário
    const [form, setForm] = useState({
        fornecedor_id: '',
        fornecedor_nome: '',
        data_pedido: new Date().toISOString().split('T')[0],
        data_previsao_entrega: '',
        observacoes: '',
        condicoes_pagamento: '',
        valor_frete: 0,
        valor_desconto: 0,
        itens: [],
        // Campos de promoção
        compra_promocional: false,
        preco_tabela_total: 0,
        promocao_inicio: '',
        promocao_fim: '',
        promocao_observacao: ''
    });

    const [buscaProduto, setBuscaProduto] = useState("");
    const [produtoSelecionado, setProdutoSelecionado] = useState(null);
    const [quantidade, setQuantidade] = useState(1);
    const [precoUnitario, setPrecoUnitario] = useState(0);
    const [precoTabela, setPrecoTabela] = useState(0);

    // Estado para cadastro de produtos novos
    const [produtoModalOpen, setProdutoModalOpen] = useState(false);
    const [produtoPendente, setProdutoPendente] = useState(null);
    const [produtosPendentesIndex, setProdutosPendentesIndex] = useState(0);
    const [salvandoProduto, setSalvandoProduto] = useState(false);

    // Estado para modal de opções de envio
    const [modalEnvio, setModalEnvio] = useState(false);
    const [pedidoSalvo, setPedidoSalvo] = useState(null);

    // Carregar dados do pedido se for edição
    useEffect(() => {
        if (pedido) {
            setForm({
                fornecedor_id: pedido.fornecedor_id || '',
                fornecedor_nome: pedido.fornecedor_nome || '',
                data_pedido: pedido.data_pedido || new Date().toISOString().split('T')[0],
                data_previsao_entrega: pedido.data_previsao_entrega || '',
                observacoes: pedido.observacoes || '',
                condicoes_pagamento: pedido.condicoes_pagamento || '',
                valor_frete: pedido.valor_frete || 0,
                valor_desconto: pedido.valor_desconto || 0,
                itens: pedido.itens || [],
                compra_promocional: pedido.tipo_preco === 'promocional',
                preco_tabela_total: pedido.preco_tabela_total || 0,
                promocao_inicio: pedido.promocao_inicio || '',
                promocao_fim: pedido.promocao_fim || '',
                promocao_observacao: pedido.promocao_observacao || ''
            });
        }
    }, [pedido]);

    // Buscar produtos
    const { data: produtos = [] } = useQuery({
        queryKey: ['produtos'],
        queryFn: () => base44.entities.Produto.list()
    });

    // Produtos filtrados pela busca
    const produtosFiltrados = produtos.filter(p =>
        buscaProduto.length >= 2 && (
            p.nome?.toLowerCase().includes(buscaProduto.toLowerCase()) ||
            p.codigo_barras?.includes(buscaProduto)
        )
    ).slice(0, 5);

    // Mutation para salvar
    const salvarPedido = useMutation({
        mutationFn: async (data) => {
            if (pedido?.id) {
                return base44.entities.PedidoCompra.update(pedido.id, data);
            } else {
                return base44.entities.PedidoCompra.create(data);
            }
        },
        onSuccess: (resultado, variables) => {
            queryClient.invalidateQueries({ queryKey: ['pedidos-compra'] });
            toast.success(pedido ? 'Pedido atualizado!' : 'Pedido criado!');

            // Se o status foi "Enviado", abrir modal de opções
            if (variables.status === 'Enviado') {
                setPedidoSalvo({ ...variables, id: resultado?.id || pedido?.id });
                setModalEnvio(true);
            } else {
                onClose();
            }
        },
        onError: (error) => {
            toast.error('Erro ao salvar: ' + error.message);
        }
    });

    // Handlers
    const handleFornecedorChange = (id) => {
        const fornecedor = fornecedores.find(f => f.id === id);
        setForm({
            ...form,
            fornecedor_id: id,
            fornecedor_nome: fornecedor?.nome_empresa || fornecedor?.razao_social || ''
        });
    };

    const adicionarItem = () => {
        if (!buscaProduto || buscaProduto.length < 2) {
            toast.error('Digite o nome do produto');
            return;
        }
        if (quantidade <= 0) {
            toast.error('Quantidade inválida');
            return;
        }

        let novoItem;

        if (produtoSelecionado) {
            novoItem = {
                produto_id: produtoSelecionado.id,
                produto_nome: produtoSelecionado.nome,
                produto_codigo: produtoSelecionado.codigo_barras || '',
                quantidade_pedida: quantidade,
                preco_unitario: precoUnitario || produtoSelecionado.preco_custo || 0,
                preco_tabela: form.compra_promocional ? (precoTabela || produtoSelecionado.preco_custo_tabela || produtoSelecionado.preco_custo || precoUnitario) : null,
                isNew: false
            };
        } else {
            novoItem = {
                produto_id: null,
                produto_nome: buscaProduto,
                produto_codigo: '',
                quantidade_pedida: quantidade,
                preco_unitario: precoUnitario || 0,
                preco_tabela: form.compra_promocional ? precoTabela : null,
                isNew: true
            };
        }

        setForm({
            ...form,
            itens: [...form.itens, novoItem]
        });

        setBuscaProduto("");
        setProdutoSelecionado(null);
        setQuantidade(1);
        setPrecoUnitario(0);
        setPrecoTabela(0);
    };

    const removerItem = (index) => {
        setForm({
            ...form,
            itens: form.itens.filter((_, i) => i !== index)
        });
    };

    const calcularTotal = () => {
        const totalItens = form.itens.reduce((sum, item) =>
            sum + (item.quantidade_pedida * item.preco_unitario), 0
        );
        return totalItens + (form.valor_frete || 0) - (form.valor_desconto || 0);
    };

    const calcularTotalTabela = () => {
        return form.itens.reduce((sum, item) =>
            sum + (item.quantidade_pedida * (item.preco_tabela || item.preco_unitario)), 0
        );
    };

    const economiaTotal = useMemo(() => {
        if (!form.compra_promocional) return 0;
        const totalTabela = calcularTotalTabela();
        const totalPromo = form.itens.reduce((sum, item) =>
            sum + (item.quantidade_pedida * item.preco_unitario), 0
        );
        return totalTabela - totalPromo;
    }, [form.itens, form.compra_promocional]);

    const produtosNovos = form.itens.filter(item => item.isNew);

    const iniciarCadastroProdutos = (status) => {
        if (produtosNovos.length > 0) {
            setProdutosPendentesIndex(0);
            const primeiroNovo = produtosNovos[0];
            const itemIndex = form.itens.findIndex(i => i.produto_nome === primeiroNovo.produto_nome && i.isNew);
            setProdutoPendente({
                ...primeiroNovo,
                _itemIndex: itemIndex,
                _statusFinal: status
            });
            setProdutoModalOpen(true);
        } else {
            finalizarPedido(status);
        }
    };

    const handleProdutoCadastrado = async (dadosProduto) => {
        setSalvandoProduto(true);
        try {
            const novoProduto = await base44.entities.Produto.create(dadosProduto);
            queryClient.invalidateQueries({ queryKey: ['produtos'] });

            const novosItens = [...form.itens];
            const itemIndex = produtoPendente._itemIndex;
            novosItens[itemIndex] = {
                ...novosItens[itemIndex],
                produto_id: novoProduto.id,
                produto_codigo: novoProduto.codigo_barras || '',
                isNew: false
            };
            setForm({ ...form, itens: novosItens });

            toast.success(`Produto "${dadosProduto.nome}" cadastrado!`);

            const proximoIndex = produtosPendentesIndex + 1;
            if (proximoIndex < produtosNovos.length) {
                setProdutosPendentesIndex(proximoIndex);
                const proximoNovo = produtosNovos[proximoIndex];
                const novoItemIndex = novosItens.findIndex((i, idx) =>
                    i.produto_nome === proximoNovo.produto_nome && i.isNew && idx > itemIndex
                );
                setProdutoPendente({
                    ...proximoNovo,
                    _itemIndex: novoItemIndex !== -1 ? novoItemIndex : itemIndex + 1,
                    _statusFinal: produtoPendente._statusFinal
                });
            } else {
                setProdutoModalOpen(false);
                setProdutoPendente(null);
                setTimeout(() => {
                    finalizarPedido(produtoPendente._statusFinal);
                }, 100);
            }
        } catch (error) {
            toast.error('Erro ao cadastrar produto: ' + error.message);
        } finally {
            setSalvandoProduto(false);
        }
    };

    const finalizarPedido = (status) => {
        const dadosSanitizados = {
            ...form,
            status,
            valor_total: calcularTotal(),
            data_pedido: form.data_pedido || null,
            data_previsao_entrega: form.data_previsao_entrega || null,
            tipo_preco: form.compra_promocional ? 'promocional' : 'tabela',
            preco_tabela_total: form.compra_promocional ? calcularTotalTabela() : null,
            economia_total: form.compra_promocional ? economiaTotal : 0,
            promocao_inicio: form.compra_promocional ? (form.promocao_inicio || null) : null,
            promocao_fim: form.compra_promocional ? (form.promocao_fim || null) : null,
            promocao_observacao: form.compra_promocional ? (form.promocao_observacao || null) : null
        };
        salvarPedido.mutate(dadosSanitizados);
    };

    const handleSalvar = (status = 'Rascunho') => {
        if (!form.fornecedor_id) {
            toast.error('Selecione um fornecedor');
            return;
        }
        if (form.itens.length === 0) {
            toast.error('Adicione pelo menos um item');
            return;
        }

        iniciarCadastroProdutos(status);
    };

    // ========== FUNÇÕES DE ENVIO ==========

    // Gerar texto do pedido
    const gerarTextoPedido = (pedidoData) => {
        const fornecedor = fornecedores.find(f => f.id === pedidoData.fornecedor_id);
        const dataFormatada = pedidoData.data_pedido ? format(new Date(pedidoData.data_pedido), 'dd/MM/yyyy') : 'Não informada';
        const previsaoFormatada = pedidoData.data_previsao_entrega ? format(new Date(pedidoData.data_previsao_entrega), 'dd/MM/yyyy') : 'A combinar';

        let texto = `*PEDIDO DE COMPRA*\n`;
        texto += `Nº: ${pedidoData.numero_pedido || 'Novo'}\n`;
        texto += `Data: ${dataFormatada}\n\n`;

        texto += `*FORNECEDOR:*\n`;
        texto += `${pedidoData.fornecedor_nome}\n`;
        if (fornecedor?.telefone) texto += `Tel: ${fornecedor.telefone}\n`;
        if (fornecedor?.email) texto += `Email: ${fornecedor.email}\n`;
        texto += `\n`;

        texto += `*ITENS DO PEDIDO:*\n`;
        texto += `━━━━━━━━━━━━━━━━━━━━━━\n`;

        (pedidoData.itens || []).forEach((item, index) => {
            const total = item.quantidade_pedida * item.preco_unitario;
            texto += `${index + 1}. ${item.produto_nome}\n`;
            texto += `   Qtd: ${item.quantidade_pedida} | R$ ${item.preco_unitario.toFixed(2)} = R$ ${total.toFixed(2)}\n`;
        });

        texto += `━━━━━━━━━━━━━━━━━━━━━━\n`;

        if (pedidoData.valor_frete > 0) {
            texto += `Frete: R$ ${pedidoData.valor_frete.toFixed(2)}\n`;
        }
        if (pedidoData.valor_desconto > 0) {
            texto += `Desconto: R$ ${pedidoData.valor_desconto.toFixed(2)}\n`;
        }

        texto += `*TOTAL: R$ ${calcularTotal().toFixed(2)}*\n\n`;

        if (pedidoData.compra_promocional) {
            texto += `🏷️ *Preço Promocional*\n`;
            if (pedidoData.promocao_observacao) texto += `   ${pedidoData.promocao_observacao}\n`;
            texto += `   Economia: R$ ${economiaTotal.toFixed(2)}\n\n`;
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

    // Enviar por WhatsApp
    const enviarWhatsApp = () => {
        const fornecedor = fornecedores.find(f => f.id === pedidoSalvo.fornecedor_id);
        let telefone = fornecedor?.telefone || fornecedor?.whatsapp || '';

        // Limpar telefone
        telefone = telefone.replace(/\D/g, '');
        if (telefone && !telefone.startsWith('55')) {
            telefone = '55' + telefone;
        }

        const texto = gerarTextoPedido(pedidoSalvo);
        const url = `https://wa.me/${telefone}?text=${encodeURIComponent(texto)}`;
        window.open(url, '_blank');
        toast.success('Abrindo WhatsApp...');
    };

    // Enviar por Email
    const enviarEmail = () => {
        const fornecedor = fornecedores.find(f => f.id === pedidoSalvo.fornecedor_id);
        const email = fornecedor?.email || '';
        const assunto = `Pedido de Compra - ${pedidoSalvo.numero_pedido || 'Novo'} - Móveis Pedro II`;
        const texto = gerarTextoPedido(pedidoSalvo).replace(/\*/g, ''); // Remove formatação markdown

        const url = `mailto:${email}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(texto)}`;
        window.location.href = url;
        toast.success('Abrindo cliente de email...');
    };

    // Copiar texto
    const copiarTexto = async () => {
        const texto = gerarTextoPedido(pedidoSalvo);
        try {
            await navigator.clipboard.writeText(texto);
            toast.success('Texto copiado para a área de transferência!');
        } catch (err) {
            toast.error('Erro ao copiar texto');
        }
    };

    // Fechar modal de envio e o modal principal
    const fecharTudo = () => {
        setModalEnvio(false);
        setPedidoSalvo(null);
        onClose();
    };

    return (
        <>
            <Dialog open={open && !modalEnvio} onOpenChange={onClose}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Package className="w-5 h-5" />
                            {pedido ? 'Editar Pedido de Compra' : 'Novo Pedido de Compra'}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-6">
                        {/* Dados do Fornecedor */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Fornecedor *</Label>
                                <Select
                                    value={form.fornecedor_id}
                                    onValueChange={handleFornecedorChange}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione o fornecedor" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {fornecedores.map(f => (
                                            <SelectItem key={f.id} value={f.id}>
                                                <div className="flex items-center gap-2">
                                                    <Building2 className="w-4 h-4" />
                                                    {f.nome_empresa || f.razao_social}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Condições de Pagamento</Label>
                                <Select
                                    value={form.condicoes_pagamento}
                                    onValueChange={(v) => setForm({ ...form, condicoes_pagamento: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="À Vista">À Vista</SelectItem>
                                        <SelectItem value="30 dias">30 dias</SelectItem>
                                        <SelectItem value="30/60 dias">30/60 dias</SelectItem>
                                        <SelectItem value="30/60/90 dias">30/60/90 dias</SelectItem>
                                        <SelectItem value="Outros">Outros</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Data do Pedido</Label>
                                <Input
                                    type="date"
                                    value={form.data_pedido}
                                    onChange={(e) => setForm({ ...form, data_pedido: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label>Previsão de Entrega</Label>
                                <Input
                                    type="date"
                                    value={form.data_previsao_entrega}
                                    onChange={(e) => setForm({ ...form, data_previsao_entrega: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Toggle de Compra Promocional */}
                        <div
                            className={cn(
                                "p-4 rounded-lg border-2 cursor-pointer transition-all",
                                form.compra_promocional
                                    ? "border-amber-400 bg-gradient-to-r from-amber-50 to-orange-50"
                                    : "border-dashed border-gray-300 hover:border-gray-400 bg-gray-50"
                            )}
                            onClick={() => setForm({ ...form, compra_promocional: !form.compra_promocional })}
                        >
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "w-6 h-6 rounded border-2 flex items-center justify-center transition-all",
                                    form.compra_promocional ? "bg-amber-500 border-amber-500" : "border-gray-300 bg-white"
                                )}>
                                    {form.compra_promocional && <Check className="w-4 h-4 text-white" />}
                                </div>
                                <div className="flex-1">
                                    <p className="font-semibold text-gray-900 flex items-center gap-2">
                                        <Tag className="w-4 h-4 text-amber-600" />
                                        Esta compra está com preço promocional do fornecedor
                                    </p>
                                    <p className="text-sm text-gray-500">
                                        Marque se o fornecedor ofereceu condição especial de preço nesta compra
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Seção expandida de promoção */}
                        {form.compra_promocional && (
                            <Card className="border-amber-200 bg-amber-50/50">
                                <CardContent className="p-4 space-y-4">
                                    <div className="flex items-center gap-2 text-amber-800 font-medium">
                                        <Tag className="w-4 h-4" />
                                        Detalhes da Promoção do Fornecedor
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <Label className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                Válido a partir de
                                            </Label>
                                            <Input
                                                type="date"
                                                value={form.promocao_inicio}
                                                onChange={(e) => setForm({ ...form, promocao_inicio: e.target.value })}
                                                className="mt-1"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </div>
                                        <div>
                                            <Label className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                Válido até
                                            </Label>
                                            <Input
                                                type="date"
                                                value={form.promocao_fim}
                                                onChange={(e) => setForm({ ...form, promocao_fim: e.target.value })}
                                                className="mt-1"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </div>
                                        <div>
                                            <Label>Observação</Label>
                                            <Input
                                                value={form.promocao_observacao}
                                                onChange={(e) => setForm({ ...form, promocao_observacao: e.target.value })}
                                                placeholder="Ex: Queima Janeiro"
                                                className="mt-1"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </div>
                                    </div>
                                    <Alert className="bg-amber-100 border-amber-300">
                                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                                        <AlertDescription className="text-amber-800 text-sm">
                                            Ao adicionar itens, informe o <strong>Preço Normal (Tabela)</strong> e o <strong>Preço Promocional</strong> para calcular a economia.
                                        </AlertDescription>
                                    </Alert>
                                </CardContent>
                            </Card>
                        )}

                        {/* Adicionar Produto */}
                        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                            <Label className="flex items-center gap-2 text-base font-semibold">
                                <Plus className="w-4 h-4" />
                                Adicionar Produto
                            </Label>
                            <div className={cn(
                                "grid gap-3",
                                form.compra_promocional ? "grid-cols-12" : "grid-cols-10"
                            )}>
                                <div className={cn(
                                    "relative",
                                    form.compra_promocional ? "col-span-4" : "col-span-5"
                                )}>
                                    <Label className="text-xs text-gray-500 mb-1 block">Nome do Produto</Label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                        <Input
                                            placeholder="Buscar ou digitar novo produto..."
                                            value={buscaProduto}
                                            onChange={(e) => {
                                                setBuscaProduto(e.target.value);
                                                setProdutoSelecionado(null);
                                            }}
                                            className="pl-10"
                                        />
                                    </div>
                                    {produtosFiltrados.length > 0 && !produtoSelecionado && (
                                        <div className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow-lg z-10 mt-1">
                                            {produtosFiltrados.map(p => (
                                                <button
                                                    key={p.id}
                                                    onClick={() => {
                                                        setProdutoSelecionado(p);
                                                        setBuscaProduto(p.nome);
                                                        setPrecoUnitario(p.preco_custo || 0);
                                                        setPrecoTabela(p.preco_custo_tabela || p.preco_custo || 0);
                                                    }}
                                                    className="w-full p-2 text-left hover:bg-gray-100 flex justify-between items-center"
                                                >
                                                    <span>{p.nome}</span>
                                                    <span className="text-xs text-gray-500">
                                                        Estoque: {p.quantidade_estoque || 0}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {buscaProduto.length >= 2 && produtosFiltrados.length === 0 && !produtoSelecionado && (
                                        <p className="text-xs text-blue-600 mt-1">
                                            ✨ Produto não encontrado. Será cadastrado automaticamente.
                                        </p>
                                    )}
                                </div>
                                <div className="col-span-2">
                                    <Label className="text-xs text-gray-500 mb-1 block">Quantidade</Label>
                                    <Input
                                        type="number"
                                        placeholder="Qtd"
                                        value={quantidade}
                                        onChange={(e) => setQuantidade(parseInt(e.target.value) || 0)}
                                        min={1}
                                    />
                                </div>
                                {form.compra_promocional && (
                                    <div className="col-span-2">
                                        <Label className="text-xs text-gray-500 mb-1 block">Preço Tabela (R$)</Label>
                                        <Input
                                            type="number"
                                            placeholder="0,00"
                                            value={precoTabela}
                                            onChange={(e) => setPrecoTabela(parseFloat(e.target.value) || 0)}
                                            step="0.01"
                                            className="border-gray-300"
                                        />
                                    </div>
                                )}
                                <div className="col-span-2">
                                    <Label className="text-xs text-gray-500 mb-1 block">
                                        {form.compra_promocional ? 'Preço Promo (R$)' : 'Preço Unitário (R$)'}
                                    </Label>
                                    <Input
                                        type="number"
                                        placeholder="0,00"
                                        value={precoUnitario}
                                        onChange={(e) => setPrecoUnitario(parseFloat(e.target.value) || 0)}
                                        step="0.01"
                                        className={form.compra_promocional ? "border-green-300 bg-green-50" : ""}
                                    />
                                </div>
                                <div className="col-span-2 flex items-end">
                                    <Button
                                        onClick={adicionarItem}
                                        className="w-full"
                                        disabled={!buscaProduto || buscaProduto.length < 2}
                                    >
                                        <Plus className="w-4 h-4 mr-1" /> Adicionar
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Lista de Itens */}
                        {form.itens.length > 0 ? (
                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Produto</TableHead>
                                            <TableHead className="text-center">Qtd</TableHead>
                                            {form.compra_promocional && (
                                                <TableHead className="text-right">Preço Tabela</TableHead>
                                            )}
                                            <TableHead className="text-right">
                                                {form.compra_promocional ? 'Preço Promo' : 'Preço Unit.'}
                                            </TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                            {form.compra_promocional && (
                                                <TableHead className="text-right">Economia</TableHead>
                                            )}
                                            <TableHead className="w-10"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {form.itens.map((item, index) => {
                                            const economiaItem = item.preco_tabela
                                                ? (item.preco_tabela - item.preco_unitario) * item.quantidade_pedida
                                                : 0;

                                            return (
                                                <TableRow key={index} className={item.isNew ? 'bg-blue-50' : ''}>
                                                    <TableCell className="font-medium">
                                                        <div className="flex items-center gap-2">
                                                            {item.produto_nome}
                                                            {item.isNew && (
                                                                <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700 border-blue-300">
                                                                    <Sparkles className="w-3 h-3 mr-1" />
                                                                    Novo
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center">{item.quantidade_pedida}</TableCell>
                                                    {form.compra_promocional && (
                                                        <TableCell className="text-right text-gray-500">
                                                            R$ {(item.preco_tabela || item.preco_unitario).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                        </TableCell>
                                                    )}
                                                    <TableCell className={cn(
                                                        "text-right",
                                                        form.compra_promocional && "font-bold text-green-600"
                                                    )}>
                                                        R$ {(item.preco_unitario || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </TableCell>
                                                    <TableCell className="text-right font-bold">
                                                        R$ {(item.quantidade_pedida * item.preco_unitario).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </TableCell>
                                                    {form.compra_promocional && (
                                                        <TableCell className="text-right text-green-600">
                                                            {economiaItem > 0 && (
                                                                <span>-R$ {economiaItem.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                            )}
                                                        </TableCell>
                                                    )}
                                                    <TableCell>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => removerItem(index)}
                                                            className="text-red-600 hover:text-red-700"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : (
                            <div className="border rounded-lg p-8 text-center text-gray-500">
                                <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                                <p>Nenhum item adicionado</p>
                                <p className="text-sm">Busque e adicione produtos acima</p>
                            </div>
                        )}

                        {/* Frete, Desconto e Total */}
                        <div className="grid grid-cols-4 gap-4">
                            <div>
                                <Label>Frete</Label>
                                <Input
                                    type="number"
                                    value={form.valor_frete}
                                    onChange={(e) => setForm({ ...form, valor_frete: parseFloat(e.target.value) || 0 })}
                                    step="0.01"
                                />
                            </div>
                            <div>
                                <Label>Desconto</Label>
                                <Input
                                    type="number"
                                    value={form.valor_desconto}
                                    onChange={(e) => setForm({ ...form, valor_desconto: parseFloat(e.target.value) || 0 })}
                                    step="0.01"
                                />
                            </div>
                            {form.compra_promocional && economiaTotal > 0 && (
                                <div>
                                    <Label className="text-green-700">Economia Promo</Label>
                                    <div className="h-10 flex items-center justify-end px-3 bg-green-100 rounded-md font-bold text-green-700">
                                        <TrendingDown className="w-4 h-4 mr-1" />
                                        R$ {economiaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </div>
                                </div>
                            )}
                            <div className={form.compra_promocional && economiaTotal > 0 ? "" : "col-span-2"}>
                                <Label>Total do Pedido</Label>
                                <div className="h-10 flex items-center justify-end px-3 bg-green-100 rounded-md text-xl font-bold text-green-700">
                                    R$ {calcularTotal().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                        </div>

                        {/* Observações */}
                        <div>
                            <Label>Observações</Label>
                            <Textarea
                                value={form.observacoes}
                                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                                placeholder="Observações adicionais..."
                                rows={2}
                            />
                        </div>

                        {/* Botões */}
                        <div className="flex gap-3 pt-4 border-t">
                            <Button variant="outline" onClick={onClose} className="flex-1">
                                Cancelar
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => handleSalvar('Rascunho')}
                                disabled={salvarPedido.isPending}
                                className="flex-1"
                            >
                                <Save className="w-4 h-4 mr-2" />
                                Salvar Rascunho
                            </Button>
                            <Button
                                onClick={() => handleSalvar('Enviado')}
                                disabled={salvarPedido.isPending}
                                className="flex-1 bg-blue-600 hover:bg-blue-700"
                            >
                                <Send className="w-4 h-4 mr-2" />
                                Salvar e Enviar
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Modal de Opções de Envio */}
            <Dialog open={modalEnvio} onOpenChange={() => fecharTudo()}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-green-600">
                            <CheckCircle className="w-5 h-5" />
                            Pedido Salvo com Sucesso!
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <p className="text-gray-600">
                            Como você deseja enviar este pedido para o fornecedor?
                        </p>

                        <div className="space-y-2">
                            <Button
                                variant="outline"
                                className="w-full justify-start gap-3 h-12"
                                onClick={enviarWhatsApp}
                            >
                                <MessageCircle className="w-5 h-5 text-green-600" />
                                <div className="text-left">
                                    <div className="font-medium">Enviar por WhatsApp</div>
                                    <div className="text-xs text-gray-500">Abre o WhatsApp com o pedido</div>
                                </div>
                            </Button>

                            <Button
                                variant="outline"
                                className="w-full justify-start gap-3 h-12"
                                onClick={enviarEmail}
                            >
                                <Mail className="w-5 h-5 text-blue-600" />
                                <div className="text-left">
                                    <div className="font-medium">Enviar por E-mail</div>
                                    <div className="text-xs text-gray-500">Abre seu cliente de e-mail</div>
                                </div>
                            </Button>

                            <Button
                                variant="outline"
                                className="w-full justify-start gap-3 h-12"
                                onClick={copiarTexto}
                            >
                                <Copy className="w-5 h-5 text-purple-600" />
                                <div className="text-left">
                                    <div className="font-medium">Copiar Texto</div>
                                    <div className="text-xs text-gray-500">Copia o pedido para colar onde quiser</div>
                                </div>
                            </Button>

                            <Button
                                variant="outline"
                                className="w-full justify-start gap-3 h-12"
                                onClick={() => {
                                    toast.info('Funcionalidade de PDF será implementada em breve');
                                }}
                            >
                                <FileText className="w-5 h-5 text-red-600" />
                                <div className="text-left">
                                    <div className="font-medium">Gerar PDF</div>
                                    <div className="text-xs text-gray-500">Baixar pedido em formato PDF</div>
                                </div>
                            </Button>
                        </div>

                        <div className="pt-4 border-t">
                            <Button
                                onClick={fecharTudo}
                                className="w-full"
                            >
                                <Check className="w-4 h-4 mr-2" />
                                Apenas Marcar como Enviado
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Modal para cadastrar produtos novos */}
            <ProdutoCadastroCompleto
                isOpen={produtoModalOpen}
                onClose={() => {
                    setProdutoModalOpen(false);
                    setProdutoPendente(null);
                }}
                onSave={handleProdutoCadastrado}
                produto={produtoPendente ? {
                    nome: produtoPendente.produto_nome,
                    preco_custo: produtoPendente.preco_unitario,
                    preco_custo_tabela: produtoPendente.preco_tabela || produtoPendente.preco_unitario,
                    preco_venda: '',
                    quantidade_estoque: produtoPendente.quantidade_pedida,
                    categoria: '',
                    estoque_minimo: 5
                } : null}
                isLoading={salvandoProduto}
            />
        </>
    );
}
