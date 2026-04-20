import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, CreditCard } from 'lucide-react';
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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const atuais = settings?.compras_aprovacao_automatica;
    if (Array.isArray(atuais)) {
      setFormasSelecionadas(atuais);
    }
  }, [settings?.compras_aprovacao_automatica]);

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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-green-700" />
            <CardTitle>Aprovacao Automatica por Forma de Pagamento</CardTitle>
          </div>
          <CardDescription>
            Selecione quais formas de pagamento NAO precisam passar pela aprovacao manual do master.
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
