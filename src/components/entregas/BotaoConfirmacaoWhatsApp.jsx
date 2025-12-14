import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { MessageCircle, Send, CheckCircle, Loader2, Server, WifiOff } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function BotaoConfirmacaoWhatsApp({ entregas, vendas }) {
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [statusServidor, setStatusServidor] = useState("verificando");

  const amanha = addDays(new Date(), 1);
  const dataAmanhaStr = format(amanha, 'yyyy-MM-dd');
  const dataAmanhaFormatada = format(amanha, "dd/MM", { locale: ptBR });

  // Filtra entregas de amanhã
  const entregasAmanha = entregas.filter(e => 
    e.data_agendada === dataAmanhaStr && 
    e.status !== 'Entregue' && 
    e.status !== 'Cancelada'
  );

  const verificarServidor = async () => {
    setStatusServidor("verificando");
    try {
      await fetch('http://localhost:3001/status', { method: 'GET' });
      setStatusServidor("online");
    } catch (e) {
      setStatusServidor("offline");
    }
  };

  const handleOpen = () => {
    setModalOpen(true);
    verificarServidor();
  };

  const enviarParaRobo = async () => {
    setLoading(true);
    try {
      // Prepara os dados
      const payload = entregasAmanha.map(entrega => {
        const venda = vendas.find(v => v.id === entrega.venda_id);
        const listaProdutos = venda?.itens?.map(item => 
          `• ${item.quantidade}x ${item.produto_nome}`
        ).join('\n') || "Itens não informados";

        return {
          id: entrega.id,
          numero_pedido: entrega.numero_pedido,
          cliente_nome: entrega.cliente_nome,
          telefone: entrega.cliente_telefone,
          turno: entrega.turno || "comercial",
          produtos: listaProdutos
        };
      });

      // Manda para o seu PC
      const response = await fetch('http://localhost:3001/disparar-confirmacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entregas: payload })
      });

      if (response.ok) {
        // Marca como aguardando no sistema
        for (const entrega of entregasAmanha) {
           await base44.entities.Entrega.update(entrega.id, {
             status_confirmacao: 'Aguardando Resposta',
             whatsapp_enviado: true
           });
        }
        alert(`✅ Robô Iniciado! Mensagens sendo enviadas para ${payload.length} clientes.`);
        setModalOpen(false);
      } else {
        alert("Erro ao comunicar com o robô local.");
      }
    } catch (error) {
      alert("Erro: O servidor local (node server.js) não está rodando.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button onClick={handleOpen} className="bg-green-600 hover:bg-green-700 text-white shadow-sm" disabled={entregasAmanha.length === 0}>
        <MessageCircle className="w-4 h-4 mr-2" />
        Confirmar Entregas ({entregasAmanha.length})
      </Button>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Robô de Confirmação</DialogTitle>
            <DialogDescription>Entregas para amanhã: <strong>{dataAmanhaFormatada}</strong></DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            {statusServidor === 'online' ? (
              <div className="p-3 rounded bg-green-100 text-green-800 flex items-center gap-2">
                <Server className="w-5 h-5"/> <span>Robô Conectado e Pronto!</span>
              </div>
            ) : (
              <div className="p-3 rounded bg-red-100 text-red-800 flex items-center gap-2">
                <WifiOff className="w-5 h-5"/> <span>Robô Offline. Rode "node server.js" no terminal.</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={enviarParaRobo} disabled={statusServidor !== "online" || loading} className="bg-green-600">
              {loading ? "Enviando..." : "Iniciar Disparos"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}