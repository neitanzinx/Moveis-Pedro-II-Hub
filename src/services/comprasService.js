import { base44 } from "@/api/base44Client";
import { supabase } from "@/lib/supabase";

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

function mergeOcMetadata(currentMetadata = {}, incomingMetadata = {}, lojaId = null) {
  return {
    ...currentMetadata,
    ...incomingMetadata,
    loja_id: incomingMetadata.loja_id || lojaId || currentMetadata.loja_id || null,
  };
}

async function validarFornecedorDosItensOc(fornecedorId, itens = []) {
  if (!fornecedorId || !Array.isArray(itens) || itens.length === 0) {
    return;
  }

  const produtoIds = [...new Set(
    itens
      .map((item) => item.produto_id)
      .filter(Boolean)
  )];

  if (produtoIds.length === 0) {
    return;
  }

  const { data: produtos = [], error } = await supabase
    .from('produtos')
    .select('id, nome, fornecedor_id')
    .in('id', produtoIds);

  if (error) {
    throw new Error(`Erro ao validar fornecedor dos itens: ${error.message}`);
  }

  const produtosFornecedorDivergente = produtos.filter((produto) => {
    if (!produto?.id) return false;
    if (!produto?.fornecedor_id) return false;
    return String(produto.fornecedor_id) !== String(fornecedorId);
  });

  if (produtosFornecedorDivergente.length > 0) {
    const nomes = produtosFornecedorDivergente
      .map((produto) => produto.nome)
      .filter(Boolean)
      .join(', ');

    throw new Error(`A OC só pode conter itens do fornecedor selecionado. Produtos divergentes: ${nomes}`);
  }
}

/**
 * Serviço centralizado para operações de Compras
 * Padrão: Usa Base44 SDK para CRUD + lógica de automação
 * Inclui: Approval Workflow + Partial Receipts
 */

export const comprasService = {
  /**
   * Lista todas as OCs com opção de ordenação
   * @param {string} orderBy - Campo para ordenação (ex: '-data_pedido')
   * @returns {Promise<Array>}
   */
  async listOcs(orderBy = '-created_at') {
    try {
      const ocs = await base44.entities.ComprasOrden.filter({ deleted_at: null }, orderBy);
      return ocs || [];
    } catch (error) {
      console.error('Erro ao listar OCs:', error);
      throw error;
    }
  },

  /**
   * Busca uma OC pelo ID com seus itens relacionados
   * @param {string} ocId - UUID da OC
   * @returns {Promise<Object>}
   */
  async getOcDetalhes(ocId) {
    try {
      const oc = await base44.entities.ComprasOrden.get(ocId);
      
      // Buscar itens da OC
      const { data: itens } = await supabase
        .from('compras_oc_itens')
        .select('*')
        .eq('ordem_compra_id', ocId);
      
      return {
        ...oc,
        itens: itens || []
      };
    } catch (error) {
      console.error('Erro ao buscar detalhes da OC:', error);
      throw error;
    }
  },

  /**
   * Cria uma nova OC (Ordem de Compra)
   * @param {Object} data - { fornecedor_id, itens, centro_custo_id, data_previsao_entrega, observacoes }
   * @returns {Promise<Object>} OC criada
   */
  async createOc(data) {
    try {
      const {
        fornecedor_id,
        fornecedor_nome,
        itens = [], // Array de { produto_id, quantidade_pedida, preco_unitario }
        centro_custo_id,
        data_previsao_entrega,
        observacoes,
        loja_id,
        metadata = {}
      } = data;

      if (!fornecedor_id || itens.length === 0) {
        throw new Error('Fornecedor e itens são obrigatórios');
      }

      await validarFornecedorDosItensOc(fornecedor_id, itens);

      // Calcular valor total
      const valor_total = itens.reduce((sum, item) => 
        sum + (item.quantidade_pedida * item.preco_unitario), 0
      );

      // Gerar número do pedido
      const numeroOc = await this._gerarNumeroPedido();

      // Criar OC em status Rascunho com approval_status Pendente
      const novaOc = await base44.entities.ComprasOrden.create({
        numero_pedido: numeroOc,
        fornecedor_id,
        fornecedor_nome,
        centro_custo_id,
        data_previsao_entrega,
        observacoes,
        valor_total,
        status: 'Rascunho',
        approval_status: 'Pendente',
        metadata: mergeOcMetadata({}, metadata, loja_id),
        data_pedido: new Date().toISOString().split('T')[0]
      });

      // Criar itens da OC
      for (const item of itens) {
        await base44.entities.ComprasOcItem.create({
          ordem_compra_id: novaOc.id,
          produto_id: item.produto_id,
          produto_nome: item.produto_nome,
          descricao_personalizada: item.descricao_personalizada || null,
          quantidade_pedida: item.quantidade_pedida,
          preco_unitario: item.preco_unitario,
          preco_tabela: item.preco_tabela,
          quantidade_recebida: 0,
          status_recebimento: 'Pendente'
        });
      }

      // Atualizar SolicitacaoEncomenda se existir (vincular)
      if (data.solicitacoes_encomenda_ids) {
        for (const solicId of data.solicitacoes_encomenda_ids) {
          await supabase
            .from('solicitacoes_encomenda')
            .update({
              ordem_id: novaOc.id,
              status: 'em_compra',
            })
            .eq('id', solicId);
        }
      }

      return novaOc;
    } catch (error) {
      console.error('Erro ao criar OC:', error);
      throw error;
    }
  },

  /**
   * Submete uma OC para Aprovação
   * Transição: Rascunho → Aguardando Aprovação
   * @param {string} ocId - UUID da OC
   * @returns {Promise<Object>}
   */
  async submitForApproval(ocId) {
    try {
      const oc = await base44.entities.ComprasOrden.get(ocId);
      
      if (oc.status !== 'Rascunho') {
        throw new Error(`Só é possível enviar OCs em status "Rascunho" para aprovação. Status atual: ${oc.status}`);
      }

      return await base44.entities.ComprasOrden.update(ocId, {
        status: 'Aguardando Aprovacao',
        approval_status: 'Pendente',
        updated_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Erro ao enviar OC para aprovação:', error);
      throw error;
    }
  },

  /**
   * Aprova uma OC
   * Transição: Aguardando Aprovação → Aguardando Envio
   * @param {string} ocId - UUID da OC
   * @param {Object} data - { comments? }
   * @returns {Promise<Object>}
   */
  async approveOc(ocId, data = {}) {
    try {
      const oc = await base44.entities.ComprasOrden.get(ocId);
      
      if (oc.status !== 'Aguardando Aprovacao') {
        throw new Error(`Só é possível aprovar OCs em status "Aguardando Aprovação". Status atual: ${oc.status}`);
      }

      // Aqui você pode adicionar lógica para obter o ID do usuário aprovador
      // Para agora, deixamos como null - a aplicação React passará o user_id
      const approvedBy = data.approved_by || null;

      return await base44.entities.ComprasOrden.update(ocId, {
        status: 'Aguardando Envio',
        approval_status: 'Aprovado',
        approved_by: approvedBy,
        approval_date: new Date().toISOString(),
        approval_comments: data.comments || '',
        updated_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Erro ao aprovar OC:', error);
      throw error;
    }
  },

  /**
   * Rejeita uma OC
   * Transição: Aguardando Aprovação → Rascunho (para revisão)
   * @param {string} ocId - UUID da OC
   * @param {Object} data - { comments }
   * @returns {Promise<Object>}
   */
  async rejectOc(ocId, data = {}) {
    try {
      const oc = await base44.entities.ComprasOrden.get(ocId);
      
      if (oc.status !== 'Aguardando Aprovacao') {
        throw new Error(`Só é possível rejeitar OCs em status "Aguardando Aprovação". Status atual: ${oc.status}`);
      }

      const rejectedBy = data.rejected_by || null;

      return await base44.entities.ComprasOrden.update(ocId, {
        status: 'Rascunho', // Volta para rascunho para revisão
        approval_status: 'Rejeitado',
        approved_by: rejectedBy,
        approval_date: new Date().toISOString(),
        approval_comments: data.comments || '',
        updated_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Erro ao rejeitar OC:', error);
      throw error;
    }
  },

  /**
   * Atualiza o status de uma OC com validação de transição
   * Estados válidos: Rascunho, Aguardando Aprovacao, Aguardando Envio, Pedido Enviado, 
   *                  Parcialmente Recebido, Recebido, Cancelada
   * @param {string} ocId - UUID da OC
   * @param {string} novoStatus - Novo status
   * @returns {Promise<Object>}
   */
  async updateOcStatus(ocId, novoStatus) {
    try {
      const statusValidos = [
        'Rascunho',
        'Aguardando Aprovacao',
        'Aguardando Envio',
        'Pedido Enviado',
        'Parcialmente Recebido',
        'Recebido',
        'Cancelada'
      ];
      
      if (!statusValidos.includes(novoStatus)) {
        throw new Error(`Status inválido: ${novoStatus}`);
      }

      const oc = await base44.entities.ComprasOrden.get(ocId);
      
      // Validar transição de estado
      const transicoes = {
        'Rascunho': ['Aguardando Aprovacao', 'Pedido Enviado', 'Cancelada'],
        'Aguardando Aprovacao': ['Aguardando Envio', 'Rascunho', 'Cancelada'],
        'Aguardando Envio': ['Pedido Enviado', 'Rascunho', 'Cancelada'],
        'Pedido Enviado': ['Parcialmente Recebido', 'Recebido', 'Cancelada'],
        'Parcialmente Recebido': ['Recebido', 'Cancelada'],
        'Recebido': ['Cancelada'],
        'Cancelada': []
      };

      if (!transicoes[oc.status]?.includes(novoStatus)) {
        throw new Error(`Transição inválida de ${oc.status} para ${novoStatus}`);
      }

      return await base44.entities.ComprasOrden.update(ocId, {
        status: novoStatus,
        updated_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Erro ao atualizar status da OC:', error);
      throw error;
    }
  },

  /**
   * Registra um recebimento de OC (com suporte a recebimentos parciais)
   * Atualiza estoque, histórico de recebimento e cria lançamento financeiro
   * @param {string} ocId - UUID da OC
   * @param {Object} dadosRecebimento - { itens_recebidos[{ item_id, quantidade_recebida }], chave_nfe?, observacoes? }
   * @returns {Promise<Object>}
   */
  async receberOc(ocId, dadosRecebimento) {
    try {
      const { itens_recebidos = [], chave_nfe, observacoes } = dadosRecebimento;

      const oc = await base44.entities.ComprasOrden.get(ocId);

      if (oc.status !== 'Pedido Enviado' && oc.status !== 'Parcialmente Recebido') {
        throw new Error(`Só é possível receber OCs em status "Pedido Enviado" ou "Parcialmente Recebido". Status atual: ${oc.status}`);
      }

      if (!itens_recebidos || itens_recebidos.length === 0) {
        throw new Error('Nenhum item foi selecionado para recebimento');
      }

      // 1. Criar registro de recebimento no histórico
      const { data: { session } } = await supabase.auth.getSession();
      const receivedBy = session?.user?.id || oc?.created_by || oc?.responsavel_id || DEFAULT_TENANT_ID;
      const tenantId = oc.tenant_id || oc.metadata?.tenant_id || DEFAULT_TENANT_ID;

      const { data: recebimentoData, error: recebimentoError } = await supabase
        .from('compras_recebimentos_historico')
        .insert({
          tenant_id: tenantId,
          ordem_compra_id: ocId,
          numero_oc: oc.numero_pedido,
          numero_nfe: chave_nfe || null,
          observacoes: observacoes || null,
          recebido_por: receivedBy
        })
        .select()
        .single();

      if (recebimentoError) {
        throw new Error(`Erro ao criar registro de recebimento: ${recebimentoError.message}`);
      }

      const recebimentoId = recebimentoData.id;
      const produtosProcessados = new Set();

      // 2. Processar cada item recebido: atualizar item, estoque e criar histórico
      let totalItensProcessados = 0;
      const lojaId = oc.metadata?.loja_id || null; // null = sem loja definida (fallback direto no produto)
      const produtosIncrementosDiretos = new Map(); // Acumula qtd quando lojaId é desconhecido
      const movimentacoesAuditoria = []; // Coleta registros de auditoria para inserção em lote

      for (const itemRecebido of itens_recebidos) {
        const { item_id, quantidade_recebida } = itemRecebido;

        if (!quantidade_recebida || quantidade_recebida <= 0) continue;

        // Buscar dados do item OC
        const { data: itemOc, error: itemError } = await supabase
          .from('compras_oc_itens')
          .select('*')
          .eq('id', item_id)
          .single();

        if (itemError) {
          console.warn(`Aviso: Item ${item_id} não encontrado, pulando...`);
          continue;
        }

        if (!itemOc?.produto_id) continue;

        // Calcular novo status de recebimento do item
        const quantidadeRecebidaAnterior = itemOc.quantidade_recebida || 0;
        const quantidadeRecebidaTotal = quantidadeRecebidaAnterior + quantidade_recebida;
        let statusRecebimentoItem = 'Pendente';

        if (quantidadeRecebidaTotal >= itemOc.quantidade_pedida) {
          statusRecebimentoItem = 'Completo';
        } else if (quantidadeRecebidaTotal > 0) {
          statusRecebimentoItem = 'Parcial';
        }

        // Atualizar item OC com nova quantidade e status
        await supabase
          .from('compras_oc_itens')
          .update({
            quantidade_recebida: quantidadeRecebidaTotal,
            status_recebimento: statusRecebimentoItem
          })
          .eq('id', item_id);

        // Registrar detalhe do recebimento para auditoria
        await supabase
          .from('compras_recebimentos_itens')
          .insert({
            recebimento_id: recebimentoId,
            oc_item_id: item_id,
            quantidade_recebida: quantidade_recebida,
            preco_unitario: itemOc.preco_unitario,
            observacao_item: null
          });

        // Atualizar estoque
        if (lojaId) {
          // Loja conhecida: atualiza estoque_loja e reagrega por produto
          const { data: estoque } = await supabase
            .from('estoque_loja')
            .select('quantidade')
            .eq('produto_id', itemOc.produto_id)
            .eq('loja_id', lojaId)
            .single();

          if (estoque) {
            await supabase
              .from('estoque_loja')
              .update({
                quantidade: (estoque.quantidade || 0) + quantidade_recebida,
                ultimo_recebimento: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('produto_id', itemOc.produto_id)
              .eq('loja_id', lojaId);
          } else {
            await supabase
              .from('estoque_loja')
              .insert({
                produto_id: itemOc.produto_id,
                loja_id: lojaId,
                quantidade: quantidade_recebida,
                tenant_id: tenantId,
                ultimo_recebimento: new Date().toISOString(),
              });
          }

          movimentacoesAuditoria.push({
            produto_id: itemOc.produto_id,
            evento_tipo: 'recebimento',
            modulo_origem: 'compras',
            quantidade: quantidade_recebida,
            estoque_antes_local: estoque?.quantidade || 0,
            estoque_depois_local: (estoque?.quantidade || 0) + quantidade_recebida,
            loja_destino: lojaId,
            referencia_id: ocId,
            referencia_numero: oc.numero_pedido || null,
            usuario_id: receivedBy,
            organization_id: tenantId || DEFAULT_TENANT_ID
          });
          produtosProcessados.add(itemOc.produto_id);
        } else {
          // Loja desconhecida: acumula para atualização direta em produtos.quantidade_estoque
          produtosIncrementosDiretos.set(
            itemOc.produto_id,
            (produtosIncrementosDiretos.get(itemOc.produto_id) || 0) + quantidade_recebida
          );
          movimentacoesAuditoria.push({
            produto_id: itemOc.produto_id,
            evento_tipo: 'recebimento',
            modulo_origem: 'compras',
            quantidade: quantidade_recebida,
            referencia_id: ocId,
            referencia_numero: oc.numero_pedido || null,
            usuario_id: receivedBy,
            organization_id: tenantId || DEFAULT_TENANT_ID
          });
        }

        totalItensProcessados++;
      }

      // Reagregar quantidade_estoque a partir de estoque_loja (quando loja é conhecida)
      for (const produtoId of produtosProcessados) {
        const { data: estoquesProduto, error: estoqueProdutoError } = await supabase
          .from('estoque_loja')
          .select('quantidade')
          .eq('produto_id', produtoId);

        if (estoqueProdutoError) {
          console.warn('Erro ao recalcular estoque agregado do produto:', estoqueProdutoError);
          continue;
        }

        const quantidadeTotal = (estoquesProduto || []).reduce(
          (sum, estoqueItem) => sum + (estoqueItem.quantidade || 0),
          0
        );

        await base44.entities.Produto.update(produtoId, {
          quantidade_estoque: quantidadeTotal,
        });
      }

      // Atualização direta quando loja é desconhecida (evita registrar em loja fantasma)
      for (const [produtoId, qtdRecebida] of produtosIncrementosDiretos) {
        const produto = await base44.entities.Produto.getById(produtoId);
        if (produto) {
          await base44.entities.Produto.update(produtoId, {
            quantidade_estoque: (produto.quantidade_estoque || 0) + qtdRecebida,
          });
        }
      }


      // Registrar movimentações de estoque para auditoria
      if (movimentacoesAuditoria.length > 0) {
        try {
          await supabase.from('movimentacoes_estoque').insert(movimentacoesAuditoria);
        } catch (auditErr) {
          console.warn('Falha ao registrar movimentações de recebimento:', auditErr);
        }
      }

      // 3. Verificar se OC foi completamente recebida
      const { data: todosItensOc } = await supabase
        .from('compras_oc_itens')
        .select('quantidade_pedida, quantidade_recebida')
        .eq('ordem_compra_id', ocId);

      const todosCompletados = todosItensOc?.every(item => item.quantidade_recebida >= item.quantidade_pedida);
      const novoStatusOc = todosCompletados ? 'Recebido' : 'Parcialmente Recebido';

      // 4. Atualizar status da OC
      await base44.entities.ComprasOrden.update(ocId, {
        status: novoStatusOc,
        updated_at: new Date().toISOString()
      });

      await supabase
        .from('solicitacoes_encomenda')
        .update({
          status: todosCompletados ? 'recebida' : 'recebida_parcial',
          observacoes: observacoes || null,
        })
        .eq('ordem_id', ocId);

      // 4.5. Registrar histórico de preços para cada item recebido
      for (const itemRecebido of itens_recebidos) {
        const { item_id } = itemRecebido;
        const { data: itemOc } = await supabase
          .from('compras_oc_itens')
          .select('produto_id, preco_unitario')
          .eq('id', item_id)
          .single();

        if (itemOc?.produto_id) {
          const produto = await base44.entities.Produto.getById(itemOc.produto_id);
          if (produto) {
            // Buscar último preço registrado (se houver) para comparar
            const { data: ultimoPrecoDados } = await supabase
              .from('historico_precos')
              .select('preco_novo')
              .eq('produto_id', itemOc.produto_id)
              .eq('fornecedor_id', oc.fornecedor_id)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();

            const precoCusto = itemOc.preco_unitario || 0;
            const precoAnterior = ultimoPrecoDados?.preco_novo || precoCusto;
            const deltaPercentual = precoAnterior > 0 ? ((precoCusto - precoAnterior) / precoAnterior) * 100 : 0;

            // Inserir no histórico de preços
            await supabase
              .from('historico_precos')
              .insert({
                tenant_id: tenantId,
                produto_id: itemOc.produto_id,
                produto_nome: produto.nome || 'Sem nome',
                fornecedor_id: oc.fornecedor_id,
                fornecedor_nome: oc.fornecedor_nome,
                ordem_compra_id: ocId,
                numero_oc: oc.numero_pedido,
                motivo: 'recebimento_oc',
                preco_anterior: precoAnterior,
                preco_novo: precoCusto,
                delta_percentual: Math.round(deltaPercentual * 100) / 100,
                created_at: new Date().toISOString()
              });
          }
        }
      }

      // 5. Criar Lançamento Financeiro automaticamente (apenas se completamente recebido)
      if (todosCompletados) {
        const dataVencimento = new Date(oc.data_pedido);
        dataVencimento.setDate(dataVencimento.getDate() + (oc.prazo_pagamento || 30));

        const { data: categoriasCompra } = await supabase
          .from('categorias_financeiras')
          .select('id, nome')
          .eq('nome', 'Compras de Estoque')
          .single();

        const lancamentoPayload = {
          tipo: 'DESPESA',
          descricao: `Compra OC #${oc.numero_pedido}`,
          valor: oc.valor_total,
          data_vencimento: dataVencimento.toISOString().split('T')[0],
          data_lancamento: new Date().toISOString().split('T')[0],
          status: 'Pendente',
          observacao: `Lançamento gerado automaticamente pelo recebimento da OC ${oc.numero_pedido}.`
        };

        if (categoriasCompra?.id) {
          lancamentoPayload.categoria_id = categoriasCompra.id;
          lancamentoPayload.categoria_nome = categoriasCompra.nome;
        }

        await base44.entities.LancamentoFinanceiro.create(lancamentoPayload);
      }

      return {
        success: true,
        message: `${totalItensProcessados} item(ns) recebido(s). Status: ${novoStatusOc}`,
        novoStatus: novoStatusOc
      };
    } catch (error) {
      console.error('Erro ao receber OC:', error);
      throw error;
    }
  },

  /**
   * Cancela uma OC
   * @param {string} ocId - UUID da OC
   * @param {string} motivo - Motivo do cancelamento
   * @returns {Promise<Object>}
   * @throws {Error} Se OC já foi recebida e contabilizou estoque
   */
  async cancelOc(ocId, motivo = '') {
    try {
      // Buscar OC para verificar seu status
      const oc = await base44.entities.ComprasOrden.read(ocId);

      // Validação: Não permite cancelar OCs que já foram recebidas
      if (oc.status === 'Recebido' || oc.status === 'Parcialmente Recebido') {
        throw new Error(
          `Não é possível cancelar uma OC que já foi recebida e teve a quantidade contabilizada no estoque. Status atual: ${oc.status}`
        );
      }

      return await base44.entities.ComprasOrden.update(ocId, {
        status: 'Cancelada',
        observacoes: `Cancelada: ${motivo}`,
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Erro ao cancelar OC:', error);
      throw error;
    }
  },

  /**
   * Edita uma OC (apenas se status = Rascunho)
   * @param {string} ocId - UUID da OC
   * @param {Object} dados - Dados a atualizar
   * @returns {Promise<Object>}
   */
  async editarOc(ocId, dados) {
    try {
      const oc = await base44.entities.ComprasOrden.get(ocId);
      
      if (!['Rascunho', 'Aguardando Envio'].includes(oc.status)) {
        throw new Error('Só é possível editar OCs em status "Rascunho" ou "Aguardando Envio"');
      }

      if (dados.itens) {
        await validarFornecedorDosItensOc(dados.fornecedor_id || oc.fornecedor_id, dados.itens);
      }

      return await base44.entities.ComprasOrden.update(ocId, {
        ...dados,
        updated_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Erro ao editar OC:', error);
      throw error;
    }
  },

  /**
   * Atualiza campos de acompanhamento da OC mesmo após envio ao fornecedor
   * @param {string} ocId
   * @param {Object} dados
   * @returns {Promise<Object>}
   */
  async updateOcTracking(ocId, dados) {
    try {
      const oc = await base44.entities.ComprasOrden.get(ocId);
      const metadataAtual = oc.metadata || {};
      const metadataNova = mergeOcMetadata(
        metadataAtual,
        {
          pedido_faturado: dados.pedido_faturado,
          data_faturamento: dados.data_faturamento || null,
          vendedor_id: dados.metadata?.vendedor_id || metadataAtual.vendedor_id || null,
          vendedor_nome: dados.metadata?.vendedor_nome || metadataAtual.vendedor_nome || null,
          origem: dados.metadata?.origem || metadataAtual.origem || null,
        },
        dados.loja_id || metadataAtual.loja_id || null
      );

      return await base44.entities.ComprasOrden.update(ocId, {
        fornecedor_id: dados.fornecedor_id,
        fornecedor_nome: dados.fornecedor_nome,
        centro_custo_id: dados.centro_custo_id,
        data_previsao_entrega: dados.data_previsao_entrega,
        observacoes: dados.observacoes,
        metadata: metadataNova,
        updated_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Erro ao atualizar acompanhamento da OC:', error);
      throw error;
    }
  },

  /**
   * Deleta uma OC (soft delete, apenas Rascunho)
   * @param {string} ocId - UUID da OC
   * @returns {Promise<void>}
   */
  async deleteOc(ocId) {
    try {
      const oc = await base44.entities.ComprasOrden.get(ocId);
      
      if (oc.status !== 'Rascunho') {
        throw new Error('Só é possível deletar OCs em status "Rascunho"');
      }

      // Deletar itens associados
      await supabase
        .from('compras_oc_itens')
        .delete()
        .eq('ordem_compra_id', ocId);

      // Soft delete da OC
      return await base44.entities.ComprasOrden.update(ocId, {
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Erro ao deletar OC:', error);
      throw error;
    }
  },

  /**
   * Gera número único de pedido (sequencial)
   * @returns {Promise<string>}
   */
  async _gerarNumeroPedido() {
    try {
      const { count } = await supabase
        .from('compras_ordens')
        .select('*', { count: 'exact', head: true });
      
      const ano = new Date().getFullYear();
      const numero = String((count || 0) + 1).padStart(5, '0');
      return `OC-${ano}-${numero}`;
    } catch (error) {
      console.error('Erro ao gerar número de pedido:', error);
      return `OC-${Date.now()}`;
    }
  }
};
