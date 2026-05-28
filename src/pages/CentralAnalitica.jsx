import { lazy, Suspense, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/contexts/TenantContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, BarChart3, DollarSign, FileSpreadsheet, PieChart, TrendingDown } from "lucide-react";

const DashboardBI = lazy(() => import("./DashboardBI.jsx"));
const ExportacaoContabil = lazy(() => import("./ExportacaoContabil.jsx"));
const RelatoriosAvancados = lazy(() => import("./RelatoriosAvancados.jsx"));
const RelatorioComissoes = lazy(() => import("./RelatorioComissoes.jsx"));
const RelatorioDescontos = lazy(() => import("./RelatorioDescontos.jsx"));

const TAB_CONFIG = [
  {
    id: "bi",
    title: "BI Estratégico",
    description: "KPIs, tendências e leitura executiva do negócio.",
    permission: "view_relatorios",
    module: "bi_dashboard",
    icon: PieChart,
    component: DashboardBI,
  },
  {
    id: "relatorios",
    title: "Relatórios",
    description: "Análises operacionais, comerciais e consolidados avançados.",
    permission: "view_relatorios",
    icon: BarChart3,
    component: RelatoriosAvancados,
  },
  {
    id: "comissoes",
    title: "Comissões",
    description: "Fechamento, acompanhamento e conferência de comissão.",
    permission: "view_relatorios",
    icon: DollarSign,
    component: RelatorioComissoes,
  },
  {
    id: "descontos",
    title: "Descontos",
    description: "Relatório de descontos concedidos por vendedor, período e origem.",
    permission: "view_relatorios",
    icon: TrendingDown,
    component: RelatorioDescontos,
  },
  {
    id: "exportacao",
    title: "Exportação Contábil",
    description: "Arquivos para contador, ERPs financeiros e integrações fiscais.",
    permission: "view_financeiro",
    icon: FileSpreadsheet,
    component: ExportacaoContabil,
  },
];

function LoadingSection() {
  return (
    <div className="flex items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white p-10 text-sm text-gray-500">
      Carregando módulo...
    </div>
  );
}

export default function CentralAnalitica() {
  const { can } = useAuth();
  const { isModuleActive } = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();

  const availableTabs = useMemo(
    () => TAB_CONFIG.filter((tab) => can(tab.permission) && (!tab.module || isModuleActive(tab.module))),
    [can, isModuleActive]
  );

  const requestedTab = searchParams.get("aba");
  const activeTab = availableTabs.some((tab) => tab.id === requestedTab)
    ? requestedTab
    : availableTabs[0]?.id;

  useEffect(() => {
    if (activeTab && requestedTab !== activeTab) {
      setSearchParams({ aba: activeTab }, { replace: true });
    }
  }, [activeTab, requestedTab, setSearchParams]);

  if (!availableTabs.length) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-center gap-4 p-6">
            <AlertTriangle className="h-10 w-10 text-amber-600" />
            <div>
              <h1 className="text-lg font-semibold text-amber-900">Nenhuma aba disponível</h1>
              <p className="text-sm text-amber-700">
                Seu perfil não possui acesso às áreas analíticas ou financeiras desta central.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card className="border-0 shadow-sm bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <Badge className="w-fit bg-white/10 text-white hover:bg-white/10">Gestão unificada</Badge>
              <CardTitle className="text-3xl font-semibold">Central Analítica</CardTitle>
              <p className="max-w-3xl text-sm text-slate-200">
                BI, relatórios, comissões e exportação contábil agora ficam reunidos em uma única área com navegação por abas.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {availableTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <div key={tab.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 backdrop-blur-sm">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Icon className="h-4 w-4" />
                      <span>{tab.title}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-300">{tab.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={(value) => setSearchParams({ aba: value }, { replace: true })}>
        <TabsList className="h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-0">
          {availableTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="h-auto min-w-[180px] justify-start rounded-xl border border-gray-200 bg-white px-4 py-3 text-left data-[state=active]:border-green-600 data-[state=active]:bg-green-50 data-[state=active]:text-green-700"
              >
                <div className="flex items-start gap-3">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <div className="font-medium">{tab.title}</div>
                    <div className="text-xs text-gray-500">{tab.description}</div>
                  </div>
                </div>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {availableTabs.map((tab) => {
          const Component = tab.component;

          return (
            <TabsContent key={tab.id} value={tab.id} className="mt-6 focus-visible:outline-none">
              <Suspense fallback={<LoadingSection />}>
                <Component />
              </Suspense>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}