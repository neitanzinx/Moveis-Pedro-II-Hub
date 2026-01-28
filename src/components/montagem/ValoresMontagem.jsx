import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Upload, Trash2, Edit } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function ValoresMontagem({ valores }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingValor, setEditingValor] = useState(null);
  const [importing, setImporting] = useState(false);
  const [formData, setFormData] = useState({
    modelo_movel: "",
    valor_montagem: "",
    valor_montagem_externa: ""
  });

  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ValorMontagem.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['valores-montagem'] });
      setIsModalOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ValorMontagem.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['valores-montagem'] });
      setIsModalOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ValorMontagem.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['valores-montagem'] });
    },
  });

  const resetForm = () => {
    setFormData({
      modelo_movel: "",
      valor_montagem: "",
      valor_montagem_externa: ""
    });
    setEditingValor(null);
  };

  const handleEdit = (valor) => {
    setEditingValor(valor);
    setFormData({
      modelo_movel: valor.modelo_movel,
      valor_montagem: valor.valor_montagem.toString(),
      valor_montagem_externa: valor.valor_montagem_externa.toString()
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const dataToSave = {
      modelo_movel: formData.modelo_movel,
      valor_montagem: parseFloat(formData.valor_montagem),
      valor_montagem_externa: parseFloat(formData.valor_montagem_externa),
      ativo: true
    };

    if (editingValor) {
      updateMutation.mutate({ id: editingValor.id, data: dataToSave });
    } else {
      createMutation.mutate(dataToSave);
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      // Pular cabeçalho
      const dataLines = lines.slice(1);
      
      const items = [];
      for (const line of dataLines) {
        const [modelo, valor, valorExterno] = line.split('\t');
        if (modelo && valor && valorExterno) {
          items.push({
            modelo_movel: modelo.trim(),
            valor_montagem: parseFloat(valor.replace(',', '.').replace('R$', '').trim()),
            valor_montagem_externa: parseFloat(valorExterno.replace(',', '.').replace('R$', '').trim()),
            ativo: true
          });
        }
      }

      // Criar em lote
      for (const item of items) {
        await createMutation.mutateAsync(item);
      }

      alert(`${items.length} itens importados com sucesso!`);
    } catch (error) {
      console.error('Erro ao importar:', error);
      alert('Erro ao importar arquivo. Verifique o formato.');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Tabela de Valores de Montagem</CardTitle>
            <div className="flex gap-2">
              <label>
                <input
                  type="file"
                  accept=".csv,.txt,.tsv"
                  onChange={handleImport}
                  disabled={importing}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={importing}
                  onClick={() => document.querySelector('input[type="file"]').click()}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {importing ? 'Importando...' : 'Importar CSV'}
                </Button>
              </label>
              <Button
                onClick={() => {
                  resetForm();
                  setIsModalOpen(true);
                }}
                style={{ background: 'linear-gradient(135deg, #f38a4c 0%, #f5a164 100%)' }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Novo Valor
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {valores.length > 0 ? (
            <div className="rounded-lg border" style={{ borderColor: '#E5E0D8' }}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Modelo do Móvel</TableHead>
                    <TableHead className="text-right">Valor Montagem (R$)</TableHead>
                    <TableHead className="text-right">Valor Externa +10% (R$)</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {valores.map((valor) => (
                    <TableRow key={valor.id}>
                      <TableCell className="font-medium">{valor.modelo_movel}</TableCell>
                      <TableCell className="text-right">
                        R$ {valor.valor_montagem?.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        R$ {valor.valor_montagem_externa?.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(valor)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              if (confirm('Tem certeza que deseja excluir?')) {
                                deleteMutation.mutate(valor.id);
                              }
                            }}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12" style={{ color: '#8B8B8B' }}>
              <p className="text-xl mb-2">Nenhum valor cadastrado</p>
              <p className="text-sm">Adicione valores manualmente ou importe um arquivo CSV</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingValor ? 'Editar Valor' : 'Novo Valor de Montagem'}
            </DialogTitle>
            <DialogDescription>
              Configure os valores para montagem deste móvel
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="modelo">Modelo do Móvel *</Label>
                <Input
                  id="modelo"
                  value={formData.modelo_movel}
                  onChange={(e) => setFormData({ ...formData, modelo_movel: e.target.value })}
                  placeholder="Ex: Sofá 3 Lugares, Cama Box Queen..."
                  required
                />
              </div>

              <div>
                <Label htmlFor="valor">Valor Montagem (R$) *</Label>
                <Input
                  id="valor"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.valor_montagem}
                  onChange={(e) => setFormData({ ...formData, valor_montagem: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <Label htmlFor="valor_externo">Valor Montagem Externa +10% (R$) *</Label>
                <Input
                  id="valor_externo"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.valor_montagem_externa}
                  onChange={(e) => setFormData({ ...formData, valor_montagem_externa: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setIsModalOpen(false);
                resetForm();
              }}>
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
    </div>
  );
}