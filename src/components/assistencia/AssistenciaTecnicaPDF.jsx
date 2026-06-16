import { EMPRESA } from "@/config/empresa";
import { stripInternalProductPrefixes } from "@/utils/productReference";

const LOGO_URL = EMPRESA.logo_url;
const LOGO_CACHE_KEY = "moveis_pedro_ii_logo_cache";

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

const obterEnderecoEntrega = (venda = {}, cliente = {}) => {
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

    if (enderecoEntregaCliente !== '-') return enderecoEntregaCliente;
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

const obterPontoReferencia = (venda = {}, cliente = {}) => (
  obterPrimeiroValorValido(
    venda?.endereco_entrega_ponto_referencia,
    cliente?.endereco_entrega_ponto_referencia,
    cliente?.ponto_referencia,
    ''
  )
);

const obterContatosAlternativos = (cliente = {}) => {
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

      if (telefoneContato !== '-') {
        contatos.push(`${nomeContato}: ${telefoneContato}`);
      } else if (emailContato !== '-') {
        contatos.push(`${nomeContato}: ${emailContato}`);
      }
    });
  }

  return contatos;
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

const obterDetalhesItem = (item = {}, produtoCatalogo = null) => ({
  cor: obterPrimeiroValorValido(item.cor, item.detalhes_solicitacao?.cor, item.produto?.cor, produtoCatalogo?.cor),
  tecido: obterPrimeiroValorValido(item.tecido, item.detalhes_solicitacao?.tecido, item.produto?.tecido, produtoCatalogo?.tecido),
  tamanho: obterTamanhoItem(item),
  fabricante: obterPrimeiroValorValido(
    item.fabricante,
    item.fabricante_nome,
    item.marca,
    item.fornecedor_nome,
    item.detalhes_solicitacao?.fabricante,
    item.produto?.fabricante,
    item.produto?.fornecedor_nome,
    produtoCatalogo?.fabricante,
    produtoCatalogo?.fornecedor_nome
  ),
  gtin: obterPrimeiroValorValido(item.gtin, item.produto?.gtin, produtoCatalogo?.gtin, ''),
  sku: obterPrimeiroValorValido(item.sku, item.produto?.sku, produtoCatalogo?.sku, ''),
  volumes: obterPrimeiroValorValido(item.volumes, item.produto?.volumes, produtoCatalogo?.volumes, '')
});

const enriquecerItemAssistencia = (itemAssistencia, venda, produtos = []) => {
  const itensVenda = Array.isArray(venda?.itens)
    ? venda.itens
    : parseJSONSeguro(venda?.itens, []);

  const itemVenda = itensVenda.find(
    (i) => String(i.produto_id) === String(itemAssistencia.produto_id)
  ) || {};

  const produtoCatalogo = produtos.find(
    (p) => String(p.id) === String(itemAssistencia.produto_id)
  ) || null;

  return {
    ...itemVenda,
    ...itemAssistencia,
    produto_nome: itemAssistencia.produto_nome || itemVenda.produto_nome,
    quantidade: itemAssistencia.quantidade ?? itemVenda.quantidade ?? 1,
    problema: itemAssistencia.problema || '',
    produtoCatalogo
  };
};

const obterDetalhesProdutoSai = (itemAssistencia, produtos = []) => {
  const produtoId = itemAssistencia.produto_sai_id || itemAssistencia.produto_id;
  const produto = produtos.find((p) => String(p.id) === String(produtoId)) || null;
  return {
    nome: itemAssistencia.produto_sai_nome || (produto ? produto.nome : itemAssistencia.produto_nome),
    quantidade: itemAssistencia.produto_sai_quantidade || itemAssistencia.quantidade || 1,
    produtoCatalogo: produto
  };
};

const formatarData = (data) => {
  if (!data) return '-';
  try {
    return new Date(data).toLocaleDateString('pt-BR');
  } catch {
    return String(data);
  }
};

const formatarMoeda = (valor) => {
  const num = Number(valor) || 0;
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
};

export function gerarAssistenciaTecnicaHTML(assistencia, venda, cliente, lojaInfo, produtos = []) {
  const logoSrc = getLogoSrc();
  const dataAbertura = formatarData(assistencia.data_abertura);
  const dataResolucao = assistencia.data_resolucao ? formatarData(assistencia.data_resolucao) : null;

  const enderecoCompleto = obterEnderecoEntrega(venda, cliente);
  const pontoReferencia = obterPontoReferencia(venda, cliente);
  const contatosAlternativos = obterContatosAlternativos(cliente);
  const telefonePrincipal = obterPrimeiroValorValido(
    cliente?.telefone,
    assistencia.cliente_telefone,
    venda?.cliente_telefone
  );

  const itensEnriquecidos = (assistencia.itens_envolvidos || []).map((item) =>
    enriquecerItemAssistencia(item, venda, produtos)
  );

  const isTroca = assistencia.tipo === 'Troca';
  let itensHTML = '';

  if (isTroca) {
    const itensEntraHTML = itensEnriquecidos.length > 0
      ? itensEnriquecidos.map((item) => {
        const detalhes = obterDetalhesItem(item, item.produtoCatalogo);
        const specs = [
          `Cor: ${detalhes.cor}`,
          `Tecido: ${detalhes.tecido}`,
          `Tamanho: ${detalhes.tamanho}`,
          `Fabricante: ${detalhes.fabricante}`
        ];
        if (detalhes.gtin && detalhes.gtin !== '-') specs.push(`GTIN: ${detalhes.gtin}`);
        if (detalhes.sku && detalhes.sku !== '-') specs.push(`SKU: ${detalhes.sku}`);
        if (detalhes.volumes && detalhes.volumes !== '-') specs.push(`Volumes: ${detalhes.volumes}`);

        return `
          <tr>
            <td style="padding: 8px 10px; border-bottom: 1px solid #e5e5e5;">
              <div style="font-weight: 600; color: #c2410c;">${limparNomeProduto(item.produto_nome)}</div>
              <div style="margin-top: 3px; font-size: 11px; color: #6b7280; line-height: 1.45;">
                ${specs.join(' | ')}
              </div>
              ${item.problema ? `<div style="margin-top: 5px; font-size: 11px; color: #b45309; background: #fffbeb; padding: 4px 8px; border-radius: 4px; border-left: 3px solid #f59e0b;"><strong>Problema do item:</strong> ${item.problema}</div>` : ''}
            </td>
            <td style="padding: 8px 10px; border-bottom: 1px solid #e5e5e5; text-align: center;">${item.quantidade}</td>
          </tr>
        `;
      }).join('')
      : `<tr><td colspan="2" style="padding: 12px; text-align: center; color: #6b7280; font-size: 11px;">Nenhum item selecionado</td></tr>`;

    const itensSaiHTML = (assistencia.itens_envolvidos || []).length > 0
      ? (assistencia.itens_envolvidos || []).map((item) => {
        const saiInfo = obterDetalhesProdutoSai(item, produtos);
        const detalhes = obterDetalhesItem({}, saiInfo.produtoCatalogo);
        const specs = [];
        if (detalhes.cor && detalhes.cor !== '-') specs.push(`Cor: ${detalhes.cor}`);
        if (detalhes.tecido && detalhes.tecido !== '-') specs.push(`Tecido: ${detalhes.tecido}`);
        if (detalhes.tamanho && detalhes.tamanho !== '-') specs.push(`Tamanho: ${detalhes.tamanho}`);
        if (detalhes.fabricante && detalhes.fabricante !== '-') specs.push(`Fabricante: ${detalhes.fabricante}`);
        if (detalhes.volumes && detalhes.volumes !== '-') specs.push(`Volumes: ${detalhes.volumes}`);

        return `
          <tr>
            <td style="padding: 8px 10px; border-bottom: 1px solid #e5e5e5;">
              <div style="font-weight: 600; color: #07593f;">${limparNomeProduto(saiInfo.nome)}</div>
              ${specs.length > 0 ? `<div style="margin-top: 3px; font-size: 11px; color: #6b7280; line-height: 1.45;">${specs.join(' | ')}</div>` : ''}
            </td>
            <td style="padding: 8px 10px; border-bottom: 1px solid #e5e5e5; text-align: center;">${saiInfo.quantidade}</td>
          </tr>
        `;
      }).join('')
      : `<tr><td colspan="2" style="padding: 12px; text-align: center; color: #6b7280; font-size: 11px;">Nenhum item de saída selecionado</td></tr>`;

    itensHTML = `
      <div style="margin-bottom: 15px;">
        <div class="section-title" style="color: #c2410c; border-bottom: 1px solid #fed7aa; padding-bottom: 4px; font-weight: bold; font-size: 11px;">Produtos que ENTRAN (Devolução do Cliente)</div>
        <table>
          <thead>
            <tr style="background: #c2410c;">
              <th style="color: white;">Produto e Características</th>
              <th style="text-align:center;width:60px;color:white;">Qtd</th>
            </tr>
          </thead>
          <tbody>
            ${itensEntraHTML}
          </tbody>
        </table>
      </div>
      <div style="margin-top: 15px;">
        <div class="section-title" style="color: #07593f; border-bottom: 1px solid #a7f3d0; padding-bottom: 4px; font-weight: bold; font-size: 11px;">Produtos que SAEM (Nova Entrega ao Cliente)</div>
        <table>
          <thead>
            <tr style="background: #07593f;">
              <th style="color: white;">Produto e Características</th>
              <th style="text-align:center;width:60px;color:white;">Qtd</th>
            </tr>
          </thead>
          <tbody>
            ${itensSaiHTML}
          </tbody>
        </table>
      </div>
    `;
  } else {
    const rows = itensEnriquecidos.length > 0
      ? itensEnriquecidos.map((item) => {
        const detalhes = obterDetalhesItem(item, item.produtoCatalogo);
        const specs = [
          `Cor: ${detalhes.cor}`,
          `Tecido: ${detalhes.tecido}`,
          `Tamanho: ${detalhes.tamanho}`,
          `Fabricante: ${detalhes.fabricante}`
        ];
        if (detalhes.gtin && detalhes.gtin !== '-') specs.push(`GTIN: ${detalhes.gtin}`);
        if (detalhes.sku && detalhes.sku !== '-') specs.push(`SKU: ${detalhes.sku}`);
        if (detalhes.volumes && detalhes.volumes !== '-') specs.push(`Volumes: ${detalhes.volumes}`);

        return `
          <tr>
            <td style="padding: 8px 10px; border-bottom: 1px solid #e5e5e5;">
              <div style="font-weight: 600; color: #1f2937;">${limparNomeProduto(item.produto_nome)}</div>
              <div style="margin-top: 3px; font-size: 11px; color: #6b7280; line-height: 1.45;">
                ${specs.join(' | ')}
              </div>
              ${item.problema ? `<div style="margin-top: 5px; font-size: 11px; color: #b45309; background: #fffbeb; padding: 4px 8px; border-radius: 4px; border-left: 3px solid #f59e0b;"><strong>Problema do item:</strong> ${item.problema}</div>` : ''}
            </td>
            <td style="padding: 8px 10px; border-bottom: 1px solid #e5e5e5; text-align: center;">${item.quantidade}</td>
          </tr>
        `;
      }).join('')
      : `<tr><td colspan="2" style="padding: 12px; text-align: center; color: #6b7280; font-size: 11px;">Nenhum item selecionado do pedido</td></tr>`;

    itensHTML = `
      <div class="section">
        <div class="section-title">Itens Selecionados do Pedido</div>
        <table>
          <thead>
            <tr>
              <th>Produto e Características</th>
              <th style="text-align:center;width:60px;">Qtd</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  const historicoHTML = (assistencia.historico || []).length > 0
    ? (assistencia.historico || []).map((h) => `
        <div class="detalhes-linha">
          ${formatarData(h.data)} — ${h.status_anterior ? `${h.status_anterior} → ` : ''}${h.status_novo || '-'}
          ${h.usuario ? ` <span style="color:#9ca3af;">(${h.usuario})</span>` : ''}
        </div>
      `).join('')
    : '<div class="detalhes-linha">Sem histórico registrado</div>';

  const lojaNome = venda?.loja || lojaInfo?.nome || '-';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Assistência Técnica - Pedido #${assistencia.numero_pedido}</title>
      <style>
        @page { size: A4; margin: 12mm; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #333; font-size: 12px; }

        .header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 15px; border-bottom: 2px solid #07593f; margin-bottom: 15px; }
        .header-left { display: flex; align-items: center; gap: 15px; }
        .logo-img { width: 50px; height: auto; }
        .empresa-nome { font-size: 16px; font-weight: bold; color: #07593f; }
        .empresa-sub { font-size: 11px; color: #666; }
        .doc-info { text-align: right; }
        .doc-titulo { font-size: 18px; font-weight: bold; color: #07593f; }
        .doc-sub { font-size: 11px; color: #666; margin-top: 2px; }

        .cliente-section { background: #f8fafc; padding: 12px 15px; border-radius: 6px; margin-bottom: 15px; border-left: 4px solid #07593f; }
        .cliente-nome { font-size: 14px; font-weight: bold; color: #07593f; margin-bottom: 4px; }
        .cliente-detalhe { color: #555; font-size: 11px; line-height: 1.6; }

        .info-row { display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap; }
        .info-tag { background: #f0f9ff; border: 1px solid #bfdbfe; padding: 8px 12px; border-radius: 4px; font-size: 11px; flex: 1; min-width: 120px; text-align: center; }
        .info-tag strong { display: block; font-size: 12px; color: #07593f; margin-top: 2px; }
        .info-tag.tipo { background: #fff7ed; border-color: #fed7aa; }
        .info-tag.tipo strong { color: #c2410c; }
        .info-tag.urgente { background: #fef2f2; border-color: #fecaca; }
        .info-tag.urgente strong { color: #dc2626; }

        .section { margin-bottom: 15px; }
        .section-title { font-size: 10px; color: #07593f; text-transform: uppercase; font-weight: 700; letter-spacing: 0.4px; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
        .problema-box { background: #fff7ed; border: 1px solid #fed7aa; border-left: 4px solid #f97316; border-radius: 6px; padding: 12px; font-size: 12px; color: #7c2d12; line-height: 1.6; }
        .solucao-box { background: #ecfdf5; border: 1px solid #a7f3d0; border-left: 4px solid #10b981; border-radius: 6px; padding: 12px; font-size: 12px; color: #065f46; line-height: 1.6; }

        .detalhes-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 15px; }
        .detalhes-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 12px; }
        .detalhes-box h4 { font-size: 9px; color: #6b7280; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.3px; }
        .detalhes-linha { font-size: 11px; color: #374151; line-height: 1.5; margin-bottom: 3px; }
        .detalhes-linha:last-child { margin-bottom: 0; }
        .obs-chip { margin-top: 6px; background: #fff7ed; border-left: 3px solid #f97316; border-radius: 4px; padding: 6px 8px; font-size: 11px; color: #9a3412; }

        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th { background: #07593f; color: white; padding: 8px 10px; text-align: left; font-size: 11px; font-weight: 600; }

        .valores-row { display: flex; gap: 12px; margin-top: 12px; }
        .valor-box { flex: 1; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 12px; text-align: center; }
        .valor-label { font-size: 9px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px; }
        .valor-num { font-size: 16px; font-weight: bold; color: #07593f; }

        .footer { text-align: center; padding-top: 12px; border-top: 1px dashed #ccc; margin-top: 20px; }
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
          <div>
            <div class="empresa-nome">Móveis Pedro II</div>
            <div class="empresa-sub">Loja ${lojaNome}</div>
            ${lojaInfo?.cnpj ? `<div class="empresa-sub">CNPJ: ${lojaInfo.cnpj}</div>` : ''}
            ${lojaInfo?.endereco ? `<div class="empresa-sub">${lojaInfo.endereco}</div>` : ''}
            ${lojaInfo?.telefone ? `<div class="empresa-sub">Tel: ${lojaInfo.telefone}</div>` : ''}
          </div>
        </div>
        <div class="doc-info">
          <div class="doc-titulo">Assistência Técnica</div>
          <div class="doc-sub">Pedido #${assistencia.numero_pedido}</div>
          <div class="doc-sub">Abertura: ${dataAbertura}</div>
          ${dataResolucao ? `<div class="doc-sub">Resolução: ${dataResolucao}</div>` : ''}
        </div>
      </div>

      <div class="cliente-section">
        <div class="cliente-nome">${cliente?.nome_completo || assistencia.cliente_nome}</div>
        <div class="cliente-detalhe">
          CPF: ${cliente?.cpf || '-'} &nbsp;|&nbsp; Tel: ${telefonePrincipal}<br/>
          ${enderecoCompleto}
        </div>
        ${pontoReferencia && pontoReferencia !== '-' ? `<div class="obs-chip"><strong>Ponto de referência:</strong> ${pontoReferencia}</div>` : ''}
      </div>

      <div class="info-row">
        <div class="info-tag tipo"><span style="color:#666;">Tipo de Assistência</span><strong>${assistencia.tipo || '-'}</strong></div>
        <div class="info-tag"><span style="color:#666;">Status</span><strong>${assistencia.status || '-'}</strong></div>
        <div class="info-tag ${assistencia.prioridade === 'Urgente' ? 'urgente' : ''}"><span style="color:#666;">Prioridade</span><strong>${assistencia.prioridade || 'Normal'}</strong></div>
        <div class="info-tag"><span style="color:#666;">Nº da Venda</span><strong>#${assistencia.numero_pedido}</strong></div>
      </div>

      <div class="detalhes-grid">
        <div class="detalhes-box">
          <h4>Contatos</h4>
          <div class="detalhes-linha"><strong>Principal:</strong> ${telefonePrincipal}</div>
          ${cliente?.email ? `<div class="detalhes-linha"><strong>E-mail:</strong> ${cliente.email}</div>` : ''}
          ${contatosAlternativos.length > 0
      ? contatosAlternativos.map((item) => `<div class="detalhes-linha">${item}</div>`).join('')
      : '<div class="detalhes-linha">Sem contatos alternativos</div>'}
        </div>
        <div class="detalhes-box">
          <h4>Informações do Pedido</h4>
          <div class="detalhes-linha"><strong>Data da venda:</strong> ${venda?.data_venda ? formatarData(venda.data_venda) : '-'}</div>
          <div class="detalhes-linha"><strong>Vendedor:</strong> ${obterPrimeiroValorValido(venda?.responsavel_nome, '-')}</div>
          <div class="detalhes-linha"><strong>Prazo entrega:</strong> ${obterPrimeiroValorValido(venda?.prazo_entrega, '-')}</div>
          ${assistencia.responsavel_nome ? `<div class="detalhes-linha"><strong>Responsável AT:</strong> ${assistencia.responsavel_nome}</div>` : ''}
          ${assistencia.responsabilidade_montador ? `<div class="detalhes-linha" style="color:#b45309;"><strong>Responsabilidade do montador</strong></div>` : ''}
        </div>
      </div>

      <div class="section">
        <div class="section-title">Descrição do Problema</div>
        <div class="problema-box">${assistencia.descricao_problema || '-'}</div>
      </div>

      <div class="section">
        <div class="section-title">Solução Aplicada</div>
        <div class="solucao-box">${assistencia.solucao_aplicada || '-'}</div>
      </div>

      ${itensHTML}

      ${(Number(assistencia.valor_devolvido) > 0 || Number(assistencia.valor_cobrado) > 0) ? `
        <div class="valores-row">
          ${Number(assistencia.valor_devolvido) > 0 ? `
            <div class="valor-box">
              <div class="valor-label">Valor Devolvido</div>
              <div class="valor-num" style="color:#dc2626;">R$ ${formatarMoeda(assistencia.valor_devolvido)}</div>
            </div>
          ` : ''}
          ${Number(assistencia.valor_cobrado) > 0 ? `
            <div class="valor-box">
              <div class="valor-label">Valor Cobrado</div>
              <div class="valor-num">R$ ${formatarMoeda(assistencia.valor_cobrado)}</div>
            </div>
          ` : ''}
        </div>
      ` : ''}

      ${assistencia.observacoes ? `
        <div class="section" style="margin-top:15px;">
          <div class="section-title">Observações Internas</div>
          <div class="detalhes-box">${assistencia.observacoes}</div>
        </div>
      ` : ''}

      <div class="section" style="margin-top:15px;">
        <div class="section-title">Histórico de Status</div>
        <div class="detalhes-box">${historicoHTML}</div>
      </div>

      <div class="footer">
        <div class="footer-text"><strong>Móveis Pedro II</strong> — Assistência Técnica</div>
        <div class="footer-text" style="margin-top:3px;font-size:9px;color:#999;">Emitido em ${new Date().toLocaleString('pt-BR')}</div>
      </div>
    </body>
    </html>
  `;
}

export function abrirAssistenciaTecnicaPDF(assistencia, venda, cliente, lojaInfo, produtos = []) {
  const html = gerarAssistenciaTecnicaHTML(assistencia, venda, cliente, lojaInfo, produtos);
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
