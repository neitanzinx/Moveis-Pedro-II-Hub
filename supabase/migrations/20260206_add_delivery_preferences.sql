-- Add delivery preferences columns to clientes table
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS dias_bloqueados_entrega text[] DEFAULT '{}';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS turno_bloqueado_entrega text DEFAULT '';

comment on column clientes.dias_bloqueados_entrega is 'Dias da semana que o cliente NÃO pode receber entrega (ex: ["Segunda", "Terça"])';
comment on column clientes.turno_bloqueado_entrega is 'Turno que o cliente NÃO pode receber entrega (ex: "Manhã", "Tarde", or empty string for none)';
