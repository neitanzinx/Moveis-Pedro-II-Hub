import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Package, User, MapPin, Phone, Calendar, Clock,
    CheckCircle, AlertCircle, Wrench
} from "lucide-react";

export default function MontadorTerceirizadoTab() {
    const { data: montagens = [], isLoading } = useQuery({
        queryKey: ['montagens-terceirizadas'],
        queryFn: async () => {
            const todas = await base44.entities.MontagemItem.list('-created_at');
            return todas.filter(m => m.tipo_montagem === 'terceirizada');
        }
    });

    const { data: montadores = [] } = useQuery({
        queryKey: ['montadores'],
        queryFn: () => base44.entities.Montador.list('nome')
    });

    const getStatusBadge = (status) => {
        const config = {
            pendente: { label: 'Pendente', className: 'bg-yellow-100 text-yellow-800' },
            agendada: { label: 'Agendada', className: 'bg-blue-100 text-blue-800' },
            confirmada: { label: 'Confirmada', className: 'bg-green-100 text-green-800' },
            em_andamento: { label: 'A Caminho', className: 'bg-purple-100 text-purple-800' },
            concluida: { label: 'Concluída', className: 'bg-gray-100 text-gray-800' },
            cancelada: { label: 'Cancelada', className: 'bg-red-100 text-red-800' }
        };
        return config[status] || { label: status, className: 'bg-gray-100 text-gray-600' };
    };

    const formatarData = (dataStr) => {
        if (!dataStr) return "A definir";
        const data = new Date(dataStr);
        return data.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
    };

    const montagensPendentes = montagens.filter(m => m.status === 'pendente');
    const montagensAgendadas = montagens.filter(m => ['agendada', 'confirmada', 'em_andamento'].includes(m.status));
    const montagensConcluidas = montagens.filter(m => m.status === 'concluida');

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Resumo */}
            <div className="grid grid-cols-3 gap-4">
                <Card className="bg-yellow-50 border-yellow-200">
                    <CardContent className="p-4 text-center">
                        <p className="text-3xl font-bold text-yellow-600">{montagensPendentes.length}</p>
                        <p className="text-sm text-yellow-700">Pendentes</p>
                    </CardContent>
                </Card>
                <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="p-4 text-center">
                        <p className="text-3xl font-bold text-blue-600">{montagensAgendadas.length}</p>
                        <p className="text-sm text-blue-700">Agendadas</p>
                    </CardContent>
                </Card>
                <Card className="bg-green-50 border-green-200">
                    <CardContent className="p-4 text-center">
                        <p className="text-3xl font-bold text-green-600">{montagensConcluidas.length}</p>
                        <p className="text-sm text-green-700">Concluídas</p>
                    </CardContent>
                </Card>
            </div>

            {/* Lista de Montagens Pendentes */}
            <div>
                <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-500" />
                    Aguardando Montador
                </h3>

                {montagensPendentes.length === 0 ? (
                    <Card className="p-8 text-center bg-gray-50">
                        <CheckCircle className="w-12 h-12 mx-auto text-green-400 mb-3" />
                        <p className="text-gray-500">Todas as montagens foram atribuídas!</p>
                    </Card>
                ) : (
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {montagensPendentes.map(montagem => (
                            <Card key={montagem.id} className="border-l-4 border-l-yellow-500">
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <p className="font-bold text-gray-900">#{montagem.numero_pedido}</p>
                                            <p className="text-sm text-gray-600">{montagem.produto_nome}</p>
                                            <p className="text-xs text-gray-500">Qtd: {montagem.quantidade}</p>
                                        </div>
                                        <Badge className={getStatusBadge(montagem.status).className}>
                                            {getStatusBadge(montagem.status).label}
                                        </Badge>
                                    </div>

                                    <div className="space-y-1 text-sm text-gray-600">
                                        <div className="flex items-center gap-2">
                                            <User className="w-3 h-3" />
                                            <span>{montagem.cliente_nome}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Phone className="w-3 h-3" />
                                            <span>{montagem.cliente_telefone}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <MapPin className="w-3 h-3" />
                                            <span className="line-clamp-1">{montagem.endereco}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Lista de Montagens Agendadas */}
            <div>
                <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-500" />
                    Montagens Agendadas
                </h3>

                {montagensAgendadas.length === 0 ? (
                    <Card className="p-6 text-center bg-gray-50">
                        <p className="text-gray-500">Nenhuma montagem agendada no momento</p>
                    </Card>
                ) : (
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {montagensAgendadas.map(montagem => {
                            const montador = montadores.find(m => m.id === montagem.montador_id);
                            return (
                                <Card key={montagem.id} className="border-l-4 border-l-blue-500">
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <p className="font-bold text-gray-900">#{montagem.numero_pedido}</p>
                                                <p className="text-sm text-gray-600">{montagem.produto_nome}</p>
                                            </div>
                                            <Badge className={getStatusBadge(montagem.status).className}>
                                                {getStatusBadge(montagem.status).label}
                                            </Badge>
                                        </div>

                                        <div className="space-y-1 text-sm text-gray-600">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-3 h-3" />
                                                <span className="font-medium">{formatarData(montagem.data_agendada)}</span>
                                                {montagem.horario_agendado && (
                                                    <span>às {montagem.horario_agendado}</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Wrench className="w-3 h-3" />
                                                <span>{montador?.nome || 'Montador não identificado'}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <User className="w-3 h-3" />
                                                <span>{montagem.cliente_nome}</span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
