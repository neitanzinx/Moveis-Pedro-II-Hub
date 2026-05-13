import React, { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/lib/supabase";
import { Paperclip, CheckCircle, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

export default function CriarLancamentoFromOcModal({ oc, open, onClose, categorias }) {
  const ocAtual = oc || null;
  const [form, setForm] = useState({
    categoria_id: "",
    descricao: `Compra OC #${ocAtual?.numero_pedido || ""}`,
    data_vencimento: "",
    forma_pagamento: ocAtual?.forma_pagamento_oc || "",
    observacao: "",
    detalhe_devolucao: "",
    anexo_url: "",
  });
  const [uploading, setUploading] = useState(false);
  const [anexoNome, setAnexoNome] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open || !ocAtual) return;
    setForm({
      categoria_id: "",
      descricao: `Compra OC #${ocAtual.numero_pedido || ""}`,
      data_vencimento: "",
      forma_pagamento: ocAtual.forma_pagamento_oc || "",
      observacao: "",
      detalhe_devolucao: "",
      anexo_url: "",
    });
    setUploading(false);
    setAnexoNome("");
    setError("");
  }, [open, ocAtual]);

  const mutation = useMutation({
    mutationFn: async () => {
      const solicitacao = {
        categoria_id: form.categoria_id,
        categoria_nome: categorias.find(c => c.id === form.categoria_id)?.nome || "",
        descricao: form.descricao,
        valor: ocAtual.valor_total,
        data_vencimento: form.data_vencimento,
        forma_pagamento: form.forma_pagamento,
        observacao: form.observacao,
        detalhe_devolucao: form.detalhe_devolucao,
        anexo_url: form.anexo_url,
        anexo_nome: anexoNome,
        solicitado_em: new Date().toISOString(),
      };
      const anexosAtuais = Array.isArray(ocAtual.anexos_financeiro) ? ocAtual.anexos_financeiro : [];
      await base44.entities.ComprasOrden.update(ocAtual.id, {
        pagamento_status: "pendente_aprovacao",
        observacoes_aprovacao: form.detalhe_devolucao || form.observacao || null,
        anexos_financeiro: [...anexosAtuais, { url: form.anexo_url, nome: anexoNome, data: new Date().toISOString() }],
        metadata: {
          ...(ocAtual.metadata || {}),
          solicitacao_financeiro: solicitacao,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compras"] });
      toast.success("Solicitação enviada para aprovação do setor financeiro.");
      onClose();
    },
    onError: (err) => setError(err?.message || "Erro ao enviar solicitação."),
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm(f => ({ ...f, anexo_url: file_url }));
      setAnexoNome(file.name);
    } catch {
      setError("Erro ao enviar o arquivo. Tente novamente.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    if (!ocAtual) return setError("Nenhuma ordem de compra foi selecionada.");
    if (!form.anexo_url) return setError("Anexe o comprovante de devolução do fabricante antes de continuar.");
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Solicitar Aprovação Financeira</DialogTitle>
          <DialogDescription>
            Anexe o comprovante de devolução do fabricante e informe os detalhes. A solicitação será enviada ao setor financeiro para aprovação e geração do lançamento.
          </DialogDescription>
        </DialogHeader>
        {!ocAtual ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Selecione uma ordem de compra para criar a solicitação.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium">Ordem de Compra</label>
              <Input value={ocAtual.numero_pedido} readOnly className="bg-gray-100" />
            </div>
            <div>
              <label className="block text-xs font-medium">Fornecedor</label>
              <Input value={ocAtual.fornecedor_nome} readOnly className="bg-gray-100" />
            </div>
            <div>
              <label className="block text-xs font-medium">Valor Total</label>
              <Input
                value={Number(ocAtual.valor_total || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                readOnly
                className="bg-gray-100"
              />
            </div>

            {/* Anexo de devolução — obrigatório */}
            <div className="rounded-md border border-dashed p-3 space-y-2">
              <label className="block text-xs font-semibold text-gray-700">
                Comprovante de Devolução do Fabricante <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-muted-foreground">
                A solicitação só poderá ser enviada após o envio do comprovante.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                className="hidden"
                onChange={handleFileUpload}
              />
              {form.anexo_url ? (
                <div className="flex items-center gap-2 text-sm text-green-700 font-medium">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span className="truncate">{anexoNome || "Arquivo enviado"}</span>
                  <button
                    type="button"
                    className="ml-auto text-xs text-muted-foreground underline hover:text-gray-700"
                    onClick={() => { setForm(f => ({ ...f, anexo_url: "" })); setAnexoNome(""); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                  >
                    Trocar
                  </button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                >
                  {uploading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enviando...</>
                  ) : (
                    <><Paperclip className="w-4 h-4 mr-2" />Selecionar arquivo</>
                  )}
                </Button>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium">Detalhe da Devolução</label>
              <Textarea
                placeholder="Descreva o motivo e os detalhes da devolução..."
                value={form.detalhe_devolucao}
                onChange={e => setForm(f => ({ ...f, detalhe_devolucao: e.target.value }))}
                rows={3}
              />
            </div>

            <div>
              <label className="block text-xs font-medium">Categoria sugerida</label>
              <Select value={form.categoria_id} onValueChange={v => setForm(f => ({ ...f, categoria_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-medium">Descrição do lançamento</label>
              <Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
            </div>

            <div>
              <label className="block text-xs font-medium">Data de vencimento sugerida</label>
              <Input
                type="date"
                lang="pt-BR"
                value={form.data_vencimento}
                onChange={e => setForm(f => ({ ...f, data_vencimento: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-xs font-medium">Forma de Pagamento</label>
              <Input
                value={form.forma_pagamento}
                onChange={e => setForm(f => ({ ...f, forma_pagamento: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-xs font-medium">Observação</label>
              <Textarea
                value={form.observacao}
                onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
              />
            </div>

            {error && <div className="text-red-600 text-xs">{error}</div>}

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={mutation.isPending || uploading || !form.anexo_url}
                title={!form.anexo_url ? "Anexe o comprovante de devolução para continuar" : undefined}
              >
                {mutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enviando...</>
                ) : (
                  <><Send className="w-4 h-4 mr-2" />Enviar para Aprovação</>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
