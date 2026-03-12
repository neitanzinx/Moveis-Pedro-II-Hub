import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    Lightbulb, ShoppingCart, TrendingUp, AlertTriangle, ArrowRight,
    PackagePlus, Filter, RefreshCw, CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';

export default function SugestaoComprasTab({ onPedidoCriado }) {
    const queryClient = useQueryClient();
    const [selectedItens, setSelectedItens] = useState([]);
    const [filtroFornecedor, setFiltroFornecedor] = useState('todos');

    // Buscar produtos com paginação (Otimizado)
    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading: isLoadingProdutos
    } = useInfiniteQuery({
        queryKey: ['produtos-sugestao'],
        queryFn: async ({ pageParam = 0 }) => {
            const limit = 100;
            const from = pageParam * limit;
            const to = from + limit - 1;

            const { data, error } = await supabase
                .from('produtos')
                .select('id, nome, codigo_barras, quantidade_estoque, estoque_minimo, estoque_ideal, fornecedor_id, preco_custo, modelo_referencia, cor, material, largura, altura, profundidade, fotos, descricao')
                .eq('ativo', true)
                .not('nome', 'ilike', '%CONJUNTO%')
                .range(from, to);

            if (error) throw error;
            return data;
        },
        getNextPageParam: (lastPage, allPages) => {
            return lastPage.length === 100 ? allPages.length : undefined;
        },
        initialPageParam: 0
    });

    const produtos = useMemo(() => {
        return data?.pages.flatMap(page => page) || [];
    }, [data]);

    // Buscar fornecedores para mapear nomes
    const { data: fornecedores = [] } = useQuery({
        queryKey: ['fornecedores'],
        queryFn: () => base44.entities.Fornecedor.list()
    });

    // Filtra produtos que precisam de reposição e calcula sugestão
    // NOTA: Isso só considera os produtos JÁ carregados.
    const sugestoes = useMemo(() => {
        return produtos
            .filter(p => {
                const estoqueAtual = p.quantidade_estoque || 0;
                const estoqueMinimo = p.estoque_minimo || 0;
                return estoqueMinimo > 0 && estoqueAtual <= estoqueMinimo;
            })
            .map(p => {
                const estoqueAtual = p.quantidade_estoque || 0;
                const estoqueMinimo = p.estoque_minimo || 0;
                const estoqueIdeal = p.estoque_ideal || (estoqueMinimo * 2);

                let sugestao = estoqueIdeal - estoqueAtual;
                if (sugestao <= 0) sugestao = 1;

                return {
                    ...p,
                    sugestao_qtd: sugestao,
                    fornecedor_nome: fornecedores.find(f => f.id === p.fornecedor_id)?.nome_empresa || 'Não definido'
                };
            })
            .filter(p => filtroFornecedor === 'todos' || p.fornecedor_id === filtroFornecedor);
    }, [produtos, fornecedores, filtroFornecedor]);

    // Agrupamento por fornecedor para visualização
    const sugestoesPorFornecedor = useMemo(() => {
        const grupos = {};
        sugestoes.forEach(item => {
            const fornId = item.fornecedor_id || 'sem_fornecedor';
            if (!grupos[fornId]) {
                grupos[fornId] = {
                    id: fornId,
                    nome: item.fornecedor_nome,
                    intens: []
                };
            }
            grupos[fornId].intens.push(item);
        });
        return Object.values(grupos);
    }, [sugestoes]);

    // Mutation para criar pedido
    const criarPedidoMutation = useMutation({
        mutationFn: async (dadosPedido) => {
            return await base44.entities.PedidoCompra.create(dadosPedido);
        },
        onSuccess: () => {
            // Redireciona para aba de pedidos ou avisa.
            // Invalidar queries
            queryClient.invalidateQueries({ queryKey: ['pedidos-compra'] });
        }
    });

    const handleSelectAll = (checked) => {
        if (checked) {
            setSelectedItens(sugestoes.map(p => p.id));
        } else {
            setSelectedItens([]);
        }
    };

    const handleSelectOne = (id) => {
        if (selectedItens.includes(id)) {
            setSelectedItens(selectedItens.filter(i => i !== id));
        } else {
            setSelectedItens([...selectedItens, id]);
        }
    };

    const handleGerarPedidos = async () => {
        if (selectedItens.length === 0) {
            toast.error('Selecione pelo menos um item');
            return;
        }

        const itensSelecionados = sugestoes.filter(p => selectedItens.includes(p.id));

        // Agrupar por fornecedor
        const pedidosPorFornecedor = {};

        itensSelecionados.forEach(item => {
            const fornId = item.fornecedor_id || 'avulso';
            if (!pedidosPorFornecedor[fornId]) {
                pedidosPorFornecedor[fornId] = {
                    fornecedor_id: item.fornecedor_id,
                    fornecedor_nome: item.fornecedor_nome,
                    itens: []
                };
            }
            pedidosPorFornecedor[fornId].itens.push({
                produto_id: item.id,
                produto_nome: item.nome,
                produto_codigo: item.codigo_barras,
                quantidade_pedida: item.sugestao_qtd,
                preco_unitario: item.preco_custo || 0,
                isNew: false,
                // Persistir detalhes para o pedido não ficar orfão de info
                detalhes: {
                    modelo: item.modelo_referencia,
                    cor: item.cor,
                    material: item.material,
                    dimensoes: `${item.altura || ''}x${item.largura || ''}x${item.profundidade || ''}`
                }
            });
        });

        const numPedidos = Object.keys(pedidosPorFornecedor).length;
        const confirmacao = confirm(`Deseja gerar ${numPedidos} pedido(s) de compra Rascunho?`);

        if (!confirmacao) return;

        let criados = 0;
        let erros = 0;

        try {
            for (const fornId in pedidosPorFornecedor) {
                const dados = pedidosPorFornecedor[fornId];

                await criarPedidoMutation.mutateAsync({
                    fornecedor_id: dados.fornecedor_id,
                    fornecedor_nome: dados.fornecedor_nome,
                    data_pedido: new Date().toISOString().split('T')[0],
                    status: 'Rascunho',
                    itens: dados.itens,
                    observacoes: 'Gerado automaticamente via Sugestão de Compras'
                });
                criados++;
            }

            toast.success(`${criados} pedido(s) gerado(s) com sucesso!`);
            setSelectedItens([]);
            if (onPedidoCriado) onPedidoCriado();

        } catch (error) {
            console.error(error);
            toast.error('Erro ao gerar alguns pedidos. Verifique os rascunhos.');
        }
    };

    if (isLoadingProdutos) {
        return <div className="p-8 text-center flex flex-col items-center gap-2">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
            <p>Carregando sugestões...</p>
        </div>;
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-blue-50 border-blue-200">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2 text-blue-800">
                            <Lightbulb className="w-5 h-5" />
                            Itens para Reposição (Carregados)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-blue-900">{sugestoes.length}</div>
                        <p className="text-sm text-blue-700">Produtos abaixo do mínimo</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2 text-gray-700">
                            <ShoppingCart className="w-5 h-5" />
                            Volume Sugerido
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-gray-900">
                            {sugestoes.reduce((acc, curr) => acc + curr.sugestao_qtd, 0)}
                        </div>
                        <p className="text-sm text-gray-500">Unidades totais a comprar</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6 flex flex-col justify-center h-full">
                        <Button
                            size="lg"
                            className="w-full bg-green-600 hover:bg-green-700 gap-2"
                            onClick={handleGerarPedidos}
                            disabled={selectedItens.length === 0}
                        >
                            <PackagePlus className="w-5 h-5" />
                            Gerar Pedidos ({selectedItens.length})
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Sugestões Detalhadas</CardTitle>
                            <CardDescription>Baseado em Estoque Mínimo e Ideal configurados</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Filter className="w-4 h-4 text-gray-500" />
                            <select
                                className="text-sm border rounded p-1"
                                value={filtroFornecedor}
                                onChange={(e) => setFiltroFornecedor(e.target.value)}
                            >
                                <option value="todos">Todos Fornecedores</option>
                                {fornecedores.map(f => (
                                    <option key={f.id} value={f.id}>{f.nome_empresa || f.razao_social}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]">
                                    <Checkbox
                                        checked={selectedItens.length === sugestoes.length && sugestoes.length > 0}
                                        onCheckedChange={handleSelectAll}
                                    />
                                </TableHead>
                                <TableHead>Produto</TableHead>
                                <TableHead>Fornecedor</TableHead>
                                <TableHead className="text-center">Atual</TableHead>
                                <TableHead className="text-center">Mínimo</TableHead>
                                <TableHead className="text-center">Ideal</TableHead>
                                <TableHead className="text-right bg-blue-50 font-bold text-blue-700">Sugestão</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sugestoes.map((produto) => {
                                const isSelected = selectedItens.includes(produto.id);
                                return (
                                    <TableRow key={produto.id} className={isSelected ? "bg-blue-50/50" : ""}>
                                        <TableCell>
                                            <Checkbox
                                                checked={isSelected}
                                                onCheckedChange={() => handleSelectOne(produto.id)}
                                            />
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            <div className="flex flex-col">
                                                <span className="text-base">{produto.nome}</span>
                                                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-gray-500">
                                                    {produto.modelo_referencia && (
                                                        <span title="Modelo/Referência">Ref: {produto.modelo_referencia}</span>
                                                    )}
                                                    {produto.cor && (
                                                        <span title="Cor">Cor: {produto.cor}</span>
                                                    )}
                                                    {produto.material && (
                                                        <span title="Material">Mat: {produto.material}</span>
                                                    )}
                                                    {(produto.largura || produto.altura || produto.profundidade) && (
                                                        <span title="Dimensões (AxLxP)">
                                                            Dim: {produto.altura || '?'}x{produto.largura || '?'}x{produto.profundidade || '?'}
                                                        </span>
                                                    )}
                                                    {produto.codigo_barras && (
                                                        <span title="EAN/GTIN">EAN: {produto.codigo_barras}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1 text-sm text-gray-600">
                                                {/* <Building2 className="w-3 h-3" /> */}
                                                {produto.fornecedor_nome}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center text-red-600 font-medium">
                                            {produto.quantidade_estoque || 0}
                                        </TableCell>
                                        <TableCell className="text-center text-gray-500">
                                            {produto.estoque_minimo || 0}
                                        </TableCell>
                                        <TableCell className="text-center text-gray-500">
                                            {produto.estoque_ideal || '-'}
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-blue-600 bg-blue-50/50">
                                            {produto.sugestao_qtd}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>

                    {/* Botão Carregar Mais */}
                    {hasNextPage && (
                        <div className="p-4 text-center border-t bg-gray-50">
                            <Button
                                variant="outline"
                                onClick={() => fetchNextPage()}
                                disabled={isFetchingNextPage}
                                className="w-full md:w-auto"
                            >
                                {isFetchingNextPage ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                        Carregando mais...
                                    </>
                                ) : (
                                    'Carregar mais produtos para analisar'
                                )}
                            </Button>
                            <p className="text-xs text-gray-500 mt-2">
                                Carregados: {produtos.length} produtos
                            </p>
                        </div>
                    )}

                    {!hasNextPage && produtos.length > 0 && (
                        <div className="p-4 text-center text-sm text-gray-500 bg-gray-50 border-t">
                            Todos os produtos foram carregados.
                        </div>
                    )}
                </CardContent>
            </Card>

        </div>
    );
}
