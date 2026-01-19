import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Percent, DollarSign, CreditCard, Save, AlertCircle, Banknote, Smartphone, FileText } from "lucide-react";
import { toast } from "sonner";

// Cores fixas por forma de pagamento (case-insensitive matching)
const CORES_PAGAMENTO = {
    "dinheiro": { bg: "bg-green-50", border: "border-green-300", icon: "bg-green-100 text-green-700" },
    "pix": { bg: "bg-cyan-50", border: "border-cyan-300", icon: "bg-cyan-100 text-cyan-700" },
    "crédito 1x": { bg: "bg-purple-50", border: "border-purple-300", icon: "bg-purple-100 text-purple-700" },
    "crédito parcelado": { bg: "bg-violet-50", border: "border-violet-300", icon: "bg-violet-100 text-violet-700" },
    "débito": { bg: "bg-blue-50", border: "border-blue-300", icon: "bg-blue-100 text-blue-700" },
    "boleto": { bg: "bg-orange-50", border: "border-orange-300", icon: "bg-orange-100 text-orange-700" },
    "multicrédito": { bg: "bg-pink-50", border: "border-pink-300", icon: "bg-pink-100 text-pink-700" },
    "afesp": { bg: "bg-amber-50", border: "border-amber-300", icon: "bg-amber-100 text-amber-700" },
    "crediário": { bg: "bg-yellow-50", border: "border-yellow-300", icon: "bg-yellow-100 text-yellow-700" },
    "financiamento": { bg: "bg-indigo-50", border: "border-indigo-300", icon: "bg-indigo-100 text-indigo-700" },
    "transferência": { bg: "bg-teal-50", border: "border-teal-300", icon: "bg-teal-100 text-teal-700" },
    "cheque": { bg: "bg-slate-50", border: "border-slate-300", icon: "bg-slate-100 text-slate-700" },
};

const getCor = (forma) => {
    const formaLower = forma.toLowerCase().trim();
    // Match exato
    if (CORES_PAGAMENTO[formaLower]) return CORES_PAGAMENTO[formaLower];
    // Match parcial
    for (const [key, value] of Object.entries(CORES_PAGAMENTO)) {
        if (formaLower.includes(key) || key.includes(formaLower)) return value;
    }
    return { bg: "bg-gray-50", border: "border-gray-300", icon: "bg-gray-100 text-gray-600" };
};

const getIcone = (forma) => {
    const f = forma.toLowerCase();
    if (f.includes('crédito') || f.includes('credito')) return <CreditCard className="w-4 h-4" />;
    if (f.includes('débito') || f.includes('debito')) return <CreditCard className="w-4 h-4" />;
    if (f.includes('pix')) return <Smartphone className="w-4 h-4" />;
    if (f.includes('dinheiro')) return <Banknote className="w-4 h-4" />;
    if (f.includes('boleto')) return <FileText className="w-4 h-4" />;
    return <DollarSign className="w-4 h-4" />;
};

export default function ConfiguracaoTaxas() {
    const queryClient = useQueryClient();
    const [editando, setEditando] = useState({});

    const { data: taxas = [], isLoading } = useQuery({
        queryKey: ['configuracao_taxas'],
        queryFn: () => base44.entities.ConfiguracaoTaxa.list()
    });

    // Ordenar alfabeticamente e manter posição fixa
    const taxasOrdenadas = useMemo(() => {
        return [...taxas].sort((a, b) => a.forma_pagamento.localeCompare(b.forma_pagamento, 'pt-BR'));
    }, [taxas]);

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.ConfiguracaoTaxa.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['configuracao_taxas'] });
            toast.success("Taxa atualizada com sucesso!");
        },
        onError: (err) => toast.error("Erro ao atualizar: " + err.message)
    });

    const handleEdit = (taxa) => {
        setEditando({
            ...editando,
            [taxa.id]: {
                tipo_taxa: taxa.tipo_taxa,
                valor: taxa.valor,
                ativa: taxa.ativa
            }
        });
    };

    const handleSave = (taxa) => {
        const dados = editando[taxa.id];
        if (!dados) return;

        updateMutation.mutate({
            id: taxa.id,
            data: {
                tipo_taxa: dados.tipo_taxa,
                valor: parseFloat(dados.valor),
                ativa: dados.ativa
            }
        });

        setEditando(prev => {
            const novo = { ...prev };
            delete novo[taxa.id];
            return novo;
        });
    };

    const handleChange = (taxaId, campo, valor) => {
        setEditando(prev => ({
            ...prev,
            [taxaId]: {
                ...prev[taxaId],
                [campo]: valor
            }
        }));
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-green-700" />
            </div>
        );
    }

    if (taxas.length === 0) {
        return (
            <Alert className="bg-yellow-50 border-yellow-200">
                <AlertCircle className="w-4 h-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800">
                    Nenhuma taxa configurada. Execute o SQL de setup no Supabase para criar as taxas padrão.
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="space-y-4">
            <Card className="border-0 shadow-lg">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2" style={{ color: '#07593f' }}>
                        <Percent className="w-6 h-6" />
                        Taxas por Forma de Pagamento
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-gray-500 mb-6">
                        Configure as taxas de cada forma de pagamento para o cálculo automático do financeiro.
                    </p>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {taxasOrdenadas.map(taxa => {
                            const isEditing = editando[taxa.id];
                            const dados = isEditing || taxa;
                            const cores = getCor(taxa.forma_pagamento);

                            return (
                                <Card
                                    key={taxa.id}
                                    className={`${cores.bg} ${cores.border} border-2 transition-all ${!dados.ativa ? 'opacity-50 grayscale' : ''}`}
                                >
                                    <CardHeader className="pb-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl ${cores.icon} flex items-center justify-center`}>
                                                    {getIcone(taxa.forma_pagamento)}
                                                </div>
                                                <div>
                                                    <CardTitle className="text-sm font-bold">{taxa.forma_pagamento}</CardTitle>
                                                    <p className="text-xs text-gray-500">{taxa.descricao}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                        {isEditing ? (
                                            <div className="space-y-3 pt-2">
                                                <div className="flex gap-2">
                                                    <div className="flex-1">
                                                        <Label className="text-xs font-medium">Tipo</Label>
                                                        <Select
                                                            value={dados.tipo_taxa}
                                                            onValueChange={(v) => handleChange(taxa.id, 'tipo_taxa', v)}
                                                        >
                                                            <SelectTrigger className="h-9 mt-1 bg-white">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="porcentagem">Porcentagem (%)</SelectItem>
                                                                <SelectItem value="fixo">Valor Fixo (R$)</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="w-28">
                                                        <Label className="text-xs font-medium">Valor</Label>
                                                        <div className="relative mt-1">
                                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">
                                                                {dados.tipo_taxa === 'porcentagem' ? '%' : 'R$'}
                                                            </span>
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                className="h-9 pl-8 bg-white"
                                                                value={dados.valor}
                                                                onChange={(e) => handleChange(taxa.id, 'valor', e.target.value)}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between pt-1">
                                                    <div className="flex items-center gap-2">
                                                        <Switch
                                                            checked={dados.ativa}
                                                            onCheckedChange={(v) => handleChange(taxa.id, 'ativa', v)}
                                                        />
                                                        <span className="text-xs font-medium">Taxa ativa</span>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        className="h-8 bg-green-600 hover:bg-green-700"
                                                        onClick={() => handleSave(taxa)}
                                                        disabled={updateMutation.isPending}
                                                    >
                                                        {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
                                                        Salvar
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between pt-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-2xl" style={{ color: '#07593f' }}>
                                                        {dados.tipo_taxa === 'porcentagem' ? `${dados.valor}%` : `R$ ${parseFloat(dados.valor).toFixed(2)}`}
                                                    </span>
                                                    {!dados.ativa && (
                                                        <Badge variant="secondary" className="text-xs">Inativa</Badge>
                                                    )}
                                                </div>
                                                <Button variant="outline" size="sm" className="h-8 bg-white" onClick={() => handleEdit(taxa)}>
                                                    Editar
                                                </Button>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            <Alert className="bg-blue-50 border-blue-200">
                <AlertCircle className="w-4 h-4 text-blue-600" />
                <AlertDescription className="text-blue-800 text-sm">
                    <strong>Como funciona:</strong> Quando uma venda é finalizada, o sistema automaticamente calcula e lança as taxas no financeiro,
                    mostrando o valor bruto, as deduções (taxas e descontos) e o valor líquido.
                </AlertDescription>
            </Alert>
        </div>
    );
}
