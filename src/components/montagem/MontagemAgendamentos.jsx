import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, MessageCircle, Calendar, User, Clock } from "lucide-react";
import MontagemModal from "./MontagemModal";

export default function MontagemAgendamentos({ montagens, valores }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMontagem, setEditingMontagem] = useState(null);
  
  const queryClient = useQueryClient();

  const { data: vendas } = useQuery({
    queryKey: ['vendas'],
    queryFn: () => base44.entities.Venda.list('-created_date'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Montagem.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['montagens'] });
    },
  });

  const enviarWhatsApp = (montagem) => {
    const mensagem = `Olá ${montagem.cliente_nome}! Sua montagem foi agendada para ${new Date(montagem.data_montagem).toLocaleDateString('pt-BR')}, ${montagem.horario_montagem}.

> Montador: ${montagem.montador}`;

    const telefone = montagem.cliente_telefone?.replace(/\D/g, '');
    const url = `https://wa.me/55${telefone}?text=${encodeURIComponent(mensagem)}`;
    
    window.open(url, '_blank');
    
    // Marcar como enviado
    updateMutation.mutate({
      id: montagem.id,
      data: { ...montagem, whatsapp_enviado: true }
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      'Pendente': 'bg-yellow-100 text-yellow-800',
      'Agendada': 'bg-blue-100 text-blue-800',
      'Concluída': 'bg-green-100 text-green-800',
      'Cancelada': 'bg-red-100 text-red-800'
    };
    return colors[status] || '';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: '#07593f' }}>
            Agendamentos de Montagem
          </h2>
          <p style={{ color: '#8B8B8B' }}>
            {montagens.length} montagem(ns) cadastrada(s)
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingMontagem(null);
            setIsModalOpen(true);
          }}
          style={{ background: 'linear-gradient(135deg, #f38a4c 0%, #f5a164 100%)' }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Montagem
        </Button>
      </div>

      <div className="grid gap-4">
        {montagens.map((montagem) => (
          <Card key={montagem.id} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="font-bold text-lg" style={{ color: '#07593f' }}>
                      Pedido #{montagem.numero_pedido}
                    </h3>
                    <Badge className={getStatusColor(montagem.status)}>
                      {montagem.status}
                    </Badge>
                  </div>

                  <div className="grid md:grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2" style={{ color: '#8B8B8B' }}>
                      <User className="w-4 h-4" />
                      <span>Cliente: <strong>{montagem.cliente_nome}</strong></span>
                    </div>
                    <div className="flex items-center gap-2" style={{ color: '#8B8B8B' }}>
                      <Calendar className="w-4 h-4" />
                      <span>Data: <strong>{new Date(montagem.data_montagem).toLocaleDateString('pt-BR')}</strong></span>
                    </div>
                    <div className="flex items-center gap-2" style={{ color: '#8B8B8B' }}>
                      <Clock className="w-4 h-4" />
                      <span>Horário: <strong>{montagem.horario_montagem}</strong></span>
                    </div>
                    <div className="flex items-center gap-2" style={{ color: '#8B8B8B' }}>
                      <User className="w-4 h-4" />
                      <span>Montador: <strong>{montagem.montador}</strong></span>
                    </div>
                  </div>

                  {montagem.itens && montagem.itens.length > 0 && (
                    <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: '#FAF8F5' }}>
                      <p className="text-sm font-semibold mb-2" style={{ color: '#07593f' }}>
                        Itens para montar:
                      </p>
                      <div className="space-y-1">
                        {montagem.itens.map((item, idx) => (
                          <p key={idx} className="text-sm" style={{ color: '#8B8B8B' }}>
                            • {item.quantidade}x {item.produto_nome} 
                            {item.montagem_externa && ' (Externa)'}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {montagem.observacoes && (
                    <p className="text-sm mt-2" style={{ color: '#8B8B8B' }}>
                      <strong>Obs:</strong> {montagem.observacoes}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  {montagem.status === 'Agendada' && !montagem.whatsapp_enviado && (
                    <Button
                      onClick={() => enviarWhatsApp(montagem)}
                      className="w-full md:w-auto"
                      style={{ background: '#25D366' }}
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Enviar WhatsApp
                    </Button>
                  )}
                  {montagem.whatsapp_enviado && (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      ✓ WhatsApp Enviado
                    </Badge>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingMontagem(montagem);
                      setIsModalOpen(true);
                    }}
                  >
                    Editar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {montagens.length === 0 && (
          <Card className="border-0 shadow-lg">
            <CardContent className="p-12 text-center">
              <Calendar className="w-16 h-16 mx-auto mb-4 opacity-20" style={{ color: '#07593f' }} />
              <p className="text-xl" style={{ color: '#8B8B8B' }}>
                Nenhuma montagem agendada
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <MontagemModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingMontagem(null);
        }}
        montagem={editingMontagem}
        vendas={vendas}
        valores={valores}
      />
    </div>
  );
}