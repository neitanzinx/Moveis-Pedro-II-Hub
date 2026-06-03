import React, { useRef, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useReactToPrint } from "react-to-print";
import EtiquetaImpressao from "./EtiquetaImpressao";
import { Printer, Plus, Minus, Search, Trash2, ArrowRight, Loader2, Upload, Palette } from "lucide-react";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import BuscaProdutoAvancada from "../vendas/BuscaProdutoAvancada";

export default function GeradorEtiquetasModal({
    isOpen,
    onClose,
    produtosPreSelecionados = [],
    user
}) {
    const componentRef = useRef(null);
    const { organization, refreshTenant } = useTenant();

    // Lista de itens a serem impressos: { produto, quantidade }
    const [itensImpressao, setItensImpressao] = useState(
        produtosPreSelecionados.map(p => ({ produto: p, quantidade: 1 }))
    );

    const [logoOption, setLogoOption] = useState("default");
    const [logoCustomizadaUrl, setLogoCustomizadaUrl] = useState("");
    const [isSavingLogo, setIsSavingLogo] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    // Carregar configurações de logo
    React.useEffect(() => {
        if (!isOpen || !organization) return;

        const dbOption = organization.logo_etiqueta_option;
        const dbUrl = organization.logo_etiqueta_url;

        const localOption = localStorage.getItem(`etiqueta_logo_option_${organization.id}`);
        const localUrl = localStorage.getItem(`etiqueta_logo_url_${organization.id}`);

        if (dbOption) {
            setLogoOption(dbOption);
        } else if (localOption) {
            setLogoOption(localOption);
        } else {
            setLogoOption("default");
        }

        if (dbUrl) {
            setLogoCustomizadaUrl(dbUrl);
        } else if (localUrl) {
            setLogoCustomizadaUrl(localUrl);
        } else {
            setLogoCustomizadaUrl("");
        }
    }, [isOpen, organization]);

    const handleSaveLogoConfig = async (option, customUrl) => {
        if (!organization) return;
        setIsSavingLogo(true);
        try {
            const { error } = await supabase
                .from('organizations')
                .update({
                    logo_etiqueta_option: option,
                    logo_etiqueta_url: customUrl
                })
                .eq('id', organization.id);

            if (error) {
                // Fallback para localStorage
                localStorage.setItem(`etiqueta_logo_option_${organization.id}`, option);
                localStorage.setItem(`etiqueta_logo_url_${organization.id}`, customUrl);
            } else {
                if (refreshTenant) await refreshTenant();
            }
        } catch (err) {
            console.warn("Erro ao salvar no banco, usando localStorage:", err);
            localStorage.setItem(`etiqueta_logo_option_${organization.id}`, option);
            localStorage.setItem(`etiqueta_logo_url_${organization.id}`, customUrl);
        } finally {
            setIsSavingLogo(false);
        }
    };

    const handleLogoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Selecione um arquivo de imagem válido (PNG, JPG).');
            return;
        }

        setIsUploading(true);
        try {
            const { file_url } = await base44.integrations.Core.UploadFile({ file });
            setLogoCustomizadaUrl(file_url);
            await handleSaveLogoConfig(logoOption, file_url);
            toast.success("Logo personalizada enviada com sucesso!");
        } catch (err) {
            toast.error("Erro ao enviar arquivo: " + err.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleRemoveCustomLogo = async () => {
        setLogoCustomizadaUrl("");
        await handleSaveLogoConfig(logoOption, "");
        toast.success("Logo personalizada removida.");
    };

    const { data: produtos = [] } = useQuery({
        queryKey: ['produtos'],
        queryFn: () => base44.entities.Produto.list()
    });

    const { data: fornecedores = [] } = useQuery({
        queryKey: ['fornecedores'],
        queryFn: () => base44.entities.Fornecedor.list()
    });

    // Atualizar quando a prop produtosPreSelecionados mudar e o modal abrir
    React.useEffect(() => {
        if (isOpen && produtosPreSelecionados.length > 0) {
            setItensImpressao(produtosPreSelecionados.map(p => ({ produto: p, quantidade: 1 })));
        } else if (isOpen && produtosPreSelecionados.length === 0) {
            setItensImpressao([]);
        }
    }, [isOpen, produtosPreSelecionados]);

    const adicionarProduto = (produto) => {
        setItensImpressao(prev => {
            const existe = prev.find(item => item.produto.id === produto.id);
            if (existe) {
                return prev.map(item =>
                    item.produto.id === produto.id
                        ? { ...item, quantidade: item.quantidade + 1 }
                        : item
                );
            }
            return [...prev, { produto, quantidade: 1 }];
        });
        toast.success(`${produto.nome} adicionado`);
    };

    const atualizarQuantidade = (id, delta) => {
        setItensImpressao(prev => prev.map(item => {
            if (item.produto.id === id) {
                const novaQtd = Math.max(1, item.quantidade + delta);
                return { ...item, quantidade: novaQtd };
            }
            return item;
        }));
    };

    const removerProduto = (id) => {
        setItensImpressao(prev => prev.filter(item => item.produto.id !== id));
    };

    // Gerar a array linear de produtos baseada nas quantidades
    const getProdutosParaImpressao = () => {
        const arr = [];
        itensImpressao.forEach(item => {
            for (let i = 0; i < item.quantidade; i++) {
                arr.push(item.produto);
            }
        });
        return arr;
    };

    const produtosImpressao = getProdutosParaImpressao();
    const totalEtiquetas = produtosImpressao.length;

    const handlePrint = useReactToPrint({
        contentRef: componentRef,
        documentTitle: "Etiquetas_Pedido",
        onAfterPrint: () => {
            toast.success("Impressão finalizada");
            onClose();
        }
    });

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
                <div className="p-6 pb-2 border-b">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <Printer className="w-5 h-5 text-gray-700" />
                            Gerador de Etiquetas (1/4 A4)
                        </DialogTitle>
                        <DialogDescription>
                            Adicione produtos à lista e defina a quantidade desejada. A impressão será em tamanho A6.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                {/* Corpo do Modal: Split Screen (Controles vs Preview) */}
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-gray-50/50">

                    {/* Lado Esquerdo: Controles */}
                    <div className="w-full md:w-1/2 p-6 flex flex-col gap-6 border-r overflow-y-auto">

                        {/* Busca */}
                        <div className="space-y-3">
                            <h3 className="font-semibold text-sm text-gray-700">Adicionar Produtos</h3>
                            <BuscaProdutoAvancada
                                produtos={produtos}
                                fornecedores={fornecedores}
                                onSelectProduto={(prod) => adicionarProduto(prod)}
                            />
                        </div>

                        {/* Configuração da Logo da Etiqueta */}
                        <div className="border rounded-lg bg-white p-4 shadow-sm space-y-3">
                            <h3 className="font-semibold text-sm text-gray-700 flex items-center gap-2">
                                <Palette className="w-4 h-4 text-green-600" />
                                Logo da Etiqueta
                            </h3>
                            
                            <div className="grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-lg text-xs font-medium">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setLogoOption("default");
                                        handleSaveLogoConfig("default", logoCustomizadaUrl);
                                    }}
                                    className={`py-1.5 px-2 rounded-md transition-all text-center ${
                                        logoOption === "default"
                                            ? "bg-white shadow text-gray-900"
                                            : "text-gray-500 hover:text-gray-900"
                                    }`}
                                >
                                    Loja
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setLogoOption("custom");
                                        handleSaveLogoConfig("custom", logoCustomizadaUrl);
                                    }}
                                    className={`py-1.5 px-2 rounded-md transition-all text-center ${
                                        logoOption === "custom"
                                            ? "bg-white shadow text-gray-900"
                                            : "text-gray-500 hover:text-gray-900"
                                    }`}
                                >
                                    Personalizada
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setLogoOption("none");
                                        handleSaveLogoConfig("none", logoCustomizadaUrl);
                                    }}
                                    className={`py-1.5 px-2 rounded-md transition-all text-center ${
                                        logoOption === "none"
                                            ? "bg-white shadow text-gray-900"
                                            : "text-gray-500 hover:text-gray-900"
                                    }`}
                                >
                                    Sem Logo
                                </button>
                            </div>

                            {logoOption === "custom" && (
                                <div className="space-y-2 mt-2 animate-in fade-in-50 duration-200">
                                    {logoCustomizadaUrl ? (
                                        <div className="flex items-center justify-between border rounded-lg p-2 bg-gray-50/50">
                                            <img
                                                src={logoCustomizadaUrl}
                                                alt="Logo Personalizada"
                                                className="h-10 max-w-[120px] object-contain rounded bg-white p-1 border shadow-sm"
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={handleRemoveCustomLogo}
                                                className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <label className="block cursor-pointer">
                                            <input
                                                type="file"
                                                accept="image/png, image/jpeg, image/webp"
                                                className="hidden"
                                                onChange={handleLogoUpload}
                                                disabled={isUploading}
                                            />
                                            <div className="border border-dashed border-gray-300 rounded-lg p-4 text-center hover:bg-gray-50 transition-colors flex flex-col items-center gap-1.5">
                                                {isUploading ? (
                                                    <>
                                                        <Loader2 className="w-5 h-5 text-green-600 animate-spin" />
                                                        <span className="text-xs text-gray-500 font-medium">Enviando logo...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Upload className="w-5 h-5 text-gray-400" />
                                                        <span className="text-xs font-semibold text-gray-700">Enviar Imagem</span>
                                                        <span className="text-[10px] text-gray-400">PNG com fundo transparente</span>
                                                    </>
                                                )}
                                            </div>
                                        </label>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Lista de Selecionados */}
                        <div className="flex-1 flex flex-col">
                            <h3 className="font-semibold text-sm text-gray-700 mb-3 flex justify-between">
                                <span>Lista de Impressão</span>
                                <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">
                                    Total: {totalEtiquetas} etiqueta(s)
                                </span>
                            </h3>

                            <ScrollArea className="flex-1 h-[250px] pr-4 border rounded-md bg-white p-2">
                                {itensImpressao.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-400 p-4 text-center">
                                        <Printer className="w-8 h-8 mb-2 opacity-50" />
                                        <p className="text-sm">Nenhum produto adicionado.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {itensImpressao.map(item => (
                                            <div key={item.produto.id} className="bg-gray-50 border p-3 rounded-lg flex items-center justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-sm text-gray-900 truncate" title={item.produto.nome}>
                                                        {item.produto.nome} {item.produto.modelo_referencia ? `(${item.produto.modelo_referencia})` : ''}
                                                    </p>
                                                </div>

                                                <div className="flex items-center gap-1 bg-white border rounded shadow-sm px-1 py-0.5 shrink-0">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        onClick={() => atualizarQuantidade(item.produto.id, -1)}
                                                    >
                                                        <Minus className="h-3 w-3" />
                                                    </Button>
                                                    <span className="text-sm font-medium w-6 text-center">
                                                        {item.quantidade}
                                                    </span>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        onClick={() => atualizarQuantidade(item.produto.id, 1)}
                                                    >
                                                        <Plus className="h-3 w-3" />
                                                    </Button>
                                                </div>

                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0"
                                                    onClick={() => removerProduto(item.produto.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>
                        </div>

                    </div>

                    {/* Lado Direito: Preview */}
                    <div className="w-full md:w-1/2 bg-gray-200/50 p-6 flex flex-col relative">
                        <h3 className="font-semibold text-sm text-gray-700 mb-3 flex items-center gap-2">
                            Preview da Impressão
                            <span className="text-xs font-normal text-gray-500">(1 página = 4 etiquetas)</span>
                        </h3>

                        <ScrollArea className="flex-1 h-[450px] border border-gray-300 rounded-md bg-gray-100 shadow-inner overflow-hidden relative">
                            {produtosImpressao.length > 0 ? (
                                <div className="scale-[0.4] origin-top-left translate-x-4 translate-y-4 w-[210mm] pointer-events-none">
                                    {/* Renderizamos o componente invisível que será pescado pelo react-to-print,
                        e o mesmo componente visualmente apenas para preview */}
                                    <div className="bg-white shadow">
                                        <EtiquetaImpressao 
                                            empresa={organization || user} 
                                            produtos={produtosImpressao} 
                                            logoOption={logoOption}
                                            logoCustomizadaUrl={logoCustomizadaUrl}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full w-full flex flex-col items-center justify-center text-gray-400">
                                    <p>Adicione itens para visualizar</p>
                                </div>
                            )}
                        </ScrollArea>

                        {/* Hidden component só pro ReactToPrint (Não afetado pelo scale do preview) */}
                        <div className="hidden">
                            <EtiquetaImpressao
                                ref={componentRef}
                                empresa={organization || user}
                                produtos={produtosImpressao}
                                logoOption={logoOption}
                                logoCustomizadaUrl={logoCustomizadaUrl}
                            />
                        </div>
                    </div>

                </div>

                <DialogFooter className="p-4 border-t bg-gray-50">
                    <Button variant="outline" onClick={onClose} className="mr-auto">Cancelar</Button>
                    <Button
                        className="bg-green-600 hover:bg-green-700 font-medium"
                        onClick={handlePrint}
                        disabled={totalEtiquetas === 0}
                    >
                        <Printer className="w-4 h-4 mr-2" />
                        Imprimir {totalEtiquetas} Etiquetas
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
