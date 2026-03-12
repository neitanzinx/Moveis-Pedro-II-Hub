import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Package, Tag, Warehouse, Filter, Palette, Layers, Ruler, ImageIcon, Edit2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import SolicitacaoCadastroModal from "./SolicitacaoCadastroModal";
import { getColorHex } from "../produtos/FurnitureColorPicker";

export default function BuscaProdutoAvancada(props) {
  const { produtos, onSelectProduto, onEditProduto, fornecedores = [] } = props;
  const [searchTerm, setSearchTerm] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [solicitationParentProduct, setSolicitationParentProduct] = useState(null);
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
    const qtdDisponivel = (produto.quantidade_estoque || 0) - (produto.quantidade_reservada || 0);

    // Se estoque zerado, verificar se fornecedor permite encomenda
    if (qtdDisponivel <= 0) {
      const fornecedor = fornecedores.find(f =>
        f.nome_empresa?.toLowerCase().trim() === produto.fornecedor_nome?.toLowerCase().trim()
      );

      if (fornecedor && fornecedor.encomendas_habilitadas === false) {
        toast.error(`Encomendas bloqueadas para o fornecedor ${fornecedor.nome_empresa}. Produto sem estoque.`);
        return;
      }

      // Marcar como encomenda
      onSelectProduto({ ...produto, is_encomenda: true });
      toast.info(`📦 ${produto.nome} adicionado como ENCOMENDA (estoque zerado)`);
    } else {
      onSelectProduto(produto);
    }
    setSearchTerm("");
    setShowResults(false);
    setSelectedIndex(0);
  };

  // Filtrar produtos
  const produtosFiltrados = produtos.filter(p => {
    if (!p.ativo) return false;

    const searchTokens = searchTerm.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    if (searchTokens.length === 0) return false;

    // Verifica se TODOS os tokens de busca estão presentes em ALGUM campo do produto
    return searchTokens.every(token =>
      p.nome?.toLowerCase().includes(token) ||
      p.codigo_barras?.toLowerCase().includes(token) ||
      p.categoria?.toLowerCase().includes(token) ||
      p.material?.toLowerCase().includes(token) ||
      p.cor?.toLowerCase().includes(token) ||
      p.fornecedor_nome?.toLowerCase().includes(token) ||
      p.modelo_referencia?.toLowerCase().includes(token)
    );
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
              <p className="text-sm text-gray-500 mb-4">Nenhum produto encontrado</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSolicitationParentProduct(null);
                  setIsModalOpen(true);
                }}
                className="w-full border-green-200 text-green-700 hover:bg-green-50"
              >
                <Plus className="w-4 h-4 mr-2" /> Solicitar Cadastro
              </Button>
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

                        <span className="flex-1 text-sm font-medium text-gray-800 dark:text-white truncate">
                          <span className="text-xs text-gray-400 mr-2">#{produto.id}</span>
                          {produto.nome}{produto.modelo_referencia ? ` - ${produto.modelo_referencia}` : ''}
                        </span>
                        <span className="text-sm font-bold text-green-700 dark:text-green-400 ml-2">
                          R$ {produto.preco_venda?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      {/* Linha de detalhes: Variações + Categoria + Estoque */}
                      <div className="flex items-center flex-wrap gap-1.5 w-full">
                        {/* Cor */}
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-50 border border-gray-200 text-gray-700 font-medium flex items-center gap-1.5" title="Cor">
                          {produto.cor ? (() => {
                            const colors = produto.cor.split('/').map(c => c.trim());
                            const isDual = colors.length > 1;
                            const hex1 = getColorHex(colors[0]);
                            const hex2 = isDual ? getColorHex(colors[1]) : null;

                            return (
                              <>
                                <div
                                  className="w-3 h-3 rounded-full border border-gray-300 shadow-sm"
                                  style={{ background: isDual ? `linear-gradient(135deg, ${hex1} 50%, ${hex2} 50%)` : hex1 }}
                                />
                                {produto.cor}
                              </>
                            );
                          })() : <span className="text-gray-400">Cor: N/A</span>}
                        </span>

                        {/* Material/Tecido */}
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium flex items-center" title="Material">
                          <Layers className="w-3 h-3 mr-1" /> {produto.material || 'Mat: N/A'}
                        </span>

                        {/* Dimensões - Montadas a partir dos campos separados */}
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-medium flex items-center" title="Dimensões">
                          <Ruler className="w-3 h-3 mr-1" />
                          {(produto.largura || produto.altura || produto.profundidade)
                            ? `${produto.largura || '?'}x${produto.altura || '?'}${produto.profundidade ? `x${produto.profundidade}` : ''} cm`
                            : 'Dim: N/A'
                          }
                        </span>
                        {/* Fornecedor */}
                        {produto.fornecedor_nome && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-neutral-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-neutral-600">
                            {produto.fornecedor_nome}
                          </span>
                        )}
                        {/* Categoria */}
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-neutral-700 text-gray-600 dark:text-gray-300">
                          {produto.categoria || 'Outros'}
                        </span>
                        {/* Estoque */}
                        <span className={`text-[10px] font-medium ml-auto ${qtd <= 0 ? 'text-red-500' : qtd <= 5 ? 'text-orange-500' : 'text-green-600'}`}>
                          {qtd <= 0 ? (
                            <span className="flex items-center gap-1">
                              <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-semibold">📦 Encomenda</span>
                            </span>
                          ) : `${qtd}un`}
                        </span>

                        {/* Botão Editar Produto */}
                        {onEditProduto && (
                          <div className="ml-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 rounded-full hover:bg-blue-100 text-blue-600"
                              title="Editar Produto"
                              onClick={() => {
                                onEditProduto(produto);
                              }}
                            >
                              <Edit2 className="w-3 h-3" />
                            </Button>
                          </div>
                        )}

                      </div>
                    </button>
                  );
                })}
              </div>
              {/* Footer with Request Button */}
              <div className="p-2 border-t border-gray-100 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900 border-none">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSolicitationParentProduct(null);
                    setIsModalOpen(true);
                  }}
                  className="w-full text-xs text-gray-500 hover:text-green-700 h-8 font-normal"
                >
                  <Plus className="w-3 h-3 mr-2" /> Não encontrou? Solicitar Cadastro
                </Button>
              </div>
            </>
          )}
        </div>
      )}
      {/* Modal de Solicitação */}
      <SolicitacaoCadastroModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onProdutoSolicitado={handleSelectProduto}
        user={props.user}
        initialParentProduct={solicitationParentProduct}
      />
    </div>
  );
}