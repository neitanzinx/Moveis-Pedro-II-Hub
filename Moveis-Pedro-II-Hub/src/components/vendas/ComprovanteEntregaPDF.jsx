/**
 * Gera PDF de comprovante de entrega com:
 * - Dados do pedido e cliente
 * - Assinatura digital do cliente
 * - Histórico de tentativas (se houver)
 * - Comprovante de pagamento (se houver)
 */
export function gerarComprovanteEntregaPDF(entrega, venda) {
  const formatarData = (dataStr) => {
    if (!dataStr) return "-";
    return new Date(dataStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Função para limpar nome do produto (remove prefixos internos)
  const limparNomeProduto = (nome) => {
    if (!nome) return '-';
    return nome
      .replace(/^\[SOLICITAÇÃO\]\s*/i, '')
      .replace(/^\[PENDENTE CADASTRO\]\s*/i, '');
  };

  const itensHTML = venda?.itens?.map(item => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.quantidade}x ${limparNomeProduto(item.produto_nome)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">
        R$ ${(item.preco_unitario * item.quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
      </td>
    </tr>
  `).join('') || '<tr><td colspan="2">Itens não disponíveis</td></tr>';

  const tentativasHTML = entrega.tentativas > 0 ? `
    <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin-top: 16px;">
      <h3 style="margin: 0 0 8px; color: #92400e; font-size: 14px;">⚠️ Tentativas Anteriores (${entrega.tentativas})</h3>
      <p style="margin: 0; font-size: 12px; color: #78350f;">${entrega.observacoes_entrega || 'Sem observações'}</p>
      ${entrega.foto_tentativa_url ? `
        <div style="margin-top: 12px;">
          <p style="font-size: 11px; color: #78350f; margin-bottom: 4px;">Foto da tentativa:</p>
          <img src="${entrega.foto_tentativa_url}" style="max-height: 120px; border-radius: 4px;" />
        </div>
      ` : ''}
    </div>
  ` : '';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Comprovante de Entrega - #${entrega.numero_pedido}</title>
      <style>
        * { box-sizing: border-box; }
        body { 
          font-family: 'Segoe UI', Arial, sans-serif; 
          margin: 0; 
          padding: 24px;
          color: #1a1a1a;
          font-size: 12px;
        }
        .header { 
          text-align: center; 
          border-bottom: 2px solid #16a34a; 
          padding-bottom: 16px; 
          margin-bottom: 20px; 
        }
        .logo { font-size: 22px; font-weight: bold; color: #16a34a; }
        .subtitle { color: #666; font-size: 11px; margin-top: 4px; }
        .badge { 
          display: inline-block; 
          background: #16a34a; 
          color: white; 
          padding: 4px 12px; 
          border-radius: 20px; 
          font-size: 11px; 
          font-weight: bold; 
          margin-top: 12px; 
        }
        .section { 
          background: #f9fafb; 
          border-radius: 8px; 
          padding: 16px; 
          margin-bottom: 16px; 
        }
        .section-title { 
          font-weight: bold; 
          color: #374151; 
          margin-bottom: 8px; 
          font-size: 13px; 
        }
        .info-row { 
          display: flex; 
          justify-content: space-between; 
          padding: 4px 0; 
          border-bottom: 1px dashed #e5e7eb; 
        }
        .info-row:last-child { border-bottom: none; }
        .info-label { color: #6b7280; }
        .info-value { font-weight: 600; color: #111827; }
        .signature-box { 
          text-align: center; 
          padding: 20px; 
          border: 2px dashed #d1d5db; 
          border-radius: 8px; 
          background: white; 
        }
        .signature-box img { max-height: 100px; }
        .signature-label { 
          margin-top: 8px; 
          font-size: 10px; 
          color: #6b7280; 
        }
        table { width: 100%; border-collapse: collapse; }
        .footer { 
          text-align: center; 
          margin-top: 24px; 
          padding-top: 16px; 
          border-top: 1px solid #e5e7eb; 
          color: #9ca3af; 
          font-size: 10px; 
        }
        @media print {
          body { padding: 12px; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">Móveis Pedro II</div>
        <div class="subtitle">Comprovante de Entrega</div>
        <div class="badge">✓ ENTREGA REALIZADA</div>
      </div>

      <div class="section">
        <div class="section-title">Dados do Pedido</div>
        <div class="info-row">
          <span class="info-label">Nº Pedido</span>
          <span class="info-value">#${entrega.numero_pedido}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Data da Entrega</span>
          <span class="info-value">${formatarData(entrega.data_realizada)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Tipo</span>
          <span class="info-value">${entrega.tipo_entrega === 'Retirada' ? 'Retirada na Loja' : 'Entrega'}</span>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Cliente</div>
        <div class="info-row">
          <span class="info-label">Nome</span>
          <span class="info-value">${entrega.cliente_nome}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Telefone</span>
          <span class="info-value">${entrega.cliente_telefone || '-'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Endereço</span>
          <span class="info-value">${entrega.endereco_entrega || 'Retirada na loja'}</span>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Itens Entregues</div>
        <table>
          ${itensHTML}
        </table>
        ${venda?.valor_total ? `
          <div style="text-align: right; margin-top: 12px; font-weight: bold; font-size: 14px;">
            Total: R$ ${venda.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
        ` : ''}
      </div>

      ${entrega.assinatura_url ? `
        <div class="section">
          <div class="section-title">Assinatura do Cliente</div>
          <div class="signature-box">
            <img src="${entrega.assinatura_url}" alt="Assinatura" />
            <div class="signature-label">
              Assinado digitalmente por ${entrega.cliente_nome}<br/>
              em ${formatarData(entrega.data_realizada)}
            </div>
          </div>
        </div>
      ` : ''}

      ${entrega.comprovante_pagamento_url ? `
        <div class="section">
          <div class="section-title">💳 Comprovante de Pagamento</div>
          <div style="text-align: center;">
            <img src="${entrega.comprovante_pagamento_url}" style="max-height: 150px; border-radius: 4px;" />
          </div>
        </div>
      ` : ''}

      ${tentativasHTML}

      <div class="footer">
        Documento gerado em ${new Date().toLocaleString('pt-BR')}<br/>
        Móveis Pedro II - Sistema de Gestão
      </div>
    </body>
    </html>
  `;

  // Abrir em nova janela para impressão/PDF
  const printWindow = window.open('', '_blank', 'width=800,height=900');
  printWindow.document.write(html);
  printWindow.document.close();

  // Auto print após carregar
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };
}
