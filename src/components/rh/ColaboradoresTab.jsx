import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    Users,
    Search,
    Plus,
    Edit,
    Trash2,
    Eye,
    UserCheck,
    UserX,
    Calendar,
    Download,
    MoreVertical,
    FileText,
    Shield,
    ExternalLink,
    KeyRound,
    Building,
} from "lucide-react";
import { formatarNome } from "@/utils/formatters";
import ColaboradorModal from "./ColaboradorModal";
import ColaboradorDetalhesModal from "./ColaboradorDetalhesModal";
import ContratacaoResumoModal from "./ContratacaoResumoModal";

const STATUS_OPTIONS = [
    { value: "todos", label: "Todos" },
    { value: "Ativo", label: "Ativo" },
    { value: "Férias", label: "Férias" },
    { value: "Licença", label: "Licença" },
    { value: "Afastado", label: "Afastado" },
    { value: "Desligado", label: "Desligado" },
];

const CONTRATO_OPTIONS = [
    { value: "todos", label: "Todos" },
    { value: "CLT", label: "CLT" },
    { value: "PJ", label: "PJ" },
    { value: "Estagiário", label: "Estagiário" },
    { value: "Temporário", label: "Temporário" },
];

const STAT_CARDS = [
    {
        key: "Ativo",
        label: "Ativos",
        icon: UserCheck,
        bg: "#D1FAE5",
        fg: "#065F46",
        activeFg: "#fff",
        activeBg: "#065F46",
        border: "#6EE7B7",
    },
    {
        key: "Férias",
        label: "Em Férias",
        icon: Calendar,
        bg: "#DBEAFE",
        fg: "#1E40AF",
        activeFg: "#fff",
        activeBg: "#1E40AF",
        border: "#93C5FD",
    },
    {
        key: "Licença",
        label: "Em Licença",
        icon: UserX,
        bg: "#FEF3C7",
        fg: "#92400E",
        activeFg: "#fff",
        activeBg: "#92400E",
        border: "#FCD34D",
    },
    {
        key: "total",
        label: "Total",
        icon: Users,
        bg: "#F0FDF4",
        fg: "#07593f",
        activeFg: "#fff",
        activeBg: "#07593f",
        border: "#86EFAC",
    },
];

function getStatusStyle(status) {
    const map = {
        Ativo: { bg: "#D1FAE5", color: "#065F46" },
        Férias: { bg: "#DBEAFE", color: "#1E40AF" },
        Licença: { bg: "#FEF3C7", color: "#92400E" },
        Afastado: { bg: "#FED7AA", color: "#C2410C" },
        Desligado: { bg: "#FEE2E2", color: "#991B1B" },
    };
    return map[status] || { bg: "#E5E7EB", color: "#374151" };
}

function getAvatarGradient(status) {
    const map = {
        Ativo: "linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)",
        Férias: "linear-gradient(135deg, #1E40AF 0%, #2563EB 100%)",
        Licença: "linear-gradient(135deg, #92400E 0%, #B45309 100%)",
        Afastado: "linear-gradient(135deg, #C2410C 0%, #EA580C 100%)",
        Desligado: "linear-gradient(135deg, #6B7280 0%, #9CA3AF 100%)",
    };
    return map[status] || "linear-gradient(135deg, #6B7280 0%, #9CA3AF 100%)";
}

export default function ColaboradoresTab() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { can } = useAuth();
    const canManageRH = can("manage_rh");
    const canManageAccess = can("manage_user_access");

    const [busca, setBusca] = useState("");
    const [filtroStatus, setFiltroStatus] = useState("todos");
    const [filtroContrato, setFiltroContrato] = useState("todos");
    const [modalAberto, setModalAberto] = useState(false);
    const [modalDetalhes, setModalDetalhes] = useState(false);
    const [modalResumo, setModalResumo] = useState(false);
    const [colaboradorSelecionado, setColaboradorSelecionado] = useState(null);
    const [novoColaborador, setNovoColaborador] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [initialTab, setInitialTab] = useState("pessoal");

    const { data: colaboradores = [], isLoading } = useQuery({
        queryKey: ["colaboradores"],
        queryFn: () => base44.entities.Colaborador.list("-created_at"),
    });

    const { data: usuarios = [] } = useQuery({
        queryKey: ["usuarios"],
        queryFn: () => base44.entities.User.list(),
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.Colaborador.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries(["colaboradores"]);
            setConfirmDelete(null);
        },
    });

    const usuariosById = useMemo(
        () => new Map(usuarios.map((u) => [u.id, u])),
        [usuarios]
    );

    const colaboradoresEnriquecidos = useMemo(
        () =>
            colaboradores.map((c) => {
                const usuarioVinculado = c.user_id ? usuariosById.get(c.user_id) : null;
                return { ...c, matricula: usuarioVinculado?.matricula || null };
            }),
        [colaboradores, usuariosById]
    );

    const contasAguardandoVinculo = useMemo(
        () =>
            usuarios.filter((u) => {
                const isEmployee = u.cargo && u.matricula?.startsWith("MP-");
                const isNotLinked = !colaboradores.some((c) => c.user_id === u.id);
                return isEmployee && isNotLinked;
            }).length,
        [usuarios, colaboradores]
    );

    const colaboradoresFiltrados = useMemo(
        () =>
            colaboradoresEnriquecidos.filter((c) => {
                const termo = busca.toLowerCase();
                const matchBusca =
                    !busca ||
                    c.nome_completo?.toLowerCase().includes(termo) ||
                    c.cpf?.includes(busca) ||
                    c.email?.toLowerCase().includes(termo) ||
                    c.matricula?.toLowerCase().includes(termo);
                const matchStatus = filtroStatus === "todos" || c.status === filtroStatus;
                const matchContrato =
                    filtroContrato === "todos" || c.tipo_contrato === filtroContrato;
                return matchBusca && matchStatus && matchContrato;
            }),
        [colaboradoresEnriquecidos, busca, filtroStatus, filtroContrato]
    );

    const counts = useMemo(
        () => ({
            Ativo: colaboradoresEnriquecidos.filter((c) => c.status === "Ativo").length,
            Férias: colaboradoresEnriquecidos.filter((c) => c.status === "Férias").length,
            Licença: colaboradoresEnriquecidos.filter((c) => c.status === "Licença").length,
            total: colaboradoresEnriquecidos.length,
        }),
        [colaboradoresEnriquecidos]
    );

    const abrirModal = (colaborador = null, tab = "pessoal") => {
        setColaboradorSelecionado(colaborador);
        setInitialTab(tab);
        setModalAberto(true);
    };

    const abrirDetalhes = (colaborador) => {
        setColaboradorSelecionado(colaborador);
        setModalDetalhes(true);
    };

    const handleNovoColaboradorSuccess = (colaborador) => {
        setModalAberto(false);
        setColaboradorSelecionado(null);
        setNovoColaborador(colaborador);
        setModalResumo(true);
    };

    const handleStatClick = (key) => {
        if (key === "total") {
            setFiltroStatus("todos");
        } else {
            setFiltroStatus((prev) => (prev === key ? "todos" : key));
        }
    };

    const exportarCSV = () => {
        let csv =
            "Nome,Matrícula,CPF,Cargo,Status,Tipo Contrato,Salário Base,Data Admissão,Telefone,Email\n";
        colaboradoresFiltrados.forEach((c) => {
            csv += `"${c.nome_completo || ""}","${c.matricula || ""}","${c.cpf || ""}","${c.descricao_cargo || ""}","${c.status || ""}","${c.tipo_contrato || ""}","${c.salario_base || ""}","${c.data_admissao || ""}","${c.telefone || ""}","${c.email || ""}"\n`;
        });
        const blob = new Blob([csv], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `colaboradores_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16">
                <div
                    className="animate-spin rounded-full h-8 w-8 border-b-2"
                    style={{ borderColor: "#07593f" }}
                />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Stat cards — also act as filter shortcuts */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {STAT_CARDS.map(({ key, label, icon: Icon, bg, fg, activeBg, border }) => {
                    const count = counts[key] ?? 0;
                    const isActive = filtroStatus === key || (key === "total" && filtroStatus === "todos" && busca === "");
                    return (
                        <button
                            key={key}
                            onClick={() => handleStatClick(key)}
                            className="rounded-xl p-4 flex items-center justify-between transition-all hover:scale-[1.02] active:scale-[0.99] text-left focus:outline-none focus-visible:ring-2"
                            style={{
                                backgroundColor: isActive ? activeBg : bg,
                                border: `2px solid ${isActive ? activeBg : border}`,
                                color: isActive ? "#fff" : fg,
                            }}
                        >
                            <div>
                                <p className="text-xs font-medium opacity-80">{label}</p>
                                <p className="text-2xl font-bold mt-0.5">{count}</p>
                            </div>
                            <Icon className="w-8 h-8 opacity-30" />
                        </button>
                    );
                })}
            </div>

            {/* Unlinked accounts alert */}
            {contasAguardandoVinculo > 0 && (
                <Alert className="bg-blue-50 border-blue-200">
                    <KeyRound className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800 flex items-center justify-between gap-4 w-full">
                        <span>
                            <strong>{contasAguardandoVinculo}</strong> conta
                            {contasAguardandoVinculo > 1 ? "s" : ""} de acesso sem vínculo com
                            colaborador de RH.
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            className="border-blue-300 text-blue-800 shrink-0"
                            disabled={!canManageAccess}
                            onClick={() => navigate("/admin/GerenciamentoUsuarios")}
                        >
                            <ExternalLink className="w-4 h-4 mr-1.5" />
                            {canManageAccess ? "Gerenciar" : "Somente Admin"}
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            {/* Filter + action bar */}
            <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <Input
                        placeholder="Buscar por nome, matrícula, CPF ou email..."
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                    <SelectTrigger className="w-full sm:w-36">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {STATUS_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={filtroContrato} onValueChange={setFiltroContrato}>
                    <SelectTrigger className="w-full sm:w-36">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {CONTRATO_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <div className="flex gap-2">
                    <Button
                        onClick={exportarCSV}
                        variant="outline"
                        size="icon"
                        title="Exportar CSV"
                    >
                        <Download className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        title={canManageAccess ? "Gerenciar Contas de Acesso" : "Apenas administrador pode vincular acesso"}
                        disabled={!canManageAccess}
                        onClick={() => navigate("/admin/GerenciamentoUsuarios")}
                    >
                        <Shield className="w-4 h-4" />
                    </Button>
                    {canManageRH && (
                        <Button
                            onClick={() => abrirModal()}
                            className="gap-2 whitespace-nowrap"
                            style={{
                                background: "linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)",
                            }}
                        >
                            <Plus className="w-4 h-4" />
                            Novo Colaborador
                        </Button>
                    )}
                </div>
            </div>

            {/* Collaborator table */}
            <div
                className="rounded-xl border overflow-hidden bg-white"
                style={{ borderColor: "#E5E0D8" }}
            >
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr
                                className="border-b text-xs text-gray-500 uppercase tracking-wide"
                                style={{ backgroundColor: "#F9F6F2", borderColor: "#E5E0D8" }}
                            >
                                <th className="text-left px-4 py-3 font-semibold">Colaborador</th>
                                <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">
                                    Cargo
                                </th>
                                <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">
                                    Contrato
                                </th>
                                <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">
                                    Admissão
                                </th>
                                <th className="text-left px-4 py-3 font-semibold hidden xl:table-cell">
                                    Matrícula
                                </th>
                                <th className="text-center px-4 py-3 font-semibold">Status</th>
                                <th className="text-right px-4 py-3 font-semibold">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {colaboradoresFiltrados.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-14">
                                        <Users className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                                        <p className="text-gray-400 mb-3">
                                            Nenhum colaborador encontrado
                                        </p>
                                        {canManageRH && (
                                            <Button
                                                onClick={() => abrirModal()}
                                                size="sm"
                                                style={{
                                                    background:
                                                        "linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)",
                                                }}
                                            >
                                                <Plus className="w-4 h-4 mr-2" />
                                                Cadastrar Colaborador
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                colaboradoresFiltrados.map((colaborador) => {
                                    const statusStyle = getStatusStyle(colaborador.status);
                                    const admissao = colaborador.data_admissao
                                        ? new Date(
                                              colaborador.data_admissao + "T00:00:00"
                                          ).toLocaleDateString("pt-BR")
                                        : null;
                                    return (
                                        <tr
                                            key={colaborador.id}
                                            className="border-b last:border-0 hover:bg-gray-50/70 transition-colors"
                                            style={{ borderColor: "#F0EBE3" }}
                                        >
                                            {/* Colaborador name + email */}
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                                                        style={{
                                                            background: getAvatarGradient(
                                                                colaborador.status
                                                            ),
                                                        }}
                                                    >
                                                        {colaborador.nome_completo
                                                            ?.charAt(0)
                                                            .toUpperCase() || "?"}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p
                                                            className="font-semibold truncate"
                                                            style={{ color: "#07593f" }}
                                                        >
                                                            {formatarNome(colaborador.nome_completo) ||
                                                                "Sem nome"}
                                                        </p>
                                                        {colaborador.email && (
                                                            <p className="text-xs text-gray-400 truncate hidden sm:block">
                                                                {colaborador.email}
                                                            </p>
                                                        )}
                                                        {/* On mobile, show cargo below name */}
                                                        <p className="text-xs text-gray-500 md:hidden mt-0.5">
                                                            {colaborador.descricao_cargo || "Sem cargo"}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Cargo */}
                                            <td className="px-4 py-3 hidden md:table-cell">
                                                <span className="flex items-center gap-1.5 text-gray-700">
                                                    <Building className="w-3 h-3 text-gray-400 shrink-0" />
                                                    {colaborador.descricao_cargo || (
                                                        <span className="text-gray-300 italic">
                                                            Sem cargo
                                                        </span>
                                                    )}
                                                </span>
                                            </td>

                                            {/* Contrato */}
                                            <td className="px-4 py-3 hidden lg:table-cell">
                                                {colaborador.tipo_contrato ? (
                                                    <Badge
                                                        variant="outline"
                                                        className="text-xs font-normal"
                                                    >
                                                        {colaborador.tipo_contrato}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-gray-300">—</span>
                                                )}
                                            </td>

                                            {/* Admissão */}
                                            <td className="px-4 py-3 hidden lg:table-cell text-gray-600">
                                                {admissao || (
                                                    <span className="text-gray-300">—</span>
                                                )}
                                            </td>

                                            {/* Matrícula */}
                                            <td className="px-4 py-3 hidden xl:table-cell">
                                                {colaborador.matricula ? (
                                                    <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono text-gray-700">
                                                        {colaborador.matricula}
                                                    </code>
                                                ) : (
                                                    <span className="text-gray-300">—</span>
                                                )}
                                            </td>

                                            {/* Status badge */}
                                            <td className="px-4 py-3 text-center">
                                                <Badge
                                                    className="text-xs"
                                                    style={{
                                                        backgroundColor: statusStyle.bg,
                                                        color: statusStyle.color,
                                                        border: "none",
                                                    }}
                                                >
                                                    {colaborador.status || "Indefinido"}
                                                </Badge>
                                            </td>

                                            {/* Actions */}
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-gray-500 hover:text-gray-800"
                                                        title="Ver detalhes"
                                                        onClick={() =>
                                                            abrirDetalhes(colaborador)
                                                        }
                                                    >
                                                        <Eye className="w-3.5 h-3.5" />
                                                    </Button>
                                                    {canManageRH && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-gray-500 hover:text-gray-800"
                                                            title="Editar"
                                                            onClick={() =>
                                                                abrirModal(colaborador)
                                                            }
                                                        >
                                                            <Edit className="w-3.5 h-3.5" />
                                                        </Button>
                                                    )}
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-gray-500 hover:text-gray-800"
                                                            >
                                                                <MoreVertical className="w-3.5 h-3.5" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem
                                                                onClick={() => {
                                                                    setNovoColaborador(
                                                                        colaborador
                                                                    );
                                                                    setModalResumo(true);
                                                                }}
                                                            >
                                                                <FileText className="w-4 h-4 mr-2" />
                                                                Resumo de Contratação
                                                            </DropdownMenuItem>
                                                            {canManageRH && (
                                                                <>
                                                                    <DropdownMenuSeparator />
                                                                    <DropdownMenuItem
                                                                        onClick={() =>
                                                                            abrirModal(
                                                                                colaborador,
                                                                                "profissional"
                                                                            )
                                                                        }
                                                                    >
                                                                        <Shield className="w-4 h-4 mr-2" />
                                                                        Alterar Cargo
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem
                                                                        className="text-red-600 focus:text-red-600"
                                                                        onClick={() =>
                                                                            setConfirmDelete(
                                                                                colaborador
                                                                            )
                                                                        }
                                                                    >
                                                                        <Trash2 className="w-4 h-4 mr-2" />
                                                                        Excluir
                                                                    </DropdownMenuItem>
                                                                </>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Table footer */}
                {colaboradoresFiltrados.length > 0 && (
                    <div
                        className="px-4 py-2 border-t text-xs text-gray-400 flex items-center justify-between"
                        style={{
                            borderColor: "#E5E0D8",
                            backgroundColor: "#F9F6F2",
                        }}
                    >
                        <span>
                            {colaboradoresFiltrados.length} de{" "}
                            {colaboradoresEnriquecidos.length} colaboradores
                        </span>
                        {(filtroStatus !== "todos" || filtroContrato !== "todos" || busca) && (
                            <button
                                className="text-blue-600 hover:underline"
                                onClick={() => {
                                    setFiltroStatus("todos");
                                    setFiltroContrato("todos");
                                    setBusca("");
                                }}
                            >
                                Limpar filtros
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Modals */}
            {modalAberto && (
                <ColaboradorModal
                    colaborador={colaboradorSelecionado}
                    usuarios={usuarios}
                    initialTab={initialTab}
                    onClose={() => {
                        setModalAberto(false);
                        setColaboradorSelecionado(null);
                    }}
                    onSuccess={
                        !colaboradorSelecionado ? handleNovoColaboradorSuccess : undefined
                    }
                />
            )}

            {modalDetalhes && colaboradorSelecionado && (
                <ColaboradorDetalhesModal
                    colaborador={colaboradorSelecionado}
                    canEdit={canManageRH}
                    onClose={() => {
                        setModalDetalhes(false);
                        setColaboradorSelecionado(null);
                    }}
                    onEdit={() => {
                        setModalDetalhes(false);
                        abrirModal(colaboradorSelecionado);
                    }}
                />
            )}

            {modalResumo && novoColaborador && (
                <ContratacaoResumoModal
                    colaborador={novoColaborador}
                    onClose={() => {
                        setModalResumo(false);
                        setNovoColaborador(null);
                    }}
                />
            )}

            <AlertDialog
                open={!!confirmDelete}
                onOpenChange={() => setConfirmDelete(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir{" "}
                            <strong>{confirmDelete?.nome_completo}</strong>? Esta ação não
                            pode ser desfeita.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => deleteMutation.mutate(confirmDelete.id)}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            Excluir
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
