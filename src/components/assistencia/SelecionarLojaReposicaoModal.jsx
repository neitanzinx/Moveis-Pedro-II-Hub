import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package, AlertTriangle } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

/**
 * Modal de seleção de unidade (loja) de onde descontar o estoque
 * ao concluir uma assistência de tipo Troca ou Peça Faltante.
 *
 * Props:
 *  - isOpen: boolean
 *  - onClose: () => void
 *  - onConfirm: (selecao: { [produto_id]: { loja_id, loja_nome, estoque_disponivel } }) => void
 *  - itens: Array<{ produto_id, produto_nome, quantidade }>
 *  - lojas: Array<{ id, nome, codigo }>
 */
export default function SelecionarLojaReposicaoModal({ isOpen, onClose, onConfirm, itens = [], lojas = [] }) {
    const [estoquePorLojaEProduto, setEstoquePorLojaEProduto] = useState({});
    const [selecao, setSelecao] = useState({});
    const [carregando, setCarregando] = useState(false);

    // Buscar estoque de cada produto em cada loja ao abrir o modal
    useEffect(() => {
        if (!isOpen || itens.length === 0 || lojas.length === 0) return;

        const buscarEstoques = async () => {
            setCarregando(true);
            try {
                const produtoIds = [...new Set(itens.map(i => i.produto_id).filter(Boolean))];
                const lojaIds = lojas.map(l => l.id);

                const { data, error } = await supabase
                    .from('estoque_loja')
                    .select('produto_id, loja_id, quantidade, quantidade_disponivel')
                    .in('produto_id', produtoIds)
                    .in('loja_id', lojaIds);

                if (error) throw error;

                // Montar mapa: { [produto_id]: { [loja_id]: quantidade } }
                const mapa = {};
                for (const row of data || []) {
                    if (!mapa[row.produto_id]) mapa[row.produto_id] = {};
                    mapa[row.produto_id][row.loja_id] = row.quantidade_disponivel ?? row.quantidade ?? 0;
                }
                setEstoquePorLojaEProduto(mapa);

                // Pré-selecionar automaticamente a loja com mais estoque para cada item
                const selecaoInicial = {};
                for (const item of itens) {
                    const estoqueDoItem = mapa[item.produto_id] || {};
                    let melhorLoja = null;
                    let melhorQtd = -1;
                    for (const loja of lojas) {
                        const qtd = estoqueDoItem[loja.id] ?? 0;
                        if (qtd > melhorQtd) {
                            melhorQtd = qtd;
                            melhorLoja = loja;
                        }
                    }
                    if (melhorLoja) {
                        selecaoInicial[item.produto_id] = {
                            loja_id: melhorLoja.id,
                            loja_nome: melhorLoja.nome,
                            estoque_disponivel: melhorQtd,
                        };
                    }
                }
                setSelecao(selecaoInicial);
            } catch (err) {
                console.error("Erro ao buscar estoques por loja:", err);
            } finally {
                setCarregando(false);
            }
        };

        buscarEstoques();
    }, [isOpen, itens, lojas]);

    const handleSelecaoLoja = (produtoId, loja) => {
        const qtd = estoquePorLojaEProduto[produtoId]?.[loja.id] ?? 0;
        setSelecao(prev => ({
            ...prev,
            [produtoId]: {
                loja_id: loja.id,
                loja_nome: loja.nome,
                estoque_disponivel: qtd,
            },
        }));
    };

    const todosSelecionados = itens.every(item => selecao[item.produto_id]);

    const handleConfirmar = () => {
        onConfirm(selecao);
    };

    return (
        <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Package className="w-5 h-5 text-orange-600" />
                        Selecionar Unidade para Desconto de Estoque
                    </DialogTitle>
                    <p className="text-sm text-gray-500 mt-1">
                        Selecione de qual unidade cada item será descontado. O estoque será reduzido e uma solicitação de reposição será enviada para Compras.
                    </p>
                </DialogHeader>

                {carregando ? (
                    <div className="flex justify-center items-center py-10">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                        <span className="ml-2 text-sm text-gray-500">Consultando estoques...</span>
                    </div>
                ) : (
                    <div className="space-y-6 py-2">
                        {itens.map(item => {
                            const estoqueItem = estoquePorLojaEProduto[item.produto_id] || {};
                            const selecaoItem = selecao[item.produto_id];
                            const totalEstoque = Object.values(estoqueItem).reduce((s, q) => s + q, 0);

                            return (
                                <div key={item.produto_id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <p className="font-medium text-gray-900">{item.produto_nome}</p>
                                            <p className="text-xs text-gray-500">
                                                Quantidade a descontar: <span className="font-semibold text-red-600">-{item.quantidade}</span>
                                            </p>
                                        </div>
                                        <Badge
                                            className={
                                                totalEstoque === 0
                                                    ? "bg-red-100 text-red-700 border-red-200"
                                                    : totalEstoque < item.quantidade
                                                    ? "bg-yellow-100 text-yellow-700 border-yellow-200"
                                                    : "bg-green-100 text-green-700 border-green-200"
                                            }
                                        >
                                            Total: {totalEstoque} unid.
                                        </Badge>
                                    </div>

                                    {totalEstoque === 0 && (
                                        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                                            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                            Estoque zerado em todas as unidades. A reposição será enviada para compras mesmo assim.
                                        </div>
                                    )}

                                    <RadioGroup
                                        value={selecaoItem?.loja_id || ''}
                                        onValueChange={lojaId => {
                                            const loja = lojas.find(l => l.id === lojaId);
                                            if (loja) handleSelecaoLoja(item.produto_id, loja);
                                        }}
                                        className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                                    >
                                        {lojas.map(loja => {
                                            const qtd = estoqueItem[loja.id] ?? 0;
                                            const semEstoque = qtd < item.quantidade;
                                            return (
                                                <div
                                                    key={loja.id}
                                                    className={`flex items-center space-x-2 border rounded-lg p-3 cursor-pointer transition-colors ${
                                                        selecaoItem?.loja_id === loja.id
                                                            ? "border-green-600 bg-green-50"
                                                            : "border-gray-200 hover:border-gray-300"
                                                    }`}
                                                    onClick={() => handleSelecaoLoja(item.produto_id, loja)}
                                                >
                                                    <RadioGroupItem value={loja.id} id={`${item.produto_id}-${loja.id}`} />
                                                    <Label
                                                        htmlFor={`${item.produto_id}-${loja.id}`}
                                                        className="flex-1 cursor-pointer"
                                                    >
                                                        <span className="block font-medium text-sm">{loja.nome}</span>
                                                        <span className={`text-xs ${semEstoque ? "text-amber-600 font-medium" : "text-gray-500"}`}>
                                                            {qtd} unid. disponíveis
                                                            {semEstoque && qtd > 0 && " (insuficiente)"}
                                                            {qtd === 0 && " (sem estoque)"}
                                                        </span>
                                                    </Label>
                                                </div>
                                            );
                                        })}
                                    </RadioGroup>
                                </div>
                            );
                        })}
                    </div>
                )}

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onClose} disabled={carregando}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleConfirmar}
                        disabled={carregando || !todosSelecionados}
                        className="bg-green-700 hover:bg-green-800 text-white"
                    >
                        {carregando ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                            <Package className="w-4 h-4 mr-2" />
                        )}
                        Confirmar Desconto e Enviar para Compras
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
