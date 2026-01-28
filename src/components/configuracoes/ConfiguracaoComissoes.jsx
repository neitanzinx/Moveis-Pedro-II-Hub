import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Percent, Save, Loader2, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const formasPagamento = [
  { value: "Dinheiro", label: "💵 Dinheiro", color: "#059669" },
  { value: "Crédito", label: "💳 Crédito", color: "#3b82f6" },
  { value: "Débito", label: "💳 Débito", color: "#8b5cf6" },
  { value: "Pix", label: "📱 Pix", color: "#06b6d4" },
  { value: "AFESP", label: "🏦 AFESP", color: "#f59e0b" },
  { value: "Multicrédito", label: "🎫 Multicrédito", color: "#ec4899" }
];

export default function ConfiguracaoComissoes() {
  const queryClient = useQueryClient();
  const [mensagemSucesso, setMensagemSucesso] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingFormData, setPendingFormData] = useState(null);

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

    const promises = formasPagamento.map(forma => {
      const porcentagem = pendingFormData.get(forma.value);
      if (porcentagem) {
        return createOrUpdateMutation.mutateAsync({
          forma: forma.value,
          porcentagem
        });
      }
    });

    await Promise.all(promises);
    setShowConfirmModal(false);
    setPendingFormData(null);
    setMensagemSucesso(true);
    setTimeout(() => setMensagemSucesso(false), 3000);
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
                    {forma.label.split(' ')[0]}
                  </div>
                  <div className="flex-1">
                    <Label htmlFor={forma.value} className="text-base font-semibold">
                      {forma.label.split(' ').slice(1).join(' ')}
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
                <strong>💡 Como funciona:</strong>
              </p>
              <ul className="text-sm space-y-1" style={{ color: '#8B8B8B' }}>
                <li>• A comissão é calculada sobre o <strong>valor da entrada</strong> paga pelo cliente</li>
                <li>• Cada forma de pagamento pode ter uma porcentagem diferente</li>
                <li>• Exemplo: Venda de R$ 1.000 com entrada de R$ 500 via Crédito (3%) = R$ 15 de comissão</li>
                <li>• Se houver pagamento restante na entrega, será calculado separadamente</li>
              </ul>
            </div>

            <div className="flex justify-end mt-6">
              <Button
                type="submit"
                disabled={createOrUpdateMutation.isPending}
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

      {/* Modal de Confirmação */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              Confirmar Alteração de Comissões
            </DialogTitle>
            <DialogDescription className="pt-4 space-y-3">
              <p>
                Você está prestes a alterar as porcentagens de comissão.
              </p>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-amber-800 font-medium">
                  ⚠️ As novas taxas serão aplicadas apenas para vendas registradas a partir de agora.
                </p>
                <p className="text-amber-700 text-sm mt-1">
                  Vendas anteriores manterão as comissões calculadas no momento original.
                </p>
              </div>
              <p className="text-sm text-gray-500">
                Data/hora da alteração: {new Date().toLocaleString('pt-BR')}
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowConfirmModal(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmSave}
              disabled={createOrUpdateMutation.isPending}
              style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
            >
              {createOrUpdateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Confirmar e Salvar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}