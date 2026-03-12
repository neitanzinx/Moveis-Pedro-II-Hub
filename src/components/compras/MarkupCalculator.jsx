import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { comprasService } from '@/services/comprasService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Calculator, Save, RefreshCw, Plus, Trash2, ArrowRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function MarkupCalculator({ fornecedorId, fornecedorNome }) {
    const queryClient = useQueryClient();
    const { can } = useAuth();

    // Default config values based on new structure
    const [config, setConfig] = useState({
        fornecedor_id: fornecedorId,
        regras: [{ tipo: 'desconto', valor: 0, descricao: 'Desconto Inicial' }],
        multiplicador_final: 2.5,
        bonus_valor: {
            minimo: 10000,
            desconto_extra: 5
        }
    });

    const [simulacao, setSimulacao] = useState({
        custo: 100,
        valorPedido: 0,
        resultado: null
    });

    const { data: markupData, isLoading } = useQuery({
        queryKey: ['markup_config', fornecedorId],
        queryFn: () => comprasService.getMarkupConfig(fornecedorId),
        enabled: !!fornecedorId
    });

    useEffect(() => {
        if (markupData) {
            setConfig({
                id: markupData.id,
                fornecedor_id: fornecedorId,
                regras: markupData.regras || [],
                multiplicador_final: markupData.multiplicador_final || 2.5,
                bonus_valor: markupData.bonus_valor || { minimo: 0, desconto_extra: 0 }
            });
        }
    }, [markupData, fornecedorId]);

    const handleAddRegra = () => {
        setConfig(prev => ({
            ...prev,
            regras: [...prev.regras, { tipo: 'desconto', valor: 0, descricao: '' }]
        }));
    };

    const handleRemoveRegra = (index) => {
        setConfig(prev => ({
            ...prev,
            regras: prev.regras.filter((_, i) => i !== index)
        }));
    };

    const handleRegraChange = (index, field, value) => {
        const newRegras = [...config.regras];
        newRegras[index] = { ...newRegras[index], [field]: field === 'valor' ? parseFloat(value) || 0 : value };
        setConfig(prev => ({ ...prev, regras: newRegras }));
    };

    const handleSimular = () => {
        const res = comprasService.calcularPrecoVenda(simulacao.custo, config, simulacao.valorPedido);
        setSimulacao(prev => ({ ...prev, resultado: res }));
    };

    const saveMutation = useMutation({
        mutationFn: (data) => comprasService.saveMarkupConfig(data),
        onSuccess: () => {
            toast.success("Configuração de markup salva!");
            queryClient.invalidateQueries({ queryKey: ['markup_config', fornecedorId] });
        },
        onError: (err) => {
            toast.error("Erro ao salvar: " + err.message);
        }
    });

    const handleSave = () => {
        saveMutation.mutate(config);
    };

    if (!fornecedorId) return null;
    if (!can('Gerenciar Pedidos de Compra')) return null;

    return (
        <div className="space-y-6">
            <Card className="shadow-sm border-blue-100">
                <CardHeader className="bg-blue-50/50 pb-4 border-b border-blue-100">
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle className="text-lg flex items-center gap-2 text-blue-800">
                                <Calculator className="w-5 h-5 text-blue-600" />
                                Calculadora de Markup por Fornecedor
                            </CardTitle>
                            <CardDescription>
                                Configure as regras de custo e multiplicador para <span className="font-semibold">{fornecedorNome}</span>
                            </CardDescription>
                        </div>
                        <Button onClick={handleSave} disabled={saveMutation.isPending} className="bg-green-600 hover:bg-green-700">
                            <Save className="w-4 h-4 mr-2" />
                            Salvar Configuração
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                    {/* Regras Sequenciais */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-semibold text-gray-700">1. Sequência de Regras (Custo)</h3>
                            <Button variant="outline" size="sm" onClick={handleAddRegra} className="text-blue-600 border-blue-200">
                                <Plus className="w-4 h-4 mr-1" /> Add Regra
                            </Button>
                        </div>

                        <div className="space-y-2">
                            {config.regras.map((regra, index) => (
                                <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                                        {index + 1}
                                    </div>
                                    <Input
                                        placeholder="Ex: IPI, Desconto à vista..."
                                        value={regra.descricao}
                                        onChange={(e) => handleRegraChange(index, 'descricao', e.target.value)}
                                        className="flex-1"
                                    />
                                    <select
                                        className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                        value={regra.tipo}
                                        onChange={(e) => handleRegraChange(index, 'tipo', e.target.value)}
                                    >
                                        <option value="desconto">Desconto (-)</option>
                                        <option value="acrescimo">Acréscimo (+)</option>
                                    </select>
                                    <div className="relative w-24">
                                        <Input
                                            type="number"
                                            value={regra.valor}
                                            onChange={(e) => handleRegraChange(index, 'valor', e.target.value)}
                                            className="pr-6"
                                        />
                                        <span className="absolute right-2 top-2.5 text-gray-400 text-xs">%</span>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveRegra(index)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))}
                            {config.regras.length === 0 && (
                                <div className="text-center py-4 text-gray-400 italic text-sm border-2 border-dashed rounded-lg">
                                    Nenhuma regra adicionada. O custo original será mantido.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Multiplicador e Bônus */}
                        <div className="space-y-4">
                            <h3 className="font-semibold text-gray-700">2. Multiplicador e Bônus</h3>
                            <div className="p-4 bg-blue-50/50 rounded-lg border border-blue-100 space-y-4">
                                <div className="space-y-2">
                                    <Label>Multiplicador Final (Preço de Venda)</Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="number"
                                            step="0.1"
                                            value={config.multiplicador_final}
                                            onChange={e => setConfig(prev => ({ ...prev, multiplicador_final: parseFloat(e.target.value) || 0 }))}
                                            className="w-32"
                                        />
                                        <span className="text-sm text-gray-500 italic">Ex: 2.5 (Venda = Custo Líquido * 2.5)</span>
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-blue-100 space-y-3">
                                    <Label className="text-blue-800">Bônus por Valor do Pedido (Opcional)</Label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-gray-500 uppercase font-bold">Mínimo Pedido</span>
                                            <Input
                                                type="number"
                                                value={config.bonus_valor.minimo}
                                                onChange={e => setConfig(prev => ({ ...prev, bonus_valor: { ...prev.bonus_valor, minimo: parseFloat(e.target.value) || 0 } }))}
                                                placeholder="Ex: 10000"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-gray-500 uppercase font-bold">Desconto Extra (%)</span>
                                            <Input
                                                type="number"
                                                value={config.bonus_valor.desconto_extra}
                                                onChange={e => setConfig(prev => ({ ...prev, bonus_valor: { ...prev.bonus_valor, desconto_extra: parseFloat(e.target.value) || 0 } }))}
                                                placeholder="Ex: 5"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Simulador */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="font-semibold text-gray-700">3. Simulação Visual</h3>
                                <Button size="sm" variant="secondary" onClick={handleSimular} className="bg-blue-600 hover:bg-blue-700 text-white">
                                    <RefreshCw className="w-4 h-4 mr-2" /> Simular
                                </Button>
                            </div>
                            <div className="p-4 bg-gray-900 text-gray-100 rounded-lg font-mono text-sm space-y-3 min-h-[160px]">
                                <div className="flex gap-4 mb-4">
                                    <div className="flex-1">
                                        <label className="text-[10px] text-gray-400 block mb-1">CUSTO UNITÁRIO</label>
                                        <Input
                                            type="number"
                                            value={simulacao.custo}
                                            onChange={e => setSimulacao(prev => ({ ...prev, custo: parseFloat(e.target.value) || 0 }))}
                                            className="h-8 bg-gray-800 border-gray-700 text-white"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-[10px] text-gray-400 block mb-1">VALOR TOTAL PEDIDO</label>
                                        <Input
                                            type="number"
                                            value={simulacao.valorPedido}
                                            onChange={e => setSimulacao(prev => ({ ...prev, valorPedido: parseFloat(e.target.value) || 0 }))}
                                            className="h-8 bg-gray-800 border-gray-700 text-white"
                                        />
                                    </div>
                                </div>

                                {simulacao.resultado ? (
                                    <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                                        {simulacao.resultado.detalhamento.map((line, i) => (
                                            <div key={i} className="flex items-center gap-2">
                                                <ArrowRight className="w-3 h-3 text-blue-400" />
                                                <span className={i === simulacao.resultado.detalhamento.length - 1 ? "text-green-400 font-bold" : ""}>
                                                    {line}
                                                </span>
                                            </div>
                                        ))}
                                        <div className="mt-4 pt-2 border-t border-gray-700 text-center">
                                            <span className="text-gray-400">PREÇO SUGERIDO:</span>
                                            <div className="text-2xl text-green-400 font-black">
                                                R$ {simulacao.resultado.precoVenda.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-gray-500 italic">
                                        Clique em simular para ver o resultado...
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
