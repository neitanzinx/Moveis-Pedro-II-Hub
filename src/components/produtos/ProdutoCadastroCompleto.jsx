import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant, useLojas } from '@/contexts/TenantContext';
import { useAuth } from '@/hooks/useAuth';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Package,
    Palette,
    DollarSign,
    ImageIcon,
    ClipboardCheck,
    Check,
    Loader2,
    Plus,
    Trash2,
    AlertTriangle,
    Ruler,
    Upload,
    X,
    Link as LinkIcon,
    ChevronRight,
    ChevronLeft,
    ChevronDown,
    ChevronUp,
    Warehouse
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import { CATEGORIAS, AMBIENTES, MATERIAIS, TIPOS_ENTREGA, CAMPOS_ESTOQUE_LOJA } from '@/constants/productConstants';
import {
    normalizeProductName,
    normalizeColor,
    checkDuplicateProduct,
    validateProduct,
    validateVariations,
    formatPrice,
    formatDimensions,
    generateSKU
} from '@/utils/productFormatters';
import { calculateSuggestedMarkup, calculateMarkupDetails } from '@/utils/markupCalculator';
import FurnitureColorPicker, { getColorHex } from './FurnitureColorPicker';

// Seções do formulário para navegação interna
const SECOES = [
    { id: 'geral', name: 'Informações Gerais', icon: Package },
    { id: 'caracteristicas', name: 'Características Técnicas', icon: Ruler },
    { id: 'financeiro', name: 'Preço e Estoque', icon: DollarSign },
    { id: 'fiscal', name: 'Fiscal e Logístico', icon: Warehouse },
    { id: 'fotos', name: 'Fotos', icon: ImageIcon },
];

// Estado inicial do formulário
const INITIAL_FORM_DATA = {
    nome: '',
    modelo_referencia: '',
    categoria: '',
    ambiente: '',
    fornecedor_id: '',
    fornecedor_nome: '',
    descricao: '',
    tipo_entrega_padrao: 'desmontado',
    material: '',
    // === DADOS FISCAIS ===
    ncm: '',
    cest: '',
    cfop: '',
    origem_mercadoria: '0', // 0=Nacional, 1=Estrangeira importação direta, etc
    // === DADOS LOGÍSTICOS (Cubagem/Peso) ===
    peso_bruto: '',
    peso_liquido: '',
    altura_embalagem: '',
    largura_embalagem: '',
    profundidade_embalagem: '',
    // Preços
    preco_custo: '',
    preco_custo_tabela: '', // Preço fixo do fornecedor (tabela)
    preco_custo_promocional: '', // Preço quando comprado em promoção
    promocao_inicio: '', // Data início da promoção
    promocao_fim: '', // Data fim da promoção
    promocao_observacao: '', // Observação da promoção
    tem_promocao: false, // Toggle para ativar seção promocional
    preco_venda: '',
    // Dimensões do produto
    largura: '',
    altura: '',
    profundidade: '',
    // Cor do produto (único, sem variações)
    cor: '',
    cor_hex: '',
    // Estoque
    estoque_cd: '',
    estoque_mostruario_centro: '',
    estoque_mostruario_mega_store: '',
    estoque_mostruario_ponte_branca: '',
    estoque_mostruario_futura: '',
    quantidade_estoque: '', // Será a soma
    estoque_minimo: '',
    estoque_ideal: '',
    fotos: [],
    codigo_barras: '',
    ativo: true,
};


export default function ProdutoCadastroCompleto({
    isOpen,
    onClose,
    onSave,
    produto = null,
    isLoading = false,
    focusField = null
}) {
    const [formData, setFormData] = useState(INITIAL_FORM_DATA);
    const [errors, setErrors] = useState({});
    const [duplicatas, setDuplicatas] = useState([]);
    const [uploadingImages, setUploadingImages] = useState(false);
    const [fotoUrlInput, setFotoUrlInput] = useState('');
    const [showFiscalSection, setShowFiscalSection] = useState(false);
    const [activeTab, setActiveTab] = useState('geral');

    // Multi-Tenant: Carrega lojas dinâmicas e configurações
    const { lojas } = useLojas();
    const { settings, organization } = useTenant();
    const { user } = useAuth();
    const showFinancials = user?.cargo === 'Administrador';

    // Busca dados necessários
    const { data: fornecedores } = useQuery({
        queryKey: ['fornecedores'],
        queryFn: () => base44.entities.Fornecedor.list()
    });

    const { data: produtosExistentes } = useQuery({
        queryKey: ['produtos-para-duplicata'],
        queryFn: () => base44.entities.Produto.list()
    });

    // Inicializa com produto existente (modo edição)
    useEffect(() => {
        if (produto && isOpen) {
            setFormData({
                ...INITIAL_FORM_DATA,
                ...produto,
                modelo_referencia: produto.modelo_referencia || '',
                preco_custo: produto.preco_custo?.toString() || '',
                preco_custo_tabela: produto.preco_custo_tabela?.toString() || produto.preco_custo?.toString() || '',
                preco_custo_promocional: '', // Ignora valor do banco
                promocao_inicio: '',
                promocao_fim: '',
                promocao_observacao: '',
                tem_promocao: false, // Feature desabilitada
                preco_venda: produto.preco_venda?.toString() || '',
                // Estoque
                estoque_cd: produto.estoque_cd?.toString() || '',
                estoque_mostruario_centro: produto.estoque_mostruario_centro?.toString() || '',
                estoque_mostruario_mega_store: produto.estoque_mostruario_mega_store?.toString() || '',
                estoque_mostruario_ponte_branca: produto.estoque_mostruario_ponte_branca?.toString() || '',
                estoque_mostruario_futura: produto.estoque_mostruario_futura?.toString() || '',
                quantidade_estoque: produto.quantidade_estoque?.toString() || '',
                estoque_minimo: produto.estoque_minimo?.toString() || '',
                estoque_ideal: produto.estoque_ideal?.toString() || '',
                largura: produto.largura?.toString() || '',
                altura: produto.altura?.toString() || '',
                profundidade: produto.profundidade?.toString() || '',
                cfop: produto.cfop || '',
                fotos: produto.fotos || [],
                temVariacoes: produto.temVariacoes || false,
                variacoes: produto.variacoes || [],
            });
            setErrors({});
            setDuplicatas([]);
            setActiveTab('geral');
        } else if (!produto && isOpen) {
            setFormData(INITIAL_FORM_DATA);
            setErrors({});
            setDuplicatas([]);
        }
    }, [produto, isOpen]);

    // Smart Validation: Foca no campo com erro e troca de aba
    useEffect(() => {
        if (isOpen && focusField) {
            // Mapeamento campo -> aba
            const fieldToTab = {
                'ncm': 'fiscal',
                'cest': 'fiscal',
                'cfop': 'fiscal',
                'origem_mercadoria': 'fiscal',
                'peso_bruto': 'fiscal',
                'peso_liquido': 'fiscal',
                'altura_embalagem': 'fiscal',
                'largura_embalagem': 'fiscal',
                'profundidade_embalagem': 'fiscal',
                'preco_venda': 'financeiro',
                'preco_custo_tabela': 'financeiro',
                'estoque_cd': 'financeiro',
                'estoque_minimo': 'financeiro',
                'estoque_ideal': 'financeiro',
                'largura': 'caracteristicas',
                'altura': 'caracteristicas',
                'profundidade': 'caracteristicas',
                'cor': 'caracteristicas',
                'material': 'caracteristicas',
                'nome': 'geral',
                'categoria': 'geral',
                'fornecedor_id': 'geral'
            };

            const targetTab = fieldToTab[focusField];
            if (targetTab) {
                setActiveTab(targetTab);

                // Pequeno delay para garantir que a aba renderizou
                setTimeout(() => {
                    const input = document.getElementById(focusField) || document.querySelector(`[name="${focusField}"]`);
                    if (input) {
                        input.focus();
                        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        input.classList.add('ring-2', 'ring-red-500', 'ring-offset-2'); // Destaque visual

                        // Remover destaque após alguns segundos
                        setTimeout(() => {
                            input.classList.remove('ring-2', 'ring-red-500', 'ring-offset-2');
                        }, 3000);
                    }
                }, 300);
            }
        }
    }, [isOpen, focusField]);

    // Verifica duplicatas com base em características EXATAS
    useEffect(() => {
        if (formData.nome && formData.nome.length >= 3 && produtosExistentes) {
            const normalizeStr = (str) => (str || '').toString().toLowerCase().trim();

            const exactDuplicates = produtosExistentes.filter(p => {
                if (p.id === produto?.id) return false;

                return normalizeStr(p.nome) === normalizeStr(formData.nome) &&
                    normalizeStr(p.modelo_referencia) === normalizeStr(formData.modelo_referencia) &&
                    normalizeStr(p.categoria) === normalizeStr(formData.categoria) &&
                    normalizeStr(p.fornecedor_id) === normalizeStr(formData.fornecedor_id) &&
                    normalizeStr(p.cor) === normalizeStr(formData.cor) &&
                    normalizeStr(p.material) === normalizeStr(formData.material) &&
                    normalizeStr(p.largura) === normalizeStr(formData.largura) &&
                    normalizeStr(p.altura) === normalizeStr(formData.altura) &&
                    normalizeStr(p.profundidade) === normalizeStr(formData.profundidade);
            });

            setDuplicatas(exactDuplicates.length > 0 ? exactDuplicates : []);
        } else {
            setDuplicatas([]);
        }
    }, [
        formData.nome, formData.modelo_referencia, formData.categoria,
        formData.fornecedor_id, formData.cor, formData.material,
        formData.largura, formData.altura, formData.profundidade,
        produtosExistentes, produto?.id
    ]);

    // Calcula markup sugerido (baseado no preço de custo de tabela e categoria)
    const suggestedPrice = useMemo(() => {
        // Usa apenas preço de tabela
        const custoAtivo = parseFloat(formData.preco_custo_tabela);

        const hasCost = custoAtivo > 0;
        if (hasCost && formData.categoria) {
            // Tenta usar markup dinâmico da organização primeiro
            const markupCategorias = settings?.markup_categorias || {};
            const markupCategoria = markupCategorias[formData.categoria] || markupCategorias['default'] || 45;

            // Calcula preço sugerido: custo * (1 + markup/100)
            const precoSugerido = custoAtivo * (1 + markupCategoria / 100);
            return Math.ceil(precoSugerido); // Arredonda para cima
        }
        return 0;
    }, [formData.preco_custo_tabela, formData.categoria, settings?.markup_categorias]);

    // Atualiza campo do formulário
    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: null }));
        }
    };

    // Normaliza nome ao sair do campo
    const handleNomeBlur = () => {
        if (formData.nome) {
            handleChange('nome', normalizeProductName(formData.nome));
        }
    };

    // Atualiza fornecedor
    const handleFornecedorChange = (value) => {
        const fornecedor = fornecedores?.find(f => f.id.toString() === value);
        setFormData(prev => ({
            ...prev,
            fornecedor_id: parseInt(value),
            fornecedor_nome: fornecedor?.nome || fornecedor?.nome_empresa || ''
        }));
    };

    // Upload de imagens
    const handleImageUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        setUploadingImages(true);
        try {
            const uploadPromises = files.map(file => base44.storage.uploadFile(file));
            const urls = await Promise.all(uploadPromises);
            setFormData(prev => ({
                ...prev,
                fotos: [...prev.fotos, ...urls]
            }));
            toast.success(`${files.length} imagem(ns) enviada(s)`);
        } catch (error) {
            console.error('Erro no upload:', error);
            toast.error('Erro ao enviar imagens');
        } finally {
            setUploadingImages(false);
        }
    };

    // Adiciona foto por URL
    const handleAddFotoUrl = () => {
        if (!fotoUrlInput.trim()) return;
        try {
            new URL(fotoUrlInput);
            setFormData(prev => ({
                ...prev,
                fotos: [...prev.fotos, fotoUrlInput.trim()]
            }));
            setFotoUrlInput('');
        } catch {
            toast.error('URL inválida');
        }
    };

    // Remove foto
    const handleRemoveFoto = (index) => {
        setFormData(prev => ({
            ...prev,
            fotos: prev.fotos.filter((_, i) => i !== index)
        }));
    };

    // Validação geral
    const validateForm = () => {
        const newErrors = {};

        if (!formData.nome || formData.nome.trim().length < 3) {
            newErrors.nome = 'Nome deve ter pelo menos 3 caracteres';
        }
        if (!formData.categoria) {
            newErrors.categoria = 'Selecione uma categoria';
        }

        const precoVenda = parseFloat(formData.preco_venda);
        if (!precoVenda || precoVenda <= 0) {
            newErrors.preco_venda = 'Preço de venda deve ser maior que zero';
        }

        setErrors(newErrors);

        if (Object.keys(newErrors).length > 0) {
            // Se houver erro, focar no primeiro erro encontrado
            if (newErrors.nome || newErrors.categoria) setActiveTab('geral');
            else if (newErrors.preco_venda) setActiveTab('financeiro');
            toast.error('Verifique os campos obrigatórios');
        }

        return Object.keys(newErrors).length === 0;
    };


    // Aplica preço sugerido
    const applySuggestedMarkup = () => {
        if (suggestedPrice) {
            handleChange('preco_venda', suggestedPrice.toString());
        }
    };

    // Submete o formulário
    const handleSubmit = () => {
        if (!validateForm()) return;

        // Calcula estoque total das lojas
        let estoqueCd = parseInt(formData.estoque_cd) || 0;
        let estoqueCentro = parseInt(formData.estoque_mostruario_centro) || 0;
        let estoquePonteBranca = parseInt(formData.estoque_mostruario_ponte_branca) || 0;
        let estoqueMega = parseInt(formData.estoque_mostruario_mega_store) || 0;
        let estoqueFutura = parseInt(formData.estoque_mostruario_futura) || 0;
        let estoqueTotal = estoqueCd + estoqueCentro + estoquePonteBranca + estoqueMega + estoqueFutura;

        let precoVenda = parseFloat(formData.preco_venda) || 0;
        let precoCusto = parseFloat(formData.preco_custo) || 0;
        let largura = formData.largura ? parseFloat(formData.largura) : null;
        let altura = formData.altura ? parseFloat(formData.altura) : null;
        let profundidade = formData.profundidade ? parseFloat(formData.profundidade) : null;



        const dataToSave = {
            nome: normalizeProductName(formData.nome),
            modelo_referencia: formData.modelo_referencia || null,
            categoria: formData.categoria,
            ambiente: formData.ambiente || null,
            fornecedor_id: formData.fornecedor_id || null,
            fornecedor_nome: formData.fornecedor_nome || null,
            descricao: formData.descricao || null,
            tipo_entrega_padrao: formData.tipo_entrega_padrao,
            largura,
            altura,
            profundidade,
            material: formData.material || null,
            ncm: formData.ncm || null,
            cest: formData.cest || null,
            cfop: formData.cfop || null,
            // Preços de custo
            preco_custo_tabela: parseFloat(formData.preco_custo_tabela) || null,
            // Promoção removida da interface - limpando dados antigos
            preco_custo_promocional: null,
            promocao_inicio: null,
            promocao_fim: null,
            promocao_observacao: null,
            // preco_custo agora é sempre igual ao preço de tabela
            preco_custo: parseFloat(formData.preco_custo_tabela) || precoCusto || null,
            preco_venda: precoVenda,
            quantidade_estoque: estoqueTotal,
            estoque_cd: estoqueCd,
            estoque_mostruario_centro: estoqueCentro,
            estoque_mostruario_ponte_branca: estoquePonteBranca,
            estoque_mostruario_mega_store: estoqueMega,
            estoque_mostruario_futura: estoqueFutura,
            estoque_minimo: formData.estoque_minimo ? parseInt(formData.estoque_minimo) : 0,
            estoque_ideal: formData.estoque_ideal ? parseInt(formData.estoque_ideal) : 0,
            cor: formData.cor || null,
            cor_hex: formData.cor_hex || null,
            temVariacoes: formData.temVariacoes || false,
            variacoes: formData.variacoes || [],
            fotos: formData.fotos,
            codigo_barras: formData.codigo_barras || null,
            ativo: formData.ativo,
        };

        onSave(dataToSave);
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
                    <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
                        <DialogTitle className="text-xl font-bold">
                            {produto ? 'Editar Produto' : 'Cadastrar Novo Produto'}
                        </DialogTitle>

                        {/* Abas de Navegação */}
                        <div className="flex items-center gap-1 mt-4 overflow-x-auto no-scrollbar pb-1">
                            {SECOES.map((sec) => {
                                const Icon = sec.icon;
                                const isActive = activeTab === sec.id;

                                return (
                                    <button
                                        key={sec.id}
                                        onClick={() => setActiveTab(sec.id)}
                                        className={cn(
                                            "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                                            isActive
                                                ? "bg-green-600 text-white shadow-md shadow-green-200"
                                                : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                                        )}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {sec.name}
                                    </button>
                                );
                            })}
                        </div>
                    </DialogHeader>

                    {/* Conteúdo scrollável */}
                    <div className="flex-1 overflow-y-auto px-6 py-4 bg-gray-50/30">
                        {/* SEÇÃO: INFORMAÇÕES GERAIS */}
                        {activeTab === 'geral' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <Package className="w-4 h-4 text-green-600" />
                                            Identificação Básica
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid md:grid-cols-2 gap-4">
                                            <div className="md:col-span-2">
                                                <Label htmlFor="nome">Nome do Produto *</Label>
                                                <Input
                                                    id="nome"
                                                    value={formData.nome}
                                                    onChange={(e) => handleChange('nome', e.target.value)}
                                                    placeholder="Ex: Sofá Retrátil 3 Lugares"
                                                    className={cn("text-lg", errors.nome && 'border-red-500')}
                                                />
                                                {errors.nome && <p className="text-xs text-red-500 mt-1">{errors.nome}</p>}

                                                {duplicatas.length > 0 && (
                                                    <Alert className="mt-2 border-amber-200 bg-amber-50">
                                                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                                                        <AlertDescription className="text-amber-800 text-sm">
                                                            <strong>Possíveis duplicatas encontradas</strong>
                                                        </AlertDescription>
                                                    </Alert>
                                                )}
                                            </div>

                                            <div>
                                                <Label htmlFor="modelo_referencia">Modelo / Referência</Label>
                                                <Input
                                                    id="modelo_referencia"
                                                    value={formData.modelo_referencia}
                                                    onChange={(e) => handleChange('modelo_referencia', e.target.value)}
                                                    placeholder="REF-1234"
                                                />
                                            </div>

                                            <div>
                                                <Label>Fornecedor</Label>
                                                <Select
                                                    value={formData.fornecedor_id?.toString() || ''}
                                                    onValueChange={handleFornecedorChange}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Selecione o fornecedor" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {(fornecedores || []).map(f => (
                                                            <SelectItem key={f.id} value={f.id.toString()}>
                                                                {f.nome || f.nome_empresa}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div>
                                                <Label>Categoria *</Label>
                                                <Select
                                                    value={formData.categoria}
                                                    onValueChange={(value) => handleChange('categoria', value)}
                                                >
                                                    <SelectTrigger className={errors.categoria ? 'border-red-500' : ''}>
                                                        <SelectValue placeholder="Selecione a categoria" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {CATEGORIAS.map(cat => (
                                                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div>
                                                <Label>Ambiente</Label>
                                                <Select
                                                    value={formData.ambiente}
                                                    onValueChange={(value) => handleChange('ambiente', value)}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Selecione o ambiente" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {AMBIENTES.map(amb => (
                                                            <SelectItem key={amb} value={amb}>{amb}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="md:col-span-2">
                                                <Label>Descrição</Label>
                                                <Textarea
                                                    value={formData.descricao}
                                                    onChange={(e) => handleChange('descricao', e.target.value)}
                                                    rows={3}
                                                    placeholder="Descrição detalhada para o e-commerce e etiquetas..."
                                                />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {/* SEÇÃO: CARACTERÍSTICAS TÉCNICAS */}
                        {activeTab === 'caracteristicas' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <Palette className="w-4 h-4 text-purple-600" />
                                            Cores e Materiais
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid md:grid-cols-2 gap-4">
                                            <div className="md:col-span-2">
                                                <Label>Cor e Acabamento</Label>
                                                <FurnitureColorPicker
                                                    value={formData.cor}
                                                    hexValue={formData.cor_hex}
                                                    onChange={(val) => handleChange('cor', val)}
                                                    onHexChange={(hex) => handleChange('cor_hex', hex)}
                                                />
                                            </div>
                                            <div>
                                                <Label>Material Principal</Label>
                                                <Select
                                                    value={formData.material}
                                                    onValueChange={(value) => handleChange('material', value)}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Selecione" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {MATERIAIS.map(mat => (
                                                            <SelectItem key={mat} value={mat}>{mat}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <Label>Tipo de Entrega Padrão</Label>
                                                <Select
                                                    value={formData.tipo_entrega_padrao}
                                                    onValueChange={(value) => handleChange('tipo_entrega_padrao', value)}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {TIPOS_ENTREGA.map(tipo => (
                                                            <SelectItem key={tipo.valor} value={tipo.valor}>
                                                                {tipo.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <Ruler className="w-4 h-4 text-blue-600" />
                                            Dimensões do Produto
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div>
                                                <Label className="text-xs">Largura (cm)</Label>
                                                <Input
                                                    id="largura"
                                                    type="number"
                                                    value={formData.largura}
                                                    onChange={(e) => handleChange('largura', e.target.value)}
                                                    placeholder="180"
                                                />
                                            </div>
                                            <div>
                                                <Label className="text-xs">Altura (cm)</Label>
                                                <Input
                                                    id="altura"
                                                    type="number"
                                                    value={formData.altura}
                                                    onChange={(e) => handleChange('altura', e.target.value)}
                                                    placeholder="90"
                                                />
                                            </div>
                                            <div>
                                                <Label className="text-xs">Profundidade (cm)</Label>
                                                <Input
                                                    id="profundidade"
                                                    type="number"
                                                    value={formData.profundidade}
                                                    onChange={(e) => handleChange('profundidade', e.target.value)}
                                                    placeholder="85"
                                                />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {/* SEÇÃO: FINANCEIRO E ESTOQUE */}
                        {activeTab === 'financeiro' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                                <Card className="border-green-200">
                                    <CardHeader>
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <DollarSign className="w-4 h-4 text-green-600" />
                                            Valores
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid md:grid-cols-2 gap-4">
                                            {showFinancials && (
                                                <div>
                                                    <Label>Custo (Tabela)</Label>
                                                    <Input
                                                        id="preco_custo_tabela"
                                                        type="number"
                                                        step="0.01"
                                                        value={formData.preco_custo_tabela}
                                                        onChange={(e) => handleChange('preco_custo_tabela', e.target.value)}
                                                        placeholder="R$ 0,00"
                                                    />
                                                </div>
                                            )}
                                            <div>
                                                <Label>Preço de Venda *</Label>
                                                <Input
                                                    id="preco_venda"
                                                    type="number"
                                                    step="0.01"
                                                    value={formData.preco_venda}
                                                    onChange={(e) => handleChange('preco_venda', e.target.value)}
                                                    placeholder="R$ 0,00"
                                                    className={cn(errors.preco_venda && 'border-red-500')}
                                                />
                                                {errors.preco_venda && <p className="text-xs text-red-500 mt-1">{errors.preco_venda}</p>}
                                                {suggestedPrice > 0 && showFinancials && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={applySuggestedMarkup}
                                                        className="mt-1 h-auto py-1 text-green-600 hover:text-green-700 text-xs"
                                                    >
                                                        Aplicar sugestão: R$ {suggestedPrice.toFixed(2)}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-base flex items-center gap-2">
                                                <Warehouse className="w-4 h-4 text-orange-600" />
                                                Estoque
                                            </CardTitle>
                                            <Badge variant="outline" className="bg-green-50">
                                                Total: {
                                                    (parseInt(formData.estoque_cd) || 0) +
                                                    (parseInt(formData.estoque_mostruario_centro) || 0) +
                                                    (parseInt(formData.estoque_mostruario_ponte_branca) || 0) +
                                                    (parseInt(formData.estoque_mostruario_mega_store) || 0) +
                                                    (parseInt(formData.estoque_mostruario_futura) || 0)
                                                }
                                            </Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-gray-50 p-2 rounded-lg border">
                                                <Label className="text-xs text-gray-500">Depósito / CD</Label>
                                                <Input
                                                    id="estoque_cd"
                                                    type="number"
                                                    value={formData.estoque_cd}
                                                    onChange={(e) => handleChange('estoque_cd', e.target.value)}
                                                    className="h-8 text-sm"
                                                />
                                            </div>
                                            {(lojas || []).map(loja => {
                                                const nomeNorm = loja.nome.toLowerCase();
                                                let field = null;
                                                if (nomeNorm.includes('centro')) field = 'estoque_mostruario_centro';
                                                else if (nomeNorm.includes('ponte branca') || nomeNorm.includes('ponte_branca')) field = 'estoque_mostruario_ponte_branca';
                                                else if (nomeNorm.includes('mega')) field = 'estoque_mostruario_mega_store';
                                                else if (nomeNorm.includes('futura')) field = 'estoque_mostruario_futura';

                                                if (!field) return null;
                                                return (
                                                    <div key={loja.id} className="p-2 rounded-lg border">
                                                        <Label className="text-xs text-gray-500">{loja.nome}</Label>
                                                        <Input
                                                            type="number"
                                                            value={formData[field]}
                                                            onChange={(e) => handleChange(field, e.target.value)}
                                                            className="h-8 text-sm"
                                                            id={field}
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                                            <div>
                                                <Label className="text-xs">Estoque Mínimo</Label>
                                                <Input
                                                    id="estoque_minimo"
                                                    type="number"
                                                    value={formData.estoque_minimo}
                                                    onChange={(e) => handleChange('estoque_minimo', e.target.value)}
                                                    className="h-8"
                                                />
                                            </div>
                                            <div>
                                                <Label className="text-xs">Estoque Ideal</Label>
                                                <Input
                                                    id="estoque_ideal"
                                                    type="number"
                                                    value={formData.estoque_ideal}
                                                    onChange={(e) => handleChange('estoque_ideal', e.target.value)}
                                                    className="h-8"
                                                />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {/* SEÇÃO: FISCAL E LOGÍSTICO */}
                        {activeTab === 'fiscal' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base">Dados Fiscais (NFe)</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid md:grid-cols-2 gap-4">
                                            <div>
                                                <Label>NCM</Label>
                                                <Input
                                                    id="ncm"
                                                    value={formData.ncm}
                                                    onChange={(e) => handleChange('ncm', e.target.value)}
                                                    placeholder="9401.61.00"
                                                />
                                            </div>
                                            <div>
                                                <Label>CEST</Label>
                                                <Input
                                                    id="cest"
                                                    value={formData.cest}
                                                    onChange={(e) => handleChange('cest', e.target.value)}
                                                    placeholder="2001500"
                                                />
                                            </div>
                                            <div>
                                                <Label>CFOP</Label>
                                                <Input
                                                    id="cfop"
                                                    value={formData.cfop}
                                                    onChange={(e) => handleChange('cfop', e.target.value)}
                                                    placeholder="5102"
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <Label>Origem da Mercadoria</Label>
                                                <Select
                                                    value={formData.origem_mercadoria}
                                                    onValueChange={(value) => handleChange('origem_mercadoria', value)}
                                                >
                                                    <SelectTrigger id="origem_mercadoria">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="0">0 - Nacional</SelectItem>
                                                        <SelectItem value="1">1 - Estrangeira (Importação Direta)</SelectItem>
                                                        <SelectItem value="2">2 - Estrangeira (Mercado Interno)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base text-gray-700">Logística de Transporte</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <Label className="text-xs">Peso Bruto (kg)</Label>
                                                <Input
                                                    id="peso_bruto"
                                                    type="number"
                                                    step="0.01"
                                                    value={formData.peso_bruto}
                                                    onChange={(e) => handleChange('peso_bruto', e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <Label className="text-xs">Peso Líquido (kg)</Label>
                                                <Input
                                                    id="peso_liquido"
                                                    type="number"
                                                    step="0.01"
                                                    value={formData.peso_liquido}
                                                    onChange={(e) => handleChange('peso_liquido', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div className="pt-2 border-t">
                                            <Label className="text-xs mb-2 block">Dimensões da Embalagem (para Cubagem)</Label>
                                            <div className="grid grid-cols-3 gap-3">
                                                <Input id="altura_embalagem" placeholder="Alt" type="number" value={formData.altura_embalagem} onChange={(e) => handleChange('altura_embalagem', e.target.value)} />
                                                <Input id="largura_embalagem" placeholder="Larg" type="number" value={formData.largura_embalagem} onChange={(e) => handleChange('largura_embalagem', e.target.value)} />
                                                <Input id="profundidade_embalagem" placeholder="Prof" type="number" value={formData.profundidade_embalagem} onChange={(e) => handleChange('profundidade_embalagem', e.target.value)} />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {/* SEÇÃO: FOTOS */}
                        {activeTab === 'fotos' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                                <div className="border-2 border-dashed rounded-xl p-8 text-center bg-white">
                                    <label className="cursor-pointer group">
                                        <input
                                            type="file"
                                            multiple
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            className="hidden"
                                            disabled={uploadingImages}
                                        />
                                        <div className="space-y-2">
                                            {uploadingImages ? (
                                                <Loader2 className="w-10 h-10 mx-auto animate-spin text-green-600" />
                                            ) : (
                                                <>
                                                    <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto group-hover:bg-green-100 transition-colors">
                                                        <Upload className="w-6 h-6 text-green-600" />
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-gray-900">Clique para enviar fotos</p>
                                                        <p className="text-sm text-gray-500">ou arraste e solte arquivos aqui</p>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </label>
                                </div>

                                <div className="space-y-2">
                                    <Label>Ou adicione por URL</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            value={fotoUrlInput}
                                            onChange={(e) => setFotoUrlInput(e.target.value)}
                                            placeholder="https://..."
                                        />
                                        <Button type="button" onClick={handleAddFotoUrl} variant="outline" size="icon">
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>

                                {formData.fotos.length > 0 && (
                                    <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
                                        {formData.fotos.map((foto, index) => (
                                            <div key={index} className="relative group aspect-square rounded-xl overflow-hidden border bg-white shadow-sm">
                                                <img src={foto} className="w-full h-full object-cover" alt="" />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                    <Button
                                                        variant="destructive"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={() => handleRemoveFoto(index)}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                                {index === 0 && (
                                                    <div className="absolute top-2 left-2 px-2 py-0.5 bg-green-500 text-white text-[10px] font-bold rounded shadow-sm">
                                                        PRINCIPAL
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer fixo */}
                    <div className="px-6 py-4 border-t bg-white shrink-0">
                        <div className="flex justify-between items-center">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={onClose}
                                disabled={isLoading}
                            >
                                Cancelar
                            </Button>

                            <Button
                                type="button"
                                onClick={handleSubmit}
                                disabled={isLoading}
                                className="bg-green-600 hover:bg-green-700 min-w-[140px] shadow-lg shadow-green-100 transition-all hover:scale-105"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Salvando...
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4 mr-2" />
                                        {produto ? 'Salvar Alterações' : 'Cadastrar Produto'}
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
