import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpCircle, ArrowDownCircle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function MovimentacaoModal({ isOpen, onClose, produto }) {
  const [quantidade, setQuantidade] = useState("");
  const [tipo, setTipo] = useState("entrada");
  const [fornecedorId, setFornecedorId] = useState("");
  const inputRef = useRef(null);
  const queryClient = useQueryClient();

  // Reset state when modal opens/product changes
  useEffect(() => {
    if (isOpen) {
      setQuantidade("");
      setTipo("entrada");
      setFornecedorId(produto?.fornecedor_id || "");
      // Focus quantity input after a short delay to allow modal animation
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, produto]);

  const { data: fornecedores = [] } = useQuery({ 
    queryKey: ['fornecedores'], 
    queryFn: () => base44.entities.Fornecedor.list('nome'), 
    enabled: isOpen 
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const qtd = parseInt(quantidade);
      if (!qtd || qtd <= 0) throw new Error("Quantidade inválida");
      
      const novaQtd = tipo === 'entrada' 
        ? (produto.quantidade_estoque || 0) + qtd
        : (produto.quantidade_estoque || 0) - qtd;

      if (tipo === 'saida' && novaQtd < 0) throw new Error("Estoque insuficiente");

      const updates = { quantidade_estoque: novaQtd };
      if (tipo === 'entrada' && fornecedorId) {
        const forn = fornecedores.find(f => f.id === fornecedorId);
        updates.fornecedor_id = fornecedorId;
        updates.fornecedor_nome = forn?.nome;
      }

      await base44.entities.Produto.update(produto.id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      toast.success("Estoque atualizado!");
      onClose();
    },
    onError: (err) => toast.error(err.message)
  });

  if (!produto) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Movimentar Estoque: {produto.nome}</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-6 py-4">
          {/* Tabs Tipo */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 dark:bg-neutral-800 rounded-lg">
            <button
              onClick={() => setTipo('entrada')}
              className={`flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
                tipo === 'entrada' 
                  ? 'bg-white dark:bg-neutral-700 text-green-600 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <ArrowUpCircle className="w-4 h-4" /> Entrada
            </button>
            <button
              onClick={() => setTipo('saida')}
              className={`flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
                tipo === 'saida' 
                  ? 'bg-white dark:bg-neutral-700 text-red-600 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <ArrowDownCircle className="w-4 h-4" /> Saída
            </button>
          </div>

          {/* Inputs */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-neutral-800 p-3 rounded-lg text-center border border-gray-100 dark:border-neutral-700">
                <p className="text-xs text-gray-500 uppercase">Atual</p>
                <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">{produto.quantidade_estoque}</p>
              </div>
              <div className={`p-3 rounded-lg text-center border ${
                tipo === 'entrada' 
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-900' 
                  : 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900'
              }`}>
                <p className={`text-xs uppercase ${tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                  Final
                </p>
                <p className={`text-2xl font-bold ${tipo === 'entrada' ? 'text-green-700' : 'text-red-700'}`}>
                  {quantidade ? (
                    tipo === 'entrada' 
                      ? (produto.quantidade_estoque || 0) + parseInt(quantidade)
                      : (produto.quantidade_estoque || 0) - parseInt(quantidade)
                  ) : '-'}
                </p>
              </div>
            </div>

            <div>
              <Label>Quantidade</Label>
              <Input 
                ref={inputRef}
                type="number" 
                className="text-lg h-12" 
                placeholder="0"
                value={quantidade}
                onChange={e => setQuantidade(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && mutation.mutate()}
              />
            </div>

            {tipo === 'entrada' && (
              <div>
                <Label>Fornecedor (Opcional)</Label>
                <Select value={fornecedorId} onValueChange={setFornecedorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {fornecedores.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <Button 
            className={`w-full h-12 text-lg ${
              tipo === 'entrada' 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-red-600 hover:bg-red-700'
            }`}
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !quantidade}
          >
            {mutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
            Confirmar {tipo === 'entrada' ? 'Entrada' : 'Saída'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}