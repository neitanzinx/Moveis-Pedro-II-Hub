
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck, MapPin, User } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const statusColors = {
  "Pendente": { bg: "#FEF3C7", text: "#92400E", border: "#FCD34D" },
  "Em Rota": { bg: "#DBEAFE", text: "#1E40AF", border: "#93C5FD" },
  "Entregue": { bg: "#D1FAE5", text: "#065F46", border: "#6EE7B7" },
  "Cancelada": { bg: "#FEE2E2", text: "#991B1B", border: "#FCA5A5" }
};

export default function EntregasHoje({ entregas }) {
  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg" style={{ backgroundColor: '#07593f', opacity: 0.1 }}>
              <Truck className="w-5 h-5" style={{ color: '#07593f' }} />
            </div>
            <CardTitle style={{ color: '#07593f' }}>Entregas de Hoje</CardTitle>
          </div>
          <Badge variant="outline" style={{ borderColor: '#07593f', color: '#07593f' }}>
            {entregas.length} pendentes
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {entregas.length === 0 ? (
          <div className="text-center py-12">
            <Truck className="w-16 h-16 mx-auto mb-4 opacity-20" style={{ color: '#07593f' }} />
            <p style={{ color: '#8B8B8B' }}>Nenhuma entrega programada para hoje</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entregas.map((entrega) => (
              <Link
                key={entrega.id}
                to={createPageUrl("Entregas")}
                className="block p-4 rounded-xl hover:shadow-md transition-all border"
                style={{ borderColor: '#E5E0D8', backgroundColor: 'white' }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold mb-1" style={{ color: '#07593f' }}>
                      Pedido #{entrega.numero_pedido}
                    </p>
                    <p className="text-sm" style={{ color: '#8B8B8B' }}>{entrega.cliente_nome}</p>
                  </div>
                  <Badge 
                    style={{
                      backgroundColor: statusColors[entrega.status]?.bg,
                      color: statusColors[entrega.status]?.text,
                      borderColor: statusColors[entrega.status]?.border,
                    }}
                    className="border"
                  >
                    {entrega.status}
                  </Badge>
                </div>
                <div className="space-y-2 text-sm">
                  {entrega.endereco_entrega && (
                    <div className="flex items-start gap-2" style={{ color: '#8B8B8B' }}>
                      <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span className="line-clamp-1">{entrega.endereco_entrega}</span>
                    </div>
                  )}
                  {entrega.responsavel && (
                    <div className="flex items-center gap-2" style={{ color: '#8B8B8B' }}>
                      <User className="w-4 h-4" />
                      <span>{entrega.responsavel}</span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
