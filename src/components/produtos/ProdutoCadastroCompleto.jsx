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
    estoque_minimo: '5',
    estoque_ideal: '10',
    fotos: [],
    codigo_barras: '',
    ativo: true,
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
            // Validação para produto único
            const precoVenda = parseFloat(formData.preco_venda);
            if (!precoVenda || precoVenda <= 0) {
                newErrors.preco_venda = 'Preço de venda deve ser maior que zero';
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
            estoque_minimo: parseInt(formData.estoque_minimo) || 5,
            estoque_ideal: parseInt(formData.estoque_ideal) || 10,
            cor: formData.cor || null,
            cor_hex: formData.cor_hex || null,
            variacoes: [], // Sempre vazio agora
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

                                    {/* Modelo / Referência */}
                                    <div className="md:col-span-2">
                                        <Label htmlFor="modelo_referencia">Modelo / Referência</Label>
                                        <Input
                                            id="modelo_referencia"
                                            value={formData.modelo_referencia}
                                            onChange={(e) => handleChange('modelo_referencia', e.target.value)}
                                            placeholder="Ex: REF-1234, Premium, etc"
                                        />
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

                        {/* PASSO 2: Detalhes do Produto */}
                        {currentStep === 2 && (
                            <div className="space-y-6">
                                <div className="text-center mb-6">
                                    <h3 className="text-lg font-semibold text-gray-900">Detalhes do Produto</h3>
                                    <p className="text-sm text-gray-500">Cores, dimensões e valores</p>
                                </div>

                                {/* Cor e Acabamento */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <Palette className="w-4 h-4" />
                                            Cor e Acabamento
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <FurnitureColorPicker
                                            value={formData.cor}
                                            hexValue={formData.cor_hex}
                                            onChange={(val) => handleChange('cor', val)}
                                            onHexChange={(hex) => handleChange('cor_hex', hex)}
                                            placeholder="Selecione ou digite a cor principal"
                                        />
                                    </CardContent>
                                </Card>

                                <div className="grid md:grid-cols-2 gap-6">
                                    {/* Dimensões */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-base flex items-center gap-2">
                                                <Ruler className="w-4 h-4" />
                                                Dimensões
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="space-y-3">
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

                                    {/* Preços e Estoque */}
                                    <Card className="border-green-200">
                                        <CardHeader>
                                            <CardTitle className="text-base flex items-center gap-2">
                                                <DollarSign className="w-4 h-4 text-green-600" />
                                                Preços e Estoque
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            {showFinancials && (
                                                <div>
                                                    <Label className="flex items-center gap-2">
                                                        Preço de Custo
                                                        <span className="text-xs text-gray-500 font-normal">(Tabela)</span>
                                                    </Label>
                                                    <Input
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
                                                        Sugestão: R$ {suggestedPrice.toFixed(2)}
                                                    </Button>
                                                )}
                                            </div>

                                            <div className="pt-4 border-t space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <Label className="font-semibold text-gray-900">Distribuição de Estoque</Label>
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

                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <Label className="text-xs text-gray-500">Depósito / CD</Label>
                                                        <Input
                                                            type="number"
                                                            value={formData.estoque_cd}
                                                            onChange={(e) => handleChange('estoque_cd', e.target.value)}
                                                            placeholder="0"
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
                                                            <div key={loja.id}>
                                                                <Label className="text-xs text-gray-500">{loja.nome}</Label>
                                                                <Input
                                                                    type="number"
                                                                    value={formData[field]}
                                                                    onChange={(e) => handleChange(field, e.target.value)}
                                                                    placeholder="0"
                                                                />
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                <div className="grid grid-cols-2 gap-3 pt-2">
                                                    <div>
                                                        <Label>Estoque Mínimo</Label>
                                                        <Input
                                                            type="number"
                                                            value={formData.estoque_minimo}
                                                            onChange={(e) => handleChange('estoque_minimo', e.target.value)}
                                                            placeholder="5"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label>Estoque Ideal</Label>
                                                        <Input
                                                            type="number"
                                                            value={formData.estoque_ideal}
                                                            onChange={(e) => handleChange('estoque_ideal', e.target.value)}
                                                            placeholder="10"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        )}

                        {/* PASSO 3: Fotos */}
                        {currentStep === 3 && (
                            <div className="space-y-6">
                                <div className="text-center mb-6">
                                    <h3 className="text-lg font-semibold text-gray-900">Fotos do Produto</h3>
                                    <p className="text-sm text-gray-500">
                                        Adicione imagens para o produto
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

                                    {/* Detalhes do Produto */}
                                    <Card>
                                        <CardContent className="p-4">
                                            <h4 className="font-semibold mb-3 flex items-center gap-2">
                                                <Palette className="w-4 h-4" />
                                                Detalhes do Produto
                                            </h4>
                                            <div className="space-y-4 text-sm">
                                                {(formData.cor || formData.cor_hex) && (
                                                    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                                                        <div
                                                            className="w-6 h-6 rounded-full border shadow-sm"
                                                            style={{ backgroundColor: formData.cor_hex || '#ccc' }}
                                                        />
                                                        <span className="font-medium">{formData.cor}</span>
                                                    </div>
                                                )}

                                                <div className="space-y-2">
                                                    <div className="flex justify-between items-center text-lg">
                                                        <span className="text-gray-500 text-sm">Preço de Venda:</span>
                                                        <span className="font-bold text-green-600">
                                                            R$ {parseFloat(formData.preco_venda || 0).toFixed(2)}
                                                        </span>
                                                    </div>

                                                    <div className="flex justify-between border-t pt-2">
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
                                            </div>
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
