import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Package,
    User,
    Calendar,
    MapPin,
    CreditCard,
    MessageSquare,
    Truck,
    Wrench,
    Store,
    FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function VendaDetalhesModal({ venda, isOpen, onClose }) {
    if (!venda) return null;

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    };

    const getStatusBadge = (status) => {
        const statusMap = {
            'pago': { color: 'bg-emerald-500', label: 'Pago' },
            'pendente': { color: 'bg-amber-500', label: 'Pendente' },
            'cancelada': { color: 'bg-destructive', label: 'Cancelada' },
            'concluida': { color: 'bg-blue-500', label: 'Concluída' },
        };
        const config = statusMap[status?.toLowerCase()] || { color: 'bg-slate-500', label: status || 'Desconhecido' };
        return <Badge className={`${config.color} text-white`}>{config.label}</Badge>;
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-6 overflow-hidden">
                <DialogHeader className="border-b pb-4 mb-4">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                                <FileText className="h-6 w-6 text-primary" />
                                Venda #{venda.numero_pedido || venda.id.slice(0, 8)}
                            </DialogTitle>
                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                    <Calendar className="h-4 w-4" />
                                    {format(new Date(venda.data_venda || venda.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Store className="h-4 w-4" />
                                    {venda.loja_nome || 'Loja não informada'}
                                </span>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            {getStatusBadge(venda.status)}
                            <span className="text-xs font-medium text-muted-foreground">
                                Vendedor: {venda.vendedor_nome || 'Não informado'}
                            </span>
                        </div>
                    </div>
                </DialogHeader>

                <ScrollArea className="flex-1 pr-4">
                    <div className="space-y-8">
                        {/* Informações do Cliente */}
                        <section>
                            <h3 className="text-lg font-semibold flex items-center gap-2 mb-4 text-primary">
                                <User className="h-5 w-5" />
                                Informações do Cliente
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/30 p-4 rounded-xl border">
                                <div>
                                    <p className="text-sm font-semibold">{venda.cliente_nome}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {venda.cliente_cpf_cnpj ? `CPF/CNPJ: ${venda.cliente_cpf_cnpj}` : 'Documento não informado'}
                                    </p>
                                    <p className="text-xs text-muted-foreground">{venda.cliente_telefone || 'Telefone não informado'}</p>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-start gap-2 text-xs">
                                        <MapPin className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                                        <span>{venda.endereco_entrega || 'Endereço não informado'}</span>
                                    </div>
                                    {venda.ponto_referencia && (
                                        <p className="text-[10px] text-amber-600 font-medium ml-5">
                                            Ref: {venda.ponto_referencia}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </section>

                        {/* Itens do Pedido */}
                        <section>
                            <h3 className="text-lg font-semibold flex items-center gap-2 mb-4 text-primary">
                                <Package className="h-5 w-5" />
                                Itens do Pedido
                            </h3>
                            <div className="border rounded-xl overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-muted/50">
                                        <TableRow>
                                            <TableHead>Produto</TableHead>
                                            <TableHead className="text-center">Qtd</TableHead>
                                            <TableHead className="text-right">Unitário</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {Array.isArray(venda.itens) && venda.itens.map((item, idx) => (
                                            <TableRow key={idx}>
                                                <TableCell className="font-medium text-sm">
                                                    {item.produto_nome}
                                                    {item.variacao_nome && (
                                                        <span className="text-xs text-muted-foreground block font-normal">
                                                            {item.variacao_nome}
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center">{item.quantidade}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(item.valor_unitario)}</TableCell>
                                                <TableCell className="text-right font-semibold">
                                                    {formatCurrency(item.quantidade * item.valor_unitario)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </section>

                        {/* Resumo Financeiro e Logística */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Financeiro */}
                            <section>
                                <h3 className="text-lg font-semibold flex items-center gap-2 mb-4 text-primary">
                                    <CreditCard className="h-5 w-5" />
                                    Financeiro
                                </h3>
                                <div className="space-y-3 bg-muted/20 p-4 rounded-xl border">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Subtotal</span>
                                        <span>{formatCurrency(venda.valor_subtotal || venda.valor_total)}</span>
                                    </div>
                                    {venda.valor_desconto > 0 && (
                                        <div className="flex justify-between text-sm text-emerald-600">
                                            <span>Desconto</span>
                                            <span>-{formatCurrency(venda.valor_desconto)}</span>
                                        </div>
                                    )}
                                    {venda.valor_frete > 0 && (
                                        <div className="flex justify-between text-sm">
                                            <span>Frete</span>
                                            <span>{formatCurrency(venda.valor_frete)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between pt-2 border-t font-bold text-lg text-primary">
                                        <span>Total</span>
                                        <span>{formatCurrency(venda.valor_total)}</span>
                                    </div>

                                    {/* Pagamentos */}
                                    {Array.isArray(venda.pagamentos) && venda.pagamentos.length > 0 && (
                                        <div className="mt-4 pt-4 border-t space-y-2">
                                            <p className="text-xs font-semibold text-muted-foreground uppercase text-center mb-2">Formas de Pagamento</p>
                                            {venda.pagamentos.map((pag, idx) => (
                                                <div key={idx} className="flex justify-between items-center bg-background p-2 rounded-lg border text-sm">
                                                    <span className="font-medium">{pag.forma_pagamento}</span>
                                                    <span className="font-semibold text-primary">{formatCurrency(pag.valor)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* Logística e Observações */}
                            <div className="space-y-6">
                                <section>
                                    <h3 className="text-lg font-semibold flex items-center gap-2 mb-4 text-primary">
                                        <Truck className="h-5 w-5" />
                                        Logística
                                    </h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-muted/10 p-3 rounded-lg border flex flex-col gap-1">
                                            <span className="text-[10px] text-muted-foreground uppercase font-bold">Entrega</span>
                                            <div className="flex items-center gap-2 text-sm font-medium">
                                                <Truck className="h-4 w-4 text-blue-500" />
                                                {venda.tipo_entrega || 'A combinar'}
                                            </div>
                                            {venda.data_entrega && (
                                                <span className="text-xs text-muted-foreground">
                                                    {format(new Date(venda.data_entrega), "dd/MM/yyyy", { locale: ptBR })}
                                                </span>
                                            )}
                                        </div>
                                        <div className="bg-muted/10 p-3 rounded-lg border flex flex-col gap-1">
                                            <span className="text-[10px] text-muted-foreground uppercase font-bold">Montagem</span>
                                            <div className="flex items-center gap-2 text-sm font-medium">
                                                <Wrench className="h-4 w-4 text-orange-500" />
                                                {venda.tipo_montagem || 'Sem montagem'}
                                            </div>
                                            {venda.data_montagem && (
                                                <span className="text-xs text-muted-foreground">
                                                    {format(new Date(venda.data_montagem), "dd/MM/yyyy", { locale: ptBR })}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </section>

                                {venda.observacoes && (
                                    <section>
                                        <h3 className="text-lg font-semibold flex items-center gap-2 mb-4 text-primary">
                                            <MessageSquare className="h-5 w-5" />
                                            Observações
                                        </h3>
                                        <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100 text-sm text-amber-900 italic">
                                            {venda.observacoes}
                                        </div>
                                    </section>
                                )}
                            </div>
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
