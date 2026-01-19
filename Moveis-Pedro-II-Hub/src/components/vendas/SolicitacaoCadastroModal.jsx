import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, AlertCircle } from "lucide-react";
import { base44, supabase } from "@/api/base44Client";
import { toast } from "sonner";

export default function SolicitacaoCadastroModal({ isOpen, onClose, onProdutoSolicitado, user }) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        nome_produto: '',
        cor: '',
        tecido: '',
        medidas: '',
        preco_sugerido: '',
        observacoes: ''
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.nome_produto || !formData.preco_sugerido) {
            toast.warning("Nome e Preço são obrigatórios");
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

            // 2. Format Correct Price
            const preco = parseFloat(formData.preco_sugerido.replace(',', '.'));

            // 3. Create Solicitation Record
            const solicitacao = await base44.entities.SolicitacaoCadastro.create({
                vendedor_id: user?.id,
                nome_produto: formData.nome_produto,
                cor: formData.cor,
                tecido: formData.tecido,
                medidas: formData.medidas,
                preco_sugerido: preco,
                observacoes: formData.observacoes,
                status: 'pendente'
            });

            // 4. Construct "Fake" Product Object for Cart
            // This mimics the structure of a real product but with overridden display values
            // IMPORTANT: nome is now CLEAN for client documents - use is_solicitacao flag for internal identification
            const produtoProvisorio = {
                id: genericProd.id, // Links to Generic Product in DB
                nome: formData.nome_produto, // Nome LIMPO para via do cliente
                preco_venda: preco,
                quantidade_estoque: 999, // Always available
                ativo: true,
                is_solicitacao: true,
                solicitacao_id: solicitacao.id,
                detalhes_solicitacao: {
                    cor: formData.cor,
                    tecido: formData.tecido,
                    medidas: formData.medidas,
                    nome_original: formData.nome_produto // Para referência interna
                }
            };

            toast.success("Solicitação enviada! Item adicionado ao carrinho.");
            onProdutoSolicitado(produtoProvisorio);
            onClose();
            setFormData({ nome_produto: '', cor: '', tecido: '', medidas: '', preco_sugerido: '', observacoes: '' });

        } catch (err) {
            console.error(err);
            toast.error("Erro ao solicitar cadastro: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Solicitar Cadastro de Produto</DialogTitle>
                    <DialogDescription>
                        Não encontrou o produto? Preencha os dados abaixo para adicioná-lo temporariamente à venda.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Nome do Produto (Mesa, Cadeira, etc)*</Label>
                        <Input
                            name="nome_produto"
                            value={formData.nome_produto}
                            onChange={handleChange}
                            placeholder="Ex: Mesa Jantar 4 lugares"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Cor</Label>
                            <Input
                                name="cor"
                                value={formData.cor}
                                onChange={handleChange}
                                placeholder="Ex: Carvalho/Off"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Tecido</Label>
                            <Input
                                name="tecido"
                                value={formData.tecido}
                                onChange={handleChange}
                                placeholder="Ex: Suede Bege"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Medidas</Label>
                        <Input
                            name="medidas"
                            value={formData.medidas}
                            onChange={handleChange}
                            placeholder="Ex: 1.20m x 0.90m"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Preço de Venda (R$)*</Label>
                        <Input
                            name="preco_sugerido"
                            type="number"
                            step="0.01"
                            value={formData.preco_sugerido}
                            onChange={handleChange}
                            placeholder="0.00"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Observações (Opcional)</Label>
                        <Textarea
                            name="observacoes"
                            value={formData.observacoes}
                            onChange={handleChange}
                            placeholder="Detalhes adicionais para o cadastro..."
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                        <Button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white" disabled={loading}>
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Adicionar à Venda"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
