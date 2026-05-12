import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Percent, Save, Loader2, AlertTriangle, CalendarClock, CheckCircle2, XCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/lib/supabase";
import { recalcularComissoesDesdaData } from "@/services/comissaoService";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const formasPagamento = [
  { value: "Dinheiro", label: "Dinheiro", color: "#059669" },
  { value: "Crédito", label: "Crédito", color: "#3b82f6" },
  { value: "Débito", label: "Débito", color: "#8b5cf6" },
  { value: "Pix", label: "Pix", color: "#06b6d4" },
  { value: "AFESP", label: "AFESP", color: "#f59e0b" },
  { value: "Multicrédito", label: "Multicrédito", color: "#ec4899" }
];

export default function ConfiguracaoComissoes() {
  const { organization, settings, refreshTenant } = useTenant();
  const queryClient = useQueryClient();
  const [mensagemSucesso, setMensagemSucesso] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingFormData, setPendingFormData] = useState(null);
  const [comissaoSobre, setComissaoSobre] = useState("bruto");
  const [prioridadeEstrategia, setPrioridadeEstrategia] = useState("mais_especifica");
  const [recalculoPolitica, setRecalculoPolitica] = useState("nao_recalcular");
  const [dataRecalculoRetroativo, setDataRecalculoRetroativo] = useState("");

  // Estado do fluxo unificado: salvar + recalcular
  const [isSaving, setIsSaving] = useState(false);
  const [recalcProgress, setRecalcProgress] = useState(null);
  const [recalcResultado, setRecalcResultado] = useState(null);

  const organizationId = organization?.id || "00000000-0000-0000-0000-000000000001";

  const saveSettingsWithFallback = async (payload) => {
    const unsupportedColumns = new Set();

    for (let i = 0; i < 4; i += 1) {
      const safePayload = Object.fromEntries(
        Object.entries(payload).filter(([key]) => !unsupportedColumns.has(key))
      );

      const { error } = await supabase
        .from("organization_settings")
        .upsert(safePayload, { onConflict: "organization_id" });

      if (!error) {
        return;
      }

      const message = error.message || "";
      const missingColumnMatch = message.match(/Could not find the '([^']+)' column/i);
      if (!missingColumnMatch?.[1]) {
        throw error;
      }

      unsupportedColumns.add(missingColumnMatch[1]);
    }

    throw new Error("Nao foi possivel persistir as configuracoes de comissao.");
  };

  React.useEffect(() => {
    setComissaoSobre(settings?.comissao_sobre || "bruto");
    setPrioridadeEstrategia(settings?.comissao_prioridade_estrategia || "mais_especifica");
    setRecalculoPolitica(settings?.comissao_recalculo_politica || "nao_recalcular");
  }, [settings]);

  const { data: configuracoes = [], isLoading } = useQuery({
    queryKey: ['configuracoes-comissao'],
    queryFn: () => base44.entities.ConfiguracaoComissao.list(),
  });

  const createOrUpdateMutation = useMutation({
    mutationFn: async ({ forma, porcentagem }) => {
      const existente = configuracoes.find(c => c.forma_pagamento === forma);

      if (existente) {
        return base44.entities.ConfiguracaoComissao.update(existente.id, {
          ...existente,
          porcentagem: parseFloat(porcentagem),
          updated_at: new Date().toISOString()
        });
      } else {
        return base44.entities.ConfiguracaoComissao.create({
          forma_pagamento: forma,
          porcentagem: parseFloat(porcentagem),
          descricao: `Comissão para ${forma}`,
          updated_at: new Date().toISOString()
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracoes-comissao'] });
    },
  });

  const handleFormSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    setPendingFormData(formData);
    setShowConfirmModal(true);
  };

  const handleConfirmSave = async () => {
    if (!pendingFormData) return;
    setIsSaving(true);
    setRecalcProgress(null);
    setRecalcResultado(null);

    try {
      const promises = formasPagamento.map(forma => {
        const porcentagem = pendingFormData.get(forma.value);
        if (porcentagem) {
          return createOrUpdateMutation.mutateAsync({ forma: forma.value, porcentagem });
        }
      });
      await Promise.all(promises);

      await saveSettingsWithFallback({
        organization_id: organizationId,
        comissao_sobre: comissaoSobre,
        comissao_prioridade_estrategia: prioridadeEstrategia,
        comissao_recalculo_politica: recalculoPolitica,
        updated_at: new Date().toISOString(),
      });
      await refreshTenant();

      if (recalculoPolitica === 'recalcular_a_partir_de' || recalculoPolitica === 'recalcular_tudo') {
        const dataInicio = recalculoPolitica === 'recalcular_tudo' ? '2000-01-01' : dataRecalculoRetroativo;
        setRecalcProgress({ total: 0, processed: 0, updated: 0, failed: 0 });
        const resultado = await recalcularComissoesDesdaData({
          dataInicio,
          organizationId,
          onProgress: (progress) => setRecalcProgress({ ...progress }),
        });
        setRecalcResultado(resultado);
        queryClient.invalidateQueries({ queryKey: ['vendas'] });
      } else {
        setShowConfirmModal(false);
        setPendingFormData(null);
        setMensagemSucesso(true);
        setTimeout(() => setMensagemSucesso(false), 3000);
      }
    } catch (err) {
      setRecalcResultado({ error: err?.message || 'Erro desconhecido' });
    } finally {
      setIsSaving(false);
    }
  };

  const getValorAtual = (forma) => {
    const config = configuracoes.find(c => c.forma_pagamento === forma);
    return config?.porcentagem || 0;
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
    <>
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ color: '#07593f' }}>
            <Percent className="w-6 h-6" />
            Configuração de Comissões por Forma de Pagamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          {mensagemSucesso && (
            <Alert className="mb-6 bg-green-50 border-green-200">
              <AlertDescription className="text-green-800">
                ✅ Configurações salvas com sucesso!
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleFormSubmit}>
            <div className="mb-6 grid md:grid-cols-3 gap-4">
              <div>
                <Label>Base de cálculo da comissão</Label>
                <Select value={comissaoSobre} onValueChange={setComissaoSobre}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bruto">Valor bruto da venda</SelectItem>
                    <SelectItem value="liquido">Valor liquido (desconto aplicado)</SelectItem>
                    <SelectItem value="recebido">Somente valor recebido</SelectItem>
                    <SelectItem value="entrada">Somente entrada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Prioridade entre regras</Label>
                <Select value={prioridadeEstrategia} onValueChange={setPrioridadeEstrategia}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mais_especifica">Mais específica vence</SelectItem>
                    <SelectItem value="maior_percentual">Maior percentual vence</SelectItem>
                    <SelectItem value="somar_regras">Somar regras compatíveis</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Política de recálculo</Label>
                <Select value={recalculoPolitica} onValueChange={setRecalculoPolitica}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nao_recalcular">Apenas vendas futuras</SelectItem>
                    <SelectItem value="recalcular_a_partir_de">Recalcular a partir de uma data</SelectItem>
                    <SelectItem value="recalcular_tudo">Recalcular todo o histórico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {recalculoPolitica === 'recalcular_a_partir_de' && (
              <div className="mb-6 p-4 rounded-lg border border-amber-200 bg-amber-50">
                <div className="flex items-start gap-3">
                  <CalendarClock className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-800 mb-3">
                      Ao salvar, as comissões de todas as vendas a partir da data abaixo serão recalculadas com as novas regras.
                    </p>
                    <div className="max-w-xs">
                      <Label htmlFor="dataRecalculoRetroativo" className="text-xs text-amber-700">Data de início do recálculo</Label>
                      <Input
                        id="dataRecalculoRetroativo"
                        type="date" lang="pt-BR"
                        className="mt-1"
                        value={dataRecalculoRetroativo}
                        onChange={(e) => setDataRecalculoRetroativo(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {recalculoPolitica === 'recalcular_tudo' && (
              <div className="mb-6 p-4 rounded-lg border border-amber-200 bg-amber-50 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm font-semibold text-amber-800">
                  Ao salvar, todas as vendas registradas no sistema terão suas comissões recalculadas com as novas regras.
                </p>
              </div>
            )}

            <div className="space-y-4">
              {formasPagamento.map((forma) => (
                <div
                  key={forma.value}
                  className="flex items-center gap-4 p-4 rounded-lg border-2 hover:shadow-md transition-shadow"
                  style={{ borderColor: '#E5E0D8' }}
                >
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
                    style={{ backgroundColor: `${forma.color}20` }}
                  >
                    <Percent className="w-5 h-5" style={{ color: forma.color }} />
                  </div>
                  <div className="flex-1">
                    <Label htmlFor={forma.value} className="text-base font-semibold">
                      {forma.label}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      id={forma.value}
                      name={forma.value}
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      defaultValue={getValorAtual(forma.value)}
                      className="w-24 text-right"
                      placeholder="0.00"
                    />
                    <span className="text-lg font-semibold" style={{ color: forma.color }}>%</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 rounded-lg" style={{ backgroundColor: '#f0f9ff' }}>
              <p className="text-sm mb-2" style={{ color: '#07593f' }}>
                <strong>Como funciona:</strong>
              </p>
              <ul className="text-sm space-y-1" style={{ color: '#8B8B8B' }}>
                <li>• A base de cálculo é definida acima (bruto, liquido, recebido ou entrada)</li>
                <li>• Cada forma de pagamento pode ter uma porcentagem diferente</li>
                <li>• Quando houver múltiplos pagamentos, o motor aplica as regras por forma de pagamento</li>
                <li>• A estratégia de prioridade e recálculo é definida pelo usuário administrador</li>
              </ul>
            </div>

            <div className="flex justify-end mt-6">
              <Button
                type="submit"
                disabled={createOrUpdateMutation.isPending || (recalculoPolitica === 'recalcular_a_partir_de' && !dataRecalculoRetroativo)}
                className="shadow-lg"
                style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
              >
                <Save className="w-4 h-4 mr-2" />
                {createOrUpdateMutation.isPending ? 'Salvando...' : 'Salvar Configurações'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Modal de Confirmação: Salvar + Recálculo */}
      <Dialog
        open={showConfirmModal}
        onOpenChange={(open) => {
          if (!isSaving) {
            if (!open) {
              setRecalcProgress(null);
              setRecalcResultado(null);
              setPendingFormData(null);
            }
            setShowConfirmModal(open);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              Confirmar Alteração de Comissões
            </DialogTitle>
            <DialogDescription className="pt-4 space-y-3">

              {/* Fase 1: confirmação */}
              {!isSaving && !recalcResultado && (
                <>
                  <p>Você está prestes a salvar as configurações de comissão.</p>
                  {recalculoPolitica === 'nao_recalcular' && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-amber-800 font-medium text-sm">
                        As novas taxas serão aplicadas apenas para vendas registradas a partir de agora. O histórico não será alterado.
                      </p>
                    </div>
                  )}
                  {recalculoPolitica === 'recalcular_a_partir_de' && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-amber-800 font-medium text-sm">
                        As configurações serão salvas e as comissões de todas as vendas a partir de{" "}
                        <strong>{dataRecalculoRetroativo ? new Date(dataRecalculoRetroativo + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</strong>{" "}
                        serão recalculadas com as novas regras.
                      </p>
                    </div>
                  )}
                  {recalculoPolitica === 'recalcular_tudo' && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-amber-800 font-medium text-sm">
                        As configurações serão salvas e <strong>todo o histórico de comissões</strong> será recalculado com as novas regras.
                      </p>
                    </div>
                  )}
                  <p className="text-xs text-gray-500">
                    Data/hora da alteração: {new Date().toLocaleString('pt-BR')}
                  </p>
                </>
              )}

              {/* Fase 2: processando */}
              {isSaving && (
                <div className="space-y-3">
                  {!recalcProgress ? (
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#07593f' }} />
                      Salvando configurações...
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-gray-600">Recalculando comissões...</p>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{
                            width: recalcProgress.total > 0
                              ? `${Math.round((recalcProgress.processed / recalcProgress.total) * 100)}%`
                              : '0%',
                            backgroundColor: '#07593f',
                          }}
                        />
                      </div>
                      <p className="text-xs text-gray-500">
                        {recalcProgress.processed} / {recalcProgress.total} vendas processadas
                        &nbsp;({recalcProgress.updated} atualizadas
                        {recalcProgress.failed > 0 && `, ${recalcProgress.failed} com erro`})
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* Fase 3: resultado */}
              {!isSaving && recalcResultado && (
                recalcResultado.error ? (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-800 font-medium text-sm">Erro: {recalcResultado.error}</p>
                  </div>
                ) : (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-green-800 font-medium text-sm">Configurações salvas e recálculo concluído.</p>
                    <p className="text-green-700 text-sm mt-1">
                      {recalcResultado.updated} venda(s) atualizada(s) de {recalcResultado.total} encontrada(s).
                      {recalcResultado.failed > 0 && ` ${recalcResultado.failed} venda(s) com erro.`}
                    </p>
                  </div>
                )
              )}

            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            {!isSaving && !recalcResultado && (
              <>
                <Button variant="outline" onClick={() => setShowConfirmModal(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmSave}
                  style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
                >
                  Confirmar e Salvar
                </Button>
              </>
            )}
            {!isSaving && recalcResultado && (
              <Button
                onClick={() => {
                  setShowConfirmModal(false);
                  setRecalcProgress(null);
                  setRecalcResultado(null);
                  setPendingFormData(null);
                  if (!recalcResultado.error) {
                    setMensagemSucesso(true);
                    setTimeout(() => setMensagemSucesso(false), 3000);
                  }
                }}
                style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
              >
                Fechar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
