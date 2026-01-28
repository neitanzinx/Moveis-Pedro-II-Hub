import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertCircle, Users, Calendar, Briefcase, FileText,
  Award, DollarSign, FolderOpen, Megaphone, Clock, AlertTriangle,
  Plus, RefreshCw, TrendingUp, TrendingDown, UserCheck, CalendarClock,
  FileWarning, ClipboardCheck, ArrowRight, Bell, CheckCircle2
} from "lucide-react";

// Import all HR tab components
import ColaboradoresTab from "@/components/rh/ColaboradoresTab";
import FeriasLicencasTab from "@/components/rh/FeriasLicencasTab";
import RecrutamentoTab from "@/components/rh/RecrutamentoTab";
import FolhaPagamentoTab from "@/components/rh/FolhaPagamentoTab";
import AvaliacoesTab from "@/components/rh/AvaliacoesTab";
import ComunicadosTab from "@/components/rh/ComunicadosTab";
import DocumentosTab from "@/components/rh/DocumentosTab";

// Quick Action Button Component
function QuickAction({ icon: Icon, label, onClick, color = "#07593f" }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white border-2 border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all duration-200 group"
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
        style={{ backgroundColor: `${color}15` }}
      >
        <Icon className="w-6 h-6" style={{ color }} />
      </div>
      <span className="text-sm font-medium text-gray-700 text-center">{label}</span>
    </button>
  );
}

// Alert Card Component
function AlertCard({ icon: Icon, title, count, description, color, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 p-4 rounded-xl bg-white border-l-4 shadow-sm hover:shadow-md transition-all duration-200 text-left"
      style={{ borderLeftColor: color }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${color}15` }}
      >
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900">{title}</span>
          <Badge variant="secondary" className="text-xs" style={{ backgroundColor: `${color}20`, color }}>
            {count}
          </Badge>
        </div>
        <p className="text-sm text-gray-500 truncate">{description}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-gray-400" />
    </button>
  );
}

// Activity Item Component
function ActivityItem({ icon: Icon, title, time, description, color }) {
  return (
    <div className="flex gap-3 py-3 border-b border-gray-100 last:border-0">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ backgroundColor: `${color}15` }}
      >
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-gray-900 text-sm">{title}</span>
          <span className="text-xs text-gray-400 flex-shrink-0">{time}</span>
        </div>
        <p className="text-xs text-gray-500 truncate">{description}</p>
      </div>
    </div>
  );
}

// Metric Card Component
function MetricCard({ icon: Icon, value, label, trend, trendValue, color, onClick, badge }) {
  return (
    <Card
      className="border-0 shadow-lg cursor-pointer hover:shadow-xl transition-all duration-200 group overflow-hidden"
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
            style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)` }}
          >
            <Icon className="w-6 h-6 text-white" />
          </div>
          {badge > 0 && (
            <Badge className="bg-red-500 text-white text-xs animate-pulse">
              {badge} pendente{badge > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <p className="text-3xl font-bold text-gray-900 mb-1">{value}</p>
        <p className="text-sm text-gray-500 mb-2">{label}</p>
        {trend && (
          <div className={`flex items-center gap-1 text-xs ${trend === 'up' ? 'text-green-600' : 'text-red-500'}`}>
            {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span>{trendValue}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function RecursosHumanos() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState("colaboradores");

  // Fetch all HR data
  const { data: colaboradores = [], refetch: refetchColaboradores } = useQuery({
    queryKey: ['colaboradores'],
    queryFn: () => base44.entities.Colaborador.list(),
  });

  const { data: ferias = [], refetch: refetchFerias } = useQuery({
    queryKey: ['ferias'],
    queryFn: () => base44.entities.Ferias.list('-data_inicio'),
  });

  const { data: licencas = [] } = useQuery({
    queryKey: ['licencas'],
    queryFn: () => base44.entities.Licenca.list('-data_inicio'),
  });

  const { data: vagas = [] } = useQuery({
    queryKey: ['vagas'],
    queryFn: () => base44.entities.Vaga.list(),
  });

  const { data: folhas = [] } = useQuery({
    queryKey: ['folhas_pagamento'],
    queryFn: () => base44.entities.FolhaPagamento.list(),
  });

  const { data: avaliacoes = [] } = useQuery({
    queryKey: ['avaliacoes_desempenho'],
    queryFn: () => base44.entities.AvaliacaoDesempenho.list(),
  });

  // Calculate metrics and alerts
  const metrics = useMemo(() => {
    const hoje = new Date();
    const proximos30Dias = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000);
    const currentMonth = hoje.getMonth() + 1;
    const currentYear = hoje.getFullYear();

    // Colaboradores
    const colaboradoresAtivos = colaboradores.filter(c => c.status === 'Ativo').length;
    const colaboradoresFerias = colaboradores.filter(c => c.status === 'Férias').length;
    const colaboradoresAfastados = colaboradores.filter(c => c.status === 'Afastado' || c.status === 'Licença').length;

    // Férias pendentes de aprovação
    const feriasPendentes = ferias.filter(f => f.status === 'Solicitada').length;
    const licencasPendentes = licencas.filter(l => l.status === 'Solicitada').length;

    // Férias próximas (próximos 30 dias)
    const feriasProximas = ferias.filter(f => {
      if (f.status !== 'Aprovada' && f.status !== 'Em Gozo') return false;
      const dataInicio = new Date(f.data_inicio);
      return dataInicio >= hoje && dataInicio <= proximos30Dias;
    }).length;

    // Vagas abertas
    const vagasAbertas = vagas.filter(v => v.status === 'Aberta').length;
    const candidatosPendentes = vagas.reduce((sum, v) =>
      sum + (v.candidatos?.filter(c => c.status === 'Em Análise')?.length || 0), 0
    );

    // Folha do mês
    const folhasMesAtual = folhas.filter(f =>
      f.mes_referencia === currentMonth && f.ano_referencia === currentYear
    );
    const totalFolhaMes = folhasMesAtual.reduce((sum, f) => sum + (Number(f.salario_liquido) || 0), 0);
    const folhasPendentes = folhasMesAtual.filter(f => f.status === 'Gerado').length;

    // Avaliações
    const avaliacoesPendentes = avaliacoes.filter(a => a.status === 'Rascunho').length;
    const avaliacoesTotal = avaliacoes.length;

    // Contratos a vencer (próximos 60 dias)
    const contratosVencer = colaboradores.filter(c => {
      if (!c.data_fim_contrato || c.status !== 'Ativo') return false;
      const dataFim = new Date(c.data_fim_contrato);
      const proximos60Dias = new Date(hoje.getTime() + 60 * 24 * 60 * 60 * 1000);
      return dataFim >= hoje && dataFim <= proximos60Dias;
    }).length;

    return {
      colaboradoresAtivos,
      colaboradoresFerias,
      colaboradoresAfastados,
      feriasPendentes,
      licencasPendentes,
      feriasProximas,
      vagasAbertas,
      candidatosPendentes,
      totalFolhaMes,
      folhasPendentes,
      avaliacoesPendentes,
      avaliacoesTotal,
      contratosVencer,
      totalPendencias: feriasPendentes + licencasPendentes + folhasPendentes + avaliacoesPendentes
    };
  }, [colaboradores, ferias, licencas, vagas, folhas, avaliacoes]);

  // Recent activities (mock based on data)
  const recentActivities = useMemo(() => {
    const activities = [];

    // Add recent vacation requests
    ferias.slice(0, 3).forEach(f => {
      const colaborador = colaboradores.find(c => c.id === f.colaborador_id);
      activities.push({
        icon: Calendar,
        title: `Férias ${f.status === 'Aprovada' ? 'aprovadas' : f.status === 'Solicitada' ? 'solicitadas' : f.status.toLowerCase()}`,
        description: colaborador?.nome || 'Colaborador',
        time: f.data_inicio ? new Date(f.data_inicio).toLocaleDateString('pt-BR') : '',
        color: f.status === 'Aprovada' ? '#22c55e' : f.status === 'Solicitada' ? '#f59e0b' : '#64748b'
      });
    });

    // Add recent payroll entries
    folhas.slice(0, 2).forEach(f => {
      const colaborador = colaboradores.find(c => c.id === f.colaborador_id);
      activities.push({
        icon: DollarSign,
        title: `Folha ${f.status === 'Pago' ? 'paga' : 'gerada'}`,
        description: colaborador?.nome || 'Colaborador',
        time: `${f.mes_referencia}/${f.ano_referencia}`,
        color: f.status === 'Pago' ? '#22c55e' : '#3b82f6'
      });
    });

    return activities.slice(0, 5);
  }, [ferias, folhas, colaboradores]);

  const handleRefreshData = () => {
    refetchColaboradores();
    refetchFerias();
  };

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#07593f' }} />
      </div>
    );
  }

  const isAdmin = user.cargo === 'Administrador';
  const isRH = user.cargo === 'RH';
  const isGestor = user.cargo === 'Gerente';

  if (!isAdmin && !isRH && !isGestor) {
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
                Você não tem permissão para acessar o módulo de Recursos Humanos.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gray-50/50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}>
                <Users className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                Recursos Humanos
              </h1>
              {metrics.totalPendencias > 0 && (
                <Badge className="bg-red-500 text-white animate-pulse">
                  {metrics.totalPendencias} pendência{metrics.totalPendencias > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            <p className="text-gray-500 text-sm md:text-base">
              Gestão de pessoas, folha de pagamento e desenvolvimento
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshData}
            className="flex items-center gap-2 self-start md:self-auto"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </Button>
        </div>

        {/* Alerts Section */}
        {(metrics.feriasPendentes > 0 || metrics.licencasPendentes > 0 || metrics.contratosVencer > 0 || metrics.avaliacoesPendentes > 0) && (
          <Card className="border-0 shadow-lg bg-gradient-to-r from-amber-50 to-orange-50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bell className="w-5 h-5 text-amber-600" />
                Ações Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {metrics.feriasPendentes > 0 && (
                  <AlertCard
                    icon={Calendar}
                    title="Férias Aguardando"
                    count={metrics.feriasPendentes}
                    description="Solicitações de férias para aprovar"
                    color="#f59e0b"
                    onClick={() => setActiveTab("ferias")}
                  />
                )}
                {metrics.licencasPendentes > 0 && (
                  <AlertCard
                    icon={FileWarning}
                    title="Licenças Aguardando"
                    count={metrics.licencasPendentes}
                    description="Solicitações de licença para aprovar"
                    color="#ef4444"
                    onClick={() => setActiveTab("ferias")}
                  />
                )}
                {metrics.contratosVencer > 0 && (
                  <AlertCard
                    icon={AlertTriangle}
                    title="Contratos Vencendo"
                    count={metrics.contratosVencer}
                    description="Contratos vencem nos próximos 60 dias"
                    color="#8b5cf6"
                    onClick={() => setActiveTab("colaboradores")}
                  />
                )}
                {metrics.avaliacoesPendentes > 0 && (
                  <AlertCard
                    icon={ClipboardCheck}
                    title="Avaliações Pendentes"
                    count={metrics.avaliacoesPendentes}
                    description="Avaliações em rascunho para finalizar"
                    color="#3b82f6"
                    onClick={() => setActiveTab("avaliacoes")}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Metrics Dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <MetricCard
            icon={UserCheck}
            value={metrics.colaboradoresAtivos}
            label="Colaboradores Ativos"
            color="#07593f"
            onClick={() => setActiveTab("colaboradores")}
          />
          <MetricCard
            icon={Calendar}
            value={metrics.feriasProximas}
            label="Férias Próximas"
            color="#3b82f6"
            badge={metrics.feriasPendentes}
            onClick={() => setActiveTab("ferias")}
          />
          <MetricCard
            icon={Briefcase}
            value={metrics.vagasAbertas}
            label="Vagas Abertas"
            color="#f38a4c"
            badge={metrics.candidatosPendentes}
            onClick={() => setActiveTab("recrutamento")}
          />
          <MetricCard
            icon={DollarSign}
            value={metrics.totalFolhaMes > 0 ? `R$ ${(metrics.totalFolhaMes / 1000).toFixed(0)}k` : 'R$ 0'}
            label="Folha do Mês"
            color="#22c55e"
            badge={metrics.folhasPendentes}
            onClick={() => setActiveTab("folha")}
          />
          <MetricCard
            icon={Award}
            value={metrics.avaliacoesTotal}
            label="Avaliações"
            color="#8b5cf6"
            badge={metrics.avaliacoesPendentes}
            onClick={() => setActiveTab("avaliacoes")}
          />
          <MetricCard
            icon={CalendarClock}
            value={metrics.colaboradoresFerias + metrics.colaboradoresAfastados}
            label="Em Férias/Licença"
            color="#64748b"
            onClick={() => setActiveTab("ferias")}
          />
        </div>

        {/* Quick Actions & Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <Card className="border-0 shadow-lg lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Plus className="w-5 h-5" style={{ color: '#07593f' }} />
                Ações Rápidas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <QuickAction
                  icon={Calendar}
                  label="Registrar Férias"
                  onClick={() => setActiveTab("ferias")}
                  color="#3b82f6"
                />
                <QuickAction
                  icon={DollarSign}
                  label="Gerar Folha"
                  onClick={() => setActiveTab("folha")}
                  color="#22c55e"
                />
                <QuickAction
                  icon={Award}
                  label="Nova Avaliação"
                  onClick={() => setActiveTab("avaliacoes")}
                  color="#8b5cf6"
                />
                <QuickAction
                  icon={Megaphone}
                  label="Novo Comunicado"
                  onClick={() => setActiveTab("comunicados")}
                  color="#f38a4c"
                />
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5" style={{ color: '#07593f' }} />
                Atividade Recente
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ScrollArea className="h-[180px]">
                {recentActivities.length > 0 ? (
                  recentActivities.map((activity, index) => (
                    <ActivityItem key={index} {...activity} />
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 py-6">
                    <CheckCircle2 className="w-8 h-8 mb-2" />
                    <p className="text-sm">Nenhuma atividade recente</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <Card className="border-0 shadow-lg">
            <CardContent className="p-2">
              <TabsList className="flex flex-wrap h-auto p-1 gap-1 bg-gray-100/50 w-full">
                <TabsTrigger value="colaboradores" className="flex-1 min-w-[120px] py-2.5 px-3 text-xs md:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  <Users className="w-4 h-4 mr-1.5" />
                  <span className="hidden sm:inline">Colaboradores</span>
                  <span className="sm:hidden">Colab.</span>
                </TabsTrigger>
                <TabsTrigger value="ferias" className="flex-1 min-w-[100px] py-2.5 px-3 text-xs md:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm relative">
                  <Calendar className="w-4 h-4 mr-1.5" />
                  <span className="hidden sm:inline">Férias</span>
                  <span className="sm:hidden">Fér.</span>
                  {(metrics.feriasPendentes + metrics.licencasPendentes) > 0 && (
                    <Badge className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-xs bg-red-500">{metrics.feriasPendentes + metrics.licencasPendentes}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="recrutamento" className="flex-1 min-w-[120px] py-2.5 px-3 text-xs md:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  <Briefcase className="w-4 h-4 mr-1.5" />
                  <span className="hidden sm:inline">Recrutamento</span>
                  <span className="sm:hidden">Recr.</span>
                </TabsTrigger>
                <TabsTrigger value="folha" className="flex-1 min-w-[100px] py-2.5 px-3 text-xs md:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm relative">
                  <DollarSign className="w-4 h-4 mr-1.5" />
                  <span className="hidden sm:inline">Folha</span>
                  <span className="sm:hidden">$</span>
                  {metrics.folhasPendentes > 0 && (
                    <Badge className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-xs bg-amber-500">{metrics.folhasPendentes}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="avaliacoes" className="flex-1 min-w-[100px] py-2.5 px-3 text-xs md:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm relative">
                  <Award className="w-4 h-4 mr-1.5" />
                  <span className="hidden sm:inline">Avaliações</span>
                  <span className="sm:hidden">Aval.</span>
                  {metrics.avaliacoesPendentes > 0 && (
                    <Badge className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-xs bg-blue-500">{metrics.avaliacoesPendentes}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="comunicados" className="flex-1 min-w-[120px] py-2.5 px-3 text-xs md:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  <Megaphone className="w-4 h-4 mr-1.5" />
                  <span className="hidden sm:inline">Comunicados</span>
                  <span className="sm:hidden">Com.</span>
                </TabsTrigger>
                <TabsTrigger value="documentos" className="flex-1 min-w-[120px] py-2.5 px-3 text-xs md:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  <FolderOpen className="w-4 h-4 mr-1.5" />
                  <span className="hidden sm:inline">Documentos</span>
                  <span className="sm:hidden">Docs</span>
                </TabsTrigger>
              </TabsList>
            </CardContent>
          </Card>

          {/* Tab Contents */}
          <TabsContent value="colaboradores" className="mt-0">
            <ColaboradoresTab />
          </TabsContent>

          <TabsContent value="ferias" className="mt-0">
            <FeriasLicencasTab />
          </TabsContent>

          <TabsContent value="recrutamento" className="mt-0">
            <RecrutamentoTab />
          </TabsContent>

          <TabsContent value="folha" className="mt-0">
            <FolhaPagamentoTab />
          </TabsContent>

          <TabsContent value="avaliacoes" className="mt-0">
            <AvaliacoesTab />
          </TabsContent>

          <TabsContent value="comunicados" className="mt-0">
            <ComunicadosTab />
          </TabsContent>

          <TabsContent value="documentos" className="mt-0">
            <DocumentosTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}