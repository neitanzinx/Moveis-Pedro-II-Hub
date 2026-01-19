import { useState, useCallback } from 'react';
import { toast } from 'sonner';

/**
 * Hook para otimização de rotas usando Google Maps Directions API
 * 
 * Recursos:
 * - Otimiza ordem de waypoints para menor distância
 * - Calcula tempo total estimado
 * - Retorna rota otimizada para exibição no mapa
 */
export default function useRouteOptimization() {
    const [loading, setLoading] = useState(false);
    const [rotaOtimizada, setRotaOtimizada] = useState(null);
    const [erro, setErro] = useState(null);

    /**
     * Otimiza uma lista de entregas
     * @param {Array} entregas - Lista de entregas com endereco_entrega
     * @param {Object} origem - Ponto de partida {lat, lng} ou endereço string
     * @returns {Object} { ordemOtimizada, distanciaTotal, tempoTotal, rotaGoogle }
     */
    const otimizarRota = useCallback(async (entregas, origem = null) => {
        if (!entregas || entregas.length === 0) {
            toast.error('Nenhuma entrega para otimizar');
            return null;
        }

        if (entregas.length === 1) {
            // Com apenas 1 entrega, não há o que otimizar
            return {
                ordemOtimizada: entregas,
                distanciaTotal: 0,
                tempoTotal: 0,
                waypoint_order: [0]
            };
        }

        setLoading(true);
        setErro(null);

        try {
            // Verificar se Google Maps está disponível
            if (!window.google?.maps) {
                // Tentar carregar dinamicamente
                await carregarGoogleMaps();
            }

            const directionsService = new window.google.maps.DirectionsService();

            // Preparar waypoints (máximo 23 intermediários + origem + destino = 25)
            const enderecos = entregas.map(e => e.endereco_entrega).filter(Boolean);

            if (enderecos.length === 0) {
                throw new Error('Nenhum endereço válido encontrado nas entregas');
            }

            // Se tiver mais de 23 entregas, dividir em grupos
            if (enderecos.length > 23) {
                toast.warning(`Limitando otimização a 23 entregas (limite Google Maps)`);
                enderecos.splice(23);
            }

            // Definir origem (ponto de partida)
            const pontoOrigem = origem || enderecos[0];

            // Primeiro endereço é destino se não houver retorno à origem
            // Último endereço é destino
            const pontoDestino = enderecos[enderecos.length - 1];

            // Waypoints intermediários (todos exceto o último)
            const waypoints = enderecos.slice(0, -1).map(endereco => ({
                location: endereco,
                stopover: true
            }));

            const request = {
                origin: pontoOrigem,
                destination: pontoDestino,
                waypoints: waypoints,
                optimizeWaypoints: true, // Chave da otimização!
                travelMode: window.google.maps.TravelMode.DRIVING,
                region: 'br', // Priorizar Brasil
                language: 'pt-BR'
            };

            return new Promise((resolve, reject) => {
                directionsService.route(request, (result, status) => {
                    if (status === 'OK') {
                        const route = result.routes[0];

                        // Ordem otimizada retornada pelo Google
                        const waypointOrder = route.waypoint_order;

                        // Reordenar entregas conforme otimização
                        const entregasReordenadas = [...entregas];
                        const ordemOtimizada = [];

                        // Montar a ordem otimizada
                        // O waypoint_order indica a nova ordem dos waypoints intermediários
                        waypointOrder.forEach((indiceOriginal, novoIndice) => {
                            ordemOtimizada[novoIndice] = entregas[indiceOriginal];
                        });

                        // Adicionar a última entrega (destino) no final
                        ordemOtimizada.push(entregas[entregas.length - 1]);

                        // Calcular totais
                        let distanciaTotal = 0;
                        let tempoTotal = 0;

                        route.legs.forEach(leg => {
                            distanciaTotal += leg.distance.value; // metros
                            tempoTotal += leg.duration.value; // segundos
                        });

                        const resultado = {
                            ordemOtimizada,
                            waypointOrder,
                            distanciaTotal: distanciaTotal / 1000, // km
                            distanciaFormatada: formatarDistancia(distanciaTotal),
                            tempoTotal: tempoTotal / 60, // minutos
                            tempoFormatado: formatarTempo(tempoTotal),
                            rotaGoogle: result,
                            legs: route.legs.map((leg, index) => ({
                                de: leg.start_address,
                                para: leg.end_address,
                                distancia: leg.distance.text,
                                tempo: leg.duration.text,
                                entrega: ordemOtimizada[index]
                            }))
                        };

                        setRotaOtimizada(resultado);
                        setLoading(false);
                        resolve(resultado);

                    } else {
                        const erro = traduzirErroGoogle(status);
                        setErro(erro);
                        setLoading(false);
                        reject(new Error(erro));
                    }
                });
            });

        } catch (error) {
            console.error('Erro na otimização:', error);
            setErro(error.message);
            setLoading(false);
            toast.error(error.message || 'Erro ao otimizar rota');
            return null;
        }
    }, []);

    /**
     * Carrega o Google Maps dinamicamente se não estiver disponível
     */
    const carregarGoogleMaps = () => {
        return new Promise((resolve, reject) => {
            if (window.google?.maps) {
                resolve();
                return;
            }

            const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
            if (!apiKey) {
                reject(new Error('API Key do Google Maps não configurada. Adicione VITE_GOOGLE_MAPS_API_KEY no .env'));
                return;
            }

            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`;
            script.async = true;
            script.defer = true;

            script.onload = () => {
                if (window.google?.maps) {
                    resolve();
                } else {
                    reject(new Error('Google Maps não carregou corretamente'));
                }
            };

            script.onerror = () => {
                reject(new Error('Erro ao carregar Google Maps'));
            };

            document.head.appendChild(script);
        });
    };

    /**
     * Limpa o estado
     */
    const limpar = useCallback(() => {
        setRotaOtimizada(null);
        setErro(null);
    }, []);

    return {
        otimizarRota,
        loading,
        rotaOtimizada,
        erro,
        limpar
    };
}

// Funções auxiliares
function formatarDistancia(metros) {
    if (metros >= 1000) {
        return `${(metros / 1000).toFixed(1)} km`;
    }
    return `${metros} m`;
}

function formatarTempo(segundos) {
    const horas = Math.floor(segundos / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);

    if (horas > 0) {
        return `${horas}h ${minutos}min`;
    }
    return `${minutos} min`;
}

function traduzirErroGoogle(status) {
    const erros = {
        'ZERO_RESULTS': 'Não foi possível encontrar uma rota entre os endereços',
        'NOT_FOUND': 'Um ou mais endereços não foram encontrados',
        'MAX_WAYPOINTS_EXCEEDED': 'Número máximo de paradas excedido (máx: 25)',
        'INVALID_REQUEST': 'Requisição inválida. Verifique os endereços',
        'OVER_QUERY_LIMIT': 'Limite de requisições excedido. Tente novamente em alguns minutos',
        'REQUEST_DENIED': 'Acesso negado. Verifique a API Key',
        'UNKNOWN_ERROR': 'Erro desconhecido no servidor do Google'
    };
    return erros[status] || `Erro: ${status}`;
}
