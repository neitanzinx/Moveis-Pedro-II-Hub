
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RotateCcw, Calendar, Clock, CheckCircle2, Package, XCircle, DollarSign, Eye } from "lucide-react";

export default function DevolucaoCard({ devolucao, onEdit }) {
  const statusColors = {
    'Pendente': 'bg-yellow-100 text-yellow-800',
    'Aprovada': 'bg-green-100 text-green-800',
    'Processada': 'bg-blue-100 text-blue-800',
    'Rejeitada': 'bg-red-100 text-red-800'
  };

  const statusIcons = {
    'Pendente': Clock,
    'Aprovada': CheckCircle2,
    'Processada': Package,
    'Rejeitada': XCircle
  };

  const StatusIcon = statusIcons[devolucao.status] || Clock;

  return (
    <Card className="border-0 shadow-md hover:shadow-lg transition-all duration-300">
      <CardHeader className="pb-4"> {/* Added pb-4 for spacing */}
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2" style={{ color: '#07593f' }}>
              <RotateCcw className="w-5 h-5" />
              {devolucao.tipo} - Pedido #{devolucao.numero_pedido}
            </CardTitle>
            <p className="text-sm mt-1" style={{ color: '#8B8B8B' }}>
              {devolucao.cliente_nome}
            </p>
          </div>
          <Badge className={statusColors[devolucao.status]}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {devolucao.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-0 px-6 pb-6"> {/* Adjusted padding */}
        <div className="flex items-center gap-2 text-sm" style={{ color: '#8B8B8B' }}>
          <Calendar className="w-4 h-4" />
          {new Date(devolucao.data_devolucao).toLocaleDateString('pt-BR')}
        </div>

        {devolucao.itens_devolvidos && devolucao.itens_devolvidos.length > 0 && (
          <div>
            <p className="text-sm font-semibold mb-2" style={{ color: '#07593f' }}>
              Itens {devolucao.tipo === 'Devolução' ? 'Devolvidos' : 'Trocados'}:
            </p>
            <div className="space-y-1">
              {devolucao.itens_devolvidos.map((item, index) => (
                <div key={index} className="text-sm flex items-center gap-2" style={{ color: '#8B8B8B' }}>
                  <Package className="w-3 h-3" />
                  {item.produto_nome} - {item.quantidade}x
                  {item.motivo && <span className="text-xs">({item.motivo})</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {devolucao.tipo === 'Troca' && devolucao.itens_troca && devolucao.itens_troca.length > 0 && (
          <div>
            <p className="text-sm font-semibold mb-2" style={{ color: '#07593f' }}>
              Novos Itens:
            </p>
            <div className="space-y-1">
              {devolucao.itens_troca.map((item, index) => (
                <div key={index} className="text-sm flex items-center gap-2" style={{ color: '#8B8B8B' }}>
                  <Package className="w-3 h-3" />
                  {item.produto_nome} - {item.quantidade}x
                </div>
              ))}
            </div>
          </div>
        )}

        {devolucao.valor_devolvido > 0 && (
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" style={{ color: '#f38a4c' }} />
            <span className="font-semibold" style={{ color: '#f38a4c' }}>
              R$ {devolucao.valor_devolvido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        )}

        {devolucao.observacoes && (
          <div className="pt-2 border-t" style={{ borderColor: '#E5E0D8' }}>
            <p className="text-sm" style={{ color: '#8B8B8B' }}>
              <span className="font-medium">Obs:</span> {devolucao.observacoes}
            </p>
          </div>
        )}

        {devolucao.aprovado_por && (
          <div className="text-xs pt-2 border-t" style={{ borderColor: '#E5E0D8', color: '#8B8B8B' }}>
            Aprovado por: {devolucao.aprovado_por}
            {devolucao.data_aprovacao && ` em ${new Date(devolucao.data_aprovacao).toLocaleDateString('pt-BR')}`}
          </div>
        )}

        <Button
          onClick={() => onEdit(devolucao)}
          variant="outline"
          className="w-full"
          size="sm"
        >
          <Eye className="w-4 h-4 mr-2" />
          Ver Detalhes
        </Button>
      </CardContent>
    </Card>
  );
}
