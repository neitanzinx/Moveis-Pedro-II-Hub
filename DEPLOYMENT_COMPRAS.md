# 🚀 Guia de Deployment - Sistema de Compras

## ✅ Checklist de Deployment

### Pré-Deployment (Local)

- [ ] **Executar testes**
  ```bash
  npm run test -- src/services/comprasService.test.js
  npm run test:watch
  ```

- [ ] **Validar linting**
  ```bash
  npm run lint
  ```

- [ ] **Verificar erros TypeScript (JSDoc)**
  ```bash
  npm run build
  ```

- [ ] **Testar rotas manualmente**
  ```bash
  npm run dev
  # Acessar: http://localhost:5173/admin/Compras
  # Acessar: http://localhost:5173/admin/AnalisePrecosCompras
  ```

---

### Migration do Database

#### 1. Backup (IMPORTANTE)
```bash
# Via Supabase CLI
supabase db pull > backup_$(date +%Y%m%d_%H%M%S).sql

# Ou via psql
pg_dump supabase > backup.sql
```

#### 2. Executar Migration Completa
```sql
-- Opção A: Via Supabase SQL Editor
-- 1. Copy-paste: migration_sistema_compras_completo.sql
-- 2. Executar
-- 3. Verificar sucesso

-- Opção B: Via CLI
supabase db execute migration_sistema_compras_completo.sql
```

#### 3. Validar Tabelas Criadas
```sql
-- Verificar estoque_loja
SELECT COUNT(*) FROM estoque_loja;

-- Verificar historico_precos
SELECT COUNT(*) FROM historico_precos;

-- Verificar índices criados
SELECT indexname FROM pg_indexes WHERE tablename IN ('estoque_loja', 'historico_precos', 'compras_ordens');

-- Verificar RLS habilitado
SELECT tablename, rowsecurity FROM pg_tables 
WHERE tablename IN ('estoque_loja', 'historico_precos');
```

---

### Configuração do Supabase

#### 1. Seed Inicial (Dados de Exemplo)
```sql
-- Popular alertas_recompra com produtos existentes
INSERT INTO alertas_recompra (
  tenant_id,
  produto_id,
  fornecedor_id,
  estoque_minimo,
  estoque_ideal,
  habilitado,
  produto_nome
)
SELECT 
  '00000000-0000-0000-0000-000000000001'::uuid,
  p.id,
  (SELECT id FROM fornecedores LIMIT 1),
  10,
  20,
  true,
  p.nome
FROM produtos p
WHERE p.ativo = true
AND p.id NOT IN (SELECT DISTINCT produto_id FROM alertas_recompra WHERE produto_id IS NOT NULL)
LIMIT 50
ON CONFLICT DO NOTHING;
```

#### 2. Inicializar estoque_loja
```sql
-- Criar entrada de estoque para cada produto em cada loja
INSERT INTO estoque_loja (
  tenant_id,
  loja_id,
  produto_id,
  quantidade,
  quantidade_reservada,
  preco_custo,
  preco_venda
)
SELECT 
  l.tenant_id,
  l.id,
  p.id,
  0,  -- Começar com zero (será preenchido no recebimento)
  0,
  NULL,
  NULL
FROM lojas l
CROSS JOIN produtos p
WHERE l.ativo = true
AND p.ativo = true
AND NOT EXISTS (
  SELECT 1 FROM estoque_loja e 
  WHERE e.loja_id = l.id AND e.produto_id = p.id
)
LIMIT 1000
ON CONFLICT DO NOTHING;
```

#### 3. Atualizar Permissões no Banco
```sql
-- Verificar que permissions_compras foram criadas
SELECT * FROM role_permissions WHERE permission LIKE 'view_compras' OR permission LIKE 'create_oc';

-- Se não existem, inserir manualmente:
INSERT INTO role_permissions (role, permission, created_at)
VALUES
  ('Administrador', 'view_compras', now()),
  ('Administrador', 'create_oc', now()),
  ('Administrador', 'manage_compras', now()),
  ('Administrador', 'send_oc', now()),
  ('Administrador', 'receive_oc', now()),
  ('Administrador', 'approve_oc', now()),
  ('Comprador', 'view_compras', now()),
  ('Comprador', 'create_oc', now()),
  ('Comprador', 'manage_compras', now()),
  ('Comprador', 'send_oc', now()),
  ('Comprador', 'receive_oc', now())
ON CONFLICT DO NOTHING;
```

---

### Deployment para Staging

#### 1. Build
```bash
# Antes de fazer merge em main/develop
npm run build

# Se houver erros, corrigir antes de continuar
```

#### 2. Deploy Frontend
```bash
# Via Vercel (ou seu host)
vercel deploy --prod

# Ou manual:
# 1. Fazer push para branch deploy/staging
# 2. CI/CD pipeline executa build e deploy
```

#### 3. Testes em Staging
```bash
# Acessar: https://staging.moveispedroii.com/admin/Compras
# 1. Criar OC teste
# 2. Enviar OC
# 3. Receber OC
# 4. Verificar estoque atualizado
# 5. Verificar lançamento financeiro criado
# 6. Verificar Análise de Preços carrega dados
```

#### 4. Validar RLS (Importante)
```javascript
// No console do navegador, testar isolamento multi-tenant:
// 1. Login como Vendedor (organizacao A)
// 2. Verificar que não vê OCs da organização B
// 3. Login como Administrador (org A)
// 4. Verificar que vê tudo

// Logs esperados no console:
// "[useAlertasEstoque] Verificando alertas de estoque mínimo..."
```

---

### Deployment para Produção

#### 1. Code Review
- [ ] PR aprovada por 2 reviewers
- [ ] Testes passando
- [ ] Sem console.logs de debug
- [ ] Sem tokens/secrets no código

#### 2. Backup Produção
```bash
# MUITO IMPORTANTE
supabase db pull --prod > backup_prod_$(date +%Y%m%d_%H%M%S).sql

# Ou via psql
PGPASSWORD=$DB_PASSWORD pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME > backup_prod.sql
```

#### 3. Executar Migration em Produção
```sql
-- Executar migration_sistema_compras_completo.sql no Supabase Prod
-- NO SQL EDITOR (não via CLI para garantir visibilidade)

-- Após executar, validar:
SELECT COUNT(*) FROM estoque_loja;  -- Deve retornar lista de lojas x produtos
SELECT COUNT(*) FROM historico_precos;  -- Pode estar vazio (será preenchido gradualmente)
```

#### 4. Deploy Frontend Produção
```bash
# Via Vercel
vercel deploy --prod

# Aguardar build completo
# Verificar: https://moveispedroii.com/admin/Compras
```

#### 5. Monitoramento Pós-Deploy
```javascript
// Habilitar console logs de monitoring:
// src/pages/Compras.jsx: Linha 41
// useAlertasEstoque ativado: true

// Monitorar:
// 1. useAlertasEstoque logs a cada 5 min → "[useAlertasEstoque] Verificando..."
// 2. React Query invalidations → Cache limpo corretamente
// 3. Toast notifications → Sucesso/erro visíveis
// 4. Database performance → Índices funcionando
```

#### 6. Rollback Plan
```bash
# Se problema detectado, rollback imediato:

# Opção 1: Revert código
git revert <commit-hash>
git push
npm run build
vercel deploy --prod

# Opção 2: Rollback database
# Restaurar backup_prod.sql
psql -U $DB_USER -d $DB_NAME < backup_prod.sql

# Opção 3: Pause RLS policies
-- Desabilitar RLS temporariamente para debug:
ALTER TABLE estoque_loja DISABLE ROW LEVEL SECURITY;
-- (re-habilitar após fix)
ALTER TABLE estoque_loja ENABLE ROW LEVEL SECURITY;
```

---

## 📋 Configurações por Ambiente

### Desenvolvimento
```javascript
// .env.local
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=eyJhbGc... (supabase test key)

// useAlertasEstoque ativado: true
// Logs habilitados: console.log() visível
```

### Staging
```javascript
// .env.staging
VITE_SUPABASE_URL=https://staging-supabase.com
VITE_SUPABASE_ANON_KEY=eyJhbGc... (staging key)

// useAlertasEstoque ativado: true
// Logs habilitados: Sentry logs
```

### Produção
```javascript
// .env.production
VITE_SUPABASE_URL=https://prod-supabase.com
VITE_SUPABASE_ANON_KEY=eyJhbGc... (prod key)

// useAlertasEstoque ativado: true
// Logs habilitados: Sentry + CloudWatch
// Toast notifications: Habilitadas
// Error tracking: Sentry
```

---

## 🔐 Segurança

### Verificações Pré-Deploy
- [ ] Sem hardcoded secrets
  ```bash
  grep -r "SUPABASE_KEY\|DATABASE_URL\|API_KEY" src/
  ```

- [ ] RLS policies validadas
  ```sql
  SELECT * FROM pg_policies;
  ```

- [ ] Permissões RBAC corretas
  ```sql
  SELECT * FROM role_permissions WHERE permission LIKE '%compra%';
  ```

- [ ] Sem SQL injection risks
  - Todas as queries usam parameterized queries
  - Base44 SDK sanitiza inputs

---

## 📊 Monitoring

### Métricas Críticas a Monitorar

```javascript
// Evento 1: Nova OC criada
console.log('[COMPRAS] Nova OC criada:', numeroOc);

// Evento 2: OC enviada
console.log('[COMPRAS] OC enviada ao fornecedor:', numeroOc);

// Evento 3: Mercadoria recebida
console.log('[COMPRAS] Estoque incrementado:', produtoId, quantidadeAdicionada);

// Evento 4: Alerta criado (background)
console.log('[useAlertasEstoque] Encomenda criada automaticamente para:', produtoNome);

// Evento 5: Erro crítico
console.error('[COMPRAS] Erro ao receber OC:', errorMessage);
```

### Dashboard de Monitoring (Sugestão Futura)
- [ ] Real-time OC status chart
- [ ] Estoque trending over time
- [ ] Fornecedor KPIs (atraso %, taxa de erro)
- [ ] Alerts timeline
- [ ] Query performance (slow query log)

---

## 🧹 Cleanup Pós-Deploy

### Remover código de teste/debug
```bash
grep -r "console.log\|debugger\|TODO\|HACK\|FIXME" src/
```

### Validar build size
```bash
npm run build
# Verificar: dist/index.html tamanho < 500KB (gzip)
# Verificar: JavaScript bundles otimizados
```

### Limpar cache
```bash
# Supabase
supabase db reset  # SOMENTE em dev!

# Frontend
rm -rf node_modules/.vite
npm run build
```

---

## 🎯 Acceptance Criteria

Considere o deployment bem-sucedido quando:

- ✅ Todas as migrations executadas sem erro
- ✅ Tabelas criadas: estoque_loja, historico_precos
- ✅ RLS policies ativas e funcionando
- ✅ useState de Compras.jsx acessível em /admin/Compras
- ✅ Tab 1 (Ordens) mostra OCs existentes
- ✅ Tab 2 (Encomendas) mostra encomendas agrupadas
- ✅ Tab 3 (Fornecedores) mostra resumo por fornecedor
- ✅ Dashboard exibe 6 métricas correctas
- ✅ AnalisePrecosCompras carrega sem erro
- ✅ useAlertasEstoque roda a cada 5 min (verificar logs)
- ✅ Testar fluxo completo: Criar OC → Enviar → Receber → Estoque atualizado
- ✅ Usuários com permissions 'view_compras' conseguem acessar
- ✅ Usuários sem permission recebem erro 403
- ✅ Nenhum data leak entre tenants (RLS funcionando)

---

**Data**: 2026-03-19
**Status**: ✅ Pronto para Deployment
**Próximos Passos**: Execute deployment e monitore por 24h
