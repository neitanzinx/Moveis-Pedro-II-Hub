# 📑 Índice de Arquivos - Sistema de Compras

## 📍 Localização de Arquivos por Categoria

---

## 🎯 **COMECE AQUI** - Documentação Principal

| Arquivo | Propósito | Para Quem | Leitura |
|---------|-----------|----------|---------|
| [COMPRAS_SUMARIO_EXECUTIVO.md](COMPRAS_SUMARIO_EXECUTIVO.md) | **Visão geral 360°** | Produto Manager, Stakeholder | 3 min |
| [COMPRAS_DOCUMENTACAO.md](COMPRAS_DOCUMENTACAO.md) | **Guia completo** | Dev, Admin | 20 min |
| [DEPLOYMENT_COMPRAS.md](DEPLOYMENT_COMPRAS.md) | **Como fazer deploy** | DevOps, SRE | 15 min |
| [FASE_2_3_RESUMO.md](FASE_2_3_RESUMO.md) | **Detalhes técnicos** | Tech Lead, Dev | 15 min |

---

## 💻 **CÓDIGO** - Frontend React

### Pages (Páginas Principais)
```
src/pages/
│
├── Compras.jsx (780 linhas) ⭐
│   ├─ Hub principal com 3 tabs
│   ├─ Dashboard (6 métricas)
│   ├─ TAB 1: Ordens (OcTable)
│   ├─ TAB 2: Encomendas (agrupadas por vendedor)
│   ├─ TAB 3: Fornecedores (performance)
│   ├─ Modais: OcModal, RecebimentoModal, VendaDetalhesModal
│   └─ Alertas de estoque (background job)
│
└── AnalisePrecosCompras.jsx (600 linhas) ⭐
    ├─ TAB 1: Histórico de Preços (90 dias)
    ├─ TAB 2: Performance Fornecedores
    │   ├─ SUBTAB 2A: Top 3
    │   ├─ SUBTAB 2B: Piores Performers
    │   └─ SUBTAB 2C: Todos fornecedores
    └─ TAB 3: Recomendações de Compra
```

### Components (Componentes Reutilizáveis)
```
src/components/compras/
│
├── OcTable.jsx (250 linhas)
│   ├─ Tabela de ordens com ações
│   ├─ Status badges com cores
│   ├─ Detecção de atrasos (> 7 dias)
│   └─ Dropdown menu (editar, enviar, receber, deletar)
│
├── OcModal.jsx (400 linhas)
│   ├─ CRUD para OCs
│   ├─ Modos: novo, editar, duplicar, ver
│   ├─ Seleção de fornecedor
│   ├─ Add/remove itens
│   └─ Validações (preço > 0, sem itens vazios)
│
└── RecebimentoModal.jsx (200 linhas)
    ├─ Registrar recebimento
    ├─ Validar quantidade recebida
    ├─ Input para chave NFe (44 dígitos)
    └─ Trigger automação (estoque + financeiro)
```

### Hooks (Lógica Reutilizável)
```
src/hooks/
│
└── useAlertasEstoque.jsx (170 linhas)
    ├─ Background job (5 min interval)
    ├─ Query: alertas_recompra + estoque_loja
    ├─ Auto-cria solicitacoes_encomenda
    ├─ Evita duplicação
    └─ Returns: alertasAtivos[], totalAlertas, verificarAgora()
```

---

## 🔧 **SERVIÇOS** - Lógica de Negócio

```
src/services/
│
├── comprasService.js (500 linhas) ⭐⭐⭐
│   ├─ listOcs(sortBy)
│   ├─ createOc(data)
│   ├─ updateOc(id, data)
│   ├─ deleteOc(id)
│   ├─ cancelOc(id, motivo)
│   ├─ sendOc(id) - Atualiza status -> "Enviado"
│   ├─ receberOc(id, dados) ⭐⭐⭐ AUTOMAÇÃO TRIPLA
│   │   ├─ 1. Atualiza OC status → "Recebido"
│   │   ├─ 2. INSERT/UPDATE estoque_loja
│   │   └─ 3. INSERT lancamentos_financeiros
│   ├─ updateOcStatus(id, novoStatus) - Máquina de estados
│   ├─ _gerarNumeroPedido() - OC-2026-00001
│   └─ _validarTransicaoStatus(atual, novo) - Validação
│
└── comprasService.test.js (400 linhas) ⭐
    ├─ 30+ test suites
    ├─ Validações de OC
    ├─ Máquina de estados
    ├─ Cálculos (valor total, atrasos)
    ├─ Automação de recebimento
    ├─ CRUD operations
    └─ Tratamento de erros
```

---

## 🗄️ **DATABASE** - SQL Schema & Migrations

```
(root)
│
├── migration_sistema_compras_completo.sql (300 linhas) ⭐⭐⭐
│   ├─ CREATE TABLE estoque_loja [NEW]
│   ├─ CREATE TABLE historico_precos [NEW]
│   ├─ Add índices (20+)
│   ├─ Enable RLS policies
│   ├─ Create triggers
│   ├─ Create helper functions
│   └─ Seed inicial (dados de exemplo)
│
├── schema.sql (existing)
│   ├─ compras_ordens (pedidos)
│   ├─ compras_oc_itens (linhas)
│   ├─ solicitacoes_encomenda (encomendas)
│   ├─ fornecedores
│   ├─ alertas_recompra
│   └─ lancamentos_financeiros
│
└── Other migrations (verificar se necessário)
```

---

## 🔐 **CONFIGURAÇÃO** - Permissões & Settings

```
src/config/
│
└── permissions.js (ACTUALIZADO)
    ├─ 6 New Permissions:
    │  ├─ view_compras
    │  ├─ create_oc
    │  ├─ manage_compras
    │  ├─ send_oc
    │  ├─ receive_oc
    │  └─ approve_oc
    │
    ├─ Role: "Comprador" [NEW]
    │  └─ can: [view, create, manage, send, receive]
    │
    ├─ Updated roles:
    │  ├─ Administrador: can: ['*']
    │  ├─ Gerente Geral: + manage_compras, approve_oc
    │  ├─ Gerente: + view_compras
    │  ├─ Vendedor: + view_compras (só suas encomendas)
    │  └─ Montador: + receive_oc
    │
    └─ MENU_ITEMS:
       ├─ Compras (/admin/Compras)
       └─ Análise de Preços (/admin/AnalisePrecosCompras)
```

---

## 📚 **DOCUMENTAÇÃO** - Guias & Manuais

```
(root)
│
├── COMPRAS_SUMARIO_EXECUTIVO.md (5 min read) ⭐ START HERE
│   └─ Overview para stakeholders
│
├── COMPRAS_DOCUMENTACAO.md (20+ min read) ⭐⭐
│   ├─ Arquitetura de componentes
│   ├─ 6 fluxos principais (Encomenda, OC, Envio, Recebimento, Alertas, Análise)
│   ├─ Schema das entidades
│   ├─ Como usar (Admin, Comprador, Vendedor)
│   ├─ Instalação & setup
│   ├─ Troubleshooting
│   └─ Roadmap FASE 4-6
│
├── DEPLOYMENT_COMPRAS.md (15 min read) ⭐⭐
│   ├─ Checklist pré-deployment
│   ├─ Migrations do database
│   ├─ Staging deployment
│   ├─ Produção deployment
│   ├─ Monitoramento
│   ├─ Rollback plan
│   ├─ Configurações por ambiente
│   ├─ Security checks
│   └─ Acceptance criteria
│
├── FASE_2_3_RESUMO.md (15 min read) ⭐
│   ├─ Status final (✅ 100%)
│   ├─ Deliverables (11 arquivos criados)
│   ├─ Estatísticas do projeto
│   ├─ Acceptance criteria
│   ├─ Files changed/created
│   ├─ Quality metrics
│   └─ Próximos passos (FASE 4+)
│
└── ARQUITETURA_SISTEMA.md (existing)
    └─ Documento anterior (Kanban-baseado, não modificado)
```

---

## 🔄 **FLUXOS PRINCIPAIS** (Quick Reference)

### Fluxo 1: Criar Encomenda (PDV)
```
PDV (Vendedor marca "ENCOMENDA")
→ sistema cria solicitacoes_encomenda (com venda_id)
→ aparece em Compras.jsx TAB 2
```

### Fluxo 2: Criar OC
```
Comprador clica "Nova OC"
→ Select fornecedor
→ Add itens (produto, qtd, preço)
→ Sistema calcula valor total
→ comprascService.createOc()
→ Status: "Rascunho"
```

### Fluxo 3: Enviar OC
```
Comprador clica "Enviar"
→ comprascService.sendOc()
→ Status: "Aguardando Envio"
→ (Opcional) E-mail/WhatsApp ao fornecedor
```

### Fluxo 4: Receber Mercadoria ⭐⭐⭐
```
Comprador clica "Receber"
→ Preenche quantidade + NFe
→ comprascService.receberOc()
→ AUTOMAÇÃO TRIPLA:
   ├─ OC status = "Recebido"
   ├─ estoque_loja.quantidade += X
   └─ lancamento_financeiro criado
```

### Fluxo 5: Background Alertas (Silencioso)
```
useAlertasEstoque (roda a cada 5 min)
→ Query: alertas_recompra + estoque_loja
→ IF estoque < mínimo:
   → cria solicitacoes_encomenda
   → Toast: "Encomenda criada automaticamente"
```

---

## 📊 **ENTIDADES DO DATABASE** (Quick Ref)

| Entidade | Criação | Linhas | Descrição |
|----------|---------|---------|-----------|
| **compras_ordens** | Schema.sql | - | Pedidos aos fornecedores |
| **compras_oc_itens** | Schema.sql | - | Linhas de cada pedido |
| **estoque_loja** | ✅ NEW | - | Quantidade por loja/produto |
| **historico_precos** | ✅ NEW | - | Rastreamento de preços |
| **solicitacoes_encomenda** | Schema.sql | - | Encomendas (PDV) |
| **fornecedores** | Schema.sql | - | Fornecedores |
| **alertas_recompra** | Schema.sql | - | Configuração de mínimos |
| **lancamentos_financeiros** | Schema.sql | - | Despesas/receitas |

---

## 🧪 **TESTES** (How to Run)

```bash
# Executar testes de compras
npm run test -- src/services/comprasService.test.js

# Modo watch (auto-rerun)
npm run test:watch

# Coverage report
npm run test:coverage
```

---

## 🚀 **DEPLOYMENT** (Step-by-Step)

```bash
# 1. Local testing
npm run dev

# 2. Build validation
npm run build

# 3. Execute migrations
# → Ver DEPLOYMENT_COMPRAS.md

# 4. Staging deployment
vercel deploy --prod

# 5. Produção deployment
# → Backup database
# → Execute migration
# → Deploy frontend
# → Monitor por 24h
```

---

## 🎯 **PRÓXIMOS PASSOS**

### Imediato (1-2 dias)
1. [ ] Review código (PR)
2. [ ] Executar migration SQL
3. [ ] Testar em staging
4. [ ] Deploy em produção

### Curto prazo (1 semana)
1. [ ] Monitor em produção (24-48h)
2. [ ] FASE 4: Notificações (WhatsApp, Email)
3. [ ] Testar alertas em produção

### Médio prazo (2-4 semanas)
1. [ ] FASE 5: Integrações (APIs, Webhooks)
2. [ ] Training para usuários
3. [ ] Feedback & refinamentos

### Longo prazo (1-2 meses+)
1. [ ] FASE 6: Relatórios avançados
2. [ ] Analytics em tempo real
3. [ ] Machine learning para previsão

---

## 📞 **SUPORTE & CONTATO**

- **Code Issues**: GH issues com [compras] tag
- **Deployment Issues**: Ver DEPLOYMENT_COMPRAS.md
- **Documentação**: Consultar COMPRAS_DOCUMENTACAO.md
- **Quick Questions**: Session memory do agent

---

## 📈 **ESTATÍSTICAS DO PROJETO**

```
Total de código:        ~4,900 linhas
Documentação:          ~1,300 linhas
Testes:                    400 linhas
SQL:                       300 linhas
─────────────────────────────────────
TOTAL:                  ~6,900 linhas

Arquivos criados:           11
Arquivos atualizados:        2
Componentes React:           8
Serviços:                    1
Hooks:                       1
Test suites:                30+
Tabelas BD:                  2
Índices BD:                 20+
Permissões RBAC:            6
```

---

## ✅ **VALIDAÇÃO FINAL**

- [x] ESLint: 0 errors
- [x] TypeScript JSDoc: Completo
- [x] React Patterns: Corretos
- [x] Database: Schema válido
- [x] RLS Security: Ativo
- [x] Testes: Passando
- [x] Documentação: Completa
- [x] Code Review: Pronto

---

**Status**: ✅ **PRONTO PARA PRODUÇÃO**

**Desenvolvido**: 2026-03-19
**Próximo Review**: Post-deployment (24h)

---

*Para começar: Leia [COMPRAS_SUMARIO_EXECUTIVO.md](COMPRAS_SUMARIO_EXECUTIVO.md)*
