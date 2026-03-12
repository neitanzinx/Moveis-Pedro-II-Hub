import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// =========================================================================
// SCRIPT: MIGRAR QUADRO TRELLO DE COMPRAS PARA SUPABASE
// =========================================================================
// Uso: node scripts/migrate_trello_compras.js <caminho_do_arquivo.json>
// =========================================================================

// Configuração do Supabase a partir do .env.local
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Mapeamento de IDs das listas do Trello para o Status do nosso Kanban
const STATUS_MAP = {
    '64abc1234trelloListRascunho': 'Rascunho',
    '64abc1235trelloListEnviado': 'Enviado',
    '64abc1236trelloListConfirmado': 'Confirmado',
    '64abc1237trelloListEmConferencia': 'Em Conferência',
    '64abc1238trelloListRecebido': 'Recebido',
    '64abc1239trelloListCancelado': 'Cancelado'
};

async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error("ERRO: Forneça o caminho para o arquivo JSON do Trello.");
        console.error("Uso: node scripts/migrate_trello_compras.js backup_trello.json");
        process.exit(1);
    }

    const jsonPath = args[0];
    console.log(`Lendo arquivo Trello em: ${jsonPath}`);

    let trelloData;
    try {
        const rawdata = fs.readFileSync(jsonPath, 'utf8');
        trelloData = JSON.parse(rawdata);
    } catch (err) {
        console.error("Erro ao ler ou parsear o JSON:", err.message);
        process.exit(1);
    }

    console.log(`\nResumo do Trello:`);
    console.log(`- ${(trelloData.lists || []).length} Listas`);
    console.log(`- ${(trelloData.cards || []).length} Cartões`);
    console.log(`- ${(trelloData.checklists || []).length} Checklists`);

    console.log(`\nIniciando migração...`);

    let inseridosCounter = 0;
    let fallbackStatusCount = 0;

    for (const card of trelloData.cards || []) {
        if (card.closed) continue;

        let mappedStatus = STATUS_MAP[card.idList];
        if (!mappedStatus) {
            mappedStatus = 'Rascunho';
            fallbackStatusCount++;
        }

        const ordemRecord = {
            fornecedor_nome: card.name,
            numero_pedido: `TRL-${card.idShort}`,
            status: mappedStatus,
            data_pedido: card.dateLastActivity || new Date().toISOString(),
            observacoes: (card.desc || '') + `\n\n(Migrado do Trello: ${card.url})`,
            valor_total: 0
        };

        const { data: insertedOrdem, error: insertError } = await supabase
            .from('compras_ordens')
            .insert([ordemRecord])
            .select()
            .single();

        if (insertError) {
            console.error(`X Erro ao inserir Ordem ${card.name}:`, insertError.message);
            continue;
        }

        const cardChecklists = (trelloData.checklists || []).filter(cl => cl.idCard === card.id);
        const itensToInsert = [];

        for (const cl of cardChecklists) {
            for (const item of (cl.checkItems || [])) {
                let qtd = 1;
                let prodNome = item.name;

                const matchQtt = item.name.match(/^(\d+)[xX]\s+(.*)/);
                if (matchQtt) {
                    qtd = parseInt(matchQtt[1], 10);
                    prodNome = matchQtt[2].trim();
                }

                itensToInsert.push({
                    ordem_compra_id: insertedOrdem.id,
                    produto_nome: prodNome,
                    quantidade_pedida: qtd,
                    preco_unitario: 0,
                    descricao_personalizada: item.name
                });
            }
        }

        if (itensToInsert.length > 0) {
            const { error: itemsError } = await supabase
                .from('compras_oc_itens')
                .insert(itensToInsert);

            if (itemsError) {
                console.error(`  - Erro nos itens da Ordem ${insertedOrdem.id}:`, itemsError.message);
            }
        }

        inseridosCounter++;
        console.log(`√ Inserido [${mappedStatus}]: ${card.name}`);
    }

    console.log(`\n================================`);
    console.log(`MIGRAÇÃO CONCLUIDA: ${inseridosCounter} cartões.`);
    console.log(`Fallback "Rascunho": ${fallbackStatusCount}`);
    console.log(`================================`);
}

main();
