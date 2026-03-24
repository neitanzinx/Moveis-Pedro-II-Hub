# 📦 Sistema de Compras - Documentação Completa

## 📋 Visão Geral

O **Sistema de Compras** é um módulo integrado ao Moveis Pedro II que gerencia:
- **Ordens de Compra (OC)**: Pedidos aos fornecedores
- **Encomendas**: Solicitações de reposição geradas a partir do PDV
- **Recebimento**: Entrada de mercadorias no estoque
- **Análise de Preços**: Histórico e performance de fornecedores
- **Alertas de Estoque**: Monitoramento automático de níveis mínimos

---

## 🏗️ Arquitetura de Componentes

```
src/pages/
├── Compras.jsx                    # Hub principal (Table + 3 Tabs)
│   ├── Tab 1: Ordens (OcTable)
│   ├── Tab 2: Encomendas (por Vendedor)
│   ├── Tab 3: Fornecedores (Performance)
│   └── Dashboard (6 Métricas)
│
├── AnalisePrecosCompras.jsx       # Analytics isolado
│   ├── Histórico de Preços (90 dias)
│   ├── Performance de Fornecedores
│   └── Recomendações de Compra
│
src/components/compras/
├── OcTable.jsx                    # Tabela de pedidos (reusável)
├── OcModal.jsx                    # CRUD de pedidos
├── RecebimentoModal.jsx           # Registro de recebimento
│
src/services/
├── comprasService.js              # Lógica de negócio
├── comprasService.test.js         # Testes integrados
│
src/hooks/
├── useAlertasEstoque.jsx          # Background job (5 min)
│   └── Auto-cria encomendas quando estoque < mínimo
│
src/config/
├── permissions.js                 # 6 new permissions para Compras
    ├── view_compras
    ├── create_oc
    ├── manage_compras
    ├── send_oc
    ├── receive_oc
    └── approve_oc
```

---

## 🎯 Fluxos Principais

### Fluxo 1: Criação de Encomenda (PDV → Compras)

```
1. PONTO DE VENDA (PDV)
   │
   ├─ Vendedor marca produto como "ENCOMENDA"
   │  (zero estoque, cliente aceita aguardar)
   │
   └──> solicitacoes_encomenda
        ├─ venda_id: ID da venda original
        ├─ produto_id: ID do produto
        ├─ cliente_nome: Nome do cliente
        ├─ quantidade: Quantidade pedida
        ├─ status: "Pendente"
        └─ created_at: Data criação

2. TAB 2: ENCOMENDAS (Compras.jsx)
   │
   ├─ Vendedor visualiza suas encomendas
   │
   ├─ Agrupa por vendedor
   │
   └─ Clica em encomenda → Abre modal com VENDA ORIGINAL
      ├─ Cliente
      ├─ Itens vendidos
      ├─ Datas
      └─ Status de pagamento
```

### Fluxo 2: Criação de Ordem de Compra

```
1. SETOR DE COMPRAS
   │
   ├─ Acessa TAB 1: Ordens
   │
   ├─ Clica "Nova OC"
   │
   └──> OcModal (modo: novo)
        │
        ├─ Seleciona FORNECEDOR
        │
        ├─ Adiciona ITENS
        │  ├─ Produto
        │  ├─ Quantidade
        │  └─ Preço Unitário
        │
        ├─ Sistema calcula:
        │  ├─ Valor Total: sum(qtd × preço)
        │  ├─ Número Pedido: OC-2026-00001 (auto)
        │  └─ Status: "Rascunho"
        │
        └─> comprasService.createOc()

2. DATABASE (Supabase)
   │
   └──> INSERT compras_ordens
        ├─ numero_pedido: "OC-2026-00001"
        ├─ fornecedor_id
        ├─ valor_total: 5000.00
        ├─ status: "Rascunho"
        ├─ centro_custo_id (opcional)
        ├─ data_previsao_entrega
        └─ created_at

3. REACT QUERY INVALIDATION
   │
   └──> queryClient.invalidateQueries(['compras'])
        └─ OcTable se atualiza automaticamente
```

### Fluxo 3: Envio de OC ao Fornecedor

```
1. TABELA OC (OcTable.jsx)
   │
   ├─ Botão: "Enviar" (visible se status = "Rascunho")
   │
   ├─ Validações:
   │  ├─ Permissão: can('send_oc')
   │  ├─ Status: deve ser "Rascunho"
   │  └─ Itens: não vazio
   │
   └─> Clica "Enviar"

2. FLUXO DE ENVIO
   │
   ├─ Confirmação: "Deseja enviar OC-2026-00001?"
   │
   ├─ Atualiza status: "Rascunho" → "Aguardando Envio"
   │
   ├─ (Opcional) Envia e-mail ao fornecedor
   │  └─> Via API externa (Resend, SendGrid, etc)
   │
   ├─ (Opcional) Envia WhatsApp
   │  └─> Via robo-whatsapp-agendamentos
   │
   └─> React Query invalidation

3. NOTIFICAÇÃO
   │
   ├─ Toast: "OC-2026-00001 enviada com sucesso"
   │
   └─ Tab 1 atualizada em tempo real
```

### Fluxo 4: Recebimento de Mercadorias

```
1. TABELA OC
   │
   ├─ Status: "Aguardando Envio" ou "Enviado"
   │
   ├─ Botão: "Receber"
   │
   └─> Clica "Receber"

2. RECEBIMENTO MODAL (RecebimentoModal.jsx)
   │
   ├─ Mostra itens da OC
   │
   ├─ Para cada item:
   │  ├─ Quantidade pedida
   │  ├─ INPUT: Quantidade recebida
   │  ├─ Input: Chave NFe (44 dígitos)
   │  └─ Validação: qtd recebida ≤ qtd pedida
   │
   ├─ Botão: "Confirmar Recebimento"
   │
   └─> comprasService.receberOc(ocId, dados)

3. AUTOMAÇÃO: receberOc() → 3 MUDANÇAS SIMULTÂNEAS
   │
   ├─ A. Atualiza compras_ordens
   │     └─ status: "Recebido"
   │
   ├─ B. INSERT estoque_loja (Incrementa quantidade)
   │     ├─ INSERT: SELECT ... ON CONFLICT UPDATE
   │     ├─ estoque_loja.quantidade += qtd_recebida
   │     ├─ Calcula: quantidade_disponivel = qtd - reservado
   │     └─ Registra: ultimo_recebimento = now()
   │
   └─ C. INSERT lancamentos_financeiros (Despesa)
         ├─ tipo: "Despesa"
         ├─ categoria: "Compras"
         ├─ valor: valor_total_oc
         ├─ descricao: "Recebimento OC-2026-00001"
         ├─ nfe_key: chave fornecida
         ├─ data: now()
         └─ status: "Pendente" (aguarda confirmação)

4. NOTIFICAÇÃO SUCESSO
   │
   ├─ Toast: "OC recebida! +10 unidades em estoque"
   │
   └─ Dashboard atualizado:
      ├─ Métrica: "Em Aberto" decrementada
      ├─ Métrica: "Recebidas" incrementada
      └─ Card: "Reabastecer" removido se necessário
```

### Fluxo 5: Alertas de Estoque (Background)

```
1. useAlertasEstoque HOOK
   │
   ├─ Executa a cada 5 MINUTOS (setInterval)
   │
   ├─ Query 1: Busca alertas_recompra (habilitado=true)
   │    └─ Cada alerta tem: produto_id, estoque_minimo
   │
   ├─ Query 2: Busca estoque_loja (quantidade atual)
   │
   ├─ Comparação:
   │    └─ IF estoque_loja.quantidade < alerta.estoque_minimo
   │       THEN criar SolicitacaoEncomenda
   │
   ├─ Validação: Busca se já existe Pendente
   │    └─ Se SIM, não cria duplicado
   │    └─ Se NÃO, cria nova
   │
   └─ Mutations:
       └─ criarEncomendaMutation.mutate({ ... })
          └─ Toast: "Encomenda criada automaticamente para Produto X"

2. DASHBOARD: Card "Reabastecer"
   │
   ├─ totalAlertas = alertasAtivos.length
   │
   ├─ Se totalAlertas > 0:
   │  ├─ Card fica com background: bg-amber-50
   │  ├─ Número fica vermelho: text-amber-600
   │  └─ Botão: "Ver" → Abre modal
   │
   └─ Modal lista produtos:
      ├─ Nome
      ├─ Estoque atual vs mínimo
      ├─ Botão: "Nova OC"
      └─ Click "Nova OC" → Abre OcModal pré-preenchido
```

### Fluxo 6: Análise de Preços (AnalisePrecosCompras.jsx)

```
1. 3 TABS INDEPENDENTES

   TAB 1: Histórico de Preços
   ├─ Query: historico_precos (últimos 90 dias)
   ├─ Filtros:
   │  ├─ Produto (busca)
   │  ├─ Fornecedor (select)
   │  ├─ Data início/fim
   │  └─ Ordenação: Data DESC | Delta % DESC | Delta % ASC
   ├─ Colunas: Data, Produto, Fornecedor, Preço Anterior, Preço Novo, Variação %
   ├─ Badge color: Verde se variação < 0 | Vermelho se > 0
   └─ Botão: "Exportar CSV"

   TAB 2: Performance de Fornecedores
   ├─ SUBTAB 2A: Top 3 (por volume gasto)
   │  ├─ Card com: Nome, Total gasto, Qtd OC, Qtd itens
   │  └─ Status breakdown: Rascunho, Enviado, Recebido
   │
   ├─ SUBTAB 2B: Piores Performers (por atraso)
   │  ├─ Calcula: Taxa atraso = (OC atrasadas / total OC)
   │  ├─ Mostra: Fornecedor, Taxa atraso %, Dias médios
   │  └─ Útil para renegociação de prazos
   │
   └─ SUBTAB 2C: Todos fornecedores
      ├─ Tabela completa
      └─ Sort por: Gasto total, Taxa atraso, Prazo médio

   TAB 3: Recomendações de Compra
   ├─ Baseado em: alertas_recompra + estoque_loja
   ├─ Cálculo:
   │  ├─ estoque_atual = estoque_loja.quantidade
   │  ├─ qtd_sugerida = MAX(min*2 - atual, min)
   │  ├─ fornecedor_top = histórico preço mais recente
   │  └─ urgencia = "alta" se atual < min | "média" otherwise
   ├─ Sort: Urgência (alta primeiro) → Quantidade (maior primeiro)
   └─ Colunas:
      ├─ Produto
      ├─ Estoque Atual vs Mínimo
      ├─ Quantidade Sugerida
      ├─ Fornecedor Recomendado
      ├─ Preço Unitário
      └─ Botão: "Criar OC"
```

---

## 📊 Entidades do Database

### 1. compras_ordens
```sql
CREATE TABLE compras_ordens (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  numero_pedido VARCHAR(50) UNIQUE,     -- OC-2026-00001
  fornecedor_id UUID NOT NULL,
  fornecedor_nome VARCHAR(255),
  valor_total NUMERIC(12, 2),
  
  centro_custo_id UUID,                 -- Opcional
  data_criacao TIMESTAMP,
  data_previsao_entrega DATE,
  data_envio TIMESTAMP,
  data_recebimento TIMESTAMP,
  
  status VARCHAR(50),                   -- Máquina de estados
  observacoes TEXT,
  
  nfe_chave VARCHAR(44),                -- Chave da nota fiscal
  valor_frete NUMERIC(12, 2),
  valor_impostos NUMERIC(12, 2),
  
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Estados Válidos**: Rascunho → Aguardando Envio → Enviado → Recebido
**Campos Editáveis** (por estado):
- Rascunho: Todos
- Aguardando Envio: observacoes, data_previsao_entrega
- Enviado: observacoes apenas
- Recebido: Nenhum (apenas visualizar)

### 2. compras_oc_itens
```sql
CREATE TABLE compras_oc_itens (
  id UUID PRIMARY KEY,
  oc_id UUID NOT NULL REFERENCES compras_ordens,
  
  produto_id UUID NOT NULL,
  produto_nome VARCHAR(255),
  
  quantidade INTEGER,
  quantidade_recebida INTEGER DEFAULT 0,
  preco_unitario NUMERIC(12, 2),
  valor_subtotal NUMERIC(12, 2),         -- qtd × preco
  
  status VARCHAR(50),                    -- Pendente, Parcial, Recebido
  
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### 3. solicitacoes_encomenda
```sql
CREATE TABLE solicitacoes_encomenda (
  id UUID PRIMARY KEY,
  
  venda_id UUID NOT NULL,                -- FK para venda original
  produto_id UUID NOT NULL,
  cliente_nome VARCHAR(255),
  
  quantidade INTEGER,
  oc_id UUID REFERENCES compras_ordens,  -- Vinculação após criação OC
  
  status VARCHAR(50),                    -- Pendente, Em Compra, Recebida, Cancelada
  
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### 4. estoque_loja
```sql
CREATE TABLE estoque_loja (
  id UUID PRIMARY KEY,
  tenant_id UUID,
  
  loja_id UUID NOT NULL,
  produto_id UUID NOT NULL,
  
  quantidade INTEGER DEFAULT 0,
  quantidade_reservada INTEGER DEFAULT 0,
  quantidade_disponivel GENERATED ALWAYS AS (quantidade - quantidade_reservada),
  
  preco_custo NUMERIC(12, 2),
  preco_venda NUMERIC(12, 2),
  
  ultimo_recebimento TIMESTAMP,
  
  UNIQUE(tenant_id, loja_id, produto_id)
);
```

### 5. historico_precos
```sql
CREATE TABLE historico_precos (
  id UUID PRIMARY KEY,
  tenant_id UUID,
  
  produto_id UUID NOT NULL,
  fornecedor_id UUID,
  
  preco_anterior NUMERIC(12, 2),
  preco_novo NUMERIC(12, 2),
  delta_percentual NUMERIC(5, 2),        -- Calulcado: (novo - anterior) / anterior * 100
  
  numero_oc VARCHAR(50),
  quantidade_pedida INTEGER,
  prazo_entrega_dias INTEGER,
  
  produto_nome VARCHAR(255),
  fornecedor_nome VARCHAR(255),
  
  created_by UUID,
  created_at TIMESTAMP
);
```

### 6. alertas_recompra
```sql
CREATE TABLE alertas_recompra (
  id UUID PRIMARY KEY,
  tenant_id UUID,
  
  produto_id UUID NOT NULL,
  loja_id UUID,
  fornecedor_id UUID,
  
  estoque_minimo INTEGER DEFAULT 10,
  estoque_ideal INTEGER DEFAULT 20,
  
  habilitado BOOLEAN DEFAULT true,
  
  status VARCHAR(50),                    -- Ativo, Resolvido, Cancelado
  
  created_at TIMESTAMP
);
```

---

## 🔐 Permissões de Acesso

### 6 Novas Permissions

```javascript
// src/config/permissions.js

ROLE_RULES = {
  // ...
  
  // Nova: Comprador (role específica para compras)
  Comprador: {
    can: [
      'view_compras',           // Visualizar OCs, Encomendas, Análise
      'create_oc',              // Criar OCs
      'manage_compras',         // Editar, duplicar OCs
      'send_oc',                // Enviar OCs ao fornecedor
      'receive_oc',             // Receber mercadorias
    ],
    scope: 'ALL',              // Vê todas as lojas (configurable)
  },
};

// Atender em cada role conforme lógica:
Administrador:   can: ['*'],  // Acesso total
Gerente Geral:   can: [..., 'view_compras', 'manage_compras', 'approve_oc'],
Gerente:         can: [..., 'view_compras'],
Vendedor:        can: [..., 'view_compras'],           // Vê só suas encomendas
Montador:        can: ['view_compras', 'receive_oc'],  // Pode receber
```

### Menums items

```javascript
// src/config/permissions.js => MENU_ITEMS

[
  {
    title: "Compras",
    url: "/admin/Compras",
    icon: ShoppingCart,
    permission: 'view_compras',
    section: "Operacional"
  },
  {
    title: "Análise de Preços",
    url: "/admin/AnalisePrecosCompras",
    icon: TrendingUp,
    permission: 'view_compras',
    section: "Operacional"
  },
]
```

---

## 🎮 Como Usar - Guia do Usuário

### Para Administrador

1. **Primeiro acesso**: Habilitar `useAlertasEstoque` hook em Compras.jsx
   - Configura: intervalo = 5 min (configurável)
   - Cria automaticamente encomendas abaixo do mínimo

2. **Configurar alertas_recompra**:
   - Via Supabase Admin Panel
   - OU criar endpoint de configuração (futura FASE 4)

3. **Visualizar Dashboard**:
   - Acessar `/admin/Compras`
   - Ver 6 métricas principais
   - Clicar "Ver" em "Reabastecer" para alertas ativos

### Para Comprador

1. **Criar nova OC**:
   - Clica "Nova OC" → Preenche Fornecedor e Itens → Salva
   - Status: "Rascunho" (pode editar)

2. **Enviar OC**:
   - Status muda para "Aguardando Envio"
   - Clica "Enviar" → Confirmação → Enviado

3. **Receber Mercadoria**:
   - OC entra em status "Enviado"
   - Clika "Receber" → Preenche quantidade + NFe → Confirma
   - **Automação**: Estoque updated + Lançamento Financeiro criado

4. **Analisar Performance**:
   - Tab 3 mostra fornecedores por volume/atraso
   - Útil para renegociação e planejamento

### Para Vendedor (PDV)

1. **Criar Encomenda** (PDV):
   - Marca produto como "ENCOMENDA"
   - Sistema cria `solicitacoes_encomenda` com venda_id

2. **Visualizar Status**:
   - Acessa `/admin/Compras` → Tab 2: Encomendas
   - Vê suas encomendas agrupadas
   - Clica em encomenda → Vê modal com venda original (cliente, itens, datas)

3. **Acompanhar Recebimento**:
   - Status da encomenda muda: Pendente → Em Compra → Recebida

---

## 🚀 Instalação & Setup

### 1. Migrations SQL
```bash
# Executar migration completa
psql -U postgres -d supabase -f migration_sistema_compras_completo.sql

# Ou via Supabase SQL Editor:
# Copy-paste o conteúdo e executar
```

### 2. Verificar Tabelas
```sql
-- Confirmar que tabelas foram criadas
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'compras%' OR table_name LIKE 'estoque%' OR table_name LIKE 'historico%';
```

### 3. Habilitar RLS
```sql
-- Já incluído na migration, mas confirmar:
ALTER TABLE estoque_loja ENABLE ROW LEVEL SECURITY;
ALTER TABLE historico_precos ENABLE ROW LEVEL SECURITY;
```

### 4. Testar no Frontend
```bash
npm run dev

# Acessar: http://localhost:5173/admin/Compras
```

---

## 🧪 Testes

### Executar Suite de Testes
```bash
npm run test -- src/services/comprasService.test.js
npm run test:watch
```

### Cobertura Esperada
- ✅ Validações de OC
- ✅ Máquina de estados
- ✅ Cálculos (valor total, atrasos)
- ✅ Automação de recebimento
- ✅ Detecção de duplicados

---

## 📈 Métricas no Dashboard

| Métrica | Cálculo | Cor |
|---------|---------|-----|
| **Total Gasto** | SUM(compras_ordens.valor_total) | Blue |
| **Em Aberto** | COUNT(status = 'Aguardando Envio' \|\| 'Enviado') | Yellow |
| **Recebidas** | COUNT(status = 'Recebido') | Green |
| **Atrasadas** | COUNT(data_previsao > today) | Red |
| **Fornecedores** | COUNT(DISTINCT fornecedor_id) | Purple |
| **Reabastecer** | COUNT(alertas_ativos) | Amber (destaque) |

---

## 🔔 Próximas Fases (Roadmap)

### FASE 4: Notificações
- [ ] E-mail ao fornecedor ao enviar OC
- [ ] WhatsApp ao fornecedor (robo-whatsapp-agendamentos)
- [ ] Notificação ao PDV quando encomenda chega

### FASE 5: Integrações Externas
- [ ] Webhook: Fornecedor confirma recebimento de OC
- [ ] Integração com APIs de fornecedores (XLS, API, etc)
- [ ] Importação automática de preços diários

### FASE 6: Relatórios Avançados
- [ ] Análise de Lead Time por fornecedor
- [ ] Previsão de demanda (machine learning)
- [ ] Otimização de tamanho de pedido (EOQ)
- [ ] Dashboards em tempo real com WebSockets

---

## 🐛 Troubleshooting

### Problema: "Estoque não atualiza após receber OC"
**Solução**: Verificar se RLS policy permite INSERT em estoque_loja
```sql
SELECT * FROM pg_policies WHERE tablename = 'estoque_loja';
```

### Problema: "Alertas não criam encomendas automaticamente"
**Solução**: 
1. Confirmar `useAlertasEstoque` habilitado em Compras.jsx
2. Verificar console para logs de `[useAlertasEstoque]`
3. Confirmar `alertas_recompra.habilitado = true`

### Problema: "Número de OC duplicado"
**Solução**: Verificar UNIQUE constraint em `numero_pedido`
```sql
SELECT * FROM compras_ordens WHERE numero_pedido = 'OC-2026-00001';
```

---

## 📞 Suporte

- **Issues**: Criar GH issue com tag `[compras]`
- **Questions**: Perguntar em Discord #development-backend
- **Docs**: Consultar copilot-instructions.md para padrões

---

**Última atualização**: 2026-03-19
**Status**: FASE 2-3 ✅ Completa | FASE 4+ 🔄 Em Planejamento
