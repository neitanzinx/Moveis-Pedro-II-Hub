import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44, supabase } from '@/api/base44Client';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  RefreshCw, 
  Scale, 
  Truck, 
  ShoppingCart, 
  ClipboardCheck,
  AlertCircle,
  Loader2 
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPrice } from '@/utils/productFormatters';

/**
 * Component para exibir histórico de movimentações de estoque
 * Agrupa eventos de: vendas, transferências, inventários, recebimentos, ajustes manuais
 * 
 * @param {string} produtoId - ID do produto
 * @returns JSX
 */
export default function ProdutoHistoricoTab({ produtoId }) {
  // Query movimentações do novo sistema
  const { data: movimentacoes = [], isLoading } = useQuery({
    queryKey: ['movimentacoes-estoque', produtoId],
    queryFn: async () => {
      if (!produtoId) return [];
      
      const { data, error } = await supabase
        .from('movimentacoes_estoque')
        .select('*')
        .eq('produto_id', produtoId)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) {
        console.error('Erro ao buscar movimentações:', error);
        return [];
      }
      
      return data || [];
    },
    enabled: !!produtoId,
    staleTime: 1000 * 60 * 2 // Cache for 2 mins
  });

  // Map evento_tipo to UI representation
  const getEventoConfig = (tipo) => {
    const configs = {
      'venda': {
        label: 'Venda',
        icon: ShoppingCart,
        color: 'bg-blue-100',
        textColor: 'text-blue-700',
        badgeVariant: 'default'
      },
      'transferencia_saida': {
        label: 'Saída - Transfer.',
        icon: ArrowUpRight,
        color: 'bg-purple-100',
        textColor: 'text-purple-700',
        badgeVariant: 'secondary'
      },
      'transferencia_entrada': {
        label: 'Entrada - Transfer.',
        icon: ArrowDownLeft,
        color: 'bg-green-100',
        textColor: 'text-green-700',
        badgeVariant: 'secondary'
      },
      'inventario': {
        label: 'Inventário',
        icon: Scale,
        color: 'bg-orange-100',
        textColor: 'text-orange-700',
        badgeVariant: 'outline'
      },
      'recebimento': {
        label: 'Recebimento',
        icon: Truck,
        color: 'bg-green-100',
        textColor: 'text-green-700',
        badgeVariant: 'default'
      },
      'ajuste_manual': {
        label: 'Ajuste Manual',
        icon: RefreshCw,
        color: 'bg-red-100',
        textColor: 'text-red-700',
        badgeVariant: 'destructive'
      },
      'conferencia_estoque': {
        label: 'Conferência de Estoque',
        icon: ClipboardCheck,
        color: 'bg-emerald-100',
        textColor: 'text-emerald-700',
        badgeVariant: 'default'
      },
      'cancelamento_devolucao': {
        label: 'Cancelamento/Devolução',
        icon: RefreshCw,
        color: 'bg-red-100',
        textColor: 'text-red-700',
        badgeVariant: 'destructive'
      },
      'default': {
        label: 'Movimentação',
        icon: RefreshCw,
        color: 'bg-gray-100',
        textColor: 'text-gray-700',
        badgeVariant: 'outline'
      }
    };
    
    return configs[tipo] || configs.default;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-green-600 mr-2" />
          <p className="text-gray-500">Carregando histórico...</p>
        </CardContent>
      </Card>
    );
  }

  if (movimentacoes.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="w-8 h-8 text-gray-400 mb-2" />
          <p className="text-gray-500">Nenhuma movimentação registrada para este produto</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200"></div>

        {/* Events */}
        <div className="space-y-6">
          {movimentacoes.map((mov, index) => {
            const config = getEventoConfig(mov.evento_tipo);
            const Icon = config.icon;
            const dataHora = formatDate(mov.created_at);
            const isConferencia = mov.evento_tipo === 'conferencia_estoque';
            const estoqueAntes = isConferencia ? mov.estoque_antes_total : mov.estoque_antes_local;
            const estoqueDepois = isConferencia ? mov.estoque_depois_total : mov.estoque_depois_local;
            const estoqueAntesLabel = (estoqueAntes !== null && estoqueAntes !== undefined) ? estoqueAntes : '-';
            const estoqueDepoisLabel = (estoqueDepois !== null && estoqueDepois !== undefined) ? estoqueDepois : '-';
            
            // Parse quantity change
            const quantidadeStr = mov.quantidade ? mov.quantidade.toString() : '0';
            const isNegative = mov.quantidade < 0;

            return (
              <div key={mov.id} className="relative">
                {/* Timeline dot */}
                <div className={`absolute left-0 top-1 w-14 h-14 flex items-center justify-center ${config.color} rounded-full border-2 border-white`}>
                  <Icon className={`w-5 h-5 ${config.textColor}`} />
                </div>

                {/* Content card */}
                <div className="ml-24">
                  <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {/* Header: tipo + data */}
                        <div className="flex items-baseline justify-between gap-2">
                          <Badge variant={config.badgeVariant} className="text-sm">
                            {config.label}
                          </Badge>
                          <span className="text-xs text-gray-500">{dataHora}</span>
                        </div>

                        {/* Main metrics: quantidade, antes, depois */}
                        <div className="grid grid-cols-3 gap-3 text-sm">
                          <div>
                            <span className="text-xs text-gray-500">Movimentação</span>
                            <p className={`font-semibold text-lg ${isNegative ? 'text-red-600' : 'text-green-600'}`}>
                              {isNegative ? '' : '+'}{quantidadeStr}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500">Estava</span>
                            <p className="font-medium">{estoqueAntesLabel}</p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500">Ficou</span>
                            <p className="font-medium">{estoqueDepoisLabel}</p>
                          </div>
                        </div>

                        {/* User attribution */}
                        <div className="text-xs text-gray-600 pt-2 border-t">
                          <p>
                            <span className="font-semibold">{mov.usuario_nome || 'Sistema'}</span>
                            {mov.usuario_cargo && <span className="text-gray-500"> ({mov.usuario_cargo})</span>}
                          </p>
                        </div>

                        {/* Client context (for sales) */}
                        {mov.cliente_nome && (
                          <div className="text-xs bg-blue-50 p-2 rounded border border-blue-200">
                            <p className="font-semibold text-blue-900">{mov.cliente_nome}</p>
                            {mov.cliente_contato && <p className="text-blue-700">{mov.cliente_contato}</p>}
                          </div>
                        )}

                        {/* References and details */}
                        <div className="text-xs text-gray-600 space-y-1">
                          {mov.referencia_numero && (
                            <p>
                              <span className="font-semibold">Referência:</span> {mov.referencia_tipo} #{mov.referencia_numero}
                            </p>
                          )}
                          {mov.loja_origem && (
                            <p>
                              <span className="font-semibold">Origem:</span> {mov.loja_origem}
                            </p>
                          )}
                          {mov.loja_destino && (
                            <p>
                              <span className="font-semibold">Destino:</span> {mov.loja_destino}
                            </p>
                          )}
                          {mov.observacao && (
                            <p className="italic text-gray-500">
                              📝 {mov.observacao}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
