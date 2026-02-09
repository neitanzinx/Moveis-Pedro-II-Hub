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

    const handleOpenRegistration = (req) => {
        // Helper to extract value from "Key: Value" lines in observacoes
        const extractVal = (key) => {
            const regex = new RegExp(`${key}:\\s*(.+)`, 'i');
            const match = req.observacoes?.match(regex);
            return match ? match[1].trim() : null;
        };

        // Parse Dimensions from "A:100cm x L:200cm x P:50cm" or similar
        // Or from the legacy 'medidas' field if available and matching pattern
        let altura = '', largura = '', profundidade = '';
        const medidasStr = extractVal('Dimensões') || req.medidas || '';

        if (medidasStr) {
            const altMatch = medidasStr.match(/A:(\d+(?:\.\d+)?)/i);
            const largMatch = medidasStr.match(/L:(\d+(?:\.\d+)?)/i);
            const profMatch = medidasStr.match(/P:(\d+(?:\.\d+)?)/i);
            if (altMatch) altura = altMatch[1];
            if (largMatch) largura = largMatch[1];
            if (profMatch) profundidade = profMatch[1];
        }


        const productPreData = {
            nome: req.nome_produto,
            categoria: extractVal('Categoria') || '',
            ambiente: extractVal('Ambiente') || '',
            fornecedor_nome: extractVal('Fornecedor') || '',
            material: extractVal('Material') || '',
            altura,
            largura,
            profundidade,
            descricao: [
                req.observacoes || '',
            ].filter(Boolean).join('\n'),
            preco_venda: req.preco_sugerido || 0,
            ativo: true,
            // [NOVO] Pre-fill variations
            temVariacoes: !!extractVal('Cor') || !!extractVal('Tecido'),
            variacoes: (extractVal('Cor') || extractVal('Tecido')) ? [{
                id: Date.now().toString(),
                nome: `${extractVal('Cor') || ''} ${extractVal('Tecido') || ''}`.trim(),
                cor: extractVal('Cor') || '',
                tamanho: medidasStr || extractVal('Tecido') || '',
                largura,
                altura,
                profundidade,
                preco_venda: req.preco_sugerido || 0,
                estoque_cd: 0, // Starts at 0, manager confirms
                fotos: []
            }] : []
        };
        setSelectedRequestForRegistration({ ...req, preData: productPreData, isUpdate: false });
        setFullRegistrationModalOpen(true);
    };

    const handleOpenAddVariation = async (req) => {
        if (!req.produto_pai_id) return;

        // Fetch Parent
        const { data: parent } = await supabase.from('produtos').select('*').eq('id', req.produto_pai_id).single();
        if (!parent) return toast.error("Produto pai não encontrado.");

        // Extract Variation Data
        const extractVal = (key) => {
            const regex = new RegExp(`${key}:\\s*(.+)`, 'i');
            const match = req.observacoes?.match(regex);
            return match ? match[1].trim() : null;
        };
        const medidasStr = extractVal('Dimensões') || req.medidas || '';
        let altura = '', largura = '', profundidade = '';
        if (medidasStr) {
            const altMatch = medidasStr.match(/A:(\d+(?:\.\d+)?)/i);
            const largMatch = medidasStr.match(/L:(\d+(?:\.\d+)?)/i);
            const profMatch = medidasStr.match(/P:(\d+(?:\.\d+)?)/i);
            if (altMatch) altura = altMatch[1];
            if (largMatch) largura = largMatch[1];
            if (profMatch) profundidade = profMatch[1];
        }

        const novaVariacao = {
            id: Date.now().toString(),
            nome: `${extractVal('Cor') || ''} ${extractVal('Tecido') || ''}`.trim() || 'Nova Variação',
            cor: extractVal('Cor') || '',
            tamanho: medidasStr || extractVal('Tecido') || '',
            largura,
            altura,
            profundidade,
            preco_venda: req.preco_sugerido || parent.preco_venda || 0,
            estoque_cd: 0,
            fotos: []
        };

        const productWithNewVariation = {
            ...parent,
            temVariacoes: true,
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
                    if (args.targetVariationId && targetProd.variacoes?.length > 0) {
                        const updatedVariacoes = targetProd.variacoes.map(v => {
                            if (v.id === args.targetVariationId) {
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
    const handleSearchProduct = async () => {
        if (!targetProductSearch) return;
        const { data } = await supabase
            .from('produtos')
            .select('*')
            .ilike('nome', `%${targetProductSearch}%`)
            .limit(5);
        setTargetProducts(data || []);
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
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Vincular a Produto Existente</DialogTitle>
                        <DialogDescription>
                            O vendedor não encontrou, mas o produto já existe? Selecione abaixo para corrigir o estoque.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="p-3 bg-amber-50 rounded border border-amber-100 text-sm">
                            <p><strong>Solicitado:</strong> {selectedRequest?.nome_produto}</p>
                            <p>Isso irá abater do estoque do produto selecionado a quantidade vendida como genérico nesta solicitação.</p>
                        </div>

                        <div className="flex gap-2">
                            <Input
                                placeholder="Buscar produto cadastrado..."
                                value={targetProductSearch}
                                onChange={e => setTargetProductSearch(e.target.value)}
                            />
                            <Button onClick={handleSearchProduct} variant="secondary"><Search className="w-4 h-4" /></Button>
                        </div>

                        <div className="max-h-40 overflow-y-auto space-y-2">
                            {targetProducts.map(p => (
                                <div
                                    key={p.id}
                                    onClick={() => {
                                        setSelectedTargetProduct(p);
                                        setSelectedTargetVariation(null); // Reset variation when product changes
                                    }}
                                    className={`p-2 border rounded cursor-pointer text-sm flex justify-between ${selectedTargetProduct?.id === p.id ? 'border-green-500 bg-green-50' : 'hover:bg-gray-50'}`}
                                >
                                    <span>{p.nome}</span>
                                    <span className="text-gray-500">{p.quantidade_estoque} un</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Variações Selector (if applies) */}
                    {selectedTargetProduct?.variacoes?.length > 0 && (
                        <div className="space-y-2 border-t pt-4">
                            <Label>Selecione a Variação vendida:</Label>
                            <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
                                {selectedTargetProduct.variacoes.map(v => (
                                    <div
                                        key={v.id}
                                        onClick={() => setSelectedTargetVariation(v)}
                                        className={`p-2 border rounded flex justify-between items-center cursor-pointer ${selectedTargetVariation?.id === v.id ? 'bg-amber-100 border-amber-500' : 'hover:bg-gray-50'}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            {v.cor_hex && <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: v.cor_hex }}></div>}
                                            <span className="text-sm font-medium">{v.nome || v.cor || 'Variação sem nome'}</span>
                                            <span className="text-xs text-gray-500">({v.tamanho || '-'})</span>
                                        </div>
                                        <Badge variant="outline">{v.estoque_cd || 0} un</Badge>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <DialogFooter className="mt-4">
                        <Button variant="ghost" onClick={() => setMergeModalOpen(false)}>Cancelar</Button>
                        <Button
                            onClick={() => mergeProductMutation.mutate({
                                requestId: selectedRequest.id,
                                targetProductId: selectedTargetProduct.id,
                                targetVariationId: selectedTargetVariation?.id
                            })}
                            disabled={!selectedTargetProduct || mergeProductMutation.isPending || (selectedTargetProduct.variacoes?.length > 0 && !selectedTargetVariation)}
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                        >
                            Confirmar Vinculação
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
