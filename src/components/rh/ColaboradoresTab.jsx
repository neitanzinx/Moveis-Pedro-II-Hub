import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Users, Search, Plus, Edit, Trash2, Eye, UserCheck,
    UserX, Phone, Mail, Building, Calendar, DollarSign,
    Filter, Download, MoreVertical, FileText
} from "lucide-react";
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
    DropdownMenuTrigger,
    DropdownMenuSeparator,
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
import ColaboradorModal from "./ColaboradorModal";
import ColaboradorDetalhesModal from "./ColaboradorDetalhesModal";
import ContratacaoResumoModal from "./ContratacaoResumoModal";

const STATUS_OPTIONS = [
    { value: "todos", label: "Todos os Status" },
    { value: "Ativo", label: "Ativo" },
    { value: "Férias", label: "Férias" },
    { value: "Licença", label: "Licença" },
    { value: "Afastado", label: "Afastado" },
    { value: "Desligado", label: "Desligado" },
];

const SETOR_OPTIONS = [
    { value: "todos", label: "Todos os Setores" },
    { value: "Vendas", label: "Vendas" },
    { value: "Logística", label: "Logística" },
    { value: "Montagem", label: "Montagem" },
    { value: "Administrativo", label: "Administrativo" },
    { value: "Financeiro", label: "Financeiro" },
    { value: "RH", label: "RH" },
    { value: "Estoque", label: "Estoque" },
    { value: "Atendimento", label: "Atendimento" },
];

const CONTRATO_OPTIONS = [
    { value: "todos", label: "Todos os Contratos" },
    { value: "CLT", label: "CLT" },
    { value: "PJ", label: "PJ" },
    { value: "Estagiário", label: "Estagiário" },
    { value: "Temporário", label: "Temporário" },
];

export default function ColaboradoresTab() {
    const queryClient = useQueryClient();
    const [busca, setBusca] = useState("");
    const [filtroStatus, setFiltroStatus] = useState("todos");
    const [filtroSetor, setFiltroSetor] = useState("todos");
    const [filtroContrato, setFiltroContrato] = useState("todos");
    const [modalAberto, setModalAberto] = useState(false);
    const [modalDetalhes, setModalDetalhes] = useState(false);
    const [modalResumo, setModalResumo] = useState(false);
    const [colaboradorSelecionado, setColaboradorSelecionado] = useState(null);
    const [novoColaborador, setNovoColaborador] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null);

    const { data: colaboradores = [], isLoading } = useQuery({
        queryKey: ['colaboradores'],
        queryFn: () => base44.entities.Colaborador.list('-created_at'),
    });

    const { data: usuarios = [] } = useQuery({
        queryKey: ['usuarios'],
        queryFn: () => base44.entities.User.list(),
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.Colaborador.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries(['colaboradores']);
            setConfirmDelete(null);
        },
    });

    // Filter collaborators
    const colaboradoresFiltrados = colaboradores.filter(c => {
        const matchBusca = !busca ||
            c.nome_completo?.toLowerCase().includes(busca.toLowerCase()) ||
            c.cpf?.includes(busca) ||
            c.email?.toLowerCase().includes(busca.toLowerCase());
        const matchStatus = filtroStatus === "todos" || c.status === filtroStatus;
        const matchSetor = filtroSetor === "todos" || c.setor === filtroSetor;
        const matchContrato = filtroContrato === "todos" || c.tipo_contrato === filtroContrato;
        return matchBusca && matchStatus && matchSetor && matchContrato;
    });

    // Metrics
    const totalAtivos = colaboradores.filter(c => c.status === 'Ativo').length;
    const totalFerias = colaboradores.filter(c => c.status === 'Férias').length;
    const totalLicenca = colaboradores.filter(c => c.status === 'Licença').length;
    const totalDesligados = colaboradores.filter(c => c.status === 'Desligado').length;

    const abrirModal = (colaborador = null) => {
        setColaboradorSelecionado(colaborador);
        setModalAberto(true);
    };

    const abrirDetalhes = (colaborador) => {
        setColaboradorSelecionado(colaborador);
        setModalDetalhes(true);
    };

    const abrirResumo = (colaborador) => {
        setNovoColaborador(colaborador);
        setModalResumo(true);
    };

    const handleNovoColaboradorSuccess = (colaborador) => {
        setModalAberto(false);
        setColaboradorSelecionado(null);
        setNovoColaborador(colaborador);
        setModalResumo(true);
    };

    const getStatusBadgeStyle = (status) => {
        switch (status) {
            case 'Ativo':
                return { backgroundColor: '#D1FAE5', color: '#065F46' };
            case 'Férias':
                return { backgroundColor: '#DBEAFE', color: '#1E40AF' };
            case 'Licença':
                return { backgroundColor: '#FEF3C7', color: '#92400E' };
            case 'Afastado':
                return { backgroundColor: '#FED7AA', color: '#C2410C' };
            case 'Desligado':
                return { backgroundColor: '#FEE2E2', color: '#991B1B' };
            default:
                return { backgroundColor: '#E5E7EB', color: '#374151' };
        }
    };

    const exportarCSV = () => {
        let csv = "Nome,CPF,Cargo,Setor,Status,Tipo Contrato,Salário Base,Data Admissão,Telefone,Email\n";
        colaboradoresFiltrados.forEach(c => {
            csv += `"${c.nome_completo || ''}","${c.cpf || ''}","${c.cargo || ''}","${c.setor || ''}","${c.status || ''}","${c.tipo_contrato || ''}","${c.salario_base || ''}","${c.data_admissao || ''}","${c.telefone || ''}","${c.email || ''}"\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `colaboradores_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#07593f' }} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="border-0 shadow-lg">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-gray-500">Ativos</p>
                                <p className="text-2xl font-bold text-green-600">{totalAtivos}</p>
                            </div>
                            <UserCheck className="w-8 h-8 text-green-600 opacity-50" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-lg">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-gray-500">Em Férias</p>
                                <p className="text-2xl font-bold text-blue-600">{totalFerias}</p>
                            </div>
                            <Calendar className="w-8 h-8 text-blue-600 opacity-50" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-lg">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-gray-500">Em Licença</p>
                                <p className="text-2xl font-bold text-orange-600">{totalLicenca}</p>
                            </div>
                            <UserX className="w-8 h-8 text-orange-600 opacity-50" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-lg">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-gray-500">Total Geral</p>
                                <p className="text-2xl font-bold" style={{ color: '#07593f' }}>{colaboradores.length}</p>
                            </div>
                            <Users className="w-8 h-8 opacity-50" style={{ color: '#07593f' }} />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters and Actions */}
            <Card className="border-0 shadow-lg">
                <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <Input
                                placeholder="Buscar por nome, CPF ou email..."
                                value={busca}
                                onChange={(e) => setBusca(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                            <SelectTrigger className="w-full md:w-40">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {STATUS_OPTIONS.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={filtroSetor} onValueChange={setFiltroSetor}>
                            <SelectTrigger className="w-full md:w-40">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {SETOR_OPTIONS.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={filtroContrato} onValueChange={setFiltroContrato}>
                            <SelectTrigger className="w-full md:w-40">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {CONTRATO_OPTIONS.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button
                            onClick={exportarCSV}
                            variant="outline"
                            className="gap-2"
                        >
                            <Download className="w-4 h-4" />
                            Exportar
                        </Button>
                        <Button
                            onClick={() => abrirModal()}
                            className="gap-2"
                            style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
                        >
                            <Plus className="w-4 h-4" />
                            Novo Colaborador
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Collaborators List */}
            <Card className="border-0 shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5" style={{ color: '#07593f' }} />
                        Lista de Colaboradores ({colaboradoresFiltrados.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {colaboradoresFiltrados.length === 0 ? (
                        <div className="text-center py-12">
                            <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                            <p className="text-gray-500">Nenhum colaborador encontrado</p>
                            <Button
                                onClick={() => abrirModal()}
                                className="mt-4"
                                style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Cadastrar Primeiro Colaborador
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {colaboradoresFiltrados.map(colaborador => (
                                <div
                                    key={colaborador.id}
                                    className="flex items-center justify-between p-4 rounded-xl border hover:shadow-md transition-all"
                                    style={{ borderColor: '#E5E0D8' }}
                                >
                                    <div className="flex items-center gap-4">
                                        <div
                                            className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white"
                                            style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
                                        >
                                            {colaborador.nome_completo?.charAt(0).toUpperCase() || '?'}
                                        </div>
                                        <div>
                                            <p className="font-semibold" style={{ color: '#07593f' }}>
                                                {colaborador.nome_completo}
                                            </p>
                                            <div className="flex items-center gap-3 text-sm text-gray-500">
                                                <span className="flex items-center gap-1">
                                                    <Building className="w-3 h-3" />
                                                    {colaborador.cargo || 'Sem cargo'} • {colaborador.setor || 'Sem setor'}
                                                </span>
                                                {colaborador.tipo_contrato && (
                                                    <Badge variant="outline" className="text-xs">
                                                        {colaborador.tipo_contrato}
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                                                {colaborador.telefone && (
                                                    <span className="flex items-center gap-1">
                                                        <Phone className="w-3 h-3" />
                                                        {colaborador.telefone}
                                                    </span>
                                                )}
                                                {colaborador.email && (
                                                    <span className="flex items-center gap-1">
                                                        <Mail className="w-3 h-3" />
                                                        {colaborador.email}
                                                    </span>
                                                )}
                                                {colaborador.data_admissao && (
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="w-3 h-3" />
                                                        Desde {new Date(colaborador.data_admissao).toLocaleDateString('pt-BR')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {colaborador.salario_base && (
                                            <div className="text-right mr-4 hidden md:block">
                                                <p className="text-xs text-gray-500">Salário Base</p>
                                                <p className="font-semibold" style={{ color: '#07593f' }}>
                                                    R$ {Number(colaborador.salario_base).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </p>
                                            </div>
                                        )}
                                        <Badge style={getStatusBadgeStyle(colaborador.status)}>
                                            {colaborador.status || 'Indefinido'}
                                        </Badge>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon">
                                                    <MoreVertical className="w-4 h-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => abrirDetalhes(colaborador)}>
                                                    <Eye className="w-4 h-4 mr-2" />
                                                    Ver Detalhes
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => abrirResumo(colaborador)}>
                                                    <FileText className="w-4 h-4 mr-2" />
                                                    Ver Resumo Contratação
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => abrirModal(colaborador)}>
                                                    <Edit className="w-4 h-4 mr-2" />
                                                    Editar
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => setConfirmDelete(colaborador)}
                                                    className="text-red-600"
                                                >
                                                    <Trash2 className="w-4 h-4 mr-2" />
                                                    Excluir
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Modals */}
            {modalAberto && (
                <ColaboradorModal
                    colaborador={colaboradorSelecionado}
                    usuarios={usuarios}
                    onClose={() => {
                        setModalAberto(false);
                        setColaboradorSelecionado(null);
                    }}
                    onSuccess={!colaboradorSelecionado ? handleNovoColaboradorSuccess : undefined}
                />
            )}

            {modalDetalhes && colaboradorSelecionado && (
                <ColaboradorDetalhesModal
                    colaborador={colaboradorSelecionado}
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

            {/* Hiring Summary Modal */}
            {modalResumo && novoColaborador && (
                <ContratacaoResumoModal
                    colaborador={novoColaborador}
                    onClose={() => {
                        setModalResumo(false);
                        setNovoColaborador(null);
                    }}
                />
            )}

            {/* Delete Confirmation */}
            <AlertDialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir o colaborador <strong>{confirmDelete?.nome_completo}</strong>?
                            Esta ação não pode ser desfeita.
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
