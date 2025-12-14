import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function MontagemModal({ isOpen, onClose, montagem, vendas, valores }) {
  const [formData, setFormData] = useState({
    venda_id: "",
    data_montagem: "",
    horario_montagem: "09:00",
    montador: "Carlos",
    status: "Agendada",
    observacoes: "",
    itens: []
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    if (montagem) {
      setFormData(montagem);
    } else {
      setFormData({
        venda_id: "",
        data_montagem: "",
        horario_montagem: "09:00",
        montador: "Carlos",
        status: "Agendada",
        observacoes: "",
        itens: []
      });
    }
  }, [montagem, isOpen]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Montagem.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['montagens'] });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Montagem.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['montagens'] });
      onClose();
    },
  });

  const handleVendaChange = (vendaId) => {
    const venda = vendas.find(v => v.id === vendaId);
    if (venda) {
      const itensComValores = (venda.itens || []).map(item => {
        const valorRef = valores.find(v => 
          v.modelo_movel.toLowerCase().includes(item.produto_nome.toLowerCase())
        );
        
        return {
          produto_nome: item.produto_nome,
          quantidade: item.quantidade,
          valor_montagem: valorRef?.valor_montagem || 0,
          montagem_externa: false
        };
      });

      setFormData({
        ...formData,
        venda_id: vendaId,
        numero_pedido: venda.numero_pedido,
        cliente_nome: venda.cliente_nome,
        cliente_telefone: venda.cliente_telefone,
        endereco_montagem: venda.endereco_montagem || "",
        itens: itensComValores
      });
    }
  };

  const handleItemChange = (index, field, value) => {
    const newItens = [...formData.itens];
    newItens[index] = { ...newItens[index], [field]: value };
    
    // Se mudou montagem_externa, atualizar valor
    if (field === 'montagem_externa') {
      const valorRef = valores.find(v => 
        v.modelo_movel.toLowerCase().includes(newItens[index].produto_nome.toLowerCase())
      );
      
      newItens[index].valor_montagem = value 
        ? (valorRef?.valor_montagem_externa || 0)
        : (valorRef?.valor_montagem || 0);
    }
    
    setFormData({ ...formData, itens: newItens });
  };

  const calcularTotal = () => {
    return formData.itens.reduce((sum, item) => 
      sum + (item.valor_montagem * item.quantidade), 0
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const dataToSave = {
      ...formData,
      valor_total_montagem: calcularTotal()
    };

    if (montagem) {
      updateMutation.mutate({ id: montagem.id, data: dataToSave });
    } else {
      createMutation.mutate(dataToSave);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {montagem ? 'Editar Montagem' : 'Nova Montagem'}
          </DialogTitle>
          <DialogDescription>
            Configure o agendamento da montagem com o montador
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="venda">Venda/Pedido *</Label>
                <Select
                  value={formData.venda_id}
                  onValueChange={handleVendaChange}
                  required
                  disabled={!!montagem}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um pedido" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendas.map(venda => (
                      <SelectItem key={venda.id} value={venda.id}>
                        #{venda.numero_pedido} - {venda.cliente_nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="montador">Montador *</Label>
                <Select
                  value={formData.montador}
                  onValueChange={(value) => setFormData({ ...formData, montador: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Carlos">Carlos</SelectItem>
                    <SelectItem value="Luis">Luis</SelectItem>
                    <SelectItem value="Guilherme">Guilherme</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="data">Data *</Label>
                <Input
                  id="data"
                  type="date"
                  value={formData.data_montagem}
                  onChange={(e) => setFormData({ ...formData, data_montagem: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="horario">Horário *</Label>
                <Select
                  value={formData.horario_montagem}
                  onValueChange={(value) => setFormData({ ...formData, horario_montagem: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="08:00">08:00</SelectItem>
                    <SelectItem value="09:00">09:00</SelectItem>
                    <SelectItem value="10:00">10:00</SelectItem>
                    <SelectItem value="11:00">11:00</SelectItem>
                    <SelectItem value="13:00">13:00</SelectItem>
                    <SelectItem value="14:00">14:00</SelectItem>
                    <SelectItem value="15:00">15:00</SelectItem>
                    <SelectItem value="16:00">16:00</SelectItem>
                    <SelectItem value="17:00">17:00</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="status">Status *</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pendente">Pendente</SelectItem>
                    <SelectItem value="Agendada">Agendada</SelectItem>
                    <SelectItem value="Concluída">Concluída</SelectItem>
                    <SelectItem value="Cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.itens.length > 0 && (
              <div className="border rounded-lg p-4" style={{ borderColor: '#E5E0D8' }}>
                <Label className="text-base mb-3 block">Itens para Montagem</Label>
                <div className="space-y-3">
                  {formData.itens.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: '#FAF8F5' }}>
                      <div className="flex-1">
                        <p className="font-semibold" style={{ color: '#07593f' }}>
                          {item.quantidade}x {item.produto_nome}
                        </p>
                        <p className="text-sm" style={{ color: '#8B8B8B' }}>
                          R$ {item.valor_montagem?.toFixed(2)} por unidade
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`externa-${idx}`}
                          checked={item.montagem_externa || false}
                          onCheckedChange={(checked) => handleItemChange(idx, 'montagem_externa', checked)}
                        />
                        <Label htmlFor={`externa-${idx}`} className="cursor-pointer text-sm">
                          Externa (+10%)
                        </Label>
                      </div>
                    </div>
                  ))}
                  <div className="text-right pt-2 border-t" style={{ borderColor: '#E5E0D8' }}>
                    <p className="text-lg font-bold" style={{ color: '#07593f' }}>
                      Total: R$ {calcularTotal().toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                rows={3}
                placeholder="Informações adicionais sobre a montagem..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
            >
              {(createMutation.isPending || updateMutation.isPending) ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}