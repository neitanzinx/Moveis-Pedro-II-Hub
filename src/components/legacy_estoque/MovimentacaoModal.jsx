import React, { useState, useEffect, useRef } from "react";
import { base44, supabase } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpCircle, ArrowDownCircle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { calcularEstoqueTotal, obterCampoEstoqueDaLoja } from "@/constants/productConstants";
import { useLojas } from "@/hooks/useLojas";
import { useAuth } from "@/hooks/useAuth";

const LOJA_CD_FALLBACK = { id: "cd-fallback", nome: "Depósito / CD" };

export default function MovimentacaoModal({
  open,
  onOpenChange,
  isOpen: legacyIsOpen,
  onClose: legacyOnClose,
  produto,
  onSuccess
}) {
  const { data: lojasReal = [] } = useLojas();
  const { user } = useAuth();
  const [quantidade, setQuantidade] = useState("");
  const [tipo, setTipo] = useState("cd_para_loja");
  const [lojaId, setLojaId] = useState("");

  const isOpen = open ?? legacyIsOpen ?? false;
  const handleClose = () => {
    if (typeof onOpenChange === "function") {
      onOpenChange(false);
      return;
    }
    if (typeof legacyOnClose === "function") {
      legacyOnClose();
    }
  };
  const inputRef = useRef(null);
  const queryClient = useQueryClient();

  const lojasComCd = React.useMemo(() => {
    const base = Array.isArray(lojasReal) ? [...lojasReal] : [];
    const hasCd = base.some((loja) => obterCampoEstoqueDaLoja(loja) === "estoque_cd");
    if (!hasCd) base.unshift(LOJA_CD_FALLBACK);
    return base;
  }, [lojasReal]);

  const lojasSemCd = React.useMemo(
    () => lojasComCd.filter((loja) => obterCampoEstoqueDaLoja(loja) !== "estoque_cd"),
    [lojasComCd]
  );

  const cdLoja = React.useMemo(
    () => lojasComCd.find((loja) => obterCampoEstoqueDaLoja(loja) === "estoque_cd") || LOJA_CD_FALLBACK,
    [lojasComCd]
  );

  // Reset state when modal opens/product changes
  useEffect(() => {
    if (isOpen) {
      setQuantidade("");
      setTipo("cd_para_loja");
      setLojaId(lojasSemCd[0]?.id || "");
      // Focus quantity input after a short delay to allow modal animation
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, lojasSemCd]);

  const mutation = useMutation({
    mutationFn: async () => {
      const qtd = parseInt(quantidade);
      if (!qtd || qtd <= 0) throw new Error("Quantidade inválida");

      const lojaInfo = lojasComCd.find(l => l.id === lojaId);
      if (!lojaInfo) throw new Error("Selecione a loja de transferência.");

      const campoCd = "estoque_cd";
      const campoLoja = obterCampoEstoqueDaLoja(lojaInfo);

      const origemCampo = tipo === "cd_para_loja" ? campoCd : campoLoja;
      const destinoCampo = tipo === "cd_para_loja" ? campoLoja : campoCd;

      const origemNome = tipo === "cd_para_loja" ? cdLoja.nome : lojaInfo.nome;
      const destinoNome = tipo === "cd_para_loja" ? lojaInfo.nome : cdLoja.nome;

      const estoqueOrigemAntes = Number(produto[origemCampo] || 0);
      const estoqueDestinoAntes = Number(produto[destinoCampo] || 0);

      if (estoqueOrigemAntes < qtd) {
        throw new Error(`Estoque insuficiente em ${origemNome} (${estoqueOrigemAntes}).`);
      }

      const estoqueOrigemDepois = estoqueOrigemAntes - qtd;
      const estoqueDestinoDepois = estoqueDestinoAntes + qtd;

      const produtoAtualizadoLocalmente = {
        ...produto,
        [origemCampo]: estoqueOrigemDepois,
        [destinoCampo]: estoqueDestinoDepois,
      };
      const novaQtdTotal = calcularEstoqueTotal(produtoAtualizadoLocalmente, lojasComCd);

      const updates = {
        [origemCampo]: estoqueOrigemDepois,
        [destinoCampo]: estoqueDestinoDepois,
        quantidade_estoque: novaQtdTotal,
      };

      await base44.entities.Produto.update(produto.id, updates);
      try {
        await supabase.from('movimentacoes_estoque').insert([
          {
            produto_id: produto.id,
            evento_tipo: 'transferencia_saida',
            modulo_origem: 'estoque',
            quantidade: qtd,
            estoque_antes_local: estoqueOrigemAntes,
            estoque_depois_local: estoqueOrigemDepois,
            estoque_antes_total: produto.quantidade_estoque || 0,
            estoque_depois_total: novaQtdTotal,
            loja_origem: origemNome,
            loja_destino: destinoNome,
            referencia_tipo: 'movimentacao_modal',
            usuario_nome: user?.full_name || user?.nome || null,
            organization_id: '00000000-0000-0000-0000-000000000001'
          },
          {
            produto_id: produto.id,
            evento_tipo: 'transferencia_entrada',
            modulo_origem: 'estoque',
            quantidade: qtd,
            estoque_antes_local: estoqueDestinoAntes,
            estoque_depois_local: estoqueDestinoDepois,
            estoque_antes_total: produto.quantidade_estoque || 0,
            estoque_depois_total: novaQtdTotal,
            loja_origem: origemNome,
            loja_destino: destinoNome,
            referencia_tipo: 'movimentacao_modal',
            usuario_nome: user?.full_name || user?.nome || null,
            organization_id: '00000000-0000-0000-0000-000000000001'
          }
        ]);
      } catch (auditErr) {
        console.warn('Falha ao registrar movimentação de transferência:', auditErr);
      }

      return {
        id: produto.id,
        ...produto,
        ...updates
      };
    },
    onSuccess: (produtoAtualizado) => {
      // Atualiza imediatamente os caches locais para feedback instantaneo.
      queryClient.setQueryData(['produtos'], (old) => {
        if (!Array.isArray(old)) return old;
        return old.map((p) => (p.id === produtoAtualizado.id ? { ...p, ...produtoAtualizado } : p));
      });

      queryClient.setQueriesData(
        { queryKey: ['produtos-paginated'] },
        (oldData) => {
          if (!oldData?.pages) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              data: (page.data || []).map((p) => (p.id === produtoAtualizado.id ? { ...p, ...produtoAtualizado } : p))
            }))
          };
        }
      );

      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      queryClient.invalidateQueries({ queryKey: ['produtos-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['produtos-atencao-count'] });
      toast.success("Transferência realizada com sucesso!");
      onSuccess?.();
      handleClose();
    },
    onError: (err) => toast.error(err.message)
  });

  if (!produto) return null;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (typeof onOpenChange === "function") {
          onOpenChange(nextOpen);
          return;
        }
        if (!nextOpen) {
          legacyOnClose?.();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Movimentar Estoque: {produto.nome}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Direção da transferência */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 dark:bg-neutral-800 rounded-lg">
            <button
              onClick={() => setTipo('cd_para_loja')}
              className={`flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${tipo === 'cd_para_loja'
                ? 'bg-white dark:bg-neutral-700 text-green-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <ArrowDownCircle className="w-4 h-4" /> CD → Loja
            </button>
            <button
              onClick={() => setTipo('loja_para_cd')}
              className={`flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${tipo === 'loja_para_cd'
                ? 'bg-white dark:bg-neutral-700 text-red-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <ArrowUpCircle className="w-4 h-4" /> Loja → CD
            </button>
          </div>

          {/* Inputs */}
          <div className="space-y-4">
            <div>
              <Label>Loja</Label>
              <Select value={lojaId} onValueChange={setLojaId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {lojasSemCd.map(loja => (
                    <SelectItem key={loja.id} value={loja.id}>{loja.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-neutral-800 p-3 rounded-lg text-center border border-gray-100 dark:border-neutral-700">
                <p className="text-xs text-gray-500 uppercase">Origem</p>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {tipo === 'cd_para_loja' ? cdLoja.nome : (lojasComCd.find(l => l.id === lojaId)?.nome || '-')}
                </p>
                <p className="text-2xl font-bold text-gray-700 dark:text-gray-300 mt-1">
                  {tipo === 'cd_para_loja'
                    ? Number(produto.estoque_cd || 0)
                    : Number(produto[obterCampoEstoqueDaLoja(lojasComCd.find(l => l.id === lojaId) || lojaId)] || 0)
                  }
                </p>
              </div>
              <div className={`p-3 rounded-lg text-center border ${tipo === 'cd_para_loja'
                ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-900'
                : 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900'
                }`}>
                <p className={`text-xs uppercase ${tipo === 'cd_para_loja' ? 'text-green-600' : 'text-red-600'}`}>
                  Destino
                </p>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {tipo === 'cd_para_loja' ? (lojasComCd.find(l => l.id === lojaId)?.nome || '-') : cdLoja.nome}
                </p>
                <p className={`text-2xl font-bold mt-1 ${tipo === 'cd_para_loja' ? 'text-green-700' : 'text-red-700'}`}>
                  {tipo === 'cd_para_loja'
                    ? Number(produto[obterCampoEstoqueDaLoja(lojasComCd.find(l => l.id === lojaId) || lojaId)] || 0)
                    : Number(produto.estoque_cd || 0)
                  }
                </p>
              </div>
            </div>

            <div>
              <Label>Quantidade</Label>
              <Input
                ref={inputRef}
                type="number"
                className="text-lg h-12"
                placeholder="0"
                value={quantidade}
                onChange={e => setQuantidade(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && mutation.mutate()}
              />
            </div>

            <p className="text-xs text-gray-500">
              A transferência move quantidade entre CD e loja sem alterar o estoque total do produto.
            </p>
          </div>

          <Button
            className={`w-full h-12 text-lg ${tipo === 'cd_para_loja'
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-red-600 hover:bg-red-700'
              }`}
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !quantidade || !lojaId}
          >
            {mutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
            Confirmar {tipo === 'cd_para_loja' ? 'CD → Loja' : 'Loja → CD'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}