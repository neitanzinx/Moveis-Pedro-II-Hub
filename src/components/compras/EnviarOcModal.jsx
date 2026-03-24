import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

function formatarQuantidade(valor) {
  const numero = Number(valor) || 0;
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: Number.isInteger(numero) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(numero);
}

function formatarData(data) {
  if (!data) return new Date().toLocaleDateString('pt-BR');
  return new Date(data).toLocaleDateString('pt-BR');
}

export default function EnviarOcModal({
  open,
  onClose,
  oc,
  onConfirmarEnvio,
  isConfirmando = false,
}) {
  const [itensOc, setItensOc] = useState([]);
  const [isLoadingItens, setIsLoadingItens] = useState(false);

  useEffect(() => {
    if (!open || !oc?.id) {
      setItensOc([]);
      return;
    }

    let ativo = true;

    const carregarItens = async () => {
      try {
        setIsLoadingItens(true);
        const { data, error } = await supabase
          .from('compras_oc_itens')
          .select('*')
          .eq('ordem_compra_id', oc.id)
          .order('created_at', { ascending: true });

        if (error) throw error;

        if (ativo) {
          setItensOc(data || []);
        }
      } catch (error) {
        console.error('Erro ao carregar itens da OC para envio:', error);
        if (ativo) {
          toast.error('Não foi possível carregar os itens da OC');
          setItensOc([]);
        }
      } finally {
        if (ativo) {
          setIsLoadingItens(false);
        }
      }
    };

    carregarItens();

    return () => {
      ativo = false;
    };
  }, [open, oc?.id]);

  const itens = itensOc;

  const textoPedido = useMemo(() => {
    if (!oc) return '';

    const linhasItens = itens.length > 0
      ? itens.map((item, index) => {
          const nome = item.produto_nome || 'Produto sem nome';
          const quantidade = formatarQuantidade(item.quantidade_pedida || 0);
          return `${index + 1}. ${nome} - Qtd: ${quantidade}`;
        })
      : ['(Sem itens cadastrados)'];

    return [
      `Pedido para ${oc.fornecedor_nome || 'Fornecedor não informado'}`,
      `OC: ${oc.numero_pedido || 'Sem número'}`,
      `Data: ${formatarData(oc.created_at || oc.data_pedido)}`,
      '',
      ...linhasItens,
      '',
      `Total de itens: ${itens.length}`,
    ].join('\n');
  }, [oc, itens]);

  const handleCopiarPedido = async () => {
    try {
      await navigator.clipboard.writeText(textoPedido);
      toast.success('Pedido copiado para a área de transferência');
    } catch (error) {
      console.error('Erro ao copiar pedido:', error);
      toast.error('Não foi possível copiar o pedido');
    }
  };

  const handleConfirmar = () => {
    if (isLoadingItens) {
      toast.warning('Aguarde o carregamento dos itens antes de enviar');
      return;
    }
    onConfirmarEnvio?.(oc);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5" />
            Enviar Pedido para Fornecedor
          </DialogTitle>
          <DialogDescription>
            Revise os itens, copie a listagem e confirme o envio da ordem.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-gray-50 p-3 text-sm space-y-1">
            <p><strong>OC:</strong> {oc?.numero_pedido || 'Sem número'}</p>
            <p><strong>Fornecedor:</strong> {oc?.fornecedor_nome || 'Não informado'}</p>
            <p><strong>Data:</strong> {formatarData(oc?.created_at || oc?.data_pedido)}</p>
            <div className="pt-1">
              <Badge variant="outline">{itens.length} item(ns)</Badge>
            </div>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <div className="px-3 py-2 border-b bg-white text-xs font-semibold uppercase tracking-wide text-gray-600">
              Itens do Pedido
            </div>
            <div className="max-h-64 overflow-auto bg-white">
              {itens.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">Nenhum item encontrado para esta OC.</p>
              ) : (
                <div className="divide-y">
                  {itens.map((item, index) => (
                    <div key={`${item.id || item.produto_id || index}`} className="px-3 py-2 text-sm flex justify-between gap-3">
                      <span className="text-gray-800">{index + 1}. {item.produto_nome || 'Produto sem nome'}</span>
                      <span className="font-mono text-gray-600">Qtd: {formatarQuantidade(item.quantidade_pedida || 0)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="secondary" onClick={handleCopiarPedido} disabled={isLoadingItens || !oc}>
            <Copy className="w-4 h-4 mr-2" />
            Copiar Pedido
          </Button>
          <Button
            type="button"
            onClick={handleConfirmar}
            disabled={isConfirmando || isLoadingItens || !oc}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoadingItens ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Carregando Itens...
              </>
            ) : isConfirmando ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Confirmar Envio
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
