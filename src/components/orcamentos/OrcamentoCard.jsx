import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Calendar, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { buildProductDisplayName } from "@/utils/productReference";

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

  const handleConverterVenda = async () => {
    try {
      const orcamentoFull = await base44.entities.Orcamento.getById(orcamento.id);

      const pdvState = {
        cliente_id: orcamentoFull.cliente_id,
        itens: (orcamentoFull.itens || []).map(item => ({
          ...item,
          preco_sugerido: item.preco_sugerido || item.preco_unitario,
          tipo_entrega: item.tipo_entrega || null,
          is_encomenda: item.is_encomenda || false,
          tipo_montagem_padrao: item.tipo_montagem_padrao || null
        })),
        desconto: parseFloat(orcamentoFull.desconto) || 0,
        pagamentos: orcamentoFull.pagamentos || [],
        observacoes: orcamentoFull.observacoes || `Convertido do orçamento #${orcamentoFull.numero_orcamento}`,
        loja: orcamentoFull.loja || "",
        cidade: orcamentoFull.cidade || "",
        bairro: orcamentoFull.bairro || "",
        endereco: orcamentoFull.endereco || "",
        valor_frete: parseFloat(orcamentoFull.valor_frete) || 0
      };

      sessionStorage.setItem('moveispedroii_pdv_state', JSON.stringify(pdvState));
      // Disparar evento customizado para o PDV detectar (SPA)
      window.dispatchEvent(new Event('orcamento-para-pdv'));
      navigate(createPageUrl("PDV"));
      toast.success("Orçamento transferido para o PDV!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar orçamento para o PDV.");
    }
  };

  let validadeExpirada = false;
  if (orcamento.validade) {
    try {
      // Pega data local de hoje zerando as horas
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      // Interpreta a string ISO (e.g. 2026-03-31 ou 2026-03-31T00:00:00Z)
      // Substituímos os hifens por barras e pegamos só a parte da data 
      // para forçar o JS a usar o fuso local sem subtrair horas
      const dataString = orcamento.validade.split('T')[0].replace(/-/g, '/');
      const dataValidade = new Date(dataString);
      dataValidade.setHours(0, 0, 0, 0);

      // Expira somente se o DIA de hoje for MAIOR que o dia de validade
      validadeExpirada = hoje.getTime() > dataValidade.getTime();
    } catch (e) {
      console.error("Erro processando data de validade:", e);
    }
  }
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
                    <span>{item.quantidade}x {buildProductDisplayName(item.produto_nome, item.modelo_referencia)}</span>
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
              style={{ backgroundColor: '#07593f' }}
              className="flex-1"
            >
              <ArrowRight className="w-4 h-4 mr-1" />
              Converter em Venda
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