import { useCallback } from "react";
import { supabase } from "@/api/base44Client";
import { base44 } from "@/api/base44Client";

/**
 * Hook para validar disponibilidade de estoque antes de confirmar uma venda.
 *
 * Tipos de retorno possíveis de `validarProduto()`:
 *
 *   { pode_vender: true,  eh_encomenda: false, requer_aprovacao: false }  → Estoque OK
 *   { pode_vender: true,  eh_encomenda: true,  requer_aprovacao: true  }  → Requer aprovação gerencial
 *   { pode_vender: true,  eh_encomenda: true,  requer_aprovacao: false }  → Sempre sob-encomenda (ok direto)
 *   { pode_vender: false, eh_encomenda: false, requer_aprovacao: false }  → Bloqueado (pronta entrega sem estoque)
 */
export function useEstoqueValidacao() {
  /**
   * Valida se um produto pode ser vendido.
   * Chama a função SQL fn_validar_estoque_venda() via RPC.
   *
   * @param {number} produtoId - ID do produto (bigint)
   * @param {number} quantidade - Quantidade desejada
   * @returns {Promise<{
   *   pode_vender: boolean,
   *   eh_encomenda: boolean,
   *   requer_aprovacao: boolean,
   *   motivo: string,
   *   tipo_efetivo: string,
   *   prazo_dias: number,
   *   total_estoque: number,
   *   total_disponivel: number
   * }>}
   */
  const validarProduto = useCallback(async (produtoId, quantidade = 1) => {
    try {
      const { data, error } = await supabase.rpc("fn_validar_estoque_venda", {
        p_produto_id: produtoId,
        p_quantidade: quantidade,
      });

      if (error) {
        console.error("[useEstoqueValidacao] Erro RPC:", error);
        // Em caso de erro na função, libera com aviso (não bloqueia a operação)
        return {
          pode_vender: true,
          eh_encomenda: false,
          requer_aprovacao: false,
          motivo: "Erro ao validar estoque. Prosseguindo normalmente.",
          tipo_efetivo: "flexivel",
          prazo_dias: 15,
          total_estoque: 0,
          total_disponivel: 0,
        };
      }

      return data;
    } catch (err) {
      console.error("[useEstoqueValidacao] Exceção:", err);
      return {
        pode_vender: true,
        eh_encomenda: false,
        requer_aprovacao: false,
        motivo: "Erro ao validar estoque.",
        tipo_efetivo: "flexivel",
        prazo_dias: 15,
        total_estoque: 0,
        total_disponivel: 0,
      };
    }
  }, []);

  /**
   * Cria uma solicitação de encomenda vinculada à venda.
   *
   * @param {object} params
   * @param {string|number} params.vendaId
   * @param {object} params.produto - Objeto produto completo
   * @param {number} params.quantidade
   * @param {string} params.motivo - 'sem_estoque' | 'aprovacao_gerencial' | 'produto_sob_encomenda' | 'ajuste_manual'
   * @param {string} params.clienteNome
   * @param {string} params.numeroPedido
   * @param {string} params.loja
   * @param {string} [params.observacoesGerencial]
   */
  const criarSolicitacaoEncomenda = useCallback(async ({
    vendaId,
    produto,
    quantidade,
    motivo = "sem_estoque",
    clienteNome,
    numeroPedido,
    loja,
    observacoesGerencial,
  }) => {
    const statusInicial = motivo === "sem_estoque" ? "aguardando_aprovacao" : "pendente";

    try {
      await base44.entities.SolicitacaoEncomenda.create({
        venda_id: vendaId,
        produto_id: produto.id,
        produto_nome: produto.nome,
        fornecedor_nome: produto.fornecedor_nome,
        quantidade,
        cliente_nome: clienteNome,
        numero_pedido: numeroPedido,
        loja,
        status: statusInicial,
        motivo_encomenda: motivo,
        observacoes_gerencial: observacoesGerencial || null,
      });
    } catch (err) {
      console.error("[useEstoqueValidacao] Erro ao criar solicitação de encomenda:", err);
    }
  }, []);

  /**
   * Aprova uma solicitação de encomenda pendente.
   *
   * @param {string} solicitacaoId - UUID da solicitação
   * @param {object} aprovador - { id: uuid, nome: string }
   * @param {string} [observacoes]
   */
  const aprovarSolicitacao = useCallback(async (solicitacaoId, aprovador, observacoes) => {
    await base44.entities.SolicitacaoEncomenda.update(solicitacaoId, {
      status: "aprovado",
      aprovado_por: aprovador.id,
      aprovado_por_nome: aprovador.nome,
      data_aprovacao: new Date().toISOString(),
      observacoes_gerencial: observacoes || null,
    });
  }, []);

  /**
   * Rejeita uma solicitação de encomenda.
   *
   * @param {string} solicitacaoId - UUID da solicitação
   * @param {string} [observacoes]
   */
  const rejeitarSolicitacao = useCallback(async (solicitacaoId, observacoes) => {
    await base44.entities.SolicitacaoEncomenda.update(solicitacaoId, {
      status: "rejeitado",
      rejeitado_em: new Date().toISOString(),
      observacoes_gerencial: observacoes || null,
    });
  }, []);

  /**
   * Retorna label e cor do badge para o tipo de estoque.
   * Usado em BuscaProdutoAvancada e cards de produto.
   */
  const getStatusEstoqueBadge = useCallback((validacao, qtdDisponivel) => {
    if (!validacao) {
      return qtdDisponivel > 0
        ? { label: `${qtdDisponivel} un.`, variant: "default", color: "green" }
        : { label: "Sem estoque", variant: "secondary", color: "gray" };
    }

    if (!validacao.pode_vender) {
      return { label: "Bloqueado - sem estoque", variant: "destructive", color: "red" };
    }
    if (validacao.eh_encomenda && validacao.requer_aprovacao) {
      return { label: "Requer aprovação gerencial", variant: "outline", color: "yellow" };
    }
    if (validacao.eh_encomenda) {
      return { label: `Sob-encomenda (${validacao.prazo_dias}d)`, variant: "outline", color: "blue" };
    }
    return { label: `${validacao.total_disponivel} un. disponível`, variant: "default", color: "green" };
  }, []);

  return {
    validarProduto,
    criarSolicitacaoEncomenda,
    aprovarSolicitacao,
    rejeitarSolicitacao,
    getStatusEstoqueBadge,
  };
}
