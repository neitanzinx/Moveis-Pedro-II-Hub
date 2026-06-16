import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Save, Truck, Plus, Trash2 } from "lucide-react";

export default function ConfiguracaoPrazos() {
    const [prazos, setPrazos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [novoPrazoModalOpen, setNovoPrazoModalOpen] = useState(false);
    const [novoPrazoData, setNovoPrazoData] = useState({
        titulo: "",
        quantidade_dias: "",
        tipo_dias: "uteis"
    });
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        fetchPrazos();
    }, []);

    const fetchPrazos = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from("prazos_entrega")
                .select("*")
                .order("identificador");

            if (error) throw error;
            setPrazos(data || []);
        } catch (err) {
            console.error("Erro ao carregar prazos:", err);
            toast.error("Erro ao carregar configurações de prazos");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdatePrazo = (id, field, value) => {
        setPrazos(prev => prev.map(p =>
            p.id === id ? { ...p, [field]: value } : p
        ));
    };

    const handleSave = async (prazo) => {
        try {
            setSaving(prazo.id);
            const { error } = await supabase
                .from("prazos_entrega")
                .update({
                    titulo: prazo.titulo,
                    quantidade_dias: parseInt(prazo.quantidade_dias),
                    tipo_dias: prazo.tipo_dias,
                    updated_at: new Date().toISOString()
                })
                .eq("id", prazo.id);

            if (error) throw error;
            toast.success(`${prazo.titulo} atualizado com sucesso!`);
        } catch (err) {
            console.error("Erro ao salvar prazo:", err);
            toast.error("Erro ao salvar configurações");
        } finally {
            setSaving(false);
        }
    };

    const handleCreatePrazo = async () => {
        if (!novoPrazoData.titulo.trim()) {
            toast.error("O título é obrigatório");
            return;
        }
        if (!novoPrazoData.quantidade_dias || parseInt(novoPrazoData.quantidade_dias) <= 0) {
            toast.error("A quantidade de dias deve ser maior que 0");
            return;
        }

        try {
            setCreating(true);
            const slug = novoPrazoData.titulo
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9]+/g, "_")
                .replace(/(^_+|_+$)/g, "");
            
            const identificador = `${slug}_${Math.random().toString(36).substring(2, 7)}`;

            const { error } = await supabase
                .from("prazos_entrega")
                .insert({
                    identificador,
                    titulo: novoPrazoData.titulo,
                    quantidade_dias: parseInt(novoPrazoData.quantidade_dias),
                    tipo_dias: novoPrazoData.tipo_dias
                });

            if (error) throw error;

            toast.success("Novo prazo de entrega criado com sucesso!");
            setNovoPrazoModalOpen(false);
            setNovoPrazoData({ titulo: "", quantidade_dias: "", tipo_dias: "uteis" });
            fetchPrazos();
        } catch (err) {
            console.error("Erro ao criar prazo:", err);
            toast.error("Erro ao criar prazo de entrega");
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (id, titulo) => {
        if (!window.confirm(`Tem certeza que deseja excluir o prazo "${titulo}"?`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from("prazos_entrega")
                .delete()
                .eq("id", id);
            if (error) throw error;
            toast.success(`Prazo "${titulo}" excluído com sucesso!`);
            fetchPrazos();
        } catch (err) {
            console.error("Erro ao excluir prazo:", err);
            toast.error("Erro ao excluir o prazo");
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-green-600" />
            </div>
        );
    }
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Prazos de Entrega</h2>
                    <p className="text-muted-foreground">
                        Configure os prazos que aparecem no PDV e como eles são calculados.
                    </p>
                </div>
                <Button onClick={() => setNovoPrazoModalOpen(true)} className="bg-green-600 hover:bg-green-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Prazo
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {prazos.map((prazo) => (
                    <Card key={prazo.id}>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Truck className="w-5 h-5 text-green-600" />
                                    <CardTitle>{prazo.titulo}</CardTitle>
                                </div>
                                {prazo.identificador !== "pronta_entrega" && prazo.identificador !== "encomenda" && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8"
                                        onClick={() => handleDelete(prazo.id, prazo.titulo)}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                )}
                            </div>
                            <CardDescription>
                                Configuração para o identificador: {prazo.identificador}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Título Exibido no PDV</Label>
                                <Input
                                    value={prazo.titulo}
                                    onChange={(e) => handleUpdatePrazo(prazo.id, 'titulo', e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Quantidade de Dias</Label>
                                    <Input
                                        type="number"
                                        value={prazo.quantidade_dias}
                                        onChange={(e) => handleUpdatePrazo(prazo.id, 'quantidade_dias', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Tipo de Dias</Label>
                                    <Select
                                        value={prazo.tipo_dias}
                                        onValueChange={(v) => handleUpdatePrazo(prazo.id, 'tipo_dias', v)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="uteis">Dias Úteis</SelectItem>
                                            <SelectItem value="corridos">Dias Corridos</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <Button
                                className="w-full bg-green-600 hover:bg-green-700"
                                onClick={() => handleSave(prazo)}
                                disabled={saving === prazo.id}
                            >
                                {saving === prazo.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                ) : (
                                    <Save className="w-4 h-4 mr-2" />
                                )}
                                Salvar Alterações
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Dialog open={novoPrazoModalOpen} onOpenChange={setNovoPrazoModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Adicionar Novo Prazo de Entrega</DialogTitle>
                        <DialogDescription>
                            Cadastre um novo prazo para ser utilizado nas vendas e entregas.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="novo-titulo">Título Exibido no PDV</Label>
                            <Input
                                id="novo-titulo"
                                placeholder="Ex: Prazo Especial, 30 dias úteis"
                                value={novoPrazoData.titulo}
                                onChange={(e) => setNovoPrazoData({ ...novoPrazoData, titulo: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="novo-dias">Quantidade de Dias</Label>
                                <Input
                                    id="novo-dias"
                                    type="number"
                                    placeholder="Ex: 30"
                                    value={novoPrazoData.quantidade_dias}
                                    onChange={(e) => setNovoPrazoData({ ...novoPrazoData, quantidade_dias: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="novo-tipo">Tipo de Dias</Label>
                                <Select
                                    value={novoPrazoData.tipo_dias}
                                    onValueChange={(v) => setNovoPrazoData({ ...novoPrazoData, tipo_dias: v })}
                                >
                                    <SelectTrigger id="novo-tipo">
                                        <SelectValue placeholder="Selecione..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="uteis">Dias Úteis</SelectItem>
                                        <SelectItem value="corridos">Dias Corridos</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setNovoPrazoModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button
                            className="bg-green-600 hover:bg-green-700"
                            onClick={handleCreatePrazo}
                            disabled={creating}
                        >
                            {creating ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                                <Plus className="w-4 h-4 mr-2" />
                            )}
                            Criar Prazo
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
