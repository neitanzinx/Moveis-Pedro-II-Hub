import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useMemo } from 'react';

/**
 * Hook customizado para buscar produtos do estoque com paginação
 * Encapsula a lógica comum de query entre SugestaoComprasTab e CaixaDemandas
 * @param {string} queryKey - Chave única para a query (ex: 'produtos-sugestao')
 * @returns {Object} - Dados paginados e funções de controle
 */
export function useEstoqueProdutos(queryKey = 'produtos-estoque') {
    const {
        data: produtosPages,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading
    } = useInfiniteQuery({
        queryKey: [queryKey],
        queryFn: async ({ pageParam = 0 }) => {
            const limit = 100;
            const from = pageParam * limit;
            const to = from + limit - 1;

            const { data, error } = await supabase
                .from('produtos')
                .select('id, nome, codigo_barras, quantidade_estoque, estoque_minimo, estoque_ideal, fornecedor_id, preco_custo, modelo_referencia, cor, material, largura, altura, profundidade, fotos, descricao')
                .eq('ativo', true)
                .not('nome', 'ilike', '%CONJUNTO%')
                .range(from, to);

            if (error) throw error;
            return data;
        },
        getNextPageParam: (lastPage, allPages) => {
            return lastPage.length === 100 ? allPages.length : undefined;
        },
        initialPageParam: 0
    });

    const produtos = useMemo(() => {
        return produtosPages?.pages.flatMap(page => page) || [];
    }, [produtosPages]);

    return {
        produtos,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading
    };
}
