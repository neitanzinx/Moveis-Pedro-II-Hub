# ✅ Guia de Boas Práticas - Sem Erros

## 🎯 Objetivo

Prevenir erros comuns ao trabalhar 100% com Supabase (sem Trello).

---

## ⚠️ Erros Comuns a Evitar

### ❌ **ERRO 1: Sincronizar dados manualmente com Trello**

```javascript
// ❌ NUNCA FAÇA ISSO
const syncToTrello = async (ordem) => {
  // Tentar enviar dados para Trello
  await fetch('https://api.trello.com/...');
};
```

**✅ Correto:**
```javascript
// ✅ SEMPRE use Supabase
const saveOrder = async (ordem) => {
  const { data, error } = await supabase
    .from('compras_ordens')
    .insert([ordem]);
};
```

---

### ❌ **ERRO 2: Não validar preços antes de gerar pedidos**

```javascript
// ❌ NUNCA FAÇA ISSO
const gerarPedido = async (itens) => {
  // Criar direto sem validar preço
  await supabase.from('compras_ordens').insert(pedido);
};
```

**✅ Correto:**
```javascript
// ✅ SEMPRE valide preços
const gerarPedido = async (itens) => {
  // 1. Verificar se há itens sem preco_custo
  const itensSemPreco = itens.filter(i => !i.preco_custo);
  
  if (itensSemPreco.length > 0) {
    // 2. Abrir modal para definir preços
    setShowModalPrecos(true);
    setPendingOrdens(pedidos);
    return;
  }
  
  // 3. Só depois criar pedido
  await supabase.from('compras_ordens').insert(pedido);
};
```

---

### ❌ **ERRO 3: Não agrupar pedidos por fornecedor**

```javascript
// ❌ NUNCA FAÇA ISSO
const gerarPedido = (itens) => {
  return itens.map(item => ({
    ordem_id: uuid(),
    fornecedor_id: item.fornecedor_id,
    // Cria ordem SEPARADA para cada item!
  }));
};
```

**✅ Correto:**
```javascript
// ✅ SEMPRE agrupe por fornecedor
const gerarPedidos = (itens) => {
  const agrupadosPorFornecedor = {};
  
  itens.forEach(item => {
    if (!agrupadosPorFornecedor[item.fornecedor_id]) {
      agrupadosPorFornecedor[item.fornecedor_id] = [];
    }
    agrupadosPorFornecedor[item.fornecedor_id].push(item);
  });
  
  // Cria UMA ordem por fornecedor
  return Object.entries(agrupadosPorFornecedor).map(([fornecedor_id, itens]) => ({
    ordem_id: uuid(),
    fornecedor_id,
    linhas: itens,
  }));
};
```

---

### ❌ **ERRO 4: Editar status sem atualizar no Supabase**

```javascript
// ❌ NUNCA FAÇA ISSO
const mudarStatus = (ordem) => {
  ordem.status = 'Enviado'; // Muda só local
  // Esqueceu de fazer update no banco!
};
```

**✅ Correto:**
```javascript
// ✅ SEMPRE use mutations
const mutation = useMutation({
  mutationFn: async (novo_status) => {
    const { error } = await supabase
      .from('compras_ordens')
      .update({ status: novo_status, atualizado_em: new Date() })
      .eq('id', ordem.id);
    
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries(['pedidos-kanban']);
  }
});
```

---

### ❌ **ERRO 5: Cache desatualizado do React Query**

```javascript
// ❌ NUNCA FAÇA ISSO
const editarOrdem = async (ordem) => {
  // Edita no BD direto
  await supabase.from('compras_ordens').update(ordem).eq('id', ordem.id);
  
  // Esqueceu de atualizar o cache!
  // React Query ainda mostra dados velhos
};
```

**✅ Correto:**
```javascript
// ✅ SEMPRE invalide queries
const editarOrdem = async (ordem) => {
  await supabase.from('compras_ordens').update(ordem).eq('id', ordem.id);
  
  // Invalidar cache para recarregar
  queryClient.invalidateQueries({ queryKey: ['pedidos-kanban'] });
  queryClient.invalidateQueries({ queryKey: ['pedidos-compra-dashboard-full'] });
};
```

---

## 📋 Checklist de Segurança

### Antes de Criar Pedido
- [ ] Verificar se todos os itens têm `preco_custo` definido
- [ ] Agrupar itens por `fornecedor_id`
- [ ] Validar `centro_custo_id` não está null
- [ ] Verificar se há encomendas já confirmadas (não duplicar)

### Antes de Mudar Status
- [ ] Confirmar permissão do usuário (RLS)
- [ ] Validar transição de status (ex: Rascunho → Enviado é ok, Recebido → Enviado não é)
- [ ] Registrar quem fez a mudança (`usuario_id`)
- [ ] Invalidar React Query cache

### Antes de Deletar
- [ ] ✅ **Usar soft delete** (`ativo = false`) - NUNCA delete físico
- [ ] Se deletar, verificar se há `solicitacoes_encomenda` órfãs
- [ ] Log de auditoria (`audit_logs`)

### Antes de Fazer Deploy
- [ ] Testar fluxo completo: Encomenda → Pedido → Confirmação → Recebimento
- [ ] Verificar RLS policies no Supabase
- [ ] Validar dados em todos os status
- [ ] Testar com usuários de diferentes perfis

---

## 🔍 Debug & Troubleshooting

### Problema: "Pedidos não aparecem no Kanban"

```javascript
// 1. Verificar se query está rodando
const { data, isLoading, error } = useQuery({
  queryKey: ['pedidos-kanban'],
  queryFn: async () => {
    console.log('Buscando pedidos...');
    const dados = await comprasService.getOrdens();
    console.log('Dados recebidos:', dados); // Ver o que retornou
    return dados;
  }
});

// 2. Se não carrega, verificar RLS
// Ir ao Supabase → SQL Editor → Run
SELECT * FROM compras_ordens LIMIT 10;

// 3. Se erro 403, é RLS - verificar policies
SELECT * FROM auth.users WHERE id = request.auth.uid();
```

### Problema: "Não posso editar pedido"

```javascript
// 1. Check: Estou no perfil certo?
console.log('User:', user.email, 'Cargo:', user.cargo);

// 2. Check RLS policy:
SELECT schemaname, tablename, policyname, qual 
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'compras_ordens';

// 3. Se ainda não funcionar, check permissão
const { data, error } = await supabase
  .from('compras_ordens')
  .update({ status: 'Novo' })
  .eq('id', ordem_id);

console.error('Update error:', error); // Ver erro específico
```

### Problema: "Preço está zerado"

```javascript
// 1. Verificar se produto está importado corretamente
SELECT id, nome, preco_custo, ativo FROM produtos WHERE nome ILIKE '%..%';

// 2. Se preco_custo é NULL, isso é problema
// Usar DefinirPrecosModal para preencher

// 3. Verificar trigger/função que deveria preencher preço
SELECT * FROM compras_ordens co
JOIN solicitacoes_encomenda se ON co.id = se.ordem_id
WHERE se.preco_custo = 0;
```

---

## 🛡️ Validações ao Receber Pedido

```javascript
const receberPedido = async (ordem, itensRecebidos) => {
  // 1. Validar quantidade
  const totalRecebido = itensRecebidos.reduce((sum, item) => sum + item.quantidade, 0);
  const totalSolicitado = ordem.linhas.reduce((sum, item) => sum + item.quantidade, 0);
  
  if (totalRecebido > totalSolicitado) {
    throw new Error('Quantidade recebida maior que solicitada!');
  }

  // 2. Validar datas
  if (new Date(ordem.data_recebimento) < new Date(ordem.data_pedido)) {
    throw new Error('Data de recebimento não pode ser antes do pedido!');
  }

  // 3. Validar notas fiscais
  if (!itensRecebidos[0]?.nota_fiscal) {
    throw new Error('Nota fiscal é obrigatória');
  }

  // 4. Updatear banco
  const { error } = await supabase
    .from('compras_ordens')
    .update({ 
      status: 'Recebido',
      data_recebimento: new Date(),
      atualizado_em: new Date()
    })
    .eq('id', ordem.id);

  if (error) throw error;

  // 5. Invalidar cache
  queryClient.invalidateQueries(['pedidos-kanban']);
};
```

---

## 📚 Recursos Úteis

- **[Documentação Supabase](https://supabase.com/docs)**
- **[React Query Best Practices](https://react-query.tanstack.com/overview)**
- **[Git History](git log --oneline)** - Ver mudanças anteriores

---

## 🎓 Fluxo Correto Completo

```
1️⃣ VENDEDOR: Cria encomenda
   └─ solicitacoes_encomenda criada

2️⃣ SETOR DE COMPRAS: Agrupa encomendas
   └─ CaixaDemandas.jsx
   └─ Valida preços → DefinirPrecosModal
   └─ Agrupa por fornecedor

3️⃣ SISTEMA: Cria ordem de compra
   └─ compras_ordens.insert()
   └─ Cria linhas (solicitacoes_encomenda)
   └─ Status = 'Rascunho'

4️⃣ COMPRADOR: Revisa e envia
   └─ Atualiza status → 'Pedido Enviado'
   └─ Notifica fornecedor (WhatsApp)

5️⃣ FORNECEDOR: Confirma recebimento
   └─ Status → 'Confirmado'
   └─ Define data de entrega

6️⃣ LOGÍSTICA: Atualiza progresso
   └─ Status → 'Em Transporte'
   └─ Rastreio disponível

7️⃣ ESTOQUE: Recebe e confere
   └─ RecebimentoPedido.jsx
   └─ Status → 'Recebido'
   └─ Atualiza estoque

8️⃣ FINANCEIRO: Reconcilia pagamento
   └─ compras_financeiro.insert()
   └─ Status → 'Quitado'

✅ PEDIDO FINALIZADO
```

---

**🎉 Seguindo este guia, você não terá erros!**
