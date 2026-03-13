import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/lib/supabase";
import { format } from 'date-fns';
import {
    Clock, Check, X, Eye, FileText, AlertTriangle,
    ArrowRight, User, DollarSign, Building2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { ApprovalEngine } from '@/services/ApprovalEngine';
import AprovacaoBadge from './AprovacaoBadge';

export default function AprovacoesDashboard({ onViewOC }) {
    const queryClient = useQueryClient();

    // Fetch current user role
    const { data: currentUserData } = useQuery({
        queryKey: ['current-user-role-aprovacoes'],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return null;
            const { data } = await supabase.from('public_users').select('cargo').eq('id', user.id).single();
            return data;
        }
    });

    const isAprovador = currentUserData?.cargo === 'Financeiro' || currentUserData?.cargo === 'Administrador';

    // Fetch pending approvals for the current user
    const { data: pendencias = [], isLoading } = useQuery({
        queryKey: ['aprovacoes-pendentes-usuario'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('aprovacoes_oc')
                .select(`
                    *,
                    oc:oc_id (
                        id, 
                        numero_pedido, 
                        valor_total, 
                        fornecedor_id, 
                        fornecedor_nome,
                        aprovacao_nivel_atual,
                        centro_custo:centro_custo_id (nome)
                    )
                `)
                .eq('status', 'PENDENTE')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        },
        enabled: isAprovador
    });

    const handleDecision = useMutation({
        mutationFn: async ({ approvalId, ocId, status, justification }) => {
            const { data: { user } } = await supabase.auth.getUser();
            return ApprovalEngine.processDecision(approvalId, ocId, user.id, status, justification);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['aprovacoes-pendentes-usuario'] });
            queryClient.invalidateQueries({ queryKey: ['pedidos-compra-kanban'] });
            toast.success("Decisão registrada com sucesso!");
        },
        onError: (err) => {
            toast.error("Erro ao processar: " + err.message);
        }
    });

    if (isLoading) return <div className="p-8 text-center text-gray-500">Buscando pendências...</div>;

    if (!isAprovador) {
        return (
            <div className="p-12 text-center text-gray-400">
                <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-bold text-gray-500">Acesso Restrito</p>
                <p className="text-sm">Somente o Financeiro e o Administrador podem aprovar pedidos.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 text-left">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                        <Clock className="w-6 h-6 text-amber-500" />
                        Minhas Aprovações Pendentes
                    </h2>
                    <p className="text-gray-500">Gerencie as ordens de compra que aguardam seu aval.</p>
                </div>
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 px-3 py-1 font-bold">
                    {pendencias.length} OC(s) PENDENTE(S)
                </Badge>
            </div>

            {pendencias.length === 0 ? (
                <Card className="border-dashed border-2 border-gray-200 bg-gray-50/50">
                    <CardContent className="py-12 flex flex-col items-center justify-center text-gray-400">
                        <Check className="w-12 h-12 mb-3 text-green-500/30" />
                        <p className="font-bold">Tudo em dia!</p>
                        <p className="text-sm">Não há ordens de compra aguardando sua aprovação no momento.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {pendencias.map((pendencia) => (
                        <Card key={pendencia.id} className="hover:shadow-md transition-shadow border-l-4 border-l-amber-500 overflow-hidden">
                            <CardContent className="p-0">
                                <div className="grid grid-cols-12 items-center">
                                    {/* Info Section */}
                                    <div className="col-span-8 p-4 border-r border-gray-100 flex items-center gap-6">
                                        <div className="bg-amber-100 text-amber-700 w-12 h-12 rounded-xl flex items-center justify-center shrink-0">
                                            <FileText className="w-6 h-6" />
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-black text-blue-600">#{pendencia.oc.numero_pedido}</span>
                                                <Badge variant="secondary" className="bg-gray-100 text-gray-600 font-bold text-[10px] uppercase">
                                                    {pendencia.oc.centro_custo?.nome || 'Geral'}
                                                </Badge>
                                                <Badge className="bg-blue-50 text-blue-700 border-blue-100 text-[10px] h-5">
                                                    Nível {pendencia.nivel}
                                                </Badge>
                                            </div>
                                            <p className="text-sm font-bold text-gray-900">{pendencia.oc.fornecedor_nome}</p>
                                            <div className="flex items-center gap-4 text-xs text-gray-500">
                                                <span className="flex items-center gap-1 font-bold text-green-700">
                                                    <DollarSign className="w-3 h-3" />
                                                    R$ {pendencia.oc.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    Há {format(new Date(pendencia.created_at), 'dd/MM HH:mm')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions Section */}
                                    <div className="col-span-4 p-4 bg-gray-50/50 flex gap-2 h-full items-center justify-end">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="hover:bg-blue-50 hover:text-blue-600"
                                            onClick={() => onViewOC(pendencia.oc)}
                                        >
                                            <Eye className="w-4 h-4 mr-2" />
                                            Detalhes
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="border-red-200 text-red-600 hover:bg-red-50"
                                            onClick={() => {
                                                const just = prompt("Justificativa para rejeição:");
                                                if (just) handleDecision.mutate({
                                                    approvalId: pendencia.id,
                                                    ocId: pendencia.oc_id,
                                                    status: 'REJEITADO',
                                                    justification: just
                                                });
                                            }}
                                        >
                                            <X className="w-4 h-4 mr-2" />
                                            Rejeitar
                                        </Button>
                                        <Button
                                            size="sm"
                                            className="bg-green-600 hover:bg-green-700"
                                            onClick={() => handleDecision.mutate({
                                                approvalId: pendencia.id,
                                                ocId: pendencia.oc_id,
                                                status: 'APROVADO'
                                            })}
                                        >
                                            <Check className="w-4 h-4 mr-2" />
                                            Aprovar
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
