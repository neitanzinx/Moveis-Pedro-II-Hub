import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Clock, Truck, Save, Sun, Sunset } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { format, addDays } from "date-fns";

export default function AgendarEntregaModal({ isOpen, onClose, entrega, entregasSelecionadas = [] }) {
  const [formData, setFormData] = useState({
    data_agendada: "",
    turno: "Manhã",
    caminhao_id: "",
    responsavel: "",
    observacoes: ""
  });
  
  const queryClient = useQueryClient();
  const isMultiple = entregasSelecionadas.length > 0;
  const totalEntregas = isMultiple ? entregasSelecionadas.length : 1;

  const { data: caminhoes = [] } = useQuery({
    queryKey: ['caminhoes'],
    queryFn: () => base44.entities.Caminhao.list()
  });

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      if (isMultiple) {
        // Atualizar múltiplas entregas
        for (const ent of entregasSelecionadas) {
          await base44.entities.Entrega.update(ent.id, data);
        }
      } else {
        await base44.entities.Entrega.update(entrega.id, data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entregas'] });
      onClose();
    }
  });

  useEffect(() => {
    if (entrega && !isMultiple) {
      setFormData({
        data_agendada: entrega.data_agendada || "",
        turno: entrega.turno || "Manhã",
        caminhao_id: entrega.caminhao_id || "",
        responsavel: entrega.responsavel || "",
        observacoes: entrega.observacoes || ""
      });
    } else {
      // Reset para múltiplas entregas
      setFormData({
        data_agendada: "",
        turno: "Manhã",
        caminhao_id: "",
        responsavel: "",
        observacoes: ""
      });
    }
  }, [entrega, isMultiple, entregasSelecionadas]);

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  // Sugestões de datas rápidas
  const hoje = new Date();
  const sugestoes = [
    { label: "Amanhã", date: format(addDays(hoje, 1), 'yyyy-MM-dd') },
    { label: "2 dias", date: format(addDays(hoje, 2), 'yyyy-MM-dd') },
    { label: "3 dias", date: format(addDays(hoje, 3), 'yyyy-MM-dd') },
    { label: "1 semana", date: format(addDays(hoje, 7), 'yyyy-MM-dd') }
  ];

  const caminhoesAtivos = caminhoes.filter(c => c.ativo);

  if (!entrega && !isMultiple) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            {isMultiple 
              ? `Agendar ${totalEntregas} Entregas` 
              : `Agendar Entrega #${entrega?.numero_pedido}`
            }
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Info do Cliente (só para uma entrega) */}
          {!isMultiple && entrega && (
            <div className="bg-gray-50 dark:bg-neutral-800 p-3 rounded-lg text-sm">
              <p className="font-semibold text-gray-900 dark:text-white">{entrega.cliente_nome}</p>
              <p className="text-gray-500 text-xs mt-1">{entrega.endereco_entrega || 'Sem endereço'}</p>
              {entrega.data_limite && (
                <p className="text-orange-600 text-xs mt-1">
                  Limite: {format(new Date(entrega.data_limite + 'T12:00:00'), 'dd/MM/yyyy')}
                </p>
              )}
            </div>
          )}

          {/* Info múltiplas entregas */}
          {isMultiple && (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-sm border border-blue-200 dark:border-blue-800">
              <p className="font-semibold text-blue-800 dark:text-blue-300">
                📦 {totalEntregas} pedidos selecionados
              </p>
              <p className="text-blue-600 dark:text-blue-400 text-xs mt-1">
                Todos serão agendados com as mesmas configurações
              </p>
            </div>
          )}

          {/* Sugestões Rápidas de Data */}
          <div>
            <Label className="text-xs text-gray-500 mb-2 block">Data rápida</Label>
            <div className="flex flex-wrap gap-2">
              {sugestoes.map(s => (
                <Button
                  key={s.label}
                  type="button"
                  size="sm"
                  variant={formData.data_agendada === s.date ? "default" : "outline"}
                  onClick={() => setFormData({ ...formData, data_agendada: s.date })}
                  className={`text-xs ${formData.data_agendada === s.date ? 'bg-blue-600 text-white' : ''}`}
                >
                  {s.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Data Manual */}
          <div>
            <Label className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4" />
              Data da Entrega
            </Label>
            <Input
              type="date"
              value={formData.data_agendada}
              onChange={e => setFormData({ ...formData, data_agendada: e.target.value })}
              min={format(hoje, 'yyyy-MM-dd')}
            />
          </div>

          {/* Turno - Botões lado a lado */}
          <div>
            <Label className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4" />
              Turno
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant={formData.turno === "Manhã" ? "default" : "outline"}
                onClick={() => setFormData({ ...formData, turno: "Manhã" })}
                className={`h-14 flex flex-col items-center justify-center gap-1 ${
                  formData.turno === "Manhã" 
                    ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500' 
                    : 'hover:border-amber-400 hover:text-amber-600'
                }`}
              >
                <Sun className="w-5 h-5" />
                <span className="text-sm font-medium">Manhã</span>
                <span className="text-xs opacity-70">8h - 12h</span>
              </Button>
              <Button
                type="button"
                variant={formData.turno === "Tarde" ? "default" : "outline"}
                onClick={() => setFormData({ ...formData, turno: "Tarde" })}
                className={`h-14 flex flex-col items-center justify-center gap-1 ${
                  formData.turno === "Tarde" 
                    ? 'bg-orange-600 hover:bg-orange-700 text-white border-orange-600' 
                    : 'hover:border-orange-400 hover:text-orange-600'
                }`}
              >
                <Sunset className="w-5 h-5" />
                <span className="text-sm font-medium">Tarde</span>
                <span className="text-xs opacity-70">13h - 18h</span>
              </Button>
            </div>
          </div>

          {/* Caminhão - Botões lado a lado */}
          <div>
            <Label className="flex items-center gap-2 mb-2">
              <Truck className="w-4 h-4" />
              Caminhão
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {caminhoesAtivos.map(c => (
                <Button
                  key={c.id}
                  type="button"
                  variant={formData.caminhao_id === c.id ? "default" : "outline"}
                  onClick={() => setFormData({ ...formData, caminhao_id: c.id })}
                  className={`h-14 flex flex-col items-center justify-center gap-1 ${
                    formData.caminhao_id === c.id 
                      ? 'bg-green-700 hover:bg-green-800 text-white border-green-700' 
                      : 'hover:border-green-500 hover:text-green-700'
                  }`}
                >
                  <Truck className="w-5 h-5" />
                  <span className="text-sm font-bold">{c.nome}</span>
                  {c.placa && <span className="text-xs opacity-70">{c.placa}</span>}
                </Button>
              ))}
              {caminhoesAtivos.length === 0 && (
                <p className="col-span-2 text-center text-gray-400 text-sm py-4">
                  Nenhum caminhão cadastrado
                </p>
              )}
            </div>
          </div>

          {/* Responsável */}
          <div>
            <Label className="mb-2 block">Responsável (opcional)</Label>
            <Input
              value={formData.responsavel}
              onChange={e => setFormData({ ...formData, responsavel: e.target.value })}
              placeholder="Nome do entregador"
            />
          </div>

          {/* Observações */}
          <div>
            <Label className="mb-2 block">Observações</Label>
            <Textarea
              value={formData.observacoes}
              onChange={e => setFormData({ ...formData, observacoes: e.target.value })}
              placeholder="Instruções especiais..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button 
            onClick={handleSave} 
            disabled={!formData.data_agendada || updateMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Save className="w-4 h-4 mr-2" />
            {updateMutation.isPending ? 'Salvando...' : `Agendar ${isMultiple ? totalEntregas + ' Entregas' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}