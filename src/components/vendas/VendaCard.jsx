
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, User, Calendar, CreditCard, Package, FileDown, MapPin, XCircle } from "lucide-react";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const statusColors = {
  "Pagamento Pendente": { bg: "#FEF3C7", text: "#92400E", border: "#FCD34D" },
  "Pago": { bg: "#DBEAFE", text: "#1E40AF", border: "#93C5FD" },
  "Pago & Retirado": { bg: "#D1FAE5", text: "#065F46", border: "#6EE7B7" }
};

export default function VendaCard({ venda, onEdit, onDelete, onLiberarEstoque, showValues = true, showLiberarEstoque = false }) {
  const [baixando, setBaixando] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const queryClient = useQueryClient();

  const cancelarVendaMutation = useMutation({
    mutationFn: async () => {
      // Devolver produtos ao estoque
      for (const item of venda.itens) {
        const produtos = await base44.entities.Produto.list();
        const produto = produtos.find(p => p.id === item.produto_id);
        
        if (produto) {
          await base44.entities.Produto.update(produto.id, {
            quantidade_estoque: produto.quantidade_estoque + item.quantidade,
            quantidade_reservada: Math.max(0, (produto.quantidade_reservada || 0) - item.quantidade)
          });
        }
      }
      
      // Deletar a venda
      await base44.entities.Venda.delete(venda.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendas'] });
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      setShowCancelDialog(false);
    },
  });

  const baixarPDF = () => {
    setBaixando(true);
    
    let itensHTML = '';
    venda.itens?.forEach(item => {
      itensHTML += `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #E5E0D8;">${item.produto_nome}</td>
          <td style="padding: 12px; border-bottom: 1px solid #E5E0D8; text-align: center;">${item.quantidade}</td>
          <td style="padding: 12px; border-bottom: 1px solid #E5E0D8; text-align: right;">R$ ${item.preco_unitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
          <td style="padding: 12px; border-bottom: 1px solid #E5E0D8; text-align: right; font-weight: bold;">R$ ${item.subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
        </tr>
      `;
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 40px;
            color: #2C2C2C;
          }
          .header {
            text-align: center;
            margin-bottom: 40px;
            border-bottom: 3px solid #07593f;
            padding-bottom: 20px;
          }
          .header img {
            width: 80px;
            height: auto;
            margin: 0 auto 15px;
          }
          .header h1 {
            color: #07593f;
            margin: 0;
            font-size: 32px;
          }
          .header p {
            color: #8B8B8B;
            margin: 5px 0;
          }
          .info-section {
            margin-bottom: 30px;
          }
          .info-row {
            margin-bottom: 10px;
          }
          .info-label {
            font-weight: bold;
            color: #2C2C2C;
          }
          .info-value {
            color: #8B8B8B;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 30px 0;
          }
          th {
            background-color: #07593f;
            color: white;
            padding: 15px;
            text-align: left;
          }
          .totals {
            margin-top: 20px;
            text-align: right;
          }
          .totals div {
            margin-bottom: 10px;
            font-size: 16px;
          }
          .total-final {
            font-size: 24px;
            font-weight: bold;
            color: #07593f;
            margin-top: 15px;
            padding-top: 15px;
            border-top: 2px solid #07593f;
          }
          .payment-info {
            background: #f0f9ff;
            padding: 15px;
            border-radius: 8px;
            margin-top: 20px;
          }
          .footer {
            margin-top: 50px;
            text-align: center;
            color: #8B8B8B;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/690ce4cb64e20af6b4a46b6f/3474ff954_undefined-Imgur.png" alt="Logo" />
          <h1>Móveis Pedro II</h1>
          <p>Loja ${venda.loja}</p>
        </div>

        <div class="info-section">
          <h2 style="color: #07593f; margin-bottom: 20px;">Comprovante de Venda</h2>
          <div class="info-row">
            <span class="info-label">Pedido Nº:</span>
            <span class="info-value">${venda.numero_pedido}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Data:</span>
            <span class="info-value">${new Date(venda.data_venda).toLocaleDateString('pt-BR')}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Status:</span>
            <span class="info-value">${venda.status}</span>
          </div>
        </div>

        <div class="info-section">
          <h3 style="color: #2C2C2C; margin-bottom: 15px;">Dados do Cliente</h3>
          <div class="info-row">
            <span class="info-label">Nome:</span>
            <span class="info-value">${venda.cliente_nome}</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th style="text-align: center;">Qtd</th>
              <th style="text-align: right;">Preço Unit.</th>
              <th style="text-align: right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${itensHTML}
          </tbody>
        </table>

        <div class="totals">
          ${venda.desconto > 0 ? `
          <div>
            <span class="info-label">Desconto:</span>
            <span style="color: #f38a4c;">-R$ ${venda.desconto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>` : ''}
          <div class="total-final">
            Total: R$ ${venda.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
        </div>

        ${venda.valor_entrada > 0 || venda.valor_restante > 0 ? `
        <div class="payment-info">
          <h3 style="color: #07593f; margin-bottom: 10px;">Informações de Pagamento</h3>
          ${venda.valor_entrada > 0 ? `
          <div class="info-row">
            <span class="info-label">Entrada Paga:</span>
            <span class="info-value">R$ ${venda.valor_entrada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} via ${venda.forma_pagamento_entrada}
            ${venda.forma_pagamento_entrada === 'Crédito' && venda.parcelas_cartao > 1 ? ` (${venda.parcelas_cartao}x)` : ''}</span>
          </div>` : ''}
          ${venda.valor_restante > 0 ? `
          <div class="info-row">
            <span class="info-label">Restante:</span>
            <span class="info-value">R$ ${venda.valor_restante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            ${venda.pagamento_restante_entrega ? ` (A pagar na entrega via ${venda.forma_pagamento_entrega})` : ''}</span>
          </div>` : ''}
        </div>` : ''}

        ${venda.observacoes ? `
        <div class="info-section" style="margin-top: 30px;">
          <h3 style="color: #2C2C2C; margin-bottom: 10px;">Observações</h3>
          <p style="color: #8B8B8B;">${venda.observacoes}</p>
        </div>` : ''}

        <div class="footer">
          <p>Obrigado pela preferência!</p>
          <p>Móveis Pedro II - Loja ${venda.loja}</p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '', 'height=600,width=800');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.print();
      setBaixando(false);
    }, 250);
  };

  return (
    <>
      <Card className="hover:shadow-xl transition-all duration-300 border-0">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-bold text-xl" style={{ color: '#07593f' }}>
                  Pedido #{venda.numero_pedido}
                </h3>
                <Badge 
                  style={{
                    backgroundColor: statusColors[venda.status]?.bg,
                    color: statusColors[venda.status]?.text,
                    borderColor: statusColors[venda.status]?.border,
                  }}
                  className="border"
                >
                  {venda.status}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm" style={{ color: '#8B8B8B' }}>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {format(new Date(venda.data_venda), "dd/MM/yyyy")}
                </div>
                {venda.loja && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {venda.loja}
                  </div>
                )}
              </div>
            </div>
            {showValues && (
              <div className="text-right">
                <p className="text-sm mb-1" style={{ color: '#8B8B8B' }}>Valor Total</p>
                <p className="text-2xl font-bold" style={{ color: '#07593f' }}>
                  R$ {venda.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {showLiberarEstoque && venda.valor_restante > 0 && (
            <div className="p-3 rounded-lg border-2" style={{ borderColor: '#FCD34D', backgroundColor: '#FEF3C7' }}>
              <p className="text-xs font-semibold mb-1" style={{ color: '#92400E' }}>
                🔒 Estoque Reservado
              </p>
              <p className="text-xs mb-2" style={{ color: '#92400E' }}>
                Cliente: <strong>{venda.cliente_nome}</strong>
                <br />
                Restante a pagar: <strong>R$ {venda.valor_restante?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onLiberarEstoque(venda)}
                className="w-full text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-orange-300"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Cliente Desistiu - Liberar Estoque
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" style={{ color: '#07593f' }} />
              <span className="font-medium" style={{ color: '#07593f' }}>
                {venda.cliente_nome}
              </span>
            </div>
            
            {showValues && venda.valor_entrada > 0 && (
              <div className="text-sm p-2 rounded" style={{ backgroundColor: '#f0f9ff' }}>
                <p style={{ color: '#07593f' }}>
                  <strong>Entrada:</strong> R$ {venda.valor_entrada?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} 
                  {' '}via {venda.forma_pagamento_entrada}
                  {venda.forma_pagamento_entrada === 'Crédito' && venda.parcelas_cartao > 1 && ` (${venda.parcelas_cartao}x)`}
                </p>
              </div>
            )}

            {showValues && venda.valor_restante > 0 && (
              <div className="text-sm p-2 rounded" style={{ backgroundColor: '#fef3c7' }}>
                <p style={{ color: '#92400E' }}>
                  <strong>Restante:</strong> R$ {venda.valor_restante?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  {venda.pagamento_restante_entrega && ` (na entrega)`}
                </p>
              </div>
            )}

            {venda.itens && venda.itens.length > 0 && (
              <div className="pt-2 border-t" style={{ borderColor: '#E5E0D8' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-4 h-4" style={{ color: '#f38a4c' }} />
                  <span className="text-sm font-medium" style={{ color: '#07593f' }}>
                    Itens da venda:
                  </span>
                </div>
                <div className="space-y-1">
                  {venda.itens.map((item, index) => (
                    <div key={index} className="text-sm flex justify-between" style={{ color: '#8B8B8B' }}>
                      <span>{item.quantidade}x {item.produto_nome}</span>
                      {showValues && (
                        <span>R$ {item.subtotal?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {venda.desconto > 0 && showValues && (
              <div className="text-sm" style={{ color: '#8B8B8B' }}>
                Desconto: R$ {venda.desconto?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            )}
          </div>

          {venda.observacoes && (
            <div className="pt-2 border-t" style={{ borderColor: '#E5E0D8' }}>
              <p className="text-sm" style={{ color: '#8B8B8B' }}>
                <span className="font-medium">Obs:</span> {venda.observacoes}
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={baixarPDF}
              disabled={baixando}
              className="flex-1"
              style={{ borderColor: '#07593f', color: '#07593f' }}
            >
              <FileDown className="w-4 h-4 mr-1" />
              {baixando ? "Gerando..." : "PDF"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(venda)}
              className="flex-1"
            >
              <Pencil className="w-4 h-4 mr-1" />
              Editar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCancelDialog(true)}
              className="flex-1 text-orange-600 hover:text-orange-700 hover:border-orange-600"
            >
              <XCircle className="w-4 h-4 mr-1" />
              Cancelar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(venda.id)}
              className="text-red-600 hover:text-red-700 hover:border-red-600"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: '#07593f' }}>
              Cancelar Venda #{venda.numero_pedido}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Ao cancelar esta venda:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Os produtos serão devolvidos ao estoque</li>
                <li>As reservas serão liberadas</li>
                <li>Esta ação não pode ser desfeita</li>
              </ul>
              <p className="mt-3 font-semibold" style={{ color: '#f38a4c' }}>
                Tem certeza que deseja cancelar esta venda?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não, manter venda</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelarVendaMutation.mutate()}
              disabled={cancelarVendaMutation.isPending}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {cancelarVendaMutation.isPending ? 'Cancelando...' : 'Sim, cancelar venda'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
