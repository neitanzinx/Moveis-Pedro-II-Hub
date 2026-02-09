import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowRightLeft, UserCheck, Loader2, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function TransferirMontagemModal({ isOpen, onClose, venda, user }) {
    const [selectedItems, setSelectedItems] = useState([]);
    const queryClient = useQueryClient();

    // Buscar itens de montagem INTERNA e NÃO CONCLUÍDOS para esta venda
    const { data: itensMontagem = [], isLoading } = useQuery({
        queryKey: ['montagens-internas-venda', venda?.id],
        queryFn: async () => {
            if (!venda?.id) return [];
            const todas = await base44.entities.MontagemItem.list();
            return todas.filter(m =>
                m.venda_id === venda.id &&
                m.tipo_montagem === 'interna' &&
                m.status !== 'concluida'
            );
        },
        enabled: !!venda?.id && isOpen,
    });

    // Mutation para atualizar
    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.MontagemItem.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['montagens-internas-venda'] });
            queryClient.invalidateQueries({ queryKey: ['montagens'] }); // Atualizar listas globais
        }
    });

    // Selecionar todos os itens
    const handleSelectAll = (checked) => {
        if (checked) {
            // Só seleciona os que não estão atribuídos (ou todos, mas com aviso)
            // A regra é: se já tem montador, não pode transferir (salvo se limparmos)
            // Mas o usuario pediu "não permita status mudar caso já tenha sido atribuido"
            // Entao só selecionamos os elegiveis
            const elegiveis = itensMontagem.filter(m => !m.montador_id).map(m => m.id);
            setSelectedItems(elegiveis);
            if (elegiveis.length < itensMontagem.length) {
                toast.info("Alguns itens já estão atribuídos e não foram selecionados.");
            }
        } else {
            setSelectedItems([]);
        }
    };

    const handleToggleItem = (id, montadorId) => {
        if (montadorId) {
            toast.warning("Este item já está atribuído a um montador interno. Remova a atribuição primeiro.");
            return;
        }

        setSelectedItems(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleTransferir = async () => {
        if (selectedItems.length === 0) return;

        const confirmacao = window.confirm(`Deseja transferir ${selectedItems.length} itens para Montagem Externa?`);
        if (!confirmacao) return;

        try {
            const promises = selectedItems.map(id =>
                updateMutation.mutateAsync({
                    id,
                    data: {
                        tipo_montagem: 'terceirizada',
                        montador_id: null,
                        montador_nome: null,
                        status: 'pendente',
                        updated_at: new Date().toISOString()
                    }
                })
            );

            await Promise.all(promises);
            toast.success(`${selectedItems.length} itens transferidos com sucesso!`);
            onClose();
            setSelectedItems([]);
        } catch (error) {
            console.error(error);
            toast.error("Erro ao transferir itens.");
        }
    };

    const isAllSelected = itensMontagem.length > 0 && itensMontagem.filter(m => !m.montador_id).every(m => selectedItems.includes(m.id)) && selectedItems.length > 0;

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ArrowRightLeft className="w-5 h-5 text-orange-600" />
                        Transferir para Montagem Externa
                    </DialogTitle>
                    <DialogDescription>
                        Selecione os itens que devem ser montados no local do cliente (Montador Externo).
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    {isLoading ? (
                        <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>
                    ) : itensMontagem.length === 0 ? (
                        <div className="text-center p-4 text-gray-500 bg-gray-50 rounded-lg border border-dashed">
                            Nenhum item de montagem interna pendente encontrado para este pedido.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex items-center space-x-2 pb-2 border-b">
                                <Checkbox
                                    id="select-all"
                                    checked={isAllSelected}
                                    onCheckedChange={handleSelectAll}
                                />
                                <Label htmlFor="select-all" className="font-bold cursor-pointer">
                                    Selecionar Todos (Elegíveis)
                                </Label>
                            </div>

                            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
                                {itensMontagem.map(item => {
                                    const isAssigned = !!item.montador_id;
                                    return (
                                        <div
                                            key={item.id}
                                            className={`flex items-start space-x-3 p-2 rounded-lg border transition-colors ${isAssigned ? 'bg-gray-50 border-gray-200 opacity-70' :
                                                    selectedItems.includes(item.id) ? 'bg-orange-50 border-orange-200' : 'bg-white hover:bg-gray-50'
                                                }`}
                                        >
                                            <Checkbox
                                                id={`item-${item.id}`}
                                                checked={selectedItems.includes(item.id)}
                                                onCheckedChange={() => handleToggleItem(item.id, item.montador_id)}
                                                disabled={isAssigned}
                                            />
                                            <div className="flex-1">
                                                <Label
                                                    htmlFor={`item-${item.id}`}
                                                    className={`font-medium cursor-pointer ${isAssigned ? 'cursor-not-allowed text-gray-500' : ''}`}
                                                >
                                                    {item.produto_nome}
                                                </Label>
                                                <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                                    <span className="bg-gray-100 px-1 rounded">Qtd: {item.quantidade}</span>
                                                    {isAssigned && (
                                                        <span className="flex items-center gap-1 text-blue-600 bg-blue-50 px-1 rounded">
                                                            <UserCheck className="w-3 h-3" />
                                                            {item.montador_nome}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="bg-yellow-50 p-3 rounded-md text-xs text-yellow-800 flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <p>
                                    Itens já atribuídos a um montador interno não podem ser transferidos diretamente.
                                    Vá para "Montagem Interna" e remova a atribuição primeiro.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button
                        onClick={handleTransferir}
                        disabled={selectedItems.length === 0 || updateMutation.isPending}
                        className="bg-orange-600 hover:bg-orange-700 text-white"
                    >
                        {updateMutation.isPending ? <Loader2 className="animate-spin mr-2" /> : null}
                        Transferir {selectedItems.length} Item(ns)
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
