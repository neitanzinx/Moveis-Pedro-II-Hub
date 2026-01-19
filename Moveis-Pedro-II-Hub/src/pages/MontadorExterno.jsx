import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Calendar, MapPin, Phone, User, Clock, Package,
    CheckCircle, AlertCircle, Navigation, MessageCircle,
    Wrench, CalendarDays, ListTodo, ExternalLink, LogOut, XCircle
} from "lucide-react";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";

export default function MontadorExterno() {
    const [user, setUser] = useState(null);
    const [montador, setMontador] = useState(null);
    const [activeTab, setActiveTab] = useState("disponiveis");
    const [selectedMontagem, setSelectedMontagem] = useState(null);
    const [agendamentoModal, setAgendamentoModal] = useState(false);
    const [agendamentoData, setAgendamentoData] = useState({ data: "", horario: "" });

    const queryClient = useQueryClient();

    useEffect(() => {
        base44.auth.me().then(setUser).catch(console.error);
    }, []);

    // Buscar dados do montador baseado no usuário logado
    const { data: montadores = [] } = useQuery({
        queryKey: ['montadores'],
        queryFn: () => base44.entities.Montador.list(),
        enabled: !!user
    });

    useEffect(() => {
        if (user && montadores.length > 0) {
            const meuMontador = montadores.find(m => m.usuario_id === user.id);
            if (meuMontador?.status === 'ativo') {
                setMontador(meuMontador);
            } else if (meuMontador?.status === 'pendente_aprovacao') {
                setMontadorPendente(meuMontador);
            }
        }
    }, [user, montadores]);

    // Buscar montagens disponíveis (sem montador atribuído E com entrega já concluída)
    const { data: montagensDisponiveis = [] } = useQuery({
        queryKey: ['montagens-disponiveis'],
        queryFn: async () => {
            const [todas, entregas] = await Promise.all([
                base44.entities.MontagemItem.list('-created_at'),
                base44.entities.Entrega.list()
            ]);

            // IDs de entregas que já foram concluídas
            const idsEntregasEntregues = entregas
                .filter(e => e.status === 'Entregue')
                .map(e => e.id);

            return todas.filter(m =>
                m.tipo_montagem === 'terceirizada' &&
                !m.montador_id &&
                m.status === 'pendente' &&
                idsEntregasEntregues.includes(m.entrega_id) // Só mostra se entrega foi concluída
            );
        },
        enabled: !!montador || user?.cargo === 'Administrador',
        refetchOnMount: 'always',
        staleTime: 0,
        refetchInterval: 30000 // Atualiza a cada 30 segundos
    });

    // Buscar minhas montagens
    const { data: minhasMontagens = [] } = useQuery({
        queryKey: ['minhas-montagens', montador?.id],
        queryFn: async () => {
            const todas = await base44.entities.MontagemItem.list('-data_agendada');
            // Admin vê todas terceirizadas, montador vê só as dele
            if (user?.cargo === 'Administrador' && !montador) {
                return todas.filter(m => m.tipo_montagem === 'terceirizada');
            }
            return todas.filter(m => m.montador_id === montador?.id);
        },
        enabled: !!montador || user?.cargo === 'Administrador'
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.MontagemItem.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['montagens-disponiveis'] });
            queryClient.invalidateQueries({ queryKey: ['minhas-montagens'] });
        }
    });

    // Pegar montagem para si
    const pegarMontagem = async (montagem) => {
        setSelectedMontagem(montagem);
        setAgendamentoModal(true);
    };

    // Confirmar agendamento
    const confirmarAgendamento = async () => {
        if (!agendamentoData.data || !agendamentoData.horario) {
            toast.warning("Selecione data e turno");
            return;
        }

        // Para admin sem registro de montador, usar dados do próprio usuário
        const montadorData = montador || (user?.cargo === 'Administrador' ? {
            id: user.id,
            nome: user.full_name || user.email?.split('@')[0] || 'Administrador',
            telefone: user.telefone || ''
        } : null);

        if (!montadorData) {
            toast.error("Erro: Montador não identificado. Verifique seu cadastro.");
            console.error("Montador não encontrado para o usuário:", user);
            return;
        }

        if (!selectedMontagem) {
            toast.error("Erro: Nenhuma montagem selecionada.");
            return;
        }

        try {
            console.log("Agendando montagem:", selectedMontagem.id, "para montador:", montadorData.id);

            await updateMutation.mutateAsync({
                id: selectedMontagem.id,
                data: {
                    montador_id: montadorData.id,
                    montador_nome: montadorData.nome,
                    montador_telefone: montadorData.telefone,
                    data_agendada: agendamentoData.data,
                    horario_agendado: agendamentoData.horario,
                    status: 'agendada'
                }
            });

            // Enviar mensagem ao cliente VIA BOT
            const dataFormatada = new Date(agendamentoData.data + 'T12:00:00').toLocaleDateString('pt-BR', {
                weekday: 'long',
                day: '2-digit',
                month: 'long'
            });

            try {
                await fetch('http://localhost:3001/aviso-montagem-agendada', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        telefone: selectedMontagem.cliente_telefone,
                        cliente_nome: selectedMontagem.cliente_nome,
                        numero_pedido: selectedMontagem.numero_pedido,
                        produto_nome: selectedMontagem.produto_nome,
                        data_formatada: dataFormatada,
                        turno: agendamentoData.horario,
                        montador_nome: montadorData.nome,
                        montador_telefone: montadorData.telefone
                    })
                });
                toast.success("Montagem agendada! Cliente notificado via WhatsApp.");
            } catch (botError) {
                console.error("Erro ao notificar via bot:", botError);
                toast.success("Montagem agendada! (Bot offline - cliente não notificado)");
            }

            setAgendamentoModal(false);
            setAgendamentoData({ data: "", horario: "" });
            setSelectedMontagem(null);
        } catch (e) {
            console.error("Erro ao agendar montagem:", e);
            toast.error("Erro ao agendar montagem: " + (e.message || "Erro desconhecido"));
        }
    };

    // Abrir WhatsApp com mensagem "a caminho"
    const abrirWhatsAppACaminho = (montagem) => {
        const telefone = montagem.cliente_telefone?.replace(/\D/g, '');
        const mensagem = encodeURIComponent(
            `Olá ${montagem.cliente_nome}! \n\n` +
            `Aqui é o montador da *Móveis Pedro II*.\n` +
            `Estou *a caminho* do seu endereço para realizar a montagem do seu pedido #${montagem.numero_pedido}!\n\n` +
            `Previsão de chegada: em breve.\n\n` +
            `Qualquer dúvida, estou à disposição!`
        );
        window.open(`https://wa.me/55${telefone}?text=${mensagem}`, '_blank');

        // Atualizar status
        updateMutation.mutate({
            id: montagem.id,
            data: { status: 'em_andamento' }
        });
    };

    // Finalizar montagem
    const finalizarMontagem = async (montagem) => {
        try {
            await updateMutation.mutateAsync({
                id: montagem.id,
                data: { status: 'concluida' }
            });
            toast.success("Montagem concluída!");
        } catch (e) {
            toast.error("Erro ao finalizar montagem");
        }
    };

    // Cancelar montagem (volta para triagem)
    const cancelarMontagem = async (montagem) => {
        const confirmar = window.confirm(
            `⚠️ ATENÇÃO: Esta ação irá:\n\n` +
            `• Devolver a montagem para a triagem\n` +
            `• Notificar o cliente "${montagem.cliente_nome}" via WhatsApp\n\n` +
            `Deseja realmente cancelar esta montagem?`
        );

        if (!confirmar) return;

        try {
            // Voltar para triagem
            await updateMutation.mutateAsync({
                id: montagem.id,
                data: {
                    status: 'pendente',
                    montador_id: null,
                    montador_nome: null,
                    montador_telefone: null,
                    data_agendada: null,
                    horario_agendado: null,
                    cancelado_por: montador?.nome || 'Montador',
                    cancelado_em: new Date().toISOString()
                }
            });

            // Notificar cliente via bot
            try {
                await fetch('http://localhost:3001/aviso-montagem-cancelada', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        telefone: montagem.cliente_telefone,
                        cliente_nome: montagem.cliente_nome,
                        numero_pedido: montagem.numero_pedido,
                        produto_nome: montagem.produto_nome
                    })
                });
                toast.success("Montagem cancelada. Cliente notificado via WhatsApp.");
            } catch (botError) {
                console.error("Erro ao notificar via bot:", botError);
                toast.warning("Montagem cancelada. (Bot offline - cliente não notificado)");
            }
        } catch (e) {
            console.error("Erro ao cancelar montagem:", e);
            toast.error("Erro ao cancelar montagem");
        }
    };

    // Estado para modal de reagendamento
    const [reagendarModal, setReagendarModal] = useState(false);
    const [reagendarData, setReagendarData] = useState({ data: "", horario: "" });
    const [montagemReagendar, setMontagemReagendar] = useState(null);

    // Abrir modal de reagendamento
    const abrirReagendar = (montagem) => {
        setMontagemReagendar(montagem);
        setReagendarData({
            data: montagem.data_agendada || "",
            horario: montagem.horario_agendado || ""
        });
        setReagendarModal(true);
    };

    // Confirmar reagendamento
    const confirmarReagendamento = async () => {
        if (!reagendarData.data || !reagendarData.horario) {
            toast.warning("Selecione data e turno");
            return;
        }

        const confirmar = window.confirm(
            `📅 O cliente "${montagemReagendar.cliente_nome}" será notificado sobre a nova data.\n\n` +
            `Confirmar reagendamento?`
        );

        if (!confirmar) return;

        try {
            const dataFormatada = new Date(reagendarData.data + 'T12:00:00').toLocaleDateString('pt-BR', {
                weekday: 'long',
                day: '2-digit',
                month: 'long'
            });

            // Atualizar montagem
            await updateMutation.mutateAsync({
                id: montagemReagendar.id,
                data: {
                    data_agendada: reagendarData.data,
                    horario_agendado: reagendarData.horario,
                    reagendado_em: new Date().toISOString()
                }
            });

            // Notificar cliente via bot
            try {
                await fetch('http://localhost:3001/aviso-montagem-reagendada', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        telefone: montagemReagendar.cliente_telefone,
                        cliente_nome: montagemReagendar.cliente_nome,
                        numero_pedido: montagemReagendar.numero_pedido,
                        produto_nome: montagemReagendar.produto_nome,
                        data_formatada: dataFormatada,
                        turno: reagendarData.horario,
                        montador_nome: montador?.nome
                    })
                });
                toast.success("Montagem reagendada! Cliente notificado via WhatsApp.");
            } catch (botError) {
                console.error("Erro ao notificar via bot:", botError);
                toast.warning("Montagem reagendada. (Bot offline - cliente não notificado)");
            }

            setReagendarModal(false);
            setMontagemReagendar(null);
        } catch (e) {
            console.error("Erro ao reagendar montagem:", e);
            toast.error("Erro ao reagendar montagem");
        }
    };


    // Abrir Google Maps com endereço
    const abrirMapa = (endereco) => {
        const enderecoEncoded = encodeURIComponent(endereco);
        window.open(`https://www.google.com/maps/search/?api=1&query=${enderecoEncoded}`, '_blank');
    };

    // Ligar para cliente
    const ligarCliente = (telefone) => {
        const tel = telefone?.replace(/\D/g, '');
        window.open(`tel:+55${tel}`, '_self');
    };

    const formatarData = (dataStr) => {
        if (!dataStr) return "A definir";
        const data = new Date(dataStr);
        return data.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
    };

    const getStatusBadge = (status) => {
        const config = {
            pendente: { label: 'Pendente', className: 'bg-yellow-100 text-yellow-800' },
            agendada: { label: 'Agendada', className: 'bg-blue-100 text-blue-800' },
            confirmada: { label: 'Confirmada', className: 'bg-green-100 text-green-800' },
            em_andamento: { label: 'A Caminho', className: 'bg-purple-100 text-purple-800' },
            concluida: { label: 'Concluída', className: 'bg-gray-100 text-gray-800' }
        };
        return config[status] || { label: status, className: 'bg-gray-100 text-gray-600' };
    };

    // Se não está logado, redirecionar para login
    if (!user) {
        return (
            <div className="flex flex-col h-screen items-center justify-center p-6 bg-gradient-to-br from-orange-50 to-orange-100">
                <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-sm">
                    <img
                        src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/690ce4cb64e20af6b4a46b6f/3474ff954_undefined-Imgur.png"
                        alt="Móveis Pedro II"
                        className="h-16 w-auto mx-auto mb-4"
                    />
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Área do Montador</h2>
                    <p className="text-gray-600 mb-6">
                        Faça login ou cadastre-se para acessar.
                    </p>
                    <Button
                        className="w-full bg-orange-500 hover:bg-orange-600"
                        onClick={() => window.location.href = '/'}
                    >
                        Ir para Login
                    </Button>
                </div>
            </div>
        );
    }

    // Admin pode visualizar como modo de teste
    const isAdmin = user?.cargo === 'Administrador';
    const isMontador = user?.cargo === 'Montador Externo';
    const isPendente = user?.status_aprovacao === 'Pendente';

    // Tela de aguardando aprovação
    if (isPendente && isMontador) {
        return (
            <div className="flex flex-col h-screen items-center justify-center p-6 bg-gradient-to-br from-orange-50 to-orange-100">
                <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-sm">
                    <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Clock className="w-10 h-10 text-orange-500" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Aguardando Aprovação</h2>
                    <p className="text-gray-600 mb-4">
                        Sua solicitação está sendo analisada pelo administrador.
                    </p>
                    <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => {
                            base44.auth.signOut();
                            window.location.href = '/';
                        }}
                    >
                        <LogOut className="w-4 h-4 mr-2" />
                        Sair
                    </Button>
                </div>
            </div>
        );
    }

    // Usuário não é montador - acesso negado
    if (!isMontador && !isAdmin) {
        return (
            <div className="flex flex-col h-screen items-center justify-center p-6 bg-gradient-to-br from-orange-50 to-orange-100">
                <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-sm">
                    <AlertCircle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Acesso Negado</h2>
                    <p className="text-gray-600 mb-4">
                        Você não possui permissão de Montador Externo.
                    </p>
                    <p className="text-sm text-gray-500 mb-6">
                        Se você é montador, faça um novo cadastro selecionando "Montador Externo" como cargo.
                    </p>
                    <Button
                        variant="outline"
                        onClick={() => {
                            base44.auth.signOut();
                            window.location.href = '/';
                        }}
                    >
                        <LogOut className="w-4 h-4 mr-2" />
                        Sair e Recadastrar
                    </Button>
                </div>
            </div>
        );
    }

    // Admin vendo como teste mostra dados fake
    const montadorDisplay = montador || { nome: 'Admin (Teste)', id: null };

    const montagensHoje = minhasMontagens.filter(m => {
        const hoje = new Date().toISOString().split('T')[0];
        return m.data_agendada === hoje && m.status !== 'concluida';
    });

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header Mobile-First */}
            <header className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-4 pb-6 rounded-b-3xl shadow-lg">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <img
                            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/690ce4cb64e20af6b4a46b6f/3474ff954_undefined-Imgur.png"
                            alt="Móveis Pedro II"
                            className="h-[52px] w-auto rounded-xl object-contain"
                        />
                        <div>
                            <h1 className="font-bold text-lg">Olá, {montadorDisplay.nome?.split(' ')[0]}!</h1>
                            <p className="text-orange-100 text-sm">Montador Externo</p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-white hover:bg-white/20"
                        onClick={() => {
                            base44.auth.signOut();
                            window.location.href = '/';
                        }}
                    >
                        <LogOut className="w-5 h-5" />
                    </Button>
                </div>

                {/* Cards de Resumo */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white/20 backdrop-blur rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold">{montagensDisponiveis.length}</p>
                        <p className="text-xs text-orange-100">Disponíveis</p>
                    </div>
                    <div className="bg-white/20 backdrop-blur rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold">{montagensHoje.length}</p>
                        <p className="text-xs text-orange-100">Hoje</p>
                    </div>
                    <div className="bg-white/20 backdrop-blur rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold">
                            {minhasMontagens.filter(m => m.status === 'concluida').length}
                        </p>
                        <p className="text-xs text-orange-100">Concluídas</p>
                    </div>
                </div>
            </header>

            {/* Tabs Mobile */}
            <div className="px-4 -mt-4">
                <div className="bg-white rounded-2xl shadow-md overflow-hidden">
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="grid grid-cols-3 bg-gray-100 p-1 m-2 rounded-xl">
                            <TabsTrigger
                                value="disponiveis"
                                className="rounded-lg text-xs py-2 data-[state=active]:bg-green-600 data-[state=active]:text-white"
                            >
                                <ListTodo className="w-4 h-4 mr-1" />
                                Pegar
                            </TabsTrigger>
                            <TabsTrigger
                                value="minhas"
                                className="rounded-lg text-xs py-2 data-[state=active]:bg-orange-500 data-[state=active]:text-white"
                            >
                                <Package className="w-4 h-4 mr-1" />
                                Minhas
                            </TabsTrigger>
                            <TabsTrigger
                                value="agenda"
                                className="rounded-lg text-xs py-2 data-[state=active]:bg-orange-500 data-[state=active]:text-white"
                            >
                                <CalendarDays className="w-4 h-4 mr-1" />
                                Agenda
                            </TabsTrigger>
                        </TabsList>

                        {/* Aba Disponíveis */}
                        <TabsContent value="disponiveis" className="p-4 space-y-3">
                            {montagensDisponiveis.length === 0 ? (
                                <div className="text-center py-8">
                                    <CheckCircle className="w-16 h-16 mx-auto text-green-400 mb-3" />
                                    <p className="text-gray-500 font-medium">Tudo certo!</p>
                                    <p className="text-gray-400 text-sm">Nenhuma montagem disponível</p>
                                </div>
                            ) : (
                                montagensDisponiveis.map(montagem => (
                                    <div key={montagem.id} className="bg-gray-50 rounded-xl p-4 border-l-4 border-orange-500">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <p className="font-bold text-gray-900">#{montagem.numero_pedido}</p>
                                                <p className="text-sm text-gray-600">{montagem.produto_nome}</p>
                                                <p className="text-xs text-gray-500">Qtd: {montagem.quantidade}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-2 mb-4">
                                            <button
                                                onClick={() => ligarCliente(montagem.cliente_telefone)}
                                                className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 w-full"
                                            >
                                                <User className="w-4 h-4" />
                                                <span>{montagem.cliente_nome}</span>
                                            </button>
                                            <button
                                                onClick={() => abrirMapa(montagem.endereco)}
                                                className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 w-full"
                                            >
                                                <MapPin className="w-4 h-4 flex-shrink-0" />
                                                <span className="text-left line-clamp-2">{montagem.endereco}</span>
                                                <ExternalLink className="w-3 h-3 ml-auto" />
                                            </button>
                                        </div>

                                        <Button
                                            className="w-full bg-orange-500 hover:bg-orange-600 h-12 text-base rounded-xl"
                                            onClick={() => pegarMontagem(montagem)}
                                        >
                                            <Calendar className="w-5 h-5 mr-2" />
                                            Pegar Montagem
                                        </Button>
                                    </div>
                                ))
                            )}
                        </TabsContent>

                        {/* Aba Minhas Montagens */}
                        <TabsContent value="minhas" className="p-4 space-y-3">
                            {minhasMontagens.filter(m => m.status !== 'concluida').length === 0 ? (
                                <div className="text-center py-8">
                                    <Package className="w-16 h-16 mx-auto text-gray-300 mb-3" />
                                    <p className="text-gray-500">Nenhuma montagem pendente</p>
                                </div>
                            ) : (
                                minhasMontagens.filter(m => m.status !== 'concluida').map(montagem => (
                                    <div key={montagem.id} className="bg-gray-50 rounded-xl p-4 border-l-4 border-blue-500">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <p className="font-bold text-gray-900">#{montagem.numero_pedido}</p>
                                                <p className="text-sm text-gray-600">{montagem.produto_nome}</p>
                                            </div>
                                            <Badge className={getStatusBadge(montagem.status).className}>
                                                {getStatusBadge(montagem.status).label}
                                            </Badge>
                                        </div>

                                        <div className="bg-blue-50 rounded-lg p-3 mb-3">
                                            <div className="flex items-center gap-2 text-blue-700 font-medium">
                                                <Calendar className="w-4 h-4" />
                                                <span>{formatarData(montagem.data_agendada)}</span>
                                                <span>•</span>
                                                <Clock className="w-4 h-4" />
                                                <span>{montagem.horario_agendado}</span>
                                            </div>
                                        </div>

                                        <div className="space-y-2 mb-4">
                                            <button
                                                onClick={() => ligarCliente(montagem.cliente_telefone)}
                                                className="flex items-center gap-2 text-sm text-gray-600 active:bg-gray-100 rounded p-1 -ml-1 w-full"
                                            >
                                                <Phone className="w-4 h-4 text-green-600" />
                                                <span>{montagem.cliente_nome}</span>
                                            </button>
                                            <button
                                                onClick={() => abrirMapa(montagem.endereco)}
                                                className="flex items-center gap-2 text-sm text-gray-600 active:bg-gray-100 rounded p-1 -ml-1 w-full"
                                            >
                                                <MapPin className="w-4 h-4 text-red-500 flex-shrink-0" />
                                                <span className="text-left line-clamp-2">{montagem.endereco}</span>
                                                <ExternalLink className="w-3 h-3 ml-auto text-gray-400" />
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            {montagem.status === 'agendada' && (
                                                <>
                                                    <Button
                                                        className="bg-green-500 hover:bg-green-600 h-12 rounded-xl"
                                                        onClick={() => abrirWhatsAppACaminho(montagem)}
                                                    >
                                                        <Navigation className="w-4 h-4 mr-2" />
                                                        A Caminho
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        className="h-12 rounded-xl border-orange-300 text-orange-600 hover:bg-orange-50"
                                                        onClick={() => abrirReagendar(montagem)}
                                                    >
                                                        <Calendar className="w-4 h-4 mr-2" />
                                                        Reagendar
                                                    </Button>
                                                </>
                                            )}
                                            {montagem.status === 'em_andamento' && (
                                                <Button
                                                    className="bg-green-600 hover:bg-green-700 h-12 rounded-xl"
                                                    onClick={() => finalizarMontagem(montagem)}
                                                >
                                                    <CheckCircle className="w-4 h-4 mr-2" />
                                                    Concluir
                                                </Button>
                                            )}
                                            <Button
                                                variant="outline"
                                                className="h-12 rounded-xl"
                                                onClick={() => {
                                                    const tel = montagem.cliente_telefone?.replace(/\D/g, '');
                                                    window.open(`https://wa.me/55${tel}`, '_blank');
                                                }}
                                            >
                                                <MessageCircle className="w-4 h-4 mr-2" />
                                                WhatsApp
                                            </Button>
                                        </div>
                                        {/* Botão de Cancelar montagem */}
                                        {(montagem.status === 'agendada' || montagem.status === 'pendente') && (
                                            <Button
                                                variant="ghost"
                                                className="w-full mt-2 h-10 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-xl"
                                                onClick={() => cancelarMontagem(montagem)}
                                            >
                                                <XCircle className="w-4 h-4 mr-2" />
                                                Desistir desta Montagem
                                            </Button>
                                        )}
                                    </div>
                                ))
                            )}
                        </TabsContent>

                        {/* Aba Agenda */}
                        <TabsContent value="agenda" className="p-4 space-y-3">
                            <h3 className="font-bold text-gray-900">Próximas Montagens</h3>
                            {minhasMontagens.filter(m => m.status !== 'concluida').length === 0 ? (
                                <div className="text-center py-8">
                                    <CalendarDays className="w-16 h-16 mx-auto text-gray-300 mb-3" />
                                    <p className="text-gray-500">Nenhuma montagem agendada</p>
                                </div>
                            ) : (
                                minhasMontagens
                                    .filter(m => m.status !== 'concluida')
                                    .sort((a, b) => new Date(a.data_agendada) - new Date(b.data_agendada))
                                    .map(montagem => (
                                        <div key={montagem.id} className="flex items-center gap-4 bg-gray-50 rounded-xl p-3">
                                            <div className="text-center bg-blue-100 rounded-xl p-2 min-w-[50px]">
                                                <p className="text-xs text-blue-600 font-medium">
                                                    {montagem.data_agendada ?
                                                        new Date(montagem.data_agendada).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
                                                        : '-'
                                                    }
                                                </p>
                                                <p className="text-lg font-bold text-blue-700">
                                                    {montagem.data_agendada ? new Date(montagem.data_agendada).getDate() : '-'}
                                                </p>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-gray-900 truncate">{montagem.produto_nome}</p>
                                                <p className="text-sm text-gray-500 truncate">
                                                    {montagem.horario_agendado} • {montagem.cliente_nome}
                                                </p>
                                            </div>
                                            <Badge className={`${getStatusBadge(montagem.status).className} text-xs`}>
                                                {getStatusBadge(montagem.status).label}
                                            </Badge>
                                        </div>
                                    ))
                            )}
                        </TabsContent>
                    </Tabs>
                </div>
            </div>

            {/* Modal de Agendamento */}
            <Dialog open={agendamentoModal} onOpenChange={setAgendamentoModal}>
                <DialogContent className="mx-4 rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-center">Agendar Montagem</DialogTitle>
                    </DialogHeader>

                    {selectedMontagem && (
                        <div className="space-y-4">
                            <div className="bg-orange-50 p-4 rounded-xl">
                                <p className="font-bold text-gray-900">{selectedMontagem.produto_nome}</p>
                                <p className="text-sm text-gray-600">{selectedMontagem.cliente_nome}</p>
                                <p className="text-sm text-gray-500">{selectedMontagem.endereco}</p>
                            </div>

                            <div>
                                <Label className="text-gray-700">Data da Montagem</Label>
                                <Input
                                    type="date"
                                    value={agendamentoData.data}
                                    onChange={e => setAgendamentoData({ ...agendamentoData, data: e.target.value })}
                                    min={new Date().toISOString().split('T')[0]}
                                    className="h-12 rounded-xl"
                                />
                            </div>

                            <div>
                                <Label className="text-gray-700">Turno</Label>
                                <Select
                                    value={agendamentoData.horario}
                                    onValueChange={value => setAgendamentoData({ ...agendamentoData, horario: value })}
                                >
                                    <SelectTrigger className="h-12 rounded-xl">
                                        <SelectValue placeholder="Selecione o turno" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Manhã">☀️ Manhã (08h - 12h)</SelectItem>
                                        <SelectItem value="Tarde">🌅 Tarde (13h - 17h)</SelectItem>
                                        <SelectItem value="Comercial">💼 Comercial (08h - 17h)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="flex-col gap-2 sm:flex-col">
                        <Button
                            onClick={confirmarAgendamento}
                            className="w-full bg-orange-500 hover:bg-orange-600 h-12 rounded-xl"
                        >
                            Confirmar Agendamento
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={() => setAgendamentoModal(false)}
                            className="w-full h-12"
                        >
                            Cancelar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal de Reagendamento */}
            <Dialog open={reagendarModal} onOpenChange={setReagendarModal}>
                <DialogContent className="max-w-md mx-4">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-orange-500" />
                            Reagendar Montagem
                        </DialogTitle>
                    </DialogHeader>

                    {montagemReagendar && (
                        <div className="space-y-4">
                            <div className="bg-gray-50 rounded-xl p-3">
                                <p className="font-bold">#{montagemReagendar.numero_pedido}</p>
                                <p className="text-sm text-gray-600">{montagemReagendar.produto_nome}</p>
                                <p className="text-sm text-gray-500">{montagemReagendar.cliente_nome}</p>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <Label className="text-sm font-medium">Nova Data</Label>
                                    <Input
                                        type="date"
                                        value={reagendarData.data}
                                        onChange={e => setReagendarData({ ...reagendarData, data: e.target.value })}
                                        className="h-12 rounded-xl mt-1"
                                        min={new Date().toISOString().split('T')[0]}
                                    />
                                </div>
                                <div>
                                    <Label className="text-sm font-medium">Novo Turno</Label>
                                    <Select
                                        value={reagendarData.horario}
                                        onValueChange={value => setReagendarData({ ...reagendarData, horario: value })}
                                    >
                                        <SelectTrigger className="h-12 rounded-xl mt-1">
                                            <SelectValue placeholder="Selecione o turno" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Manhã">☀️ Manhã (08h - 12h)</SelectItem>
                                            <SelectItem value="Tarde">🌅 Tarde (13h - 17h)</SelectItem>
                                            <SelectItem value="Comercial">💼 Comercial (08h - 17h)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="flex-col gap-2 sm:flex-col">
                        <Button
                            onClick={confirmarReagendamento}
                            className="w-full bg-orange-500 hover:bg-orange-600 h-12 rounded-xl"
                        >
                            Confirmar Reagendamento
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={() => setReagendarModal(false)}
                            className="w-full h-12"
                        >
                            Cancelar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
