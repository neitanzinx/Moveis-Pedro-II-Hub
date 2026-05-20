import React, { useMemo, useRef, useState } from "react";
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
import ProdutoCadastroCompleto from "@/components/produtos/ProdutoCadastroCompleto";

const LOJA_CD = { id: "__cd__", nome: "Depósito / CD", ativa: true };

export default function LancamentoManualEstoque({ onVoltar, user }) {
  const queryClient = useQueryClient();
  const [linhas, setLinhas] = useState([]);
  const [termoBusca, setTermoBusca] = useState("");
  const [tipoMovimento, setTipoMovimento] = useState("entrada");
  const [destinoId, setDestinoId] = useState("__cd__");
  const [isSaving, setIsSaving] = useState(false);
  const [isCadastrarOpen, setIsCadastrarOpen] = useState(false);
  const searchInputRef = useRef(null);
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

  const atualizarLinha = (linhaId, patch) => {
    setLinhas((current) => current.map((linha) => (linha.id === linhaId ? { ...linha, ...patch } : linha)));
  };

  const removerLinha = (linhaId) => {
    setLinhas((current) => current.filter((linha) => linha.id !== linhaId));
  };

  const selecionarProduto = (produto) => {
    const novaLinha = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      produtoId: produto.id,
      nomeProduto: produto.nome,
      produtoCodigo: [produto.codigo_barras, produto.modelo_referencia, produto.fornecedor_nome].filter(Boolean).join(" • "),
      quantidade: "",
    };
    setLinhas((current) => [novaLinha, ...current]);
    setTermoBusca("");
    setTimeout(() => searchInputRef.current?.focus(), 50);
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

  const produtosJaAdicionados = useMemo(() => new Set(linhas.map((l) => l.produtoId)), [linhas]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sugestoes = useMemo(
    () => (termoBusca.trim().length >= 2 ? filtrarProdutos(termoBusca).filter((p) => !produtosJaAdicionados.has(p.id)) : []),
    [termoBusca, produtos, produtosJaAdicionados]
  );

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

  const prepararResumo = () => linhas
    .map((linha, index) => ({
      index,
      linha,
      produto: produtos.find((p) => p.id === linha.produtoId),
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
        toast.error(`Informe uma quantidade válida para "${item.linha.nomeProduto}".`);
        return;
      }
    }

    const confirmacao = resumo
      .map((item) => `${item.produto.nome} • ${item.loja.nome} • ${tipoMovimento === "entrada" ? "+" : "-"}${item.quantidade}`)
      .join("\n");

    if (!confirm(`Confirmar o lançamento manual de ${resumo.length} produto(s)?\n\n${confirmacao}`)) {
      return;
    }

    setIsSaving(true);

    try {
      // Pré-validação: verificar se alguma saída ficaria negativa antes de gravar qualquer coisa
      for (const item of resumo) {
        if (tipoMovimento === "saida") {
          const campoEstoque = obterCampoEstoqueDaLoja(item.loja.isCd ? null : item.loja);
          const estoqueAtual = Number(item.produto[campoEstoque] || 0);
          if (estoqueAtual - item.quantidade < 0) {
            throw new Error(`Estoque insuficiente para ${item.produto.nome} em ${item.loja.nome}.`);
          }
        }
      }

      for (const item of resumo) {
        const campoEstoque = obterCampoEstoqueDaLoja(item.loja.isCd ? null : item.loja);
        const estoqueAntesLocal = Number(item.produto[campoEstoque] || 0);
        const estoqueAntesTotal = Number(item.produto.quantidade_estoque || 0);
        const delta = item.quantidade;
        const estoqueDepoisLocal = tipoMovimento === "entrada"
          ? estoqueAntesLocal + delta
          : estoqueAntesLocal - delta;

        const produtoAtualizado = { ...item.produto, [campoEstoque]: estoqueDepoisLocal };
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
      }

      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      queryClient.invalidateQueries({ queryKey: ["produtos-carga-inicial"] });
      queryClient.invalidateQueries({ queryKey: ["produtos-inventario"] });
      queryClient.invalidateQueries({ queryKey: ["movimentacoes-estoque"] });

      setLinhas([]);
      setTermoBusca("");
      toast.success(`Lançamento salvo com sucesso para ${resumo.length} produto(s).`);
    } catch (error) {
      toast.error(`Erro ao salvar: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const totalLinhasValidas = linhas.filter((linha) => linha.produtoId && linha.quantidade !== "").length;
  const totalQuantidades = linhas.reduce((sum, l) => sum + (parseInt(l.quantidade, 10) || 0), 0);

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
              Adicione vários produtos e quantidades em um único envio, sem bipagem.
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
          <strong>Como funciona:</strong> defina o tipo e o destino, busque produtos e clique para adicioná-los à lista. Informe a quantidade de cada um e salve.
        </AlertDescription>
      </Alert>

      <Card className="border-0 shadow-sm">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-4 space-y-2">
              <Label>Tipo de lançamento</Label>
              <Select value={tipoMovimento} onValueChange={setTipoMovimento}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="lg:col-span-8 space-y-2">
              <Label>Destino</Label>
              <Select value={destinoId} onValueChange={setDestinoId}>
                <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                <SelectContent>
                  {lojaOptions.map((loja) => (
                    <SelectItem key={loja.id} value={loja.id}>{loja.nome}</SelectItem>
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
              Produtos do lançamento
            </CardTitle>
            <Badge variant="secondary" className="rounded-full px-3 py-1">
              {linhas.length} produto(s)
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
            <>
              {/* Barra de busca única */}
              <div className="space-y-2 relative">
                <div className="flex items-center justify-between">
                  <Label>Buscar e adicionar produto</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => setIsCadastrarOpen(true)}
                  >
                    <Plus className="w-3 h-3" />
                    Cadastrar item
                  </Button>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    ref={searchInputRef}
                    className="pl-10"
                    value={termoBusca}
                    onChange={(e) => setTermoBusca(e.target.value)}
                    placeholder="Buscar por nome, código ou referência..."
                  />
                </div>
                {sugestoes.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full rounded-xl border bg-white shadow-lg overflow-hidden">
                    {sugestoes.map((produto, idx) => {
                      const resumo = getProdutoResumoEstoque(produto);
                      return (
                        <button
                          key={`${produto.id}-${idx}`}
                          type="button"
                          onClick={() => selecionarProduto(produto)}
                          className="flex w-full items-center justify-between gap-3 border-b border-gray-100 px-3 py-2 text-left last:border-b-0 hover:bg-green-50"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-gray-900">{produto.nome}</p>
                            <p className="truncate text-xs text-gray-500">
                              {[produto.codigo_barras, produto.modelo_referencia, produto.fornecedor_nome].filter(Boolean).join(" • ") || "Sem código"}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-gray-600">
                              <span className="rounded-full bg-gray-100 px-2 py-0.5">Estoque total: {resumo.total}</span>
                              {resumo.itens.map((item) => (
                                <span key={`${produto.id}-${item.campo}`} className="rounded-full bg-gray-50 px-2 py-0.5 border border-gray-200">
                                  {item.loja}: {item.quantidade}
                                </span>
                              ))}
                            </div>
                          </div>
                          <Badge variant="outline" className="shrink-0">Adicionar</Badge>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Lista de produtos adicionados (mais recente no topo) */}
              {linhas.length === 0 ? (
                <div className="py-10 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhum produto adicionado ainda.</p>
                  <p className="text-xs mt-1">Use a busca acima para adicionar produtos à lista.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {linhas.map((linha) => {
                    const produtoAtual = produtos.find((p) => p.id === linha.produtoId);
                    const resumo = produtoAtual ? getProdutoResumoEstoque(produtoAtual) : null;
                    return (
                      <div key={linha.id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-900">{linha.nomeProduto}</p>
                          {linha.produtoCodigo && (
                            <p className="truncate text-xs text-gray-500">{linha.produtoCodigo}</p>
                          )}
                          {resumo && (
                            <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-gray-500">
                              <span className="rounded-full bg-gray-100 px-2 py-0.5">Estoque: {resumo.total}</span>
                              {resumo.itens.map((item) => (
                                <span key={item.campo} className="rounded-full bg-gray-50 px-2 py-0.5 border border-gray-200">
                                  {item.loja}: {item.quantidade}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Input
                            type="number"
                            min="1"
                            value={linha.quantidade}
                            onChange={(e) => atualizarLinha(linha.id, { quantidade: e.target.value })}
                            onBlur={(e) => {
                              if (e.target.value && parseInt(e.target.value, 10) > 0) {
                                searchInputRef.current?.focus();
                              }
                            }}
                            placeholder="Qtd"
                            className="w-20 text-center"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => removerLinha(linha.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Rodapé com total e botão salvar */}
              {linhas.length > 0 && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-3 border-t border-gray-100">
                  <div className="text-sm text-gray-600">
                    <span>Total de unidades: </span>
                    <span className="font-bold text-gray-900">{totalQuantidades}</span>
                    <span className="text-gray-400 ml-2">em {linhas.length} produto(s)</span>
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
              )}
            </>
          )}
        </CardContent>
      </Card>

      <ProdutoCadastroCompleto
        isOpen={isCadastrarOpen}
        onClose={() => setIsCadastrarOpen(false)}
        produto={null}
        onSave={async (data) => {
          const novoProduto = await base44.entities.Produto.create(data);
          queryClient.invalidateQueries({ queryKey: ["produtos"] });
          setIsCadastrarOpen(false);
          if (novoProduto?.id) {
            selecionarProduto(novoProduto);
            toast.success("Produto cadastrado e adicionado ao lançamento.");
            return;
          }

          toast.success("Produto cadastrado! Você já pode buscá-lo na lista.");
        }}
      />
    </div>
  );
}