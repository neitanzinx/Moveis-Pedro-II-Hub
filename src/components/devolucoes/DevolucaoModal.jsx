
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function DevolucaoModal({ isOpen, onClose, onSave, devolucao, vendas, produtos, isLoading }) {
  const [formData, setFormData] = useState({
    venda_id: "",
    numero_pedido: "",
    cliente_nome: "",
    data_devolucao: new Date().toISOString().split('T')[0],
    tipo: "Devolução",
    itens_devolvidos: [],
    itens_troca: [],
    valor_devolvido: 0,
    valor_diferenca: 0,
    status: "Pendente",
    observacoes: "",
  });

  const [vendaSelecionada, setVendaSelecionada] = useState(null);
  const [canApprove, setCanApprove] = useState(false);

  useEffect(() => {
    const checkPermissions = async () => {
      const currentUser = await base44.auth.me();
      const isAdminOrManager = currentUser?.role === 'Administrador' || currentUser?.role === 'Gerente';
      setCanApprove(isAdminOrManager);
    };
    checkPermissions();
  }, []);

  useEffect(() => {
    if (devolucao) {
      setFormData(devolucao);
      const venda = vendas.find(v => v.id === devolucao.venda_id);
      setVendaSelecionada(venda);
    } else {
      setFormData({
        venda_id: "",
        numero_pedido: "",
        cliente_nome: "",
        data_devolucao: new Date().toISOString().split('T')[0],
        tipo: "Devolução",
        itens_devolvidos: [],
        itens_troca: [],
        valor_devolvido: 0,
        valor_diferenca: 0,
        status: "Pendente",
        observacoes: "",
      });
      setVendaSelecionada(null);
    }
  }, [devolucao, vendas, isOpen]);

  const handleVendaChange = (vendaId) => {
    const venda = vendas.find(v => v.id === vendaId);
    if (!venda) return;

    setVendaSelecionada(venda);
    setFormData({
      ...formData,
      venda_id: vendaId,
      numero_pedido: venda.numero_pedido,
      cliente_nome: venda.cliente_nome,
      itens_devolvidos: [],
      itens_troca: []
    });
  };

  const adicionarItemDevolucao = (item) => {
    const jaAdicionado = formData.itens_devolvidos.find(i => i.produto_id === item.produto_id);
    if (jaAdicionado) return;

    setFormData({
      ...formData,
      itens_devolvidos: [...formData.itens_devolvidos, {
        produto_id: item.produto_id,
        produto_nome: item.produto_nome,
        quantidade: item.quantidade,
        motivo: ""
      }]
    });
  };

  const removerItemDevolucao = (index) => {
    setFormData({
      ...formData,
      itens_devolvidos: formData.itens_devolvidos.filter((_, i) => i !== index)
    });
  };

  const atualizarEstoque = async () => {
    // Devolver itens ao estoque
    for (const item of formData.itens_devolvidos) {
      const produto = produtos.find(p => p.id === item.produto_id);
      if (produto) {
        await base44.entities.Produto.update(produto.id, {
          ...produto,
          quantidade_estoque: produto.quantidade_estoque + item.quantidade,
          quantidade_reservada: Math.max(0, (produto.quantidade_reservada || 0) - item.quantidade)
        });
      }
    }

    // Se for troca, descontar novos itens do estoque
    if (formData.tipo === 'Troca' && formData.itens_troca.length > 0) {
      for (const item of formData.itens_troca) {
        const produto = produtos.find(p => p.id === item.produto_id);
        if (produto) {
          await base44.entities.Produto.update(produto.id, {
            ...produto,
            quantidade_estoque: produto.quantidade_estoque - item.quantidade
          });
        }
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.venda_id || formData.itens_devolvidos.length === 0) {
      alert("Selecione uma venda e adicione pelo menos um item");
      return;
    }

    if (formData.status === 'Processada') {
      await atualizarEstoque();
    }

    onSave(formData);
  };

  const handleApprove = async () => {
    const currentUser = await base44.auth.me();
    const updatedData = {
      ...formData,
      status: 'Aprovada',
      aprovado_por: currentUser.email,
      data_aprovacao: new Date().toISOString()
    };
    onSave(updatedData);
  };

  const handleReject = () => {
    const updatedData = {
      ...formData,
      status: 'Rejeitada'
    };
    onSave(updatedData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={{ color: '#07593f' }}>
            {devolucao ? "Detalhes da Devolução/Troca" : "Nova Devolução/Troca"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="venda">Selecionar Venda *</Label>
                <Select
                  value={formData.venda_id}
                  onValueChange={handleVendaChange}
                  required
                  disabled={devolucao && devolucao.status !== 'Pendente'}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma venda" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendas
                      .filter(v => v.status !== 'Cancelado')
                      .map(venda => (
                        <SelectItem key={venda.id} value={venda.id}>
                          #{venda.numero_pedido} - {venda.cliente_nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="tipo">Tipo *</Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(value) => setFormData({ ...formData, tipo: value })}
                  required
                  disabled={devolucao && devolucao.status !== 'Pendente'}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Devolução">Devolução</SelectItem>
                    <SelectItem value="Troca">Troca</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {vendaSelecionada && (
              <>
                <Alert>
                  <AlertDescription>
                    <strong>Cliente:</strong> {vendaSelecionada.cliente_nome} •
                    <strong className="ml-2">Total da Venda:</strong> R$ {vendaSelecionada.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </AlertDescription>
                </Alert>

                <div className="border rounded-lg p-4" style={{ borderColor: '#E5E0D8' }}>
                  <h4 className="font-semibold mb-3" style={{ color: '#07593f' }}>
                    Selecionar Itens para {formData.tipo}
                  </h4>
                  <div className="space-y-2">
                    {vendaSelecionada.itens?.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <div>
                          <p className="font-medium">{item.produto_nome}</p>
                          <p className="text-sm" style={{ color: '#8B8B8B' }}>
                            Quantidade: {item.quantidade}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => adicionarItemDevolucao(item)}
                          disabled={(devolucao && devolucao.status !== 'Pendente') || formData.itens_devolvidos.some(i => i.produto_id === item.produto_id)}
                          style={{ backgroundColor: '#f38a4c' }}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Adicionar
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {formData.itens_devolvidos.length > 0 && (
                  <div className="border rounded-lg p-4" style={{ borderColor: '#07593f' }}>
                    <h4 className="font-semibold mb-3" style={{ color: '#07593f' }}>
                      Itens Selecionados
                    </h4>
                    <div className="space-y-3">
                      {formData.itens_devolvidos.map((item, index) => (
                        <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded">
                          <div className="flex-1">
                            <p className="font-medium">{item.produto_nome}</p>
                            <Input
                              placeholder="Motivo da devolução/troca"
                              value={item.motivo}
                              onChange={(e) => {
                                const novosItens = [...formData.itens_devolvidos];
                                novosItens[index].motivo = e.target.value;
                                setFormData({ ...formData, itens_devolvidos: novosItens });
                              }}
                              className="mt-2"
                              disabled={devolucao && devolucao.status !== 'Pendente'}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removerItemDevolucao(index)}
                            className="text-red-600"
                            disabled={devolucao && devolucao.status !== 'Pendente'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="data_devolucao">Data *</Label>
                <Input
                  id="data_devolucao"
                  type="date"
                  value={formData.data_devolucao}
                  onChange={(e) => setFormData({ ...formData, data_devolucao: e.target.value })}
                  required
                  disabled={devolucao && devolucao.status !== 'Pendente'}
                />
              </div>
              <div>
                <Label htmlFor="status">Status *</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                  disabled={devolucao && !canApprove} // Only allow status change if new or if user can approve
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pendente">Pendente</SelectItem>
                    <SelectItem value="Aprovada">Aprovada</SelectItem>
                    <SelectItem value="Processada">Processada</SelectItem>
                    <SelectItem value="Rejeitada">Rejeitada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                rows={3}
                disabled={devolucao && devolucao.status !== 'Pendente'}
              />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            
            {devolucao && canApprove && devolucao.status === 'Pendente' && (
              <>
                <Button 
                  type="button"
                  onClick={handleReject}
                  variant="destructive"
                  disabled={isLoading}
                >
                  Rejeitar
                </Button>
                <Button 
                  type="button"
                  onClick={handleApprove}
                  disabled={isLoading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Aprovar
                </Button>
              </>
            )}
            
            {(!devolucao || devolucao.status === 'Pendente') && (
              <Button 
                type="submit" 
                disabled={isLoading || !formData.venda_id || formData.itens_devolvidos.length === 0}
                style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  devolucao ? "Atualizar" : "Criar Devolução"
                )}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
