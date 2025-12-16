import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertCircle, Calendar } from "lucide-react";
import { format } from "date-fns";

const statusColors = {
  "Pendente": { bg: "#FEF3C7", text: "#92400E" },
  "Paga": { bg: "#D1FAE5", text: "#065F46" },
  "Atrasada": { bg: "#FEE2E2", text: "#991B1B" },
  "Cancelada": { bg: "#F3F4F6", text: "#6B7280" }
};

export default function ParcelasTable({ parcelas, onMarcarPaga, isLoading }) {
  const hoje = new Date().toISOString().split('T')[0];
  
  // Atualizar status de parcelas atrasadas
  const parcelasAtualizadas = parcelas.map(p => ({
    ...p,
    status: p.status === 'Pendente' && p.data_vencimento < hoje ? 'Atrasada' : p.status
  }));

  const parcelasPendentes = parcelasAtualizadas.filter(
    p => p.status === 'Pendente' || p.status === 'Atrasada'
  ).sort((a, b) => new Date(a.data_vencimento) - new Date(b.data_vencimento));

  if (isLoading) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: '#07593f' }} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle style={{ color: '#07593f' }}>
          Parcelas a Receber ({parcelasPendentes.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {parcelasPendentes.length === 0 ? (
          <div className="text-center py-8" style={{ color: '#8B8B8B' }}>
            Nenhuma parcela pendente
          </div>
        ) : (
          <div className="space-y-3">
            {parcelasPendentes.map((parcela) => (
              <div
                key={parcela.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:shadow-md transition-shadow"
                style={{ borderColor: '#E5E0D8' }}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-bold" style={{ color: '#07593f' }}>
                      Pedido #{parcela.numero_pedido}
                    </span>
                    <span className="text-sm" style={{ color: '#8B8B8B' }}>
                      Parcela {parcela.numero_parcela}
                    </span>
                    <Badge 
                      style={{
                        backgroundColor: statusColors[parcela.status]?.bg,
                        color: statusColors[parcela.status]?.text,
                      }}
                    >
                      {parcela.status}
                    </Badge>
                  </div>
                  <p className="text-sm mb-1" style={{ color: '#8B8B8B' }}>
                    {parcela.cliente_nome}
                  </p>
                  <div className="flex items-center gap-2 text-sm" style={{ color: '#8B8B8B' }}>
                    <Calendar className="w-4 h-4" />
                    <span>
                      Vencimento: {format(new Date(parcela.data_vencimento), "dd/MM/yyyy")}
                    </span>
                    {parcela.status === 'Atrasada' && (
                      <AlertCircle className="w-4 h-4 text-red-600 ml-2" />
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-2xl font-bold" style={{ color: '#07593f' }}>
                      R$ {parcela.valor_parcela?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => onMarcarPaga(parcela)}
                    style={{ backgroundColor: '#07593f' }}
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Marcar Paga
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}