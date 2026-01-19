import React from "react";
import { EMPRESA } from "@/config/empresa";

// URL da logo e cache em localStorage para uso offline
const LOGO_URL = EMPRESA.logo_url;
const LOGO_CACHE_KEY = "moveis_pedro_ii_logo_cache";

// Tenta carregar logo do cache ou usa URL online
const getLogoSrc = () => {
  try {
    const cached = localStorage.getItem(LOGO_CACHE_KEY);
    if (cached) return cached;
  } catch (e) { }
  return LOGO_URL;
};

// Função para limpar nome do produto (remove prefixos internos)
// Garante retrocompatibilidade com vendas antigas que têm [SOLICITAÇÃO] no nome
const limparNomeProduto = (nome) => {
  if (!nome) return '-';
  return nome
    .replace(/^\[SOLICITAÇÃO\]\s*/i, '')
    .replace(/^\[PENDENTE CADASTRO\]\s*/i, '');
};

// Cache a logo em base64 para uso offline (chamado uma vez quando online)
if (typeof window !== 'undefined') {
  try {
    if (!localStorage.getItem(LOGO_CACHE_KEY) && navigator.onLine) {
      fetch(LOGO_URL)
        .then(res => res.blob())
        .then(blob => {
          const reader = new FileReader();
          reader.onloadend = () => {
            try {
              localStorage.setItem(LOGO_CACHE_KEY, reader.result);
            } catch (e) { }
          };
          reader.readAsDataURL(blob);
        })
        .catch(() => { });
    }
  } catch (e) { }
}

// PDF PARA O CLIENTE (limpo e elegante)
export function gerarNotaPedidoHTML(venda, cliente, vendedor) {
  const logoSrc = getLogoSrc();
  const dataVenda = new Date(venda.data_venda).toLocaleDateString('pt-BR');

  const enderecoCompleto = cliente?.endereco ?
    `${cliente.endereco}, ${cliente.numero || 's/n'}${cliente.complemento ? ` - ${cliente.complemento}` : ''}, ${cliente.bairro || ''}, ${cliente.cidade || ''} - ${cliente.estado || ''}` :
    'Endereço não cadastrado';

  const prazoEntrega = venda.prazo_entrega === "15 dias" ? "15 dias úteis" :
    venda.prazo_entrega === "45 dias" ? "45 dias úteis" :
      venda.prazo_entrega === "Retirado na loja" ? "Retirada na loja" : venda.prazo_entrega;

  const nomeVendedor = vendedor || venda.responsavel_nome || '-';

  const itensHTML = venda.itens.map(item => `
    <tr>
      <td style="padding: 8px 10px; border-bottom: 1px solid #e5e5e5;">${limparNomeProduto(item.produto_nome)}</td>
      <td style="padding: 8px 10px; border-bottom: 1px solid #e5e5e5; text-align: center;">${item.quantidade}</td>
      <td style="padding: 8px 10px; border-bottom: 1px solid #e5e5e5; text-align: right;">R$ ${item.preco_unitario?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
      <td style="padding: 8px 10px; border-bottom: 1px solid #e5e5e5; text-align: right; font-weight: 600;">R$ ${item.subtotal?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
    </tr>
  `).join('');

  const pagamentosHTML = venda.pagamentos?.length > 0 ? venda.pagamentos.map(pag =>
    `${pag.forma_pagamento}${pag.parcelas > 1 ? ` (${pag.parcelas}x)` : ''}: R$ ${pag.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
  ).join(' • ') : 'Pagamento pendente';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Pedido #${venda.numero_pedido}</title>
      <style>
        @page { size: A4; margin: 12mm; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #333; font-size: 11px; }
        
        .header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 15px; border-bottom: 2px solid #07593f; margin-bottom: 15px; }
        .header-left { display: flex; align-items: center; gap: 15px; }
        .logo-img { width: 50px; height: auto; }
        .empresa-info { }
        .empresa-nome { font-size: 16px; font-weight: bold; color: #07593f; }
        .empresa-sub { font-size: 9px; color: #666; }
        .pedido-info { text-align: right; }
        .pedido-numero { font-size: 20px; font-weight: bold; color: #07593f; }
        .pedido-data { font-size: 10px; color: #666; margin-top: 2px; }
        
        .cliente-section { background: #f8fafc; padding: 12px 15px; border-radius: 6px; margin-bottom: 15px; border-left: 4px solid #07593f; }
        .cliente-nome { font-size: 14px; font-weight: bold; color: #07593f; margin-bottom: 4px; }
        .cliente-detalhe { color: #555; font-size: 10px; line-height: 1.6; }
        
        .info-row { display: flex; gap: 12px; margin-bottom: 15px; }
        .info-tag { background: #f0f9ff; border: 1px solid #bfdbfe; padding: 8px 12px; border-radius: 4px; font-size: 10px; flex: 1; text-align: center; }
        .info-tag strong { display: block; font-size: 12px; color: #07593f; margin-top: 2px; }
        
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th { background: #07593f; color: white; padding: 8px 10px; text-align: left; font-size: 10px; font-weight: 600; }
        
        .resumo-row { display: flex; gap: 15px; margin-top: 15px; }
        .resumo-box { flex: 1; background: #f9fafb; padding: 12px; border-radius: 6px; border: 1px solid #e5e5e5; }
        .resumo-titulo { font-size: 9px; color: #666; text-transform: uppercase; margin-bottom: 6px; font-weight: 600; }
        
        .total-linha { display: flex; justify-content: space-between; font-size: 11px; padding: 3px 0; }
        .total-final { font-size: 16px; font-weight: bold; color: #07593f; border-top: 2px solid #07593f; padding-top: 8px; margin-top: 8px; }
        
        .assinaturas { display: flex; gap: 40px; padding-top: 20px; position: fixed; bottom: 60px; left: 20px; right: 20px; }
        .assinatura-box { flex: 1; text-align: center; }
        .assinatura-linha { border-top: 1px solid #333; margin-top: 50px; padding-top: 8px; }
        .assinatura-label { font-size: 10px; color: #333; font-weight: 600; }
        .assinatura-nome { font-size: 9px; color: #666; margin-top: 2px; }
        
        .footer { text-align: center; padding-top: 12px; border-top: 1px dashed #ccc; position: fixed; bottom: 15px; left: 20px; right: 20px; }
        .footer-text { font-size: 9px; color: #666; }
        
        @media print { 
          body { padding: 15px; -webkit-print-color-adjust: exact; print-color-adjust: exact; } 
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="header-left">
          <img src="${logoSrc}" alt="Logo" class="logo-img" />
          <div class="empresa-info">
            <div class="empresa-nome">Móveis Pedro II</div>
            <div class="empresa-sub">Loja ${venda.loja}</div>
          </div>
        </div>
        <div class="pedido-info">
          <div class="pedido-numero">Pedido #${venda.numero_pedido}</div>
          <div class="pedido-data">${dataVenda}</div>
        </div>
      </div>

      <div class="cliente-section">
        <div class="cliente-nome">${cliente?.nome_completo || venda.cliente_nome}</div>
        <div class="cliente-detalhe">
          CPF: ${cliente?.cpf || '-'} &nbsp;|&nbsp; Tel: ${cliente?.telefone || venda.cliente_telefone}<br/>
          ${enderecoCompleto}
        </div>
      </div>

      <div class="info-row">
        <div class="info-tag"><span style="color:#666;">Prazo de Entrega</span><strong>${prazoEntrega}</strong></div>
        <div class="info-tag"><span style="color:#666;">Vendedor</span><strong>${nomeVendedor}</strong></div>
      </div>

      <table>
        <thead><tr><th>Produto</th><th style="text-align:center;width:60px;">Qtd</th><th style="text-align:right;width:90px;">Unitário</th><th style="text-align:right;width:90px;">Subtotal</th></tr></thead>
        <tbody>${itensHTML}</tbody>
      </table>

      <div class="resumo-row">
        <div class="resumo-box">
          <div class="resumo-titulo">Forma de Pagamento</div>
          <div style="font-size:11px;color:#333;">${pagamentosHTML}</div>
          ${venda.pagamento_na_entrega ? `<div style="margin-top:6px;font-size:11px;color:#059669;font-weight:600;">+ R$ ${venda.valor_pagamento_entrega?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} na entrega (${venda.forma_pagamento_entrega || 'A combinar'})</div>` : ''}
        </div>
        <div class="resumo-box">
          <div class="resumo-titulo">Valores</div>
          ${venda.desconto > 0 ? `<div class="total-linha"><span>Desconto:</span><span style="color:#dc2626;">- R$ ${venda.desconto?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>` : ''}
          <div class="total-linha total-final"><span>TOTAL:</span><span>R$ ${venda.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
        </div>
      </div>

      ${venda.observacoes ? `<div style="margin-top:12px;background:#fff7ed;padding:10px 12px;border-radius:4px;font-size:10px;color:#9a3412;border-left:3px solid #f97316;"><strong>Observações:</strong> ${venda.observacoes}</div>` : ''}

      <div style="margin-top:15px;background:#f0f9ff;padding:12px 15px;border-radius:6px;border:1px solid #bfdbfe;">
        <div style="font-size:10px;font-weight:700;color:#1e40af;margin-bottom:6px;text-transform:uppercase;">📋 Observações:</div>
        <ul style="margin:0;padding-left:18px;font-size:10px;color:#1e3a8a;line-height:1.8;">
          <li><strong>Não fazemos entregas com hora marcada.</strong> Agradecemos a compreensão.</li>
          <li><strong>Garantia é de 90 dias</strong> conforme lei nº 8078 de 11/09/1990.</li>
          <li><strong>Não trocamos mercadoria.</strong></li>
        </ul>
      </div>

      <div class="assinaturas">
        <div class="assinatura-box">
          <div class="assinatura-linha">
            <div class="assinatura-label">Assinatura do Cliente</div>
            <div class="assinatura-nome">${cliente?.nome_completo || venda.cliente_nome}</div>
          </div>
        </div>
        <div class="assinatura-box">
          <div class="assinatura-linha">
            <div class="assinatura-label">Assinatura do Vendedor</div>
            <div class="assinatura-nome">${nomeVendedor}</div>
          </div>
        </div>
      </div>

      <div class="footer">
        <div class="footer-text"><strong>Móveis Pedro II</strong> - Este documento não possui valor fiscal</div>
        <div class="footer-text" style="margin-top:3px;font-size:8px;color:#999;">Emitido em ${new Date().toLocaleString('pt-BR')}</div>
      </div>
    </body>
    </html>
  `;
}

// PDF INTERNO (para entregadores - com destaque de pagamento)
export function gerarNotaInternaHTML(venda, cliente, vendedor) {
  const enderecoCompleto = cliente?.endereco ?
    `${cliente.endereco}, ${cliente.numero || 's/n'}${cliente.complemento ? ` - ${cliente.complemento}` : ''}, ${cliente.bairro || ''}, ${cliente.cidade || ''} - ${cliente.estado || ''}` :
    'SEM ENDEREÇO';

  const itensHTML = venda.itens.map(item =>
    `<tr><td style="padding:5px;border-bottom:1px solid #ddd;">${item.produto_nome}</td><td style="padding:5px;border-bottom:1px solid #ddd;text-align:center;">${item.quantidade}</td></tr>`
  ).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Interno #${venda.numero_pedido}</title>
      <style>
        @page { size: A4; margin: 10mm; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; padding: 15px; font-size: 12px; }
        .titulo { font-size: 16px; font-weight: bold; color: #07593f; border-bottom: 2px solid #07593f; padding-bottom: 8px; margin-bottom: 12px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; }
        .box { background: #f5f5f5; padding: 12px; border-radius: 6px; }
        .box-titulo { font-size: 10px; color: #666; text-transform: uppercase; margin-bottom: 5px; }
        .box-valor { font-size: 14px; font-weight: bold; color: #333; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #333; color: white; padding: 8px; text-align: left; font-size: 11px; }
        .pagamento-destaque { border: 4px dashed #10b981; background: #ecfdf5; padding: 20px; border-radius: 10px; margin-top: 15px; text-align: center; }
        .pagamento-titulo { color: #065f46; font-size: 14px; font-weight: bold; margin-bottom: 10px; }
        .pagamento-valor { font-size: 32px; font-weight: bold; color: #059669; }
        .pagamento-forma { color: #065f46; margin-top: 8px; font-size: 14px; }
        @media print { body { padding: 10px; } .pagamento-destaque { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style>
    </head>
    <body>
      <div class="titulo">📋 CONTROLE INTERNO - PEDIDO #${venda.numero_pedido}</div>
      
      <div class="grid">
        <div class="box"><div class="box-titulo">Cliente</div><div class="box-valor">${cliente?.nome_completo || venda.cliente_nome}</div><div style="font-size:11px;color:#666;margin-top:4px;">Tel: ${cliente?.telefone || venda.cliente_telefone}</div></div>
        <div class="box"><div class="box-titulo">Endereço</div><div class="box-valor" style="font-size:12px;">${enderecoCompleto}</div></div>
        <div class="box"><div class="box-titulo">Vendedor</div><div class="box-valor">${vendedor || venda.responsavel_nome || '-'}</div></div>
        <div class="box"><div class="box-titulo">Status</div><div class="box-valor">${venda.prazo_entrega === 'Retirado na loja' ? '🏪 RETIRADA' : '🚚 ENTREGA'}</div></div>
      </div>

      <table><thead><tr><th>Produto</th><th style="width:60px;text-align:center;">Qtd</th></tr></thead><tbody>${itensHTML}</tbody></table>

      ${venda.pagamento_na_entrega ? `
        <div class="pagamento-destaque">
          <div class="pagamento-titulo">💰 RECEBER NA ENTREGA</div>
          <div class="pagamento-valor">R$ ${venda.valor_pagamento_entrega?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          ${venda.forma_pagamento_entrega ? `<div class="pagamento-forma">Forma: <strong>${venda.forma_pagamento_entrega}</strong></div>` : ''}
        </div>
      ` : `<div style="margin-top:15px;padding:15px;background:#d1fae5;border-radius:8px;text-align:center;font-weight:bold;color:#065f46;">✅ PAGAMENTO JÁ REALIZADO - SEM COBRANÇA</div>`}

      <div style="margin-top:20px;text-align:right;font-size:10px;color:#999;">Gerado: ${new Date().toLocaleString('pt-BR')}</div>
    </body>
    </html>
  `;
}

export function abrirNotaPedidoPDF(venda, cliente, vendedor) {
  const html = gerarNotaPedidoHTML(venda, cliente, vendedor);
  const printWindow = window.open('', '_blank');

  // Check if popup was blocked
  if (!printWindow) {
    alert('O navegador bloqueou a impressão. Por favor, permita popups para este site e tente novamente.');
    console.error('Popup bloqueado pelo navegador');
    return;
  }

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 500);
}

/**
 * Prepara janela de impressão IMEDIATAMENTE (deve ser chamada no click handler)
 * Retorna a janela para ser preenchida depois
 */
export function prepararNotaPedidoPDF() {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    console.error('Popup bloqueado pelo navegador');
    return null;
  }
  // Mostra loading enquanto processa
  printWindow.document.write(`
    <html>
    <head><title>Gerando Nota...</title></head>
    <body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:Arial;">
      <div style="text-align:center;">
        <div style="font-size:24px;color:#07593f;margin-bottom:10px;">⏳</div>
        <p>Gerando nota do pedido...</p>
      </div>
    </body>
    </html>
  `);
  return printWindow;
}

/**
 * Preenche e imprime a janela já aberta com os dados da nota
 */
export function preencherEImprimirPDF(printWindow, venda, cliente, vendedor) {
  if (!printWindow) {
    // Se por algum motivo a janela não existe, tenta abrir normalmente
    console.warn('Janela não disponível, tentando abrir nova...');
    abrirNotaPedidoPDF(venda, cliente, vendedor);
    return;
  }

  const html = gerarNotaPedidoHTML(venda, cliente, vendedor);
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 500);
}

export function abrirNotaInternaPDF(venda, cliente, vendedor) {
  const html = gerarNotaInternaHTML(venda, cliente, vendedor);
  const printWindow = window.open('', '_blank');

  // Check if popup was blocked
  if (!printWindow) {
    alert('O navegador bloqueou a impressão. Por favor, permita popups para este site e tente novamente.');
    console.error('Popup bloqueado pelo navegador');
    return;
  }

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 500);
}

export function enviarWhatsApp(telefone, numeroPedido, valorTotal, nomeCliente) {
  // Limpa o telefone para formato internacional
  let tel = telefone?.replace(/\D/g, '') || '';
  if (tel.length === 11) tel = '55' + tel;
  if (tel.length === 10) tel = '55' + tel;

  const mensagem = encodeURIComponent(
    `Olá ${nomeCliente}! 🪑\n\n` +
    `Seu pedido *#${numeroPedido}* foi registrado com sucesso!\n\n` +
    `💰 *Valor Total:* R$ ${valorTotal?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n` +
    `Em breve entraremos em contato para agendar a entrega.\n\n` +
    `Obrigado pela preferência!\n` +
    `*Móveis Pedro II*`
  );

  const url = `https://wa.me/${tel}?text=${mensagem}`;
  window.open(url, '_blank');
}

/**
 * Gera o PDF da nota de pedido como base64 para enviar via WhatsApp bot
 * @param {Object} venda - Dados da venda
 * @param {Object} cliente - Dados do cliente
 * @param {string} vendedor - Nome do vendedor
 * @returns {Promise<string>} - PDF em base64 (sem o prefixo data:application/pdf;base64,)
 */
export async function gerarNotaPedidoBase64(venda, cliente, vendedor) {
  try {
    // Importação dinâmica do html2pdf
    const html2pdf = (await import('html2pdf.js')).default;

    const htmlContent = gerarNotaPedidoHTML(venda, cliente, vendedor);

    // Criar container temporário
    const container = document.createElement('div');
    container.innerHTML = htmlContent;
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    document.body.appendChild(container);

    // Configurações do PDF
    const opt = {
      margin: 10,
      filename: `Pedido_${venda.numero_pedido}.pdf`,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // Gerar PDF como blob
    const pdfBlob = await html2pdf().set(opt).from(container).outputPdf('blob');

    // Remover container temporário
    document.body.removeChild(container);

    // Converter blob para base64
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Remove o prefixo "data:application/pdf;base64,"
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(pdfBlob);
    });
  } catch (error) {
    console.error('Erro ao gerar PDF base64:', error);
    return null;
  }
}