import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, CheckCircle, Package, AlertTriangle, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

export default function BaixaEntregaRapida({ entregas }) {
  const [numeroPedido, setNumeroPedido] = useState("");
  const [entregaEncontrada, setEntregaEncontrada] = useState(null);
  const [observacao, setObservacao] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Entrega.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entregas'] });
      setModalOpen(false);
      setNumeroPedido("");
      setEntregaEncontrada(null);
      setObservacao("");
    },
    onError: (e) => alert("Erro ao confirmar entrega: " + e.message)
  });

  const buscarEntrega = (e) => {
    e.preventDefault();
    if (!numeroPedido) return;

    const entrega = entregas.find(e => 
        e.numero_pedido === numeroPedido || 
        parseInt(e.numero_pedido) === parseInt(numeroPedido)
    );
    
    if (entrega) {
      setEntregaEncontrada(entrega);
      setObservacao(entrega.observacoes || "");
      setModalOpen(true);
    } else {
      alert("Pedido não encontrado! Verifique o número.");
    }
  };

  const confirmarEntrega = () => {
    if (!entregaEncontrada) return;

    if (confirm(`Confirmar entrega do pedido #${entregaEncontrada.numero_pedido}?`)) {
        updateMutation.mutate({
        id: entregaEncontrada.id,
        data: {
            status: 'Entregue',
            data_realizada: new Date().toISOString().split('T')[0],
            observacoes: observacao
        }
        });
    }
  };

  return (
    <>
      {/* Barra de Busca Rápida */}
      <form onSubmit={buscarEntrega} className="flex gap-2 items-center bg-white dark:bg-neutral-900 p-1.5 rounded-lg border border-gray-200 dark:border-neutral-800 shadow-sm">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input 
            placeholder="Nº Pedido para Baixa..." 
            value={numeroPedido}
            onChange={(e) => setNumeroPedido(e.target.value)}
            className="pl-9 h-9 w-48 text-sm bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
        <Button type="submit" size="sm" variant="secondary" className="h-9 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-neutral-800 dark:text-gray-300">
          Buscar
        </Button>
      </form>

      {/* Modal de Confirmação */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-800">
              <CheckCircle className="w-5 h-5" />
              Baixa de Entrega
            </DialogTitle>
          </DialogHeader>

          {entregaEncontrada && (
            <div className="space-y-5 py-2">
              {/* Cartão de Resumo */}
              <div className="bg-gray-50 dark:bg-neutral-800 p-4 rounded-lg border border-gray-200 dark:border-neutral-700">
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">Pedido #{entregaEncontrada.numero_pedido}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{entregaEncontrada.cliente_nome}</p>
                    </div>
                    <Badge className={
                        entregaEncontrada.status === 'Entregue' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }>
                        {entregaEncontrada.status}
                    </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Package className="w-3 h-3" />
                    <span className="truncate max-w-[300px]">{entregaEncontrada.endereco_entrega || "Retirada na loja"}</span>
                </div>
              </div>

              {/* Campo de Observação */}
              <div className="space-y-2">
                <Label className="text-gray-700">Observações do Canhoto / Motorista</Label>
                <Textarea 
                  placeholder="Ex: Recebido pelo porteiro João, caixa levemente amassada, cliente elogiou..."
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-gray-400">Use este espaço para registrar quem recebeu ou ocorrências.</p>
              </div>

              {/* Alerta se já estiver entregue */}
              {entregaEncontrada.status === 'Entregue' && (
                <div className="flex items-center gap-2 text-amber-700 text-sm bg-amber-50 p-3 rounded border border-amber-200">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Atenção: Este pedido já consta como entregue. Salvar atualizará apenas a observação.</span>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button 
                onClick={confirmarEntrega} 
                disabled={updateMutation.isPending}
                className="bg-green-600 hover:bg-green-700 text-white"
            >
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                {entregaEncontrada?.status === 'Entregue' ? 'Atualizar Obs.' : 'Confirmar Entrega'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}