import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CheckCircle, Search, Calendar, User, MapPin } from "lucide-react";
import { format } from "date-fns";

export default function EntregasConcluidas({ entregas, vendas }) {
  const [busca, setBusca] = useState("");

  // Filtrar
  const entregasFiltradas = entregas.filter(e => 
    e.numero_pedido?.toLowerCase().includes(busca.toLowerCase()) ||
    e.cliente_nome?.toLowerCase().includes(busca.toLowerCase())
  );

  // Ordenar por data de realização (mais recente primeiro)
  const entregasOrdenadas = [...entregasFiltradas].sort((a, b) => {
    const dataA = new Date(a.data_realizada || a.updated_date);
    const dataB = new Date(b.data_realizada || b.updated_date);
    return dataB - dataA;
  });

  if (entregas.length === 0) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="text-center py-16">
          <CheckCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-xl font-semibold text-gray-500 mb-2">Nenhuma entrega concluída</p>
          <p className="text-gray-400">As entregas finalizadas aparecerão aqui</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Buscar por pedido ou cliente..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Stats */}
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <CheckCircle className="w-8 h-8 text-green-600" />
          <div>
            <p className="text-2xl font-bold text-green-700 dark:text-green-400">{entregas.length}</p>
            <p className="text-sm text-green-600 dark:text-green-500">entregas realizadas</p>
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {entregasOrdenadas.map(entrega => {
          const venda = vendas.find(v => v.id === entrega.venda_id);
          
          return (
            <Card key={entrega.id} className="border shadow-sm bg-white dark:bg-neutral-900">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 dark:text-white">
                          #{entrega.numero_pedido}
                        </span>
                        <Badge className="bg-green-100 text-green-700 text-xs">
                          Entregue
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {entrega.cliente_nome}
                        </span>
                        {entrega.data_realizada && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(entrega.data_realizada), 'dd/MM/yyyy')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {venda && (
                    <div className="text-right">
                      <p className="font-semibold text-green-700 dark:text-green-400">
                        R$ {venda.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}