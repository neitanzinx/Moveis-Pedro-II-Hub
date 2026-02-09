import { productService } from '@/services/productService';
import { supabase } from '@/lib/supabase';

/**
 * Service to identify products by EAN.
 * 1. Checks internal DB.
 * 2. Checks existing External APIs (Cosmos etc via productService).
 * 3. Fallback to Gemini 3.0 Flash for "smart guess" (if configured).
 */
export const eanService = {
    /**
     * Looks up an EAN.
     * @param {string} gtin - Barcode
     * @returns {Promise<{found: boolean, source: 'internal'|'api'|'gemini', product: object}>}
     */
    async lookup(gtin) {
        if (!gtin) return { found: false };

        try {
            // 1. Internal Search
            const { data: internal, error } = await supabase
                .from('produtos')
                .select('*')
                .eq('codigo_barras', gtin)
                .maybeSingle();

            if (internal) {
                return { found: true, source: 'internal', product: internal };
            }

            // 2. External API (Cosmos/Table via existing service)
            // Adapting from EntradaEstoque logic
            const apiData = await productService.fetchProductByGtin(gtin);
            if (apiData && apiData.description) { // Normalizing return checks
                return {
                    found: true,
                    source: 'api',
                    product: {
                        nome: apiData.description || apiData.nome,
                        ncm: apiData.ncm,
                        gtin: gtin,
                        foto_url: apiData.thumbnail || apiData.foto_url,
                        specs: apiData // Keep raw data just in case
                    }
                };
            }

            return { found: false };

        } catch (err) {
            console.error("EAN Lookup Error:", err);
            return { found: false, error: err };
        }
    }
};
