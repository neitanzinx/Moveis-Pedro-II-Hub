import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

const NCM_FALLBACK_MAP: Record<string, { ncm: string; descricao: string }> = {
    "Sofás": { ncm: "9401.61.00", descricao: "Assentos estofados com armação de madeira" },
    "Sofá": { ncm: "9401.61.00", descricao: "Assentos estofados com armação de madeira" },
    "Estofados": { ncm: "9401.61.00", descricao: "Assentos estofados" },
    "Poltronas": { ncm: "9401.61.00", descricao: "Assentos estofados com armação de madeira" },
    "Mesas": { ncm: "9403.60.00", descricao: "Móveis de madeira para sala de jantar/cozinha" },
    "Mesa": { ncm: "9403.60.00", descricao: "Móveis de madeira para sala de jantar/cozinha" },
    "Cadeiras": { ncm: "9401.71.00", descricao: "Assentos com armação de metal, estofados" },
    "Cadeira": { ncm: "9401.71.00", descricao: "Assentos com armação de metal, estofados" },
    "Racks": { ncm: "9403.60.00", descricao: "Outros móveis de madeira" },
    "Rack": { ncm: "9403.60.00", descricao: "Outros móveis de madeira" },
    "Painéis": { ncm: "9403.60.00", descricao: "Outros móveis de madeira" },
    "Camas": { ncm: "9403.50.00", descricao: "Móveis de madeira para quartos de dormir" },
    "Cama": { ncm: "9403.50.00", descricao: "Móveis de madeira para quartos de dormir" },
    "Colchões": { ncm: "9404.21.00", descricao: "Colchões de borracha ou plástico celular" },
    "Colchão": { ncm: "9404.21.00", descricao: "Colchões de borracha ou plástico celular" },
    "Guarda-Roupas": { ncm: "9403.50.00", descricao: "Móveis de madeira para quartos de dormir" },
    "Armários": { ncm: "9403.60.00", descricao: "Outros móveis de madeira" },
    "Cômodas": { ncm: "9403.50.00", descricao: "Móveis de madeira para quartos de dormir" },
    "Estantes": { ncm: "9403.60.00", descricao: "Outros móveis de madeira" },
    "Buffets": { ncm: "9403.60.00", descricao: "Móveis de madeira para sala de jantar" },
    "default": { ncm: "9403.60.00", descricao: "Outros móveis de madeira" }
};

interface NCMRequest {
    produtos: Array<{
        nome: string;
        categoria: string;
    }>;
}

interface NCMSuggestion {
    nome: string;
    ncm: string;
    descricao: string;
    confianca: number;
    fonte: "gemini" | "fallback";
}

// Função para obter a chave da API (Environment ou Database)
async function getGeminiApiKey(): Promise<string | null> {
    // 1. Tentar Variável de Ambiente
    const envKey = Deno.env.get("GEMINI_API_KEY");
    if (envKey) return envKey;

    // 2. Tentar Banco de Dados (usando Service Role para acesso total)
    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        if (!supabaseUrl || !supabaseKey) {
            console.warn("Credenciais do Supabase não encontradas no ambiente");
            return null;
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data, error } = await supabase
            .from("configuracao_sistema")
            .select("dados")
            .eq("tipo", "integracoes")
            .single();

        if (error || !data?.dados?.gemini_api_key) {
            console.warn("Chave Gemini não encontrada no banco de dados", error);
            return null;
        }

        return data.dados.gemini_api_key;
    } catch (err) {
        console.error("Erro ao buscar chave no banco:", err);
        return null;
    }
}

async function suggestNCMWithGemini(nome: string, categoria: string, apiKey: string): Promise<NCMSuggestion> {
    const prompt = `Você é um especialista em classificação fiscal NCM brasileira para móveis.

Dado o produto:
- Nome: "${nome}"
- Categoria: "${categoria}"

Responda APENAS com um JSON válido no formato:
{
  "ncm": "XXXX.XX.XX",
  "descricao": "Breve descrição da classificação fiscal",
  "confianca": 0.XX
}

Onde:
- ncm: Código NCM de 6 ou 8 dígitos no formato XXXX.XX.XX
- descricao: Descrição curta da categoria fiscal
- confianca: Número entre 0 e 1 indicando sua certeza (ex: 0.95)

IMPORTANTE: Responda APENAS o JSON.`;

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 256,
            }
        }),
    });

    if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textResponse) {
        throw new Error("Resposta vazia do Gemini");
    }

    const cleanJson = textResponse.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(cleanJson);

    return {
        nome,
        ncm: parsed.ncm,
        descricao: parsed.descricao,
        confianca: parsed.confianca,
        fonte: "gemini"
    };
}

function getFallbackNCM(nome: string, categoria: string): NCMSuggestion {
    const catKey = Object.keys(NCM_FALLBACK_MAP).find(
        key => categoria.toLowerCase().includes(key.toLowerCase())
    );

    if (catKey && catKey !== "default") {
        const fallback = NCM_FALLBACK_MAP[catKey];
        return {
            nome,
            ncm: fallback.ncm,
            descricao: fallback.descricao,
            confianca: 0.6,
            fonte: "fallback"
        };
    }

    const nomeKey = Object.keys(NCM_FALLBACK_MAP).find(
        key => nome.toLowerCase().includes(key.toLowerCase())
    );

    if (nomeKey && nomeKey !== "default") {
        const fallback = NCM_FALLBACK_MAP[nomeKey];
        return {
            nome,
            ncm: fallback.ncm,
            descricao: fallback.descricao,
            confianca: 0.5,
            fonte: "fallback"
        };
    }

    const defaultFallback = NCM_FALLBACK_MAP["default"];
    return {
        nome,
        ncm: defaultFallback.ncm,
        descricao: defaultFallback.descricao,
        confianca: 0.3,
        fonte: "fallback"
    };
}

Deno.serve(async (req: Request) => {
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey",
    };

    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { produtos }: NCMRequest = await req.json();

        if (!produtos || !Array.isArray(produtos)) {
            throw new Error("Lista de produtos inválida");
        }

        // Buscar API Key (apenas uma vez para todo o lote)
        const geminiApiKey = await getGeminiApiKey();
        const useAI = !!geminiApiKey;

        const sugestoes: NCMSuggestion[] = [];
        const erros: string[] = [];

        // Processar em paralelo com limite de concorrência ou sequencial para evitar rate limit
        // Para simplificar e evitar estouro de cota, faremos sequencial com delay pequeno
        for (const produto of produtos) {
            try {
                if (useAI) {
                    const sugestao = await suggestNCMWithGemini(produto.nome, produto.categoria, geminiApiKey!);
                    sugestoes.push(sugestao);
                } else {
                    throw new Error("Chave Gemini não configurada");
                }
            } catch (error) {
                // Silencioso no console do servidor, mas retorna fallback
                const fallback = getFallbackNCM(produto.nome, produto.categoria);
                sugestoes.push(fallback);
                if (useAI) erros.push(`Erro IA para ${produto.nome}: ${error.message}`);
            }

            // Delay pequeno se estiver usando IA
            if (useAI) await new Promise(r => setTimeout(r, 100));
        }

        return new Response(
            JSON.stringify({
                success: true,
                sugestoes,
                erros: erros.length > 0 ? erros : undefined,
                total: sugestoes.length,
                gemini: sugestoes.filter(s => s.fonte === "gemini").length,
                fallback: sugestoes.filter(s => s.fonte === "fallback").length,
                aiAvailable: useAI
            }),
            {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
        );

    } catch (error) {
        console.error("Erro function:", error);
        return new Response(
            JSON.stringify({ error: error.message || "Erro interno" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
