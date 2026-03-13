import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { comprasService } from '@/services/comprasService';
import AprovacaoBadge from './AprovacaoBadge';
import {
    DndContext,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
} from '@dnd-kit/core';
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Clock, Eye, Edit, Trash2, Search, FileText, Paperclip, MessageSquare, AlertTriangle, Phone } from 'lucide-react';
import { format, differenceInDays, differenceInHours } from 'date-fns';
import { toast } from 'sonner';

// --- SORTABLE CARD COMPONENT ---
function SortableKanbanCard({
    pedido,
    isFocado,
    isAtrasado,
    onView,
    onEdit,
    onDelete,
    onReceber,
    isDimmedByStatus
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: `pedido-${pedido.id}`, data: { type: 'Card', pedido } });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const statusConfig = {
        'NÃO FATURADO': { icon: '🔴', color: 'text-red-700', bg: 'bg-red-50', border: 'border-l-red-600' },
        'APROVADO': { icon: '🟣', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-l-purple-600' },
        'CONFIRMADO': { icon: '🟢', color: 'text-green-700', bg: 'bg-green-50', border: 'border-l-green-600' },
        'COM PREVISÃO DE CHEGADA': { icon: '🟠', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-l-orange-600' },
        'EM TRANSPORTE': { icon: '🔵', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-l-blue-600' },
        'ENTREGUE': { icon: '☁️', color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-l-gray-400' },
        'BLOQUEADO': { icon: '🔒', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-l-amber-600' },
    };

    const isPendingApproval = pedido.aprovacao_status === 'PENDENTE';
    const statusToDisplay = isPendingApproval ? 'BLOQUEADO' : (pedido.status || 'NÃO DEFINIDO');
    const currentStatus = statusConfig[statusToDisplay] || { icon: '⚪', color: 'text-gray-400', bg: 'bg-gray-50' };

    // Communication Alert Logic
    const hrsSemDevolutiva = differenceInHours(new Date(), new Date(pedido.created_at));
    const requerAtencaoComm = !pedido.devolutiva && hrsSemDevolutiva > 24;

    const cardClasses = `
        group relative overflow-hidden
        bg-white/90 backdrop-blur-md border border-gray-200/50 
        shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] 
        cursor-grab active:cursor-grabbing hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.12)] 
        transition-all duration-300 w-full mb-3 rounded-xl
        ${statusConfig[pedido.status]?.border || 'border-l-4 border-l-gray-200'}
        ${isDragging ? 'opacity-40 scale-95 rotate-2 shadow-2xl ring-2 ring-blue-500/20' : ''} 
        ${isAtrasado ? 'bg-red-50/40 border-red-200 shadow-inner' : ''}
        ${requerAtencaoComm ? 'ring-1 ring-red-400 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : ''}
        ${isFocado ? 'ring-2 ring-green-500/50 scale-[1.02] shadow-xl animate-soft-pulse bg-green-50/60 z-50' : ''}
        ${isDimmedByStatus ? 'opacity-30 blur-[0.5px] grayscale' : ''}
        ${isPendingApproval ? 'ring-2 ring-amber-500/30' : ''}
    `;

    return (
        <Card ref={setNodeRef} style={style} {...attributes} {...listeners} className={cardClasses}>
            {isPendingApproval && (
                <div className="absolute inset-0 bg-amber-50/20 backdrop-blur-[1px] z-10 pointer-events-none flex items-center justify-center">
                    <div className="bg-amber-500 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg -rotate-12 border-2 border-white">
                        Aguardando Aprovação
                    </div>
                </div>
            )}
            <CardContent className="p-3">
                {/* Header: Center Cost Border & Badges */}
                <div className="flex items-center gap-2 mb-2.5">
                    {pedido.centro_custo && (
                        <div
                            className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.1)]"
                            style={{ backgroundColor: pedido.centro_custo.cor || '#ccc' }}
                            title={pedido.centro_custo.nome}
                        />
                    )}
                    <Badge variant="secondary" className="text-[10px] font-bold tracking-wider uppercase bg-gray-100/80 text-gray-600 border-none px-1.5 h-4">
                        {pedido.centro_custo?.nome || 'Geral'}
                    </Badge>
                    <span className="font-mono font-bold text-xs text-blue-600/80 ml-auto bg-blue-50 px-1.5 py-0.5 rounded">
                        #{pedido.numero_pedido || '---'}
                    </span>
                </div>

                {/* Body: Supplier & Product Preview */}
                <div className="text-[13px] font-bold text-gray-900 line-clamp-1 mb-1.5 group-hover:text-blue-600 transition-colors" title={pedido.fornecedor?.nome}>
                    {pedido.fornecedor?.nome || 'Fornecedor não informado'}
                </div>

                {pedido.itens && pedido.itens.length > 0 && (
                    <div className="text-[11px] text-gray-500 line-clamp-2 mb-3 bg-gray-50/50 p-2 rounded-lg border border-gray-100/50 leading-relaxed">
                        <span className="font-bold text-gray-700">{pedido.itens[0].quantidade_pedida}x</span> {pedido.itens[0].descricao_personalizada}
                        {pedido.itens.length > 1 && <span className="text-blue-500 font-medium italic"> (+{pedido.itens.length - 1} outros)</span>}
                    </div>
                )}

                {/* Status Label (Visual Filter Status) */}
                <div className={`mt-1 mb-3 flex items-center justify-between gap-1.5 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${currentStatus.bg} ${currentStatus.color} ring-1 ring-inset ring-black/5`}>
                    <div className="flex items-center gap-1.5">
                        <span>{currentStatus.icon}</span>
                        <span>{statusToDisplay}</span>
                    </div>
                    {isPendingApproval && (
                        <AprovacaoBadge status={pedido.aprovacao_status} nivelAtual={pedido.aprovacao_nivel_atual} />
                    )}
                </div>

                {/* Footer: Value, Icons */}
                <div className="flex justify-between items-center mb-3">
                    <div className="bg-green-100/50 text-green-800 px-2 py-0.5 rounded-full text-xs font-bold ring-1 ring-green-600/10">
                        R$ {(pedido.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                        {pedido.devolutiva && <Phone className="w-3.5 h-3.5 text-blue-500" title="Possui devolutiva do fornecedor" />}
                        {requerAtencaoComm && <AlertTriangle className="w-3.5 h-3.5 text-red-500 animate-bounce" title="Sem devolutiva há mais de 24h!" />}
                        {pedido.metadata?.has_attachments && <Paperclip className="w-3.5 h-3.5 hover:text-blue-500 transition-colors" title="Possui anexos" />}
                    </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-100/60 mt-2">
                    <div className="flex items-center gap-1.5 text-gray-400">
                        <Clock className={`w-3.5 h-3.5 ${isAtrasado ? 'text-red-500 animate-pulse' : ''}`} />
                        <span className={`text-[10px] font-medium uppercase tracking-tight ${isAtrasado ? 'text-red-600 font-bold' : ''}`}>
                            {pedido.data_previsao_entrega ? format(new Date(pedido.data_previsao_entrega), 'dd/MM/yy') : '---'}
                        </span>
                    </div>

                    <div className="flex gap-1" onPointerDown={(e) => e.stopPropagation()}>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full hover:bg-blue-50 hover:text-blue-600 transition-all active:scale-90"
                            onClick={(e) => { e.stopPropagation(); onView(pedido); }}
                            title="Ver Detalhes"
                        >
                            <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full hover:bg-amber-50 hover:text-amber-600 transition-all active:scale-90"
                            onClick={(e) => { e.stopPropagation(); onEdit(pedido); }}
                            title="Editar"
                        >
                            <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full text-red-500 hover:bg-red-50 hover:text-red-600 transition-all active:scale-90"
                            onClick={(e) => { e.stopPropagation(); onDelete(pedido); }}
                            title="Excluir"
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// --- COLUMN COMPONENT ---
function KanbanColumn({ column, cards, isDraggingOver, onReceber, onEdit, onView, onDelete, pedidoEmFoco, filtrosStatus }) {
    const { setNodeRef } = useDroppable({
        id: column.id,
        data: { type: 'Column', column }
    });

    const statusOrder = [
        'NÃO FATURADO',
        'APROVADO',
        'CONFIRMADO',
        'COM PREVISÃO DE CHEGADA',
        'EM TRANSPORTE',
        'ENTREGUE'
    ];

    const cardsByStatus = useMemo(() => {
        const groups = {};
        statusOrder.forEach(status => {
            groups[status] = cards.filter(c => c.status === status);
        });
        const others = cards.filter(c => !statusOrder.includes(c.status));
        if (others.length > 0) groups['Outros'] = others;
        return groups;
    }, [cards]);

    return (
        <div className="flex-shrink-0 w-80 flex flex-col h-full bg-gray-50/40 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-sm overflow-hidden group/column">
            <div
                className="p-4 flex items-center justify-between border-b border-white/20 relative"
                style={{ backgroundColor: `${column.cor || '#e5e7eb'}22` }}
            >
                <div
                    className="absolute left-0 top-0 bottom-0 w-1.5"
                    style={{ backgroundColor: column.cor || '#e5e7eb' }}
                />
                <div className="flex items-center gap-3 font-bold text-gray-800 tracking-tight pl-2">
                    {column.nome}
                    <Badge variant="secondary" className="bg-white/90 text-gray-500 font-mono text-[10px] shadow-sm border-none px-1.5">
                        {cards.length}
                    </Badge>
                </div>
            </div>

            <div
                ref={setNodeRef}
                className={`flex-1 p-3 overflow-y-auto custom-scrollbar transition-all duration-300 space-y-4 ${isDraggingOver ? 'bg-blue-50/50 ring-2 ring-inset ring-blue-100/50' : ''}`}
            >
                <SortableContext items={cards.map(c => `pedido-${c.id}`)} strategy={verticalListSortingStrategy}>
                    {Object.entries(cardsByStatus).map(([status, groupCards]) => {
                        if (groupCards.length === 0) return null;

                        return (
                            <div key={status} className="space-y-2">
                                <div className="flex items-center gap-2 px-1 mb-2">
                                    <div className="h-[1px] flex-1 bg-gray-200" />
                                    <span className="text-[9px] font-black tracking-widest text-gray-400 uppercase">
                                        {status}
                                    </span>
                                    <div className="h-[1px] flex-1 bg-gray-200" />
                                </div>
                                {groupCards.map((pedido) => {
                                    const diasEntrega = pedido.data_previsao_entrega ? differenceInDays(new Date(pedido.data_previsao_entrega), new Date()) : null;
                                    const isAtrasado = diasEntrega !== null && diasEntrega < 0;
                                    const isDimmed = filtrosStatus[pedido.status] === false;

                                    return (
                                        <SortableKanbanCard
                                            key={pedido.id}
                                            pedido={pedido}
                                            isFocado={pedidoEmFoco === pedido.id}
                                            isAtrasado={isAtrasado}
                                            isDimmedByStatus={isDimmed}
                                            onView={onView}
                                            onEdit={onEdit}
                                            onDelete={onDelete}
                                            onReceber={onReceber}
                                        />
                                    );
                                })}
                            </div>
                        );
                    })}
                </SortableContext>
            </div>
        </div>
    );
}

import { useDroppable } from '@dnd-kit/core';

// --- MAIN KANBAN BOARD ---
export default function PedidosKanban({ onEdit, onView, onDelete, onReceber, pedidoEmFoco, filter = { type: 'all', value: null } }) {
    const queryClient = useQueryClient();
    const [busca, setBusca] = useState("");
    const [activeId, setActiveId] = useState(null);
    const [activeCard, setActiveCard] = useState(null);

    const { data: boardData, isLoading, isError } = useQuery({
        queryKey: ['pedidos-compra-kanban'],
        queryFn: async () => await comprasService.getBoard(),
        refetchInterval: 15000
    });

    const updateStatusMutation = useMutation({
        mutationFn: async ({ id, centro_custo_id, status }) => {
            if (status) {
                return await comprasService.updateStatus(id, status, { centro_custo_id });
            }
            return await comprasService.moveCard(id, centro_custo_id);
        },
        onMutate: async ({ id, centro_custo_id, status }) => {
            await queryClient.cancelQueries(['pedidos-compra-kanban']);
            const previousData = queryClient.getQueryData(['pedidos-compra-kanban']);

            queryClient.setQueryData(['pedidos-compra-kanban'], old => {
                if (!old) return old;
                const newCards = old.cards.map(p => {
                    if (String(p.id) === String(id)) {
                        return { 
                            ...p, 
                            centro_custo_id: centro_custo_id || p.centro_custo_id,
                            status: status || p.status 
                        };
                    }
                    return p;
                });
                const newBoard = old.columns.map(col => ({
                    ...col,
                    cards: newCards.filter(c => c.centro_custo_id === col.centro_custo_id)
                }));
                return { ...old, cards: newCards, board: newBoard };
            });

            return { previousData };
        },
        onError: (err, variables, context) => {
            queryClient.setQueryData(['pedidos-compra-kanban'], context.previousData);
            toast.error("Erro ao mover pedido. Tente novamente.");
        },
        onSettled: () => {
            queryClient.invalidateQueries(['pedidos-compra-kanban']);
        }
    });

    const [filtrosStatus, setFiltrosStatus] = useState({
        'NÃO FATURADO': true,
        'APROVADO': true,
        'CONFIRMADO': true,
        'COM PREVISÃO DE CHEGADA': true,
        'EM TRANSPORTE': true,
        'ENTREGUE': true,
    });

    const toggleFiltroStatus = (status) => {
        setFiltrosStatus(prev => ({ ...prev, [status]: !prev[status] }));
    };

    // Auto-apply filters when 'filter' prop changes
    React.useEffect(() => {
        setFiltrosStatus(prev => {
            if (filter.type === 'status' && filter.value) {
                const newFiltros = { ...prev };
                Object.keys(newFiltros).forEach(k => newFiltros[k] = (k === filter.value));
                return newFiltros;
            } else if (filter.type === 'all') {
                const newFiltros = { ...prev };
                Object.keys(newFiltros).forEach(k => newFiltros[k] = true);
                return newFiltros;
            }
            return prev;
        });
    }, [filter]);

    const boardComDimmer = useMemo(() => {
        if (!boardData?.board) return [];

        return boardData.board.map(col => ({
            ...col,
            cards: col.cards.filter(c => {
                // 1. Search Match
                const searchMatch = !busca ||
                    c.numero_pedido?.toLowerCase().includes(busca.toLowerCase()) ||
                    c.fornecedor?.nome?.toLowerCase().includes(busca.toLowerCase()) ||
                    c.centro_custo?.nome?.toLowerCase().includes(busca.toLowerCase());

                if (!searchMatch) return false;

                // 2. Dashboard Specific Filters (Hard Filter)
                if (filter.type === 'highlight' && filter.value) {
                    return c.id === filter.value;
                }

                if (filter.type === 'sem_resposta') {
                    const hrs = differenceInHours(new Date(), new Date(c.created_at));
                    return !c.devolutiva && hrs > 24;
                }

                return true;
            })
        }));
    }, [boardData, busca, filter]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    React.useEffect(() => {
        if (pedidoEmFoco) {
            setTimeout(() => {
                const el = document.getElementById(`pedido-card-${pedidoEmFoco}`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);
        }
    }, [pedidoEmFoco]);

    const { columns = [], cards = [] } = boardData || {};

    const handleDragStart = (event) => {
        const { active } = event;
        setActiveId(active.id);
        setActiveCard(active.data.current?.pedido);
    };

    const handleDragEnd = (event) => {
        const { active, over } = event;
        setActiveId(null);
        setActiveCard(null);

        if (!over) return;

        const pedidoId = active.id.replace('pedido-', '');
        let toColumnId = over.id;
        const isOverCard = over.data.current?.type === 'Card';
        if (isOverCard) {
            toColumnId = over.data.current.pedido.centro_custo_id;
        }

        if (activeCard && (String(activeCard.centro_custo_id) !== String(toColumnId))) {
            const targetCol = boardData.columns.find(c => String(c.id) === String(toColumnId) || String(c.centro_custo_id) === String(toColumnId));

            const colTipo = targetCol?.tipo || targetCol?.centro_custo?.tipo;

            if (colTipo === 'estoque') {
                onReceber(activeCard);
                return;
            }

            if (colTipo === 'entregue') {
                updateStatusMutation.mutate({ id: pedidoId, status: 'ENTREGUE', centro_custo_id: toColumnId });
                return;
            }

            const finalTargetId = targetCol?.centro_custo_id || toColumnId;
            updateStatusMutation.mutate({ id: pedidoId, centro_custo_id: finalTargetId });
        }
    };

    if (isLoading) {
        return <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-b-2 border-green-600 rounded-full" /></div>;
    }
    if (isError) {
        return <div className="text-center text-red-500 py-12 px-4 rounded-xl border border-red-200 bg-red-50">Erro ao carregar o quadro do Kanban.</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4 bg-white/60 backdrop-blur-xl p-4 rounded-2xl border border-white/40 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.1)] ring-1 ring-black/[0.02]">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-500 w-4 h-4" />
                    <Input
                        placeholder="Buscar pedido, C.C ou fornecedor..."
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        className="pl-10 h-10 bg-white/80 border-gray-200/50 focus:ring-2 focus:ring-blue-100 rounded-xl transition-all shadow-sm"
                    />
                </div>

                <div className="flex gap-2 items-center overflow-x-auto pb-1 max-w-full custom-scrollbar">
                    {Object.entries({
                        'NÃO FATURADO': '🔴',
                        'APROVADO': '🟣',
                        'CONFIRMADO': '🟢',
                        'COM PREVISÃO DE CHEGADA': '🟠',
                        'EM TRANSPORTE': '🔵',
                        'ENTREGUE': '☁️',
                    }).map(([status, icon]) => (
                        <button
                            key={status}
                            onClick={() => toggleFiltroStatus(status)}
                            className={`
                                flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black transition-all whitespace-nowrap border
                                ${filtrosStatus[status]
                                    ? 'bg-white text-gray-800 shadow-sm border-gray-200 ring-2 ring-blue-500/20'
                                    : 'bg-gray-100/50 text-gray-400 grayscale border-transparent'}
                            `}
                        >
                            <span>{icon}</span>
                            {status}
                        </button>
                    ))}
                </div>
            </div>

            <div className="relative">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCorners}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                >
                    <div className="flex gap-6 overflow-x-auto pb-6 h-[calc(100vh-280px)] custom-scrollbar">
                        <SortableContext items={boardComDimmer.map(c => c.id)} strategy={horizontalListSortingStrategy}>
                            {boardComDimmer.map((column) => (
                                <KanbanColumn
                                    key={column.id}
                                    column={{
                                        ...column,
                                        id: column.centro_custo_id
                                    }}
                                    cards={column.cards}
                                    filtrosStatus={filtrosStatus}
                                    isDraggingOver={activeId && activeCard?.centro_custo_id !== column.centro_custo_id}
                                    onView={onView}
                                    onEdit={onEdit}
                                    onDelete={onDelete}
                                    onReceber={onReceber}
                                    pedidoEmFoco={pedidoEmFoco}
                                />
                            ))}
                        </SortableContext>
                    </div>

                    {boardComDimmer.length === 0 && (
                        <div className="text-gray-400 p-8 border-2 border-dashed border-gray-200 rounded-xl w-full text-center">
                            Sem vendedores ou setores cadastrados para o Kanban.
                        </div>
                    )}
                </DndContext>
            </div>

            <DragOverlay>
                {activeId && activeCard ? (
                    <div className="opacity-90 transform rotate-2 pointer-events-none">
                        <SortableKanbanCard
                            pedido={activeCard}
                            isFocado={false}
                            isAtrasado={false}
                            onView={() => { }}
                            onEdit={() => { }}
                            onDelete={() => { }}
                            onReceber={() => { }}
                        />
                    </div>
                ) : null}
            </DragOverlay>
        </div>
    );
}
