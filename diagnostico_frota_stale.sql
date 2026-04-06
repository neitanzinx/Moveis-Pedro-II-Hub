-- Diagnóstico: Identificar Caminhões com Dados Inconsistentes (Stale)
-- Problema: Motorista atribuído mas sem atualização GPS > 12 horas

SELECT 
    id,
    placa,
    nome,
    motorista_atual_nome,
    status_rota,
    ultima_atualizacao,
    NOW() - ultima_atualizacao AS tempo_sem_atualizacao,
    CASE 
        WHEN motorista_atual_nome IS NOT NULL AND (NOW() - ultima_atualizacao) > INTERVAL '12 hours'
        THEN 'INCONSISTENTE: Motorista atribuído mas sem GPS > 12h'
        WHEN motorista_atual_nome IS NOT NULL AND status_rota = 'Em Trânsito' AND (NOW() - ultima_atualizacao) > INTERVAL '6 hours'
        THEN 'SUSPEITO: Em trânsito mas sem atualização > 6h'
        WHEN motorista_atual_nome IS NULL AND status_rota = 'Em Trânsito'
        THEN 'INCONSISTENTE: Sem motorista mas em trânsito'
        ELSE 'OK'
    END AS status_consistencia
FROM caminhoes
WHERE 
    -- Encontrar apenas caminhões com problemas de consistência
    (motorista_atual_nome IS NOT NULL AND (NOW() - ultima_atualizacao) > INTERVAL '12 hours')
    OR (motorista_atual_nome IS NOT NULL AND status_rota = 'Em Trânsito' AND (NOW() - ultima_atualizacao) > INTERVAL '6 hours')
    OR (motorista_atual_nome IS NULL AND status_rota = 'Em Trânsito')
    OR placa = '710'  -- Especificamente o 710 Azul reportado
ORDER BY 
    CASE 
        WHEN motorista_atual_nome IS NOT NULL AND (NOW() - ultima_atualizacao) > INTERVAL '12 hours' THEN 1
        ELSE 2
    END,
    ultima_atualizacao ASC;

-- Resumo: Contagem de caminhões por status
SELECT 
    COUNT(*) as total_caminhoes,
    SUM(CASE WHEN motorista_atual_nome IS NOT NULL THEN 1 ELSE 0 END) as com_motorista_atribuido,
    SUM(CASE WHEN status_rota = 'Em Trânsito' THEN 1 ELSE 0 END) as em_transito,
    SUM(CASE WHEN status_rota = 'Parado' THEN 1 ELSE 0 END) as parados,
    SUM(CASE WHEN (NOW() - ultima_atualizacao) > INTERVAL '12 hours' THEN 1 ELSE 0 END) as sem_gps_12h
FROM caminhoes;
