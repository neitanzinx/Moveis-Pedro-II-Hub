/**
 * NfeGenerator.js
 * Serviço para geração de XML de NF-e (Layout 4.00) compatível com Emissor Sebrae.
 * Focado em regime Simples Nacional (CSOSN 102).
 */

import { format } from "date-fns";

export const NfeGenerator = {
    /**
     * Gera o XML completo da NF-e
     * @param {Object} venda - Dados da venda
     * @param {Object} emitente - Dados da empresa (configurações)
     * @param {Object} cliente - Dados do cliente
     * @returns {string} XML string
     */
    generateXML: (venda, emitente, cliente) => {
        if (!emitente?.cnpj || !cliente?.cpf_cnpj) {
            throw new Error("Dados de Emitente ou Cliente incompletos (CNPJ/CPF obrigatórios).");
        }

        const nfeId = generateAccessKey(emitente, venda); // Gera chave de acesso

        // Montagem das Seções
        const ide = buildIde(venda, emitente);
        const emit = buildEmit(emitente);
        const dest = buildDest(cliente);
        const det = buildDet(venda.itens);
        const total = buildTotal(venda);
        const transp = buildTransp();
        const pag = buildPag(venda);
        const infAdic = buildInfAdic(venda);

        // Template Final
        return `
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
    <infNFe Id="${nfeId}" versao="4.00">
        ${ide}
        ${emit}
        ${dest}
        ${det}
        ${total}
        ${transp}
        ${pag}
        ${infAdic}
    </infNFe>
</NFe>`.trim();
    }
};

// --- Helper Functions ---

const generateAccessKey = (emitente, venda) => {
    // Implementação simplificada da Chave de Acesso (44 dígitos)
    // UF(2) + AAMM(4) + CNPJ(14) + Mod(2) + Serie(3) + nNF(9) + tpEmis(1) + cNF(8) + DV(1)
    // Para fins de IMPORTAÇÃO no Sebrae, não precisamos assinar/validar a chave rigorosamente aqui,
    // pois o Sebrae vai gerar/validar ao importar. Mas precisamos de um ID único para o XML.
    // Usaremos um dummy ou geraremos algo próximo do real.
    const uf = emitente.endereco_fiscal?.municipio_codigo?.substring(0, 2) || '35'; // Default SP
    const aamm = format(new Date(), 'yyMM');
    const cnpj = emitente.cnpj.replace(/\D/g, '');
    const mod = '55';
    const serie = '001';
    const nNr = String(venda.id).padStart(9, '0'); // Numero da nota = ID da venda (simplificado)
    const tpEmis = '1';
    const cNF = '12345678'; // Código aleatório
    const keyBase = `${uf}${aamm}${cnpj}${mod}${serie}${nNr}${tpEmis}${cNF}`;

    // Calculo DV (módulo 11) - simplificado, retorna 0 se falhar
    const dv = calculateDV(keyBase);

    return `NFe${keyBase}${dv}`;
};

const calculateDV = (key) => {
    // Algoritmo módulo 11 padrão da NF-e
    let soma = 0;
    let peso = 2;
    for (let i = key.length - 1; i >= 0; i--) {
        soma += parseInt(key[i]) * peso;
        peso = peso === 9 ? 2 : peso + 1;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
};

const buildIde = (venda, emitente) => {
    const dataEmissao = new Date().toISOString().split('.')[0] + '-03:00'; // Formato: YYYY-MM-DDThh:mm:ssTZD
    return `
        <ide>
            <cUF>${emitente.endereco_fiscal?.municipio_codigo?.substring(0, 2) || '35'}</cUF>
            <cNF>12345678</cNF>
            <natOp>Venda de Mercadoria</natOp>
            <mod>55</mod>
            <serie>1</serie>
            <nNF>${venda.id}</nNF>
            <dhEmi>${dataEmissao}</dhEmi>
            <tpNF>1</tpNF>
            <idDest>1</idDest>
            <cMunFG>${emitente.endereco_fiscal?.municipio_codigo || '3550308'}</cMunFG>
            <tpImp>1</tpImp>
            <tpEmis>1</tpEmis>
            <cDV>${calculateDV('0')}</cDV> {/* DV placeholder */}
            <tpAmb>2</tpAmb> {/* 2 = Homologação (Teste), 1 = Produção */}
            <finNFe>1</finNFe>
            <indFinal>1</indFinal>
            <indPres>1</indPres>
            <procEmi>0</procEmi>
            <verProc>ERP_MOVEIS_1.0</verProc>
        </ide>`;
};

const buildEmit = (emitente) => {
    return `
        <emit>
            <CNPJ>${emitente.cnpj.replace(/\D/g, '')}</CNPJ>
            <xNome>${emitente.razao_social}</xNome>
            <xFant>${emitente.nome_fantasia || emitente.razao_social}</xFant>
            <enderEmit>
                <xLgr>${emitente.endereco_fiscal?.logradouro || ''}</xLgr>
                <nro>${emitente.endereco_fiscal?.numero || 'S/N'}</nro>
                <xBairro>${emitente.endereco_fiscal?.bairro || ''}</xBairro>
                <cMun>${emitente.endereco_fiscal?.municipio_codigo || '3550308'}</cMun>
                <xMun>${emitente.endereco_fiscal?.municipio_nome || 'Sao Paulo'}</xMun>
                <UF>${emitente.endereco_fiscal?.uf || 'SP'}</UF>
                <CEP>${(emitente.endereco_fiscal?.cep || '').replace(/\D/g, '')}</CEP>
                <cPais>1058</cPais>
                <xPais>BRASIL</xPais>
            </enderEmit>
            <IE>${(emitente.inscricao_estadual || '').replace(/\D/g, '')}</IE>
            <CRT>${emitente.crt || 1}</CRT>
        </emit>`;
};

const buildDest = (cliente) => {
    const rawDoc = cliente.cpf || cliente.cnpj || cliente.cpf_cnpj || '';
    const cleanDoc = String(rawDoc).replace(/\D/g, '');
    const docTag = cleanDoc.length > 11 ? 'CNPJ' : 'CPF';

    return `
        <dest>
            <${docTag}>${cleanDoc}</${docTag}>
            <xNome>${cliente.nome_completo || cliente.razao_social || cliente.nome}</xNome>
            <enderDest>
                <xLgr>${cliente.endereco || cliente.logradouro || 'Rua Desconhecida'}</xLgr>
                <nro>${cliente.numero || 'S/N'}</nro>
                <xBairro>${cliente.bairro || 'Centro'}</xBairro>
                <cMun>3550308</cMun> {/* TODO: Mapear codigo municipio cliente */}
                <xMun>${cliente.cidade || 'Sao Paulo'}</xMun>
                <UF>${cliente.estado || cliente.uf || 'SP'}</UF>
                <CEP>${(cliente.cep || '00000000').replace(/\D/g, '')}</CEP>
                <cPais>1058</cPais>
                <xPais>BRASIL</xPais>
            </enderDest>
            <indIEDest>9</indIEDest> {/* 9 = Não Contribuinte */}
        </dest>`;
};

const buildDet = (itens) => {
    return itens.map((item, index) => `
        <det nItem="${index + 1}">
            <prod>
                <cProd>${item.id}</cProd>
                <cEAN>SEM GTIN</cEAN>
                <xProd>${item.nome}</xProd>
                <NCM>${item.ncm}</NCM>
                <CFOP>${item.cfop}</CFOP>
                <uCom>${item.unidade || 'UN'}</uCom>
                <qCom>${item.quantidade}</qCom>
                <vUnCom>${item.preco_unitario.toFixed(2)}</vUnCom>
                <vProd>${(item.quantidade * item.preco_unitario).toFixed(2)}</vProd>
                <cEANTrib>SEM GTIN</cEANTrib>
                <uTrib>${item.unidade || 'UN'}</uTrib>
                <qTrib>${item.quantidade}</qTrib>
                <vUnTrib>${item.preco_unitario.toFixed(2)}</vUnTrib>
                <indTot>1</indTot>
            </prod>
            <imposto>
                <ICMS>
                    <ICMSSN102> {/* CSOSN 102 - Simples Nacional sem crédito */}
                        <orig>${item.origem || 0}</orig>
                        <CSOSN>102</CSOSN>
                    </ICMSSN102>
                </ICMS>
                <PIS>
                    <PISOutr>
                        <CST>99</CST>
                        <vBC>0.00</vBC>
                        <pPIS>0.00</pPIS>
                        <vPIS>0.00</vPIS>
                    </PISOutr>
                </PIS>
                <COFINS>
                    <COFINSOutr>
                        <CST>99</CST>
                        <vBC>0.00</vBC>
                        <pCOFINS>0.00</pCOFINS>
                        <vCOFINS>0.00</vCOFINS>
                    </COFINSOutr>
                </COFINS>
            </imposto>
        </det>`).join('');
};

const buildTotal = (venda) => {
    return `
        <total>
            <ICMSTot>
                <vBC>0.00</vBC>
                <vICMS>0.00</vICMS>
                <vICMSDeson>0.00</vICMSDeson>
                <vFCP>0.00</vFCP>
                <vBCST>0.00</vBCST>
                <vST>0.00</vST>
                <vFCPST>0.00</vFCPST>
                <vFCPSTRet>0.00</vFCPSTRet>
                <vProd>${venda.total.toFixed(2)}</vProd>
                <vFrete>0.00</vFrete>
                <vSeg>0.00</vSeg>
                <vDesc>${(venda.desconto || 0).toFixed(2)}</vDesc>
                <vII>0.00</vII>
                <vIPI>0.00</vIPI>
                <vIPIDevol>0.00</vIPIDevol>
                <vPIS>0.00</vPIS>
                <vCOFINS>0.00</vCOFINS>
                <vOutro>0.00</vOutro>
                <vNF>${venda.total.toFixed(2)}</vNF>
            </ICMSTot>
        </total>`;
};

const buildTransp = () => `
    <transp>
        <modFrete>9</modFrete> {/* 9 = Sem Ocorrência de Transporte */}
    </transp>`;

const buildPag = (venda) => `
    <pag>
        <detPag>
            <tPag>01</tPag> {/* 01 = Dinheiro (Placeholder) */}
            <vPag>${venda.total.toFixed(2)}</vPag>
        </detPag>
    </pag>`;

const buildInfAdic = () => `
    <infAdic>
        <infCpl>Documento emitido por ME ou EPP optante pelo Simples Nacional.</infCpl>
    </infAdic>`;
