import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  RefreshCw, 
  Calendar, 
  CheckCircle, 
  AlertCircle,
  Clock
} from "lucide-react";

export default function RecorrentesManager({ lancamentos }) {
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.LancamentoFinanceiro.create(data),
  });

  // Calcular próxima data baseada no tipo de recorrência
  const calcularProximaData = (dataBase, tipoRecorrencia) => {
    const data = new Date(dataBase);
    
    switch (tipoRecorrencia) {
      case 'Mensal':
        data.setMonth(data.getMonth() + 1);
        break;
      case 'Trimestral':
        data.setMonth(data.getMonth() + 3);
        break;
      case 'Semestral':
        data.setMonth(data.getMonth() + 6);
        break;
      case 'Anual':
        data.setFullYear(data.getFullYear() + 1);
        break;
      default:
        data.setMonth(data.getMonth() + 1);
    }
    
    return data.toISOString().split('T')[0];
  };

  // Verificar se já existe lançamento para o mês/período
  const jaExisteLancamento = (lancamentoOriginal, dataVerificar, todosLancamentos) => {
    return todosLancamentos.some(l => 
      l.descricao === lancamentoOriginal.descricao &&
      l.valor === lancamentoOriginal.valor &&
      l.categoria_id === lancamentoOriginal.categoria_id &&
      l.data_lancamento === dataVerificar &&
      l.id !== lancamentoOriginal.id
    );
  };

  const gerarLancamentosRecorrentes = async () => {
    setProcessing(true);
    setResult(null);

    try {
      const hoje = new Date();
      const recorrentes = lancamentos.filter(l => l.recorrente === true);
      
      let gerados = 0;
      let ignorados = 0;
      const detalhes = [];

      for (const lanc of recorrentes) {
        const dataLancamento = new Date(lanc.data_lancamento);
        let proximaData = calcularProximaData(lanc.data_lancamento, lanc.recorrencia_tipo);
        let dataProxima = new Date(proximaData);

        // Gerar todos os lançamentos pendentes até hoje
        while (dataProxima <= hoje) {
          // Verificar se já existe
          if (!jaExisteLancamento(lanc, proximaData, lancamentos)) {
            // Criar novo lançamento
            await createMutation.mutateAsync({
              tipo: lanc.tipo,
              categoria_id: lanc.categoria_id,
              categoria_nome: lanc.categoria_nome,
              descricao: lanc.descricao,
              valor: lanc.valor,
              data_lancamento: proximaData,
              forma_pagamento: lanc.forma_pagamento,
              status: 'Pendente', // Novos lançamentos recorrentes começam como pendentes
              observacao: `Gerado automaticamente de lançamento recorrente (${lanc.recorrencia_tipo})`,
              recorrente: false, // O novo lançamento não é recorrente
              anexo_url: lanc.anexo_url
            });

            gerados++;
            detalhes.push({
              descricao: lanc.descricao,
              data: proximaData,
              valor: lanc.valor
            });
          } else {
            ignorados++;
          }

          // Calcular próxima data
          proximaData = calcularProximaData(proximaData, lanc.recorrencia_tipo);
          dataProxima = new Date(proximaData);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['lancamentos-financeiros'] });
      
      setResult({
        success: true,
        gerados,
        ignorados,
        total: recorrentes.length,
        detalhes
      });

    } catch (error) {
      console.error('Erro ao gerar lançamentos:', error);
      setResult({
        success: false,
        error: error.message
      });
    } finally {
      setProcessing(false);
    }
  };

  // Auto-executar ao montar o componente
  useEffect(() => {
    const autoGenerate = async () => {
      // Verificar se há lançamentos recorrentes
      const recorrentes = lancamentos.filter(l => l.recorrente === true);
      if (recorrentes.length > 0) {
        // Pequeno delay para não executar imediatamente
        await new Promise(resolve => setTimeout(resolve, 1000));
        gerarLancamentosRecorrentes();
      }
    };

    autoGenerate();
  }, []); // Apenas na montagem

  const recorrentes = lancamentos.filter(l => l.recorrente === true);

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Lançamentos Recorrentes
          </CardTitle>
          <Badge variant="outline" className="text-blue-600 border-blue-600">
            {recorrentes.length} ativo(s)
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 p-4 rounded-lg" style={{ backgroundColor: '#f0f9ff' }}>
          <Clock className="w-5 h-5 mt-0.5" style={{ color: '#07593f' }} />
          <div className="flex-1">
            <h4 className="font-semibold mb-1" style={{ color: '#07593f' }}>
              Geração Automática
            </h4>
            <p className="text-sm" style={{ color: '#8B8B8B' }}>
              Os lançamentos recorrentes são verificados e gerados automaticamente quando você acessa esta página.
              Novos lançamentos são criados com status "Pendente" para revisão.
            </p>
          </div>
        </div>

        {result && (
          result.success ? (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <AlertDescription className="ml-2">
                <div className="space-y-2">
                  <p className="font-semibold text-green-800">
                    Processamento concluído!
                  </p>
                  <div className="text-sm text-green-700">
                    <p>• {result.gerados} lançamento(s) gerado(s)</p>
                    <p>• {result.ignorados} já existente(s)</p>
                    <p>• {result.total} recorrente(s) verificado(s)</p>
                  </div>
                  {result.detalhes.length > 0 && (
                    <div className="mt-3 space-y-1">
                      <p className="font-semibold text-green-800">Lançamentos gerados:</p>
                      {result.detalhes.slice(0, 5).map((det, idx) => (
                        <p key={idx} className="text-sm text-green-700">
                          • {det.descricao} - {new Date(det.data).toLocaleDateString('pt-BR')} - R$ {det.valor.toFixed(2)}
                        </p>
                      ))}
                      {result.detalhes.length > 5 && (
                        <p className="text-sm text-green-700">
                          ... e mais {result.detalhes.length - 5} lançamento(s)
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="bg-red-50 border-red-200">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <AlertDescription className="ml-2 text-red-800">
                Erro ao processar lançamentos: {result.error}
              </AlertDescription>
            </Alert>
          )
        )}

        {recorrentes.length > 0 ? (
          <div className="space-y-3">
            <h4 className="font-semibold" style={{ color: '#07593f' }}>
              Lançamentos Recorrentes Ativos:
            </h4>
            {recorrentes.map((lanc) => (
              <div 
                key={lanc.id}
                className="flex items-center justify-between p-3 rounded-lg border"
                style={{ borderColor: '#E5E0D8' }}
              >
                <div className="flex-1">
                  <p className="font-semibold" style={{ color: '#07593f' }}>
                    {lanc.descricao}
                  </p>
                  <div className="flex items-center gap-4 text-sm" style={{ color: '#8B8B8B' }}>
                    <span>R$ {lanc.valor?.toFixed(2)}</span>
                    <Badge variant="outline">{lanc.recorrencia_tipo}</Badge>
                    <span>Desde {new Date(lanc.data_lancamento).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
                <Badge className={lanc.tipo === 'Entrada' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                  {lanc.tipo}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8" style={{ color: '#8B8B8B' }}>
            <Calendar className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>Nenhum lançamento recorrente cadastrado</p>
            <p className="text-sm mt-1">
              Marque um lançamento como recorrente ao criá-lo para que seja gerado automaticamente
            </p>
          </div>
        )}

        <div className="flex justify-end pt-4 border-t" style={{ borderColor: '#E5E0D8' }}>
          <Button
            onClick={gerarLancamentosRecorrentes}
            disabled={processing || recorrentes.length === 0}
            variant="outline"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${processing ? 'animate-spin' : ''}`} />
            {processing ? 'Processando...' : 'Gerar Manualmente'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}