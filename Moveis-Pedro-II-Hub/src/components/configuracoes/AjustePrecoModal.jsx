import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, TrendingDown, Loader2, CheckCircle, Package, Percent, DollarSign } from "lucide-react";
import { toast } from "sonner";

export default function AjustePrecoModal({ isOpen, onClose, produtos = [] }) {
    const [tipoAjuste, setTipoAjuste] = useState("porcentagem"); // porcentagem, fixo
    const [operacao, setOperacao] = useState("aumentar");
    const [percentual, setPercentual] = useState("");
    const [valorFixo, setValorFixo] = useState("");
    const [categoria, setCategoria] = useState("todas");
    const [produtosSelecionados, setProdutosSelecionados] = useState([]);
    const [selecionarTodos, setSelecionarTodos] = useState(false);
    const [aplicando, setAplicando] = useState(false);

    const queryClient = useQueryClient();

    const categorias = [...new Set(produtos.map(p => p.categoria).filter(Boolean))].sort();

    const produtosFiltrados = categoria === "todas"
        ? produtos
        : produtos.filter(p => p.categoria === categoria);

    const toggleProduto = (id) => {
        setProdutosSelecionados(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const toggleTodos = () => {
        if (selecionarTodos) {
            setProdutosSelecionados([]);
        } else {
            setProdutosSelecionados(produtosFiltrados.map(p => p.id));
        }
        setSelecionarTodos(!selecionarTodos);
    };

    const calcularNovoPreco = (precoAtual) => {
        if (!precoAtual) return 0;

        if (tipoAjuste === "porcentagem") {
            const pct = parseFloat(percentual) || 0;
            return operacao === "aumentar"
                ? precoAtual * (1 + pct / 100)
                : precoAtual * (1 - pct / 100);
        } else {
            const valor = parseFloat(valorFixo) || 0;
            return operacao === "aumentar"
                ? precoAtual + valor
                : Math.max(0, precoAtual - valor);
        }
    };

    const formatMoney = (value) => {
        if (!value && value !== 0) return "R$ 0,00";
        return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    };

    const produtosParaAjuste = produtosFiltrados.filter(p => produtosSelecionados.includes(p.id));

    const valorAtivo = tipoAjuste === "porcentagem" ? percentual : valorFixo;

    const aplicarAjuste = async () => {
        if (produtosParaAjuste.length === 0) {
            toast.error("Selecione pelo menos um produto");
            return;
        }
        if (!valorAtivo || parseFloat(valorAtivo) <= 0) {
            toast.error("Informe um valor válido");
            return;
        }

        setAplicando(true);
        try {
            for (const produto of produtosParaAjuste) {
                const novoPreco = calcularNovoPreco(produto.preco_venda);
                await base44.entities.Produto.update(produto.id, {
                    preco_venda: Math.round(novoPreco * 100) / 100
                });
            }
            toast.success(`${produtosParaAjuste.length} produtos atualizados!`);
            queryClient.invalidateQueries({ queryKey: ['produtos'] });
            onClose();
        } catch (error) {
            toast.error("Erro ao ajustar preços: " + error.message);
        } finally {
            setAplicando(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
                <DialogHeader className="pb-4 border-b">
                    <DialogTitle className="text-xl font-semibold" style={{ color: '#07593f' }}>
                        Ajuste de Preços em Massa
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto space-y-5 py-4">
                    {/* Tipo de Ajuste */}
                    <div className="flex gap-3">
                        <button
                            onClick={() => setTipoAjuste("porcentagem")}
                            className={`flex-1 p-4 rounded-xl border-2 transition-all ${tipoAjuste === "porcentagem"
                                    ? "border-green-500 bg-green-50"
                                    : "border-gray-200 hover:border-gray-300"
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${tipoAjuste === "porcentagem" ? "bg-green-100" : "bg-gray-100"}`}>
                                    <Percent className={`w-5 h-5 ${tipoAjuste === "porcentagem" ? "text-green-600" : "text-gray-400"}`} />
                                </div>
                                <div className="text-left">
                                    <p className={`font-semibold ${tipoAjuste === "porcentagem" ? "text-green-800" : "text-gray-700"}`}>
                                        Porcentagem
                                    </p>
                                    <p className="text-xs text-gray-500">Ajustar por %</p>
                                </div>
                            </div>
                        </button>

                        <button
                            onClick={() => setTipoAjuste("fixo")}
                            className={`flex-1 p-4 rounded-xl border-2 transition-all ${tipoAjuste === "fixo"
                                    ? "border-blue-500 bg-blue-50"
                                    : "border-gray-200 hover:border-gray-300"
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${tipoAjuste === "fixo" ? "bg-blue-100" : "bg-gray-100"}`}>
                                    <DollarSign className={`w-5 h-5 ${tipoAjuste === "fixo" ? "text-blue-600" : "text-gray-400"}`} />
                                </div>
                                <div className="text-left">
                                    <p className={`font-semibold ${tipoAjuste === "fixo" ? "text-blue-800" : "text-gray-700"}`}>
                                        Valor Fixo
                                    </p>
                                    <p className="text-xs text-gray-500">Ajustar por R$</p>
                                </div>
                            </div>
                        </button>
                    </div>

                    {/* Opcoes de Ajuste */}
                    <div className="flex flex-wrap items-end gap-4 p-4 bg-gray-50 rounded-xl">
                        {/* Botoes Aumentar/Diminuir */}
                        <div className="flex-1 min-w-[200px]">
                            <Label className="text-sm font-medium text-gray-700 mb-2 block">Operação</Label>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant={operacao === "aumentar" ? "default" : "outline"}
                                    onClick={() => setOperacao("aumentar")}
                                    className={`flex-1 h-11 ${operacao === "aumentar"
                                        ? "bg-green-600 hover:bg-green-700 text-white"
                                        : "border-green-300 text-green-700 hover:bg-green-50"}`}
                                >
                                    <TrendingUp className="w-4 h-4 mr-2" />
                                    Aumentar
                                </Button>
                                <Button
                                    type="button"
                                    variant={operacao === "diminuir" ? "default" : "outline"}
                                    onClick={() => setOperacao("diminuir")}
                                    className={`flex-1 h-11 ${operacao === "diminuir"
                                        ? "bg-red-600 hover:bg-red-700 text-white"
                                        : "border-red-300 text-red-700 hover:bg-red-50"}`}
                                >
                                    <TrendingDown className="w-4 h-4 mr-2" />
                                    Diminuir
                                </Button>
                            </div>
                        </div>

                        {/* Valor */}
                        <div className="w-40">
                            <Label className="text-sm font-medium text-gray-700 mb-2 block">
                                {tipoAjuste === "porcentagem" ? "Percentual" : "Valor"}
                            </Label>
                            <div className="relative">
                                {tipoAjuste === "fixo" && (
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">R$</span>
                                )}
                                <Input
                                    type="number"
                                    min="0"
                                    max={tipoAjuste === "porcentagem" ? "100" : "999999"}
                                    step={tipoAjuste === "porcentagem" ? "0.5" : "0.01"}
                                    placeholder={tipoAjuste === "porcentagem" ? "10" : "50,00"}
                                    value={tipoAjuste === "porcentagem" ? percentual : valorFixo}
                                    onChange={(e) => tipoAjuste === "porcentagem"
                                        ? setPercentual(e.target.value)
                                        : setValorFixo(e.target.value)
                                    }
                                    className={`h-11 text-lg font-semibold ${tipoAjuste === "fixo" ? "pl-10 pr-3" : "pr-8"}`}
                                />
                                {tipoAjuste === "porcentagem" && (
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">%</span>
                                )}
                            </div>
                        </div>

                        {/* Categoria */}
                        <div className="w-44">
                            <Label className="text-sm font-medium text-gray-700 mb-2 block">Categoria</Label>
                            <Select value={categoria} onValueChange={setCategoria}>
                                <SelectTrigger className="h-11">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todas">Todas</SelectItem>
                                    {categorias.map(cat => (
                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Preview */}
                    {valorAtivo && parseFloat(valorAtivo) > 0 && (
                        <div className={`p-4 rounded-xl border-2 ${operacao === "aumentar" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                            <p className={`text-sm font-medium ${operacao === "aumentar" ? "text-green-800" : "text-red-800"}`}>
                                {operacao === "aumentar" ? "📈" : "📉"} {operacao === "aumentar" ? "Aumento" : "Redução"} de {" "}
                                {tipoAjuste === "porcentagem"
                                    ? `${percentual}%`
                                    : formatMoney(parseFloat(valorFixo))}
                                {" "}nos preços selecionados
                            </p>
                        </div>
                    )}

                    {/* Tabela */}
                    <div className="border rounded-xl overflow-hidden">
                        <div className="max-h-[260px] overflow-y-auto">
                            <Table>
                                <TableHeader className="bg-gray-50 sticky top-0">
                                    <TableRow>
                                        <TableHead className="w-12">
                                            <Checkbox
                                                checked={selecionarTodos && produtosSelecionados.length === produtosFiltrados.length}
                                                onCheckedChange={toggleTodos}
                                            />
                                        </TableHead>
                                        <TableHead>Produto</TableHead>
                                        <TableHead className="text-right w-32">Atual</TableHead>
                                        <TableHead className="text-right w-32">Novo</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {produtosFiltrados.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                                                <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                                Nenhum produto encontrado
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        produtosFiltrados.map(produto => {
                                            const novoPreco = calcularNovoPreco(produto.preco_venda);
                                            const selecionado = produtosSelecionados.includes(produto.id);

                                            return (
                                                <TableRow
                                                    key={produto.id}
                                                    className={`cursor-pointer transition-colors ${selecionado ? "bg-blue-50" : "hover:bg-gray-50"}`}
                                                    onClick={() => toggleProduto(produto.id)}
                                                >
                                                    <TableCell onClick={e => e.stopPropagation()}>
                                                        <Checkbox
                                                            checked={selecionado}
                                                            onCheckedChange={() => toggleProduto(produto.id)}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <p className="font-medium text-sm truncate max-w-[300px]">{produto.nome}</p>
                                                        <p className="text-xs text-gray-500">{produto.categoria || "Sem categoria"}</p>
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono text-sm">
                                                        {formatMoney(produto.preco_venda)}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono text-sm font-semibold">
                                                        {selecionado && valorAtivo ? (
                                                            <span className={operacao === "aumentar" ? "text-green-600" : "text-red-600"}>
                                                                {formatMoney(novoPreco)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-400">—</span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="pt-4 border-t flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                        {produtosParaAjuste.length > 0 ? (
                            <span className="font-medium text-gray-900">{produtosParaAjuste.length} produto(s) selecionado(s)</span>
                        ) : (
                            "Selecione os produtos para ajustar"
                        )}
                    </div>
                    <div className="flex gap-3">
                        <Button variant="outline" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={aplicarAjuste}
                            disabled={aplicando || produtosParaAjuste.length === 0 || !valorAtivo}
                            className={`min-w-[160px] ${operacao === "aumentar" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
                        >
                            {aplicando ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <CheckCircle className="w-4 h-4 mr-2" />
                            )}
                            Aplicar Ajuste
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
