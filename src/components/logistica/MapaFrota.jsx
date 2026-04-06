import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck, Clock, MapPin, User, Navigation, ExternalLink, AlertTriangle } from "lucide-react";

export default function MapaFrota({ caminhoes = [] }) {
    const formatarHora = (isoString) => {
        if (!isoString) return '-';
        const data = new Date(isoString);
        return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };

    const tempoDesdeAtualizacao = (isoString) => {
        if (!isoString) return 'Sem dados';
        const agora = new Date();
        const ultima = new Date(isoString);
        const diffMs = agora - ultima;
        const diffMin = Math.floor(diffMs / 60000);

        if (diffMin < 1) return 'Agora mesmo';
        if (diffMin < 60) return `Há ${diffMin} min`;
        return `Há ${Math.floor(diffMin / 60)}h`;
    };

    // 🔍 Detectar dados suspeitos: motorista atribuído mas sem GPS > 12h
    const temDadosSuspeitos = (caminhao) => {
        if (!caminhao.motorista_atual_nome) return false;
        if (!caminhao.ultima_atualizacao) return true; // Motorista sem última atualização é suspeito

        const agora = new Date();
        const ultima = new Date(caminhao.ultima_atualizacao);
        const LIMITE_ATIVO_MS = 12 * 60 * 60 * 1000; // 12 horas

        return (agora - ultima) > LIMITE_ATIVO_MS;
    };

    const agora = new Date();
    const LIMITE_ATIVO_MS = 12 * 60 * 60 * 1000; // 12 horas

    const caminhoesAtivosRecentemente = caminhoes.filter(c => {
        if (!c.ultima_atualizacao) return false;
        const ultima = new Date(c.ultima_atualizacao);
        return (agora - ultima) < LIMITE_ATIVO_MS;
    });

    const caminhoesEmTransito = caminhoesAtivosRecentemente.filter(c => c.status_rota === 'Em Trânsito');
    const caminhoesParados = caminhoes.filter(c => {
        const isEmTransito = c.status_rota === 'Em Trânsito';
        const isRecente = c.ultima_atualizacao && (agora - new Date(c.ultima_atualizacao)) < LIMITE_ATIVO_MS;
        return !isEmTransito || !isRecente;
    });

    const getMapsEmbedUrl = (lat, lng) => {
        return `https://maps.google.com/maps?q=${lat},${lng}&t=m&z=15&output=embed`;
    };

    return (
        <div className="space-y-4">
            {/* Cards de Resumo */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="border-0 shadow-sm">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-blue-100 text-blue-600">
                                <Truck className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{caminhoes.length}</p>
                                <p className="text-xs text-gray-500">Total Frota</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-0 shadow-sm">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-green-100 text-green-600">
                                <Navigation className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{caminhoesEmTransito.length}</p>
                                <p className="text-xs text-gray-500">Em Trânsito</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-0 shadow-sm">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-orange-100 text-orange-600">
                                <User className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{caminhoes.filter(c => c.motorista_atual_nome).length}</p>
                                <p className="text-xs text-gray-500">Motoristas Ativos</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-0 shadow-sm">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-gray-100 text-gray-600">
                                <Clock className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{caminhoesParados.length}</p>
                                <p className="text-xs text-gray-500">Parados</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Caminhões em Trânsito com Mini Mapa */}
            {caminhoesEmTransito.length > 0 && (
                <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-green-700">
                            <Navigation className="w-4 h-4" />
                            Em Trânsito Agora - Localização em Tempo Real
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {caminhoesEmTransito.map(caminhao => (
                                <div
                                    key={caminhao.id}
                                    className="rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 overflow-hidden"
                                >
                                    {/* Header do Caminhão */}
                                    <div className="p-4 border-b border-green-200">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                                                <span className="font-bold text-lg">🚚 {caminhao.placa || caminhao.nome}</span>
                                            </div>
                                            <Badge className="bg-green-600">{caminhao.turno_atual || 'Comercial'}</Badge>
                                        </div>

                                        <div className="flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-2 text-gray-600">
                                                <User className="w-4 h-4" />
                                                <span className="font-medium">{caminhao.motorista_atual_nome || 'Motorista'}</span>
                                            </div>
                                            <span className="text-xs text-gray-400">
                                                Atualizado {tempoDesdeAtualizacao(caminhao.ultima_atualizacao)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Mini Mapa */}
                                    {caminhao.latitude && caminhao.longitude ? (
                                        <div className="relative">
                                            <iframe
                                                src={getMapsEmbedUrl(caminhao.latitude, caminhao.longitude)}
                                                width="100%"
                                                height="180"
                                                style={{ border: 0 }}
                                                allowFullScreen=""
                                                loading="lazy"
                                                referrerPolicy="no-referrer-when-downgrade"
                                                className="w-full"
                                            />
                                            <a
                                                href={`https://www.google.com/maps?q=${caminhao.latitude},${caminhao.longitude}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="absolute bottom-2 right-2 flex items-center gap-1 bg-white/90 text-blue-600 text-xs px-2 py-1 rounded-full shadow hover:bg-white"
                                            >
                                                <ExternalLink className="w-3 h-3" />
                                                Abrir mapa
                                            </a>
                                        </div>
                                    ) : (
                                        <div className="h-[180px] flex items-center justify-center bg-gray-100 text-gray-400 text-sm">
                                            <MapPin className="w-5 h-5 mr-2" />
                                            Aguardando localização GPS...
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Lista Completa da Frota */}
            <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Truck className="w-4 h-4" />
                        Todos os Caminhões
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {caminhoes.map(caminhao => {
                            const emTransito = caminhao.status_rota === 'Em Trânsito';
                            const temLocalizacao = caminhao.latitude && caminhao.longitude;
                            const suspeito = temDadosSuspeitos(caminhao);

                            return (
                                <div
                                    key={caminhao.id}
                                    className={`rounded-xl border overflow-hidden ${suspeito
                                        ? 'bg-red-50 border-red-300 border-2'
                                        : emTransito
                                            ? 'bg-green-50 border-green-200'
                                            : 'bg-gray-50 border-gray-200'
                                    }`}
                                >
                                    {/* ⚠️ Aviso de dados suspeitos */}
                                    {suspeito && (
                                        <div className="bg-red-100 border-b border-red-300 px-3 py-2 flex items-center gap-2">
                                            <AlertTriangle className="w-4 h-4 text-red-600" />
                                            <span className="text-xs font-semibold text-red-700">
                                                Possível dados inconsistentes
                                            </span>
                                        </div>
                                    )}

                                    <div className="p-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-3 h-3 rounded-full ${suspeito
                                                    ? 'bg-red-500 animate-pulse'
                                                    : emTransito
                                                        ? 'bg-green-500 animate-pulse'
                                                        : 'bg-gray-400'
                                                    }`} />
                                                <span className="font-bold">🚚 {caminhao.placa || caminhao.nome}</span>
                                            </div>
                                            <Badge variant={suspeito ? 'destructive' : emTransito ? 'default' : 'secondary'} className="text-xs">
                                                {suspeito ? '⚠️ Verificar' : (caminhao.status_rota || 'Parado')}
                                            </Badge>
                                        </div>

                                        <p className="text-xs text-gray-500 mb-2">
                                            {caminhao.modelo || 'Caminhão'}
                                            {caminhao.motorista_atual_nome && (
                                                <>
                                                    <br />
                                                    <span className={suspeito ? 'text-red-600 font-semibold' : ''}>
                                                        Motorista: {caminhao.motorista_atual_nome}
                                                    </span>
                                                </>
                                            )}
                                            {caminhao.ultima_atualizacao && (
                                                <>
                                                    <br />
                                                    <span className={suspeito ? 'text-red-600 font-semibold' : 'text-gray-400'}>
                                                        Último GPS: {tempoDesdeAtualizacao(caminhao.ultima_atualizacao)}
                                                    </span>
                                                </>
                                            )}
                                        </p>

                                        {temLocalizacao && (
                                            <a
                                                href={`https://www.google.com/maps?q=${caminhao.latitude},${caminhao.longitude}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                                            >
                                                <MapPin className="w-3 h-3" />
                                                Ver localização
                                            </a>
                                        )}
                                    </div>

                                    {/* Mini mapa para caminhões parados com localização */}
                                    {!emTransito && temLocalizacao && (
                                        <div className="border-t border-gray-200">
                                            <iframe
                                                src={getMapsEmbedUrl(caminhao.latitude, caminhao.longitude)}
                                                width="100%"
                                                height="100"
                                                style={{ border: 0 }}
                                                loading="lazy"
                                                className="w-full"
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {caminhoes.length === 0 && (
                            <div className="col-span-full text-center py-8 text-gray-400">
                                <Truck className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                <p>Nenhum caminhão cadastrado</p>
                                <p className="text-xs mt-1">Execute o SQL para criar a tabela de caminhões</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
