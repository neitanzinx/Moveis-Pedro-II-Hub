import React, { useState, useRef } from "react";
import FidelidadeRegras from "@/components/marketing/FidelidadeRegras";
import { useConfirm } from "@/hooks/useConfirm";
import { base44, supabase } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { EMPRESA } from "@/config/empresa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
    Tag, Plus, Pencil, Trash2, Loader2, Percent, DollarSign,
    Calendar, Hash, AlertCircle, Copy, Check, MessageCircle, Send,
    Cake, Gift, ShoppingCart, RefreshCw, Users, Printer, Search,
    FileText, Package, Filter, Star, Trophy, Target, Award, Save, Crown
} from "lucide-react";

// Print styles for labels

const printStyles = `
@media print {
    /* Hide everything initially */
    body > * {
        display: none !important;
    }

    /* Show only our printable area */
    #printable-root {
        display: block !important;
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
    }

    /* Reset page margins for full control */
    @page {
        size: auto;
        margin: 0mm;
    }

    /* Ensure label pages break correctly */
    .label-page-print {
        page-break-after: always !important;
        page-break-inside: avoid !important;
        width: 100% !important;
        height: 100vh !important; /* Force full page height */
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        background: white !important;
        margin: 0 !important;
        padding: 0 !important; /* Padding handled by inner content */
    }

    .label-page-print:last-child {
        page-break-after: auto !important;
    }
}
`;

// Company Logo URL
const LOGO_URL = EMPRESA.logo_url;

export default function Marketing() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCupom, setEditingCupom] = useState(null);
    const [error, setError] = useState("");
    const [copiedCode, setCopiedCode] = useState(null);
    const [enviandoMsg, setEnviandoMsg] = useState({});
    const queryClient = useQueryClient();
    const confirm = useConfirm();

    // Label states
    const [selectedProducts, setSelectedProducts] = useState([]);
    const [labelLayout, setLabelLayout] = useState("a4-full");
    const [showPrintPreview, setShowPrintPreview] = useState(false);
    const [showDePor, setShowDePor] = useState(false);
    const [precoDeValue, setPrecoDeValue] = useState({});

    // Price list states
    const [priceSearchTerm, setPriceSearchTerm] = useState("");
    const [priceCategory, setPriceCategory] = useState("todas");
    const [editingPrice, setEditingPrice] = useState(null);
    const [newPrice, setNewPrice] = useState("");

    const [formData, setFormData] = useState({
        codigo: "",
        tipo: "porcentagem",
        valor: "",
        validade: "",
        quantidade_disponivel: "",
        ativo: true
    });

    // Fidelidade config state
    const [fidelidadeConfig, setFidelidadeConfig] = useState({
        signup_bonus: 2,
        steps_per_purchase: 2,
        purchase_value_threshold: 50,
        reward_threshold: 20,
        reward_description: "Desconto especial na próxima compra!",
        is_active: true
    });
    const [savingFidelidade, setSavingFidelidade] = useState(false);

    // Queries
    const { data: cupons = [], isLoading: loadingCupons } = useQuery({
        queryKey: ['cupons'],
        queryFn: () => base44.entities.Cupom.list('-created_at'),
    });

    const { data: orcamentos = [], isLoading: loadingOrcamentos } = useQuery({
        queryKey: ['orcamentos'],
        queryFn: () => base44.entities.Orcamento.list('-data_orcamento'),
    });

    const { data: clientes = [], isLoading: loadingClientes } = useQuery({
        queryKey: ['clientes'],
        queryFn: () => base44.entities.Cliente.list(),
    });

    const { data: produtos = [], isLoading: loadingProdutos } = useQuery({
        queryKey: ['produtos'],
        queryFn: () => base44.entities.Produto.list('nome'),
    });

    // Fidelidade config query
    const { data: fidelidadeData, isLoading: loadingFidelidade } = useQuery({
        queryKey: ['fidelidade_config'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('fidelidade_config')
                .select('*')
                .eq('is_active', true)
                .single();
            if (error && error.code !== 'PGRST116') throw error;
            return data;
        },
    });

    // Update fidelidade state when data loads
    React.useEffect(() => {
        if (fidelidadeData) {
            setFidelidadeConfig(fidelidadeData);
        }
    }, [fidelidadeData]);

    // Save fidelidade config
    const saveFidelidadeConfig = async () => {
        setSavingFidelidade(true);
        try {
            const { error } = await supabase
                .from('fidelidade_config')
                .upsert({
                    id: fidelidadeConfig.id || 1,
                    signup_bonus: parseInt(fidelidadeConfig.signup_bonus) || 2,
                    steps_per_purchase: parseInt(fidelidadeConfig.steps_per_purchase) || 2,
                    purchase_value_threshold: parseFloat(fidelidadeConfig.purchase_value_threshold) || 50,
                    reward_threshold: parseInt(fidelidadeConfig.reward_threshold) || 20,
                    reward_description: fidelidadeConfig.reward_description || "Desconto especial!",
                    is_active: true,
                    updated_at: new Date().toISOString()
                });
            if (error) throw error;
            toast.success("Configurações de fidelidade salvas!");
            queryClient.invalidateQueries({ queryKey: ['fidelidade_config'] });
        } catch (error) {
            console.error("Erro ao salvar:", error);
            toast.error("Erro ao salvar configurações");
        } finally {
            setSavingFidelidade(false);
        }
    };

    // Price update mutation
    const updatePriceMutation = useMutation({
        mutationFn: ({ id, preco_venda }) => base44.entities.Produto.update(id, { preco_venda }),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['produtos'] });
            const produto = produtos.find(p => p.id === variables.id);
            toast.success(
                <div className="flex flex-col gap-2">
                    <span>Preço atualizado com sucesso!</span>
                    <Button
                        size="sm"
                        variant="outline"
                        className="flex items-center gap-1"
                        onClick={() => {
                            setSelectedProducts([produto]);
                            setLabelLayout("individual");
                            setShowPrintPreview(true);
                        }}
                    >
                        <Printer className="w-3 h-3" />
                        Imprimir nova etiqueta
                    </Button>
                </div>,
                { duration: 8000 }
            );
            setEditingPrice(null);
            setNewPrice("");
        },
        onError: (err) => toast.error("Erro ao atualizar preço: " + err.message),
    });

    // Filtrar orçamentos pendentes > 3 dias
    const tresDiasAtras = new Date();
    tresDiasAtras.setDate(tresDiasAtras.getDate() - 3);

    const orcamentosPendentes = orcamentos.filter(orc => {
        if (orc.status !== "Pendente") return false;
        const dataOrc = new Date(orc.data_orcamento);
        return dataOrc < tresDiasAtras;
    });

    // Filtrar aniversariantes do mês
    const mesAtual = new Date().getMonth() + 1;
    const aniversariantes = clientes.filter(cliente => {
        if (!cliente.data_nascimento) return false;
        const dataNasc = new Date(cliente.data_nascimento);
        return (dataNasc.getMonth() + 1) === mesAtual;
    });

    // Get unique categories
    const categorias = [...new Set(produtos.map(p => p.categoria).filter(Boolean))].sort();

    // Filter products for price list
    const filteredProdutos = produtos.filter(p => {
        const matchSearch = !priceSearchTerm ||
            p.nome?.toLowerCase().includes(priceSearchTerm.toLowerCase()) ||
            p.categoria?.toLowerCase().includes(priceSearchTerm.toLowerCase());
        const matchCategoria = priceCategory === "todas" || p.categoria === priceCategory;
        return matchSearch && matchCategoria;
    });

    // Mutations para cupons
    const createMutation = useMutation({
        mutationFn: (data) => base44.entities.Cupom.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cupons'] });
            handleCloseModal();
        },
        onError: (err) => setError(err.message || "Erro ao criar cupom"),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.Cupom.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cupons'] });
            handleCloseModal();
        },
        onError: (err) => setError(err.message || "Erro ao atualizar cupom"),
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.Cupom.delete(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cupons'] }),
    });

    // Funções de envio de mensagem marketing
    const enviarMensagemMarketing = async (tipo, dados) => {
        const key = `${tipo}-${dados.telefone}`;
        setEnviandoMsg(prev => ({ ...prev, [key]: true }));

        try {
            const response = await fetch(`${import.meta.env.VITE_ZAP_API_URL}/enviar-mensagem-marketing`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telefone: dados.telefone,
                    nome: dados.nome,
                    tipo: tipo,
                    dados_extras: dados.extras || {}
                })
            });

            if (response.ok) {
                toast.success(`Mensagem enviada para ${dados.nome}!`);
            } else {
                throw new Error("Falha no envio");
            }
        } catch (error) {
            console.error("Erro ao enviar:", error);
            toast.error(`Erro ao enviar mensagem. Verifique se o robô está online.`);
        } finally {
            setEnviandoMsg(prev => ({ ...prev, [key]: false }));
        }
    };

    const handleRecuperarVenda = (orcamento) => {
        enviarMensagemMarketing('recuperacao', {
            telefone: orcamento.cliente_telefone,
            nome: orcamento.cliente_nome,
            extras: {
                valor: orcamento.valor_total,
                numero_orcamento: orcamento.numero_orcamento
            }
        });
    };

    const handleEnviarParabens = async (cliente) => {
        const key = `aniversario - ${cliente.telefone} `;
        setEnviandoMsg(prev => ({ ...prev, [key]: true }));

        try {
            const primeiroNome = cliente.nome_completo.split(' ')[0].toUpperCase();
            const codigoCupom = `${primeiroNome} 10`;

            const cuponsExistentes = await base44.entities.Cupom.list();
            const cupomExiste = cuponsExistentes.find(c => c.codigo === codigoCupom);

            if (!cupomExiste) {
                const validade = new Date();
                validade.setDate(validade.getDate() + 30);

                await base44.entities.Cupom.create({
                    codigo: codigoCupom,
                    tipo: 'porcentagem',
                    valor: 10,
                    validade: validade.toISOString().split('T')[0],
                    quantidade_usada: 0,
                    ativo: true
                });
            }

            const lojas = await base44.entities.Loja.list();
            const lojasAtivas = lojas.filter(l => l.ativa);

            const response = await fetch(`${import.meta.env.VITE_ZAP_API_URL}/enviar-mensagem-aniversario`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telefone: cliente.telefone,
                    nome: cliente.nome_completo,
                    cupom_codigo: codigoCupom,
                    lojas: lojasAtivas
                })
            });

            if (response.ok) {
                queryClient.invalidateQueries({ queryKey: ['cupons'] });
                toast.success(`Parabéns enviado para ${cliente.nome_completo} !Cupom: ${codigoCupom} `);
            } else {
                throw new Error("Falha no envio");
            }
        } catch (error) {
            console.error("Erro ao enviar:", error);
            toast.error(`Erro ao enviar mensagem.Verifique se o robô está online.`);
        } finally {
            setEnviandoMsg(prev => ({ ...prev, [key]: false }));
        }
    };

    // Modal handlers
    const handleOpenModal = (cupom = null) => {
        setEditingCupom(cupom);
        if (cupom) {
            setFormData({
                codigo: cupom.codigo,
                tipo: cupom.tipo,
                valor: cupom.valor,
                validade: cupom.validade || "",
                quantidade_disponivel: cupom.quantidade_disponivel || "",
                ativo: cupom.ativo
            });
        } else {
            setFormData({
                codigo: "",
                tipo: "porcentagem",
                valor: "",
                validade: "",
                quantidade_disponivel: "",
                ativo: true
            });
        }
        setError("");
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingCupom(null);
        setFormData({ codigo: "", tipo: "porcentagem", valor: "", validade: "", quantidade_disponivel: "", ativo: true });
        setError("");
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.codigo.trim()) {
            setError("O código do cupom é obrigatório");
            return;
        }
        if (!formData.valor || parseFloat(formData.valor) <= 0) {
            setError("O valor deve ser maior que zero");
            return;
        }

        const dataToSave = {
            codigo: formData.codigo.toUpperCase().replace(/\s/g, ''),
            tipo: formData.tipo,
            valor: parseFloat(formData.valor),
            validade: formData.validade || null,
            quantidade_disponivel: formData.quantidade_disponivel ? parseInt(formData.quantidade_disponivel) : null,
            ativo: formData.ativo
        };

        if (editingCupom) {
            updateMutation.mutate({ id: editingCupom.id, data: dataToSave });
        } else {
            createMutation.mutate({ ...dataToSave, quantidade_usada: 0 });
        }
    };

    const handleToggleAtivo = (cupom) => {
        updateMutation.mutate({ id: cupom.id, data: { ativo: !cupom.ativo } });
    };

    const handleDelete = async (id) => {
        const confirmed = await confirm({
            title: "Excluir Cupom",
            message: "Tem certeza que deseja excluir este cupom?",
            confirmText: "Excluir",
            variant: "destructive"
        });
        if (confirmed) {
            deleteMutation.mutate(id);
        }
    };

    const copyToClipboard = (codigo) => {
        navigator.clipboard.writeText(codigo);
        setCopiedCode(codigo);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    const isExpired = (validade) => {
        if (!validade) return false;
        return new Date(validade) < new Date();
    };

    const isEsgotado = (cupom) => {
        if (!cupom.quantidade_disponivel) return false;
        return (cupom.quantidade_usada || 0) >= cupom.quantidade_disponivel;
    };

    const getStatusBadge = (cupom) => {
        if (!cupom.ativo) return <Badge variant="secondary" className="bg-gray-100 text-gray-600">Inativo</Badge>;
        if (isExpired(cupom.validade)) return <Badge variant="destructive">Expirado</Badge>;
        if (isEsgotado(cupom)) return <Badge variant="outline" className="border-orange-500 text-orange-600">Esgotado</Badge>;
        return <Badge className="bg-green-100 text-green-700">Ativo</Badge>;
    };

    const formatarValor = (valor) => {
        return parseFloat(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const formatarData = (data) => {
        if (!data) return "-";
        return new Date(data).toLocaleDateString('pt-BR');
    };

    const getDiasPassados = (data) => {
        const dataOrc = new Date(data);
        const hoje = new Date();
        const diff = Math.floor((hoje - dataOrc) / (1000 * 60 * 60 * 24));
        return diff;
    };

    // Label functions
    const handleSelectProduct = (produto, checked) => {
        if (checked) {
            setSelectedProducts(prev => [...prev, produto]);
        } else {
            setSelectedProducts(prev => prev.filter(p => p.id !== produto.id));
        }
    };

    const handleSelectAll = (checked) => {
        if (checked) {
            setSelectedProducts(produtos);
        } else {
            setSelectedProducts([]);
        }
    };



    const handlePrint = () => {
        window.print();
    };

    const getLayoutConfig = () => {
        switch (labelLayout) {
            case 'a4-full': return { width: '210mm', height: '297mm', logoSize: 120, nameSize: '42px', priceSize: '96px', padding: '40px' };
            case 'a4-half': return { width: '210mm', height: '148mm', logoSize: 80, nameSize: '32px', priceSize: '72px', padding: '30px' };
            case 'a4-quarter': return { width: '148mm', height: '105mm', logoSize: 60, nameSize: '24px', priceSize: '54px', padding: '20px' };
            case 'small': return { width: '100mm', height: '70mm', logoSize: 40, nameSize: '16px', priceSize: '36px', padding: '15px' };
            default: return { width: '210mm', height: '297mm', logoSize: 120, nameSize: '42px', priceSize: '96px', padding: '40px' };
        }
    };

    // Quick print for single product
    const handleQuickPrint = (produto) => {
        setSelectedProducts([produto]);
        setLabelLayout("individual");
        setShowPrintPreview(true);
    };

    // Save price change
    const handleSavePrice = (produtoId) => {
        const priceValue = parseFloat(newPrice);
        if (isNaN(priceValue) || priceValue < 0) {
            toast.error("Preço inválido");
            return;
        }
        updatePriceMutation.mutate({ id: produtoId, preco_venda: priceValue });
    };

    if (loadingCupons || loadingOrcamentos || loadingClientes || loadingProdutos) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#07593f' }} />
            </div>
        );
    }

    const layoutConfig = getLayoutConfig();

    return (
        <div className="p-4 md:p-8">
            <style>{printStyles}</style>

            <div className="max-w-6xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl md:text-4xl font-bold mb-2" style={{ color: '#07593f' }}>
                        Marketing
                    </h1>
                    <p className="text-gray-500">
                        Recupere vendas, gerencie preços e imprima etiquetas
                    </p>
                </div>

                <Tabs defaultValue="recuperacao" className="w-full">
                    <TabsList className="grid w-full grid-cols-6 mb-6">
                        <TabsTrigger value="recuperacao" className="flex items-center gap-1 text-xs">
                            <RefreshCw className="w-4 h-4" />
                            <span className="hidden sm:inline">Recuperação</span>
                            {orcamentosPendentes.length > 0 && (
                                <Badge variant="destructive" className="ml-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]">
                                    {orcamentosPendentes.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="aniversariantes" className="flex items-center gap-1 text-xs">
                            <Cake className="w-4 h-4" />
                            <span className="hidden sm:inline">Aniversariantes</span>
                        </TabsTrigger>
                        <TabsTrigger value="cupons" className="flex items-center gap-1 text-xs">
                            <Tag className="w-4 h-4" />
                            <span className="hidden sm:inline">Cupons</span>
                        </TabsTrigger>
                        <TabsTrigger value="fidelidade" className="flex items-center gap-1 text-xs">
                            <Trophy className="w-4 h-4" />
                            <span className="hidden sm:inline">Fidelidade</span>
                        </TabsTrigger>
                        <TabsTrigger value="etiquetas" className="flex items-center gap-1 text-xs">
                            <Printer className="w-4 h-4" />
                            <span className="hidden sm:inline">Etiquetas</span>
                        </TabsTrigger>
                        <TabsTrigger value="precos" className="flex items-center gap-1 text-xs">
                            <DollarSign className="w-4 h-4" />
                            <span className="hidden sm:inline">Lista de Preços</span>
                        </TabsTrigger>
                    </TabsList>

                    {/* ABA 1: RECUPERAÇÃO DE VENDAS */}
                    <TabsContent value="recuperacao">
                        <Card className="border-0 shadow-lg">
                            <CardHeader className="border-b bg-orange-50 dark:bg-orange-900/20">
                                <CardTitle className="text-lg flex items-center gap-2 text-orange-700">
                                    <ShoppingCart className="w-5 h-5" />
                                    Orçamentos Pendentes (+ de 3 dias)
                                </CardTitle>
                                <p className="text-sm text-orange-600 mt-1">
                                    Clientes que pediram orçamento mas não fecharam. Hora de recuperar!
                                </p>
                            </CardHeader>
                            <CardContent className="p-0">
                                {orcamentosPendentes.length === 0 ? (
                                    <div className="text-center py-12">
                                        <ShoppingCart className="w-16 h-16 mx-auto mb-4 opacity-20 text-orange-500" />
                                        <p className="text-gray-500 font-medium">Nenhum orçamento pendente para recuperar</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-gray-50 dark:bg-neutral-800">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Cliente</th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Valor</th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Data</th>
                                                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Ação</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {orcamentosPendentes.map((orc) => (
                                                    <tr key={orc.id} className="hover:bg-gray-50">
                                                        <td className="px-4 py-3">
                                                            <p className="font-medium">{orc.cliente_nome}</p>
                                                            <p className="text-xs text-gray-500">{orc.cliente_telefone}</p>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className="font-bold text-green-700">{formatarValor(orc.valor_total)}</span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <p className="text-sm">{formatarData(orc.data_orcamento)}</p>
                                                            <p className="text-xs text-red-500">Há {getDiasPassados(orc.data_orcamento)} dias</p>
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <Button
                                                                size="sm"
                                                                className="bg-green-600 hover:bg-green-700"
                                                                onClick={() => handleRecuperarVenda(orc)}
                                                                disabled={enviandoMsg[`recuperacao - ${orc.cliente_telefone} `]}
                                                            >
                                                                {enviandoMsg[`recuperacao - ${orc.cliente_telefone} `] ? (
                                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                                ) : (
                                                                    <>
                                                                        <MessageCircle className="w-4 h-4 mr-1" />
                                                                        Recuperar
                                                                    </>
                                                                )}
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ABA 2: ANIVERSARIANTES */}
                    <TabsContent value="aniversariantes">
                        <Card className="border-0 shadow-lg">
                            <CardHeader className="border-b bg-purple-50 dark:bg-purple-900/20">
                                <CardTitle className="text-lg flex items-center gap-2 text-purple-700">
                                    <Cake className="w-5 h-5" />
                                    Aniversariantes de {new Date().toLocaleDateString('pt-BR', { month: 'long' })}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                {aniversariantes.length === 0 ? (
                                    <div className="text-center py-12">
                                        <Cake className="w-16 h-16 mx-auto mb-4 opacity-20 text-purple-500" />
                                        <p className="text-gray-500 font-medium">Nenhum aniversariante este mês</p>
                                    </div>
                                ) : (
                                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                                        {aniversariantes.map((cliente) => {
                                            const dataNasc = new Date(cliente.data_nascimento);
                                            const diaAniversario = dataNasc.getDate();
                                            const hoje = new Date().getDate();
                                            const isHoje = diaAniversario === hoje;

                                            return (
                                                <div
                                                    key={cliente.id}
                                                    className={`p - 4 rounded - xl border ${isHoje ? 'bg-purple-100 border-purple-300' : 'bg-white border-gray-200'} `}
                                                >
                                                    <div className="flex items-start justify-between">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <Gift className={`w - 5 h - 5 ${isHoje ? 'text-purple-600' : 'text-gray-400'} `} />
                                                                <span className="font-bold">{cliente.nome_completo}</span>
                                                            </div>
                                                            <p className="text-sm text-gray-500 mt-1">{cliente.telefone}</p>
                                                            <p className="text-xs text-purple-600 font-medium mt-2">
                                                                Dia {diaAniversario} {isHoje && "(HOJE!)"}
                                                            </p>
                                                        </div>
                                                        {isHoje && <Badge className="bg-purple-500 animate-pulse">Hoje!</Badge>}
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        className="w-full mt-3 bg-purple-600 hover:bg-purple-700"
                                                        onClick={() => handleEnviarParabens(cliente)}
                                                        disabled={enviandoMsg[`aniversario - ${cliente.telefone} `]}
                                                    >
                                                        {enviandoMsg[`aniversario - ${cliente.telefone} `] ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <>
                                                                <Send className="w-4 h-4 mr-1" />
                                                                Enviar Parabéns
                                                            </>
                                                        )}
                                                    </Button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ABA 3: CUPONS */}
                    <TabsContent value="cupons">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                            <Card className="border-0 shadow-sm">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                                            <Tag className="w-5 h-5 text-purple-600" />
                                        </div>
                                        <div>
                                            <p className="text-2xl font-bold">{cupons.length}</p>
                                            <p className="text-xs text-gray-500">Cupons Criados</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="border-0 shadow-sm">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                                            <Check className="w-5 h-5 text-green-600" />
                                        </div>
                                        <div>
                                            <p className="text-2xl font-bold">
                                                {cupons.filter(c => c.ativo && !isExpired(c.validade) && !isEsgotado(c)).length}
                                            </p>
                                            <p className="text-xs text-gray-500">Ativos</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="border-0 shadow-sm">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                            <Hash className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="text-2xl font-bold">
                                                {cupons.reduce((sum, c) => sum + (c.quantidade_usada || 0), 0)}
                                            </p>
                                            <p className="text-xs text-gray-500">Total de Usos</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="border-0 shadow-sm">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                                            <AlertCircle className="w-5 h-5 text-orange-600" />
                                        </div>
                                        <div>
                                            <p className="text-2xl font-bold">
                                                {cupons.filter(c => isExpired(c.validade) || isEsgotado(c)).length}
                                            </p>
                                            <p className="text-xs text-gray-500">Expirados</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <Card className="border-0 shadow-lg">
                            <CardHeader className="border-b flex-row items-center justify-between">
                                <CardTitle className="text-lg" style={{ color: '#07593f' }}>Cupons de Desconto</CardTitle>
                                <Button onClick={() => handleOpenModal()} style={{ backgroundColor: '#07593f' }}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Novo Cupom
                                </Button>
                            </CardHeader>
                            <CardContent className="p-0">
                                {cupons.length === 0 ? (
                                    <div className="text-center py-12">
                                        <Tag className="w-16 h-16 mx-auto mb-4 opacity-20" style={{ color: '#07593f' }} />
                                        <p className="text-gray-500">Nenhum cupom cadastrado</p>
                                    </div>
                                ) : (
                                    <div className="divide-y">
                                        {cupons.map((cupom) => (
                                            <div key={cupom.id} className="p-4 hover:bg-gray-50 transition-colors">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w - 12 h - 12 rounded - lg flex items - center justify - center ${cupom.tipo === 'porcentagem' ? 'bg-purple-100 text-purple-600' : 'bg-green-100 text-green-600'} `}>
                                                            {cupom.tipo === 'porcentagem' ? <Percent className="w-6 h-6" /> : <DollarSign className="w-6 h-6" />}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-mono font-bold text-lg" style={{ color: '#07593f' }}>{cupom.codigo}</span>
                                                                <button onClick={() => copyToClipboard(cupom.codigo)} className="p-1 hover:bg-gray-200 rounded">
                                                                    {copiedCode === cupom.codigo ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-400" />}
                                                                </button>
                                                                {getStatusBadge(cupom)}
                                                            </div>
                                                            <p className="text-sm text-gray-500">
                                                                {cupom.tipo === 'porcentagem' ? `${cupom.valor}% ` : `R$ ${cupom.valor.toFixed(2)} `} de desconto
                                                                {cupom.validade && ` • Válido até ${new Date(cupom.validade).toLocaleDateString('pt-BR')} `}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Switch checked={cupom.ativo} onCheckedChange={() => handleToggleAtivo(cupom)} />
                                                        <Button variant="ghost" size="sm" onClick={() => handleOpenModal(cupom)}>
                                                            <Pencil className="w-4 h-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="sm" onClick={() => handleDelete(cupom.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ABA 4: FIDELIDADE */}
                    <TabsContent value="fidelidade">
                        <FidelidadeRegras />
                    </TabsContent>


                    {/* ABA 5: ETIQUETAS */}
                    <TabsContent value="etiquetas">
                        <div className="grid lg:grid-cols-3 gap-6">
                            {/* Product Selection */}
                            <div className="lg:col-span-2">
                                <Card className="border-0 shadow-lg">
                                    <CardHeader className="border-b">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-lg" style={{ color: '#07593f' }}>
                                                <Package className="w-5 h-5 inline mr-2" />
                                                Selecionar Produtos
                                            </CardTitle>
                                            <div className="flex items-center gap-2">
                                                <Checkbox
                                                    checked={selectedProducts.length === produtos.length && produtos.length > 0}
                                                    onCheckedChange={handleSelectAll}
                                                />
                                                <span className="text-sm text-gray-500">Selecionar todos</span>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-0 max-h-[500px] overflow-auto">
                                        {produtos.length === 0 ? (
                                            <div className="text-center py-12">
                                                <Package className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                                <p className="text-gray-500">Nenhum produto cadastrado</p>
                                            </div>
                                        ) : (
                                            <div className="divide-y">
                                                {produtos.map((produto) => (
                                                    <div
                                                        key={produto.id}
                                                        className={`p - 3 hover: bg - gray - 50 flex items - center gap - 3 cursor - pointer ${selectedProducts.some(p => p.id === produto.id) ? 'bg-green-50' : ''} `}
                                                        onClick={() => handleSelectProduct(produto, !selectedProducts.some(p => p.id === produto.id))}
                                                    >
                                                        <Checkbox
                                                            checked={selectedProducts.some(p => p.id === produto.id)}
                                                            onCheckedChange={(checked) => handleSelectProduct(produto, checked)}
                                                        />
                                                        <div className="flex-1">
                                                            <p className="font-medium">{produto.nome}</p>
                                                            <p className="text-sm text-gray-500">{produto.categoria}</p>
                                                        </div>
                                                        <p className="font-bold" style={{ color: '#07593f' }}>
                                                            {formatarValor(produto.preco_venda)}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Layout Selection & Actions */}
                            <div className="space-y-4">
                                <Card className="border-0 shadow-lg">
                                    <CardHeader className="border-b">
                                        <CardTitle className="text-lg" style={{ color: '#07593f' }}>
                                            <FileText className="w-5 h-5 inline mr-2" />
                                            Layout de Impressão
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3 p-4">
                                        <div className="space-y-2">
                                            {[
                                                { value: 'a4-full', label: 'Folha A4 Inteira', desc: 'Etiqueta gigante (21x29,7cm)' },
                                                { value: 'a4-half', label: 'Metade da A4', desc: 'Etiqueta grande (21x14,8cm)' },
                                                { value: 'a4-quarter', label: '1/4 da A4', desc: 'Etiqueta média (14,8x10,5cm)' },
                                                { value: 'small', label: 'Pequena', desc: 'Etiqueta pequena (10x7cm)' },
                                            ].map(layout => (
                                                <div
                                                    key={layout.value}
                                                    className={`p - 3 rounded - lg border cursor - pointer transition - all ${labelLayout === layout.value ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'} `}
                                                    onClick={() => setLabelLayout(layout.value)}
                                                >
                                                    <p className="font-medium">{layout.label}</p>
                                                    <p className="text-xs text-gray-500">{layout.desc}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="border-0 shadow-lg">
                                    <CardContent className="p-4 space-y-3">
                                        <div className="text-center p-4 bg-gray-50 rounded-lg">
                                            <p className="text-3xl font-bold" style={{ color: '#07593f' }}>{selectedProducts.length}</p>
                                            <p className="text-sm text-gray-500">produtos selecionados</p>
                                        </div>

                                        {/* De-Por Toggle */}
                                        <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
                                            <div>
                                                <p className="font-medium text-amber-800">Exibir "De - Por"</p>
                                                <p className="text-xs text-amber-600">Mostra preço riscado + preço atual</p>
                                            </div>
                                            <Switch
                                                checked={showDePor}
                                                onCheckedChange={setShowDePor}
                                            />
                                        </div>

                                        {showDePor && selectedProducts.length > 0 && (
                                            <div className="space-y-2 p-3 bg-gray-50 rounded-lg">
                                                <p className="text-xs font-medium text-gray-600 mb-2">Preço "De" para cada produto:</p>
                                                {selectedProducts.map(p => (
                                                    <div key={p.id} className="flex items-center gap-2 text-sm">
                                                        <span className="flex-1 truncate">{p.nome}</span>
                                                        <span className="text-gray-500">R$</span>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            placeholder={String(p.preco_venda * 1.2 || 0)}
                                                            className="w-24 h-8 text-sm"
                                                            value={precoDeValue[p.id] || ""}
                                                            onChange={e => setPrecoDeValue(prev => ({ ...prev, [p.id]: e.target.value }))}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <Button
                                            className="w-full"
                                            style={{ backgroundColor: '#07593f' }}
                                            disabled={selectedProducts.length === 0}
                                            onClick={() => setShowPrintPreview(true)}
                                        >
                                            <Printer className="w-4 h-4 mr-2" />
                                            Visualizar Etiquetas
                                        </Button>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </TabsContent>

                    {/* ABA 5: LISTA DE PREÇOS */}
                    <TabsContent value="precos">
                        <Card className="border-0 shadow-lg">
                            <CardHeader className="border-b">
                                <div className="flex flex-col sm:flex-row gap-4 justify-between">
                                    <CardTitle className="text-lg" style={{ color: '#07593f' }}>
                                        <DollarSign className="w-5 h-5 inline mr-2" />
                                        Lista de Preços
                                    </CardTitle>
                                    <div className="flex gap-2">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <Input
                                                placeholder="Buscar produto..."
                                                className="pl-9 w-64"
                                                value={priceSearchTerm}
                                                onChange={e => setPriceSearchTerm(e.target.value)}
                                            />
                                        </div>
                                        <Select value={priceCategory} onValueChange={setPriceCategory}>
                                            <SelectTrigger className="w-40">
                                                <SelectValue placeholder="Categoria" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="todas">Todas</SelectItem>
                                                {categorias.map(cat => (
                                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Produto</TableHead>
                                            <TableHead>Categoria</TableHead>
                                            <TableHead className="text-right">Preço</TableHead>
                                            <TableHead className="w-32"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredProdutos.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-12">
                                                    <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                                    <p className="text-gray-500">Nenhum produto encontrado</p>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredProdutos.map(produto => (
                                                <TableRow key={produto.id}>
                                                    <TableCell>
                                                        <p className="font-medium">{produto.nome}</p>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="secondary">{produto.categoria || '-'}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {editingPrice === produto.id ? (
                                                            <div className="flex items-center gap-2 justify-end">
                                                                <span className="text-gray-500">R$</span>
                                                                <Input
                                                                    type="number"
                                                                    step="0.01"
                                                                    className="w-28 text-right"
                                                                    value={newPrice}
                                                                    onChange={e => setNewPrice(e.target.value)}
                                                                    autoFocus
                                                                />
                                                                <Button size="sm" onClick={() => handleSavePrice(produto.id)} style={{ backgroundColor: '#07593f' }}>
                                                                    <Check className="w-3 h-3" />
                                                                </Button>
                                                                <Button size="sm" variant="ghost" onClick={() => { setEditingPrice(null); setNewPrice(""); }}>
                                                                    Cancelar
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <span
                                                                className="font-bold cursor-pointer hover:underline"
                                                                style={{ color: '#07593f' }}
                                                                onClick={() => { setEditingPrice(produto.id); setNewPrice(produto.preco_venda || ""); }}
                                                            >
                                                                {formatarValor(produto.preco_venda)}
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex gap-1 justify-end">
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => { setEditingPrice(produto.id); setNewPrice(produto.preco_venda || ""); }}
                                                            >
                                                                <Pencil className="w-3 h-3" />
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => handleQuickPrint(produto)}
                                                            >
                                                                <Printer className="w-3 h-3" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                {/* Print Preview Modal */}
                <Dialog open={showPrintPreview} onOpenChange={setShowPrintPreview}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
                        <DialogHeader>
                            <DialogTitle style={{ color: '#07593f' }}>
                                <Printer className="w-5 h-5 inline mr-2" />
                                Pré-visualização de Etiquetas
                            </DialogTitle>
                        </DialogHeader>

                        <div id="print-area" className="bg-white">
                            {selectedProducts.map((produto, index) => {
                                const precoDe = precoDeValue[produto.id] || (produto.preco_venda * 1.2);
                                return (
                                    <div
                                        key={`${produto.id}-${index}`}
                                        className="label-page border-4 border-gray-800 rounded-2xl flex flex-col items-center justify-center text-center bg-gradient-to-br from-white to-gray-50 mx-auto mb-4"
                                        style={{
                                            width: layoutConfig.width,
                                            height: layoutConfig.height,
                                            padding: layoutConfig.padding,
                                            boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                                            maxWidth: '100%'
                                        }}
                                    >
                                        {/* Logo */}
                                        <img
                                            src={LOGO_URL}
                                            alt="Móveis Pedro II"
                                            style={{
                                                width: layoutConfig.logoSize,
                                                height: 'auto',
                                                marginBottom: '16px'
                                            }}
                                        />

                                        {/* Product Name */}
                                        <p
                                            className="font-bold text-gray-800 leading-tight text-center px-4"
                                            style={{
                                                fontSize: layoutConfig.nameSize,
                                                maxWidth: '90%',
                                                wordBreak: 'break-word'
                                            }}
                                        >
                                            {produto.nome}
                                        </p>

                                        {/* Divider */}
                                        <div className="w-1/2 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent my-4 rounded-full" />

                                        {/* Price - De Por */}
                                        {showDePor && (
                                            <p
                                                className="text-gray-400 line-through"
                                                style={{ fontSize: `calc(${layoutConfig.priceSize} * 0.5)` }}
                                            >
                                                De {formatarValor(precoDe)}
                                            </p>
                                        )}

                                        {showDePor && (
                                            <p className="text-red-600 font-bold text-sm uppercase tracking-widest">
                                                Por apenas
                                            </p>
                                        )}

                                        <p
                                            className="font-black tracking-tight"
                                            style={{
                                                color: '#07593f',
                                                fontSize: layoutConfig.priceSize,
                                                textShadow: '2px 2px 4px rgba(0,0,0,0.1)'
                                            }}
                                        >
                                            {formatarValor(produto.preco_venda)}
                                        </p>

                                        {/* Category Badge */}
                                        {produto.categoria && (
                                            <p
                                                className="mt-3 text-gray-500 uppercase tracking-widest"
                                                style={{ fontSize: `calc(${layoutConfig.nameSize} * 0.5)` }}
                                            >
                                                {produto.categoria}
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowPrintPreview(false)}>
                                Fechar
                            </Button>
                            <Button onClick={handlePrint} style={{ backgroundColor: '#07593f' }}>
                                <Printer className="w-4 h-4 mr-2" />
                                Imprimir
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Modal de Criar/Editar Cupom */}
                <Dialog open={isModalOpen} onOpenChange={handleCloseModal}>
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-bold" style={{ color: '#07593f' }}>
                                {editingCupom ? 'Editar Cupom' : 'Novo Cupom'}
                            </DialogTitle>
                        </DialogHeader>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <Alert variant="destructive" className="bg-red-50 border-red-200">
                                    <AlertDescription className="text-red-700">{error}</AlertDescription>
                                </Alert>
                            )}

                            <div>
                                <Label htmlFor="codigo">Código do Cupom *</Label>
                                <Input
                                    id="codigo"
                                    value={formData.codigo}
                                    onChange={(e) => setFormData(prev => ({ ...prev, codigo: e.target.value.toUpperCase() }))}
                                    placeholder="Ex: NATAL10, CLIENTEVIP"
                                    className="mt-1 font-mono uppercase"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="tipo">Tipo de Desconto *</Label>
                                    <Select value={formData.tipo} onValueChange={(v) => setFormData(prev => ({ ...prev, tipo: v }))}>
                                        <SelectTrigger className="mt-1">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="porcentagem">
                                                <div className="flex items-center gap-2">
                                                    <Percent className="w-4 h-4" /> Porcentagem
                                                </div>
                                            </SelectItem>
                                            <SelectItem value="fixo">
                                                <div className="flex items-center gap-2">
                                                    <DollarSign className="w-4 h-4" /> Valor Fixo
                                                </div>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label htmlFor="valor">Valor *</Label>
                                    <div className="relative mt-1">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                                            {formData.tipo === 'porcentagem' ? '%' : 'R$'}
                                        </span>
                                        <Input
                                            id="valor"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={formData.valor}
                                            onChange={(e) => setFormData(prev => ({ ...prev, valor: e.target.value }))}
                                            className="pl-10"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="validade" className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3" /> Validade
                                    </Label>
                                    <Input
                                        id="validade"
                                        type="date"
                                        value={formData.validade}
                                        onChange={(e) => setFormData(prev => ({ ...prev, validade: e.target.value }))}
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="quantidade" className="flex items-center gap-1">
                                        <Hash className="w-3 h-3" /> Quantidade
                                    </Label>
                                    <Input
                                        id="quantidade"
                                        type="number"
                                        min="1"
                                        value={formData.quantidade_disponivel}
                                        onChange={(e) => setFormData(prev => ({ ...prev, quantidade_disponivel: e.target.value }))}
                                        placeholder="Ilimitado"
                                        className="mt-1"
                                    />
                                </div>
                            </div>

                            <DialogFooter className="gap-2 pt-4">
                                <Button type="button" variant="outline" onClick={handleCloseModal}>
                                    Cancelar
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={createMutation.isPending || updateMutation.isPending}
                                    style={{ backgroundColor: '#07593f' }}
                                >
                                    {(createMutation.isPending || updateMutation.isPending) ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        editingCupom ? 'Salvar' : 'Criar Cupom'
                                    )}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Printable Content (hidden on screen, visible on print) */}
            <div id="printable-root" className="hidden print:block">
                {selectedProducts.map((produto, index) => {
                    const precoDe = precoDeValue[produto.id] || (produto.preco_venda * 1.2);
                    const config = layoutConfig; // Use current layout config

                    return (
                        <div
                            key={`print-${produto.id}-${index}`}
                            className="label-page-print"
                            style={{
                                padding: config.padding
                            }}
                        >
                            <div className="flex flex-col items-center justify-center text-center w-full h-full border-4 border-gray-800 rounded-3xl" style={{
                                width: config.width,
                                height: config.height,
                                margin: '0 auto'  // Center horizontally
                            }}>
                                {/* Logo */}
                                <img
                                    src={LOGO_URL}
                                    alt="Móveis Pedro II"
                                    style={{
                                        width: config.logoSize,
                                        height: 'auto',
                                        marginBottom: '20px'
                                    }}
                                />

                                {/* Product Name */}
                                <p
                                    className="font-bold text-gray-800 leading-tight px-4"
                                    style={{
                                        fontSize: config.nameSize,
                                        marginBottom: '20px',
                                        maxWidth: '90%',
                                        wordBreak: 'break-word'
                                    }}
                                >
                                    {produto.nome}
                                </p>

                                {/* Divider */}
                                <div className="w-1/2 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent my-4 rounded-full" />

                                {/* De Por */}
                                {showDePor && (
                                    <>
                                        <p
                                            className="text-gray-400 line-through mb-1"
                                            style={{ fontSize: `calc(${config.priceSize} * 0.4)` }}
                                        >
                                            De {formatarValor(precoDe)}
                                        </p>
                                        <p className="text-red-600 font-bold text-sm uppercase tracking-widest mb-2">
                                            POR APENAS
                                        </p>
                                    </>
                                )}

                                {/* Main Price */}
                                <p
                                    className="font-black tracking-tight"
                                    style={{
                                        color: '#07593f',
                                        fontSize: config.priceSize,
                                        textShadow: '2px 2px 4px rgba(0,0,0,0.1)'
                                    }}
                                >
                                    {formatarValor(produto.preco_venda)}
                                </p>

                                {/* Category */}
                                {produto.categoria && (
                                    <p
                                        className="mt-4 text-gray-500 uppercase tracking-widest"
                                        style={{ fontSize: `calc(${config.nameSize} * 0.5)` }}
                                    >
                                        {produto.categoria}
                                    </p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
