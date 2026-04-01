import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Search, Settings, Package, Loader2, Save } from "lucide-react";

const TIPO_LABELS = {
  pronta_entrega:  { label: "Pronta Entrega", desc: "Bloqueia venda se sem estoque", color: "bg-red-100 text-red-700" },
  sob_encomenda:   { label: "Sob-Encomenda",  desc: "Sempre gera ordem de compra",  color: "bg-blue-100 text-blue-700" },
  flexivel:        { label: "Flexível",        desc: "Vende normal, sem estoque pede aprovação", color: "bg-green-100 text-green-700" },
  herdado:         { label: "Herdar fornecedor", desc: "Usa configuração do fornecedor", color: "bg-gray-100 text-gray-600" },
};

// ─── Linha editável de fornecedor ────────────────────────────────────────────
function FornecedorRow({ fornecedor, onSave, saving }) {
  const [draft, setDraft] = useState({
    tipo_estoque_padrao: fornecedor.tipo_estoque_padrao || "flexivel",
    aprovacao_obrigatoria: fornecedor.aprovacao_obrigatoria !== false,
    prazo_entrega_dias_padrao: fornecedor.prazo_entrega_dias_padrao ?? 15,
  });
  const dirty =
    draft.tipo_estoque_padrao !== (fornecedor.tipo_estoque_padrao || "flexivel") ||
    draft.aprovacao_obrigatoria !== (fornecedor.aprovacao_obrigatoria !== false) ||
    draft.prazo_entrega_dias_padrao !== (fornecedor.prazo_entrega_dias_padrao ?? 15);

  return (
    <div className="grid grid-cols-[2fr_1.5fr_1fr_auto_auto] gap-3 items-center py-3 px-4 border-b border-gray-100 hover:bg-gray-50/50">
      <div>
        <p className="text-sm font-medium text-gray-800">{fornecedor.nome_empresa}</p>
        <p className="text-xs text-gray-400">{fornecedor.cidade || "—"}</p>
      </div>

      <Select value={draft.tipo_estoque_padrao} onValueChange={v => setDraft(d => ({ ...d, tipo_estoque_padrao: v }))}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(TIPO_LABELS)
            .filter(([k]) => k !== "herdado")
            .map(([value, { label }]) => (
              <SelectItem key={value} value={value} className="text-xs">{label}</SelectItem>
            ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          max={120}
          className="w-16 border rounded px-2 py-1 text-xs"
          value={draft.prazo_entrega_dias_padrao}
          onChange={e => setDraft(d => ({ ...d, prazo_entrega_dias_padrao: Number(e.target.value) }))}
        />
        <span className="text-xs text-gray-400">dias</span>
      </div>

      <label className="flex items-center gap-1.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={draft.aprovacao_obrigatoria}
          onChange={e => setDraft(d => ({ ...d, aprovacao_obrigatoria: e.target.checked }))}
          className="rounded"
        />
        <span className="text-xs text-gray-600 whitespace-nowrap">Exigir aprovação</span>
      </label>

      <Button
        size="sm"
        variant={dirty ? "default" : "ghost"}
        disabled={!dirty || saving}
        className="h-7 px-3 text-xs"
        onClick={() => onSave(fornecedor.id, draft)}
      >
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
      </Button>
    </div>
  );
}

// ─── Linha editável de produto (override) ───────────────────────────────────
function ProdutoRow({ produto, onSave, saving }) {
  const [draft, setDraft] = useState({
    tipo_estoque: produto.tipo_estoque || "herdado",
    prazo_entrega_dias: produto.prazo_entrega_dias ?? "",
    requires_approval: produto.requires_approval,
  });
  const dirty =
    draft.tipo_estoque !== (produto.tipo_estoque || "herdado") ||
    draft.prazo_entrega_dias !== (produto.prazo_entrega_dias ?? "") ||
    draft.requires_approval !== produto.requires_approval;

  const tipoInfo = TIPO_LABELS[draft.tipo_estoque];

  return (
    <div className="grid grid-cols-[2.5fr_1.5fr_0.8fr_auto_auto] gap-3 items-center py-2.5 px-4 border-b border-gray-100 hover:bg-gray-50/50">
      <div>
        <p className="text-xs font-medium text-gray-800 truncate">{produto.nome}</p>
        <p className="text-xs text-gray-400">{produto.fornecedor_nome} · #{produto.id}</p>
      </div>

      <Select value={draft.tipo_estoque} onValueChange={v => setDraft(d => ({ ...d, tipo_estoque: v }))}>
        <SelectTrigger className="h-7 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(TIPO_LABELS).map(([value, { label }]) => (
            <SelectItem key={value} value={value} className="text-xs">{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1">
        <input
          type="number"
          min={1}
          max={365}
          placeholder="padrão"
          className="w-16 border rounded px-2 py-1 text-xs"
          value={draft.prazo_entrega_dias}
          onChange={e => setDraft(d => ({ ...d, prazo_entrega_dias: e.target.value ? Number(e.target.value) : "" }))}
        />
      </div>

      <label className="flex items-center gap-1 cursor-pointer">
        <input
          type="checkbox"
          checked={draft.requires_approval === true}
          onChange={e => setDraft(d => ({
            ...d,
            requires_approval: e.target.checked ? true : null
          }))}
          className="rounded"
        />
        <span className="text-xs text-gray-500 whitespace-nowrap">Override<br/>aprovação</span>
      </label>

      <Button
        size="sm"
        variant={dirty ? "default" : "ghost"}
        disabled={!dirty || saving}
        className="h-7 px-3 text-xs"
        onClick={() => onSave(produto.id, {
          tipo_estoque: draft.tipo_estoque,
          prazo_entrega_dias: draft.prazo_entrega_dias !== "" ? draft.prazo_entrega_dias : null,
          requires_approval: draft.requires_approval,
        })}
      >
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
      </Button>
    </div>
  );
}

// ─── Página Principal ────────────────────────────────────────────────────────
export default function PoliticasEstoque() {
  const [searchForn, setSearchForn] = useState("");
  const [searchProd, setSearchProd] = useState("");
  const [savingId, setSavingId] = useState(null);
  const queryClient = useQueryClient();

  const { data: fornecedores = [], isLoading: loadingForn } = useQuery({
    queryKey: ["fornecedores"],
    queryFn: () => base44.entities.Fornecedor.list("nome_empresa"),
  });

  const { data: produtos = [], isLoading: loadingProd } = useQuery({
    queryKey: ["produtos-politicas"],
    queryFn: () => base44.entities.Produto.list("nome"),
    select: d => d.filter(p => p.ativo && p.tipo_estoque && p.tipo_estoque !== "herdado"),
    staleTime: 60000,
  });

  const saveFornMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Fornecedor.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      toast.success("Fornecedor atualizado");
      setSavingId(null);
    },
    onError: () => {
      toast.error("Erro ao salvar");
      setSavingId(null);
    },
  });

  const saveProdMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Produto.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos-politicas"] });
      toast.success("Produto atualizado");
      setSavingId(null);
    },
    onError: () => {
      toast.error("Erro ao salvar");
      setSavingId(null);
    },
  });

  const fornsFiltrados = fornecedores.filter(f =>
    f.nome_empresa?.toLowerCase().includes(searchForn.toLowerCase())
  );

  const prodsFiltrados = produtos.filter(p =>
    p.nome?.toLowerCase().includes(searchProd.toLowerCase()) ||
    p.fornecedor_nome?.toLowerCase().includes(searchProd.toLowerCase())
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-green-100">
          <Settings className="w-5 h-5 text-green-700" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800">Políticas de Estoque</h1>
          <p className="text-sm text-gray-500">Configure como cada fornecedor/produto se comporta quando sem estoque</p>
        </div>
      </div>

      {/* Legenda */}
      <Card className="border-0 bg-gray-50">
        <CardContent className="py-3 px-4 flex flex-wrap gap-3">
          {Object.entries(TIPO_LABELS).map(([, { label, desc, color }]) => (
            <div key={label} className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${color}`}>{label}</span>
              <span className="text-xs text-gray-500">{desc}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Tabs defaultValue="fornecedores">
        <TabsList>
          <TabsTrigger value="fornecedores">Por Fornecedor (padrão)</TabsTrigger>
          <TabsTrigger value="produtos">Overrides por Produto</TabsTrigger>
        </TabsList>

        {/* ─── ABA FORNECEDORES ─── */}
        <TabsContent value="fornecedores" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Configuração por Fornecedor</CardTitle>
              <CardDescription className="text-xs">
                Define o comportamento padrão para todos os produtos do fornecedor. Produtos com override individual ignoram esta configuração.
              </CardDescription>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Buscar fornecedor..."
                  value={searchForn}
                  onChange={e => setSearchForn(e.target.value)}
                  className="pl-9 h-8 text-sm"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Cabeçalho */}
              <div className="grid grid-cols-[2fr_1.5fr_1fr_auto_auto] gap-3 px-4 py-2 bg-gray-100 text-xs text-gray-500 font-medium">
                <span>Fornecedor</span>
                <span>Política de estoque</span>
                <span>Prazo padrão</span>
                <span>Aprovação</span>
                <span></span>
              </div>
              {loadingForn ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-400" /></div>
              ) : (
                fornsFiltrados.map(f => (
                  <FornecedorRow
                    key={f.id}
                    fornecedor={f}
                    saving={savingId === f.id}
                    onSave={(id, data) => {
                      setSavingId(id);
                      saveFornMutation.mutate({ id, data });
                    }}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── ABA PRODUTOS ─── */}
        <TabsContent value="produtos" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="w-4 h-4" /> Overrides por Produto
              </CardTitle>
              <CardDescription className="text-xs">
                Apenas produtos com configuração individual diferente de "herdado" aparecem aqui. Para configurar um produto, acesse o cadastro do produto e altere o campo "Política de Estoque".
              </CardDescription>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Buscar produto ou fornecedor..."
                  value={searchProd}
                  onChange={e => setSearchProd(e.target.value)}
                  className="pl-9 h-8 text-sm"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-[2.5fr_1.5fr_0.8fr_auto_auto] gap-3 px-4 py-2 bg-gray-100 text-xs text-gray-500 font-medium">
                <span>Produto</span>
                <span>Política individual</span>
                <span>Prazo (dias)</span>
                <span>Aprovação</span>
                <span></span>
              </div>
              {loadingProd ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-400" /></div>
              ) : prodsFiltrados.length === 0 ? (
                <div className="text-center py-10 text-sm text-gray-400">
                  Nenhum produto com configuração individual. Configure um produto editando o campo "Política de Estoque" no cadastro do produto.
                </div>
              ) : (
                prodsFiltrados.map(p => (
                  <ProdutoRow
                    key={p.id}
                    produto={p}
                    saving={savingId === p.id}
                    onSave={(id, data) => {
                      setSavingId(id);
                      saveProdMutation.mutate({ id, data });
                    }}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
