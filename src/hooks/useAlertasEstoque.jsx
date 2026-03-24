import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { base44 } from '@/api/base44Client';

/**
 * Hook para monitorar estoque mínimo e criar encomendas automaticamente
 * Roda em background verificando a cada 5 minutos
 * 
 * @param {string} lojaId - ID da loja para filtrar alertas (opcional)
 * @param {boolean} enabled - Se deve ativar o monitoramento
 * @returns {Object} { alertasAtivos, isChecking, ultimaVerificacao }
 */
export function useAlertasEstoque(lojaId = null, enabled = true) {
  const queryClient = useQueryClient();
  const intervalRef = useRef(null);
  const ultimaVerificacaoRef = useRef(null);

  // Query: Alertas de Recompra
  const { data: alertas = [] } = useQuery({
    queryKey: ['alertas_recompra'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alertas_recompra')
        .select('*')
        .eq('habilitado', true);

      if (error) {
        console.error('[useAlertasEstoque] Erro ao buscar alertas:', error);
        return [];
      }
      return data || [];
    },
    enabled,
    staleTime: 10 * 60 * 1000, // 10 minutos
  });

  // Query: Estoque por Loja
  const { data: estoqueLojas = [] } = useQuery({
    queryKey: ['estoque_loja'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estoque_loja')
        .select('*');

      if (error) {
        console.error('[useAlertasEstoque] Erro ao buscar estoque:', error);
        return [];
      }
      return data || [];
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  // Mutation: Criar SolicitacaoEncomenda
  const criarEncomendaMutation = useMutation({
    mutationFn: async (dados) => {
      const { produto_id, produto_nome, fornecedor_id, quantidade_sugerida } = dados;

      // Buscar ou criar SolicitacaoEncomenda
      const { data: existente } = await supabase
        .from('solicitacoes_encomenda')
        .select('*')
        .eq('produto_id', produto_id)
        .in('status', ['pendente', 'Pendente', 'aguardando_compra', 'em_compra'])
        .limit(1)
        .single();

      if (existente) {
        console.log(`[useAlertasEstoque] SolicitacaoEncomenda já existe para produto ${produto_id}`);
        return existente;
      }

      return await base44.entities.SolicitacaoEncomenda.create({
        produto_id,
        produto_nome,
        fornecedor_id,
        quantidade: quantidade_sugerida,
        status: 'pendente',
        data_criacao: new Date().toISOString(),
        motivo: 'Alerta automático - estoque mínimo atingido',
      });
    },
    onSuccess: (data, variables) => {
      toast.success(`Encomenda criada automaticamente para ${variables.produto_nome}`);
      queryClient.invalidateQueries({ queryKey: ['solicitacoes_encomenda'] });
    },
    onError: (error) => {
      console.error('[useAlertasEstoque] Erro ao criar encomenda:', error);
      toast.error('Erro ao criar encomenda automática');
    },
  });

  // Função para verificar alertas e criar encomendas
  const verificarAlertas = async () => {
    try {
      const agora = new Date();
      ultimaVerificacaoRef.current = agora;

      console.log('[useAlertasEstoque] Verificando alertas de estoque mínimo...');

      for (const alerta of alertas) {
        // Filtrar por loja se especificado
        const estoqueLoja = estoqueLojas.find(
          e => e.produto_id === alerta.produto_id && 
               (!lojaId || e.loja_id === lojaId)
        );

        if (!estoqueLoja) {
          // Produto não tem registro de estoque em nenhuma loja
          console.warn(`[useAlertasEstoque] Produto ${alerta.produto_id} não tem estoque registrado`);
          continue;
        }

        const quantidadeAtual = estoqueLoja.quantidade || 0;
        const estoque_minimo = alerta.estoque_minimo || 0;

        if (quantidadeAtual < estoque_minimo) {
          console.log(
            `[useAlertasEstoque] ALERTA: Produto ${alerta.produto_id} abaixo do mínimo (${quantidadeAtual} < ${estoque_minimo})`
          );

          // Calcular quantidade sugerida (mínimo * 2 como padrão)
          const quantidade_sugerida = estoque_minimo * 2;

          // Criar encomenda
          criarEncomendaMutation.mutate({
            produto_id: alerta.produto_id,
            produto_nome: alerta.produto_nome,
            fornecedor_id: alerta.fornecedor_id,
            quantidade_sugerida,
          });
        }
      }
    } catch (error) {
      console.error('[useAlertasEstoque] Erro durante verificação:', error);
    }
  };

  // Efeito: Verificar alertas a cada 5 minutos
  useEffect(() => {
    if (!enabled || alertas.length === 0) {
      return;
    }

    // Verificar imediatamente
    verificarAlertas();

    // Agendar verificações periódicas (5 minutos)
    intervalRef.current = setInterval(() => {
      verificarAlertas();
    }, 5 * 60 * 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, alertas, estoqueLojas]);

  // Encontrar alertas ativos (produtos com estoque < mínimo)
  const alertasAtivos = alertas.filter(alerta => {
    const estoque = estoqueLojas.find(
      e => e.produto_id === alerta.produto_id && (!lojaId || e.loja_id === lojaId)
    );
    return estoque && estoque.quantidade < alerta.estoque_minimo;
  });

  return {
    alertasAtivos,
    totalAlertas: alertasAtivos.length,
    isChecking: criarEncomendaMutation.isPending,
    ultimaVerificacao: ultimaVerificacaoRef.current,
    verificarAgora: verificarAlertas,
  };
}
