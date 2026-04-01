import React, { useEffect, useMemo, useState } from 'react';
import { base44, supabase } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Package, History, Warehouse, AlertTriangle, CircleDollarSign, Plus, Minus } from 'lucide-react';
import { toast } from 'sonner';
import { useLojas } from '@/hooks/useLojas';
import { useAuth } from '@/hooks/useAuth';
import { obterCampoEstoqueDaLoja, calcularEstoqueTotal } from '@/constants/productConstants';
import ProdutoHistoricoTab from '@/components/produtos/ProdutoHistoricoTab';

const LOJA_CD_FALLBACK = {
  id: 'cd-fallback',
  nome: 'Depósito / CD',
};

export default function ProdutoConferenciaModal({
  isOpen,
  onClose,
  produto,
  onSave,
}) {
  const queryClient = useQueryClient();
  const { data: lojas = [] } = useLojas();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('conferencia');
  const [saving, setSaving] = useState(false);
  const [manualLojaId, setManualLojaId] = useState('');
  const [manualDelta, setManualDelta] = useState('');

  const [estoquePorLoja, setEstoquePorLoja] = useState({});
  const [estoqueMinimo, setEstoqueMinimo] = useState(0);
  const [estoqueIdeal, setEstoqueIdeal] = useState(0);

  const lojasComCd = useMemo(() => {
    const base = Array.isArray(lojas) ? [...lojas] : [];
    const hasCd = base.some((loja) => obterCampoEstoqueDaLoja(loja) === 'estoque_cd');
    if (!hasCd) {
      base.unshift(LOJA_CD_FALLBACK);
    }

    return base.sort((a, b) => {
      const aIsCd = obterCampoEstoqueDaLoja(a) === 'estoque_cd';
      const bIsCd = obterCampoEstoqueDaLoja(b) === 'estoque_cd';
      if (aIsCd && !bIsCd) return -1;
      if (!aIsCd && bIsCd) return 1;
      return (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' });
    });
  }, [lojas]);

  useEffect(() => {
    if (!produto || !isOpen) return;

    const next = {};
    lojasComCd.forEach((loja) => {
      const campo = obterCampoEstoqueDaLoja(loja);
      next[campo] = Number(produto[campo] || 0);
    });

    setEstoquePorLoja(next);
    setEstoqueMinimo(Number(produto.estoque_minimo || 0));
    setEstoqueIdeal(Number(produto.estoque_ideal || 0));
    const cdLoja = lojasComCd.find((loja) => obterCampoEstoqueDaLoja(loja) === 'estoque_cd');
    setManualLojaId(cdLoja?.id || lojasComCd[0]?.id || '');
    setManualDelta('');
    setActiveTab('conferencia');
  }, [produto, isOpen, lojasComCd]);

  const totalCalculado = useMemo(() => {
    const pseudoProduto = { ...produto, ...estoquePorLoja };
    return calcularEstoqueTotal(pseudoProduto, lojasComCd);
  }, [produto, estoquePorLoja, lojasComCd]);

  const estoqueCd = Number(estoquePorLoja.estoque_cd || 0);

  const isLowStock = totalCalculado <= estoqueMinimo;

  const atualizarLoja = (campo, valor) => {
    const qtd = Number.isNaN(Number(valor)) ? 0 : Number(valor);
    setEstoquePorLoja((prev) => ({
      ...prev,
      [campo]: Math.max(0, qtd),
    }));
  };

  const aplicarAjusteRapido = (sinal) => {
    if (!manualLojaId) {
      toast.warning('Selecione a loja para ajuste manual.');
      return;
    }

    const delta = Number(manualDelta);
    if (!delta || delta <= 0) {
      toast.warning('Informe uma quantidade valida para ajuste rapido.');
      return;
    }

    const loja = lojasComCd.find((l) => l.id === manualLojaId);
    if (!loja) return;

    const campo = obterCampoEstoqueDaLoja(loja);
    const atual = Number(estoquePorLoja[campo] || 0);
    const proximo = sinal === 'entrada' ? atual + delta : Math.max(0, atual - delta);

    setEstoquePorLoja((prev) => ({ ...prev, [campo]: proximo }));
    setManualDelta('');
  };

  const handleSalvar = async () => {
    if (!produto?.id) return;

    setSaving(true);
    try {
      const estoqueAnteriorTotal = Number(produto.quantidade_estoque || 0);
      const deltaTotal = totalCalculado - estoqueAnteriorTotal;

      const payload = {
        ...estoquePorLoja,
        quantidade_estoque: totalCalculado,
        estoque_minimo: Math.max(0, Number(estoqueMinimo || 0)),
        estoque_ideal: Math.max(0, Number(estoqueIdeal || 0)),
      };

      await onSave(payload);

      const alteracoesPorLoja = lojasComCd
        .map((loja) => {
          const campo = obterCampoEstoqueDaLoja(loja);
          const anterior = Number(produto[campo] || 0);
          const atual = Number(estoquePorLoja[campo] || 0);
          if (anterior === atual) return null;

          return {
            loja_id: loja.id,
            loja_nome: loja.nome,
            campo,
            anterior,
            atual,
            delta: atual - anterior,
          };
        })
        .filter(Boolean);

      try {
        const { error: auditError } = await supabase.from('movimentacoes_estoque').insert({
          produto_id: produto.id,
          evento_tipo: 'conferencia_estoque',
          modulo_origem: 'estoque',
          referencia_tipo: 'conferencia',
          quantidade: deltaTotal,
          estoque_antes_total: estoqueAnteriorTotal,
          estoque_depois_total: totalCalculado,
          estoque_antes_local: null,
          estoque_depois_local: null,
          usuario_id: user?.id || null,
          usuario_nome: user?.full_name || user?.nome || 'Operador de Estoque',
          usuario_cargo: user?.cargo || null,
          observacao: alteracoesPorLoja.length > 0
            ? `Conferencia com ajuste em ${alteracoesPorLoja.length} loja(s)`
            : 'Conferencia sem alteracao de quantidade',
          payload_json: {
            tipo: 'conferencia_estoque',
            alteracoes_por_loja: alteracoesPorLoja,
            estoque_cd: Number(estoquePorLoja.estoque_cd || 0),
            estoque_minimo: Math.max(0, Number(estoqueMinimo || 0)),
            estoque_ideal: Math.max(0, Number(estoqueIdeal || 0)),
          },
        });

        if (auditError) {
          throw auditError;
        }
      } catch (auditError) {
        console.warn('Falha ao registrar historico de conferencia:', auditError);
        toast.warning('Estoque salvo, mas houve falha ao registrar no historico.');
      }

      queryClient.invalidateQueries({ queryKey: ['movimentacoes-estoque', produto.id] });

      toast.success('Conferencia de estoque salva com sucesso.');
      onClose?.();
    } catch (error) {
      toast.error(`Erro ao salvar: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (!produto) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-green-700" />
            Conferencia de Mercadoria
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="conferencia">Conferencia</TabsTrigger>
            <TabsTrigger value="historico">Historico</TabsTrigger>
          </TabsList>

          <TabsContent value="conferencia" className="space-y-4 pt-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="md:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Dados do Produto</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-gray-500">Nome</Label>
                      <Input value={produto.nome || ''} readOnly className="bg-gray-50" />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Fornecedor</Label>
                      <Input value={produto.fornecedor_nome || ''} readOnly className="bg-gray-50" />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Categoria</Label>
                      <Input value={produto.categoria || ''} readOnly className="bg-gray-50" />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Codigo de Barras</Label>
                      <Input value={produto.codigo_barras || ''} readOnly className="bg-gray-50" />
                    </div>
                  </div>

                  <Alert className="border-green-200 bg-green-50">
                    <CircleDollarSign className="h-4 w-4 text-green-700" />
                    <AlertDescription className="text-green-800">
                      Preco de venda: <strong>R$ {(produto.preco_venda || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                      {' '} (somente visualizacao para equipe de estoque)
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Resumo de Estoque</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">CD</span>
                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">{estoqueCd} un.</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Total atual</span>
                    <Badge variant={isLowStock ? 'destructive' : 'secondary'}>{totalCalculado} un.</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Estoque minimo</span>
                    <Input
                      type="number"
                      value={estoqueMinimo}
                      onChange={(e) => setEstoqueMinimo(Math.max(0, Number(e.target.value || 0)))}
                      className="w-20 h-8"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Estoque ideal</span>
                    <Input
                      type="number"
                      value={estoqueIdeal}
                      onChange={(e) => setEstoqueIdeal(Math.max(0, Number(e.target.value || 0)))}
                      className="w-20 h-8"
                    />
                  </div>

                  {isLowStock && (
                    <Alert className="border-yellow-200 bg-yellow-50">
                      <AlertTriangle className="h-4 w-4 text-yellow-700" />
                      <AlertDescription className="text-yellow-800 text-xs">
                        Produto em nivel de atencao de estoque.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Warehouse className="w-4 h-4 text-blue-700" />
                  Ajuste Rapido por Loja
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_auto_auto] gap-2 items-end">
                  <div>
                    <Label>Loja</Label>
                    <Select value={manualLojaId} onValueChange={setManualLojaId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {lojasComCd.map((loja) => (
                          <SelectItem key={loja.id} value={loja.id}>{loja.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Qtd</Label>
                    <Input
                      type="number"
                      min={1}
                      value={manualDelta}
                      onChange={(e) => setManualDelta(e.target.value)}
                    />
                  </div>
                  <Button type="button" variant="outline" onClick={() => aplicarAjusteRapido('entrada')}>
                    <Plus className="w-4 h-4 mr-1" /> Entrada
                  </Button>
                  <Button type="button" variant="outline" onClick={() => aplicarAjusteRapido('saida')}>
                    <Minus className="w-4 h-4 mr-1" /> Saida
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {lojasComCd.map((loja) => {
                    const campo = obterCampoEstoqueDaLoja(loja);
                    const isCd = campo === 'estoque_cd';
                    return (
                      <div key={loja.id} className={`border rounded-lg p-3 ${isCd ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'}`}>
                        <Label className="text-xs text-gray-600 flex items-center gap-1">
                          {loja.nome}
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          value={estoquePorLoja[campo] ?? 0}
                          onChange={(e) => atualizarLoja(campo, e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="historico" className="pt-3">
            <ProdutoHistoricoTab produtoId={produto.id} />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={saving} className="bg-green-700 hover:bg-green-800">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Salvar Conferencia
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
