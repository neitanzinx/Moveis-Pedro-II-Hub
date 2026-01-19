import React, { useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingDown, Calendar, Package, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AlertasTab({ user }) {
  const queryClient = useQueryClient();

  // Listen for header action event to refresh alerts
  useEffect(() => {
    const handleAction = (e) => {
      if (e.detail === 'alertas') {
        queryClient.invalidateQueries({ queryKey: ['alertas-recompra'] });
        queryClient.invalidateQueries({ queryKey: ['produtos'] });
      }
    };
    window.addEventListener('estoque-header-action', handleAction);
    return () => window.removeEventListener('estoque-header-action', handleAction);
  }, [queryClient]);

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => base44.entities.Produto.list(),
  });

  const { data: vendas = [] } = useQuery({
    queryKey: ['vendas'],
    queryFn: () => base44.entities.Venda.list('-data_venda'),
  });

  const { data: alertasExistentes = [] } = useQuery({
    queryKey: ['alertas-recompra'],
    queryFn: () => base44.entities.AlertaRecompra.list('-created_date'),
    refetchInterval: 60000, // Atualizar a cada 1 minuto
  });

  const criarAlertaMutation = useMutation({
    mutationFn: (data) => base44.entities.AlertaRecompra.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alertas-recompra'] });
      queryClient.invalidateQueries({ queryKey: ['alertas-ativos-menu'] });
    },
  });

  const resolverAlertaMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.AlertaRecompra.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alertas-recompra'] });
      queryClient.invalidateQueries({ queryKey: ['alertas-ativos-menu'] });
    },
  });

  const isAdmin = user?.cargo === 'Administrador';
  const isManager = user?.cargo === 'Gerente';
  const isWarehouse = user?.cargo === 'Estoque';

  // Calcular alertas de recompra
  const calcularAlertasRecompra = () => {
    const alertas = [];
    const hoje = new Date();
    const ultimosMeses = new Date();
    ultimosMeses.setMonth(ultimosMeses.getMonth() - 3);

    (produtos || []).forEach(produto => {
      if (!produto.ativo) return;

      const vendasProduto = (vendas || []).filter(v => {
        const dataVenda = new Date(v.data_venda);
        return dataVenda >= ultimosMeses &&
          v.itens?.some(item => item.produto_id === produto.id);
      });

      if (vendasProduto.length === 0) return;

      const totalVendido = vendasProduto.reduce((sum, venda) => {
        const item = venda.itens.find(i => i.produto_id === produto.id);
        return sum + (item?.quantidade || 0);
      }, 0);

      const diasPeriodo = Math.ceil((hoje - ultimosMeses) / (1000 * 60 * 60 * 24));
      const mediaVendasDia = totalVendido / diasPeriodo;

      if (mediaVendasDia <= 0) return;

      const quantidadeAtual = (produto.quantidade_estoque || 0) - (produto.quantidade_reservada || 0);
      const diasParaAcabar = quantidadeAtual / mediaVendasDia;

      let nivelUrgencia = 'Baixo';
      if (diasParaAcabar <= 7) nivelUrgencia = 'Crítico';
      else if (diasParaAcabar <= 15) nivelUrgencia = 'Alto';
      else if (diasParaAcabar <= 30) nivelUrgencia = 'Médio';

      if (diasParaAcabar <= 30) {
        const dataPrevistaRuptura = new Date(hoje);
        dataPrevistaRuptura.setDate(dataPrevistaRuptura.getDate() + Math.floor(diasParaAcabar));
        const quantidadeSugerida = Math.ceil(mediaVendasDia * 60);

        alertas.push({
          produto_id: produto.id,
          produto_nome: produto.nome,
          loja: "Todas",
          quantidade_atual: quantidadeAtual,
          media_vendas_dia: parseFloat(mediaVendasDia.toFixed(2)),
          dias_para_acabar: Math.floor(diasParaAcabar),
          data_prevista_ruptura: dataPrevistaRuptura.toISOString().split('T')[0],
          nivel_urgencia: nivelUrgencia,
          quantidade_sugerida: quantidadeSugerida,
          status: 'Ativo'
        });
      }
    });

    return alertas.sort((a, b) => a.dias_para_acabar - b.dias_para_acabar);
  };

  const alertasCalculados = calcularAlertasRecompra();

  // Atualizar alertas automaticamente quando há novos alertas calculados
  useEffect(() => {
    if (alertasCalculados.length > 0 && alertasExistentes.length === 0) {
      // Auto-gerar alertas se houver alertas calculados e nenhum alerta ativo
      const autoGerarAlertas = async () => {
        for (const alerta of alertasCalculados) {
          await criarAlertaMutation.mutateAsync(alerta);
        }
      };
      autoGerarAlertas();
    }
  }, [alertasCalculados.length, alertasExistentes.length]);

  const gerarAlertas = async () => {
    for (const alerta of alertasExistentes.filter(a => a.status === 'Ativo')) {
      await base44.entities.AlertaRecompra.delete(alerta.id);
    }

    for (const alerta of alertasCalculados) {
      await criarAlertaMutation.mutateAsync(alerta);
    }
  };

  const marcarResolvido = (alerta) => {
    resolverAlertaMutation.mutate({
      id: alerta.id,
      data: {
        ...alerta,
        status: 'Resolvido',
        resolvido_em: new Date().toISOString(),
        resolvido_por: user.full_name
      }
    });
  };

  const nivelCores = {
    "Crítico": { bg: "#FEE2E2", text: "#991B1B", icon: "🚨" },
    "Alto": { bg: "#FED7AA", text: "#9A3412", icon: "⚠️" },
    "Médio": { bg: "#FEF3C7", text: "#92400E", icon: "⚡" },
    "Baixo": { bg: "#DBEAFE", text: "#1E40AF", icon: "ℹ️" }
  };

  const alertasAtivos = alertasExistentes.filter(a => a.status === 'Ativo');
  const alertasCriticos = alertasAtivos.filter(a => a.nivel_urgencia === 'Crítico').length;
  const alertasAltos = alertasAtivos.filter(a => a.nivel_urgencia === 'Alto').length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p style={{ color: '#8B8B8B' }}>
          Previsão de ruptura de estoque baseada no histórico de vendas • Atualização automática a cada minuto
        </p>
        {(isAdmin || isManager || isWarehouse) && (
          <Button
            onClick={gerarAlertas}
            disabled={criarAlertaMutation.isPending}
            className="shadow-lg"
            style={{ background: 'linear-gradient(135deg, #f38a4c 0%, #f5a164 100%)' }}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {criarAlertaMutation.isPending ? 'Atualizando...' : 'Atualizar Alertas'}
          </Button>
        )}
      </div>

      <Alert style={{ backgroundColor: '#f0f9ff', borderColor: '#3b82f6' }}>
        <AlertDescription>
          <strong>💡 Como funciona:</strong> O sistema analisa o histórico de vendas dos últimos 3 meses
          para calcular a média de vendas diária de cada produto e estimar quando o estoque acabará.
          Os alertas são atualizados automaticamente a cada minuto.
        </AlertDescription>
      </Alert>

      <div className="grid md:grid-cols-4 gap-6">
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-10 h-10 text-red-600" />
              <div>
                <p className="text-sm" style={{ color: '#8B8B8B' }}>Alertas Críticos</p>
                <p className="text-2xl font-bold text-red-600">{alertasCriticos}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <TrendingDown className="w-10 h-10 text-orange-600" />
              <div>
                <p className="text-sm" style={{ color: '#8B8B8B' }}>Urgência Alta</p>
                <p className="text-2xl font-bold text-orange-600">{alertasAltos}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Package className="w-10 h-10" style={{ color: '#07593f' }} />
              <div>
                <p className="text-sm" style={{ color: '#8B8B8B' }}>Total Ativos</p>
                <p className="text-2xl font-bold" style={{ color: '#07593f' }}>{alertasAtivos.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Calendar className="w-10 h-10 text-blue-600" />
              <div>
                <p className="text-sm" style={{ color: '#8B8B8B' }}>Previstos</p>
                <p className="text-2xl font-bold text-blue-600">{alertasCalculados.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {alertasAtivos.length === 0 && alertasCalculados.length === 0 ? (
        <Card className="border-0 shadow-lg">
          <CardContent className="p-12 text-center">
            <Package className="w-16 h-16 mx-auto mb-4 opacity-20" style={{ color: '#07593f' }} />
            <p className="text-xl mb-2" style={{ color: '#07593f' }}>
              Nenhum alerta no momento! 🎉
            </p>
            <p style={{ color: '#8B8B8B' }}>
              Todos os produtos têm estoque adequado
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {alertasCalculados.length > 0 && alertasAtivos.length === 0 && (
            <Alert className="border-2" style={{ borderColor: '#f38a4c', backgroundColor: '#FEF3C7' }}>
              <AlertDescription style={{ color: '#92400E' }}>
                <strong>Atenção!</strong> Existem {alertasCalculados.length} alerta(s) pendente(s).
                Clique em "Atualizar Alertas" para registrá-los no sistema.
              </AlertDescription>
            </Alert>
          )}

          {(alertasAtivos.length > 0 ? alertasAtivos : alertasCalculados).map((alerta, index) => {
            const nivel = nivelCores[alerta.nivel_urgencia];

            return (
              <Card key={alerta.id || index} className="border-0 shadow-lg">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="text-3xl">{nivel.icon}</div>
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <span style={{ color: '#07593f' }}>{alerta.produto_nome}</span>
                          <Badge style={{ backgroundColor: nivel.bg, color: nivel.text }}>
                            {alerta.nivel_urgencia}
                          </Badge>
                        </CardTitle>
                        <p className="text-sm mt-1" style={{ color: '#8B8B8B' }}>
                          Estoque atual: {alerta.quantidade_atual} unidades •
                          Média: {alerta.media_vendas_dia} un/dia
                        </p>
                      </div>
                    </div>
                    {alerta.id && (isAdmin || isManager || isWarehouse) && (
                      <Button size="sm" variant="outline" onClick={() => marcarResolvido(alerta)}>
                        Marcar como Resolvido
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-6">
                    <div>
                      <p className="text-sm font-medium mb-1" style={{ color: '#8B8B8B' }}>
                        Dias para Ruptura
                      </p>
                      <p className="text-2xl font-bold" style={{ color: nivel.text }}>
                        {alerta.dias_para_acabar} dias
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-1" style={{ color: '#8B8B8B' }}>
                        Data Prevista
                      </p>
                      <p className="text-lg font-semibold" style={{ color: '#07593f' }}>
                        {new Date(alerta.data_prevista_ruptura).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-1" style={{ color: '#8B8B8B' }}>
                        Quantidade Sugerida
                      </p>
                      <p className="text-lg font-semibold" style={{ color: '#07593f' }}>
                        {alerta.quantidade_sugerida} unidades
                      </p>
                      <p className="text-xs" style={{ color: '#8B8B8B' }}>
                        (para 60 dias)
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}