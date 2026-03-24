# 🐛 Relatório de Bugs Encontrados - Sistema de Compras

## Status: 5 Bugs Críticos & 3 Bugs Menores Identificados

---

## 🔴 BUGS CRÍTICOS

### BUG #1: Agrupamento incorreto de encomendas
**Arquivo**: `src/pages/Compras.jsx` (linhas 165-170)
**Severidade**: ALTA - Funcionalidade quebrada

```javascript
// ❌ ERRADO - Agrupa por numero_pedido (número da OC) ao invés de vendedor
const encomendaresPorVendedor = useMemo(() => {
  const agrupado = {};
  encomendas.forEach(enc => {
    const vendedor = enc.numero_pedido || 'Sem vendedor';  // ERRO!
    if (!agrupado[vendedor]) agrupado[vendedor] = [];
    agrupado[vendedor].push(enc);
  });
  return agrupado;
}, [encomendas]);
```

**Impacto**: TAB 2 (Encomendas) agrupa por número da OC, não por vendedor. Informação errada para o usuário.

**Solução**:
```javascript
const encomendaresPorVendedor = useMemo(() => {
  const agrupado = {};
  encomendas.forEach(enc => {
    const vendedor = enc.vendedor_nome || enc.usuario_criacao || 'Sem vendedor'; // Corrigido
    if (!agrupado[vendedor]) agrupado[vendedor] = [];
    agrupado[vendedor].push(enc);
  });
  return agrupado;
}, [encomendas]);
```

---

### BUG #2: Métrica "Aguardando Envio" com status errado
**Arquivo**: `src/pages/Compras.jsx` (linhas 190-192)
**Severidade**: ALTA - Métrica incorreta

```javascript
// ❌ ERRADO - Status "Aguardando Envio" não existe na máquina de estados
const emAberto = ocs.filter(o => 
  ['Rascunho', 'Aguardando Envio', 'Pedido Enviado'].includes(o.status)
).length;
```

**Problema**: O status correto é `Envio`, não `Aguardando Envio`. Isto causa filtros vazios.

**Solução**:
```javascript
// ✅ CORRETO
const emAberto = ocs.filter(o => 
  ['Rascunho', 'Envio', 'Pedido Enviado'].includes(o.status)
).length;
```

---

### BUG #3: Desestruturação incorreta de resposta Supabase
**Arquivo**: `src/services/comprasService.js` (linhas 260-265)
**Severidade**: ALTA - Causará erro em runtime

```javascript
// ❌ ERRADO - item é { data, error }, não direto
const item = await supabase
  .from('compras_oc_itens')
  .select('produto_id')
  .eq('id', item_id)
  .single();

if (item.data?.produto_id) {  // ❌ Deveria ser item?.data?.produto_id
```

**Impacto**: `receberOc()` quebrará ao tentar acessar `item.data.produto_id`.

**Solução**:
```javascript
// ✅ CORRETO
const { data: itemData, error: itemError } = await supabase
  .from('compras_oc_itens')
  .select('produto_id')
  .eq('id', item_id)
  .single();

if (itemError) {
  console.error('Erro ao buscar item:', itemError);
  continue;
}

if (itemData?.produto_id) {
  // ... código
}
```

---

### BUG #4: Campo "ordem_compra_id" vs "oc_id" inconsistente
**Arquivo**: `src/services/comprasService.js` (linha 38)
**Severidade**: ALTA - Query silenciosa retorna vazio

```javascript
// ❌ POSSÍVEL ERRO - Inconsistência de nomenclatura
const { data: itens } = await supabase
  .from('compras_oc_itens')
  .select('*')
  .eq('ordem_compra_id', ocId);  // Mas a tabela usa 'oc_id'?
```

**Problema**: Se a tabela usa `oc_id` mas o código busca `ordem_compra_id`, a query retorna vazio.

**Solução**: Verificar esquema correto em `schema.sql`:
```sql
-- No schema.sql, confirmar qual coluna existe:
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'compras_oc_itens';
```

Se for `oc_id`, corrigir para:
```javascript
.eq('oc_id', ocId);
```

---

### BUG #5: categoria_id hardcoded não existe
**Arquivo**: `src/services/comprasService.js` (linha 314)
**Severidade**: ALTA - Lançamento financeiro falhará

```javascript
// ❌ ERRADO - UUID literal pode não existir
await base44.entities.LancamentoFinanceiro.create({
  tipo: 'DESPESA',
  categoria_id: 'c2e5e8f7-b8c1-4e3f-a1d2-9f5c3b7a8e2d',  // Pode não existir!
  // ...
});
```

**Impacto**: Se essa categoria não existir no banco, o lançamento financeiro falhará silenciosamente.

**Solução**:
```javascript
// ✅ CORRETO - Buscar categoria correta
const { data: categoriasCompra } = await supabase
  .from('financeiro_categorias')
  .select('id')
  .eq('nome', 'Compras de Estoque')
  .single();

if (!categoriasCompra) {
  throw new Error('Categoria "Compras de Estoque" não encontrada');
}

await base44.entities.LancamentoFinanceiro.create({
  tipo: 'DESPESA',
  categoria_id: categoriasCompra.id,  // Dinâmico
  // ...
});
```

---

## 🟡 BUGS MENORES

### BUG #6: Querykey não dispara refetch ao trocar data
**Arquivo**: `src/pages/AnalisePrecosCompras.jsx` (linhas 73-82)
**Severidade**: MÉDIA

```javascript
// ⚠️ PROBLEMA - dataInicio não está no queryKey
const { data: historicoPrecos = [], isLoading: historicoLoading } = useQuery({
  queryKey: ['historico_precos'],  // ❌ Falta adicionar dataInicio
  queryFn: async () => {
    const { data, error } = await supabase
      .from('historico_precos')
      .select('*')
      .gte('created_at', dataInicio)  // Usa dataInicio
      // ...
  },
});
```

**Impacto**: Ao mudar `dataInicio`, a query não refaz.

**Solução**:
```javascript
queryKey: ['historico_precos', dataInicio],  // Adicionar dependência
```

---

### BUG #7: Missing null check no estoque_loja
**Arquivo**: `src/services/comprasService.js` (linhas 284-295)
**Severidade**: MÉDIA

```javascript
// ⚠️ PROBLEMA - Pode falhar se resultado é null
const { data: estoque } = await supabase
  .from('estoque_loja')
  .select('quantidade')
  .eq('produto_id', item.data.produto_id)
  .eq('loja_id', oc.metadata?.loja_id)
  .single();

const quantidadeAtual = estoque?.quantidade || 0;  // OK, mas...

// Depois:
if (estoque) {  // Se estoque for null, cria novo, OK
  // ...
}
```

**Impacto**: Risco de atualizar quantidade incorreta se ausência de registro.

**Solução**: Usar `upsert` em vez de lógica condicional:
```javascript
await supabase
  .from('estoque_loja')
  .upsert({
    produto_id: item.data.produto_id,
    loja_id: oc.metadata?.loja_id,
    quantidade: (quantidadeAtual) + quantidade_recebida
  }, {
    onConflict: 'produto_id,loja_id'
  });
```

---

### BUG #8: Filtro de fornecedor quebrado
**Arquivo**: `src/pages/Compras.jsx` (linhas 146-149)
**Severidade**: MÉDIA

```javascript
// ⚠️ PROBLEMA - String comparison de UUID
if (fornecedorFilter !== 'all') {
  resultado = resultado.filter(oc => {
    const fornecedorStr = fornecedorFilter;
    return String(oc.fornecedor_id) === fornecedorStr;  // Pode falhar
  });
}
```

**Impacto**: Filtro de fornecedor pode não funcionar se tipos forem diferentes.

**Solução**:
```javascript
if (fornecedorFilter !== 'all') {
  resultado = resultado.filter(oc =>
    oc.fornecedor_id === fornecedorFilter
  );
}
```

---

## 📋 Resumo de Correções Necessárias

| Bug # | Arquivo | Linha | Severidade | Descrição | Ação |
|-------|---------|-------|-----------|-----------|--------|
| 1 | Compras.jsx | 165 | 🔴 CRÍTICA | Agrupamento errado por numero_pedido | Corrigir para enc.vendedor_nome |
| 2 | Compras.jsx | 191 | 🔴 CRÍTICA | Status "Aguardando Envio" não existe | Usar "Envio" |
| 3 | comprasService.js | 260 | 🔴 CRÍTICA | Desestruturação errada de Supabase | Usar { data, error } |
| 4 | comprasService.js | 38 | 🔴 CRÍTICA | Campo "ordem_compra_id" inconsistente | Verificar schema |
| 5 | comprasService.js | 314 | 🔴 CRÍTICA | categoria_id hardcoded | Buscar dinâmeco |
| 6 | AnalisePrecosCompras.jsx | 73 | 🟡 MÉDIA | QueryKey falta dataInicio | Adicionar ao queryKey |
| 7 | comprasService.js | 284 | 🟡 MÉDIA | Missing null check | Usar upsert |
| 8 | Compras.jsx | 146 | 🟡 MÉDIA | Filtro de fornecedor quebrado | Remover String() |

---

## ✅ Recomendação

**AÇÃO IMEDIATA NECESSÁRIA**: Corrigir bugs críticos #1, #2, #3, #4, #5 antes de fazer deploy em produção.

Os bugs menores (#6, #7, #8) podem ser corrigidos depois, mas recomenda-se corrigir também agora.

---

*Relatório gerado em 2026-03-19*
