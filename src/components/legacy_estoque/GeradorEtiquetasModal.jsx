import React, { useRef, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useReactToPrint } from "react-to-print";
import EtiquetaImpressao from "./EtiquetaImpressao";
import { Printer, Plus, Minus, Search, Trash2, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function GeradorEtiquetasModal({
    isOpen,
    onClose,
    produtosPreSelecionados = [],
    user
}) {
    const componentRef = useRef(null);

    // Lista de itens a serem impressos: { produto, quantidade }
    const [itensImpressao, setItensImpressao] = useState(
        produtosPreSelecionados.map(p => ({ produto: p, quantidade: 1 }))
    );

    const [searchTerm, setSearchTerm] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState([]);

    // Atualizar quando a prop produtosPreSelecionados mudar e o modal abrir
    React.useEffect(() => {
        if (isOpen && produtosPreSelecionados.length > 0) {
            setItensImpressao(produtosPreSelecionados.map(p => ({ produto: p, quantidade: 1 })));
        } else if (isOpen && produtosPreSelecionados.length === 0) {
            setItensImpressao([]);
        }
        setSearchTerm("");
        setSearchResults([]);
    }, [isOpen, produtosPreSelecionados]);

    // Busca de produtos para adicionar à lista
    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchTerm || searchTerm.length < 2) return;

        setIsSearching(true);
        try {
            const { data } = await base44.entities.Produto.search({
                search: searchTerm,
                limit: 10
            });
            setSearchResults(data || []);
            if (data?.length === 0) {
                toast.info("Nenhum produto encontrado");
            }
        } catch (error) {
            toast.error("Erro na busca: " + error.message);
        } finally {
            setIsSearching(false);
        }
    };

    const adicionarProduto = (produto) => {
        setItensImpressao(prev => {
            const existe = prev.find(item => item.produto.id === produto.id);
            if (existe) {
                return prev.map(item =>
                    item.produto.id === produto.id
                        ? { ...item, quantidade: item.quantidade + 1 }
                        : item
                );
            }
            return [...prev, { produto, quantidade: 1 }];
        });
        toast.success(`${produto.nome} adicionado`);
    };

    const atualizarQuantidade = (id, delta) => {
        setItensImpressao(prev => prev.map(item => {
            if (item.produto.id === id) {
                const novaQtd = Math.max(1, item.quantidade + delta);
                return { ...item, quantidade: novaQtd };
            }
            return item;
        }));
    };

    const removerProduto = (id) => {
        setItensImpressao(prev => prev.filter(item => item.produto.id !== id));
    };

    // Gerar a array linear de produtos baseada nas quantidades
    const getProdutosParaImpressao = () => {
        const arr = [];
        itensImpressao.forEach(item => {
            for (let i = 0; i < item.quantidade; i++) {
                arr.push(item.produto);
            }
        });
        return arr;
    };

    const produtosImpressao = getProdutosParaImpressao();
    const totalEtiquetas = produtosImpressao.length;

    const handlePrint = useReactToPrint({
        contentRef: componentRef,
        documentTitle: "Etiquetas_Pedido",
        onAfterPrint: () => {
            toast.success("Impressão finalizada");
            onClose();
        }
    });

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
                <div className="p-6 pb-2 border-b">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <Printer className="w-5 h-5 text-gray-700" />
                            Gerador de Etiquetas (1/4 A4)
                        </DialogTitle>
                        <DialogDescription>
                            Adicione produtos à lista e defina a quantidade desejada. A impressão será em tamanho A6.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                {/* Corpo do Modal: Split Screen (Controles vs Preview) */}
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-gray-50/50">

                    {/* Lado Esquerdo: Controles */}
                    <div className="w-full md:w-1/2 p-6 flex flex-col gap-6 border-r overflow-y-auto">

                        {/* Busca */}
                        <div className="space-y-3">
                            <h3 className="font-semibold text-sm text-gray-700">Adicionar Produtos</h3>
                            <form onSubmit={handleSearch} className="flex gap-2">
                                <Input
                                    placeholder="Buscar produto por nome ou ref..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="bg-white"
                                />
                                <Button type="submit" disabled={isSearching} variant="secondary">
                                    <Search className="w-4 h-4" />
                                </Button>
                            </form>

                            {/* Resultados da Busca */}
                            {searchResults.length > 0 && (
                                <div className="bg-white border rounded-md shadow-sm max-h-40 overflow-y-auto w-full z-10 p-1">
                                    {searchResults.map(prod => (
                                        <div
                                            key={prod.id}
                                            className="flex justify-between items-center p-2 hover:bg-gray-50 rounded text-sm cursor-pointer border-b last:border-0"
                                            onClick={() => adicionarProduto(prod)}
                                        >
                                            <div className="truncate pr-2">
                                                <span className="font-medium block truncate">{prod.nome}</span>
                                                <span className="text-xs text-gray-400">R$ {prod.preco_venda}</span>
                                            </div>
                                            <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0 rounded-full bg-green-50 text-green-600 hover:bg-green-100">
                                                <Plus className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Lista de Selecionados */}
                        <div className="flex-1 flex flex-col">
                            <h3 className="font-semibold text-sm text-gray-700 mb-3 flex justify-between">
                                <span>Lista de Impressão</span>
                                <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">
                                    Total: {totalEtiquetas} etiqueta(s)
                                </span>
                            </h3>

                            <ScrollArea className="flex-1 h-[250px] pr-4 border rounded-md bg-white p-2">
                                {itensImpressao.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-400 p-4 text-center">
                                        <Printer className="w-8 h-8 mb-2 opacity-50" />
                                        <p className="text-sm">Nenhum produto adicionado.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {itensImpressao.map(item => (
                                            <div key={item.produto.id} className="bg-gray-50 border p-3 rounded-lg flex items-center justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-sm text-gray-900 truncate" title={item.produto.nome}>
                                                        {item.produto.nome}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        {item.produto.modelo_referencia ? `Ref: ${item.produto.modelo_referencia}` : 'S/ Ref'}
                                                    </p>
                                                </div>

                                                <div className="flex items-center gap-1 bg-white border rounded shadow-sm px-1 py-0.5 shrink-0">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        onClick={() => atualizarQuantidade(item.produto.id, -1)}
                                                    >
                                                        <Minus className="h-3 w-3" />
                                                    </Button>
                                                    <span className="text-sm font-medium w-6 text-center">
                                                        {item.quantidade}
                                                    </span>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        onClick={() => atualizarQuantidade(item.produto.id, 1)}
                                                    >
                                                        <Plus className="h-3 w-3" />
                                                    </Button>
                                                </div>

                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0"
                                                    onClick={() => removerProduto(item.produto.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>
                        </div>

                    </div>

                    {/* Lado Direito: Preview */}
                    <div className="w-full md:w-1/2 bg-gray-200/50 p-6 flex flex-col relative">
                        <h3 className="font-semibold text-sm text-gray-700 mb-3 flex items-center gap-2">
                            Preview da Impressão
                            <span className="text-xs font-normal text-gray-500">(1 página = 4 etiquetas)</span>
                        </h3>

                        <ScrollArea className="flex-1 h-[450px] border border-gray-300 rounded-md bg-gray-100 shadow-inner overflow-hidden relative">
                            {produtosImpressao.length > 0 ? (
                                <div className="scale-[0.4] origin-top-left translate-x-4 translate-y-4 w-[210mm] pointer-events-none">
                                    {/* Renderizamos o componente invisível que será pescado pelo react-to-print,
                       e o mesmo componente visualmente apenas para preview */}
                                    <div className="bg-white shadow">
                                        <EtiquetaImpressao empresa={user} produtos={produtosImpressao} />
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full w-full flex flex-col items-center justify-center text-gray-400">
                                    <p>Adicione itens para visualizar</p>
                                </div>
                            )}
                        </ScrollArea>

                        {/* Hidden component só pro ReactToPrint (Não afetado pelo scale do preview) */}
                        <div className="hidden">
                            <EtiquetaImpressao
                                ref={componentRef}
                                empresa={user}
                                produtos={produtosImpressao}
                            />
                        </div>
                    </div>

                </div>

                <DialogFooter className="p-4 border-t bg-gray-50">
                    <Button variant="outline" onClick={onClose} className="mr-auto">Cancelar</Button>
                    <Button
                        className="bg-green-600 hover:bg-green-700 font-medium"
                        onClick={handlePrint}
                        disabled={totalEtiquetas === 0}
                    >
                        <Printer className="w-4 h-4 mr-2" />
                        Imprimir {totalEtiquetas} Etiquetas
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
