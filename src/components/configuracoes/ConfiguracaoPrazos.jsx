import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Save, Truck } from "lucide-react";

export default function ConfiguracaoPrazos() {
    const [prazos, setPrazos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

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
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {prazos.map((prazo) => (
                    <Card key={prazo.id}>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Truck className="w-5 h-5 text-green-600" />
                                <CardTitle>{prazo.titulo}</CardTitle>
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
        </div>
    );
}
