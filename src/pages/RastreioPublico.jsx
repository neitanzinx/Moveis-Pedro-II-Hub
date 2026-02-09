import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import MapaRota from "@/components/entregador/MapaRota";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck, MapPin, Package, AlertCircle, Clock } from "lucide-react";

export default function RastreioPublico() {
    const { id } = useParams();
    const [entrega, setEntrega] = useState(null);
    const [loading, setLoading] = useState(true);
    const [erro, setErro] = useState(null);
    const [localizacaoMotorista, setLocalizacaoMotorista] = useState(null);

    useEffect(() => {
        async function carregarRastreio() {
            try {
                // 1. Buscar a entrega e validar o status
                const { data, error } = await supabase
                    .from("entregas")
                    .select("*, vendedora:vendedores(nome)")
                    .eq("id", id)
                    .single();

                if (error || !data) {
                    setErro("Entrega não encontrada.");
                    return;
                }

                // 2. Validação de Segurança: Só permite rastreio se estiver em rota
                const statusPermitidos = ["Próxima parada", "A caminho", "Em rota"];
                if (!statusPermitidos.includes(data.status)) {
                    setErro("O rastreio em tempo real não está disponível para o status atual deste pedido.");
                    setEntrega(data); // Para mostrar o status estático
                    return;
                }

                setEntrega(data);

                // 3. Buscar localização do veículo vinculado
                if (data.veiculo_id) {
                    const { data: veiculo } = await supabase
                        .from("veiculos")
                        .select("latitude, longitude, ultima_atualizacao")
                        .eq("id", data.veiculo_id)
                        .single();
                    
                    if (veiculo) {
                        setLocalizacaoMotorista({
                            lat: veiculo.latitude,
                            lng: veiculo.longitude
                        });
                    }
                }
            } catch (err) {
                setErro("Erro ao carregar mapa.");
            } finally {
                setLoading(false);
            }
        }

        carregarRastreio();
        const interval = setInterval(carregarRastreio, 30000); // Atualiza a cada 30s
        return () => clearInterval(interval);
    }, [id]);

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="animate-pulse flex flex-col items-center">
                <Truck className="w-12 h-12 text-green-600 mb-4" />
                <p className="text-gray-500">Localizando sua entrega...</p>
            </div>
        </div>
    );

    if (erro && !entrega) return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <Card className="max-w-md w-full">
                <CardContent className="pt-6 text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <CardTitle className="text-red-700 mb-2">Acesso Negado</CardTitle>
                    <p className="text-gray-600">{erro}</p>
                </CardContent>
            </Card>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8">
            <div className="max-w-2xl mx-auto space-y-4">
                <div className="flex items-center gap-3 mb-6">
                    <div className="bg-green-600 p-2 rounded-lg">
                        <Truck className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Móveis Pedro II</h1>
                        <p className="text-xs text-gray-500">Rastreamento de Pedido</p>
                    </div>
                </div>

                <Card>
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="text-lg">Pedido #{entrega.numero_pedido || id.slice(0,5)}</CardTitle>
                                <p className="text-sm text-gray-500">{entrega.cliente_nome}</p>
                            </div>
                            <Badge className={entrega.status === "Próxima parada" ? "bg-green-500" : "bg-blue-500"}>
                                {entrega.status}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {erro ? (
                            <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex gap-3">
                                <Clock className="w-5 h-5 text-amber-600 shrink-0" />
                                <p className="text-sm text-amber-800">{erro}</p>
                            </div>
                        ) : (
                            <div className="rounded-xl overflow-hidden border">
                                <MapaRota 
                                    entregas={[entrega]} 
                                    entregaAtual={entrega} 
                                    localizacaoAtual={localizacaoMotorista} 
                                />
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4 pt-2">
                            <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-gray-400" />
                                <div>
                                    <p className="text-[10px] text-gray-500 uppercase font-bold">Destino</p>
                                    <p className="text-xs truncate">{entrega.bairro || "Endereço cadastrado"}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Package className="w-4 h-4 text-gray-400" />
                                <div>
                                    <p className="text-[10px] text-gray-500 uppercase font-bold">Vendedor(a)</p>
                                    <p className="text-xs">{entrega.vendedora?.nome || "Loja Central"}</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <p className="text-center text-[10px] text-gray-400 uppercase tracking-widest">
                    Móveis Pedro II - Qualidade que vai até você
                </p>
            </div>
        </div>
    );
}
