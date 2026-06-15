import React, { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

import { base44, supabase } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Check, AlertTriangle, Play, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { obterCampoEstoqueDaLoja } from "@/constants/productConstants";
import InventarioContagem from "./InventarioContagem";
import CargaInicialEstoque from "./CargaInicialEstoque";
import LancamentoManualEstoque from "./LancamentoManualEstoque";

export default function InventarioTab({ user }) {
  const [modoContagem, setModoContagem] = useState(false);
  const [modoCargaInicial, setModoCargaInicial] = useState(false);
  const [modoLancamentoManual, setModoLancamentoManual] = useState(false);
  const [inventarioEditando, setInventarioEditando] = useState(null);

  const queryClient = useQueryClient();

  const { data: inventarios = [], isLoading } = useQuery({
    queryKey: ['inventarios'],
    queryFn: () => base44.entities.Inventario.list('-created_date'),
  });

  const { data: produtos } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => base44.entities.Produto.list(),
  });

  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas'],
    queryFn: () => base44.entities.Loja.list(),
  });

  const aprovarMutation = useMutation({
    mutationFn: async ({ inventario }) => {
      const lojaInventario = lojas.find(l => l.id === inventario.loja_id);
      const targetField = obterCampoEstoqueDaLoja(lojaInventario || inventario.loja_id);

      for (const item of inventario.itens_contados) {
        if (item.diferenca !== 0) {
          const produto = produtos.find(p => p.id === item.produto_id);
          if (produto && targetField) {
            const currentValues = {};

            // Collect all stock fields dynamically based on active stores 
            // plus the target field if it's new
            const activeStoreFields = new Set(lojas.filter(l => l.ativa).map(l => obterCampoEstoqueDaLoja(l)));
            activeStoreFields.add(targetField); // Ensure current target is included

            activeStoreFields.forEach(field => {
              currentValues[field] = produto[field] || 0;
            });

            // Update specific store value
            currentValues[targetField] = item.quantidade_contada;

            // Recalculate total
            const newTotal = Object.values(currentValues).reduce((sum, val) => sum + val, 0);

            await base44.entities.Produto.update(produto.id, {
              [targetField]: item.quantidade_contada,
              quantidade_estoque: newTotal
            });
            try {
              await supabase.from('movimentacoes_estoque').insert({
                produto_id: produto.id,
                evento_tipo: 'inventario',
                modulo_origem: 'estoque',
                quantidade: Math.abs(item.diferenca),
                estoque_antes_local: produto[targetField] || 0,
                estoque_depois_local: item.quantidade_contada,
                estoque_antes_total: produto.quantidade_estoque || 0,
                estoque_depois_total: newTotal,
                referencia_id: inventario.id,
                referencia_numero: inventario.numero_inventario?.toString() || null,
                usuario_nome: user?.email || null,
                loja_origem: lojaInventario?.nome || null,
                organization_id: '00000000-0000-0000-0000-000000000001'
              });
            } catch (auditErr) {
              console.warn('Falha ao registrar movimentação de inventário:', auditErr);
            }
          }
        }
      }

      await base44.entities.Inventario.update(inventario.id, {
        ...inventario,
        status: 'Aprovado',
        aprovado_por: user.email,
        data_aprovacao: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventarios'] });
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      toast.success("Inventário aprovado e estoque atualizado!");
    },
  });

  const handleSalvar = async (data, existingId) => {
    if (existingId) {
      await base44.entities.Inventario.update(existingId, data);
    } else {
      await base44.entities.Inventario.create(data);
    }
    queryClient.invalidateQueries({ queryKey: ['inventarios'] });
    setModoContagem(false);
    setInventarioEditando(null);
  };

  const handleAprovar = (inventario) => {
    if (confirm(`Aprovar inventário #${inventario.numero_inventario}?\n\nOs ajustes de estoque serão aplicados.`)) {
      aprovarMutation.mutate({ inventario });
    }
  };

  const handleContinuar = (inventario) => {
    setInventarioEditando(inventario);
    setModoContagem(true);
  };

  const { can } = useAuth();
  const isAdmin = user?.cargo === 'Administrador';
  const isManager = user?.cargo === 'Gerente';
  const isWarehouse = user?.cargo === 'Estoque';
  const isGerenteGeral = user?.cargo === 'Gerente Geral';
  const canManage = isAdmin || isManager || isWarehouse || isGerenteGeral || can('manage_estoque');
  const canApprove = isAdmin || isManager || isGerenteGeral;


  const statusColors = {
    "Em Andamento": { bg: "#FEF3C7", text: "#92400E", icon: "🔄" },
    "Concluído": { bg: "#DBEAFE", text: "#1E40AF", icon: "📋" },
    "Aprovado": { bg: "#D1FAE5", text: "#065F46", icon: "✅" },
    "Cancelado": { bg: "#FEE2E2", text: "#991B1B", icon: "❌" }
  };

  // --- Carga Inicial mode ---
  if (modoCargaInicial) {
    return (
      <CargaInicialEstoque
        onVoltar={() => setModoCargaInicial(false)}
      />
    );
  }

  if (modoLancamentoManual) {
    return (
      <LancamentoManualEstoque
        onVoltar={() => setModoLancamentoManual(false)}
        user={user}
      />
    );
  }

  // --- Counting mode ---
  if (modoContagem) {
    return (
      <InventarioContagem
        inventarioExistente={inventarioEditando}
        onVoltar={() => {
          setModoContagem(false);
          setInventarioEditando(null);
        }}
        onSalvar={handleSalvar}
        user={user}
      />
    );
  }

  // --- List mode ---
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p style={{ color: '#8B8B8B' }}>
          {inventarios.length} inventário(s) registrado(s)
        </p>
        {canManage && (
          <div className="flex gap-2">
            <Button
              onClick={() => setModoCargaInicial(true)}
              variant="outline"
              className="shadow border-2"
              style={{ borderColor: '#07593f', color: '#07593f' }}
            >
              📦 Carga Inicial de Estoque
            </Button>
            <Button
              onClick={() => setModoLancamentoManual(true)}
              variant="outline"
              className="shadow border-2"
              style={{ borderColor: '#f38a4c', color: '#c75f1a' }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Lançamento Manual
            </Button>
            <Button
              onClick={() => {
                setInventarioEditando(null);
                setModoContagem(true);
              }}
              className="shadow-lg"
              style={{ background: 'linear-gradient(135deg, #f38a4c 0%, #f5a164 100%)' }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Novo Inventário
            </Button>
          </div>
        )}
      </div>

      <Alert style={{ backgroundColor: '#f0f9ff', borderColor: '#3b82f6' }}>
        <AlertDescription>
          <strong>💡 Como funciona:</strong> Selecione a loja/CD, conte os produtos fisicamente
          digitando as quantidades. O sistema calcula divergências automaticamente.
          Após finalizar, um administrador ou gerente deve aprovar para ajustar o estoque.
        </AlertDescription>
      </Alert>

      <Alert style={{ backgroundColor: '#fff7ed', borderColor: '#fdba74' }}>
        <AlertDescription>
          <strong>📝 Lançamento manual:</strong> use esta opção para ajustes rápidos em massa, sem bipagem.
          Cada linha atualiza o estoque direto e fica registrada no histórico.
        </AlertDescription>
      </Alert>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: '#07593f' }} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {inventarios.map((inventario) => (
            <Card key={inventario.id} className="border-0 shadow-md hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <span style={{ color: '#07593f' }}>
                        Inventário #{inventario.numero_inventario}
                      </span>
                      <Badge
                        style={{
                          backgroundColor: statusColors[inventario.status]?.bg,
                          color: statusColors[inventario.status]?.text,
                        }}
                      >
                        {statusColors[inventario.status]?.icon} {inventario.status}
                      </Badge>
                    </CardTitle>
                    <p className="text-sm mt-1" style={{ color: '#8B8B8B' }}>
                      {inventario.loja} • {new Date(inventario.data_inventario).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {inventario.status === 'Em Andamento' && canManage && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleContinuar(inventario)}
                        style={{ borderColor: '#F59E0B', color: '#92400E' }}
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Continuar
                      </Button>
                    )}
                    {inventario.status === 'Concluído' && canApprove && (
                      <Button
                        size="sm"
                        onClick={() => handleAprovar(inventario)}
                        disabled={aprovarMutation.isPending}
                        style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Aprovar e Ajustar Estoque
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-3 gap-6 mb-4">
                  <div>
                    <p className="text-xs font-medium mb-0.5" style={{ color: '#8B8B8B' }}>Responsável</p>
                    <p className="font-semibold text-sm" style={{ color: '#07593f' }}>
                      {inventario.responsavel}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium mb-0.5" style={{ color: '#8B8B8B' }}>Total de Itens</p>
                    <p className="font-semibold text-sm" style={{ color: '#07593f' }}>
                      {inventario.total_itens || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium mb-0.5" style={{ color: '#8B8B8B' }}>Divergências</p>
                    <p className="font-semibold text-sm text-orange-600">
                      {inventario.total_divergencias || 0}
                    </p>
                  </div>
                </div>

                {/* Divergence details (collapsed by default for Concluído/Aprovado) */}
                {inventario.itens_contados && inventario.itens_contados.length > 0 && (
                  <ItensResumo itens={inventario.itens_contados} />
                )}

                {inventario.observacoes && (
                  <div className="mt-3 pt-3 border-t" style={{ borderColor: '#E5E0D8' }}>
                    <p className="text-sm" style={{ color: '#8B8B8B' }}>
                      <strong>Observações:</strong> {inventario.observacoes}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {inventarios.length === 0 && !isLoading && (
        <div className="text-center py-16">
          <p className="text-xl" style={{ color: '#8B8B8B' }}>
            Nenhum inventário registrado
          </p>
          <p className="text-sm mt-2" style={{ color: '#C0C0C0' }}>
            Clique em &quot;Novo Inventário&quot; para começar a contagem
          </p>
        </div>
      )}
    </div>
  );
}

// Sub-component: collapsible divergence list
function ItensResumo({ itens }) {
  const [expandido, setExpandido] = useState(false);
  const divergentes = itens.filter(item => item.diferenca !== 0);

  if (divergentes.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg" style={{ backgroundColor: '#D1FAE5' }}>
        <Check className="w-4 h-4" style={{ color: '#065F46' }} />
        <span style={{ color: '#065F46' }}>Nenhuma divergência — estoque confere ✓</span>
      </div>
    );
  }

  return (
    <div className="border-t pt-3" style={{ borderColor: '#E5E0D8' }}>
      <button
        className="flex items-center gap-2 text-sm font-medium w-full text-left"
        style={{ color: '#07593f' }}
        onClick={() => setExpandido(!expandido)}
      >
        <AlertTriangle className="w-4 h-4 text-orange-500" />
        {divergentes.length} item(ns) com divergência
        {expandido ? <Eye className="w-3 h-3 ml-auto" /> : <Eye className="w-3 h-3 ml-auto opacity-50" />}
      </button>

      {expandido && (
        <div className="space-y-1.5 mt-2">
          {divergentes.map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-2.5 rounded-lg text-sm"
              style={{ backgroundColor: '#FEF3C7' }}
            >
              <div>
                <p className="font-medium" style={{ color: '#07593f' }}>
                  {item.produto_nome}
                </p>
                <p className="text-xs" style={{ color: '#8B8B8B' }}>
                  Sistema: {item.quantidade_sistema} → Contado: {item.quantidade_contada}
                </p>
              </div>
              <span className="font-bold text-orange-600">
                {item.diferenca > 0 ? '+' : ''}{item.diferenca}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}