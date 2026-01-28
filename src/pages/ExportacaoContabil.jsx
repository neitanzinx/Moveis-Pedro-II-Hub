import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    FileSpreadsheet,
    Download,
    FileText,
    FileCode,
    Building2,
    Calendar,
    Loader2,
    CheckCircle,
    Info
} from "lucide-react";
import { toast } from "sonner";

// Importar exportadores
import ContaAzulExporter from "@/utils/contabilidade/ContaAzulExporter";
import OmieExporter from "@/utils/contabilidade/OmieExporter";
import BlingExporter from "@/utils/contabilidade/BlingExporter";
import SPEDExporter from "@/utils/contabilidade/SPEDExporter";

export default function ExportacaoContabil() {
    const [sistema, setSistema] = useState("conta_azul");
    const [tipoExportacao, setTipoExportacao] = useState("lancamentos");
    const [periodoInicio, setPeriodoInicio] = useState(() => {
        const d = new Date();
        d.setDate(1);
        return d.toISOString().split('T')[0];
    });
    const [periodoFim, setPeriodoFim] = useState(() => new Date().toISOString().split('T')[0]);
    const [incluirCancelados, setIncluirCancelados] = useState(false);
    const [exportando, setExportando] = useState(false);
    const [ultimaExportacao, setUltimaExportacao] = useState(null);

    // Buscar dados
    const { data: lancamentos = [] } = useQuery({
        queryKey: ['lancamentos-export'],
        queryFn: () => base44.entities.LancamentoFinanceiro.list('-data_lancamento')
    });

    const { data: vendas = [] } = useQuery({
        queryKey: ['vendas-export'],
        queryFn: () => base44.entities.Venda.list('-data_venda')
    });

    const { data: clientes = [] } = useQuery({
        queryKey: ['clientes-export'],
        queryFn: () => base44.entities.Cliente.list()
    });

    const { data: produtos = [] } = useQuery({
        queryKey: ['produtos-export'],
        queryFn: () => base44.entities.Produto.list()
    });

    // Filtrar por período
    const filtrarPorPeriodo = (lista, campoData) => {
        return lista.filter(item => {
            const data = item[campoData]?.split('T')[0];
            if (!data) return false;
            return data >= periodoInicio && data <= periodoFim;
        });
    };

    const handleExportar = async () => {
        setExportando(true);

        try {
            let conteudo = '';
            let nomeArquivo = '';
            let downloadFn = null;

            const opcoes = { incluirCancelados };
            const periodo = `${periodoInicio.replace(/-/g, '')}_${periodoFim.replace(/-/g, '')}`;

            switch (sistema) {
                case 'conta_azul':
                    if (tipoExportacao === 'lancamentos') {
                        const dados = filtrarPorPeriodo(lancamentos, 'data_lancamento');
                        conteudo = ContaAzulExporter.exportarLancamentosContaAzul(dados, opcoes);
                        nomeArquivo = `conta_azul_lancamentos_${periodo}.csv`;
                    } else if (tipoExportacao === 'vendas') {
                        const dados = filtrarPorPeriodo(vendas, 'data_venda');
                        conteudo = ContaAzulExporter.exportarVendasContaAzul(dados, opcoes);
                        nomeArquivo = `conta_azul_vendas_${periodo}.csv`;
                    } else if (tipoExportacao === 'clientes') {
                        conteudo = ContaAzulExporter.exportarClientesContaAzul(clientes);
                        nomeArquivo = `conta_azul_clientes_${periodo}.csv`;
                    }
                    downloadFn = ContaAzulExporter.downloadCSV;
                    break;

                case 'omie':
                    if (tipoExportacao === 'lancamentos') {
                        const dados = filtrarPorPeriodo(lancamentos, 'data_lancamento');
                        conteudo = OmieExporter.exportarLancamentosOmie(dados, opcoes);
                        nomeArquivo = `omie_contas_${periodo}.csv`;
                    } else if (tipoExportacao === 'produtos') {
                        conteudo = OmieExporter.exportarProdutosOmie(produtos);
                        nomeArquivo = `omie_produtos_${periodo}.csv`;
                    } else if (tipoExportacao === 'clientes') {
                        conteudo = OmieExporter.exportarClientesOmie(clientes);
                        nomeArquivo = `omie_clientes_${periodo}.csv`;
                    }
                    downloadFn = OmieExporter.downloadCSV;
                    break;

                case 'bling':
                    if (tipoExportacao === 'vendas') {
                        const dados = filtrarPorPeriodo(vendas, 'data_venda');
                        conteudo = BlingExporter.exportarPedidosBling(dados);
                        nomeArquivo = `bling_pedidos_${periodo}.xml`;
                    } else if (tipoExportacao === 'produtos') {
                        conteudo = BlingExporter.exportarProdutosBling(produtos);
                        nomeArquivo = `bling_produtos_${periodo}.xml`;
                    } else if (tipoExportacao === 'clientes') {
                        conteudo = BlingExporter.exportarContatosBling(clientes);
                        nomeArquivo = `bling_contatos_${periodo}.xml`;
                    } else if (tipoExportacao === 'lancamentos') {
                        const dados = filtrarPorPeriodo(lancamentos, 'data_lancamento');
                        conteudo = BlingExporter.exportarContasBling(dados);
                        nomeArquivo = `bling_contas_${periodo}.xml`;
                    }
                    downloadFn = BlingExporter.downloadXML;
                    break;

                case 'sped':
                    const vendasPeriodo = filtrarPorPeriodo(vendas, 'data_venda');
                    const lancamentosPeriodo = filtrarPorPeriodo(lancamentos, 'data_lancamento');
                    const mes = periodoInicio.split('-')[1];
                    const ano = periodoInicio.split('-')[0];

                    if (tipoExportacao === 'efd') {
                        // Dados da empresa (buscar das configurações)
                        const empresa = {
                            razao_social: 'MOVEIS PEDRO II LTDA',
                            cnpj: '',
                            uf: 'SP',
                            codigo_municipio: ''
                        };
                        conteudo = SPEDExporter.gerarSPEDContribuicoes(
                            { vendas: vendasPeriodo, lancamentos: lancamentosPeriodo },
                            empresa,
                            mes + ano
                        );
                        nomeArquivo = `sped_efd_${mes}${ano}.txt`;
                    } else if (tipoExportacao === 'resumo') {
                        conteudo = SPEDExporter.gerarResumoContador(
                            { vendas: vendasPeriodo, lancamentos: lancamentosPeriodo },
                            `${mes}/${ano}`
                        );
                        nomeArquivo = `resumo_contador_${mes}${ano}.txt`;
                    }
                    downloadFn = SPEDExporter.downloadTXT;
                    break;
            }

            if (conteudo && downloadFn) {
                downloadFn(conteudo, nomeArquivo);
                setUltimaExportacao({
                    sistema,
                    tipo: tipoExportacao,
                    arquivo: nomeArquivo,
                    data: new Date().toLocaleString('pt-BR')
                });
                toast.success(`Arquivo ${nomeArquivo} gerado com sucesso!`);
            } else {
                toast.error('Nenhum dado para exportar');
            }

        } catch (error) {
            console.error('Erro na exportação:', error);
            toast.error('Erro ao gerar arquivo');
        } finally {
            setExportando(false);
        }
    };

    const sistemasInfo = {
        conta_azul: {
            nome: 'Conta Azul',
            formato: 'CSV',
            icon: FileSpreadsheet,
            cor: 'blue',
            tipos: ['lancamentos', 'vendas', 'clientes']
        },
        omie: {
            nome: 'Omie',
            formato: 'CSV',
            icon: FileSpreadsheet,
            cor: 'purple',
            tipos: ['lancamentos', 'produtos', 'clientes']
        },
        bling: {
            nome: 'Bling',
            formato: 'XML',
            icon: FileCode,
            cor: 'orange',
            tipos: ['vendas', 'produtos', 'clientes', 'lancamentos']
        },
        sped: {
            nome: 'SPED/Contador',
            formato: 'TXT',
            icon: FileText,
            cor: 'green',
            tipos: ['efd', 'resumo']
        }
    };

    const tiposExportacaoLabels = {
        lancamentos: 'Lançamentos Financeiros',
        vendas: 'Vendas/Pedidos',
        clientes: 'Clientes',
        produtos: 'Produtos',
        efd: 'EFD Contribuições',
        resumo: 'Resumo para Contador'
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Building2 className="w-7 h-7" />
                        Exportação Contábil
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Exporte dados para sistemas de contabilidade
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Configurações */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Seleção de Sistema */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Sistema de Destino</CardTitle>
                            <CardDescription>
                                Selecione o sistema para onde deseja exportar os dados
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {Object.entries(sistemasInfo).map(([key, info]) => (
                                    <button
                                        key={key}
                                        onClick={() => {
                                            setSistema(key);
                                            setTipoExportacao(info.tipos[0]);
                                        }}
                                        className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${sistema === key
                                                ? `border-${info.cor}-500 bg-${info.cor}-50 text-${info.cor}-700`
                                                : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <info.icon className={`w-8 h-8 ${sistema === key ? `text-${info.cor}-600` : 'text-gray-400'}`} />
                                        <span className="font-medium text-sm">{info.nome}</span>
                                        <Badge variant="outline" className="text-xs">
                                            {info.formato}
                                        </Badge>
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Período e Tipo */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Parâmetros</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Período */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Data Início</Label>
                                    <Input
                                        type="date"
                                        value={periodoInicio}
                                        onChange={(e) => setPeriodoInicio(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <Label>Data Fim</Label>
                                    <Input
                                        type="date"
                                        value={periodoFim}
                                        onChange={(e) => setPeriodoFim(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Tipo de Exportação */}
                            <div>
                                <Label>Tipo de Dados</Label>
                                <Select value={tipoExportacao} onValueChange={setTipoExportacao}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {sistemasInfo[sistema].tipos.map(tipo => (
                                            <SelectItem key={tipo} value={tipo}>
                                                {tiposExportacaoLabels[tipo]}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Opções adicionais */}
                            {['lancamentos', 'vendas'].includes(tipoExportacao) && (
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="cancelados"
                                        checked={incluirCancelados}
                                        onCheckedChange={setIncluirCancelados}
                                    />
                                    <label htmlFor="cancelados" className="text-sm text-gray-600">
                                        Incluir registros cancelados
                                    </label>
                                </div>
                            )}

                            {/* Botão Exportar */}
                            <Button
                                onClick={handleExportar}
                                disabled={exportando}
                                className="w-full h-12 text-lg"
                            >
                                {exportando ? (
                                    <>
                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                        Gerando arquivo...
                                    </>
                                ) : (
                                    <>
                                        <Download className="w-5 h-5 mr-2" />
                                        Exportar {sistemasInfo[sistema].formato}
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Resumo do período */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Calendar className="w-5 h-5" />
                                Resumo do Período
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-500">Vendas</span>
                                <span className="font-bold">
                                    {filtrarPorPeriodo(vendas, 'data_venda').length}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-500">Lançamentos</span>
                                <span className="font-bold">
                                    {filtrarPorPeriodo(lancamentos, 'data_lancamento').length}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-500">Clientes</span>
                                <span className="font-bold">{clientes.length}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-500">Produtos</span>
                                <span className="font-bold">{produtos.length}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Última exportação */}
                    {ultimaExportacao && (
                        <Card className="border-green-200 bg-green-50">
                            <CardContent className="p-4">
                                <div className="flex items-start gap-3">
                                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                                    <div>
                                        <p className="font-medium text-green-800">Última exportação</p>
                                        <p className="text-sm text-green-600 mt-1">
                                            {ultimaExportacao.arquivo}
                                        </p>
                                        <p className="text-xs text-green-500">
                                            {ultimaExportacao.data}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Dica */}
                    <Card className="border-blue-200 bg-blue-50">
                        <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                                <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                                <div>
                                    <p className="font-medium text-blue-800">Dica</p>
                                    <p className="text-sm text-blue-600 mt-1">
                                        Para o SPED, exporte primeiro o Resumo para Contador validar os dados antes de gerar o arquivo oficial.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
