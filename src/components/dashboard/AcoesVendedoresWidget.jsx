import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye, Clock, User, Package, Edit, Trash, Plus, ShieldCheck } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const ACTION_ICONS = {
    'UPDATE': <Edit className="w-4 h-4 text-orange-500" />,
    'CREATE': <Plus className="w-4 h-4 text-green-500" />,
    'DELETE': <Trash className="w-4 h-4 text-red-500" />,
    'DEFAULT': <ShieldCheck className="w-4 h-4 text-blue-500" />
};

export default function AcoesVendedoresWidget() {
    const { user, getUserLoja } = useAuth();

    const { data: rawLogs = [], isLoading, isError } = useQuery({
        queryKey: ['acoes-vendedores'],
        queryFn: () => base44.entities.AuditLog.list('-created_at'),
        refetchInterval: 15000,
            staleTime: 30000,
            retry: false,
    });

    const { data: storeUsers = [] } = useQuery({
        queryKey: ['store-users', user?.loja],
        queryFn: async () => {
            const lojaAtual = getUserLoja();
            if (!lojaAtual) return [];
            const { data, error } = await supabase
                .from('public_users')
                .select('id, email, full_name, cargo')
                .eq('loja', lojaAtual);
            if (error) throw error;
            return data || [];
        },
        enabled: !!getUserLoja()
    });

    const normalizedLogs = rawLogs.map((log) => {
        const resolvedUser = storeUsers.find((u) =>
            (log.user_id && String(u.id) === String(log.user_id)) ||
            (log.user_email && u.email === log.user_email)
        );

        return {
            ...log,
            action: log.acao || log.action || 'UPDATE',
            user_name: log.usuario || log.user_name || resolvedUser?.full_name || '',
            user_email: log.user_email || resolvedUser?.email || '',
            user_cargo: log.user_cargo || resolvedUser?.cargo || '',
            entity_type: log.tabela || log.entity_type || log.table_name || '',
            entity_description: log.entity_description || log.detalhes?.description || '',
            timestamp: log.created_at || log.timestamp,
        };
    });

    const storeUserEmails = storeUsers.map(u => u.email).filter(Boolean);
    const storeUserNames = storeUsers.map(u => u.full_name).filter(Boolean);

    // Filtrar apenas vendedores da mesma loja
    const vendedorLogs = normalizedLogs.filter(log => {
        const cargoLog = (log.user_cargo || log.cargo || '').toLowerCase();
        const isVendedor = cargoLog.includes('vendedor');

        const email = log.user_email || log.email || '';
        const nome = log.user_name || log.usuario || '';

        const isFromStore = storeUserEmails.includes(email) || storeUserNames.includes(nome);

        const lojaAtual = getUserLoja();
        const isGlobalManager = !lojaAtual || lojaAtual === 'todas';

        return isVendedor && (isGlobalManager || isFromStore);
    });

    if (isLoading) {
        return (
            <Card className="col-span-1 lg:col-span-2 shadow-sm border border-gray-100 flex flex-col h-[400px]">
                <CardHeader className="bg-gray-50/50 pb-3 border-b border-gray-100 shrink-0">
                    <CardTitle className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                        <Eye className="w-4 h-4 text-orange-600" />
                        Ações de Vendedores
                    </CardTitle>
                    <CardDescription className="text-xs">
                        Monitorando atividades recentes
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-6 flex-1 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
                </CardContent>
            </Card>
        );
    }

    if (isError) {
        return (
            <Card className="col-span-1 lg:col-span-2 shadow-sm border border-gray-100 flex flex-col h-[400px]">
                <CardHeader className="bg-gray-50/50 pb-3 border-b border-gray-100 shrink-0">
                    <CardTitle className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                        <Eye className="w-4 h-4 text-orange-600" />
                        Ações de Vendedores
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6 flex-1 flex items-center justify-center">
                    <p className="text-sm text-gray-500">Erro ao carregar os logs.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="col-span-1 lg:col-span-2 shadow-sm border-orange-100 flex flex-col h-[400px]">
            <CardHeader className="bg-orange-50/50 pb-3 border-b border-orange-100 shrink-0">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                            <Eye className="w-4 h-4 text-orange-600" />
                            Ações de Vendedores
                        </CardTitle>
                        <CardDescription className="text-xs mt-1">
                            Atividades recentes de produtos e vendas
                        </CardDescription>
                    </div>
                    <div className="text-xs text-orange-600 bg-orange-100 px-2 py-1 flex items-center gap-1 rounded font-medium">
                        <Clock className="w-3 h-3" /> Tempo Real
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 h-[330px]">
                <ScrollArea className="h-full">
                    {vendedorLogs.length === 0 ? (
                        <div className="p-8 text-center flex flex-col items-center justify-center text-gray-500">
                            <User className="w-8 h-8 opacity-20 mb-2" />
                            <p className="text-sm">Nenhuma ação recente registrada.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {vendedorLogs.map((log) => {
                                const parsedDate = new Date(log.created_at || log.timestamp);
                                const dataFormatada = format(parsedDate, "dd/MM 'às' HH:mm", { locale: ptBR });
                                const actionIcon = ACTION_ICONS[log.action] || ACTION_ICONS['DEFAULT'];

                                return (
                                    <div key={log.id} className="p-4 hover:bg-orange-50/30 transition-colors">
                                        <div className="flex justify-between items-start gap-3">
                                            <div className="mt-0.5 bg-white p-1.5 rounded-full border shadow-sm shrink-0">
                                                {actionIcon}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2 mb-1">
                                                    <p className="font-semibold text-sm text-gray-800 truncate">
                                                        {log.user_name || log.usuario}
                                                    </p>
                                                    <span className="text-xs text-gray-500 whitespace-nowrap">
                                                        {dataFormatada}
                                                    </span>
                                                </div>
                                                <div className="text-xs bg-gray-50 p-2 rounded text-gray-700 leading-relaxed border line-clamp-2">
                                                    {log.entity_description || log.detalhes?.description || "Ação sem descrição."}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
