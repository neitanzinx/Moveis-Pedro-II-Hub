import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Check, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import InventarioModal from "../components/estoque/InventarioModal";

export default function Inventario() {
  const [user, setUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  const { data: inventarios, isLoading } = useQuery({
    queryKey: ['inventarios'],
    queryFn: () => base44.entities.Inventario.list('-created_date'),
  });

  const { data: produtos } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => base44.entities.Produto.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Inventario.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventarios'] });
      setIsModalOpen(false);
    },
  });

  const aprovarMutation = useMutation({
    mutationFn: async ({ inventario }) => {
      // Aplicar ajustes de estoque
      for (const item of inventario.itens) {
        if (item.diferenca !== 0) {
          const produto = produtos.find(p => p.id === item.produto_id);
          if (produto) {
            await base44.entities.Produto.update(produto.id, {
              quantidade_estoque: item.quantidade_contada
            });
          }
        }
      }
      
      // Atualizar status do inventário
      await base44.entities.Inventario.update(inventario.id, {
        ...inventario,
        status: 'Aprovado',
        aprovado_por: user.email,
        data_aprovacao: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventarios'] });
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
    },
  });

  const handleSave = (data) => {
    createMutation.mutate(data);
  };

  const handleAprovar = (inventario) => {
    if (confirm(`Aprovar inventário #${inventario.numero_inventario}?\n\nOs ajustes de estoque serão aplicados.`)) {
      aprovarMutation.mutate({ inventario });
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#07593f' }} />
      </div>
    );
  }

  const isAdmin = user.cargo === 'Administrador';
  const isManager = user.cargo === 'Gerente';
  const isWarehouse = user.cargo === 'Estoque';

  const statusColors = {
    "Em Andamento": { bg: "#FEF3C7", text: "#92400E" },
    "Concluído": { bg: "#DBEAFE", text: "#1E40AF" },
    "Aprovado": { bg: "#D1FAE5", text: "#065F46" },
    "Cancelado": { bg: "#FEE2E2", text: "#991B1B" }
  };

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2" style={{ color: '#07593f' }}>
              Inventário
            </h1>
            <p style={{ color: '#8B8B8B' }}>
              {inventarios.length} inventário(s) registrado(s)
            </p>
          </div>
          {(isAdmin || isManager || isWarehouse) && (
            <Button
              onClick={() => setIsModalOpen(true)}
              className="shadow-lg"
              style={{ background: 'linear-gradient(135deg, #f38a4c 0%, #f5a164 100%)' }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Novo Inventário
            </Button>
          )}
        </div>

        <Alert className="mb-6" style={{ backgroundColor: '#f0f9ff', borderColor: '#3b82f6' }}>
          <AlertDescription>
            <strong>💡 Como funciona:</strong> Realize a contagem física dos produtos em estoque e registre as quantidades. 
            O sistema calculará automaticamente as diferenças e permitirá ajustar o estoque após aprovação.
          </AlertDescription>
        </Alert>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: '#07593f' }} />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {inventarios.map((inventario) => (
              <Card key={inventario.id} className="border-0 shadow-lg">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <span style={{ color: '#07593f' }}>
                          Inventário #{inventario.numero_inventario}
                        </span>
                        <Badge
                          style={{
                            backgroundColor: statusColors[inventario.status]?.bg,
                            color: statusColors[inventario.status]?.text,
                          }}
                        >
                          {inventario.status}
                        </Badge>
                      </CardTitle>
                      <p className="text-sm mt-1" style={{ color: '#8B8B8B' }}>
                        {inventario.loja} • {new Date(inventario.data_inventario).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    {inventario.status === 'Concluído' && (isAdmin || isManager) && (
                      <Button
                        size="sm"
                        onClick={() => handleAprovar(inventario)}
                        disabled={aprovarMutation.isPending}
                        style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Aprovar e Ajustar Estoque
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-6 mb-4">
                    <div>
                      <p className="text-sm font-medium mb-1" style={{ color: '#8B8B8B' }}>Responsável</p>
                      <p className="font-semibold" style={{ color: '#07593f' }}>
                        {inventario.responsavel}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-1" style={{ color: '#8B8B8B' }}>Total de Itens</p>
                      <p className="font-semibold" style={{ color: '#07593f' }}>
                        {inventario.total_itens || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-1" style={{ color: '#8B8B8B' }}>Divergências</p>
                      <p className="font-semibold text-orange-600">
                        {inventario.total_divergencias || 0}
                      </p>
                    </div>
                  </div>

                  {inventario.itens && inventario.itens.length > 0 && (
                    <div className="border-t pt-4" style={{ borderColor: '#E5E0D8' }}>
                      <p className="text-sm font-medium mb-3" style={{ color: '#07593f' }}>
                        Itens com Divergência:
                      </p>
                      <div className="space-y-2">
                        {inventario.itens
                          .filter(item => item.diferenca !== 0)
                          .map((item, index) => (
                            <div 
                              key={index}
                              className="flex items-center justify-between p-3 rounded-lg"
                              style={{ backgroundColor: '#FEF3C7' }}
                            >
                              <div>
                                <p className="font-medium" style={{ color: '#07593f' }}>
                                  {item.produto_nome}
                                </p>
                                <p className="text-xs" style={{ color: '#8B8B8B' }}>
                                  Sistema: {item.quantidade_sistema} | Contado: {item.quantidade_contada}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-orange-600" />
                                <span className="font-bold text-orange-600">
                                  {item.diferenca > 0 ? '+' : ''}{item.diferenca}
                                </span>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {inventario.observacoes && (
                    <div className="mt-4 pt-4 border-t" style={{ borderColor: '#E5E0D8' }}>
                      <p className="text-sm" style={{ color: '#8B8B8B' }}>
                        <strong>Observações:</strong> {inventario.observacoes}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {inventarios.length === 0 && !isLoading && (
          <div className="text-center py-16">
            <p className="text-xl" style={{ color: '#8B8B8B' }}>
              Nenhum inventário registrado
            </p>
          </div>
        )}

        <InventarioModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
          produtos={produtos}
          isLoading={createMutation.isPending}
          userLoja={user.loja}
        />
      </div>
    </div>
  );
}