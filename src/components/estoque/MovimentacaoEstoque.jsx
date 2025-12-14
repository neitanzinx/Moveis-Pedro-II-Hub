import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Search, ArrowUpCircle, ArrowDownCircle, Package, Loader2, ScanBarcode, Check, X } from "lucide-react";
import { toast } from "sonner";

export default function MovimentacaoEstoque({ barcodeInputRef }) {
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState("");
  const [type, setType] = useState(null); // 'entrada' | 'saida' | null
  const inputRef = useRef(null);
  const qtyRef = useRef(null);
  
  const queryClient = useQueryClient();
  const { data: produtos = [] } = useQuery({ queryKey: ['produtos'], queryFn: () => base44.entities.Produto.list(), initialData: [] });

  // Auto-focus search on mount and reset
  useEffect(() => { inputRef.current?.focus(); }, [selectedProduct]);
  
  // Auto-focus quantity when type selected
  useEffect(() => { if (type) qtyRef.current?.focus(); }, [type]);

  const handleSearch = (e) => {
    if (e.key === 'Enter' && search) {
      const exactMatch = produtos.find(p => p.codigo_barras === search);
      if (exactMatch) {
        selectProduct(exactMatch);
      } else {
        // Simple fuzzy search if needed, but for scanner exact is best. 
        // Let's try find by name if barcode fails
        const nameMatch = produtos.find(p => p.nome.toLowerCase().includes(search.toLowerCase()));
        if(nameMatch) selectProduct(nameMatch);
        else toast.error("Produto não encontrado");
      }
    }
  };

  const selectProduct = (prod) => {
    setSelectedProduct(prod);
    setSearch("");
    setType(null);
    setQuantity("");
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const qtd = parseInt(quantity);
      if (!qtd || qtd <= 0) throw new Error("Qtd inválida");
      const novaQtd = type === 'entrada' 
        ? (selectedProduct.quantidade_estoque || 0) + qtd
        : (selectedProduct.quantidade_estoque || 0) - qtd;
      
      if (type === 'saida' && novaQtd < 0) throw new Error("Estoque insuficiente");
      
      await base44.entities.Produto.update(selectedProduct.id, { quantidade_estoque: novaQtd });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      toast.success("Movimentação realizada!");
      setSelectedProduct(null); // Go back to search
    },
    onError: (err) => toast.error(err.message)
  });

  return (
    <div className="max-w-2xl mx-auto">
      {!selectedProduct ? (
        <div className="bg-white dark:bg-neutral-900 p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-neutral-800 text-center">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <ScanBarcode className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Movimentação Rápida</h2>
          <p className="text-gray-500 mb-8">Escaneie o código de barras ou digite o nome do produto</p>
          
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              ref={inputRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleSearch}
              className="pl-12 h-14 text-lg shadow-sm"
              placeholder="Código ou Nome..."
            />
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-gray-200 dark:border-neutral-800 overflow-hidden">
          <div className="p-6 border-b border-gray-100 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-900">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedProduct.nome}</h2>
                <p className="text-sm text-gray-500 font-mono mt-1">{selectedProduct.codigo_barras}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 uppercase">Estoque</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{selectedProduct.quantidade_estoque}</p>
              </div>
            </div>
          </div>

          <div className="p-8">
            {!type ? (
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setType('entrada')}
                  className="h-32 rounded-xl border-2 border-gray-100 dark:border-neutral-800 hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-700 transition-all flex flex-col items-center justify-center gap-3 group"
                >
                  <ArrowUpCircle className="w-10 h-10 text-green-500 group-hover:scale-110 transition-transform" />
                  <span className="text-lg font-bold">Entrada</span>
                </button>
                <button 
                  onClick={() => setType('saida')}
                  className="h-32 rounded-xl border-2 border-gray-100 dark:border-neutral-800 hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-700 transition-all flex flex-col items-center justify-center gap-3 group"
                >
                  <ArrowDownCircle className="w-10 h-10 text-red-500 group-hover:scale-110 transition-transform" />
                  <span className="text-lg font-bold">Saída</span>
                </button>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                <div className="text-center">
                  <Badge className={`mb-4 px-3 py-1 text-sm ${type === 'entrada' ? 'bg-green-100 text-green-800 hover:bg-green-100' : 'bg-red-100 text-red-800 hover:bg-red-100'}`}>
                    {type === 'entrada' ? 'Entrada de Estoque' : 'Saída de Estoque'}
                  </Badge>
                  <div className="flex items-center justify-center gap-4">
                    <Button variant="outline" size="icon" className="h-12 w-12 rounded-full" onClick={() => setQuantity(prev => Math.max(1, (parseInt(prev)||0)-1).toString())}>-</Button>
                    <Input 
                      ref={qtyRef}
                      type="number" 
                      className="text-center text-3xl font-bold h-16 w-32" 
                      placeholder="0"
                      value={quantity}
                      onChange={e => setQuantity(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && mutation.mutate()}
                    />
                    <Button variant="outline" size="icon" className="h-12 w-12 rounded-full" onClick={() => setQuantity(prev => ((parseInt(prev)||0)+1).toString())}>+</Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" size="lg" onClick={() => setType(null)}>Voltar</Button>
                  <Button 
                    size="lg" 
                    className={type === 'entrada' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
                    onClick={() => mutation.mutate()}
                    disabled={!quantity || mutation.isPending}
                  >
                    {mutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5 mr-2" />}
                    Confirmar
                  </Button>
                </div>
              </div>
            )}
          </div>
          
          <div className="bg-gray-50 dark:bg-neutral-900 p-4 border-t border-gray-100 dark:border-neutral-800 text-center">
            <Button variant="ghost" size="sm" onClick={() => setSelectedProduct(null)} className="text-gray-500">
              Cancelar e Buscar Outro
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}