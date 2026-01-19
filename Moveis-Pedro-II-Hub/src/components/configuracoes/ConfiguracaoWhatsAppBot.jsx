import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
    MessageCircle, Save, Loader2, CheckCircle, AlertCircle,
    RefreshCw, Power, PowerOff, Smartphone, Bot, Sparkles,
    QrCode, Wifi, WifiOff, Truck, Package, ShoppingBag,
    Wrench, Megaphone, ChevronDown, ChevronRight, Edit2, Eye, EyeOff,
    Copy, Gift, MapPin, AlertTriangle, Clock, Calendar, Key, Rocket
} from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";

const WHATSAPP_BOT_URL = "http://localhost:3001";

// Definição de todos os templates de mensagens
const MESSAGE_TEMPLATES = {
    entregas: {
        label: "Entregas",
        icon: Package,
        color: "text-blue-600",
        bgColor: "bg-blue-50",
        borderColor: "border-blue-100",
        messages: [
            {
                key: "entrega_confirmacao",
                label: "Confirmação de Entrega",
                description: "Enviada ao confirmar uma entrega para o cliente",
                icon: CheckCircle,
                variables: [
                    { key: "{{nome}}", label: "Nome do Cliente", example: "João Silva" },
                    { key: "{{pedido}}", label: "Número do Pedido", example: "#12345" },
                    { key: "{{data}}", label: "Data da Entrega", example: "AMANHÃ" },
                    { key: "{{horario}}", label: "Faixa de Horário", example: "08:00 às 13:00" },
                    { key: "{{produtos}}", label: "Lista de Produtos", example: "Sofá 3 lugares, Mesa de jantar" }
                ],
                defaultTemplate: `Olá *{{nome}}*! 👋
Aqui é da *Móveis Pedro II*.

🚚 *Sua entrega está confirmada!*

📦 Pedido: #{{pedido}}
📅 Data: *{{data}}*
🕐 Horário: *{{horario}}*

*O que você vai receber:*
{{produtos}}

✅ Tudo certo por aqui! Nossa equipe já está preparando seu pedido.

⚠️ *Lembre-se:* É necessário que tenha alguém *maior de idade* no local para receber e conferir os itens.

_O horário pode ter pequenas variações devido ao trânsito._

Qualquer imprevisto, é só responder esta mensagem! 📱`
            },
            {
                key: "reagendamento",
                label: "Reagendamento de Entrega",
                description: "Enviada quando uma entrega precisa ser reagendada",
                icon: Calendar,
                variables: [
                    { key: "{{nome}}", label: "Nome do Cliente", example: "Maria Santos" },
                    { key: "{{pedido}}", label: "Número do Pedido", example: "#54321" }
                ],
                defaultTemplate: `Olá *{{nome}}*! 😔

Pedimos desculpas, mas *ocorreu um imprevisto* e precisaremos reagendar a sua entrega.

📦 Pedido: *#{{pedido}}*

Fique tranquilo(a)! O reagendamento será feito dentro do prazo original do seu pedido.

Nossa equipe entrará em contato em breve para confirmar a nova data da entrega.

Pedimos desculpas pelo inconveniente. 🙏
*Móveis Pedro II*`
            },
            {
                key: "entrega_falha",
                label: "Entrega Não Realizada",
                description: "Enviada quando não foi possível entregar",
                icon: AlertTriangle,
                variables: [
                    { key: "{{nome}}", label: "Nome do Cliente", example: "Carlos Oliveira" },
                    { key: "{{pedido}}", label: "Número do Pedido", example: "#99999" },
                    { key: "{{motivo}}", label: "Motivo da Falha", example: "Cliente ausente" }
                ],
                defaultTemplate: `Olá *{{nome}}*! 😔

Nossos entregadores estiveram no endereço hoje, mas *não conseguimos realizar a entrega* do seu pedido *#{{pedido}}*.

📝 Motivo: {{motivo}}

O pedido está retornando ao nosso depósito e faremos uma *nova tentativa de entrega em breve*.

Nossa equipe entrará em contato para reagendar uma data conveniente para você.

Caso tenha alguma dúvida, responda esta mensagem!

*Móveis Pedro II* 🧡💚`
            }
        ]
    },
    logistica: {
        label: "Logística",
        icon: Truck,
        color: "text-orange-600",
        bgColor: "bg-orange-50",
        borderColor: "border-orange-100",
        messages: [
            {
                key: "inicio_rota",
                label: "Início de Rota",
                description: "Enviada quando o caminhão sai para as entregas",
                icon: Truck,
                variables: [
                    { key: "{{nome}}", label: "Nome do Cliente", example: "Ana Paula" },
                    { key: "{{pedido}}", label: "Número do Pedido", example: "#11111" }
                ],
                defaultTemplate: `Bom dia, *{{nome}}*! 🚚

O caminhão da *Móveis Pedro II* acabou de sair do depósito e iniciou a rota de entregas de hoje.

📦 Seu pedido *#{{pedido}}* está a caminho!
Por favor, mantenha alguém no local para receber.

Até breve!`
            },
            {
                key: "proxima_parada",
                label: "Próxima Parada",
                description: "Enviada quando o cliente é o próximo da rota",
                icon: MapPin,
                variables: [
                    { key: "{{nome}}", label: "Nome do Cliente", example: "Roberto Lima" },
                    { key: "{{localizacao}}", label: "Link de Localização", example: "https://maps.google.com/..." }
                ],
                defaultTemplate: `*Móveis Pedro II Informa:* 📍

Olá *{{nome}}*! O motorista finalizou a entrega anterior e **você é a próxima parada!**

Prepare-se para receber seus móveis em breve.

👇 *Localização atual do caminhão:*
{{localizacao}}`
            }
        ]
    },
    vendas: {
        label: "Vendas",
        icon: ShoppingBag,
        color: "text-green-600",
        bgColor: "bg-green-50",
        borderColor: "border-green-100",
        messages: [
            {
                key: "pos_venda",
                label: "Mensagem Pós-Venda",
                description: "Enviada após o cliente finalizar uma compra",
                icon: CheckCircle,
                variables: [
                    { key: "{{nome}}", label: "Nome do Cliente", example: "Fernanda Costa" },
                    { key: "{{pedido}}", label: "Número do Pedido", example: "#77777" },
                    { key: "{{produtos}}", label: "Lista de Produtos", example: "Guarda-roupa, Cômoda" },
                    { key: "{{prazo}}", label: "Prazo de Entrega", example: "15 dias" }
                ],
                defaultTemplate: `Olá *{{nome}}!* 🎉
Muito obrigado por comprar na *Móveis Pedro II*.

✅ *Seu Pedido #{{pedido}} foi confirmado!*

📦 *Itens do seu pedido:*
{{produtos}}

⚠️ *IMPORTANTE:*
Por favor, **salve este número** na sua agenda. É por aqui que vamos te avisar sobre a entrega.

📅 *Prazo:* {{prazo}} úteis
Não precisa se preocupar em ligar! Quando seu pedido já tiver uma rota pronta, entraremos em contato para te informar a data da entrega.

Qualquer dúvida, estamos à disposição! 🧡💚`
            }
        ]
    },
    montagem: {
        label: "Montagem",
        icon: Wrench,
        color: "text-purple-600",
        bgColor: "bg-purple-50",
        borderColor: "border-purple-100",
        messages: [
            {
                key: "montagem_agendada",
                label: "Montagem Agendada",
                description: "Enviada quando uma montagem é agendada",
                icon: Calendar,
                variables: [
                    { key: "{{nome}}", label: "Nome do Cliente", example: "Paulo Mendes" },
                    { key: "{{pedido}}", label: "Número do Pedido", example: "#88888" },
                    { key: "{{produto}}", label: "Produto", example: "Guarda-roupa 6 portas" },
                    { key: "{{data}}", label: "Data da Montagem", example: "Segunda, 15/01" },
                    { key: "{{turno}}", label: "Turno", example: "Manhã" },
                    { key: "{{montador}}", label: "Nome do Montador", example: "José" },
                    { key: "{{contato_montador}}", label: "Contato do Montador", example: "wa.me/5511999999999" }
                ],
                defaultTemplate: `Olá *{{nome}}*! 🛠️

Sua *montagem* do pedido *#{{pedido}}* foi agendada!

📅 *Data:* {{data}}
🕐 *Turno:* {{turno}}
📦 *Item:* {{produto}}

👷 *Montador:* {{montador}}
📱 *Contato direto:* {{contato_montador}}

💡 *Precisa reagendar?*
Entre em contato diretamente com o montador pelo WhatsApp acima. Ele tem autonomia para ajustar a data e horário conforme sua disponibilidade.

⚠️ Por favor, certifique-se de que haverá alguém no local para receber.

*Móveis Pedro II* 🧡💚`
            },
            {
                key: "lembrete_montagem",
                label: "Lembrete de Montagem",
                description: "Enviada no dia da montagem às 8h",
                icon: Clock,
                variables: [
                    { key: "{{nome}}", label: "Nome do Cliente", example: "Lucia Andrade" },
                    { key: "{{horario}}", label: "Horário Previsto", example: "Manhã (8h-12h)" }
                ],
                defaultTemplate: `Bom dia, *{{nome}}*! ☀️

Hoje é o dia da sua *montagem*!

🕐 Horário previsto: *{{horario}}*

O montador chegará em breve. Por favor, mantenha alguém no local para receber.

Se precisar de algo, responda esta mensagem!
*Móveis Pedro II* 🧡💚`
            },
            {
                key: "montador_caminho",
                label: "Montador a Caminho",
                description: "Enviada quando o montador sai para o local",
                icon: Truck,
                variables: [
                    { key: "{{nome}}", label: "Nome do Cliente", example: "Marcos Ferreira" }
                ],
                defaultTemplate: `Olá *{{nome}}*! 🚗

O montador está *a caminho* do seu endereço!

Previsão de chegada: *em breve*

Por favor, aguarde no local indicado.

*Móveis Pedro II* 🧡💚`
            }
        ]
    },
    marketing: {
        label: "Marketing",
        icon: Megaphone,
        color: "text-pink-600",
        bgColor: "bg-pink-50",
        borderColor: "border-pink-100",
        messages: [
            {
                key: "aniversario",
                label: "Aniversário do Cliente",
                description: "Enviada para parabenizar clientes aniversariantes",
                icon: Gift,
                variables: [
                    { key: "{{nome}}", label: "Nome do Cliente", example: "Beatriz Lima" },
                    { key: "{{cupom}}", label: "Código do Cupom", example: "ANIVER10" },
                    { key: "{{lojas}}", label: "Endereços das Lojas", example: "📍 Loja Centro..." }
                ],
                defaultTemplate: `Olá *{{nome}}*! 🎂🎉

A equipe da *Móveis Pedro II* deseja um FELIZ ANIVERSÁRIO!

Para celebrar seu dia especial, preparamos um presente exclusivo:
💜 *10% de desconto* na sua próxima compra!

🎁 Use o cupom: *{{cupom}}*
_⚠️ Apresente este cupom no balcão da loja junto com uma documentação sua!_
_✨ Válido por 30 dias_

{{lojas}}

Um grande abraço! 🧡💚`
            },
            {
                key: "recuperacao_orcamento",
                label: "Recuperação de Orçamento",
                description: "Enviada para clientes que fizeram orçamento mas não fecharam",
                icon: ShoppingBag,
                variables: [
                    { key: "{{nome}}", label: "Nome do Cliente", example: "Ricardo Souza" },
                    { key: "{{valor}}", label: "Valor do Orçamento", example: "R$ 2.500,00" }
                ],
                defaultTemplate: `Olá *{{nome}}*!
Aqui é da *Móveis Pedro II*.

Vi que você fez um orçamento conosco de *{{valor}}* e ainda não fechou. 📋

🎯 Conseguimos manter as condições especiais se você fechar até hoje!

Posso te ajudar a finalizar a compra? 
Estou à disposição para tirar qualquer dúvida! 😊`
            }
        ]
    }
};

export default function ConfiguracaoWhatsAppBot() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [reconnecting, setReconnecting] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);
    const [activeTab, setActiveTab] = useState("conexao");
    const [showApiKey, setShowApiKey] = useState(false);

    // Estado da conexão WhatsApp
    const [connectionStatus, setConnectionStatus] = useState('initializing');
    const [qrCode, setQrCode] = useState(null);
    const [qrCodeImage, setQrCodeImage] = useState(null);
    const [connectionInfo, setConnectionInfo] = useState(null);

    // Configurações do agente IA
    const [settings, setSettings] = useState({
        ai_enabled: true,
        ai_model: "gemini-2.0-flash",
        ai_instructions: "",
        welcome_message: "",
        gemini_api_key: ""
    });
    const [originalSettings, setOriginalSettings] = useState(null);

    // Templates de mensagens
    const [messageSettings, setMessageSettings] = useState({});
    const [originalMessageSettings, setOriginalMessageSettings] = useState({});

    // Modal de edição
    const [editingMessage, setEditingMessage] = useState(null);
    const [editingTemplate, setEditingTemplate] = useState("");
    const [editingEnabled, setEditingEnabled] = useState(true);

    // Expandidos (acordeões)
    const [expandedCategories, setExpandedCategories] = useState({});

    // Polling de status do WhatsApp
    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch(`${WHATSAPP_BOT_URL}/whatsapp/status`);
            if (res.ok) {
                const data = await res.json();
                setConnectionStatus(data.status);
                setQrCode(data.qr);
                setConnectionInfo(data.info);

                if (data.qr && data.qr !== qrCode) {
                    const qrImg = await QRCode.toDataURL(data.qr, {
                        width: 280,
                        margin: 2,
                        color: { dark: '#000000', light: '#ffffff' }
                    });
                    setQrCodeImage(qrImg);
                } else if (!data.qr) {
                    setQrCodeImage(null);
                }
            }
        } catch (error) {
            setConnectionStatus('offline');
        }
    }, [qrCode]);

    // Carregar configurações
    const loadSettings = async () => {
        try {
            const res = await fetch(`${WHATSAPP_BOT_URL}/whatsapp/ai-settings`);
            if (res.ok) {
                const data = await res.json();

                // Separar configurações de IA
                const aiSettings = {
                    ai_enabled: data.ai_enabled ?? true,
                    ai_model: data.ai_model ?? "gemini-2.0-flash",
                    ai_instructions: data.ai_instructions ?? "",
                    welcome_message: data.welcome_message ?? "",
                    gemini_api_key: data.gemini_api_key ?? ""
                };
                setSettings(aiSettings);
                setOriginalSettings(aiSettings);

                // Configurações de mensagens
                const msgSettings = {};
                Object.values(MESSAGE_TEMPLATES).forEach(category => {
                    category.messages.forEach(msg => {
                        msgSettings[msg.key] = {
                            enabled: data[`msg_${msg.key}_enabled`] ?? true,
                            template: data[`msg_${msg.key}_template`] ?? msg.defaultTemplate
                        };
                    });
                });
                setMessageSettings(msgSettings);
                setOriginalMessageSettings(JSON.parse(JSON.stringify(msgSettings)));
            }
        } catch (error) {
            console.error("Erro ao carregar configurações:", error);
            // Usar valores padrão
            const msgSettings = {};
            Object.values(MESSAGE_TEMPLATES).forEach(category => {
                category.messages.forEach(msg => {
                    msgSettings[msg.key] = {
                        enabled: true,
                        template: msg.defaultTemplate
                    };
                });
            });
            setMessageSettings(msgSettings);
            setOriginalMessageSettings(JSON.parse(JSON.stringify(msgSettings)));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
        loadSettings();

        const interval = setInterval(fetchStatus, 3000);
        return () => clearInterval(interval);
    }, [fetchStatus]);

    const handleSaveAI = async () => {
        setSaving(true);
        try {
            const res = await fetch(`${WHATSAPP_BOT_URL}/whatsapp/ai-settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });

            if (!res.ok) throw new Error('Falha ao salvar');

            setOriginalSettings({ ...settings });
            toast.success("Configurações de IA salvas!");
        } catch (error) {
            toast.error("Erro ao salvar configurações");
        } finally {
            setSaving(false);
        }
    };

    const handleSaveMessages = async () => {
        setSaving(true);
        try {
            // Converter messageSettings para formato do banco
            const payload = {};
            Object.entries(messageSettings).forEach(([key, value]) => {
                payload[`msg_${key}_enabled`] = value.enabled;
                payload[`msg_${key}_template`] = value.template;
            });

            const res = await fetch(`${WHATSAPP_BOT_URL}/whatsapp/ai-settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error('Falha ao salvar');

            setOriginalMessageSettings(JSON.parse(JSON.stringify(messageSettings)));
            toast.success("Templates de mensagens salvos!");
        } catch (error) {
            toast.error("Erro ao salvar mensagens");
        } finally {
            setSaving(false);
        }
    };

    const handleReconnect = async () => {
        setReconnecting(true);
        try {
            const res = await fetch(`${WHATSAPP_BOT_URL}/whatsapp/reconnect`, { method: 'POST' });
            if (res.ok) {
                toast.success("Reconexão iniciada!");
                setTimeout(fetchStatus, 1000);
            }
        } catch (error) {
            toast.error("Erro ao reconectar");
        } finally {
            setReconnecting(false);
        }
    };

    const handleDisconnect = async () => {
        setDisconnecting(true);
        try {
            const res = await fetch(`${WHATSAPP_BOT_URL}/whatsapp/disconnect`, { method: 'POST' });
            if (res.ok) {
                toast.success("Desconectado!");
                setTimeout(fetchStatus, 1000);
            }
        } catch (error) {
            toast.error("Erro ao desconectar");
        } finally {
            setDisconnecting(false);
        }
    };

    const openMessageEditor = (msg) => {
        setEditingMessage(msg);
        setEditingTemplate(messageSettings[msg.key]?.template || msg.defaultTemplate);
        setEditingEnabled(messageSettings[msg.key]?.enabled ?? true);
    };

    const saveMessageEdit = () => {
        setMessageSettings(prev => ({
            ...prev,
            [editingMessage.key]: {
                enabled: editingEnabled,
                template: editingTemplate
            }
        }));
        setEditingMessage(null);
        toast.success("Alterações aplicadas! Clique em 'Salvar Todas as Mensagens' para persistir.");
    };

    const insertVariable = (variable) => {
        setEditingTemplate(prev => prev + variable);
    };

    const toggleCategory = (cat) => {
        setExpandedCategories(prev => ({
            ...prev,
            [cat]: !prev[cat]
        }));
    };

    const hasAIChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);
    const hasMessageChanges = JSON.stringify(messageSettings) !== JSON.stringify(originalMessageSettings);

    const getStatusBadge = () => {
        const badges = {
            connected: { class: "bg-green-100 text-green-800", icon: Wifi, text: "Conectado Online" },
            waiting_qr: { class: "bg-yellow-100 text-yellow-800", icon: QrCode, text: "Escaneie o QR" },
            initializing: { class: "bg-blue-100 text-blue-800", icon: Loader2, text: "Iniciando..." },
            offline: { class: "bg-red-100 text-red-800", icon: WifiOff, text: "Servidor Offline" },
            disconnected: { class: "bg-gray-100 text-gray-800", icon: WifiOff, text: "Desconectado" }
        };
        const b = badges[connectionStatus] || badges.disconnected;
        const Icon = b.icon;
        return (
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${b.class} border-opacity-20`}>
                <Icon className={`w-3.5 h-3.5 ${connectionStatus === 'initializing' ? 'animate-spin' : ''}`} />
                {b.text}
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-green-600" />
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <div className="flex items-start justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Rocket className="w-8 h-8 text-green-600" />
                        Automação WhatsApp
                    </h2>
                    <p className="text-gray-500 mt-1">Configure o bot de atendimento, notificações automáticas e IA.</p>
                </div>
                {getStatusBadge()}
            </div>

            <Card className="border-t-4 border-t-green-600 shadow-sm overflow-hidden">
                <div className="border-b bg-gray-50/50 px-6 py-2">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="bg-transparent h-auto p-0 gap-6 w-full justify-start">
                            <TabsTrigger
                                value="conexao"
                                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-green-600 rounded-none px-2 py-3 text-gray-500 hover:text-green-700 data-[state=active]:text-green-700 font-medium transition-all"
                            >
                                <Wifi className="w-4 h-4 mr-2" /> Conexão
                            </TabsTrigger>
                            <TabsTrigger
                                value="mensagens"
                                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-green-600 rounded-none px-2 py-3 text-gray-500 hover:text-green-700 data-[state=active]:text-green-700 font-medium transition-all"
                            >
                                <MessageCircle className="w-4 h-4 mr-2" /> Mensagens Automáticas
                            </TabsTrigger>
                            <TabsTrigger
                                value="agente"
                                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-green-600 rounded-none px-2 py-3 text-gray-500 hover:text-green-700 data-[state=active]:text-green-700 font-medium transition-all"
                            >
                                <Bot className="w-4 h-4 mr-2" /> Agente Inteligente (IA)
                            </TabsTrigger>
                            <TabsTrigger
                                value="funcoes"
                                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-green-600 rounded-none px-2 py-3 text-gray-500 hover:text-green-700 data-[state=active]:text-green-700 font-medium transition-all"
                            >
                                <Sparkles className="w-4 h-4 mr-2" /> Recursos Extras
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>

                <CardContent className="p-6">
                    <Tabs value={activeTab} className="w-full">
                        {/* Tab Conexão */}
                        <TabsContent value="conexao" className="mt-0 space-y-6">
                            <div className="grid md:grid-cols-2 gap-8 items-start">
                                <div>
                                    <h3 className="text-lg font-semibold mb-2">Status do Dispositivo</h3>
                                    <p className="text-gray-500 text-sm mb-6">Escaneie o QR Code para conectar seu WhatsApp Business e começar a enviar mensagens automáticas.</p>

                                    {connectionStatus === 'connected' && connectionInfo ? (
                                        <div className="bg-green-50 border border-green-100 rounded-xl p-6 mb-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm text-green-600 border border-green-200">
                                                    <Smartphone className="w-8 h-8" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-green-600 uppercase tracking-wider">Dispositivo Conectado</p>
                                                    <p className="text-xl font-bold text-gray-900">{connectionInfo.pushname || 'WhatsApp'}</p>
                                                    <p className="text-sm text-gray-600 font-mono">+{connectionInfo.wid?.split('@')[0]}</p>
                                                </div>
                                            </div>
                                            <div className="mt-6 flex gap-3">
                                                <Button onClick={handleDisconnect} disabled={disconnecting} variant="outline" className="w-full border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300">
                                                    {disconnecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PowerOff className="w-4 h-4 mr-2" />}
                                                    Desconectar Sessão
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {connectionStatus === 'offline' && (
                                                <Alert variant="destructive">
                                                    <AlertCircle className="w-4 h-4" />
                                                    <AlertDescription>O servidor do bot parece estar offline. Verifique o terminal.</AlertDescription>
                                                </Alert>
                                            )}

                                            <Button
                                                onClick={handleReconnect}
                                                disabled={reconnecting || connectionStatus === 'offline'}
                                                className="w-full bg-green-600 hover:bg-green-700"
                                            >
                                                {reconnecting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando novo QR Code...</> : <><RefreshCw className="w-4 h-4 mr-2" /> Iniciar Conexão / Novo QR</>}
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                {/* QR Code Area */}
                                <div className="flex flex-col items-center justify-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 min-h-[300px] p-6">
                                    {connectionStatus === 'waiting_qr' && qrCodeImage ? (
                                        <div className="bg-white p-4 rounded-lg shadow-lg animate-in fade-in zoom-in duration-300">
                                            <img src={qrCodeImage} alt="QR Code" className="w-56 h-56" />
                                            <p className="text-center text-xs text-gray-400 mt-2">Atualiza a cada 30s</p>
                                        </div>
                                    ) : connectionStatus === 'connected' ? (
                                        <div className="text-center">
                                            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <CheckCircle className="w-10 h-10" />
                                            </div>
                                            <h4 className="text-lg font-medium text-gray-900">Tudo pronto!</h4>
                                            <p className="text-gray-500">Seu bot está operando normalmente.</p>
                                        </div>
                                    ) : (
                                        <div className="text-center text-gray-400">
                                            <Loader2 className="w-10 h-10 mx-auto mb-3 animate-spin opacity-50" />
                                            <p>Aguardando servidor...</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </TabsContent>

                        {/* Tab Mensagens */}
                        <TabsContent value="mensagens" className="mt-0 space-y-4">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="text-lg font-semibold">Templates</h3>
                                    <p className="text-sm text-gray-500">Personalize o que o bot envia para seus clientes.</p>
                                </div>
                                <Button onClick={handleSaveMessages} disabled={saving || !hasMessageChanges} className="bg-green-600 hover:bg-green-700">
                                    {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</> : <><Save className="w-4 h-4 mr-2" /> Salvar Alterações</>}
                                </Button>
                            </div>

                            <div className="grid gap-4">
                                {Object.entries(MESSAGE_TEMPLATES).map(([catKey, category]) => {
                                    const CatIcon = category.icon;
                                    const isExpanded = expandedCategories[catKey];

                                    return (
                                        <Collapsible key={catKey} open={isExpanded} onOpenChange={() => toggleCategory(catKey)} className="border rounded-xl bg-white overflow-hidden shadow-sm">
                                            <CollapsibleTrigger className={`w-full flex items-center justify-between p-4 ${category.bgColor} hover:brightness-95 transition-all`}>
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 bg-white/50 rounded-lg ${category.color}`}>
                                                        <CatIcon className="w-5 h-5" />
                                                    </div>
                                                    <div className="text-left">
                                                        <span className={`block font-semibold ${category.color} brightness-75`}>{category.label}</span>
                                                        <span className="text-xs text-gray-500">{category.messages.filter(m => messageSettings[m.key]?.enabled).length} ativas</span>
                                                    </div>
                                                </div>
                                                {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                                            </CollapsibleTrigger>
                                            <CollapsibleContent className="divide-y border-t">
                                                {category.messages.map(msg => {
                                                    const MsgIcon = msg.icon;
                                                    const isEnabled = messageSettings[msg.key]?.enabled ?? true;

                                                    return (
                                                        <div key={msg.key} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group">
                                                            <div className="flex items-start gap-3 max-w-[70%]">
                                                                <MsgIcon className={`w-4 h-4 mt-1 ${isEnabled ? category.color : 'text-gray-300'}`} />
                                                                <div>
                                                                    <p className={`font-medium text-sm ${isEnabled ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                                                                        {msg.label}
                                                                    </p>
                                                                    <p className="text-xs text-gray-500 line-clamp-1">{msg.description}</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <Button size="sm" variant="ghost" onClick={() => openMessageEditor(msg)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <Edit2 className="w-4 h-4 text-gray-500" />
                                                                </Button>
                                                                <Switch
                                                                    checked={isEnabled}
                                                                    onCheckedChange={(v) => setMessageSettings(prev => ({
                                                                        ...prev,
                                                                        [msg.key]: { ...prev[msg.key], enabled: v }
                                                                    }))}
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </CollapsibleContent>
                                        </Collapsible>
                                    );
                                })}
                            </div>
                        </TabsContent>

                        {/* Tab Agente IA */}
                        <TabsContent value="agente" className="mt-0 space-y-6">
                            <div className="grid md:grid-cols-[1fr_300px] gap-8">
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between p-5 border border-purple-100 bg-purple-50 rounded-xl">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-purple-600 shadow-sm">
                                                <Sparkles className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <Label className="text-base font-semibold text-purple-900">Atendimento Inteligente</Label>
                                                <p className="text-sm text-purple-700">O bot responderá automaticamente dúvidas comuns usando IA.</p>
                                            </div>
                                        </div>
                                        <Switch checked={settings.ai_enabled} onCheckedChange={(v) => setSettings({ ...settings, ai_enabled: v })} className="data-[state=checked]:bg-purple-600" />
                                    </div>

                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label>Personalidade e Instruções (System Prompt)</Label>
                                            <Textarea
                                                value={settings.ai_instructions}
                                                onChange={(e) => setSettings({ ...settings, ai_instructions: e.target.value })}
                                                placeholder="Ex: Você é a assistente virtual da Móveis Pedro II. Seja cordial, use emojis e foque em agendar visitas..."
                                                className="min-h-[200px] font-mono text-sm leading-relaxed"
                                            />
                                            <p className="text-xs text-gray-500">Defina como a IA deve se comportar, o que ela sabe sobre a loja e os limites do atendimento.</p>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Mensagem de Boas-vindas</Label>
                                            <Textarea
                                                value={settings.welcome_message}
                                                onChange={(e) => setSettings({ ...settings, welcome_message: e.target.value })}
                                                placeholder="Ex: Olá! Bem-vindo à Móveis Pedro II. Como posso ajudar hoje?"
                                                className="min-h-[80px]"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex justify-end pt-4 border-t">
                                        <Button onClick={handleSaveAI} disabled={saving || !hasAIChanges} className="bg-purple-600 hover:bg-purple-700">
                                            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</> : <><Save className="w-4 h-4 mr-2" /> Salvar Configurações de IA</>}
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                                        <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                            <Key className="w-4 h-4" /> Configuração Técnica
                                        </h4>

                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs text-gray-500 uppercase font-bold tracking-wider">Modelo IA</Label>
                                                <Select value={settings.ai_model} onValueChange={(v) => setSettings({ ...settings, ai_model: v })}>
                                                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="gemini-2.0-flash">Gemini 2.0 Flash (Recomendado)</SelectItem>
                                                        <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro (Mais capaz)</SelectItem>
                                                        <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash (Rápido)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-xs text-gray-500 uppercase font-bold tracking-wider">Chave da API</Label>
                                                <div className="relative">
                                                    <Input
                                                        type={showApiKey ? "text" : "password"}
                                                        value={settings.gemini_api_key}
                                                        onChange={(e) => setSettings({ ...settings, gemini_api_key: e.target.value })}
                                                        placeholder="Padrão do Sistema"
                                                        className="pr-10 bg-white font-mono text-xs"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowApiKey(!showApiKey)}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                                    >
                                                        {showApiKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                                    </button>
                                                </div>
                                                <p className="text-[10px] text-gray-500 leading-tight">
                                                    Deixe em branco para usar a chave global configurada em Integrações.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <Alert className="bg-blue-50 border-blue-100 text-blue-800">
                                        <Sparkles className="w-4 h-4" />
                                        <AlertDescription className="text-xs">
                                            A IA tem acesso ao catálogo de produtos e status de pedidos para responder perguntas simples.
                                        </AlertDescription>
                                    </Alert>
                                </div>
                            </div>
                        </TabsContent>

                        {/* Tab Funções */}
                        <TabsContent value="funcoes" className="mt-0 space-y-4">
                            <div className="grid md:grid-cols-2 gap-4">
                                {Object.entries(MESSAGE_TEMPLATES).map(([catKey, category]) => {
                                    const CatIcon = category.icon;
                                    const allEnabled = category.messages.every(m => messageSettings[m.key]?.enabled);

                                    return (
                                        <div key={catKey} className={`p-4 rounded-xl border ${category.borderColor} bg-white hover:shadow-md transition-shadow`}>
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2.5 rounded-lg ${category.bgColor}`}>
                                                        <CatIcon className={`w-6 h-6 ${category.color}`} />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold text-gray-900">{category.label}</h4>
                                                        <p className="text-xs text-gray-500 mt-1">
                                                            {category.messages.length} tipos de mensagens
                                                        </p>
                                                    </div>
                                                </div>
                                                <Switch
                                                    checked={allEnabled}
                                                    onCheckedChange={(v) => {
                                                        const updates = {};
                                                        category.messages.forEach(m => {
                                                            updates[m.key] = { ...messageSettings[m.key], enabled: v };
                                                        });
                                                        setMessageSettings(prev => ({ ...prev, ...updates }));
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="flex justify-end pt-6">
                                <Button onClick={handleSaveMessages} disabled={saving || !hasMessageChanges} className="bg-green-600 hover:bg-green-700">
                                    {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</> : <><Save className="w-4 h-4 mr-2" /> Salvar Configurações</>}
                                </Button>
                            </div>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            {/* Modal de Edição de Mensagem */}
            <Dialog open={!!editingMessage} onOpenChange={() => setEditingMessage(null)}>
                <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 overflow-hidden rounded-2xl">
                    <DialogHeader className="px-6 py-4 border-b bg-gray-50">
                        <DialogTitle className="flex items-center gap-2">
                            <Edit2 className="w-5 h-5 text-gray-500" />
                            Editar Template: <span className="text-green-700">{editingMessage?.label}</span>
                        </DialogTitle>
                        <DialogDescription>
                            {editingMessage?.description}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 flex overflow-hidden">
                        {/* Editor Sidebar */}
                        <div className="w-1/2 p-6 overflow-y-auto border-r space-y-6 bg-white">
                            <div className="flex items-center justify-between p-4 bg-gray-50 border rounded-xl">
                                <Label className="cursor-pointer" htmlFor="msg-active">Mensagem Ativa</Label>
                                <Switch id="msg-active" checked={editingEnabled} onCheckedChange={setEditingEnabled} className="data-[state=checked]:bg-green-600" />
                            </div>

                            <div className="space-y-3">
                                <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Variáveis Disponíveis</Label>
                                <div className="flex flex-wrap gap-2">
                                    {editingMessage?.variables.map(v => (
                                        <button
                                            key={v.key}
                                            onClick={() => insertVariable(v.key)}
                                            className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-md text-xs font-mono hover:bg-blue-100 hover:border-blue-200 transition-all active:scale-95 flex items-center gap-1.5"
                                            title={`${v.label}: ${v.example}`}
                                        >
                                            <Copy className="w-3 h-3" />
                                            {v.key}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[10px] text-gray-400">Clique para inserir no texto. Elas serão substituídas pelos dados reais.</p>
                            </div>

                            <div className="space-y-3 h-full">
                                <Label>Conteúdo da Mensagem</Label>
                                <Textarea
                                    value={editingTemplate}
                                    onChange={(e) => setEditingTemplate(e.target.value)}
                                    className="min-h-[300px] font-mono text-sm leading-relaxed p-4 bg-gray-50 focus:bg-white transition-colors resize-none"
                                />
                            </div>
                        </div>

                        {/* Preview Area */}
                        <div className="w-1/2 bg-[#efeae2] p-8 flex flex-col items-center justify-center relative bg-opacity-80">
                            <div className="absolute inset-0 opacity-10 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')]"></div>

                            <div className="w-[320px] relative z-10">
                                <div className="bg-[#dcf8c6] rounded-lg p-3 shadow-sm relative after:content-[''] after:absolute after:top-0 after:-right-2 after:w-0 after:h-0 after:border-[8px] after:border-t-[#dcf8c6] after:border-r-transparent after:border-b-transparent after:border-l-transparent">
                                    <p className="text-sm text-gray-800 whitespace-pre-wrap leading-snug">
                                        {editingMessage?.variables.reduce((text, v) => {
                                            return text.replace(new RegExp(v.key.replace(/[{}]/g, '\\$&'), 'g'), v.example);
                                        }, editingTemplate || "")}
                                    </p>
                                    <div className="flex justify-end mt-1">
                                        <span className="text-[10px] text-gray-500">14:30</span>
                                        <span className="ml-1 text-blue-400">✓✓</span>
                                    </div>
                                </div>
                            </div>

                            <p className="mt-8 text-xs text-gray-500 font-medium bg-white/50 px-3 py-1 rounded-full backdrop-blur-sm">
                                Visualização Aproximada
                            </p>
                        </div>
                    </div>

                    <DialogHeader className="px-6 py-4 border-t bg-gray-50 flex flex-row justify-end gap-3 rounded-b-2xl h-auto">
                        <Button variant="ghost" onClick={() => setEditingMessage(null)}>Cancelar</Button>
                        <Button onClick={saveMessageEdit} className="bg-green-600 hover:bg-green-700">
                            <Save className="w-4 h-4 mr-2" /> Salvar Alterações
                        </Button>
                    </DialogHeader>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// Nota para o futuro:
// Para centralizar totalmente as chaves, o backend (server.js) deve ser atualizado para ler
// a gemini_api_key diretamente da tabela 'configuracao_sistema' do Supabase se não for enviada aqui.
