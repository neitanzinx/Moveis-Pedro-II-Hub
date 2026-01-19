import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant, useLojas } from '@/contexts/TenantContext';
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

import { CATEGORIAS, AMBIENTES, MATERIAIS, TIPOS_ENTREGA } from '@/constants/productConstants';
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

// Steps do formulário - NOVO FLUXO (4 etapas)
const STEPS = [
    { id: 1, name: 'Identificação', icon: Package },
    { id: 2, name: 'Variações e Preço', icon: Palette },
    { id: 3, name: 'Fotos', icon: ImageIcon },
    { id: 4, name: 'Revisão', icon: ClipboardCheck },
];

// Estado inicial do formulário
const INITIAL_FORM_DATA = {
    nome: '',
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
    origem_mercadoria: '0', // 0=Nacional, 1=Estrangeira importação direta, etc
    // === DADOS LOGÍSTICOS (Cubagem/Peso) ===
    peso_bruto: '',
    peso_liquido: '',
    altura_embalagem: '',
    largura_embalagem: '',
    profundidade_embalagem: '',
    // Preços base (usados para item único ou como template para variações)
    preco_custo: '',
    preco_custo_tabela: '', // Preço fixo do fornecedor (tabela)
    preco_custo_promocional: '', // Preço quando comprado em promoção
    promocao_inicio: '', // Data início da promoção
    promocao_fim: '', // Data fim da promoção
    promocao_observacao: '', // Observação da promoção
    tem_promocao: false, // Toggle para ativar seção promocional
    preco_venda: '',
    // Dimensões base (para item único)
    largura: '',
    altura: '',
    profundidade: '',
    quantidade_estoque: '',
    estoque_minimo: '5',
    variacoes: [],
    fotos: [],
    codigo_barras: '',
    ativo: true,
    temVariacoes: false,
};

export default function ProdutoCadastroCompleto({
    isOpen,
    onClose,
    onSave,
    produto = null,
    isLoading = false
}) {
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState(INITIAL_FORM_DATA);
    const [errors, setErrors] = useState({});
    const [duplicatas, setDuplicatas] = useState([]);
    const [uploadingImages, setUploadingImages] = useState(false);
    const [fotoUrlInput, setFotoUrlInput] = useState('');
    const [expandedVariacao, setExpandedVariacao] = useState(null);
    const [showFiscalSection, setShowFiscalSection] = useState(false);

    // Multi-Tenant: Carrega lojas dinâmicas e configurações
    const { lojas } = useLojas();
    const { settings, organization } = useTenant();

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
                preco_custo: produto.preco_custo?.toString() || '',
                preco_custo_tabela: produto.preco_custo_tabela?.toString() || produto.preco_custo?.toString() || '',
                preco_custo_promocional: '', // Ignora valor do banco
                promocao_inicio: '',
                promocao_fim: '',
                promocao_observacao: '',
                tem_promocao: false, // Feature desabilitada
                preco_venda: produto.preco_venda?.toString() || '',
                quantidade_estoque: produto.quantidade_estoque?.toString() || '',
                estoque_minimo: produto.estoque_minimo?.toString() || '5',
                largura: produto.largura?.toString() || '',
                altura: produto.altura?.toString() || '',
                profundidade: produto.profundidade?.toString() || '',
                variacoes: produto.variacoes || [],
                fotos: produto.fotos || [],
                temVariacoes: (produto.variacoes?.length || 0) > 0,
            });
            setCurrentStep(1);
            setErrors({});
            setDuplicatas([]);
        } else if (!produto && isOpen) {
            setFormData(INITIAL_FORM_DATA);
            setCurrentStep(1);
            setErrors({});
            setDuplicatas([]);
        }
    }, [produto, isOpen]);

    // Verifica duplicatas quando o nome muda
    useEffect(() => {
        if (formData.nome && formData.nome.length >= 3 && produtosExistentes) {
            const possiveis = checkDuplicateProduct(
                formData.nome,
                produtosExistentes.filter(p => p.id !== produto?.id),
                0.75
            );
            setDuplicatas(possiveis);
        } else {
            setDuplicatas([]);
        }
    }, [formData.nome, produtosExistentes, produto?.id]);

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

    // Adiciona variação com dimensões - AGORA com estoque dinâmico por loja
    const handleAddVariacao = () => {
        // Cria objeto de estoque dinâmico baseado nas lojas cadastradas
        const estoquePorLoja = {};
        lojas.forEach(loja => {
            estoquePorLoja[`estoque_${loja.codigo.toLowerCase().replace(/\s+/g, '_')}`] = '';
        });

        const novaVariacao = {
            id: Date.now().toString(),
            nome: '', // Nome descritivo da variação (ex: "Cinza 180cm")
            cor: '',
            cor_hex: '#CCCCCC',
            tamanho: '',
            // Dimensões por variação
            largura: formData.largura || '',
            altura: formData.altura || '',
            profundidade: formData.profundidade || '',
            // Preço
            preco_custo: formData.preco_custo || '',
            preco_venda: formData.preco_venda || '',
            // Estoque dinâmico por loja (gerado automaticamente)
            ...estoquePorLoja,
            estoque_cd: '', // Centro de distribuição sempre presente
            // Fotos da variação
            fotos: [],
        };
        setFormData(prev => ({
            ...prev,
            variacoes: [...prev.variacoes, novaVariacao]
        }));
        setExpandedVariacao(novaVariacao.id);
    };

    // Atualiza variação
    const handleUpdateVariacao = (index, field, value) => {
        setFormData(prev => ({
            ...prev,
            variacoes: prev.variacoes.map((v, i) =>
                i === index ? { ...v, [field]: value } : v
            )
        }));
    };

    // Remove variação
    const handleRemoveVariacao = (index) => {
        setFormData(prev => ({
            ...prev,
            variacoes: prev.variacoes.filter((_, i) => i !== index)
        }));
    };

    // Valida step atual
    const validateCurrentStep = () => {
        const newErrors = {};

        if (currentStep === 1) {
            if (!formData.nome || formData.nome.trim().length < 3) {
                newErrors.nome = 'Nome deve ter pelo menos 3 caracteres';
            }
            if (!formData.categoria) {
                newErrors.categoria = 'Selecione uma categoria';
            }
        }

        if (currentStep === 2) {
            if (formData.temVariacoes) {
                if (formData.variacoes.length === 0) {
                    newErrors.variacoes = 'Adicione pelo menos uma variação';
                } else {
                    const semIdentificacao = formData.variacoes.some(v =>
                        (!v.cor || v.cor.trim() === '') && (!v.tamanho || v.tamanho.trim() === '')
                    );
                    if (semIdentificacao) {
                        newErrors.variacoes = 'Cada variação precisa de cor ou tamanho';
                    }
                    const semPreco = formData.variacoes.some(v => !v.preco_venda || parseFloat(v.preco_venda) <= 0);
                    if (semPreco) {
                        newErrors.variacoes = 'Todas as variações precisam ter preço de venda';
                    }
                }
            } else {
                const precoVenda = parseFloat(formData.preco_venda);
                if (!precoVenda || precoVenda <= 0) {
                    newErrors.preco_venda = 'Preço de venda deve ser maior que zero';
                }
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Navega entre steps
    const handleNext = () => {
        if (validateCurrentStep()) {
            setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
        }
    };

    const handlePrev = () => {
        setCurrentStep(prev => Math.max(prev - 1, 1));
    };

    // Aplica preço sugerido
    const applySuggestedMarkup = () => {
        if (suggestedPrice) {
            handleChange('preco_venda', suggestedPrice.toString());
        }
    };

    // Submete o formulário
    const handleSubmit = () => {
        if (!validateCurrentStep()) return;

        // Calcula estoque total e preço
        let estoqueTotal = parseInt(formData.quantidade_estoque) || 0;
        let precoVenda = parseFloat(formData.preco_venda) || 0;
        let precoCusto = parseFloat(formData.preco_custo) || 0;
        let largura = formData.largura ? parseFloat(formData.largura) : null;
        let altura = formData.altura ? parseFloat(formData.altura) : null;
        let profundidade = formData.profundidade ? parseFloat(formData.profundidade) : null;

        if (formData.temVariacoes && formData.variacoes.length > 0) {
            estoqueTotal = formData.variacoes.reduce((sum, v) => sum + (parseInt(v.estoque) || 0), 0);
            // Pega o menor preço de venda das variações
            const precos = formData.variacoes.map(v => parseFloat(v.preco_venda) || 0).filter(p => p > 0);
            if (precos.length > 0) {
                precoVenda = Math.min(...precos);
            }
            // Pega dimensões da primeira variação como referência
            const primeiraVariacao = formData.variacoes[0];
            if (primeiraVariacao) {
                largura = primeiraVariacao.largura ? parseFloat(primeiraVariacao.largura) : null;
                altura = primeiraVariacao.altura ? parseFloat(primeiraVariacao.altura) : null;
                profundidade = primeiraVariacao.profundidade ? parseFloat(primeiraVariacao.profundidade) : null;
            }
        }

        const dataToSave = {
            nome: normalizeProductName(formData.nome),
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
            estoque_minimo: parseInt(formData.estoque_minimo) || 5,
            variacoes: formData.temVariacoes ? formData.variacoes : [],
            fotos: formData.fotos,
            codigo_barras: formData.codigo_barras || null,
            ativo: formData.ativo,
        };

        onSave(dataToSave);
    };

    // Gera nome da variação
    const getVariacaoDisplayName = (v) => {
        const parts = [];
        if (v.cor) parts.push(v.cor);
        if (v.tamanho) parts.push(v.tamanho);
        if (v.largura && v.altura) parts.push(`${v.largura}x${v.altura}cm`);
        return parts.join(' - ') || 'Nova variação';
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
                    <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
                        <DialogTitle className="text-xl font-bold">
                            {produto ? 'Editar Produto' : 'Cadastrar Novo Produto'}
                        </DialogTitle>

                        {/* Stepper Visual */}
                        <div className="flex items-center justify-between mt-4">
                            {STEPS.map((step, index) => {
                                const Icon = step.icon;
                                const isActive = currentStep === step.id;
                                const isCompleted = currentStep > step.id;

                                return (
                                    <button
                                        key={step.id}
                                        onClick={() => setCurrentStep(step.id)}
                                        className={cn(
                                            "flex flex-col items-center gap-1 flex-1 transition-all cursor-pointer hover:scale-105",
                                            isActive && "text-green-700",
                                            isCompleted && "text-green-600",
                                            !isActive && !isCompleted && "text-gray-500 hover:text-gray-700"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                                            isActive && "bg-green-100 ring-2 ring-green-500",
                                            isCompleted && "bg-green-500",
                                            !isActive && !isCompleted && "bg-gray-100 hover:bg-gray-200"
                                        )}>
                                            {isCompleted ? (
                                                <Check className="w-5 h-5 text-white" />
                                            ) : (
                                                <Icon className={cn("w-5 h-5", isActive ? "text-green-700" : "text-gray-400")} />
                                            )}
                                        </div>
                                        <span className="text-xs font-medium hidden md:block">{step.name}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </DialogHeader>

                    {/* Conteúdo scrollável */}
                    <div className="flex-1 overflow-y-auto px-6 py-4">

                        {/* PASSO 1: Identificação */}
                        {currentStep === 1 && (
                            <div className="space-y-6">
                                <div className="text-center mb-6">
                                    <h3 className="text-lg font-semibold text-gray-900">Identificação do Produto</h3>
                                    <p className="text-sm text-gray-500">Informe o nome e categorização do produto</p>
                                </div>

                                <div className="grid md:grid-cols-2 gap-4">
                                    {/* Nome */}
                                    <div className="md:col-span-2">
                                        <Label htmlFor="nome">Nome do Produto *</Label>
                                        <Input
                                            id="nome"
                                            value={formData.nome}
                                            onChange={(e) => handleChange('nome', e.target.value)}
                                            onBlur={handleNomeBlur}
                                            placeholder="Ex: Sofá 3 Lugares Retrátil"
                                            className={cn("text-lg", errors.nome && 'border-red-500')}
                                        />
                                        {errors.nome && <p className="text-xs text-red-500 mt-1">{errors.nome}</p>}

                                        {duplicatas.length > 0 && (
                                            <Alert className="mt-2 border-amber-200 bg-amber-50">
                                                <AlertTriangle className="h-4 w-4 text-amber-600" />
                                                <AlertDescription className="text-amber-800 text-sm">
                                                    <strong>Possíveis duplicatas:</strong>
                                                    <ul className="mt-1 ml-4 list-disc">
                                                        {duplicatas.slice(0, 3).map((dup, i) => (
                                                            <li key={i}>
                                                                {dup.produto.nome}
                                                                <span className="text-amber-600 ml-1">
                                                                    ({Math.round(dup.similarity * 100)}% similar)
                                                                </span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </AlertDescription>
                                            </Alert>
                                        )}
                                    </div>

                                    {/* Ambiente */}
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

                                    {/* Categoria */}
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
                                        {errors.categoria && <p className="text-xs text-red-500 mt-1">{errors.categoria}</p>}
                                    </div>

                                    {/* Fornecedor */}
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

                                    {/* Tipo de Entrega */}
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

                                    {/* Material */}
                                    <div>
                                        <Label>Material Principal</Label>
                                        <Select
                                            value={formData.material}
                                            onValueChange={(value) => handleChange('material', value)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione o material" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {MATERIAIS.map(mat => (
                                                    <SelectItem key={mat} value={mat}>{mat}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Descrição */}
                                    <div className="md:col-span-2">
                                        <Label>Descrição</Label>
                                        <Textarea
                                            value={formData.descricao}
                                            onChange={(e) => handleChange('descricao', e.target.value)}
                                            rows={3}
                                            placeholder="Descrição detalhada do produto..."
                                        />
                                    </div>
                                </div>

                                {/* Dados Fiscais e Logísticos */}
                                <div className="border-t pt-4">
                                    <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                                        <Package className="w-4 h-4" />
                                        Dados Fiscais e Logísticos
                                    </h4>

                                    {/* Dados Fiscais */}
                                    <div className="grid md:grid-cols-3 gap-4 mb-4">
                                        <div>
                                            <Label htmlFor="ncm">NCM</Label>
                                            <Input
                                                id="ncm"
                                                value={formData.ncm}
                                                onChange={(e) => handleChange('ncm', e.target.value)}
                                                placeholder="Ex: 9401.61.00"
                                                maxLength={10}
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="cest">CEST</Label>
                                            <Input
                                                id="cest"
                                                value={formData.cest}
                                                onChange={(e) => handleChange('cest', e.target.value)}
                                                placeholder="Ex: 2001500"
                                                maxLength={7}
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="origem">Origem da Mercadoria</Label>
                                            <Select
                                                value={formData.origem_mercadoria}
                                                onValueChange={(value) => handleChange('origem_mercadoria', value)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecione" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="0">0 - Nacional</SelectItem>
                                                    <SelectItem value="1">1 - Estrangeira (Importação Direta)</SelectItem>
                                                    <SelectItem value="2">2 - Estrangeira (Mercado Interno)</SelectItem>
                                                    <SelectItem value="3">3 - Nacional (40-70% conteúdo importado)</SelectItem>
                                                    <SelectItem value="5">5 - Nacional (menor 40% conteúdo importado)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {/* Dados de Peso */}
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="peso_bruto">Peso Bruto (kg)</Label>
                                            <Input
                                                id="peso_bruto"
                                                type="number"
                                                step="0.01"
                                                value={formData.peso_bruto}
                                                onChange={(e) => handleChange('peso_bruto', e.target.value)}
                                                placeholder="Ex: 35.50"
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="peso_liquido">Peso Líquido (kg)</Label>
                                            <Input
                                                id="peso_liquido"
                                                type="number"
                                                step="0.01"
                                                value={formData.peso_liquido}
                                                onChange={(e) => handleChange('peso_liquido', e.target.value)}
                                                placeholder="Ex: 32.00"
                                            />
                                        </div>
                                    </div>

                                    {/* Cubagem da Embalagem */}
                                    <div>
                                        <Label className="text-sm font-medium text-gray-700 mb-2 block">
                                            Dimensões da Embalagem (cm)
                                        </Label>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div>
                                                <Label htmlFor="altura_emb" className="text-xs text-gray-500">Altura</Label>
                                                <Input
                                                    id="altura_emb"
                                                    type="number"
                                                    step="0.1"
                                                    value={formData.altura_embalagem}
                                                    onChange={(e) => handleChange('altura_embalagem', e.target.value)}
                                                    placeholder="cm"
                                                />
                                            </div>
                                            <div>
                                                <Label htmlFor="largura_emb" className="text-xs text-gray-500">Largura</Label>
                                                <Input
                                                    id="largura_emb"
                                                    type="number"
                                                    step="0.1"
                                                    value={formData.largura_embalagem}
                                                    onChange={(e) => handleChange('largura_embalagem', e.target.value)}
                                                    placeholder="cm"
                                                />
                                            </div>
                                            <div>
                                                <Label htmlFor="prof_emb" className="text-xs text-gray-500">Profundidade</Label>
                                                <Input
                                                    id="prof_emb"
                                                    type="number"
                                                    step="0.1"
                                                    value={formData.profundidade_embalagem}
                                                    onChange={(e) => handleChange('profundidade_embalagem', e.target.value)}
                                                    placeholder="cm"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* PASSO 2: Variações e Preço */}
                        {currentStep === 2 && (
                            <div className="space-y-6">
                                <div className="text-center mb-6">
                                    <h3 className="text-lg font-semibold text-gray-900">Variações e Preço</h3>
                                    <p className="text-sm text-gray-500">Configure as opções do produto</p>
                                </div>

                                {/* Pergunta: Tem variações? */}
                                <Card className="border-2">
                                    <CardContent className="p-6">
                                        <div className="text-center mb-4">
                                            <h4 className="font-medium text-gray-900">
                                                Este produto possui variações de cor, tamanho ou acabamento?
                                            </h4>
                                            <p className="text-sm text-gray-500 mt-1">
                                                Ex: Sofá disponível em Cinza e Bege, ou Mesa em 4 e 6 lugares
                                            </p>
                                        </div>
                                        <div className="flex justify-center gap-4">
                                            <Button
                                                type="button"
                                                variant={formData.temVariacoes ? "default" : "outline"}
                                                onClick={() => handleChange('temVariacoes', true)}
                                                className={cn(
                                                    "w-40",
                                                    formData.temVariacoes && "bg-green-600 hover:bg-green-700"
                                                )}
                                            >
                                                <Check className="w-4 h-4 mr-2" />
                                                Sim, tem variações
                                            </Button>
                                            <Button
                                                type="button"
                                                variant={!formData.temVariacoes ? "default" : "outline"}
                                                onClick={() => handleChange('temVariacoes', false)}
                                                className={cn(
                                                    "w-40",
                                                    !formData.temVariacoes && "bg-green-600 hover:bg-green-700"
                                                )}
                                            >
                                                <X className="w-4 h-4 mr-2" />
                                                Não, item único
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Se TEM variações */}
                                {formData.temVariacoes && (
                                    <div className="space-y-4">
                                        {/* Preço Base */}
                                        <Card className="bg-gray-50 border-dashed">
                                            <CardContent className="p-4">
                                                <Label className="text-sm text-gray-600 mb-2 block">
                                                    Preço base (aplicado automaticamente às novas variações)
                                                </Label>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <Label className="text-xs text-gray-500">Custo Base</Label>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            value={formData.preco_custo}
                                                            onChange={(e) => handleChange('preco_custo', e.target.value)}
                                                            placeholder="R$ 0,00"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label className="text-xs text-gray-500">Venda Base</Label>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            value={formData.preco_venda}
                                                            onChange={(e) => handleChange('preco_venda', e.target.value)}
                                                            placeholder="R$ 0,00"
                                                        />
                                                    </div>
                                                </div>
                                                {formData.variacoes.length > 0 && (formData.preco_custo || formData.preco_venda) && (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="mt-3 w-full text-green-600 border-green-300 hover:bg-green-50"
                                                        onClick={() => {
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                variacoes: prev.variacoes.map(v => ({
                                                                    ...v,
                                                                    preco_custo: prev.preco_custo || v.preco_custo,
                                                                    preco_venda: prev.preco_venda || v.preco_venda
                                                                }))
                                                            }));
                                                            toast.success('Preço base aplicado a todas as variações');
                                                        }}
                                                    >
                                                        Aplicar preço base a todas as variações
                                                    </Button>
                                                )}
                                            </CardContent>
                                        </Card>

                                        <div className="flex justify-between items-center">
                                            <Label className="text-base font-semibold">Variações do Produto</Label>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={handleAddVariacao}
                                                className="gap-2"
                                            >
                                                <Plus className="w-4 h-4" />
                                                Adicionar Variação
                                            </Button>
                                        </div>

                                        {errors.variacoes && (
                                            <Alert className="border-red-200 bg-red-50">
                                                <AlertTriangle className="h-4 w-4 text-red-600" />
                                                <AlertDescription className="text-red-800">
                                                    {errors.variacoes}
                                                </AlertDescription>
                                            </Alert>
                                        )}

                                        {formData.variacoes.length === 0 ? (
                                            <Card className="border-dashed">
                                                <CardContent className="p-8 text-center text-gray-500">
                                                    <Palette className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                                    <p>Nenhuma variação adicionada</p>
                                                    <p className="text-sm">Clique em "Adicionar Variação" para começar</p>
                                                </CardContent>
                                            </Card>
                                        ) : (
                                            <div className="space-y-3">
                                                {formData.variacoes.map((variacao, index) => (
                                                    <Card key={variacao.id} className="border">
                                                        <CardContent className="p-0">
                                                            {/* Header da variação - sempre visível */}
                                                            <div
                                                                className="p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-50"
                                                                onClick={() => setExpandedVariacao(
                                                                    expandedVariacao === variacao.id ? null : variacao.id
                                                                )}
                                                            >
                                                                {/* Foto ou cor da variação */}
                                                                {variacao.fotos && variacao.fotos.length > 0 ? (
                                                                    <img
                                                                        src={variacao.fotos[0]}
                                                                        alt={variacao.cor || 'Variação'}
                                                                        className="w-10 h-10 rounded object-cover border shadow-sm"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    />
                                                                ) : (
                                                                    <div
                                                                        className="w-10 h-10 rounded border-2 shadow-sm flex items-center justify-center"
                                                                        style={{ backgroundColor: variacao.cor_hex || getColorHex(variacao.cor) || '#CCCCCC' }}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    >
                                                                        <ImageIcon className="w-4 h-4 text-white/50" />
                                                                    </div>
                                                                )}
                                                                <span className="flex-1 font-medium">
                                                                    {getVariacaoDisplayName(variacao)}
                                                                </span>
                                                                {variacao.fotos?.length > 0 && (
                                                                    <Badge variant="secondary" className="text-xs">
                                                                        {variacao.fotos.length} foto{variacao.fotos.length > 1 ? 's' : ''}
                                                                    </Badge>
                                                                )}
                                                                <Badge variant="outline">
                                                                    {(parseInt(variacao.estoque_cd) || 0) +
                                                                        (parseInt(variacao.estoque_ponte_branca) || 0) +
                                                                        (parseInt(variacao.estoque_carangola) || 0) +
                                                                        (parseInt(variacao.estoque_centro) || 0)} un
                                                                </Badge>
                                                                <span className="font-semibold text-green-600">
                                                                    R$ {parseFloat(variacao.preco_venda || 0).toFixed(2)}
                                                                </span>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleRemoveVariacao(index);
                                                                    }}
                                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </Button>
                                                                {expandedVariacao === variacao.id ? (
                                                                    <ChevronUp className="w-5 h-5 text-gray-400" />
                                                                ) : (
                                                                    <ChevronDown className="w-5 h-5 text-gray-400" />
                                                                )}
                                                            </div>

                                                            {/* Detalhes expandidos */}
                                                            {expandedVariacao === variacao.id && (
                                                                <div className="px-4 pb-4 pt-2 border-t bg-gray-50 space-y-4">
                                                                    {/* Cor e Tamanho */}
                                                                    <div className="grid grid-cols-2 gap-4">
                                                                        <div>
                                                                            <Label className="text-xs">Cor / Acabamento</Label>
                                                                            <FurnitureColorPicker
                                                                                value={variacao.cor}
                                                                                hexValue={variacao.cor_hex}
                                                                                onChange={(val) => handleUpdateVariacao(index, 'cor', val)}
                                                                                onHexChange={(hex) => handleUpdateVariacao(index, 'cor_hex', hex)}
                                                                                placeholder="Selecione ou digite"
                                                                            />
                                                                        </div>
                                                                        <div>
                                                                            <Label className="text-xs">Tamanho / Modelo</Label>
                                                                            <Input
                                                                                value={variacao.tamanho || ''}
                                                                                onChange={(e) => handleUpdateVariacao(index, 'tamanho', e.target.value)}
                                                                                placeholder="Ex: 6 Lugares, Grande"
                                                                            />
                                                                        </div>
                                                                    </div>

                                                                    {/* Dimensões */}
                                                                    <div>
                                                                        <Label className="text-xs flex items-center gap-1">
                                                                            <Ruler className="w-3 h-3" />
                                                                            Dimensões desta variação (cm)
                                                                        </Label>
                                                                        <div className="grid grid-cols-3 gap-3 mt-1">
                                                                            <Input
                                                                                type="number"
                                                                                value={variacao.largura || ''}
                                                                                onChange={(e) => handleUpdateVariacao(index, 'largura', e.target.value)}
                                                                                placeholder="Largura"
                                                                            />
                                                                            <Input
                                                                                type="number"
                                                                                value={variacao.altura || ''}
                                                                                onChange={(e) => handleUpdateVariacao(index, 'altura', e.target.value)}
                                                                                placeholder="Altura"
                                                                            />
                                                                            <Input
                                                                                type="number"
                                                                                value={variacao.profundidade || ''}
                                                                                onChange={(e) => handleUpdateVariacao(index, 'profundidade', e.target.value)}
                                                                                placeholder="Profund."
                                                                            />
                                                                        </div>
                                                                    </div>

                                                                    {/* Preço */}
                                                                    <div className="grid grid-cols-2 gap-4">
                                                                        <div>
                                                                            <Label className="text-xs">Preço Custo</Label>
                                                                            <Input
                                                                                type="number"
                                                                                step="0.01"
                                                                                value={variacao.preco_custo}
                                                                                onChange={(e) => handleUpdateVariacao(index, 'preco_custo', e.target.value)}
                                                                                placeholder="R$ 0,00"
                                                                            />
                                                                        </div>
                                                                        <div>
                                                                            <Label className="text-xs">Preço Venda *</Label>
                                                                            <Input
                                                                                type="number"
                                                                                step="0.01"
                                                                                value={variacao.preco_venda}
                                                                                onChange={(e) => handleUpdateVariacao(index, 'preco_venda', e.target.value)}
                                                                                placeholder="R$ 0,00"
                                                                            />
                                                                        </div>
                                                                    </div>

                                                                    {/* Estoque por Localização */}
                                                                    <div>
                                                                        <Label className="text-xs flex items-center gap-1 mb-2">
                                                                            <Package className="w-3 h-3" />
                                                                            Estoque por Localização
                                                                        </Label>
                                                                        <div className="grid grid-cols-4 gap-2">
                                                                            <div>
                                                                                <Label className="text-[10px] text-gray-500">CD</Label>
                                                                                <Input
                                                                                    type="number"
                                                                                    value={variacao.estoque_cd || ''}
                                                                                    onChange={(e) => handleUpdateVariacao(index, 'estoque_cd', e.target.value)}
                                                                                    placeholder="0"
                                                                                    className="h-8"
                                                                                />
                                                                            </div>
                                                                            <div>
                                                                                <Label className="text-[10px] text-gray-500">Ponte Branca</Label>
                                                                                <Input
                                                                                    type="number"
                                                                                    value={variacao.estoque_ponte_branca || ''}
                                                                                    onChange={(e) => handleUpdateVariacao(index, 'estoque_ponte_branca', e.target.value)}
                                                                                    placeholder="0"
                                                                                    className="h-8"
                                                                                />
                                                                            </div>
                                                                            <div>
                                                                                <Label className="text-[10px] text-gray-500">Carangola</Label>
                                                                                <Input
                                                                                    type="number"
                                                                                    value={variacao.estoque_carangola || ''}
                                                                                    onChange={(e) => handleUpdateVariacao(index, 'estoque_carangola', e.target.value)}
                                                                                    placeholder="0"
                                                                                    className="h-8"
                                                                                />
                                                                            </div>
                                                                            <div>
                                                                                <Label className="text-[10px] text-gray-500">Centro</Label>
                                                                                <Input
                                                                                    type="number"
                                                                                    value={variacao.estoque_centro || ''}
                                                                                    onChange={(e) => handleUpdateVariacao(index, 'estoque_centro', e.target.value)}
                                                                                    placeholder="0"
                                                                                    className="h-8"
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Fotos da Variação */}
                                                                    <div>
                                                                        <Label className="text-xs flex items-center gap-1 mb-2">
                                                                            <ImageIcon className="w-3 h-3" />
                                                                            Fotos desta variação
                                                                        </Label>

                                                                        {/* Upload de fotos */}
                                                                        <label className="cursor-pointer">
                                                                            <input
                                                                                type="file"
                                                                                multiple
                                                                                accept="image/*"
                                                                                onChange={async (e) => {
                                                                                    const files = Array.from(e.target.files);
                                                                                    if (files.length === 0) return;
                                                                                    try {
                                                                                        const urls = await Promise.all(
                                                                                            files.map(file => base44.storage.uploadFile(file))
                                                                                        );
                                                                                        const currentPhotos = variacao.fotos || [];
                                                                                        handleUpdateVariacao(index, 'fotos', [...currentPhotos, ...urls]);
                                                                                        toast.success(`${files.length} foto(s) enviada(s)`);
                                                                                    } catch (err) {
                                                                                        toast.error('Erro ao enviar fotos');
                                                                                    }
                                                                                }}
                                                                                className="hidden"
                                                                            />
                                                                            <div className="border-2 border-dashed rounded-lg p-4 text-center hover:bg-gray-100 transition-colors">
                                                                                <Upload className="w-6 h-6 mx-auto mb-1 text-gray-400" />
                                                                                <p className="text-sm text-gray-600">Clique para adicionar fotos</p>
                                                                            </div>
                                                                        </label>

                                                                        {/* Grid de fotos da variação */}
                                                                        {variacao.fotos && variacao.fotos.length > 0 && (
                                                                            <div className="grid grid-cols-4 gap-2 mt-3">
                                                                                {variacao.fotos.map((foto, fotoIndex) => (
                                                                                    <div key={fotoIndex} className="relative group aspect-square">
                                                                                        <img
                                                                                            src={foto}
                                                                                            alt={`Foto ${fotoIndex + 1}`}
                                                                                            className="w-full h-full object-cover rounded"
                                                                                        />
                                                                                        {fotoIndex === 0 && (
                                                                                            <Badge className="absolute top-1 left-1 bg-green-500 text-[10px] px-1">Principal</Badge>
                                                                                        )}
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => {
                                                                                                const newFotos = variacao.fotos.filter((_, i) => i !== fotoIndex);
                                                                                                handleUpdateVariacao(index, 'fotos', newFotos);
                                                                                            }}
                                                                                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                                        >
                                                                                            <X className="w-3 h-3" />
                                                                                        </button>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </CardContent>
                                                    </Card>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Se NÃO tem variações - Item único */}
                                {!formData.temVariacoes && (
                                    <div className="space-y-6">
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="text-base flex items-center gap-2">
                                                    <Ruler className="w-4 h-4" />
                                                    Dimensões
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                                <div className="grid grid-cols-3 gap-4">
                                                    <div>
                                                        <Label>Largura (cm)</Label>
                                                        <Input
                                                            type="number"
                                                            value={formData.largura}
                                                            onChange={(e) => handleChange('largura', e.target.value)}
                                                            placeholder="Ex: 180"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label>Altura (cm)</Label>
                                                        <Input
                                                            type="number"
                                                            value={formData.altura}
                                                            onChange={(e) => handleChange('altura', e.target.value)}
                                                            placeholder="Ex: 90"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label>Profundidade (cm)</Label>
                                                        <Input
                                                            type="number"
                                                            value={formData.profundidade}
                                                            onChange={(e) => handleChange('profundidade', e.target.value)}
                                                            placeholder="Ex: 85"
                                                        />
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card className="border-green-200">
                                            <CardHeader>
                                                <CardTitle className="text-base flex items-center gap-2">
                                                    <DollarSign className="w-4 h-4 text-green-600" />
                                                    Preços e Custos
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                                {/* Preços principais */}
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <Label className="flex items-center gap-2">
                                                            Preço de Custo (Tabela)
                                                            <span className="text-xs text-gray-500 font-normal">Preço fixo do fornecedor</span>
                                                        </Label>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            value={formData.preco_custo_tabela}
                                                            onChange={(e) => handleChange('preco_custo_tabela', e.target.value)}
                                                            placeholder="R$ 0,00"
                                                            className="mt-1"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label>Preço de Venda *</Label>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            value={formData.preco_venda}
                                                            onChange={(e) => handleChange('preco_venda', e.target.value)}
                                                            placeholder="R$ 0,00"
                                                            className={cn("mt-1", errors.preco_venda && 'border-red-500')}
                                                        />
                                                        {errors.preco_venda && <p className="text-xs text-red-500 mt-1">{errors.preco_venda}</p>}

                                                        {suggestedPrice > 0 && (
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={applySuggestedMarkup}
                                                                className="mt-1 text-green-600 hover:text-green-700"
                                                            >
                                                                Usar sugestão: R$ {suggestedPrice.toFixed(2)}
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Estoque */}
                                                <div className="pt-2 border-t">
                                                    <Label>Quantidade em Estoque</Label>
                                                    <Input
                                                        type="number"
                                                        value={formData.quantidade_estoque}
                                                        onChange={(e) => handleChange('quantidade_estoque', e.target.value)}
                                                        placeholder="0"
                                                        className="mt-1 w-40"
                                                    />
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* PASSO 3: Fotos */}
                        {currentStep === 3 && (
                            <div className="space-y-6">
                                <div className="text-center mb-6">
                                    <h3 className="text-lg font-semibold text-gray-900">Fotos do Produto</h3>
                                    <p className="text-sm text-gray-500">
                                        {formData.temVariacoes
                                            ? 'Adicione fotos gerais do produto (fotos específicas podem ser adicionadas em cada variação)'
                                            : 'Adicione imagens para o produto'}
                                    </p>
                                </div>

                                {/* Upload manual */}
                                <div>
                                    <Label className="mb-2 block">Upload Manual</Label>
                                    <label className="cursor-pointer">
                                        <input
                                            type="file"
                                            multiple
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            className="hidden"
                                            disabled={uploadingImages}
                                        />
                                        <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-gray-50 transition-colors">
                                            {uploadingImages ? (
                                                <Loader2 className="w-8 h-8 mx-auto animate-spin text-green-600" />
                                            ) : (
                                                <>
                                                    <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                                                    <p className="text-gray-600 font-medium">Clique para fazer upload</p>
                                                    <p className="text-sm text-gray-400">ou arraste e solte</p>
                                                </>
                                            )}
                                        </div>
                                    </label>
                                </div>

                                {/* Adicionar por URL */}
                                <div>
                                    <Label className="mb-2 block">Ou adicione por URL</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            value={fotoUrlInput}
                                            onChange={(e) => setFotoUrlInput(e.target.value)}
                                            placeholder="https://exemplo.com/foto.jpg"
                                            className="flex-1"
                                        />
                                        <Button type="button" onClick={handleAddFotoUrl} variant="outline">
                                            <LinkIcon className="w-4 h-4 mr-2" />
                                            Adicionar
                                        </Button>
                                    </div>
                                </div>

                                {/* Grid de fotos */}
                                {formData.fotos.length > 0 && (
                                    <div>
                                        <Label className="mb-2 block">Fotos adicionadas ({formData.fotos.length})</Label>
                                        <div className="grid grid-cols-4 gap-3">
                                            {formData.fotos.map((foto, index) => (
                                                <div key={index} className="relative group aspect-square">
                                                    <img
                                                        src={foto}
                                                        alt={`Foto ${index + 1}`}
                                                        className="w-full h-full object-cover rounded-lg"
                                                    />
                                                    {index === 0 && (
                                                        <Badge className="absolute top-1 left-1 bg-green-500">Principal</Badge>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveFoto(index)}
                                                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* PASSO 4: Revisão */}
                        {currentStep === 4 && (
                            <div className="space-y-6">
                                <div className="text-center mb-6">
                                    <h3 className="text-lg font-semibold text-gray-900">Revisão Final</h3>
                                    <p className="text-sm text-gray-500">Confirme as informações antes de salvar</p>
                                </div>

                                <div className="grid md:grid-cols-2 gap-6">
                                    {/* Identificação */}
                                    <Card>
                                        <CardContent className="p-4">
                                            <h4 className="font-semibold mb-3 flex items-center gap-2">
                                                <Package className="w-4 h-4" />
                                                Identificação
                                            </h4>
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">Nome:</span>
                                                    <span className="font-medium">{formData.nome}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">Categoria:</span>
                                                    <span>{formData.categoria}</span>
                                                </div>
                                                {formData.ambiente && (
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">Ambiente:</span>
                                                        <span>{formData.ambiente}</span>
                                                    </div>
                                                )}
                                                {formData.fornecedor_nome && (
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">Fornecedor:</span>
                                                        <span>{formData.fornecedor_nome}</span>
                                                    </div>
                                                )}
                                                {formData.material && (
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">Material:</span>
                                                        <span>{formData.material}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Variações/Preço */}
                                    <Card>
                                        <CardContent className="p-4">
                                            <h4 className="font-semibold mb-3 flex items-center gap-2">
                                                <Palette className="w-4 h-4" />
                                                {formData.temVariacoes ? `Variações (${formData.variacoes.length})` : 'Preço e Dimensões'}
                                            </h4>
                                            {formData.temVariacoes ? (
                                                <div className="space-y-2">
                                                    {formData.variacoes.map((v, i) => (
                                                        <div key={i} className="flex items-center gap-2 text-sm p-2 bg-gray-50 rounded">
                                                            <div
                                                                className="w-4 h-4 rounded-full border"
                                                                style={{ backgroundColor: v.cor_hex }}
                                                            />
                                                            <span className="flex-1">
                                                                {getVariacaoDisplayName(v)}
                                                            </span>
                                                            <span className="text-gray-500">{v.estoque}un</span>
                                                            <span className="font-medium text-green-600">
                                                                R$ {parseFloat(v.preco_venda || 0).toFixed(2)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="space-y-2 text-sm">
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">Preço de Venda:</span>
                                                        <span className="font-medium text-green-600">
                                                            R$ {parseFloat(formData.preco_venda || 0).toFixed(2)}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">Estoque:</span>
                                                        <span>{formData.quantidade_estoque || 0} unidades</span>
                                                    </div>
                                                    {(formData.largura || formData.altura || formData.profundidade) && (
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-500">Dimensões:</span>
                                                            <span>
                                                                {formData.largura || '-'} x {formData.altura || '-'} x {formData.profundidade || '-'} cm
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* Fotos */}
                                    <Card className="md:col-span-2">
                                        <CardContent className="p-4">
                                            <h4 className="font-semibold mb-3 flex items-center gap-2">
                                                <ImageIcon className="w-4 h-4" />
                                                Fotos ({formData.fotos.length})
                                            </h4>
                                            {formData.fotos.length > 0 ? (
                                                <div className="flex gap-2 flex-wrap">
                                                    {formData.fotos.slice(0, 6).map((foto, i) => (
                                                        <img
                                                            key={i}
                                                            src={foto}
                                                            alt={`Foto ${i + 1}`}
                                                            className="w-20 h-20 object-cover rounded"
                                                        />
                                                    ))}
                                                    {formData.fotos.length > 6 && (
                                                        <div className="w-20 h-20 bg-gray-100 rounded flex items-center justify-center text-gray-500 text-sm">
                                                            +{formData.fotos.length - 6}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <p className="text-gray-400 italic text-sm">Nenhuma foto adicionada</p>
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer com navegação */}
                    <div className="px-6 py-4 border-t bg-gray-50 shrink-0">
                        <div className="flex justify-between items-center">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={currentStep === 1 ? onClose : handlePrev}
                                disabled={isLoading}
                            >
                                {currentStep === 1 ? (
                                    'Cancelar'
                                ) : (
                                    <>
                                        <ChevronLeft className="w-4 h-4 mr-1" />
                                        Voltar
                                    </>
                                )}
                            </Button>

                            {currentStep < STEPS.length ? (
                                <Button
                                    type="button"
                                    onClick={handleNext}
                                    className="bg-green-600 hover:bg-green-700"
                                >
                                    Próximo
                                    <ChevronRight className="w-4 h-4 ml-1" />
                                </Button>
                            ) : (
                                <Button
                                    type="button"
                                    onClick={handleSubmit}
                                    disabled={isLoading}
                                    className="bg-green-600 hover:bg-green-700"
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
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog >
        </>
    );
}
