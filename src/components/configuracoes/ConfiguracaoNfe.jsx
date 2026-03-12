import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    Building2, Save, CheckCircle, Edit, AlertCircle, Search
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

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

    const [dadosFiscais, setDadosFiscais] = useState(carregarDadosFiscais);
    const [editandoEmpresa, setEditandoEmpresa] = useState(null);
    const [formEmpresa, setFormEmpresa] = useState({});
    const [highlightEmitente, setHighlightEmitente] = useState(false);

    // Check for highlight signal from EmitirNFeModal
    useEffect(() => {
        const signal = localStorage.getItem('nfe_highlight_emitente');
        if (signal === '1') {
            localStorage.removeItem('nfe_highlight_emitente');
            setHighlightEmitente(true);
        }
    }, []);

    // Atualiza dados fiscais no localStorage quando mudam
    useEffect(() => {
        salvarDadosFiscais(dadosFiscais);
    }, [dadosFiscais]);

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

    const formatarTexto = (valor) => {
        if (!valor) return "";
        return valor.toLowerCase().replace(/(?:^|\s|["'([{])+\S/g, match => match.toUpperCase());
    };

    const buscarCEP = async (cep) => {
        if (!cep) return;
        const cepLimpo = cep.replace(/\D/g, '');
        if (cepLimpo.length !== 8) return;

        const toastId = toast.loading("Buscando CEP...");

        try {
            const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
            const data = await response.json();

            if (!data.erro) {
                const novoEndereco = {
                    logradouro: formatarTexto(data.logradouro || ""),
                    bairro: formatarTexto(data.bairro || ""),
                    municipio: formatarTexto(data.localidade || ""),
                    uf: data.uf || "",
                    codigoMunicipio: data.ibge || ""
                };

                setFormEmpresa(prev => ({
                    ...prev,
                    ...novoEndereco
                }));

                toast.success("Endereço encontrado e preenchido!", { id: toastId });
            } else {
                toast.error("CEP não encontrado.", { id: toastId });
            }
        } catch (error) {
            toast.error("Erro ao buscar CEP.", { id: toastId });
        }
    };

    const buscarCNPJ = async (cnpj) => {
        const cnpjLimpo = cnpj.replace(/\D/g, '');
        if (cnpjLimpo.length !== 14) return;

        try {
            const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
            const data = await response.json();

            let regime = "1";
            if (data.opcao_pelo_simples === false) {
                regime = "3";
            }

            setFormEmpresa(prev => ({
                ...prev,
                municipio: formatarTexto(data.municipio || ""),
                codigoMunicipio: data.codigo_municipio_ibge || "",
                uf: data.uf || "",
                logradouro: formatarTexto(data.logradouro || ""),
                numero: data.numero || "",
                complemento: formatarTexto(data.complemento || ""),
                bairro: formatarTexto(data.bairro || ""),
                cep: data.cep?.replace(/\D/g, '') || "",
                regimeTributario: regime
            }));
            toast.success("Dados carregados!");
        } catch (error) {
            toast.error("Erro ao buscar CNPJ.");
        }
    };

    const salvarDadosEmpresa = () => {
        if (!editandoEmpresa) return;
        setDadosFiscais(prev => ({
            ...prev,
            [editandoEmpresa.cnpj]: formEmpresa
        }));
        setEditandoEmpresa(null);
        toast.success(`Dados de ${editandoEmpresa.nome} salvos!`);
    };

    const getStatusEmpresa = (cnpj) => {
        const dados = dadosFiscais[cnpj];
        if (!dados?.ie || !dados?.logradouro) {
            return { ok: false, msg: "Incompleto" };
        }
        return { ok: true, msg: "Configurado" };
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Building2 className="w-8 h-8 text-green-600" />
                    Dados Fiscais das Empresas
                </h2>
                <p className="text-gray-500 mt-1">Gerencie os dados fiscais obrigatórios para cada CNPJ emissor.</p>
            </div>

            <Card className="border-t-4 border-t-green-600 shadow-sm">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-gray-500" />
                        Empresas Cadastradas
                    </CardTitle>
                    <CardDescription>Configure Inscrição Estadual e endereços fiscais</CardDescription>
                </CardHeader>
                <CardContent>
                    {highlightEmitente && (
                        <Alert className="mb-6 bg-red-50 border-red-200">
                            <AlertCircle className="h-4 w-4 text-red-600" />
                            <AlertDescription className="text-red-700">
                                <strong>Atenção:</strong> Dados fiscais obrigatórios estão faltando para emissão de notas.
                            </AlertDescription>
                        </Alert>
                    )}
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
                                                <Badge className="bg-green-100 text-green-800 border-green-200">Padrão</Badge>
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
                                            <span className="text-gray-500 block text-xs mb-0.5">Endereço Fiscal</span>
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
                                                onClick={() => {
                                                    setEmpresaPadrao(empresa.cnpj);
                                                    localStorage.setItem("nfe_empresa_padrao", empresa.cnpj);
                                                    toast.success(`${empresa.nome} definida como padrão.`);
                                                }}
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

                    <div className="space-y-4 py-4">
                        <div className="bg-blue-50 border border-blue-100 rounded-md p-3 mb-4 flex gap-4 text-sm text-blue-800">
                            <div className="flex items-center gap-2">
                                <Search className="w-4 h-4" />
                                <span className="font-semibold">Preencher via CNPJ:</span>
                                <Button variant="link" className="p-0 h-auto font-normal text-blue-700 underline" onClick={() => buscarCNPJ(editandoEmpresa.cnpj)}>
                                    Buscar dados de {editandoEmpresa?.cnpjFormatado || editandoEmpresa?.cnpj}
                                </Button>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <Label>Inscrição Estadual (IE)</Label>
                                <Input
                                    value={formEmpresa.ie || ""}
                                    onChange={(e) => setFormEmpresa({ ...formEmpresa, ie: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label>Regime Tributário</Label>
                                <Select
                                    value={formEmpresa.regimeTributario || "1"}
                                    onValueChange={(v) => setFormEmpresa({ ...formEmpresa, regimeTributario: v })}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1">Simples Nacional</SelectItem>
                                        <SelectItem value="3">Regime Normal</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="border-t pt-4">
                            <h4 className="font-medium mb-3 text-gray-700">Endereço Fiscal</h4>
                            <div className="grid md:grid-cols-3 gap-4 mb-4">
                                <div className="md:col-span-1">
                                    <Label>CEP</Label>
                                    <Input
                                        value={formEmpresa.cep || ""}
                                        onChange={(e) => setFormEmpresa({ ...formEmpresa, cep: e.target.value })}
                                        onBlur={(e) => buscarCEP(e.target.value)}
                                        placeholder="00000-000"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <Label>Logradouro</Label>
                                    <Input
                                        value={formEmpresa.logradouro || ""}
                                        onChange={(e) => setFormEmpresa({ ...formEmpresa, logradouro: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid md:grid-cols-3 gap-4 mb-4">
                                <div><Label>Número</Label><Input value={formEmpresa.numero || ""} onChange={(e) => setFormEmpresa({ ...formEmpresa, numero: e.target.value })} /></div>
                                <div className="md:col-span-2"><Label>Complemento</Label><Input value={formEmpresa.complemento || ""} onChange={(e) => setFormEmpresa({ ...formEmpresa, complemento: e.target.value })} /></div>
                            </div>

                            <div className="grid md:grid-cols-3 gap-4">
                                <div><Label>Bairro</Label><Input value={formEmpresa.bairro || ""} onChange={(e) => setFormEmpresa({ ...formEmpresa, bairro: e.target.value })} /></div>
                                <div><Label>Município *</Label><Input value={formEmpresa.municipio || ""} onChange={(e) => setFormEmpresa({ ...formEmpresa, municipio: e.target.value })} /></div>
                                <div>
                                    <Label>UF *</Label>
                                    <Select value={formEmpresa.uf || "ES"} onValueChange={(v) => setFormEmpresa({ ...formEmpresa, uf: v })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"].map(uf => (
                                                <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="border-t pt-4">
                        <Button variant="ghost" onClick={() => setEditandoEmpresa(null)}>Cancelar</Button>
                        <Button onClick={salvarDadosEmpresa} className="bg-green-700 hover:bg-green-800">
                            <Save className="w-4 h-4 mr-2" /> Salvar Dados Fiscais
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
