import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { base44 } from '@/api/base44Client';
import { comprasService } from '@/services/comprasService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    Lightbulb, ShoppingCart, TrendingUp, AlertTriangle, ArrowRight,
    PackagePlus, Filter, RefreshCw, CheckCircle2, Inbox, Store
} from 'lucide-react';
import { toast } from 'sonner';

export default function CaixaDemandas({ onPedidoCriado }) {
    const queryClient = useQueryClient();
    const [selectedItens, setSelectedItens] = useState([]);
    const [filtroFornecedor, setFiltroFornecedor] = useState('todos');
    const [activeTab, setActiveTab] = useState('encomendas'); // Nova aba ativa padrão

    // Mapeamento de Fornecedores
    const { data: fornecedores = [] } = useQuery({
        queryKey: ['fornecedores'],
        queryFn: () => base44.entities.Fornecedor.list()
    });

    // 1. Buscar Encomendas do PDV (Solicitações pendentes)
    const { data: encomendas = [], isLoading: loadingEncomendas } = useQuery({
        queryKey: ['solicitacoes-pdv'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('solicitacoes_encomenda')
                .select('*')
                .eq('status', 'pendente')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        }
    });

    // 2. Buscar produtos abaixo do mínimo (Reposição)
    const {
        data: produtosPages,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading: loadingProdutos
    } = useInfiniteQuery({
        queryKey: ['produtos-reposicao'],
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
        return produtosPages?.pages.flatMap(page => page) || [];
    }, [produtosPages]);

    // Consolidar as demandas
    const demandas = useMemo(() => {
        let lista = [];

        // A. Adicionar Encomendas do PDV
        encomendas.forEach(enc => {
            lista.push({
                uniqueId: `enc_${enc.id}`,
                tipo: 'encomenda',
                id: enc.produto_id,
                solicitacao_id: enc.id,
                nome: enc.produto_nome,
                cliente: enc.cliente_nome,
                sugestao_qtd: enc.quantidade,
                venda_id: enc.venda_id,
                numero_pdv: enc.numero_pedido,
                fornecedor_id: null, // Pode ser preenchido se ligar ao produto, mas vamos tentar achar
                fornecedor_nome: enc.fornecedor_nome || 'A preencher'
            });
        });

        // B. Adicionar Reposições
        produtos.filter(p => {
            const estoqueAtual = p.quantidade_estoque || 0;
            const estoqueMinimo = p.estoque_minimo || 0;
            return estoqueMinimo > 0 && estoqueAtual <= estoqueMinimo;
        }).forEach(p => {
            const estoqueAtual = p.quantidade_estoque || 0;
            const estoqueMinimo = p.estoque_minimo || 0;
            const estoqueIdeal = p.estoque_ideal || (estoqueMinimo * 2);
            let sugestao = estoqueIdeal - estoqueAtual;
            if (sugestao <= 0) sugestao = 1;

            lista.push({
                uniqueId: `rep_${p.id}`,
                tipo: 'reposicao',
                id: p.id,
                nome: p.nome,
                estoqueAtual,
                estoqueMinimo,
                estoqueIdeal,
                sugestao_qtd: sugestao,
                preco_custo: p.preco_custo,
                fornecedor_id: p.fornecedor_id,
                fornecedor_nome: fornecedores.find(f => f.id === p.fornecedor_id)?.nome_empresa || 'Sem fornecedor',
                detalhes: {
                    modelo: p.modelo_referencia,
                    cor: p.cor,
                    material: p.material,
                    dimensoes: `${p.altura || ''}x${p.largura || ''}x${p.profundidade || ''}`
                },
                codigo_barras: p.codigo_barras
            });
        });

        if (filtroFornecedor !== 'todos') {
            lista = lista.filter(item => {
                if (item.tipo === 'encomenda') {
                    // Tenta achar o fornecedor do produto através da base local
                    const prodOrig = produtos.find(p => p.id == item.id);
                    if (prodOrig && prodOrig.fornecedor_id === filtroFornecedor) return true;
                    return false; // Se a encomenda não tiver fornecedor mapeado
                }
                return item.fornecedor_id === filtroFornecedor;
            });
        }

        return lista;
    }, [encomendas, produtos, fornecedores, filtroFornecedor]);

    const criarPedidoMutation = useMutation({
        mutationFn: async ({ orderData, itemsData }) => {
            return await comprasService.createOrdem(orderData, itemsData);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pedidos-compra-dashboard'] });
            queryClient.invalidateQueries({ queryKey: ['pedidos-compra-kanban'] });
        }
    });

    const atualizarSolicitacaoMutation = useMutation({
        mutationFn: async ({ solicitacaoId, pedidoId, numeroPedidoCompra }) => {
            return await supabase
                .from('solicitacoes_encomenda')
                .update({
                    status: 'pedida',
                    pedido_compra_id: pedidoId,
                    numero_pedido_compra: numeroPedidoCompra
                })
                .eq('id', solicitacaoId);
        }
    });

    const handleSelectAll = (checked) => {
        if (checked) {
            setSelectedItens(demandas.map(d => d.uniqueId));
        } else {
            setSelectedItens([]);
        }
    };

    const handleSelectOne = (uniqueId) => {
        if (selectedItens.includes(uniqueId)) {
            setSelectedItens(selectedItens.filter(i => i !== uniqueId));
        } else {
            setSelectedItens([...selectedItens, uniqueId]);
        }
    };

    const handleGerarPedidos = async () => {
        if (selectedItens.length === 0) {
            toast.error('Selecione pelo menos uma demanda');
            return;
        }

        const itensSelecionados = demandas.filter(d => selectedItens.includes(d.uniqueId));

        // Exigir fornecedor caso seja um grupo de encomendas soltas (agrupamos pelo ID local se existir)
        const pedidosPorFornecedor = {};

        for (const item of itensSelecionados) {
            // Tenta resgatar fornecedor ID se a demanda for encomenda
            let fornId = item.fornecedor_id;
            let fornNome = item.fornecedor_nome;

            if (item.tipo === 'encomenda' && !fornId) {
                const prodRef = produtos.find(p => p.id == item.id);
                if (prodRef?.fornecedor_id) {
                    fornId = prodRef.fornecedor_id;
                    fornNome = fornecedores.find(f => f.id === fornId)?.nome_empresa || fornNome;
                }
            }

            const chaveFornecedor = fornId || 'avulso';

            if (!pedidosPorFornecedor[chaveFornecedor]) {
                pedidosPorFornecedor[chaveFornecedor] = {
                    fornecedor_id: fornId,
                    fornecedor_nome: fornNome,
                    itens: [],
                    solicitacoesRelacionadas: [] // guardar para atualizar dps
                };
            }

            pedidosPorFornecedor[chaveFornecedor].itens.push({
                produto_id: item.id,
                produto_nome: item.nome,
                produto_codigo: item.codigo_barras || '',
                quantidade_pedida: item.sugestao_qtd,
                preco_unitario: item.preco_custo || 0,
                isNew: false,
                detalhes: item.detalhes || { modelo: '', cor: '', material: '', dimensoes: '' },
                // Campo extra se quiser guardar ref no JSON do pedido
                observacao_item: item.tipo === 'encomenda' ? `PDV: Venda ${item.numero_pdv} - Cliente: ${item.cliente}` : 'Reposição'
            });

            if (item.tipo === 'encomenda') {
                pedidosPorFornecedor[chaveFornecedor].solicitacoesRelacionadas.push(item.solicitacao_id);
            }
        }

        const numPedidos = Object.keys(pedidosPorFornecedor).length;
        if (Object.keys(pedidosPorFornecedor).includes('avulso')) {
            toast.warning('Alguns itens não têm fornecedor definido. Será gerado um pedido "Sem Fornecedor".');
        }

        const confirmacao = confirm(`Deseja gerar ${numPedidos} pedido(s) de compra (Status: Rascunho)?`);
        if (!confirmacao) return;

        let criados = 0;

        try {
            for (const chave in pedidosPorFornecedor) {
                const dados = pedidosPorFornecedor[chave];

                const orderData = {
                    fornecedor_id: dados.fornecedor_id,
                    fornecedor_nome: dados.fornecedor_nome,
                    data_pedido: new Date().toISOString(),
                    status: 'Rascunho',
                    observacoes: 'Gerado via Caixa de Demandas',
                    numero_pedido: `OC-${Math.floor(Date.now() / 1000)}` // Gera um número provisório
                };

                const vendaCriada = await criarPedidoMutation.mutateAsync({
                    orderData,
                    itemsData: dados.itens
                });

                // Atualizar solicitações atreladas
                for (const solId of dados.solicitacoesRelacionadas) {
                    await atualizarSolicitacaoMutation.mutateAsync({
                        solicitacaoId: solId,
                        pedidoId: vendaCriada.id,
                        numeroPedidoCompra: vendaCriada.numero_pedido
                    });
                }

                criados++;
            }

            toast.success(`${criados} pedido(s) gerado(s) com sucesso na Caixa Kanban!`);
            setSelectedItens([]);
            queryClient.invalidateQueries({ queryKey: ['solicitacoes-pdv'] });
            if (onPedidoCriado) onPedidoCriado();

        } catch (error) {
            console.error(error);
            toast.error('Erro ao gerar alguns pedidos.');
        }
    };

    if (loadingEncomendas || loadingProdutos) {
        return <div className="flex items-center justify-center p-12 text-blue-600 gap-2">
            <RefreshCw className="w-6 h-6 animate-spin" /> Atualizando Demandas...
        </div>;
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card
                    className={`border-purple-200 cursor-pointer transition-all ${activeTab === 'encomendas' ? 'bg-purple-100 ring-2 ring-purple-400' : 'bg-purple-50 hover:bg-purple-100/50'}`}
                    onClick={() => setActiveTab('encomendas')}
                >
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-purple-800 uppercase tracking-widest font-bold">
                            <Store className="w-4 h-4" />
                            Encomendas do PDV
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-purple-900">{encomendas.length}</div>
                        <p className="text-xs font-semibold text-purple-700 mt-1 uppercase">Aguardando Pedido de Compra</p>
                    </CardContent>
                </Card>

                <Card
                    className={`border-blue-200 cursor-pointer transition-all ${activeTab === 'reposicao' ? 'bg-blue-100 ring-2 ring-blue-400' : 'bg-blue-50 hover:bg-blue-100/50'}`}
                    onClick={() => setActiveTab('reposicao')}
                >
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-blue-800 uppercase tracking-widest font-bold">
                            <Lightbulb className="w-4 h-4" />
                            Reposição Sugerida
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-blue-900">{demandas.filter(d => d.tipo === 'reposicao').length}</div>
                        <p className="text-xs font-semibold text-blue-700 mt-1 uppercase">Produtos abaixo do mínimo</p>
                    </CardContent>
                </Card>

                <Card className="border-green-200 bg-green-50/30">
                    <CardContent className="pt-6 flex flex-col justify-center h-full">
                        <Button
                            size="lg"
                            className="w-full bg-green-600 hover:bg-green-700 gap-2 shadow-sm uppercase font-bold tracking-wide"
                            onClick={handleGerarPedidos}
                            disabled={selectedItens.length === 0}
                        >
                            <ShoppingCart className="w-5 h-5" />
                            Gerar Pedidos ({selectedItens.length})
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <Card className="shadow-sm">
                    <CardHeader className="bg-gray-50/50 border-b pb-4">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <Inbox className="w-5 h-5 text-gray-500" />
                                    Caixa de Demandas
                                </CardTitle>
                                <CardDescription>Consolide as demandas em Pedidos de Compra.</CardDescription>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                                <TabsList className="flex w-full md:w-max h-auto p-1.5 bg-gray-100/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-sm gap-1">
                                    <TabsTrigger
                                        value="encomendas"
                                        className="flex items-center gap-2.5 px-6 py-2 rounded-xl transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-purple-700 data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-purple-200 hover:bg-white/50"
                                    >
                                        <Store className="w-4 h-4" />
                                        <span className="font-semibold text-sm">Encomendas</span>
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="reposicao"
                                        className="flex items-center gap-2.5 px-6 py-2 rounded-xl transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-blue-200 hover:bg-white/50"
                                    >
                                        <Lightbulb className="w-4 h-4" />
                                        <span className="font-semibold text-sm">Reposição</span>
                                    </TabsTrigger>
                                </TabsList>

                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                    <Filter className="w-4 h-4 text-gray-500" />
                                    <Select value={filtroFornecedor} onValueChange={setFiltroFornecedor}>
                                        <SelectTrigger className="w-full sm:w-[200px] h-10 rounded-xl bg-white">
                                            <SelectValue placeholder="Filtrar Fornecedor" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="todos">Todos Fornecedores</SelectItem>
                                            {fornecedores.map(f => (
                                                <SelectItem key={f.id} value={f.id}>{f.nome_empresa}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="p-0">
                        <TabsContent value="encomendas" className="m-0 border-none outline-none">
                            <TabelaDemandas
                                tipo="encomenda"
                                data={demandas.filter(d => d.tipo === 'encomenda')}
                                selectedItens={selectedItens}
                                onSelectAll={handleSelectAll}
                                onSelectOne={handleSelectOne}
                            />
                        </TabsContent>

                        <TabsContent value="reposicao" className="m-0 border-none outline-none">
                            <TabelaDemandas
                                tipo="reposicao"
                                data={demandas.filter(d => d.tipo === 'reposicao')}
                                selectedItens={selectedItens}
                                onSelectAll={handleSelectAll}
                                onSelectOne={handleSelectOne}
                            />

                            {hasNextPage && (
                                <div className="p-4 text-center border-t bg-gray-50">
                                    <Button variant="outline" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                                        {isFetchingNextPage ? 'Buscando...' : 'Carregar mais reposições'}
                                    </Button>
                                </div>
                            )}
                        </TabsContent>
                    </CardContent>
                </Card>
            </Tabs>
        </div>
    );
}

// Componente Auxiliar para renderizar a tabela, evitando repetição de código
function TabelaDemandas({ tipo, data, selectedItens, onSelectAll, onSelectOne }) {
    return (
        <Table>
            <TableHeader className="bg-gray-50/80">
                <TableRow>
                    <TableHead className="w-[50px]">
                        <Checkbox
                            checked={selectedItens.length > 0 && data.every(item => selectedItens.includes(item.uniqueId))}
                            onCheckedChange={(checked) => {
                                // Se checked, adiciona todos os visíveis na aba. Senão, remove.
                                const uniqueIds = data.map(d => d.uniqueId);
                                if (checked) {
                                    // Pegar os atuais e mesclar (evitando duplicidade) com os da view atual
                                    const mixed = new Set([...selectedItens, ...uniqueIds]);
                                    onSelectAll(Array.from(mixed), true); // Passando param customizado pra saber que é parcial?
                                    // Nota: Para manter simples e evitar bugs de estado, reescrevi o checkbox no onCheckedChange direto no componente pai se necessário, ou filtro aqui.
                                } else {
                                    // Remover apenas os ids desta aba
                                    onSelectAll(selectedItens.filter(id => !uniqueIds.includes(id)), false);
                                }
                            }}
                        />
                    </TableHead>
                    <TableHead>Detalhes</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead className="text-right">Qtd Sugerida</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {data.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={4} className="text-center py-12 text-gray-500 font-medium">
                            Nenhuma demanda de {tipo === 'encomenda' ? 'encomenda' : 'reposição'} pendente 🎉
                        </TableCell>
                    </TableRow>
                ) : (
                    data.map((item) => {
                        const isSelected = selectedItens.includes(item.uniqueId);
                        const isEncomenda = item.tipo === 'encomenda';

                        return (
                            <TableRow key={item.uniqueId} className={`${isSelected ? (isEncomenda ? "bg-purple-50/50" : "bg-blue-50/50") : ""} hover:bg-gray-50 transition-colors`}>
                                <TableCell>
                                    <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={() => onSelectOne(item.uniqueId)}
                                    />
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-1.5">
                                        <span className="font-semibold text-gray-900 leading-none">{item.nome}</span>
                                        {isEncomenda ? (
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200 uppercase text-[10px] tracking-wide font-bold px-1.5 py-0">PDV - Encomenda</Badge>
                                                <span className="text-[11px] text-gray-500 font-medium">Ped: {item.numero_pdv} • Cli: {item.cliente}</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge variant="outline" className="text-blue-700 bg-blue-50 border-blue-200 uppercase text-[10px] tracking-wide font-bold px-1.5 py-0">Estoque Baixo</Badge>
                                                <span className="text-[11px] text-gray-500 font-medium whitespace-nowrap">
                                                    Atual: <strong className="text-red-500">{item.estoqueAtual}</strong> / Mín: {item.estoqueMinimo}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="text-sm text-gray-600 truncate max-w-[200px]" title={item.fornecedor_nome}>
                                        {item.fornecedor_nome}
                                    </div>
                                </TableCell>
                                <TableCell className={`text-right font-bold text-lg ${isEncomenda ? 'text-purple-700' : 'text-blue-700'}`}>
                                    {item.sugestao_qtd}
                                </TableCell>
                            </TableRow>
                        );
                    })
                )}
            </TableBody>
        </Table>
    );
}
