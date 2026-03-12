-- Create WhatsApp Message Queue Table
CREATE TABLE IF NOT EXISTS whatsapp_message_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone TEXT NOT NULL,
    message TEXT NOT NULL,
    options JSONB,
    status TEXT DEFAULT 'pending', -- pending, sent, failed
    attempts INTEGER DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    venda_id BIGINT REFERENCES vendas(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE whatsapp_message_queue ENABLE ROW LEVEL SECURITY;

-- Create Policy
DROP POLICY IF EXISTS all_whatsapp_message_queue ON whatsapp_message_queue;
CREATE POLICY all_whatsapp_message_queue ON whatsapp_message_queue 
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_status ON whatsapp_message_queue(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_created_at ON whatsapp_message_queue(created_at);
