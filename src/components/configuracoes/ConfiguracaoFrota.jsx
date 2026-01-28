import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Truck, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function ConfiguracaoFrota() {
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [formData, setFormData] = useState({
    nome: "",
    placa: "",
    capacidade_volume_m3: 0,
    capacidade_peso_kg: 0,
    ativo: true,
    motorista_padrao: "",
    telefone_motorista: "",
    observacoes: ""
  });

  const queryClient = useQueryClient();

  const { data: caminhoes = [], isLoading } = useQuery({
    queryKey: ['caminhoes'],
    queryFn: () => base44.entities.Caminhao.list(),
  });

  const criarMutation = useMutation({
    mutationFn: (data) => base44.entities.Caminhao.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caminhoes'] });
      fecharModal();
    }
  });

  const atualizarMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Caminhao.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caminhoes'] });
      fecharModal();
    }
  });

  const deletarMutation = useMutation({
    mutationFn: (id) => base44.entities.Caminhao.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caminhoes'] });
    }
  });

  const abrirModal = (caminhao = null) => {
    if (caminhao) {
      setEditando(caminhao);
      setFormData(caminhao);
    } else {
      setEditando(null);
      setFormData({
        nome: "",
        placa: "",
        capacidade_volume_m3: 0,
        capacidade_peso_kg: 0,
        ativo: true,
        motorista_padrao: "",
        telefone_motorista: "",
        observacoes: ""
      });
    }
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setEditando(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editando) {
      atualizarMutation.mutate({ id: editando.id, data: formData });
    } else {
      criarMutation.mutate(formData);
    }
  };

  const handleDelete = (id) => {
    if (confirm("Tem certeza que deseja remover este caminhão?")) {
      deletarMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#07593f' }} />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Truck className="w-6 h-6" style={{ color: '#07593f' }} />
              Frota de Caminhões
            </CardTitle>
            <Button
              onClick={() => abrirModal()}
              style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Caminhão
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {caminhoes.length === 0 ? (
            <div className="text-center py-12">
              <Truck className="w-16 h-16 mx-auto mb-4 opacity-20" style={{ color: '#07593f' }} />
              <p className="text-lg font-medium mb-2" style={{ color: '#07593f' }}>
                Nenhum caminhão cadastrado
              </p>
              <p className="text-sm" style={{ color: '#8B8B8B' }}>
                Cadastre caminhões para otimizar o cálculo de rotas de entrega
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {caminhoes.map((caminhao) => (
                <Card key={caminhao.id} className="border-2" style={{ borderColor: '#E5E0D8' }}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold text-lg" style={{ color: '#07593f' }}>
                          {caminhao.nome}
                        </h3>
                        {caminhao.placa && (
                          <p className="text-sm" style={{ color: '#8B8B8B' }}>
                            Placa: {caminhao.placa}
                          </p>
                        )}
                      </div>
                      <Badge
                        style={{
                          backgroundColor: caminhao.ativo ? '#D1FAE5' : '#FEE2E2',
                          color: caminhao.ativo ? '#065f46' : '#991B1B'
                        }}
                      >
                        {caminhao.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span style={{ color: '#8B8B8B' }}>Volume:</span>
                        <span className="font-bold" style={{ color: '#07593f' }}>
                          {caminhao.capacidade_volume_m3} m³
                        </span>
                      </div>
                      {caminhao.capacidade_peso_kg > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span style={{ color: '#8B8B8B' }}>Peso:</span>
                          <span className="font-bold" style={{ color: '#07593f' }}>
                            {caminhao.capacidade_peso_kg} kg
                          </span>
                        </div>
                      )}
                      {caminhao.motorista_padrao && (
                        <div className="flex items-center justify-between text-sm">
                          <span style={{ color: '#8B8B8B' }}>Motorista:</span>
                          <span style={{ color: '#07593f' }}>
                            {caminhao.motorista_padrao}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => abrirModal(caminhao)}
                        className="flex-1"
                      >
                        <Pencil className="w-4 h-4 mr-1" />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(caminhao.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle style={{ color: '#07593f' }}>
              {editando ? "Editar Caminhão" : "Novo Caminhão"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Nome/Identificação *</Label>
                  <Input
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: Caminhão 1, HR Branco"
                    required
                  />
                </div>
                <div>
                  <Label>Placa</Label>
                  <Input
                    value={formData.placa}
                    onChange={(e) => setFormData({ ...formData, placa: e.target.value.toUpperCase() })}
                    placeholder="ABC-1234"
                    maxLength={8}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Capacidade Volumétrica (m³) *</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    value={formData.capacidade_volume_m3}
                    onChange={(e) => setFormData({ ...formData, capacidade_volume_m3: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>
                <div>
                  <Label>Capacidade de Peso (kg)</Label>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    value={formData.capacidade_peso_kg}
                    onChange={(e) => setFormData({ ...formData, capacidade_peso_kg: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Motorista Padrão</Label>
                  <Input
                    value={formData.motorista_padrao}
                    onChange={(e) => setFormData({ ...formData, motorista_padrao: e.target.value })}
                    placeholder="Nome do motorista"
                  />
                </div>
                <div>
                  <Label>Telefone do Motorista</Label>
                  <Input
                    value={formData.telefone_motorista}
                    onChange={(e) => setFormData({ ...formData, telefone_motorista: e.target.value })}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>

              <div>
                <Label>Observações</Label>
                <Textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  rows={3}
                  placeholder="Informações adicionais sobre o caminhão"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ativo"
                  checked={formData.ativo}
                  onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                  className="w-4 h-4"
                />
                <Label htmlFor="ativo" className="cursor-pointer">
                  Caminhão ativo para entregas
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={fecharModal}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={criarMutation.isPending || atualizarMutation.isPending}
                style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
              >
                {(criarMutation.isPending || atualizarMutation.isPending) ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  editando ? "Atualizar" : "Cadastrar"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}