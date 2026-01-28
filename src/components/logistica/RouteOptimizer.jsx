import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
    Route,
    MapPin,
    Clock,
    Fuel,
    ArrowRight,
    Check,
    RefreshCw,
    Navigation,
    TrendingDown,
    AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import useRouteOptimization from "@/hooks/useRouteOptimization";
import { base44 } from "@/api/base44Client";

/**
 * Componente para otimização de rotas de entrega
 * 
 * Funcionalidades:
 * - Otimiza ordem das entregas para menor distância
 * - Mostra economia de tempo/combustível
 * - Permite aplicar nova ordem ao banco de dados
 * - Exibe preview antes/depois
 */
export default function RouteOptimizer({
    entregas,
    caminhaoId,
    turno,
    data,
    onRotaAplicada
}) {
    const [modalAberto, setModalAberto] = useState(false);
    const [comparacao, setComparacao] = useState(null);
    const [aplicando, setAplicando] = useState(false);

    const { otimizarRota, loading, rotaOtimizada, erro, limpar } = useRouteOptimization();

    // Filtrar entregas válidas
    const entregasValidas = entregas?.filter(e =>
        e.endereco_entrega &&
        e.status !== 'Entregue' &&
        e.status !== 'Cancelada'
    ) || [];

    const handleOtimizar = async () => {
        if (entregasValidas.length < 2) {
            toast.info('Mínimo de 2 entregas para otimizar');
            return;
        }

        setModalAberto(true);
        limpar();

        // Endereço da loja como origem (pode ser configurável)
        const origem = "Rua São Paulo, Centro, São José dos Campos, SP"; // TODO: Buscar da config

        const resultado = await otimizarRota(entregasValidas, origem);

        if (resultado) {
            // Calcular comparação antes/depois
            const ordemAtual = entregasValidas.map((e, i) => i);
            const novaOrdem = resultado.waypointOrder;

            // Verificar se a ordem mudou
            const ordemMudou = JSON.stringify(ordemAtual) !== JSON.stringify(novaOrdem);

            setComparacao({
                ordemAtual,
                novaOrdem,
                ordemMudou,
                economiaEstimada: ordemMudou ? Math.round(resultado.distanciaTotal * 0.15) : 0 // ~15% economia típica
            });
        }
    };

    const aplicarOrdem = async () => {
        if (!rotaOtimizada?.ordemOtimizada) return;

        setAplicando(true);

        try {
            // Atualizar ordem_rota de cada entrega
            const promises = rotaOtimizada.ordemOtimizada.map((entrega, index) => {
                return base44.entities.Entrega.update(entrega.id, {
                    ordem_rota: index + 1
                });
            });

            await Promise.all(promises);

            toast.success('Rota otimizada aplicada com sucesso!');
            setModalAberto(false);
            onRotaAplicada?.();

        } catch (error) {
            console.error('Erro ao aplicar ordem:', error);
            toast.error('Erro ao aplicar nova ordem');
        } finally {
            setAplicando(false);
        }
    };

    return (
        <>
            <Button
                variant="outline"
                size="sm"
                onClick={handleOtimizar}
                disabled={entregasValidas.length < 2 || loading}
                className="gap-2"
            >
                {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                    <Route className="w-4 h-4" />
                )}
                Otimizar Rota ({entregasValidas.length})
            </Button>

            <Dialog open={modalAberto} onOpenChange={setModalAberto}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Navigation className="w-5 h-5 text-blue-600" />
                            Otimização de Rota
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Loading */}
                        {loading && (
                            <div className="flex flex-col items-center justify-center py-12">
                                <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
                                <p className="text-gray-500">Calculando melhor rota...</p>
                                <p className="text-xs text-gray-400 mt-1">
                                    Analisando {entregasValidas.length} entregas
                                </p>
                            </div>
                        )}

                        {/* Erro */}
                        {erro && (
                            <Card className="border-red-200 bg-red-50">
                                <CardContent className="p-4 flex items-center gap-3">
                                    <AlertCircle className="w-6 h-6 text-red-500" />
                                    <div>
                                        <p className="font-medium text-red-800">Erro na otimização</p>
                                        <p className="text-sm text-red-600">{erro}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Resultado */}
                        {rotaOtimizada && !loading && (
                            <>
                                {/* Cards de resumo */}
                                <div className="grid grid-cols-3 gap-3">
                                    <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                                        <CardContent className="p-4 text-center">
                                            <MapPin className="w-6 h-6 mx-auto text-blue-600 mb-2" />
                                            <p className="text-2xl font-bold text-blue-800">
                                                {rotaOtimizada.distanciaFormatada}
                                            </p>
                                            <p className="text-xs text-blue-600">Distância total</p>
                                        </CardContent>
                                    </Card>

                                    <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                                        <CardContent className="p-4 text-center">
                                            <Clock className="w-6 h-6 mx-auto text-green-600 mb-2" />
                                            <p className="text-2xl font-bold text-green-800">
                                                {rotaOtimizada.tempoFormatado}
                                            </p>
                                            <p className="text-xs text-green-600">Tempo estimado</p>
                                        </CardContent>
                                    </Card>

                                    <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                                        <CardContent className="p-4 text-center">
                                            <Fuel className="w-6 h-6 mx-auto text-orange-600 mb-2" />
                                            <p className="text-2xl font-bold text-orange-800">
                                                ~{Math.round(rotaOtimizada.distanciaTotal / 10)}L
                                            </p>
                                            <p className="text-xs text-orange-600">Combustível (~10km/L)</p>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Indicador de economia */}
                                {comparacao?.ordemMudou && (
                                    <Card className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white">
                                        <CardContent className="p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <TrendingDown className="w-8 h-8" />
                                                <div>
                                                    <p className="font-bold">Rota otimizada!</p>
                                                    <p className="text-sm text-emerald-100">
                                                        A ordem das entregas foi reorganizada para economia
                                                    </p>
                                                </div>
                                            </div>
                                            <Badge className="bg-white/20 text-white">
                                                ~{comparacao.economiaEstimada}km economizados
                                            </Badge>
                                        </CardContent>
                                    </Card>
                                )}

                                {!comparacao?.ordemMudou && (
                                    <Card className="bg-gray-50 border-gray-200">
                                        <CardContent className="p-4 text-center">
                                            <Check className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                                            <p className="text-gray-600">
                                                A ordem atual já está otimizada!
                                            </p>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Lista de paradas otimizada */}
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                                            <Route className="w-4 h-4" />
                                            Ordem Otimizada das Entregas
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <div className="divide-y">
                                            {rotaOtimizada.ordemOtimizada.map((entrega, index) => (
                                                <div
                                                    key={entrega.id}
                                                    className="p-3 flex items-center gap-3 hover:bg-gray-50"
                                                >
                                                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                                                        {index + 1}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-sm truncate">
                                                            {entrega.cliente_nome}
                                                        </p>
                                                        <p className="text-xs text-gray-500 truncate">
                                                            {entrega.endereco_entrega}
                                                        </p>
                                                    </div>
                                                    {rotaOtimizada.legs?.[index] && (
                                                        <div className="text-right text-xs text-gray-400">
                                                            <p>{rotaOtimizada.legs[index].distancia}</p>
                                                            <p>{rotaOtimizada.legs[index].tempo}</p>
                                                        </div>
                                                    )}
                                                    {index < rotaOtimizada.ordemOtimizada.length - 1 && (
                                                        <ArrowRight className="w-4 h-4 text-gray-300 hidden sm:block" />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Botões de ação */}
                                <div className="flex gap-3 pt-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => setModalAberto(false)}
                                        className="flex-1"
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        onClick={aplicarOrdem}
                                        disabled={aplicando || !comparacao?.ordemMudou}
                                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                                    >
                                        {aplicando ? (
                                            <>
                                                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                                Aplicando...
                                            </>
                                        ) : (
                                            <>
                                                <Check className="w-4 h-4 mr-2" />
                                                Aplicar Nova Ordem
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
