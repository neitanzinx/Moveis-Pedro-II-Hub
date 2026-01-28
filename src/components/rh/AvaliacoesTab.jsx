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
import { Slider } from "@/components/ui/slider";
import {
    Award, Plus, Star, TrendingUp, Users, Eye,
    Edit, Calendar, Target, MessageSquare
} from "lucide-react";
import { toast } from "sonner";

const TIPOS_AVALIACAO = ["90 Dias", "Anual", "360°", "Promocional", "Feedback"];
const STATUS_AVALIACAO = ["Rascunho", "Concluída", "Revisão"];

const COMPETENCIAS_PADRAO = [
    { nome: "Produtividade", peso: 1 },
    { nome: "Qualidade do Trabalho", peso: 1 },
    { nome: "Trabalho em Equipe", peso: 1 },
    { nome: "Comunicação", peso: 1 },
    { nome: "Iniciativa", peso: 1 },
    { nome: "Pontualidade", peso: 1 },
    { nome: "Comprometimento", peso: 1 },
    { nome: "Conhecimento Técnico", peso: 1 },
];

export default function AvaliacoesTab() {
    const queryClient = useQueryClient();
    const [modalNova, setModalNova] = useState(false);
    const [modalDetalhes, setModalDetalhes] = useState(false);
    const [avaliacaoSelecionada, setAvaliacaoSelecionada] = useState(null);
    const [filtroColaborador, setFiltroColaborador] = useState("todos");

    const { data: colaboradores = [] } = useQuery({
        queryKey: ['colaboradores'],
        queryFn: () => base44.entities.Colaborador.list(),
    });

    const { data: avaliacoes = [], isLoading } = useQuery({
        queryKey: ['avaliacoes_desempenho'],
        queryFn: () => base44.entities.AvaliacaoDesempenho.list('-created_at'),
    });

    const colaboradoresAtivos = colaboradores.filter(c => c.status !== 'Desligado');

    // Metrics
    const avaliacoesConcluidas = avaliacoes.filter(a => a.status === 'Concluída');
    const mediaGeral = avaliacoesConcluidas.length > 0
        ? avaliacoesConcluidas.reduce((sum, a) => sum + (Number(a.pontuacao_media) || 0), 0) / avaliacoesConcluidas.length
        : 0;
    const avaliacoesRecentes = avaliacoes.filter(a => {
        const data = new Date(a.data_avaliacao);
        const hoje = new Date();
        const diff = (hoje - data) / (1000 * 60 * 60 * 24);
        return diff <= 30;
    });

    const avaliacoesFiltradas = avaliacoes.filter(a =>
        filtroColaborador === "todos" || a.colaborador_id === filtroColaborador
    );

    const getStatusBadgeStyle = (status) => {
        switch (status) {
            case 'Concluída':
                return { backgroundColor: '#D1FAE5', color: '#065F46' };
            case 'Rascunho':
                return { backgroundColor: '#FEF3C7', color: '#92400E' };
            case 'Revisão':
                return { backgroundColor: '#DBEAFE', color: '#1E40AF' };
            default:
                return { backgroundColor: '#E5E7EB', color: '#374151' };
        }
    };

    const getNotaColor = (nota) => {
        if (nota >= 4) return '#065F46';
        if (nota >= 3) return '#1E40AF';
        if (nota >= 2) return '#92400E';
        return '#991B1B';
    };

    return (
        <div className="space-y-6">
            {/* Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="border-0 shadow-lg">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-gray-500">Total de Avaliações</p>
                                <p className="text-2xl font-bold" style={{ color: '#07593f' }}>{avaliacoes.length}</p>
                            </div>
                            <Award className="w-8 h-8 opacity-50" style={{ color: '#07593f' }} />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-lg">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-gray-500">Média Geral</p>
                                <p className="text-2xl font-bold text-blue-600">{mediaGeral.toFixed(1)}/5</p>
                            </div>
                            <Star className="w-8 h-8 text-blue-600 opacity-50" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-lg">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-gray-500">Últimos 30 dias</p>
                                <p className="text-2xl font-bold text-orange-600">{avaliacoesRecentes.length}</p>
                            </div>
                            <Calendar className="w-8 h-8 text-orange-600 opacity-50" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-lg">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-gray-500">Concluídas</p>
                                <p className="text-2xl font-bold text-green-600">{avaliacoesConcluidas.length}</p>
                            </div>
                            <TrendingUp className="w-8 h-8 text-green-600 opacity-50" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Actions */}
            <Card className="border-0 shadow-lg">
                <CardContent className="p-4">
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="flex-1 min-w-[200px]">
                            <Label>Filtrar por Colaborador</Label>
                            <Select value={filtroColaborador} onValueChange={setFiltroColaborador}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todos">Todos os Colaboradores</SelectItem>
                                    {colaboradoresAtivos.map(c => (
                                        <SelectItem key={c.id} value={c.id}>{c.nome_completo}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button
                            onClick={() => { setAvaliacaoSelecionada(null); setModalNova(true); }}
                            style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Nova Avaliação
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Evaluations List */}
            <Card className="border-0 shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2" style={{ color: '#07593f' }}>
                        <Award className="w-5 h-5" />
                        Avaliações de Desempenho
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#07593f' }} />
                        </div>
                    ) : avaliacoesFiltradas.length === 0 ? (
                        <div className="text-center py-12">
                            <Award className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                            <p className="text-gray-500 mb-4">Nenhuma avaliação encontrada</p>
                            <Button
                                onClick={() => setModalNova(true)}
                                style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Criar Primeira Avaliação
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {avaliacoesFiltradas.map(avaliacao => (
                                <div
                                    key={avaliacao.id}
                                    className="p-4 rounded-xl border hover:shadow-md transition-all cursor-pointer"
                                    style={{ borderColor: '#E5E0D8' }}
                                    onClick={() => { setAvaliacaoSelecionada(avaliacao); setModalDetalhes(true); }}
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="font-semibold text-lg" style={{ color: '#07593f' }}>
                                                {avaliacao.colaborador_nome}
                                            </p>
                                            <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                                                <Badge variant="outline">{avaliacao.tipo}</Badge>
                                                <span>•</span>
                                                <span>{avaliacao.data_avaliacao && new Date(avaliacao.data_avaliacao).toLocaleDateString('pt-BR')}</span>
                                                {avaliacao.avaliador_nome && (
                                                    <>
                                                        <span>•</span>
                                                        <span>por {avaliacao.avaliador_nome}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {avaliacao.pontuacao_media && (
                                                <div className="text-center">
                                                    <p className="text-2xl font-bold" style={{ color: getNotaColor(avaliacao.pontuacao_media) }}>
                                                        {Number(avaliacao.pontuacao_media).toFixed(1)}
                                                    </p>
                                                    <p className="text-xs text-gray-500">de 5</p>
                                                </div>
                                            )}
                                            <Badge style={getStatusBadgeStyle(avaliacao.status)}>
                                                {avaliacao.status}
                                            </Badge>
                                        </div>
                                    </div>

                                    {/* Star Rating Display */}
                                    {avaliacao.pontuacao_media && (
                                        <div className="flex items-center gap-1 mt-3">
                                            {[1, 2, 3, 4, 5].map(star => (
                                                <Star
                                                    key={star}
                                                    className={`w-5 h-5 ${star <= Math.round(avaliacao.pontuacao_media) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Modals */}
            {modalNova && (
                <AvaliacaoFormModal
                    avaliacao={avaliacaoSelecionada}
                    colaboradores={colaboradoresAtivos}
                    onClose={() => { setModalNova(false); setAvaliacaoSelecionada(null); }}
                />
            )}

            {modalDetalhes && avaliacaoSelecionada && (
                <AvaliacaoDetalhesModal
                    avaliacao={avaliacaoSelecionada}
                    onClose={() => { setModalDetalhes(false); setAvaliacaoSelecionada(null); }}
                    onEdit={() => {
                        setModalDetalhes(false);
                        setModalNova(true);
                    }}
                />
            )}
        </div>
    );
}

// Evaluation Form Modal
function AvaliacaoFormModal({ avaliacao, colaboradores, onClose }) {
    const queryClient = useQueryClient();
    const isEditing = !!avaliacao;

    const [formData, setFormData] = useState({
        colaborador_id: avaliacao?.colaborador_id || "",
        colaborador_nome: avaliacao?.colaborador_nome || "",
        tipo: avaliacao?.tipo || "Anual",
        data_avaliacao: avaliacao?.data_avaliacao || new Date().toISOString().slice(0, 10),
        status: avaliacao?.status || "Rascunho",
        pontos_fortes: avaliacao?.pontos_fortes || "",
        pontos_melhorar: avaliacao?.pontos_melhorar || "",
        metas_definidas: avaliacao?.metas_definidas || "",
        comentarios_gerais: avaliacao?.comentarios_gerais || "",
    });

    const [competencias, setCompetencias] = useState(() => {
        if (avaliacao?.competencias) {
            return typeof avaliacao.competencias === 'string'
                ? JSON.parse(avaliacao.competencias)
                : avaliacao.competencias;
        }
        return COMPETENCIAS_PADRAO.map(c => ({ ...c, nota: 3 }));
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

    const handleNotaChange = (index, nota) => {
        setCompetencias(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], nota };
            return updated;
        });
    };

    const calcularMedia = () => {
        const totalPeso = competencias.reduce((sum, c) => sum + (c.peso || 1), 0);
        const totalNota = competencias.reduce((sum, c) => sum + ((c.nota || 0) * (c.peso || 1)), 0);
        return totalPeso > 0 ? totalNota / totalPeso : 0;
    };

    const handleSubmit = async () => {
        if (!formData.colaborador_id) {
            toast.error("Selecione um colaborador");
            return;
        }

        setSaving(true);
        try {
            const dataToSave = {
                ...formData,
                competencias: JSON.stringify(competencias),
                pontuacao_media: calcularMedia(),
            };

            if (isEditing) {
                await base44.entities.AvaliacaoDesempenho.update(avaliacao.id, dataToSave);
                toast.success("Avaliação atualizada!");
            } else {
                await base44.entities.AvaliacaoDesempenho.create(dataToSave);
                toast.success("Avaliação criada!");
            }
            queryClient.invalidateQueries(['avaliacoes_desempenho']);
            onClose();
        } catch (error) {
            toast.error("Erro: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    const media = calcularMedia();

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2" style={{ color: '#07593f' }}>
                        <Award className="w-5 h-5" />
                        {isEditing ? "Editar Avaliação" : "Nova Avaliação de Desempenho"}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 mt-4">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
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
                            <Label>Tipo de Avaliação</Label>
                            <Select value={formData.tipo} onValueChange={(v) => setFormData(prev => ({ ...prev, tipo: v }))}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {TIPOS_AVALIACAO.map(t => (
                                        <SelectItem key={t} value={t}>{t}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Data da Avaliação</Label>
                            <Input
                                type="date"
                                value={formData.data_avaliacao}
                                onChange={(e) => setFormData(prev => ({ ...prev, data_avaliacao: e.target.value }))}
                            />
                        </div>
                    </div>

                    {/* Competencies */}
                    <div>
                        <Label className="mb-3 block">Avaliação por Competências</Label>
                        <div className="space-y-4 p-4 rounded-lg border" style={{ borderColor: '#E5E0D8' }}>
                            {competencias.map((comp, index) => (
                                <div key={index} className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium">{comp.nome}</span>
                                        <span className="text-lg font-bold" style={{ color: '#07593f' }}>{comp.nota}/5</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {[1, 2, 3, 4, 5].map(nota => (
                                            <button
                                                key={nota}
                                                type="button"
                                                onClick={() => handleNotaChange(index, nota)}
                                                className="p-1"
                                            >
                                                <Star
                                                    className={`w-6 h-6 transition-colors ${nota <= comp.nota ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 hover:text-yellow-300'}`}
                                                />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Average Display */}
                        <div className="mt-4 p-4 rounded-lg text-center" style={{ backgroundColor: '#f0f9ff' }}>
                            <p className="text-sm text-gray-600">Média Geral</p>
                            <p className="text-3xl font-bold" style={{ color: '#07593f' }}>{media.toFixed(1)}/5</p>
                            <div className="flex justify-center gap-1 mt-2">
                                {[1, 2, 3, 4, 5].map(star => (
                                    <Star
                                        key={star}
                                        className={`w-6 h-6 ${star <= Math.round(media) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Comments */}
                    <div className="space-y-4">
                        <div>
                            <Label className="flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-green-600" />
                                Pontos Fortes
                            </Label>
                            <Textarea
                                value={formData.pontos_fortes}
                                onChange={(e) => setFormData(prev => ({ ...prev, pontos_fortes: e.target.value }))}
                                placeholder="Destaque os pontos positivos do colaborador..."
                                rows={2}
                            />
                        </div>
                        <div>
                            <Label className="flex items-center gap-2">
                                <Target className="w-4 h-4 text-orange-600" />
                                Pontos a Melhorar
                            </Label>
                            <Textarea
                                value={formData.pontos_melhorar}
                                onChange={(e) => setFormData(prev => ({ ...prev, pontos_melhorar: e.target.value }))}
                                placeholder="Identifique áreas de melhoria..."
                                rows={2}
                            />
                        </div>
                        <div>
                            <Label className="flex items-center gap-2">
                                <Target className="w-4 h-4 text-blue-600" />
                                Metas para o Próximo Período
                            </Label>
                            <Textarea
                                value={formData.metas_definidas}
                                onChange={(e) => setFormData(prev => ({ ...prev, metas_definidas: e.target.value }))}
                                placeholder="Defina metas claras e mensuráveis..."
                                rows={2}
                            />
                        </div>
                        <div>
                            <Label className="flex items-center gap-2">
                                <MessageSquare className="w-4 h-4 text-gray-600" />
                                Comentários Gerais
                            </Label>
                            <Textarea
                                value={formData.comentarios_gerais}
                                onChange={(e) => setFormData(prev => ({ ...prev, comentarios_gerais: e.target.value }))}
                                placeholder="Observações adicionais..."
                                rows={2}
                            />
                        </div>
                    </div>

                    {/* Status */}
                    <div>
                        <Label>Status da Avaliação</Label>
                        <Select value={formData.status} onValueChange={(v) => setFormData(prev => ({ ...prev, status: v }))}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {STATUS_AVALIACAO.map(s => (
                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={saving}
                        style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
                    >
                        {saving ? "Salvando..." : isEditing ? "Salvar Alterações" : "Criar Avaliação"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// Evaluation Details Modal
function AvaliacaoDetalhesModal({ avaliacao, onClose, onEdit }) {
    const competencias = avaliacao.competencias
        ? (typeof avaliacao.competencias === 'string' ? JSON.parse(avaliacao.competencias) : avaliacao.competencias)
        : [];

    const getNotaColor = (nota) => {
        if (nota >= 4) return '#065F46';
        if (nota >= 3) return '#1E40AF';
        if (nota >= 2) return '#92400E';
        return '#991B1B';
    };

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2" style={{ color: '#07593f' }}>
                        <Award className="w-5 h-5" />
                        Detalhes da Avaliação
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 mt-4">
                    {/* Header */}
                    <div className="p-4 rounded-lg" style={{ backgroundColor: '#f0f9ff' }}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-bold text-xl" style={{ color: '#07593f' }}>{avaliacao.colaborador_nome}</p>
                                <p className="text-sm text-gray-500">
                                    {avaliacao.tipo} • {avaliacao.data_avaliacao && new Date(avaliacao.data_avaliacao).toLocaleDateString('pt-BR')}
                                </p>
                            </div>
                            <div className="text-center">
                                <p className="text-3xl font-bold" style={{ color: getNotaColor(avaliacao.pontuacao_media) }}>
                                    {Number(avaliacao.pontuacao_media || 0).toFixed(1)}
                                </p>
                                <p className="text-sm text-gray-500">de 5</p>
                            </div>
                        </div>
                    </div>

                    {/* Competencies */}
                    {competencias.length > 0 && (
                        <div>
                            <Label className="mb-3 block">Competências Avaliadas</Label>
                            <div className="space-y-3">
                                {competencias.map((comp, index) => (
                                    <div key={index} className="flex items-center justify-between p-3 rounded-lg border" style={{ borderColor: '#E5E0D8' }}>
                                        <span className="font-medium">{comp.nome}</span>
                                        <div className="flex items-center gap-2">
                                            <div className="flex gap-0.5">
                                                {[1, 2, 3, 4, 5].map(star => (
                                                    <Star
                                                        key={star}
                                                        className={`w-4 h-4 ${star <= comp.nota ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                                                    />
                                                ))}
                                            </div>
                                            <span className="font-bold ml-2" style={{ color: getNotaColor(comp.nota) }}>
                                                {comp.nota}/5
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Comments */}
                    {avaliacao.pontos_fortes && (
                        <div>
                            <Label className="flex items-center gap-2 mb-2">
                                <TrendingUp className="w-4 h-4 text-green-600" />
                                Pontos Fortes
                            </Label>
                            <p className="p-3 rounded-lg bg-green-50 text-green-800">{avaliacao.pontos_fortes}</p>
                        </div>
                    )}

                    {avaliacao.pontos_melhorar && (
                        <div>
                            <Label className="flex items-center gap-2 mb-2">
                                <Target className="w-4 h-4 text-orange-600" />
                                Pontos a Melhorar
                            </Label>
                            <p className="p-3 rounded-lg bg-orange-50 text-orange-800">{avaliacao.pontos_melhorar}</p>
                        </div>
                    )}

                    {avaliacao.metas_definidas && (
                        <div>
                            <Label className="flex items-center gap-2 mb-2">
                                <Target className="w-4 h-4 text-blue-600" />
                                Metas Definidas
                            </Label>
                            <p className="p-3 rounded-lg bg-blue-50 text-blue-800">{avaliacao.metas_definidas}</p>
                        </div>
                    )}

                    {avaliacao.comentarios_gerais && (
                        <div>
                            <Label className="flex items-center gap-2 mb-2">
                                <MessageSquare className="w-4 h-4 text-gray-600" />
                                Comentários Gerais
                            </Label>
                            <p className="p-3 rounded-lg border text-gray-700" style={{ borderColor: '#E5E0D8' }}>
                                {avaliacao.comentarios_gerais}
                            </p>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <Button variant="outline" onClick={onClose}>Fechar</Button>
                    <Button
                        onClick={onEdit}
                        style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
                    >
                        <Edit className="w-4 h-4 mr-2" />
                        Editar Avaliação
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
