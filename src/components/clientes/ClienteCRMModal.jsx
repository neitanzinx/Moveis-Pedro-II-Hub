import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    ShoppingBag,
    User,
    Star,
    Calendar,
    TrendingUp,
    Package,
    Clock,
    Phone,
    Mail,
    FileText,
    Cake,
    MapPin,
    Truck,
    Ban
} from 'lucide-react';
import { base44 } from '@/lib/supabase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatarCPFCNPJ, formatarTelefone } from '@/utils/formatters';

export function ClienteCRMModal({ cliente, isOpen, onClose }) {
    // Busca o histórico de vendas do cliente
    const { data: vendas, isLoading } = useQuery({
        queryKey: ['vendas-crm', cliente?.id],
        queryFn: async () => {
            if (!cliente?.id) return [];
            const { data, error } = await base44.entities.Venda.filter({ cliente_id: cliente.id });
            if (error) throw error;
            return data || [];
        },
        enabled: !!cliente?.id && isOpen,
    });

    // Busca todos os produtos para ter acesso às categorias (fallback para vendas antigas)
    const { data: produtos } = useQuery({
        queryKey: ['produtos-crm'],
        queryFn: async () => {
            const { data, error } = await base44.entities.Produto.list();
            if (error) throw error;
            return data || [];
        },
        enabled: isOpen,
    });

    // Calcula categorias de interesse
    const interesses = useMemo(() => {
        if (!vendas) return [];
        const catCounts = {};

        // Cria um mapa de produto_id -> categoria
        const produtoMap = (produtos || []).reduce((acc, p) => {
            acc[p.id] = p.categoria || "Geral";
            return acc;
        }, {});

        vendas.forEach(venda => {
            const itens = Array.isArray(venda.itens) ? venda.itens : [];
            itens.forEach(item => {
                // Tenta pegar do item (novas vendas) ou do mapa de produtos (vendas antigas)
                const categoria = item.produto_categoria || produtoMap[item.produto_id] || "Outros";
                catCounts[categoria] = (catCounts[categoria] || 0) + (item.quantidade || 1);
            });
        });

        return Object.entries(catCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([nome, qtde]) => ({ nome, qtde }));
    }, [vendas, produtos]);

    // Função para pegar a badge de tier (coroas)
    const getTierBadge = (coroas = 0) => {
        if (coroas >= 1000) return { label: 'Elite', color: 'bg-amber-500 text-white' };
        if (coroas >= 500) return { label: 'Master', color: 'bg-slate-400 text-white' };
        if (coroas >= 100) return { label: 'Prime', color: 'bg-emerald-500 text-white' };
        return { label: 'Cliente', color: 'bg-blue-500 text-white' };
    };

    const tier = getTierBadge(cliente?.coroas);

    if (!cliente) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-6">
                <DialogHeader className="mb-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-primary/10 rounded-full">
                                <User className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-bold">{cliente.nome_completo}</DialogTitle>
                                <DialogDescription className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline" className={tier.color}>{tier.label}</Badge>
                                    <span className="text-sm font-medium flex items-center gap-1">
                                        <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                                        {cliente.coroas || 0} coroas
                                    </span>
                                </DialogDescription>
                            </div>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col gap-6">
                    {/* Perfil Compacto no Topo */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted/20 rounded-xl border">
                        <div className="space-y-1">
                            <h4 className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                                <User className="h-3 w-3" /> Identificação
                            </h4>
                            <p className="text-xs font-medium">
                                {cliente.cnpj ? 'CNPJ' : 'CPF'}: {formatarCPFCNPJ(cliente.cpf || cliente.cnpj) || '---'}
                            </p>
                            {cliente.razao_social && <p className="text-[10px] truncate text-muted-foreground">{cliente.razao_social}</p>}
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Cake className="h-2.5 w-2.5" /> {cliente.data_nascimento ? format(new Date(cliente.data_nascimento.includes('T') ? cliente.data_nascimento : `${cliente.data_nascimento}T12:00:00`), "dd/MM/yyyy") : '---'}
                            </p>
                        </div>

                        <div className="space-y-1">
                            <h4 className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                                <Phone className="h-3 w-3" /> Contato
                            </h4>
                            <p className="text-xs font-medium text-primary">{formatarTelefone(cliente.telefone) || '---'}</p>
                            <p className="text-[10px] truncate text-muted-foreground">{cliente.email || '---'}</p>
                        </div>

                        <div className="space-y-1 md:col-span-2">
                            <h4 className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> Endereços
                            </h4>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="text-[10px] leading-tight">
                                    <span className="font-semibold block">Principal:</span>
                                    <span className="text-muted-foreground">{cliente.endereco}, {cliente.numero} - {cliente.bairro}</span>
                                </div>
                                <div className="text-[10px] leading-tight">
                                    <span className="font-semibold block">Entrega:</span>
                                    <span className="text-muted-foreground italic">
                                        {cliente.usar_mesmo_endereco !== false ? 'Mesmo do principal' : `${cliente.endereco_entrega_rua}, ${cliente.endereco_entrega_numero}`}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <ScrollArea className="flex-1">
                        <div className="space-y-6 pb-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Coluna da Esquerda: Categorias e Resumo */}
                                <div className="space-y-6">
                                    <div className="bg-muted/30 p-4 rounded-xl border">
                                        <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                                            <TrendingUp className="h-4 w-4 text-primary" />
                                            Categorias de Interesse
                                        </h3>
                                        <div className="space-y-2">
                                            {interesses.length > 0 ? (
                                                interesses.map((int, i) => (
                                                    <div key={i} className="flex justify-between items-center text-sm p-2 bg-background rounded-lg border">
                                                        <span className="truncate flex-1 font-medium">{int.nome}</span>
                                                        <Badge variant="secondary" className="ml-2">x{int.qtde}</Badge>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-xs text-muted-foreground text-center py-4">
                                                    Nenhum histórico disponível para calcular interesses.
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-primary/5 p-4 rounded-xl border border-primary/20">
                                        <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                                            <ShoppingBag className="h-4 w-4 text-primary" />
                                            Resumo da Carteira
                                        </h3>
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-muted-foreground">Total de Compras</span>
                                                <span className="text-sm font-bold">{vendas?.length || 0}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-muted-foreground">Última Compra</span>
                                                <span className="text-sm font-medium">
                                                    {vendas?.[0]?.data_venda ? format(new Date(vendas[0].data_venda), "dd/MM/yyyy") : '---'}
                                                </span>
                                            </div>
                                            <div className="space-y-2 pt-2 border-t">
                                                <h4 className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                                                    <FileText className="h-3 w-3" /> Observações
                                                </h4>
                                                <p className="text-[10px] text-muted-foreground italic leading-relaxed">
                                                    {cliente.observacoes || 'Sem observações.'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Coluna da Direita: Histórico de Vendas */}
                                <div className="md:col-span-2 flex flex-col border rounded-xl overflow-hidden bg-background">
                                    <div className="p-4 border-b bg-muted/20 flex items-center justify-between">
                                        <h3 className="text-sm font-semibold flex items-center gap-2">
                                            <Clock className="h-4 w-4 text-primary" />
                                            Histórico de Compras Detalhado
                                        </h3>
                                    </div>

                                    <div className="p-0">
                                        <Table>
                                            <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                                <TableRow>
                                                    <TableHead className="w-[120px]">Data</TableHead>
                                                    <TableHead>Itens / Produtos</TableHead>
                                                    <TableHead className="text-right">Valor Total</TableHead>
                                                    <TableHead className="text-center w-[100px]">Status</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {isLoading ? (
                                                    <TableRow>
                                                        <TableCell colSpan={4} className="h-24 text-center">Carregando histórico...</TableCell>
                                                    </TableRow>
                                                ) : vendas?.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                                            Nenhum registro de venda encontrado.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    vendas.map((venda) => (
                                                        <TableRow key={venda.id} className="hover:bg-muted/30 transition-colors">
                                                            <TableCell className="text-xs font-medium">
                                                                {format(new Date(venda.data_venda), "dd MMM yyyy", { locale: ptBR })}
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex flex-col gap-1">
                                                                    {Array.isArray(venda.itens) && venda.itens.slice(0, 2).map((item, idx) => (
                                                                        <div key={idx} className="text-xs flex items-center gap-1">
                                                                            <Package className="h-3 w-3 text-muted-foreground shrink-0" />
                                                                            <span className="truncate">{item.produto_nome}</span>
                                                                        </div>
                                                                    ))}
                                                                    {Array.isArray(venda.itens) && venda.itens.length > 2 && (
                                                                        <span className="text-[10px] text-muted-foreground font-medium italic">
                                                                            + {venda.itens.length - 2} outros itens
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-right font-semibold text-primary">
                                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(venda.valor_total || 0)}
                                                            </TableCell>
                                                            <TableCell className="text-center">
                                                                <Badge variant={venda.status === 'cancelada' ? 'destructive' : 'outline'} className="text-[10px] capitalize px-1 py-0 h-4">
                                                                    {venda.status || 'concluída'}
                                                                </Badge>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                </div>
            </DialogContent>
        </Dialog>
    );
}
