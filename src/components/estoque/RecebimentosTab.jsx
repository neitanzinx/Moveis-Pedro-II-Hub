import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    PackageCheck, Search, Clock, CheckCircle2,
    AlertTriangle, ArrowRight, Truck
} from 'lucide-react';
import { format } from 'date-fns';
import RecebimentoPedido from './RecebimentoPedido';

export default function RecebimentosTab() {
    const [busca, setBusca] = useState("");
    const [pedidoSelecionado, setPedidoSelecionado] = useState(null);

    const { data: pedidos = [], isLoading, refetch } = useQuery({
        queryKey: ['pedidos-compra-recebimento'],
        queryFn: async () => {
            const { data } = await base44.entities.PedidoCompra.search({
                limit: 100,
                orderBy: '-created_at'
            });
            // Mostrar apenas o que pode ser recebido
            return data.filter(p =>
                ['Confirmado', 'Em Conferência', 'Parcialmente Recebido'].includes(p.status)
            );
        }
    });

    const statusConfig = {
        'Enviado': { label: 'Enviado', color: 'bg-blue-100 text-blue-700' },
        'Confirmado': { label: 'Confirmado', color: 'bg-purple-100 text-purple-700' },
        'Em Conferência': { label: 'Conferindo', color: 'bg-blue-600 text-white' },
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
                                        {pedido.telefone_fornecedor && (
                                            <div className="text-xs text-gray-500">{pedido.telefone_fornecedor}</div>
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
                                <TableCell colSpan={6} className="h-32 text-center text-gray-500">
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

            {pedidoSelecionado && (
                <RecebimentoPedido
                    open={!!pedidoSelecionado}
                    onClose={() => {
                        setPedidoSelecionado(null);
                        refetch();
                    }}
                    pedido={pedidoSelecionado}
                />
            )}
        </div>
    );
}
