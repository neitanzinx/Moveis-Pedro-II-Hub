import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Users, ShoppingCart, TrendingUp, CheckCircle2 } from "lucide-react";
import { filtrarFolhasPorMes, normalizeTipo } from "@/services/financeiroAggregation";

const fmt = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const FOLHA_STATUS = {
  Gerado:    { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-400" },
  Pago:      { bg: "bg-green-100 dark:bg-green-900/30",  text: "text-green-700 dark:text-green-400" },
  Cancelado: { bg: "bg-gray-100 dark:bg-neutral-700",    text: "text-gray-500" },
};

const COMISSAO_STATUS = {
  Calculada: { bg: "bg-blue-100 dark:bg-blue-900/30",   text: "text-blue-700 dark:text-blue-400" },
  Paga:      { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400" },
  Pendente:  { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-400" },
  Cancelada: { bg: "bg-gray-100 dark:bg-neutral-700",   text: "text-gray-500" },
};

function StatusBadge({ status, mapa }) {
  const c = mapa?.[status] || { bg: "bg-gray-100", text: "text-gray-500" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${c.bg} ${c.text}`}>
      {status || "—"}
    </span>
  );
}

function isDespesaPendente(lancamento) {
  const status = String(lancamento?.status || "").trim().toLowerCase();
  if (lancamento?.pago === true) return false;
  if (status === "pago" || status === "cancelado") return false;
  return normalizeTipo(lancamento?.tipo) === "saida";
}

// ─── Aba: Folha de Pagamento ─────────────────────────────────────────────────
function FolhaTab({ folhas, mesAno, isLoading }) {
  const [busca, setBusca] = useState("");

  const folhasMes = useMemo(
    () => filtrarFolhasPorMes(folhas, mesAno),
    [folhas, mesAno]
  );

  const filtradas = useMemo(() => {
    if (!busca) return folhasMes;
    const t = busca.toLowerCase();
    return folhasMes.filter((f) => f.colaborador_nome?.toLowerCase().includes(t));
  }, [folhasMes, busca]);

  const totalBruto = folhasMes.reduce((s, f) => s + (f.salario_bruto || 0), 0);
  const totalLiquido = folhasMes.reduce((s, f) => s + (f.salario_liquido || 0), 0);
  const totalFGTS = folhasMes.reduce((s, f) => s + (f.fgts || 0), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-green-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Salário Bruto</p>
            <p className="text-xl font-bold text-gray-800 dark:text-gray-200">R$ {fmt(totalBruto)}</p>
            <p className="text-xs text-gray-400">{folhasMes.length} colaborador(es)</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Salário Líquido</p>
            <p className="text-xl font-bold text-red-600">R$ {fmt(totalLiquido)}</p>
            <p className="text-xs text-gray-400">A desembolsar</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide">FGTS</p>
            <p className="text-xl font-bold text-orange-600">R$ {fmt(totalFGTS)}</p>
            <p className="text-xs text-gray-400">Encargo patronal</p>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Buscar colaborador..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9 text-sm"
        />
      </div>

      {filtradas.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
          {folhasMes.length === 0
            ? "Nenhuma folha gerada para este mês."
            : "Nenhum resultado para a busca."}
        </div>
      ) : (
        <Card className="border-0 shadow-md">
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow className="text-xs text-gray-400 uppercase">
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Bruto</TableHead>
                  <TableHead>Descontos</TableHead>
                  <TableHead>Líquido</TableHead>
                  <TableHead>FGTS</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pagamento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((f) => {
                  const descontos = (f.inss || 0) + (f.irrf || 0) + (f.vale_transporte || 0) + (f.outros_descontos || 0);
                  return (
                    <TableRow key={f.id} className="text-sm hover:bg-gray-50 dark:hover:bg-neutral-800">
                      <TableCell className="font-medium">{f.colaborador_nome || "—"}</TableCell>
                      <TableCell>R$ {fmt(f.salario_bruto)}</TableCell>
                      <TableCell className="text-red-500">– R$ {fmt(descontos)}</TableCell>
                      <TableCell className="font-semibold text-red-600">R$ {fmt(f.salario_liquido)}</TableCell>
                      <TableCell className="text-orange-500">R$ {fmt(f.fgts)}</TableCell>
                      <TableCell><StatusBadge status={f.status} mapa={FOLHA_STATUS} /></TableCell>
                      <TableCell className="text-gray-400 text-xs">
                        {f.data_pagamento
                          ? new Date(f.data_pagamento + "T00:00:00").toLocaleDateString("pt-BR")
                          : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Aba: Comissões ──────────────────────────────────────────────────────────
function ComissoesTab({ comissoes, mesAno, isLoading }) {
  const [filtroStatus, setFiltroStatus] = useState("pendentes");

  const comissoesMes = useMemo(() => {
    if (!Array.isArray(comissoes)) return [];
    return comissoes.filter((c) => c.data_calculo?.slice(0, 7) === mesAno);
  }, [comissoes, mesAno]);

  const filtradas = useMemo(() => {
    if (filtroStatus === "pendentes") {
      return comissoesMes.filter((c) => c.status === "Calculada" || c.status === "Pendente");
    }
    if (filtroStatus === "pagas") {
      return comissoesMes.filter((c) => c.status === "Paga");
    }
    return comissoesMes;
  }, [comissoesMes, filtroStatus]);

  const totalPendente = comissoesMes
    .filter((c) => c.status === "Calculada" || c.status === "Pendente")
    .reduce((s, c) => s + (c.valor_comissao || 0), 0);
  const totalPago = comissoesMes
    .filter((c) => c.status === "Paga")
    .reduce((s, c) => s + (c.valor_comissao || 0), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-green-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide">A Pagar</p>
            <p className="text-xl font-bold text-orange-600">R$ {fmt(totalPendente)}</p>
            <p className="text-xs text-gray-400">
              {comissoesMes.filter((c) => c.status === "Calculada" || c.status === "Pendente").length} comissão(ões)
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Já Pagas</p>
            <p className="text-xl font-bold text-green-600">R$ {fmt(totalPago)}</p>
            <p className="text-xs text-gray-400">
              {comissoesMes.filter((c) => c.status === "Paga").length} comissão(ões)
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2">
        {[
          { value: "pendentes", label: "A pagar" },
          { value: "pagas",     label: "Pagas" },
          { value: "todas",     label: "Todas" },
        ].map((op) => (
          <button
            key={op.value}
            onClick={() => setFiltroStatus(op.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filtroStatus === op.value
                ? "bg-green-600 text-white"
                : "bg-gray-100 dark:bg-neutral-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-neutral-600"
            }`}
          >
            {op.label}
          </button>
        ))}
      </div>

      {filtradas.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-30" />
          {comissoesMes.length === 0
            ? "Sem comissões calculadas neste mês."
            : "Nenhuma comissão com este status."}
        </div>
      ) : (
        <Card className="border-0 shadow-md">
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow className="text-xs text-gray-400 uppercase">
                  <TableHead>Data Cálculo</TableHead>
                  <TableHead>Forma Pagto.</TableHead>
                  <TableHead>Base</TableHead>
                  <TableHead>%</TableHead>
                  <TableHead>Comissão</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((c) => (
                  <TableRow key={c.id} className="text-sm hover:bg-gray-50 dark:hover:bg-neutral-800">
                    <TableCell className="text-gray-500 text-xs">
                      {c.data_calculo ? new Date(c.data_calculo).toLocaleDateString("pt-BR") : "—"}
                    </TableCell>
                    <TableCell>{c.forma_pagamento || "—"}</TableCell>
                    <TableCell>R$ {fmt(c.valor_base)}</TableCell>
                    <TableCell>{c.percentual_aplicado ? `${c.percentual_aplicado}%` : "—"}</TableCell>
                    <TableCell className="font-semibold text-orange-600">
                      R$ {fmt(c.valor_comissao)}
                    </TableCell>
                    <TableCell><StatusBadge status={c.status} mapa={COMISSAO_STATUS} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Aba: Contas a Pagar de Compras ─────────────────────────────────────────
function ComprasTab({ contasPagarCompras, isLoading }) {
  const pendentes = useMemo(() => {
    if (!Array.isArray(contasPagarCompras)) return [];
    return contasPagarCompras.filter(
      (c) => c.status === "Pendente" || c.status === "Em aberto" || c.status === "Vencida"
    );
  }, [contasPagarCompras]);

  const total = pendentes.reduce((s, c) => s + (c.valor_total || c.valor || 0), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-green-600" />
      </div>
    );
  }

  if (pendentes.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-30" />
        <p>Nenhuma conta a pagar de compras em aberto.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-md">
        <CardContent className="pt-4 pb-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Pendente</p>
          <p className="text-xl font-bold text-red-600">R$ {fmt(total)}</p>
          <p className="text-xs text-gray-400">{pendentes.length} conta(s)</p>
        </CardContent>
      </Card>
      <Card className="border-0 shadow-md">
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow className="text-xs text-gray-400 uppercase">
                <TableHead>Descrição</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendentes.map((c) => (
                <TableRow key={c.id} className="text-sm hover:bg-gray-50 dark:hover:bg-neutral-800">
                  <TableCell>{c.descricao || c.numero_pedido || "—"}</TableCell>
                  <TableCell className="text-gray-500 text-xs">
                    {c.data_vencimento
                      ? new Date(c.data_vencimento + "T00:00:00").toLocaleDateString("pt-BR")
                      : "—"}
                  </TableCell>
                  <TableCell className="font-semibold text-red-600">
                    R$ {fmt(c.valor_total || c.valor)}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      c.status === "Vencida"
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {c.status}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function DespesasTab({ lancamentos = [], isLoading }) {
  const [busca, setBusca] = useState("");

  const pendentes = useMemo(() => {
    if (!Array.isArray(lancamentos)) return [];
    return lancamentos.filter(isDespesaPendente);
  }, [lancamentos]);

  const filtradas = useMemo(() => {
    if (!busca) return pendentes;
    const termo = busca.toLowerCase();
    return pendentes.filter((l) =>
      l.descricao?.toLowerCase().includes(termo) ||
      l.categoria_nome?.toLowerCase().includes(termo) ||
      l.forma_pagamento?.toLowerCase().includes(termo)
    );
  }, [pendentes, busca]);

  const total = pendentes.reduce((sum, lanc) => sum + Math.abs(Number(lanc.valor || 0)), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-green-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-md">
        <CardContent className="pt-4 pb-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Despesas Pendentes</p>
          <p className="text-xl font-bold text-red-600">R$ {fmt(total)}</p>
          <p className="text-xs text-gray-400">{pendentes.length} lançamento(s)</p>
        </CardContent>
      </Card>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Buscar despesa, categoria ou forma de pagamento..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9 text-sm"
        />
      </div>

      {filtradas.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>{pendentes.length === 0 ? "Nenhuma despesa pendente." : "Nenhuma despesa encontrada para a busca."}</p>
        </div>
      ) : (
        <Card className="border-0 shadow-md">
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow className="text-xs text-gray-400 uppercase">
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Forma</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((lanc) => (
                  <TableRow 
                    key={lanc.id} 
                    className="text-sm hover:bg-gray-50 dark:hover:bg-neutral-800 cursor-pointer"
                    onClick={() => window.dispatchEvent(new CustomEvent("openLancamentoDetalhes", { detail: lanc }))}
                  >
                    <TableCell className="font-medium">{lanc.descricao || "—"}</TableCell>
                    <TableCell>{lanc.categoria_nome || "—"}</TableCell>
                    <TableCell className="text-gray-500 text-xs">
                      {lanc.data_vencimento
                        ? new Date(lanc.data_vencimento + "T00:00:00").toLocaleDateString("pt-BR")
                        : "—"}
                    </TableCell>
                    <TableCell>{lanc.forma_pagamento || "—"}</TableCell>
                    <TableCell className="font-semibold text-red-600">R$ {fmt(Math.abs(lanc.valor || 0))}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
                        {lanc.status || "Pendente"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PagasTab({
  folhas = [],
  comissoes = [],
  contasPagarCompras = [],
  lancamentos = [],
  mesAno,
  isLoading = false,
}) {
  const [busca, setBusca] = useState("");

  const toStatus = (v) => String(v || "").trim().toLowerCase();
  const isPago = (status) => ["pago", "paga", "quitado", "liquidado"].includes(toStatus(status));
  const isDoMesSelecionado = (dateValue) => {
    if (!mesAno) return true;
    if (!dateValue) return false;
    const dateStr = String(dateValue);
    return dateStr.slice(0, 7) === mesAno;
  };

  const contasPagas = useMemo(() => {
    const contas = [];

    folhas
      .filter((f) => isPago(f.status) && isDoMesSelecionado(f.data_pagamento || f.updated_at || f.created_at))
      .forEach((f) => {
        contas.push({
          id: `folha-${f.id}`,
          origem: "Folha",
          descricao: f.colaborador_nome || "Folha de pagamento",
          categoria: "Folha de Pagamento",
          forma: "—",
          valor: Number(f.salario_liquido || 0),
          data: f.data_pagamento || f.updated_at || f.created_at || null,
          status: f.status || "Pago",
        });
      });

    comissoes
      .filter((c) => isPago(c.status) && isDoMesSelecionado(c.data_pagamento || c.data_calculo || c.updated_at || c.created_at))
      .forEach((c) => {
        contas.push({
          id: `comissao-${c.id}`,
          origem: "Comissão",
          descricao: c.colaborador_nome || "Comissão de vendas",
          categoria: "Comissões",
          forma: c.forma_pagamento || "—",
          valor: Number(c.valor_comissao || 0),
          data: c.data_pagamento || c.data_calculo || c.updated_at || c.created_at || null,
          status: c.status || "Paga",
        });
      });

    contasPagarCompras
      .filter((c) => isPago(c.status) && isDoMesSelecionado(c.data_vencimento || c.data_pagamento || c.updated_at || c.created_at))
      .forEach((c) => {
        contas.push({
          id: `compra-${c.id}`,
          origem: "Compras",
          descricao: c.descricao || c.numero_pedido || "Conta de compra",
          categoria: "Contas de Compras",
          forma: c.forma_pagamento || "—",
          valor: Number(c.valor_total || c.valor || 0),
          data: c.data_vencimento || c.data_pagamento || c.updated_at || c.created_at || null,
          status: c.status || "Pago",
        });
      });

    lancamentos
      .filter((l) =>
        normalizeTipo(l.tipo) === "saida" &&
        (l.pago === true || isPago(l.status)) &&
        isDoMesSelecionado(l.data_vencimento || l.data_lancamento_real || l.data_lancamento || l.updated_at || l.created_at)
      )
      .forEach((l) => {
        contas.push({
          id: `lancamento-${l.id}`,
          origem: "Despesas",
          descricao: l.descricao || "Lançamento financeiro",
          categoria: l.categoria_nome || "Sem categoria",
          forma: l.forma_pagamento || "—",
          valor: Math.abs(Number(l.valor || 0)),
          data: l.data_vencimento || l.data_lancamento_real || l.data_lancamento || l.updated_at || l.created_at || null,
          status: l.status || "Pago",
          _raw: l,
        });
      });

    return contas.sort((a, b) => {
      const da = a.data ? new Date(a.data).getTime() : 0;
      const db = b.data ? new Date(b.data).getTime() : 0;
      return db - da;
    });
  }, [folhas, comissoes, contasPagarCompras, lancamentos, mesAno]);

  const filtradas = useMemo(() => {
    if (!busca) return contasPagas;
    const termo = busca.toLowerCase();
    return contasPagas.filter((conta) =>
      conta.descricao?.toLowerCase().includes(termo) ||
      conta.categoria?.toLowerCase().includes(termo) ||
      conta.forma?.toLowerCase().includes(termo) ||
      conta.origem?.toLowerCase().includes(termo)
    );
  }, [contasPagas, busca]);

  const totalPago = contasPagas.reduce((sum, conta) => sum + Number(conta.valor || 0), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-green-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-md">
        <CardContent className="pt-4 pb-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Pago</p>
          <p className="text-xl font-bold text-green-600">R$ {fmt(totalPago)}</p>
          <p className="text-xs text-gray-400">{contasPagas.length} conta(s) paga(s)</p>
        </CardContent>
      </Card>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Pesquisar conta paga por descrição, categoria, origem ou forma..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9 text-sm"
        />
      </div>

      {filtradas.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>{contasPagas.length === 0 ? "Nenhuma conta paga encontrada." : "Nenhuma conta paga corresponde à busca."}</p>
        </div>
      ) : (
        <Card className="border-0 shadow-md">
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow className="text-xs text-gray-400 uppercase">
                  <TableHead>Origem</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Forma</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((conta) => (
                  <TableRow 
                    key={conta.id} 
                    className={`text-sm hover:bg-gray-50 dark:hover:bg-neutral-800 ${conta.origem === 'Despesas' ? 'cursor-pointer' : ''}`}
                    onClick={() => {
                      if (conta.origem === 'Despesas' && conta._raw) {
                        window.dispatchEvent(new CustomEvent("openLancamentoDetalhes", { detail: conta._raw }));
                      }
                    }}
                  >
                    <TableCell>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                        {conta.origem}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{conta.descricao || "—"}</TableCell>
                    <TableCell>{conta.categoria || "—"}</TableCell>
                    <TableCell>{conta.forma || "—"}</TableCell>
                    <TableCell className="text-gray-500 text-xs">
                      {conta.data ? new Date(conta.data).toLocaleDateString("pt-BR") : "—"}
                    </TableCell>
                    <TableCell className="font-semibold text-green-600">R$ {fmt(conta.valor)}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                        {conta.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function ContasPagar({
  folhas = [],
  comissoes = [],
  contasPagarCompras = [],
  lancamentos = [],
  mesAno,
  isLoadingFolha = false,
  isLoadingComissoes = false,
  isLoadingCompras = false,
  isLoadingLancamentos = false,
}) {
  const [activeTab, setActiveTab] = useState("folha");

  const totalFolhaMes = useMemo(
    () => filtrarFolhasPorMes(folhas, mesAno).reduce((s, f) => s + (f.salario_liquido || 0), 0),
    [folhas, mesAno]
  );

  const totalComissoesMes = useMemo(() => {
    if (!Array.isArray(comissoes)) return 0;
    return comissoes
      .filter((c) => c.data_calculo?.slice(0, 7) === mesAno && (c.status === "Calculada" || c.status === "Pendente"))
      .reduce((s, c) => s + (c.valor_comissao || 0), 0);
  }, [comissoes, mesAno]);

  const totalComprasPendentes = useMemo(() => {
    if (!Array.isArray(contasPagarCompras)) return 0;
    return contasPagarCompras
      .filter((c) => c.status === "Pendente" || c.status === "Em aberto" || c.status === "Vencida")
      .reduce((s, c) => s + (c.valor_total || c.valor || 0), 0);
  }, [contasPagarCompras]);

  const totalDespesasPendentes = useMemo(() => {
    if (!Array.isArray(lancamentos)) return 0;
    return lancamentos
      .filter(isDespesaPendente)
      .reduce((sum, lanc) => sum + Math.abs(Number(lanc.valor || 0)), 0);
  }, [lancamentos]);

  const grandTotal = totalFolhaMes + totalComissoesMes + totalComprasPendentes + totalDespesasPendentes;
  const isLoadingPagas = isLoadingFolha || isLoadingComissoes || isLoadingCompras || isLoadingLancamentos;

  return (
    <div className="space-y-4">
      {/* Resumo total */}
      <div className="grid grid-cols-5 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total a Pagar</p>
            <p className="text-xl font-bold text-red-600">R$ {fmt(grandTotal)}</p>
            <p className="text-xs text-gray-400">Todas as obrigações</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Folha</p>
            <p className="text-xl font-bold text-gray-700 dark:text-gray-200">R$ {fmt(totalFolhaMes)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Comissões</p>
            <p className="text-xl font-bold text-orange-600">R$ {fmt(totalComissoesMes)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Compras</p>
            <p className="text-xl font-bold text-red-500">R$ {fmt(totalComprasPendentes)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Despesas</p>
            <p className="text-xl font-bold text-red-600">R$ {fmt(totalDespesasPendentes)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Sub-tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 h-auto p-0 gap-1">
          <TabsTrigger value="folha" className="data-[state=active]:bg-green-50 data-[state=active]:text-green-700 px-4 py-2 rounded-md text-sm">
            <Users className="w-4 h-4 mr-1.5" />
            Folha de Pagamento
          </TabsTrigger>
          <TabsTrigger value="comissoes" className="data-[state=active]:bg-green-50 data-[state=active]:text-green-700 px-4 py-2 rounded-md text-sm">
            <TrendingUp className="w-4 h-4 mr-1.5" />
            Comissões
          </TabsTrigger>
          <TabsTrigger value="compras" className="data-[state=active]:bg-green-50 data-[state=active]:text-green-700 px-4 py-2 rounded-md text-sm">
            <ShoppingCart className="w-4 h-4 mr-1.5" />
            Contas de Compras
          </TabsTrigger>
          <TabsTrigger value="despesas" className="data-[state=active]:bg-green-50 data-[state=active]:text-green-700 px-4 py-2 rounded-md text-sm">
            <TrendingUp className="w-4 h-4 mr-1.5" />
            Despesas
          </TabsTrigger>
          <TabsTrigger value="pagas" className="data-[state=active]:bg-green-50 data-[state=active]:text-green-700 px-4 py-2 rounded-md text-sm">
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            Pagas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="folha">
          <FolhaTab folhas={folhas} mesAno={mesAno} isLoading={isLoadingFolha} />
        </TabsContent>
        <TabsContent value="comissoes">
          <ComissoesTab comissoes={comissoes} mesAno={mesAno} isLoading={isLoadingComissoes} />
        </TabsContent>
        <TabsContent value="compras">
          <ComprasTab contasPagarCompras={contasPagarCompras} isLoading={isLoadingCompras} />
        </TabsContent>
        <TabsContent value="despesas">
          <DespesasTab lancamentos={lancamentos} isLoading={isLoadingLancamentos} />
        </TabsContent>
        <TabsContent value="pagas">
          <PagasTab
            folhas={folhas}
            comissoes={comissoes}
            contasPagarCompras={contasPagarCompras}
            lancamentos={lancamentos}
            mesAno={mesAno}
            isLoading={isLoadingPagas}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
