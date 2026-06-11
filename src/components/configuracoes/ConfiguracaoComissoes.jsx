import React, { useState, useMemo, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingDown, Save, Loader2, AlertCircle, Settings, Target, ShieldAlert, Award, Store, User } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/lib/supabase";

const isMissingDescontoVendedorColumnError = (err) => {
  const message = String(err?.message || '').toLowerCase();
  return message.includes('desconto_vendedor') && message.includes('schema cache');
};

export default function ConfiguracaoComissoes() {
  const queryClient = useQueryClient();
  const { settings, refreshTenant } = useTenant();
  const [editando, setEditando] = useState({});

  // Configurações do modelo de cálculo
  const [modeloCalculo, setModeloCalculo] = useState('regra_venda');
  const [faixaReferencia, setFaixaReferencia] = useState('vendedor');
  const [pisoLoja, setPisoLoja] = useState(0);
  const [salvandoSettings, setSalvandoSettings] = useState(false);

  useEffect(() => {
    if (settings) {
      setModeloCalculo(settings.comissao_modelo_calculo || 'regra_venda');
      setFaixaReferencia(settings.comissao_faixa_referencia || 'vendedor');
      setPisoLoja(settings.comissao_meta_minima_loja_percentual || 0);
    }
  }, [settings]);

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
    onError: (err) => {
      if (isMissingDescontoVendedorColumnError(err)) {
        toast.error("Seu banco ainda não possui a coluna desconto_vendedor em configuracao_taxas. Aplique a migração pendente para habilitar esta configuração.");
        return;
      }
      toast.error("Erro ao salvar: " + err.message);
    },
  });

  const handleSaveSettings = async () => {
    setSalvandoSettings(true);
    try {
      const tenantId = settings?.organization_id || "00000000-0000-0000-0000-000000000001";
      const { error } = await supabase
        .from('organization_settings')
        .update({
          comissao_modelo_calculo: modeloCalculo,
          comissao_faixa_referencia: faixaReferencia,
          comissao_meta_minima_loja_percentual: Number(pisoLoja) || 0,
        })
        .eq('organization_id', tenantId);

      if (error) throw error;
      await refreshTenant();
      toast.success("Configurações gerais de comissão atualizadas com sucesso!");
    } catch (err) {
      toast.error("Erro ao salvar configurações gerais: " + err.message);
    } finally {
      setSalvandoSettings(false);
    }
  };

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
    <div className="space-y-6">
      {/* Card 1: Configuração do Modelo Geral */}
      <Card className="border-0 shadow-lg overflow-hidden">
        <CardHeader className="bg-gray-50/50 border-b">
          <CardTitle className="flex items-center gap-2" style={{ color: '#07593f' }}>
            <Settings className="w-5 h-5" />
            Parâmetros de Cálculo de Comissão da Loja
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="space-y-4">
            <Label className="text-base font-semibold text-gray-800">Selecione o Modelo de Comissão Ativo</Label>
            
            <div className="grid md:grid-cols-2 gap-4">
              {/* Modelo por Venda */}
              <div
                onClick={() => setModeloCalculo('regra_venda')}
                className={`p-5 rounded-xl border-2 cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                  modeloCalculo === 'regra_venda'
                    ? 'border-green-600 bg-green-50/30'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Award className={`w-5 h-5 ${modeloCalculo === 'regra_venda' ? 'text-green-700' : 'text-gray-500'}`} />
                    <h3 className="font-bold text-gray-800">Por Venda (Regras Individuais)</h3>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    A comissão é acumulada a cada venda efetuada pelo vendedor, aplicando o percentual correspondente à forma de pagamento ou regra de comissão específica.
                  </p>
                </div>
                {modeloCalculo === 'regra_venda' && (
                  <span className="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full w-max mt-4">Ativo</span>
                )}
              </div>

              {/* Modelo por Faixas de Meta */}
              <div
                onClick={() => setModeloCalculo('faixas_meta')}
                className={`p-5 rounded-xl border-2 cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                  modeloCalculo === 'faixas_meta'
                    ? 'border-green-600 bg-green-50/30'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Target className={`w-5 h-5 ${modeloCalculo === 'faixas_meta' ? 'text-green-700' : 'text-gray-500'}`} />
                    <h3 className="font-bold text-gray-800">Por Faixas de Meta Mensal</h3>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    A comissão é calculada mensalmente com base no faturamento acumulado do vendedor vs. sua meta, aplicando percentuais progressivos escalonados (tiers).
                  </p>
                </div>
                {modeloCalculo === 'faixas_meta' && (
                  <span className="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full w-max mt-4">Ativo</span>
                )}
              </div>
            </div>
          </div>

          {/* Opções de Faixa de Meta (somente se selecionado) */}
          {modeloCalculo === 'faixas_meta' && (
            <div className="p-5 rounded-xl bg-gray-50/50 border-2 border-dashed space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-gray-700">Referência para o Atingimento da Meta</Label>
                <div className="grid md:grid-cols-3 gap-3">
                  {/* Vendedor */}
                  <div
                    onClick={() => setFaixaReferencia('vendedor')}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all flex items-center gap-3 bg-white ${
                      faixaReferencia === 'vendedor'
                        ? 'border-green-600 bg-green-50/10'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <User className="w-4 h-4 text-gray-500" />
                    <div>
                      <h4 className="text-xs font-bold text-gray-800">Vendedor</h4>
                      <p className="text-[10px] text-gray-400">Meta e faturamento individual</p>
                    </div>
                  </div>

                  {/* Loja */}
                  <div
                    onClick={() => setFaixaReferencia('loja')}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all flex items-center gap-3 bg-white ${
                      faixaReferencia === 'loja'
                        ? 'border-green-600 bg-green-50/10'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Store className="w-4 h-4 text-gray-500" />
                    <div>
                      <h4 className="text-xs font-bold text-gray-800">Apenas Loja</h4>
                      <p className="text-[10px] text-gray-400">Faturamento da filial vs meta da filial</p>
                    </div>
                  </div>

                  {/* Misto */}
                  <div
                    onClick={() => setFaixaReferencia('ambos')}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all flex items-center gap-3 bg-white ${
                      faixaReferencia === 'ambos'
                        ? 'border-green-600 bg-green-50/10'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <ShieldAlert className="w-4 h-4 text-gray-500" />
                    <div>
                      <h4 className="text-xs font-bold text-gray-800">Misto (Com Piso)</h4>
                      <p className="text-[10px] text-gray-400">Meta individual + piso da filial</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Piso da Loja (se Ambos) */}
              {faixaReferencia === 'ambos' && (
                <div className="space-y-2 max-w-md animate-in fade-in duration-200">
                  <Label htmlFor="piso-loja-input" className="text-xs text-gray-700 font-semibold">
                    Piso de Faturamento da Loja (% Mínimo Atingido)
                  </Label>
                  <div className="relative w-36">
                    <Input
                      id="piso-loja-input"
                      type="number"
                      min="0"
                      max="100"
                      step="5"
                      value={pisoLoja}
                      onChange={(e) => setPisoLoja(e.target.value)}
                      className="pr-8 text-right font-medium"
                    />
                    <span className="absolute right-3 top-2.5 text-gray-400 text-sm font-semibold pointer-events-none">%</span>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-normal">
                    O vendedor só qualifica para a comissão por faixas se a sua filial atingir pelo menos este percentual da meta geral da loja no mês. Caso contrário, aplica-se a comissão por regras normais.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end pt-2 border-t">
            <Button
              onClick={handleSaveSettings}
              disabled={salvandoSettings}
              className="bg-green-700 hover:bg-green-800 text-white font-semibold flex items-center gap-2"
              style={{ backgroundColor: '#07593f' }}
            >
              {salvandoSettings ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Salvar Parâmetros Gerais
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Card 2: Configuração de Desconto de Forma de Pagamento */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ color: '#07593f' }}>
            <TrendingDown className="w-6 h-6" />
            Desconto no Líquido do Vendedor por Forma de Pagamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="mb-6 bg-orange-50/60 border-orange-200">
            <AlertCircle className="w-4 h-4 text-orange-600" />
            <AlertDescription className="text-orange-800 text-sm space-y-1">
              <p>
                {modeloCalculo === 'regra_venda' ? (
                  <>
                    <strong>O sistema calcula comissões automaticamente.</strong> O percentual de desconto abaixo é subtraído do valor da venda para obter o <strong>valor líquido do vendedor</strong> — que é a base usada para o cálculo de regras.
                  </>
                ) : (
                  <>
                    <strong>Cálculo mensal por faixas ativo.</strong> O percentual de desconto configurado abaixo só afetará o cálculo se a faixa configurada para o vendedor utilizar a base de cálculo <strong>Líquido</strong>.
                  </>
                )}
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
                    className="flex items-center gap-4 p-4 rounded-lg border-2 hover:shadow-md transition-all duration-200"
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
                        className="bg-green-600 hover:bg-green-700 shrink-0 text-white"
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
          <strong>Fórmula do Líquido:</strong>{" "}
          <code className="bg-white px-1 rounded border border-blue-100">
            Líquido Vendedor = Valor da Venda × (1 − Desconto%)
          </code>
          . Configure as taxas da loja e os acréscimos ao cliente na aba <strong>Taxas</strong>.
        </AlertDescription>
      </Alert>
    </div>
  );
}
