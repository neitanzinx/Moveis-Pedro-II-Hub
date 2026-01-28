import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Send, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function ChatEquipe() {
  const [aberto, setAberto] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [usuario, setUsuario] = useState(null);
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUsuario);
  }, []);

  const { data: mensagens = [] } = useQuery({
    queryKey: ['chat-logistica'],
    queryFn: async () => {
      const msgs = await base44.entities.MensagemChat.list('-created_date', 50);
      return msgs.reverse();
    },
    refetchInterval: 3000,
    enabled: aberto
  });

  const enviarMensagem = useMutation({
    mutationFn: async (texto) => {
      return base44.entities.MensagemChat.create({
        usuario_nome: usuario?.full_name || 'Usuário',
        usuario_email: usuario?.email,
        mensagem: texto,
        tipo: 'logistica'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-logistica'] });
      setMensagem("");
    }
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (aberto) scrollToBottom();
  }, [mensagens, aberto]);

  const handleEnviar = (e) => {
    e.preventDefault();
    if (mensagem.trim() && usuario) {
      enviarMensagem.mutate(mensagem.trim());
    }
  };

  if (!aberto) {
    return (
      <Button
        onClick={() => setAberto(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-green-600 hover:bg-green-700 z-50"
      >
        <MessageCircle className="w-6 h-6" />
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-6 right-6 w-96 h-[500px] shadow-2xl z-50 flex flex-col border-green-500">
      <CardHeader className="border-b bg-green-600 text-white p-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            Chat da Equipe
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAberto(false)}
            className="h-8 w-8 p-0 text-white hover:bg-green-700"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-neutral-900">
        {mensagens.map((msg) => {
          const ehMinha = msg.usuario_email === usuario?.email;
          return (
            <div key={msg.id} className={`flex ${ehMinha ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] ${ehMinha ? 'bg-green-600 text-white' : 'bg-white dark:bg-neutral-800 text-gray-900 dark:text-white'} rounded-lg p-3 shadow-sm`}>
                <div className="text-xs font-semibold mb-1 opacity-70">
                  {msg.usuario_nome}
                </div>
                <div className="text-sm">{msg.mensagem}</div>
                <div className="text-xs mt-1 opacity-60">
                  {new Date(msg.created_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </CardContent>

      <form onSubmit={handleEnviar} className="border-t p-3 bg-white dark:bg-neutral-900">
        <div className="flex gap-2">
          <Input
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            placeholder="Digite sua mensagem..."
            className="flex-1"
            disabled={enviarMensagem.isPending}
          />
          <Button 
            type="submit" 
            size="sm"
            disabled={!mensagem.trim() || enviarMensagem.isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </Card>
  );
}