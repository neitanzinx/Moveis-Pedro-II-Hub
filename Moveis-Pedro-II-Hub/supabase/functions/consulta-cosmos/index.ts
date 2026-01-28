import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { gtin } = await req.json()

        if (!gtin) {
            return new Response(JSON.stringify({ error: 'GTIN required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const cosmosToken = Deno.env.get('COSMOS_TOKEN')
        if (!cosmosToken) {
            console.error('Missing COSMOS_TOKEN')
            return new Response(JSON.stringify({ error: 'Server configuration error' }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // Call Cosmos API
        const response = await fetch(`https://api.cosmos.bluesoft.com.br/gtins/${gtin}`, {
            headers: {
                'X-Cosmos-Token': cosmosToken,
                'User-Agent': 'Cosmos-API-Request'
            }
        })

        if (response.status === 404) {
            return new Response(JSON.stringify(null), {
                status: 200, // Return null successfully to indicate "not found" logic in frontend
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        if (response.status === 429) {
            return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
                status: 429,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        if (!response.ok) {
            const errorText = await response.text()
            return new Response(JSON.stringify({ error: `Cosmos API error: ${response.status}`, details: errorText }), {
                status: response.status,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const data = await response.json()

        // Map to internal format
        const mappedProduct = {
            gtin: data.gtin.toString(),
            nome: data.description,
            marca: data.brand?.name || null,
            ncm: data.ncm?.code || null,
            gpc_description: data.gpc?.description || null, // Fallback info
            foto_url: data.thumbnail || null,
        }

        return new Response(JSON.stringify(mappedProduct), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
