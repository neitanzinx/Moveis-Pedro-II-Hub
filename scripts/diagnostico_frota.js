#!/usr/bin/env node
/**
 * Script de Diagnóstico e Limpeza de Frota Stale
 * Executa queries no Supabase para identificar e corrigir inconsistências
 * 
 * Uso: node scripts/diagnostico_frota.js
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// Carregar variáveis de ambiente do .env
function loadEnv() {
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        envContent.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) {
                process.env[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
            }
        });
    }
}

loadEnv();

// Validar variáveis de ambiente
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Erro: Variáveis de ambiente não configuradas');
    console.error('   Verifique se .env contém VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Executa query SQL via RPC do Supabase
 */
async function executarQuery(sqlQuery, nome) {
    console.log(`\n📊 ${nome}...`);
    console.log('─'.repeat(60));
    
    try {
        // Executar via query direta via RPC (execute_sql)
        // Alternativamente, usar base44.entities se necessário
        const { data, error } = await supabase.rpc('execute_raw_sql', {
            sql: sqlQuery
        });

        if (error) {
            // Se RPC não existir, tentar via função alternativa
            console.log('⚠️  RPC execute_raw_sql não disponível, usando método alternativo...');
            return null;
        }

        console.log(JSON.stringify(data, null, 2));
        return data;
    } catch (err) {
        console.error(`❌ Erro ao executar: ${err.message}`);
        return null;
    }
}

/**
 * Diagnóstico: Identificar caminhões com dados inconsistentes
 */
async function diagnostico() {
    console.log('\n🔍 INICIANDO DIAGNÓSTICO DE FROTA...\n');
    
    try {
        // Query 1: Todos os caminhões para análise manual
        const { data: todosCaminhoes, error: errTodos } = await supabase
            .from('caminhoes')
            .select('id, placa, nome, motorista_atual_nome, status_rota, ultima_atualizacao')
            .order('placa');

        if (errTodos) {
            console.error('❌ Erro ao buscar caminhões:', errTodos.message);
            return;
        }

        console.log('📋 TODOS OS CAMINHÕES:');
        console.log('─'.repeat(80));
        
        const agora = new Date();
        const horasLimite = 12;
        const msLimite = horasLimite * 60 * 60 * 1000;

        todosCaminhoes.forEach(c => {
            const ultimaAtualizacao = new Date(c.ultima_atualizacao);
            const tempoDecorrido = agora - ultimaAtualizacao;
            const horasDecorridas = Math.floor(tempoDecorrido / (60 * 60 * 1000));
            const diasDecorridos = Math.floor(tempoDecorrido / (24 * 60 * 60 * 1000));
            
            let status_consistencia = '✅ OK';
            if (c.motorista_atual_nome && tempoDecorrido > msLimite) {
                status_consistencia = '⚠️  INCONSISTENTE: Motorista atribuído mas sem GPS > 12h';
            } else if (c.motorista_atual_nome && c.status_rota === 'Em Trânsito' && horasDecorridas > 6) {
                status_consistencia = '⚠️  SUSPEITO: Em trânsito mas sem atualização > 6h';
            } else if (!c.motorista_atual_nome && c.status_rota === 'Em Trânsito') {
                status_consistencia = '❌ INCONSISTENTE: Sem motorista mas em trânsito';
            }

            const tempoTexto = diasDecorridos > 0 
                ? `${diasDecorridos} dia(s)` 
                : `${horasDecorridas} hora(s)`;

            console.log(`
  🚚 ${c.placa} - ${c.nome}
     Motorista: ${c.motorista_atual_nome || '(nenhum)'}
     Status Rota: ${c.status_rota}
     Última atualização: ${tempoTexto} atrás
     Diagnóstico: ${status_consistencia}
            `);
        });

        // Query 2: Resumo geral
        const comMotorista = todosCaminhoes.filter(c => c.motorista_atual_nome).length;
        const emTransito = todosCaminhoes.filter(c => c.status_rota === 'Em Trânsito').length;
        const parados = todosCaminhoes.filter(c => c.status_rota === 'Parado').length;

        console.log('\n📊 RESUMO DE FROTA:');
        console.log('─'.repeat(80));
        console.log(`  Total de Caminhões: ${todosCaminhoes.length}`);
        console.log(`  Motoristas Ativos: ${comMotorista}`);
        console.log(`  Em Trânsito: ${emTransito}`);
        console.log(`  Parados: ${parados}`);
        console.log('\n✨ Diagnóstico Concluído');

    } catch (err) {
        console.error('❌ Erro durante diagnóstico:', err);
    }
}

/**
 * Limpeza: Remove motorista stale do 710 Azul
 */
async function limpar710Azul(confirmar = false) {
    console.log('\n🧹 INICIANDO LIMPEZA DO 710 AZUL...\n');

    if (!confirmar) {
        console.log('⚠️  Modo DRY-RUN (sem executar). Use --confirmar para realmente limpar.');
    }

    try {
        // Buscar caminhões com motorista atribuído mas sem GPS > 12h
        const { data: caminhoes, error: errBusca } = await supabase
            .from('caminhoes')
            .select('id, placa, nome, motorista_atual_nome, status_rota, turno_atual')
            .not('motorista_atual_nome', 'is', null);

        if (errBusca) {
            console.error('❌ Erro ao buscar caminhões:', errBusca.message);
            return;
        }

        if (caminhoes.length === 0) {
            console.log('✅ Nenhum caminhão com motorista atribuído encontrado (já está limpo)');
            return;
        }

        // Filtrar apenas os stale (12h sem atualização)
        const agora = new Date();
        const msLimite = 12 * 60 * 60 * 1000;
        const caminhoesStale = caminhoes.filter(c => {
            const ultima = new Date(c.ultima_atualizacao || 0);
            return (agora - ultima) > msLimite;
        });

        if (caminhoesStale.length === 0) {
            console.log('✅ Nenhum caminhão com inconsistência em status encontrado');
            return;
        }

        console.log(`📍 ENCONTRADO(S) ${caminhoesStale.length} CAMINHÃO(ÕES) COM INCONSISTÊNCIA:`);
        console.log('─'.repeat(80));
        
        caminhoesStale.forEach(c => {
            const ultima = new Date(c.ultima_atualizacao || 0);
            const diasDecorridos = Math.floor((agora - ultima) / (24 * 60 * 60 * 1000));
            console.log(`
  🚚 ${c.nome || c.placa}
     Motorista: ${c.motorista_atual_nome}
     Status: ${c.status_rota}
     Sem atualização GPS há ${diasDecorridos} dias
            `);
        });

        if (confirmar) {
            console.log('\n✂️  EXECUTANDO LIMPEZA...');
            
            // Limpar todos os caminhões stale
            for (const caminhao of caminhoesStale) {
                const { error: errUpdate } = await supabase
                    .from('caminhoes')
                    .update({
                        motorista_atual_nome: null,
                        status_rota: 'Parado',
                        turno_atual: null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', caminhao.id);

                if (errUpdate) {
                    console.error(`❌ Erro ao atualizar ${caminhao.nome || caminhao.placa}:`, errUpdate.message);
                } else {
                    console.log(`✅ Limpeza concluída: ${caminhao.nome || caminhao.placa}`);
                }
            }

            // Verificar resultado
            console.log('\n📍 ESTADO PÓS-LIMPEZA:');
            console.log('─'.repeat(80));
            
            const { data: caminhoesApos } = await supabase
                .from('caminhoes')
                .select('id, placa, nome, motorista_atual_nome, status_rota, turno_atual')
                .order('placa');

            const comMotorista = caminhoesApos.filter(c => c.motorista_atual_nome).length;
            const emTransito = caminhoesApos.filter(c => c.status_rota === 'Em Trânsito').length;
            const parados = caminhoesApos.filter(c => c.status_rota === 'Parado').length;

            console.log(`  Total de Caminhões: ${caminhoesApos.length}`);
            console.log(`  Motoristas Ativos: ${comMotorista}`);
            console.log(`  Em Trânsito: ${emTransito}`);
            console.log(`  Parados: ${parados}`);
        }

    } catch (err) {
        console.error('❌ Erro durante limpeza:', err);
    }
}

/**
 * Main
 */
async function main() {
    const args = process.argv.slice(2);
    const confirmar = args.includes('--confirmar');
    const apenasLimpeza = args.includes('--limpar');
    const apenasDiagnostico = args.includes('--diagnostico');

    console.log('═'.repeat(60));
    console.log('   SISTEMA DE DIAGNÓSTICO E LIMPEZA DE FROTA');
    console.log('═'.repeat(60));

    if (apenasDiagnostico || !apenasLimpeza) {
        await diagnostico();
    }

    if (apenasLimpeza || (!apenasDiagnostico && args.length === 0)) {
        await limpar710Azul(confirmar);
    }

    if (!confirmar && !apenasDiagnostico) {
        console.log('\n💡 Use --confirmar para realmente executar a limpeza');
        console.log('   Exemplo: node scripts/diagnostico_frota.js --confirmar');
    }

    console.log('\n═'.repeat(60));
}

main().catch(err => {
    console.error('❌ Erro fatal:', err);
    process.exit(1);
});
