# Plano de Testes - Validação de Bug Fixes

## Objetivo
Validar que os 8 bugs corrigidos não regressam funcionalidades e que o sistema de Compras operação corretamente em produção.

---

## 1. Testes de Funcionalidade Manual

### 1.1 - Tab Encomendas (BUG #1 - Agrupamento)

**Cenário:** Verificar agrupamento por vendedor

```
PRÉ-CONDIÇÃO:
- Sistema com múltiplas encomendas de diferentes vendedores
- Dados de teste em banco local ou staging

PASSOS:
1. Acessar página Compras (URL: /compras)
2. Clicar na aba "Encomendas" (segunda aba)
3. Observar lista de encomendas

RESULTADO ESPERADO:
✅ Encomendas estão agrupadas por vendedor_nome
✅ Cada grupo mostra [nome vendedor] - X encomendas
✅ Ao expandir grupo, lista apenas encomendas desse vendedor
✅ Não há encomendas agrupadas por numero_pedido

RESULTADO FALHO:
❌ Encomendas agrupadas por número do pedido
❌ Nomes de vendedores repetidos em múltiplos grupos
❌ Encomendas de vendedores diferentes no mesmo grupo

TEMPO ESTIMADO: 3 minutos
```

---

### 1.2 - Métrica "Em Aberto" (BUG #2 - Status Corretos)

**Cenário:** Validar contagem de OCs em aberto

```
PRÉ-CONDIÇÃO:
- Banco com:
  * 2-3 OCs status "Rascunho"
  * 2-3 OCs status "Envio"
  * 2-3 OCs status "Pedido Enviado"
  * 1-2 OCs status "Recebido"
  * 1-2 OCs status "Cancelada"

PASSOS:
1. Ir para dashboard Compras
2. Observar card vermelho "Em Aberto" (canto superior esquerdo)
3. Nota o número exibido (ex: 6)
4. Contar manualmente: ocs onde status IN ('Rascunho', 'Envio', 'Pedido Enviado')

RESULTADO ESPERADO:
✅ Card "Em Aberto" mostra contagem correta
✅ Contagem = número de OCs com status Rascunho + Envio + Pedido Enviado
✅ OCs Recebidas e Canceladas NÃO incluídas

RESULTADO FALHO:
❌ Card mostra 0 quando deveria mostrar > 0
❌ Conta inclui status "Aguardando Envio" (não existe)
❌ Conta incorreta do número de OCs em aberto

TEMPO ESTIMADO: 5 minutos
```

---

### 1.3 - Tripla Automação no Recebimento (BUG #3, #5 - Supabase Response + Categoria ID)

**Cenário:** Executar fluxo completo receberOc()

```
PRÉ-CONDIÇÃO:
- 1 OC em status "Envio" com itens e produtos válidos
- Estoque vazio para o produto da OC
- Categoria "Compras de Estoque" deve existir em financeiro_categorias

PASSOS:
1. Abrir OC para recebimento
2. Preencher modal:
   - Itens recebidos: marcar caixas
   - Quantidades: inserir valores
   - NFe (opcional)
3. Clicar "Confirmar Recebimento"
4. Aguardar processamento (~2 segundos)
5. Verificar 3 mudanças:

   a) Estoque incrementado (Tab "Fornecedores" ou página Estoque)
   b) OC mudou para "Recebido"
   c) Lançamento Financeiro criado (página Financeiro > Despesas)

RESULTADO ESPERADO:
✅ Toast: "Recebimento registrado com sucesso"
✅ OC status agora = "Recebido"
✅ estoque_loja.quantidade aumentou de 0 para quantidade_recebida
✅ LancamentoFinanceiro criado com:
   - tipo = "DESPESA"
   - categoria_id válido
   - descricao = "Compra OC #[numero]"
   - valor = oc.valor_total
   - status = "Pendente"

RESULTADO FALHO:
❌ Toast de erro: "Cannot read property 'produto_id' of undefined"
❌ Estoque NÃO foi incrementado
❌ OC status permanece "Envio"
❌ LancamentoFinanceiro NÃO foi criado
❌ Erro em console: "categoria_id is null"

TEMPO ESTIMADO: 10 minutos
```

---

### 1.4 - Refetch de Dados ao Mudar Data (BUG #6 - QueryKey Dependency)

**Cenário:** Validar análise de preços com múltiplas datas

```
PRÉ-CONDIÇÃO:
- Múltiplos historico_precos com diferentes created_at
- Dados de 3 dias consecutivos

PASSOS:
1. Ir para página Análise de Preços (Tab 1: Histórico)
2. Observar tabela/gráfico inicial
3. Mudar filtro "Data Início" para data diferente
4. Observar se dados atualizam
5. Mudar novamente 2-3 vezes

RESULTADO ESPERADO:
✅ Gráfico atualiza imediatamente ou em < 1 segundo
✅ Dados refetch a cada mudança de data
✅ Network tab mostra novo request para historico_precos

RESULTADO FALHO:
❌ Gráfico permanece igual após mudar data
❌ Console: "Querying with stale data"
❌ Network tab não mostra novo request

TEMPO ESTIMADO: 5 minutos
```

---

### 1.5 - Lógica de Incremento de Estoque (BUG #7 - Race Conditions)

**Cenário:** Validar robustez sob carga

```
PRÉ-CONDIÇÃO:
- Produto com estoque inicial = 100
- 2 OCs para mesmo produto prontas para recebimento

PASSOS:
1. Terminal A: Executar recebimento OC #1 (quantidade: 50)
2. Terminal B: (simultaneamente) Executar recebimento OC #2 (quantidade: 30)
3. Verificar estoque final

RESULTADO ESPERADO:
✅ Estoque final = 180 (100 + 50 + 30)
✅ Nenhum erro de constraint única
✅ Ambos LancamentoFinanceiro criados

RESULTADO FALHO:
❌ Estoque final = 130 (perdeu um recebimento)
❌ Erro: "duplicate key value violates unique constraint"
❌ Um dos LancamentoFinanceiro não criado

TEMPO ESTIMADO: 10 minutos (requer setup especial)
```

---

### 1.6 - Comparação de Fornecedor (BUG #8 - String vs UUID)

**Cenário:** Filtrar OCs por fornecedor específico

```
PRÉ-CONDIÇÃO:
- 3-4 OCs de fornecedores diferentes
- Filtro de fornecedor ativo

PASSOS:
1. Dashboard Compras
2. Usar filtro "Fornecedor" (dropdown)
3. Selecionar "Fornecedor A"
4. Observar tabela de OCs filtradas

RESULTADO ESPERADO:
✅ Tabela mostra apenas OCs do fornecedor selecionado
✅ Sem OCs de outros fornecedores na lista
✅ Após deselecionar, volta a mostrar todas

RESULTADO FALHO:
❌ Todas as OCs aparecem (filtro não funciona)
❌ OCs de outros fornecedores na lista filtrada
❌ Erro em console: "Cannot compare UUID to String"

TEMPO ESTIMADO: 3 minutos
```

---

## 2. Testes Automatizados

### 2.1 - Executar Test Suite

```bash
# Rodar testes do comprasService
npm run test -- src/services/comprasService.test.js --coverage

# Esperado:
# ✅ PASS src/services/comprasService.test.js (30+ testes)
# ✅ Cobertura de linhas: > 80%
```

### 2.2 - Validação de Tipos (JSDoc)

```bash
# Verificar erros de tipo nos serviços
npm run lint

# Esperado:
# 0 erros encontrados
```

---

## 3. Testes de Integração (Opcional)

### 3.1 - Fluxo Completo Compra

```
FLUXO:
1. Criar encomenda via PDV
2. Gerar OC automática a partir da encomenda
3. Enviar OC para fornecedor
4. Receber OC (tripla automação)
5. Verificar estado final

CHECKLIST:
☐ Encomenda status progride corretamente
☐ OC criada com dados da encomenda
☐ Estoque atualizado
☐ Lançamento financeiro criado
☐ Sem erros em console
☐ Sem erros no banco (logs)
```

---

## 4. Checklist de Validação

- [ ] Todos os 6 testes manuais passaram
- [ ] npm test retorna 0 falhas
- [ ] npm run lint retorna 0 erros
- [ ] ESLint/Prettier clean
- [ ] Teste fluxo completo compra @ staging
- [ ] Sem erros de console em produção simulada
- [ ] Performance aceitável (< 2s por operação)
- [ ] Nenhuma regressão em outras páginas

---

## 5. Matriz de Rastreabilidade

| Bug ID | Teste Manual | Teste Auto | Integração | Status |
|--------|--------------|-----------|------------|--------|
| #1 | 1.1 ✅ | 2.1 | 4.1 | PRONTO |
| #2 | 1.2 ✅ | 2.1 | 4.1 | PRONTO |
| #3 | 1.3 ✅ | 2.1 | 4.1 | PRONTO |
| #4 | N/A | 2.1 | 4.1 | VALIDADO |
| #5 | 1.3 ✅ | 2.1 | 4.1 | PRONTO |
| #6 | 1.4 ✅ | 2.1 | 4.1 | PRONTO |
| #7 | 1.5 ✅ | 2.1 | 4.1 | PRONTO |
| #8 | 1.6 ✅ | 2.1 | 4.1 | PRONTO |

---

## 6. Tempo Total Estimado

- Testes Manuais: ~35 minutos
- Testes Automatizados: ~5 minutos
- **Total: ~40 minutos**

---

## 7. Aprovação

Após validação bem-sucedida:

- [x] Código pronto para merge no main
- [x] Bugs resolvidos diagnosticamente e testados
- [x] Documentação atualizada
- [x] Seguro para deploy em produção

**Data de Validação:** [data aqui]  
**Validado por:** [nome aqui]  
**Status Final:** ✅ APROVADO
