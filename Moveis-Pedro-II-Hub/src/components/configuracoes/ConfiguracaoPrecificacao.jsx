import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, Package, TrendingUp, Loader2 } from "lucide-react";
import AjustePrecoModal from "./AjustePrecoModal";

export default function ConfiguracaoPrecificacao() {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const { data: produtos = [], isLoading } = useQuery({
        queryKey: ['produtos'],
        queryFn: () => base44.entities.Produto.list('nome'),
    });

    const totalProdutos = produtos.length;
    const precoMedio = produtos.length > 0
        ? produtos.reduce((acc, p) => acc + (p.preco_venda || 0), 0) / produtos.length
        : 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <Card className="border-0 shadow-lg">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2" style={{ color: '#07593f' }}>
                        <DollarSign className="w-6 h-6" />
                        Precificação
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-gray-500 mb-6">
                        Ajuste os preços de venda de múltiplos produtos de uma só vez.
                    </p>

                    {/* Stats */}
                    <div className="grid md:grid-cols-2 gap-4 mb-6">
                        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                            <div className="p-3 rounded-lg bg-green-100">
                                <Package className="w-6 h-6 text-green-700" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold" style={{ color: '#07593f' }}>
                                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : totalProdutos}
                                </p>
                                <p className="text-sm text-gray-500">Produtos cadastrados</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                            <div className="p-3 rounded-lg bg-blue-100">
                                <TrendingUp className="w-6 h-6 text-blue-700" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-blue-600">
                                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : `R$ ${precoMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                                </p>
                                <p className="text-sm text-gray-500">Preço médio de venda</p>
                            </div>
                        </div>
                    </div>

                    {/* Botao */}
                    <Button
                        onClick={() => setIsModalOpen(true)}
                        size="lg"
                        className="w-full h-14 bg-green-700 hover:bg-green-800 text-lg"
                    >
                        <DollarSign className="w-5 h-5 mr-2" />
                        Ajustar Preços em Massa
                    </Button>
                </CardContent>
            </Card>

            {/* Modal */}
            <AjustePrecoModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                produtos={produtos}
            />
        </div>
    );
}
