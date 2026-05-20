import React, { useState, useEffect, useRef } from "react";
import { normSearch } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Package, Tag, Warehouse, Filter, Palette, Layers, Ruler, ImageIcon, Edit2, AlertTriangle, Clock, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import SolicitacaoCadastroModal from "./SolicitacaoCadastroModal";
import { getColorHex } from "../produtos/FurnitureColorPicker";
import { useEstoqueValidacao } from "@/hooks/useEstoqueValidacao";

export default function BuscaProdutoAvancada(props) {
  const { produtos, onSelectProduto, onEditProduto, fornecedores = [] } = props;
  const [searchTerm, setSearchTerm] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [solicitationParentProduct, setSolicitationParentProduct] = useState(null);
  const [validating, setValidating] = useState(false);
  const searchRef = useRef(null);
  const { validarProduto } = useEstoqueValidacao();

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

  const handleSelectProduto = async (produto) => {
    if (validating) return;
    setValidating(true);

    try {
      const validacao = await validarProduto(produto.id, 1);

      if (!validacao.pode_vender) {
        // Pronta entrega sem estoque: bloqueia
        toast.error(`${produto.nome}: ${validacao.motivo}`);
        return;
      }

      if (validacao.eh_encomenda && validacao.requer_aprovacao) {
        // Flexível sem estoque: passa para VendaModal lidar com aprovação
        onSelectProduto({ ...produto, is_encomenda: true, validacao_estoque: validacao });
        toast.warning(`${produto.nome} adicionado. Requer aprovação gerencial (sem estoque).`);
      } else if (validacao.eh_encomenda) {
        // Sob-encomenda configurado: encomenda direta
        onSelectProduto({ ...produto, is_encomenda: true, validacao_estoque: validacao });
        toast.info(`${produto.nome} adicionado como ENCOMENDA (prazo: ${validacao.prazo_dias} dias úteis)`);
      } else {
        // Estoque disponível: venda normal
        onSelectProduto({ ...produto, is_encomenda: false, validacao_estoque: validacao });
      }
    } finally {
      setValidating(false);
    }

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
                        } ${validating ? 'opacity-60 cursor-wait' : ''}`}
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
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium flex items-center border border-purple-100 dark:border-purple-800" title="Fornecedor">
                          <Building2 className="w-3 h-3 mr-1" /> {produto.fornecedor_nome || 'Forn: N/A'}
                        </span>
                        {/* Categoria */}
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-neutral-700 text-gray-600 dark:text-gray-300">
                          {produto.categoria || 'Outros'}
                        </span>
                        {/* Estoque */}
                        <span className="text-[10px] font-medium ml-auto">
                          {bloqueado ? (
                            <span className="flex items-center gap-1 bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-semibold">
                              <AlertTriangle className="w-3 h-3" /> Sem estoque
                            </span>
                          ) : semEstoque && tipoEstoque === 'sob_encomenda' ? (
                            <span className="flex items-center gap-1 bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold">
                              <Clock className="w-3 h-3" /> Sob-encomenda
                            </span>
                          ) : semEstoque ? (
                            <span className="flex items-center gap-1 bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-semibold">
                              <AlertTriangle className="w-3 h-3" /> Requer aprovacao
                            </span>
                          ) : (
                            <span className={`${qtd <= 5 ? 'text-orange-500' : 'text-green-600'}`}>{qtd}un</span>
                          )}
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