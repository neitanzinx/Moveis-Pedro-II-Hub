import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/api/base44Client';

/**
 * Hook para gerenciar filtros padrão de produto
 * Reutilizável entre Produtos.jsx e EstoqueTab.jsx
 * 
 * @returns {Object} Contém states dos filtros, queries de categorias/fabricantes, e utilities
 */
export function useProdutoFilters() {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState('todas');
  const [selectedFabricante, setSelectedFabricante] = useState('todos');
  const [selectedOrdenacao, setSelectedOrdenacao] = useState('alfabetica');
  const [selectedDirecao, setSelectedDirecao] = useState('asc');
  const [filtroAtencao, setFiltroAtencao] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch categorias únicas
  const { data: categorias = [] } = useQuery({
    queryKey: ['categorias-produtos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('produtos').select('categoria').not('categoria', 'is', null);
      if (error) throw error;
      const cats = [...new Set(data?.map(p => p.categoria))].filter(Boolean).sort();
      return cats;
    },
    staleTime: 1000 * 60 * 5
  });

  // Fetch fabricantes únicos
  const { data: fabricantes = [] } = useQuery({
    queryKey: ['fabricantes-produtos'],
    queryFn: async () => {
      const { data: produtos, error } = await supabase
        .from('produtos')
        .select('fornecedor_id, fornecedor_nome');

      if (error) throw error;

      const idsFornecedor = [...new Set(
        (produtos || [])
          .map((produto) => produto.fornecedor_id)
          .filter(Boolean)
      )];

      let fornecedoresMap = new Map();
      if (idsFornecedor.length > 0) {
        const { data: fornecedores, error: fornecedoresError } = await supabase
          .from('fornecedores')
          .select('id, nome_empresa')
          .in('id', idsFornecedor);

        if (fornecedoresError) throw fornecedoresError;

        fornecedoresMap = new Map(
          (fornecedores || []).map((fornecedor) => [String(fornecedor.id), String(fornecedor.nome_empresa || '').trim()])
        );
      }

      const items = [...new Set(
        (produtos || [])
          .map((produto) => {
            const nomeDoId = produto.fornecedor_id ? fornecedoresMap.get(String(produto.fornecedor_id)) : '';
            return (nomeDoId || produto.fornecedor_nome || '').trim();
          })
          .filter(Boolean)
      )].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));

      return items;
    },
    staleTime: 1000 * 60 * 5
  });

  // Fetch count de produtos com atenção
  const { data: produtosComAtencao = 0 } = useQuery({
    queryKey: ['produtos-atencao-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('produtos')
        .select('*', { count: 'exact', head: true })
        .eq('requer_atencao', true);
      if (error) throw error;
      return count || 0;
    }
  });

  // Função para aplicar sorting (client-side) em um array de produtos
  const aplicarOrdenacao = (produtos) => {
    let sorted = [...produtos];

    if (selectedFabricante !== 'todos') {
      sorted = sorted.filter((produto) => {
        const fabricante = (produto.fornecedor_nome || '').trim();
        return fabricante === selectedFabricante;
      });
    }

    switch (selectedOrdenacao) {
      case 'quantidade':
        sorted.sort((a, b) => {
          const aQtd = a.quantidade_estoque || 0;
          const bQtd = b.quantidade_estoque || 0;
          return selectedDirecao === 'asc' ? aQtd - bQtd : bQtd - aQtd;
        });
        break;
      case 'preco':
        sorted.sort((a, b) => {
          const aPreco = a.preco_venda || 0;
          const bPreco = b.preco_venda || 0;
          return selectedDirecao === 'asc' ? aPreco - bPreco : bPreco - aPreco;
        });
        break;
      case 'alfabetica':
      default:
        sorted.sort((a, b) => {
          const comparacao = (a.nome || '').localeCompare((b.nome || ''), 'pt-BR', { sensitivity: 'base' });
          return selectedDirecao === 'asc' ? comparacao : comparacao * -1;
        });
        break;
    }

    return sorted;
  };

  // Função para resetar todos os filtros
  const resetFilters = () => {
    setSearchTerm('');
    setDebouncedSearch('');
    setSelectedCategoria('todas');
    setSelectedFabricante('todos');
    setSelectedOrdenacao('alfabetica');
    setSelectedDirecao('asc');
    setFiltroAtencao(false);
  };

  return {
    // Estados
    searchTerm,
    setSearchTerm,
    debouncedSearch,
    selectedCategoria,
    setSelectedCategoria,
    selectedFabricante,
    setSelectedFabricante,
    selectedOrdenacao,
    setSelectedOrdenacao,
    selectedDirecao,
    setSelectedDirecao,
    filtroAtencao,
    setFiltroAtencao,

    // Dados carregados
    categorias,
    fabricantes,
    produtosComAtencao,

    // Utilities
    aplicarOrdenacao,
    resetFilters
  };
}
