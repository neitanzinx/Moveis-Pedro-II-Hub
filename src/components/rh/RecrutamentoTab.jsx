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
    Briefcase, Plus, Users, UserPlus, Search, Edit,
    Trash2, Eye, ChevronRight, GripVertical, FileText,
    Phone, Mail, Calendar, DollarSign
} from "lucide-react";
import { toast } from "sonner";

const STATUS_VAGA = ["Aberta", "Em Processo", "Fechada", "Cancelada"];
const ETAPAS_CANDIDATO = ["Triagem", "Entrevista RH", "Entrevista Gestor", "Teste Prático", "Proposta", "Contratado", "Rejeitado"];
const STATUS_CANDIDATO = ["Em Análise", "Aprovado", "Rejeitado", "Desistiu"];

export default function RecrutamentoTab() {
    const queryClient = useQueryClient();
    const [modalVaga, setModalVaga] = useState(false);
    const [modalCandidato, setModalCandidato] = useState(false);
    const [vagaSelecionada, setVagaSelecionada] = useState(null);
    const [candidatoSelecionado, setCandidatoSelecionado] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [tipoDelete, setTipoDelete] = useState(null);
    const [busca, setBusca] = useState("");

    const { data: vagas = [], isLoading: loadingVagas } = useQuery({
        queryKey: ['vagas'],
        queryFn: () => base44.entities.Vaga.list('-created_at'),
    });

    const { data: candidatos = [], isLoading: loadingCandidatos } = useQuery({
        queryKey: ['candidatos'],
        queryFn: () => base44.entities.Candidato.list('-created_at'),
    });

    // Metrics
    const vagasAbertas = vagas.filter(v => v.status === 'Aberta');
    const totalVagas = vagasAbertas.reduce((sum, v) => sum + (v.quantidade_vagas || 1), 0);
    const candidatosEmProcesso = candidatos.filter(c => c.status === 'Em Análise');
    const candidatosContratados = candidatos.filter(c => c.etapa_atual === 'Contratado');

    const getStatusBadgeStyle = (status) => {
        switch (status) {
            case 'Aberta':
                return { backgroundColor: '#D1FAE5', color: '#065F46' };
            case 'Em Processo':
                return { backgroundColor: '#DBEAFE', color: '#1E40AF' };
            case 'Fechada':
                return { backgroundColor: '#E5E7EB', color: '#374151' };
            case 'Cancelada':
                return { backgroundColor: '#FEE2E2', color: '#991B1B' };
            default:
                return { backgroundColor: '#E5E7EB', color: '#374151' };
        }
    };

    const getEtapaBadgeStyle = (etapa) => {
        switch (etapa) {
            case 'Triagem':
                return { backgroundColor: '#E5E7EB', color: '#374151' };
            case 'Entrevista RH':
                return { backgroundColor: '#DBEAFE', color: '#1E40AF' };
            case 'Entrevista Gestor':
                return { backgroundColor: '#E0E7FF', color: '#3730A3' };
            case 'Teste Prático':
                return { backgroundColor: '#FEF3C7', color: '#92400E' };
            case 'Proposta':
                return { backgroundColor: '#FED7AA', color: '#C2410C' };
            case 'Contratado':
                return { backgroundColor: '#D1FAE5', color: '#065F46' };
            case 'Rejeitado':
                return { backgroundColor: '#FEE2E2', color: '#991B1B' };
            default:
                return { backgroundColor: '#E5E7EB', color: '#374151' };
        }
    };

    const candidatosFiltrados = candidatos.filter(c =>
        !busca ||
        c.nome_completo?.toLowerCase().includes(busca.toLowerCase()) ||
        c.vaga_titulo?.toLowerCase().includes(busca.toLowerCase())
    );

    const avancarEtapa = async (candidato) => {
        const currentIndex = ETAPAS_CANDIDATO.indexOf(candidato.etapa_atual);
        if (currentIndex < ETAPAS_CANDIDATO.length - 2) { // -2 to skip "Contratado" and "Rejeitado"
            const novaEtapa = ETAPAS_CANDIDATO[currentIndex + 1];
            try {
                await base44.entities.Candidato.update(candidato.id, { etapa_atual: novaEtapa });
                queryClient.invalidateQueries(['candidatos']);
                toast.success(`Candidato avançou para: ${novaEtapa}`);
            } catch (error) {
                toast.error("Erro ao avançar etapa: " + error.message);
            }
        }
    };

    const handleDelete = async () => {
        try {
            if (tipoDelete === 'vaga') {
                await base44.entities.Vaga.delete(confirmDelete.id);
                queryClient.invalidateQueries(['vagas']);
            } else {
                await base44.entities.Candidato.delete(confirmDelete.id);
                queryClient.invalidateQueries(['candidatos']);
            }
            toast.success("Registro excluído com sucesso!");
            setConfirmDelete(null);
        } catch (error) {
            toast.error("Erro ao excluir: " + error.message);
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
                                <p className="text-xs text-gray-500">Vagas Abertas</p>
                                <p className="text-2xl font-bold" style={{ color: '#07593f' }}>{vagasAbertas.length}</p>
                            </div>
                            <Briefcase className="w-8 h-8 opacity-50" style={{ color: '#07593f' }} />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-lg">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-gray-500">Posições Disponíveis</p>
                                <p className="text-2xl font-bold text-blue-600">{totalVagas}</p>
                            </div>
                            <Users className="w-8 h-8 text-blue-600 opacity-50" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-lg">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-gray-500">Em Processo Seletivo</p>
                                <p className="text-2xl font-bold text-orange-600">{candidatosEmProcesso.length}</p>
                            </div>
                            <UserPlus className="w-8 h-8 text-orange-600 opacity-50" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-lg">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-gray-500">Contratados (Total)</p>
                                <p className="text-2xl font-bold text-green-600">{candidatosContratados.length}</p>
                            </div>
                            <Users className="w-8 h-8 text-green-600 opacity-50" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
                <Button
                    onClick={() => { setVagaSelecionada(null); setModalVaga(true); }}
                    style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Vaga
                </Button>
                <Button
                    onClick={() => { setCandidatoSelecionado(null); setModalCandidato(true); }}
                    variant="outline"
                >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Novo Candidato
                </Button>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                {/* Vagas */}
                <Card className="border-0 shadow-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2" style={{ color: '#07593f' }}>
                            <Briefcase className="w-5 h-5" />
                            Vagas ({vagas.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loadingVagas ? (
                            <div className="flex justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#07593f' }} />
                            </div>
                        ) : vagas.length === 0 ? (
                            <div className="text-center py-8">
                                <Briefcase className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                <p className="text-gray-500">Nenhuma vaga cadastrada</p>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[500px] overflow-y-auto">
                                {vagas.map(vaga => (
                                    <div key={vaga.id} className="p-4 rounded-xl border hover:shadow-md transition-all" style={{ borderColor: '#E5E0D8' }}>
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <p className="font-semibold" style={{ color: '#07593f' }}>{vaga.titulo}</p>
                                                <p className="text-sm text-gray-500">{vaga.cargo} • {vaga.setor}</p>
                                            </div>
                                            <Badge style={getStatusBadgeStyle(vaga.status)}>{vaga.status}</Badge>
                                        </div>
                                        <div className="flex items-center justify-between mt-3">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline">{vaga.quantidade_vagas || 1} vaga(s)</Badge>
                                                {vaga.salario_min && vaga.salario_max && (
                                                    <span className="text-xs text-gray-500">
                                                        R$ {Number(vaga.salario_min).toLocaleString()} - R$ {Number(vaga.salario_max).toLocaleString()}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    onClick={() => { setVagaSelecionada(vaga); setModalVaga(true); }}
                                                >
                                                    <Edit className="w-3 h-3" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-red-600"
                                                    onClick={() => { setConfirmDelete(vaga); setTipoDelete('vaga'); }}
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        </div>
                                        {vaga.data_abertura && (
                                            <p className="text-xs text-gray-400 mt-2">
                                                Aberta em {new Date(vaga.data_abertura).toLocaleDateString('pt-BR')}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Candidatos */}
                <Card className="border-0 shadow-lg">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2" style={{ color: '#07593f' }}>
                                <Users className="w-5 h-5" />
                                Candidatos ({candidatos.length})
                            </CardTitle>
                        </div>
                        <div className="relative mt-2">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <Input
                                placeholder="Buscar candidatos..."
                                value={busca}
                                onChange={(e) => setBusca(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                    </CardHeader>
                    <CardContent>
                        {loadingCandidatos ? (
                            <div className="flex justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#07593f' }} />
                            </div>
                        ) : candidatosFiltrados.length === 0 ? (
                            <div className="text-center py-8">
                                <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                <p className="text-gray-500">Nenhum candidato encontrado</p>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[500px] overflow-y-auto">
                                {candidatosFiltrados.map(candidato => (
                                    <div key={candidato.id} className="p-4 rounded-xl border hover:shadow-md transition-all" style={{ borderColor: '#E5E0D8' }}>
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <p className="font-semibold" style={{ color: '#07593f' }}>{candidato.nome_completo}</p>
                                                <p className="text-sm text-gray-500">{candidato.vaga_titulo || 'Vaga não especificada'}</p>
                                                <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                                                    {candidato.telefone && (
                                                        <span className="flex items-center gap-1">
                                                            <Phone className="w-3 h-3" />
                                                            {candidato.telefone}
                                                        </span>
                                                    )}
                                                    {candidato.email && (
                                                        <span className="flex items-center gap-1">
                                                            <Mail className="w-3 h-3" />
                                                            {candidato.email}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <Badge style={getEtapaBadgeStyle(candidato.etapa_atual)}>
                                                {candidato.etapa_atual || 'Triagem'}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center justify-between mt-3">
                                            {candidato.etapa_atual !== 'Contratado' && candidato.etapa_atual !== 'Rejeitado' && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => avancarEtapa(candidato)}
                                                    className="text-xs"
                                                >
                                                    Avançar Etapa
                                                    <ChevronRight className="w-3 h-3 ml-1" />
                                                </Button>
                                            )}
                                            <div className="flex gap-1 ml-auto">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    onClick={() => { setCandidatoSelecionado(candidato); setModalCandidato(true); }}
                                                >
                                                    <Edit className="w-3 h-3" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-red-600"
                                                    onClick={() => { setConfirmDelete(candidato); setTipoDelete('candidato'); }}
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
            {modalVaga && (
                <VagaModal
                    vaga={vagaSelecionada}
                    onClose={() => { setModalVaga(false); setVagaSelecionada(null); }}
                />
            )}

            {modalCandidato && (
                <CandidatoModal
                    candidato={candidatoSelecionado}
                    vagas={vagasAbertas}
                    onClose={() => { setModalCandidato(false); setCandidatoSelecionado(null); }}
                />
            )}

            {/* Delete Confirmation */}
            <AlertDialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir {tipoDelete === 'vaga' ? 'esta vaga' : 'este candidato'}?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                            Excluir
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

// Vaga Modal
function VagaModal({ vaga, onClose }) {
    const queryClient = useQueryClient();
    const isEditing = !!vaga;

    const [formData, setFormData] = useState({
        titulo: vaga?.titulo || "",
        cargo: vaga?.cargo || "",
        setor: vaga?.setor || "",
        quantidade_vagas: vaga?.quantidade_vagas || 1,
        status: vaga?.status || "Aberta",
        descricao: vaga?.descricao || "",
        requisitos: vaga?.requisitos || "",
        beneficios: vaga?.beneficios || "",
        salario_min: vaga?.salario_min || "",
        salario_max: vaga?.salario_max || "",
        tipo_contrato: vaga?.tipo_contrato || "CLT",
        data_abertura: vaga?.data_abertura || new Date().toISOString().slice(0, 10),
    });

    const [saving, setSaving] = useState(false);

    const handleSubmit = async () => {
        if (!formData.titulo || !formData.cargo) {
            toast.error("Título e cargo são obrigatórios");
            return;
        }

        setSaving(true);
        try {
            const dataToSave = {
                ...formData,
                quantidade_vagas: Number(formData.quantidade_vagas),
                salario_min: formData.salario_min ? Number(formData.salario_min) : null,
                salario_max: formData.salario_max ? Number(formData.salario_max) : null,
            };

            if (isEditing) {
                await base44.entities.Vaga.update(vaga.id, dataToSave);
                toast.success("Vaga atualizada com sucesso!");
            } else {
                await base44.entities.Vaga.create(dataToSave);
                toast.success("Vaga criada com sucesso!");
            }
            queryClient.invalidateQueries(['vagas']);
            onClose();
        } catch (error) {
            toast.error("Erro: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2" style={{ color: '#07593f' }}>
                        <Briefcase className="w-5 h-5" />
                        {isEditing ? "Editar Vaga" : "Nova Vaga"}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <Label>Título da Vaga *</Label>
                            <Input
                                value={formData.titulo}
                                onChange={(e) => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
                                placeholder="Ex: Vendedor Interno"
                            />
                        </div>
                        <div>
                            <Label>Cargo *</Label>
                            <Input
                                value={formData.cargo}
                                onChange={(e) => setFormData(prev => ({ ...prev, cargo: e.target.value }))}
                                placeholder="Ex: Vendedor"
                            />
                        </div>
                        <div>
                            <Label>Setor</Label>
                            <Input
                                value={formData.setor}
                                onChange={(e) => setFormData(prev => ({ ...prev, setor: e.target.value }))}
                                placeholder="Ex: Vendas"
                            />
                        </div>
                        <div>
                            <Label>Quantidade de Vagas</Label>
                            <Input
                                type="number"
                                value={formData.quantidade_vagas}
                                onChange={(e) => setFormData(prev => ({ ...prev, quantidade_vagas: e.target.value }))}
                            />
                        </div>
                        <div>
                            <Label>Status</Label>
                            <Select value={formData.status} onValueChange={(v) => setFormData(prev => ({ ...prev, status: v }))}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {STATUS_VAGA.map(s => (
                                        <SelectItem key={s} value={s}>{s}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Salário Mínimo</Label>
                            <Input
                                type="number"
                                value={formData.salario_min}
                                onChange={(e) => setFormData(prev => ({ ...prev, salario_min: e.target.value }))}
                                placeholder="0,00"
                            />
                        </div>
                        <div>
                            <Label>Salário Máximo</Label>
                            <Input
                                type="number"
                                value={formData.salario_max}
                                onChange={(e) => setFormData(prev => ({ ...prev, salario_max: e.target.value }))}
                                placeholder="0,00"
                            />
                        </div>
                    </div>

                    <div>
                        <Label>Descrição da Vaga</Label>
                        <Textarea
                            value={formData.descricao}
                            onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                            placeholder="Descreva as responsabilidades e atividades..."
                            rows={3}
                        />
                    </div>

                    <div>
                        <Label>Requisitos</Label>
                        <Textarea
                            value={formData.requisitos}
                            onChange={(e) => setFormData(prev => ({ ...prev, requisitos: e.target.value }))}
                            placeholder="Liste os requisitos necessários..."
                            rows={3}
                        />
                    </div>

                    <div>
                        <Label>Benefícios</Label>
                        <Textarea
                            value={formData.beneficios}
                            onChange={(e) => setFormData(prev => ({ ...prev, beneficios: e.target.value }))}
                            placeholder="Liste os benefícios oferecidos..."
                            rows={2}
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
                        {saving ? "Salvando..." : isEditing ? "Salvar Alterações" : "Criar Vaga"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// Candidato Modal
function CandidatoModal({ candidato, vagas, onClose }) {
    const queryClient = useQueryClient();
    const isEditing = !!candidato;

    const [formData, setFormData] = useState({
        nome_completo: candidato?.nome_completo || "",
        email: candidato?.email || "",
        telefone: candidato?.telefone || "",
        vaga_id: candidato?.vaga_id || "",
        vaga_titulo: candidato?.vaga_titulo || "",
        etapa_atual: candidato?.etapa_atual || "Triagem",
        status: candidato?.status || "Em Análise",
        fonte: candidato?.fonte || "",
        curriculo_url: candidato?.curriculo_url || "",
        comentarios: candidato?.comentarios || "",
    });

    const [saving, setSaving] = useState(false);

    const handleVagaChange = (id) => {
        const vaga = vagas.find(v => v.id === id);
        setFormData(prev => ({
            ...prev,
            vaga_id: id,
            vaga_titulo: vaga?.titulo || "",
        }));
    };

    const handleSubmit = async () => {
        if (!formData.nome_completo) {
            toast.error("Nome é obrigatório");
            return;
        }

        setSaving(true);
        try {
            if (isEditing) {
                await base44.entities.Candidato.update(candidato.id, formData);
                toast.success("Candidato atualizado com sucesso!");
            } else {
                await base44.entities.Candidato.create(formData);
                toast.success("Candidato cadastrado com sucesso!");
            }
            queryClient.invalidateQueries(['candidatos']);
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
                        <UserPlus className="w-5 h-5" />
                        {isEditing ? "Editar Candidato" : "Novo Candidato"}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 mt-4">
                    <div>
                        <Label>Nome Completo *</Label>
                        <Input
                            value={formData.nome_completo}
                            onChange={(e) => setFormData(prev => ({ ...prev, nome_completo: e.target.value }))}
                            placeholder="Nome do candidato"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Email</Label>
                            <Input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                placeholder="email@exemplo.com"
                            />
                        </div>
                        <div>
                            <Label>Telefone</Label>
                            <Input
                                value={formData.telefone}
                                onChange={(e) => setFormData(prev => ({ ...prev, telefone: e.target.value }))}
                                placeholder="(00) 00000-0000"
                            />
                        </div>
                    </div>

                    <div>
                        <Label>Vaga</Label>
                        <Select value={formData.vaga_id || "none"} onValueChange={(v) => handleVagaChange(v === "none" ? "" : v)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione a vaga" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Nenhuma vaga específica</SelectItem>
                                {vagas.map(v => (
                                    <SelectItem key={v.id} value={v.id}>{v.titulo}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Etapa Atual</Label>
                            <Select value={formData.etapa_atual} onValueChange={(v) => setFormData(prev => ({ ...prev, etapa_atual: v }))}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {ETAPAS_CANDIDATO.map(e => (
                                        <SelectItem key={e} value={e}>{e}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Status</Label>
                            <Select value={formData.status} onValueChange={(v) => setFormData(prev => ({ ...prev, status: v }))}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {STATUS_CANDIDATO.map(s => (
                                        <SelectItem key={s} value={s}>{s}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div>
                        <Label>Fonte (onde encontrou o candidato)</Label>
                        <Input
                            value={formData.fonte}
                            onChange={(e) => setFormData(prev => ({ ...prev, fonte: e.target.value }))}
                            placeholder="Ex: LinkedIn, Indicação, Site..."
                        />
                    </div>

                    <div>
                        <Label>Link do Currículo</Label>
                        <Input
                            value={formData.curriculo_url}
                            onChange={(e) => setFormData(prev => ({ ...prev, curriculo_url: e.target.value }))}
                            placeholder="URL do currículo"
                        />
                    </div>

                    <div>
                        <Label>Comentários / Observações</Label>
                        <Textarea
                            value={formData.comentarios}
                            onChange={(e) => setFormData(prev => ({ ...prev, comentarios: e.target.value }))}
                            placeholder="Anotações sobre o candidato..."
                            rows={3}
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
                        {saving ? "Salvando..." : isEditing ? "Salvar Alterações" : "Cadastrar Candidato"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
