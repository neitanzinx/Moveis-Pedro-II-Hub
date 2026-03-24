import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    PackageCheck, Search, Clock, Truck
} from 'lucide-react';
import { format } from 'date-fns';
import RecebimentoModal from '@/components/compras/RecebimentoModal';
import { comprasService } from '@/services/comprasService';
import { supabase } from '@/lib/supabase';

export default function RecebimentosTab() {
    const [busca, setBusca] = useState("");
    const [pedidoSelecionado, setPedidoSelecionado] = useState(null);

    const { data: pedidos = [], isLoading, refetch } = useQuery({
        queryKey: ['pedidos-compra-recebimento'],
        queryFn: async () => {
            const data = await comprasService.listOcs('-created_at');
            const pedidosPendentes = (data || []).filter(p =>
                ['Pedido Enviado', 'Parcialmente Recebido'].includes(p.status)
            );

            const pedidosIds = pedidosPendentes.map(p => p.id).filter(Boolean);
            if (pedidosIds.length === 0) return pedidosPendentes;

            const { data: itensOc, error } = await supabase
                .from('compras_oc_itens')
                .select('ordem_compra_id, quantidade_pedida, quantidade_recebida')
                .in('ordem_compra_id', pedidosIds);

            if (error) {
                console.warn('Aviso ao buscar progresso de recebimento:', error.message);
                return pedidosPendentes;
            }

            const progressoPorOc = (itensOc || []).reduce((acc, item) => {
                const ordemId = item.ordem_compra_id;
                if (!acc[ordemId]) {
                    acc[ordemId] = { total: 0, completos: 0 };
                }
                acc[ordemId].total += 1;
                if ((item.quantidade_recebida || 0) >= (item.quantidade_pedida || 0)) {
                    acc[ordemId].completos += 1;
                }
                return acc;
            }, {});

            return pedidosPendentes.map(pedido => ({
                ...pedido,
                progresso_recebimento: progressoPorOc[pedido.id] || { total: 0, completos: 0 },
            }));
        }
    });

    const { data: recebidosHistorico = [], isLoading: isLoadingHistorico } = useQuery({
        queryKey: ['historico-recebimentos-oc'],
        queryFn: async () => {
            const { data: historico, error } = await supabase
                .from('compras_recebimentos_historico')
                .select('id, ordem_compra_id, numero_oc, numero_nfe, data_recebimento, recebido_por, observacoes')
                .order('data_recebimento', { ascending: false })
                .limit(30);

            if (error) {
                throw error;
            }

            const userIds = [...new Set((historico || []).map(r => r.recebido_por).filter(Boolean))];
            let usuariosMap = {};

            if (userIds.length > 0) {
                const { data: usuarios, error: usuariosError } = await supabase
                    .from('public_users')
                    .select('id, full_name, nome, email')
                    .in('id', userIds);

                if (usuariosError) {
                    console.warn('Aviso ao buscar usuários de recebimento:', usuariosError.message);
                }

                usuariosMap = (usuarios || []).reduce((acc, usuario) => {
                    acc[usuario.id] = usuario.full_name || usuario.nome || usuario.email || 'Usuário';
                    return acc;
                }, {});
            }

            return (historico || []).map(item => ({
                ...item,
                recebido_por_nome: usuariosMap[item.recebido_por] || 'Usuário não identificado',
            }));
        }
    });

    const statusConfig = {
        'Pedido Enviado': { label: 'Pedido Enviado', color: 'bg-blue-100 text-blue-700' },
        'Parcialmente Recebido': { label: 'Parcial', color: 'bg-orange-100 text-orange-700' }
    };

    const filtrados = pedidos.filter(p =>
        (p.numero_pedido || '').toLowerCase().includes(busca.toLowerCase()) ||
        (p.fornecedor_nome || '').toLowerCase().includes(busca.toLowerCase())
    );

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-12">
                <div className="animate-spin h-8 w-8 border-b-2 border-green-600 rounded-full" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                        placeholder="Buscar por número ou fornecedor..."
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Truck className="w-4 h-4" />
                    <span>{pedidos.length} pedidos aguardando recebimento</span>
                </div>
            </div>

            <div className="border rounded-lg bg-white overflow-hidden shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-gray-50/50">
                            <TableHead className="w-[120px]">Nº Pedido</TableHead>
                            <TableHead>Fornecedor</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead className="text-center">Progresso</TableHead>
                            <TableHead className="text-right">Data Pedido</TableHead>
                            <TableHead className="text-right">Previsão</TableHead>
                            <TableHead className="w-[130px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtrados.length > 0 ? (
                            filtrados.map((pedido) => (
                                <TableRow key={pedido.id} className="hover:bg-gray-50/50">
                                    <TableCell className="font-medium text-blue-700">
                                        #{pedido.numero_pedido}
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-medium text-gray-900">{pedido.fornecedor_nome}</div>
                                        {(pedido.metadata?.vendedor_nome || pedido.centro_custo_nome) && (
                                            <div className="text-xs text-gray-500">
                                                Vendedor: {pedido.metadata?.vendedor_nome || pedido.centro_custo_nome}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge
                                            variant="secondary"
                                            className={statusConfig[pedido.status]?.color || "bg-gray-100"}
                                        >
                                            {statusConfig[pedido.status]?.label || pedido.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-center text-xs">
                                        <Badge variant="outline" className="font-mono">
                                            {pedido.progresso_recebimento?.completos || 0}/{pedido.progresso_recebimento?.total || 0}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right text-gray-500">
                                        {pedido.data_pedido ? format(new Date(pedido.data_pedido), 'dd/MM/yyyy') : '-'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="text-sm">
                                                {pedido.data_previsao_entrega ? format(new Date(pedido.data_previsao_entrega), 'dd/MM/yyyy') : 'Não informada'}
                                            </span>
                                            {pedido.data_previsao_entrega && (
                                                <div className="flex items-center gap-1 text-[10px] text-gray-400">
                                                    <Clock className="w-3 h-3" />
                                                    <span>Previsão</span>
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            size="sm"
                                            onClick={() => setPedidoSelecionado(pedido)}
                                            className="w-full gap-2 bg-green-600 hover:bg-green-700"
                                        >
                                            <PackageCheck className="w-4 h-4" />
                                            Receber
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={7} className="h-32 text-center text-gray-500">
                                    <div className="flex flex-col items-center gap-2">
                                        <Truck className="w-8 h-8 text-gray-300" />
                                        <p>Nenhum pedido aguardando recebimento</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="border rounded-lg bg-white overflow-hidden shadow-sm">
                <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50/50">
                    <div className="font-semibold text-sm text-gray-800">Recebidos Recentemente</div>
                    <div className="text-xs text-gray-500">Últimos {recebidosHistorico.length} registros</div>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow className="bg-gray-50/30">
                            <TableHead className="w-[120px]">Nº Pedido</TableHead>
                            <TableHead>Recebido por</TableHead>
                            <TableHead className="text-right">Data/Hora</TableHead>
                            <TableHead className="w-[180px]">NFe</TableHead>
                            <TableHead>Observações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoadingHistorico ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-gray-500">
                                    Carregando histórico de recebimentos...
                                </TableCell>
                            </TableRow>
                        ) : recebidosHistorico.length > 0 ? (
                            recebidosHistorico.map((recebido) => (
                                <TableRow key={recebido.id} className="hover:bg-gray-50/50">
                                    <TableCell className="font-medium text-green-700">#{recebido.numero_oc}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="border-green-200 text-green-700 bg-green-50">
                                            {recebido.recebido_por_nome}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right text-gray-600">
                                        {recebido.data_recebimento
                                            ? format(new Date(recebido.data_recebimento), 'dd/MM/yyyy HH:mm')
                                            : '-'}
                                    </TableCell>
                                    <TableCell className="text-xs text-gray-600">
                                        {recebido.numero_nfe || '-'}
                                    </TableCell>
                                    <TableCell className="text-xs text-gray-600">
                                        {recebido.observacoes || '-'}
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-gray-500">
                                    Ainda não há registros de OCs recebidas.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {pedidoSelecionado && (
                <RecebimentoModal
                    isOpen={!!pedidoSelecionado}
                    onClose={() => {
                        setPedidoSelecionado(null);
                        refetch();
                    }}
                    oc={pedidoSelecionado}
                />
            )}
        </div>
    );
}
