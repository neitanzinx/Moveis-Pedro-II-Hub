import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Search, CheckCircle, XCircle, Clock, Loader2, Package } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEstoqueValidacao } from "@/hooks/useEstoqueValidacao";

const STATUS_CONFIG = {
  aguardando_aprovacao: { label: "Aguardando Aprovação", color: "bg-amber-100 text-amber-700", icon: Clock },
  pendente:             { label: "Pendente",              color: "bg-gray-100 text-gray-600",   icon: Clock },
  aprovado:             { label: "Aprovado",               color: "bg-green-100 text-green-700", icon: CheckCircle },
  rejeitado:            { label: "Rejeitado",              color: "bg-red-100 text-red-700",     icon: XCircle },
  cancelada:            { label: "Cancelada",              color: "bg-gray-100 text-gray-400",   icon: XCircle },
};

const MOTIVO_LABELS = {
  sem_estoque:           "Estoque zerado",
  aprovacao_gerencial:   "Aprovação gerencial",
  produto_sob_encomenda: "Produto sob-encomenda",
  ajuste_manual:         "Ajuste manual",
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pendente;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
      <Icon className="w-3 h-3" /> {cfg.label}
    </span>
  );
}

export default function AprovacaoSemEstoque() {
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("aguardando_aprovacao");
  const [modalItem, setModalItem] = useState(null); // { solicitacao, acao: 'aprovar'|'rejeitar' }
  const [obs, setObs] = useState("");
  const [processando, setProcessando] = useState(false);

  const { user } = useAuth();
  const { aprovarSolicitacao, rejeitarSolicitacao } = useEstoqueValidacao();
  const queryClient = useQueryClient();

  const { data: solicitacoes = [], isLoading } = useQuery({
    queryKey: ["solicitacoes-encomenda-aprovacao"],
    queryFn: () => base44.entities.SolicitacaoEncomenda.list("-created_at"),
    refetchInterval: 15000, // atualiza a cada 15s
  });

  const filtradas = solicitacoes.filter(s => {
    const matchStatus = filtroStatus === "todos" ? true : s.status === filtroStatus;
    const matchSearch =
      !search ||
      s.produto_nome?.toLowerCase().includes(search.toLowerCase()) ||
      s.cliente_nome?.toLowerCase().includes(search.toLowerCase()) ||
      s.numero_pedido?.toLowerCase().includes(search.toLowerCase()) ||
      s.fornecedor_nome?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const countPendentes = solicitacoes.filter(s => s.status === "aguardando_aprovacao").length;

  const handleAprovar = async () => {
    if (!modalItem) return;
    setProcessando(true);
    try {
      await aprovarSolicitacao(
        modalItem.solicitacao.id,
        { id: user?.id, nome: user?.full_name || user?.nome || "Gerente" },
        obs
      );
      toast.success(`Encomenda de "${modalItem.solicitacao.produto_nome}" aprovada`);
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-encomenda-aprovacao"] });
      setModalItem(null);
      setObs("");
    } catch (err) {
      toast.error("Erro ao aprovar solicitação");
    } finally {
      setProcessando(false);
    }
  };

  const handleRejeitar = async () => {
    if (!modalItem) return;
    setProcessando(true);
    try {
      await rejeitarSolicitacao(modalItem.solicitacao.id, obs);
      toast.success(`Encomenda de "${modalItem.solicitacao.produto_nome}" rejeitada`);
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-encomenda-aprovacao"] });
      setModalItem(null);
      setObs("");
    } catch (err) {
      toast.error("Erro ao rejeitar solicitação");
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-100">
            <Package className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">
              Aprovação de Encomendas
              {countPendentes > 0 && (
                <span className="ml-2 text-sm bg-amber-500 text-white px-2 py-0.5 rounded-full">
                  {countPendentes} pendente{countPendentes > 1 ? "s" : ""}
                </span>
              )}
            </h1>
            <p className="text-sm text-gray-500">Vendas sem estoque aguardando autorização gerencial</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar produto, cliente, pedido..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 w-72"
          />
        </div>
        <div className="flex gap-1">
          {[
            { key: "aguardando_aprovacao", label: "Pendentes" },
            { key: "aprovado", label: "Aprovados" },
            { key: "rejeitado", label: "Rejeitados" },
            { key: "todos", label: "Todos" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFiltroStatus(key)}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                filtroStatus === key
                  ? "bg-green-700 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          {/* Cabeçalho da tabela */}
          <div className="grid grid-cols-[1.5fr_2fr_0.8fr_1fr_1fr_auto] gap-3 px-4 py-2.5 bg-gray-50 border-b text-xs font-medium text-gray-500">
            <span>Produto / Fornecedor</span>
            <span>Cliente / Pedido</span>
            <span>Qtd</span>
            <span>Motivo</span>
            <span>Status</span>
            <span>Ações</span>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin text-gray-400" />
            </div>
          ) : filtradas.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-400">
              Nenhuma solicitação encontrada para o filtro selecionado.
            </div>
          ) : (
            filtradas.map(s => (
              <div
                key={s.id}
                className="grid grid-cols-[1.5fr_2fr_0.8fr_1fr_1fr_auto] gap-3 px-4 py-3 border-b border-gray-100 hover:bg-gray-50/50 items-center"
              >
                <div>
                  <p className="text-sm font-medium text-gray-800 truncate">{s.produto_nome}</p>
                  <p className="text-xs text-gray-400">{s.fornecedor_nome}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-700">{s.cliente_nome}</p>
                  <p className="text-xs text-gray-400">Pedido #{s.numero_pedido} · {s.loja}</p>
                </div>
                <span className="text-sm font-medium">{s.quantidade}</span>
                <span className="text-xs text-gray-600">
                  {MOTIVO_LABELS[s.motivo_encomenda] || s.motivo_encomenda || "—"}
                </span>
                <StatusBadge status={s.status} />
                <div className="flex gap-1">
                  {s.status === "aguardando_aprovacao" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs text-green-700 border-green-200 hover:bg-green-50"
                        onClick={() => { setModalItem({ solicitacao: s, acao: "aprovar" }); setObs(""); }}
                      >
                        <CheckCircle className="w-3.5 h-3.5 mr-1" /> Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => { setModalItem({ solicitacao: s, acao: "rejeitar" }); setObs(""); }}
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1" /> Rejeitar
                      </Button>
                    </>
                  )}
                  {s.status === "aprovado" && (
                    <div className="text-xs text-gray-400">
                      por {s.aprovado_por_nome || "—"}<br />
                      {s.data_aprovacao ? new Date(s.data_aprovacao).toLocaleDateString("pt-BR") : ""}
                    </div>
                  )}
                  {s.observacoes_gerencial && (
                    <span className="text-xs text-gray-400 italic truncate max-w-32" title={s.observacoes_gerencial}>
                      "{s.observacoes_gerencial}"
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Modal Aprovar / Rejeitar */}
      <Dialog open={!!modalItem} onOpenChange={() => setModalItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className={modalItem?.acao === "aprovar" ? "text-green-700" : "text-red-600"}>
              {modalItem?.acao === "aprovar" ? "Aprovar Encomenda" : "Rejeitar Encomenda"}
            </DialogTitle>
          </DialogHeader>
          {modalItem && (
            <div className="space-y-4 py-2">
              <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                <p><span className="font-medium">Produto:</span> {modalItem.solicitacao.produto_nome}</p>
                <p><span className="font-medium">Cliente:</span> {modalItem.solicitacao.cliente_nome}</p>
                <p><span className="font-medium">Pedido:</span> #{modalItem.solicitacao.numero_pedido}</p>
                <p><span className="font-medium">Qtd:</span> {modalItem.solicitacao.quantidade}</p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Observações {modalItem.acao === "rejeitar" ? "(obrigatório indicar motivo)" : "(opcional)"}
                </label>
                <Textarea
                  rows={3}
                  placeholder={
                    modalItem.acao === "aprovar"
                      ? "Ex: Mercadoria em trânsito, prazo 10 dias..."
                      : "Ex: Produto descontinuado, aguardar nova coleção..."
                  }
                  value={obs}
                  onChange={e => setObs(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalItem(null)}>Cancelar</Button>
            {modalItem?.acao === "aprovar" ? (
              <Button
                disabled={processando}
                className="bg-green-700 hover:bg-green-800 text-white"
                onClick={handleAprovar}
              >
                {processando ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Aprovando...</> : "Confirmar Aprovação"}
              </Button>
            ) : (
              <Button
                disabled={processando || !obs.trim()}
                variant="destructive"
                onClick={handleRejeitar}
              >
                {processando ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Rejeitando...</> : "Confirmar Rejeição"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
