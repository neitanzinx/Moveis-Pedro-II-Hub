import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/contexts/TenantContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    Calculator, ArrowRight, Info, TrendingUp, Settings, HandCoins, Loader2, Save
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Categorias padrão do sistema
const CATEGORIAS = [
    "Sofa", "Cama", "Mesa", "Cadeira", "Armario", "Estante", "Rack",
    "Poltrona", "Escrivaninha", "Criado-mudo", "Buffet", "Aparador",
    "Banco", "Colchao", "Guarda-roupa", "Comoda", "Painel", "Outros"
];

const TAXA_PADRAO_IMPOSTO = 18; // 18% padrão se não configurado

export default function ConfiguracaoMarkup() {
    const { settings, updateSettings, isLoading: loadingSettings } = useTenant();
    const [margens, setMargens] = useState({});
    const [salvando, setSalvando] = useState(false);
    const [recalculando, setRecalculando] = useState(false);
    const [impostoEstimado, setImpostoEstimado] = useState(TAXA_PADRAO_IMPOSTO);

    const queryClient = useQueryClient();

    // Carregar configurações do tenant quando disponíveis
    useEffect(() => {
        if (settings?.markup_categorias) {
            setMargens(settings.markup_categorias);
        } else {
            // Inicializa com padrão se vazio
            const padroes = {};
            CATEGORIAS.forEach(cat => padroes[cat] = 45); // 45% default
            setMargens(padroes);
        }

        if (settings?.imposto_padrao) {
            setImpostoEstimado(settings.imposto_padrao);
        }
    }, [settings]);

    const { data: produtos = [], isLoading: loadingProdutos } = useQuery({
        queryKey: ['produtos_markup'],
        queryFn: () => base44.entities.Produto.list('nome'),
        staleTime: 1000 * 60 * 5 // 5 minutos cache
    });

    const handleMargemChange = (categoria, valor) => {
        const numValue = Math.max(0, Math.min(500, parseInt(valor) || 0));
        setMargens(prev => ({ ...prev, [categoria]: numValue }));
    };

    const salvarConfiguracoes = async () => {
        setSalvando(true);
        try {
            await updateSettings({
                markup_categorias: margens,
                imposto_padrao: impostoEstimado
            });
            toast.success("Configurações de markup salvas com sucesso!");
        } catch (error) {
            console.error(error);
            toast.error("Erro ao salvar configurações");
        } finally {
            setSalvando(false);
        }
    };

    const recalcularTodosProdutos = async () => {
        if (produtos.length === 0) {
            toast.error("Nenhum produto encontrado para recalcular");
            return;
        }

        const produtosComCusto = produtos.filter(p => p.preco_custo_tabela > 0 && p.categoria);
        if (produtosComCusto.length === 0) {
            toast.error("Nenhum produto com custo de tabela e categoria definidos");
            return;
        }

        // Confirmação antes de processar
        if (!window.confirm(`Isso irá atualizar o preço de VENDA de ${produtosComCusto.length} produtos baseado no CUSTO TABELA. Deseja continuar?`)) {
            return;
        }

        setRecalculando(true);
        let atualizados = 0;
        let erros = 0;

        try {
            // Processamento em lotes para não travar a UI
            const batchSize = 10;
            for (let i = 0; i < produtosComCusto.length; i += batchSize) {
                const batch = produtosComCusto.slice(i, i + batchSize);
                await Promise.all(batch.map(async (produto) => {
                    try {
                        const margemConfigurada = (margens[produto.categoria] || 45) / 100;
                        const custo = parseFloat(produto.preco_custo_tabela);

                        // Fórmula: Custo * (1 + Margem) * (1 + Imposto)
                        // Ex: 100 * 1.45 * 1.18 = 171.10
                        let novoPreco = custo * (1 + margemConfigurada);
                        novoPreco *= (1 + (impostoEstimado / 100));
                        novoPreco = Math.ceil(novoPreco); // Arredondar para cima (estratégia comercial)

                        // Só atualiza se mudar (reduz chamadas)
                        if (parseFloat(produto.preco_venda) !== novoPreco) {
                            await base44.entities.Produto.update(produto.id, {
                                preco_venda: novoPreco
                            });
                            atualizados++;
                        }
                    } catch (err) {
                        console.error(`Erro ao atualizar ${produto.nome}:`, err);
                        erros++;
                    }
                }));
            }

            queryClient.invalidateQueries({ queryKey: ['produtos_markup'] });
            queryClient.invalidateQueries({ queryKey: ['produtos'] }); // Atualiza lista geral

            if (erros === 0) {
                toast.success(`${atualizados} preços atualizados com sucesso!`);
            } else {
                toast.warning(`${atualizados} atualizados, ${erros} com erro`);
            }
        } catch (error) {
            toast.error("Erro ao processar: " + error.message);
        } finally {
            setRecalculando(false);
        }
    };

    const produtosPorCategoria = CATEGORIAS.reduce((acc, cat) => {
        acc[cat] = produtos.filter(p => p.categoria === cat).length;
        return acc;
    }, {});

    if (loadingSettings) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-green-600" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <HandCoins className="w-8 h-8 text-green-600" />
                    Precificação Automática
                </h2>
                <p className="text-gray-500 mt-1">
                    Defina as margens de lucro padrão para cada categoria de produto.
                </p>
            </div>

            {/* Configuração Global */}
            <Card className="border-t-4 border-t-yellow-500 shadow-sm">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Settings className="w-5 h-5 text-gray-500" />
                        Parâmetros Globais
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-end gap-4 p-4 bg-yellow-50 rounded-lg border border-yellow-100">
                        <div className="space-y-2">
                            <Label>Imposto Médio Estimado (%)</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    type="number"
                                    value={impostoEstimado}
                                    onChange={(e) => setImpostoEstimado(e.target.value)}
                                    className="w-24 bg-white"
                                />
                                <span className="text-gray-500">%</span>
                            </div>
                            <p className="text-xs text-gray-500">Adicionado ao preço final para cobrir impostos.</p>
                        </div>
                        <div className="flex-1 text-sm text-yellow-800">
                            <strong>Fórmula de Precificação:</strong><br />
                            <code className="bg-white px-2 py-1 rounded border border-yellow-200 mt-1 block w-fit">
                                Preço = Custo Tabela × (1 + Margem%) × (1 + Imposto%)
                            </code>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Tabela de Markup */}
            <Card className="border-t-4 border-t-green-600 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-gray-500" />
                            Margens por Categoria
                        </CardTitle>
                        <CardDescription>
                            Ajuste o markup aplicado sobre o custo de tabela.
                        </CardDescription>
                    </div>
                    <Button
                        onClick={recalcularTodosProdutos}
                        disabled={recalculando || loadingProdutos}
                        variant="outline"
                        size="sm"
                        className="text-blue-600 border-blue-200 hover:bg-blue-50"
                    >
                        {recalculando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Calculator className="w-4 h-4 mr-2" />}
                        Recalcular Tabela Atual
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-xl overflow-hidden shadow-sm">
                        <Table>
                            <TableHeader className="bg-gray-50">
                                <TableRow>
                                    <TableHead className="w-[200px] font-semibold">Categoria</TableHead>
                                    <TableHead className="w-[150px] text-center font-semibold">Margem Lucro</TableHead>
                                    <TableHead className="w-[150px] text-right font-semibold">Produtos Ativos</TableHead>
                                    <TableHead className="text-right font-semibold">Simulação (Custo R$ 100)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {CATEGORIAS.map(categoria => {
                                    const margem = margens[categoria] || 45;
                                    // Simulação: 100 * (1+margem) * (1+imposto)
                                    const precoExemplo = 100 * (1 + margem / 100) * (1 + (parseFloat(impostoEstimado) || 0) / 100);

                                    return (
                                        <TableRow key={categoria} className="hover:bg-gray-50 transition-colors">
                                            <TableCell className="font-medium">
                                                <Badge variant="outline" className="font-normal text-sm px-3 py-1 bg-white">
                                                    {categoria}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="relative flex items-center justify-center">
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        max="500"
                                                        value={margem}
                                                        onChange={(e) => handleMargemChange(categoria, e.target.value)}
                                                        className="w-20 pr-8 text-center font-bold text-green-700 bg-green-50/50 border-green-200 focus:border-green-500 focus:ring-green-200"
                                                    />
                                                    <span className="absolute right-8 top-1/2 -translate-y-1/2 text-green-600 text-xs font-bold">%</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right text-gray-500">
                                                {produtosPorCategoria[categoria] || "-"}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2 text-gray-600">
                                                    <span className="text-xs">R$ 100 ➔</span>
                                                    <span className="font-mono font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded">
                                                        R$ {Math.ceil(precoExemplo).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Footer Fixo */}
            <div className="flex justify-end pt-4 bg-white/50 backdrop-blur-sm sticky bottom-0 pb-4 border-t">
                <Button
                    onClick={salvarConfiguracoes}
                    disabled={salvando}
                    className="bg-green-700 hover:bg-green-800 text-white shadow-lg min-w-[200px]"
                >
                    {salvando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Salvar Alterações
                </Button>
            </div>
        </div>
    );
}
