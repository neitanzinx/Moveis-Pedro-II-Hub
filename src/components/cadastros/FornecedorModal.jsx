import { useState, useEffect } from "react";
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
import { toMultiplierFromPercent, toPercentFromMultiplier } from "@/utils/markupCalculator";

const FORNECEDOR_CORE_FIELDS = [
    "nome_empresa",
    "cnpj",
    "contato",
    "nome",
    "telefone",
    "email",
];

const FORNECEDOR_OPTIONAL_FIELDS = [
    "endereco",
    "observacoes",
    "outros_cnpjs",
    "ativo",
    "encomendas_habilitadas",
    "usar_markup_padrao",
    "markup_padrao_multiplicador",
    "markup_padrao_percentual",
];

function pickFields(source, fields) {
    return fields.reduce((acc, key) => {
        if (source[key] !== undefined) acc[key] = source[key];
        return acc;
    }, {});
}

function hasMeaningfulValue(value) {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim() !== "";
    if (Array.isArray(value)) return value.length > 0;
    return true;
}

function pickOptionalMeaningfulFields(source, fields) {
    return fields.reduce((acc, key) => {
        const value = source[key];
        if (hasMeaningfulValue(value)) acc[key] = value;
        return acc;
    }, {});
}

function toSupabaseMessage(error) {
    if (!error) return "Erro desconhecido";
    if (typeof error === "string") return error;
    return error.message || error.details || error.hint || JSON.stringify(error);
}

function isSchemaColumnError(error) {
    const message = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
    return (
        error?.code === "42703" ||
        message.includes("column") ||
        message.includes("schema cache") ||
        message.includes("could not find the") ||
        message.includes("does not exist")
    );
}

async function saveFornecedorWithFallback({ data, isUpdate = false, id = null }) {
    const fullPayload = {
        ...pickFields(data, FORNECEDOR_CORE_FIELDS),
        ...pickOptionalMeaningfulFields(data, FORNECEDOR_OPTIONAL_FIELDS),
    };

    try {
        if (isUpdate && id) return await base44.entities.Fornecedor.update(id, fullPayload);
        return await base44.entities.Fornecedor.create(fullPayload);
    } catch (error) {
        if (!isSchemaColumnError(error)) throw error;

        // Fallback para bases com migração parcial da tabela fornecedores.
        const corePayload = pickFields(data, FORNECEDOR_CORE_FIELDS);
        if (isUpdate && id) return await base44.entities.Fornecedor.update(id, corePayload);
        return await base44.entities.Fornecedor.create(corePayload);
    }
}

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
        ativo: true,
        encomendas_habilitadas: true,
        usar_markup_padrao: false,
        markup_padrao_multiplicador: "",
        markup_padrao_percentual: "",
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
                ativo: true,
                encomendas_habilitadas: true,
                usar_markup_padrao: false,
                markup_padrao_multiplicador: "",
                markup_padrao_percentual: "",
            });
        }
    }, [fornecedor, open]);

    const createMutation = useMutation({
        mutationFn: (data) => saveFornecedorWithFallback({ data, isUpdate: false }),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
            toast.success("Fornecedor criado com sucesso!");
            if (onSuccess) onSuccess(data);
            onOpenChange(false);
        },
        onError: (error) => {
            console.error("Erro ao criar fornecedor:", error);
            toast.error(`Erro ao criar fornecedor: ${toSupabaseMessage(error)}`);
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => saveFornecedorWithFallback({ id, data, isUpdate: true }),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
            toast.success("Fornecedor atualizado com sucesso!");
            if (onSuccess) onSuccess(data);
            onOpenChange(false);
        },
        onError: (error) => {
            console.error("Erro ao atualizar fornecedor:", error);
            toast.error(`Erro ao atualizar fornecedor: ${toSupabaseMessage(error)}`);
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();

        const markupMultiplicador = parseFloat(formData.markup_padrao_multiplicador || 0);
        const markupPercentual = parseFloat(formData.markup_padrao_percentual || 0);

        const payload = {
            ...formData,
            markup_padrao_multiplicador: markupMultiplicador > 0 ? markupMultiplicador : null,
            markup_padrao_percentual: markupPercentual > 0 ? markupPercentual : null,
            usar_markup_padrao: Boolean(formData.usar_markup_padrao),
        };

        if (fornecedor?.id) {
            updateMutation.mutate({ id: fornecedor.id, data: payload });
        } else {
            createMutation.mutate(payload);
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

                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id="encomendas_habilitadas"
                                checked={formData.encomendas_habilitadas !== false}
                                onChange={(e) => setFormData({ ...formData, encomendas_habilitadas: e.target.checked })}
                                className="rounded"
                            />
                            <Label htmlFor="encomendas_habilitadas" className="cursor-pointer">
                                Encomendas Habilitadas
                            </Label>
                            <span className="text-xs text-gray-400">
                                (permite venda por encomenda quando estoque zerado)
                            </span>
                        </div>

                        <div className="rounded-lg border p-3 space-y-3 bg-gray-50">
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="usar_markup_padrao"
                                    checked={Boolean(formData.usar_markup_padrao)}
                                    onChange={(e) => setFormData({ ...formData, usar_markup_padrao: e.target.checked })}
                                    className="rounded"
                                />
                                <Label htmlFor="usar_markup_padrao" className="cursor-pointer">
                                    Usar markup fixo deste fornecedor
                                </Label>
                            </div>

                            <div className="grid md:grid-cols-2 gap-3">
                                <div>
                                    <Label htmlFor="markup_padrao_multiplicador">Markup Multiplicador</Label>
                                    <Input
                                        id="markup_padrao_multiplicador"
                                        type="number"
                                        step="0.0001"
                                        min="1"
                                        value={formData.markup_padrao_multiplicador ?? ""}
                                        onChange={(e) => {
                                            const multiplierText = e.target.value;
                                            const multiplier = parseFloat(multiplierText || 0);
                                            setFormData((prev) => ({
                                                ...prev,
                                                markup_padrao_multiplicador: multiplierText,
                                                markup_padrao_percentual: multiplier > 0 ? toPercentFromMultiplier(multiplier).toString() : "",
                                            }));
                                        }}
                                        placeholder="Ex: 1.45"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="markup_padrao_percentual">Markup Percentual (%)</Label>
                                    <Input
                                        id="markup_padrao_percentual"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={formData.markup_padrao_percentual ?? ""}
                                        onChange={(e) => {
                                            const percentText = e.target.value;
                                            const percent = parseFloat(percentText || 0);
                                            setFormData((prev) => ({
                                                ...prev,
                                                markup_padrao_percentual: percentText,
                                                markup_padrao_multiplicador: percentText === "" ? "" : toMultiplierFromPercent(percent).toString(),
                                            }));
                                        }}
                                        placeholder="Ex: 45"
                                    />
                                </div>
                            </div>
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
