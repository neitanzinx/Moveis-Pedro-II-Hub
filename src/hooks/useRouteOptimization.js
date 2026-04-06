import { useState, useCallback } from 'react';
import { toast } from 'sonner';

/**
 * Hook para otimização de rotas usando nearest neighbor com Google Distance Matrix API
 * 
 * Recursos:
 * - Otimiza ordem de waypoints via nearest neighbor
 * - Calcula tempo total estimado
 * - Retorna sequência otimizada para exibição e persistência da ordem
 */
export default function useRouteOptimization() {
    const [loading, setLoading] = useState(false);
    const [rotaOtimizada, setRotaOtimizada] = useState(null);
    const [erro, setErro] = useState(null);

    const carregarGoogleMaps = useCallback(() => {
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
    }, []);

    const geocodificarEndereco = useCallback(async (geocoder, endereco) => {
        return new Promise((resolve, reject) => {
            geocoder.geocode({ address: endereco, region: 'BR' }, (results, status) => {
                if (status !== 'OK' || !results?.[0]?.geometry?.location) {
                    reject(new Error(`Endereco nao encontrado: ${endereco}`));
                    return;
                }

                const loc = results[0].geometry.location;
                resolve({
                    lat: loc.lat(),
                    lng: loc.lng(),
                    enderecoFormatado: results[0].formatted_address
                });
            });
        });
    }, []);

    const calcularMatrizDistancias = useCallback(async (locations) => {
        const matrixService = new window.google.maps.DistanceMatrixService();

        const response = await new Promise((resolve, reject) => {
            matrixService.getDistanceMatrix({
                origins: locations,
                destinations: locations,
                travelMode: window.google.maps.TravelMode.DRIVING,
                region: 'BR',
                unitSystem: window.google.maps.UnitSystem.METRIC
            }, (result, status) => {
                if (status !== 'OK') {
                    reject(new Error(traduzirErroGoogle(status)));
                    return;
                }
                resolve(result);
            });
        });

        return response.rows.map((row) =>
            row.elements.map((el) => {
                if (el.status !== 'OK') {
                    return { distance: Infinity, duration: Infinity };
                }
                return {
                    distance: el.distance.value,
                    duration: el.duration.value
                };
            })
        );
    }, []);

    const nearestNeighborOrder = useCallback((matrix, startIndex = 0) => {
        const n = matrix.length;
        const visited = Array(n).fill(false);
        const order = [startIndex];
        visited[startIndex] = true;

        while (order.length < n) {
            const current = order[order.length - 1];
            let bestNext = -1;
            let bestDistance = Infinity;

            for (let i = 0; i < n; i++) {
                if (visited[i]) continue;
                const d = matrix[current][i]?.distance ?? Infinity;
                if (d < bestDistance) {
                    bestDistance = d;
                    bestNext = i;
                }
            }

            if (bestNext === -1) {
                break;
            }

            visited[bestNext] = true;
            order.push(bestNext);
        }

        return order;
    }, []);

    /**
     * Otimiza uma lista de entregas
     * @param {Array} entregas - Lista de entregas com endereco_entrega
     * @param {Object|string|null} origem - Ponto de partida opcional
     * @returns {Object} Resultado da rota otimizada
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
            if (!window.google?.maps) {
                await carregarGoogleMaps();
            }

            const entregasComEndereco = entregas.filter((e) => e.endereco_entrega);
            if (entregasComEndereco.length < 2) {
                throw new Error('Sao necessarias pelo menos 2 entregas com endereco valido.');
            }

            const geocoder = new window.google.maps.Geocoder();
            const geocoded = await Promise.all(
                entregasComEndereco.map(async (entrega) => {
                    const coord = await geocodificarEndereco(geocoder, entrega.endereco_entrega);
                    return { entrega, ...coord };
                })
            );

            const locations = geocoded.map((g) => ({ lat: g.lat, lng: g.lng }));
            const matrix = await calcularMatrizDistancias(locations);

            let startIndex = 0;
            if (origem && typeof origem === 'object' && typeof origem.lat === 'number' && typeof origem.lng === 'number') {
                let melhor = Infinity;
                geocoded.forEach((item, idx) => {
                    const dist = haversineMeters(origem.lat, origem.lng, item.lat, item.lng);
                    if (dist < melhor) {
                        melhor = dist;
                        startIndex = idx;
                    }
                });
            }

            const ordemIndices = nearestNeighborOrder(matrix, startIndex);
            const ordemOtimizada = ordemIndices.map((idx) => geocoded[idx].entrega);

            let distanciaTotalMetros = 0;
            let tempoTotalSegundos = 0;
            const legs = [];

            for (let i = 0; i < ordemIndices.length - 1; i++) {
                const de = ordemIndices[i];
                const para = ordemIndices[i + 1];
                const trecho = matrix[de][para];

                distanciaTotalMetros += Number.isFinite(trecho.distance) ? trecho.distance : 0;
                tempoTotalSegundos += Number.isFinite(trecho.duration) ? trecho.duration : 0;

                legs.push({
                    de: geocoded[de].enderecoFormatado,
                    para: geocoded[para].enderecoFormatado,
                    distancia: formatarDistancia(trecho.distance),
                    tempo: formatarTempo(trecho.duration),
                    entrega: geocoded[para].entrega
                });
            }

            const resultado = {
                ordemOtimizada,
                waypointOrder: ordemIndices,
                distanciaTotal: distanciaTotalMetros / 1000,
                distanciaFormatada: formatarDistancia(distanciaTotalMetros),
                tempoTotal: tempoTotalSegundos / 60,
                tempoFormatado: formatarTempo(tempoTotalSegundos),
                legs,
                algoritmo: 'nearest-neighbor'
            };

            setRotaOtimizada(resultado);
            setLoading(false);
            return resultado;

        } catch (error) {
            console.error('Erro na otimização:', error);
            setErro(error.message);
            setLoading(false);
            toast.error(error.message || 'Erro ao otimizar rota');
            return null;
        }
    }, [calcularMatrizDistancias, carregarGoogleMaps, geocodificarEndereco, nearestNeighborOrder]);

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
    if (!Number.isFinite(metros)) return 'N/D';
    if (metros >= 1000) {
        return `${(metros / 1000).toFixed(1)} km`;
    }
    return `${Math.round(metros)} m`;
}

function formatarTempo(segundos) {
    if (!Number.isFinite(segundos)) return 'N/D';
    const horas = Math.floor(segundos / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);

    if (horas > 0) {
        return `${horas}h ${minutos}min`;
    }
    return `${minutos} min`;
}

function haversineMeters(lat1, lon1, lat2, lon2) {
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
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
