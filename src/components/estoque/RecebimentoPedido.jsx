import React, { useState } from "react";
import { base44, supabase } from "@/lib/supabase";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    PackageCheck,
    Check,
    AlertCircle,
    Package
} from "lucide-react";
import { toast } from "sonner";

export default function RecebimentoPedido({ open, onClose, pedido }) {
    const queryClient = useQueryClient();

    // Estado para quantidades recebidas
    const [quantidadesRecebidas, setQuantidadesRecebidas] = useState(() => {
        const inicial = {};
        (pedido?.itens || []).forEach((item, index) => {
            inicial[index] = item.quantidade_recebida || 0;
        });
        return inicial;
    });

    const [observacaoRecebimento, setObservacaoRecebimento] = useState("");

    // Mutation para atualizar pedido e estoque
    const receberPedido = useMutation({
        mutationFn: async () => {
            // Preparar itens atualizados
            const itensAtualizados = (pedido.itens || []).map((item, index) => ({
                ...item,
                quantidade_recebida: (item.quantidade_recebida || 0) + (quantidadesRecebidas[index] || 0),
                status: verificarStatusItem(item, quantidadesRecebidas[index])
            }));

            // Verificar status geral do pedido
            const todoRecebido = itensAtualizados.every(
                item => item.quantidade_recebida >= item.quantidade_pedida
            );
            const algumRecebido = itensAtualizados.some(
                item => item.quantidade_recebida > 0
            );

            let novoStatus = pedido.status;
            if (todoRecebido) {
                novoStatus = 'Recebido';
            } else if (algumRecebido) {
                novoStatus = 'Parcialmente Recebido';
            }

            // Atualizar pedido
            await base44.entities.PedidoCompra.update(pedido.id, {
                itens: itensAtualizados,
                status: novoStatus,
                data_entrega_real: todoRecebido ? new Date().toISOString().split('T')[0] : null,
                observacoes: pedido.observacoes
                    ? `${pedido.observacoes}\n\n[${new Date().toLocaleString('pt-BR')}] ${observacaoRecebimento}`
                    : `[${new Date().toLocaleString('pt-BR')}] ${observacaoRecebimento}`
            });

            // Atualizar estoque de cada produto recebido
            for (const [index, qtdRecebida] of Object.entries(quantidadesRecebidas)) {
                if (qtdRecebida > 0) {
                    const item = pedido.itens[index];
                    if (item.produto_id) {
                        try {
                            // Buscar produto atual usando o método get por ID
                            const produtos = await base44.entities.Produto.list();
                            const produto = produtos.find(p => String(p.id) === String(item.produto_id));
                            if (produto) {
                                const estoqueAtual = produto.quantidade_estoque || 0;
                                const estoqueCdAtual = produto.estoque_cd || 0;
                                await base44.entities.Produto.update(item.produto_id, {
                                    quantidade_estoque: estoqueAtual + qtdRecebida,
                                    estoque_cd: estoqueCdAtual + qtdRecebida
                                });

                                // --- SINCRONIZAÇÃO COM ESTOQUE POR UNIDADE (estoque_loja) ---
                                // Ao receber pedido de compra, garantimos que a unidade CD (padrão) receba o saldo.
                                try {
                                    if (produto.codigo_barras) {
                                        await supabase.from('estoque_loja').insert({
                                            gtin: produto.codigo_barras,
                                            tenant_id: 'CD',
                                            quantidade: qtdRecebida
                                        });
                                    }
                                } catch (syncErr) {
                                    console.warn('Erro ao sincronizar estoque por unidade:', syncErr);
                                }
                            }
                        } catch (e) {
                            console.error('Erro ao atualizar estoque:', e);
                        }
                    }
                }
            }

            // Criar lançamento financeiro (despesa)
            const totalRecebido = Object.entries(quantidadesRecebidas).reduce((sum, [index, qtd]) => {
                return sum + (qtd * (pedido.itens[index]?.preco_unitario || 0));
            }, 0);

            if (totalRecebido > 0) {
                await base44.entities.LancamentoFinanceiro.create({
                    descricao: `Compra de Mercadoria - Pedido ${pedido.numero_pedido} - ${pedido.fornecedor_nome}`,
                    valor: totalRecebido,
                    tipo: 'despesa',
                    categoria_nome: 'Compra de Mercadoria',
                    data_lancamento: new Date().toISOString().split('T')[0],
                    data_vencimento: new Date().toISOString().split('T')[0],
                    status: 'Pendente',
                    pago: false,
                    observacao: `Recebimento do pedido ${pedido.numero_pedido}. Fornecedor: ${pedido.fornecedor_nome}`
                });
            }

            return { todoRecebido };
        },
        onSuccess: ({ todoRecebido }) => {
            queryClient.invalidateQueries({ queryKey: ['pedidos-compra'] });
            queryClient.invalidateQueries({ queryKey: ['produtos'] });
            queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
            toast.success(todoRecebido
                ? 'Pedido recebido completamente! Estoque atualizado.'
                : 'Recebimento parcial registrado!'
            );
            onClose();
        },
        onError: (error) => {
            toast.error('Erro ao registrar recebimento: ' + error.message);
        }
    });

    const verificarStatusItem = (item, qtdRecebidaAgora) => {
        const totalRecebido = (item.quantidade_recebida || 0) + (qtdRecebidaAgora || 0);
        if (totalRecebido >= item.quantidade_pedida) return 'Completo';
        if (totalRecebido > 0) return 'Parcial';
        return 'Pendente';
    };

    const handleQuantidadeChange = (index, valor) => {
        const item = pedido.itens[index];
        const jaRecebido = item.quantidade_recebida || 0;
        const pendente = item.quantidade_pedida - jaRecebido;
        const novaQtd = Math.min(Math.max(0, parseInt(valor) || 0), pendente);

        setQuantidadesRecebidas({
            ...quantidadesRecebidas,
            [index]: novaQtd
        });
    };

    const receberTudo = () => {
        const novasQuantidades = {};
        (pedido?.itens || []).forEach((item, index) => {
            const jaRecebido = item.quantidade_recebida || 0;
            novasQuantidades[index] = item.quantidade_pedida - jaRecebido;
        });
        setQuantidadesRecebidas(novasQuantidades);
    };

    const totalAReceber = Object.entries(quantidadesRecebidas).reduce((sum, [index, qtd]) => {
        return sum + (qtd * (pedido?.itens[index]?.preco_unitario || 0));
    }, 0);

    const algumItemParaReceber = Object.values(quantidadesRecebidas).some(q => q > 0);

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <PackageCheck className="w-5 h-5 text-green-600" />
                        Receber Pedido {pedido?.numero_pedido}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Info do Fornecedor */}
                    <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Fornecedor</p>
                                <p className="font-medium">{pedido?.fornecedor_nome}</p>
                            </div>
                            <Badge>{pedido?.status}</Badge>
                        </div>
                    </div>

                    {/* Botão receber tudo */}
                    <div className="flex justify-end">
                        <Button variant="outline" onClick={receberTudo} size="sm">
                            <Check className="w-4 h-4 mr-2" />
                            Receber Tudo
                        </Button>
                    </div>

                    {/* Tabela de itens */}
                    <div className="border rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Produto</TableHead>
                                    <TableHead className="text-center">Pedido</TableHead>
                                    <TableHead className="text-center">Já Recebido</TableHead>
                                    <TableHead className="text-center">Receber Agora</TableHead>
                                    <TableHead className="text-right">Valor</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {(pedido?.itens || []).map((item, index) => {
                                    const jaRecebido = item.quantidade_recebida || 0;
                                    const pendente = item.quantidade_pedida - jaRecebido;
                                    const recebendoAgora = quantidadesRecebidas[index] || 0;
                                    const completo = jaRecebido + recebendoAgora >= item.quantidade_pedida;

                                    return (
                                        <TableRow key={index} className={completo ? 'bg-green-50' : ''}>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <Package className="w-4 h-4 text-gray-400" />
                                                        <span className="font-medium">{item.produto_nome}</span>
                                                    </div>
                                                    {item.detalhes && (
                                                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-gray-500 ml-6">
                                                            {item.detalhes.modelo && (
                                                                <span title="Modelo/Referência">Ref: {item.detalhes.modelo}</span>
                                                            )}
                                                            {item.detalhes.cor && (
                                                                <span title="Cor">Cor: {item.detalhes.cor}</span>
                                                            )}
                                                            {item.detalhes.dimensoes && item.detalhes.dimensoes !== 'x x' && item.detalhes.dimensoes !== 'xx' && (
                                                                <span title="Dimensões">Dim: {item.detalhes.dimensoes}</span>
                                                            )}
                                                        </div>
                                                    )}
                                                    {item.produto_codigo && (
                                                        <p className="text-xs text-gray-500 ml-6">
                                                            Cód: {item.produto_codigo}
                                                        </p>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center font-bold">
                                                {item.quantidade_pedida}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {jaRecebido > 0 ? (
                                                    <Badge variant="outline" className="bg-blue-50">
                                                        {jaRecebido}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-gray-400">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {pendente > 0 ? (
                                                    <Input
                                                        type="number"
                                                        value={recebendoAgora}
                                                        onChange={(e) => handleQuantidadeChange(index, e.target.value)}
                                                        min={0}
                                                        max={pendente}
                                                        className="w-20 text-center mx-auto"
                                                    />
                                                ) : (
                                                    <Badge className="bg-green-100 text-green-800">
                                                        <Check className="w-3 h-3 mr-1" />
                                                        Completo
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                R$ {(recebendoAgora * item.preco_unitario).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Observação */}
                    <div>
                        <Label>Observação do Recebimento</Label>
                        <Textarea
                            value={observacaoRecebimento}
                            onChange={(e) => setObservacaoRecebimento(e.target.value)}
                            placeholder="Ex: Recebido por João às 14h. Sem avarias."
                            rows={2}
                        />
                    </div>

                    {/* Total e botões */}
                    <div className="flex items-center justify-between pt-4 border-t">
                        <div>
                            <p className="text-sm text-gray-500">Total a dar entrada:</p>
                            <p className="text-2xl font-bold text-green-600">
                                R$ {totalAReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <Button variant="outline" onClick={onClose}>
                                Cancelar
                            </Button>
                            <Button
                                onClick={() => receberPedido.mutate()}
                                disabled={!algumItemParaReceber || receberPedido.isPending}
                                className="bg-green-600 hover:bg-green-700"
                            >
                                {receberPedido.isPending ? (
                                    'Processando...'
                                ) : (
                                    <>
                                        <PackageCheck className="w-4 h-4 mr-2" />
                                        Confirmar Recebimento
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Aviso */}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="text-sm text-amber-700">
                            <p className="font-medium">Atenção</p>
                            <p>Ao confirmar, o estoque dos produtos será atualizado automaticamente e um lançamento financeiro (despesa) será criado.</p>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
