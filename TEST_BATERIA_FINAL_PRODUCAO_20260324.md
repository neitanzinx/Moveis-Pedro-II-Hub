# Bateria Final de Testes - Produção

Data: 2026-03-24
Projeto: Moveis Pedro II
Objetivo: validar prontidão para uso com cobertura técnica (build/lint/testes) e smoke funcional em navegador.

## 1. Gate Técnico (obrigatório)

1. Build de produção
- Comando: `npm run build`
- Critério: build concluído sem erro
- Resultado: PASS

2. Lint global
- Comando: `npm run lint`
- Critério: sem erros bloqueantes
- Resultado: PASS (apenas warnings não bloqueantes)

3. Testes automatizados
- Comando: `npm run test -- --run`
- Critério: 100% de testes do suite atual passando
- Resultado: PASS (35/35)

## 2. Smoke de Navegador (obrigatório)

Ambiente local:
- Servidor: `npm run dev -- --host 127.0.0.1 --port 5173`
- Validação de porta: 127.0.0.1:5173 aberta (TcpTestSucceeded=True)
- Rotas abertas no navegador:
  - http://127.0.0.1:5173/
  - http://127.0.0.1:5173/compras

Checklist de smoke:
1. Login e sessão
- Entrar com perfil administrativo e perfil operacional
- Confirmar que menus mudam por RBAC

2. Compras
- Abrir dashboard de compras
- Ver card de ruptura prevista e item mais vendido
- Abrir modal de reabastecimento

3. Logística
- Acessar kanban semanal
- Mover entrega entre slots e validar persistência

4. Montagem
- Simular claim/transferência e confirmar ausência de corrida visível

5. Rastreio público
- Acessar página com token válido
- Confirmar bloqueio de acesso sem token válido

6. Financeiro e RH
- Acessar páginas com usuário autorizado e não autorizado
- Confirmar bloqueio por permissões

7. Logs e auditoria
- Executar ação de atualização e validar exibição em logs

## 3. Critério de Go/No-Go

Go para produção quando:
- Build PASS
- Lint sem erros PASS
- Testes automatizados PASS
- Smoke de navegador validado nos fluxos críticos (Compras, Logística, Montagem, Rastreio, Financeiro, RH, Logs)

No-Go se:
- qualquer erro bloqueante voltar no lint
- regressão em fluxo crítico
- falha de autenticação/autorização

## 4. Evidências desta execução

- Build: PASS
- Lint: PASS (sem erros)
- Testes: PASS (35/35)
- Navegador: aplicação iniciada e rotas abertas para smoke manual
