import React, { useState, useEffect } from "react";
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
import { Loader2 } from "lucide-react";

const lojas = ["Centro", "Carangola", "Ponte Branca"];

export default function TransferenciaModal({ isOpen, onClose, onSave, transferencia, produtos, isLoading }) {
  const [formData, setFormData] = useState({
    numero_transferencia: "",
    produto_id: "",
    produto_nome: "",
    loja_origem: "",
    loja_destino: "",
    quantidade: 0,
    data_solicitacao: new Date().toISOString().split('T')[0],
    status: "Solicitada",
    motivo: "",
    observacoes: "",
  });

  useEffect(() => {
    if (transferencia) {
      setFormData(transferencia);
    } else {
      const numeroTransf = `TRANSF-${Date.now()}`;
      setFormData({
        numero_transferencia: numeroTransf,
        produto_id: "",
        produto_nome: "",
        loja_origem: "",
        loja_destino: "",
        quantidade: 0,
        data_solicitacao: new Date().toISOString().split('T')[0],
        status: "Solicitada",
        motivo: "",
        observacoes: "",
      });
    }
  }, [transferencia, isOpen]);

  const handleProdutoChange = (produtoId) => {
    const produto = produtos.find(p => p.id === produtoId);
    setFormData({
      ...formData,
      produto_id: produtoId,
      produto_nome: produto?.nome || ""
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.produto_id || !formData.loja_origem || !formData.loja_destino || formData.quantidade <= 0) {
      alert("Preencha todos os campos obrigatórios");
      return;
    }

    if (formData.loja_origem === formData.loja_destino) {
      alert("As lojas de origem e destino devem ser diferentes");
      return;
    }

    onSave(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle style={{ color: '#07593f' }}>
            {transferencia ? "Editar Transferência" : "Nova Transferência"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="numero_transferencia">Número da Transferência</Label>
              <Input
                id="numero_transferencia"
                value={formData.numero_transferencia}
                disabled
              />
            </div>

            <div>
              <Label htmlFor="produto">Produto *</Label>
              <Select
                value={formData.produto_id}
                onValueChange={handleProdutoChange}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um produto" />
                </SelectTrigger>
                <SelectContent>
                  {produtos.map(produto => (
                    <SelectItem key={produto.id} value={produto.id}>
                      {produto.nome} (Estoque: {produto.quantidade_estoque})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="loja_origem">Loja Origem *</Label>
                <Select
                  value={formData.loja_origem}
                  onValueChange={(value) => setFormData({ ...formData, loja_origem: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Origem" />
                  </SelectTrigger>
                  <SelectContent>
                    {lojas.map(loja => (
                      <SelectItem key={loja} value={loja}>{loja}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="loja_destino">Loja Destino *</Label>
                <Select
                  value={formData.loja_destino}
                  onValueChange={(value) => setFormData({ ...formData, loja_destino: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {lojas.map(loja => (
                      <SelectItem key={loja} value={loja}>{loja}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="quantidade">Quantidade *</Label>
                <Input
                  id="quantidade"
                  type="number"
                  min="1"
                  value={formData.quantidade}
                  onChange={(e) => setFormData({ ...formData, quantidade: parseInt(e.target.value) || 0 })}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="motivo">Motivo</Label>
              <Input
                id="motivo"
                value={formData.motivo}
                onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
                placeholder="Ex: Reposição de estoque, alta demanda..."
              />
            </div>

            <div>
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading}
              style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                transferencia ? "Atualizar" : "Criar Transferência"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}