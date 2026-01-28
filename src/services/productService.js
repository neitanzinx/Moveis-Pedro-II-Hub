import { supabase } from '@/lib/supabase';

export const productService = {
    /**
     * Busca produto pelo GTIN
     * Ordem: Banco Local -> API Bluesoft -> Google Search
     */
    async fetchProductByGtin(gtin) {
        try {
            // ---------------------------------------------------------
            // 1. Verifica Banco Local (Abordagem segura com Array)
            // ---------------------------------------------------------
            const { data: listaProdutos, error: localError } = await supabase
                .from('produtos_mestre')
                .select('*')
                .eq('gtin', gtin)
                .limit(1);

            if (localError) {
                console.error('Erro de conexão com Banco:', localError);
            }

            const localData = (listaProdutos && listaProdutos.length > 0) ? listaProdutos[0] : null;

            if (localData) return localData;

            // ---------------------------------------------------------
            // 2. Chama a API Cosmos (Edge Function)
            // ---------------------------------------------------------
            console.log('Buscando na API Externa (Edge Function)...');

            const { data: cosmosData, error: functionError } = await supabase.functions.invoke('consulta-cosmos', {
                body: { gtin }
            });

            // Logs de Debug (úteis para ver o que a Bluesoft retornou)
            if (functionError) {
                console.warn('Erro na Edge Function:', functionError);
            } else {
                console.log('--- RESPOSTA DA API ---');
                console.log('Dados:', cosmosData);
                console.log('-----------------------');
            }

            // SE a Bluesoft achou o produto, retorna ele agora mesmo.
            if (cosmosData && cosmosData.gtin) {
                return cosmosData;
            }

            // ---------------------------------------------------------
            // 3. Fallback: Google Custom Search (Plano C)
            // ---------------------------------------------------------
            // Pega as chaves seguras do arquivo .env
            const googleKey = import.meta.env.VITE_GOOGLE_API_KEY;
            const searchEngineId = import.meta.env.VITE_GOOGLE_SEARCH_ENGINE_ID;

            if (googleKey && searchEngineId) {
                console.log('Bluesoft falhou. Tentando Google Search...');
                const googleData = await fetchGoogleProduct(gtin, googleKey, searchEngineId);

                if (googleData) {
                    console.log('✅ Achamos no Google:', googleData.nome);
                    return googleData;
                }
            }

            // Se nada funcionar, retorna null (vai virar "NOVO ITEM" genérico na tela)
            return null;

        } catch (error) {
            console.error('Erro Crítico no Service:', error);
            return null;
        }
    }
};

/**
 * Função auxiliar que pesquisa no Google
 * Retorna um objeto formatado ou null
 */
async function fetchGoogleProduct(gtin, apiKey, cx) {
    try {
        const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${gtin}`;

        const res = await fetch(url);

        if (!res.ok) {
            console.warn('Google Search API retornou erro:', res.status);
            return null;
        }

        const json = await res.json();

        // O Google retorna uma lista 'items'. Pegamos o primeiro resultado.
        if (json.items && json.items.length > 0) {
            const item = json.items[0];

            // Cria um objeto compatível com o seu sistema
            return {
                gtin: gtin,
                nome: item.title, // Ex: "Armário Aéreo..."
                marca: 'A DEFINIR',
                ncm: '',
                foto_url: item.pagemap?.cse_image?.[0]?.src || null, // Tenta pegar a foto
                status: 'REVISAO_PENDENTE' // Marca para saneamento futuro
            };
        }
    } catch (err) {
        console.warn('Erro ao processar Google Search:', err);
    }
    return null;
}