import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ShieldCheck,
  Search,
  Clock,
  RefreshCw,
  AlertTriangle,
  Check,
  Loader2,
  User,
  CreditCard,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/contexts/TenantContext';
import { isAguardandoConferencia, aprovarConferencia, devolverParaVendedor } from '@/services/conferenciaCaixaService';
import ConferenciaCaixaModal from '@/components/conferencia/ConferenciaCaixaModal';
import { formatarNome } from '@/utils/formatters';
import { formatarDataExibicao } from '@/utils/dateUtils';

const formatCurrency = (val) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

export default function PainelConferenciaCaixa() {
  const { user } = useAuth();
  const { conferenciaCaixaEnabled } = useTenant();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [vendaParaConferencia, setVendaParaConferencia] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Query de vendas pendentes de conferência
  const { data: todasVendas = [], isLoading, refetch } = useQuery({
    queryKey: ['vendas-conferencia'],
    queryFn: () => base44.entities.Venda.list('-data_venda'),
    enabled: !!user && conferenciaCaixaEnabled,
    refetchInterval: 15000, // atualizar a cada 15s
  });

  // Query de configurações auxiliares para o serviço de aprovação
  const { data: taxas = [] } = useQuery({
    queryKey: ['configuracao_taxas'],
    queryFn: () => base44.entities.ConfiguracaoTaxa.list(),
    enabled: !!user,
  });

  const { data: categoriasFinanceiras = [] } = useQuery({
    queryKey: ['categorias-financeiras'],
    queryFn: () => base44.entities.CategoriaFinanceira?.list?.() || Promise.resolve([]),
    enabled: !!user,
  });

  const { data: prazosConfig = [] } = useQuery({
    queryKey: ['prazos-entrega'],
    queryFn: async () => {
      const { data, error } = await supabase.from('prazos_entrega').select('*');
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Filtrar vendas aguardando conferência
  const vendasPendentes = todasVendas.filter(v => isAguardandoConferencia(v));

  const vendasFiltradas = vendasPendentes.filter(v => {
    if (!searchTerm.trim()) return true;
    const termo = searchTerm.toLowerCase();
    return (
      v.cliente_nome?.toLowerCase().includes(termo) ||
      v.numero_pedido?.includes(termo)
    );
  });

  const handleAprovar = async ({ pagamentos, observacao }) => {
    if (!vendaParaConferencia) return;
    setIsProcessing(true);
    try {
      await aprovarConferencia({
        venda: vendaParaConferencia,
        gerente: { id: user?.id, nome: user?.full_name || user?.email },
        pagamentosConferidos: pagamentos,
        observacao,
        taxas,
        categoriasFinanceiras,
        prazosConfig,
      });

      toast.success(`Pedido #${vendaParaConferencia.numero_pedido} aprovado! Entrega e lançamentos criados.`);
      setIsModalOpen(false);
      setVendaParaConferencia(null);
      queryClient.invalidateQueries({ queryKey: ['vendas-conferencia'] });
      queryClient.invalidateQueries({ queryKey: ['vendas-gerente'] });
      queryClient.invalidateQueries({ queryKey: ['vendas'] });
      queryClient.invalidateQueries({ queryKey: ['entregas'] });
      queryClient.invalidateQueries({ queryKey: ['lancamentos-financeiros'] });
    } catch (err) {
      console.error('Erro ao aprovar conferência:', err);
      toast.error(err?.message || 'Não foi possível aprovar o pedido.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDevolver = async ({ motivo }) => {
    if (!vendaParaConferencia) return;
    setIsProcessing(true);
    try {
      await devolverParaVendedor({
        venda: vendaParaConferencia,
        gerente: { id: user?.id, nome: user?.full_name || user?.email },
        motivo,
      });

      toast.success(`Pedido #${vendaParaConferencia.numero_pedido} devolvido ao vendedor para correção.`);
      setIsModalOpen(false);
      setVendaParaConferencia(null);
      queryClient.invalidateQueries({ queryKey: ['vendas-conferencia'] });
      queryClient.invalidateQueries({ queryKey: ['vendas'] });
    } catch (err) {
      console.error('Erro ao devolver pedido:', err);
      toast.error(err?.message || 'Não foi possível devolver o pedido.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!conferenciaCaixaEnabled) {
    return (
      <Card className="border-dashed border-2 border-gray-200">
        <CardContent className="py-10 text-center">
          <ShieldCheck className="w-10 h-10 mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500 font-medium">Módulo de Conferência de Caixa inativo</p>
          <p className="text-xs text-gray-400 mt-1">
            Ative em Configurações → Compras e Pagamentos.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Conferência de Caixa</h2>
            <p className="text-sm text-gray-500">
              {vendasPendentes.length > 0
                ? `${vendasPendentes.length} pedido(s) aguardando conferência`
                : 'Nenhum pedido aguardando conferência'}
            </p>
          </div>
        </div>
        <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          className="pl-9"
          placeholder="Buscar por cliente ou nº do pedido..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-amber-50">
              <TableRow>
                <TableHead className="w-[100px]">Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Forma Pagamento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                    <p className="text-sm text-gray-500">Carregando...</p>
                  </TableCell>
                </TableRow>
              ) : vendasFiltradas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-14">
                    <Check className="w-10 h-10 mx-auto text-green-300 mb-3" />
                    <p className="font-medium text-gray-500">
                      {searchTerm
                        ? 'Nenhum pedido encontrado para esta busca.'
                        : 'Todos os pedidos foram conferidos! ✅'}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      Novas vendas aparecerão aqui automaticamente.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                vendasFiltradas.map((venda) => (
                  <TableRow
                    key={venda.id}
                    className="hover:bg-amber-50/50 transition-colors cursor-pointer"
                    onClick={() => {
                      setVendaParaConferencia(venda);
                      setIsModalOpen(true);
                    }}
                  >
                    <TableCell className="font-bold text-amber-700">
                      #{venda.numero_pedido}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{formatarNome(venda.cliente_nome)}</span>
                        {venda.cliente_telefone && (
                          <span className="text-xs text-gray-400">{venda.cliente_telefone}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {formatarDataExibicao(venda.data_venda)}
                    </TableCell>
                    <TableCell className="font-semibold text-green-700">
                      {formatCurrency(venda.valor_total)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm text-gray-600">
                        <CreditCard className="w-3.5 h-3.5 text-gray-400" />
                        {venda.forma_pagamento || 'Não informado'}
                      </div>
                    </TableCell>
                    <TableCell>
                      {venda.conferencia_caixa_status === 'devolvido' ? (
                        <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-xs">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Devolvido
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          Aguardando
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        className="bg-amber-500 hover:bg-amber-600 text-white"
                        onClick={() => {
                          setVendaParaConferencia(venda);
                          setIsModalOpen(true);
                        }}
                      >
                        <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                        Conferir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal de Conferência */}
      <ConferenciaCaixaModal
        open={isModalOpen}
        onClose={() => {
          if (!isProcessing) {
            setIsModalOpen(false);
            setVendaParaConferencia(null);
          }
        }}
        venda={vendaParaConferencia}
        onAprovar={handleAprovar}
        onDevolver={handleDevolver}
        isLoading={isProcessing}
      />
    </div>
  );
}
