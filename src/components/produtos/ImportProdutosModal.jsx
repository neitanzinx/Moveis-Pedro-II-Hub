import React, { useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { base44 } from '@/api/base44Client';
import { useTenant, useLojas } from '@/contexts/TenantContext';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
    Upload,
    FileSpreadsheet,
    Check,
    AlertTriangle,
    Loader2,
    Download,
    X,
    Package,
    Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { getColorHex } from './FurnitureColorPicker';
import { sugerirNCMsComIA, aplicarSugestoesNCM } from '@/services/ncmSuggestionService';

// Template CSV - NOTA: Lojas são carregádas dinamicamente
const CSV_TEMPLATE_HEADER = `FABRICANTE / FORNECEDOR,DESCRIÇÃO DO PRODUTO,MODELO / REFERÊNCIA,PREÇO DE CUSTO,LARGURA,ALTURA,PROFUNDIDADE,EXTRA,VARIAÇÃO DE CORES,MODELOS DE TECIDOS,ESTOQUE CD`;
const CSV_TEMPLATE_FOOTER = `,IMPOSTOS,FRETE,IPI,MARKUP,PREÇO VENDA FINAL,DESCONTOS VENDEDOR,DESCONTOS GERENCIAL,MOVEIS MONTAGEM`;

// Mapeamento BASE de colunas do CSV para campos internos
// As colunas de estoque por loja são geradas dinamicamente
const BASE_COLUMN_MAPPING = {
    // === CÓDIGO ===
    'codigo': 'codigo_barras',
    'código': 'codigo_barras',
    'codigo_barras': 'codigo_barras',
    'sku': 'codigo_barras',

    // === FABRICANTE / FORNECEDOR (com variações/typos) ===
    'fabricante / fornecedor': 'fornecedor_nome',
    'fabricante / fornencedor': 'fornecedor_nome',
    'fabricante/fornecedor': 'fornecedor_nome',
    'fornecedor': 'fornecedor_nome',
    'fabricante': 'fornecedor_nome',

    // === DESCRIÇÃO DO PRODUTO ===
    'descrição do produto': 'nome',
    'descricao do produto': 'nome',
    'descrição': 'nome',
    'descricao': 'nome',
    'nome': 'nome',
    'produto': 'nome',

    // === MODELO / REFERÊNCIA ===
    'modelo / referência': 'modelo_referencia',
    'modelo / referencia': 'modelo_referencia',
    'modelo/referência': 'modelo_referencia',
    'modelo': 'modelo_referencia',
    'referência': 'modelo_referencia',
    'referencia': 'modelo_referencia',

    // === PREÇO DE CUSTO ===
    'preço de custo': 'preco_custo',
    'preco de custo': 'preco_custo',
    'preco_custo': 'preco_custo',
    'custo': 'preco_custo',

    // === DIMENSÕES ===
    'largura': 'largura',
    'altura': 'altura',
    'profundidade': 'profundidade',
    'extra': 'dimensao_extra',

    // === VARIAÇÕES ===
    'variação de cores': 'cor',
    'variacao de cores': 'cor',
    'cor': 'cor',
    'cores': 'cor',
    'modelos de tecidos': 'modelos_tecidos',
    'tecidos': 'modelos_tecidos',

    // === ESTOQUE CD (sempre presente) ===
    'estoque cd': 'estoque_cd',
    'estoque_cd': 'estoque_cd',
    'cd': 'estoque_cd',

    // === IMPOSTOS / CUSTEIO ===
    'impostos': 'impostos_percentual',
    'frete': 'frete_custo',
    'ipi': 'ipi_percentual',

    // === MARKUP ===
    'markup': 'markup_aplicado',

    // === PREÇO DE VENDA ===
    'preço venda final': 'preco_venda',
    'preco venda final': 'preco_venda',
    'preco_venda': 'preco_venda',
    'preco': 'preco_venda',
    'preço': 'preco_venda',
    'valor': 'preco_venda',

    // === DESCONTOS ===
    'descontos vendedor': 'desconto_max_vendedor',
    'desconto vendedor': 'desconto_max_vendedor',
    'descontos gerencial': 'desconto_max_gerencial',
    'desconto gerencial': 'desconto_max_gerencial',

    // === MONTAGEM ===
    'moveis montagem': 'requer_montagem',
    'móveis montagem': 'requer_montagem',
    'montagem / terceirizado': 'montagem_terceirizado',
    'terceirizado': 'montagem_terceirizado',

    // === CAMPOS EXTRAS ===
    'categoria': 'categoria',
    'ambiente': 'ambiente',
    'material': 'material',
    'tamanho': 'tamanho',
    'grupos': '_ignorar',
    'espera': '_ignorar',
};

export default function ImportProdutosModal({ isOpen, onClose, onSuccess }) {
    const [file, setFile] = useState(null);
    const [parsedData, setParsedData] = useState([]);
    const [groupedProducts, setGroupedProducts] = useState([]);
    const [errors, setErrors] = useState([]);
    const [importing, setImporting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [step, setStep] = useState(1); // 1: upload, 2: preview, 3: importing, 4: enriching NCM
    const cancelImportRef = React.useRef(false);

    // Estados para enriquecimento de NCM via IA
    const [enrichingNCM, setEnrichingNCM] = useState(false);
    const [ncmProgress, setNcmProgress] = useState({ current: 0, total: 0, message: '' });
    const [ncmStats, setNcmStats] = useState(null); // { gemini: N, fallback: N }

    // Verificação de permissão estrita para dados financeiros
    const { user } = useAuth();
    const showFinancials = user?.cargo === 'Administrador';

    // Multi-Tenant: Carrega lojas dinâmicas
    const { lojas } = useLojas();
    const { organization } = useTenant();

    // Gera mapeamento dinâmico de colunas baseado nas lojas cadastradas
    const COLUMN_MAPPING = useMemo(() => {
        const dynamicMapping = { ...BASE_COLUMN_MAPPING };

        // Adiciona mapeamentos dinâmicos para cada loja
        lojas.forEach(loja => {
            const codigoNormalizado = loja.codigo.toLowerCase().replace(/\s+/g, '_');
            const nomeNormalizado = loja.nome.toLowerCase().replace(/\s+/g, '_');
            const fieldName = `estoque_${codigoNormalizado}`;

            // Várias formas de escrever o nome da loja no CSV
            dynamicMapping[`mostruario loja ${loja.codigo.toLowerCase()}`] = fieldName;
            dynamicMapping[`mostruario ${loja.codigo.toLowerCase()}`] = fieldName;
            dynamicMapping[loja.codigo.toLowerCase()] = fieldName;
            dynamicMapping[codigoNormalizado] = fieldName;
            dynamicMapping[nomeNormalizado] = fieldName;
        });

        // === Mapeamentos especiais para compatibilidade com planilha atual ===
        // Mega Store = Carangola (mesmo local)
        dynamicMapping['mostruario loja mega store'] = 'estoque_carangola';
        dynamicMapping['mostruario loja mega  store'] = 'estoque_carangola'; // typo com dois espaços
        dynamicMapping['mega store'] = 'estoque_carangola';
        dynamicMapping['mega  store'] = 'estoque_carangola';

        // Futura = placeholder (ignorar, mas ler para não quebrar importação)
        dynamicMapping['mostruario loja futura'] = '_ignorar';
        dynamicMapping['futura'] = '_ignorar';

        return dynamicMapping;
    }, [lojas]);

    // Gera template CSV dinâmico com lojas
    const CSV_TEMPLATE = useMemo(() => {
        const lojasHeaders = lojas.map(l => `MOSTRUARIO ${l.nome.toUpperCase()}`).join(',');
        return `${CSV_TEMPLATE_HEADER},${lojasHeaders}${CSV_TEMPLATE_FOOTER}\nAltaro,Sofá 3 Lugares,ALT-SF3R,1200,220,95,100,,Cinza,Suede,5${',0'.repeat(lojas.length)},12,150,5,100,2640,5,15,SIM`;
    }, [lojas]);

    // Gerar SKU único
    // Formato: FOR-MOD-NNNN ou FOR-MOD-NNNN-COR-VV (para variações)
    const generateSKU = (fornecedor, modelo, index, cor = null, varIndex = null) => {
        const forPart = (fornecedor || 'GEN').substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '');
        const modPart = (modelo || 'PRD').substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '');
        const numPart = String(Date.now() % 10000 + index).padStart(4, '0');

        // Se é uma variação, adicionar cor e índice
        if (cor && varIndex) {
            const corPart = cor.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '') || 'STD';
            const varPart = String(varIndex).padStart(2, '0');
            return `${forPart || 'GEN'}-${modPart || 'PRD'}-${numPart}-${corPart}-${varPart}`;
        }

        return `${forPart || 'GEN'}-${modPart || 'PRD'}-${numPart}`;
    };

    // Detectar categoria e ambiente automaticamente baseado no nome do produto
    const detectCategoryAndAmbiente = (nome) => {
        const n = (nome || '').toLowerCase();

        // Mapeamento de palavras-chave para categoria e ambiente
        const rules = [
            // QUARTO
            { keywords: ['cama', 'bicama', 'beliche'], categoria: 'Cama', ambiente: 'Quarto' },
            { keywords: ['colchão', 'colchao'], categoria: 'Colchão', ambiente: 'Quarto' },
            { keywords: ['guarda-roupa', 'guarda roupa', 'roupeiro'], categoria: 'Guarda-roupa', ambiente: 'Quarto' },
            { keywords: ['armário', 'armario'], categoria: 'Armário', ambiente: 'Quarto' },
            { keywords: ['camiseiro'], categoria: 'Armário', ambiente: 'Quarto' },
            { keywords: ['cômoda', 'comoda'], categoria: 'Cômoda', ambiente: 'Quarto' },
            { keywords: ['criado-mudo', 'criado mudo', 'mesa de cabeceira'], categoria: 'Criado-mudo', ambiente: 'Quarto' },
            { keywords: ['cabeceira'], categoria: 'Cabeceira', ambiente: 'Quarto' },
            { keywords: ['penteadeira', 'mesa vestir'], categoria: 'Penteadeira', ambiente: 'Quarto' },
            { keywords: ['sapateira'], categoria: 'Sapateira', ambiente: 'Quarto' },

            // SALA DE ESTAR
            { keywords: ['sofá', 'sofa'], categoria: 'Sofá', ambiente: 'Sala de Estar' },
            { keywords: ['poltrona'], categoria: 'Poltrona', ambiente: 'Sala de Estar' },
            { keywords: ['rack', 'home', 'painel tv', 'painel para tv'], categoria: 'Rack', ambiente: 'Sala de Estar' },
            { keywords: ['painel'], categoria: 'Painel', ambiente: 'Sala de Estar' },
            { keywords: ['estante'], categoria: 'Estante', ambiente: 'Sala de Estar' },
            { keywords: ['puff', 'pufe'], categoria: 'Poltrona', ambiente: 'Sala de Estar' },

            // SALA DE JANTAR
            { keywords: ['mesa de jantar', 'mesa jantar'], categoria: 'Mesa', ambiente: 'Sala de Jantar' },
            { keywords: ['buffet', 'aparador'], categoria: 'Buffet', ambiente: 'Sala de Jantar' },
            { keywords: ['cristaleira'], categoria: 'Cristaleira', ambiente: 'Sala de Jantar' },
            { keywords: ['cadeira'], categoria: 'Cadeira', ambiente: 'Sala de Jantar' },
            { keywords: ['banco'], categoria: 'Banco', ambiente: 'Sala de Jantar' },

            // COZINHA
            { keywords: ['balcão', 'balcao', 'bancada cozinha'], categoria: 'Balcão', ambiente: 'Cozinha' },
            { keywords: ['armário cozinha', 'armario cozinha', 'aéreo', 'aereo'], categoria: 'Armário', ambiente: 'Cozinha' },
            { keywords: ['paneleiro'], categoria: 'Armário', ambiente: 'Cozinha' },
            { keywords: ['fruteira'], categoria: 'Estante', ambiente: 'Cozinha' },
            { keywords: ['cantinho do café', 'cantinho cafe', 'cantinho do cafe'], categoria: 'Estante', ambiente: 'Cozinha' },

            // ESCRITÓRIO
            { keywords: ['escrivaninha', 'escrevaninha'], categoria: 'Escrivaninha', ambiente: 'Escritório' },
            { keywords: ['cadeira escritório', 'cadeira escritorio', 'cadeira office'], categoria: 'Cadeira', ambiente: 'Escritório' },
            { keywords: ['estante livros', 'estante escritório'], categoria: 'Estante', ambiente: 'Escritório' },

            // DIVERSOS (podem ser usados em vários ambientes)
            { keywords: ['mesa lateral', 'mesa de canto', 'mesa centro', 'mesa apoio'], categoria: 'Mesa', ambiente: 'Diversos' },
            { keywords: ['multiuso'], categoria: 'Estante', ambiente: 'Diversos' },
            { keywords: ['expositor'], categoria: 'Estante', ambiente: 'Diversos' },
            { keywords: ['cabideiro', 'cabide', 'manequim'], categoria: 'Outros', ambiente: 'Diversos' },
            { keywords: ['mesa bar', 'mesa bistro', 'mesa bistrô'], categoria: 'Mesa', ambiente: 'Diversos' },
            { keywords: ['mesa redonda', 'mesa quadrada', 'mesa retangular'], categoria: 'Mesa', ambiente: 'Sala de Jantar' },
            { keywords: ['mesa infantil'], categoria: 'Mesa', ambiente: 'Quarto' },
            { keywords: ['mesa dobrável', 'mesa dobravel'], categoria: 'Mesa', ambiente: 'Diversos' },

            // Genéricos (ordem importa - checar por último)
            { keywords: ['mesa'], categoria: 'Mesa', ambiente: 'Diversos' },
            { keywords: ['bancada'], categoria: 'Balcão', ambiente: 'Diversos' },
        ];

        for (const rule of rules) {
            for (const kw of rule.keywords) {
                if (n.includes(kw)) {
                    return { categoria: rule.categoria, ambiente: rule.ambiente };
                }
            }
        }

        // Fallback
        return { categoria: 'Outros', ambiente: 'Diversos' };
    };

    // Normaliza nome da coluna
    const normalizeColumn = (col) => {
        // Primeiro tenta com lowercase e trim apenas
        const lower = col.toLowerCase().trim();
        if (COLUMN_MAPPING[lower]) {
            return COLUMN_MAPPING[lower];
        }
        // Depois tenta normalizando espaços múltiplos para um só
        const normalized = lower.replace(/\s+/g, ' ');
        if (COLUMN_MAPPING[normalized]) {
            return COLUMN_MAPPING[normalized];
        }
        // Retorna o valor normalizado (mesmo que não mapeado)
        return normalized;
    };

    // Parse valor numérico (aceita vírgula como decimal)
    // Parse valor numérico (aceita vírgula como decimal e ignora pontos de milhar)
    const parseNum = (val) => {
        if (!val && val !== 0) return null;
        if (typeof val === 'number') return val;

        let cleaned = String(val).replace(/[R$\s]/g, '');

        // Se tiver vírgula, assume que é decimal e remove pontos de milhar
        if (cleaned.includes(',')) {
            cleaned = cleaned.replace(/\./g, '').replace(',', '.');
        }
        // Se não tiver vírgula mas tiver pontos, verifica se parede ser milhar
        // Ex: 1.200 (1200) vs 1.2 (1.2) - Na dúvida, JS trata ponto como decimal

        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
    };

    // Parse booleano (SIM/NÃO)
    const parseBool = (val) => {
        if (!val) return false;
        const v = String(val).toLowerCase().trim();
        return v === 'sim' || v === 's' || v === 'true' || v === '1';
    };

    // Parse CSV
    const parseCSV = (text) => {
        const lines = text.trim().split('\n');

        // Detectar separador automaticamente (vírgula ou ponto-e-vírgula)
        const firstLine = lines[0];
        const commaCount = (firstLine.match(/,/g) || []).length;
        const semicolonCount = (firstLine.match(/;/g) || []).length;
        const separator = semicolonCount > commaCount ? ';' : ',';

        console.log('[Import] Separador detectado:', separator, '(vírgulas:', commaCount, 'ponto-e-vírgulas:', semicolonCount, ')');

        const rawHeaders = firstLine.split(separator).map(h => h.trim().replace(/"/g, ''));
        console.log('[Import] Headers encontrados:', rawHeaders.slice(0, 5), '...');

        const headers = rawHeaders.map(h => normalizeColumn(h));
        console.log('[Import] Headers mapeados:', headers.slice(0, 5), '...');

        const data = [];
        const parseErrors = [];

        for (let i = 1; i < lines.length; i++) {
            // Parse CSV considerando aspas
            const values = [];
            let current = '';
            let inQuotes = false;
            for (const char of lines[i]) {
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === separator && !inQuotes) {
                    values.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            values.push(current.trim());

            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });

            // Validação básica
            if (!row.nome) {
                parseErrors.push(`Linha ${i + 1}: Nome/Descrição do produto é obrigatório`);
                continue;
            }

            // Extrair estoque dinâmico por loja
            const estoquePorLoja = {};
            lojas.forEach(loja => {
                const codigoNorm = loja.codigo.toLowerCase().replace(/\s+/g, '_');
                const fieldName = `estoque_${codigoNorm}`;
                estoquePorLoja[fieldName] = parseInt(row[fieldName]) || 0;
            });

            // Converter valores numéricos com sanitização Enterprise
            data.push({
                ...row,
                preco_custo: parseNum(row.preco_custo) || 0,
                preco_venda: parseNum(row.preco_venda) || 0,
                largura: parseNum(row.largura),
                altura: parseNum(row.altura),
                profundidade: parseNum(row.profundidade),
                impostos_percentual: parseNum(row.impostos_percentual) || 0,
                frete_custo: parseNum(row.frete_custo) || 0,
                ipi_percentual: parseNum(row.ipi_percentual) || 0,
                markup_aplicado: parseNum(row.markup_aplicado),
                desconto_max_vendedor: parseNum(row.desconto_max_vendedor) || 5,
                desconto_max_gerencial: parseNum(row.desconto_max_gerencial) || 15,
                requer_montagem: parseBool(row.requer_montagem),
                montagem_terceirizado: parseBool(row.montagem_terceirizado),
                // Estoque dinâmico por loja
                ...estoquePorLoja,
                linha: i + 1
            });
        }

        return { data, errors: parseErrors };
    };

    // NÃO AGRUPA MAIS - Retorna lista plana preparada
    const prepareProducts = (data) => {
        return data.map(row => {
            // Garante que todo produto tenha um ID temporário para a UI de preview
            return {
                ...row,
                id: row.id || Date.now().toString() + Math.random().toString(36).substr(2, 9),
                // Mantém estrutura "variacoes" vazia apenas se algum componente legado depender, 
                // mas a lógica principal vai ignorar.
                variacoes: []
            };
        });
    };

    // Handle file upload
    const handleFileUpload = useCallback((e) => {
        const uploadedFile = e.target.files[0];
        if (!uploadedFile) {
            console.log('[Import] Nenhum arquivo selecionado');
            return;
        }

        console.log('[Import] Arquivo selecionado:', uploadedFile.name, uploadedFile.type);
        setFile(uploadedFile);

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target.result;
                console.log('[Import] Arquivo lido, primeiros 500 chars:', text.substring(0, 500));
                console.log('[Import] Total de caracteres:', text.length);

                const { data, errors: parseErrors } = parseCSV(text);
                console.log('[Import] Parse concluído. Produtos:', data.length, 'Erros:', parseErrors.length);

                if (parseErrors.length > 0) {
                    console.log('[Import] Erros de parse:', parseErrors);
                }

                setParsedData(data);
                setErrors(parseErrors);

                if (data.length > 0) {
                    const prepared = prepareProducts(data);
                    console.log('[Import] Produtos preparados (sem agrupamento):', prepared.length);
                    setGroupedProducts(prepared);
                    setStep(2);
                } else {
                    console.log('[Import] Nenhum produto encontrado nos dados');
                    toast.error('Nenhum produto encontrado no arquivo. Verifique o formato.');
                }
            } catch (error) {
                console.error('[Import] Erro ao processar arquivo:', error);
                toast.error('Erro ao processar arquivo: ' + error.message);
            }
        };
        reader.onerror = (error) => {
            console.error('[Import] Erro ao ler arquivo:', error);
            toast.error('Erro ao ler arquivo');
        };
        reader.readAsText(uploadedFile);
    }, []);

    // Download template
    const downloadTemplate = () => {
        const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'template_produtos.csv';
        a.click();
        window.URL.revokeObjectURL(url);
    };

    // Import products
    const handleImport = async () => {
        cancelImportRef.current = false; // Reset flag de cancelamento
        setImporting(true);
        setStep(3);
        setProgress(0);

        try {
            // 1. Primeiro, criar fornecedores que não existem
            const fornecedoresNomes = [...new Set(
                groupedProducts
                    .map(p => p.fornecedor_nome)
                    .filter(nome => nome && nome.trim())
            )];

            if (fornecedoresNomes.length > 0) {
                console.log('[Import] Verificando fornecedores:', fornecedoresNomes);

                // Buscar fornecedores existentes
                const fornecedoresExistentes = await base44.entities.Fornecedor.list();
                const nomesExistentes = new Set(
                    fornecedoresExistentes.map(f => (f.nome_empresa || '').toLowerCase().trim())
                );

                // Criar fornecedores novos
                const novosFornecedores = fornecedoresNomes.filter(
                    nome => !nomesExistentes.has(nome.toLowerCase().trim())
                );

                for (const nomeFornecedor of novosFornecedores) {
                    try {
                        await base44.entities.Fornecedor.create({
                            nome_empresa: nomeFornecedor
                        });
                        console.log('[Import] Fornecedor criado:', nomeFornecedor);
                    } catch (err) {
                        console.warn('[Import] Erro ao criar fornecedor:', nomeFornecedor, err);
                    }
                }

                if (novosFornecedores.length > 0) {
                    toast.success(`${novosFornecedores.length} fornecedor(es) criado(s) automaticamente`);
                }
            }
        } catch (err) {
            console.warn('[Import] Erro ao processar fornecedores:', err);
        }

        const total = groupedProducts.length;
        let imported = 0;
        let failed = 0;

        for (let index = 0; index < groupedProducts.length; index++) {
            // Verificar se foi cancelado
            if (cancelImportRef.current) {
                toast.warning(`Importação cancelada. ${imported} produtos importados de ${total}.`);
                break;
            }

            const product = groupedProducts[index];
            try {
                // Constroi nome único concatenando variações
                let nomeUnico = product.nome;
                const variaveisNome = [];
                if (product.cor) variaveisNome.push(product.cor);
                if (product.tamanho) variaveisNome.push(product.tamanho);
                if (product.dimensao_extra) variaveisNome.push(product.dimensao_extra);

                if (variaveisNome.length > 0) {
                    nomeUnico = `${product.nome} - ${variaveisNome.join(' ')}`;
                }

                // Gera SKU único
                // Se já tiver código de barras no CSV, usa ele. Se não, gera.
                const sku = product.codigo_barras || generateSKU(product.fornecedor_nome, product.modelo_referencia, index, product.cor);

                // Detecta categoria e ambiente automaticamente se não fornecidos
                const detected = detectCategoryAndAmbiente(product.nome);
                const categoria = product.categoria || detected.categoria;
                const ambiente = product.ambiente || detected.ambiente;

                // === CÁLCULO DE ESTOQUE TOTAL ===
                // O product já tem os campos estoque_nomeloja vindos do parseCSV
                let totalEstoque = 0;
                lojas.forEach(loja => {
                    const codigoNorm = loja.codigo.toLowerCase().replace(/\s+/g, '_');
                    const fieldName = `estoque_${codigoNorm}`;
                    totalEstoque += (parseInt(product[fieldName]) || 0);
                });

                const produtoData = {
                    // Identificação
                    codigo_barras: sku,
                    nome: nomeUnico,
                    categoria: categoria,
                    ambiente: ambiente,
                    fornecedor_nome: product.fornecedor_nome || '',
                    modelo_referencia: product.modelo_referencia || '',
                    material: product.material || '',

                    // Variações (agora atributos diretos do produto único)
                    cor: product.cor || null,
                    cor_hex: product.cor ? getColorHex(product.cor) : null,
                    tamanho: product.tamanho || null,

                    tipo_entrega_padrao: 'desmontado',

                    // Dimensões
                    largura: product.largura || null,
                    altura: product.altura || null,
                    profundidade: product.profundidade || null,

                    // Preços
                    preco_custo: product.preco_custo || 0,
                    preco_venda: product.preco_venda || 0,

                    // Custeio
                    impostos_percentual: product.impostos_percentual || 0,
                    frete_custo: product.frete_custo || 0,
                    ipi_percentual: product.ipi_percentual || 0,

                    // Markup
                    markup_aplicado: product.markup_aplicado,

                    // Descontos
                    desconto_max_vendedor: product.desconto_max_vendedor || 5,
                    desconto_max_gerencial: product.desconto_max_gerencial || 15,

                    // Estoque
                    quantidade_estoque: totalEstoque,
                    estoque_minimo: 5,

                    // Campos dinâmicos de estoque por loja já estão no ...product se passarmos,
                    // mas precisamos garantir que estao no formato certo para criar?
                    // O base44.entities.Produto.create deve aceitar os campos extras se o backend suportar.
                    // Assumindo que o create aceita campos extras ou que precisamos passá-los um a um?
                    // O ideal é passar explicitamente o que sabemos que existe.

                    // Montagem
                    requer_montagem: product.requer_montagem || false,
                    montagem_terceirizado: product.montagem_terceirizado || false,

                    // NÃO É MAIS PARENT/CHILD
                    variacoes: [],
                    fotos: [],
                    ativo: true,
                    is_parent: false,
                    parent_id: null, // NULO PARA SEMPRE

                    // Multi-tenant
                    organization_id: organization?.id || '00000000-0000-0000-0000-000000000001'
                };

                // Adiciona campos de estoque por loja explicitamente
                lojas.forEach(loja => {
                    const codigoNorm = loja.codigo.toLowerCase().replace(/\s+/g, '_');
                    const fieldName = `estoque_${codigoNorm}`;
                    if (product[fieldName] !== undefined) {
                        produtoData[fieldName] = product[fieldName];
                    }
                });

                const novoProduto = await base44.entities.Produto.create(produtoData);

                // === REGISTRAR HISTÓRICO DE PREÇOS ===
                try {
                    if (novoProduto && novoProduto.id) {
                        await base44.entities.HistoricoPrecos?.create?.({
                            organization_id: organization?.id || '00000000-0000-0000-0000-000000000001',
                            produto_id: novoProduto.id,
                            preco_antigo: 0,
                            preco_novo: produtoData.preco_venda,
                            tipo: 'custo',
                            motivo: `Importação - ${file?.name || 'arquivo'}`,
                            usuario_nome: user?.nome || 'Sistema'
                        });
                    }
                } catch (histErr) {
                    console.warn('[Import] Não foi possível registrar histórico de preços:', histErr);
                }

                imported++;
            } catch (err) {
                console.error('Erro ao importar:', product.nome, err);
                failed++;
            }

            setProgress(Math.round(((imported + failed) / total) * 100));
        }

        setImporting(false);

        if (failed === 0) {
            toast.success(`${imported} produto(s) importado(s) com sucesso!`);
            onSuccess?.();
            handleClose();
        } else {
            toast.warning(`${imported} importados, ${failed} falharam`);
        }
    };

    // Sugerir NCMs usando IA Gemini
    const handleSuggestNCM = async () => {
        if (enrichingNCM) return;

        setEnrichingNCM(true);
        setNcmProgress({ current: 0, total: groupedProducts.length, message: 'Iniciando IA...' });

        try {
            // Callback para progresso
            const onProgress = (current, total, message) => {
                setNcmProgress({ current, total, message });
            };

            const result = await sugerirNCMsComIA(groupedProducts, onProgress);

            if (result.success) {
                // Aplicar sugestões aos produtos agrupados
                const enrichedProducts = aplicarSugestoesNCM(groupedProducts, result.sugestoes);
                setGroupedProducts(enrichedProducts);

                // Mostrar estatísticas
                setNcmStats(result.stats);

                if (result.erros && result.erros.length > 0) {
                    console.warn("Erros parciais no enriquecimento NCM:", result.erros);
                }

                toast.success(`NCMs sugeridos! IA: ${result.stats?.gemini}, Fallback: ${result.stats?.fallback}`, {
                    icon: <Sparkles className="w-4 h-4 text-yellow-500" />
                });
            } else {
                toast.error("Erro ao sugerir NCMs: " + result.erros?.join(', '));
            }
        } catch (error) {
            console.error(error);
            toast.error("Erro ao conectar com serviço de IA");
        } finally {
            setEnrichingNCM(false);
        }
    };

    // Reset and close
    const handleClose = () => {
        setFile(null);
        setParsedData([]);
        setGroupedProducts([]);
        setErrors([]);
        setStep(1);
        setProgress(0);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5" />
                        Importar Produtos via Planilha
                    </DialogTitle>
                    <DialogDescription>
                        {step === 1 && "Faça upload de um arquivo CSV para importar produtos em lote."}
                        {step === 2 && "Revise os produtos antes de importar e opcionalmente enriqueça com NCMs sugeridos por IA."}
                        {step === 3 && "Aguarde enquanto os produtos são importados para o sistema."}
                        {step === 4 && "Enriquecendo produtos com códigos NCM usando inteligência artificial."}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto py-4">
                    {/* Step 1: Upload */}
                    {step === 1 && (
                        <div className="space-y-6">
                            <Alert>
                                <AlertDescription>
                                    Faça upload de um arquivo CSV com os produtos.
                                    Produtos com o mesmo nome serão agrupados como variações.
                                </AlertDescription>
                            </Alert>

                            <div className="flex justify-center">
                                <Button variant="outline" onClick={downloadTemplate} className="gap-2">
                                    <Download className="w-4 h-4" />
                                    Baixar Modelo CSV
                                </Button>
                            </div>

                            <label className="cursor-pointer block">
                                <input
                                    type="file"
                                    accept=".csv,.txt"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                />
                                <div className="border-2 border-dashed rounded-lg p-12 text-center hover:bg-gray-50 transition-colors">
                                    <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                                    <p className="text-lg font-medium text-gray-700">
                                        Clique para selecionar arquivo
                                    </p>
                                    <p className="text-sm text-gray-500 mt-1">
                                        Formato aceito: CSV
                                    </p>
                                </div>
                            </label>

                            <Card className="bg-gray-50">
                                <CardContent className="p-4">
                                    <Label className="text-sm font-semibold mb-2 block">
                                        Colunas aceitas (principais):
                                    </Label>
                                    <div className="flex flex-wrap gap-1 mb-2">
                                        {['DESCRIÇÃO DO PRODUTO*', 'FABRICANTE/FORNECEDOR', 'MODELO/REFERÊNCIA', 'PREÇO DE CUSTO', 'PREÇO VENDA FINAL', 'VARIAÇÃO DE CORES'].map(col => (
                                            <Badge key={col} variant={col.includes('*') ? 'default' : 'outline'} className="text-xs">
                                                {col.replace('*', '')}
                                                {col.includes('*') && <span className="text-red-300 ml-0.5">*</span>}
                                            </Badge>
                                        ))}
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {['LARGURA', 'ALTURA', 'PROFUNDIDADE', 'ESTOQUE CD', 'MOSTRUARIO LOJAS', 'MARKUP', 'IMPOSTOS', 'FRETE', 'IPI', 'DESCONTOS', 'MONTAGEM'].map(col => (
                                            <Badge key={col} variant="outline" className="text-xs">
                                                {col}
                                            </Badge>
                                        ))}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">* Campos obrigatórios. Sistema aceita múltiplos formatos de cabeçalho.</p>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Step 2: Preview */}
                    {step === 2 && (
                        <div className="space-y-4">
                            {errors.length > 0 && (
                                <Alert variant="destructive">
                                    <AlertTriangle className="w-4 h-4" />
                                    <AlertDescription>
                                        <p className="font-medium mb-1">{errors.length} erro(s) encontrado(s):</p>
                                        <ul className="text-sm list-disc list-inside">
                                            {errors.slice(0, 5).map((err, i) => (
                                                <li key={i}>{err}</li>
                                            ))}
                                            {errors.length > 5 && (
                                                <li>... e mais {errors.length - 5} erros</li>
                                            )}
                                        </ul>
                                    </AlertDescription>
                                </Alert>
                            )}

                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-semibold">
                                        {groupedProducts.length} produto(s) encontrado(s)
                                    </p>
                                    <p className="text-sm text-gray-500">
                                        {parsedData.length} linha(s) no total
                                    </p>
                                </div>
                                <Button variant="outline" size="sm" onClick={() => setStep(1)}>
                                    <X className="w-4 h-4 mr-1" />
                                    Escolher outro arquivo
                                </Button>
                            </div>

                            <div className="space-y-3 max-h-[400px] overflow-y-auto">
                                {groupedProducts.map((product, index) => {
                                    // Calcula totais do produto
                                    const estoqueTotal = product.variacoes.reduce((sum, v) =>
                                        sum + (v.estoque_cd || 0) + (v.estoque_mostruario_mega_store || 0) +
                                        (v.estoque_mostruario_centro || 0) + (v.estoque_mostruario_ponte_branca || 0) +
                                        (v.estoque_mostruario_futura || 0), 0);
                                    const precoMin = Math.min(...product.variacoes.map(v => v.preco_venda || 0).filter(p => p > 0)) || 0;
                                    const precoMax = Math.max(...product.variacoes.map(v => v.preco_venda || 0));

                                    return (
                                        <Card key={index} className="overflow-hidden">
                                            {/* Cabeçalho do produto */}
                                            <div className="bg-gray-50 px-4 py-3 border-b">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <h4 className="font-bold text-base flex items-center gap-2">
                                                            <Package className="w-4 h-4 text-green-600" />
                                                            {product.nome}
                                                        </h4>
                                                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
                                                            {product.fornecedor_nome && (
                                                                <span>📦 {product.fornecedor_nome}</span>
                                                            )}
                                                            {product.modelo_referencia && (
                                                                <span>🏷️ {product.modelo_referencia}</span>
                                                            )}
                                                            {product.categoria && (
                                                                <span>📂 {product.categoria}</span>
                                                            )}
                                                            {showFinancials && product.markup_aplicado && (
                                                                <span>📊 Markup: {product.markup_aplicado}%</span>
                                                            )}
                                                            {product.ncm && (
                                                                <span className={`inline-flex items-center gap-1 ${product.ncm_fonte === 'gemini' ? 'text-purple-600 font-medium' : ''
                                                                    }`}>
                                                                    📝 NCM: {product.ncm}
                                                                    {product.ncm_fonte === 'gemini' && (
                                                                        <Sparkles className="w-3 h-3 text-purple-600 inline ml-0.5" />
                                                                    )}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-right flex-shrink-0">
                                                        <Badge variant="secondary" className="mb-1">
                                                            {product.variacoes.length} variação(ões)
                                                        </Badge>
                                                        <div className="text-xs text-gray-500">
                                                            {estoqueTotal} un total
                                                        </div>
                                                        <div className="text-sm font-semibold text-green-600">
                                                            {precoMin === precoMax ?
                                                                `R$ ${precoMin.toFixed(2)}` :
                                                                `R$ ${precoMin.toFixed(2)} - ${precoMax.toFixed(2)}`
                                                            }
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Tabela de variações */}
                                            <CardContent className="p-0">
                                                <div className="max-h-[180px] overflow-y-auto">
                                                    <table className="w-full text-xs">
                                                        <thead className="bg-gray-100 sticky top-0">
                                                            <tr>
                                                                <th className="text-left px-3 py-2 font-medium">Cor</th>
                                                                <th className="text-left px-3 py-2 font-medium">Dimensões</th>
                                                                {showFinancials && <th className="text-right px-3 py-2 font-medium">Custo</th>}
                                                                <th className="text-right px-3 py-2 font-medium">Venda</th>
                                                                <th className="text-right px-3 py-2 font-medium">Est.</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {product.variacoes.map((v, i) => {
                                                                const estVar = (v.estoque_cd || 0) + (v.estoque_mostruario_mega_store || 0) +
                                                                    (v.estoque_mostruario_centro || 0) + (v.estoque_mostruario_ponte_branca || 0) +
                                                                    (v.estoque_mostruario_futura || 0);
                                                                const dims = [v.largura, v.altura, v.profundidade].filter(d => d).join('×');

                                                                return (
                                                                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                                        <td className="px-3 py-2">
                                                                            <div className="flex items-center gap-2">
                                                                                <div
                                                                                    className="w-4 h-4 rounded border shadow-sm flex-shrink-0"
                                                                                    style={{ backgroundColor: v.cor_hex || '#ccc' }}
                                                                                />
                                                                                <span className="truncate max-w-[100px]" title={v.cor || 'Sem cor'}>
                                                                                    {v.cor || 'Sem cor'}
                                                                                </span>
                                                                                {v.tamanho && (
                                                                                    <span className="text-gray-400">({v.tamanho})</span>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-3 py-2 text-gray-500">
                                                                            {dims ? `${dims} cm` : '-'}
                                                                        </td>
                                                                        {showFinancials && (
                                                                            <td className="px-3 py-2 text-right text-gray-500">
                                                                                {v.preco_custo > 0 ? `R$ ${v.preco_custo.toFixed(2)}` : '-'}
                                                                            </td>
                                                                        )}
                                                                        <td className="px-3 py-2 text-right font-medium text-green-600">
                                                                            R$ {(v.preco_venda || 0).toFixed(2)}
                                                                        </td>
                                                                        <td className="px-3 py-2 text-right">
                                                                            <Badge
                                                                                variant={estVar > 0 ? 'secondary' : 'outline'}
                                                                                className="text-xs px-1.5"
                                                                            >
                                                                                {estVar}
                                                                            </Badge>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Step 3: Importing */}
                    {step === 3 && (
                        <div className="space-y-6 py-8">
                            <div className="text-center">
                                {importing ? (
                                    <>
                                        <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-green-600" />
                                        <p className="text-lg font-medium">Importando produtos...</p>
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-12 h-12 mx-auto mb-4 text-green-600" />
                                        <p className="text-lg font-medium text-green-600">Importação concluída!</p>
                                    </>
                                )}
                            </div>

                            <Progress value={progress} className="h-2" />
                            <p className="text-center text-sm text-gray-500">{progress}%</p>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => {
                            if (importing) {
                                cancelImportRef.current = true;
                                toast.info('Cancelando importação...');
                            } else {
                                handleClose();
                            }
                        }}
                    >
                        {step === 3 && !importing ? 'Fechar' : 'Cancelar'}
                    </Button>
                    {step === 2 && (
                        <div className="flex gap-2">
                            {enrichingNCM ? (
                                <div className="flex items-center gap-2 mr-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                                    <span className="text-sm text-purple-600 font-medium">
                                        Analizando com IA... {(ncmProgress.current / ncmProgress.total * 100).toFixed(0)}%
                                    </span>
                                </div>
                            ) : (
                                <Button
                                    onClick={handleSuggestNCM}
                                    variant="outline"
                                    className="border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800 gap-2"
                                    disabled={groupedProducts.length === 0}
                                >
                                    <Sparkles className="w-4 h-4" />
                                    Sugerir NCMs com IA
                                </Button>
                            )}

                            <Button onClick={handleImport} className="bg-green-600 hover:bg-green-700 gap-2">
                                <Upload className="w-4 h-4" />
                                Importar {groupedProducts.length} Produto(s)
                            </Button>
                        </div>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
