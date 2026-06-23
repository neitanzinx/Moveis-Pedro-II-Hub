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
    FileText,
    AlertTriangle,
    ShieldCheck
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { buildProductDisplayName } from '@/utils/productReference';
import { getEntregaFotos, getVendaFinanceiro, getVendaResumoLogistico } from '@/utils/vendaStatus';

const TONE_CLASSES = {
    purple: 'bg-purple-100 text-purple-700 border-purple-200',
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    orange: 'bg-orange-100 text-orange-700 border-orange-200',
    cyan: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    green: 'bg-green-100 text-green-700 border-green-200'
};

export function VendaDetalhesModal({ venda, isOpen, onClose, entregas = [], montagens = [], lancamentos = [] }) {
    if (!venda) return null;

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    };

    const financeiro = getVendaFinanceiro(venda, { entregas, lancamentos });
    const resumoLogistico = getVendaResumoLogistico(venda, { entregas, montagens });
    const entregaAtual = resumoLogistico.entregaPrincipal;
    const fotosEntrega = getEntregaFotos(entregaAtual);

    const totalDescontosItens = (venda.itens || []).reduce((acc, item) => acc + Number(item.desconto_item_valor || 0), 0);
    const subtotalBruto = (venda.itens || []).reduce((acc, item) => {
        const price = Number(item.preco_original || item.preco_unitario || item.valor_unitario || 0);
        return acc + (price * Number(item.quantidade || 1));
    }, 0);
    const descontoGlobal = Number(venda.desconto || venda.valor_desconto || 0);

    const getStatusBadge = (status) => {
        const statusMap = {
            'pago': { color: 'bg-emerald-500', label: 'Pago' },
            'pagamento pendente': { color: 'bg-amber-500', label: 'Pagamento Pendente' },
            'cancelado': { color: 'bg-destructive', label: 'Cancelado' },
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
                                {(venda.loja_nome || venda.loja) && (
                                    <span className="flex items-center gap-1">
                                        <Store className="h-4 w-4" />
                                        {venda.loja_nome || venda.loja}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            {getStatusBadge(financeiro.displayStatus)}
                            {venda.conferencia_caixa_status === 'aguardando' && (
                                <Badge className="bg-amber-100 text-amber-700 border-amber-200 border text-[10px] flex items-center gap-1 font-semibold uppercase tracking-wider">
                                    <ShieldCheck className="h-3 w-3" /> Aguardando Caixa
                                </Badge>
                            )}
                            {venda.conferencia_caixa_status === 'devolvido' && (
                                <Badge className="bg-orange-100 text-orange-700 border-orange-200 border text-[10px] flex items-center gap-1 font-semibold uppercase tracking-wider">
                                    <AlertTriangle className="h-3 w-3" /> Devolvido
                                </Badge>
                            )}
                            {venda.conferencia_caixa_status === 'aprovado' && (
                                <Badge className="bg-green-100 text-green-700 border-green-200 border text-[10px] flex items-center gap-1 font-semibold uppercase tracking-wider">
                                    <ShieldCheck className="h-3 w-3" /> Conferido
                                </Badge>
                            )}
                            {(venda.vendedor_nome || venda.responsavel_nome) && (
                                <span className="text-xs font-medium text-muted-foreground">
                                    Vendedor: {venda.vendedor_nome || venda.responsavel_nome}
                                </span>
                            )}
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
                                    {venda.cliente_cpf_cnpj && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                            CPF/CNPJ: {venda.cliente_cpf_cnpj}
                                        </p>
                                    )}
                                    {venda.cliente_telefone && (
                                        <p className="text-xs text-muted-foreground">{venda.cliente_telefone}</p>
                                    )}
                                </div>
                                <div className="flex flex-col gap-1">
                                    {(entregaAtual?.endereco_entrega || venda.endereco_entrega) && (
                                        <div className="flex items-start gap-2 text-xs">
                                            <MapPin className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                                            <span>{entregaAtual?.endereco_entrega || venda.endereco_entrega}</span>
                                        </div>
                                    )}
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
                                            <TableHead>Entrega</TableHead>
                                            <TableHead>Montagem</TableHead>
                                            <TableHead className="text-center">Qtd</TableHead>
                                            <TableHead className="text-right">Unitário</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {resumoLogistico.itensDetalhados.map((item, idx) => {
                                            const temDescontoItem = (item.desconto_item_percent || 0) > 0 || (item.desconto_item_valor || 0) > 0;
                                            const unitPrice = Number(item.valor_unitario || item.preco_unitario || 0);
                                            const originalPrice = item.preco_original || (unitPrice + Number(item.desconto_item_valor || 0) / Number(item.quantidade || 1));
                                            const subtotalOriginal = originalPrice * Number(item.quantidade || 1);
                                            const subtotalComDesconto = Number(item.quantidade || 0) * unitPrice;
                                            
                                            return (
                                                <TableRow key={idx}>
                                                    <TableCell className="font-medium text-sm">
                                                        {buildProductDisplayName(item.produto_nome, item.modelo_referencia)}
                                                        {item.variacao_nome && (
                                                            <span className="text-xs text-muted-foreground block font-normal">
                                                                {item.variacao_nome}
                                                            </span>
                                                        )}
                                                        {temDescontoItem && (
                                                            <span className="text-xs text-emerald-600 font-semibold block mt-0.5">
                                                                ✂ {item.desconto_item_percent ? `Desconto ${item.desconto_item_percent}%` : 'Desconto'}: -{formatCurrency(item.desconto_item_valor)}
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">{item.entregaLabel || '-'}</TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">{item.montagemLabel || '-'}</TableCell>
                                                    <TableCell className="text-center">{item.quantidade}</TableCell>
                                                    <TableCell className="text-right text-xs">
                                                        {temDescontoItem && originalPrice > unitPrice && (
                                                            <span className="text-[10px] text-muted-foreground line-through block">
                                                                {formatCurrency(originalPrice)}
                                                            </span>
                                                        )}
                                                        <span className="font-medium">{formatCurrency(unitPrice)}</span>
                                                    </TableCell>
                                                    <TableCell className="text-right font-semibold">
                                                        {temDescontoItem && subtotalOriginal > subtotalComDesconto && (
                                                            <span className="text-xs text-muted-foreground line-through block font-normal">
                                                                {formatCurrency(subtotalOriginal)}
                                                            </span>
                                                        )}
                                                        <span className={temDescontoItem ? "text-emerald-700" : ""}>
                                                            {formatCurrency(item.subtotal || subtotalComDesconto)}
                                                        </span>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
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
                                     {/* Subtotal bruto se houver qualquer desconto */}
                                     {(totalDescontosItens > 0 || descontoGlobal > 0) ? (
                                         <div className="flex justify-between text-sm">
                                             <span className="text-muted-foreground">Subtotal bruto</span>
                                             <span>{formatCurrency(subtotalBruto)}</span>
                                         </div>
                                     ) : (
                                         <div className="flex justify-between text-sm">
                                             <span className="text-muted-foreground">Subtotal</span>
                                             <span>{formatCurrency(venda.valor_subtotal || subtotalBruto)}</span>
                                         </div>
                                     )}
                                     
                                     {totalDescontosItens > 0 && (
                                         <div className="flex justify-between text-sm text-emerald-600 font-medium">
                                             <span>Descontos em produtos</span>
                                             <span>-{formatCurrency(totalDescontosItens)}</span>
                                         </div>
                                     )}
                                     
                                     {descontoGlobal > 0 && (
                                         <div className="flex justify-between text-sm text-emerald-600 font-medium">
                                             <span>Desconto negociável</span>
                                             <span>-{formatCurrency(descontoGlobal)}</span>
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
                                    <div className="flex justify-between text-sm pt-2 border-t mt-2">
                                        <span className="text-muted-foreground">Status</span>
                                        <span className={financeiro.isPaid ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>
                                            {financeiro.displayStatus}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Total pago</span>
                                        <span>{formatCurrency(financeiro.valorPago)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Saldo restante</span>
                                        <span className={financeiro.valorRestante > 0 ? 'text-amber-700 font-semibold' : 'text-emerald-700 font-semibold'}>
                                            {financeiro.valorRestante > 0 ? formatCurrency(financeiro.valorRestante) : '-'}
                                        </span>
                                    </div>

                                    {/* Pagamentos */}
                                    {Array.isArray(venda.pagamentos) && venda.pagamentos.length > 0 && (
                                        <div className="mt-4 pt-4 border-t space-y-2">
                                            <p className="text-xs font-semibold text-muted-foreground uppercase text-center mb-2">Formas de Pagamento</p>
                                            {venda.pagamentos.map((pag, idx) => (
                                                <div key={idx} className="flex justify-between items-center bg-background p-2 rounded-lg border text-sm">
                                                    <span className="font-medium">{pag.forma_pagamento || pag.forma || '-'}</span>
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
                                    <div className="space-y-3 bg-muted/10 p-4 rounded-xl border">
                                        <div className="flex flex-wrap gap-2">
                                            {resumoLogistico.composicao.length > 0 ? resumoLogistico.composicao.map((grupo) => (
                                                <Badge key={grupo.key} variant="outline" className={TONE_CLASSES[grupo.tone] || TONE_CLASSES.blue}>
                                                    {grupo.count} {grupo.label}
                                                </Badge>
                                            )) : (
                                                <span className="text-xs text-muted-foreground italic">Sem composição logística informada</span>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                                            <div className="rounded-lg border bg-background p-3">
                                                <p className="text-[10px] font-bold uppercase text-muted-foreground">Composição</p>
                                                <div className="mt-2 flex items-center gap-2 font-medium">
                                                    <Truck className="h-4 w-4 text-blue-500" />
                                                    {resumoLogistico.headline}
                                                </div>
                                                {resumoLogistico.isMisto && (
                                                    <p className="mt-2 text-xs text-muted-foreground">
                                                        Este pedido combina itens para entrega e retirada no mesmo número.
                                                    </p>
                                                )}
                                            </div>
                                            <div className="rounded-lg border bg-background p-3">
                                                <p className="text-[10px] font-bold uppercase text-muted-foreground">Status operacional</p>
                                                {entregaAtual ? (
                                                    <div className="mt-2 space-y-1 text-sm">
                                                        <div className="font-medium">{entregaAtual.status || '-'}</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {entregaAtual.data_realizada
                                                                ? `Concluído em ${format(new Date(entregaAtual.data_realizada), "dd/MM/yyyy HH:mm", { locale: ptBR })}`
                                                                : entregaAtual.data_agendada
                                                                    ? `Agendado para ${format(new Date(entregaAtual.data_agendada), "dd/MM/yyyy", { locale: ptBR })}`
                                                                    : 'Sem data operacional'}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {entregaAtual.endereco_entrega || 'Retirada na loja'}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="mt-2 block text-xs text-muted-foreground italic">Sem entrega vinculada</span>
                                                )}
                                                {(resumoLogistico.contagens.montagemInterna > 0 || resumoLogistico.contagens.montagemExterna > 0) && (
                                                    <div className="mt-3 flex items-center gap-2 text-xs">
                                                        <Wrench className="h-3.5 w-3.5 text-orange-500" />
                                                        <span>{resumoLogistico.montagensConcluidas ? 'Montagens concluídas' : 'Montagens pendentes'}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {resumoLogistico.gruposDetalhados.length > 0 && (
                                            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                                                {resumoLogistico.gruposDetalhados.map((grupo) => (
                                                    <div key={grupo.key} className="rounded-lg border bg-background p-3">
                                                        <p className={`text-xs font-bold uppercase ${TONE_CLASSES[grupo.tone] || TONE_CLASSES.blue}`}>
                                                            {grupo.label}
                                                        </p>
                                                        <div className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                                                            {grupo.items.map((item, index) => (
                                                                <p key={`${grupo.key}-${index}`}>{item.resumoItem}</p>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </section>

                                {fotosEntrega.length > 0 && (
                                    <section>
                                        <h3 className="text-lg font-semibold flex items-center gap-2 mb-4 text-primary">
                                            <Package className="h-5 w-5" />
                                            Fotos da Entrega
                                        </h3>
                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                            {fotosEntrega.map((foto, index) => (
                                                <div key={`${foto.url}-${index}`} className="overflow-hidden rounded-xl border bg-muted/20 p-2">
                                                    <img
                                                        src={foto.url}
                                                        alt={foto.tipo || `Foto da entrega ${index + 1}`}
                                                        className="h-48 w-full rounded-lg object-cover"
                                                    />
                                                    <p className="mt-2 text-xs font-medium text-muted-foreground">
                                                        {foto.tipo || `Foto ${index + 1}`}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                )}

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

                                {venda.conferencia_caixa_status === 'devolvido' && venda.conferencia_caixa_observacao && (
                                    <section>
                                        <h3 className="text-lg font-semibold flex items-center gap-2 mb-4 text-orange-700">
                                            <AlertTriangle className="h-5 w-5" />
                                            Devolvido pelo Caixa
                                        </h3>
                                        <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 text-sm text-orange-950">
                                            <p className="font-semibold text-xs text-orange-800 uppercase tracking-wider mb-1">Motivo da Devolução</p>
                                            <p className="italic">"{venda.conferencia_caixa_observacao}"</p>
                                            {venda.conferencia_caixa_por && (
                                                <p className="text-[10px] text-orange-500 mt-2 font-medium">
                                                    Por: {venda.conferencia_caixa_por} {venda.conferencia_caixa_at ? `em ${format(new Date(venda.conferencia_caixa_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}` : ''}
                                                </p>
                                            )}
                                        </div>
                                    </section>
                                )}

                                {venda.conferencia_caixa_status === 'aprovado' && (
                                    <section>
                                        <h3 className="text-lg font-semibold flex items-center gap-2 mb-4 text-green-700">
                                            <ShieldCheck className="h-5 w-5" />
                                            Conferência de Caixa Realizada
                                        </h3>
                                        <div className="bg-green-50 p-4 rounded-xl border border-green-100 text-sm text-green-950">
                                            <p className="font-semibold text-xs text-green-800 uppercase tracking-wider mb-1">Status</p>
                                            <p>O pagamento deste pedido foi conferido e aprovado pelo caixa.</p>
                                            {venda.conferencia_caixa_observacao && (
                                                <p className="mt-2 text-xs italic text-green-800">
                                                    Observação: "{venda.conferencia_caixa_observacao}"
                                                </p>
                                            )}
                                            {venda.conferencia_caixa_por && (
                                                <p className="text-[10px] text-green-600 mt-2 font-medium">
                                                    Por: {venda.conferencia_caixa_por} {venda.conferencia_caixa_at ? `em ${format(new Date(venda.conferencia_caixa_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}` : ''}
                                                </p>
                                            )}
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
