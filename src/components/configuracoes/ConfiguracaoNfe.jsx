import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    Building2, Save, CheckCircle, Edit, AlertCircle, Search, Loader2
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useTenant } from "@/contexts/TenantContext";

const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

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

// Lê do localStorage como fallback (dados legados)
const carregarDadosFiscaisLocal = () => {
    try {
        const dados = localStorage.getItem("nfe_empresas_fiscais");
        return dados ? JSON.parse(dados) : {};
    } catch {
        return {};
    }
};

// Mapeia colunas do banco → objeto formEmpresa
const dbConfigParaForm = (config) => ({
    ie: config.emitente_ie || "",
    regimeTributario: String(config.emitente_crt || "1"),
    logradouro: config.emitente_logradouro || "",
    numero: config.emitente_numero || "",
    complemento: config.emitente_complemento || "",
    bairro: config.emitente_bairro || "",
    municipio: config.emitente_municipio || "",
    codigoMunicipio: config.emitente_codigo_municipio || "",
    uf: config.emitente_uf || "ES",
    cep: config.emitente_cep || "",
});

export default function ConfiguracaoNfe() {
    const { organization } = useTenant();
    const orgId = organization?.id || DEFAULT_ORG_ID;

    const [empresaPadrao, setEmpresaPadrao] = useState(() => {
        return localStorage.getItem("nfe_empresa_padrao") || EMPRESAS_BASE[0].cnpj;
    });

    const [dadosFiscais, setDadosFiscais] = useState(carregarDadosFiscaisLocal);
    const [editandoEmpresa, setEditandoEmpresa] = useState(null);
    const [formEmpresa, setFormEmpresa] = useState({});
    const [highlightEmitente, setHighlightEmitente] = useState(false);
    const [savingDb, setSavingDb] = useState(false);
    const [acbrCredentials, setAcbrCredentials] = useState({ client_id: '', client_secret: '' });
    const [savingCredentials, setSavingCredentials] = useState(false);
    const [certDialogOpen, setCertDialogOpen] = useState(false);
    const [savingCert, setSavingCert] = useState(false);
    const [certFile, setCertFile] = useState(null);
    const [certPassword, setCertPassword] = useState('');
    const [certStatus, setCertStatus] = useState({
        empresaRegistrada: false,
        validade: null,
        thumbprint: null,
    });
    const [certForm, setCertForm] = useState({
        cnpj: '',
        nome_razao_social: '',
        email: '',
        logradouro: '',
        numero: '',
        complemento: '',
        bairro: '',
        cidade: '',
        uf: 'ES',
        cep: '',
        codigo_municipio: '',
    });

    // ─── Padrões Fiscais (org-level defaults) ────────────────────────────────
    const [fiscalDefaults, setFiscalDefaults] = useState({
        csosn_padrao: '102',
        cst_icms_padrao: '00',
        cst_pis_padrao: '49',
        cst_cofins_padrao: '49',
        aliquota_icms_padrao: '17.00',
        aliquota_icms_interestadual_padrao: '12.00',
        aliquota_pis_padrao: '0.65',
        aliquota_cofins_padrao: '3.00',
        percentual_tributos_padrao: '17.00',
        mod_frete_padrao: '9',
    });
    const [savingFiscal, setSavingFiscal] = useState(false);
    const [fiscalLoaded, setFiscalLoaded] = useState(false);

    // Check for highlight signal from EmitirNFeModal
    useEffect(() => {
        const signal = localStorage.getItem('nfe_highlight_emitente');
        if (signal === '1') {
            localStorage.removeItem('nfe_highlight_emitente');
            setHighlightEmitente(true);
        }
    }, []);

    // ─── Carregar emitente ativo do banco ────────────────────────────────────
    useEffect(() => {
        async function carregarDoDb() {
            const { data, error } = await supabase
                .from('organization_nfe_configs')
                .select('emitente_cnpj, emitente_nome, emitente_ie, emitente_uf, emitente_crt, emitente_logradouro, emitente_numero, emitente_complemento, emitente_bairro, emitente_municipio, emitente_cep, emitente_codigo_municipio, emitente_email, acbr_client_id, acbr_client_secret, acbr_empresa_registrada, acbr_certificado_validade, acbr_certificado_thumbprint, csosn_padrao, cst_icms_padrao, cst_pis_padrao, cst_cofins_padrao, aliquota_icms_padrao, aliquota_icms_interestadual_padrao, aliquota_pis_padrao, aliquota_cofins_padrao, percentual_tributos_padrao, mod_frete_padrao')
                .eq('organization_id', orgId)
                .maybeSingle();

            if (error || !data) return;

            // Credenciais ACBR
            if (data.acbr_client_id || data.acbr_client_secret) {
                setAcbrCredentials({
                    client_id: data.acbr_client_id || '',
                    client_secret: data.acbr_client_secret || '',
                });
            }

            setCertStatus({
                empresaRegistrada: !!data.acbr_empresa_registrada,
                validade: data.acbr_certificado_validade || null,
                thumbprint: data.acbr_certificado_thumbprint || null,
            });

            // Padrões Fiscais
            setFiscalDefaults(prev => ({
                csosn_padrao: data.csosn_padrao || prev.csosn_padrao,
                cst_icms_padrao: data.cst_icms_padrao || prev.cst_icms_padrao,
                cst_pis_padrao: data.cst_pis_padrao || prev.cst_pis_padrao,
                cst_cofins_padrao: data.cst_cofins_padrao || prev.cst_cofins_padrao,
                aliquota_icms_padrao: data.aliquota_icms_padrao != null ? String(data.aliquota_icms_padrao) : prev.aliquota_icms_padrao,
                aliquota_icms_interestadual_padrao: data.aliquota_icms_interestadual_padrao != null ? String(data.aliquota_icms_interestadual_padrao) : prev.aliquota_icms_interestadual_padrao,
                aliquota_pis_padrao: data.aliquota_pis_padrao != null ? String(data.aliquota_pis_padrao) : prev.aliquota_pis_padrao,
                aliquota_cofins_padrao: data.aliquota_cofins_padrao != null ? String(data.aliquota_cofins_padrao) : prev.aliquota_cofins_padrao,
                percentual_tributos_padrao: data.percentual_tributos_padrao != null ? String(data.percentual_tributos_padrao) : prev.percentual_tributos_padrao,
                mod_frete_padrao: data.mod_frete_padrao != null ? String(data.mod_frete_padrao) : prev.mod_frete_padrao,
            }));
            setFiscalLoaded(true);

            const { emitente_cnpj } = data;
            if (!emitente_cnpj) return;

            // Empresa padrão vem do banco
            const cnpjLimpo = emitente_cnpj.replace(/\D/g, '');
            setEmpresaPadrao(cnpjLimpo);
            localStorage.setItem("nfe_empresa_padrao", cnpjLimpo);

            // Dados fiscais come do banco (sobrescreve localStorage para esta empresa)
            setDadosFiscais(prev => ({
                ...prev,
                [cnpjLimpo]: dbConfigParaForm(data),
            }));
        }

        carregarDoDb();
    }, [orgId]);

    // Helper: upsert emitente no banco
    const salvarEmitenteNoBanco = async (empresa, form) => {
        const cnpjLimpo = empresa.cnpj.replace(/\D/g, '');
        const upsertData = {
            emitente_cnpj: cnpjLimpo,
            emitente_nome: empresa.nome,
            emitente_ie: form.ie || null,
            emitente_uf: form.uf || 'ES',
            emitente_crt: parseInt(form.regimeTributario || '1'),
            emitente_logradouro: form.logradouro || null,
            emitente_numero: form.numero || null,
            emitente_bairro: form.bairro || null,
            emitente_municipio: form.municipio || null,
            emitente_cep: (form.cep || '').replace(/\D/g, '') || null,
            emitente_codigo_municipio: form.codigoMunicipio || null,
        };

        // Atualiza todos os rows da org (homologação + produção)
        const { error } = await supabase
            .from('organization_nfe_configs')
            .update(upsertData)
            .eq('organization_id', orgId);

        return error;
    };

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

    const salvarDadosEmpresa = async () => {
        if (!editandoEmpresa) return;

        // 1. Atualiza state local + localStorage (backward compat)
        const novosDados = { ...dadosFiscais, [editandoEmpresa.cnpj]: formEmpresa };
        setDadosFiscais(novosDados);
        localStorage.setItem("nfe_empresas_fiscais", JSON.stringify(novosDados));

        // 2. Se for a empresa padrão, persiste no banco
        if (editandoEmpresa.cnpj === empresaPadrao) {
            setSavingDb(true);
            try {
                const err = await salvarEmitenteNoBanco(editandoEmpresa, formEmpresa);
                if (err) {
                    console.error('[ConfiguracaoNfe] Erro ao salvar no banco:', err);
                    toast.warning(`Dados salvos localmente, mas não foi possível salvar no banco: ${err.message}`);
                } else {
                    toast.success(`Dados de ${editandoEmpresa.nome} salvos!`);
                }
            } finally {
                setSavingDb(false);
            }
        } else {
            toast.success(`Dados de ${editandoEmpresa.nome} salvos!`);
        }

        setEditandoEmpresa(null);
    };

    const getStatusEmpresa = (cnpj) => {
        const dados = dadosFiscais[cnpj];
        if (!dados?.ie || !dados?.logradouro) {
            return { ok: false, msg: "Incompleto" };
        }
        return { ok: true, msg: "Configurado" };
    };

    // ─── Salvar Padrões Fiscais ─────────────────────────────────────────────
    const handleSalvarFiscalDefaults = async () => {
        setSavingFiscal(true);
        try {
            const updateData = {
                csosn_padrao: fiscalDefaults.csosn_padrao || null,
                cst_icms_padrao: fiscalDefaults.cst_icms_padrao || null,
                cst_pis_padrao: fiscalDefaults.cst_pis_padrao || null,
                cst_cofins_padrao: fiscalDefaults.cst_cofins_padrao || null,
                aliquota_icms_padrao: fiscalDefaults.aliquota_icms_padrao ? parseFloat(fiscalDefaults.aliquota_icms_padrao) : null,
                aliquota_icms_interestadual_padrao: fiscalDefaults.aliquota_icms_interestadual_padrao ? parseFloat(fiscalDefaults.aliquota_icms_interestadual_padrao) : null,
                aliquota_pis_padrao: fiscalDefaults.aliquota_pis_padrao ? parseFloat(fiscalDefaults.aliquota_pis_padrao) : null,
                aliquota_cofins_padrao: fiscalDefaults.aliquota_cofins_padrao ? parseFloat(fiscalDefaults.aliquota_cofins_padrao) : null,
                percentual_tributos_padrao: fiscalDefaults.percentual_tributos_padrao ? parseFloat(fiscalDefaults.percentual_tributos_padrao) : null,
                mod_frete_padrao: fiscalDefaults.mod_frete_padrao != null ? parseInt(fiscalDefaults.mod_frete_padrao) : null,
            };

            const { error } = await supabase
                .from('organization_nfe_configs')
                .update(updateData)
                .eq('organization_id', orgId);

            if (error) throw error;
            toast.success('Padrões fiscais salvos com sucesso!');
        } catch (err) {
            toast.error('Erro ao salvar padrões fiscais: ' + err.message);
        } finally {
            setSavingFiscal(false);
        }
    };

    const handleSalvarCredentials = async () => {
        if (!acbrCredentials.client_id.trim() || !acbrCredentials.client_secret.trim()) {
            toast.error('Preencha Client ID e Client Secret.');
            return;
        }
        setSavingCredentials(true);
        try {
            const { error } = await supabase
                .from('organization_nfe_configs')
                .update({
                    acbr_client_id: acbrCredentials.client_id.trim(),
                    acbr_client_secret: acbrCredentials.client_secret.trim(),
                    acbr_access_token: null,
                    acbr_token_expires_at: null,
                })
                .eq('organization_id', orgId);

            if (error) throw error;
            toast.success('Credenciais da ACBR API salvas com sucesso!');
        } catch (err) {
            toast.error('Erro ao salvar credenciais: ' + err.message);
        } finally {
            setSavingCredentials(false);
        }
    };

    const validarCnpj = (cnpj) => {
        const cleaned = (cnpj || '').replace(/\D/g, '');
        if (cleaned.length !== 14) return false;
        if (/^(\d)\1{13}$/.test(cleaned)) return false;

        let length = cleaned.length - 2;
        let numbers = cleaned.substring(0, length);
        const digits = cleaned.substring(length);
        let sum = 0;
        let pos = length - 7;

        for (let i = length; i >= 1; i--) {
            sum += parseInt(numbers.charAt(length - i), 10) * pos--;
            if (pos < 2) pos = 9;
        }

        let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
        if (result !== parseInt(digits.charAt(0), 10)) return false;

        length += 1;
        numbers = cleaned.substring(0, length);
        sum = 0;
        pos = length - 7;

        for (let i = length; i >= 1; i--) {
            sum += parseInt(numbers.charAt(length - i), 10) * pos--;
            if (pos < 2) pos = 9;
        }

        result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
        return result === parseInt(digits.charAt(1), 10);
    };

    const fileToBase64 = async (file) => {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, i + chunkSize);
            binary += String.fromCharCode(...chunk);
        }
        return btoa(binary);
    };

    const abrirDialogCertificado = () => {
        const empresaAtual = EMPRESAS_BASE.find(e => e.cnpj === empresaPadrao);
        const dados = dadosFiscais[empresaPadrao] || {};

        setCertForm({
            cnpj: (empresaPadrao || '').replace(/\D/g, ''),
            nome_razao_social: empresaAtual?.nome || '',
            email: '',
            logradouro: dados.logradouro || '',
            numero: dados.numero || '',
            complemento: dados.complemento || '',
            bairro: dados.bairro || '',
            cidade: dados.municipio || '',
            uf: dados.uf || 'ES',
            cep: (dados.cep || '').replace(/\D/g, ''),
            codigo_municipio: dados.codigoMunicipio || '',
        });

        setCertFile(null);
        setCertPassword('');
        setCertDialogOpen(true);
    };

    const handleRegistrarCertificado = async () => {
        if (!validarCnpj(certForm.cnpj)) {
            toast.error('CNPJ inválido.');
            return;
        }
        if (!certForm.nome_razao_social?.trim()) {
            toast.error('Razão social é obrigatória.');
            return;
        }
        if (!certForm.email?.trim()) {
            toast.error('Email é obrigatório.');
            return;
        }
        if (!certFile) {
            toast.error('Selecione o certificado A1 (.pfx ou .p12).');
            return;
        }
        if (!certPassword.trim()) {
            toast.error('Senha do certificado é obrigatória.');
            return;
        }

        setSavingCert(true);
        try {
            const certificado_base64 = await fileToBase64(certFile);

            const { data, error } = await supabase.functions.invoke('registrar-empresa-acbr', {
                body: {
                    organization_id: orgId,
                    cnpj: certForm.cnpj,
                    nome_razao_social: certForm.nome_razao_social,
                    email: certForm.email,
                    endereco: {
                        logradouro: certForm.logradouro,
                        numero: certForm.numero,
                        complemento: certForm.complemento,
                        bairro: certForm.bairro,
                        cidade: certForm.cidade,
                        uf: certForm.uf,
                        cep: certForm.cep,
                        codigo_municipio: certForm.codigo_municipio,
                    },
                    certificado_base64,
                    certificado_senha: certPassword,
                },
            });

            if (error) {
                throw new Error(error.message || 'Erro ao registrar certificado');
            }
            if (!data?.success) {
                throw new Error(data?.error || 'Falha ao registrar certificado');
            }

            setCertStatus({
                empresaRegistrada: true,
                validade: data.data?.certificado_validade || null,
                thumbprint: data.data?.thumbprint || null,
            });

            toast.success('Certificado registrado com sucesso na ACBR API.');
            setCertDialogOpen(false);
        } catch (err) {
            toast.error('Erro ao registrar certificado: ' + err.message);
        } finally {
            setSavingCert(false);
        }
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

            {/* ─── Credenciais ACBR API ─────────────────────────────────── */}
            <Card className="border-t-4 border-t-blue-600 shadow-sm">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-blue-600" />
                        Credenciais da ACBR API
                    </CardTitle>
                    <CardDescription>
                        Client ID e Client Secret do painel da ACBR API. Obrigatório para emissão via API.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <Label>Client ID</Label>
                            <Input
                                value={acbrCredentials.client_id}
                                onChange={(e) => setAcbrCredentials(prev => ({ ...prev, client_id: e.target.value }))}
                                placeholder="Obtido em acbr.api.br"
                                className="font-mono text-sm"
                            />
                        </div>
                        <div>
                            <Label>Client Secret</Label>
                            <Input
                                type="password"
                                value={acbrCredentials.client_secret}
                                onChange={(e) => setAcbrCredentials(prev => ({ ...prev, client_secret: e.target.value }))}
                                placeholder="Obtido em acbr.api.br"
                                className="font-mono text-sm"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button onClick={handleSalvarCredentials} disabled={savingCredentials} className="bg-blue-700 hover:bg-blue-800">
                            {savingCredentials ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                            Salvar Credenciais
                        </Button>
                        {acbrCredentials.client_id && acbrCredentials.client_secret && (
                            <Badge className="bg-green-100 text-green-800 border-green-200">Configurado</Badge>
                        )}
                        {(!acbrCredentials.client_id || !acbrCredentials.client_secret) && (
                            <Badge variant="outline" className="text-red-600 bg-red-50 border-red-100">Pendente</Badge>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card className="border-t-4 border-t-indigo-600 shadow-sm">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-indigo-600" />
                        Certificado Digital (A1)
                    </CardTitle>
                    <CardDescription>
                        Cadastre ou renove o certificado A1 (.pfx/.p12) da empresa emissora para habilitar emissão na ACBR API.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                        {certStatus.empresaRegistrada ? (
                            <Badge className="bg-green-100 text-green-800 border-green-200">Empresa registrada na ACBR</Badge>
                        ) : (
                            <Badge variant="outline" className="text-red-600 bg-red-50 border-red-100">Empresa não registrada</Badge>
                        )}

                        {certStatus.validade ? (
                            <Badge variant="outline" className="text-blue-700 bg-blue-50 border-blue-200">
                                Validade: {new Date(certStatus.validade).toLocaleDateString('pt-BR')}
                            </Badge>
                        ) : (
                            <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200">Sem validade registrada</Badge>
                        )}
                    </div>

                    {certStatus.thumbprint && (
                        <p className="text-xs text-gray-600 font-mono break-all">
                            Thumbprint: {certStatus.thumbprint}
                        </p>
                    )}

                    <Button onClick={abrirDialogCertificado} className="bg-indigo-700 hover:bg-indigo-800">
                        Cadastrar / Renovar Certificado
                    </Button>
                </CardContent>
            </Card>

            {/* ─── Padrões Fiscais para Emissão de NF-e ───────────────── */}
            <Card className="border-t-4 border-t-amber-500 shadow-sm">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-amber-600" />
                        Padrões Fiscais para Emissão de NF-e
                    </CardTitle>
                    <CardDescription>
                        Valores padrão de CSOSN/CST, alíquotas e tributação usados na emissão. Produtos com valores próprios terão prioridade.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {(() => {
                        const crtAtual = dadosFiscais[empresaPadrao]?.regimeTributario || '1';
                        const isSimplesNacional = crtAtual === '1' || crtAtual === '2';

                        return (
                            <>
                                {/* CSOSN ou CST ICMS dependendo do regime */}
                                <div>
                                    <h4 className="font-medium text-gray-700 mb-3">
                                        {isSimplesNacional ? 'ICMS - Simples Nacional' : 'ICMS - Regime Normal'}
                                    </h4>
                                    <div className="grid md:grid-cols-3 gap-4">
                                        {isSimplesNacional ? (
                                            <div>
                                                <Label>CSOSN Padrão</Label>
                                                <Select
                                                    value={fiscalDefaults.csosn_padrao}
                                                    onValueChange={(v) => setFiscalDefaults(prev => ({ ...prev, csosn_padrao: v }))}
                                                >
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="102">102 - Tributada sem permissão de crédito</SelectItem>
                                                        <SelectItem value="103">103 - Isenção do ICMS (faixa SN)</SelectItem>
                                                        <SelectItem value="300">300 - Imune</SelectItem>
                                                        <SelectItem value="400">400 - Não tributada</SelectItem>
                                                        <SelectItem value="500">500 - ICMS cobrado por ST</SelectItem>
                                                        <SelectItem value="900">900 - Outros</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        ) : (
                                            <>
                                                <div>
                                                    <Label>CST ICMS Padrão</Label>
                                                    <Select
                                                        value={fiscalDefaults.cst_icms_padrao}
                                                        onValueChange={(v) => setFiscalDefaults(prev => ({ ...prev, cst_icms_padrao: v }))}
                                                    >
                                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="00">00 - Tributada integralmente</SelectItem>
                                                            <SelectItem value="10">10 - Tributada com ST</SelectItem>
                                                            <SelectItem value="20">20 - Com redução de base</SelectItem>
                                                            <SelectItem value="40">40 - Isenta</SelectItem>
                                                            <SelectItem value="41">41 - Não tributada</SelectItem>
                                                            <SelectItem value="60">60 - ICMS cobrado por ST</SelectItem>
                                                            <SelectItem value="90">90 - Outros</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div>
                                                    <Label>Alíquota ICMS (%)</Label>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        value={fiscalDefaults.aliquota_icms_padrao}
                                                        onChange={(e) => setFiscalDefaults(prev => ({ ...prev, aliquota_icms_padrao: e.target.value }))}
                                                        placeholder="17.00"
                                                    />
                                                </div>
                                                <div>
                                                    <Label>Alíquota Interestadual (%)</Label>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        value={fiscalDefaults.aliquota_icms_interestadual_padrao}
                                                        onChange={(e) => setFiscalDefaults(prev => ({ ...prev, aliquota_icms_interestadual_padrao: e.target.value }))}
                                                        placeholder="12.00"
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* PIS / COFINS */}
                                <div className="border-t pt-4">
                                    <h4 className="font-medium text-gray-700 mb-3">PIS / COFINS</h4>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div>
                                            <Label>CST PIS Padrão</Label>
                                            <Select
                                                value={fiscalDefaults.cst_pis_padrao}
                                                onValueChange={(v) => setFiscalDefaults(prev => ({ ...prev, cst_pis_padrao: v }))}
                                            >
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {isSimplesNacional ? (
                                                        <>
                                                            <SelectItem value="49">49 - Outras saídas (SN)</SelectItem>
                                                            <SelectItem value="99">99 - Outras operações</SelectItem>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <SelectItem value="01">01 - Tributável (alíquota normal)</SelectItem>
                                                            <SelectItem value="04">04 - Monofásica (alíquota zero)</SelectItem>
                                                            <SelectItem value="06">06 - Alíquota zero</SelectItem>
                                                            <SelectItem value="07">07 - Isenta</SelectItem>
                                                            <SelectItem value="08">08 - Sem incidência</SelectItem>
                                                            <SelectItem value="09">09 - Com suspensão</SelectItem>
                                                            <SelectItem value="49">49 - Outras saídas</SelectItem>
                                                            <SelectItem value="99">99 - Outras operações</SelectItem>
                                                        </>
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label>CST COFINS Padrão</Label>
                                            <Select
                                                value={fiscalDefaults.cst_cofins_padrao}
                                                onValueChange={(v) => setFiscalDefaults(prev => ({ ...prev, cst_cofins_padrao: v }))}
                                            >
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {isSimplesNacional ? (
                                                        <>
                                                            <SelectItem value="49">49 - Outras saídas (SN)</SelectItem>
                                                            <SelectItem value="99">99 - Outras operações</SelectItem>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <SelectItem value="01">01 - Tributável (alíquota normal)</SelectItem>
                                                            <SelectItem value="04">04 - Monofásica (alíquota zero)</SelectItem>
                                                            <SelectItem value="06">06 - Alíquota zero</SelectItem>
                                                            <SelectItem value="07">07 - Isenta</SelectItem>
                                                            <SelectItem value="08">08 - Sem incidência</SelectItem>
                                                            <SelectItem value="09">09 - Com suspensão</SelectItem>
                                                            <SelectItem value="49">49 - Outras saídas</SelectItem>
                                                            <SelectItem value="99">99 - Outras operações</SelectItem>
                                                        </>
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    {!isSimplesNacional && (
                                        <div className="grid md:grid-cols-2 gap-4 mt-4">
                                            <div>
                                                <Label>Alíquota PIS (%)</Label>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    value={fiscalDefaults.aliquota_pis_padrao}
                                                    onChange={(e) => setFiscalDefaults(prev => ({ ...prev, aliquota_pis_padrao: e.target.value }))}
                                                    placeholder="0.65"
                                                />
                                            </div>
                                            <div>
                                                <Label>Alíquota COFINS (%)</Label>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    value={fiscalDefaults.aliquota_cofins_padrao}
                                                    onChange={(e) => setFiscalDefaults(prev => ({ ...prev, aliquota_cofins_padrao: e.target.value }))}
                                                    placeholder="3.00"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Tributos Aproximados + Frete */}
                                <div className="border-t pt-4">
                                    <h4 className="font-medium text-gray-700 mb-3">Outros Padrões</h4>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div>
                                            <Label>Percentual Tributos Aprox. (%)</Label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={fiscalDefaults.percentual_tributos_padrao}
                                                onChange={(e) => setFiscalDefaults(prev => ({ ...prev, percentual_tributos_padrao: e.target.value }))}
                                                placeholder="17.00"
                                            />
                                            <p className="text-xs text-gray-500 mt-1">Lei da Transparência (12.741/2012) - valor informado ao consumidor</p>
                                        </div>
                                        <div>
                                            <Label>Modalidade de Frete Padrão</Label>
                                            <Select
                                                value={fiscalDefaults.mod_frete_padrao}
                                                onValueChange={(v) => setFiscalDefaults(prev => ({ ...prev, mod_frete_padrao: v }))}
                                            >
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="0">0 - CIF (emitente)</SelectItem>
                                                    <SelectItem value="1">1 - FOB (destinatário)</SelectItem>
                                                    <SelectItem value="2">2 - Terceiros</SelectItem>
                                                    <SelectItem value="3">3 - Próprio por conta do remetente</SelectItem>
                                                    <SelectItem value="4">4 - Próprio por conta do destinatário</SelectItem>
                                                    <SelectItem value="9">9 - Sem frete</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>

                                {/* Botão Salvar */}
                                <div className="flex items-center gap-3 pt-2">
                                    <Button onClick={handleSalvarFiscalDefaults} disabled={savingFiscal} className="bg-amber-600 hover:bg-amber-700">
                                        {savingFiscal ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                        Salvar Padrões Fiscais
                                    </Button>
                                    {fiscalLoaded && (
                                        <Badge className="bg-green-100 text-green-800 border-green-200">Carregado do banco</Badge>
                                    )}
                                </div>
                            </>
                        );
                    })()}
                </CardContent>
            </Card>

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
                                                onClick={async () => {
                                                    setEmpresaPadrao(empresa.cnpj);
                                                    localStorage.setItem("nfe_empresa_padrao", empresa.cnpj);
                                                    // Salva dados fiscais desta empresa no banco
                                                    const dadosEmpresa = dadosFiscais[empresa.cnpj];
                                                    if (dadosEmpresa) {
                                                        const err = await salvarEmitenteNoBanco(empresa, dadosEmpresa);
                                                        if (err) {
                                                            toast.warning('Empresa padrão definida, mas erro ao salvar no banco.');
                                                        }
                                                    }
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
                        <Button onClick={salvarDadosEmpresa} disabled={savingDb} className="bg-green-700 hover:bg-green-800">
                            {savingDb ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                            Salvar Dados Fiscais
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={certDialogOpen} onOpenChange={setCertDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Cadastro de Certificado A1 (ACBR API)</DialogTitle>
                        <DialogDescription>
                            Revise os dados da empresa, anexe o arquivo .pfx/.p12 e informe a senha do certificado.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <Alert className="bg-amber-50 border-amber-200">
                            <AlertCircle className="h-4 w-4 text-amber-600" />
                            <AlertDescription className="text-amber-800">
                                Apenas certificados A1 (.pfx ou .p12) são suportados.
                            </AlertDescription>
                        </Alert>

                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <Label>CNPJ *</Label>
                                <Input value={certForm.cnpj} onChange={(e) => setCertForm(prev => ({ ...prev, cnpj: e.target.value }))} placeholder="Somente números" />
                            </div>
                            <div>
                                <Label>Razão Social *</Label>
                                <Input value={certForm.nome_razao_social} onChange={(e) => setCertForm(prev => ({ ...prev, nome_razao_social: e.target.value }))} />
                            </div>
                        </div>

                        <div>
                            <Label>Email *</Label>
                            <Input type="email" value={certForm.email} onChange={(e) => setCertForm(prev => ({ ...prev, email: e.target.value }))} />
                        </div>

                        <div className="grid md:grid-cols-3 gap-4">
                            <div><Label>CEP *</Label><Input value={certForm.cep} onChange={(e) => setCertForm(prev => ({ ...prev, cep: e.target.value }))} /></div>
                            <div className="md:col-span-2"><Label>Logradouro *</Label><Input value={certForm.logradouro} onChange={(e) => setCertForm(prev => ({ ...prev, logradouro: e.target.value }))} /></div>
                        </div>

                        <div className="grid md:grid-cols-3 gap-4">
                            <div><Label>Número *</Label><Input value={certForm.numero} onChange={(e) => setCertForm(prev => ({ ...prev, numero: e.target.value }))} /></div>
                            <div><Label>Complemento</Label><Input value={certForm.complemento} onChange={(e) => setCertForm(prev => ({ ...prev, complemento: e.target.value }))} /></div>
                            <div><Label>Bairro *</Label><Input value={certForm.bairro} onChange={(e) => setCertForm(prev => ({ ...prev, bairro: e.target.value }))} /></div>
                        </div>

                        <div className="grid md:grid-cols-3 gap-4">
                            <div><Label>Cidade *</Label><Input value={certForm.cidade} onChange={(e) => setCertForm(prev => ({ ...prev, cidade: e.target.value }))} /></div>
                            <div>
                                <Label>UF *</Label>
                                <Select value={certForm.uf} onValueChange={(v) => setCertForm(prev => ({ ...prev, uf: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"].map(uf => (
                                            <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div><Label>Código Município IBGE *</Label><Input value={certForm.codigo_municipio} onChange={(e) => setCertForm(prev => ({ ...prev, codigo_municipio: e.target.value }))} /></div>
                        </div>

                        <div>
                            <Label>Certificado A1 (.pfx/.p12) *</Label>
                            <Input type="file" accept=".pfx,.p12" onChange={(e) => setCertFile(e.target.files?.[0] || null)} />
                        </div>

                        <div>
                            <Label>Senha do Certificado *</Label>
                            <Input type="password" value={certPassword} onChange={(e) => setCertPassword(e.target.value)} />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setCertDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleRegistrarCertificado} disabled={savingCert} className="bg-indigo-700 hover:bg-indigo-800">
                            {savingCert ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                            Registrar Certificado
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
