import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Calendar, MapPin, Phone, User, Clock, Package,
    CheckCircle, AlertCircle, AlertTriangle, Navigation, MessageCircle,
    Wrench, CalendarDays, ListTodo, ExternalLink, LogOut, XCircle, Search, ShoppingBag
} from "lucide-react";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { whatsappService } from "@/services/whatsappService";
import { supabase } from "@/lib/supabase";
import { useConfirm } from "@/hooks/useConfirm";
import AssistenciaTecnicaModal from "@/components/assistencia/AssistenciaTecnicaModal";

export default function MontadorExterno() {
    const MONTAGEM_ITEM_NULLABLE_FIELDS = new Set([
        'montador_id',
        'montador_nome',
        'montador_telefone',
        'data_agendada',
        'horario_agendado',
        'cancelado_por',
        'cancelado_em',
        'reagendado_em'
    ]);

    const sanitizeMontagemItemPayload = (payload) => {
        return Object.fromEntries(
            Object.entries(payload).map(([key, value]) => {
                if (MONTAGEM_ITEM_NULLABLE_FIELDS.has(key) && value === '') {
                    return [key, null];
                }

                return [key, value];
            })
        );
    };

    const getMissingMontagemItemColumn = (error) => {
        const message = error?.message || "";
        const match = message.match(/Could not find the '([^']+)' column of 'montagens_itens'/i);
        return match?.[1] || null;
    };

    const updateMontagemItemWithSchemaFallback = async ({ id, data }) => {
        const unsupportedColumns = new Set();
        let attempts = 0;
        let lastError = null;

        while (attempts < 10) {
            const sanitizedPayload = sanitizeMontagemItemPayload(
                Object.fromEntries(
                    Object.entries(data).filter(([key]) => !unsupportedColumns.has(key))
                )
            );

            try {
                return await base44.entities.MontagemItem.update(id, sanitizedPayload);
            } catch (error) {
                lastError = error;
                const missingColumn = getMissingMontagemItemColumn(error);
                if (!missingColumn) throw error;

                const hasColumnInPayload = Object.prototype.hasOwnProperty.call(sanitizedPayload, missingColumn);
                if (!hasColumnInPayload) throw error;

                console.warn(`Coluna opcional ausente em montagens_itens; ignorando no update: ${missingColumn}`);
                unsupportedColumns.add(missingColumn);
                attempts += 1;
            }
        }

        throw lastError;
    };

    const normalizarTexto = (valor) =>
        String(valor || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim()
            .toLowerCase();

    const normalizarTelefone = (valor) => String(valor || "").replace(/\D/g, "");

    const montadorEstaAtivo = (registroMontador) => {
        const statusNormalizado = normalizarTexto(registroMontador?.status);
        const ativoBooleano = registroMontador?.ativo === true || registroMontador?.ativo === 1 || registroMontador?.ativo === "true";

        // Compatibilidade com schemas antigos (campo status) e novos (campo ativo)
        return (
            ativoBooleano ||
            statusNormalizado === "ativo" ||
            statusNormalizado === "aprovado"
        );
    };

    // Estado para busca na aba "Minhas"
    const [searchTerm, setSearchTerm] = useState("");

    // Filtro GLOBAL para montagens (se precisar)
    const { user } = useAuth();
    const [montador, setMontador] = useState(null);
    const [montadorPendente, setMontadorPendente] = useState(null);
    const [activeTab, setActiveTab] = useState("disponiveis");
    const [selectedMontagem, setSelectedMontagem] = useState(null);
    const [agendamentoModal, setAgendamentoModal] = useState(false);
    const [agendamentoData, setAgendamentoData] = useState({ data: "", horario: "" });
    const [assistenciaModalOpen, setAssistenciaModalOpen] = useState(false);
    const [montagemParaAssistencia, setMontagemParaAssistencia] = useState(null);
    const [salvandoAssistencia, setSalvandoAssistencia] = useState(false);

    const queryClient = useQueryClient();
    const confirm = useConfirm();



    // Buscar dados do montador baseado no usuário logado
    const { data: montadores = [] } = useQuery({
        queryKey: ['montadores'],
        queryFn: () => base44.entities.Montador.list(),
        enabled: !!user
    });

    useEffect(() => {
        if (!user || montadores.length === 0) {
            setMontador(null);
            setMontadorPendente(null);
            return;
        }

        const nomeUsuario = normalizarTexto(user?.full_name || user?.nome);
        const emailUsuario = normalizarTexto(user?.email);
        const telefoneUsuario = normalizarTelefone(user?.telefone);

        // Prioridade de vínculo:
        // 1) usuario_id
        // 2) email
        // 3) telefone
        // 4) nome normalizado (com remoção de acentos)
        const meuMontador = montadores.find((m) => {
            const matchUsuarioId = String(m?.usuario_id || "") === String(user?.id || "");
            const matchEmail = !!emailUsuario && normalizarTexto(m?.email) === emailUsuario;
            const matchTelefone = !!telefoneUsuario && normalizarTelefone(m?.telefone) === telefoneUsuario;
            const matchNome = !!nomeUsuario && normalizarTexto(m?.nome) === nomeUsuario;

            return matchUsuarioId || matchEmail || matchTelefone || matchNome;
        });

        if (!meuMontador) {
            setMontador(null);
            setMontadorPendente(null);
            return;
        }

        if (montadorEstaAtivo(meuMontador)) {
            setMontador(meuMontador);
            setMontadorPendente(null);
        } else {
            setMontador(null);
            setMontadorPendente(meuMontador);
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
                .filter(e => ['Entregue', 'Retirado', 'Concluída'].includes(e.status))
                .map(e => e.id);

            return todas.filter(m =>
                m.tipo_montagem === 'terceirizada' &&
                !m.montador_id &&
                m.status === 'pendente' &&
                idsEntregasEntregues.includes(m.entrega_id) // Só mostra se entrega foi concluída
            );
        },
        enabled: !!user && (!!montador || user?.cargo === 'Administrador' || user?.cargo === 'Montador Externo'),
        refetchOnMount: 'always',
        staleTime: 0,
        refetchInterval: 30000 // Atualiza a cada 30 segundos
    });

    // Buscar minhas montagens
    const { data: minhasMontagens = [] } = useQuery({
        queryKey: ['minhas-montagens', montador?.id],
        queryFn: async () => {
            const todas = await base44.entities.MontagemItem.list('-data_agendada');
            const usuarioIdNormalizado = String(user?.id || "");
            const montadorIdNormalizado = String(montador?.id || "");
            // Admin vê todas terceirizadas, montador vê só as dele
            if (user?.cargo === 'Administrador' && !montador) {
                return todas.filter((m) =>
                    m.tipo_montagem === 'terceirizada' &&
                    String(m.montador_id || "") === usuarioIdNormalizado
                );
            }
            if (!montador) return [];
            return todas.filter((m) => String(m.montador_id || "") === montadorIdNormalizado);
        },
        enabled: !!user && (!!montador || user?.cargo === 'Administrador' || user?.cargo === 'Montador Externo')
    });
    
    // Buscar assistências vinculadas a este montador
    const { data: assistenciasMontador = [] } = useQuery({
        queryKey: ['assistencias-montador', montador?.usuario_id],
        queryFn: async () => {
            const todas = await base44.entities.AssistenciaTecnica.list('-created_at');
            return todas.filter(a =>
                a.responsabilidade_montador === true &&
                a.montador_usuario_id &&
                String(a.montador_usuario_id) === String(montador?.usuario_id || '')
            );
        },
        enabled: !!montador?.usuario_id,
        refetchInterval: 30000
    });

    const assistenciasAbertas = assistenciasMontador.filter(a =>
        !['Concluída', 'Cancelada'].includes(a.status)
    );

    // Buscar todas as vendas para associar vendedor e data
    const { data: vendas = [] } = useQuery({
        queryKey: ['vendas-resumo'],
        queryFn: () => base44.entities.Venda.list(),
        enabled: !!user,
        staleTime: 1000 * 60 * 5 // 5 minutos de cache
    });

    const getVendaInfo = (vendaId) => {
        if (!vendaId || !vendas?.length) return { vendedor: 'Lojista', data: '-' };
        const idBusca = String(vendaId);
        const venda = vendas.find(v => String(v.id) === idBusca);
        if (!venda) return { vendedor: 'Lojista', data: '-' };
        return {
            vendedor: venda.responsavel_nome || 'Lojista',
            data: venda.data_venda ? new Date(venda.data_venda).toLocaleDateString('pt-BR') : '-'
        };
    };

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => updateMontagemItemWithSchemaFallback({ id, data }),
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

            const payloadAgendamento = {
                montador_id: montadorData.id,
                montador_nome: montadorData.nome,
                montador_telefone: montadorData.telefone,
                data_agendada: agendamentoData.data,
                horario_agendado: agendamentoData.horario,
                status: 'agendada'
            };

            if (!selectedMontagem.montador_id) {
                const { data, error } = await supabase
                    .from('montagens_itens')
                    .update(payloadAgendamento)
                    .eq('id', selectedMontagem.id)
                    .is('montador_id', null)
                    .eq('status', 'pendente')
                    .select('id');

                if (error) throw error;

                if (!data || data.length === 0) {
                    toast.warning('Esta montagem acabou de ser pega por outro montador.');
                    queryClient.invalidateQueries({ queryKey: ['montagens-disponiveis'] });
                    queryClient.invalidateQueries({ queryKey: ['minhas-montagens'] });
                    setAgendamentoModal(false);
                    setSelectedMontagem(null);
                    return;
                }
            } else {
                await updateMutation.mutateAsync({
                    id: selectedMontagem.id,
                    data: payloadAgendamento
                });
            }

            queryClient.invalidateQueries({ queryKey: ['montagens-disponiveis'] });
            queryClient.invalidateQueries({ queryKey: ['minhas-montagens'] });

            // Enviar mensagem ao cliente VIA BOT
            const dataFormatada = new Date(agendamentoData.data + 'T12:00:00').toLocaleDateString('pt-BR', {
                weekday: 'long',
                day: '2-digit',
                month: 'long'
            });

            try {
                const sent = await whatsappService.notifyAssemblyScheduled({
                    telefone: selectedMontagem.cliente_telefone,
                    cliente_nome: selectedMontagem.cliente_nome,
                    numero_pedido: selectedMontagem.numero_pedido,
                    produto_nome: selectedMontagem.produto_nome,
                    data_formatada: dataFormatada,
                    turno: agendamentoData.horario,
                    montador_nome: montadorData.nome,
                    montador_telefone: montadorData.telefone
                });
                if (sent === 'queued') {
                    toast.success("Montagem agendada! Notificação na fila - será enviada ao reconectar.");
                } else if (sent === true) {
                    toast.success("Montagem agendada! Cliente notificado via WhatsApp.");
                } else {
                    toast.warning("Montagem agendada. Não foi possível notificar o cliente.");
                }
            } catch (botError) {
                console.error("Erro ao notificar via bot:", botError);
                toast.warning("Montagem agendada. Notificação do WhatsApp ficou pendente.");
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

    const abrirAssistenciaDaMontagem = (montagem) => {
        setMontagemParaAssistencia(montagem);
        setAssistenciaModalOpen(true);
    };

    const fecharAssistenciaDaMontagem = () => {
        setAssistenciaModalOpen(false);
        setMontagemParaAssistencia(null);
    };

    const salvarAssistenciaDaMontagem = async (formData) => {
        if (!montagemParaAssistencia) return;

        setSalvandoAssistencia(true);
        try {
            const assistenciaCriada = await base44.entities.AssistenciaTecnica.create(formData);

            await updateMontagemItemWithSchemaFallback({
                id: montagemParaAssistencia.id,
                data: {
                    tem_problema: true,
                    assistencia_id: assistenciaCriada.id,
                    updated_at: new Date().toISOString()
                }
            });

            await queryClient.invalidateQueries({ queryKey: ['montagens-disponiveis'] });
            await queryClient.invalidateQueries({ queryKey: ['minhas-montagens'] });
            await queryClient.invalidateQueries({ queryKey: ['assistencias'] });
            await queryClient.invalidateQueries({ queryKey: ['assistencias-montador'] });

            toast.success("Assistência aberta com sucesso para esta montagem.");
            fecharAssistenciaDaMontagem();
        } catch (e) {
            console.error("Erro ao abrir assistência da montagem:", e);
            toast.error("Erro ao abrir assistência");
        } finally {
            setSalvandoAssistencia(false);
        }
    };

    // Cancelar montagem (volta para triagem)
    const cancelarMontagem = async (montagem) => {
        const confirmar = await confirm({
            title: "Cancelar montagem",
            message:
            `⚠️ ATENÇÃO: Esta ação irá:\n\n` +
            `• Devolver a montagem para a triagem\n` +
            `• Notificar o cliente "${montagem.cliente_nome}" via WhatsApp\n\n` +
            `Deseja realmente cancelar esta montagem?`,
            confirmText: "Cancelar montagem",
            cancelText: "Voltar",
            variant: "destructive"
        });

        if (!confirmar) return;

        try {
            // Voltar para triagem
            await updateMutation.mutateAsync({
                id: montagem.id,
                data: {
                    status: 'pendente',
                    montador_id: '',
                    montador_nome: '',
                    montador_telefone: '',
                    data_agendada: '',
                    horario_agendado: '',
                    cancelado_por: montador?.nome || 'Montador',
                    cancelado_em: new Date().toISOString()
                }
            });

            // Notificar cliente via bot
            try {
                const sent = await whatsappService.notifyAssemblyCancelled({
                    telefone: montagem.cliente_telefone,
                    cliente_nome: montagem.cliente_nome,
                    numero_pedido: montagem.numero_pedido,
                    produto_nome: montagem.produto_nome
                });
                if (sent === 'queued') {
                    toast.success("Montagem cancelada. Notificação na fila - será enviada ao reconectar.");
                } else if (sent === true) {
                    toast.success("Montagem cancelada. Cliente notificado via WhatsApp.");
                } else {
                    toast.warning("Montagem cancelada. Não foi possível notificar o cliente.");
                }
            } catch (botError) {
                console.error("Erro ao notificar via bot:", botError);
                toast.warning("Montagem cancelada. Notificação do WhatsApp ficou pendente.");
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

    // Estado para aba Assistências
    const [obsAssistenciaOpen, setObsAssistenciaOpen] = useState(false);
    const [assistenciaParaObs, setAssistenciaParaObs] = useState(null);
    const [novaObservacao, setNovaObservacao] = useState("");
    const [atualizandoAssistencia, setAtualizandoAssistencia] = useState(false);

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

        const confirmar = await confirm({
            title: "Confirmar reagendamento",
            message:
            `📅 O cliente "${montagemReagendar.cliente_nome}" será notificado sobre a nova data.\n\n` +
            `Confirmar reagendamento?`,
            confirmText: "Confirmar",
            cancelText: "Voltar"
        });

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
                const sent = await whatsappService.notifyAssemblyRescheduled({
                    telefone: montagemReagendar.cliente_telefone,
                    cliente_nome: montagemReagendar.cliente_nome,
                    numero_pedido: montagemReagendar.numero_pedido,
                    produto_nome: montagemReagendar.produto_nome,
                    data_formatada: dataFormatada,
                    turno: reagendarData.horario,
                    montador_nome: montador?.nome
                });
                if (sent === 'queued') {
                    toast.success("Montagem reagendada! Notificação na fila - será enviada ao reconectar.");
                } else if (sent === true) {
                    toast.success("Montagem reagendada! Cliente notificado via WhatsApp.");
                } else {
                    toast.warning("Montagem reagendada. Não foi possível notificar o cliente.");
                }
            } catch (botError) {
                console.error("Erro ao notificar via bot:", botError);
                toast.warning("Montagem reagendada. Notificação do WhatsApp ficou pendente.");
            }

            setReagendarModal(false);
            setMontagemReagendar(null);
        } catch (e) {
            console.error("Erro ao reagendar montagem:", e);
            toast.error("Erro ao reagendar montagem");
        }
    };


    // Adicionar observação a uma assistência
    const salvarObservacao = async () => {
        if (!assistenciaParaObs || !novaObservacao.trim()) return;
        setAtualizandoAssistencia(true);
        try {
            const dataHora = new Date().toLocaleString('pt-BR');
            const textoNovo = `[${dataHora} - ${montador?.nome || 'Montador'}] ${novaObservacao.trim()}`;
            const obsAtual = assistenciaParaObs.observacoes ? assistenciaParaObs.observacoes + '\n\n' + textoNovo : textoNovo;
            await base44.entities.AssistenciaTecnica.update(assistenciaParaObs.id, { observacoes: obsAtual });
            await queryClient.invalidateQueries({ queryKey: ['assistencias-montador'] });
            await queryClient.invalidateQueries({ queryKey: ['assistencias'] });
            toast.success("Observação adicionada");
            setNovaObservacao("");
            setObsAssistenciaOpen(false);
            setAssistenciaParaObs(null);
        } catch (e) {
            toast.error("Erro ao salvar observação");
        } finally {
            setAtualizandoAssistencia(false);
        }
    };

    // Atualizar status de uma assistência
    const atualizarStatusAssistencia = async (assistencia, novoStatus) => {
        setAtualizandoAssistencia(true);
        try {
            await base44.entities.AssistenciaTecnica.update(assistencia.id, { status: novoStatus });
            await queryClient.invalidateQueries({ queryKey: ['assistencias-montador'] });
            await queryClient.invalidateQueries({ queryKey: ['assistencias'] });
            toast.success("Status atualizado");
        } catch (e) {
            toast.error("Erro ao atualizar status");
        } finally {
            setAtualizandoAssistencia(false);
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
                        onClick={() => window.location.href = '/login?redirect=/admin/MontadorExterno'}
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
                        Se você é montador, faça um novo cadastro selecionando &quot;Montador Externo&quot; como cargo.
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

    // Admin vendo como teste mostra dados fake ou nome do usuário logado
    const montadorDisplay = montador || { nome: user?.full_name || 'Admin (Teste)', id: null };

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
                        <TabsList className="grid grid-cols-4 bg-gray-100 p-1 m-2 rounded-xl">
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
                            <TabsTrigger
                                value="assistencias"
                                className="rounded-lg text-xs py-2 data-[state=active]:bg-red-500 data-[state=active]:text-white relative"
                            >
                                <AlertTriangle className="w-4 h-4 mr-1" />
                                Prob.
                                {assistenciasAbertas.length > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                                        {assistenciasAbertas.length}
                                    </span>
                                )}
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
                                            </button>
                                        </div>

                                         <div className="flex items-center gap-4 text-[11px] text-gray-500 mb-4 bg-white/50 p-2 rounded-lg">
                                            <div className="flex items-center gap-1">
                                                <ShoppingBag className="w-3 h-3 text-orange-400" />
                                                <span className="font-medium text-gray-700">{getVendaInfo(montagem.venda_id).vendedor}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3 text-orange-400" />
                                                <span>{getVendaInfo(montagem.venda_id).data}</span>
                                            </div>
                                        </div>

                                        <Button
                                            className="w-full bg-orange-500 hover:bg-orange-600 h-12 text-base rounded-xl"
                                            onClick={() => pegarMontagem(montagem)}
                                        >
                                            <Calendar className="w-5 h-5 mr-2" />
                                            Pegar Montagem
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="w-full mt-2 border-red-200 text-red-700 hover:bg-red-50"
                                            onClick={() => abrirAssistenciaDaMontagem(montagem)}
                                        >
                                            <AlertTriangle className="w-4 h-4 mr-2" />
                                            Reportar Problema
                                        </Button>
                                    </div>
                                ))
                            )}
                        </TabsContent>

                        {/* Aba Minhas Montagens */}
                        <TabsContent value="minhas" className="p-4 space-y-4">
                            {/* Barra de Pesquisa */}
                            <div className="relative">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <Input
                                    placeholder="Buscar por cliente, pedido ou produto..."
                                    className="pl-9 bg-white"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            {(() => {
                                // Função de filtro usando o searchTerm
                                const filtrar = (lista) => {
                                    if (!searchTerm) return lista;
                                    const termo = searchTerm.toLowerCase();
                                    return lista.filter(m => {
                                        const vendaInfo = getVendaInfo(m.venda_id);
                                        return m.cliente_nome?.toLowerCase().includes(termo) ||
                                            m.numero_pedido?.toString().includes(termo) ||
                                            m.produto_nome?.toLowerCase().includes(termo) ||
                                            m.endereco?.toLowerCase().includes(termo) ||
                                            vendaInfo.vendedor.toLowerCase().includes(termo);
                                    });
                                };

                                const proximas = filtrar(minhasMontagens.filter(m => m.status !== 'concluida'));
                                const concluidas = filtrar(minhasMontagens.filter(m => m.status === 'concluida'));

                                return (
                                    <>
                                        {/* Seção Próximas */}
                                        <div>
                                            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                                <Calendar className="w-4 h-4 text-orange-500" />
                                                Próximas
                                                <span className="bg-orange-100 text-orange-700 text-[10px] px-2 py-0.5 rounded-full">{proximas.length}</span>
                                            </h3>

                                            {proximas.length === 0 ? (
                                                <div className="text-center py-6 bg-white/50 rounded-lg border border-dashed border-gray-200">
                                                    <p className="text-gray-400 text-sm">Nenhuma montagem pendente encontrada</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {proximas.map(montagem => (
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

                                                            {/* Info da Venda */}
                                                            <div className="flex items-center gap-4 text-[10px] text-gray-500 mb-3 px-1">
                                                                <div className="flex items-center gap-1">
                                                                    <ShoppingBag className="w-3 h-3 text-blue-400" />
                                                                    <span className="font-medium text-gray-700">{getVendaInfo(montagem.venda_id).vendedor}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <Calendar className="w-3 h-3 text-blue-400" />
                                                                    <span>Venda: {getVendaInfo(montagem.venda_id).data}</span>
                                                                </div>
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
                                                                            className="bg-green-500 hover:bg-green-600 h-10 rounded-xl text-sm"
                                                                            onClick={() => abrirWhatsAppACaminho(montagem)}
                                                                        >
                                                                            <Navigation className="w-4 h-4 mr-2" />
                                                                            Ir ao Local
                                                                        </Button>
                                                                        <Button
                                                                            variant="outline"
                                                                            className="h-10 rounded-xl text-sm border-red-200 text-red-600 hover:bg-red-50"
                                                                            onClick={() => abrirReagendar(montagem)}
                                                                        >
                                                                            <CalendarDays className="w-4 h-4 mr-2" />
                                                                            Reagendar
                                                                        </Button>
                                                                    </>
                                                                )}

                                                                {montagem.status === 'em_andamento' && (
                                                                    <Button
                                                                        className="col-span-2 bg-blue-600 hover:bg-blue-700 h-10 rounded-xl text-sm"
                                                                        onClick={async () => {
                                                                            const confirmar = await confirm({
                                                                                title: "Finalizar montagem",
                                                                                message: `Confirmar conclusão da montagem para ${montagem.cliente_nome}?`,
                                                                                confirmText: "Finalizar",
                                                                                cancelText: "Voltar"
                                                                            });

                                                                            if (confirmar) {
                                                                                finalizarMontagem(montagem);
                                                                            }
                                                                        }}
                                                                    >
                                                                        <CheckCircle className="w-4 h-4 mr-2" />
                                                                        Finalizar Montagem
                                                                    </Button>
                                                                )}

                                                                {montagem.status === 'pendente' && (
                                                                    <Button
                                                                        className="col-span-2 bg-orange-500 hover:bg-orange-600 h-10 rounded-xl text-sm"
                                                                        onClick={() => pegarMontagem(montagem)}
                                                                    >
                                                                        <Clock className="w-4 h-4 mr-2" />
                                                                        Agendar Agora
                                                                    </Button>
                                                                )}
                                                            </div>

                                                            {/* Botão de Cancelar montagem */}
                                                            {(montagem.status === 'agendada' || montagem.status === 'pendente') && (
                                                                <Button
                                                                    variant="ghost"
                                                                    className="w-full mt-2 h-8 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg text-xs"
                                                                    onClick={() => cancelarMontagem(montagem)}
                                                                >
                                                                    <XCircle className="w-3 h-3 mr-2" />
                                                                    Desistir desta Montagem
                                                                </Button>
                                                            )}

                                                            {montagem.status !== 'concluida' && (
                                                                <Button
                                                                    variant="outline"
                                                                    className="w-full mt-2 border-red-200 text-red-700 hover:bg-red-50"
                                                                    onClick={() => abrirAssistenciaDaMontagem(montagem)}
                                                                >
                                                                    <AlertTriangle className="w-4 h-4 mr-2" />
                                                                    Reportar Problema
                                                                </Button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Seção Concluídas */}
                                        <div className="pt-4 border-t border-gray-200">
                                            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                                <CheckCircle className="w-4 h-4 text-green-500" />
                                                Concluídas ({concluidas.length})
                                            </h3>

                                            {concluidas.length === 0 ? (
                                                <p className="text-center text-xs text-gray-400 py-2">Nenhuma montagem concluída recente.</p>
                                            ) : (
                                                <div className="space-y-3 opacity-80">
                                                    {concluidas.map(montagem => (
                                                        <div key={montagem.id} className="bg-gray-100 rounded-xl p-4 border border-gray-200">
                                                            <div className="flex justify-between items-start mb-2">
                                                                <div>
                                                                    <p className="font-bold text-gray-600 line-through">#{montagem.numero_pedido}</p>
                                                                    <p className="text-xs text-gray-500">{montagem.produto_nome}</p>
                                                                </div>
                                                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                                                    Concluída
                                                                </Badge>
                                                            </div>
                                                            <div className="flex items-center gap-4 text-[10px] text-gray-500 mt-2">
                                                                <div className="flex items-center gap-1">
                                                                    <User className="w-3 h-3" />
                                                                    <span>{montagem.cliente_nome}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <ShoppingBag className="w-3 h-3" />
                                                                    <span>{getVendaInfo(montagem.venda_id).vendedor}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <Calendar className="w-3 h-3" />
                                                                    <span>{getVendaInfo(montagem.venda_id).data}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </>
                                );
                            })()}
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
                                                <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-1">
                                                    <span className="flex items-center gap-0.5">
                                                        <ShoppingBag className="w-2.5 h-2.5" />
                                                        {getVendaInfo(montagem.venda_id).vendedor}
                                                    </span>
                                                    <span>•</span>
                                                    <span>Venda: {getVendaInfo(montagem.venda_id).data}</span>
                                                </div>
                                            </div>
                                            <Badge className={`${getStatusBadge(montagem.status).className} text-xs`}>
                                                {getStatusBadge(montagem.status).label}
                                            </Badge>
                                        </div>
                                    ))
                            )}
                        </TabsContent>

                        {/* Aba Assist\u00eancias */}
                        <TabsContent value="assistencias" className="p-4 space-y-3">
                            <div className="flex items-center justify-between mb-1">
                                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-red-500" />
                                    Minhas Assist\u00eancias
                                </h3>
                                {assistenciasAbertas.length > 0 && (
                                    <Badge className="bg-red-100 text-red-800 text-xs">
                                        {assistenciasAbertas.length} em aberto
                                    </Badge>
                                )}
                            </div>

                            {assistenciasMontador.length === 0 ? (
                                <div className="text-center py-10">
                                    <CheckCircle className="w-14 h-14 mx-auto text-green-400 mb-3" />
                                    <p className="text-gray-500 font-medium">Sem assist\u00eancias atribu\u00eddas</p>
                                    <p className="text-gray-400 text-xs mt-1">Quando um problema da sua montagem for registrado, aparecer\u00e1 aqui.</p>
                                </div>
                            ) : (
                                assistenciasMontador.map(ass => {
                                    const statusConfig = {
                                        'Aberta': 'bg-blue-100 text-blue-800',
                                        'Em Andamento': 'bg-yellow-100 text-yellow-800',
                                        'Aguardando Pe\u00e7a': 'bg-orange-100 text-orange-800',
                                        'Aguardando Cliente': 'bg-purple-100 text-purple-800',
                                        'Conclu\u00edda': 'bg-green-100 text-green-800',
                                        'Cancelada': 'bg-red-100 text-red-800'
                                    };
                                    const tipoConfig = {
                                        'Devolu\u00e7\u00e3o': 'bg-red-100 text-red-800',
                                        'Troca': 'bg-orange-100 text-orange-800',
                                        'Pe\u00e7a Faltante': 'bg-yellow-100 text-yellow-800',
                                        'Conserto': 'bg-blue-100 text-blue-800',
                                        'Visita T\u00e9cnica': 'bg-purple-100 text-purple-800',
                                        'Outros': 'bg-gray-100 text-gray-800'
                                    };
                                    const isClosed = ['Conclu\u00edda', 'Cancelada'].includes(ass.status);
                                    return (
                                        <div key={ass.id} className={`bg-gray-50 rounded-xl p-4 border-l-4 ${isClosed ? 'border-gray-300 opacity-70' : 'border-red-400'}`}>
                                            <div className="flex justify-between items-start mb-2 gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-gray-900 text-sm truncate">#{ass.numero_pedido} \u2014 {ass.cliente_nome}</p>
                                                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{ass.descricao_problema}</p>
                                                </div>
                                                <div className="flex flex-col items-end gap-1 shrink-0">
                                                    <Badge className={`text-[10px] px-2 ${tipoConfig[ass.tipo] || 'bg-gray-100 text-gray-800'}`}>
                                                        {ass.tipo}
                                                    </Badge>
                                                    <Badge className={`text-[10px] px-2 ${statusConfig[ass.status] || 'bg-gray-100 text-gray-800'}`}>
                                                        {ass.status}
                                                    </Badge>
                                                </div>
                                            </div>

                                            {ass.itens_envolvidos?.length > 0 && (
                                                <div className="mb-3">
                                                    {ass.itens_envolvidos.map((item, idx) => (
                                                        <p key={idx} className="text-[11px] text-gray-600 bg-white rounded px-2 py-1 mb-1">
                                                            {item.produto_nome}{item.problema ? ` \u2014 ${item.problema}` : ''}
                                                        </p>
                                                    ))}
                                                </div>
                                            )}

                                            {ass.observacoes && (
                                                <div className="text-[11px] text-gray-500 bg-white rounded px-2 py-1 mb-3 whitespace-pre-wrap line-clamp-3">
                                                    {ass.observacoes}
                                                </div>
                                            )}

                                            {!isClosed && (
                                                <div className="flex gap-2 mt-1">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="flex-1 h-8 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                                                        onClick={() => {
                                                            setAssistenciaParaObs(ass);
                                                            setNovaObservacao('');
                                                            setObsAssistenciaOpen(true);
                                                        }}
                                                    >
                                                        Adicionar Obs.
                                                    </Button>
                                                    <Select
                                                        value={ass.status}
                                                        onValueChange={(val) => atualizarStatusAssistencia(ass, val)}
                                                        disabled={atualizandoAssistencia}
                                                    >
                                                        <SelectTrigger className="flex-1 h-8 text-xs rounded-lg">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {['Aberta', 'Em Andamento', 'Aguardando Pe\u00e7a', 'Aguardando Cliente', 'Conclu\u00edda', 'Cancelada'].map(s => (
                                                                <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </TabsContent>
                    </Tabs>
                </div >
            </div >

            {/* Modal de Agendamento */}
            < Dialog open={agendamentoModal} onOpenChange={setAgendamentoModal} >
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
                                <div className="flex items-center gap-4 mt-2 pt-2 border-t border-orange-100 text-[11px] text-orange-700">
                                    <div className="flex items-center gap-1">
                                        <ShoppingBag className="w-3 h-3" />
                                        <span>Venda por: <strong>{getVendaInfo(selectedMontagem.venda_id).vendedor}</strong></span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        <span>Data: <strong>{getVendaInfo(selectedMontagem.venda_id).data}</strong></span>
                                    </div>
                                </div>
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
            </Dialog >

            {/* Modal de Reagendamento */}
            < Dialog open={reagendarModal} onOpenChange={setReagendarModal} >
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
            </Dialog >

            {/* Dialog: Adicionar Observa\u00e7\u00e3o em Assist\u00eancia */}
            <Dialog open={obsAssistenciaOpen} onOpenChange={(open) => { if (!open) { setObsAssistenciaOpen(false); setAssistenciaParaObs(null); setNovaObservacao(''); } }}>
                <DialogContent className="mx-4 rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-base">Adicionar Observa\u00e7\u00e3o</DialogTitle>
                    </DialogHeader>
                    {assistenciaParaObs && (
                        <div className="space-y-3">
                            <div className="bg-gray-50 rounded-lg p-3">
                                <p className="text-sm font-medium text-gray-900">#{assistenciaParaObs.numero_pedido} \u2014 {assistenciaParaObs.cliente_nome}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{assistenciaParaObs.descricao_problema}</p>
                            </div>
                            <Textarea
                                value={novaObservacao}
                                onChange={e => setNovaObservacao(e.target.value)}
                                placeholder="Descreva o andamento, o que foi feito ou qualquer informa\u00e7\u00e3o relevante..."
                                rows={4}
                                className="rounded-xl"
                            />
                        </div>
                    )}
                    <DialogFooter className="flex-col gap-2 sm:flex-col">
                        <Button
                            onClick={salvarObservacao}
                            disabled={!novaObservacao.trim() || atualizandoAssistencia}
                            className="w-full h-11 rounded-xl bg-green-600 hover:bg-green-700"
                        >
                            {atualizandoAssistencia ? 'Salvando...' : 'Salvar Observa\u00e7\u00e3o'}
                        </Button>
                        <Button variant="ghost" onClick={() => { setObsAssistenciaOpen(false); setNovaObservacao(''); }} className="w-full h-11">
                            Cancelar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AssistenciaTecnicaModal
                isOpen={assistenciaModalOpen}
                onClose={fecharAssistenciaDaMontagem}
                onSave={salvarAssistenciaDaMontagem}
                assistencia={null}
                initialValues={montagemParaAssistencia ? {
                    venda_id: montagemParaAssistencia.venda_id || '',
                    numero_pedido: montagemParaAssistencia.numero_pedido || '',
                    cliente_nome: montagemParaAssistencia.cliente_nome || '',
                    cliente_telefone: montagemParaAssistencia.cliente_telefone || '',
                    tipo: 'Conserto',
                    montador_usuario_id: montador?.usuario_id || '',
                    itens_envolvidos: [{
                        produto_id: montagemParaAssistencia.produto_id,
                        produto_nome: montagemParaAssistencia.produto_nome,
                        quantidade: montagemParaAssistencia.quantidade || 1,
                        problema: ''
                    }],
                    observacoes: `Aberta no painel do montador externo. Item montagem #${montagemParaAssistencia.id}`
                } : null}
                vendas={vendas}
                isLoading={salvandoAssistencia}
            />
        </div >
    );
}
