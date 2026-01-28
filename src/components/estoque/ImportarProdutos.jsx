import React, { useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Upload, Download, CheckCircle, AlertCircle, Loader2, FileSpreadsheet,
  X, Check, FileX, Eye, Trash2, Package
} from "lucide-react";
import * as XLSX from 'xlsx';
import { toast } from "sonner";

// Mapeamento de colunas esperadas - COMPLETO
const COLUMN_MAP = {
  // === IDENTIFICAÇÃO ===
  'codigo': 'codigo_barras',
  'código': 'codigo_barras',
  'codigo_barras': 'codigo_barras',
  'sku': 'codigo_barras',
  'ref': 'codigo_barras',
  'referencia': 'codigo_barras',
  'nome': 'nome',
  'produto': 'nome',
  'descricao': 'nome',
  'descrição': 'nome',
  'descrição do produto': 'nome',
  'descricao do produto': 'nome',
  'categoria': 'categoria',
  'tipo': 'categoria',

  // === FABRICANTE / FORNECEDOR ===
  'fabricante': 'fornecedor_nome',
  'fornecedor': 'fornecedor_nome',
  'fabricante / fornecedor': 'fornecedor_nome',
  'fabricante/fornecedor': 'fornecedor_nome',

  // === MODELO / REFERÊNCIA ===
  'modelo': 'modelo_referencia',
  'modelo / referência': 'modelo_referencia',
  'modelo/referência': 'modelo_referencia',
  'modelo / referencia': 'modelo_referencia',

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

  // === ESTOQUE POR LOCAL ===
  'estoque cd': 'estoque_cd',
  'estoque_cd': 'estoque_cd',
  'cd': 'estoque_cd',
  'mostruario loja mega store': 'estoque_mostruario_mega_store',
  'mega store': 'estoque_mostruario_mega_store',
  'mostruario loja centro': 'estoque_mostruario_centro',
  'centro': 'estoque_mostruario_centro',
  'mostruario loja ponte branca': 'estoque_mostruario_ponte_branca',
  'ponte branca': 'estoque_mostruario_ponte_branca',
  'mostruario loja futura': 'estoque_mostruario_futura',
  'futura': 'estoque_mostruario_futura',
  'quantidade': 'quantidade_estoque',
  'qtd': 'quantidade_estoque',
  'estoque': 'quantidade_estoque',
  'quantidade_estoque': 'quantidade_estoque',
  'estoque_minimo': 'estoque_minimo',
  'minimo': 'estoque_minimo',

  // === CUSTEIO ===
  'preco_custo': 'preco_custo',
  'preço_custo': 'preco_custo',
  'preco custo': 'preco_custo',
  'preço de custo': 'preco_custo',
  'preco de custo': 'preco_custo',
  'custo': 'preco_custo',
  'impostos': 'impostos_percentual',
  'frete': 'frete_custo',
  'ipi': 'ipi_percentual',

  // === MARKUP ===
  'grupo 1: prontos': 'markup_grupo1_prontos',
  'grupo 1 prontos': 'markup_grupo1_prontos',
  'prontos': 'markup_grupo1_prontos',
  'grupo 2: montagem': 'markup_grupo2_montagem',
  'grupo 2 montagem': 'markup_grupo2_montagem',
  'grupo 3: lustre': 'markup_grupo3_lustre',
  'grupo 3 lustre': 'markup_grupo3_lustre',
  'lustre': 'markup_grupo3_lustre',
  'markup': 'markup_aplicado',

  // === PREÇO DE VENDA ===
  'preco_venda': 'preco_venda',
  'preço_venda': 'preco_venda',
  'preco venda': 'preco_venda',
  'preco venda final': 'preco_venda',
  'preço venda final': 'preco_venda',
  'preco': 'preco_venda',
  'preço': 'preco_venda',
  'valor': 'preco_venda',

  // === DESCONTOS ===
  'descontos vendedor': 'desconto_max_vendedor',
  'descontos vendendor': 'desconto_max_vendedor', // typo comum
  'desconto vendedor': 'desconto_max_vendedor',
  'descontos gerencial': 'desconto_max_gerencial',
  'desconto gerencial': 'desconto_max_gerencial',
  'descontos campanha a': 'desconto_campanha_a',
  'desconto campanha a': 'desconto_campanha_a',
  'descontos campanha b': 'desconto_campanha_b',
  'desconto campanha b': 'desconto_campanha_b',

  // === MONTAGEM ===
  'movéis montagem': 'requer_montagem',
  'moveis montagem': 'requer_montagem',
  'requer montagem': 'requer_montagem',
  'montagem / terceirizado': 'montagem_terceirizado',
  'montagem/terceirizado': 'montagem_terceirizado',
  'terceirizado': 'montagem_terceirizado',

  // === OUTROS ===
  'marca': 'marca',
  'ncm': 'ncm'
};

export default function ImportarProdutos() {
  const [arquivo, setArquivo] = useState(null);
  const [dadosPreview, setDadosPreview] = useState([]);
  const [colunas, setColunas] = useState([]);
  const [processando, setProcessando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [resultado, setResultado] = useState(null);
  const [erros, setErros] = useState([]);

  const queryClient = useQueryClient();

  const handleDownloadModelo = () => {
    const wb = XLSX.utils.book_new();
    // Cabeçalhos completos conforme estrutura solicitada
    const cabecalhos = [
      'FABRICANTE / FORNECEDOR',
      'DESCRIÇÃO DO PRODUTO',
      'MODELO / REFERÊNCIA',
      'PREÇO DE CUSTO',
      'LARGURA',
      'ALTURA',
      'PROFUNDIDADE',
      'EXTRA',
      'VARIAÇÃO DE CORES',
      'MODELOS DE TECIDOS',
      'ESTOQUE CD',
      'MOSTRUARIO LOJA MEGA STORE',
      'MOSTRUARIO LOJA CENTRO',
      'MOSTRUARIO LOJA PONTE BRANCA',
      'MOSTRUARIO LOJA FUTURA',
      'IMPOSTOS',
      'FRETE',
      'IPI',
      'GRUPO 1: PRONTOS',
      'GRUPO 2: MONTAGEM',
      'GRUPO 3: LUSTRE',
      'MARKUP',
      'PREÇO VENDA FINAL',
      'DESCONTOS VENDEDOR',
      'DESCONTOS GERENCIAL',
      'DESCONTOS CAMPANHA A',
      'DESCONTOS CAMPANHA B',
      'MOVEIS MONTAGEM',
      'MONTAGEM / TERCEIRIZADO'
    ];

    const exemplos = [
      // Exemplo 1
      ['Altaro', 'Sofá 3 Lugares Retrátil', 'ALT-SF3R', 1200, 220, 95, 100, '', 'Cinza', 'Suede, Veludo', 5, 1, 0, 1, 0, 12, 150, 5, 100, '', '', 100, 2640, 5, 15, 0, 0, 'SIM', 'NÃO'],
      // Exemplo 2
      ['Lider', 'Mesa de Jantar 6L', 'LID-MJ6', 800, 180, 78, 90, '', 'Carvalho', '', 3, 0, 1, 0, 0, 12, 80, 5, '', 120, '', 120, 2112, 5, 10, 0, 0, 'NÃO', 'SIM'],
      // Exemplo 3
      ['Anjos', 'Lustre Cristal', 'ANJ-LC01', 350, 60, 45, '', '', 'Dourado', '', 10, 2, 2, 1, 1, 10, 50, 5, '', '', 80, 80, 756, 5, 15, 10, 5, 'NÃO', 'NÃO'],
    ];

    const dados = [cabecalhos, ...exemplos];
    const ws = XLSX.utils.aoa_to_sheet(dados);

    // Ajustar largura das colunas
    ws['!cols'] = cabecalhos.map(h => ({ wch: Math.max(h.length + 2, 12) }));

    XLSX.utils.book_append_sheet(wb, ws, 'Produtos');
    XLSX.writeFile(wb, 'modelo_importacao_produtos_completo.xlsx');
  };

  const normalizarColuna = (coluna) => {
    const normalizada = coluna.toLowerCase().trim().replace(/\s+/g, '_');
    return COLUMN_MAP[normalizada] || normalizada;
  };

  const parseNumber = (value) => {
    if (!value && value !== 0) return null;
    if (typeof value === 'number') return value;
    // Remove R$, espaços e troca vírgula por ponto
    const cleaned = String(value).replace(/[R$\s]/g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  };

  const handleFileChange = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const extensao = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(extensao)) {
      toast.error('Formato inválido. Use Excel (.xlsx, .xls) ou CSV.');
      return;
    }

    setArquivo(file);
    setResultado(null);
    setErros([]);
    setProcessando(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const primeiraAba = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(primeiraAba, { defval: '' });

      if (jsonData.length === 0) {
        toast.error('Arquivo vazio ou sem dados válidos.');
        setProcessando(false);
        return;
      }

      // Pegar colunas originais
      const colunasOriginais = Object.keys(jsonData[0]);
      setColunas(colunasOriginais);

      // Mapear dados para formato esperado
      const dadosMapeados = jsonData.map((row, index) => {
        const mapped = { _rowIndex: index + 2, _valid: true, _errors: [] };

        colunasOriginais.forEach(col => {
          const colNormalizada = normalizarColuna(col);
          mapped[colNormalizada] = row[col];
        });

        // Converter números - campos básicos
        if (mapped.preco_custo) mapped.preco_custo = parseNumber(mapped.preco_custo);
        if (mapped.preco_venda) mapped.preco_venda = parseNumber(mapped.preco_venda);
        if (mapped.quantidade_estoque) mapped.quantidade_estoque = parseNumber(mapped.quantidade_estoque) || 0;
        if (mapped.estoque_minimo) mapped.estoque_minimo = parseNumber(mapped.estoque_minimo) || 0;

        // Dimensões
        if (mapped.largura) mapped.largura = parseNumber(mapped.largura);
        if (mapped.altura) mapped.altura = parseNumber(mapped.altura);
        if (mapped.profundidade) mapped.profundidade = parseNumber(mapped.profundidade);

        // Estoque por loja
        if (mapped.estoque_cd) mapped.estoque_cd = parseNumber(mapped.estoque_cd) || 0;
        if (mapped.estoque_mostruario_mega_store) mapped.estoque_mostruario_mega_store = parseNumber(mapped.estoque_mostruario_mega_store) || 0;
        if (mapped.estoque_mostruario_centro) mapped.estoque_mostruario_centro = parseNumber(mapped.estoque_mostruario_centro) || 0;
        if (mapped.estoque_mostruario_ponte_branca) mapped.estoque_mostruario_ponte_branca = parseNumber(mapped.estoque_mostruario_ponte_branca) || 0;
        if (mapped.estoque_mostruario_futura) mapped.estoque_mostruario_futura = parseNumber(mapped.estoque_mostruario_futura) || 0;

        // Custeio
        if (mapped.impostos_percentual) mapped.impostos_percentual = parseNumber(mapped.impostos_percentual) || 0;
        if (mapped.frete_custo) mapped.frete_custo = parseNumber(mapped.frete_custo) || 0;
        if (mapped.ipi_percentual) mapped.ipi_percentual = parseNumber(mapped.ipi_percentual) || 0;

        // Markup
        if (mapped.markup_grupo1_prontos) mapped.markup_grupo1_prontos = parseNumber(mapped.markup_grupo1_prontos);
        if (mapped.markup_grupo2_montagem) mapped.markup_grupo2_montagem = parseNumber(mapped.markup_grupo2_montagem);
        if (mapped.markup_grupo3_lustre) mapped.markup_grupo3_lustre = parseNumber(mapped.markup_grupo3_lustre);
        if (mapped.markup_aplicado) mapped.markup_aplicado = parseNumber(mapped.markup_aplicado);

        // Descontos
        if (mapped.desconto_max_vendedor) mapped.desconto_max_vendedor = parseNumber(mapped.desconto_max_vendedor) || 5;
        if (mapped.desconto_max_gerencial) mapped.desconto_max_gerencial = parseNumber(mapped.desconto_max_gerencial) || 15;
        if (mapped.desconto_campanha_a) mapped.desconto_campanha_a = parseNumber(mapped.desconto_campanha_a) || 0;
        if (mapped.desconto_campanha_b) mapped.desconto_campanha_b = parseNumber(mapped.desconto_campanha_b) || 0;

        // Montagem - converter SIM/NÃO para boolean
        if (mapped.requer_montagem) {
          const val = String(mapped.requer_montagem).toLowerCase().trim();
          mapped.requer_montagem = val === 'sim' || val === 's' || val === 'true' || val === '1';
        }
        if (mapped.montagem_terceirizado) {
          const val = String(mapped.montagem_terceirizado).toLowerCase().trim();
          mapped.montagem_terceirizado = val === 'sim' || val === 's' || val === 'true' || val === '1';
        }

        // Determinar grupo de markup baseado nos campos preenchidos
        if (!mapped.grupo_markup) {
          if (mapped.markup_grupo1_prontos) mapped.grupo_markup = 'prontos';
          else if (mapped.markup_grupo2_montagem) mapped.grupo_markup = 'montagem';
          else if (mapped.markup_grupo3_lustre) mapped.grupo_markup = 'lustre';
          else mapped.grupo_markup = 'prontos'; // padrão
        }

        // Usar markup do grupo correspondente se não tiver markup_aplicado
        if (!mapped.markup_aplicado) {
          if (mapped.grupo_markup === 'prontos' && mapped.markup_grupo1_prontos) {
            mapped.markup_aplicado = mapped.markup_grupo1_prontos;
          } else if (mapped.grupo_markup === 'montagem' && mapped.markup_grupo2_montagem) {
            mapped.markup_aplicado = mapped.markup_grupo2_montagem;
          } else if (mapped.grupo_markup === 'lustre' && mapped.markup_grupo3_lustre) {
            mapped.markup_aplicado = mapped.markup_grupo3_lustre;
          }
        }

        // Validações
        if (!mapped.nome) {
          mapped._valid = false;
          mapped._errors.push('Nome obrigatório');
        }

        return mapped;
      });

      setDadosPreview(dadosMapeados);
      toast.success(`${dadosMapeados.length} produtos encontrados no arquivo.`);
    } catch (error) {
      console.error('Erro ao ler arquivo:', error);
      toast.error('Erro ao ler arquivo: ' + error.message);
    }

    setProcessando(false);
  }, []);

  const removerLinha = (index) => {
    setDadosPreview(prev => prev.filter((_, i) => i !== index));
  };

  const handleImportar = async () => {
    const produtosValidos = dadosPreview.filter(p => p._valid);

    if (produtosValidos.length === 0) {
      toast.error('Nenhum produto válido para importar.');
      return;
    }

    setImportando(true);
    setProgresso(0);
    const errosImportacao = [];
    let sucessos = 0;

    for (let i = 0; i < produtosValidos.length; i++) {
      const produto = produtosValidos[i];
      try {
        await base44.entities.Produto.create({
          // Identificação
          codigo_barras: produto.codigo_barras || null,
          nome: produto.nome,
          categoria: produto.categoria || 'Outros',
          fornecedor_nome: produto.fornecedor_nome || null,
          modelo_referencia: produto.modelo_referencia || null,

          // Dimensões
          largura: produto.largura || null,
          altura: produto.altura || null,
          profundidade: produto.profundidade || null,
          dimensao_extra: produto.dimensao_extra || null,

          // Variações
          cor: produto.cor || null,
          modelos_tecidos: produto.modelos_tecidos ?
            (typeof produto.modelos_tecidos === 'string' ?
              produto.modelos_tecidos.split(',').map(t => t.trim()) :
              produto.modelos_tecidos) :
            null,

          // Custeio
          preco_custo: produto.preco_custo || 0,
          impostos_percentual: produto.impostos_percentual || 0,
          frete_custo: produto.frete_custo || 0,
          ipi_percentual: produto.ipi_percentual || 0,

          // Markup
          grupo_markup: produto.grupo_markup || 'prontos',
          markup_grupo1_prontos: produto.markup_grupo1_prontos || null,
          markup_grupo2_montagem: produto.markup_grupo2_montagem || null,
          markup_grupo3_lustre: produto.markup_grupo3_lustre || null,
          markup_aplicado: produto.markup_aplicado || null,

          // Preço de venda
          preco_venda: produto.preco_venda || 0,

          // Descontos
          desconto_max_vendedor: produto.desconto_max_vendedor || 5,
          desconto_max_gerencial: produto.desconto_max_gerencial || 15,
          desconto_campanha_a: produto.desconto_campanha_a || 0,
          desconto_campanha_b: produto.desconto_campanha_b || 0,

          // Estoque geral (soma de todos)
          quantidade_estoque: (produto.estoque_cd || 0) +
            (produto.estoque_mostruario_mega_store || 0) +
            (produto.estoque_mostruario_centro || 0) +
            (produto.estoque_mostruario_ponte_branca || 0) +
            (produto.estoque_mostruario_futura || 0) ||
            produto.quantidade_estoque || 0,
          estoque_minimo: produto.estoque_minimo || 0,

          // Estoque por loja
          estoque_cd: produto.estoque_cd || 0,
          estoque_mostruario_mega_store: produto.estoque_mostruario_mega_store || 0,
          estoque_mostruario_centro: produto.estoque_mostruario_centro || 0,
          estoque_mostruario_ponte_branca: produto.estoque_mostruario_ponte_branca || 0,
          estoque_mostruario_futura: produto.estoque_mostruario_futura || 0,

          // Montagem
          requer_montagem: produto.requer_montagem || false,
          montagem_terceirizado: produto.montagem_terceirizado || false,

          // Outros
          marca: produto.marca || null,
          ncm: produto.ncm || null,
          ativo: true,
          requer_atencao: !produto.preco_venda
        });
        sucessos++;
      } catch (error) {
        errosImportacao.push({
          linha: produto._rowIndex,
          nome: produto.nome,
          erro: error.message
        });
      }

      setProgresso(((i + 1) / produtosValidos.length) * 100);
    }

    queryClient.invalidateQueries({ queryKey: ['produtos'] });

    setImportando(false);
    setErros(errosImportacao);

    if (errosImportacao.length === 0) {
      toast.success(`${sucessos} produtos importados com sucesso!`);
      setResultado({ tipo: 'sucesso', texto: `${sucessos} produtos importados com sucesso!` });
      setDadosPreview([]);
      setArquivo(null);
    } else {
      toast.warning(`${sucessos} importados, ${errosImportacao.length} com erro.`);
      setResultado({
        tipo: 'parcial',
        texto: `${sucessos} importados, ${errosImportacao.length} com erro.`
      });
    }
  };

  const produtosValidos = dadosPreview.filter(p => p._valid).length;
  const produtosInvalidos = dadosPreview.filter(p => !p._valid).length;

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2" style={{ color: '#07593f' }}>
            <Upload className="w-6 h-6" />
            Importacao de Produtos (Excel/CSV)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Instrucoes */}
          <Alert className="border-2 border-amber-300 bg-amber-50">
            <FileSpreadsheet className="h-5 w-5 text-amber-600" />
            <AlertDescription className="ml-2 text-amber-800">
              <strong>Colunas aceitas:</strong> Codigo, Nome, Categoria, Preco Custo, Preco Venda,
              Quantidade, Estoque Minimo, Fornecedor, NCM
            </AlertDescription>
          </Alert>

          {/* Download Modelo */}
          <div className="flex justify-center">
            <Button
              onClick={handleDownloadModelo}
              variant="outline"
              className="h-12 border-green-700 text-green-700 hover:bg-green-50"
            >
              <Download className="w-5 h-5 mr-2" />
              Baixar Modelo Excel
            </Button>
          </div>

          {/* Upload Area */}
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${arquivo ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-green-400'
              }`}
          >
            {processando ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-12 h-12 animate-spin text-green-600" />
                <p className="text-gray-600">Processando arquivo...</p>
              </div>
            ) : arquivo ? (
              <div className="flex flex-col items-center gap-3">
                <FileSpreadsheet className="w-12 h-12 text-green-600" />
                <p className="font-medium text-green-700">{arquivo.name}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setArquivo(null); setDadosPreview([]); }}
                >
                  <X className="w-4 h-4 mr-1" /> Remover
                </Button>
              </div>
            ) : (
              <>
                <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="mb-4 text-gray-500">
                  Arraste um arquivo Excel ou CSV aqui, ou clique para selecionar
                </p>
                <input
                  id="file-input"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button
                  onClick={() => document.getElementById('file-input').click()}
                  variant="outline"
                >
                  Escolher Arquivo
                </Button>
              </>
            )}
          </div>

          {/* Preview */}
          {dadosPreview.length > 0 && (
            <Card className="border-2 border-blue-200">
              <CardHeader className="pb-2 bg-blue-50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2 text-blue-800">
                    <Eye className="w-5 h-5" />
                    Pre-visualizacao ({dadosPreview.length} produtos)
                  </CardTitle>
                  <div className="flex gap-2">
                    <Badge className="bg-green-100 text-green-800">
                      <Check className="w-3 h-3 mr-1" />
                      {produtosValidos} validos
                    </Badge>
                    {produtosInvalidos > 0 && (
                      <Badge className="bg-red-100 text-red-800">
                        <X className="w-3 h-3 mr-1" />
                        {produtosInvalidos} com erro
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[300px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-white">
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>Codigo</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead className="text-right">Custo</TableHead>
                        <TableHead className="text-right">Venda</TableHead>
                        <TableHead className="text-center">Qtd</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dadosPreview.map((produto, idx) => (
                        <TableRow
                          key={idx}
                          className={!produto._valid ? 'bg-red-50' : ''}
                        >
                          <TableCell className="text-gray-400 text-xs">
                            {produto._rowIndex}
                          </TableCell>
                          <TableCell className="text-xs font-mono">
                            {produto.codigo_barras || '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {!produto._valid && (
                                <AlertCircle className="w-4 h-4 text-red-500" />
                              )}
                              <span className={!produto._valid ? 'text-red-700' : ''}>
                                {produto.nome || <span className="text-red-500 italic">Sem nome</span>}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="font-normal">
                              {produto.categoria || 'Outros'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-gray-600">
                            {produto.preco_custo ? `R$ ${produto.preco_custo.toFixed(2)}` : '-'}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {produto.preco_venda ? `R$ ${produto.preco_venda.toFixed(2)}` : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            {produto.quantidade_estoque || 0}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-gray-400 hover:text-red-600"
                              onClick={() => removerLinha(idx)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Progresso */}
          {importando && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Importando produtos...</span>
                <span>{Math.round(progresso)}%</span>
              </div>
              <Progress value={progresso} className="h-2" />
            </div>
          )}

          {/* Resultado */}
          {resultado && (
            <Alert className={`border-2 ${resultado.tipo === 'sucesso' ? 'bg-green-50 border-green-300' :
              resultado.tipo === 'parcial' ? 'bg-yellow-50 border-yellow-300' :
                'bg-red-50 border-red-300'
              }`}>
              {resultado.tipo === 'sucesso' ?
                <CheckCircle className="h-5 w-5 text-green-600" /> :
                <AlertCircle className="h-5 w-5 text-yellow-600" />
              }
              <AlertDescription className="ml-2">
                {resultado.texto}
              </AlertDescription>
            </Alert>
          )}

          {/* Erros */}
          {erros.length > 0 && (
            <div className="bg-red-50 rounded-lg p-4 border border-red-200">
              <p className="font-medium text-red-800 mb-2">Erros de importacao:</p>
              <ul className="text-sm text-red-700 space-y-1">
                {erros.slice(0, 5).map((erro, i) => (
                  <li key={i}>Linha {erro.linha} ({erro.nome}): {erro.erro}</li>
                ))}
                {erros.length > 5 && (
                  <li>... e mais {erros.length - 5} erros</li>
                )}
              </ul>
            </div>
          )}

          {/* Botao Importar */}
          <Button
            onClick={handleImportar}
            disabled={produtosValidos === 0 || importando}
            className="w-full h-14 text-lg"
            style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
          >
            {importando ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Package className="w-5 h-5 mr-2" />
                Importar {produtosValidos} Produto(s)
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}