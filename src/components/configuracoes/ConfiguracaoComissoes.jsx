import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TrendingDown, Save, Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

export default function ConfiguracaoComissoes() {
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState({});

  const { data: taxas = [], isLoading } = useQuery({
    queryKey: ['configuracao_taxas'],
    queryFn: () => base44.entities.ConfiguracaoTaxa.list(),
  });

  const taxasOrdenadas = useMemo(() => {
    return [...taxas].sort((a, b) =>
      a.forma_pagamento.localeCompare(b.forma_pagamento, 'pt-BR')
    );
  }, [taxas]);

  const updateMutation = useMutation({
    mutationFn: ({ id, desconto_vendedor }) =>
      base44.entities.ConfiguracaoTaxa.update(id, { desconto_vendedor }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracao_taxas'] });
      toast.success("Configuração salva com sucesso!");
    },
    onError: (err) => toast.error("Erro ao salvar: " + err.message),
  });

  const handleChange = (taxaId, valor) => {
    setEditando(prev => ({ ...prev, [taxaId]: valor }));
  };

  const handleSave = (taxa) => {
    const novoValor = editando[taxa.id];
    if (novoValor === undefined) return;
    updateMutation.mutate({
      id: taxa.id,
      desconto_vendedor: parseFloat(novoValor) || 0,
    });
    setEditando(prev => {
      const novo = { ...prev };
      delete novo[taxa.id];
      return novo;
    });
  };

  if (isLoading) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#07593f' }} />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ color: '#07593f' }}>
            <TrendingDown className="w-6 h-6" />
            Desconto no Líquido do Vendedor por Forma de Pagamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="mb-6 bg-orange-50 border-orange-200">
            <AlertCircle className="w-4 h-4 text-orange-600" />
            <AlertDescription className="text-orange-800 text-sm space-y-1">
              <p>
                <strong>O sistema não calcula comissão.</strong> Configure aqui o percentual descontado
                do valor da venda para obter o <strong>valor líquido do vendedor</strong> — a base que
                a loja usa para calcular a comissão manualmente.
              </p>
              <p className="text-xs text-orange-700">
                Exemplo: Venda de R$ 1.000 no Crédito 1x com 10% de desconto → Líquido do vendedor = R$ 900
              </p>
            </AlertDescription>
          </Alert>

          {taxas.length === 0 ? (
            <Alert className="bg-yellow-50 border-yellow-200">
              <AlertCircle className="w-4 h-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                Nenhuma forma de pagamento configurada. Acesse a aba <strong>Taxas</strong> para
                configurar as formas de pagamento.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {taxasOrdenadas.map(taxa => {
                const isEditing = taxa.id in editando;
                const valorAtual = isEditing ? editando[taxa.id] : (taxa.desconto_vendedor ?? 0);
                return (
                  <div
                    key={taxa.id}
                    className="flex items-center gap-4 p-4 rounded-lg border-2 hover:shadow-md transition-shadow"
                    style={{ borderColor: '#E5E0D8' }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{taxa.forma_pagamento}</p>
                      {taxa.descricao && (
                        <p className="text-xs text-gray-500 truncate">{taxa.descricao}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={valorAtual}
                        onChange={(e) => handleChange(taxa.id, e.target.value)}
                        className="w-24 text-right"
                        placeholder="0.00"
                      />
                      <span className="text-sm font-semibold text-orange-600">%</span>
                    </div>
                    {isEditing && (
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 shrink-0"
                        onClick={() => handleSave(taxa)}
                        disabled={updateMutation.isPending}
                      >
                        {updateMutation.isPending
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <><Save className="w-3 h-3 mr-1" />Salvar</>
                        }
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Alert className="bg-blue-50 border-blue-200">
        <AlertCircle className="w-4 h-4 text-blue-600" />
        <AlertDescription className="text-blue-800 text-sm">
          <strong>Fórmula:</strong>{" "}
          <code className="bg-white px-1 rounded border border-blue-100">
            Líquido Vendedor = Valor da Venda × (1 − Desconto%)
          </code>
          . Configure as taxas da loja e os acréscimos ao cliente na aba <strong>Taxas</strong>.
        </AlertDescription>
      </Alert>
    </div>
  );
}
