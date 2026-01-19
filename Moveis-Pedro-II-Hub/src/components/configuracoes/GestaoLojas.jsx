import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Store, Plus, Pencil, Trash2, MapPin, Loader2, Building2, Search } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export default function GestaoLojas() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLoja, setEditingLoja] = useState(null);
    const [formData, setFormData] = useState({ nome: "", endereco: "" });
    const [error, setError] = useState("");
    const [searchTerm, setSearchTerm] = useState("");

    const queryClient = useQueryClient();

    const { data: lojas = [], isLoading } = useQuery({
        queryKey: ['lojas'],
        queryFn: () => base44.entities.Loja.list('nome'),
    });

    const createMutation = useMutation({
        mutationFn: (data) => base44.entities.Loja.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lojas'] });
            handleCloseModal();
        },
        onError: (err) => setError(err.message || "Erro ao criar loja"),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.Loja.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lojas'] });
            handleCloseModal();
        },
        onError: (err) => setError(err.message || "Erro ao atualizar loja"),
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.Loja.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lojas'] });
        },
    });

    const handleOpenModal = (loja = null) => {
        setEditingLoja(loja);
        setFormData(loja ? { nome: loja.nome, endereco: loja.endereco || "" } : { nome: "", endereco: "" });
        setError("");
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingLoja(null);
        setFormData({ nome: "", endereco: "" });
        setError("");
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.nome.trim()) {
            setError("O nome da loja é obrigatório");
            return;
        }
        if (editingLoja) {
            updateMutation.mutate({ id: editingLoja.id, data: formData });
        } else {
            createMutation.mutate({ ...formData, ativa: true });
        }
    };

    const handleToggleAtiva = (loja) => {
        updateMutation.mutate({ id: loja.id, data: { ativa: !loja.ativa } });
    };

    const handleDelete = (id) => {
        if (window.confirm("Tem certeza que deseja excluir esta loja? Isso pode afetar estoques vinculados.")) {
            deleteMutation.mutate(id);
        }
    };

    const filteredLojas = lojas.filter(l =>
        l.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.endereco && l.endereco.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-green-600" />
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Building2 className="w-8 h-8 text-green-600" />
                    Gestão de Filiais e Estoques
                </h2>
                <p className="text-gray-500 mt-1">Configure as lojas físicas e centros de distribuição para controle de estoque multi-local.</p>
            </div>

            <Card className="border-t-4 border-t-green-600 shadow-sm">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <CardTitle>Lojas Cadastradas</CardTitle>
                            <CardDescription>Gerencie suas unidades de negócio</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <Input
                                    placeholder="Buscar loja..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9 h-9 w-[200px] bg-gray-50"
                                />
                            </div>
                            <Button
                                onClick={() => handleOpenModal()}
                                className="bg-green-600 hover:bg-green-700 h-9"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Nova Loja
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {filteredLojas.length === 0 ? (
                        <div className="text-center py-16 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Store className="w-8 h-8 text-green-600 opacity-80" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900">Nenhuma loja encontrada</h3>
                            <p className="text-gray-500 max-w-sm mx-auto mt-1">
                                {searchTerm ? "Nenhum resultado para sua busca." : "Comece cadastrando sua primeira loja ou centro de distribuição."}
                            </p>
                            {!searchTerm && (
                                <Button onClick={() => handleOpenModal()} variant="outline" className="mt-4 border-green-200 text-green-700 hover:bg-green-50">
                                    Cadastrar Primeira Loja
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {filteredLojas.map((loja) => (
                                <div
                                    key={loja.id}
                                    className={`relative group bg-white rounded-xl border transition-all duration-200 hover:shadow-md ${loja.ativa
                                        ? 'border-gray-200'
                                        : 'border-gray-200 bg-gray-50 opacity-75'
                                        }`}
                                >
                                    {/* Status Badge */}
                                    <div className="absolute top-4 right-4 z-10">
                                        <Badge variant={loja.ativa ? "default" : "secondary"} className={loja.ativa ? "bg-green-100 text-green-700 hover:bg-green-200" : ""}>
                                            {loja.ativa ? 'Ativa' : 'Inativa'}
                                        </Badge>
                                    </div>

                                    <div className="p-5">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className={`p-2.5 rounded-lg ${loja.ativa ? 'bg-green-50' : 'bg-gray-100'}`}>
                                                <Store className={`w-6 h-6 ${loja.ativa ? 'text-green-600' : 'text-gray-400'}`} />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-gray-900 leading-tight">{loja.nome}</h3>
                                                <p className="text-xs text-gray-500 mt-0.5">ID: {loja.id.substring(0, 8)}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-2 mb-6 min-h-[40px]">
                                            {loja.endereco ? (
                                                <div className="flex items-start gap-2 text-sm text-gray-600">
                                                    <MapPin className="w-4 h-4 mt-0.5 text-gray-400 shrink-0" />
                                                    <span className="line-clamp-2">{loja.endereco}</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 text-sm text-gray-400 italic">
                                                    <MapPin className="w-4 h-4" /> Sem endereço
                                                </div>
                                            )}
                                        </div>

                                        <div className="pt-4 border-t flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Switch
                                                    checked={loja.ativa}
                                                    onCheckedChange={() => handleToggleAtiva(loja)}
                                                    className="data-[state=checked]:bg-green-600"
                                                />
                                                <span className="text-xs font-medium text-gray-600">
                                                    {loja.ativa ? 'Loja Aberta' : 'Loja Fechada'}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleOpenModal(loja)}
                                                    className="h-8 w-8 text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDelete(loja.id)}
                                                    className="h-8 w-8 text-gray-500 hover:text-red-600 hover:bg-red-50"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isModalOpen} onOpenChange={handleCloseModal}>
                <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2 text-gray-900">
                            <Store className="w-5 h-5 text-green-600" />
                            {editingLoja ? 'Editar Loja' : 'Nova Loja'}
                        </DialogTitle>
                        <DialogDescription>
                            Preencha as informações da unidade abaixo.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4 py-2">
                        {error && (
                            <Alert variant="destructive" className="bg-red-50 border-red-200">
                                <AlertDescription className="text-red-700">{error}</AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="nome">Nome da Loja *</Label>
                            <Input
                                id="nome"
                                value={formData.nome}
                                onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                                placeholder="Ex: Matriz, Shopping Sul, Centro"
                                className="bg-gray-50"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="endereco">Endereço Completo</Label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                                <Input
                                    id="endereco"
                                    value={formData.endereco}
                                    onChange={(e) => setFormData(prev => ({ ...prev, endereco: e.target.value }))}
                                    placeholder="Rua, Número, Bairro, Cidade - UF"
                                    className="pl-9 bg-gray-50"
                                />
                            </div>
                        </div>

                        <DialogFooter className="pt-4">
                            <Button type="button" variant="ghost" onClick={handleCloseModal}>
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={createMutation.isPending || updateMutation.isPending}
                                className="bg-green-600 hover:bg-green-700 min-w-[120px]"
                            >
                                {(createMutation.isPending || updateMutation.isPending) ? (
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                ) : null}
                                {editingLoja ? 'Salvar Alterações' : 'Criar Loja'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
