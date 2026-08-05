import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Loader2, CreditCard, ShieldCheck, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/contexts/TenantContext';

const FORMAS_PAGAMENTO = [
  { value: 'a_vista', label: 'A Vista' },
  { value: 'pix', label: 'PIX' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'parcelado', label: 'Parcelado' },
  { value: 'cartao_debito', label: 'Cartao Debito' },
  { value: 'cartao_credito', label: 'Cartao Credito' },
  { value: 'transferencia', label: 'Transferencia Bancaria' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'a_definir', label: 'A Definir' },
];

export default function ConfiguracaoComprasPagamento() {
  const { organization, settings, refreshTenant } = useTenant();
  const [formasSelecionadas, setFormasSelecionadas] = useState(['a_vista']);
  const [conferenciaCaixaEnabled, setConferenciaCaixaEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingConferencia, setSavingConferencia] = useState(false);

  useEffect(() => {
    const atuais = settings?.compras_aprovacao_automatica;
    if (Array.isArray(atuais)) {
      setFormasSelecionadas(atuais);
    }
    setConferenciaCaixaEnabled(settings?.conferencia_caixa_enabled === true);
  }, [settings?.compras_aprovacao_automatica, settings?.conferencia_caixa_enabled]);

  const toggleForma = (forma) => {
    setFormasSelecionadas((prev) => {
      if (prev.includes(forma)) {
        return prev.filter((f) => f !== forma);
      }
      return [...prev, forma];
    });
  };

  const handleSalvar = async () => {
    try {
      setSaving(true);

      const orgId = organization?.id || '00000000-0000-0000-0000-000000000001';
      const payload = {
        organization_id: orgId,
        compras_aprovacao_automatica: formasSelecionadas,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('organization_settings')
        .upsert(payload, { onConflict: 'organization_id' });

      if (error) throw error;

      await refreshTenant();
      toast.success('Configuracoes de aprovacao automatica atualizadas');
    } catch (error) {
      console.error('Erro ao salvar configuracao de compras:', error);
      toast.error(`Erro ao salvar: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSalvarConferencia = async (novoValor) => {
    try {
      setSavingConferencia(true);
      const orgId = organization?.id || '00000000-0000-0000-0000-000000000001';

      const { error } = await supabase
        .from('organization_settings')
        .upsert(
          {
            organization_id: orgId,
            conferencia_caixa_enabled: novoValor,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'organization_id' }
        );

      if (error) throw error;

      setConferenciaCaixaEnabled(novoValor);
      await refreshTenant();
      toast.success(
        novoValor
          ? 'Conferência de Caixa ativada! As vendas agora aguardarão aprovação antes de prosseguir.'
          : 'Conferência de Caixa desativada. Vendas seguirão o fluxo normal.'
      );
    } catch (error) {
      console.error('Erro ao salvar conferência de caixa:', error);
      toast.error(`Erro ao salvar: ${error.message}`);
      // Reverter o switch visualmente em caso de erro
      setConferenciaCaixaEnabled(!novoValor);
    } finally {
      setSavingConferencia(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Conferência de Caixa ── */}
      <Card className="border-2 border-amber-100">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-600" />
            <CardTitle>Conferência de Caixa</CardTitle>
          </div>
          <CardDescription>
            Quando ativado, toda venda precisará ser conferida pelo gerente antes de gerar entrega,
            montagem e lançamentos financeiros. Permite detectar divergências de pagamento logo após
            a venda.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl border bg-amber-50/50">
            <div className="space-y-1">
              <p className="font-semibold text-sm text-gray-800">
                {conferenciaCaixaEnabled ? '✅ Módulo Ativo' : '⬜ Módulo Inativo'}
              </p>
              <p className="text-xs text-gray-500 max-w-sm">
                {conferenciaCaixaEnabled
                  ? 'Vendas ficam bloqueadas aguardando aprovação do caixa/gerente. Vendas "Pagar na Entrega" são isentas.'
                  : 'As vendas seguem o fluxo normal (entrega e lançamentos criados automaticamente).'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {savingConferencia && <Loader2 className="w-4 h-4 animate-spin text-amber-600" />}
              <Switch
                id="conferencia-caixa-toggle"
                checked={conferenciaCaixaEnabled}
                onCheckedChange={(val) => handleSalvarConferencia(val)}
                disabled={savingConferencia}
                className="data-[state=checked]:bg-amber-500"
              />
            </div>
          </div>

          {conferenciaCaixaEnabled && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                <strong>Atenção:</strong> Com este módulo ativo, o gerente verá as vendas pendentes
                no <strong>Painel Gerencial → Conferência de Caixa</strong>. Vendas não conferidas
                ficam editáveis pelo vendedor na listagem de vendas.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Aprovação Automática de Compras ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-green-700" />
            <CardTitle>Aprovação Automática de Vendas por Forma de Pagamento</CardTitle>
          </div>
          <CardDescription>
            Selecione quais formas de pagamento NÃO precisam passar pela aprovação manual do gerente/master nas vendas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            {FORMAS_PAGAMENTO.map((forma) => (
              <div key={forma.value} className="flex items-center space-x-2 rounded-md border p-3">
                <Checkbox
                  id={`forma-${forma.value}`}
                  checked={formasSelecionadas.includes(forma.value)}
                  onCheckedChange={() => toggleForma(forma.value)}
                />
                <Label htmlFor={`forma-${forma.value}`} className="cursor-pointer text-sm font-medium">
                  {forma.label}
                </Label>
              </div>
            ))}
          </div>

          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Formas desmarcadas exigirao envio para aprovacao de pagamento.
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSalvar} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Salvar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
