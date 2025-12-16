import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Package, Tag, Warehouse, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function BuscaProdutoAvancada({ produtos, onSelectProduto }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchRef = useRef(null);

  // Fechar resultados ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Navegação por teclado
  const handleKeyDown = (e) => {
    if (!showResults || produtosFiltrados.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, produtosFiltrados.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (produtosFiltrados[selectedIndex]) {
        handleSelectProduto(produtosFiltrados[selectedIndex]);
      }
    }
  };

  const handleSelectProduto = (produto) => {
    onSelectProduto(produto);
    setSearchTerm("");
    setShowResults(false);
    setSelectedIndex(0);
  };

  // Filtrar produtos
  const produtosFiltrados = produtos.filter(p => {
    if (!p.ativo) return false;
    
    const matchesSearch = 
      p.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.codigo_barras?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.categoria?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.material?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.cor?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  return (
    <div ref={searchRef} className="relative">
      {/* Barra de busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Buscar produto por nome, código ou categoria..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setShowResults(true);
            setSelectedIndex(0);
          }}
          onFocus={() => setShowResults(true)}
          onKeyDown={handleKeyDown}
          className="pl-10 h-11 border-2 border-green-600 focus:border-green-700 rounded-lg"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => {
              setSearchTerm("");
              setShowResults(false);
            }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        )}
      </div>

      {/* Dropdown de resultados */}
      {showResults && searchTerm && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-neutral-900 border-2 border-green-600 rounded-lg shadow-2xl max-h-64 overflow-hidden">
          {produtosFiltrados.length === 0 ? (
            <div className="p-6 text-center">
              <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-gray-500">Nenhum produto encontrado</p>
            </div>
          ) : (
            <>
              <div className="bg-gray-50 dark:bg-neutral-800 px-4 py-2 border-b border-gray-200 dark:border-neutral-700">
                <p className="text-xs text-gray-500">{produtosFiltrados.length} produto(s) encontrado(s)</p>
              </div>
              <div className="max-h-52 overflow-y-auto">
                {produtosFiltrados.slice(0, 10).map((produto, index) => {
                  const qtd = (produto.quantidade_estoque || 0) - (produto.quantidade_reservada || 0);
                  const isSelected = index === selectedIndex;
                  
                  return (
                    <button
                      key={produto.id}
                      type="button"
                      onClick={() => handleSelectProduto(produto)}
                      className={`w-full text-left px-4 py-2.5 flex items-center gap-3 border-b border-gray-100 dark:border-neutral-800 transition-colors ${
                        isSelected ? 'bg-green-50 dark:bg-green-900/30' : 'hover:bg-gray-50 dark:hover:bg-neutral-800'
                      }`}
                    >
                      <span className="flex-1 text-sm font-medium text-gray-800 dark:text-white truncate">
                        {produto.nome}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-gray-100 dark:bg-neutral-700 text-gray-600 dark:text-gray-300">
                        {produto.categoria || 'Outros'}
                      </span>
                      <span className={`text-xs font-medium ${qtd <= 0 ? 'text-red-500' : qtd <= 5 ? 'text-orange-500' : 'text-green-600'}`}>
                        {qtd}un
                      </span>
                      <span className="text-sm font-bold text-green-700 dark:text-green-400">
                        R$ {produto.preco_venda?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}