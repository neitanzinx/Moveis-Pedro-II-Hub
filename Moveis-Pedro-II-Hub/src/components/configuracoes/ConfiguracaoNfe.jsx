import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Building2, Save, CheckCircle, FileText, RefreshCw,
    Percent, MapPin, Edit, AlertCircle, Eye, EyeOff,
    Key, Cloud, ExternalLink, Loader2, ScrollText,
    ShieldCheck, Factory
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/api/base44Client";

// Empresas base para emissao de NFe
const EMPRESAS_BASE = [
    { cnpj: "49129137000130", nome: "Atacadao Outlet", cnpjFormatado: "49.129.137/0001-30" },
    { cnpj: "04842257000141", nome: "Moveis Pedro II", cnpjFormatado: "04.842.257/0001-41" },
    { cnpj: "42316614000127", nome: "Massi Home Design", cnpjFormatado: "42.316.614/0001-27" },
    { cnpj: "53795479000166", nome: "Alta Performance Decoracoes", cnpjFormatado: "53.795.479/0001-66" },
];

const REGIMES_TRIBUTARIOS = [
    { value: "1", label: "Simples Nacional" },
    { value: "2", label: "Simples Nacional - Excesso de sublimite" },
    { value: "3", label: "Regime Normal (Lucro Presumido/Real)" },
];

const AMBIENTES = [
    { value: "homologacao", label: "Homologação (Testes)", cor: "bg-yellow-100 text-yellow-800", border: "border-yellow-200" },
    { value: "producao", label: "Produção", cor: "bg-green-100 text-green-800", border: "border-green-200" },
];

// Carrega dados fiscais das empresas do localStorage
const carregarDadosFiscais = () => {
    try {
        const dados = localStorage.getItem("nfe_empresas_fiscais");
        return dados ? JSON.parse(dados) : {};
    } catch {
        return {};
    }
};

// Salva dados fiscais no localStorage
const salvarDadosFiscais = (dados) => {
    localStorage.setItem("nfe_empresas_fiscais", JSON.stringify(dados));
};

export default function ConfiguracaoNfe() {
    const [empresaPadrao, setEmpresaPadrao] = useState(() => {
        return localStorage.getItem("nfe_empresa_padrao") || EMPRESAS_BASE[0].cnpj;
    });
    const [ambiente, setAmbiente] = useState(() => {
        return localStorage.getItem("nfe_ambiente") || "homologacao";
    });
    const [serieNfe, setSerieNfe] = useState(() => {
        return localStorage.getItem("nfe_serie") || "1";
    });
    const [margemLucro, setMargemLucro] = useState(() => {
        return localStorage.getItem("nfe_margem_lucro") || "80";
    });

    const [dadosFiscais, setDadosFiscais] = useState(carregarDadosFiscais);
    const [editandoEmpresa, setEditandoEmpresa] = useState(null);
    const [formEmpresa, setFormEmpresa] = useState({});
    const [salvando, setSalvando] = useState(false);
    const [activeTab, setActiveTab] = useState("emissao");

    // Credenciais Nuvem Fiscal
    const [showHomologSecret, setShowHomologSecret] = useState(false);
    const [showProdSecret, setShowProdSecret] = useState(false);
    const [testando, setTestando] = useState(false);
    const [credenciais, setCredenciais] = useState({
        homolog_id: localStorage.getItem("nuvem_fiscal_homolog_id") || "",
        homolog_secret: localStorage.getItem("nuvem_fiscal_homolog_secret") || "",
        prod_id: localStorage.getItem("nuvem_fiscal_prod_id") || "",
        prod_secret: localStorage.getItem("nuvem_fiscal_prod_secret") || ""
    });

    // Carregar credenciais do Supabase ao montar
    useEffect(() => {
        const carregarCredenciais = async () => {
            try {
                const { data, error } = await supabase
                    .from('nfe_config')
                    .select('*');

                // Se tabela não existe (PGRST205) ou outro erro, apenas ignora silenciosamente
                // As credenciais continuarão sendo lidas do localStorage
                if (error) {
                    // Não loga erro se tabela não existe - comportamento esperado
                    return;
                }

                if (data && data.length > 0) {
                    const homolog = data.find(c => c.ambiente === 'homologacao');
                    const prod = data.find(c => c.ambiente === 'producao');

                    setCredenciais({
                        homolog_id: homolog?.client_id || "",
                        homolog_secret: homolog?.client_secret || "",
                        prod_id: prod?.client_id || "",
                        prod_secret: prod?.client_secret || ""
                    });
                }
            } catch (error) {
                // Ignora erros - credenciais continuam no localStorage
            }
        };

        carregarCredenciais();
    }, []);

    // Atualiza dados fiscais no localStorage quando mudam
    useEffect(() => {
        salvarDadosFiscais(dadosFiscais);
    }, [dadosFiscais]);

    const empresaSelecionada = EMPRESAS_BASE.find(e => e.cnpj === empresaPadrao);
    const ambienteSelecionado = AMBIENTES.find(a => a.value === ambiente);

    const abrirEdicaoEmpresa = (empresa) => {
        const dados = dadosFiscais[empresa.cnpj] || {};
        setFormEmpresa({
            ie: dados.ie || "",
            regimeTributario: dados.regimeTributario || "1",
            logradouro: dados.logradouro || "",
            numero: dados.numero || "",
            complemento: dados.complemento || "",
            bairro: dados.bairro || "",
            municipio: dados.municipio || "",
            codigoMunicipio: dados.codigoMunicipio || "",
            uf: dados.uf || "ES",
            cep: dados.cep || "",
        });
        setEditandoEmpresa(empresa);
    };

    const salvarDadosEmpresa = () => {
        if (!editandoEmpresa) return;
        setDadosFiscais(prev => ({
            ...prev,
            [editandoEmpresa.cnpj]: formEmpresa
        }));
        setEditandoEmpresa(null);
        toast.success(`Dados fiscais de ${editandoEmpresa.nome} salvos!`);
    };

    const salvarConfiguracoes = async () => {
        setSalvando(true);
        localStorage.setItem("nfe_empresa_padrao", empresaPadrao);
        localStorage.setItem("nfe_ambiente", ambiente);
        localStorage.setItem("nfe_serie", serieNfe);
        localStorage.setItem("nfe_margem_lucro", margemLucro);

        // Sempre salva no localStorage como backup
        localStorage.setItem("nuvem_fiscal_homolog_id", credenciais.homolog_id);
        localStorage.setItem("nuvem_fiscal_homolog_secret", credenciais.homolog_secret);
        localStorage.setItem("nuvem_fiscal_prod_id", credenciais.prod_id);
        localStorage.setItem("nuvem_fiscal_prod_secret", credenciais.prod_secret);

        try {
            const updates = [
                {
                    ambiente: 'homologacao',
                    client_id: credenciais.homolog_id,
                    client_secret: credenciais.homolog_secret
                },
                {
                    ambiente: 'producao',
                    client_id: credenciais.prod_id,
                    client_secret: credenciais.prod_secret
                }
            ];

            const { error } = await supabase
                .from('nfe_config')
                .upsert(updates, { onConflict: 'ambiente' });

            // Se tabela não existe (404), ignora silenciosamente - localStorage já foi salvo
            if (error && !error.message?.includes('404') && error.code !== 'PGRST116') {
                console.warn("nfe_config não disponível, usando localStorage:", error.message);
            }

            toast.success("Configurações de NFe salvas com sucesso!");
        } catch (error) {
            // Erro de rede ou outro - localStorage já foi salvo
            console.warn("Erro ao salvar no Supabase (usando localStorage):", error);
            toast.success("Configurações salvas localmente!");
        } finally {
            setSalvando(false);
        }
    };

    const testarConexaoNuvemFiscal = async () => {
        const clientId = ambiente === "producao" ? credenciais.prod_id : credenciais.homolog_id;
        const clientSecret = ambiente === "producao" ? credenciais.prod_secret : credenciais.homolog_secret;

        if (!clientId || !clientSecret) {
            toast.error("Preencha as credenciais antes de testar");
            return;
        }

        setTestando(true);
        try {
            const response = await fetch('https://auth.nuvemfiscal.com.br/oauth/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'client_credentials',
                    client_id: clientId,
                    client_secret: clientSecret,
                    scope: 'nfe'
                })
            });

            if (response.ok) {
                const data = await response.json();
                toast.success(`Conexão OK! Token válido por ${data.expires_in}s`);
            } else {
                const error = await response.json();
                toast.error(error.error_description || "Credenciais inválidas");
            }
        } catch (error) {
            toast.error("Erro ao conectar: " + error.message);
        } finally {
            setTestando(false);
        }
    };

    const getStatusEmpresa = (cnpj) => {
        const dados = dadosFiscais[cnpj];
        if (!dados?.ie || !dados?.logradouro) {
            return { ok: false, msg: "Incompleto" };
        }
        return { ok: true, msg: "Configurado" };
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex items-start justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <FileText className="w-8 h-8 text-green-600" />
                        Emissor Fiscal (NFe)
                    </h2>
                    <p className="text-gray-500 mt-1">Configure empresas, credenciais da Nuvem Fiscal e regras de emissão.</p>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="bg-gray-100 p-1 rounded-lg w-full justify-start">
                    <TabsTrigger value="emissao" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        <ScrollText className="w-4 h-4 mr-2" /> Regras de Emissão
                    </TabsTrigger>
                    <TabsTrigger value="empresas" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        <Building2 className="w-4 h-4 mr-2" /> Empresas
                    </TabsTrigger>
                    <TabsTrigger value="credenciais" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        <Key className="w-4 h-4 mr-2" /> Credenciais API
                    </TabsTrigger>
                </TabsList>

                {/* TAB 1: REGRAS DE EMISSÃO */}
                <TabsContent value="emissao" className="space-y-6 mt-0">
                    <Card className="border-t-4 border-t-green-600 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Factory className="w-5 h-5 text-gray-500" />
                                Configurações Gerais
                            </CardTitle>
                            <CardDescription>Defina o ambiente e padrões para emissão de notas</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label>Ambiente SEFAZ</Label>
                                    <Select value={ambiente} onValueChange={setAmbiente}>
                                        <SelectTrigger className="bg-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {AMBIENTES.map(amb => (
                                                <SelectItem key={amb.value} value={amb.value}>
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full ${amb.value === 'producao' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                                                        {amb.label}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-gray-500">
                                        {ambiente === "homologacao"
                                            ? "Notas enviadas em homologação NÃO têm validade fiscal."
                                            : "CUIDADO: Notas enviadas em produção TÊM validade fiscal."}
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="serie">Série da NFe</Label>
                                    <Input
                                        id="serie"
                                        type="number"
                                        min="1"
                                        max="999"
                                        value={serieNfe}
                                        onChange={(e) => setSerieNfe(e.target.value)}
                                        className="bg-white"
                                    />
                                </div>
                            </div>

                            <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg flex gap-4">
                                <div className="p-2 bg-blue-100 rounded-lg h-fit text-blue-600">
                                    <Percent className="w-5 h-5" />
                                </div>
                                <div className="space-y-2 flex-1">
                                    <Label htmlFor="margem" className="text-blue-900 font-semibold">Margem de Lucro para NFe de Entrada</Label>
                                    <p className="text-sm text-blue-700">Ao importar XML de fornecedores, o sistema sugerirá o preço de venda aplicando esta margem sobre o custo.</p>
                                    <div className="flex items-center gap-2 max-w-[200px]">
                                        <Input
                                            id="margem"
                                            type="number"
                                            value={margemLucro}
                                            onChange={(e) => setMargemLucro(e.target.value)}
                                            className="bg-white border-blue-200"
                                        />
                                        <span className="text-blue-600 font-bold">%</span>
                                    </div>
                                    <div className="text-xs text-blue-600 mt-1">
                                        Ex: Custo R$ 100,00 + {margemLucro}% = Venda R$ {(100 * (1 + parseFloat(margemLucro || 0) / 100)).toFixed(2)}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TAB 2: EMPRESAS */}
                <TabsContent value="empresas" className="mt-0">
                    <Card className="border-t-4 border-t-green-600 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Building2 className="w-5 h-5 text-gray-500" />
                                Empresas Emissoras
                            </CardTitle>
                            <CardDescription>Gerencie os dados fiscais de cada CNPJ</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid md:grid-cols-2 gap-4">
                                {EMPRESAS_BASE.map(empresa => {
                                    const status = getStatusEmpresa(empresa.cnpj);
                                    const isPadrao = empresaPadrao === empresa.cnpj;
                                    const dados = dadosFiscais[empresa.cnpj] || {};

                                    return (
                                        <div
                                            key={empresa.cnpj}
                                            className={`p-5 rounded-xl border-2 transition-all relative overflow-hidden group hover:shadow-md ${isPadrao ? "border-green-500 bg-green-50/50" : "border-gray-100 bg-white"
                                                }`}
                                        >
                                            <div className="flex items-start justify-between mb-4">
                                                <div>
                                                    <h4 className="font-bold text-gray-900">{empresa.nome}</h4>
                                                    <p className="text-xs text-gray-500 font-mono mt-0.5">{empresa.cnpjFormatado}</p>
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    {isPadrao && (
                                                        <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">Padrão</Badge>
                                                    )}
                                                    <Badge variant="outline" className={status.ok ? "text-blue-600 bg-blue-50 border-blue-100" : "text-red-600 bg-red-50 border-red-100"}>
                                                        {status.msg}
                                                    </Badge>
                                                </div>
                                            </div>

                                            <div className="space-y-2 mb-5">
                                                <div className="flex justify-between text-sm py-1 border-b border-dashed border-gray-200">
                                                    <span className="text-gray-500">Inscrição Estadual</span>
                                                    <span className="font-mono">{dados.ie || "-"}</span>
                                                </div>
                                                <div className="flex justify-between text-sm py-1 border-b border-dashed border-gray-200">
                                                    <span className="text-gray-500">Regime</span>
                                                    <span>{REGIMES_TRIBUTARIOS.find(r => r.value === dados.regimeTributario)?.label.split(" - ")[0] || "-"}</span>
                                                </div>
                                                <div className="text-sm py-1">
                                                    <span className="text-gray-500 block text-xs mb-0.5">Endereço</span>
                                                    <span className="line-clamp-1 text-gray-700">
                                                        {dados.logradouro ? `${dados.logradouro}, ${dados.numero} - ${dados.municipio}/${dados.uf}` : "-"}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="flex-1"
                                                    onClick={() => abrirEdicaoEmpresa(empresa)}
                                                >
                                                    <Edit className="w-3.5 h-3.5 mr-2" />
                                                    Editar Dados
                                                </Button>
                                                {!isPadrao && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => setEmpresaPadrao(empresa.cnpj)}
                                                        title="Definir como empresa padrão para emissão"
                                                    >
                                                        <CheckCircle className="w-4 h-4 text-gray-400 hover:text-green-600" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TAB 3: CREDENCIAIS */}
                <TabsContent value="credenciais" className="mt-0">
                    <Card className="border-t-4 border-t-green-600 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Key className="w-5 h-5 text-gray-500" />
                                API Nuvem Fiscal
                            </CardTitle>
                            <CardDescription>Configure as chaves de acesso para comunicação com a SEFAZ via Nuvem Fiscal</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">

                            {/* Homologação */}
                            <div className="space-y-4 p-5 border border-yellow-200 rounded-xl bg-yellow-50/30">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="p-1.5 bg-yellow-100 rounded-md text-yellow-700">
                                        <ShieldCheck className="w-4 h-4" />
                                    </div>
                                    <span className="font-semibold text-yellow-900">Ambiente de Homologação</span>
                                    <Badge variant="outline" className="ml-auto border-yellow-300 text-yellow-700 bg-yellow-50">Para testes</Badge>
                                </div>

                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-gray-500 uppercase">Client ID</Label>
                                        <Input
                                            value={credenciais.homolog_id}
                                            onChange={(e) => setCredenciais({ ...credenciais, homolog_id: e.target.value })}
                                            className="font-mono text-sm bg-white"
                                            placeholder="Ex: 1234..."
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-gray-500 uppercase">Client Secret</Label>
                                        <div className="relative">
                                            <Input
                                                type={showHomologSecret ? "text" : "password"}
                                                value={credenciais.homolog_secret}
                                                onChange={(e) => setCredenciais({ ...credenciais, homolog_secret: e.target.value })}
                                                className="font-mono text-sm pr-10 bg-white"
                                                placeholder="••••••••"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowHomologSecret(!showHomologSecret)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                            >
                                                {showHomologSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Produção */}
                            <div className="space-y-4 p-5 border border-green-200 rounded-xl bg-green-50/30">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="p-1.5 bg-green-100 rounded-md text-green-700">
                                        <Cloud className="w-4 h-4" />
                                    </div>
                                    <span className="font-semibold text-green-900">Ambiente de Produção</span>
                                    <Badge variant="outline" className="ml-auto border-green-300 text-green-700 bg-green-50">Oficial</Badge>
                                </div>

                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-gray-500 uppercase">Client ID</Label>
                                        <Input
                                            value={credenciais.prod_id}
                                            onChange={(e) => setCredenciais({ ...credenciais, prod_id: e.target.value })}
                                            className="font-mono text-sm bg-white"
                                            placeholder="Ex: 5678..."
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-gray-500 uppercase">Client Secret</Label>
                                        <div className="relative">
                                            <Input
                                                type={showProdSecret ? "text" : "password"}
                                                value={credenciais.prod_secret}
                                                onChange={(e) => setCredenciais({ ...credenciais, prod_secret: e.target.value })}
                                                className="font-mono text-sm pr-10 bg-white"
                                                placeholder="••••••••"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowProdSecret(!showProdSecret)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                            >
                                                {showProdSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t">
                                <a
                                    href="https://app.nuvemfiscal.com.br"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
                                >
                                    Painel Nuvem Fiscal <ExternalLink className="w-3 h-3" />
                                </a>
                                <Button
                                    variant="outline"
                                    onClick={testarConexaoNuvemFiscal}
                                    disabled={testando}
                                    className="border-green-200 hover:bg-green-50 text-green-700"
                                >
                                    {testando ? (
                                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verificando...</>
                                    ) : (
                                        <><RefreshCw className="w-4 h-4 mr-2" /> Testar Conexão ({ambiente})</>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Footer Fixo de Ação */}
            <div className="flex justify-end pt-4 bg-white/50 backdrop-blur-sm sticky bottom-0 pb-4 border-t">
                <Button
                    onClick={salvarConfiguracoes}
                    disabled={salvando}
                    className="bg-green-700 hover:bg-green-800 text-white shadow-lg min-w-[200px]"
                >
                    {salvando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Salvar Alterações
                </Button>
            </div>

            {/* Modal de Edição de Empresa (Mantido Igual, apenas estilo) */}
            <Dialog open={!!editandoEmpresa} onOpenChange={() => setEditandoEmpresa(null)}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Building2 className="w-5 h-5 text-green-600" />
                            Dados Fiscais - {editandoEmpresa?.nome}
                        </DialogTitle>
                        <DialogDescription>
                            Edite as informações fiscais (IE, Regime) e endereço da empresa.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        <div className="space-y-4">
                            <h4 className="font-semibold text-gray-900 border-b pb-2">Informações Fiscais</h4>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <Label>Inscrição Estadual (IE) *</Label>
                                    <Input
                                        value={formEmpresa.ie || ""}
                                        onChange={(e) => setFormEmpresa({ ...formEmpresa, ie: e.target.value })}
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label>Regime Tributário *</Label>
                                    <Select
                                        value={formEmpresa.regimeTributario || "1"}
                                        onValueChange={(v) => setFormEmpresa({ ...formEmpresa, regimeTributario: v })}
                                    >
                                        <SelectTrigger className="mt-1">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {REGIMES_TRIBUTARIOS.map(r => (
                                                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h4 className="font-semibold text-gray-900 border-b pb-2">Endereço</h4>
                            <div className="grid md:grid-cols-3 gap-4">
                                <div className="md:col-span-2">
                                    <Label>Logradouro *</Label>
                                    <Input
                                        value={formEmpresa.logradouro || ""}
                                        onChange={(e) => setFormEmpresa({ ...formEmpresa, logradouro: e.target.value })}
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label>Número *</Label>
                                    <Input
                                        value={formEmpresa.numero || ""}
                                        onChange={(e) => setFormEmpresa({ ...formEmpresa, numero: e.target.value })}
                                        className="mt-1"
                                    />
                                </div>
                            </div>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <Label>Complemento</Label>
                                    <Input
                                        value={formEmpresa.complemento || ""}
                                        onChange={(e) => setFormEmpresa({ ...formEmpresa, complemento: e.target.value })}
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label>Bairro *</Label>
                                    <Input
                                        value={formEmpresa.bairro || ""}
                                        onChange={(e) => setFormEmpresa({ ...formEmpresa, bairro: e.target.value })}
                                        className="mt-1"
                                    />
                                </div>
                            </div>
                            <div className="grid md:grid-cols-3 gap-4">
                                <div>
                                    <Label>Município *</Label>
                                    <Input
                                        value={formEmpresa.municipio || ""}
                                        onChange={(e) => setFormEmpresa({ ...formEmpresa, municipio: e.target.value })}
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label>UF *</Label>
                                    <Select
                                        value={formEmpresa.uf || "ES"}
                                        onValueChange={(v) => setFormEmpresa({ ...formEmpresa, uf: v })}
                                    >
                                        <SelectTrigger className="mt-1">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"].map(uf => (
                                                <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>CEP *</Label>
                                    <Input
                                        value={formEmpresa.cep || ""}
                                        onChange={(e) => setFormEmpresa({ ...formEmpresa, cep: e.target.value })}
                                        className="mt-1"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="border-t pt-4">
                        <Button variant="ghost" onClick={() => setEditandoEmpresa(null)}>
                            Cancelar
                        </Button>
                        <Button onClick={salvarDadosEmpresa} className="bg-green-700 hover:bg-green-800">
                            <Save className="w-4 h-4 mr-2" />
                            Salvar Dados Fiscais
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
