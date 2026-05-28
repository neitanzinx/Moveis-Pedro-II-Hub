import React, { useState, useEffect, useRef } from "react";
import { normSearch } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Package, Tag, Warehouse, Filter, Palette, ImageIcon, Edit2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import ProdutoCadastroCompleto from "@/components/produtos/ProdutoCadastroCompleto";

export default function BuscaProdutoAvancada(props) {
  const { produtos, onSelectProduto, onEditProduto, fornecedores = [] } = props;
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSavingProduto, setIsSavingProduto] = useState(false);
  const searchRef = useRef(null);

  const hasMeaningfulValue = (value) => {
    if (value === null || value === undefined) return false;
    const normalized = String(value).trim().toLowerCase();
    return normalized !== '' && !['n/a', 'na', '-', 'null', 'undefined', '?'].includes(normalized);
  };

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
    // Produto entra no carrinho sempre sem encomenda pré-confirmada.
    // Se o estoque estiver zerado, o carrinho exibirá o botão "Encomenda deste item"
    // que o vendedor deve clicar explicitamente para confirmar.
    onSelectProduto({ ...produto, is_encomenda: false });
    setSearchTerm("");
    setShowResults(false);
    setSelectedIndex(0);
  };

  // Filtrar e pontuar produtos
  const searchTokens = normSearch(searchTerm).split(/\s+/).filter(t => t.length > 0);
  const scoredProdutos = searchTokens.length === 0 ? [] : produtos
    .filter(p => p.ativo)
    .map(p => {
      const camposBusca = [p.nome, p.codigo_barras, p.categoria, p.material, p.cor, p.fornecedor_nome, p.modelo_referencia]
        .filter(Boolean).map(normSearch).join(' ');
      const matches = searchTokens.filter(token => camposBusca.includes(token)).length;
      return { produto: p, score: matches };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  const exactMatches = scoredProdutos.filter(({ score }) => score === searchTokens.length);
  const isFuzzy = exactMatches.length === 0 && scoredProdutos.length > 0;
  const produtosFiltrados = (isFuzzy ? scoredProdutos : exactMatches).map(s => s.produto);

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
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-neutral-900 border-2 border-green-600 rounded-lg shadow-2xl overflow-hidden">
          {produtosFiltrados.length === 0 ? (
            <div className="p-6 text-center">
              <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-gray-500 mb-4">Nenhum produto encontrado</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsModalOpen(true);
                }}
                className="w-full border-green-200 text-green-700 hover:bg-green-50"
              >
                <Plus className="w-4 h-4 mr-2" /> Cadastrar item
              </Button>
            </div>
          ) : (
            <>
              <div className="bg-gray-50 dark:bg-neutral-800 px-4 py-2 border-b border-gray-200 dark:border-neutral-700 flex items-center gap-2">
                <p className="text-xs text-gray-500">{produtosFiltrados.length} produto(s) encontrado(s)</p>
                {isFuzzy && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">resultado mais próximo</span>
                )}
              </div>
              <div className="max-h-52 overflow-y-auto">
                {produtosFiltrados.slice(0, 10).map((produto, index) => {
                  const qtd = (produto.quantidade_estoque || 0) - (produto.quantidade_reservada || 0);
                  const isSelected = index === selectedIndex;
                  const tipoEstoque = produto.tipo_estoque || 'herdado';
                  const semEstoque = qtd <= 0;
                  const bloqueado = tipoEstoque === 'pronta_entrega' && semEstoque;

                  return (
                    <div
                      key={produto.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelectProduto(produto)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSelectProduto(produto);
                        }
                      }}
                      className={`w-full text-left px-4 py-2.5 flex flex-col gap-1 border-b border-gray-100 dark:border-neutral-800 transition-colors ${isSelected ? 'bg-green-50 dark:bg-green-900/30' : 'hover:bg-gray-50 dark:hover:bg-neutral-800'
                        }`}
                    >
                      {/* Linha principal: Imagem + Nome + Modelo + Preço */}
                      <div className="flex items-center justify-between w-full gap-3">
                        {/* Imagem do Produto Produto (Cascata) */}
                        <div className="w-10 h-10 shrink-0 border rounded overflow-hidden bg-gray-50 flex items-center justify-center">
                          {produto.fotos?.[0] ? (
                            <img src={produto.fotos[0]} alt={produto.nome} className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon className="w-5 h-5 text-gray-300" />
                          )}
                        </div>

                        <span
                          className="flex-1 text-sm font-medium text-gray-800 dark:text-white truncate"
                          title={`${produto.nome}${produto.modelo_referencia ? ` - ${produto.modelo_referencia}` : ''}`}
                        >
                          <span className="text-xs text-gray-400 mr-2">#{produto.id}</span>
                          {produto.nome}{produto.modelo_referencia ? ` - ${produto.modelo_referencia}` : ''}
                        </span>
                        <span className="text-sm font-bold text-green-700 dark:text-green-400 ml-2">
                          R$ {produto.preco_venda?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      {/* Linha de detalhes */}
                      <div className="flex items-center justify-between w-full gap-2">
                        <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-none truncate">
                          {[
                            hasMeaningfulValue(produto.cor) ? produto.cor : null,
                            hasMeaningfulValue(produto.material) ? produto.material : null,
                            (hasMeaningfulValue(produto.largura) || hasMeaningfulValue(produto.altura) || hasMeaningfulValue(produto.profundidade))
                              ? [
                                  hasMeaningfulValue(produto.largura) ? `L:${produto.largura}` : null,
                                  hasMeaningfulValue(produto.altura) ? `A:${produto.altura}` : null,
                                  hasMeaningfulValue(produto.profundidade) ? `P:${produto.profundidade}` : null,
                                ].filter(Boolean).join(' ') + ' cm'
                              : null,
                            hasMeaningfulValue(produto.fornecedor_nome) ? produto.fornecedor_nome : null,
                            produto.categoria || 'Outros',
                          ].filter(Boolean).join(' · ')}
                        </p>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[10px] font-semibold">
                            {bloqueado ? (
                              <span className="text-red-500">Sem estoque</span>
                            ) : semEstoque ? (
                              <span className="text-amber-500">Sob encomenda</span>
                            ) : (
                              <span className={qtd <= 5 ? 'text-orange-500' : 'text-green-600'}>{qtd}un</span>
                            )}
                          </span>
                          {onEditProduto && (
                            <div onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 rounded-full hover:bg-blue-100 text-blue-600"
                                title="Editar Produto"
                                onClick={() => onEditProduto(produto)}
                              >
                                <Edit2 className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Footer with Request Button */}
              <div className="p-2 border-t border-gray-100 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsModalOpen(true);
                  }}
                  className="w-full text-xs text-gray-500 hover:text-green-700 h-8 font-normal"
                >
                  <Plus className="w-3 h-3 mr-2" /> Não encontrou? Cadastrar item
                </Button>
              </div>
            </>
          )}
        </div>
      )}
      <ProdutoCadastroCompleto
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        produto={null}
        isLoading={isSavingProduto}
        onSave={async (data) => {
          if (isSavingProduto) return;

          setIsSavingProduto(true);
          try {
            const novoProduto = await base44.entities.Produto.create({
              ...data,
              requer_atencao: true,
              motivo_atencao: data?.motivo_atencao || "Cadastro iniciado no PDV por vendedor",
            });
            await queryClient.invalidateQueries({ queryKey: ['produtos'] });
            setIsModalOpen(false);

            if (novoProduto?.id) {
              handleSelectProduto(novoProduto);
              toast.success("Produto cadastrado e adicionado ao carrinho.");
              return;
            }

            toast.success("Produto cadastrado! Voce ja pode busca-lo na lista.");
          } catch (error) {
            toast.error(`Erro ao cadastrar produto: ${error.message}`);
          } finally {
            setIsSavingProduto(false);
          }
        }}
      />
    </div>
  );
}