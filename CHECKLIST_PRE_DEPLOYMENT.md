# ✅ PRÉ-DEPLOYMENT CHECKLIST - Sistema de Compras

## 🎯 Use este checklist antes de fazer deploy

---

## 1️⃣ CÓDIGO & AMBIENTE

### Frontend Build
- [ ] `npm install` rodou sem erros
- [ ] `npm run lint` → 0 errors
- [ ] `npm run build` → Success
- [ ] Nenhuma warning de console na build
- [ ] `npm run dev` → Servidor rodou em http://localhost:5173

### Imports & Dependencies
- [ ] Todos os imports em Compras.jsx resolvidos ✅
- [ ] Todos os imports em AnalisePrecosCompras.jsx resolvidos ✅
- [ ] comprasService importado corretamente
- [ ] useAlertasEstoque importado corretamente
- [ ] Base44 SDK disponível e funcional
- [ ] React Query (TanStack) disponível

### TypeScript / JSDoc
- [ ] Sem erros TypeScript (ou JSDoc)
- [ ] Props documentados
- [ ] Tipos inferidos corretamente
- [ ] Sem `any` genéricos

---

## 2️⃣ BANCO DE DADOS

### Migration SQL
- [ ] `migration_sistema_compras_completo.sql` validado
- [ ] Sintaxe SQL correta (testado em IDE)
- [ ] Backup do database realizado ANTES de executar
- [ ] Migrations podem ser rollback se necessário

### Tabelas Criadas
- [ ] `estoque_loja` existe
  ```sql
  SELECT COUNT(*) FROM estoque_loja;  -- Deve não dar erro
  ```
- [ ] `historico_precos` existe
  ```sql
  SELECT COUNT(*) FROM historico_precos;  -- Deve não dar erro
  ```
- [ ] Índices criados (20+)
  ```sql
  SELECT indexname FROM pg_indexes 
  WHERE tablename IN ('estoque_loja', 'historico_precos');
  ```

### RLS Security
- [ ] RLS habilitado em `estoque_loja`
  ```sql
  SELECT rowsecurity FROM pg_tables WHERE tablename = 'estoque_loja';
  -- Deve retornar: true
  ```
- [ ] RLS habilitado em `historico_precos`
  ```sql
  SELECT rowsecurity FROM pg_tables WHERE tablename = 'historico_precos';
  -- Deve retornar: true
  ```
- [ ] RLS policies criadas (2+)
  ```sql
  SELECT policyname FROM pg_policies 
  WHERE tablename IN ('estoque_loja', 'historico_precos');
  ```

### Data Seed (Opcional)
- [ ] `alertas_recompra` tem dados de exemplo (se necessário)
- [ ] `estoque_loja` populado com locais × produtos
- [ ] `fornecedores` existem

---

## 3️⃣ FUNCIONALIDADES

### Hub Principal (Compras.jsx)
- [ ] Página acessível em `/admin/Compras`
- [ ] Dashboard carrega sem erro
- [ ] 6 métricas visíveis:
  - [ ] Total Gasto
  - [ ] Em Aberto
  - [ ] Recebidas
  - [ ] Atrasadas
  - [ ] Fornecedores
  - [ ] Reabastecer
- [ ] 3 Tabs renderizando:
  - [ ] TAB 1: Ordens (OcTable)
  - [ ] TAB 2: Encomendas (agrupadas)
  - [ ] TAB 3: Fornecedores (resumo)
- [ ] Filtros funcionam (status, fornecedor, vendedor)
- [ ] Tutorial panel abre ao clicar "?" (HelpCircle)

### Análise de Preços (AnalisePrecosCompras.jsx)
- [ ] Página acessível em `/admin/AnalisePrecosCompras`
- [ ] 3 Tabs carregando:
  - [ ] TAB 1: Histórico Preços (busca, filtro, ordenação)
  - [ ] TAB 2: Performance Fornecedores (subtabs funcionando)
  - [ ] TAB 3: Recomendações (baseado em estoque)
- [ ] Gráficos/cards renderizam
- [ ] CSV export funciona

### CRUD de OC
- [ ] Botão "Nova OC" abre OcModal ✅
- [ ] Criar OC com validações:
  - [ ] Sem fornecedor → erro
  - [ ] Sem itens → erro
  - [ ] Item com preço <= 0 → erro
- [ ] Editar OC em Rascunho → funciona
- [ ] Duplicar OC → funciona
- [ ] Status muda após ações (Enviar, Receber)
- [ ] Deletar apenas em Rascunho → validado

### Recebimento
- [ ] Botão "Receber" abre RecebimentoModal ✅
- [ ] Preencher quantidade → validado
- [ ] Preencher NFe (44 dígitos) → validado
- [ ] Confirmar → **AUTOMAÇÃO TRIPLA**:
  - [ ] Status OC atualizado
  - [ ] estoque_loja incrementado
  - [ ] lancamento_financeiro criado
- [ ] Toast de sucesso aparece

### Encomendas
- [ ] TAB 2 mostra encomendas agrupadas por vendedor ✅
- [ ] Clica em encomenda → abre VendaDetalhesModal
- [ ] Modal exibe:
  - [ ] Cliente
  - [ ] Itens da venda
  - [ ] Datas
  - [ ] Status de pagamento

### Background Job (Alertas)
- [ ] useAlertasEstoque ativado em Compras.jsx
- [ ] Console mostra "[useAlertasEstoque] Verificando..." a cada 5 min
- [ ] Card "Reabastecer" fica destaque se há alertas
- [ ] Botão "Ver" abre modal com produtos abaixo do mínimo

---

## 4️⃣ PERMISSÕES (RBAC)

### Permissões Criadas
- [ ] view_compras
- [ ] create_oc
- [ ] manage_compras
- [ ] send_oc
- [ ] receive_oc
- [ ] approve_oc

### Roles Atualizadas
- [ ] Administrador: tem todas as permissions
- [ ] Comprador (NEW): tem view/create/manage/send/receive
- [ ] Gerente Geral: tem manage_compras, approve_oc
- [ ] Gerente: tem view_compras
- [ ] Vendedor: tem view_compras (vê só suas encomendas)
- [ ] Montador: tem receive_oc

### Menu Items
- [ ] "Compras" aparece no menu (icone ShoppingCart)
- [ ] "Análise de Preços" aparece no menu (icone TrendingUp)
- [ ] Links funcionam corretamente
- [ ] Usuário sem permission 'view_compras' recebe erro 403

---

## 5️⃣ SEGURANÇA

### Multi-Tenant (Crucial)
- [ ] Usuário de ORG A não vê dados de ORG B
- [ ] RLS policies validam tenant_id
- [ ] `filterData()` aplicado em queries
- [ ] No hardcoded organization IDs

### Secrets
- [ ] Nenhuma chave de API no código
- [ ] Nenhum SUPABASE_KEY exposto
- [ ] Nenhum token em localStorage (exceto Auth)
- [ ] Todas as queries usam prepared statements (Base44)

### SQL Injection Prevention
- [ ] Base44 SDK sanitiza inputs
- [ ] parameterized queries usadas
- [ ] nenhuma string concatenation direta

---

## 6️⃣ TESTES

### Executar Testes
```bash
npm run test -- src/services/comprasService.test.js
```
- [ ] Todos os testes passam (30+)
- [ ] Nenhuma warning no output
- [ ] Coverage adequada

### Teste Manual (Fluxo Completo)
1. [ ] **Criar OC**:
   - [ ] Acessar Compras → Tab 1
   - [ ] Clica "Nova OC"
   - [ ] Seleciona fornecedor
   - [ ] Adiciona item (produto, qtd, preço)
   - [ ] Salva → OC criada em "Rascunho"

2. [ ] **Enviar OC**:
   - [ ] Entra na OC
   - [ ] Clika "Enviar"
   - [ ] Confirma
   - [ ] Status muda para "Aguardando Envio"

3. [ ] **Receber OC**:
   - [ ] Clika "Receber"
   - [ ] Preenche quantidade + NFe
   - [ ] Confirma
   - [ ] **Validar AUTOMAÇÃO**:
     - OC agora está "Recebido" ✅
     - estoque_loja.quantidade incrementado ✅
     - lancamento_financeiro criado ✅

4. [ ] **Visualizar Encomenda**:
   - [ ] Em Tab 2, clika em uma encomenda
   - [ ] Modal abre com detalhes da venda ✅

5. [ ] **Análise de Preços**:
   - [ ] Acessa AnalisePrecosCompras
   - [ ] Histórico carrega dados
   - [ ] Performance carrega dados
   - [ ] Recomendações carrega dados

---

## 7️⃣ PERFORMANCE

### Query Performance
- [ ] Índices em `compras_ordens` (status, fornecedor_id, created_at)
- [ ] Índices em `estoque_loja` (produto_id, loja_id)
- [ ] Índices em `historico_precos` (produto_id, created_at)
- [ ] Nenhuma query N+1
- [ ] React Query cache funcionando (5 min staleTime)

### Build Size
- [ ] `npm run build` → dist tamanho razoável
- [ ] Nenhum bundle muito grande
- [ ] Code splitting ativo (Vite)

### Frontend Performance
- [ ] Compras.jsx carrega < 2 segundos
- [ ] AnalisePrecosCompras.jsx carrega < 2 segundos
- [ ] Nenhuma lag ao trocar tabs
- [ ] Nenhuma lag ao scrollar

---

## 8️⃣ DOCUMENTAÇÃO

### Arquivos Documentação
- [ ] COMPRAS_SUMARIO_EXECUTIVO.md existe
- [ ] COMPRAS_DOCUMENTACAO.md completo
- [ ] DEPLOYMENT_COMPRAS.md com procedimentos
- [ ] FASE_2_3_RESUMO.md com detalhes
- [ ] migration_sistema_compras_completo.sql documentado
- [ ] INDICE_COMPRAS.md criado

### Código Documentado
- [ ] Funções têm JSDoc comments
- [ ] Props documentados
- [ ] Fluxos explicados em comentários
- [ ] Nenhuma função "mágica" sem explicação

---

## 9️⃣ DEPLOYMENT STAGING

### Pré-Staging
- [ ] Backup de produção realizado
- [ ] Feature branch testada localmente
- [ ] PR review completo

### Staging Build
```bash
vercel deploy --staging
```
- [ ] Build sucesso
- [ ] Página acessível em staging.example.com

### Staging Testing
- [ ] Executar migration em staging database
- [ ] Testar fluxo completo (Criar → Enviar → Receber)
- [ ] Testar permissões (sem acesso = 403)
- [ ] Testar RLS (org A não vê org B)
- [ ] Verificar logs (nenhum error)
- [ ] Monitorar por 1-2 horas

---

## 🔟 DEPLOYMENT PRODUÇÃO

### Pré-Produção
- [ ] Code review aprovado por 2 reviewers
- [ ] Todos os testes passando
- [ ] Staging testado com sucesso
- [ ] Backup de produção realizado (IMPORTANTE)

### Produção Deploy
```bash
vercel deploy --prod
```
- [ ] Build sucesso
- [ ] Página acessível em example.com
- [ ] Menu items visíveis

### Produção Testing
- [ ] Executar migration (com backup validado)
- [ ] Verificar tabelas criadas
- [ ] Testar fluxo completo
- [ ] Monitorar por 24 horas

### Rollback Plan (Se Necessário)
- [ ] Revert código: `git revert <commit>`
- [ ] Rollback database: `psql < backup.sql`
- [ ] Re-deploy frontend

---

## 📊 FINAL CHECKLIST

### Tudo Completo?
- [ ] Código: ESLint ✅, Build ✅, Testes ✅
- [ ] Database: Migration ✅, Tabelas ✅, RLS ✅
- [ ] Funcionalidades: CRUD ✅, Automação ✅, Analytics ✅
- [ ] Permissões: 6 permissions ✅, Menu items ✅
- [ ] Documentação: 6 arquivos ✅
- [ ] Segurança: RLS ✅, Secrets ✅, SQL injection ✅
- [ ] Performance: Índices ✅, Cache ✅
- [ ] Staging: Testado ✅
- [ ] Produção: Pronto ✅

---

## ✅ STATUS FINAL

```
┌─────────────────────────────────────┐
│ ✅ PRONTO PARA PRODUÇÃO             │
│                                     │
│ Data: 2026-03-19                    │
│ Desenvolvedor: [Your name]          │
│ Revisor: [Reviewer name]            │
│                                     │
│ Próximo: Deploy em staging          │
│ Depois: Deploy em produção          │
│ Monitorar: 24 horas                 │
└─────────────────────────────────────┘
```

---

**Imprima este checklist e marque cada item antes de fazer deploy!**

_Desenvolvido com 💖 para Moveis Pedro II_
