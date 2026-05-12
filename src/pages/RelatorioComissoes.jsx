
import React, { useState, useEffect } from "react";
import { base44, supabase } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, TrendingUp, Users, FileDown, AlertCircle, Calendar, Banknote, RefreshCcw, Lock, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useTenant } from "@/contexts/TenantContext";

export default function RelatorioComissoes() {
  const { organization, settings } = useTenant();
  const [user, setUser] = useState(null);
  const [vendedorFiltro, setVendedorFiltro] = useState("todos");
  const [mesInicio, setMesInicio] = useState(new Date().toISOString().slice(0, 7));
  const [mesFim, setMesFim] = useState(new Date().toISOString().slice(0, 7));

  // States for payment modal
  const [modalPagamento, setModalPagamento] = useState(false);
  const [pagamentoSelecionado, setPagamentoSelecionado] = useState(null);
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().slice(0, 10));
  const [processandoPagamento, setProcessandoPagamento] = useState(false);
  const [observacaoPagamento, setObservacaoPagamento] = useState("");
  const [processandoFechamento, setProcessandoFechamento] = useState(false);
  const queryClient = useQueryClient();

  const tenantId = organization?.id || "00000000-0000-0000-0000-000000000001";

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  const { data: vendas = [], isLoading } = useQuery({
    queryKey: ['vendas'],
    queryFn: () => base44.entities.Venda.list('-data_venda'),
  });

  const { data: vendedores = [] } = useQuery({
    queryKey: ['vendedores'],
    queryFn: () => base44.entities.Vendedor.list(),
  });

  const { data: assistencias = [] } = useQuery({
    queryKey: ['assistencias-comissoes'],
    queryFn: () => base44.entities.AssistenciaTecnica.list(),
  });

  const { data: fechamentos = [] } = useQuery({
    queryKey: ['comissoes-fechamento', mesInicio, mesFim, tenantId],
    queryFn: () => base44.entities.ComissaoFechamentoMensal.list('-created_at'),
  });

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#07593f' }} />
      </div>
    );
  }

  // Sistema simplificado - usa APENAS cargo
  const isAdmin = user.cargo === 'Administrador';

  if (!isAdmin) {
    return (
      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <Card className="border-2 border-red-200 bg-red-50">
            <CardContent className="p-8 text-center">
              <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-600" />
              <h2 className="text-2xl font-bold mb-2 text-red-800">
                Acesso Restrito
              </h2>
              <p className="text-red-600">
                Apenas administradores podem acessar o relatório de comissões.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Filtrar vendas por período e vendedor
  const getVendedorRef = (venda) => venda.vendedor_id || venda.responsavel_id || venda.responsavel_nome || "sem-vendedor";

  const vendasFiltradas = vendas.filter(v => {
    const dataVenda = v.data_venda?.slice(0, 7); // YYYY-MM
    const dentroPeríodo = dataVenda >= mesInicio && dataVenda <= mesFim;
    const vendedorMatch = vendedorFiltro === "todos" || getVendedorRef(v) === vendedorFiltro;
    return dentroPeríodo && vendedorMatch && v.comissao_calculada > 0;
  });

  // Calcular breakdown por forma de pagamento para todas as vendas filtradas
  const calcularBreakdownPorFormaPagamento = (vendasArr) => {
    const breakdown = {};

    vendasArr.forEach(venda => {
      if (venda.pagamentos && Array.isArray(venda.pagamentos)) {
        venda.pagamentos.forEach(pag => {
          const forma = pag.forma_pagamento;
          if (!breakdown[forma]) {
            breakdown[forma] = { valor: 0, quantidade: 0 };
          }
          breakdown[forma].valor += pag.valor || 0;
          breakdown[forma].quantidade += 1;
        });
      }
    });

    return breakdown;
  };



  // Agrupar por vendedor (com fallback para responsavel_id em vendas antigas)
  const gruposPorVendedor = vendasFiltradas.reduce((acc, venda) => {
    const ref = getVendedorRef(venda);
    if (!acc[ref]) {
      const vendedorCadastrado = vendedores.find((ven) => ven.id === ref);
      acc[ref] = {
        vendedor: vendedorCadastrado || {
          id: ref,
          nome: venda.responsavel_nome || "Sem vendedor",
          loja: venda.loja || "-",
          meta_mensal: 0,
        },
        vendas: [],
      };
    }

    acc[ref].vendas.push(venda);
    return acc;
  }, {});

  const comissoesPorVendedor = Object.values(gruposPorVendedor).map((grupo) => {
    const vendasVendedor = grupo.vendas;

    // Calcular comissão subtraindo devoluções
    const totalComissao = vendasVendedor.reduce((sum, v) => {
      // Verificar se há assistência de devolução/troca concluída para este pedido
      const assistencia = assistencias.find(a =>
        a.numero_pedido === v.numero_pedido &&
        a.status === 'Concluída' &&
        (a.tipo === 'Devolução' || a.tipo === 'Troca')
      );

      // Se houve devolução total (valor_devolvido >= valor_total), comissão é 0
      // Se houve devolução parcial, subtraímos proporcionalmente? 
      // Por simplicidade, se houve devolução/troca de item, o custo da assistência ou perda de venda impacta aqui.
      // Regra sugerida: Se valor_devolvido existe, subtraímos a comissão sobre esse valor.
      const valorBaseComissao = Math.max(0, (v.valor_total || 0) - (assistencia?.valor_devolvido || 0));
      const porcentagem = v.comissao_calculada / (v.valor_total || 1);
      const comissaoAjustada = valorBaseComissao * porcentagem;

      return sum + comissaoAjustada;
    }, 0);

    const totalVendas = vendasVendedor.reduce((sum, v) => {
      const assistencia = assistencias.find(a => a.numero_pedido === v.numero_pedido && a.status === 'Concluída');
      return sum + ((v.valor_total || 0) - (assistencia?.valor_devolvido || 0));
    }, 0);

    const quantidadeVendas = vendasVendedor.length;
    const breakdownPagamentos = calcularBreakdownPorFormaPagamento(vendasVendedor);

    return {
      vendedor: grupo.vendedor,
      totalComissao,
      totalVendas,
      quantidadeVendas,
      breakdownPagamentos,
      vendas: vendasVendedor
    };
  }).filter(item => item.quantidadeVendas > 0);

  const totalGeralComissoes = comissoesPorVendedor.reduce((sum, item) => sum + item.totalComissao, 0);
  const totalGeralVendas = comissoesPorVendedor.reduce((sum, item) => sum + item.totalVendas, 0);

  const getPeriodoInicioDate = () => new Date(`${mesInicio}-01T00:00:00`);

  const getPeriodoFimDate = () => {
    const [ano, mes] = mesFim.split('-').map(Number);
    return new Date(ano, mes, 0, 23, 59, 59, 999);
  };

  const periodoInicioDate = getPeriodoInicioDate();
  const periodoFimDate = getPeriodoFimDate();
  const periodoInicioIso = periodoInicioDate.toISOString().slice(0, 10);
  const periodoFimIso = periodoFimDate.toISOString().slice(0, 10);

  const fechamentosPeriodo = (fechamentos || []).filter((f) => {
    const inicio = (f.periodo_inicio || '').slice(0, 10);
    const fim = (f.periodo_fim || '').slice(0, 10);
    const vendedorMatch = vendedorFiltro === 'todos' || f.vendedor_id === vendedorFiltro;
    return (
      f.organization_id === tenantId &&
      inicio === periodoInicioIso &&
      fim === periodoFimIso &&
      vendedorMatch
    );
  });

  const mapFechamentoPorVendedor = new Map(
    fechamentosPeriodo.map((f) => [f.vendedor_id || `sem-vendedor-${f.id}`, f])
  );

  const comissoesConsolidadas = comissoesPorVendedor.map((item) => {
    const fechamento = mapFechamentoPorVendedor.get(item.vendedor.id);
    if (!fechamento) {
      return {
        ...item,
        fechamento_id: null,
        status_fechamento: 'Nao Fechado',
        totalFinal: item.totalComissao,
      };
    }

    return {
      ...item,
      fechamento_id: fechamento.id,
      status_fechamento: fechamento.status || 'Pendente',
      totalFinal: Number(fechamento.total_final || fechamento.total_comissao || item.totalComissao),
      fechamento,
    };
  });

  const totalPendente = comissoesConsolidadas
    .filter((item) => item.status_fechamento !== 'Pago')
    .reduce((sum, item) => sum + Number(item.totalFinal || 0), 0);

  const aplicarPoliticaFechamento = (existente, politica) => {
    if (!existente) {
      return 'criar';
    }

    if (politica === 'recalcular_tudo') {
      return 'recriar';
    }

    if (politica === 'recalcular_periodo_aberto') {
      return existente.status === 'Pago' ? 'manter' : 'recriar';
    }

    return 'manter';
  };

  const gerarFechamentoPeriodo = async () => {
    setProcessandoFechamento(true);
    const politica = settings?.comissao_recalculo_politica || 'nao_recalcular';

    try {
      const existentesPorVendedor = new Map(
        fechamentosPeriodo.map((item) => [item.vendedor_id || `sem-vendedor-${item.id}`, item])
      );

      let criados = 0;
      let atualizados = 0;
      let mantidos = 0;

      for (const item of comissoesPorVendedor) {
        const existente = existentesPorVendedor.get(item.vendedor.id);
        const acao = aplicarPoliticaFechamento(existente, politica);

        if (acao === 'manter') {
          mantidos += 1;
          continue;
        }

        if (acao === 'recriar' && existente) {
          await base44.entities.ComissaoFechamentoMensal.update(existente.id, {
            quantidade_vendas: item.quantidadeVendas,
            valor_total_vendas: Number(item.totalVendas.toFixed(2)),
            total_comissao: Number(item.totalComissao.toFixed(2)),
            total_final: Number(item.totalComissao.toFixed(2)),
            total_ajustes: Number(existente.total_ajustes || 0),
            breakdown_pagamentos: item.breakdownPagamentos,
            status: existente.status || 'Pendente',
            observacoes: existente.observacoes || `Fechamento atualizado automaticamente (${politica})`,
            updated_at: new Date().toISOString(),
          });
          atualizados += 1;
          continue;
        }

        await base44.entities.ComissaoFechamentoMensal.create({
          organization_id: tenantId,
          periodo_inicio: periodoInicioIso,
          periodo_fim: periodoFimIso,
          vendedor_id: item.vendedor.id,
          loja: item.vendedor.loja || null,
          quantidade_vendas: item.quantidadeVendas,
          valor_total_vendas: Number(item.totalVendas.toFixed(2)),
          total_comissao: Number(item.totalComissao.toFixed(2)),
          total_ajustes: 0,
          total_final: Number(item.totalComissao.toFixed(2)),
          status: 'Pendente',
          breakdown_pagamentos: item.breakdownPagamentos,
          observacoes: `Fechamento gerado automaticamente em ${new Date().toLocaleDateString('pt-BR')}`,
        });
        criados += 1;
      }

      queryClient.invalidateQueries(['comissoes-fechamento']);
      toast.success(`Fechamento concluído: ${criados} criado(s), ${atualizados} atualizado(s), ${mantidos} mantido(s).`);
    } catch (error) {
      toast.error(`Erro ao gerar fechamento: ${error.message}`);
    } finally {
      setProcessandoFechamento(false);
    }
  };

  const exportarCSV = () => {
    let csv = "Vendedor,Loja,Quantidade de Vendas,Total em Vendas,Total Comissões\n";

    comissoesPorVendedor.forEach(item => {
      csv += `${item.vendedor.nome},${item.vendedor.loja},${item.quantidadeVendas},R$ ${item.totalVendas.toFixed(2)},R$ ${item.totalComissao.toFixed(2)}\n`;
    });

    csv += `\nTOTAL GERAL,,${comissoesPorVendedor.reduce((sum, i) => sum + i.quantidadeVendas, 0)},R$ ${totalGeralVendas.toFixed(2)},R$ ${totalGeralComissoes.toFixed(2)}`;

    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comissoes_${mesInicio}_${mesFim}.csv`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const abrirModalPagamento = (item) => {
    if (!item.fechamento_id) {
      toast.error('Feche o período antes de registrar pagamento.');
      return;
    }

    if (item.status_fechamento === 'Pago') {
      toast.info('Esta comissão já está marcada como paga.');
      return;
    }

    setPagamentoSelecionado(item);
    setDataPagamento(new Date().toISOString().slice(0, 10));
    setObservacaoPagamento("");
    setModalPagamento(true);
  };

  const confirmarPagamentoComissao = async () => {
    if (!pagamentoSelecionado) return;

    setProcessandoPagamento(true);
    try {
      await base44.entities.LancamentoFinanceiro.create({
        descricao: `Comissão - ${pagamentoSelecionado.vendedor.nome} - Ref: ${mesInicio === mesFim ? mesInicio : `${mesInicio} a ${mesFim}`}`,
        valor: -Number(pagamentoSelecionado.totalFinal.toFixed(2)),
        tipo: 'despesa',
        categoria_nome: 'Comissões',
        data_lancamento: dataPagamento,
        forma_pagamento: 'Transferência',
        status: 'Pago',
        observacao: `Pgto ref. ${pagamentoSelecionado.quantidadeVendas} vendas. ${observacaoPagamento}`,
      });

      if (pagamentoSelecionado.fechamento_id) {
        await base44.entities.ComissaoFechamentoMensal.update(pagamentoSelecionado.fechamento_id, {
          status: 'Pago',
          data_pagamento: `${dataPagamento}T12:00:00.000Z`,
          observacoes: observacaoPagamento || pagamentoSelecionado.fechamento?.observacoes || null,
          updated_at: new Date().toISOString(),
        });

        const dataInicioHistorico = `${periodoInicioIso}T00:00:00.000Z`;
        const dataFimHistorico = `${periodoFimIso}T23:59:59.999Z`;
        await supabase
          .from('comissoes_historico')
          .update({
            status: 'Pago',
            data_pagamento: `${dataPagamento}T12:00:00.000Z`,
          })
          .eq('organization_id', tenantId)
          .eq('vendedor_id', pagamentoSelecionado.vendedor.id)
          .gte('data_calculo', dataInicioHistorico)
          .lte('data_calculo', dataFimHistorico)
          .neq('status', 'Pago');
      }

      toast.success(`Pagamento registrado para ${pagamentoSelecionado.vendedor.nome}!`);
      setModalPagamento(false);
      setPagamentoSelecionado(null);
      queryClient.invalidateQueries(['comissoes-fechamento']);
      queryClient.invalidateQueries(['lancamentos']);

    } catch (error) {
      toast.error("Erro ao registrar pagamento: " + error.message);
    } finally {
      setProcessandoPagamento(false);
    }
  };

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2" style={{ color: '#07593f' }}>
              Relatório de Comissões
            </h1>
            <p style={{ color: '#8B8B8B' }}>
              Análise detalhada por vendedor e período
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={gerarFechamentoPeriodo}
              variant="outline"
              disabled={processandoFechamento || comissoesPorVendedor.length === 0}
            >
              <RefreshCcw className="w-4 h-4 mr-2" />
              {processandoFechamento ? 'Processando...' : 'Gerar Fechamento'}
            </Button>
            <Button
              onClick={exportarCSV}
              className="shadow-lg"
              style={{ background: 'linear-gradient(135deg, #f38a4c 0%, #f5a164 100%)' }}
            >
              <FileDown className="w-4 h-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </div>

        <Card className="border-0 shadow-lg mb-6">
          <CardContent className="p-4 md:p-5">
            <div className="grid md:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg border" style={{ borderColor: '#E5E0D8' }}>
                <p className="text-xs text-gray-500">Período de fechamento</p>
                <p className="font-semibold" style={{ color: '#07593f' }}>{periodoInicioIso} a {periodoFimIso}</p>
              </div>
              <div className="p-3 rounded-lg border" style={{ borderColor: '#E5E0D8' }}>
                <p className="text-xs text-gray-500">Fechamentos encontrados</p>
                <p className="font-semibold" style={{ color: '#07593f' }}>{fechamentosPeriodo.length}</p>
              </div>
              <div className="p-3 rounded-lg border" style={{ borderColor: '#E5E0D8' }}>
                <p className="text-xs text-gray-500">Pendente para pagamento</p>
                <p className="font-semibold text-amber-600">
                  R$ {totalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-3 rounded-lg border" style={{ borderColor: '#E5E0D8' }}>
                <p className="text-xs text-gray-500">Política de recálculo</p>
                <p className="font-semibold" style={{ color: '#07593f' }}>
                  {settings?.comissao_recalculo_politica || 'nao_recalcular'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg mb-6">
          <CardContent className="p-6">
            <div className="grid md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="mesInicio">Período Inicial</Label>
                <Input
                  id="mesInicio"
                  type="month"
                  value={mesInicio}
                  onChange={(e) => setMesInicio(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="mesFim">Período Final</Label>
                <Input
                  id="mesFim"
                  type="month"
                  value={mesFim}
                  onChange={(e) => setMesFim(e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="vendedor">Vendedor</Label>
                <Select value={vendedorFiltro} onValueChange={setVendedorFiltro}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Vendedores</SelectItem>
                    {vendedores.map(v => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.nome} - {v.loja}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium" style={{ color: '#8B8B8B' }}>
                Total em Comissões
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <DollarSign className="w-8 h-8" style={{ color: '#f38a4c' }} />
                <p className="text-2xl font-bold" style={{ color: '#f38a4c' }}>
                  R$ {totalGeralComissoes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium" style={{ color: '#8B8B8B' }}>
                Total em Vendas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-8 h-8" style={{ color: '#07593f' }} />
                <p className="text-2xl font-bold" style={{ color: '#07593f' }}>
                  R$ {totalGeralVendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium" style={{ color: '#8B8B8B' }}>
                Vendedores Ativos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="w-8 h-8" style={{ color: '#3b82f6' }} />
                <p className="text-2xl font-bold" style={{ color: '#3b82f6' }}>
                  {comissoesPorVendedor.length}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: '#07593f' }} />
          </div>
        ) : comissoesConsolidadas.length === 0 ? (
          <Card className="border-0 shadow-lg">
            <CardContent className="p-12 text-center">
              <Calendar className="w-16 h-16 mx-auto mb-4 opacity-20" style={{ color: '#07593f' }} />
              <p className="text-xl" style={{ color: '#8B8B8B' }}>
                Nenhuma comissão encontrada no período selecionado
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {comissoesConsolidadas.map((item) => (
              <Card key={item.vendedor.id} className="border-0 shadow-lg">
                <CardHeader style={{ backgroundColor: '#f0f9ff' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-xl"
                        style={{ backgroundColor: '#07593f', color: 'white' }}
                      >
                        {item.vendedor.nome.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <CardTitle style={{ color: '#07593f' }}>
                          {item.vendedor.nome}
                        </CardTitle>
                        <p className="text-sm" style={{ color: '#8B8B8B' }}>
                          Loja {item.vendedor.loja}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-2 mb-1">
                        <Badge
                          className={item.status_fechamento === 'Pago' ? 'bg-green-100 text-green-700' : item.status_fechamento === 'Pendente' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'}
                        >
                          {item.status_fechamento === 'Pago' ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <Lock className="w-3 h-3 mr-1" />}
                          {item.status_fechamento}
                        </Badge>
                      </div>
                      <p className="text-sm mb-1" style={{ color: '#8B8B8B' }}>Total Comissão</p>
                      <p className="text-2xl font-bold" style={{ color: '#f38a4c' }}>
                        R$ {item.totalFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2 h-8 text-green-700 border-green-200 hover:bg-green-50"
                        disabled={!item.fechamento_id || item.status_fechamento === 'Pago'}
                        onClick={() => abrirModalPagamento(item)}
                      >
                        <Banknote className="w-4 h-4 mr-1" />
                        {!item.fechamento_id ? 'Fechar Período Primeiro' : item.status_fechamento === 'Pago' ? 'Já Pago' : 'Registrar Pagamento'}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid md:grid-cols-3 gap-4 mb-4">
                    <div className="text-center p-3 rounded-lg" style={{ backgroundColor: '#FAF8F5' }}>
                      <p className="text-sm mb-1" style={{ color: '#8B8B8B' }}>Quantidade de Vendas</p>
                      <p className="text-xl font-bold" style={{ color: '#07593f' }}>
                        {item.quantidadeVendas}
                      </p>
                    </div>
                    <div className="text-center p-3 rounded-lg" style={{ backgroundColor: '#FAF8F5' }}>
                      <p className="text-sm mb-1" style={{ color: '#8B8B8B' }}>Total em Vendas</p>
                      <p className="text-xl font-bold" style={{ color: '#07593f' }}>
                        R$ {item.totalVendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="text-center p-3 rounded-lg" style={{ backgroundColor: '#FAF8F5' }}>
                      <p className="text-sm mb-1" style={{ color: '#8B8B8B' }}>Ticket Médio</p>
                      <p className="text-xl font-bold" style={{ color: '#07593f' }}>
                        R$ {(item.totalVendas / item.quantidadeVendas).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  {/* Breakdown por Forma de Pagamento */}
                  {Object.keys(item.breakdownPagamentos).length > 0 && (
                    <div className="mt-4 p-4 rounded-lg border" style={{ borderColor: '#E5E0D8' }}>
                      <p className="text-sm font-semibold mb-3" style={{ color: '#07593f' }}>
                        Recebimentos por Forma de Pagamento
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {Object.entries(item.breakdownPagamentos).map(([forma, dados]) => (
                          <div key={forma} className="flex items-center justify-between p-2 rounded bg-gray-50">
                            <span className="text-sm text-gray-600">{forma}</span>
                            <span className="text-sm font-semibold" style={{ color: '#07593f' }}>
                              R$ {dados.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {item.vendedor.meta_mensal > 0 && (
                    <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: '#f0f9ff' }}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium" style={{ color: '#07593f' }}>
                          Meta Mensal: R$ {item.vendedor.meta_mensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <Badge
                          style={{
                            backgroundColor: item.totalVendas >= item.vendedor.meta_mensal ? '#D1FAE5' : '#FEF3C7',
                            color: item.totalVendas >= item.vendedor.meta_mensal ? '#065F46' : '#92400E'
                          }}
                        >
                          {((item.totalVendas / item.vendedor.meta_mensal) * 100).toFixed(0)}% atingido
                        </Badge>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{
                            width: `${Math.min((item.totalVendas / item.vendedor.meta_mensal) * 100, 100)}%`,
                            backgroundColor: item.totalVendas >= item.vendedor.meta_mensal ? '#07593f' : '#f38a4c'
                          }}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}


        {/* Modal de Pagamento */}
        <Dialog open={modalPagamento} onOpenChange={setModalPagamento}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-green-600" />
                Registrar Pagamento de Comissão
              </DialogTitle>
              <DialogDescription>
                Confirmar pagamento para <strong>{pagamentoSelecionado?.vendedor.nome}</strong>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="p-4 bg-green-50 rounded-lg border border-green-100 text-center">
                <p className="text-sm text-gray-500 mb-1">Valor a Pagar</p>
                <p className="text-3xl font-bold text-green-700">
                  R$ {pagamentoSelecionado?.totalComissao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="dataPagamento">Data do Pagamento</Label>
                <Input
                  id="dataPagamento"
                  type="date"
                  value={dataPagamento}
                  onChange={(e) => setDataPagamento(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="obsPagamento">Observações (Opcional)</Label>
                <Input
                  id="obsPagamento"
                  placeholder="Ex: Pix, Transferência, etc."
                  value={observacaoPagamento}
                  onChange={(e) => setObservacaoPagamento(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setModalPagamento(false)}>Cancelar</Button>
              <Button
                onClick={confirmarPagamentoComissao}
                disabled={processandoPagamento}
                className="bg-green-600 hover:bg-green-700"
              >
                {processandoPagamento ? "Processando..." : "Confirmar Pagamento"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div >
  );
}
