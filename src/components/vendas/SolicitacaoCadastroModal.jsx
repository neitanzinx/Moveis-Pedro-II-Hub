import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertCircle } from "lucide-react";
import { base44, supabase } from "@/api/base44Client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { CATEGORIAS, AMBIENTES, MATERIAIS } from "@/constants/productConstants";

export default function SolicitacaoCadastroModal({ isOpen, onClose, onProdutoSolicitado, user }) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        nome_produto: '',
        categoria: '',
        ambiente: '',
        fornecedor_id: '',
        cor: '',
        tecido: '',
        material: '',
        altura: '',
        largura: '',
        profundidade: '',
        preco_sugerido: '',
        observacoes: ''
    });

    // Busca fornecedores
    const { data: fornecedores = [] } = useQuery({
        queryKey: ['fornecedores'],
        queryFn: () => base44.entities.Fornecedor.list(),
        enabled: isOpen
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSelectChange = (name, value) => {
        setFormData({ ...formData, [name]: value });
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.nome_produto || !formData.preco_sugerido || !formData.categoria) {
            toast.warning("Nome, Categoria e Preço são obrigatórios");
            return;
        }

        setLoading(true);
        try {
            // 1. Get the Generic Product ID
            const { data: genericProd, error: prodError } = await supabase
                .from('produtos')
                .select('id, codigo_barras')
                .eq('codigo_barras', 'PROD-GENERICO')
                .maybeSingle();

            if (prodError || !genericProd) {
                throw new Error("Produto genérico não configurado no sistema. Contate o suporte.");
            }

            // 2. Format Correct Price and Dimensions
            const preco = parseFloat(formData.preco_sugerido.replace(',', '.'));

            // Format dimensions for display/string storage
            const medidasFormatted = [
                formData.altura ? `A:${formData.altura}cm` : '',
                formData.largura ? `L:${formData.largura}cm` : '',
                formData.profundidade ? `P:${formData.profundidade}cm` : ''
            ].filter(Boolean).join(' x ');

            // Pack extra info into remarks for database storage (since schema might not have these cols yet)
            // But we will pass structured data to the cart for immediate use
            const extraInfo = `
Categoria: ${formData.categoria}
Ambiente: ${formData.ambiente || '-'}
Material: ${formData.material || '-'}
Fornecedor: ${fornecedores.find(f => f.id.toString() === formData.fornecedor_id)?.nome_empresa || '-'}
Dimensões: ${medidasFormatted}
            `.trim();

            const finalObservacoes = `${formData.observacoes || ''}\n\n--- Detalhes Técnicos ---\n${extraInfo}`.trim();

            // 3. Create Solicitation Record
            const solicitacao = await base44.entities.SolicitacaoCadastro.create({
                vendedor_id: user?.id,
                nome_produto: formData.nome_produto,
                cor: formData.cor,
                tecido: formData.tecido,
                medidas: medidasFormatted, // Store simple string representation in legacy column
                preco_sugerido: preco,
                observacoes: finalObservacoes,
                status: 'pendente'
            });

            // 4. Construct "Fake" Product Object for Cart
            const produtoProvisorio = {
                id: genericProd.id,
                nome: formData.nome_produto,
                preco_venda: preco,
                quantidade_estoque: 999,
                ativo: true,
                is_solicitacao: true,
                solicitacao_id: solicitacao.id,
                detalhes_solicitacao: {
                    cor: formData.cor,
                    tecido: formData.tecido,
                    // Pass SPLIT dimensions for easy mapping later
                    altura: formData.altura,
                    largura: formData.largura,
                    profundidade: formData.profundidade,
                    medidas: medidasFormatted,
                    categoria: formData.categoria,
                    ambiente: formData.ambiente,
                    material: formData.material,
                    fornecedor_id: formData.fornecedor_id,
                    nome_original: formData.nome_produto
                }
            };

            toast.success("Solicitação enviada! Item adicionado ao carrinho.");
            onProdutoSolicitado(produtoProvisorio);
            onClose();
            setFormData({
                nome_produto: '', categoria: '', ambiente: '', fornecedor_id: '',
                cor: '', tecido: '', material: '',
                altura: '', largura: '', profundidade: '',
                preco_sugerido: '', observacoes: ''
            });

        } catch (err) {
            console.error(err);
            toast.error("Erro ao solicitar cadastro: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Solicitar Cadastro de Produto</DialogTitle>
                    <DialogDescription>
                        Preencha todos os dados técnicos para agilizar o cadastro.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Linha 1: Nome e Categoria */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Nome do Produto *</Label>
                            <Input
                                name="nome_produto"
                                value={formData.nome_produto}
                                onChange={handleChange}
                                placeholder="Ex: Mesa Jantar 4 lugares"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Categoria *</Label>
                            <Select onValueChange={(v) => handleSelectChange('categoria', v)} value={formData.categoria}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                    {CATEGORIAS.map(c => (
                                        <SelectItem key={c} value={c}>{c}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Linha 2: Ambiente e Fornecedor */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Ambiente</Label>
                            <Select onValueChange={(v) => handleSelectChange('ambiente', v)} value={formData.ambiente}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                    {AMBIENTES.map(a => (
                                        <SelectItem key={a} value={a}>{a}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Fornecedor (Opcional)</Label>
                            <Select onValueChange={(v) => handleSelectChange('fornecedor_id', v)} value={formData.fornecedor_id}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                    {fornecedores.map(f => (
                                        <SelectItem key={f.id} value={String(f.id)}>{f.nome_empresa || f.nome_contato}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Linha 3: Dimensões (Split) */}
                    <div className="space-y-2">
                        <Label>Dimensões (cm)</Label>
                        <div className="grid grid-cols-3 gap-2">
                            <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">Alt.</span>
                                <Input
                                    name="altura"
                                    type="number"
                                    value={formData.altura}
                                    onChange={handleChange}
                                    placeholder="0"
                                    className="pl-8"
                                />
                            </div>
                            <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">Larg.</span>
                                <Input
                                    name="largura"
                                    type="number"
                                    value={formData.largura}
                                    onChange={handleChange}
                                    placeholder="0"
                                    className="pl-9"
                                />
                            </div>
                            <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">Prof.</span>
                                <Input
                                    name="profundidade"
                                    type="number"
                                    value={formData.profundidade}
                                    onChange={handleChange}
                                    placeholder="0"
                                    className="pl-9"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Linha 4: Acabamento (Cor, Tecido, Material) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-2">
                            <Label>Cor</Label>
                            <Input
                                name="cor"
                                value={formData.cor}
                                onChange={handleChange}
                                placeholder="Ex: Off White"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Tecido</Label>
                            <Input
                                name="tecido"
                                value={formData.tecido}
                                onChange={handleChange}
                                placeholder="Ex: Linho"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Material</Label>
                            <Select onValueChange={(v) => handleSelectChange('material', v)} value={formData.material}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                    {MATERIAIS.map(m => (
                                        <SelectItem key={m} value={m}>{m}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Preço de Venda (R$)*</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">R$</span>
                            <Input
                                name="preco_sugerido"
                                type="number"
                                step="0.01"
                                value={formData.preco_sugerido}
                                onChange={handleChange}
                                placeholder="0.00"
                                className="pl-9 text-lg font-bold text-green-700"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Observações Adicionais</Label>
                        <Textarea
                            name="observacoes"
                            value={formData.observacoes}
                            onChange={handleChange}
                            placeholder="Detalhes adicionais..."
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                        <Button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white w-full md:w-auto" disabled={loading}>
                            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Solicitar Cadastro"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
