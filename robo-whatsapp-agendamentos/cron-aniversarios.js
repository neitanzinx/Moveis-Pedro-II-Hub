/**
 * Agendador de Verificação de Aniversários
 * 
 * Este script configura um cron job que executa automaticamente
 * todos os dias às 09:00 para verificar aniversariantes e enviar
 * mensagens personalizadas via WhatsApp.
 */

const cron = require('node-cron');
const executarVerificacaoAniversarios = require('./verificar-aniversarios');

console.log('🎂 Sistema de Aniversários Automático Iniciado');
console.log('⏰ Configurado para rodar todos os dias às 09:00\n');

// Agenda execução diária às 09:00
// Formato cron: minuto hora dia mês dia-da-semana
// '0 9 * * *' = todo dia, às 09:00
cron.schedule('0 9 * * *', async () => {
    console.log('\n⏰ === CRON DISPARADO ===');
    console.log(`Hora atual: ${new Date().toLocaleString('pt-BR')}\n`);

    try {
        await executarVerificacaoAniversarios();
    } catch (error) {
        console.error('❌ Erro na execução do cron:', error);
    }
}, {
    timezone: "America/Sao_Paulo"
});

console.log('✅ Cron agendado com sucesso!');
console.log('ℹ️  Para testar manualmente, execute: node verificar-aniversarios.js\n');

// Mantém o processo rodando
process.on('SIGINT', () => {
    console.log('\n Encerrando sistema de aniversários...');
    process.exit(0);
});
