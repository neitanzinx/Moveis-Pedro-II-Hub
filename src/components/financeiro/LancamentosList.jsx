import React from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  CreditCard,
  FileText,
  Trash2,
  Eye,
  DollarSign
} from "lucide-react";

export default function LancamentosList({ lancamentos, categorias, isLoading }) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.LancamentoFinanceiro.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lancamentos-financeiros'] });
    }
  });

  const handleDelete = (id) => {
    if (confirm('Tem certeza que deseja excluir este lançamento?')) {
      deleteMutation.mutate(id);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      'Pago': 'bg-green-100 text-green-800',
      'Pendente': 'bg-yellow-100 text-yellow-800',
      'Cancelado': 'bg-red-100 text-red-800'
    };
    
    return (
      <Badge className={styles[status] || ''}>
        {status}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: '#07593f' }} />
      </div>
    );
  }

  if (lancamentos.length === 0) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="p-12 text-center">
          <DollarSign className="w-16 h-16 mx-auto mb-4 opacity-20" style={{ color: '#07593f' }} />
          <p className="text-xl" style={{ color: '#8B8B8B' }}>
            Nenhum lançamento encontrado
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {lancamentos.map((lanc) => (
        <Card key={lanc.id} className="border-0 shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-4 flex-1">
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ 
                    backgroundColor: lanc.tipo === 'Entrada' ? '#dcfce7' : '#fee2e2'
                  }}
                >
                  {lanc.tipo === 'Entrada' ? (
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  ) : (
                    <TrendingDown className="w-6 h-6 text-red-600" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-bold text-lg" style={{ color: '#07593f' }}>
                      {lanc.descricao}
                    </h3>
                    {getStatusBadge(lanc.status)}
                    {lanc.recorrente && (
                      <Badge variant="outline" className="text-blue-600 border-blue-600">
                        Recorrente
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-4 text-sm" style={{ color: '#8B8B8B' }}>
                    <div className="flex items-center gap-1">
                      <FileText className="w-4 h-4" />
                      {lanc.categoria_nome || 'Sem categoria'}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {lanc.data_lancamento ? new Date(lanc.data_lancamento).toLocaleDateString('pt-BR') : '-'}
                    </div>
                    <div className="flex items-center gap-1">
                      <CreditCard className="w-4 h-4" />
                      {lanc.forma_pagamento}
                    </div>
                  </div>
                  
                  {lanc.observacao && (
                    <p className="text-sm mt-2" style={{ color: '#8B8B8B' }}>
                      {lanc.observacao}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col items-end gap-3">
                <p 
                  className="text-2xl font-bold"
                  style={{ color: lanc.tipo === 'Entrada' ? '#059669' : '#dc2626' }}
                >
                  {lanc.tipo === 'Entrada' ? '+' : '-'} R$ {lanc.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                
                <div className="flex gap-2">
                  {lanc.anexo_url && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(lanc.anexo_url, '_blank')}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Anexo
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(lanc.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}