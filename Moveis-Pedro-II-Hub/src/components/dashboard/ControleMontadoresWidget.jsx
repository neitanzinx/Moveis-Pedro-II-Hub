import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
    Wrench, Calendar, User, Clock, MapPin, Phone,
    CheckCircle, AlertCircle, CalendarDays, RotateCcw,
    DollarSign, FileText, TrendingUp
} from "lucide-react";
import { format, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function ControleMontadoresWidget() {
    const [mesRelatorio, setMesRelatorio] = useState(() => {
        const hoje = new Date();
        return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    });
    const [abaAtiva, setAbaAtiva] = useState('visao-geral');

    // Buscar todas as montagens terceirizadas
    const { data: montagens = [], isLoading } = useQuery({
        queryKey: ['montagens-externas-gestao'],
        queryFn: async () => {
            const todas = await base44.entities.MontagemItem.list('-created_at');
            return todas.filter(m => m.tipo_montagem === 'terceirizada');
        },
        refetchInterval: 60000
    });

    // Buscar montadores
    const { data: montadores = [] } = useQuery({
        queryKey: ['montadores-lista'],
        queryFn: () => base44.entities.Montador.list()
    });

    // Filtrar montagens do mês selecionado
    const montagensMes = useMemo(() => {
        if (!mesRelatorio) return montagens;
        const [ano, mes] = mesRelatorio.split('-').map(Number);
        const inicio = startOfMonth(new Date(ano, mes - 1));
        const fim = endOfMonth(new Date(ano, mes - 1));

        return montagens.filter(m => {
            if (!m.data_agendada && !m.created_at) return false;
            const data = new Date(m.data_agendada || m.created_at);
            return isWithinInterval(data, { start: inicio, end: fim });
        });
    }, [montagens, mesRelatorio]);

    // KPIs
    const kpis = useMemo(() => {
        const pendentes = montagens.filter(m => m.status === 'pendente');
        const agendadas = montagens.filter(m => m.status === 'agendada' || m.status === 'confirmada');
        const emAndamento = montagens.filter(m => m.status === 'em_andamento');
        const concluidasMes = montagensMes.filter(m => m.status === 'concluida');
        const valorTotalMes = concluidasMes.reduce((sum, m) => sum + (m.valor_montagem || 0), 0);

        // Reagendadas (se tiver campo de reagendamento ou lógica)
        const reagendadas = montagens.filter(m => m.reagendada === true);

        return {
            pendentes: pendentes.length,
            agendadas: agendadas.length,
            emAndamento: emAndamento.length,
            concluidas: concluidasMes.length,
            reagendadas: reagendadas.length,
            valorTotalMes
        };
    }, [montagens, montagensMes]);

    // Relatório por montador
    const relatorioPorMontador = useMemo(() => {
        const agrupado = {};

        montagensMes.filter(m => m.status === 'concluida').forEach(m => {
            const montadorId = m.montador_id || 'sem_montador';
            const montadorNome = m.montador_nome || 'Não atribuído';

            if (!agrupado[montadorId]) {
                agrupado[montadorId] = {
                    id: montadorId,
                    nome: montadorNome,
                    qtdMontagens: 0,
                    valorTotal: 0,
                    montagens: []
                };
            }
            agrupado[montadorId].qtdMontagens += 1;
            agrupado[montadorId].valorTotal += m.valor_montagem || 0;
            agrupado[montadorId].montagens.push(m);
        });

        return Object.values(agrupado).sort((a, b) => b.valorTotal - a.valorTotal);
    }, [montagensMes]);

    const valorTotalRelatorio = relatorioPorMontador.reduce((sum, m) => sum + m.valorTotal, 0);

    const getStatusConfig = (status) => {
        const config = {
            pendente: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
            agendada: { label: 'Agendada', color: 'bg-blue-100 text-blue-800', icon: Calendar },
            confirmada: { label: 'Confirmada', color: 'bg-green-100 text-green-800', icon: CheckCircle },
            em_andamento: { label: 'Em Andamento', color: 'bg-purple-100 text-purple-800', icon: Wrench },
            concluida: { label: 'Concluída', color: 'bg-gray-100 text-gray-600', icon: CheckCircle }
        };
        return config[status] || { label: status, color: 'bg-gray-100 text-gray-600', icon: AlertCircle };
    };

    const formatarMoeda = (valor) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
    };

    const formatarData = (dataStr) => {
        if (!dataStr) return '-';
        return format(new Date(dataStr), 'dd/MM/yyyy', { locale: ptBR });
    };

    // Montagens ativas (não concluídas)
    const montagensAtivas = montagens.filter(m => m.status !== 'concluida');

    return (
        <Card className="col-span-full border-orange-200 bg-orange-50/30">
            <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="text-orange-800 flex items-center gap-2">
                            <Wrench className="w-5 h-5" />
                            Controle de Montadores Externos
                        </CardTitle>
                        <CardDescription>
                            Visão gerencial de montagens terceirizadas
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Select value={mesRelatorio} onValueChange={setMesRelatorio}>
                            <SelectTrigger className="w-[140px]">
                                <CalendarDays className="w-4 h-4 mr-2" />
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Array.from({ length: 6 }, (_, i) => {
                                    const d = new Date();
                                    d.setMonth(d.getMonth() - i);
                                    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                                    const label = format(d, 'MMMM yyyy', { locale: ptBR });
                                    return <SelectItem key={val} value={val}>{label}</SelectItem>;
                                })}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {/* KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                    <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                        <p className="text-xs text-yellow-600 font-medium">Pendentes</p>
                        <p className="text-2xl font-bold text-yellow-700">{kpis.pendentes}</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                        <p className="text-xs text-blue-600 font-medium">Agendadas</p>
                        <p className="text-2xl font-bold text-blue-700">{kpis.agendadas}</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                        <p className="text-xs text-purple-600 font-medium">Em Andamento</p>
                        <p className="text-2xl font-bold text-purple-700">{kpis.emAndamento}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                        <p className="text-xs text-green-600 font-medium">Concluídas (mês)</p>
                        <p className="text-2xl font-bold text-green-700">{kpis.concluidas}</p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                        <p className="text-xs text-orange-600 font-medium">Valor Total (mês)</p>
                        <p className="text-xl font-bold text-orange-700">{formatarMoeda(kpis.valorTotalMes)}</p>
                    </div>
                </div>

                <Tabs value={abaAtiva} onValueChange={setAbaAtiva}>
                    <TabsList className="grid grid-cols-3 mb-4">
                        <TabsTrigger value="visao-geral">
                            <Clock className="w-4 h-4 mr-1" />
                            Ativas
                        </TabsTrigger>
                        <TabsTrigger value="agenda">
                            <Calendar className="w-4 h-4 mr-1" />
                            Agenda
                        </TabsTrigger>
                        <TabsTrigger value="relatorio">
                            <FileText className="w-4 h-4 mr-1" />
                            Relatório
                        </TabsTrigger>
                    </TabsList>

                    {/* Aba Visão Geral - Montagens Ativas */}
                    <TabsContent value="visao-geral" className="mt-0">
                        <div className="max-h-[400px] overflow-y-auto">
                            {montagensAtivas.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-400" />
                                    <p>Todas as montagens foram concluídas!</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Pedido</TableHead>
                                            <TableHead>Cliente</TableHead>
                                            <TableHead>Montador</TableHead>
                                            <TableHead>Data Agendada</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Valor</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {montagensAtivas.map(m => {
                                            const statusConfig = getStatusConfig(m.status);
                                            return (
                                                <TableRow key={m.id}>
                                                    <TableCell className="font-medium">#{m.numero_pedido}</TableCell>
                                                    <TableCell>
                                                        <div>
                                                            <p className="text-sm">{m.cliente_nome}</p>
                                                            <p className="text-xs text-gray-500 truncate max-w-[150px]">{m.produto_nome}</p>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {m.montador_nome || (
                                                            <span className="text-orange-600 text-xs">Não atribuído</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {m.data_agendada ? (
                                                            <div className="flex items-center gap-1">
                                                                <Calendar className="w-3 h-3" />
                                                                {formatarData(m.data_agendada)}
                                                                {m.horario_agendado && (
                                                                    <span className="text-xs text-gray-500">({m.horario_agendado})</span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-400 text-xs">A definir</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge className={statusConfig.color}>
                                                            {statusConfig.label}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium">
                                                        {formatarMoeda(m.valor_montagem)}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            )}
                        </div>
                    </TabsContent>

                    {/* Aba Agenda */}
                    <TabsContent value="agenda" className="mt-0">
                        <div className="max-h-[400px] overflow-y-auto space-y-2">
                            {montagens
                                .filter(m => m.data_agendada && m.status !== 'concluida')
                                .sort((a, b) => new Date(a.data_agendada) - new Date(b.data_agendada))
                                .map(m => {
                                    const dataAgendada = new Date(m.data_agendada);
                                    const isHoje = dataAgendada.toDateString() === new Date().toDateString();
                                    const statusConfig = getStatusConfig(m.status);

                                    return (
                                        <div key={m.id} className={`flex items-center gap-4 p-3 rounded-lg border ${isHoje ? 'bg-orange-50 border-orange-300' : 'bg-white border-gray-200'}`}>
                                            <div className={`text-center p-2 rounded-lg min-w-[50px] ${isHoje ? 'bg-orange-500 text-white' : 'bg-gray-100'}`}>
                                                <p className="text-xs font-medium">
                                                    {format(dataAgendada, 'EEE', { locale: ptBR })}
                                                </p>
                                                <p className="text-lg font-bold">{format(dataAgendada, 'dd')}</p>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-gray-900">#{m.numero_pedido} - {m.produto_nome}</p>
                                                <p className="text-sm text-gray-600">{m.cliente_nome}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <User className="w-3 h-3 text-orange-500" />
                                                    <span className="text-xs text-gray-500">{m.montador_nome || 'Sem montador'}</span>
                                                    {m.horario_agendado && (
                                                        <>
                                                            <Clock className="w-3 h-3 text-gray-400" />
                                                            <span className="text-xs text-gray-500">{m.horario_agendado}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                                        </div>
                                    );
                                })}
                            {montagens.filter(m => m.data_agendada && m.status !== 'concluida').length === 0 && (
                                <div className="text-center py-8 text-gray-500">
                                    <Calendar className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                    <p>Nenhuma montagem agendada</p>
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    {/* Aba Relatório Mensal */}
                    <TabsContent value="relatorio" className="mt-0">
                        <div className="space-y-4">
                            {/* Resumo */}
                            <div className="bg-gradient-to-r from-orange-100 to-orange-50 rounded-lg p-4 border border-orange-200">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="text-sm text-orange-600 font-medium">Total de Montagens Concluídas</p>
                                        <p className="text-3xl font-bold text-orange-800">{kpis.concluidas}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-orange-600 font-medium">Valor Total a Pagar</p>
                                        <p className="text-3xl font-bold text-orange-800">{formatarMoeda(valorTotalRelatorio)}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Detalhamento por Montador */}
                            <div className="max-h-[300px] overflow-y-auto">
                                {relatorioPorMontador.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500">
                                        <FileText className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                        <p>Nenhuma montagem concluída neste mês</p>
                                    </div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Montador</TableHead>
                                                <TableHead className="text-center">Qtd. Montagens</TableHead>
                                                <TableHead className="text-right">Valor Total</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {relatorioPorMontador.map(montador => (
                                                <TableRow key={montador.id}>
                                                    <TableCell className="font-medium">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                                                                <User className="w-4 h-4 text-orange-600" />
                                                            </div>
                                                            {montador.nome}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge variant="secondary">{montador.qtdMontagens}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right font-bold text-green-600">
                                                        {formatarMoeda(montador.valorTotal)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
