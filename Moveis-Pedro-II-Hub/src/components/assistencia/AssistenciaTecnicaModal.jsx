import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Upload, X, FileText, Image } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const TIPOS_ASSISTENCIA = [
    { value: "Devolução", label: "Devolução", color: "bg-red-100 text-red-800" },
    { value: "Troca", label: "Troca", color: "bg-orange-100 text-orange-800" },
    { value: "Peça Faltante", label: "Peça Faltante", color: "bg-yellow-100 text-yellow-800" },
    { value: "Conserto", label: "Conserto", color: "bg-blue-100 text-blue-800" },
    { value: "Visita Técnica", label: "Visita Técnica", color: "bg-purple-100 text-purple-800" },
    { value: "Outros", label: "Outros", color: "bg-gray-100 text-gray-800" }
];

const STATUS_OPTIONS = [
    { value: "Aberta", label: "Aberta", color: "bg-blue-100 text-blue-800" },
    { value: "Em Andamento", label: "Em Andamento", color: "bg-yellow-100 text-yellow-800" },
    { value: "Aguardando Peça", label: "Aguardando Peça", color: "bg-orange-100 text-orange-800" },
    { value: "Aguardando Cliente", label: "Aguardando Cliente", color: "bg-purple-100 text-purple-800" },
    { value: "Concluída", label: "Concluída", color: "bg-green-100 text-green-800" },
    { value: "Cancelada", label: "Cancelada", color: "bg-red-100 text-red-800" }
];

const PRIORIDADE_OPTIONS = [
    { value: "Baixa", label: "Baixa", color: "bg-gray-100 text-gray-600" },
    { value: "Normal", label: "Normal", color: "bg-blue-100 text-blue-700" },
    { value: "Alta", label: "Alta", color: "bg-orange-100 text-orange-700" },
    { value: "Urgente", label: "Urgente", color: "bg-red-100 text-red-700" }
];

export default function AssistenciaTecnicaModal({
    isOpen,
    onClose,
    onSave,
    assistencia,
    vendas = [],
    isLoading
}) {
    const [formData, setFormData] = useState({
        venda_id: "",
        numero_pedido: "",
        cliente_nome: "",
        cliente_telefone: "",
        tipo: "Devolução",
        data_abertura: new Date().toISOString().split('T')[0],
        data_resolucao: "",
        descricao_problema: "",
        solucao_aplicada: "",
        itens_envolvidos: [],
        valor_devolvido: 0,
        valor_cobrado: 0,
        status: "Aberta",
        prioridade: "Normal",
        arquivos: [],
        observacoes: ""
    });

    const [vendaSelecionada, setVendaSelecionada] = useState(null);
    const [searchVenda, setSearchVenda] = useState("");
    const [uploadingFile, setUploadingFile] = useState(false);

    useEffect(() => {
        if (assistencia) {
            setFormData({
                ...assistencia,
                itens_envolvidos: assistencia.itens_envolvidos || [],
                arquivos: assistencia.arquivos || []
            });
            const venda = vendas.find(v => v.id === assistencia.venda_id);
            setVendaSelecionada(venda);
        } else {
            setFormData({
                venda_id: "",
                numero_pedido: "",
                cliente_nome: "",
                cliente_telefone: "",
                tipo: "Devolução",
                data_abertura: new Date().toISOString().split('T')[0],
                data_resolucao: "",
                descricao_problema: "",
                solucao_aplicada: "",
                itens_envolvidos: [],
                valor_devolvido: 0,
                valor_cobrado: 0,
                status: "Aberta",
                prioridade: "Normal",
                arquivos: [],
                observacoes: ""
            });
            setVendaSelecionada(null);
        }
    }, [assistencia, vendas, isOpen]);

    const handleVendaChange = (vendaId) => {
        const venda = vendas.find(v => v.id === vendaId);
        if (!venda) return;

        setVendaSelecionada(venda);
        setFormData({
            ...formData,
            venda_id: vendaId,
            numero_pedido: venda.numero_pedido,
            cliente_nome: venda.cliente_nome,
            cliente_telefone: venda.cliente_telefone || "",
            itens_envolvidos: []
        });
    };

    const adicionarItem = (item) => {
        const jaAdicionado = formData.itens_envolvidos.find(i => i.produto_id === item.produto_id);
        if (jaAdicionado) return;

        setFormData({
            ...formData,
            itens_envolvidos: [...formData.itens_envolvidos, {
                produto_id: item.produto_id,
                produto_nome: item.produto_nome,
                quantidade: item.quantidade,
                problema: ""
            }]
        });
    };

    const removerItem = (index) => {
        setFormData({
            ...formData,
            itens_envolvidos: formData.itens_envolvidos.filter((_, i) => i !== index)
        });
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingFile(true);
        try {
            const result = await base44.integrations.Core.UploadFile({ file });
            setFormData({
                ...formData,
                arquivos: [...formData.arquivos, {
                    nome: file.name,
                    url: result.file_url,
                    tipo: file.type,
                    data: new Date().toISOString()
                }]
            });
        } catch (error) {
            console.error("Erro ao fazer upload:", error);
            alert("Erro ao fazer upload do arquivo");
        } finally {
            setUploadingFile(false);
        }
    };

    const removerArquivo = (index) => {
        setFormData({
            ...formData,
            arquivos: formData.arquivos.filter((_, i) => i !== index)
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.venda_id) {
            alert("Selecione um pedido");
            return;
        }

        if (!formData.descricao_problema.trim()) {
            alert("Descreva o problema");
            return;
        }

        // Sanitize date fields - convert empty strings to null for PostgreSQL
        const sanitizedData = {
            ...formData,
            data_abertura: formData.data_abertura || null,
            data_resolucao: formData.data_resolucao || null
        };

        onSave(sanitizedData);
    };

    const filteredVendas = vendas.filter(v => {
        if (!searchVenda) return true;
        const termo = searchVenda.toLowerCase();
        return (
            v.numero_pedido?.toString().includes(termo) ||
            v.cliente_nome?.toLowerCase().includes(termo)
        );
    });

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle style={{ color: '#07593f' }}>
                        {assistencia ? "Editar Assistência Técnica" : "Nova Assistência Técnica"}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-6">
                        {/* Seleção do Pedido */}
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Buscar Pedido *</Label>
                                <Input
                                    placeholder="Digite número do pedido ou nome do cliente..."
                                    value={searchVenda}
                                    onChange={e => setSearchVenda(e.target.value)}
                                    disabled={!!assistencia}
                                />
                                {!assistencia && searchVenda && (
                                    <div className="max-h-40 overflow-y-auto border rounded-lg">
                                        {filteredVendas.slice(0, 10).map(venda => (
                                            <div
                                                key={venda.id}
                                                className="p-2 hover:bg-gray-100 cursor-pointer flex justify-between items-center"
                                                onClick={() => {
                                                    handleVendaChange(venda.id);
                                                    setSearchVenda("");
                                                }}
                                            >
                                                <div>
                                                    <span className="font-medium">#{venda.numero_pedido}</span>
                                                    <span className="text-gray-500 ml-2">{venda.cliente_nome}</span>
                                                </div>
                                                <Badge variant="outline">
                                                    R$ {venda.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </Badge>
                                            </div>
                                        ))}
                                        {filteredVendas.length === 0 && (
                                            <div className="p-2 text-gray-500 text-center">Nenhum pedido encontrado</div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label>Tipo de Assistência *</Label>
                                <Select
                                    value={formData.tipo}
                                    onValueChange={(value) => setFormData({ ...formData, tipo: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {TIPOS_ASSISTENCIA.map(tipo => (
                                            <SelectItem key={tipo.value} value={tipo.value}>
                                                {tipo.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Info do Pedido Selecionado */}
                        {vendaSelecionada && (
                            <Alert className="bg-green-50 border-green-200">
                                <AlertDescription>
                                    <div className="flex flex-wrap gap-4">
                                        <div>
                                            <strong>Pedido:</strong> #{vendaSelecionada.numero_pedido}
                                        </div>
                                        <div>
                                            <strong>Cliente:</strong> {vendaSelecionada.cliente_nome}
                                        </div>
                                        <div>
                                            <strong>Valor:</strong> R$ {vendaSelecionada.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </div>
                                        <div>
                                            <strong>Data:</strong> {new Date(vendaSelecionada.data_venda).toLocaleDateString('pt-BR')}
                                        </div>
                                    </div>
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Status e Prioridade */}
                        <div className="grid md:grid-cols-3 gap-4">
                            <div>
                                <Label>Data de Abertura *</Label>
                                <Input
                                    type="date"
                                    value={formData.data_abertura}
                                    onChange={(e) => setFormData({ ...formData, data_abertura: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <Label>Status</Label>
                                <Select
                                    value={formData.status}
                                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {STATUS_OPTIONS.map(status => (
                                            <SelectItem key={status.value} value={status.value}>
                                                {status.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Prioridade</Label>
                                <Select
                                    value={formData.prioridade}
                                    onValueChange={(value) => setFormData({ ...formData, prioridade: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PRIORIDADE_OPTIONS.map(p => (
                                            <SelectItem key={p.value} value={p.value}>
                                                {p.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Descrição do Problema */}
                        <div>
                            <Label>Descrição do Problema *</Label>
                            <Textarea
                                value={formData.descricao_problema}
                                onChange={(e) => setFormData({ ...formData, descricao_problema: e.target.value })}
                                placeholder="Descreva detalhadamente o problema relatado pelo cliente..."
                                rows={3}
                                required
                            />
                        </div>

                        {/* Itens Envolvidos */}
                        {vendaSelecionada && vendaSelecionada.itens && (
                            <div className="border rounded-lg p-4" style={{ borderColor: '#E5E0D8' }}>
                                <h4 className="font-semibold mb-3" style={{ color: '#07593f' }}>
                                    Itens do Pedido (selecione os envolvidos)
                                </h4>
                                <div className="space-y-2">
                                    {vendaSelecionada.itens.map((item, index) => (
                                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                                            <div>
                                                <p className="font-medium">{item.produto_nome}</p>
                                                <p className="text-sm text-gray-500">
                                                    Quantidade: {item.quantidade}
                                                </p>
                                            </div>
                                            <Button
                                                type="button"
                                                size="sm"
                                                onClick={() => adicionarItem(item)}
                                                disabled={formData.itens_envolvidos.some(i => i.produto_id === item.produto_id)}
                                                className={formData.itens_envolvidos.some(i => i.produto_id === item.produto_id)
                                                    ? "bg-gray-300"
                                                    : "bg-orange-500 hover:bg-orange-600"}
                                            >
                                                <Plus className="w-4 h-4 mr-1" />
                                                {formData.itens_envolvidos.some(i => i.produto_id === item.produto_id) ? "Adicionado" : "Adicionar"}
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Itens Selecionados */}
                        {formData.itens_envolvidos.length > 0 && (
                            <div className="border rounded-lg p-4" style={{ borderColor: '#07593f' }}>
                                <h4 className="font-semibold mb-3" style={{ color: '#07593f' }}>
                                    Itens Selecionados ({formData.itens_envolvidos.length})
                                </h4>
                                <div className="space-y-3">
                                    {formData.itens_envolvidos.map((item, index) => (
                                        <div key={index} className="flex items-start gap-3 p-3 bg-green-50 rounded">
                                            <div className="flex-1">
                                                <p className="font-medium">{item.produto_nome}</p>
                                                <Input
                                                    placeholder="Descreva o problema específico deste item..."
                                                    value={item.problema}
                                                    onChange={(e) => {
                                                        const novosItens = [...formData.itens_envolvidos];
                                                        novosItens[index].problema = e.target.value;
                                                        setFormData({ ...formData, itens_envolvidos: novosItens });
                                                    }}
                                                    className="mt-2"
                                                />
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => removerItem(index)}
                                                className="text-red-600"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Arquivos */}
                        <div className="border rounded-lg p-4" style={{ borderColor: '#E5E0D8' }}>
                            <h4 className="font-semibold mb-3 flex items-center gap-2" style={{ color: '#07593f' }}>
                                <Upload className="w-4 h-4" />
                                Arquivos Anexos
                            </h4>

                            <div className="flex flex-wrap gap-2 mb-3">
                                {formData.arquivos.map((arquivo, index) => (
                                    <div key={index} className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-lg">
                                        {arquivo.tipo?.startsWith('image') ? (
                                            <Image className="w-4 h-4 text-blue-600" />
                                        ) : (
                                            <FileText className="w-4 h-4 text-gray-600" />
                                        )}
                                        <a
                                            href={arquivo.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm text-blue-600 hover:underline max-w-[150px] truncate"
                                        >
                                            {arquivo.nome}
                                        </a>
                                        <button
                                            type="button"
                                            onClick={() => removerArquivo(index)}
                                            className="text-red-500 hover:text-red-700"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                {uploadingFile ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <Upload className="w-5 h-5 text-gray-400" />
                                        <span className="text-gray-500">Clique para anexar arquivo (foto, documento...)</span>
                                    </>
                                )}
                                <input
                                    type="file"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                    disabled={uploadingFile}
                                    accept="image/*,.pdf,.doc,.docx"
                                />
                            </label>
                        </div>

                        {/* Valores */}
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <Label>Valor Devolvido (R$)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={formData.valor_devolvido}
                                    onChange={(e) => setFormData({ ...formData, valor_devolvido: parseFloat(e.target.value) || 0 })}
                                    placeholder="0,00"
                                />
                            </div>
                            <div>
                                <Label>Valor Cobrado (R$)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={formData.valor_cobrado}
                                    onChange={(e) => setFormData({ ...formData, valor_cobrado: parseFloat(e.target.value) || 0 })}
                                    placeholder="0,00"
                                />
                            </div>
                        </div>

                        {/* Solução Aplicada */}
                        <div>
                            <Label>Solução Aplicada</Label>
                            <Textarea
                                value={formData.solucao_aplicada}
                                onChange={(e) => setFormData({ ...formData, solucao_aplicada: e.target.value })}
                                placeholder="Descreva a solução aplicada para resolver o problema..."
                                rows={3}
                            />
                        </div>

                        {/* Data de Resolução */}
                        {formData.status === "Concluída" && (
                            <div>
                                <Label>Data de Resolução</Label>
                                <Input
                                    type="date"
                                    value={formData.data_resolucao}
                                    onChange={(e) => setFormData({ ...formData, data_resolucao: e.target.value })}
                                />
                            </div>
                        )}

                        {/* Observações */}
                        <div>
                            <Label>Observações Internas</Label>
                            <Textarea
                                value={formData.observacoes}
                                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                                placeholder="Notas internas (não serão mostradas ao cliente)..."
                                rows={2}
                            />
                        </div>
                    </div>

                    <DialogFooter className="mt-6">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={isLoading || !formData.venda_id || !formData.descricao_problema}
                            style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                assistencia ? "Atualizar" : "Criar Assistência"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
