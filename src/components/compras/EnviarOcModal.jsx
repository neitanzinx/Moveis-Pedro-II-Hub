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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Copy, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/contexts/TenantContext';
import { gerarTextoPedidoOperacional } from '@/utils/orderFormatUtils';
import { formatProductItemName } from '@/utils/productReference';

const TIPO_ITEM_LABELS = {
  ASSISTENCIA_REPOSICAO_PECAS: 'Assistência - Reposição de Peças',
  ASSISTENCIA_VENDA_CLIENTE: 'Assistência - Venda para Cliente',
  ORDEM_COMUM_ENCOMENDA: 'Ordem Comum de Compra',
};

const ORIGEM_LABELS = {
  VENDEDOR: 'Vendedor',
  ESTOQUE: 'Estoque',
  ASSISTENCIA: 'Assistência',
};

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
  const { user } = useAuth();
  const { lojas, organization } = useTenant();
  const [itensOc, setItensOc] = useState([]);
  const [isLoadingItens, setIsLoadingItens] = useState(false);
  const [canalEnvio, setCanalEnvio] = useState('email');

  // Obter nome da loja da OC (com fallback para organização)
  const lojaName = useMemo(() => {
    if (oc?.metadata?.loja_id && lojas) {
      const loja = lojas.find(l => l.id === oc.metadata.loja_id);
      if (loja?.nome) return loja.nome;
    }
    // Fallback: usar nome da organização/empresa
    return organization?.name || '';
  }, [oc?.metadata?.loja_id, lojas, organization?.name]);

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
    return gerarTextoPedidoOperacional(oc, itens, user, lojaName);
  }, [oc, itens, user, lojaName]);

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
    onConfirmarEnvio?.(oc, {
      canal_envio: canalEnvio,
      data_hora_enviado: new Date().toISOString(),
    });
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
                  {itens.map((item, index) => {
                    const nome = formatProductItemName(item);
                    const cor = item.cor_item || item.cor || null;
                    const qtd = Number(item.quantidade_pedida || 0);
                    const tipoLabel = TIPO_ITEM_LABELS[item.tipo_item_oc] || null;
                    const origemLabel = ORIGEM_LABELS[item.origem_solicitacao] || null;
                    const ehAssistencia = item.tipo_item_oc && item.tipo_item_oc !== 'ORDEM_COMUM_ENCOMENDA';
                    const precoCusto = Number(item.preco_custo_item || 0);
                    const precoFinal = Number(item.preco_final_manual || item.preco_unitario || 0);
                    return (
                      <div key={`${item.id || item.produto_id || index}`} className="px-3 py-2 text-sm space-y-1">
                        <div className="flex justify-between gap-3">
                          <span className="text-gray-800 font-medium">
                            {index + 1}. {nome}{cor ? ` — ${cor}` : ''}
                          </span>
                          <span className="font-mono text-gray-600 shrink-0">Qtd: {qtd}</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {tipoLabel && (
                            <Badge variant="outline" className={`text-[10px] px-1 py-0 ${ehAssistencia ? 'border-amber-400 text-amber-700' : ''}`}>
                              {tipoLabel}
                            </Badge>
                          )}
                          {origemLabel && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 text-blue-600 border-blue-300">
                              {origemLabel}
                            </Badge>
                          )}
                          {ehAssistencia && item.pedido_origem_numero && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 text-gray-600">
                              Ped. {item.pedido_origem_numero}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-600">
                          Custo: R$ {precoCusto.toFixed(2)} | Preço Final: R$ {precoFinal.toFixed(2)}
                        </p>
                        {ehAssistencia && item.motivo_assistencia && (
                          <p className="text-xs text-amber-700">Motivo: {item.motivo_assistencia}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Canal de Envio */}
          <div className="rounded-lg border bg-blue-50 p-4 space-y-2">
            <Label htmlFor="canal_envio" className="text-blue-800 font-semibold text-sm">Como será enviado?</Label>
            <Select value={canalEnvio} onValueChange={setCanalEnvio}>
              <SelectTrigger id="canal_envio" className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="pessoalmente">Pessoalmente</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
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
