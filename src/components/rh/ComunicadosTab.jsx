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
    FileText, Plus, Edit, Trash2, Eye, Megaphone,
    Calendar, User, AlertTriangle, Info, Bell
} from "lucide-react";
import { toast } from "sonner";

const TIPOS_COMUNICADO = ["Informativo", "Urgente", "Aviso", "Evento", "Política", "Treinamento"];
const PRIORIDADES = ["Alta", "Média", "Baixa"];

export default function ComunicadosTab() {
    const queryClient = useQueryClient();
    const [modalAberto, setModalAberto] = useState(false);
    const [comunicadoSelecionado, setComunicadoSelecionado] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [filtroTipo, setFiltroTipo] = useState("todos");

    const { data: comunicados = [], isLoading } = useQuery({
        queryKey: ['comunicados_rh'],
        queryFn: () => base44.entities.ComunicadoRH.list('-created_at'),
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.ComunicadoRH.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries(['comunicados_rh']);
            toast.success("Comunicado excluído!");
            setConfirmDelete(null);
        },
    });

    // Metrics
    const comunicadosPublicados = comunicados.filter(c => c.publicado);
    const comunicadosUrgentes = comunicados.filter(c => c.prioridade === 'Alta' && c.publicado);

    const comunicadosFiltrados = comunicados.filter(c =>
        filtroTipo === "todos" || c.tipo === filtroTipo
    );

    const getTipoBadgeStyle = (tipo) => {
        switch (tipo) {
            case 'Urgente':
                return { backgroundColor: '#FEE2E2', color: '#991B1B' };
            case 'Aviso':
                return { backgroundColor: '#FEF3C7', color: '#92400E' };
            case 'Informativo':
                return { backgroundColor: '#DBEAFE', color: '#1E40AF' };
            case 'Evento':
                return { backgroundColor: '#E0E7FF', color: '#3730A3' };
            case 'Política':
                return { backgroundColor: '#D1FAE5', color: '#065F46' };
            case 'Treinamento':
                return { backgroundColor: '#FED7AA', color: '#C2410C' };
            default:
                return { backgroundColor: '#E5E7EB', color: '#374151' };
        }
    };

    const getPrioridadeIcon = (prioridade) => {
        switch (prioridade) {
            case 'Alta':
                return <AlertTriangle className="w-4 h-4 text-red-500" />;
            case 'Média':
                return <Bell className="w-4 h-4 text-orange-500" />;
            case 'Baixa':
                return <Info className="w-4 h-4 text-blue-500" />;
            default:
                return null;
        }
    };

    const togglePublicado = async (comunicado) => {
        try {
            await base44.entities.ComunicadoRH.update(comunicado.id, {
                publicado: !comunicado.publicado,
                data_publicacao: !comunicado.publicado ? new Date().toISOString() : null,
            });
            queryClient.invalidateQueries(['comunicados_rh']);
            toast.success(comunicado.publicado ? "Comunicado despublicado" : "Comunicado publicado!");
        } catch (error) {
            toast.error("Erro: " + error.message);
        }
    };

    return (
        <div className="space-y-6">
            {/* Metrics */}
            <div className="grid grid-cols-3 gap-4">
                <Card className="border-0 shadow-lg">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-gray-500">Total de Comunicados</p>
                                <p className="text-2xl font-bold" style={{ color: '#07593f' }}>{comunicados.length}</p>
                            </div>
                            <FileText className="w-8 h-8 opacity-50" style={{ color: '#07593f' }} />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-lg">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-gray-500">Publicados</p>
                                <p className="text-2xl font-bold text-green-600">{comunicadosPublicados.length}</p>
                            </div>
                            <Megaphone className="w-8 h-8 text-green-600 opacity-50" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-lg">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-gray-500">Urgentes Ativos</p>
                                <p className="text-2xl font-bold text-red-600">{comunicadosUrgentes.length}</p>
                            </div>
                            <AlertTriangle className="w-8 h-8 text-red-600 opacity-50" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Actions */}
            <Card className="border-0 shadow-lg">
                <CardContent className="p-4">
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="w-48">
                            <Label>Filtrar por Tipo</Label>
                            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todos">Todos os Tipos</SelectItem>
                                    {TIPOS_COMUNICADO.map(t => (
                                        <SelectItem key={t} value={t}>{t}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button
                            onClick={() => { setComunicadoSelecionado(null); setModalAberto(true); }}
                            style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Novo Comunicado
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Communications List */}
            <Card className="border-0 shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2" style={{ color: '#07593f' }}>
                        <Megaphone className="w-5 h-5" />
                        Comunicados
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#07593f' }} />
                        </div>
                    ) : comunicadosFiltrados.length === 0 ? (
                        <div className="text-center py-12">
                            <Megaphone className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                            <p className="text-gray-500 mb-4">Nenhum comunicado encontrado</p>
                            <Button
                                onClick={() => setModalAberto(true)}
                                style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Criar Primeiro Comunicado
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {comunicadosFiltrados.map(comunicado => (
                                <div
                                    key={comunicado.id}
                                    className={`p-4 rounded-xl border transition-all ${comunicado.publicado ? 'hover:shadow-md' : 'opacity-60'}`}
                                    style={{ borderColor: '#E5E0D8' }}
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-start gap-2">
                                            {getPrioridadeIcon(comunicado.prioridade)}
                                            <div>
                                                <h3 className="font-bold text-lg" style={{ color: '#07593f' }}>
                                                    {comunicado.titulo}
                                                </h3>
                                                <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                                                    <Badge style={getTipoBadgeStyle(comunicado.tipo)}>{comunicado.tipo}</Badge>
                                                    {comunicado.autor_nome && (
                                                        <span className="flex items-center gap-1">
                                                            <User className="w-3 h-3" />
                                                            {comunicado.autor_nome}
                                                        </span>
                                                    )}
                                                    {comunicado.data_publicacao && (
                                                        <span className="flex items-center gap-1">
                                                            <Calendar className="w-3 h-3" />
                                                            {new Date(comunicado.data_publicacao).toLocaleDateString('pt-BR')}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge
                                                variant={comunicado.publicado ? "default" : "outline"}
                                                className={comunicado.publicado ? "bg-green-100 text-green-800" : ""}
                                            >
                                                {comunicado.publicado ? "Publicado" : "Rascunho"}
                                            </Badge>
                                        </div>
                                    </div>

                                    <p className="text-gray-600 mb-4 line-clamp-2">{comunicado.conteudo}</p>

                                    <div className="flex items-center justify-end gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => togglePublicado(comunicado)}
                                        >
                                            {comunicado.publicado ? "Despublicar" : "Publicar"}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => { setComunicadoSelecionado(comunicado); setModalAberto(true); }}
                                        >
                                            <Edit className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-red-600"
                                            onClick={() => setConfirmDelete(comunicado)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Modal */}
            {modalAberto && (
                <ComunicadoModal
                    comunicado={comunicadoSelecionado}
                    onClose={() => { setModalAberto(false); setComunicadoSelecionado(null); }}
                />
            )}

            {/* Delete Confirmation */}
            <AlertDialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir o comunicado "{confirmDelete?.titulo}"?
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

// Comunicado Modal
function ComunicadoModal({ comunicado, onClose }) {
    const queryClient = useQueryClient();
    const isEditing = !!comunicado;

    const [formData, setFormData] = useState({
        titulo: comunicado?.titulo || "",
        conteudo: comunicado?.conteudo || "",
        tipo: comunicado?.tipo || "Informativo",
        prioridade: comunicado?.prioridade || "Média",
        autor_nome: comunicado?.autor_nome || "",
        destinatarios: comunicado?.destinatarios || "Todos",
        data_expiracao: comunicado?.data_expiracao || "",
        publicado: comunicado?.publicado || false,
    });

    const [saving, setSaving] = useState(false);

    const handleSubmit = async () => {
        if (!formData.titulo || !formData.conteudo) {
            toast.error("Título e conteúdo são obrigatórios");
            return;
        }

        setSaving(true);
        try {
            const dataToSave = {
                ...formData,
                data_publicacao: formData.publicado ? new Date().toISOString() : null,
            };

            if (isEditing) {
                await base44.entities.ComunicadoRH.update(comunicado.id, dataToSave);
                toast.success("Comunicado atualizado!");
            } else {
                await base44.entities.ComunicadoRH.create(dataToSave);
                toast.success("Comunicado criado!");
            }
            queryClient.invalidateQueries(['comunicados_rh']);
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
                        <Megaphone className="w-5 h-5" />
                        {isEditing ? "Editar Comunicado" : "Novo Comunicado"}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 mt-4">
                    <div>
                        <Label>Título *</Label>
                        <Input
                            value={formData.titulo}
                            onChange={(e) => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
                            placeholder="Título do comunicado"
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Tipo</Label>
                            <Select value={formData.tipo} onValueChange={(v) => setFormData(prev => ({ ...prev, tipo: v }))}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {TIPOS_COMUNICADO.map(t => (
                                        <SelectItem key={t} value={t}>{t}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Prioridade</Label>
                            <Select value={formData.prioridade} onValueChange={(v) => setFormData(prev => ({ ...prev, prioridade: v }))}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {PRIORIDADES.map(p => (
                                        <SelectItem key={p} value={p}>{p}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Autor</Label>
                            <Input
                                value={formData.autor_nome}
                                onChange={(e) => setFormData(prev => ({ ...prev, autor_nome: e.target.value }))}
                                placeholder="Nome do autor"
                            />
                        </div>
                    </div>

                    <div>
                        <Label>Conteúdo *</Label>
                        <Textarea
                            value={formData.conteudo}
                            onChange={(e) => setFormData(prev => ({ ...prev, conteudo: e.target.value }))}
                            placeholder="Escreva o conteúdo do comunicado..."
                            rows={6}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Destinatários</Label>
                            <Input
                                value={formData.destinatarios}
                                onChange={(e) => setFormData(prev => ({ ...prev, destinatarios: e.target.value }))}
                                placeholder="Todos, Setor específico, etc."
                            />
                        </div>
                        <div>
                            <Label>Data de Expiração (opcional)</Label>
                            <Input
                                type="date"
                                value={formData.data_expiracao}
                                onChange={(e) => setFormData(prev => ({ ...prev, data_expiracao: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 p-4 rounded-lg" style={{ backgroundColor: '#f0f9ff' }}>
                        <input
                            type="checkbox"
                            id="publicado"
                            checked={formData.publicado}
                            onChange={(e) => setFormData(prev => ({ ...prev, publicado: e.target.checked }))}
                            className="w-4 h-4"
                        />
                        <Label htmlFor="publicado" className="cursor-pointer">
                            Publicar imediatamente
                        </Label>
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={saving}
                        style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
                    >
                        {saving ? "Salvando..." : isEditing ? "Salvar Alterações" : "Criar Comunicado"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
