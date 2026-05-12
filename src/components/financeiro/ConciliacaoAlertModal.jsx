import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

const fmt = (v) =>
  `R$ ${Math.abs(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const fmtDate = (d) => {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
};

/**
 * Modal de alerta de conciliação inteligente.
 * Exibe lançamentos existentes com valor similar ao que está sendo criado,
 * pedindo confirmação se o usuário realmente quer criar um novo lançamento.
 *
 * Props:
 *   open: boolean
 *   duplicatas: LancamentoFinanceiro[]
 *   novoValor: number
 *   novoDescricao: string
 *   onConfirm: () => void   — prosseguir mesmo assim
 *   onCancel: () => void    — cancelar criação
 */
export default function ConciliacaoAlertModal({
  open,
  duplicatas = [],
  novoValor,
  novoDescricao,
  onConfirm,
  onCancel,
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="w-5 h-5" />
            Possível duplicidade detectada
          </DialogTitle>
          <DialogDescription>
            Foram encontrados lançamentos existentes com valor semelhante a{" "}
            <strong>{fmt(novoValor)}</strong> ({novoDescricao}). Verifique abaixo se
            este lançamento já foi registrado pelo setor de Compras ou Financeiro antes de
            prosseguir.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border divide-y overflow-hidden mb-2">
          {duplicatas.map((l) => (
            <div key={l.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {l.descricao || "—"}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {l.categoria_nome || "Sem categoria"} ·{" "}
                  {l.forma_pagamento || "—"} · vence {fmtDate(l.data_vencimento)}
                </p>
                {l.fornecedor_nome && (
                  <p className="text-xs text-gray-400">Fornecedor: {l.fornecedor_nome}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className="text-sm font-bold text-red-600">{fmt(l.valor)}</span>
                <Badge
                  className={
                    l.status === "Pago"
                      ? "bg-green-100 text-green-800 text-[10px]"
                      : l.status === "Cancelado" || l.status === "Cancelada"
                      ? "bg-gray-100 text-gray-600 text-[10px]"
                      : "bg-yellow-100 text-yellow-800 text-[10px]"
                  }
                >
                  {l.status || "Pendente"}
                </Badge>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          Se este boleto ou compra já foi registrado pelo setor de Compras (ao receber a OC),
          criar um novo lançamento aqui resultará em <strong>contabilização dupla</strong> da
          despesa. Prossiga apenas se tiver certeza de que são lançamentos diferentes.
        </p>

        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={onCancel}>
            Cancelar — não criar
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
          >
            Criar mesmo assim
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
