import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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
import {
    Calendar, Plus, Check, X, Clock, Umbrella,
    FileText, Edit, Trash2, Filter, CalendarDays
} from "lucide-react";
import { toast } from "sonner";

const STATUS_FERIAS = ["Solicitada", "Aprovada", "Rejeitada", "Em Gozo", "Concluída", "Cancelada"];
const STATUS_LICENCA = ["Solicitada", "Aprovada", "Rejeitada", "Em Andamento", "Concluída"];
const TIPOS_LICENCA = ["Médica", "Maternidade", "Paternidade", "Casamento", "Falecimento", "Outros"];

export default function FeriasLicencasTab() {
    const queryClient = useQueryClient();
    const [modalFerias, setModalFerias] = useState(false);
    const [modalLicenca, setModalLicenca] = useState(false);
    const [itemSelecionado, setItemSelecionado] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [tipoDelete, setTipoDelete] = useState(null);
    const [filtroStatus, setFiltroStatus] = useState("todos");

    const { data: colaboradores = [] } = useQuery({
        queryKey: ['colaboradores'],
        queryFn: () => base44.entities.Colaborador.list(),
    });

    const { data: ferias = [], isLoading: loadingFerias } = useQuery({
        queryKey: ['ferias'],
        queryFn: () => base44.entities.Ferias.list('-data_inicio'),
    });

    const { data: licencas = [], isLoading: loadingLicencas } = useQuery({
        queryKey: ['licencas'],
        queryFn: () => base44.entities.Licenca.list('-data_inicio'),
    });

    const colaboradoresAtivos = colaboradores.filter(c => c.status !== 'Desligado');

    // Metrics
    const feriasProximas = ferias.filter(f => {
        if (f.status !== 'Aprovada') return false;
        const dataInicio = new Date(f.data_inicio);
        const hoje = new Date();
        const proximos30Dias = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000);
        return dataInicio >= hoje && dataInicio <= proximos30Dias;
    });

    const feriasEmGozo = ferias.filter(f => f.status === 'Em Gozo');
    const licencasAtivas = licencas.filter(l => l.status === 'Em Andamento');
    const pendentesAprovacao = [...ferias.filter(f => f.status === 'Solicitada'), ...licencas.filter(l => l.status === 'Solicitada')];

    const getStatusBadgeStyle = (status) => {
        switch (status) {
            case 'Aprovada':
            case 'Aprovado':
                return { backgroundColor: '#D1FAE5', color: '#065F46' };
            case 'Em Gozo':
            case 'Em Andamento':
                return { backgroundColor: '#DBEAFE', color: '#1E40AF' };
            case 'Solicitada':
            case 'Solicitado':
                return { backgroundColor: '#FEF3C7', color: '#92400E' };
            case 'Rejeitada':
            case 'Rejeitado':
                return { backgroundColor: '#FEE2E2', color: '#991B1B' };
            case 'Concluída':
            case 'Concluído':
                return { backgroundColor: '#E5E7EB', color: '#374151' };
            case 'Cancelada':
            case 'Cancelado':
                return { backgroundColor: '#FED7AA', color: '#C2410C' };
            default:
                return { backgroundColor: '#E5E7EB', color: '#374151' };
        }
    };

    return (
        <div className="space-y-6">
            {/* Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="border-0 shadow-lg">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-gray-500">Férias Próximas (30 dias)</p>
                                <p className="text-2xl font-bold text-blue-600">{feriasProximas.length}</p>
                            </div>
                            <CalendarDays className="w-8 h-8 text-blue-600 opacity-50" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-lg">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-gray-500">Em Gozo de Férias</p>
                                <p className="text-2xl font-bold" style={{ color: '#07593f' }}>{feriasEmGozo.length}</p>
                            </div>
                            <Umbrella className="w-8 h-8 opacity-50" style={{ color: '#07593f' }} />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-lg">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-gray-500">Licenças Ativas</p>
                                <p className="text-2xl font-bold text-orange-600">{licencasAtivas.length}</p>
                            </div>
                            <FileText className="w-8 h-8 text-orange-600 opacity-50" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-lg">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-gray-500">Aguardando Aprovação</p>
                                <p className="text-2xl font-bold text-amber-600">{pendentesAprovacao.length}</p>
                            </div>
                            <Clock className="w-8 h-8 text-amber-600 opacity-50" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
                <Button
                    onClick={() => { setItemSelecionado(null); setModalFerias(true); }}
                    style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Solicitação de Férias
                </Button>
                <Button
                    onClick={() => { setItemSelecionado(null); setModalLicenca(true); }}
                    variant="outline"
                    className="border-orange-300 text-orange-600 hover:bg-orange-50"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Licença
                </Button>
            </div>

            {/* Pending Approvals */}
            {pendentesAprovacao.length > 0 && (
                <Card className="border-0 shadow-lg border-l-4" style={{ borderLeftColor: '#f38a4c' }}>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-amber-700">
                            <Clock className="w-5 h-5" />
                            Aguardando Aprovação ({pendentesAprovacao.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {pendentesAprovacao.map((item, index) => {
                                const isFerias = 'quantidade_dias' in item && !('tipo' in item);
                                return (
                                    <PendingApprovalCard
                                        key={item.id}
                                        item={item}
                                        isFerias={isFerias}
                                        onApprove={() => {
                                            // Handle approval
                                            const entity = isFerias ? base44.entities.Ferias : base44.entities.Licenca;
                                            entity.update(item.id, { status: isFerias ? 'Aprovada' : 'Aprovada' })
                                                .then(() => {
                                                    queryClient.invalidateQueries(['ferias']);
                                                    queryClient.invalidateQueries(['licencas']);
                                                    toast.success(`${isFerias ? 'Férias' : 'Licença'} aprovada com sucesso!`);
                                                })
                                                .catch(err => toast.error("Erro ao aprovar: " + err.message));
                                        }}
                                        onReject={() => {
                                            const entity = isFerias ? base44.entities.Ferias : base44.entities.Licenca;
                                            entity.update(item.id, { status: 'Rejeitada' })
                                                .then(() => {
                                                    queryClient.invalidateQueries(['ferias']);
                                                    queryClient.invalidateQueries(['licencas']);
                                                    toast.success(`${isFerias ? 'Férias' : 'Licença'} rejeitada.`);
                                                })
                                                .catch(err => toast.error("Erro ao rejeitar: " + err.message));
                                        }}
                                    />
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Main Content */}
            <div className="grid md:grid-cols-2 gap-6">
                {/* Férias */}
                <Card className="border-0 shadow-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2" style={{ color: '#07593f' }}>
                            <Umbrella className="w-5 h-5" />
                            Férias
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loadingFerias ? (
                            <div className="flex justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#07593f' }} />
                            </div>
                        ) : ferias.length === 0 ? (
                            <p className="text-center py-8 text-gray-500">Nenhuma férias registrada</p>
                        ) : (
                            <div className="space-y-3 max-h-[500px] overflow-y-auto">
                                {ferias.slice(0, 20).map(f => (
                                    <div key={f.id} className="p-3 rounded-lg border" style={{ borderColor: '#E5E0D8' }}>
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <p className="font-semibold" style={{ color: '#07593f' }}>{f.colaborador_nome}</p>
                                                <p className="text-sm text-gray-500">
                                                    {f.data_inicio && new Date(f.data_inicio).toLocaleDateString('pt-BR')}
                                                    {f.data_fim && ` até ${new Date(f.data_fim).toLocaleDateString('pt-BR')}`}
                                                </p>
                                            </div>
                                            <Badge style={getStatusBadgeStyle(f.status)}>{f.status}</Badge>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <Badge variant="outline">{f.quantidade_dias || 0} dias</Badge>
                                            <div className="flex gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    onClick={() => { setItemSelecionado(f); setModalFerias(true); }}
                                                >
                                                    <Edit className="w-3 h-3" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-red-600"
                                                    onClick={() => { setConfirmDelete(f); setTipoDelete('ferias'); }}
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Licenças */}
                <Card className="border-0 shadow-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-orange-600">
                            <FileText className="w-5 h-5" />
                            Licenças
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loadingLicencas ? (
                            <div className="flex justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
                            </div>
                        ) : licencas.length === 0 ? (
                            <p className="text-center py-8 text-gray-500">Nenhuma licença registrada</p>
                        ) : (
                            <div className="space-y-3 max-h-[500px] overflow-y-auto">
                                {licencas.slice(0, 20).map(l => (
                                    <div key={l.id} className="p-3 rounded-lg border" style={{ borderColor: '#E5E0D8' }}>
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <p className="font-semibold text-orange-600">{l.colaborador_nome}</p>
                                                <p className="text-sm text-gray-500">{l.tipo}</p>
                                                <p className="text-xs text-gray-400">
                                                    {l.data_inicio && new Date(l.data_inicio).toLocaleDateString('pt-BR')}
                                                    {l.data_fim && ` até ${new Date(l.data_fim).toLocaleDateString('pt-BR')}`}
                                                </p>
                                            </div>
                                            <Badge style={getStatusBadgeStyle(l.status)}>{l.status}</Badge>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            {l.quantidade_dias && <Badge variant="outline">{l.quantidade_dias} dias</Badge>}
                                            <div className="flex gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    onClick={() => { setItemSelecionado(l); setModalLicenca(true); }}
                                                >
                                                    <Edit className="w-3 h-3" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-red-600"
                                                    onClick={() => { setConfirmDelete(l); setTipoDelete('licenca'); }}
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Modals */}
            {modalFerias && (
                <FeriasModal
                    ferias={itemSelecionado}
                    colaboradores={colaboradoresAtivos}
                    onClose={() => { setModalFerias(false); setItemSelecionado(null); }}
                />
            )}

            {modalLicenca && (
                <LicencaModal
                    licenca={itemSelecionado}
                    colaboradores={colaboradoresAtivos}
                    onClose={() => { setModalLicenca(false); setItemSelecionado(null); }}
                />
            )}

            {/* Delete Confirmation */}
            <AlertDialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir este registro de {tipoDelete === 'ferias' ? 'férias' : 'licença'}?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                const entity = tipoDelete === 'ferias' ? base44.entities.Ferias : base44.entities.Licenca;
                                entity.delete(confirmDelete.id)
                                    .then(() => {
                                        queryClient.invalidateQueries([tipoDelete === 'ferias' ? 'ferias' : 'licencas']);
                                        toast.success("Registro excluído com sucesso!");
                                        setConfirmDelete(null);
                                    })
                                    .catch(err => toast.error("Erro ao excluir: " + err.message));
                            }}
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

// Pending Approval Card Component
function PendingApprovalCard({ item, isFerias, onApprove, onReject }) {
    return (
        <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-200">
            <div>
                <p className="font-semibold" style={{ color: '#07593f' }}>{item.colaborador_nome}</p>
                <p className="text-sm text-gray-600">
                    {isFerias ? 'Férias' : `Licença: ${item.tipo}`} • {item.quantidade_dias || 0} dias
                </p>
                <p className="text-xs text-gray-500">
                    {item.data_inicio && new Date(item.data_inicio).toLocaleDateString('pt-BR')}
                    {item.data_fim && ` até ${new Date(item.data_fim).toLocaleDateString('pt-BR')}`}
                </p>
            </div>
            <div className="flex gap-2">
                <Button
                    size="sm"
                    onClick={onApprove}
                    className="bg-green-600 hover:bg-green-700"
                >
                    <Check className="w-4 h-4 mr-1" />
                    Aprovar
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={onReject}
                    className="border-red-300 text-red-600 hover:bg-red-50"
                >
                    <X className="w-4 h-4 mr-1" />
                    Rejeitar
                </Button>
            </div>
        </div>
    );
}

// Férias Modal Component
function FeriasModal({ ferias, colaboradores, onClose }) {
    const queryClient = useQueryClient();
    const isEditing = !!ferias;

    const [formData, setFormData] = useState({
        colaborador_id: ferias?.colaborador_id || "",
        colaborador_nome: ferias?.colaborador_nome || "",
        data_inicio: ferias?.data_inicio || "",
        data_fim: ferias?.data_fim || "",
        quantidade_dias: ferias?.quantidade_dias || 30,
        status: ferias?.status || "Solicitada",
        tipo: ferias?.tipo || "Normal",
        observacoes: ferias?.observacoes || "",
    });

    const [saving, setSaving] = useState(false);

    const handleColaboradorChange = (id) => {
        const colab = colaboradores.find(c => c.id === id);
        setFormData(prev => ({
            ...prev,
            colaborador_id: id,
            colaborador_nome: colab?.nome_completo || "",
        }));
    };

    const calcularDias = () => {
        if (formData.data_inicio && formData.data_fim) {
            const inicio = new Date(formData.data_inicio);
            const fim = new Date(formData.data_fim);
            const diff = Math.ceil((fim - inicio) / (1000 * 60 * 60 * 24)) + 1;
            setFormData(prev => ({ ...prev, quantidade_dias: diff > 0 ? diff : 0 }));
        }
    };

    const handleSubmit = async () => {
        if (!formData.colaborador_id || !formData.data_inicio) {
            toast.error("Colaborador e data de início são obrigatórios");
            return;
        }

        setSaving(true);
        try {
            if (isEditing) {
                await base44.entities.Ferias.update(ferias.id, formData);
                toast.success("Férias atualizada com sucesso!");
            } else {
                await base44.entities.Ferias.create(formData);
                toast.success("Férias registrada com sucesso!");
            }
            queryClient.invalidateQueries(['ferias']);
            onClose();
        } catch (error) {
            toast.error("Erro: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2" style={{ color: '#07593f' }}>
                        <Umbrella className="w-5 h-5" />
                        {isEditing ? "Editar Férias" : "Nova Solicitação de Férias"}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 mt-4">
                    <div>
                        <Label>Colaborador *</Label>
                        <Select value={formData.colaborador_id} onValueChange={handleColaboradorChange}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione o colaborador" />
                            </SelectTrigger>
                            <SelectContent>
                                {colaboradores.map(c => (
                                    <SelectItem key={c.id} value={c.id}>{c.nome_completo}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Data Início *</Label>
                            <Input
                                type="date"
                                value={formData.data_inicio}
                                onChange={(e) => setFormData(prev => ({ ...prev, data_inicio: e.target.value }))}
                                onBlur={calcularDias}
                            />
                        </div>
                        <div>
                            <Label>Data Fim</Label>
                            <Input
                                type="date"
                                value={formData.data_fim}
                                onChange={(e) => setFormData(prev => ({ ...prev, data_fim: e.target.value }))}
                                onBlur={calcularDias}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Quantidade de Dias</Label>
                            <Input
                                type="number"
                                value={formData.quantidade_dias}
                                onChange={(e) => setFormData(prev => ({ ...prev, quantidade_dias: Number(e.target.value) }))}
                            />
                        </div>
                        <div>
                            <Label>Status</Label>
                            <Select value={formData.status} onValueChange={(v) => setFormData(prev => ({ ...prev, status: v }))}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {STATUS_FERIAS.map(s => (
                                        <SelectItem key={s} value={s}>{s}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div>
                        <Label>Observações</Label>
                        <Textarea
                            value={formData.observacoes}
                            onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                            placeholder="Observações adicionais..."
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={saving}
                        style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
                    >
                        {saving ? "Salvando..." : isEditing ? "Salvar Alterações" : "Registrar Férias"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// Licença Modal Component
function LicencaModal({ licenca, colaboradores, onClose }) {
    const queryClient = useQueryClient();
    const isEditing = !!licenca;

    const [formData, setFormData] = useState({
        colaborador_id: licenca?.colaborador_id || "",
        colaborador_nome: licenca?.colaborador_nome || "",
        tipo: licenca?.tipo || "Médica",
        data_inicio: licenca?.data_inicio || "",
        data_fim: licenca?.data_fim || "",
        quantidade_dias: licenca?.quantidade_dias || 0,
        status: licenca?.status || "Solicitada",
        motivo: licenca?.motivo || "",
    });

    const [saving, setSaving] = useState(false);

    const handleColaboradorChange = (id) => {
        const colab = colaboradores.find(c => c.id === id);
        setFormData(prev => ({
            ...prev,
            colaborador_id: id,
            colaborador_nome: colab?.nome_completo || "",
        }));
    };

    const calcularDias = () => {
        if (formData.data_inicio && formData.data_fim) {
            const inicio = new Date(formData.data_inicio);
            const fim = new Date(formData.data_fim);
            const diff = Math.ceil((fim - inicio) / (1000 * 60 * 60 * 24)) + 1;
            setFormData(prev => ({ ...prev, quantidade_dias: diff > 0 ? diff : 0 }));
        }
    };

    const handleSubmit = async () => {
        if (!formData.colaborador_id || !formData.tipo || !formData.data_inicio) {
            toast.error("Colaborador, tipo e data de início são obrigatórios");
            return;
        }

        setSaving(true);
        try {
            if (isEditing) {
                await base44.entities.Licenca.update(licenca.id, formData);
                toast.success("Licença atualizada com sucesso!");
            } else {
                await base44.entities.Licenca.create(formData);
                toast.success("Licença registrada com sucesso!");
            }
            queryClient.invalidateQueries(['licencas']);
            onClose();
        } catch (error) {
            toast.error("Erro: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-orange-600">
                        <FileText className="w-5 h-5" />
                        {isEditing ? "Editar Licença" : "Nova Licença"}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 mt-4">
                    <div>
                        <Label>Colaborador *</Label>
                        <Select value={formData.colaborador_id} onValueChange={handleColaboradorChange}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione o colaborador" />
                            </SelectTrigger>
                            <SelectContent>
                                {colaboradores.map(c => (
                                    <SelectItem key={c.id} value={c.id}>{c.nome_completo}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label>Tipo de Licença *</Label>
                        <Select value={formData.tipo} onValueChange={(v) => setFormData(prev => ({ ...prev, tipo: v }))}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {TIPOS_LICENCA.map(t => (
                                    <SelectItem key={t} value={t}>{t}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Data Início *</Label>
                            <Input
                                type="date"
                                value={formData.data_inicio}
                                onChange={(e) => setFormData(prev => ({ ...prev, data_inicio: e.target.value }))}
                                onBlur={calcularDias}
                            />
                        </div>
                        <div>
                            <Label>Data Fim</Label>
                            <Input
                                type="date"
                                value={formData.data_fim}
                                onChange={(e) => setFormData(prev => ({ ...prev, data_fim: e.target.value }))}
                                onBlur={calcularDias}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Quantidade de Dias</Label>
                            <Input
                                type="number"
                                value={formData.quantidade_dias}
                                onChange={(e) => setFormData(prev => ({ ...prev, quantidade_dias: Number(e.target.value) }))}
                            />
                        </div>
                        <div>
                            <Label>Status</Label>
                            <Select value={formData.status} onValueChange={(v) => setFormData(prev => ({ ...prev, status: v }))}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {STATUS_LICENCA.map(s => (
                                        <SelectItem key={s} value={s}>{s}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div>
                        <Label>Motivo / Observações</Label>
                        <Textarea
                            value={formData.motivo}
                            onChange={(e) => setFormData(prev => ({ ...prev, motivo: e.target.value }))}
                            placeholder="Descreva o motivo da licença..."
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={saving}
                        className="bg-orange-600 hover:bg-orange-700"
                    >
                        {saving ? "Salvando..." : isEditing ? "Salvar Alterações" : "Registrar Licença"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
