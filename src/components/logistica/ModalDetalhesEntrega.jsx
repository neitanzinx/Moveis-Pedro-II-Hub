import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea"; // Added Textarea
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Package, MapPin, User, Phone, Wrench, Save, RefreshCw, Ban, Clock } from "lucide-react"; // Added RefreshCw, Ban, Clock
import { toast } from "sonner"; // Added toast

export default function ModalDetalhesEntrega({ entrega, venda, onClose }) {
  const queryClient = useQueryClient();
  const [itensMontagem, setItensMontagem] = useState(
    entrega.itens_montagem_interna || []
  );
  const [endereco, setEndereco] = useState(entrega.endereco_entrega || "");
  const [isSyncing, setIsSyncing] = useState(false);

  // Update local state if prop changes (though usually modal unmounts)
  useEffect(() => {
    setEndereco(entrega.endereco_entrega || "");
  }, [entrega.endereco_entrega]);

  const atualizarEntregaMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Entrega.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entregas'] });
      toast.success("Entrega atualizada com sucesso!");
      onClose();
    },
    onError: (err) => {
      console.error("Erro ao atualizar entrega:", err);
      toast.error("Erro ao salvar entrega");
    }
  });

  const toggleItemMontagem = (itemNome) => {
    const itemExiste = (itensMontagem || []).find(i => i.produto_nome === itemNome);

    if (itemExiste) {
      setItensMontagem((itensMontagem || []).filter(i => i.produto_nome !== itemNome));
    } else {
      const itemVenda = venda?.itens?.find(i => i.produto_nome === itemNome);
      if (itemVenda) {
        setItensMontagem([...(itensMontagem || []), {
          produto_nome: itemNome,
          quantidade: itemVenda.quantidade,
          montado: false
        }]);
      }
    }
  };

  const buscarEnderecoCliente = async () => {
    setIsSyncing(true);
    try {
      let cliente = null;

      // Tentativa 1: Pelo ID do cliente na venda
      if (venda && venda.cliente_id) {
        try {
          // Fetch single client if ID exists
          const response = await base44.entities.Cliente.list(); // List is inefficient but filter might be better if available
          // Optimization: using filter if available or finding in list
          // Since we don't have a direct get(id) exposed in the simple wrapper shown in previous turns, 
          // we might need to filter.
          // Re-reading base44Client.js... it has filter() and list(). 
          // Let's use filter to be safe or list and find.

          const clientes = await base44.entities.Cliente.list();
          cliente = clientes.find(c => String(c.id) === String(venda.cliente_id));
        } catch (e) { console.warn("Erro ao buscar cliente por ID", e); }
      }

      // Tentativa 2: Pelo Nome (caso venda_id falhe ou não exista)
      if (!cliente && entrega.cliente_nome) {
        const clientes = await base44.entities.Cliente.list();
        // Fuzzy match or exact match
        cliente = clientes.find(c => c.nome_completo === entrega.cliente_nome);
      }

      if (cliente) {
        const construirEndereco = (c) => {
          const usarMesmo = c.usar_mesmo_endereco !== false;
          const end = usarMesmo ? {
            rua: c.endereco,
            numero: c.numero,
            complemento: c.complemento,
            ponto_referencia: c.ponto_referencia,
            bairro: c.bairro,
            cidade: c.cidade,
            estado: c.estado
          } : {
            rua: c.endereco_entrega_rua,
            numero: c.endereco_entrega_numero,
            complemento: c.endereco_entrega_complemento,
            ponto_referencia: c.endereco_entrega_ponto_referencia,
            bairro: c.endereco_entrega_bairro,
            cidade: c.endereco_entrega_cidade,
            estado: c.endereco_entrega_estado
          };

          if (!end.rua) return "";

          let enderecoStr = `${end.rua}, ${end.numero || 's/n'}`;
          if (end.complemento) enderecoStr += ` - ${end.complemento}`;
          if (end.bairro) enderecoStr += ` - ${end.bairro}`;
          if (end.cidade) enderecoStr += `, ${end.cidade}`;
          if (end.estado) enderecoStr += `/${end.estado}`;
          if (end.ponto_referencia) enderecoStr += ` (Ref: ${end.ponto_referencia})`;

          return enderecoStr;
        };
        const novoEnd = construirEndereco(cliente);
        if (novoEnd) {
          setEndereco(novoEnd);
          toast.success("Endereço atualizado do cadastro do cliente!");
        } else {
          toast.warning("Cliente encontrado, mas endereço está incompleto.");
        }
      } else {
        toast.error("Cliente não encontrado para sincronizar.");
      }

    } catch (error) {
      console.error("Erro ao buscar cliente:", error);
      toast.error("Erro ao buscar endereço do cliente.");
    } finally {
      setIsSyncing(false);
    }
  };

  const salvarMontagem = async () => {
    await atualizarEntregaMutation.mutateAsync({
      id: entrega.id,
      data: {
        itens_montagem_interna: itensMontagem,
        montagem_concluida: false,
        endereco_entrega: endereco // Save the updated address
      }
    });
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-green-600" />
            Detalhes da Entrega #{entrega.numero_pedido}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Cliente */}
          <div className="bg-gray-50 dark:bg-neutral-800 p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-gray-500" />
              <span className="font-semibold">{entrega.cliente_nome}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Phone className="w-4 h-4" />
              <span>{entrega.cliente_telefone}</span>
            </div>
          </div>

          {/* Endereço Editável */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg space-y-2">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-medium">
                <MapPin className="w-4 h-4" />
                <Label htmlFor="endereco_entrega">Endereço de Entrega</Label>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-blue-600 hover:text-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40"
                onClick={buscarEnderecoCliente}
                disabled={isSyncing}
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
                Sincronizar com Cliente
              </Button>
            </div>
            <Textarea
              id="endereco_entrega"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              className="bg-white dark:bg-neutral-900 border-blue-200 dark:border-blue-800/50 resize-none"
              rows={2}
              placeholder="Endereço de entrega..."
            />
          </div>

          {/* Itens da Venda */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Wrench className="w-5 h-5 text-orange-600" />
              <h3 className="font-bold">Selecionar Itens para Montagem Interna</h3>
            </div>
            <div className="space-y-2">
              {(venda?.itens || []).map((item, index) => {
                const selecionado = (itensMontagem || []).some(i => i.produto_nome === item.produto_nome);
                return (
                  <div
                    key={index}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer ${selecionado
                      ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20'
                      : 'border-gray-200 dark:border-neutral-700 hover:border-gray-300'
                      }`}
                    onClick={() => toggleItemMontagem(item.produto_nome)}
                  >
                    <Checkbox
                      checked={selecionado}
                      onCheckedChange={() => toggleItemMontagem(item.produto_nome)}
                    />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.produto_nome}</p>
                      <p className="text-xs text-gray-500">Qtd: {item.quantidade}</p>
                    </div>
                    {selecionado && (
                      <Badge className="bg-orange-500 text-white">
                        Para Montar
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Resumo */}
          {itensMontagem.length > 0 && (
            <div className="bg-orange-100 dark:bg-orange-900/30 p-3 rounded-lg">
              <p className="text-sm text-orange-800 dark:text-orange-400 font-medium">
                ⚠️ {itensMontagem.length} {itensMontagem.length === 1 ? 'item será enviado' : 'itens serão enviados'} para os montadores internos
              </p>
            </div>
          )}



          {/* Histórico de Reagendamentos / Tentativas */}
          {(entrega.historico_reagendamentos?.length > 0 || entrega.motivo_restricao) && (
            <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-800/50">
              <div className="flex items-center gap-2 mb-2 text-red-700 dark:text-red-400 font-medium">
                <Package className="w-4 h-4" /> {/* Or History icon */}
                <h3>Histórico de Tentativas</h3>
              </div>

              {/* Alerta de Restrição Atual (Específica + Preferências) */}
              {(entrega.motivo_restricao || entrega.data_restricao || entrega.preferencias_entrega?.dias?.length > 0 || entrega.preferencias_entrega?.turnos?.length > 0) && (
                <div className="mb-3 p-2 bg-white dark:bg-neutral-900 rounded border border-red-200 dark:border-red-800 text-sm">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-red-600 flex items-center gap-1">
                      <Ban className="w-3.5 h-3.5" /> Restrições Ativas
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={async () => {
                        if (confirm("Isso removerá TODAS as restrições (Data específica e Preferências) desta entrega. Confirmar?")) {
                          await atualizarEntregaMutation.mutateAsync({
                            id: entrega.id,
                            data: {
                              motivo_restricao: null,
                              data_restricao: null,
                              preferencias_entrega: { dias: [], turnos: [], obs: entrega.preferencias_entrega?.obs || "" }
                            }
                          });
                          toast.success("Todas as restrições foram removidas!");
                        }
                      }}
                    >
                      Limpar Tudo
                    </Button>
                  </div>

                  <div className="space-y-1 pl-1">
                    {entrega.data_restricao && (
                      <div className="text-gray-700">
                        <span className="font-semibold">Data Bloqueada:</span> {new Date(entrega.data_restricao).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                        {entrega.motivo_restricao && <span className="text-gray-500 italic"> - {entrega.motivo_restricao}</span>}
                      </div>
                    )}

                    {entrega.preferencias_entrega?.dias?.length > 0 && (
                      <div className="text-gray-700">
                        <span className="font-semibold">Dias Permitidos (Cliente):</span> {' '}
                        {entrega.preferencias_entrega.dias.map(d => ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][Number(d)]).join(', ')}
                      </div>
                    )}

                    {entrega.preferencias_entrega?.turnos?.length > 0 && (
                      <div className="text-gray-700">
                        <span className="font-semibold">Turnos Permitidos:</span> {entrega.preferencias_entrega.turnos.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Lista de Histórico */}
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {entrega.historico_reagendamentos?.map((hist, idx) => (
                  <div key={idx} className="text-sm bg-white dark:bg-neutral-900 p-2 rounded shadow-sm flex flex-col gap-1">
                    <div className="flex justify-between items-center border-b border-gray-100 pb-1 mb-1">
                      <span className="font-bold text-gray-700 dark:text-gray-200">
                        {hist.data ? format(new Date(hist.data), "dd/MM/yyyy", { locale: ptBR }) : 'Data N/D'}
                      </span>
                      <span className="text-xs text-gray-400 truncate max-w-[100px]" title={hist.usuario}>
                        {hist.usuario?.split('@')[0] || 'Sistema'}
                      </span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-xs italic">
                      &quot;{hist.motivo || 'Sem motivo registrado'}&quot;
                    </p>
                  </div>
                ))}
                {(!entrega.historico_reagendamentos || entrega.historico_reagendamentos.length === 0) && !entrega.motivo_restricao && (
                  <p className="text-xs text-gray-500">Nenhum histórico registrado.</p>
                )}
              </div>
            </div>
          )}

          {/* Ações */}
          <div className="flex gap-2 justify-between pt-4 border-t">
            <Button
              variant="outline"
              className="text-amber-600 border-amber-200 hover:bg-amber-50 gap-2 font-bold"
              onClick={async () => {
                const motivo = prompt("Qual o motivo para aguardar liberação?");
                if (!motivo) return;

                await atualizarEntregaMutation.mutateAsync({
                  id: entrega.id,
                  data: {
                    status: 'Aguardando Liberação',
                    observacoes: motivo,
                    data_agendada: null,
                    turno: null,
                    caminhao_id: null,
                    ordem_rota: null
                  }
                });
                toast.success("Entrega movida para Aguardando Liberação");
                onClose();
              }}
              disabled={atualizarEntregaMutation.isPending}
            >
              <Clock className="w-4 h-4" />
              Mover para Aguardando
            </Button>

            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                onClick={salvarMontagem}
                className="bg-green-600 hover:bg-green-700 gap-2"
                disabled={atualizarEntregaMutation.isPending}
              >
                <Save className="w-4 h-4" />
                {atualizarEntregaMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}