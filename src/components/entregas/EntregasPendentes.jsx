import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Printer, Calendar, MapPin, User, Phone, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import AgendarEntregaModal from "./AgendarEntregaModal";

export default function EntregasPendentes({ entregas, vendas, clientes }) {
  const [selecionados, setSelecionados] = useState([]);
  const [imprimindo, setImprimindo] = useState(false);
  const [modalAgendar, setModalAgendar] = useState({ open: false, entrega: null, multiplos: [] });
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Entrega.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['entregas'] })
  });

  // Separar impressos e não impressos
  const naoImpressos = entregas.filter(e => !e.impresso);

  const toggleSelecao = (id) => {
    setSelecionados(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selecionarTodos = () => {
    const ids = entregas.map(e => e.id);
    const allSelected = ids.every(id => selecionados.includes(id));
    setSelecionados(allSelected ? [] : ids);
  };

  const gerarFichaInternaHTML = (entrega, venda, cliente) => {
    const enderecoCompleto = cliente?.endereco ? 
      `${cliente.endereco}, ${cliente.numero || 's/n'}${cliente.complemento ? ` - ${cliente.complemento}` : ''}, ${cliente.bairro || ''}, ${cliente.cidade || ''} - ${cliente.estado || ''}` : 
      entrega.endereco_entrega || 'SEM ENDEREÇO';

    const itensHTML = venda?.itens?.map(item => 
      `<tr><td style="padding:8px;border-bottom:1px solid #ddd;">${item.produto_nome}</td><td style="padding:8px;border-bottom:1px solid #ddd;text-align:center;font-weight:bold;">${item.quantidade}</td></tr>`
    ).join('') || '<tr><td colspan="2" style="padding:8px;color:#999;">Sem itens</td></tr>';

    return `
      <div class="ficha" style="page-break-after: always; padding: 20px; font-family: Arial, sans-serif; font-size: 12px; border: 2px solid #333; margin-bottom: 20px; min-height: 90vh; display: flex; flex-direction: column;">
        <!-- Cabeçalho -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #07593f; padding-bottom: 10px; margin-bottom: 15px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/690ce4cb64e20af6b4a46b6f/3474ff954_undefined-Imgur.png" alt="Logo" style="width: 40px; height: auto;" />
            <div>
              <div style="font-size: 14px; font-weight: bold; color: #07593f;">Móveis Pedro II</div>
              <div style="font-size: 9px; color: #666;">FICHA DE EXPEDIÇÃO</div>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 24px; font-weight: bold; color: #07593f;">#${entrega.numero_pedido}</div>
            <div style="font-size: 10px; color: #666;">Limite: ${entrega.data_limite ? format(new Date(entrega.data_limite + 'T12:00:00'), 'dd/MM/yyyy') : '-'}</div>
          </div>
        </div>

        <!-- Informações do Cliente -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
          <div style="background: #f5f5f5; padding: 12px; border-radius: 6px;">
            <div style="font-size: 10px; color: #666; text-transform: uppercase; margin-bottom: 5px;">Cliente</div>
            <div style="font-size: 14px; font-weight: bold; color: #333;">${cliente?.nome_completo || entrega.cliente_nome}</div>
            <div style="font-size: 11px; color: #666; margin-top: 4px;">Tel: ${cliente?.telefone || entrega.cliente_telefone || '-'}</div>
          </div>
          <div style="background: #f5f5f5; padding: 12px; border-radius: 6px;">
            <div style="font-size: 10px; color: #666; text-transform: uppercase; margin-bottom: 5px;">Endereço de Entrega</div>
            <div style="font-size: 12px; font-weight: bold; color: #333;">${enderecoCompleto}</div>
          </div>
        </div>

        <!-- Tabela de Produtos -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
          <thead>
            <tr style="background: #333; color: white;">
              <th style="padding: 8px; text-align: left;">Produto</th>
              <th style="padding: 8px; text-align: center; width: 80px;">Qtd</th>
            </tr>
          </thead>
          <tbody>${itensHTML}</tbody>
        </table>

        <!-- Alerta de Pagamento -->
        ${venda?.pagamento_na_entrega ? `
          <div style="border: 4px dashed #dc2626; background: #fef2f2; padding: 20px; border-radius: 10px; text-align: center; margin-bottom: 15px;">
            <div style="color: #991b1b; font-size: 16px; font-weight: bold; margin-bottom: 10px;">⚠️ RECEBER NA ENTREGA</div>
            <div style="font-size: 28px; font-weight: bold; color: #dc2626;">R$ ${venda.valor_pagamento_entrega?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <div style="color: #991b1b; margin-top: 12px; font-size: 18px; padding: 8px 16px; background: #fee2e2; border-radius: 6px; display: inline-block;">
              Receber em: <strong>${venda.forma_pagamento_entrega || 'A COMBINAR'}</strong>
            </div>
          </div>
        ` : `
          <div style="padding: 15px; background: #d1fae5; border-radius: 8px; text-align: center; font-weight: bold; color: #065f46; margin-bottom: 15px;">
            ✅ PAGAMENTO JÁ REALIZADO - SEM COBRANÇA
          </div>
        `}

        ${entrega.observacoes ? `
          <div style="background: #fff7ed; padding: 10px; border-radius: 4px; border-left: 3px solid #f97316; margin-bottom: 15px;">
            <strong style="color: #9a3412;">Obs:</strong> <span style="color: #9a3412;">${entrega.observacoes}</span>
          </div>
        ` : ''}

        <!-- Espaçador flexível -->
        <div style="flex: 1;"></div>

        <!-- Área de Observações do Cliente (fixo no fim) -->
        <div style="border: 1px solid #ccc; border-radius: 6px; padding: 10px; margin-bottom: 15px;">
          <div style="font-size: 10px; color: #666; text-transform: uppercase; margin-bottom: 8px;">Observações do Cliente na Entrega:</div>
          <div style="border-bottom: 1px solid #ddd; height: 20px; margin-bottom: 8px;"></div>
          <div style="border-bottom: 1px solid #ddd; height: 20px; margin-bottom: 8px;"></div>
          <div style="border-bottom: 1px solid #ddd; height: 20px;"></div>
        </div>

        <!-- Assinaturas (fixo no fim) -->
        <div style="display: flex; justify-content: space-between; border-top: 1px dashed #ccc; padding-top: 15px;">
          <div style="flex: 1; text-align: center; border-right: 1px dashed #ccc; padding-right: 20px;">
            <div style="border-top: 1px solid #333; margin-top: 50px; padding-top: 5px; font-size: 10px; color: #666;">Assinatura do Cliente</div>
            <div style="font-size: 9px; color: #999; margin-top: 2px;">${cliente?.nome_completo || entrega.cliente_nome}</div>
          </div>
          <div style="flex: 1; text-align: center; padding-left: 20px;">
            <div style="border-top: 1px solid #333; margin-top: 50px; padding-top: 5px; font-size: 10px; color: #666;">Assinatura do Entregador</div>
            <div style="font-size: 9px; color: #999; margin-top: 2px;">Data: ___/___/______</div>
          </div>
        </div>

        <div style="text-align: right; font-size: 9px; color: #999; margin-top: 10px;">
          Impresso em: ${new Date().toLocaleString('pt-BR')}
        </div>
      </div>
    `;
  };

  const imprimirFichas = async (entregasParaImprimir) => {
    setImprimindo(true);
    
    const fichasHTML = entregasParaImprimir.map(entrega => {
      const venda = vendas.find(v => v.id === entrega.venda_id);
      const cliente = clientes.find(c => c.id === venda?.cliente_id);
      return gerarFichaInternaHTML(entrega, venda, cliente);
    }).join('');

    const htmlCompleto = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Fichas de Expedição</title>
        <style>
          @page { size: A4; margin: 10mm; }
          @media print { 
            body { padding: 0; margin: 0; }
            .ficha:last-child { page-break-after: avoid; }
          }
        </style>
      </head>
      <body>${fichasHTML}</body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlCompleto);
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(async () => {
      printWindow.print();
      
      // Marcar como impressos
      for (const entrega of entregasParaImprimir) {
        await updateMutation.mutateAsync({
          id: entrega.id,
          data: { impresso: true, data_impressao: new Date().toISOString() }
        });
      }
      
      setSelecionados([]);
      setImprimindo(false);
    }, 500);
  };

  const imprimirSelecionados = () => {
    const entregasParaImprimir = entregas.filter(e => selecionados.includes(e.id));
    if (entregasParaImprimir.length > 0) {
      imprimirFichas(entregasParaImprimir);
    }
  };

  const imprimirNovos = () => {
    if (naoImpressos.length > 0) {
      imprimirFichas(naoImpressos);
    }
  };

  const imprimirUm = (entrega) => {
    imprimirFichas([entrega]);
  };

  const agendarSelecionados = () => {
    const entregasParaAgendar = entregas.filter(e => selecionados.includes(e.id));
    if (entregasParaAgendar.length > 0) {
      setModalAgendar({ open: true, entrega: null, multiplos: entregasParaAgendar });
    }
  };

  const getDiasRestantes = (dataLimite) => {
    if (!dataLimite) return null;
    const dias = differenceInDays(new Date(dataLimite + 'T12:00:00'), new Date());
    return dias;
  };

  const getUrgenciaBadge = (dataLimite) => {
    const dias = getDiasRestantes(dataLimite);
    if (dias === null) return null;
    if (dias < 0) return <Badge className="bg-red-600 text-white"><AlertTriangle className="w-3 h-3 mr-1" />Atrasado</Badge>;
    if (dias <= 3) return <Badge className="bg-orange-500 text-white"><Clock className="w-3 h-3 mr-1" />{dias}d</Badge>;
    if (dias <= 7) return <Badge className="bg-yellow-500 text-white">{dias}d</Badge>;
    return <Badge className="bg-green-600 text-white">{dias}d</Badge>;
  };

  if (entregas.length === 0) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="text-center py-16">
          <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500 opacity-50" />
          <p className="text-xl font-semibold text-green-700 mb-2">Tudo em dia!</p>
          <p className="text-gray-500">Nenhuma entrega pendente no momento.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Barra de Ações */}
      <Card className="border-0 shadow-md bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={selecionarTodos}
                className="text-xs"
              >
                {selecionados.length === entregas.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
              </Button>
              <div className="text-sm">
                <span className="text-gray-500">Total:</span>{" "}
                <span className="font-bold text-gray-900 dark:text-white">{entregas.length}</span>
                {naoImpressos.length > 0 && (
                  <span className="ml-2 text-orange-600 font-medium">
                    ({naoImpressos.length} novos)
                  </span>
                )}
              </div>
              {selecionados.length > 0 && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                  {selecionados.length} selecionados
                </Badge>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {selecionados.length > 0 && (
                <>
                  <Button
                    onClick={agendarSelecionados}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Agendar ({selecionados.length})
                  </Button>
                  <Button
                    onClick={imprimirSelecionados}
                    disabled={imprimindo}
                    variant="outline"
                    className="border-green-600 text-green-700 hover:bg-green-50"
                  >
                    <Printer className="w-4 h-4 mr-2" />
                    Imprimir ({selecionados.length})
                  </Button>
                </>
              )}
              {naoImpressos.length > 0 && (
                <Button
                  onClick={imprimirNovos}
                  disabled={imprimindo}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Imprimir Novos ({naoImpressos.length})
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Entregas */}
      <div className="space-y-3">
        {entregas.map((entrega) => {
          const venda = vendas.find(v => v.id === entrega.venda_id);
          
          return (
            <Card 
              key={entrega.id} 
              className={`border shadow-sm hover:shadow-md transition-all ${
                selecionados.includes(entrega.id)
                  ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-900/10'
                  : entrega.impresso 
                    ? 'bg-gray-50 dark:bg-neutral-800/50 border-gray-200' 
                    : 'bg-white dark:bg-neutral-900 border-orange-200'
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Checkbox */}
                  <div className="pt-1">
                    <Checkbox
                      checked={selecionados.includes(entrega.id)}
                      onCheckedChange={() => toggleSelecao(entrega.id)}
                    />
                  </div>

                  {/* Conteúdo Principal */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-bold text-lg text-green-800 dark:text-green-400">
                        #{entrega.numero_pedido}
                      </span>
                      {getUrgenciaBadge(entrega.data_limite)}
                      {entrega.impresso && (
                        <Badge variant="outline" className="border-green-500 text-green-600">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Impresso
                        </Badge>
                      )}
                      {venda?.pagamento_na_entrega && (
                        <Badge className="bg-red-100 text-red-700 border border-red-300">
                          💰 Receber R$ {venda.valor_pagamento_entrega?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </Badge>
                      )}
                    </div>

                    <div className="grid md:grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                        <User className="w-4 h-4 text-green-600" />
                        <span className="font-medium">{entrega.cliente_nome}</span>
                      </div>
                      {entrega.cliente_telefone && (
                        <div className="flex items-center gap-2 text-gray-500">
                          <Phone className="w-4 h-4" />
                          {entrega.cliente_telefone}
                        </div>
                      )}
                      {entrega.endereco_entrega && (
                        <div className="flex items-start gap-2 text-gray-500 md:col-span-2">
                          <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-orange-500" />
                          <span className="line-clamp-1">{entrega.endereco_entrega}</span>
                        </div>
                      )}
                    </div>

                    {entrega.observacoes && (
                      <div className="mt-2 text-sm text-orange-700 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400 px-3 py-1.5 rounded">
                        <strong>Obs:</strong> {entrega.observacoes}
                      </div>
                    )}
                  </div>

                  {/* Ações */}
                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      onClick={() => setModalAgendar({ open: true, entrega, multiplos: [] })}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                    >
                      <Calendar className="w-3 h-3 mr-1" />
                      Agendar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => imprimirUm(entrega)}
                      disabled={imprimindo}
                      className="text-xs"
                    >
                      <Printer className="w-3 h-3 mr-1" />
                      Imprimir
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Modal de Agendamento */}
      <AgendarEntregaModal
        isOpen={modalAgendar.open}
        onClose={() => setModalAgendar({ open: false, entrega: null, multiplos: [] })}
        entrega={modalAgendar.entrega}
        entregasSelecionadas={modalAgendar.multiplos}
      />
    </div>
  );
}