import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, FileText, Calendar, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const statusColors = {
  "Pendente": { bg: "#FEF3C7", text: "#92400E", border: "#FCD34D" },
  "Aprovado": { bg: "#DBEAFE", text: "#1E40AF", border: "#93C5FD" },
  "Rejeitado": { bg: "#FEE2E2", text: "#991B1B", border: "#FCA5A5" },
  "Convertido": { bg: "#D1FAE5", text: "#065F46", border: "#6EE7B7" },
  "Expirado": { bg: "#F3F4F6", text: "#6B7280", border: "#D1D5DB" }
};

export default function OrcamentoCard({ orcamento, onEdit, onDelete }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createVendaMutation = useMutation({
    mutationFn: async (orcamentoData) => {
      const numeroPedido = Math.floor(10000 + Math.random() * 90000).toString();
      
      const vendaData = {
        numero_pedido: numeroPedido,
        orcamento_id: orcamentoData.id,
        data_venda: new Date().toISOString().split('T')[0],
        loja: orcamentoData.loja,
        cliente_id: orcamentoData.cliente_id,
        cliente_nome: orcamentoData.cliente_nome,
        cliente_telefone: orcamentoData.cliente_telefone,
        itens: orcamentoData.itens,
        valor_total: orcamentoData.valor_total,
        forma_pagamento: "Dinheiro",
        tipo_parcelamento: "À vista",
        numero_parcelas: 1,
        prazo_entrega: "15 dias",
        status: "Pendente Pagamento",
        desconto: orcamentoData.desconto,
        observacoes: `Convertido do orçamento #${orcamentoData.numero_orcamento}`,
      };

      const venda = await base44.entities.Venda.create(vendaData);
      
      await base44.entities.Orcamento.update(orcamentoData.id, {
        ...orcamentoData,
        status: 'Convertido',
        venda_id: venda.id
      });

      // Reservar estoque
      for (const item of orcamentoData.itens) {
        const produto = await base44.entities.Produto.list().then(produtos => 
          produtos.find(p => p.id === item.produto_id)
        );
        if (produto) {
          await base44.entities.Produto.update(produto.id, {
            ...produto,
            quantidade_reservada: (produto.quantidade_reservada || 0) + item.quantidade
          });
        }
      }

      return venda;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
      queryClient.invalidateQueries({ queryKey: ['vendas'] });
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      navigate(createPageUrl("Vendas"));
    },
  });

  const handleConverterVenda = () => {
    if (confirm('Deseja converter este orçamento em venda? O estoque será reservado.')) {
      createVendaMutation.mutate(orcamento);
    }
  };

  const validadeExpirada = new Date(orcamento.validade) < new Date();

  return (
    <Card className="hover:shadow-xl transition-all duration-300 border-0">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-bold text-xl" style={{ color: '#07593f' }}>
                Orçamento #{orcamento.numero_orcamento}
              </h3>
              <Badge 
                style={{
                  backgroundColor: statusColors[orcamento.status]?.bg,
                  color: statusColors[orcamento.status]?.text,
                  borderColor: statusColors[orcamento.status]?.border,
                }}
                className="border"
              >
                {orcamento.status}
              </Badge>
              {validadeExpirada && orcamento.status === 'Pendente' && (
                <Badge variant="outline" className="text-red-600 border-red-600">
                  Expirado
                </Badge>
              )}
            </div>
            <p className="text-sm" style={{ color: '#8B8B8B' }}>
              {orcamento.cliente_nome} • {orcamento.loja}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm mb-1" style={{ color: '#8B8B8B' }}>Valor Total</p>
            <p className="text-2xl font-bold" style={{ color: '#07593f' }}>
              R$ {orcamento.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm" style={{ color: '#8B8B8B' }}>
            <Calendar className="w-4 h-4" />
            <span>Criado em {format(new Date(orcamento.data_orcamento), "dd/MM/yyyy")}</span>
          </div>
          <div className="flex items-center gap-2 text-sm" style={{ color: '#8B8B8B' }}>
            <Calendar className="w-4 h-4" />
            <span>Válido até {format(new Date(orcamento.validade), "dd/MM/yyyy")}</span>
          </div>
          {orcamento.itens && orcamento.itens.length > 0 && (
            <div className="pt-2 border-t" style={{ borderColor: '#E5E0D8' }}>
              <p className="text-sm font-medium mb-2" style={{ color: '#07593f' }}>
                Itens ({orcamento.itens.length}):
              </p>
              <div className="space-y-1">
                {orcamento.itens.slice(0, 3).map((item, index) => (
                  <div key={index} className="text-sm flex justify-between" style={{ color: '#8B8B8B' }}>
                    <span>{item.quantidade}x {item.produto_nome}</span>
                    <span>R$ {item.subtotal?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
                {orcamento.itens.length > 3 && (
                  <p className="text-xs" style={{ color: '#8B8B8B' }}>
                    +{orcamento.itens.length - 3} item(ns)
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {orcamento.status === 'Pendente' && !validadeExpirada && (
            <Button
              size="sm"
              onClick={handleConverterVenda}
              disabled={createVendaMutation.isPending}
              style={{ backgroundColor: '#07593f' }}
              className="flex-1"
            >
              <ArrowRight className="w-4 h-4 mr-1" />
              {createVendaMutation.isPending ? 'Convertendo...' : 'Converter em Venda'}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(orcamento)}
          >
            <Pencil className="w-4 h-4 mr-1" />
            Editar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(orcamento.id)}
            className="text-red-600 hover:text-red-700 hover:border-red-600"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}