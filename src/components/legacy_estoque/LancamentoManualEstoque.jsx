import React, { useEffect, useMemo, useState } from "react";
import { base44, supabase } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, CheckCircle2, Loader2, Plus, Search, Trash2, Warehouse } from "lucide-react";
import { toast } from "sonner";
import { normSearch } from "@/lib/utils";
import { calcularEstoqueTotal, obterCampoEstoqueDaLoja } from "@/constants/productConstants";
import { useLojas } from "@/hooks/useLojas";

const LOJA_CD = { id: "__cd__", nome: "Depósito / CD", ativa: true };

function criarLinha() {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    produtoId: "",
    produtoBusca: "",
    quantidade: "",
  };
}

function getProdutoLabel(produto) {
  if (!produto) return "";
  const detalhes = [produto.codigo_barras, produto.modelo_referencia].filter(Boolean).join(" • ");
  return detalhes ? `${produto.nome} (${detalhes})` : produto.nome;
}

export default function LancamentoManualEstoque({ onVoltar, user }) {
  const queryClient = useQueryClient();
  const [linhas, setLinhas] = useState([criarLinha()]);
  const [filtrosProduto, setFiltrosProduto] = useState({});
  const [tipoMovimento, setTipoMovimento] = useState("entrada");
  const [destinoId, setDestinoId] = useState("__cd__");
  const [isSaving, setIsSaving] = useState(false);
  const { data: lojas = [], isLoading: loadingLojas } = useLojas();

  const { data: produtos = [], isLoading: loadingProdutos } = useQuery({
    queryKey: ["produtos"],
    queryFn: () => base44.entities.Produto.list(),
  });

  const lojasAtivas = useMemo(() => lojas, [lojas]);
  const lojasComCd = useMemo(() => {
    const hasCd = lojasAtivas.some((loja) => obterCampoEstoqueDaLoja(loja) === "estoque_cd");
    return hasCd ? lojasAtivas : [LOJA_CD, ...lojasAtivas];
  }, [lojasAtivas]);

  const lojaOptions = useMemo(
    () => lojasComCd.map((loja) => ({
      id: loja.id,
      nome: loja.nome,
      isCd: loja.id === LOJA_CD.id,
    })),
    [lojasComCd]
  );

  useEffect(() => {
    if (linhas.length === 0) {
      setLinhas([criarLinha()]);
    }
  }, [linhas.length]);

  const atualizarLinha = (linhaId, patch) => {
    setLinhas((current) => current.map((linha) => (linha.id === linhaId ? { ...linha, ...patch } : linha)));
  };

  const adicionarLinha = () => setLinhas((current) => [...current, criarLinha()]);

  const removerLinha = (linhaId) => {
    setLinhas((current) => (current.length === 1 ? current : current.filter((linha) => linha.id !== linhaId)));
    setFiltrosProduto((current) => {
      const next = { ...current };
      delete next[linhaId];
      return next;
    });
  };

  const selecionarProduto = (linhaId, produto) => {
    atualizarLinha(linhaId, {
      produtoId: produto.id,
      produtoBusca: getProdutoLabel(produto),
    });
    setFiltrosProduto((current) => ({ ...current, [linhaId]: getProdutoLabel(produto) }));
  };

  const filtrarProdutos = (termo) => {
    const searchTokens = normSearch(termo || "").split(/\s+/).filter(Boolean);
    if (searchTokens.length === 0) return [];

    const scoredProdutos = produtos
      .filter((produto) => produto.ativo !== false)
      .map((produto) => {
        const camposBusca = [
          produto.nome,
          produto.codigo_barras,
          produto.sku,
          produto.categoria,
          produto.material,
          produto.cor,
          produto.fornecedor_nome,
          produto.modelo_referencia,
          produto.descricao,
        ]
          .filter(Boolean)
          .map(normSearch)
          .join(" ");

        const matches = searchTokens.filter((token) => camposBusca.includes(token)).length;
        return { produto, score: matches };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score);

    const exactMatches = scoredProdutos.filter(({ score }) => score === searchTokens.length);
    const resultado = exactMatches.length === 0 && scoredProdutos.length > 0 ? scoredProdutos : exactMatches;
    return resultado.map((item) => item.produto).slice(0, 10);
  };

  const obterLoja = (lojaId) => lojaOptions.find((loja) => loja.id === lojaId) || lojaOptions[0] || LOJA_CD;

  const getProdutoResumoEstoque = (produto) => {
    const itens = lojasComCd.map((loja) => {
      const campo = obterCampoEstoqueDaLoja(loja.id === LOJA_CD.id ? null : loja);
      return {
        campo,
        loja: loja.nome,
        quantidade: Number(produto[campo] || 0),
      };
    });

    return {
      total: Number(produto.quantidade_estoque || calcularEstoqueTotal(produto, lojasComCd) || 0),
      itens,
    };
  };

  const getProdutoSelecionado = (linha) => produtos.find((produto) => produto.id === linha.produtoId);

  const prepararResumo = () => linhas
    .map((linha, index) => ({
      index,
      linha,
      produto: getProdutoSelecionado(linha),
      loja: obterLoja(destinoId),
      quantidade: parseInt(linha.quantidade, 10),
    }))
    .filter(({ linha }) => linha.produtoId && linha.quantidade !== "");

  const handleSalvar = async () => {
    const resumo = prepararResumo();

    if (resumo.length === 0) {
      toast.error("Preencha ao menos uma linha antes de salvar.");
      return;
    }

    for (const item of resumo) {
      if (!item.produto) {
        toast.error(`Selecione um produto válido na linha ${item.index + 1}.`);
        return;
      }

      if (!Number.isInteger(item.quantidade) || item.quantidade <= 0) {
        toast.error(`Informe uma quantidade válida na linha ${item.index + 1}.`);
        return;
      }
    }

    const confirmacao = resumo
      .map((item) => `${item.produto.nome} • ${item.loja.nome} • ${item.linha.tipo === "entrada" ? "+" : "-"}${item.quantidade}`)
      .join("\n");

    if (!confirm(`Confirmar o lançamento manual de ${resumo.length} linha(s)?\n\n${confirmacao}`)) {
      return;
    }

    setIsSaving(true);

    try {
      const produtosCache = new Map(produtos.map((produto) => [produto.id, { ...produto }]));

      for (const item of resumo) {
        const produtoAtual = produtosCache.get(item.produto.id);
        if (!produtoAtual) {
          throw new Error(`Produto não encontrado: ${item.produto.nome}`);
        }

        const campoEstoque = obterCampoEstoqueDaLoja(item.loja.isCd ? null : item.loja);
        const estoqueAntesLocal = Number(produtoAtual[campoEstoque] || 0);
        const estoqueDepoisLocal = tipoMovimento === "entrada"
          ? estoqueAntesLocal + item.quantidade
          : estoqueAntesLocal - item.quantidade;

        if (estoqueDepoisLocal < 0) {
          throw new Error(`Estoque insuficiente para ${item.produto.nome} em ${item.loja.nome}.`);
        }

        produtosCache.set(item.produto.id, {
          ...produtoAtual,
          [campoEstoque]: estoqueDepoisLocal,
        });
      }

      for (const item of resumo) {
        const produtoAtual = produtosCache.get(item.produto.id);
        if (!produtoAtual) {
          throw new Error(`Produto não encontrado: ${item.produto.nome}`);
        }

        const campoEstoque = obterCampoEstoqueDaLoja(item.loja.isCd ? null : item.loja);
        const estoqueAntesLocal = Number(produtoAtual[campoEstoque] || 0);
        const estoqueAntesTotal = Number(produtoAtual.quantidade_estoque || 0);
        const delta = item.quantidade;
        const estoqueDepoisLocal = tipoMovimento === "entrada"
          ? estoqueAntesLocal + delta
          : estoqueAntesLocal - delta;

        if (estoqueDepoisLocal < 0) {
          throw new Error(`Estoque insuficiente para ${item.produto.nome} em ${item.loja.nome}.`);
        }

        const produtoAtualizado = {
          ...produtoAtual,
          [campoEstoque]: estoqueDepoisLocal,
        };
        const estoqueDepoisTotal = calcularEstoqueTotal(produtoAtualizado, lojasComCd);

        await base44.entities.Produto.update(item.produto.id, {
          [campoEstoque]: estoqueDepoisLocal,
          quantidade_estoque: estoqueDepoisTotal,
        });

        try {
          const { error: auditError } = await supabase.from("movimentacoes_estoque").insert({
            produto_id: item.produto.id,
            evento_tipo: tipoMovimento === "entrada" ? "ajuste_manual_entrada" : "ajuste_manual_saida",
            modulo_origem: "estoque",
            referencia_tipo: "lancamento_manual_estoque",
            quantidade: delta,
            estoque_antes_local: estoqueAntesLocal,
            estoque_depois_local: estoqueDepoisLocal,
            estoque_antes_total: estoqueAntesTotal,
            estoque_depois_total: estoqueDepoisTotal,
            loja_origem: item.loja.nome,
            usuario_id: user?.id || null,
            usuario_nome: user?.full_name || user?.nome || user?.email || null,
            usuario_cargo: user?.cargo || null,
            observacao: item.linha.observacao || null,
            payload_json: {
              tipo: "lancamento_manual_estoque",
              loja_id: item.loja.id,
              loja_nome: item.loja.nome,
              campo_estoque: campoEstoque,
              linha_id: item.linha.id,
              operacao: tipoMovimento,
            },
            organization_id: "00000000-0000-0000-0000-000000000001",
          });

          if (auditError) {
            throw auditError;
          }
        } catch (auditErr) {
          console.warn("Falha ao registrar movimentação manual de estoque:", auditErr);
        }

        produtosCache.set(item.produto.id, {
          ...produtoAtual,
          [campoEstoque]: estoqueDepoisLocal,
          quantidade_estoque: estoqueDepoisTotal,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      queryClient.invalidateQueries({ queryKey: ["produtos-carga-inicial"] });
      queryClient.invalidateQueries({ queryKey: ["produtos-inventario"] });
      queryClient.invalidateQueries({ queryKey: ["movimentacoes-estoque"] });

      setLinhas([criarLinha()]);
      setFiltrosProduto({});
      toast.success(`Lançamento salvo com sucesso em ${resumo.length} linha(s).`);
    } catch (error) {
      toast.error(`Erro ao salvar: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const totalLinhasValidas = linhas.filter((linha) => linha.produtoId && linha.quantidade !== "").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onVoltar}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-xl font-bold" style={{ color: "#07593f" }}>
              Lançamento Manual de Estoque
            </h2>
            <p className="text-sm" style={{ color: "#8B8B8B" }}>
              Adicione vários produtos e unidades em um único envio, sem bipagem.
            </p>
          </div>
        </div>

        <Button
          onClick={handleSalvar}
          disabled={isSaving || totalLinhasValidas === 0}
          style={{ background: "linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)" }}
        >
          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
          Salvar lançamento
        </Button>
      </div>

      <Alert style={{ backgroundColor: "#f0fdf4", borderColor: "#86efac" }}>
        <AlertDescription>
          <strong>Como funciona:</strong> selecione acima se é entrada ou saída e para qual unidade.
          Depois preencha os produtos e quantidades nas linhas. Cada linha segue o mesmo destino.
        </AlertDescription>
      </Alert>

      <Card className="border-0 shadow-sm">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-4 space-y-2">
              <Label>Tipo de lançamento</Label>
              <Select value={tipoMovimento} onValueChange={setTipoMovimento}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="lg:col-span-8 space-y-2">
              <Label>Destino</Label>
              <Select value={destinoId} onValueChange={setDestinoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a unidade" />
                </SelectTrigger>
                <SelectContent>
                  {lojaOptions.map((loja) => (
                    <SelectItem key={loja.id} value={loja.id}>
                      {loja.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Warehouse className="w-5 h-5 text-green-700" />
              Lançamentos
            </CardTitle>
            <Badge variant="secondary" className="rounded-full px-3 py-1">
              {totalLinhasValidas} linha(s) pronta(s)
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {loadingProdutos || loadingLojas ? (
            <div className="py-12 text-center text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
              Carregando produtos e unidades...
            </div>
          ) : (
            linhas.map((linha, index) => {
              const termoProduto = filtrosProduto[linha.id] ?? linha.produtoBusca;
              const sugestoes = termoProduto.trim().length >= 2 ? filtrarProdutos(termoProduto) : [];
              const produtoSelecionado = getProdutoSelecionado(linha);
              const resumoSelecionado = produtoSelecionado ? getProdutoResumoEstoque(produtoSelecionado) : null;

              return (
                <div key={linha.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-green-100 text-sm font-semibold text-green-700">
                        {index + 1}
                      </span>
                      <span className="font-semibold text-sm text-gray-700">Linha {index + 1}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removerLinha(linha.id)} disabled={linhas.length === 1}>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Remover
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
                    <div className="lg:col-span-9 space-y-2 relative">
                      <Label>Produto</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          className="pl-10"
                          value={termoProduto}
                          onChange={(e) => {
                            atualizarLinha(linha.id, { produtoBusca: e.target.value, produtoId: "" });
                            setFiltrosProduto((current) => ({ ...current, [linha.id]: e.target.value }));
                          }}
                          placeholder="Buscar por nome, código ou referência..."
                        />
                      </div>

                      {sugestoes.length > 0 && (
                        <div className="absolute z-20 mt-1 w-full rounded-xl border bg-white shadow-lg overflow-hidden">
                          {sugestoes.map((produto, indexSugestao) => {
                            const resumo = getProdutoResumoEstoque(produto);
                            return (
                            <button
                              key={`${produto.id}-${indexSugestao}`}
                              type="button"
                              onClick={() => selecionarProduto(linha.id, produto)}
                              className="flex w-full items-center justify-between gap-3 border-b border-gray-100 px-3 py-2 text-left last:border-b-0 hover:bg-green-50"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-gray-900">{produto.nome}</p>
                                <p className="truncate text-xs text-gray-500">
                                  {[produto.codigo_barras, produto.modelo_referencia, produto.fornecedor_nome].filter(Boolean).join(" • ") || "Sem código"}
                                </p>
                                <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-gray-600">
                                  <span className="rounded-full bg-gray-100 px-2 py-0.5">
                                    Estoque total: {resumo.total}
                                  </span>
                                  {resumo.itens.map((item) => (
                                    <span key={`${produto.id}-${item.campo}`} className="rounded-full bg-gray-50 px-2 py-0.5 border border-gray-200">
                                      {item.loja}: {item.quantidade}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <Badge variant="outline" className="shrink-0">
                                Selecionar
                              </Badge>
                            </button>
                            );
                          })}
                        </div>
                      )}

                      {produtoSelecionado && resumoSelecionado && (
                        <div className="rounded-xl border border-green-100 bg-green-50 px-3 py-2 text-sm text-green-900">
                          <div className="flex flex-wrap items-center gap-2">
                            <strong>{produtoSelecionado.nome}</strong>
                            <Badge variant="secondary" className="h-5 rounded-full px-2 text-[10px]">
                              Estoque total: {resumoSelecionado.total}
                            </Badge>
                            <span className="text-green-700 text-xs">
                              {produtoSelecionado.codigo_barras ? `COD ${produtoSelecionado.codigo_barras}` : "Produto selecionado"}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-green-800">
                            {resumoSelecionado.itens.map((item) => (
                              <span key={`${produtoSelecionado.id}-${item.campo}`} className="rounded-full bg-white/80 px-2 py-1 border border-green-200">
                                {item.loja}: {item.quantidade}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="lg:col-span-3 space-y-2">
                      <Label>Quantidade</Label>
                      <Input
                        type="number"
                        min="1"
                        value={linha.quantidade}
                        onChange={(e) => atualizarLinha(linha.id, { quantidade: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                  </div>

                </div>
              );
            })
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
            <div className="text-sm text-gray-500">
              Use quantas linhas precisar; todas seguem o tipo e a unidade escolhidos no topo.
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={adicionarLinha}>
                <Plus className="w-4 h-4 mr-2" />
                Cadastrar Item
              </Button>
              <Button
                onClick={handleSalvar}
                disabled={isSaving || totalLinhasValidas === 0}
                style={{ background: "linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)" }}
              >
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Salvar lançamento
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}