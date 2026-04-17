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
    Warehouse
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import { CATEGORIAS, AMBIENTES, MATERIAIS, TIPOS_ENTREGA, CAMPOS_ESTOQUE_LOJA, obterCampoEstoqueDaLoja } from '@/constants/productConstants';
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
import ProdutoHistoricoTab from './ProdutoHistoricoTab';

const VIEW_OPTIONS = [
    { id: 'ficha', name: 'Ficha do Produto', icon: Package },
    { id: 'historico', name: 'Histórico', icon: ClipboardCheck },
];

const FIELD_TO_SECTION = {
    ncm: 'secao-fiscal-logistico',
    cest: 'secao-fiscal-logistico',
    cfop: 'secao-fiscal-logistico',
    origem_mercadoria: 'secao-fiscal-logistico',
    peso_bruto: 'secao-fiscal-logistico',
    peso_liquido: 'secao-fiscal-logistico',
    altura_embalagem: 'secao-fiscal-logistico',
    largura_embalagem: 'secao-fiscal-logistico',
    profundidade_embalagem: 'secao-fiscal-logistico',
    preco_venda: 'secao-financeiro-estoque',
    valor_montagem: 'secao-financeiro-estoque',
    preco_custo_tabela: 'secao-financeiro-estoque',
    estoque_cd: 'secao-financeiro-estoque',
    estoque_minimo: 'secao-financeiro-estoque',
    estoque_ideal: 'secao-financeiro-estoque',
    largura: 'secao-caracteristicas',
    altura: 'secao-caracteristicas',
    profundidade: 'secao-caracteristicas',
    cor: 'secao-caracteristicas',
    material: 'secao-caracteristicas',
    nome: 'secao-identificacao',
    codigo_barras: 'secao-identificacao',
    categoria: 'secao-identificacao',
    fornecedor_id: 'secao-identificacao',
    fotos: 'secao-fotos'
};

const ESTOQUE_LOJA_FIELDS = Object.values(CAMPOS_ESTOQUE_LOJA).filter((field) => field !== 'estoque_cd');

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
    unidade: 'UN', // Unidade comercial: UN, PC, CX, KG, MT
    origem_mercadoria: '0', // 0=Nacional, 1=Estrangeira importação direta, etc
    // Override fiscal por produto (vazio = usa padrão da org)
    csosn: '',
    cst_icms: '',
    cst_pis: '',
    cst_cofins: '',
    aliquota_icms: '',
    percentual_tributos: '',
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
    valor_montagem: '',
    // Dimensões do produto
    largura: '',
    altura: '',
    profundidade: '',
    // Cor do produto (único, sem variações)
    cor: '',
    cor_hex: '',
    // Estoque
    estoque_cd: '',
    ...ESTOQUE_LOJA_FIELDS.reduce((acc, field) => {
        acc[field] = '';
        return acc;
    }, {}),
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
    focusField = null,
    readOnly = false
}) {
    const [formData, setFormData] = useState(INITIAL_FORM_DATA);
    const [errors, setErrors] = useState({});
    const [duplicatas, setDuplicatas] = useState([]);
    const [uploadingImages, setUploadingImages] = useState(false);
    const [fotoUrlInput, setFotoUrlInput] = useState('');
    const [activeView, setActiveView] = useState('ficha');

    // Multi-Tenant: Carrega lojas dinâmicas e configurações
    const { data: lojas = [] } = useLojas();
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

    const coresCatalogo = useMemo(() => {
        const setCores = new Set();
        (produtosExistentes || []).forEach((p) => {
            const corRaw = String(p?.cor || '').trim();
            if (!corRaw) return;
            corRaw
                .split('/')
                .map((c) => c.trim())
                .filter(Boolean)
                .forEach((c) => setCores.add(c));
        });
        return Array.from(setCores).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    }, [produtosExistentes]);

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
                valor_montagem: produto.valor_montagem?.toString() || '',
                // Estoque
                estoque_cd: produto.estoque_cd?.toString() || '',
                ...Object.fromEntries(
                    ESTOQUE_LOJA_FIELDS.map((field) => [field, produto[field]?.toString() || ''])
                ),
                quantidade_estoque: produto.quantidade_estoque?.toString() || '',
                estoque_minimo: produto.estoque_minimo?.toString() || '',
                estoque_ideal: produto.estoque_ideal?.toString() || '',
                largura: produto.largura?.toString() || '',
                altura: produto.altura?.toString() || '',
                profundidade: produto.profundidade?.toString() || '',
                cfop: produto.cfop || '',
                unidade: produto.unidade || 'UN',
                origem_mercadoria: produto.origem_mercadoria || produto.origem || '0',
                peso_bruto: produto.peso_bruto?.toString() || '',
                peso_liquido: produto.peso_liquido?.toString() || '',
                altura_embalagem: produto.altura_embalagem?.toString() || '',
                largura_embalagem: produto.largura_embalagem?.toString() || '',
                profundidade_embalagem: produto.profundidade_embalagem?.toString() || '',
                fotos: produto.fotos || [],
                variacoes: produto.variacoes || [],
            });
            setErrors({});
            setDuplicatas([]);
            setActiveView('ficha');
        } else if (!produto && isOpen) {
            setFormData(INITIAL_FORM_DATA);
            setErrors({});
            setDuplicatas([]);
            setActiveView('ficha');
        }
    }, [produto, isOpen]);

    const focusFieldInForm = (field) => {
        const target = document.getElementById(field) || document.querySelector(`[name="${field}"]`);
        if (!target) return false;

        target.focus();
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('ring-2', 'ring-red-500', 'ring-offset-2');

        setTimeout(() => {
            target.classList.remove('ring-2', 'ring-red-500', 'ring-offset-2');
        }, 3000);

        return true;
    };

    const scrollToSection = (sectionId) => {
        const target = document.getElementById(sectionId);
        if (!target) return false;

        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        target.classList.add('ring-2', 'ring-red-500', 'ring-offset-2', 'rounded-xl');

        setTimeout(() => {
            target.classList.remove('ring-2', 'ring-red-500', 'ring-offset-2', 'rounded-xl');
        }, 3000);

        return true;
    };

    // Smart Validation: Foca no campo com erro dentro da ficha única
    useEffect(() => {
        if (readOnly) return;
        if (isOpen && focusField) {
            setActiveView('ficha');
            setTimeout(() => {
                const focused = focusFieldInForm(focusField);
                if (!focused && FIELD_TO_SECTION[focusField]) {
                    scrollToSection(FIELD_TO_SECTION[focusField]);
                }
            }, 300);
        }
    }, [isOpen, focusField, readOnly]);

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
            fornecedor_id: value,
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
            setActiveView('ficha');
            const firstErrorField = Object.keys(newErrors)[0];
            setTimeout(() => {
                const focused = focusFieldInForm(firstErrorField);
                if (!focused && FIELD_TO_SECTION[firstErrorField]) {
                    scrollToSection(FIELD_TO_SECTION[firstErrorField]);
                }
            }, 100);
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
        if (readOnly || !onSave) return;
        if (!validateForm()) return;

        // Calcula estoque total das lojas
        const estoqueCd = parseInt(formData.estoque_cd) || 0;
        const estoquePorLoja = ESTOQUE_LOJA_FIELDS.reduce((acc, field) => {
            acc[field] = parseInt(formData[field]) || 0;
            return acc;
        }, {});
        const estoqueTotal = estoqueCd + Object.values(estoquePorLoja).reduce((sum, value) => sum + value, 0);

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
            unidade: formData.unidade || 'UN',
            origem_mercadoria: formData.origem_mercadoria || '0',
            csosn: formData.csosn || null,
            cst_icms: formData.cst_icms || null,
            cst_pis: formData.cst_pis || null,
            cst_cofins: formData.cst_cofins || null,
            aliquota_icms: formData.aliquota_icms ? parseFloat(formData.aliquota_icms) : null,
            percentual_tributos: formData.percentual_tributos ? parseFloat(formData.percentual_tributos) : null,
            peso_bruto: formData.peso_bruto ? parseFloat(formData.peso_bruto) : null,
            peso_liquido: formData.peso_liquido ? parseFloat(formData.peso_liquido) : null,
            altura_embalagem: formData.altura_embalagem ? parseFloat(formData.altura_embalagem) : null,
            largura_embalagem: formData.largura_embalagem ? parseFloat(formData.largura_embalagem) : null,
            profundidade_embalagem: formData.profundidade_embalagem ? parseFloat(formData.profundidade_embalagem) : null,
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
            valor_montagem: formData.valor_montagem ? parseFloat(formData.valor_montagem) : null,
            quantidade_estoque: estoqueTotal,
            estoque_cd: estoqueCd,
            ...estoquePorLoja,
            estoque_minimo: formData.estoque_minimo ? parseInt(formData.estoque_minimo) : 0,
            estoque_ideal: formData.estoque_ideal ? parseInt(formData.estoque_ideal) : 0,
            cor: formData.cor || null,
            cor_hex: formData.cor_hex || null,
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
                            {readOnly ? 'Ficha do Produto' : (produto ? 'Editar Produto' : 'Cadastrar Novo Produto')}
                        </DialogTitle>

                        {/* Navegação principal */}
                        <div className="flex items-center gap-1 mt-4 overflow-x-auto no-scrollbar pb-1">
                            {VIEW_OPTIONS.map((view) => {
                                const Icon = view.icon;
                                const isActive = activeView === view.id;

                                return (
                                    <button
                                        key={view.id}
                                        onClick={() => setActiveView(view.id)}
                                        className={cn(
                                            "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                                            isActive
                                                ? "bg-green-600 text-white shadow-md shadow-green-200"
                                                : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                                        )}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {view.name}
                                    </button>
                                );
                            })}
                        </div>
                    </DialogHeader>

                    {/* Conteúdo scrollável */}
                    <div className="flex-1 overflow-y-auto px-6 py-4 bg-gray-50/30">
                        {activeView === 'ficha' && (
                            <fieldset disabled={readOnly} className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                                <Card id="secao-identificacao" className="scroll-mt-4">
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
                                                            onBlur={handleNomeBlur}
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
                                                    <SelectTrigger id="fornecedor_id">
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
                                                    <SelectTrigger id="categoria" className={errors.categoria ? 'border-red-500' : ''}>
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
                                                    <SelectTrigger id="ambiente">
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

                                <Card id="secao-caracteristicas" className="scroll-mt-4">
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
                                                    customOptions={coresCatalogo}
                                                    placeholder="Selecione a cor por nomenclatura"
                                                />
                                            </div>
                                            <div>
                                                <Label>Material Principal</Label>
                                                <Select
                                                    value={formData.material}
                                                    onValueChange={(value) => handleChange('material', value)}
                                                >
                                                    <SelectTrigger id="material">
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
                                                    <SelectTrigger id="tipo_entrega_padrao">
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

                                <Card id="secao-financeiro-estoque" className="border-green-200 scroll-mt-4">
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
                                            <div>
                                                <Label>Valor de Montagem</Label>
                                                <Input
                                                    id="valor_montagem"
                                                    type="number"
                                                    step="0.01"
                                                    value={formData.valor_montagem}
                                                    onChange={(e) => handleChange('valor_montagem', e.target.value)}
                                                    placeholder="R$ 0,00"
                                                />
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
                                                    ESTOQUE_LOJA_FIELDS.reduce((sum, field) => sum + (parseInt(formData[field]) || 0), 0)
                                                }
                                            </Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <Alert className="bg-blue-50 border-blue-200">
                                            <AlertTriangle className="h-4 w-4 text-blue-600" />
                                            <AlertDescription className="text-sm text-blue-800 ml-2">
                                                Movimentações de estoque ocorrem via Transferência, Inventário, Recebimento de Compras ou Venda. 
                                                Veja o histórico de movimentações na aba Histórico.
                                            </AlertDescription>
                                        </Alert>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-gray-50 p-2 rounded-lg border">
                                                <Label className="text-xs text-gray-500">Depósito / CD</Label>
                                                <Input
                                                    id="estoque_cd"
                                                    type="number"
                                                    value={formData.estoque_cd}
                                                    disabled={true}
                                                    className="h-8 text-sm bg-gray-100 cursor-not-allowed"
                                                />
                                            </div>
                                            {(lojas || []).map(loja => {
                                                const field = obterCampoEstoqueDaLoja(loja);

                                                if (!field || field === 'estoque_cd' || !(field in formData)) return null;
                                                return (
                                                    <div key={loja.id} className="p-2 rounded-lg border">
                                                        <Label className="text-xs text-gray-500">{loja.nome}</Label>
                                                        <Input
                                                            type="number"
                                                            value={formData[field]}
                                                            disabled={true}
                                                            className="h-8 text-sm bg-gray-100 cursor-not-allowed"
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

                                <Card id="secao-fiscal-logistico" className="scroll-mt-4">
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
                                            <div>
                                                <Label>Unidade Comercial</Label>
                                                <Select
                                                    value={formData.unidade}
                                                    onValueChange={(value) => handleChange('unidade', value)}
                                                >
                                                    <SelectTrigger id="unidade">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="UN">UN - Unidade</SelectItem>
                                                        <SelectItem value="PC">PC - Peça</SelectItem>
                                                        <SelectItem value="CX">CX - Caixa</SelectItem>
                                                        <SelectItem value="KG">KG - Quilograma</SelectItem>
                                                        <SelectItem value="MT">MT - Metro</SelectItem>
                                                        <SelectItem value="JG">JG - Jogo</SelectItem>
                                                        <SelectItem value="CON">CON - Conjunto</SelectItem>
                                                    </SelectContent>
                                                </Select>
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

                                        {/* Override fiscal por produto */}
                                        <div className="border-t pt-4 mt-4">
                                            <p className="text-sm text-gray-500 mb-3">Tributação específica do produto (vazio = usa padrão da organização)</p>
                                            <div className="grid md:grid-cols-3 gap-4">
                                                <div>
                                                    <Label>CSOSN (Simples Nacional)</Label>
                                                    <Select
                                                        value={formData.csosn || '_empty'}
                                                        onValueChange={(v) => handleChange('csosn', v === '_empty' ? '' : v)}
                                                    >
                                                        <SelectTrigger><SelectValue placeholder="Padrão da org" /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="_empty">Padrão da org</SelectItem>
                                                            <SelectItem value="102">102 - Tributada sem crédito</SelectItem>
                                                            <SelectItem value="103">103 - Isenção (faixa SN)</SelectItem>
                                                            <SelectItem value="300">300 - Imune</SelectItem>
                                                            <SelectItem value="400">400 - Não tributada</SelectItem>
                                                            <SelectItem value="500">500 - ICMS cobrado por ST</SelectItem>
                                                            <SelectItem value="900">900 - Outros</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div>
                                                    <Label>CST PIS</Label>
                                                    <Select
                                                        value={formData.cst_pis || '_empty'}
                                                        onValueChange={(v) => handleChange('cst_pis', v === '_empty' ? '' : v)}
                                                    >
                                                        <SelectTrigger><SelectValue placeholder="Padrão da org" /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="_empty">Padrão da org</SelectItem>
                                                            <SelectItem value="01">01 - Tributável</SelectItem>
                                                            <SelectItem value="04">04 - Monofásica</SelectItem>
                                                            <SelectItem value="06">06 - Alíquota zero</SelectItem>
                                                            <SelectItem value="49">49 - Outras saídas</SelectItem>
                                                            <SelectItem value="99">99 - Outras operações</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div>
                                                    <Label>CST COFINS</Label>
                                                    <Select
                                                        value={formData.cst_cofins || '_empty'}
                                                        onValueChange={(v) => handleChange('cst_cofins', v === '_empty' ? '' : v)}
                                                    >
                                                        <SelectTrigger><SelectValue placeholder="Padrão da org" /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="_empty">Padrão da org</SelectItem>
                                                            <SelectItem value="01">01 - Tributável</SelectItem>
                                                            <SelectItem value="04">04 - Monofásica</SelectItem>
                                                            <SelectItem value="06">06 - Alíquota zero</SelectItem>
                                                            <SelectItem value="49">49 - Outras saídas</SelectItem>
                                                            <SelectItem value="99">99 - Outras operações</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div>
                                                    <Label>Alíquota ICMS (%)</Label>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        value={formData.aliquota_icms}
                                                        onChange={(e) => handleChange('aliquota_icms', e.target.value)}
                                                        placeholder="Padrão da org"
                                                    />
                                                </div>
                                                <div>
                                                    <Label>% Tributos Aprox.</Label>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        value={formData.percentual_tributos}
                                                        onChange={(e) => handleChange('percentual_tributos', e.target.value)}
                                                        placeholder="Padrão da org"
                                                    />
                                                    <p className="text-xs text-gray-400 mt-1">Lei 12.741/2012</p>
                                                </div>
                                            </div>
                                        </div>

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

                                <Card id="secao-fotos" className="scroll-mt-4">
                                    <CardHeader>
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <ImageIcon className="w-4 h-4 text-amber-600" />
                                            Fotos do Produto
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
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
                                    </CardContent>
                                </Card>
                            </fieldset>
                        )}

                        {/* SEÇÃO: HISTÓRICO */}
                        {activeView === 'historico' && produto?.id && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <ClipboardCheck className="w-4 h-4 text-blue-600" />
                                            Histórico de Movimentações
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <ProdutoHistoricoTab produtoId={produto.id} />
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {/* SEÇÃO: HISTÓRICO - Sem produto */}
                        {activeView === 'historico' && !produto?.id && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <ClipboardCheck className="w-4 h-4 text-blue-600" />
                                            Histórico de Movimentações
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="text-center text-gray-500 py-12">
                                        <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                                        <p>Salve o produto para visualizar o histórico de movimentações.</p>
                                    </CardContent>
                                </Card>
                            </div>
                        )}
                    </div>

                    {/* Footer fixo */}
                    <div className="px-6 py-4 border-t bg-white shrink-0">
                        <div className={cn('flex items-center', readOnly ? 'justify-end' : 'justify-between')}>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={onClose}
                                disabled={isLoading}
                            >
                                {readOnly ? 'Fechar' : 'Cancelar'}
                            </Button>

                            {!readOnly && (
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
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
