-- SQL para atualizar/criar a tabela de caminhões
-- Execute no SQL Editor do Supabase

-- Primeiro, vamos adicionar as colunas que faltam na tabela existente
-- Se a tabela não existir, ela será criada

-- Verificar se a tabela existe, se não, criar
CREATE TABLE IF NOT EXISTS caminhoes (
    id SERIAL PRIMARY KEY,
    placa VARCHAR(10) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar todas as colunas necessárias (ignora erro se já existirem)
DO $$
BEGIN
    -- Colunas básicas do ConfiguracaoFrota
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'caminhoes' AND column_name = 'nome') THEN
        ALTER TABLE caminhoes ADD COLUMN nome VARCHAR(200);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'caminhoes' AND column_name = 'modelo') THEN
        ALTER TABLE caminhoes ADD COLUMN modelo VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'caminhoes' AND column_name = 'capacidade_volume_m3') THEN
        ALTER TABLE caminhoes ADD COLUMN capacidade_volume_m3 NUMERIC(10,2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'caminhoes' AND column_name = 'capacidade_peso_kg') THEN
        ALTER TABLE caminhoes ADD COLUMN capacidade_peso_kg INTEGER DEFAULT 1000;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'caminhoes' AND column_name = 'ativo') THEN
        ALTER TABLE caminhoes ADD COLUMN ativo BOOLEAN DEFAULT true;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'caminhoes' AND column_name = 'motorista_padrao') THEN
        ALTER TABLE caminhoes ADD COLUMN motorista_padrao VARCHAR(200);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'caminhoes' AND column_name = 'telefone_motorista') THEN
        ALTER TABLE caminhoes ADD COLUMN telefone_motorista VARCHAR(20);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'caminhoes' AND column_name = 'observacoes') THEN
        ALTER TABLE caminhoes ADD COLUMN observacoes TEXT;
    END IF;
    
    -- Colunas de rastreamento em tempo real
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'caminhoes' AND column_name = 'latitude') THEN
        ALTER TABLE caminhoes ADD COLUMN latitude DOUBLE PRECISION;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'caminhoes' AND column_name = 'longitude') THEN
        ALTER TABLE caminhoes ADD COLUMN longitude DOUBLE PRECISION;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'caminhoes' AND column_name = 'ultima_atualizacao') THEN
        ALTER TABLE caminhoes ADD COLUMN ultima_atualizacao TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'caminhoes' AND column_name = 'status_rota') THEN
        ALTER TABLE caminhoes ADD COLUMN status_rota VARCHAR(50) DEFAULT 'Parado';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'caminhoes' AND column_name = 'motorista_atual_nome') THEN
        ALTER TABLE caminhoes ADD COLUMN motorista_atual_nome VARCHAR(200);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'caminhoes' AND column_name = 'turno_atual') THEN
        ALTER TABLE caminhoes ADD COLUMN turno_atual VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'caminhoes' AND column_name = 'updated_at') THEN
        ALTER TABLE caminhoes ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Adicionar coluna caminhao_id na tabela entregas se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'entregas' AND column_name = 'caminhao_id'
    ) THEN
        ALTER TABLE entregas ADD COLUMN caminhao_id INTEGER REFERENCES caminhoes(id);
    END IF;
END $$;

-- Garantir RLS está habilitado
ALTER TABLE caminhoes ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem e criar novas
DROP POLICY IF EXISTS "Usuarios autenticados podem ver caminhoes" ON caminhoes;
DROP POLICY IF EXISTS "Usuarios autenticados podem atualizar caminhoes" ON caminhoes;
DROP POLICY IF EXISTS "Usuarios autenticados podem inserir caminhoes" ON caminhoes;
DROP POLICY IF EXISTS "Usuarios autenticados podem deletar caminhoes" ON caminhoes;

-- Criar políticas RLS
CREATE POLICY "Usuarios autenticados podem ver caminhoes" ON caminhoes
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados podem atualizar caminhoes" ON caminhoes
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados podem inserir caminhoes" ON caminhoes
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados podem deletar caminhoes" ON caminhoes
    FOR DELETE USING (auth.role() = 'authenticated');

-- Inserir caminhões de exemplo se a tabela estiver vazia
INSERT INTO caminhoes (nome, placa, modelo, capacidade_volume_m3, capacidade_peso_kg, ativo)
SELECT 'Caminhão 1', 'ABC-1234', 'Fiat Ducato', 15, 1500, true
WHERE NOT EXISTS (SELECT 1 FROM caminhoes WHERE placa = 'ABC-1234');

INSERT INTO caminhoes (nome, placa, modelo, capacidade_volume_m3, capacidade_peso_kg, ativo)
SELECT 'Caminhão 2', 'DEF-5678', 'VW Delivery', 25, 3000, true
WHERE NOT EXISTS (SELECT 1 FROM caminhoes WHERE placa = 'DEF-5678');
