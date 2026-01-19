import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Truck, MapPin, Navigation, CheckCircle, Send, Radio, Sun, Sunset, Briefcase, ArrowLeft, Package, AlertTriangle, CreditCard, Camera, PenTool, X, DollarSign, LogOut, Wrench, Link2, MessageCircle, QrCode, Copy, Download, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/useConfirm";
import AssinaturaCanvas from "@/components/logistica/AssinaturaCanvas";
import CameraCapture from "@/components/logistica/CameraCapture";
import FotoEntregaCapture from "@/components/logistica/FotoEntregaCapture";
import { supabase } from "@/api/base44Client";
import { Input } from "@/components/ui/input";

export default function Entregador() {
    const [user, setUser] = useState(null);
    const [etapa, setEtapa] = useState('selecao'); // 'selecao' | 'rota'
    const [rotaIniciada, setRotaIniciada] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [caminhaoSelecionado, setCaminhaoSelecionado] = useState(null);
    const [turnoSelecionado, setTurnoSelecionado] = useState(null);
    const [dataSelecionada, setDataSelecionada] = useState(new Date().toISOString().split('T')[0]);
    const gpsInterval = useRef(null);

    // Estados dos modais
    const [modalAssinatura, setModalAssinatura] = useState(null); // entrega ou null
    const [modalFotoEntrega, setModalFotoEntrega] = useState(null); // NOVO: modal de foto dos móveis
    const [modalComprovante, setModalComprovante] = useState(null);
    const [modalFalha, setModalFalha] = useState(null);
    const [observacaoFalha, setObservacaoFalha] = useState("");
    const [fotoFalha, setFotoFalha] = useState(null);
    const [etapaFalha, setEtapaFalha] = useState('foto'); // 'foto' | 'observacao'

    // Estado para modal de conclusão de assistência
    const [modalConcluirAssistencia, setModalConcluirAssistencia] = useState(null);
    const [observacaoAssistencia, setObservacaoAssistencia] = useState("");

    // Estado para modal de link de pagamento
    const [modalLinkPagamento, setModalLinkPagamento] = useState(null);
    const [linkPagamentoData, setLinkPagamentoData] = useState(null);
    const [gerandoLink, setGerandoLink] = useState(false);
    const [linkCopiado, setLinkCopiado] = useState(false);
    const [numeroAlternativo, setNumeroAlternativo] = useState("");

    const queryClient = useQueryClient();
    const confirm = useConfirm();

    useEffect(() => {
        base44.auth.me().then(setUser).catch(console.error);
        return () => {
            if (gpsInterval.current) clearInterval(gpsInterval.current);
        };
    }, []);

    // Lista de caminhões
    const { data: caminhoes = [] } = useQuery({
        queryKey: ['caminhoes'],
        queryFn: () => base44.entities.Caminhao.list()
    });

    // Entregas do dia selecionado
    const { data: todasEntregas = [], refetch } = useQuery({
        queryKey: ['entregas-dia', dataSelecionada],
        queryFn: async () => {
            const todas = await base44.entities.Entrega.list('-ordem_rota');
            return todas.filter(e =>
                e.data_agendada?.startsWith(dataSelecionada) &&
                e.status !== 'Entregue' &&
                e.status !== 'Cancelada'
            );
        },
        refetchInterval: rotaIniciada ? 10000 : 30000
    });

    // Assistências Técnicas pendentes
    const { data: todasAssistencias = [], refetch: refetchAssistencias } = useQuery({
        queryKey: ['assistencias-entregador'],
        queryFn: async () => {
            const todas = await base44.entities.AssistenciaTecnica.list('-created_at');
            return todas.filter(a =>
                a.status !== 'Concluída' &&
                a.status !== 'Cancelada' &&
                (a.tipo === 'Devolução' || a.tipo === 'Troca' || a.tipo === 'Peça Faltante' || a.tipo === 'Visita Técnica' || a.tipo === 'Conserto')
            );
        },
        refetchInterval: rotaIniciada ? 10000 : 60000
    });

    // Agrupar entregas por turno
    const entregasPorTurno = {
        'Manhã': todasEntregas.filter(e => e.turno === 'Manhã'),
        'Tarde': todasEntregas.filter(e => e.turno === 'Tarde'),
        'Comercial': todasEntregas.filter(e => !e.turno || e.turno === 'Comercial')
    };

    // Entregas da rota selecionada
    const entregasRota = todasEntregas.filter(e => {
        const matchTurno = turnoSelecionado ? (e.turno === turnoSelecionado || (!e.turno && turnoSelecionado === 'Comercial')) : true;
        const matchCaminhao = caminhaoSelecionado ? (e.caminhao_id === caminhaoSelecionado || !e.caminhao_id) : true;
        return matchTurno && matchCaminhao;
    }).sort((a, b) => (a.ordem_rota || 99) - (b.ordem_rota || 99));

    // Pedidos com pagamento na entrega
    const pedidosAReceber = entregasRota.filter(e => e.pagamento_na_entrega || e.valor_a_receber > 0);

    const updateEntrega = useMutation({
        mutationFn: ({ id, data }) => base44.entities.Entrega.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['entregas-dia'] });
            queryClient.invalidateQueries({ queryKey: ['entregas'] });
        }
    });

    const updateCaminhao = useMutation({
        mutationFn: ({ id, data }) => base44.entities.Caminhao.update(id, data)
    });

    const updateAssistencia = useMutation({
        mutationFn: ({ id, data }) => base44.entities.AssistenciaTecnica.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['assistencias-entregador'] });
            queryClient.invalidateQueries({ queryKey: ['assistencias'] });
        }
    });

    // GPS a cada 5 segundos
    const iniciarRastreamento = () => {
        if (!navigator.geolocation) {
            toast.error("GPS não suportado neste dispositivo.");
            return;
        }
        atualizarPosicao();
        gpsInterval.current = setInterval(atualizarPosicao, 5000);
    };

    const atualizarPosicao = () => {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                if (caminhaoSelecionado) {
                    updateCaminhao.mutate({
                        id: caminhaoSelecionado,
                        data: {
                            latitude,
                            longitude,
                            ultima_atualizacao: new Date().toISOString(),
                            status_rota: 'Em Trânsito',
                            motorista_atual_nome: user?.full_name || 'Entregador',
                            turno_atual: turnoSelecionado
                        }
                    });
                }
            },
            (error) => console.error("Erro GPS:", error),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const pararRastreamento = () => {
        if (gpsInterval.current) {
            clearInterval(gpsInterval.current);
            gpsInterval.current = null;
        }
        if (caminhaoSelecionado) {
            updateCaminhao.mutate({
                id: caminhaoSelecionado,
                data: { status_rota: 'Parado', motorista_atual_nome: null, turno_atual: null }
            });
        }
    };

    const iniciarRota = async () => {
        if (!caminhaoSelecionado || !turnoSelecionado) {
            toast.error("Selecione caminhão e turno primeiro.");
            return;
        }

        // Verificar se tem pedidos a receber
        if (pedidosAReceber.length > 0) {
            const formas = [...new Set(pedidosAReceber.map(p => p.forma_pagamento).filter(Boolean))];
            const totalReceber = pedidosAReceber.reduce((sum, p) => sum + (p.valor_a_receber || 0), 0);

            const continuar = await confirm({
                title: "⚠️ ATENÇÃO: Pedidos a Receber!",
                message: `Você tem ${pedidosAReceber.length} pedido(s) para receber na entrega!\n\n💰 Total: R$ ${totalReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n💳 Formas: ${formas.length > 0 ? formas.join(', ') : 'Não especificado'}\n\nPrepare a(s) máquina(s) de cartão!`,
                confirmText: "Entendi, Continuar",
                variant: "default"
            });

            if (!continuar) return;
        }

        const confirmed = await confirm({
            title: "Iniciar Rota",
            message: `Iniciar rota ${turnoSelecionado} com ${entregasRota.length} entregas?`,
            confirmText: "Iniciar"
        });
        if (!confirmed) return;

        setEnviando(true);
        try {
            for (const entrega of entregasRota) {
                if (!entrega.caminhao_id) {
                    await base44.entities.Entrega.update(entrega.id, { caminhao_id: caminhaoSelecionado });
                }
            }

            await fetch('http://localhost:3001/aviso-inicio-rota', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entregas: entregasRota })
            }).catch(() => { });

            setRotaIniciada(true);
            setEtapa('rota');
            iniciarRastreamento();
            toast.success("Rota iniciada! GPS ativo.");
        } catch (e) {
            toast.error("Erro ao iniciar rota.");
        } finally {
            setEnviando(false);
        }
    };

    const finalizarRota = async () => {
        const confirmed = await confirm({
            title: "Finalizar Rota",
            message: "Tem certeza que deseja finalizar a rota?",
            confirmText: "Finalizar",
            variant: "destructive"
        });
        if (!confirmed) return;

        pararRastreamento();
        setRotaIniciada(false);
        setEtapa('selecao');
        setCaminhaoSelecionado(null);
        setTurnoSelecionado(null);
        toast.success("Rota finalizada!");
    };

    const avisarProximo = async (entrega) => {
        setEnviando(true);
        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            const linkMaps = `https://www.google.com/maps?q=${latitude},${longitude}`;

            try {
                await fetch('http://localhost:3001/aviso-proxima-parada', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        telefone: entrega.cliente_telefone,
                        nome: entrega.cliente_nome,
                        linkLocalizacao: linkMaps
                    })
                });
                toast.success("Cliente avisado!");
            } catch (e) { toast.error("Erro ao enviar."); }
            finally { setEnviando(false); }
        });
    };

    // Iniciar processo de finalizar entrega (abre assinatura)
    const iniciarFinalizacao = (entrega) => {
        setModalAssinatura(entrega);
    };

    // Salvar assinatura e pedir foto dos móveis (NOVO FLUXO)
    const salvarAssinatura = async (assinaturaDataUrl) => {
        const entrega = modalAssinatura;
        setModalAssinatura(null);

        // NOVO: Sempre pedir foto dos móveis após assinatura
        setModalFotoEntrega({ ...entrega, assinatura_url: assinaturaDataUrl });
    };

    // NOVO: Salvar fotos dos móveis e verificar se precisa de comprovante de pagamento
    const salvarFotosEntrega = async (fotosData) => {
        const entrega = modalFotoEntrega;
        setModalFotoEntrega(null);

        const entregaComFotos = {
            ...entrega,
            fotos_entrega: fotosData.fotos,
            geolocalizacao_entrega: fotosData.geolocalizacao,
            data_hora_entrega: fotosData.dataHoraEntrega
        };

        // Se tem pagamento, pedir comprovante
        if (entrega.pagamento_na_entrega || entrega.valor_a_receber > 0) {
            setModalComprovante(entregaComFotos);
        } else {
            // Finalizar diretamente
            await finalizarEntrega(entregaComFotos, entrega.assinatura_url, null);
        }
    };

    // Salvar comprovante e finalizar
    const salvarComprovante = async (comprovanteDataUrl) => {
        const entrega = modalComprovante;
        setModalComprovante(null);
        await finalizarEntrega(entrega, entrega.assinatura_url, comprovanteDataUrl);
    };

    // Finalizar entrega com assinatura, fotos e comprovante
    const finalizarEntrega = async (entrega, assinaturaUrl, comprovanteUrl) => {
        setEnviando(true);
        try {
            const updateData = {
                status: 'Entregue',
                data_realizada: new Date().toISOString(),
                assinatura_url: assinaturaUrl,
            };

            // NOVO: Adicionar fotos da entrega
            if (entrega.fotos_entrega) {
                updateData.fotos_entrega = entrega.fotos_entrega;
                updateData.foto_entrega_url = entrega.fotos_entrega[0]?.url || null;
            }

            // NOVO: Adicionar geolocalização
            if (entrega.geolocalizacao_entrega) {
                updateData.geolocalizacao_entrega = entrega.geolocalizacao_entrega;
            }

            // NOVO: Adicionar data/hora exata
            if (entrega.data_hora_entrega) {
                updateData.data_hora_entrega = entrega.data_hora_entrega;
            }

            if (comprovanteUrl) {
                updateData.comprovante_pagamento_url = comprovanteUrl;
            }

            await updateEntrega.mutateAsync({ id: entrega.id, data: updateData });
            toast.success("Entrega finalizada com sucesso!");
            refetch();
        } catch (error) {
            toast.error("Erro ao finalizar entrega.");
            console.error(error);
        } finally {
            setEnviando(false);
        }
    };

    // Iniciar processo de falha na entrega
    const iniciarFalhaEntrega = (entrega) => {
        setModalFalha(entrega);
        setFotoFalha(null);
        setObservacaoFalha("");
        setEtapaFalha('foto');
    };

    // Salvar foto da falha
    const salvarFotoFalha = (fotoDataUrl) => {
        setFotoFalha(fotoDataUrl);
        setEtapaFalha('observacao');
    };

    // Confirmar falha na entrega
    const confirmarFalhaEntrega = async () => {
        if (!fotoFalha) {
            toast.error("Foto obrigatória!");
            return;
        }
        if (!observacaoFalha.trim()) {
            toast.error("Observação obrigatória!");
            return;
        }

        setEnviando(true);
        try {
            const entrega = modalFalha;
            const tentativas = (entrega.tentativas || 0) + 1;

            // 1. Atualizar no banco
            await updateEntrega.mutateAsync({
                id: entrega.id,
                data: {
                    status: 'Pendente',
                    data_agendada: null,
                    turno: null,
                    caminhao_id: null,
                    tentativas,
                    observacoes_entrega: `[TENTATIVA ${tentativas}] ${observacaoFalha}`,
                    foto_tentativa_url: fotoFalha
                }
            });

            // 2. Notificar cliente via bot
            await fetch('http://localhost:3001/entrega-nao-realizada', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telefone: entrega.cliente_telefone,
                    nome: entrega.cliente_nome,
                    numero_pedido: entrega.numero_pedido,
                    motivo: observacaoFalha
                })
            }).catch(() => { });

            setModalFalha(null);
            toast.success("Entrega retornada para triagem. Cliente notificado.");
            refetch();
        } catch (error) {
            toast.error("Erro ao registrar falha.");
            console.error(error);
        } finally {
            setEnviando(false);
        }
    };

    // Concluir assistência técnica
    const concluirAssistencia = async () => {
        if (!modalConcluirAssistencia) return;

        setEnviando(true);
        try {
            const assistencia = modalConcluirAssistencia;
            const hoje = new Date().toISOString().split('T')[0];

            await updateAssistencia.mutateAsync({
                id: assistencia.id,
                data: {
                    status: 'Concluída',
                    data_resolucao: hoje,
                    solucao_aplicada: observacaoAssistencia || 'Atendimento realizado pelo entregador',
                    historico: [
                        ...(assistencia.historico || []),
                        {
                            status_anterior: assistencia.status,
                            status_novo: 'Concluída',
                            data: new Date().toISOString(),
                            usuario: user?.full_name || 'Entregador'
                        }
                    ]
                }
            });

            setModalConcluirAssistencia(null);
            setObservacaoAssistencia("");
            toast.success("Assistência concluída com sucesso!");
            refetchAssistencias();
        } catch (error) {
            toast.error("Erro ao concluir assistência.");
            console.error(error);
        } finally {
            setEnviando(false);
        }
    };

    const formatarData = (dataStr) => {
        const data = new Date(dataStr + 'T12:00:00');
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const amanha = new Date(hoje);
        amanha.setDate(amanha.getDate() + 1);
        const dataNorm = new Date(data);
        dataNorm.setHours(0, 0, 0, 0);

        if (dataNorm.getTime() === hoje.getTime()) return 'Hoje';
        if (dataNorm.getTime() === amanha.getTime()) return 'Amanhã';
        return data.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
    };

    // Funções de link de pagamento
    const gerarLinkPagamento = async (entrega) => {
        setGerandoLink(true);
        try {
            // Payload para Stone Payment Link
            const payload = {
                venda_id: entrega.venda_id || null,
                valor: entrega.valor_a_receber || 0,
                descricao: `Pedido #${entrega.numero_pedido} - Móveis Pedro II`,
                cliente_nome: entrega.cliente_nome,
                cliente_email: null,
                cliente_documento: null,
                payment_methods: ['pix', 'credit_card', 'boleto'],
                max_installments: 12,
                expires_in_days: 1 // Link expira em 1 dia para entrega
            };

            const { data, error } = await supabase.functions.invoke('stone-payment-link', { body: payload });
            if (error) throw new Error(error.message);
            if (data.error) throw new Error(data.error);

            // Normalizar resposta da Stone
            const normalizedData = {
                link_pagamento: data.payment_url,
                qr_code_url: data.qr_code || `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(data.payment_url)}`,
                valor: entrega.valor_a_receber,
                entrega
            };

            setLinkPagamentoData(normalizedData);
            toast.success("Link de pagamento gerado!");
        } catch (err) {
            console.error("Erro ao gerar link:", err);
            toast.error(err.message || "Erro ao gerar link");
        } finally {
            setGerandoLink(false);
        }
    };


    const copiarLink = async () => {
        if (!linkPagamentoData?.link_pagamento) return;
        try {
            await navigator.clipboard.writeText(linkPagamentoData.link_pagamento);
            setLinkCopiado(true);
            toast.success("Link copiado!");
            setTimeout(() => setLinkCopiado(false), 2000);
        } catch (err) { toast.error("Erro ao copiar"); }
    };

    const enviarWhatsAppPara = async (numero, entrega = null) => {
        if (!linkPagamentoData?.link_pagamento || !numero) {
            toast.error("Número não fornecido");
            return;
        }
        const telefone = numero.replace(/\D/g, '');
        const telefoneFormatado = telefone.startsWith('55') ? telefone : `55${telefone}`;

        // Salvar telefone alternativo no cliente se diferente
        if (numeroAlternativo && entrega?.cliente_id) {
            try {
                const clienteTelNorm = entrega.cliente_telefone?.replace(/\D/g, '') || '';
                if (telefone !== clienteTelNorm) {
                    await base44.entities.Cliente.update(entrega.cliente_id, { telefone_alternativo: telefone });
                }
            } catch (e) { console.error(e); }
        }

        const nome = entrega?.cliente_nome?.split(' ')[0] || 'Cliente';
        const mensagem = encodeURIComponent(
            `Olá ${nome}! 👋\n\n` +
            `Segue o link para pagamento do seu pedido #${entrega?.numero_pedido}:\n\n` +
            `💰 Valor: R$ ${linkPagamentoData.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n` +
            `🔗 Link: ${linkPagamentoData.link_pagamento}\n\n` +
            `Você pode pagar com Pix, Cartão ou Boleto.\n\n` +
            `- Móveis Pedro II`
        );
        window.open(`https://wa.me/${telefoneFormatado}?text=${mensagem}`, '_blank');
    };

    // Verificar se é admin ou tem cargo de entregador
    const isAdmin = user?.cargo === 'Administrador';
    const isEntregador = user?.cargo === 'Entregador';
    const isPendente = user?.status_aprovacao === 'Pendente' && user?.cargo === 'Entregador';

    // Se não está logado, redirecionar para login
    if (!user) {
        return (
            <div className="flex flex-col h-screen items-center justify-center p-6 bg-gradient-to-br from-green-50 to-green-100">
                <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-sm">
                    <img
                        src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/690ce4cb64e20af6b4a46b6f/3474ff954_undefined-Imgur.png"
                        alt="Móveis Pedro II"
                        className="h-16 w-auto mx-auto mb-4"
                    />
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Área do Entregador</h2>
                    <p className="text-gray-600 mb-6">
                        Faça login ou cadastre-se para acessar.
                    </p>
                    <Button
                        className="w-full bg-green-600 hover:bg-green-700"
                        onClick={() => window.location.href = '/'}
                    >
                        Ir para Login
                    </Button>
                </div>
            </div>
        );
    }

    // Tela de aguardando aprovação
    if (isPendente) {
        return (
            <div className="flex flex-col h-screen items-center justify-center p-6 bg-gradient-to-br from-green-50 to-green-100">
                <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-sm">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Radio className="w-10 h-10 text-green-500" />
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

    // Usuário não é entregador nem admin - acesso negado
    if (!isEntregador && !isAdmin) {
        return (
            <div className="flex flex-col h-screen items-center justify-center p-6 bg-gradient-to-br from-green-50 to-green-100">
                <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-sm">
                    <AlertTriangle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Acesso Negado</h2>
                    <p className="text-gray-600 mb-4">
                        Você não possui permissão de Entregador.
                    </p>
                    <p className="text-sm text-gray-500 mb-6">
                        Se você é entregador, faça um novo cadastro selecionando "Entregador" como cargo.
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

    // ===== TELA DE SELEÇÃO DE ROTA =====
    if (etapa === 'selecao') {
        return (
            <div className="max-w-lg mx-auto p-4 space-y-6 min-h-screen bg-gray-50">
                {/* Header com Branding */}
                <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-xl shadow-lg p-5 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <img
                                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/690ce4cb64e20af6b4a46b6f/3474ff954_undefined-Imgur.png"
                                alt="Móveis Pedro II"
                                className="h-[52px] w-auto rounded-xl object-contain"
                            />
                            <div>
                                <h1 className="text-xl font-bold">Olá, {user?.full_name?.split(' ')[0] || 'Entregador'}!</h1>
                                <p className="text-sm text-green-100">Entregador</p>
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
                </div>

                {/* Card de Seleções */}
                <div className="bg-white rounded-xl shadow-sm border p-5">
                    {/* Seleção de Data */}
                    <div className="mb-4">
                        <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">Data</label>
                        <input
                            type="date"
                            value={dataSelecionada}
                            onChange={(e) => setDataSelecionada(e.target.value)}
                            className="w-full border rounded-lg px-3 py-2 text-sm"
                        />
                    </div>

                    {/* Seleção de Caminhão */}
                    <div className="mb-4">
                        <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">Caminhão</label>
                        <Select value={caminhaoSelecionado?.toString()} onValueChange={(v) => setCaminhaoSelecionado(Number(v))}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione o caminhão..." />
                            </SelectTrigger>
                            <SelectContent>
                                {caminhoes.map(c => (
                                    <SelectItem key={c.id} value={c.id.toString()}>
                                        🚚 {c.nome} {c.placa ? `(${c.placa})` : ''}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Seleção de Turno */}
                    <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">Turno</label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { id: 'Manhã', icon: Sun, label: 'Manhã', bgLight: 'bg-amber-50/50', bgSolid: 'bg-amber-500', borderColor: 'border-amber-300', textColor: 'text-amber-600', textSelected: 'text-white' },
                                { id: 'Tarde', icon: Sunset, label: 'Tarde', bgLight: 'bg-orange-50/50', bgSolid: 'bg-orange-500', borderColor: 'border-orange-300', textColor: 'text-orange-600', textSelected: 'text-white' },
                                { id: 'Comercial', icon: Briefcase, label: 'Comercial', bgLight: 'bg-blue-50/50', bgSolid: 'bg-blue-500', borderColor: 'border-blue-300', textColor: 'text-blue-600', textSelected: 'text-white' }
                            ].map(turno => (
                                <button
                                    key={turno.id}
                                    onClick={() => setTurnoSelecionado(turno.id)}
                                    className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${turnoSelecionado === turno.id
                                        ? `${turno.bgSolid} border-transparent ${turno.textSelected} shadow-lg scale-105`
                                        : `${turno.bgLight} ${turno.borderColor} ${turno.textColor} hover:scale-102`
                                        }`}
                                >
                                    <turno.icon className={`w-6 h-6 ${turnoSelecionado === turno.id ? 'animate-pulse' : ''}`} />
                                    <span className="text-sm font-bold">{turno.label}</span>
                                    <Badge
                                        variant="secondary"
                                        className={`text-xs ${turnoSelecionado === turno.id ? 'bg-white/20 text-white' : ''}`}
                                    >
                                        {entregasPorTurno[turno.id]?.length || 0} entregas
                                    </Badge>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Alerta de Pagamento */}
                {
                    turnoSelecionado && pedidosAReceber.length > 0 && (
                        <Card className="border-2 border-amber-400 bg-amber-50">
                            <CardContent className="p-4">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-full bg-amber-200">
                                        <DollarSign className="w-5 h-5 text-amber-700" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-amber-800">
                                            {pedidosAReceber.length} pedido(s) a RECEBER
                                        </p>
                                        <p className="text-sm text-amber-700">
                                            Total: R$ {pedidosAReceber.reduce((s, p) => s + (p.valor_a_receber || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </p>
                                        <p className="text-xs text-amber-600 mt-1">
                                            💳 Prepare a máquina de cartão!
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )
                }

                {/* Preview das Entregas */}
                {
                    turnoSelecionado && (
                        <Card className="border-0 shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Package className="w-4 h-4" />
                                    Entregas do turno ({entregasRota.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {entregasRota.slice(0, 5).map((e, i) => (
                                    <div key={e.id} className="flex items-center gap-2 text-sm p-2 bg-gray-50 rounded">
                                        <Badge variant="outline" className="text-xs">{i + 1}</Badge>
                                        <span className="font-medium truncate flex-1">{e.endereco_entrega?.split(',')[0]}</span>
                                        {(e.pagamento_na_entrega || e.valor_a_receber > 0) && (
                                            <Badge className="bg-amber-500 text-white text-[10px]">💰 RECEBER</Badge>
                                        )}
                                    </div>
                                ))}
                                {entregasRota.length > 5 && (
                                    <p className="text-xs text-gray-400 text-center">+ {entregasRota.length - 5} mais...</p>
                                )}
                            </CardContent>
                        </Card>
                    )
                }

                {/* Botão Iniciar */}
                <Button
                    onClick={iniciarRota}
                    disabled={!caminhaoSelecionado || !turnoSelecionado || entregasRota.length === 0 || enviando}
                    className="w-full h-14 text-lg font-bold bg-green-600 hover:bg-green-700"
                >
                    <Navigation className="w-5 h-5 mr-2" />
                    INICIAR ROTA ({entregasRota.length} entregas)
                </Button>
            </div >
        );
    }

    // ===== TELA DE EXECUÇÃO DA ROTA =====
    return (
        <div className="max-w-lg mx-auto p-4 space-y-4 pb-24 bg-gray-50 min-h-screen">
            {/* Header com Status */}
            <div className="bg-white rounded-xl shadow-sm border p-4 sticky top-2 z-10">
                <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={finalizarRota}>
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <div>
                            <h1 className="font-bold text-gray-900">Rota {turnoSelecionado}</h1>
                            <p className="text-xs text-gray-500">{formatarData(dataSelecionada)} • {entregasRota.filter(e => e.status !== 'Entregue').length} pendentes</p>
                        </div>
                    </div>
                    <div className={`p-2 rounded-full ${rotaIniciada ? 'bg-green-100 text-green-700 animate-pulse' : 'bg-gray-100'}`}>
                        <Radio className="w-5 h-5" />
                    </div>
                </div>

                {rotaIniciada && (
                    <div className="flex items-center justify-center gap-2 p-2 bg-green-50 text-green-800 rounded text-xs font-medium">
                        <span className="w-2 h-2 bg-green-600 rounded-full animate-ping" />
                        GPS ativo • Atualizando a cada 5s
                    </div>
                )}
            </div>

            {/* Lista de Entregas */}
            <div className="space-y-3">
                {entregasRota.map((entrega, index) => {
                    const temPagamento = entrega.pagamento_na_entrega || entrega.valor_a_receber > 0;
                    const isProxima = index === 0 && entrega.status !== 'Entregue';

                    return (
                        <Card key={entrega.id} className={`border-0 shadow-sm ${isProxima ? 'ring-2 ring-blue-500' : ''} ${entrega.status === 'Entregue' ? 'opacity-50' : ''}`}>
                            {isProxima && (
                                <div className="bg-blue-600 text-white text-[10px] font-bold px-3 py-1 text-center">
                                    PRÓXIMA PARADA
                                </div>
                            )}
                            {entrega.status === 'Entregue' && (
                                <div className="bg-green-600 text-white text-[10px] font-bold px-3 py-1 text-center">
                                    ✓ ENTREGUE
                                </div>
                            )}

                            {/* Badge de pagamento */}
                            {temPagamento && entrega.status !== 'Entregue' && (
                                <div className="bg-amber-500 text-white text-[10px] font-bold px-3 py-1 text-center flex items-center justify-center gap-1">
                                    <DollarSign className="w-3 h-3" />
                                    RECEBER: R$ {(entrega.valor_a_receber || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    {entrega.forma_pagamento && ` (${entrega.forma_pagamento})`}
                                </div>
                            )}

                            <CardContent className="p-4">
                                {/* Header */}
                                <div className="flex justify-between items-center mb-2">
                                    <Badge variant="outline" className="text-sm font-bold">#{index + 1}</Badge>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-400">Pedido</span>
                                        <span className="font-bold text-sm">#{entrega.numero_pedido}</span>
                                    </div>
                                </div>

                                {/* Endereço em Destaque */}
                                <div className="bg-gray-50 rounded-lg p-3 mb-3 border border-gray-100">
                                    <div className="flex items-start gap-2">
                                        <MapPin className="w-5 h-5 mt-0.5 text-red-500 flex-shrink-0" />
                                        <div className="flex-1">
                                            <p className="font-bold text-gray-800 leading-tight">{entrega.endereco_entrega}</p>
                                            <a
                                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(entrega.endereco_entrega || '')}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                                            >
                                                Abrir no Maps →
                                            </a>
                                        </div>
                                    </div>
                                </div>

                                {/* Cliente */}
                                <p className="text-sm text-gray-500 mb-3">
                                    <span className="text-xs text-gray-400">Cliente:</span> {entrega.cliente_nome}
                                </p>

                                {/* Tentativas anteriores */}
                                {entrega.tentativas > 0 && (
                                    <div className="bg-red-50 border border-red-200 rounded p-2 mb-3 text-xs text-red-700">
                                        ⚠️ Tentativa {entrega.tentativas + 1} - {entrega.observacoes_entrega}
                                    </div>
                                )}

                                {entrega.status !== 'Entregue' && (
                                    <div className="space-y-2">
                                        {/* Botões principais */}
                                        <div className="grid grid-cols-2 gap-2">
                                            <Button variant="outline" size="sm" onClick={() => avisarProximo(entrega)} disabled={enviando}>
                                                <Send className="w-4 h-4 mr-1" /> Avisar
                                            </Button>
                                            <Button
                                                size="sm"
                                                className="bg-green-600 hover:bg-green-700"
                                                onClick={() => iniciarFinalizacao(entrega)}
                                            >
                                                <PenTool className="w-4 h-4 mr-1" /> Entregar
                                            </Button>
                                        </div>

                                        {/* Botão de falha */}
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full border-red-300 text-red-600 hover:bg-red-50"
                                            onClick={() => iniciarFalhaEntrega(entrega)}
                                        >
                                            <X className="w-4 h-4 mr-1" /> Não consegui entregar
                                        </Button>

                                        {/* Botão de link de pagamento (backup para máquina) */}
                                        {temPagamento && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="w-full border-blue-300 text-blue-600 hover:bg-blue-50"
                                                onClick={() => {
                                                    setModalLinkPagamento(entrega);
                                                    gerarLinkPagamento(entrega);
                                                }}
                                                disabled={gerandoLink}
                                            >
                                                {gerandoLink ? (
                                                    <><span className="animate-spin mr-1">⏳</span> Gerando...</>
                                                ) : (
                                                    <><Link2 className="w-4 h-4 mr-1" /> Gerar Link de Pagamento</>
                                                )}
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}

                {/* Assistências Técnicas */}
                {todasAssistencias.length > 0 && (
                    <>
                        <div className="flex items-center gap-2 mt-4 mb-2">
                            <div className="flex-1 h-px bg-purple-200" />
                            <span className="text-xs font-bold text-purple-600 uppercase flex items-center gap-1">
                                <Wrench className="w-3.5 h-3.5" />
                                Assistências Técnicas ({todasAssistencias.length})
                            </span>
                            <div className="flex-1 h-px bg-purple-200" />
                        </div>

                        {todasAssistencias.map((assistencia) => (
                            <Card key={`at-${assistencia.id}`} className="border-0 shadow-sm ring-2 ring-purple-200 bg-gradient-to-r from-purple-50 to-white">
                                <div className="bg-purple-600 text-white text-[10px] font-bold px-3 py-1 text-center flex items-center justify-center gap-1">
                                    <Wrench className="w-3 h-3" />
                                    {assistencia.tipo.toUpperCase()}
                                </div>

                                <CardContent className="p-4">
                                    {/* Header */}
                                    <div className="flex justify-between items-center mb-2">
                                        <Badge variant="outline" className="text-sm font-bold border-purple-300 text-purple-700">
                                            AT #{assistencia.numero_pedido}
                                        </Badge>
                                        <Badge className={`text-[10px] ${assistencia.prioridade === 'Urgente' ? 'bg-red-500' :
                                            assistencia.prioridade === 'Alta' ? 'bg-orange-500' : 'bg-purple-500'
                                            }`}>
                                            {assistencia.prioridade}
                                        </Badge>
                                    </div>

                                    {/* Cliente */}
                                    <p className="font-bold text-gray-800 mb-1">{assistencia.cliente_nome}</p>

                                    {/* Problema */}
                                    <div className="bg-purple-50 rounded-lg p-2 mb-3 border border-purple-100">
                                        <p className="text-xs text-purple-800 font-medium">Problema:</p>
                                        <p className="text-sm text-gray-700">{assistencia.descricao_problema}</p>
                                    </div>

                                    {/* Itens */}
                                    {assistencia.itens_envolvidos?.length > 0 && (
                                        <p className="text-xs text-gray-500 mb-3">
                                            <strong>Itens:</strong> {assistencia.itens_envolvidos.map(i => i.produto_nome).join(', ')}
                                        </p>
                                    )}

                                    {/* Botões */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                const tel = assistencia.cliente_telefone?.replace(/\D/g, '');
                                                if (tel) window.open(`https://wa.me/55${tel}`, '_blank');
                                                else toast.error("Telefone não cadastrado");
                                            }}
                                        >
                                            <Send className="w-4 h-4 mr-1" /> Contato
                                        </Button>
                                        <Button
                                            size="sm"
                                            className="bg-purple-600 hover:bg-purple-700"
                                            onClick={() => {
                                                setModalConcluirAssistencia(assistencia);
                                                setObservacaoAssistencia("");
                                            }}
                                        >
                                            <CheckCircle className="w-4 h-4 mr-1" /> Concluir
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </>
                )}

                {entregasRota.filter(e => e.status !== 'Entregue').length === 0 && todasAssistencias.length === 0 && (
                    <div className="text-center py-10 text-gray-400">
                        <CheckCircle className="w-16 h-16 mx-auto mb-3 opacity-20" />
                        <p className="font-medium">Todas as tarefas concluídas!</p>
                        <Button variant="outline" className="mt-4" onClick={finalizarRota}>
                            Finalizar Rota
                        </Button>
                    </div>
                )}
            </div>

            {/* Modal de Assinatura */}
            <Dialog open={!!modalAssinatura} onOpenChange={() => setModalAssinatura(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <PenTool className="w-5 h-5" />
                            Assinatura do Cliente
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <p className="text-sm text-gray-500 mb-4 text-center">
                            Peça ao cliente para assinar abaixo confirmando o recebimento
                        </p>
                        <AssinaturaCanvas
                            onSave={salvarAssinatura}
                            onCancel={() => setModalAssinatura(null)}
                        />
                    </div>
                </DialogContent>
            </Dialog>

            {/* Modal de Comprovante de Pagamento */}
            <Dialog open={!!modalComprovante} onOpenChange={() => setModalComprovante(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Camera className="w-5 h-5" />
                            Comprovante de Pagamento
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                            <p className="text-sm font-medium text-amber-800">
                                💰 Valor recebido: R$ {(modalComprovante?.valor_a_receber || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                            {modalComprovante?.forma_pagamento && (
                                <p className="text-xs text-amber-600">Forma: {modalComprovante.forma_pagamento}</p>
                            )}
                        </div>
                        <CameraCapture
                            titulo="Foto do Comprovante"
                            onCapture={salvarComprovante}
                            onCancel={() => {
                                // Finalizar sem comprovante
                                const entrega = modalComprovante;
                                setModalComprovante(null);
                                finalizarEntrega(entrega, entrega.assinatura_url, null);
                            }}
                        />
                    </div>
                </DialogContent>
            </Dialog>

            {/* NOVO: Modal de Foto dos Móveis Entregues */}
            <Dialog open={!!modalFotoEntrega} onOpenChange={() => { }}>
                <DialogContent className="max-w-md mx-4">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-green-600">
                            <Camera className="w-5 h-5" />
                            Foto dos Móveis (Obrigatório)
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-2">
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                            <p className="text-sm text-green-700 text-center">
                                📸 Tire foto dos móveis entregues ao cliente
                            </p>
                            <p className="text-xs text-green-600 text-center mt-1">
                                Esta foto serve como comprovante de entrega
                            </p>
                        </div>
                        <FotoEntregaCapture
                            entregaId={modalFotoEntrega?.id}
                            numeroPedido={modalFotoEntrega?.numero_pedido}
                            minFotos={1}
                            maxFotos={3}
                            onComplete={salvarFotosEntrega}
                            onCancel={() => {
                                // Perguntar se quer continuar sem foto
                                if (confirm('Continuar sem foto? (Não recomendado)')) {
                                    const entrega = modalFotoEntrega;
                                    setModalFotoEntrega(null);
                                    // Se tem pagamento, ir para comprovante
                                    if (entrega.pagamento_na_entrega || entrega.valor_a_receber > 0) {
                                        setModalComprovante(entrega);
                                    } else {
                                        finalizarEntrega(entrega, entrega.assinatura_url, null);
                                    }
                                }
                            }}
                        />
                    </div>
                </DialogContent>
            </Dialog>

            {/* Modal de Falha na Entrega */}
            <Dialog open={!!modalFalha} onOpenChange={() => setModalFalha(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <AlertTriangle className="w-5 h-5" />
                            Não foi possível entregar
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        {etapaFalha === 'foto' ? (
                            <>
                                <p className="text-sm text-gray-500 mb-4 text-center">
                                    📸 Tire uma foto da FRENTE DA CASA/LOCAL do cliente
                                </p>
                                <CameraCapture
                                    titulo="Foto do Local (Obrigatório)"
                                    onCapture={salvarFotoFalha}
                                    onCancel={() => setModalFalha(null)}
                                />
                            </>
                        ) : (
                            <div className="space-y-4">
                                <div className="bg-gray-100 rounded-lg p-2">
                                    <img src={fotoFalha} alt="Foto do local" className="w-full h-32 object-cover rounded" />
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-gray-700 block mb-2">
                                        Motivo (obrigatório):
                                    </label>
                                    <Textarea
                                        value={observacaoFalha}
                                        onChange={(e) => setObservacaoFalha(e.target.value)}
                                        placeholder="Ex: Cliente não estava em casa, endereço incorreto, recusa de recebimento..."
                                        rows={3}
                                    />
                                </div>

                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => setEtapaFalha('foto')}
                                        className="flex-1"
                                    >
                                        Refazer Foto
                                    </Button>
                                    <Button
                                        onClick={confirmarFalhaEntrega}
                                        disabled={!observacaoFalha.trim() || enviando}
                                        className="flex-1 bg-red-600 hover:bg-red-700"
                                    >
                                        Confirmar
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Modal de Conclusão de Assistência */}
            <Dialog open={!!modalConcluirAssistencia} onOpenChange={() => setModalConcluirAssistencia(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-purple-700">
                            <Wrench className="w-5 h-5" />
                            Concluir Assistência
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        {modalConcluirAssistencia && (
                            <>
                                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                                    <p className="text-xs text-purple-600 font-bold uppercase mb-1">{modalConcluirAssistencia.tipo}</p>
                                    <p className="font-bold text-gray-800">{modalConcluirAssistencia.cliente_nome}</p>
                                    <p className="text-sm text-gray-600">Pedido #{modalConcluirAssistencia.numero_pedido}</p>
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-gray-700 block mb-2">
                                        Observação / Solução Aplicada (opcional):
                                    </label>
                                    <Textarea
                                        value={observacaoAssistencia}
                                        onChange={(e) => setObservacaoAssistencia(e.target.value)}
                                        placeholder="Ex: Peça entregue ao cliente, troca realizada, problema resolvido..."
                                        rows={3}
                                    />
                                </div>

                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => setModalConcluirAssistencia(null)}
                                        className="flex-1"
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        onClick={concluirAssistencia}
                                        disabled={enviando}
                                        className="flex-1 bg-purple-600 hover:bg-purple-700"
                                    >
                                        {enviando ? "Salvando..." : "Marcar Concluída"}
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Modal de Link de Pagamento */}
            <Dialog open={!!modalLinkPagamento} onOpenChange={(open) => !open && setModalLinkPagamento(null)}>
                <DialogContent className="max-w-md mx-4">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Link2 className="w-5 h-5 text-blue-600" />
                            Link de Pagamento
                        </DialogTitle>
                    </DialogHeader>

                    {gerandoLink ? (
                        <div className="flex flex-col items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                            <p className="text-gray-500">Gerando link...</p>
                        </div>
                    ) : linkPagamentoData ? (
                        <div className="space-y-4">
                            {/* Valor e Pedido */}
                            <div className="bg-blue-50 rounded-lg p-4 text-center">
                                <p className="text-sm text-blue-600">Pedido #{linkPagamentoData.entrega?.numero_pedido}</p>
                                <p className="text-2xl font-bold text-blue-800">
                                    R$ {linkPagamentoData.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                            </div>

                            {/* QR Code */}
                            {linkPagamentoData.qr_code_url && (
                                <div className="flex justify-center">
                                    <div className="bg-white p-3 rounded-lg border shadow-sm">
                                        <img
                                            src={linkPagamentoData.qr_code_url}
                                            alt="QR Code"
                                            className="w-40 h-40"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Link copiável */}
                            <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2 border">
                                <input
                                    type="text"
                                    value={linkPagamentoData.link_pagamento}
                                    readOnly
                                    className="flex-1 bg-transparent border-none focus:outline-none text-xs text-gray-500 truncate"
                                />
                                <Button size="sm" variant="ghost" onClick={copiarLink} className="shrink-0">
                                    {linkCopiado ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                                </Button>
                            </div>

                            {/* WhatsApp Options */}
                            <div className="bg-green-50 rounded-lg p-4 border border-green-200 space-y-3">
                                <p className="text-sm font-semibold text-green-800 flex items-center gap-1">
                                    <MessageCircle className="w-4 h-4" /> Enviar via WhatsApp
                                </p>

                                {/* Enviar para cliente cadastrado */}
                                {linkPagamentoData.entrega?.cliente_telefone && (
                                    <Button
                                        size="sm"
                                        onClick={() => enviarWhatsAppPara(linkPagamentoData.entrega.cliente_telefone, linkPagamentoData.entrega)}
                                        className="w-full bg-green-600 hover:bg-green-700 justify-start gap-2"
                                    >
                                        <MessageCircle className="w-4 h-4" />
                                        Enviar para {linkPagamentoData.entrega?.cliente_nome?.split(' ')[0]}
                                    </Button>
                                )}

                                {/* Enviar para outro número */}
                                <div className="flex gap-2">
                                    <div className="flex-1 relative">
                                        <Input
                                            type="tel"
                                            placeholder="Outro número"
                                            value={numeroAlternativo}
                                            onChange={(e) => setNumeroAlternativo(e.target.value.replace(/\D/g, ''))}
                                            className="h-9 text-sm pl-10"
                                        />
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">+55</span>
                                    </div>
                                    <Button
                                        size="sm"
                                        onClick={() => enviarWhatsAppPara(numeroAlternativo, linkPagamentoData.entrega)}
                                        disabled={!numeroAlternativo || numeroAlternativo.length < 10}
                                        className="bg-green-600 hover:bg-green-700"
                                    >
                                        <Send className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>

                            {/* Botão Fechar */}
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => {
                                    setModalLinkPagamento(null);
                                    setLinkPagamentoData(null);
                                    setNumeroAlternativo("");
                                }}
                            >
                                Fechar
                            </Button>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-500">
                            Erro ao gerar link. Tente novamente.
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}