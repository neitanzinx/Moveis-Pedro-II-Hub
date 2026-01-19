import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, AlertTriangle, ArrowRight, Building2, Calculator, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/useConfirm";

export default function BulkPriceUpdateModal({ open, onClose, fornecedores = [] }) {
    const queryClient = useQueryClient();
    const confirm = useConfirm();

    // Estados do formulário
    const [step, setStep] = useState(1); // 1: Configuração, 2: Preview
    const [selectedFornecedorId, setSelectedFornecedorId] = useState("");
    const [updateType, setUpdateType] = useState("percentage"); // percentage | fixed
    const [updateValue, setUpdateValue] = useState("");

    // Busca produtos do fornecedor quando selecionado
    const { data: produtos = [], isLoading: loadingProdutos } = useQuery({
        queryKey: ['produtos-fornecedor', selectedFornecedorId],
        queryFn: () => base44.entities.Produto.list(),
        enabled: !!selectedFornecedorId
    });

    const produtosDoFornecedor = produtos.filter(p => p.fornecedor_id === selectedFornecedorId);

    // Mutation de atualização
    const bulkUpdate = useMutation({
        mutationFn: async (updates) => {
            // Executa atualizações sequencialmente ou em paralelo (aqui sequencial para garantir)
            // Idealmente a API teria um endpoint bulk, mas faremos loop
            const promises = updates.map(update =>
                base44.entities.Produto.update(update.id, {
                    preco_custo: update.novoPrecoCusto,
                    preco_venda: update.novoPrecoVenda,
                    // Histórico ou log poderia ser adicionado aqui
                })
            );
            return Promise.all(promises);
        },
        onSuccess: (results) => {
            queryClient.invalidateQueries({ queryKey: ['produtos'] });
            toast.success(`${results.length} produtos atualizados com sucesso!`);
            handleClose();
        },
        onError: (err) => {
            toast.error('Erro ao atualizar produtos: ' + err.message);
        }
    });

    // Calcular preview
    const previewData = React.useMemo(() => {
        if (!updateValue || produtosDoFornecedor.length === 0) return [];

        const valor = parseFloat(updateValue);
        if (isNaN(valor)) return [];

        return produtosDoFornecedor.map(prod => {
            let novoCusto = parseFloat(prod.preco_custo || 0);
            let novoVenda = parseFloat(prod.preco_venda || 0);

            if (updateType === 'percentage') {
                const fator = 1 + (valor / 100);
                novoCusto = novoCusto * fator;
                // Assumindo que o preço de venda também sobe na mesma proporção PARA MANTER MARGEM
                // Ou o usuário pode querer re-calcular margem depois?
                // Vamos assumir reajuste de custo -> reajuste de venda proporcional
                novoVenda = novoVenda * fator;
            } else {
                // Fixed amount usually adds to cost?
                novoCusto = novoCusto + valor;
                novoVenda = novoVenda + valor; // Repassa o aumento integral
            }

            return {
                id: prod.id,
                nome: prod.nome,
                custoAtual: prod.preco_custo || 0,
                vendaAtual: prod.preco_venda || 0,
                novoPrecoCusto: parseFloat(novoCusto.toFixed(2)),
                novoPrecoVenda: parseFloat(novoVenda.toFixed(2))
            };
        });
    }, [produtosDoFornecedor, updateType, updateValue]);

    const handleClose = () => {
        setStep(1);
        setSelectedFornecedorId("");
        setUpdateValue("");
        onClose();
    };

    const handleNext = () => {
        if (!selectedFornecedorId) {
            toast.error("Selecione um fornecedor");
            return;
        }
        if (!updateValue || isNaN(updateValue)) {
            toast.error("Informe um valor válido");
            return;
        }
        if (produtosDoFornecedor.length === 0) {
            toast.error("Este fornecedor não possui produtos cadastrados.");
            return;
        }
        setStep(2);
    };

    const handleApply = async () => {
        const confirmed = await confirm({
            title: "Confirmar Reajuste em Massa",
            message: `Você está prestes a atualizar o preço de ${previewData.length} produtos. Esta ação não pode ser desfeita automaticamente. Deseja continuar?`,
            confirmText: "Aplicar Reajuste",
            variant: "destructive" // Ação sensível
        });

        if (confirmed) {
            bulkUpdate.mutate(previewData);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Calculator className="w-6 h-6 text-blue-600" />
                        Reajuste de Preços em Massa
                    </DialogTitle>
                    <DialogDescription>
                        Atualize o preço de custo e venda de todos os produtos de um fornecedor de uma só vez.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    {/* Linha de progresso simples */}
                    <div className="flex items-center justify-center mb-8">
                        <div className={`flex items-center gap-2 ${step === 1 ? 'text-blue-600 font-bold' : 'text-gray-500'}`}>
                            <span className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-sm border-current">1</span>
                            Configuração
                        </div>
                        <div className="w-16 h-0.5 bg-gray-200 mx-4" />
                        <div className={`flex items-center gap-2 ${step === 2 ? 'text-blue-600 font-bold' : 'text-gray-500'}`}>
                            <span className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-sm border-current">2</span>
                            Confirmação
                        </div>
                    </div>

                    {step === 1 && (
                        <div className="space-y-6 max-w-lg mx-auto">
                            <div className="space-y-2">
                                <Label>Selecione o Fornecedor</Label>
                                <Select value={selectedFornecedorId} onValueChange={setSelectedFornecedorId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Buscar fornecedor..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {fornecedores.map(f => (
                                            <SelectItem key={f.id} value={f.id}>
                                                {f.nome_empresa}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {selectedFornecedorId && (
                                    <p className="text-xs text-gray-500">
                                        {loadingProdutos ? (
                                            <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Carregando produtos...</span>
                                        ) : (
                                            `${produtosDoFornecedor.length} produtos encontrados`
                                        )}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label>Tipo de Reajuste</Label>
                                <div className="grid grid-cols-2 gap-4">
                                    <div
                                        className={`p-4 border rounded-lg cursor-pointer transition-all flex flex-col items-center gap-2 ${updateType === 'percentage' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'hover:border-gray-300'}`}
                                        onClick={() => setUpdateType('percentage')}
                                    >
                                        <span className="text-2xl font-bold text-blue-600">%</span>
                                        <span className="font-medium">Porcentagem</span>
                                    </div>
                                    <div
                                        className={`p-4 border rounded-lg cursor-pointer transition-all flex flex-col items-center gap-2 ${updateType === 'fixed' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'hover:border-gray-300'}`}
                                        onClick={() => setUpdateType('fixed')}
                                    >
                                        <span className="text-2xl font-bold text-green-600">R$</span>
                                        <span className="font-medium">Valor Fixo</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>
                                    {updateType === 'percentage' ? 'Percentual de Aumento (%)' : 'Valor a Adicionar (R$)'}
                                </Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    placeholder={updateType === 'percentage' ? "Ex: 10 para 10%" : "Ex: 5.00 para R$ 5,00"}
                                    value={updateValue}
                                    onChange={e => setUpdateValue(e.target.value)}
                                    className="text-lg"
                                />
                                {updateValue && !isNaN(updateValue) && (
                                    <p className="text-sm text-gray-500">
                                        {updateType === 'percentage'
                                            ? `Os preços serão aumentados em ${updateValue}%`
                                            : `Será adicionado R$ ${parseFloat(updateValue).toFixed(2)} ao custo de cada produto`
                                        }
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4">
                            <Alert className="bg-yellow-50 border-yellow-200">
                                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                                <AlertDescription className="text-yellow-800">
                                    Revise os novos preços abaixo. O reajuste será aplicado tanto no <strong>Preço de Custo</strong> quanto no <strong>Preço de Venda</strong> para manter a margem.
                                </AlertDescription>
                            </Alert>

                            <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
                                <Table>
                                    <TableHeader className="bg-gray-50 sticky top-0">
                                        <TableRow>
                                            <TableHead>Produto</TableHead>
                                            <TableHead className="text-right text-gray-500">Custo Atual</TableHead>
                                            <TableHead className="text-right font-bold text-blue-600">Novo Custo</TableHead>
                                            <TableHead className="w-8"></TableHead>
                                            <TableHead className="text-right text-gray-500">Venda Atual</TableHead>
                                            <TableHead className="text-right font-bold text-green-600">Nova Venda</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {previewData.map(item => (
                                            <TableRow key={item.id}>
                                                <TableCell className="font-medium">{item.nome}</TableCell>
                                                <TableCell className="text-right text-gray-500">
                                                    R$ {item.custoAtual.toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-right font-bold text-blue-600">
                                                    R$ {item.novoPrecoCusto.toFixed(2)}
                                                </TableCell>
                                                <TableCell>
                                                    <ArrowRight className="w-4 h-4 text-gray-300 mx-auto" />
                                                </TableCell>
                                                <TableCell className="text-right text-gray-500">
                                                    R$ {item.vendaAtual.toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-right font-bold text-green-600 bg-green-50">
                                                    R$ {item.novoPrecoVenda.toFixed(2)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            <div className="flex justify-end p-2 bg-gray-50 rounded text-sm text-gray-600">
                                Total de produtos afetados: <strong>{previewData.length}</strong>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    {step === 1 ? (
                        <>
                            <Button variant="outline" onClick={handleClose}>Cancelar</Button>
                            <Button onClick={handleNext} disabled={loadingProdutos || produtosDoFornecedor.length === 0}>
                                Continuar <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="ghost" onClick={() => setStep(1)}>Voltar</Button>
                            <Button
                                onClick={handleApply}
                                disabled={bulkUpdate.isPending}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                {bulkUpdate.isPending ? (
                                    <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Aplicando...</>
                                ) : (
                                    <><CheckCircle className="w-4 h-4 mr-2" /> Confirmar Reajuste</>
                                )}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
