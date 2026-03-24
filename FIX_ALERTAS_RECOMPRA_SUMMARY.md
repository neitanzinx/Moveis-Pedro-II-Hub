# Fix: Schema mismatch em alertas_recompra - RESUMO

## Problema Identificado
```
Error: column alertas_recompra.habilitado does not exist
Code: 42703
```

Dois arquivos do frontend tentavam usar a coluna `habilitado` que não existia no banco:
- `src/hooks/useAlertasEstoque.jsx` (linha 26)
- `src/pages/AnalisePrecosCompras.jsx` (linha 96)

## Arquivos Afetados no Banco

### Tabela Original (schema.sql - ANTES)
```sql
CREATE TABLE alertas_recompra (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id uuid REFERENCES produtos(id),
    mensagem text,
    lido boolean DEFAULT false,
    status text,
    created_at timestamptz DEFAULT now()
);
```

**Problemas:**
- ❌ Falta `habilitado` (usado como filtro)
- ❌ Falta `tenant_id` (multi-tenant)
- ❌ Falta `fornecedor_id` (referência)
- ❌ Falta `estoque_minimo`/`estoque_ideal` (regras de negócio)
- ❌ Falta `loja_id` (contexto de loja)
- ❌ Falta `produto_nome` (cache)
- ❌ Sem `updated_at` (auditoria)

### Tabela Corrigida (schema.sql - DEPOIS)
```sql
CREATE TABLE alertas_recompra (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001',
    produto_id uuid REFERENCES produtos(id),
    produto_nome varchar(255),
    fornecedor_id uuid REFERENCES fornecedores(id),
    loja_id uuid,
    estoque_minimo integer DEFAULT 10,
    estoque_ideal integer DEFAULT 20,
    habilitado boolean DEFAULT true,  -- ✅ ADICIONADO
    mensagem text,
    lido boolean DEFAULT false,
    status text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),  -- ✅ ADICIONADO
    deleted_at timestamptz
);
```

---

## Arquivos Criados / Modificados

### 1. ✅ Modificado: `schema.sql`
- **Linha:** 387-394
- **Mudança:** Atualizar CREATE TABLE completo com todas as colunas
- **Status:** Já aplicado

### 2. ✅ Criado: `migration_fix_alertas_recompra.sql`
- **Propósito:** Migration SQL para adicionar colunas faltantes ao banco existing
- **Conteúdo:**
  - `ALTER TABLE ADD COLUMN` para cada coluna faltante
  - Criação de índices para performance
  - Enable RLS (Row Level Security)
  - RLS policies para isolamento multi-tenant
- **Size:** 95 linhas
- **Status:** Pronto para executar

### 3. ✅ Criado: `APLICAR_MIGRATION_ALERTAS.md`
- **Propósito:** Guia passo-a-passo para aplicar migration
- **Inclui:**
  - 3 métodos diferentes de aplicação (SQL direto, CLI, PSql)
  - Verificações pós-aplicação
  - Troubleshooting para erros comuns
- **Status:** Pronto para usuário seguir

---

## Como Aplicar

### Passo 1: Executar Migration (escolher 1 opção)

**Opção A - Via Supabase Console (RECOMENDADO para iniciantes)**
1. Ir para supabase.com/dashboard
2. Abrir "Moveis Pedro II" projeto
3. SQL Editor > + New Query
4. Copiar `migration_fix_alertas_recompra.sql`
5. Ctrl+Enter para executar

**Opção B - Via Supabase CLI**
```bash
cp migration_fix_alertas_recompra.sql supabase/migrations/
supabase db push
```

**Opção C - Via psql direto**
```bash
psql -h [host] -U postgres -d postgres -f migration_fix_alertas_recompra.sql
```

### Passo 2: Verificar Implementação

```sql
-- Verificar coluna criada
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'alertas_recompra' 
AND column_name = 'habilitado';

-- Esperado: 1 linha com data_type = 'boolean'
```

### Passo 3: Frontend Fix
Nenhuma mudança necessária! Assim que a coluna existir no banco:
- ✅ useAlertasEstoque.jsx funcionará
- ✅ AnalisePrecosCompras.jsx funcionará
- ✅ Erros no console desaparecerão

---

## Impacto

### Antes da Migration
```
❌ useAlertasEstoque.jsx - Error 42703 (column doesn't exist)
❌ AnalisePrecosCompras.jsx - Error 42703 (column doesn't exist)
❌ Alertas de recompra não funcionam
```

### Depois da Migration
```
✅ useAlertasEstoque.jsx - Funciona normalmente
✅ AnalisePrecosCompras.jsx - Funciona normalmente
✅ Alertas de recompra operacional
✅ Isolamento multi-tenant via RLS
✅ Performance melhorada com índices
```

---

## Arquivos Gerados

```
migration_fix_alertas_recompra.sql      ← Execute isto no banco
APLICAR_MIGRATION_ALERTAS.md            ← Instruções passo-a-passo
FIX_ALERTAS_RECOMPRA_SUMMARY.md         ← Este arquivo
schema.sql                               ← Atualizado (estrutura futura)
```

---

## Changelog

| Data | Mudança | Arquivo |
|------|---------|---------|
| 2026-03-19 | Identificar erro schema | Console |
| 2026-03-19 | Criar migration completa | `migration_fix_alertas_recompra.sql` |
| 2026-03-19 | Atualizar schema definitivo | `schema.sql` |
| 2026-03-19 | Criar instruções aplicação | `APLICAR_MIGRATION_ALERTAS.md` |

---

## Verificação Final (Pós-Deploy)

Após executar migration, se não houver mais erro 42703 nos logs do navegador, significa que:
- ✅ Migration executou com sucesso
- ✅ Schema foi atualizado
- ✅ Queries funcionam novamente

---

## Próximas Etapas

1. ✅ Entender problema (FEITO)
2. ✅ Criar migration (FEITO)
3. ⏳ **Executar migration no banco** ← SEU TURNO
4. ⏳ Validar no navegador
5. ⏳ Testar fluxo de alertas

**Estimado:** 5 minutos para executar + 1 minuto para validar = 6 minutos total

---

## Suporte

- Se receber erro na migration: Ver seção "Se tiver erro" em `APLICAR_MIGRATION_ALERTAS.md`
- Se alertas ainda não funcionar: Fazer hard refresh (Ctrl+Shift+R) no navegador
- Se precisar rollback: Drop columns manualmente ou restaurar backup

---

**Status:** 🟢 PRONTO PARA DEPLOY
