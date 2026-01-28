import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, UserCheck, UserX, MapPin, Loader2 } from "lucide-react";
import VendedorModal from "./VendedorModal";

export default function GestaoVendedores() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVendedor, setEditingVendedor] = useState(null);
  const queryClient = useQueryClient();

  const { data: vendedores = [], isLoading } = useQuery({
    queryKey: ['vendedores'],
    queryFn: () => base44.entities.Vendedor.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Vendedor.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendedores'] });
      setIsModalOpen(false);
      setEditingVendedor(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Vendedor.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendedores'] });
      setIsModalOpen(false);
      setEditingVendedor(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Vendedor.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendedores'] });
    },
  });

  const handleSave = (data) => {
    if (editingVendedor) {
      updateMutation.mutate({ id: editingVendedor.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (vendedor) => {
    setEditingVendedor(vendedor);
    setIsModalOpen(true);
  };

  const handleDelete = (id) => {
    if (confirm('Tem certeza que deseja excluir este vendedor?')) {
      deleteMutation.mutate(id);
    }
  };

  const toggleAtivo = (vendedor) => {
    updateMutation.mutate({
      id: vendedor.id,
      data: { ...vendedor, ativo: !vendedor.ativo }
    });
  };

  const vendedoresPorLoja = {
    "Centro": vendedores.filter(v => v.loja === "Centro"),
    "Carangola": vendedores.filter(v => v.loja === "Carangola"),
    "Ponte Branca": vendedores.filter(v => v.loja === "Ponte Branca")
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#07593f' }} />
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-end mb-6">
        <Button
          onClick={() => {
            setEditingVendedor(null);
            setIsModalOpen(true);
          }}
          className="shadow-lg"
          style={{ background: 'linear-gradient(135deg, #f38a4c 0%, #f5a164 100%)' }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Vendedor
        </Button>
      </div>

      <div className="space-y-6">
        {Object.entries(vendedoresPorLoja).map(([loja, vendedoresLoja]) => (
          <Card key={loja} className="border-0 shadow-lg">
            <CardHeader style={{ backgroundColor: '#f0f9ff' }}>
              <CardTitle className="flex items-center gap-2" style={{ color: '#07593f' }}>
                <MapPin className="w-5 h-5" />
                Loja {loja} ({vendedoresLoja.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {vendedoresLoja.length === 0 ? (
                <p className="text-center py-8" style={{ color: '#8B8B8B' }}>
                  Nenhum vendedor cadastrado nesta loja
                </p>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {vendedoresLoja.map((vendedor) => (
                    <div
                      key={vendedor.id}
                      className="p-4 rounded-lg border-2 hover:shadow-md transition-all"
                      style={{
                        borderColor: vendedor.ativo ? '#07593f' : '#E5E0D8',
                        backgroundColor: vendedor.ativo ? '#ffffff' : '#f9fafb'
                      }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center"
                            style={{
                              backgroundColor: vendedor.ativo ? '#07593f' : '#9ca3af',
                              color: 'white'
                            }}
                          >
                            {vendedor.nome?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold" style={{ color: '#07593f' }}>
                              {vendedor.nome}
                            </p>
                            <p className="text-xs" style={{ color: '#8B8B8B' }}>
                              {vendedor.cpf || 'CPF não informado'}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant={vendedor.ativo ? "default" : "secondary"}
                          style={vendedor.ativo ? { backgroundColor: '#D1FAE5', color: '#065F46' } : {}}
                        >
                          {vendedor.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>

                      {vendedor.telefone && (
                        <p className="text-sm mb-1" style={{ color: '#8B8B8B' }}>
                          📱 {vendedor.telefone}
                        </p>
                      )}
                      {vendedor.email && (
                        <p className="text-sm mb-3" style={{ color: '#8B8B8B' }}>
                          ✉️ {vendedor.email}
                        </p>
                      )}

                      <div className="flex gap-2 pt-3 border-t" style={{ borderColor: '#E5E0D8' }}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleAtivo(vendedor)}
                          className="flex-1"
                        >
                          {vendedor.ativo ? (
                            <>
                              <UserX className="w-4 h-4 mr-1" />
                              Desativar
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-4 h-4 mr-1" />
                              Ativar
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(vendedor)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(vendedor.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <VendedorModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingVendedor(null);
        }}
        onSave={handleSave}
        vendedor={editingVendedor}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />
    </>
  );
}