import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function FornecedorModal({
    open,
    onOpenChange,
    fornecedor = null,
    onSuccess
}) {
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState({
        nome_empresa: "",
        cnpj: "",
        outros_cnpjs: [],
        telefone: "",
        email: "",
        endereco: "",
        contato: "",
        observacoes: "",
        ativo: true
    });
    const [novoCnpj, setNovoCnpj] = useState("");

    useEffect(() => {
        if (fornecedor) {
            setFormData(fornecedor);
        } else {
            setFormData({
                nome_empresa: "",
                cnpj: "",
                outros_cnpjs: [],
                telefone: "",
                email: "",
                endereco: "",
                contato: "",
                observacoes: "",
                ativo: true
            });
        }
    }, [fornecedor, open]);

    const createMutation = useMutation({
        mutationFn: (data) => base44.entities.Fornecedor.create(data),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
            toast.success("Fornecedor criado com sucesso!");
            if (onSuccess) onSuccess(data);
            onOpenChange(false);
        },
        onError: (error) => {
            console.error("Erro ao criar fornecedor:", error);
            toast.error("Erro ao criar fornecedor");
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.Fornecedor.update(id, data),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
            toast.success("Fornecedor atualizado com sucesso!");
            if (onSuccess) onSuccess(data);
            onOpenChange(false);
        },
        onError: (error) => {
            console.error("Erro ao atualizar fornecedor:", error);
            toast.error("Erro ao atualizar fornecedor");
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();

        if (fornecedor?.id) {
            updateMutation.mutate({ id: fornecedor.id, data: formData });
        } else {
            createMutation.mutate(formData);
        }
    };

    const handleAddCnpj = () => {
        if (novoCnpj && !formData.outros_cnpjs?.includes(novoCnpj)) {
            setFormData({
                ...formData,
                outros_cnpjs: [...(formData.outros_cnpjs || []), novoCnpj]
            });
            setNovoCnpj("");
        }
    };

    const handleRemoveCnpj = (cnpjToRemove) => {
        setFormData({
            ...formData,
            outros_cnpjs: (formData.outros_cnpjs || []).filter(c => c !== cnpjToRemove)
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {fornecedor ? 'Editar Fornecedor' : 'Novo Fornecedor'}
                    </DialogTitle>
                    <DialogDescription>
                        Preencha as informações do fornecedor
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-4">
                        <div>
                            <Label htmlFor="nome_empresa">Nome da Empresa *</Label>
                            <Input
                                id="nome_empresa"
                                value={formData.nome_empresa}
                                onChange={(e) => setFormData({ ...formData, nome_empresa: e.target.value })}
                                placeholder="Nome do fornecedor"
                                required
                            />
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="cnpj">CNPJ Principal</Label>
                                <Input
                                    id="cnpj"
                                    value={formData.cnpj}
                                    onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                                    placeholder="00.000.000/0000-00"
                                />
                            </div>

                            <div className="col-span-2">
                                <Label>Outros CNPJs (Filiais)</Label>
                                <div className="flex gap-2 mb-2">
                                    <Input
                                        value={novoCnpj}
                                        onChange={(e) => setNovoCnpj(e.target.value)}
                                        placeholder="Adicionar outro CNPJ"
                                    />
                                    <Button type="button" onClick={handleAddCnpj} variant="secondary">
                                        Adicionar
                                    </Button>
                                </div>
                                {(formData.outros_cnpjs && formData.outros_cnpjs.length > 0) && (
                                    <div className="flex flex-wrap gap-2 p-2 bg-gray-50 rounded border">
                                        {formData.outros_cnpjs.map((cnpj, idx) => (
                                            <Badge key={idx} variant="outline" className="flex items-center gap-1 bg-white">
                                                {cnpj}
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveCnpj(cnpj)}
                                                    className="hover:text-red-500"
                                                >
                                                    ×
                                                </button>
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </div>


                            <div>
                                <Label htmlFor="telefone">Telefone</Label>
                                <Input
                                    id="telefone"
                                    value={formData.telefone}
                                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                                    placeholder="(00) 00000-0000"
                                />
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="email">E-mail</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="contato@fornecedor.com"
                                />
                            </div>
                            <div>
                                <Label htmlFor="contato">Responsável</Label>
                                <Input
                                    id="contato"
                                    value={formData.contato}
                                    onChange={(e) => setFormData({ ...formData, contato: e.target.value })}
                                    placeholder="Nome do contato"
                                />
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="endereco">Endereço</Label>
                            <Input
                                id="endereco"
                                value={formData.endereco}
                                onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                                placeholder="Endereço completo"
                            />
                        </div>

                        <div>
                            <Label htmlFor="observacoes">Observações</Label>
                            <Textarea
                                id="observacoes"
                                value={formData.observacoes}
                                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                                rows={3}
                                placeholder="Informações adicionais..."
                            />
                        </div>

                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id="ativo"
                                checked={formData.ativo}
                                onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                                className="rounded"
                            />
                            <Label htmlFor="ativo" className="cursor-pointer">
                                Fornecedor Ativo
                            </Label>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                onOpenChange(false);
                            }}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={createMutation.isPending || updateMutation.isPending}
                            style={{ width: '100%' }}
                            className="bg-green-700 hover:bg-green-800 text-white"
                        >
                            {(createMutation.isPending || updateMutation.isPending) ? 'Salvando...' : 'Salvar'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
