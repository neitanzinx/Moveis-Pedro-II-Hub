import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { Save, CheckSquare, Square, Trash2, Filter } from 'lucide-react';

export default function SaneamentoEstoque() {
    const { toast } = useToast();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedGtins, setSelectedGtins] = useState(new Set());
    const [saving, setSaving] = useState(false);

    // Shortcuts for NCM
    const NCM_SHORTCUTS = [
        { label: 'Cozinha (9403.40.00)', value: '9403.40.00', color: 'bg-orange-100 hover:bg-orange-200 text-orange-800' },
        { label: 'Quarto (9403.50.00)', value: '9403.50.00', color: 'bg-blue-100 hover:bg-blue-200 text-blue-800' },
        { label: 'Escritório (9403.30.00)', value: '9403.30.00', color: 'bg-slate-100 hover:bg-slate-200 text-slate-800' },
        { label: 'Estofado (9401.61.00)', value: '9401.61.00', color: 'bg-purple-100 hover:bg-purple-200 text-purple-800' },
    ];

    useEffect(() => {
        fetchPendingProducts();
    }, []);

    const fetchPendingProducts = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('produtos_mestre')
            .select('*')
            .eq('status', 'REVISAO_PENDENTE')
            .order('created_at', { ascending: false });

        if (error) {
            console.error(error);
            toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
        } else {
            setProducts(data || []);
        }
        setLoading(false);
    };

    const handleSelect = (gtin) => {
        const newSet = new Set(selectedGtins);
        if (newSet.has(gtin)) newSet.delete(gtin);
        else newSet.add(gtin);
        setSelectedGtins(newSet);
    };

    const handleSelectAll = () => {
        if (selectedGtins.size === products.length) {
            setSelectedGtins(new Set());
        } else {
            setSelectedGtins(new Set(products.map(p => p.gtin)));
        }
    };

    const updateField = (gtin, field, value) => {
        setProducts(prev => prev.map(p =>
            p.gtin === gtin ? { ...p, [field]: value } : p
        ));
    };

    const applyBulkNcm = (ncm) => {
        setProducts(prev => prev.map(p =>
            selectedGtins.has(p.gtin) ? { ...p, ncm: ncm } : p
        ));
        toast({ title: "Aplicado", description: `NCM ${ncm} aplicado a ${selectedGtins.size} itens.` });
    };

    const saveChanges = async () => {
        setSaving(true);
        const updates = products.filter(p => selectedGtins.has(p.gtin));

        if (updates.length === 0) {
            setSaving(false);
            return;
        }

        try {
            // Only update products that are complete enough to be valid? 
            // Or just save whatever is edited.
            // Let's assume we validate Name and NCM are present to mark as COMPLETO

            const toUpsert = updates.map(p => ({
                ...p,
                status: (p.nome && p.ncm) ? 'COMPLETO' : 'REVISAO_PENDENTE'
            }));

            const { error } = await supabase
                .from('produtos_mestre')
                .upsert(toUpsert);

            if (error) throw error;

            toast({ title: "Salvo com sucesso!", description: `${updates.length} itens atualizados.` });

            // Refresh list (filtering out those that became COMPLETO)
            fetchPendingProducts();
            setSelectedGtins(new Set());

        } catch (error) {
            console.error(error);
            toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    const progress = products.length === 0 ? 100 : 0; // Ideally should track "Done" vs "Pending" but here we only query Pending.
    // Let's fake progress or just show counts.

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Saneamento de Dados</h1>
                    <p className="text-muted-foreground">Corrija produtos incompletos importados via scanner.</p>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-sm font-medium bg-secondary px-3 py-1 rounded-full">
                        {products.length} Pendentes
                    </span>
                </div>
            </div>

            {/* Bulk Actions Bar */}
            <Card className="bg-slate-50 border-slate-200">
                <CardContent className="p-4 flex flex-wrap items-center gap-4">
                    <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <Filter className="h-4 w-4" /> Ações em Massa ({selectedGtins.size}):
                    </span>

                    {NCM_SHORTCUTS.map(shortcut => (
                        <Button
                            key={shortcut.value}
                            variant="outline"
                            size="sm"
                            className={`border-none ${shortcut.color} transition-colors`}
                            onClick={() => applyBulkNcm(shortcut.value)}
                            disabled={selectedGtins.size === 0}
                        >
                            {shortcut.label}
                        </Button>
                    ))}

                    <div className="flex-1"></div>

                    <Button
                        onClick={saveChanges}
                        disabled={selectedGtins.size === 0 || saving}
                        className="bg-green-600 hover:bg-green-700 text-white"
                    >
                        {saving ? "Salvando..." : (
                            <><Save className="mr-2 h-4 w-4" /> Salvar e Finalizar</>
                        )}
                    </Button>
                </CardContent>
            </Card>

            {/* Products Table */}
            <div className="border rounded-md bg-white shadow-sm overflow-hidden">
                <div className="grid grid-cols-[50px_1fr_1fr_1fr_100px] gap-4 p-4 bg-gray-50 border-b font-medium text-sm text-gray-500">
                    <div className="flex justify-center items-center">
                        <Checkbox
                            checked={products.length > 0 && selectedGtins.size === products.length}
                            onCheckedChange={handleSelectAll}
                        />
                    </div>
                    <div>Produto / GTIN</div>
                    <div>Marca</div>
                    <div>NCM</div>
                    <div className="text-right">Ação</div>
                </div>

                {loading ? (
                    <div className="p-8 text-center text-gray-400">Carregando...</div>
                ) : products.length === 0 ? (
                    <div className="p-12 text-center text-green-600 bg-green-50">
                        <CheckSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <h3 className="text-lg font-medium">Tudo limpo!</h3>
                        <p>Não há produtos pendentes de revisão.</p>
                    </div>
                ) : (
                    <div className="divide-y max-h-[600px] overflow-auto">
                        {products.map(product => (
                            <div
                                key={product.gtin}
                                className={`grid grid-cols-[50px_1fr_1fr_1fr_100px] gap-4 p-4 items-center transition-colors hover:bg-gray-50
                                    ${selectedGtins.has(product.gtin) ? 'bg-blue-50/50' : ''}
                                `}
                            >
                                <div className="flex justify-center">
                                    <Checkbox
                                        checked={selectedGtins.has(product.gtin)}
                                        onCheckedChange={() => handleSelect(product.gtin)}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <Input
                                        value={product.nome}
                                        onChange={(e) => updateField(product.gtin, 'nome', e.target.value)}
                                        className="h-8 font-medium"
                                        placeholder="Nome do Produto"
                                    />
                                    <span className="text-xs text-muted-foreground pl-1">{product.gtin}</span>
                                </div>

                                <div>
                                    <Input
                                        value={product.marca || ''}
                                        onChange={(e) => updateField(product.gtin, 'marca', e.target.value)}
                                        className="h-8"
                                        placeholder="Marca"
                                    />
                                </div>

                                <div>
                                    <Input
                                        value={product.ncm || ''}
                                        onChange={(e) => updateField(product.gtin, 'ncm', e.target.value)}
                                        className="h-8 font-mono text-xs"
                                        placeholder="0000.00.00"
                                    />
                                </div>

                                <div className="text-right">
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:text-red-600">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
