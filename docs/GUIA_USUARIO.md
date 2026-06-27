# 📘 Guia de Utilização por Setor - Móveis Pedro II

> **Versão:** 2.0 | **Atualizado:** Fevereiro 2026

Este guia detalha os fluxos de trabalho e funcionalidades disponíveis para cada setor da empresa.

---

## 🔖 Índice

1. [Setor de Vendas](#1-setor-de-vendas)
2. [Setor de Logística (Gerentes & Entregadores)](#2-setor-de-logística)
3. [Setor de Estoque](#3-setor-de-estoque)
4. [Setor de Compras](#4-setor-de-compras)
5. [Setor Financeiro](#5-setor-financeiro)
6. [Setor de RH](#6-setor-de-rh)
7. [Marketing](#7-marketing)
8. [Administração & Configurações](#8-administração--configurações)
9. [Áreas Mobile (Entregador/Montador)](#9-áreas-mobile)
10. [Permissões por Cargo](#10-permissões-por-cargo)

---

## 1. 🛒 Setor de Vendas
**Acesso Principal:** Vendedores e Gerentes

### **PDV (Ponto de Venda)**
O coração das vendas da loja.

*   **Etapa 1 - Produtos:**
    *   Utilize a barra de busca para encontrar produtos por nome, código de barras, referência, fornecedor ou cor.
    *   Defina se o item precisa de montagem interna ou externa.

*   **Etapa 2 - Cliente:**
    *   Sempre vincule um cliente à venda (CPF ou busca por nome) para garantir o histórico e fidelidade.
    *   Confirme o endereço de entrega (pode ser diferente do residencial).

*   **Etapa 3 - Pagamento:**
    *   Múltiplas formas aceitas: Dinheiro, Cartão, PIX, Crediário.
    *   Pagamento híbrido permitido (ex: 50% PIX + 50% Cartão).
    *   **Pagamento na Entrega:** Marque esta opção se o cliente for pagar ao receber o produto.

*   **Etapa 4 - Finalização:**
    *   Revise dados e finalize.
    *   Comprovante enviado automaticamente via WhatsApp.

### **Orçamentos**
*   **Salvar Negociação:** Caso o cliente não feche na hora, salve como Orçamento.
*   **Recuperação:** Acesse a aba "Orçamentos" para reabrir, editar e transformar em Venda com um clique.

### **Clientes**
*   Cadastro completo com histórico de compras.
*   Preferências de entrega (dia da semana, turno).
*   Programa de fidelidade integrado.

### **Catálogo WhatsApp (Bot)**
*   Ferramenta para envio rápido de fotos e preços para clientes diretamente pelo WhatsApp integrado.

---

## 2. 🚛 Setor de Logística
**Acesso Principal:** Gerente de Logística, Entregadores, Montadores

### **Gestão de Rotas (Kanban Semanal)**
*   **Kanban de Entregas:** Visualize todas as vendas pendentes de entrega.
*   **Agendamento:** Arraste o cartão da venda para o dia da semana e turno desejado.
    *   ⚠️ *O sistema avisará se o dia escolhido conflitar com a preferência do cliente.*
*   **Turnos:** Manhã, Tarde ou Comercial.
*   **Notificação em Massa:** Envie WhatsApp automático para todos os clientes de um caminhão.

### **App do Entregador (Mobile)**
Acesso exclusivo para motoristas em rota (`/admin/Entregador`).

*   **Minha Rota:** Seleciona o caminhão e visualiza a lista de entregas do dia.
*   **GPS:** Rastreamento em tempo real.
*   **Avisar Cliente:** Botão para enviar WhatsApp automático.
*   **Finalizar Entrega:**
    *   **Assinatura Digital:** Cliente assina na tela do celular.
    *   **Fotos Obrigatórias:** Foto dos móveis montados/entregues.
    *   **Pagamento:** Gera Link de Pagamento (Stone) ou registra recebimento.
*   **Insucesso:** Registrar motivo com foto da fachada obrigatória.

### **Montagem Interna**
*   Lista de ordens de montagem para itens que precisam ser montados na loja antes da entrega.
*   Montadores da loja acessam `/admin/Montagem`.

### **Montador Externo (Mobile)**
*   Acesso em `/admin/MontadorExterno`.
*   Lista de ordens de serviço para montadores que vão à casa do cliente.
*   Mesmo fluxo do entregador: avisar, executar, fotos, assinatura.

### **Assistência Técnica**
Abertura de chamados para Trocas, Devoluções ou Reparos.
*   **Devoluções:** Ao concluir, o estoque é estornado automaticamente e valor é descontado das comissões.

---

## 3. 📦 Setor de Estoque
**Acesso Principal:** Estoquistas

### **Produtos**        
*   Cadastro completo com fotos, preços (custo/venda) e dados fiscais.
*   Sistema hierárquico: Produto Pai → Variações (cores, tamanhos).
*   **Badge de Qualidade:** Indica completude do cadastro (Verde/Amarelo/Vermelho).

> ⚠️ **Importante:** NCM e CFOP são obrigatórios para emissão de NF-e!

### **Entrada de Nota (Import XML)**
*   Importe o XML da nota fiscal para dar entrada rápida.
*   Sistema lê automaticamente produtos, quantidades e preços.
*   Associe produtos novos ou crie cadastros.

### **Bipagem de Estoque** *(NOVO)*
*   Acesse `/admin/EstoqueBipagem`.
*   Use leitor de código de barras para contagem rápida.
*   Sistema incrementa estoque automaticamente.
*   Alerta para EANs não cadastrados (permite associação).

### **Transferências**
*   Registre saída de mercadorias do CD para as Lojas.
*   Recebedor confirma a chegada.

### **Inventário**
*   Contagem cega para auditoria de estoque físico vs sistema.
*   Relatório de divergências.
*   Ajuste massivo após aprovação.

### **Mostruário** *(NOVO)*
*   Controle de itens de exposição nas lojas.
*   Solicitar transferência de mostruário.
*   Acompanhar status de montagem de mostruários.

---

## 4. 🛒 Setor de Compras
**Acesso Principal:** Compradores

*   **Alertas de Recompra:** Dashboard que mostra produtos com estoque abaixo do mínimo.
*   **Pedidos de Compra:** Criação e envio de pedidos para fornecedores (PDF/Email).
*   **Promoções de Fornecedores:** Gestão de ofertas e condições especiais.
*   **Recebimento:** Conferência cega ao receber a mercadoria no galpão.

---

## 5. 💰 Setor Financeiro
**Acesso Principal:** Financeiro, Diretoria

*   **Fluxo de Caixa:** Visão diária/mensal de entradas (Vendas) e saídas (Despesas).
*   **Lançamentos:** Registro manual de despesas.
*   **Recorrentes:** Despesas fixas mensais.
*   **Comissões:** Fechamento de comissões de vendedores por período.
    *   Desconta automaticamente: devoluções e cancelamentos.
*   **Notas Fiscais (NFe/NFCe):** Monitoramento de notas emitidas, canceladas e contingência.
*   **Exportação Contábil:** Exporta dados para contador.

---

## 6. 👥 Setor de RH
**Acesso Principal:** RH, Gerentes de Loja

*   **Colaboradores:** Cadastro completo (Admissão, documentos, dados bancários).
*   **Férias e Licenças:** Solicitação, aprovação e calendário.
*   **Folha de Pagamento:** Cálculo automático com descontos configuráveis.
*   **Avaliações:** Avaliação de desempenho.
*   **Comunicados:** Mural digital para avisos importantes.
*   **Documentos:** Gestão de documentos do colaborador.
*   **Recrutamento:** Gestão de vagas e candidatos.

> 💡 **Dica:** Ao contratar, clique em "Criar Acesso ao Sistema" para gerar as credenciais!

---

## 7. 📣 Marketing
**Acesso Principal:** Marketing, Gerentes

*   **Cupons:** Criação de cupons de desconto (% ou R$) com validade e limite de uso.
*   **Recuperação de Vendas:** Orçamentos expirados para tentativa de recuperação via WhatsApp.
*   **Aniversariantes:** Lista do mês com envio de mensagens personalizadas.
*   **Programa de Fidelidade:** Pontuação por compras e resgate de prêmios.
*   **Etiquetas de Preço:** Seleção de produtos e impressão em lote.

---

## 8. ⚙️ Administração & Configurações
**Acesso Principal:** Administradores

### **Dashboards**
*   **Dashboard do Gerente:** Dashboard gerencial (vendas do dia, metas, tokens).
*   **Dashboard BI:** Visão estratégica (Ticket Médio, Vendas por Hora, Curva ABC).

### **Configurações**
*   **Identidade Visual:** Logo da empresa.
*   **Lojas:** Cadastro de filiais.
*   **Taxas de Cartão:** Cadastro das taxas das maquininhas.
*   **Markup:** Regras de precificação automática.
*   **Comissões:** Porcentagem por cargo/vendedor.
*   **Integrações:** WhatsApp Bot, Stone, PagSeguro.
*   **NF-e:** Certificado digital, regime tributário.
*   **Funcionários:** Gerenciamento de acessos.
*   **Perfis de Acesso:** Permissões por cargo.

### **Segurança**
*   **Audit Log:** Histórico de "quem fez o quê e quando".

---

## 9. 📱 Áreas Mobile

| Cargo | URL | Descrição |
|-------|-----|-----------|
| Entregador | `/admin/Entregador` | App exclusivo para motoristas em rota |
| Montador Externo | `/admin/MontadorExterno` | App para montadores na casa do cliente |
| Montador (Interno) | `/admin/Montagem` | Ordens de montagem na loja |

> Estes cargos têm acesso restrito apenas à sua área específica.

---

## 10. 🔐 Permissões por Cargo

| Cargo | Acesso |
|-------|--------|
| **Administrador** | Acesso total a todos os módulos |
| **Gerente** | Vendas, Estoque, Logística, Financeiro, RH, Relatórios, Configurações |
| **Vendedor** | PDV, Vendas, Orçamentos, Clientes, Catálogo WhatsApp |
| **Estoque** | Estoque (todas as abas), Produtos, Entrada, Transferências, Inventário |
| **Financeiro** | Financeiro, Comissões, NF-e, Relatórios |
| **RH** | Recursos Humanos (todas as abas) |
| **Entregador** | Apenas App do Entregador |
| **Montador Externo** | Apenas App do Montador Externo |
| **Montador** | Apenas Montagem Interna |

---

*Documento atualizado em Fevereiro de 2026*
