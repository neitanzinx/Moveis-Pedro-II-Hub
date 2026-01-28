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

export default function SolicitacoesCadastroWidget() {
    const queryClient = useQueryClient();
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [mergeModalOpen, setMergeModalOpen] = useState(false);
    const [targetProductSearch, setTargetProductSearch] = useState("");
    const [targetProducts, setTargetProducts] = useState([]);
    const [selectedTargetProduct, setSelectedTargetProduct] = useState(null);

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
    const createProductMutation = useMutation({
        mutationFn: async (request) => {
            // 1. Create the product - only use columns that exist in the 'produtos' table
            const descricaoCompleta = [
                'Cadastrado via solicitação de cadastro.',
                request.cor ? `Cor: ${request.cor}` : null,
                request.tecido ? `Tecido: ${request.tecido}` : null,
                request.medidas ? `Medidas: ${request.medidas}` : null,
                request.observacoes ? `Obs: ${request.observacoes}` : null
            ].filter(Boolean).join(' | ');

            const { data: newProd, error: createError } = await supabase
                .from('produtos')
                .insert({
                    nome: request.nome_produto,
                    descricao: descricaoCompleta,
                    preco_venda: request.preco_sugerido || 0,
                    categoria: 'Geral',
                    quantidade_estoque: 0,
                    ativo: true
                })
                .select()
                .single();

            if (createError) throw createError;

            // 2. Update request status
            const { error: updateError } = await supabase
                .from('solicitacoes_cadastro_produto')
                .update({
                    status: 'aprovado',
                    produto_gerado_id: newProd.id
                })
                .eq('id', request.id);

            if (updateError) throw updateError;

            return newProd;
        },
        onSuccess: () => {
            toast.success("Produto cadastrado com sucesso!");
            queryClient.invalidateQueries({ queryKey: ['solicitacoes_cadastro'] });
            queryClient.invalidateQueries({ queryKey: ['produtos'] });
            setSelectedRequest(null);
        },
        onError: (err) => toast.error("Erro ao cadastrar: " + err.message)
    });

    // Action: Merge with Existing Product
    const mergeProductMutation = useMutation({
        mutationFn: async ({ requestId, targetProductId }) => {
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
                    .select('quantidade_estoque')
                    .eq('id', targetProductId)
                    .single();

                if (targetProd) {
                    await supabase
                        .from('produtos')
                        .update({ quantidade_estoque: targetProd.quantidade_estoque - quantitySold })
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
                                    <h4 className="font-bold text-gray-800">{req.nome_produto}</h4>
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
                                        className="flex-1 bg-green-600 hover:bg-green-700 h-8 text-xs"
                                        onClick={() => createProductMutation.mutate(req)}
                                        disabled={createProductMutation.isPending}
                                    >
                                        <Check className="w-3 h-3 mr-1" /> Criar Produto
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
                                    onClick={() => setSelectedTargetProduct(p)}
                                    className={`p-2 border rounded cursor-pointer text-sm flex justify-between ${selectedTargetProduct?.id === p.id ? 'border-green-500 bg-green-50' : 'hover:bg-gray-50'}`}
                                >
                                    <span>{p.nome}</span>
                                    <span className="text-gray-500">{p.quantidade_estoque} un</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setMergeModalOpen(false)}>Cancelar</Button>
                        <Button
                            onClick={() => mergeProductMutation.mutate({ requestId: selectedRequest.id, targetProductId: selectedTargetProduct.id })}
                            disabled={!selectedTargetProduct || mergeProductMutation.isPending}
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                        >
                            Confirmar Vinculação
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
