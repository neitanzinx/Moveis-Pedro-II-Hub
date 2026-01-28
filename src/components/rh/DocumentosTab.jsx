import React, { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44, supabase } from "@/api/base44Client";
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
    FileText, Plus, Upload, Eye, Download, Trash2,
    Search, Folder, File, Calendar, User
} from "lucide-react";
import { toast } from "sonner";

const TIPOS_DOCUMENTO = ["Contrato", "Atestado", "Certificado", "Advertência", "Carteira de Trabalho", "Comprovante", "Outros"];

export default function DocumentosTab() {
    const queryClient = useQueryClient();
    const [modalUpload, setModalUpload] = useState(false);
    const [documentoSelecionado, setDocumentoSelecionado] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [busca, setBusca] = useState("");
    const [filtroTipo, setFiltroTipo] = useState("todos");
    const [filtroColaborador, setFiltroColaborador] = useState("todos");

    const { data: colaboradores = [] } = useQuery({
        queryKey: ['colaboradores'],
        queryFn: () => base44.entities.Colaborador.list(),
    });

    const { data: documentos = [], isLoading } = useQuery({
        queryKey: ['documentos_rh'],
        queryFn: () => base44.entities.DocumentoRH.list('-created_at'),
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.DocumentoRH.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries(['documentos_rh']);
            toast.success("Documento excluído!");
            setConfirmDelete(null);
        },
    });

    const colaboradoresAtivos = colaboradores.filter(c => c.status !== 'Desligado');

    // Metrics
    const documentosPorTipo = TIPOS_DOCUMENTO.map(tipo => ({
        tipo,
        quantidade: documentos.filter(d => d.tipo === tipo).length,
    }));

    const documentosFiltrados = documentos.filter(d => {
        const matchBusca = !busca ||
            d.titulo?.toLowerCase().includes(busca.toLowerCase()) ||
            d.colaborador_nome?.toLowerCase().includes(busca.toLowerCase());
        const matchTipo = filtroTipo === "todos" || d.tipo === filtroTipo;
        const matchColaborador = filtroColaborador === "todos" || d.colaborador_id === filtroColaborador;
        return matchBusca && matchTipo && matchColaborador;
    });

    const getTipoBadgeStyle = (tipo) => {
        switch (tipo) {
            case 'Contrato':
                return { backgroundColor: '#D1FAE5', color: '#065F46' };
            case 'Atestado':
                return { backgroundColor: '#FEE2E2', color: '#991B1B' };
            case 'Certificado':
                return { backgroundColor: '#DBEAFE', color: '#1E40AF' };
            case 'Advertência':
                return { backgroundColor: '#FEF3C7', color: '#92400E' };
            case 'Carteira de Trabalho':
                return { backgroundColor: '#E0E7FF', color: '#3730A3' };
            default:
                return { backgroundColor: '#E5E7EB', color: '#374151' };
        }
    };

    const abrirDocumento = (url) => {
        if (url) {
            window.open(url, '_blank');
        } else {
            toast.error("URL do documento não disponível");
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
                                <p className="text-xs text-gray-500">Total de Documentos</p>
                                <p className="text-2xl font-bold" style={{ color: '#07593f' }}>{documentos.length}</p>
                            </div>
                            <Folder className="w-8 h-8 opacity-50" style={{ color: '#07593f' }} />
                        </div>
                    </CardContent>
                </Card>
                {documentosPorTipo.slice(0, 3).map(item => (
                    <Card key={item.tipo} className="border-0 shadow-lg">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-gray-500">{item.tipo}</p>
                                    <p className="text-2xl font-bold text-blue-600">{item.quantidade}</p>
                                </div>
                                <File className="w-8 h-8 text-blue-600 opacity-50" />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Filters */}
            <Card className="border-0 shadow-lg">
                <CardContent className="p-4">
                    <div className="flex flex-wrap gap-4">
                        <div className="flex-1 min-w-[200px] relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <Input
                                placeholder="Buscar documentos..."
                                value={busca}
                                onChange={(e) => setBusca(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                            <SelectTrigger className="w-40">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos">Todos os Tipos</SelectItem>
                                {TIPOS_DOCUMENTO.map(t => (
                                    <SelectItem key={t} value={t}>{t}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={filtroColaborador} onValueChange={setFiltroColaborador}>
                            <SelectTrigger className="w-48">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos">Todos os Colaboradores</SelectItem>
                                {colaboradoresAtivos.map(c => (
                                    <SelectItem key={c.id} value={c.id}>{c.nome_completo}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button
                            onClick={() => { setDocumentoSelecionado(null); setModalUpload(true); }}
                            style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
                        >
                            <Upload className="w-4 h-4 mr-2" />
                            Enviar Documento
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Documents List */}
            <Card className="border-0 shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2" style={{ color: '#07593f' }}>
                        <FileText className="w-5 h-5" />
                        Documentos ({documentosFiltrados.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#07593f' }} />
                        </div>
                    ) : documentosFiltrados.length === 0 ? (
                        <div className="text-center py-12">
                            <Folder className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                            <p className="text-gray-500 mb-4">Nenhum documento encontrado</p>
                            <Button
                                onClick={() => setModalUpload(true)}
                                style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
                            >
                                <Upload className="w-4 h-4 mr-2" />
                                Enviar Primeiro Documento
                            </Button>
                        </div>
                    ) : (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {documentosFiltrados.map(doc => (
                                <div
                                    key={doc.id}
                                    className="p-4 rounded-xl border hover:shadow-md transition-all"
                                    style={{ borderColor: '#E5E0D8' }}
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-start gap-3">
                                            <div
                                                className="w-10 h-10 rounded-lg flex items-center justify-center"
                                                style={{ backgroundColor: '#f0f9ff' }}
                                            >
                                                <FileText className="w-5 h-5" style={{ color: '#07593f' }} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold truncate" style={{ color: '#07593f' }}>
                                                    {doc.titulo}
                                                </p>
                                                <p className="text-sm text-gray-500 truncate">{doc.colaborador_nome}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 mb-3">
                                        <Badge style={getTipoBadgeStyle(doc.tipo)}>{doc.tipo}</Badge>
                                        {doc.data_documento && (
                                            <span className="text-xs text-gray-500 flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {new Date(doc.data_documento).toLocaleDateString('pt-BR')}
                                            </span>
                                        )}
                                    </div>

                                    {doc.descricao && (
                                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{doc.descricao}</p>
                                    )}

                                    <div className="flex items-center justify-end gap-1">
                                        {doc.arquivo_url && (
                                            <>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => abrirDocumento(doc.arquivo_url)}
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => {
                                                        const a = document.createElement('a');
                                                        a.href = doc.arquivo_url;
                                                        a.download = doc.titulo || 'documento';
                                                        a.click();
                                                    }}
                                                >
                                                    <Download className="w-4 h-4" />
                                                </Button>
                                            </>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-red-600"
                                            onClick={() => setConfirmDelete(doc)}
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

            {/* Upload Modal */}
            {modalUpload && (
                <DocumentoUploadModal
                    colaboradores={colaboradoresAtivos}
                    onClose={() => { setModalUpload(false); setDocumentoSelecionado(null); }}
                />
            )}

            {/* Delete Confirmation */}
            <AlertDialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir o documento "{confirmDelete?.titulo}"?
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

// Document Upload Modal
function DocumentoUploadModal({ colaboradores, onClose }) {
    const queryClient = useQueryClient();
    const fileInputRef = useRef(null);

    const [formData, setFormData] = useState({
        colaborador_id: "",
        colaborador_nome: "",
        tipo: "Contrato",
        titulo: "",
        descricao: "",
        data_documento: "",
        arquivo_url: "",
    });

    const [arquivo, setArquivo] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);

    const handleColaboradorChange = (id) => {
        const colab = colaboradores.find(c => c.id === id);
        setFormData(prev => ({
            ...prev,
            colaborador_id: id,
            colaborador_nome: colab?.nome_completo || "",
        }));
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setArquivo(file);
            if (!formData.titulo) {
                setFormData(prev => ({ ...prev, titulo: file.name.replace(/\.[^/.]+$/, "") }));
            }
        }
    };

    const uploadFile = async () => {
        if (!arquivo) return null;

        const fileExt = arquivo.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `documentos-rh/${fileName}`;

        const { data, error } = await supabase.storage
            .from('documentos')
            .upload(filePath, arquivo);

        if (error) {
            throw new Error("Erro ao fazer upload do arquivo: " + error.message);
        }

        const { data: urlData } = supabase.storage
            .from('documentos')
            .getPublicUrl(filePath);

        return urlData.publicUrl;
    };

    const handleSubmit = async () => {
        if (!formData.colaborador_id || !formData.titulo) {
            toast.error("Colaborador e título são obrigatórios");
            return;
        }

        setSaving(true);
        try {
            let arquivoUrl = formData.arquivo_url;

            if (arquivo) {
                setUploading(true);
                arquivoUrl = await uploadFile();
                setUploading(false);
            }

            await base44.entities.DocumentoRH.create({
                ...formData,
                arquivo_url: arquivoUrl,
                data_upload: new Date().toISOString(),
            });

            queryClient.invalidateQueries(['documentos_rh']);
            toast.success("Documento enviado com sucesso!");
            onClose();
        } catch (error) {
            toast.error("Erro: " + error.message);
        } finally {
            setSaving(false);
            setUploading(false);
        }
    };

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2" style={{ color: '#07593f' }}>
                        <Upload className="w-5 h-5" />
                        Enviar Documento
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
                            <Label>Tipo de Documento</Label>
                            <Select value={formData.tipo} onValueChange={(v) => setFormData(prev => ({ ...prev, tipo: v }))}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {TIPOS_DOCUMENTO.map(t => (
                                        <SelectItem key={t} value={t}>{t}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Data do Documento</Label>
                            <Input
                                type="date"
                                value={formData.data_documento}
                                onChange={(e) => setFormData(prev => ({ ...prev, data_documento: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div>
                        <Label>Título *</Label>
                        <Input
                            value={formData.titulo}
                            onChange={(e) => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
                            placeholder="Nome do documento"
                        />
                    </div>

                    <div>
                        <Label>Descrição</Label>
                        <Textarea
                            value={formData.descricao}
                            onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                            placeholder="Breve descrição do documento..."
                            rows={2}
                        />
                    </div>

                    {/* File Upload */}
                    <div>
                        <Label>Arquivo</Label>
                        <div
                            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 transition-colors"
                            style={{ borderColor: '#E5E0D8' }}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                className="hidden"
                                onChange={handleFileChange}
                                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                            />
                            {arquivo ? (
                                <div className="flex items-center justify-center gap-2">
                                    <FileText className="w-8 h-8" style={{ color: '#07593f' }} />
                                    <div className="text-left">
                                        <p className="font-medium">{arquivo.name}</p>
                                        <p className="text-sm text-gray-500">
                                            {(arquivo.size / 1024 / 1024).toFixed(2)} MB
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <Upload className="w-10 h-10 mx-auto mb-2 text-gray-400" />
                                    <p className="text-gray-600">Clique para selecionar um arquivo</p>
                                    <p className="text-xs text-gray-400 mt-1">PDF, DOC, DOCX, JPG, PNG (max 10MB)</p>
                                </>
                            )}
                        </div>
                    </div>

                    <div>
                        <Label>Ou cole uma URL</Label>
                        <Input
                            value={formData.arquivo_url}
                            onChange={(e) => setFormData(prev => ({ ...prev, arquivo_url: e.target.value }))}
                            placeholder="https://..."
                            disabled={!!arquivo}
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={saving || uploading}
                        style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
                    >
                        {uploading ? "Enviando arquivo..." : saving ? "Salvando..." : "Enviar Documento"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
