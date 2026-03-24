import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
    Loader2, AlertTriangle, FileCheck, Download,
    ShieldCheck, ShieldAlert, CheckCircle2, XCircle,
    RefreshCw, FileDown, ArrowRight, Settings, Package, User
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { validarNFe } from '@/services/NfeValidator';
import { NfeGenerator } from '@/services/NfeGenerator';

// Roles that can emit NF-e directly without a token
const ROLES_EMISSAO_DIRETA = ['Administrador', 'Gerente', 'Gerente Geral'];

// Empresas base (same as before for Sebrae XML export)
const EMPRESAS_BASE = [
    { cnpj: "49129137000130", nome: "Atacadao Outlet", cnpjFormatado: "49.129.137/0001-30" },
    { cnpj: "04842257000141", nome: "Moveis Pedro II", cnpjFormatado: "04.842.257/0001-41" },
    { cnpj: "42316614000127", nome: "Massi Home Design", cnpjFormatado: "42.316.614/0001-27" },
    { cnpj: "53795479000166", nome: "Alta Performance Decoracoes", cnpjFormatado: "53.795.479/0001-66" },
];

export default function EmitirNFeModal({ isOpen, onClose, venda, cliente }) {
    const { user, can } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [ambiente, setAmbiente] = useState('homologacao');
    const [tokenGerencial, setTokenGerencial] = useState('');
    const [nfeStatus, setNfeStatus] = useState(null); // { status, ref, message }
    const [validationErrors, setValidationErrors] = useState(null);
    const [showValidationDetails, setShowValidationDetails] = useState(false);
    const [consultando, setConsultando] = useState(false);

    // Reset state when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            setTokenGerencial('');
            setNfeStatus(null);
            setValidationErrors(null);
            setShowValidationDetails(false);
            setItensAtualizados(venda?.itens || []);

            // If sale already has NF-e, load its status
            if (venda?.nfe_ref && venda?.nfe_status) {
                setNfeStatus({
                    status: venda.nfe_status,
                    ref: venda.nfe_ref,
                    message: venda.nfe_mensagem || ''
                });
            }
        }
    }, [isOpen, venda]);

    const [itensAtualizados, setItensAtualizados] = useState([]);
    const [clienteAtualizado, setClienteAtualizado] = useState(null);

    // Fetch fresh product data when modal opens
    useEffect(() => {
        const fetchFreshProductData = async () => {
            if (!isOpen || !venda?.itens?.length) return;

            try {
                const produtoIds = venda.itens.map(i => i.produto_id).filter(Boolean);
                if (produtoIds.length === 0) return;

                const { data: produtos, error } = await supabase
                    .from('produtos')
                    .select('id, nome, ncm, cfop, cest, origem_mercadoria, preco_venda, unidade, estoque_minimo, estoque_ideal')
                    .in('id', produtoIds);

                if (error) throw error;

                if (produtos) {
                    const mappedItens = venda.itens.map(item => {
                        const prod = produtos.find(p => p.id === item.produto_id);
                        if (prod) {
                            // Prioritize product catalog data over stale sale snapshot
                            return {
                                ...item,
                                nome: prod.nome || item.nome, // Update description if changed
                                produto_nome: prod.nome || item.produto_nome,
                                ncm: prod.ncm || item.ncm,
                                cfop: prod.cfop || item.cfop,
                                cest: prod.cest || item.cest,
                                origem_mercadoria: prod.origem_mercadoria ?? item.origem_mercadoria,
                                preco: prod.preco_venda || item.preco, // Update price
                                preco_venda: prod.preco_venda || item.preco_venda,
                                valor_unitario: prod.preco_venda || item.valor_unitario,
                                unidade: prod.unidade || item.unidade || 'UN',
                                // Keep quantity as is from the sale
                            };
                        }
                        return item;
                    });
                    setItensAtualizados(mappedItens);
                }
            } catch (err) {
                toast.error("Erro ao atualizar dados dos produtos para a NF-e. Alguns campos podem estar desatualizados.");
            }
        };

        fetchFreshProductData();
    }, [isOpen, venda]);

    // Fetch fresh client data when modal opens
    useEffect(() => {
        const fetchFreshClientData = async () => {
            if (!isOpen || !venda?.cliente_id) return;

            try {
                const { data: freshCliente, error } = await supabase
                    .from('clientes')
                    .select('*')
                    .eq('id', venda.cliente_id)
                    .single();

                if (error) throw error;
                if (freshCliente) {
                    setClienteAtualizado(freshCliente);
                }
            } catch (err) {
                toast.error("Erro ao carregar dados atualizados do cliente.");
            }
        };

        fetchFreshClientData();
    }, [isOpen, venda?.cliente_id]);

    // Update clienteAtualizado when prop changes as a fallback
    useEffect(() => {
        if (cliente) setClienteAtualizado(cliente);
    }, [cliente]);

    // Auto-trigger validation when data changes
    useEffect(() => {
        if (isOpen && (clienteAtualizado || cliente) && itensAtualizados.length > 0) {
            runValidation();
        }
    }, [isOpen, clienteAtualizado, cliente, itensAtualizados]);

    if (!venda || !cliente) return null;

    const cargo = user?.cargo || '';
    const podeEmitirDireto = ROLES_EMISSAO_DIRETA.includes(cargo) || cargo === 'Administrador';
    const precisaToken = !podeEmitirDireto;
    const jaEmitida = venda.nfe_emitida && venda.nfe_status === 'autorizado';

    // ─── Pre-flight Validation ───────────────────────────────────────────────
    const runValidation = () => {
        const emitente = getDadosEmitente();
        const result = validarNFe({
            emitente,
            cliente: clienteAtualizado || cliente,
            itens: itensAtualizados
        });
        setValidationErrors(result.valid ? null : result);
        return result.valid;
    };

    const getDadosEmitente = () => {
        const cnpjPadrao = localStorage.getItem("nfe_empresa_padrao");
        const dadosFiscaisRaw = localStorage.getItem("nfe_empresas_fiscais");
        const serie = localStorage.getItem("nfe_serie") || "1";
        const dadosFiscais = dadosFiscaisRaw ? JSON.parse(dadosFiscaisRaw) : {};

        const empresaBase = EMPRESAS_BASE.find(e => e.cnpj === cnpjPadrao) || EMPRESAS_BASE[0];
        const dadosComplementares = dadosFiscais[empresaBase.cnpj] || {};

        return {
            nome: empresaBase.nome,
            razao_social: empresaBase.nome,
            cnpj: empresaBase.cnpj,
            inscricao_estadual: dadosComplementares.ie || "",
            ie: dadosComplementares.ie || "",
            crt: dadosComplementares.regimeTributario || 1,
            regime_tributario: dadosComplementares.regimeTributario || 1,
            regimeTributario: dadosComplementares.regimeTributario || 1,
            logradouro: dadosComplementares.logradouro,
            numero: dadosComplementares.numero,
            bairro: dadosComplementares.bairro,
            cidade: dadosComplementares.municipio,
            municipio: dadosComplementares.municipio,
            uf: dadosComplementares.uf,
            cep: dadosComplementares.cep,
            serie: serie,
            endereco_fiscal: {
                logradouro: dadosComplementares.logradouro,
                numero: dadosComplementares.numero,
                bairro: dadosComplementares.bairro,
                municipio_codigo: dadosComplementares.codigoMunicipio || '3550308',
                municipio_nome: dadosComplementares.municipio,
                uf: dadosComplementares.uf,
                cep: dadosComplementares.cep
            },
            codigoMunicipio: dadosComplementares.codigoMunicipio
        };
    };

    // ─── Sebrae XML Download ─────────────────────────────────────────────────
    const handleBaixarXmlSebrae = () => {
        try {
            setLoading(true);
            if (!runValidation()) {
                setShowValidationDetails(true);
                setLoading(false);
                toast.error('Corrija os erros de validação antes de gerar o XML.');
                return;
            }

            const emitente = getDadosEmitente();
            const xml = NfeGenerator.generateXML(
                { ...venda, itens: itensAtualizados },
                emitente,
                cliente
            );

            const blob = new Blob([xml], { type: "application/xml" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `NFe_${venda.numero_pedido}_${emitente.razao_social.replace(/\s+/g, '_')}.xml`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast.success("XML gerado! Importe no emissor do Sebrae.");
            onClose();
        } catch (error) {
            console.error(error);
            toast.error("Erro ao gerar XML: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    // ─── API Emission (Nuvem Fiscal) ────────────────────────────────────────────
    const handleEmitirAPI = async () => {
        try {
            setLoading(true);
            setValidationErrors(null);

            // Pre-flight validation
            if (!runValidation()) {
                setShowValidationDetails(true);
                setLoading(false);
                return;
            }

            // Check token requirement
            if (precisaToken && !tokenGerencial.trim()) {
                toast.error('Você precisa de um token gerencial para emitir NF-e. Solicite ao seu gerente.');
                setLoading(false);
                return;
            }

            // Fetch issuer data using the unified helper
            const emitenteDados = getDadosEmitente();

            // Critical check: If we don't even have a CNPJ, we can't emit
            if (!emitenteDados.cnpj || !emitenteDados.ie) {
                toast.error('Dados da empresa incompletos. Por favor, configure a empresa em Configurações > NF-e.');
                setLoading(false);
                return;
            }

            const { data, error } = await supabase.functions.invoke('emitir-nfe', {
                body: {
                    venda_id: venda.id,
                    ambiente,
                    user_id: user.id,
                    token_gerencial: precisaToken ? tokenGerencial.trim() : undefined,
                    itens_atualizados: itensAtualizados,
                    emitente_dados: emitenteDados
                }
            });

            if (error) {
                // Try to extract from context body
                let msg = error.message || 'Erro de conexão';
                if (error.context && typeof error.context.json === 'function') {
                    try {
                        const body = await error.context.json();
                        if (body?.error) msg = body.error;
                        if (body?.code === 'VALIDATION_ERROR' && body?.camposFaltantes) {
                            setValidationErrors({
                                valid: false,
                                errors: body.camposFaltantes,
                                errorsBySection: body.porSecao,
                                totalErrors: body.totalErros
                            });
                            setShowValidationDetails(true);
                            toast.error(`Validação falhou: ${body.totalErros} campo(s) faltante(s)`);
                            return;
                        }
                        if (body?.code === 'ROLE_BLOCKED') {
                            toast.error(msg);
                            return;
                        }
                        if (body?.code === 'INVALID_TOKEN' || body?.code === 'TOKEN_EXPIRED' || body?.code === 'TOKEN_EXHAUSTED') {
                            toast.error(msg);
                            setTokenGerencial('');
                            return;
                        }
                    } catch (e) { /* ignore JSON parse error */ }
                }
                throw new Error(msg);
            }

            if (!data?.success) {
                if (data?.code === 'VALIDATION_ERROR' && data?.camposFaltantes) {
                    setValidationErrors({
                        valid: false,
                        errors: data.camposFaltantes,
                        errorsBySection: data.porSecao,
                        totalErrors: data.totalErros
                    });
                    setShowValidationDetails(true);
                    toast.error(`Validação falhou: ${data.totalErros} campo(s) faltante(s)`);
                    return;
                }
                throw new Error(data?.error || 'Erro desconhecido ao emitir NFe');
            }

            setNfeStatus({
                status: data.status,
                ref: data.ref,
                message: 'NF-e enviada para processamento!'
            });
            toast.success(`NF-e enviada! Status: ${data.status}`);

        } catch (error) {
            console.error('Erro ao emitir NFe:', error);
            toast.error('Falha ao emitir NFe: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // ─── Consultar Status ────────────────────────────────────────────────────
    const handleConsultarStatus = async () => {
        const ref = nfeStatus?.ref || venda.nfe_ref;
        if (!ref) return;

        try {
            setConsultando(true);
            const { data, error } = await supabase.functions.invoke('consultar-nfe', {
                body: {
                    nfe_ref: ref,
                    ambiente,
                    organization_id: venda.organization_id
                }
            });

            if (error) throw error;
            if (!data?.success) throw new Error(data?.error || 'Erro ao consultar');

            setNfeStatus({
                status: data.status,
                ref,
                message: data.motivo_status || data.status,
                chave: data.chave,
                numero: data.numero,
                danfeUrl: data.caminho_danfe,
                xmlUrl: data.caminho_xml,
                protocolo: data.protocolo
            });
            toast.success(`Status: ${data.status}`);
        } catch (error) {
            console.error('Erro ao consultar:', error);
            toast.error('Erro ao consultar status: ' + error.message);
        } finally {
            setConsultando(false);
        }
    };

    // ─── Status Badge ────────────────────────────────────────────────────────
    const getStatusBadge = (status) => {
        const s = (status || '').toLowerCase();
        if (s === 'autorizado' || s === 'autorizada') return <Badge className="bg-green-600 text-white"><CheckCircle2 className="w-3 h-3 mr-1" /> Autorizada</Badge>;
        if (s === 'processando_autorizacao' || s === 'processando') return <Badge className="bg-yellow-500 text-white"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Processando</Badge>;
        if (s === 'cancelado' || s === 'cancelada') return <Badge className="bg-red-600 text-white"><XCircle className="w-3 h-3 mr-1" /> Cancelada</Badge>;
        if (s === 'erro_autorizacao' || s === 'rejeitada') return <Badge className="bg-red-500 text-white"><XCircle className="w-3 h-3 mr-1" /> Rejeitada</Badge>;
        return <Badge variant="outline">{status}</Badge>;
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileCheck className="w-5 h-5 text-green-600" />
                        Emitir Nota Fiscal (NF-e)
                    </DialogTitle>
                    <DialogDescription>
                        Pedido #{venda.numero_pedido} - {cliente.nome_completo || cliente.nome || cliente.razao_social}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-2">

                    {/* ─── Already Emitted Status ─────────────────────────────── */}
                    {nfeStatus && (
                        <div className="bg-gray-50 border rounded-lg p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-gray-700">Status da NF-e</span>
                                {getStatusBadge(nfeStatus.status)}
                            </div>

                            {nfeStatus.chave && (
                                <div className="text-xs">
                                    <span className="text-gray-500">Chave:</span>
                                    <span className="ml-1 font-mono text-gray-700 break-all">{nfeStatus.chave}</span>
                                </div>
                            )}
                            {nfeStatus.numero && (
                                <div className="text-xs">
                                    <span className="text-gray-500">Número:</span>
                                    <span className="ml-1 font-semibold">{nfeStatus.numero}</span>
                                </div>
                            )}
                            {nfeStatus.protocolo && (
                                <div className="text-xs">
                                    <span className="text-gray-500">Protocolo:</span>
                                    <span className="ml-1 font-mono">{nfeStatus.protocolo}</span>
                                </div>
                            )}

                            <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={handleConsultarStatus} disabled={consultando}>
                                    <RefreshCw className={`w-3 h-3 mr-1 ${consultando ? 'animate-spin' : ''}`} />
                                    Atualizar
                                </Button>
                                {nfeStatus.danfeUrl && (
                                    <Button size="sm" variant="outline" asChild>
                                        <a href={nfeStatus.danfeUrl} target="_blank" rel="noopener noreferrer">
                                            <FileDown className="w-3 h-3 mr-1" /> DANFE (PDF)
                                        </a>
                                    </Button>
                                )}
                                {nfeStatus.xmlUrl && (
                                    <Button size="sm" variant="outline" asChild>
                                        <a href={nfeStatus.xmlUrl} target="_blank" rel="noopener noreferrer">
                                            <Download className="w-3 h-3 mr-1" /> XML
                                        </a>
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ─── Role Gate ──────────────────────────────────────────── */}
                    {precisaToken && !jaEmitida && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                            <div className="flex items-start gap-3">
                                <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                <div className="text-sm">
                                    <p className="font-semibold text-amber-800">Token Gerencial Necessário</p>
                                    <p className="text-amber-700 mt-1">
                                        Vendedores precisam de autorização do gerente para emitir NF-e.
                                        Solicite um token ao seu gerente.
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Input
                                    type="text"
                                    value={tokenGerencial}
                                    onChange={(e) => setTokenGerencial(e.target.value.toUpperCase())}
                                    placeholder="Código do token (ex: A3B2C1)"
                                    maxLength={10}
                                    className="font-mono tracking-wider uppercase text-center"
                                />
                            </div>
                        </div>
                    )}

                    {podeEmitirDireto && !jaEmitida && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3 text-sm text-green-800">
                            <ShieldCheck className="w-5 h-5 text-green-600 shrink-0" />
                            <div>
                                <p className="font-semibold">Emissão autorizada</p>
                                <p className="text-green-700 text-xs">Cargo: {cargo}</p>
                            </div>
                        </div>
                    )}

                    {/* ─── Validation Errors ──────────────────────────────────── */}
                    {validationErrors && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                                <span className="text-sm font-semibold text-red-800">
                                    {validationErrors.totalErrors} campo(s) precisam ser preenchidos
                                </span>
                            </div>

                            {validationErrors.errorsBySection && Object.entries(validationErrors.errorsBySection).map(([secao, erros]) => (
                                <div key={secao} className="bg-white rounded-lg border border-red-200 overflow-hidden">
                                    {/* Section header */}
                                    <div className="flex items-center justify-between px-3 py-2 bg-red-100">
                                        <div className="flex items-center gap-2">
                                            {secao === 'Emitente' ? (
                                                <Settings className="w-3.5 h-3.5 text-red-700" />
                                            ) : secao === 'Cliente' ? (
                                                <User className="w-3.5 h-3.5 text-red-700" />
                                            ) : (
                                                <Package className="w-3.5 h-3.5 text-red-700" />
                                            )}
                                            <span className="text-xs font-bold text-red-800 uppercase tracking-wide">{secao}</span>
                                        </div>
                                        {secao === 'Emitente' && (
                                            <button
                                                onClick={() => {
                                                    localStorage.setItem('nfe_highlight_emitente', '1');
                                                    onClose();
                                                    navigate('/admin/Configuracoes?tab=nfe');
                                                }}
                                                className="flex items-center gap-1 text-xs font-semibold text-red-700 hover:text-red-900 underline"
                                            >
                                                Corrigir nas Configurações <ArrowRight className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                    {/* Error list */}
                                    <ul className="divide-y divide-red-100">
                                        {erros.map((erro, i) => {
                                            // Extract product_id from item errors if available
                                            // Tenta extrair o índice do item (suporta itens[0] ou itens.0)
                                            const itemMatch = erro.campo?.match(/itens(?:\[|\.)(\d+)(?:\]|\.)?/);
                                            const itemIndex = itemMatch ? parseInt(itemMatch[1]) : null;
                                            const itemObj = (itemIndex !== null && venda?.itens) ? venda.itens[itemIndex] : null;
                                            const produtoId = itemObj?.produto_id; // Sempre usar produto_id para o catálogo

                                            return (
                                                <li key={i} className="flex items-center justify-between px-3 py-2 gap-2">
                                                    <div className="flex items-start gap-1.5">
                                                        <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                                                        <span className="text-xs text-red-700">{erro.mensagem}</span>
                                                    </div>
                                                    {produtoId && (
                                                        <button
                                                            onClick={() => {
                                                                // Extrair nome do campo para foco (ex: "ncm", "cest")
                                                                const fieldMatch = erro.campo?.split('.').pop();
                                                                const focusParam = fieldMatch ? `&focus=${fieldMatch}` : '';

                                                                // URL de retorno para reabrir este modal
                                                                const returnUrl = encodeURIComponent(`/admin/Vendas?emitirNfe=${venda.id}`);

                                                                onClose();
                                                                navigate(`/admin/Produtos?highlight=${produtoId}${focusParam}&returnUrl=${returnUrl}`);
                                                            }}
                                                            className="flex items-center gap-1 text-xs font-semibold text-red-700 hover:text-red-900 underline whitespace-nowrap shrink-0"
                                                        >
                                                            Editar <ArrowRight className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                    {secao === 'Cliente' && venda?.cliente_id && (
                                                        <button
                                                            onClick={() => {
                                                                const returnUrl = encodeURIComponent(`/admin/Vendas?emitirNfe=${venda.id}`);
                                                                onClose();
                                                                navigate(`/admin/Clientes?highlight=${venda.cliente_id}&returnUrl=${returnUrl}`);
                                                            }}
                                                            className="flex items-center gap-1 text-xs font-semibold text-red-700 hover:text-red-900 underline whitespace-nowrap shrink-0"
                                                        >
                                                            Editar <ArrowRight className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ─── Emission Options ───────────────────────────────────── */}
                    {!jaEmitida && !nfeStatus && (
                        <>
                            <div className="space-y-2">
                                <Label>Opções de Emissão</Label>
                                <div className="grid grid-cols-2 gap-3">
                                    <Button
                                        variant="outline"
                                        className="h-auto py-4 flex flex-col gap-2 items-center hover:bg-blue-50 border-dashed border-2"
                                        onClick={handleBaixarXmlSebrae}
                                        disabled={loading}
                                    >
                                        <Download className="w-6 h-6 text-blue-600" />
                                        <span className="font-semibold text-blue-700">Baixar XML</span>
                                        <span className="text-xs text-center text-gray-500 font-normal">Para Emissor Sebrae</span>
                                    </Button>

                                    <Button
                                        variant="outline"
                                        className="h-auto py-4 flex flex-col gap-2 items-center hover:bg-green-50 border-dashed border-2"
                                        onClick={handleEmitirAPI}
                                        disabled={loading || (precisaToken && !tokenGerencial.trim())}
                                    >
                                        {loading ? (
                                            <Loader2 className="w-6 h-6 text-green-600 animate-spin" />
                                        ) : (
                                            <FileCheck className="w-6 h-6 text-green-600" />
                                        )}
                                        <span className="font-semibold text-green-700">Via API (Auto)</span>
                                        <span className="text-xs text-center text-gray-500 font-normal">Nuvem Fiscal</span>
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-2 pt-2 border-t mt-2">
                                <Label className="text-xs text-gray-500">Ambiente (Apenas API)</Label>
                                <Select value={ambiente} onValueChange={setAmbiente}>
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="homologacao">Homologação (Teste)</SelectItem>
                                        <SelectItem value="producao">Produção (Validade Jurídica)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </>
                    )}

                    {/* ─── Re-emit or Consult for already emitted ─────────────── */}
                    {jaEmitida && (
                        <div className="text-center text-sm text-gray-500 py-4">
                            Esta venda já possui uma NF-e autorizada.
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={onClose} disabled={loading}>
                        Fechar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
