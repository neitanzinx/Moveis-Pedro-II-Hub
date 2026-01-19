import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, ArrowRight, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import TransferenciaModal from "./TransferenciaModal";

export default function TransferenciasTab({ user }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransferencia, setEditingTransferencia] = useState(null);

  const queryClient = useQueryClient();

  // Listen for header action event
  useEffect(() => {
    const handleAction = (e) => {
      if (e.detail === 'transferencias') {
        setEditingTransferencia(null);
        setIsModalOpen(true);
      }
    };
    window.addEventListener('estoque-header-action', handleAction);
    return () => window.removeEventListener('estoque-header-action', handleAction);
  }, []);

  const { data: transferencias = [], isLoading } = useQuery({
    queryKey: ['transferencias'],
    queryFn: () => base44.entities.TransferenciaEstoque.list('-created_date'),
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => base44.entities.Produto.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.TransferenciaEstoque.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transferencias'] });
      setIsModalOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TransferenciaEstoque.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transferencias'] });
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
    },
  });

  const handleSave = (data) => {
    if (editingTransferencia) {
      updateMutation.mutate({ id: editingTransferencia.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleConfirmarRecebimento = async (transferencia) => {
    if (confirm(`Confirmar recebimento de ${transferencia.quantidade} unidades de ${transferencia.produto_nome}?`)) {
      await updateMutation.mutateAsync({
        id: transferencia.id,
        data: {
          ...transferencia,
          status: 'Recebida',
          data_recebimento: new Date().toISOString().split('T')[0],
          responsavel_recebimento: user.full_name
        }
      });
    }
  };

  const isAdmin = user?.cargo === 'Administrador';
  const isManager = user?.cargo === 'Gerente';
  const isWarehouse = user?.cargo === 'Estoque';

  const statusColors = {
    "Solicitada": { bg: "#FEF3C7", text: "#92400E", border: "#FCD34D" },
    "Em Trânsito": { bg: "#DBEAFE", text: "#1E40AF", border: "#93C5FD" },
    "Recebida": { bg: "#D1FAE5", text: "#065F46", border: "#6EE7B7" },
    "Cancelada": { bg: "#FEE2E2", text: "#991B1B", border: "#FCA5A5" }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p style={{ color: '#8B8B8B' }}>
          {transferencias.length} transferência(s) registrada(s)
        </p>
        {(isAdmin || isManager || isWarehouse) && (
          <Button
            onClick={() => {
              setEditingTransferencia(null);
              setIsModalOpen(true);
            }}
            className="shadow-lg"
            style={{ background: 'linear-gradient(135deg, #f38a4c 0%, #f5a164 100%)' }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Transferência
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: '#07593f' }} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {transferencias.map((transferencia) => (
            <Card key={transferencia.id} className="border-0 shadow-lg">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <span style={{ color: '#07593f' }}>
                        Transferência #{transferencia.numero_transferencia}
                      </span>
                      <Badge
                        style={{
                          backgroundColor: statusColors[transferencia.status]?.bg,
                          color: statusColors[transferencia.status]?.text,
                          borderColor: statusColors[transferencia.status]?.border,
                        }}
                        className="border"
                      >
                        {transferencia.status}
                      </Badge>
                    </CardTitle>
                    <p className="text-sm mt-1" style={{ color: '#8B8B8B' }}>
                      Solicitada em {new Date(transferencia.data_solicitacao).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  {transferencia.status === 'Em Trânsito' && (isAdmin || isManager || isWarehouse) && (
                    <Button
                      size="sm"
                      onClick={() => handleConfirmarRecebimento(transferencia)}
                      style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Confirmar Recebimento
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-6">
                  <div>
                    <p className="text-sm font-medium mb-2" style={{ color: '#8B8B8B' }}>Produto</p>
                    <p className="font-semibold" style={{ color: '#07593f' }}>
                      {transferencia.produto_nome}
                    </p>
                    <p className="text-sm" style={{ color: '#8B8B8B' }}>
                      Quantidade: {transferencia.quantidade} unidades
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2" style={{ color: '#8B8B8B' }}>Rota</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{transferencia.loja_origem}</Badge>
                      <ArrowRight className="w-4 h-4" style={{ color: '#f38a4c' }} />
                      <Badge variant="outline">{transferencia.loja_destino}</Badge>
                    </div>
                    {transferencia.motivo && (
                      <p className="text-xs mt-2" style={{ color: '#8B8B8B' }}>
                        Motivo: {transferencia.motivo}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2" style={{ color: '#8B8B8B' }}>Datas</p>
                    {transferencia.data_envio && (
                      <p className="text-sm" style={{ color: '#8B8B8B' }}>
                        Enviado: {new Date(transferencia.data_envio).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                    {transferencia.data_recebimento && (
                      <p className="text-sm" style={{ color: '#8B8B8B' }}>
                        Recebido: {new Date(transferencia.data_recebimento).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>
                </div>
                {transferencia.observacoes && (
                  <div className="mt-4 pt-4 border-t" style={{ borderColor: '#E5E0D8' }}>
                    <p className="text-sm" style={{ color: '#8B8B8B' }}>
                      <strong>Observações:</strong> {transferencia.observacoes}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {transferencias.length === 0 && !isLoading && (
        <div className="text-center py-16">
          <p className="text-xl" style={{ color: '#8B8B8B' }}>
            Nenhuma transferência registrada
          </p>
        </div>
      )}

      <TransferenciaModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTransferencia(null);
        }}
        onSave={handleSave}
        transferencia={editingTransferencia}
        produtos={produtos}
        isLoading={createMutation.isPending}
      />
    </div>
  );
}