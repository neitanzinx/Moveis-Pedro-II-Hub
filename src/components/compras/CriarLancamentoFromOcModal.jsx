import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/lib/supabase";
import { useConfirm } from "@/hooks/useConfirm";
import { verificarConciliacao } from "@/lib/conciliacaoInteligente";
import ConciliacaoAlertModal from "@/components/financeiro/ConciliacaoAlertModal";

export default function CriarLancamentoFromOcModal({ oc, open, onClose, categorias }) {
  const [form, setForm] = useState({
    categoria_id: "",
    descricao: `Compra OC #${oc?.numero_pedido || ""}`,
    valor: oc?.valor_total || "",
    status: "Pendente",
    data_vencimento: "",
    forma_pagamento: oc?.forma_pagamento_oc || "",
    observacao: "",
  });
  const [error, setError] = useState("");
  const [conciliacaoState, setConciliacaoState] = useState(null);
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const { data: todosLancamentos = [] } = useQuery({
    queryKey: ['lancamentos-financeiros'],
    queryFn: async () => await base44.entities.LancamentoFinanceiro.list('-data_lancamento') || [],
    staleTime: 60000,
  });

  const mutation = useMutation({
    mutationFn: async (payload) => base44.entities.LancamentoFinanceiro.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lancamentos-financeiros"] });
      onClose();
    },
    onError: (err) => setError(err?.message || "Erro ao criar lançamento."),
  });

  const criarLancamento = async (payload) => {
    mutation.mutate(payload);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.categoria_id) return setError("Selecione uma categoria.");
    if (!form.valor || isNaN(Number(form.valor))) return setError("Valor inválido.");
    if (!form.data_vencimento) return setError("Informe a data de vencimento.");
    const confirmed = await confirm({
      title: "Criar Lançamento Financeiro",
      message: `Deseja criar o lançamento para a OC #${oc.numero_pedido}?`,
      confirmText: "Criar Lançamento",
      cancelText: "Cancelar",
    });
    if (!confirmed) return;
    const payload = {
      tipo: "Saída",
      categoria_id: form.categoria_id,
      categoria_nome: categorias.find(c => c.id === form.categoria_id)?.nome || "",
      descricao: form.descricao,
      valor: Number(form.valor),
      status: form.status,
      data_vencimento: form.data_vencimento,
      forma_pagamento: form.forma_pagamento,
      observacao: form.observacao,
      numero_pedido: oc.numero_pedido,
      fornecedor_nome: oc.fornecedor_nome,
      origem: `OC#${oc.numero_pedido}`
    };
    // Conciliação inteligente
    const { duplicatas } = verificarConciliacao(payload, todosLancamentos);
    if (duplicatas.length > 0) {
      setConciliacaoState({ duplicatas, payload });
      return;
    }
    criarLancamento(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      {conciliacaoState && (
        <ConciliacaoAlertModal
          open
          duplicatas={conciliacaoState.duplicatas}
          novoValor={conciliacaoState.payload.valor}
          novoDescricao={conciliacaoState.payload.descricao}
          onConfirm={() => {
            const p = conciliacaoState.payload;
            setConciliacaoState(null);
            criarLancamento(p);
          }}
          onCancel={() => setConciliacaoState(null)}
        />
      )}
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Criar Lançamento Financeiro</DialogTitle>
          <DialogDescription>
            Preencha os dados para criar o lançamento desta compra no financeiro.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium">Ordem de Compra</label>
            <Input value={oc.numero_pedido} readOnly className="bg-gray-100" />
          </div>
          <div>
            <label className="block text-xs font-medium">Fornecedor</label>
            <Input value={oc.fornecedor_nome} readOnly className="bg-gray-100" />
          </div>
          <div>
            <label className="block text-xs font-medium">Valor Total</label>
            <Input value={form.valor} readOnly className="bg-gray-100" />
          </div>
          <div>
            <label className="block text-xs font-medium">Categoria</label>
            <Select value={form.categoria_id} onValueChange={v => setForm(f => ({ ...f, categoria_id: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {categorias.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-xs font-medium">Descrição</label>
            <Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium">Status</label>
            <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Pendente">Pendente</SelectItem>
                <SelectItem value="Pago">Pago</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-xs font-medium">Data de Vencimento</label>
            <Input type="date" value={form.data_vencimento} onChange={e => setForm(f => ({ ...f, data_vencimento: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium">Forma de Pagamento</label>
            <Input value={form.forma_pagamento} onChange={e => setForm(f => ({ ...f, forma_pagamento: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium">Observação</label>
            <Textarea value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} />
          </div>
          {error && <div className="text-red-600 text-xs">{error}</div>}
          <div className="flex justify-end">
            <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Salvando..." : "Criar Lançamento"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
