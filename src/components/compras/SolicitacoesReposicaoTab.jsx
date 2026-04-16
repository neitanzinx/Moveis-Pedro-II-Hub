import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, MoreVertical, Package, CheckCircle, ShoppingCart, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

const STATUS_CONFIG = {
    Pendente:   { label: "Pendente",   color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
    "Em Compra":{ label: "Em Compra",  color: "bg-blue-100 text-blue-800 border-blue-200" },
    Resolvida:  { label: "Resolvida",  color: "bg-green-100 text-green-800 border-green-200" },
    Cancelada:  { label: "Cancelada",  color: "bg-red-100 text-red-800 border-red-200" },
};

/**
 * Tab de Solicitações de Reposição dentro da página de Compras.
 * Exibe todas as solicitações geradas por assistências técnicas concluídas.
 */
export default function SolicitacoesReposicaoTab() {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFiltro, setStatusFiltro] = useState("todos");

    const { data: solicitacoes = [], isLoading } = useQuery({
        queryKey: ["solicitacoes-reposicao"],
        queryFn: () => base44.entities.SolicitacaoReposicao.list("-created_at"),
        staleTime: 30000,
    });

    const atualizarStatusMutation = useMutation({
        mutationFn: ({ id, status }) =>
            base44.entities.SolicitacaoReposicao.update(id, { status }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["solicitacoes-reposicao"] });
            toast.success("Status atualizado!");
        },
        onError: () => toast.error("Erro ao atualizar status"),
    });

    const handleAtualizarStatus = (id, novoStatus) => {
        atualizarStatusMutation.mutate({ id, status: novoStatus });
    };

    const filtradas = solicitacoes.filter(s => {
        const matchSearch =
            s.produto_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.numero_assistencia?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.loja_nome?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchStatus = statusFiltro === "todos" || s.status === statusFiltro;
        return matchSearch && matchStatus;
    });

    const contadores = {
        Pendente: solicitacoes.filter(s => s.status === "Pendente").length,
        "Em Compra": solicitacoes.filter(s => s.status === "Em Compra").length,
        Resolvida: solicitacoes.filter(s => s.status === "Resolvida").length,
        Cancelada: solicitacoes.filter(s => s.status === "Cancelada").length,
    };

    return (
        <div className="space-y-4">
            {/* Cards de resumo */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="border-l-4 border-l-yellow-400">
                    <CardContent className="p-3">
                        <p className="text-2xl font-bold text-yellow-600">{contadores.Pendente}</p>
                        <p className="text-xs text-gray-500">Pendentes</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-blue-400">
                    <CardContent className="p-3">
                        <p className="text-2xl font-bold text-blue-600">{contadores["Em Compra"]}</p>
                        <p className="text-xs text-gray-500">Em Compra</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-green-400">
                    <CardContent className="p-3">
                        <p className="text-2xl font-bold text-green-600">{contadores.Resolvida}</p>
                        <p className="text-xs text-gray-500">Resolvidas</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-red-400">
                    <CardContent className="p-3">
                        <p className="text-2xl font-bold text-red-500">{contadores.Cancelada}</p>
                        <p className="text-xs text-gray-500">Canceladas</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Package className="w-4 h-4 text-orange-600" />
                        Solicitações de Reposição
                    </CardTitle>
                    <div className="flex flex-wrap gap-3 items-center mt-2">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                placeholder="Buscar por produto, assistência ou unidade..."
                                className="pl-9"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Select value={statusFiltro} onValueChange={setStatusFiltro}>
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos">Todos</SelectItem>
                                <SelectItem value="Pendente">Pendente</SelectItem>
                                <SelectItem value="Em Compra">Em Compra</SelectItem>
                                <SelectItem value="Resolvida">Resolvida</SelectItem>
                                <SelectItem value="Cancelada">Cancelada</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex justify-center items-center py-10">
                            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                        </div>
                    ) : filtradas.length === 0 ? (
                        <div className="text-center py-10 text-gray-500">
                            <Package className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                            <p className="text-sm">Nenhuma solicitação encontrada.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader className="bg-gray-50">
                                <TableRow>
                                    <TableHead>Produto</TableHead>
                                    <TableHead className="text-center">Qtd</TableHead>
                                    <TableHead>Unidade de Origem</TableHead>
                                    <TableHead>Assistência</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Data</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtradas.map(sol => {
                                    const statusCfg = STATUS_CONFIG[sol.status] || STATUS_CONFIG.Pendente;
                                    return (
                                        <TableRow key={sol.id}>
                                            <TableCell className="font-medium">{sol.produto_nome || "—"}</TableCell>
                                            <TableCell className="text-center font-mono font-semibold text-red-600">
                                                -{sol.quantidade}
                                            </TableCell>
                                            <TableCell className="text-sm text-gray-600">{sol.loja_nome || "—"}</TableCell>
                                            <TableCell className="text-sm">
                                                {sol.numero_assistencia ? `#${sol.numero_assistencia}` : "—"}
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={`${statusCfg.color} border text-[10px] uppercase tracking-wide px-2`}>
                                                    {statusCfg.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm text-gray-500">
                                                {sol.created_at
                                                    ? new Date(sol.created_at).toLocaleDateString("pt-BR")
                                                    : "—"}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {atualizarStatusMutation.isPending &&
                                                atualizarStatusMutation.variables?.id === sol.id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin ml-auto text-gray-400" />
                                                ) : (
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon">
                                                                <MoreVertical className="w-4 h-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            {sol.status !== "Em Compra" && (
                                                                <DropdownMenuItem
                                                                    onClick={() => handleAtualizarStatus(sol.id, "Em Compra")}
                                                                >
                                                                    <ShoppingCart className="w-4 h-4 mr-2 text-blue-600" />
                                                                    Marcar Em Compra
                                                                </DropdownMenuItem>
                                                            )}
                                                            {sol.status !== "Resolvida" && (
                                                                <DropdownMenuItem
                                                                    onClick={() => handleAtualizarStatus(sol.id, "Resolvida")}
                                                                >
                                                                    <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                                                                    Marcar Resolvida
                                                                </DropdownMenuItem>
                                                            )}
                                                            {sol.status !== "Cancelada" && (
                                                                <DropdownMenuItem
                                                                    onClick={() => handleAtualizarStatus(sol.id, "Cancelada")}
                                                                    className="text-red-600"
                                                                >
                                                                    <XCircle className="w-4 h-4 mr-2" />
                                                                    Cancelar
                                                                </DropdownMenuItem>
                                                            )}
                                                            {sol.status === "Cancelada" && (
                                                                <DropdownMenuItem
                                                                    onClick={() => handleAtualizarStatus(sol.id, "Pendente")}
                                                                >
                                                                    <Package className="w-4 h-4 mr-2 text-yellow-600" />
                                                                    Reabrir
                                                                </DropdownMenuItem>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
