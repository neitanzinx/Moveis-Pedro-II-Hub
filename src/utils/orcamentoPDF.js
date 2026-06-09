import { EMPRESA } from "@/config/empresa";
import { format } from "date-fns";
import { stripInternalProductPrefixes } from "@/utils/productReference";

const limparNomeProduto = (nome) => stripInternalProductPrefixes(nome) || '-';

const formatarTelefone = (tel) => {
  if (!tel) return '-';
  const limpo = String(tel).replace(/\D/g, '');
  if (limpo.length === 11) {
    return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 7)}-${limpo.slice(7)}`;
  }
  if (limpo.length === 10) {
    return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 6)}-${limpo.slice(6)}`;
  }
  return tel;
};

export function gerarOrcamentoHTML(orcamento, vendedorNome) {
  const logoSrc = EMPRESA.logo_url;
  const dataOrcamento = orcamento.data_orcamento
    ? new Date(orcamento.data_orcamento).toLocaleDateString('pt-BR')
    : new Date().toLocaleDateString('pt-BR');
  const validadeOrcamento = orcamento.validade
    ? new Date(orcamento.validade).toLocaleDateString('pt-BR')
    : '-';

  const localidadeArray = [];
  if (orcamento.endereco) localidadeArray.push(orcamento.endereco);
  if (orcamento.bairro) localidadeArray.push(orcamento.bairro);
  if (orcamento.cidade) localidadeArray.push(orcamento.cidade);
  const enderecoCompleto = localidadeArray.length > 0 ? localidadeArray.join(', ') : 'Não informado';

  const subtotalItens = (orcamento.itens || []).reduce((acc, item) => acc + (item.subtotal || 0), 0);

  const itensHTML = (orcamento.itens || []).map(item => {
    const caracteristicas = item.caracteristicas || '';
    const fabricante = item.fornecedor_nome || '';
    
    let specs = [];
    if (caracteristicas) specs.push(caracteristicas);
    if (fabricante) specs.push(`Fabricante: ${fabricante}`);
    const specsStr = specs.join(' | ');

    return `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #e5e5e5;">
        <div style="font-weight: 600; color: #1f2937;">${limparNomeProduto(item.produto_nome)}</div>
        ${specsStr ? `<div style="margin-top: 3px; font-size: 11px; color: #6b7280; line-height: 1.4;">${specsStr}</div>` : ''}
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e5e5; text-align: center;">${item.quantidade}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e5e5; text-align: right;">
        R$ ${(item.preco_unitario || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e5e5; text-align: right; font-weight: 600;">
        R$ ${(item.subtotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
      </td>
    </tr>
  `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Orçamento #${orcamento.numero_orcamento}</title>
      <style>
        @page { size: A4; margin: 12mm; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #333; font-size: 12px; }
        
        .header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 15px; border-bottom: 2px solid #07593f; margin-bottom: 15px; }
        .header-left { display: flex; align-items: center; gap: 15px; }
        .logo-img { width: 50px; height: auto; }
        .empresa-nome { font-size: 16px; font-weight: bold; color: #07593f; }
        .empresa-sub { font-size: 11px; color: #666; }
        .pedido-info { text-align: right; }
        .pedido-numero { font-size: 20px; font-weight: bold; color: #07593f; }
        .pedido-data { font-size: 11px; color: #666; margin-top: 2px; }
        
        .cliente-section { background: #f8fafc; padding: 12px 15px; border-radius: 6px; margin-bottom: 15px; border-left: 4px solid #07593f; }
        .cliente-nome { font-size: 14px; font-weight: bold; color: #07593f; margin-bottom: 4px; }
        .cliente-detalhe { color: #555; font-size: 11px; line-height: 1.6; }
        
        .info-row { display: flex; gap: 12px; margin-bottom: 15px; }
        .info-tag { background: #f0f9ff; border: 1px solid #bfdbfe; padding: 8px 12px; border-radius: 4px; font-size: 11px; flex: 1; text-align: center; }
        .info-tag strong { display: block; font-size: 12px; color: #07593f; margin-top: 2px; }
        
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th { background: #07593f; color: white; padding: 8px 10px; text-align: left; font-size: 11px; font-weight: 600; }
        
        .resumo-row { display: flex; gap: 15px; margin-top: 15px; justify-content: flex-end; }
        .resumo-box { width: 300px; background: #f9fafb; padding: 12px; border-radius: 6px; border: 1px solid #e5e5e5; }
        
        .total-linha { display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0; }
        .total-final { font-size: 16px; font-weight: bold; color: #07593f; border-top: 2px solid #07593f; padding-top: 8px; margin-top: 8px; }
        
        .assinaturas { display: flex; gap: 40px; padding-top: 20px; position: fixed; bottom: 60px; left: 20px; right: 20px; }
        .assinatura-box { flex: 1; text-align: center; }
        .assinatura-linha { border-top: 1px solid #333; margin-top: 50px; padding-top: 8px; }
        .assinatura-label { font-size: 11px; color: #333; font-weight: 600; }
        .assinatura-nome { font-size: 11px; color: #666; margin-top: 2px; }
        
        .footer { text-align: center; padding-top: 12px; border-top: 1px dashed #ccc; position: fixed; bottom: 15px; left: 20px; right: 20px; }
        .footer-text { font-size: 11px; color: #666; }
        
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
            <div class="empresa-sub">Loja ${orcamento.loja || 'Centro'}</div>
          </div>
        </div>
        <div class="pedido-info">
          <div class="pedido-numero">Orçamento #${orcamento.numero_orcamento}</div>
          <div class="pedido-data">Emissão: ${dataOrcamento}</div>
        </div>
      </div>

      <div class="cliente-section">
        <div class="cliente-nome">${orcamento.cliente_nome}</div>
        <div class="cliente-detalhe">
          Tel: ${formatarTelefone(orcamento.cliente_telefone)}<br/>
          Endereço: ${enderecoCompleto}
        </div>
      </div>

      <div class="info-row">
        <div class="info-tag"><span style="color:#666;">Validade do Orçamento</span><strong>${validadeOrcamento}</strong></div>
        <div class="info-tag"><span style="color:#666;">Vendedor</span><strong>${vendedorNome || 'Não informado'}</strong></div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Produto</th>
            <th style="text-align:center;width:60px;">Qtd</th>
            <th style="text-align:right;width:100px;">Unitário</th>
            <th style="text-align:right;width:100px;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${itensHTML}
        </tbody>
      </table>

      <div class="resumo-row">
        <div class="resumo-box">
          <div class="total-linha">
            <span>Subtotal:</span>
            <span>R$ ${subtotalItens.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
          ${orcamento.desconto > 0 ? `
          <div class="total-linha" style="color:#059669;">
            <span>Desconto:</span>
            <span>-R$ ${Number(orcamento.desconto).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>` : ''}
          ${orcamento.valor_frete > 0 ? `
          <div class="total-linha">
            <span>Frete:</span>
            <span>R$ ${Number(orcamento.valor_frete).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>` : ''}
          <div class="total-linha total-final">
            <span>TOTAL:</span>
            <span>R$ ${(orcamento.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      ${orcamento.observacoes ? `<div style="margin-top:12px;background:#fff7ed;padding:10px 12px;border-radius:4px;font-size:11px;color:#9a3412;border-left:3px solid #f97316;"><strong>Observações:</strong> ${orcamento.observacoes}</div>` : ''}

      <div class="assinaturas">
        <div class="assinatura-box">
          <div class="assinatura-linha">
            <div class="assinatura-label">Assinatura do Cliente</div>
            <div class="assinatura-nome">${orcamento.cliente_nome}</div>
          </div>
        </div>
        <div class="assinatura-box">
          <div class="assinatura-linha">
            <div class="assinatura-label">Assinatura do Vendedor</div>
            <div class="assinatura-nome">${vendedorNome || 'Móveis Pedro II'}</div>
          </div>
        </div>
      </div>

      <div class="footer">
        <div class="footer-text"><strong>Móveis Pedro II</strong></div>
        <div class="footer-text" style="margin-top:3px;font-size:8px;color:#999;">Orçamento gerado em ${new Date().toLocaleString('pt-BR')}</div>
      </div>
    </body>
    </html>
  `;
}

export function abrirOrcamentoPDF(orcamento, vendedorNome) {
  const html = gerarOrcamentoHTML(orcamento, vendedorNome);
  const printWindow = window.open('', '_blank');

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
