import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

/**
 * Hook para buscar a lista de lojas ativas do banco de dados.
 * Substitui a lista fixa LOJAS do arquivo cargos.js.
 */
export function useLojas() {
    return useQuery({
        queryKey: ['lojas-ativas'],
        queryFn: async () => {
            const lojas = await base44.entities.Loja.list('nome');
            // Filtragem robusta: deve ser explicitamente ativa e is_active
            // Se um dos campos for nulo, consideramos o outro.
            return lojas.filter(l => 
                (l.ativa !== false && l.is_active !== false) && 
                (l.ativa === true || l.is_active === true)
            );
        },
        staleTime: 1000 * 60 * 5, // 5 minutos de cache
    });
}
