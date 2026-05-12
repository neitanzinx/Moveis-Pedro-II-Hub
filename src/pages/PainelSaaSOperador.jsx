import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Building2, Activity, Users, RefreshCw } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SEVERITY_VARIANT = {
  low: "secondary",
  medium: "outline",
  high: "destructive",
  critical: "destructive",
};

function formatDate(date) {
  if (!date) return "-";
  return new Date(date).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("pt-BR");
}

export default function PainelSaaSOperador() {
  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const [dateFrom, setDateFrom] = useState(sevenDaysAgo);
  const [dateTo, setDateTo] = useState(today);

  const usageQuery = useQuery({
    queryKey: ["saas-operator-usage", dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saas_tenant_daily_usage")
        .select("organization_id, metric_date, active_users, total_sessions, total_events, total_errors")
        .gte("metric_date", dateFrom)
        .lte("metric_date", dateTo)
        .order("metric_date", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const faultQuery = useQuery({
    queryKey: ["saas-operator-faults", dateFrom, dateTo],
    queryFn: async () => {
      const fromTs = `${dateFrom}T00:00:00Z`;
      const toTs = `${dateTo}T23:59:59Z`;

      const { data, error } = await supabase
        .from("saas_fault_events")
        .select("id, organization_id, severity, status, source, service_name, error_message, occurred_at")
        .gte("occurred_at", fromTs)
        .lte("occurred_at", toTs)
        .order("occurred_at", { ascending: false })
        .limit(150);

      if (error) throw error;
      return data || [];
    },
  });

  const isLoading = usageQuery.isLoading || faultQuery.isLoading;
  const hasError = usageQuery.error || faultQuery.error;

  const usageByTenant = useMemo(() => {
    const grouped = new Map();

    (usageQuery.data || []).forEach((row) => {
      const key = row.organization_id || "sem-org";
      const current = grouped.get(key) || {
        organization_id: key,
        active_users: 0,
        total_sessions: 0,
        total_events: 0,
        total_errors: 0,
      };

      current.active_users += Number(row.active_users || 0);
      current.total_sessions += Number(row.total_sessions || 0);
      current.total_events += Number(row.total_events || 0);
      current.total_errors += Number(row.total_errors || 0);

      grouped.set(key, current);
    });

    return Array.from(grouped.values()).sort((a, b) => b.total_events - a.total_events);
  }, [usageQuery.data]);

  const kpis = useMemo(() => {
    const totalActiveUsers = usageByTenant.reduce((acc, row) => acc + row.active_users, 0);
    const totalEvents = usageByTenant.reduce((acc, row) => acc + row.total_events, 0);
    const criticalOpenFaults = (faultQuery.data || []).filter(
      (fault) => fault.severity === "critical" && fault.status !== "resolved"
    ).length;

    return {
      monitoredTenants: usageByTenant.length,
      totalActiveUsers,
      totalEvents,
      criticalOpenFaults,
    };
  }, [usageByTenant, faultQuery.data]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Painel SaaS Operador</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitoramento central de empresas, uso e falhas operacionais.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date" lang="pt-BR"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 w-36"
          />
          <Input
            type="date" lang="pt-BR"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 w-36"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              usageQuery.refetch();
              faultQuery.refetch();
            }}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {hasError && (
        <div className="rounded-md border border-red-200 bg-red-50 text-red-700 p-3 text-sm">
          Falha ao carregar dados do painel operador. Verifique as migrações e permissões RLS.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Empresas monitoradas</p>
                <p className="text-2xl font-semibold mt-1">{formatNumber(kpis.monitoredTenants)}</p>
              </div>
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Usuários ativos (período)</p>
                <p className="text-2xl font-semibold mt-1">{formatNumber(kpis.totalActiveUsers)}</p>
              </div>
              <Users className="w-5 h-5 text-emerald-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Eventos de uso</p>
                <p className="text-2xl font-semibold mt-1">{formatNumber(kpis.totalEvents)}</p>
              </div>
              <Activity className="w-5 h-5 text-amber-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Falhas críticas abertas</p>
                <p className="text-2xl font-semibold mt-1">{formatNumber(kpis.criticalOpenFaults)}</p>
              </div>
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Uso por empresa no período</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead className="text-right">Usuários</TableHead>
                  <TableHead className="text-right">Sessões</TableHead>
                  <TableHead className="text-right">Eventos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usageByTenant.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Sem dados de uso para o período selecionado.
                    </TableCell>
                  </TableRow>
                )}

                {usageByTenant.slice(0, 20).map((row) => (
                  <TableRow key={row.organization_id}>
                    <TableCell className="font-medium">{row.organization_id}</TableCell>
                    <TableCell className="text-right">{formatNumber(row.active_users)}</TableCell>
                    <TableCell className="text-right">{formatNumber(row.total_sessions)}</TableCell>
                    <TableCell className="text-right">{formatNumber(row.total_events)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Falhas recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[420px] overflow-auto pr-1">
              {(faultQuery.data || []).length === 0 && (
                <div className="text-sm text-muted-foreground">Sem falhas no período selecionado.</div>
              )}

              {(faultQuery.data || []).map((fault) => (
                <div key={fault.id} className="border rounded-md p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">{fault.error_message}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant={SEVERITY_VARIANT[fault.severity] || "outline"}>
                        {fault.severity || "low"}
                      </Badge>
                      <Badge variant={fault.status === "resolved" ? "secondary" : "outline"}>
                        {fault.status || "open"}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-muted-foreground grid grid-cols-1 md:grid-cols-2 gap-1">
                    <span>Empresa: {fault.organization_id || "sem-org"}</span>
                    <span>Origem: {fault.source || "-"}</span>
                    <span>Serviço: {fault.service_name || "-"}</span>
                    <span>Ocorrência: {formatDate(fault.occurred_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
