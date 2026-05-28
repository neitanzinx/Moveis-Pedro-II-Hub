import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44, supabase } from "@/api/base44Client";
import { Check, Search, AlertCircle, Loader2, PackagePlus, Link2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import ProdutoCadastroCompleto from "@/components/produtos/ProdutoCadastroCompleto";

export default function SolicitacoesCadastroWidget() {
    const queryClient = useQueryClient();
    const [selectedItem, setSelectedItem] = useState(null);
    const [existingItemModalOpen, setExistingItemModalOpen] = useState(false);
    const [targetProductSearch, setTargetProductSearch] = useState("");
    const [targetProducts, setTargetProducts] = useState([]);
    const [selectedTargetProduct, setSelectedTargetProduct] = useState(null);
    const [isSearching, setIsSearching] = useState(false);

    const [fullRegistrationModalOpen, setFullRegistrationModalOpen] = useState(false);
    const [selectedItemForRegistration, setSelectedItemForRegistration] = useState(null);
    const [isSavingFullProduct, setIsSavingFullProduct] = useState(false);

    const { data: itensPendentes = [], isLoading } = useQuery({
        queryKey: ['itens_cadastrados_vendedor_pendentes'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('produtos')
                .select('*')
                .eq('requer_atencao', true)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        }
    });

    const concluirCadastroMutation = useMutation({
        mutationFn: async ({ productId, productData }) => {
            return base44.entities.Produto.update(productId, {
                ...productData,
                requer_atencao: false,
                motivo_atencao: null,
                ativo: productData.ativo !== false,
            });
        },
        onSuccess: () => {
            toast.success("Cadastro concluido com sucesso!");
            queryClient.invalidateQueries({ queryKey: ['itens_cadastrados_vendedor_pendentes'] });
            queryClient.invalidateQueries({ queryKey: ['produtos'] });
            setFullRegistrationModalOpen(false);
            setSelectedItemForRegistration(null);
        },
        onError: (err) => toast.error("Erro ao concluir cadastro: " + err.message)
    });

    const marcarComoExistenteMutation = useMutation({
        mutationFn: async ({ sourceProduct, targetProduct }) => {
            const agora = new Date();
            const { data: vendas, error: vendasError } = await supabase
                .from('vendas')
                .select('status,itens');

            if (vendasError) throw vendasError;

            const quantidadeVendida = (vendas || []).reduce((totalVenda, venda) => {
                const statusVenda = String(venda?.status || '').toLowerCase();
                if (statusVenda === 'cancelado' || statusVenda === 'cancelada') {
                    return totalVenda;
                }

                const itensVenda = Array.isArray(venda?.itens) ? venda.itens : [];
                const totalItens = itensVenda.reduce((subtotal, item) => {
                    const itemProdutoId = item?.produto_id;
                    if (!itemProdutoId) return subtotal;

                    const mesmoProduto = String(itemProdutoId) === String(sourceProduct.id);
                    if (!mesmoProduto) return subtotal;

                    const qtd = Number(item?.quantidade || 0);
                    return subtotal + (Number.isFinite(qtd) ? qtd : 0);
                }, 0);

                return totalVenda + totalItens;
            }, 0);

            const estoqueAtualAlvo = Number(targetProduct?.quantidade_estoque || 0);
            const novoEstoqueAlvo = Math.max(0, estoqueAtualAlvo - quantidadeVendida);

            const observacao = `Item cadastrado por vendedor identificado como ja existente. Referencia correta: ${targetProduct.nome} (ID ${targetProduct.id}) em ${format(agora, 'dd/MM/yyyy HH:mm')}. Vendas transferidas para baixa de estoque: ${quantidadeVendida}.`;

            const { error: targetUpdateError } = await supabase
                .from('produtos')
                .update({ quantidade_estoque: novoEstoqueAlvo })
                .eq('id', targetProduct.id);

            if (targetUpdateError) throw targetUpdateError;

            return base44.entities.Produto.update(sourceProduct.id, {
                requer_atencao: false,
                ativo: false,
                motivo_atencao: observacao,
            });
        },
        onSuccess: () => {
            toast.success("Item assimilado com baixa de estoque no produto existente.");
            queryClient.invalidateQueries({ queryKey: ['itens_cadastrados_vendedor_pendentes'] });
            queryClient.invalidateQueries({ queryKey: ['produtos'] });
            setExistingItemModalOpen(false);
            setSelectedItem(null);
            setSelectedTargetProduct(null);
            setTargetProductSearch("");
            setTargetProducts([]);
        },
        onError: (err) => toast.error("Erro ao marcar item existente: " + err.message)
    });

    const handleOpenRegistration = (item) => {
        setSelectedItemForRegistration(item);
        setFullRegistrationModalOpen(true);
    };

    const handleSaveFullProduct = (data) => {
        if (!selectedItemForRegistration) return;
        setIsSavingFullProduct(true);
        concluirCadastroMutation.mutate(
            {
                productId: selectedItemForRegistration.id,
                productData: data,
            },
            {
                onSettled: () => setIsSavingFullProduct(false)
            }
        );
    };

    React.useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (targetProductSearch.length === 0) {
                setTargetProducts([]);
                return;
            }

            if (targetProductSearch.length < 2 || !selectedItem?.id) {
                return;
            }

            setIsSearching(true);
            try {
                const { data, error } = await supabase
                    .from('produtos')
                    .select('*')
                    .neq('id', selectedItem.id)
                    .or(`nome.ilike.%${targetProductSearch}%,modelo_referencia.ilike.%${targetProductSearch}%,sku.ilike.%${targetProductSearch}%`)
                    .limit(10);

                if (error) throw error;
                setTargetProducts(data || []);
            } catch (err) {
                console.error('Erro na busca real-time:', err);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [targetProductSearch, selectedItem?.id]);

    return (
        <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="text-amber-800 flex items-center gap-2">
                            <PackagePlus className="w-5 h-5" />
                            Itens Cadastrados por Vendedor
                        </CardTitle>
                        <CardDescription>
                            Produtos que precisam de conclusao de cadastro
                        </CardDescription>
                    </div>
                    <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                        {itensPendentes.length} pendentes
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center p-4"><Loader2 className="animate-spin text-amber-600" /></div>
                ) : itensPendentes.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">Nenhum item pendente.</p>
                ) : (
                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                        {itensPendentes.map(item => (
                            <div key={item.id} className="bg-white p-3 rounded-lg border border-amber-100 shadow-sm text-sm">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold text-gray-800">
                                        <span className="flex items-center gap-1 text-blue-700">
                                            <AlertCircle className="w-3 h-3" /> {item.nome}
                                        </span>
                                    </h4>
                                    <span className="text-xs text-gray-400">{item.created_at ? format(new Date(item.created_at), 'dd/MM HH:mm') : '-'}</span>
                                </div>

                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 mb-3">
                                    <p><span className="font-medium">Cor:</span> {item.cor || '-'}</p>
                                    <p><span className="font-medium">Material:</span> {item.material || '-'}</p>
                                    <p>
                                        <span className="font-medium">Medidas:</span>{' '}
                                        {(item.largura || item.altura || item.profundidade)
                                            ? `L:${item.largura || '-'} A:${item.altura || '-'} P:${item.profundidade || '-'} cm`
                                            : '-'}
                                    </p>
                                    <p><span className="font-medium">Preço:</span> R$ {Number(item.preco_venda || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                </div>

                                {(item.descricao || item.motivo_atencao) && (
                                    <p className="text-xs text-gray-500 italic mb-3 bg-gray-50 p-1 rounded">Obs: {item.descricao || item.motivo_atencao}</p>
                                )}

                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700"
                                        onClick={() => handleOpenRegistration(item)}
                                    >
                                        <><Check className="w-3 h-3 mr-1" /> Concluir cadastro</>
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="flex-1 h-8 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                                        onClick={() => {
                                            setSelectedItem(item);
                                            setSelectedTargetProduct(null);
                                            setTargetProductSearch("");
                                            setTargetProducts([]);
                                            setExistingItemModalOpen(true);
                                        }}
                                    >
                                        <Link2 className="w-3 h-3 mr-1" /> Este item ja existe
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>

            {/* Modal: Este item ja existe */}
            <Dialog open={existingItemModalOpen} onOpenChange={setExistingItemModalOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold text-gray-900">Selecionar Item Ja Cadastrado</DialogTitle>
                        <DialogDescription className="text-base text-gray-500">
                            Escolha o produto correto para marcar este cadastro como item ja existente.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-hidden flex flex-col space-y-4 py-2">
                        <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 shadow-sm flex justify-between items-center animate-in fade-in slide-in-from-top-4 duration-500">
                            <div>
                                <p className="text-amber-800 font-semibold text-xs uppercase tracking-wider mb-1">Item Cadastrado:</p>
                                <h4 className="text-xl font-bold text-gray-900">{selectedItem?.nome}</h4>
                                <div className="flex gap-4 mt-1 text-sm text-amber-900/70">
                                    {selectedItem?.cor && <p><strong>Cor:</strong> {selectedItem.cor}</p>}
                                    {(selectedItem?.largura || selectedItem?.altura || selectedItem?.profundidade) && (
                                        <p>
                                            <strong>Medidas:</strong> L:{selectedItem?.largura || '-'} A:{selectedItem?.altura || '-'} P:{selectedItem?.profundidade || '-'}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="text-right hidden sm:block">
                                <Badge variant="outline" className="bg-white border-amber-200 text-amber-700 h-8 px-4 font-bold">
                                    R$ {Number(selectedItem?.preco_venda || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </Badge>
                                <p className="text-[10px] text-amber-600 mt-1 italic">Preco do item cadastrado</p>
                            </div>
                        </div>

                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-amber-500 transition-colors" />
                            <Input
                                placeholder="🔍 Buscar por Nome do Produto, SKU, Referência ou Modelo..."
                                value={targetProductSearch}
                                onChange={e => setTargetProductSearch(e.target.value)}
                                className="pl-10 h-12 text-lg border-gray-300 rounded-xl focus:ring-amber-500 shadow-sm transition-all"
                                autoFocus
                            />
                            {isSearching && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
                                </div>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto min-h-[300px] space-y-3 pr-2">
                            {targetProducts.length > 0 ? (
                                targetProducts.map(p => (
                                    <div
                                        key={p.id}
                                        onClick={() => {
                                            setSelectedTargetProduct(p);
                                        }}
                                        className={`group p-4 rounded-xl border-2 transition-all cursor-pointer relative overflow-hidden ${selectedTargetProduct?.id === p.id
                                            ? 'border-amber-500 bg-amber-50/50 shadow-md ring-1 ring-amber-500'
                                            : 'border-gray-100 bg-white hover:border-amber-200 hover:shadow-sm'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <h5 className="font-bold text-lg text-gray-900 group-hover:text-amber-700 transition-colors">{p.nome}</h5>
                                                    <Badge variant="outline" className="text-[9px] uppercase font-mono py-0 h-4">ID: {p.id}</Badge>
                                                </div>

                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                                    <div>
                                                        <p className="text-gray-400 uppercase text-[9px] font-bold tracking-tighter">Referência/SKU</p>
                                                        <p className="text-gray-700 font-medium truncate">{p.modelo_referencia || p.sku || 'N/A'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-gray-400 uppercase text-[9px] font-bold tracking-tighter">Estoque Atual</p>
                                                        <p className={`font-bold ${p.quantidade_estoque > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                            {p.quantidade_estoque} unidades
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-gray-400 uppercase text-[9px] font-bold tracking-tighter">Categoria</p>
                                                        <p className="text-gray-700 font-medium">{p.categoria || 'Sem categoria'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-gray-400 uppercase text-[9px] font-bold tracking-tighter">Fornecedor</p>
                                                        <p className="text-gray-700 font-medium truncate">{p.fornecedor_nome || '-'}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="ml-4 text-right">
                                                <p className="text-2xl font-black text-amber-600">
                                                    R$ {Number(p.preco_venda || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </p>
                                                <p className="text-[10px] text-gray-400 mt-1 uppercase">Preço de Venda</p>
                                            </div>
                                        </div>

                                        {/* Subtle background indicator for selection */}
                                        {selectedTargetProduct?.id === p.id && (
                                            <div className="absolute right-0 top-0 bottom-0 w-1 bg-amber-500" />
                                        )}
                                    </div>
                                ))
                            ) : targetProductSearch.length >= 2 && !isSearching ? (
                                <div className="flex flex-col items-center justify-center py-12 text-gray-400 bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-200">
                                    <PackagePlus className="w-12 h-12 mb-4 opacity-20" />
                                    <p className="text-lg">Ops! Nenhum produto encontrado.</p>
                                    <p className="text-sm">Tente buscar por um termo diferente ou confira as informações.</p>
                                </div>
                            ) : null}
                        </div>
                    </div>

                    <DialogFooter className="mt-6 pt-4 border-t gap-2 flex-col sm:flex-row">
                        <Button
                            variant="ghost"
                            size="lg"
                            className="text-gray-500 hover:text-gray-700"
                            onClick={() => setExistingItemModalOpen(false)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            size="lg"
                            onClick={() => marcarComoExistenteMutation.mutate({
                                sourceProduct: selectedItem,
                                targetProduct: selectedTargetProduct,
                            })}
                            disabled={!selectedTargetProduct || marcarComoExistenteMutation.isPending}
                            className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-8 shadow-lg shadow-amber-200 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {marcarComoExistenteMutation.isPending ? (
                                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Processando...</>
                            ) : (
                                "Confirmar Item Existente"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal de Cadastro Completo */}
            {fullRegistrationModalOpen && selectedItemForRegistration && (
                <ProdutoCadastroCompleto
                    isOpen={fullRegistrationModalOpen}
                    onClose={() => setFullRegistrationModalOpen(false)}
                    onSave={handleSaveFullProduct}
                    produto={selectedItemForRegistration}
                    isLoading={isSavingFullProduct}
                />
            )}
        </Card>
    );
}
