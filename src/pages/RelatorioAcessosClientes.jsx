import { useState, useEffect } from "react";
import { supabase } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Users, Activity, Clock, BarChart2, Search, RefreshCw, ChevronDown, ChevronUp
} from "lucide-react";

// ─── helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_LABEL = {
    auth:        "Autenticação",
    navigation:  "Navegação",
    profile:     "Perfil",
    orders:      "Pedidos",
    loyalty:     "Fidelidade",
    support:     "Suporte",
};

const EVENT_LABEL = {
    login_success:                    "Login",
    logout:                           "Logout",
    dashboard_view:                   "Painel aberto",
    profile_edit_opened:              "Edição de perfil aberta",
    profile_saved:                    "Perfil salvo",
    orders_tab_opened:                "Aba de pedidos aberta",
    loyalty_tab_opened:               "Aba de fidelidade aberta",
    support_auto_atendimento_opened:  "Autoatendimento aberto",
};

function fmt(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleString("pt-BR", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}

function fmtDate(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("pt-BR");
}

// ─── sub-componente: linha da tabela individual ────────────────────────────────

function ClienteRow({ row }) {
    const [open, setOpen] = useState(false);
    const categorias = row.eventos_por_categoria || {};
    const categoriaKeys = Object.keys(categorias);

    return (
        <>
            <tr
                className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => setOpen(v => !v)}
            >
                <td className="py-3 px-4 font-medium text-sm">
                    {row.nome_completo || row.email || row.auth_user_id?.slice(0, 8) + "…"}
                </td>
                <td className="py-3 px-4 text-sm text-center">{row.total_sessoes}</td>
                <td className="py-3 px-4 text-sm text-center">{row.total_eventos}</td>
                <td className="py-3 px-4 text-sm">{fmt(row.ultimo_acesso)}</td>
                <td className="py-3 px-4 text-sm">{fmt(row.primeiro_acesso)}</td>
                <td className="py-3 px-4 text-sm text-center">
                    <div className="flex flex-wrap gap-1 justify-center">
                        {categoriaKeys.slice(0, 3).map(cat => (
                            <Badge key={cat} variant="outline" className="text-xs capitalize">
                                {CATEGORY_LABEL[cat] || cat}
                            </Badge>
                        ))}
                        {categoriaKeys.length > 3 && (
                            <Badge variant="secondary" className="text-xs">+{categoriaKeys.length - 3}</Badge>
                        )}
                    </div>
                </td>
                <td className="py-3 px-4 text-center">
                    {open ? <ChevronUp className="w-4 h-4 mx-auto text-muted-foreground" />
                           : <ChevronDown className="w-4 h-4 mx-auto text-muted-foreground" />}
                </td>
            </tr>
            {open && (
                <tr className="bg-muted/20">
                    <td colSpan={7} className="px-6 py-3">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-xs">
                            {categoriaKeys.map(cat => (
                                <div key={cat} className="bg-white border rounded px-3 py-2 flex justify-between">
                                    <span className="text-muted-foreground capitalize">
                                        {CATEGORY_LABEL[cat] || cat}
                                    </span>
                                    <span className="font-semibold">{categorias[cat]} eventos</span>
                                </div>
                            ))}
                            {categoriaKeys.length === 0 && (
                                <span className="text-muted-foreground col-span-4">Sem detalhes de categoria.</span>
                            )}
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}

// ─── componente principal ──────────────────────────────────────────────────────

export default function RelatorioAcessosClientes() {
    const today = new Date().toISOString().split("T")[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

    const [dateFrom, setDateFrom] = useState(thirtyDaysAgo);
    const [dateTo,   setDateTo]   = useState(today);
    const [search,   setSearch]   = useState("");

    const [kpis,       setKpis]       = useState(null);
    const [funnel,     setFunnel]     = useState([]);
    const [individual, setIndividual] = useState([]);
    const [loading,    setLoading]    = useState(false);
    const [error,      setError]      = useState(null);

    async function fetchAll() {
        setLoading(true);
        setError(null);
        try {
            const fromTs = dateFrom + "T00:00:00Z";
            const toTs   = dateTo   + "T23:59:59Z";

            // ── KPIs agregados no período ──
            const { data: kpiRows, error: kpiErr } = await supabase
                .from("vw_cliente_acesso_indice_geral_diario")
                .select("*")
                .gte("dia", dateFrom)
                .lte("dia", dateTo);
            if (kpiErr) throw kpiErr;

            const kpiAgg = (kpiRows || []).reduce(
                (acc, row) => {
                    acc.totalEventos   += Number(row.total_eventos   || 0);
                    acc.totalSessoes   += Number(row.total_sessoes   || 0);
                    acc.clientesUnicos  = Math.max(acc.clientesUnicos, Number(row.clientes_unicos || 0));
                    if (!acc.ultimoEvento || row.ultimo_evento > acc.ultimoEvento)
                        acc.ultimoEvento = row.ultimo_evento;
                    return acc;
                },
                { totalEventos: 0, totalSessoes: 0, clientesUnicos: 0, ultimoEvento: null }
            );

            // Clientes únicos reais no período (distinct)
            const { count: uniqueCount } = await supabase
                .from("cliente_sessoes_portal")
                .select("auth_user_id", { count: "exact", head: true })
                .gte("session_started_at", fromTs)
                .lte("session_started_at", toTs);

            setKpis({ ...kpiAgg, clientesUnicos: uniqueCount ?? kpiAgg.clientesUnicos });

            // ── Funil: eventos por categoria + nome ──
            const { data: funnelRows, error: funnelErr } = await supabase
                .from("cliente_acesso_eventos")
                .select("event_category, event_name")
                .gte("event_at", fromTs)
                .lte("event_at", toTs);
            if (funnelErr) throw funnelErr;

            const funnelMap = {};
            for (const row of funnelRows || []) {
                const key = `${row.event_category}||${row.event_name}`;
                funnelMap[key] = (funnelMap[key] || 0) + 1;
            }
            const funnelSorted = Object.entries(funnelMap)
                .map(([key, count]) => {
                    const [cat, evt] = key.split("||");
                    return { category: cat, event: evt, count };
                })
                .sort((a, b) => b.count - a.count);
            setFunnel(funnelSorted);

            // ── Índice individual ──
            const { data: indRows, error: indErr } = await supabase
                .from("vw_cliente_acesso_indice_individual")
                .select("*")
                .gte("ultimo_acesso", fromTs)
                .order("ultimo_acesso", { ascending: false });
            if (indErr) throw indErr;
            setIndividual(indRows || []);
        } catch (err) {
            setError(err.message || "Erro ao carregar dados.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { fetchAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const filteredIndividual = individual.filter(row => {
        if (!search) return true;
        const s = search.toLowerCase();
        return (
            (row.nome_completo || "").toLowerCase().includes(s) ||
            (row.email || "").toLowerCase().includes(s)
        );
    });

    return (
        <div className="p-6 space-y-6">
            {/* Cabeçalho */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Acessos do Portal do Cliente</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Índice geral e individual de uso do portal pelos clientes.
                    </p>
                </div>
                {/* Filtros */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 text-sm">
                        <span className="text-muted-foreground">De</span>
                        <Input
                            type="date" value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                            className="h-8 w-36 text-sm"
                        />
                    </div>
                    <div className="flex items-center gap-1 text-sm">
                        <span className="text-muted-foreground">até</span>
                        <Input
                            type="date" value={dateTo}
                            onChange={e => setDateTo(e.target.value)}
                            className="h-8 w-36 text-sm"
                        />
                    </div>
                    <Button size="sm" onClick={fetchAll} disabled={loading} className="gap-1">
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                        Atualizar
                    </Button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-4">
                    {error}
                </div>
            )}

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-5 pb-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wide">Clientes únicos</p>
                                <p className="text-3xl font-bold mt-1">{kpis?.clientesUnicos ?? "—"}</p>
                            </div>
                            <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
                                <Users className="w-5 h-5 text-green-700" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-5 pb-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total de sessões</p>
                                <p className="text-3xl font-bold mt-1">{kpis?.totalSessoes ?? "—"}</p>
                            </div>
                            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                                <Activity className="w-5 h-5 text-blue-700" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-5 pb-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total de eventos</p>
                                <p className="text-3xl font-bold mt-1">{kpis?.totalEventos ?? "—"}</p>
                            </div>
                            <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center">
                                <BarChart2 className="w-5 h-5 text-purple-700" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-5 pb-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wide">Último acesso</p>
                                <p className="text-sm font-semibold mt-2 leading-tight">{fmt(kpis?.ultimoEvento)}</p>
                            </div>
                            <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center">
                                <Clock className="w-5 h-5 text-amber-700" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Funil de eventos */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">Funil de objetivos — o que os clientes fazem no portal</CardTitle>
                </CardHeader>
                <CardContent>
                    {funnel.length === 0 && !loading && (
                        <p className="text-sm text-muted-foreground text-center py-6">
                            Nenhum evento registrado no período.
                        </p>
                    )}
                    {funnel.length > 0 && (
                        <div className="space-y-2">
                            {funnel.map((item, i) => {
                                const maxCount = funnel[0]?.count || 1;
                                const pct = Math.round((item.count / maxCount) * 100);
                                return (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className="w-40 shrink-0 text-right">
                                            <span className="text-xs font-medium text-foreground">
                                                {EVENT_LABEL[item.event] || item.event}
                                            </span>
                                            <br />
                                            <span className="text-xs text-muted-foreground capitalize">
                                                {CATEGORY_LABEL[item.category] || item.category}
                                            </span>
                                        </div>
                                        <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-green-600 rounded-full transition-all"
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                        <span className="w-12 text-right text-sm font-semibold text-foreground shrink-0">
                                            {item.count}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Tabela individual */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <CardTitle className="text-base">Índice individual de clientes</CardTitle>
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar cliente..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-8 h-8 text-sm"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
                                    <th className="py-2 px-4 text-left">Cliente</th>
                                    <th className="py-2 px-4 text-center">Sessões</th>
                                    <th className="py-2 px-4 text-center">Eventos</th>
                                    <th className="py-2 px-4 text-left">Último acesso</th>
                                    <th className="py-2 px-4 text-left">Primeiro acesso</th>
                                    <th className="py-2 px-4 text-center">Objetivos</th>
                                    <th className="py-2 px-4 text-center w-8"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading && (
                                    <tr>
                                        <td colSpan={7} className="text-center py-10 text-muted-foreground text-sm">
                                            Carregando...
                                        </td>
                                    </tr>
                                )}
                                {!loading && filteredIndividual.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="text-center py-10 text-muted-foreground text-sm">
                                            {search ? "Nenhum cliente encontrado para esta busca." : "Nenhum acesso registrado no período."}
                                        </td>
                                    </tr>
                                )}
                                {!loading && filteredIndividual.map((row, i) => (
                                    <ClienteRow key={row.auth_user_id || i} row={row} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {filteredIndividual.length > 0 && (
                        <p className="text-xs text-muted-foreground text-right px-4 py-2">
                            {filteredIndividual.length} cliente{filteredIndividual.length !== 1 ? "s" : ""} com acesso no período
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
