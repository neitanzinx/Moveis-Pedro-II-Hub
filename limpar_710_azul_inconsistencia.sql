-- Script de Limpeza: Resolver Inconsistência do Caminhão 710 Azul
-- Problema: motorista_atual_nome preenchido com motorista que parou de usar há dias
-- Solução: Limpar motorista_atual_nome e resetar status_rota para "Parado"

-- ANTES: Verificar estado atual do 710 Azul
SELECT 
    id,
    placa,
    nome,
    motorista_atual_nome,
    status_rota,
    turno_atual,
    ultima_atualizacao,
    NOW() - ultima_atualizacao AS tempo_sem_atualizacao
FROM caminhoes
WHERE placa = '710'
ORDER BY placa;

-- AÇÃO: Limpar dados inconsistentes
UPDATE caminhoes
SET 
    motorista_atual_nome = NULL,
    status_rota = 'Parado',
    turno_atual = NULL,
    updated_at = NOW()
WHERE placa = '710'
  AND motorista_atual_nome IS NOT NULL
  AND (NOW() - ultima_atualizacao) > INTERVAL '12 hours';

-- DEPOIS: Verificar resultado da limpeza
SELECT 
    id,
    placa,
    nome,
    motorista_atual_nome,
    status_rota,
    turno_atual,
    ultima_atualizacao
FROM caminhoes
WHERE placa = '710'
ORDER BY placa;

-- Validação: Verificar contadores corrigidos
SELECT 
    COUNT(*) as total_caminhoes,
    SUM(CASE WHEN motorista_atual_nome IS NOT NULL THEN 1 ELSE 0 END) as motoristas_ativos,
    SUM(CASE WHEN status_rota = 'Em Trânsito' THEN 1 ELSE 0 END) as em_transito,
    SUM(CASE WHEN status_rota = 'Parado' THEN 1 ELSE 0 END) as parados
FROM caminhoes;
