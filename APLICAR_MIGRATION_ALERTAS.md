# Fix: Aplicar Migration - Alertas Recompra

## Problema
```
Error: column alertas_recompra.habilitado does not exist
```

A tabela `alertas_recompra` está incompleta no banco de dados. Faltam as colunas que o código espera:
- `habilitado` - para ativar/desativar alertas
- `tenant_id` - isolamento multi-tenant
- `fornecedor_id` - fornecedor sugerido
- `estoque_minimo` - quantidade mínima
- `estoque_ideal` - quantidade ideal
- `loja_id` - loja específica
- `produto_nome` - cache do nome

## Solução

### Opção 1: Aplicar via SQL direto (Supabase Console)

1. Acessar https://supabase.com/dashboard
2. Selecionar projeto "Moveis Pedro II"
3. Ir para **SQL Editor** (no menu lateral esquerdo)
4. Clicar **+ New Query**
5. Copiar o conteúdo de `migration_fix_alertas_recompra.sql`
6. Clicar **Run** (atalho: Ctrl+Enter)
7. Verificar se executou sem erros

### Opção 2: Aplicar via Supabase CLI (Recomendado)

```bash
# 1. Copiar migration para pasta correta
cp migration_fix_alertas_recompra.sql supabase/migrations/

# 2. Fazer push das migrations
supabase db push

# 3. Verificar status
supabase migration list
```

### Opção 3: SQL direto no terminal (Advanced)

```bash
# Se tiver acesso direto ao banco (psql)
psql -h <host> -U postgres -d postgres -f migration_fix_alertas_recompra.sql
```

---

## Verificar se aplicou corretamente

Após executar a migration, verificar no Supabase Console:

### Via SQL Query:
```sql
-- Verificar estrutura da tabela
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'alertas_recompra'
ORDER BY ordinal_position;
```

**Resultado esperado:** Todas estas colunas devem aparecer:
- ✅ `id` (uuid)
- ✅ `tenant_id` (uuid)
- ✅ `produto_id` (uuid)
- ✅ `produto_nome` (character varying)
- ✅ `fornecedor_id` (uuid)
- ✅ `loja_id` (uuid)
- ✅ `estoque_minimo` (integer)
- ✅ `estoque_ideal` (integer)
- ✅ `habilitado` (boolean) ← **Crítica!**
- ✅ `mensagem` (text)
- ✅ `lido` (boolean)
- ✅ `status` (text)
- ✅ `created_at` (timestamp with time zone)
- ✅ `updated_at` (timestamp with time zone)
- ✅ `deleted_at` (timestamp with time zone)

### Verificar índices:
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'alertas_recompra';
```

**Resultado esperado:** Múltiplos índices para performance:
- ✅ `idx_alertas_recompra_tenant_id`
- ✅ `idx_alertas_recompra_produto_id`
- ✅ `idx_alertas_recompra_habilitado`
- ✅ (e outros)

---

## Após aplicar a migration

1. **Frontend se auto-recupera** - Não precisa rebuild
2. **Verificar no console do navegador** - Erro deve desaparecer
3. **Checar atividade de alertas** - useAlertasEstoque.jsx funciona novamente

---

## Se tiver erro na migration

### Erro: "table does not exist"

Significa que a tabela `alertas_recompra` ainda não foi criada. Neste caso:

```sql
-- Criar a tabela primeiro
CREATE TABLE alertas_recompra (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001',
    produto_id uuid REFERENCES produtos(id),
    produto_nome varchar(255),
    fornecedor_id uuid REFERENCES fornecedores(id),
    loja_id uuid,
    estoque_minimo integer DEFAULT 10,
    estoque_ideal integer DEFAULT 20,
    habilitado boolean DEFAULT true,
    mensagem text,
    lido boolean DEFAULT false,
    status text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    deleted_at timestamptz
);

-- Depois aplicar os índices
CREATE INDEX idx_alertas_recompra_tenant_id ON alertas_recompra(tenant_id);
CREATE INDEX idx_alertas_recompra_produto_id ON alertas_recompra(produto_id);
CREATE INDEX idx_alertas_recompra_habilitado ON alertas_recompra(habilitado);
```

### Erro: "column already exists"

Significa que algumas colunas já foram criadas. Ignorar a mensagem - ela usa `ADD COLUMN IF NOT EXISTS` que é segura.

---

## Verificação Final

Após migration, recarregar o frontend:

```bash
npm run dev
# ou
npm run build && npm preview
```

Acessar página de Compras. Logs anteriores de erro desapareceram? ✅ Sucesso!

---

## Timeline

- **Criação:** 2026-03-19
- **Status:** 🟢 Pronto para aplicação
- **Impacto:** Alto (Fix crítico para Compras)
- **Reversível:** Sim (apenas DROP COLUMN se necessário)
