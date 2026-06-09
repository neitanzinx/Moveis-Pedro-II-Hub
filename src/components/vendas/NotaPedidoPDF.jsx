import { EMPRESA } from "@/config/empresa";
import html2pdf from 'html2pdf.js';
import { stripInternalProductPrefixes } from "@/utils/productReference";

const clampProgress = (value) => {
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) return 0;
  return Math.max(0, Math.min(100, numericValue));
};

const atualizarUIProgresso = (printWindow, {
  label,
  step,
  progress,
  error = false
} = {}) => {
  if (!printWindow || printWindow.closed) return;

  const doc = printWindow.document;
  const cardEl = doc.getElementById('progress-card');
  const labelEl = doc.getElementById('progress-label');
  const stepEl = doc.getElementById('progress-step');
  const barEl = doc.getElementById('progress-bar');

  if (!cardEl || !labelEl || !stepEl || !barEl) return;

  if (typeof label === 'string') {
    labelEl.textContent = label;
  }

  if (typeof step === 'string') {
    stepEl.textContent = step;
  }

  if (typeof progress !== 'undefined') {
    barEl.style.width = `${clampProgress(progress)}%`;
  }

  cardEl.dataset.state = error ? 'error' : 'loading';
};

// URL da logo e cache em localStorage para uso offline
const LOGO_URL = EMPRESA.logo_url;
const LOGO_CACHE_KEY = "moveis_pedro_ii_logo_cache";

// Tenta carregar logo do cache ou usa URL online
const getLogoSrc = () => {
  try {
    const cached = localStorage.getItem(LOGO_CACHE_KEY);
    if (cached) return cached;
  } catch (e) { void e; }
  return LOGO_URL;
};

const limparNomeProduto = (nome) => stripInternalProductPrefixes(nome) || '-';

const possuiValorValido = (valor) => {
  if (valor === null || typeof valor === 'undefined') return false;
  const texto = String(valor).trim();
  if (!texto) return false;
  const normalizado = texto.toLowerCase();
  return !['-', 'null', 'undefined', 'n/a', 'na'].includes(normalizado);
};

const obterPrimeiroValorValido = (...valores) => {
  const encontrado = valores.find(possuiValorValido);
  return possuiValorValido(encontrado) ? String(encontrado).trim() : '-';
};

const obterTamanhoItem = (item = {}) => {
  const tamanhoDireto = obterPrimeiroValorValido(
    item.tamanho,
    item.detalhes_solicitacao?.tamanho,
    item.produto?.tamanho
  );

  if (tamanhoDireto !== '-') return tamanhoDireto;

  const largura = item.largura ?? item.produto?.largura;
  const altura = item.altura ?? item.produto?.altura;
  const profundidade = item.profundidade ?? item.produto?.profundidade;
  const medidas = [largura, altura, profundidade]
    .filter((valor) => possuiValorValido(valor))
    .map((valor) => String(valor).trim());

  return medidas.length > 0 ? medidas.join(' x ') : '-';
};

const obterDetalhesItemPDF = (item = {}) => ({
  cor: obterPrimeiroValorValido(item.cor, item.detalhes_solicitacao?.cor, item.produto?.cor),
  tecido: obterPrimeiroValorValido(item.tecido, item.detalhes_solicitacao?.tecido, item.produto?.tecido),
  tamanho: obterTamanhoItem(item),
  fabricante: obterPrimeiroValorValido(
    item.fabricante,
    item.fabricante_nome,
    item.marca,
    item.fornecedor_nome,
    item.detalhes_solicitacao?.fabricante,
    item.produto?.fabricante,
    item.produto?.fornecedor_nome
  )
});

const parseJSONSeguro = (valor, fallback = null) => {
  if (typeof valor !== 'string') return valor ?? fallback;
  try {
    return JSON.parse(valor);
  } catch (e) {
    void e;
    return fallback;
  }
};

const montarEndereco = ({ rua, numero, complemento, bairro, cidade, estado }) => {
  if (!possuiValorValido(rua)) return '-';

  let endereco = `${rua}, ${obterPrimeiroValorValido(numero, 's/n')}`;
  if (possuiValorValido(complemento)) endereco += ` - ${complemento}`;

  const localidade = [bairro, cidade, estado]
    .filter(possuiValorValido)
    .map((valor) => String(valor).trim())
    .join(' - ');

  if (localidade) endereco += `, ${localidade}`;
  return endereco;
};

const obterEnderecoEntregaPedido = (venda = {}, cliente = {}) => {
  const usarMesmoEndereco = cliente?.usar_mesmo_endereco !== false;

  if (!usarMesmoEndereco) {
    const enderecoEntregaCliente = montarEndereco({
      rua: cliente?.endereco_entrega_rua,
      numero: cliente?.endereco_entrega_numero,
      complemento: cliente?.endereco_entrega_complemento,
      bairro: cliente?.endereco_entrega_bairro,
      cidade: cliente?.endereco_entrega_cidade,
      estado: cliente?.endereco_entrega_estado
    });

    if (enderecoEntregaCliente !== '-') {
      return enderecoEntregaCliente;
    }
  }

  const enderecoPrincipalCliente = montarEndereco({
    rua: cliente?.endereco,
    numero: cliente?.numero,
    complemento: cliente?.complemento,
    bairro: cliente?.bairro,
    cidade: cliente?.cidade,
    estado: cliente?.estado
  });

  if (enderecoPrincipalCliente !== '-') return enderecoPrincipalCliente;
  return obterPrimeiroValorValido(venda?.endereco_entrega, 'Endereço não cadastrado');
};

const obterPontoReferenciaPedido = (venda = {}, cliente = {}) => (
  obterPrimeiroValorValido(
    venda?.endereco_entrega_ponto_referencia,
    cliente?.endereco_entrega_ponto_referencia,
    cliente?.ponto_referencia,
    ''
  )
);

const obterContatosAlternativosPedido = (cliente = {}) => {
  const contatos = [];

  if (possuiValorValido(cliente?.telefone_alternativo)) {
    contatos.push(`Telefone alternativo: ${String(cliente.telefone_alternativo).trim()}`);
  }

  const contatosExtras = parseJSONSeguro(cliente?.contatos, []);
  if (Array.isArray(contatosExtras)) {
    contatosExtras.forEach((contato, index) => {
      if (!contato) return;
      const nomeContato = obterPrimeiroValorValido(
        contato.nome,
        contato.tipo,
        `Contato ${index + 1}`
      );
      const telefoneContato = obterPrimeiroValorValido(contato.telefone, contato.celular, '');
      const emailContato = obterPrimeiroValorValido(contato.email, '');

      if (telefoneContato) {
        contatos.push(`${nomeContato}: ${telefoneContato}`);
      } else if (emailContato) {
        contatos.push(`${nomeContato}: ${emailContato}`);
      }
    });
  }

  return contatos;
};

const obterResumoMontagemPedido = (venda = {}) => {
  const montagemDireta = obterPrimeiroValorValido(venda?.tipo_montagem, venda?.montagem_status, '');
  if (montagemDireta) return montagemDireta;

  const itens = Array.isArray(venda?.itens) ? venda.itens : parseJSONSeguro(venda?.itens, []);
  if (!Array.isArray(itens) || itens.length === 0) return '-';

  const tipos = new Set();
  itens.forEach((item) => {
    const tipo = obterPrimeiroValorValido(item?.tipo_montagem, item?.detalhes_solicitacao?.tipo_montagem, '');
    if (tipo) tipos.add(tipo);
  });

  return tipos.size > 0 ? Array.from(tipos).join(', ') : '-';
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
            } catch (e) { void e; }
          };
          reader.readAsDataURL(blob);
        })
        .catch(() => { });
    }
  } catch (e) { void e; }
}

// PDF PARA O CLIENTE (limpo e elegante)
export function gerarNotaPedidoHTML(venda, cliente, vendedor, lojaInfo) {
  const logoSrc = getLogoSrc();
  const dataVenda = new Date(venda.data_venda).toLocaleDateString('pt-BR');

  const enderecoCompleto = obterEnderecoEntregaPedido(venda, cliente);
  const pontoReferencia = obterPontoReferenciaPedido(venda, cliente);
  const contatosAlternativos = obterContatosAlternativosPedido(cliente);

  const prazoEntrega = venda.prazo_entrega === "Retirado na loja" ? "Mercadoria retirada na loja pelo cliente" :
    venda.prazo_entrega === "15 dias" ? "15 dias úteis" :
      venda.prazo_entrega === "45 dias" ? "45 dias úteis" :
        (venda.prazo_entrega || '-');

  const nomeVendedor = vendedor || venda.responsavel_nome || '-';

  const itensHTML = venda.itens.map(item => {
    const detalhes = obterDetalhesItemPDF(item);
    const temDescontoItem = (item.desconto_item_percent || 0) > 0;
    const precoOriginalTotal = temDescontoItem && item.preco_original
      ? item.preco_original * (item.quantidade || 1)
      : item.subtotal;

    return `
    <tr>
      <td style="padding: 8px 10px; border-bottom: 1px solid #e5e5e5;">
        <div style="font-weight: 600; color: #1f2937;">${limparNomeProduto(item.produto_nome)}</div>
        <div style="margin-top: 3px; font-size: 11px; color: #6b7280; line-height: 1.45;">
          Cor: ${detalhes.cor} | Tecido: ${detalhes.tecido} | Tamanho: ${detalhes.tamanho} | Fabricante: ${detalhes.fabricante}
        </div>
        ${temDescontoItem ? `<div style="margin-top: 4px; font-size: 11px; color: #059669; font-weight: 600;">✂ Desconto ${item.desconto_item_percent}%: -R$ ${(item.desconto_item_valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>` : ''}
      </td>
      <td style="padding: 8px 10px; border-bottom: 1px solid #e5e5e5; text-align: center;">${item.quantidade}</td>
      <td style="padding: 8px 10px; border-bottom: 1px solid #e5e5e5; text-align: right;">
        ${temDescontoItem && item.preco_original
          ? `<span style="text-decoration: line-through; color: #9ca3af; font-size: 11px;">R$ ${item.preco_original.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span><br><span style="color: #059669; font-weight: 600;">R$ ${(item.preco_unitario || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>`
          : `R$ ${item.preco_unitario?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        }
      </td>
      <td style="padding: 8px 10px; border-bottom: 1px solid #e5e5e5; text-align: right; font-weight: 600;">
        ${temDescontoItem ? `<span style="text-decoration: line-through; color: #9ca3af; font-size: 11px;">R$ ${precoOriginalTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span><br><span style="color: #059669;">R$ ${item.subtotal?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>` : `R$ ${item.subtotal?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
      </td>
    </tr>
  `;
  }).join('');

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
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #333; font-size: 12px; }
        
        .header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 15px; border-bottom: 2px solid #07593f; margin-bottom: 15px; }
        .header-left { display: flex; align-items: center; gap: 15px; }
        .logo-img { width: 50px; height: auto; }
        .empresa-info { }
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
        .detalhes-grid { display: grid; grid-template-columns: 1fr; gap: 12px; margin-bottom: 15px; }
        .detalhes-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 12px; }
        .detalhes-box h4 { font-size: 9px; color: #6b7280; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.3px; }
        .detalhes-linha { font-size: 11px; color: #374151; line-height: 1.5; margin-bottom: 3px; }
        .detalhes-linha:last-child { margin-bottom: 0; }
        .obs-chip { margin-top: 6px; background: #fff7ed; border-left: 3px solid #f97316; border-radius: 4px; padding: 6px 8px; font-size: 11px; color: #9a3412; }
        
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th { background: #07593f; color: white; padding: 8px 10px; text-align: left; font-size: 11px; font-weight: 600; }
        
        .resumo-row { display: flex; gap: 15px; margin-top: 15px; }
        .resumo-box { flex: 1; background: #f9fafb; padding: 12px; border-radius: 6px; border: 1px solid #e5e5e5; }
        .resumo-titulo { font-size: 9px; color: #666; text-transform: uppercase; margin-bottom: 6px; font-weight: 600; }
        
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
            <div class="empresa-sub">Loja ${venda.loja}</div>
            ${lojaInfo?.cnpj ? `<div class="empresa-sub">CNPJ: ${lojaInfo.cnpj}</div>` : ''}
            ${lojaInfo?.endereco ? `<div class="empresa-sub">${lojaInfo.endereco}</div>` : ''}
            ${lojaInfo?.telefone ? `<div class="empresa-sub">Tel: ${lojaInfo.telefone}</div>` : ''}
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
        ${pontoReferencia ? `<div class="obs-chip"><strong>Ponto de referência:</strong> ${pontoReferencia}</div>` : ''}
      </div>

      <div class="info-row">
        <div class="info-tag"><span style="color:#666;">Prazo de Entrega</span><strong>${prazoEntrega}</strong></div>
        <div class="info-tag"><span style="color:#666;">Vendedor</span><strong>${nomeVendedor}</strong></div>
      </div>

      <div class="detalhes-grid">
        <div class="detalhes-box">
          <h4>Contatos</h4>
          <div class="detalhes-linha"><strong>Principal:</strong> ${cliente?.telefone || venda.cliente_telefone || '-'}</div>
          ${contatosAlternativos.length > 0
      ? contatosAlternativos.map((item) => `<div class="detalhes-linha">${item}</div>`).join('')
      : '<div class="detalhes-linha">Sem contatos alternativos</div>'}
        </div>
      </div>

      <table>
        <thead><tr><th>Produto</th><th style="text-align:center;width:60px;">Qtd</th><th style="text-align:right;width:90px;">Unitário</th><th style="text-align:right;width:90px;">Subtotal</th></tr></thead>
        <tbody>${itensHTML}</tbody>
      </table>

      <div class="resumo-row">
        <div class="resumo-box">
          <div class="resumo-titulo">Forma de Pagamento</div>
          <div style="font-size:12px;color:#333;">${pagamentosHTML}</div>
          ${venda.pagamento_na_entrega ? `<div style="margin-top:6px;font-size:12px;color:#059669;font-weight:600;">+ R$ ${venda.valor_pagamento_entrega?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} na entrega (${venda.forma_pagamento_entrega || 'A combinar'})</div>` : ''}
        </div>
        <div class="resumo-box">
          <div class="resumo-titulo">Valores</div>
          ${(() => {
            const totalDescontosItens = (venda.itens || []).reduce((acc, item) => acc + (item.desconto_item_valor || 0), 0);
            const subtotalBruto = (venda.itens || []).reduce((acc, item) => acc + ((item.preco_original || item.preco_unitario || 0) * (item.quantidade || 1)), 0);
            const temDescontoItens = totalDescontosItens > 0;
            const temDescontoGlobal = venda.desconto > 0;
            if (temDescontoItens || temDescontoGlobal) {
              return `
                ${temDescontoItens ? `<div class="total-linha"><span>Subtotal bruto:</span><span>R$ ${subtotalBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>` : ''}
                ${temDescontoItens ? `<div class="total-linha" style="color:#059669;"><span>Descontos em produtos:</span><span>-R$ ${totalDescontosItens.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>` : ''}
                ${temDescontoGlobal ? `<div class="total-linha" style="color:#059669;"><span>Desconto negociável:</span><span>-R$ ${Number(venda.desconto).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>` : ''}
              `;
            }
            return '';
          })()}
          <div class="total-linha total-final"><span>TOTAL:</span><span>R$ ${venda.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
        </div>
      </div>

      ${venda.observacoes ? `<div style="margin-top:12px;background:#fff7ed;padding:10px 12px;border-radius:4px;font-size:11px;color:#9a3412;border-left:3px solid #f97316;"><strong>Observações:</strong> ${venda.observacoes}</div>` : ''}

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
        <div class="footer-text"><strong>Móveis Pedro II</strong></div>
        <div class="footer-text" style="margin-top:3px;font-size:8px;color:#999;">Emitido em ${new Date().toLocaleString('pt-BR')}</div>
      </div>
    </body>
    </html>
  `;
}

// PDF INTERNO (para entregadores - com destaque de pagamento)
export function gerarNotaInternaHTML(venda, cliente, vendedor) {
  const enderecoCompleto = obterEnderecoEntregaPedido(venda, cliente);
  const pontoReferencia = obterPontoReferenciaPedido(venda, cliente);
  const contatosAlternativos = obterContatosAlternativosPedido(cliente);

  const nfeNumero = obterPrimeiroValorValido(venda?.nfe_numero, venda?.numero_nfe, '-');
  const nfeStatus = obterPrimeiroValorValido(venda?.nfe_status, venda?.status_nfe, '-');
  const nfeChave = obterPrimeiroValorValido(venda?.nfe_chave, venda?.chave_nfe, '-');
  const resumoMontagem = obterResumoMontagemPedido(venda);

  const itensHTML = venda.itens.map(item => {
    const detalhes = obterDetalhesItemPDF(item);
    return `<tr>
      <td style="padding:5px;border-bottom:1px solid #ddd;">
        <div style="font-weight:600;">${limparNomeProduto(item.produto_nome)}</div>
        <div style="margin-top:2px;font-size:10px;color:#6b7280;line-height:1.4;">
          Cor: ${detalhes.cor} | Tecido: ${detalhes.tecido} | Tamanho: ${detalhes.tamanho} | Fabricante: ${detalhes.fabricante}
        </div>
      </td>
      <td style="padding:5px;border-bottom:1px solid #ddd;text-align:center;">${item.quantidade}</td>
    </tr>`;
  }).join('');

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
        .box-titulo { font-size: 11px; color: #666; text-transform: uppercase; margin-bottom: 5px; }
        .box-valor { font-size: 14px; font-weight: bold; color: #333; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #333; color: white; padding: 8px; text-align: left; font-size: 11px; }
        .pagamento-destaque { border: 4px dashed #10b981; background: #ecfdf5; padding: 20px; border-radius: 10px; margin-top: 15px; text-align: center; }
        .pagamento-titulo { color: #065f46; font-size: 14px; font-weight: bold; margin-bottom: 10px; }
        .pagamento-valor { font-size: 32px; font-weight: bold; color: #059669; }
        .pagamento-forma { color: #065f46; margin-top: 8px; font-size: 14px; }
        .detalhes-op { margin-top: 12px; padding: 10px 12px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; }
        .detalhes-op-linha { font-size: 11px; color: #7c2d12; margin-bottom: 4px; line-height: 1.4; }
        .detalhes-op-linha:last-child { margin-bottom: 0; }
        @media print { body { padding: 10px; } .pagamento-destaque { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style>
    </head>
    <body>
      <div class="titulo">📋 CONTROLE INTERNO - PEDIDO #${venda.numero_pedido}</div>
      
      <div class="grid">
        <div class="box"><div class="box-titulo">Cliente</div><div class="box-valor">${cliente?.nome_completo || venda.cliente_nome}</div><div style="font-size:11px;color:#666;margin-top:4px;">Tel: ${cliente?.telefone || venda.cliente_telefone}</div>${contatosAlternativos.length > 0 ? `<div style="font-size:10px;color:#6b7280;margin-top:6px;">${contatosAlternativos.join(' • ')}</div>` : ''}</div>
        <div class="box"><div class="box-titulo">Endereço</div><div class="box-valor" style="font-size:12px;">${enderecoCompleto}</div></div>
        <div class="box"><div class="box-titulo">Vendedor</div><div class="box-valor">${vendedor || venda.responsavel_nome || '-'}</div></div>
        <div class="box"><div class="box-titulo">Status</div><div class="box-valor">${venda.prazo_entrega === 'Retirado na loja' ? '🏪 RETIRADA' : '🚚 ENTREGA'}</div></div>
      </div>

      ${(pontoReferencia || venda?.observacoes || resumoMontagem !== '-' || nfeNumero !== '-') ? `
        <div class="detalhes-op">
          ${pontoReferencia ? `<div class="detalhes-op-linha"><strong>Ponto de referência:</strong> ${pontoReferencia}</div>` : ''}
          ${resumoMontagem !== '-' ? `<div class="detalhes-op-linha"><strong>Montagem:</strong> ${resumoMontagem}</div>` : ''}
          ${(nfeNumero !== '-' || nfeStatus !== '-' || nfeChave !== '-') ? `<div class="detalhes-op-linha"><strong>NFe:</strong> ${nfeNumero} | <strong>Status:</strong> ${nfeStatus}${nfeChave !== '-' ? ` | <strong>Chave:</strong> ${nfeChave}` : ''}</div>` : ''}
          ${venda?.observacoes ? `<div class="detalhes-op-linha"><strong>Observações do pedido:</strong> ${venda.observacoes}</div>` : ''}
        </div>
      ` : ''}

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

export function abrirNotaPedidoPDF(venda, cliente, vendedor, lojaInfo) {
  const html = gerarNotaPedidoHTML(venda, cliente, vendedor, lojaInfo);
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
  printWindow.document.write(`
    <html>
    <head>
      <title>Gerando Nota...</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          font-family: 'Segoe UI', Arial, sans-serif;
          background: #f9fafb;
          color: #374151;
        }
        .card {
          text-align: center;
          padding: 40px 48px;
          background: white;
          border-radius: 16px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.08);
          min-width: 320px;
          border: 1px solid #e5e7eb;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .logo {
          font-size: 20px;
          font-weight: 700;
          color: #07593f;
          margin-bottom: 24px;
          letter-spacing: -0.3px;
        }
        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #e5e7eb;
          border-top-color: #07593f;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin: 0 auto 20px;
        }
        .card[data-state="error"] {
          border-color: #fecaca;
          box-shadow: 0 8px 30px rgba(185, 28, 28, 0.12);
        }
        .card[data-state="error"] .spinner {
          border-color: #fee2e2;
          border-top-color: #dc2626;
        }
        .card[data-state="error"] .label {
          color: #b91c1c;
        }
        .card[data-state="error"] .step {
          color: #991b1b;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .label {
          font-size: 14px;
          color: #6b7280;
          margin-bottom: 20px;
        }
        .bar-track {
          width: 100%;
          height: 6px;
          background: #e5e7eb;
          border-radius: 99px;
          overflow: hidden;
        }
        .bar-fill {
          height: 100%;
          width: 14%;
          background: linear-gradient(90deg, #07593f, #10b981);
          border-radius: 99px;
          transition: width 0.25s ease, background 0.2s ease;
        }
        .card[data-state="error"] .bar-fill {
          background: linear-gradient(90deg, #dc2626, #f87171);
        }
        .step {
          font-size: 11px;
          color: #9ca3af;
          margin-top: 12px;
        }
      </style>
    </head>
    <body>
      <div class="card" id="progress-card" data-state="loading">
        <div class="logo">Móveis Pedro II</div>
        <div class="spinner"></div>
        <p class="label" id="progress-label">Finalizando pedido...</p>
        <div class="bar-track">
          <div class="bar-fill" id="progress-bar"></div>
        </div>
        <p class="step" id="progress-step">Salvando venda...</p>
      </div>
    </body>
    </html>
  `);
  return printWindow;
}

export function atualizarStatusNotaPedidoPDF(printWindow, status) {
  atualizarUIProgresso(printWindow, status);
}

export function sinalizarErroNotaPedidoPDF(printWindow, mensagem = 'Nao foi possivel concluir o pedido.') {
  atualizarUIProgresso(printWindow, {
    label: 'Nao foi possivel finalizar o pedido',
    step: mensagem,
    error: true
  });
}

/**
 * Preenche e imprime a janela já aberta com os dados da nota
 */
export function preencherEImprimirPDF(printWindow, venda, cliente, vendedor, lojaInfo) {
  if (!printWindow) {
    // Se por algum motivo a janela não existe, tenta abrir normalmente
    console.warn('Janela não disponível, tentando abrir nova...');
    abrirNotaPedidoPDF(venda, cliente, vendedor, lojaInfo);
    return;
  }

  atualizarUIProgresso(printWindow, {
    label: 'Pedido concluido',
    step: 'Preparando impressao...',
    progress: 100
  });

  const html = gerarNotaPedidoHTML(venda, cliente, vendedor, lojaInfo);
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

export function enviarWhatsApp(telefone, numeroPedido, valorTotal, nomeCliente, prazoEntrega = '') {
  // Limpa o telefone para formato internacional
  let tel = telefone?.replace(/\D/g, '') || '';
  if (tel.length === 11) tel = '55' + tel;
  if (tel.length === 10) tel = '55' + tel;

  const isRetirada = prazoEntrega === 'Retirado na loja' || prazoEntrega === 'Retirada';

  const mensagem = encodeURIComponent(
    `Olá ${nomeCliente}! 🪑\n\n` +
    `Seu pedido *#${numeroPedido}* foi registrado com sucesso!\n\n` +
    `💰 *Valor Total:* R$ ${valorTotal?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n` +
    (isRetirada
      ? `Esperamos que você aproveite muito sua compra! 😍`
      : `Em breve entraremos em contato para agendar a entrega.`
    ) + `\n\n` +
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
export async function gerarNotaPedidoBase64(venda, cliente, vendedor, lojaInfo) {
  try {
    const htmlContent = gerarNotaPedidoHTML(venda, cliente, vendedor, lojaInfo);

    // Criar container temporário 
    const container = document.createElement('div');
    container.innerHTML = htmlContent;

    // Estilos cruciais para o html2canvas capturar corretamente
    // Posicionado no topo esquerdo mas invisível, para garantir que seja renderizado
    container.style.position = 'absolute';
    container.style.left = '0';
    container.style.top = '0';
    container.style.width = '210mm';
    container.style.minHeight = '297mm';
    container.style.backgroundColor = '#ffffff'; // Fundo branco explícito
    container.style.color = '#000000'; // Texto preto explícito
    container.style.zIndex = '-9999'; // Atrás de tudo
    container.style.opacity = '0'; // Invisível
    container.style.pointerEvents = 'none'; // Não interfere no clique

    const appRoot = document.getElementById('root') || document.body;
    appRoot.appendChild(container);

    // Aguardar renderização e carregamento de imagens
    // 300ms é suficiente — era 1000ms antes (melhoria de performance)
    await new Promise(resolve => setTimeout(resolve, 300));

    // Configurações do PDF OTIMIZADAS
    const opt = {
      margin: [10, 10, 10, 10],
      filename: `Pedido_${venda.numero_pedido}.pdf`,
      image: { type: 'jpeg', quality: 0.85 }, // era 0.98 — qualidade ainda ótima, muito mais rápido
      html2canvas: {
        scale: 1.5,           // era 2 — ainda nítido, mas processa bem mais rápido
        useCORS: true,
        letterRendering: true,
        scrollY: 0,
        scrollX: 0,
        windowWidth: 800,
        backgroundColor: '#ffffff'
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // Gerar PDF como blob
    const pdfBlob = await html2pdf().set(opt).from(container).outputPdf('blob');

    // Remover container
    appRoot.removeChild(container);

    // Converter blob para base64
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Verifica se o resultado é válido
        if (reader.result) {
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        } else {
          reject(new Error("Falha na conversão para Base64"));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(pdfBlob);
    });
  } catch (error) {
    console.error('Erro ao gerar PDF base64:', error);
    return null;
  }
}