import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44, supabase } from "@/api/base44Client";
import { Check, X, Merge, Search, AlertCircle, Loader2, PackagePlus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import ProdutoCadastroCompleto from "@/components/produtos/ProdutoCadastroCompleto";

export default function SolicitacoesCadastroWidget() {
    const queryClient = useQueryClient();
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [mergeModalOpen, setMergeModalOpen] = useState(false);
    const [targetProductSearch, setTargetProductSearch] = useState("");
    const [targetProducts, setTargetProducts] = useState([]);
    const [selectedTargetProduct, setSelectedTargetProduct] = useState(null);
    const [selectedTargetVariation, setSelectedTargetVariation] = useState(null);
    const [isSearching, setIsSearching] = useState(false);

    // Full Registration Modal State
    const [fullRegistrationModalOpen, setFullRegistrationModalOpen] = useState(false);
    const [selectedRequestForRegistration, setSelectedRequestForRegistration] = useState(null);
    const [isSavingFullProduct, setIsSavingFullProduct] = useState(false);

    // Fetch pending requests
    const { data: solicitacoes = [], isLoading } = useQuery({
        queryKey: ['solicitacoes_cadastro'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('solicitacoes_cadastro_produto')
                .select('*')
                .eq('status', 'pendente')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        }
    });

    // Action: Create New Product from Request
    // Action: Create New Product (Full Registration)
    const createFullProductMutation = useMutation({
        mutationFn: async ({ productData, originalRequestId }) => {
            // 1. Create the product using the standard entity method (consistent with Produtos.jsx)
            const newProd = await base44.entities.Produto.create(productData);

            if (!newProd?.id) throw new Error("Falha ao receber ID do produto criado.");

            // 2. Update request status
            const { error: updateError } = await supabase
                .from('solicitacoes_cadastro_produto')
                .update({
                    status: 'aprovado',
                    produto_gerado_id: newProd.id
                })
                .eq('id', originalRequestId);

            if (updateError) throw updateError;

            return newProd;
        },
        onSuccess: () => {
            toast.success("Produto cadastrado com sucesso!");
            queryClient.invalidateQueries({ queryKey: ['solicitacoes_cadastro'] });
            queryClient.invalidateQueries({ queryKey: ['produtos'] });
            setFullRegistrationModalOpen(false);
            setSelectedRequestForRegistration(null);
        },
        onError: (err) => toast.error("Erro ao cadastrar: " + err.message)
    });

    // Action: Update Existing Product (Add Variation)
    // Used when the request is to add a variation to an existing parent
    const updateProductMutation = useMutation({
        mutationFn: async ({ productId, productData, originalRequestId }) => {
            // 1. Update the product
            const updatedProd = await base44.entities.Produto.update(productId, productData);

            // 2. Update request status
            const { error: updateError } = await supabase
                .from('solicitacoes_cadastro_produto')
                .update({
                    status: 'aprovado',
                    produto_gerado_id: productId // Linked to same parent
                })
                .eq('id', originalRequestId);

            if (updateError) throw updateError;
            return updatedProd;
        },
        onSuccess: () => {
            toast.success("Variação adicionada com sucesso!");
            queryClient.invalidateQueries({ queryKey: ['solicitacoes_cadastro'] });
            queryClient.invalidateQueries({ queryKey: ['produtos'] });
            setFullRegistrationModalOpen(false);
            setSelectedRequestForRegistration(null);
        },
        onError: (err) => toast.error("Erro ao atualizar: " + err.message)
    });

    const handleOpenRegistration = async (req) => {
        // If we have a fornecedor_id, we can fetch its name, but mostly we just need the ID for the form
        // We might want to pass it as string or keep as obj

        let fornecedor_nome = '';
        if (req.fornecedor_id) {
            try {
                // Best effort to get name for display, though select component handles ID mapping
                const { data: f } = await supabase.from('fornecedores').select('nome_empresa, nome_contato').eq('id', req.fornecedor_id).single();
                if (f) fornecedor_nome = f.nome_empresa || f.nome_contato || '';
            } catch (e) {
                console.warn('Could not fetch fornecedor name pre-fill', e);
            }
        }

        const productPreData = {
            nome: req.nome_produto,
            categoria: req.categoria || '',
            ambiente: req.ambiente || '',
            fornecedor_id: req.fornecedor_id?.toString() || '',
            fornecedor_nome: fornecedor_nome,
            material: req.material || '',
            altura: req.altura?.toString() || '',
            largura: req.largura?.toString() || '',
            profundidade: req.profundidade?.toString() || '',
            descricao: req.observacoes || '',
            preco_venda: req.preco_sugerido || 0,
            ativo: true,
            variacoes: (req.cor || req.tecido) ? [{
                id: Date.now().toString(),
                nome: `${req.cor || ''} ${req.tecido || ''}`.trim(),
                cor: req.cor || '',
                tamanho: req.medidas || req.tecido || '', // Legacy medidas string for now if present, better to use structured 
                largura: req.largura?.toString() || '',
                altura: req.altura?.toString() || '',
                profundidade: req.profundidade?.toString() || '',
                preco_venda: req.preco_sugerido || 0,
                estoque_cd: 0, // Starts at 0, manager confirms
                fotos: []
            }] : []
        };
        // Se produto já foi criado pelo vendedor no PDV, abrir para edição (não criar duplicado)
        if (req.produto_gerado_id) {
            const { data: existingProduct } = await supabase
                .from('produtos')
                .select('*')
                .eq('id', req.produto_gerado_id)
                .single();
            if (existingProduct) {
                setSelectedRequestForRegistration({ ...req, preData: existingProduct, isUpdate: true, parentId: req.produto_gerado_id });
                setFullRegistrationModalOpen(true);
                return;
            }
        }

        setSelectedRequestForRegistration({ ...req, preData: productPreData, isUpdate: false });
        setFullRegistrationModalOpen(true);
    };

    const handleOpenAddVariation = async (req) => {
        if (!req.produto_pai_id) return;

        // Fetch Parent
        const { data: parent } = await supabase.from('produtos').select('*').eq('id', req.produto_pai_id).single();
        if (!parent) return toast.error("Produto pai não encontrado.");

        const novaVariacao = {
            id: Date.now().toString(),
            nome: `${req.cor || ''} ${req.tecido || ''}`.trim() || 'Nova Variação',
            cor: req.cor || '',
            tamanho: req.medidas || req.tecido || '',
            largura: req.largura?.toString() || '',
            altura: req.altura?.toString() || '',
            profundidade: req.profundidade?.toString() || '',
            preco_venda: req.preco_sugerido || parent.preco_venda || 0,
            estoque_cd: 0,
            fotos: []
        };

        const productWithNewVariation = {
            ...parent,
            variacoes: [...(parent.variacoes || []), novaVariacao]
        };

        setSelectedRequestForRegistration({ ...req, preData: productWithNewVariation, isUpdate: true, parentId: parent.id });
        setFullRegistrationModalOpen(true);
    };

    const handleSaveFullProduct = (data) => {
        if (!selectedRequestForRegistration) return;
        setIsSavingFullProduct(true);

        if (selectedRequestForRegistration.isUpdate) {
            updateProductMutation.mutate(
                {
                    productId: selectedRequestForRegistration.parentId,
                    productData: data,
                    originalRequestId: selectedRequestForRegistration.id
                },
                {
                    onSettled: () => setIsSavingFullProduct(false)
                }
            );
        } else {
            createFullProductMutation.mutate(
                {
                    productData: data,
                    originalRequestId: selectedRequestForRegistration.id
                },
                {
                    onSettled: () => setIsSavingFullProduct(false)
                }
            );
        }
    };

    // Action: Merge with Existing Product
    const mergeProductMutation = useMutation({
        mutationFn: async ({ requestId, targetProductId, targetVariationId }) => {
            // 1. Calculate how many items were sold using this request
            // This is tricky because 'vendas' stores items in JSONB.
            // We need to fetch sales that might have this item.
            // Ideally we would have a specific link, but we stored 'solicitacao_id' in the item json.

            // Strategy: Fetch recent sales (e.g. last 30 days) and parse locally for simplicity/safety
            // Or rely on the user to manually verify? 
            // Let's do a best-effort count.

            const { data: vendas } = await supabase
                .from('vendas')
                .select('itens')
                .gte('data_venda', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Last 30 days

            let quantitySold = 0;
            vendas?.forEach(v => {
                const items = v.itens || [];
                items.forEach(item => {
                    if (item.solicitacao_id === requestId) {
                        quantitySold += (item.quantidade || 1);
                    }
                });
            });

            // 2. Deduct inventory from target product
            if (quantitySold > 0) {
                // Fetch current stock
                const { data: targetProd } = await supabase
                    .from('produtos')
                    .select('*')
                    .eq('id', targetProductId)
                    .single();

                if (targetProd) {
                    let updateData = {};

                    // Logic for Variations
                    if (targetVariationId && targetProd.variacoes?.length > 0) {
                        const updatedVariacoes = targetProd.variacoes.map(v => {
                            if (v.id === targetVariationId) {
                                // Defaulting to CD deduction for now as we don't track origin store of the request explicitly yet
                                const currentStock = parseInt(v.estoque_cd) || 0;
                                return { ...v, estoque_cd: Math.max(0, currentStock - quantitySold) };
                            }
                            return v;
                        });

                        // Recalculate Total Stock
                        // Assuming simple sum of all stores for total, or just re-summing what we have
                        // For safety, we just deduct from the total scalar as well to keep sync
                        const currentTotal = parseInt(targetProd.quantidade_estoque) || 0;

                        updateData = {
                            variacoes: updatedVariacoes,
                            quantidade_estoque: Math.max(0, currentTotal - quantitySold)
                        };
                    } else {
                        // Simple Product
                        updateData = {
                            quantidade_estoque: Math.max(0, (targetProd.quantidade_estoque || 0) - quantitySold)
                        };
                    }

                    await supabase
                        .from('produtos')
                        .update(updateData)
                        .eq('id', targetProductId);
                }
            }

            // 3. Update request status
            const { error } = await supabase
                .from('solicitacoes_cadastro_produto')
                .update({
                    status: 'mesclado',
                    produto_mesclado_id: targetProductId,
                    observacoes: `Mesclado com produto ID ${targetProductId}. Baixa de ${quantitySold} itens no estoque realizada.`
                })
                .eq('id', requestId);

            if (error) throw error;
            return quantitySold;
        },
        onSuccess: (qty) => {
            toast.success(`Solicitação mesclada! ${qty} itens abatidos do estoque.`);
            setMergeModalOpen(false);
            setSelectedRequest(null);
            setSelectedTargetProduct(null);
            queryClient.invalidateQueries({ queryKey: ['solicitacoes_cadastro'] });
            queryClient.invalidateQueries({ queryKey: ['produtos'] });
        },
        onError: (err) => toast.error("Erro ao mesclar: " + err.message)
    });

    // Search for generic products to merge
    React.useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (targetProductSearch.length >= 2) {
                handleSearchProduct();
            } else if (targetProductSearch.length === 0) {
                setTargetProducts([]);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [targetProductSearch]);

    const handleSearchProduct = async () => {
        setIsSearching(true);
        try {
            const { data, error } = await supabase
                .from('produtos')
                .select('*')
                .or(`nome.ilike.%${targetProductSearch}%,modelo_referencia.ilike.%${targetProductSearch}%,sku.ilike.%${targetProductSearch}%`)
                .limit(10);

            if (error) throw error;
            setTargetProducts(data || []);
        } catch (err) {
            console.error('Erro na busca real-time:', err);
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="text-amber-800 flex items-center gap-2">
                            <PackagePlus className="w-5 h-5" />
                            Solicitações de Cadastro
                        </CardTitle>
                        <CardDescription>
                            Produtos não encontrados pelos vendedores
                        </CardDescription>
                    </div>
                    <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                        {solicitacoes.length} pendentes
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center p-4"><Loader2 className="animate-spin text-amber-600" /></div>
                ) : solicitacoes.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">Nenhuma solicitação pendente.</p>
                ) : (
                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                        {solicitacoes.map(req => (
                            <div key={req.id} className="bg-white p-3 rounded-lg border border-amber-100 shadow-sm text-sm">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold text-gray-800">
                                        {req.produto_pai_id ? (
                                            <span className="flex items-center gap-1 text-blue-700">
                                                <AlertCircle className="w-3 h-3" /> Variação: {req.nome_produto}
                                            </span>
                                        ) : req.nome_produto}
                                    </h4>
                                    <span className="text-xs text-gray-400">{format(new Date(req.created_at), 'dd/MM HH:mm')}</span>
                                </div>

                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 mb-3">
                                    <p><span className="font-medium">Cor:</span> {req.cor || '-'}</p>
                                    <p><span className="font-medium">Tecido:</span> {req.tecido || '-'}</p>
                                    <p><span className="font-medium">Medidas:</span> {req.medidas || '-'}</p>
                                    <p><span className="font-medium">Preço Sug.:</span> R$ {req.preco_sugerido}</p>
                                </div>

                                {req.observacoes && (
                                    <p className="text-xs text-gray-500 italic mb-3 bg-gray-50 p-1 rounded">Obs: {req.observacoes}</p>
                                )}

                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        className={`flex-1 h-8 text-xs ${req.produto_pai_id ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}
                                        onClick={() => req.produto_pai_id ? handleOpenAddVariation(req) : handleOpenRegistration(req)}
                                    >
                                        {req.produto_pai_id ? (
                                            <><PackagePlus className="w-3 h-3 mr-1" /> Adicionar Variação</>
                                        ) : (
                                            <><Check className="w-3 h-3 mr-1" /> Criar Produto</>
                                        )}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="flex-1 h-8 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                                        onClick={() => {
                                            setSelectedRequest(req);
                                            setMergeModalOpen(true);
                                        }}
                                    >
                                        <Merge className="w-3 h-3 mr-1" /> Vincular
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>

            {/* Merge Modal */}
            <Dialog open={mergeModalOpen} onOpenChange={setMergeModalOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold text-gray-900">Vincular a Produto Existente</DialogTitle>
                        <DialogDescription className="text-base text-gray-500">
                            Selecione o produto correto para vincular a esta solicitação e corrigir o estoque automaticamente.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-hidden flex flex-col space-y-4 py-2">
                        <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 shadow-sm flex justify-between items-center animate-in fade-in slide-in-from-top-4 duration-500">
                            <div>
                                <p className="text-amber-800 font-semibold text-xs uppercase tracking-wider mb-1">Produto da Solicitação:</p>
                                <h4 className="text-xl font-bold text-gray-900">{selectedRequest?.nome_produto}</h4>
                                <div className="flex gap-4 mt-1 text-sm text-amber-900/70">
                                    {selectedRequest?.cor && <p><strong>Cor:</strong> {selectedRequest.cor}</p>}
                                    {selectedRequest?.medidas && <p><strong>Medidas:</strong> {selectedRequest.medidas}</p>}
                                </div>
                            </div>
                            <div className="text-right hidden sm:block">
                                <Badge variant="outline" className="bg-white border-amber-200 text-amber-700 h-8 px-4 font-bold">
                                    R$ {selectedRequest?.preco_sugerido}
                                </Badge>
                                <p className="text-[10px] text-amber-600 mt-1 italic">Preço sugerido pelo vendedor</p>
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

                        <div className="flex-1 overflow-y-auto min-h-[300px] space-y-3 pr-2 custom-scrollbar">
                            {targetProducts.length > 0 ? (
                                targetProducts.map(p => (
                                    <div
                                        key={p.id}
                                        onClick={() => {
                                            setSelectedTargetProduct(p);
                                            setSelectedTargetVariation(null);
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

                    {/* Variações Selector (if applies) */}
                    {selectedTargetProduct?.variacoes?.length > 0 && (
                        <div className="space-y-3 border-t pt-4 mt-2 animate-in zoom-in-95 duration-300">
                            <Label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                Selecione a Variação vendida:
                            </Label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[180px] overflow-y-auto pr-1">
                                {selectedTargetProduct.variacoes.map(v => (
                                    <div
                                        key={v.id}
                                        onClick={() => setSelectedTargetVariation(v)}
                                        className={`p-3 border-2 rounded-xl flex flex-col justify-center items-center gap-2 cursor-pointer transition-all ${selectedTargetVariation?.id === v.id
                                            ? 'bg-amber-600 border-amber-700 text-white shadow-inner scale-[1.02]'
                                            : 'bg-white hover:border-amber-300 hover:bg-amber-50/30'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            {v.cor_hex && <div className="w-5 h-5 rounded-full border border-white/20 shadow-sm" style={{ backgroundColor: v.cor_hex }}></div>}
                                            <span className="text-xs font-bold text-center leading-tight">
                                                {v.nome || v.cor || 'Variação'}
                                            </span>
                                        </div>
                                        <div className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${selectedTargetVariation?.id === v.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                            Estoque: {v.estoque_cd || 0}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <DialogFooter className="mt-6 pt-4 border-t gap-2 flex-col sm:flex-row">
                        <Button
                            variant="ghost"
                            size="lg"
                            className="text-gray-500 hover:text-gray-700"
                            onClick={() => setMergeModalOpen(false)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            size="lg"
                            onClick={() => mergeProductMutation.mutate({
                                requestId: selectedRequest.id,
                                targetProductId: selectedTargetProduct.id,
                                targetVariationId: selectedTargetVariation?.id
                            })}
                            disabled={!selectedTargetProduct || mergeProductMutation.isPending || (selectedTargetProduct.variacoes?.length > 0 && !selectedTargetVariation)}
                            className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-8 shadow-lg shadow-amber-200 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {mergeProductMutation.isPending ? (
                                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Processando...</>
                            ) : (
                                "Confirmar Vinculação"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal de Cadastro Completo */}
            {fullRegistrationModalOpen && selectedRequestForRegistration && (
                <ProdutoCadastroCompleto
                    isOpen={fullRegistrationModalOpen}
                    onClose={() => setFullRegistrationModalOpen(false)}
                    onSave={handleSaveFullProduct}
                    produto={selectedRequestForRegistration.preData}
                    isLoading={isSavingFullProduct}
                />
            )}
        </Card>
    );
}
