import { toast } from "sonner";
import { ZAP_API_URL as API_URL } from "@/utils/zapApiUrl";

export const whatsappService = {
    /**
     * Verifica o status da conexão com a API do WhatsApp
     * @returns {Promise<boolean>}
     */
    checkStatus: async () => {
        try {
            const response = await fetch(`${API_URL}/status`);
            return response.ok;
        } catch (error) {
            console.error("Erro ao verificar status do WhatsApp:", error);
            return false;
        }
    },

    /**
     * Envia uma mensagem de texto simples
     * @param {string} telefone - Número do telefone (com DDD)
     * @param {string} mensagem - Texto da mensagem
     */
    sendMessage: async (telefone, mensagem) => {
        if (!telefone) return;

        // Limpar caracteres não numéricos
        const numbersOnly = telefone.replace(/\D/g, '');
        const formattedPhone = numbersOnly.startsWith('55') ? numbersOnly : `55${numbersOnly}`;

        try {
            const response = await fetch(`${API_URL}/send-text`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    phone: formattedPhone,
                    message: mensagem,
                }),
            });

            if (!response.ok) throw new Error('Falha ao enviar mensagem');
            return true;
        } catch (error) {
            console.error("Erro no envio do WhatsApp:", error);
            toast.error("Erro ao enviar mensagem automática do WhatsApp");
            return false;
        }
    },

    /**
     * Envia confirmação de agendamento de montagem
     */
    sendAssemblyConfirmation: async (cliente, montagem, montador) => {
        const mensagem = `Olá, ${cliente.nome}! 🛠️
    
Seu agendamento de montagem foi confirmado!

*Pedido:* #${montagem.numero_pedido}
*Data:* ${new Date(montagem.data_montagem).toLocaleDateString('pt-BR')}
*Horário:* ${montagem.horario_montagem}
*Montador:* ${montador.nome}

Em caso de dúvidas ou necessidade de reagendamento, entre em contato diretamente com nosso montador:
📞 ${montador.whatsapp || montador.telefone || "Número não disponível"}

Agradecemos a preferência!
_Móveis Pedro II_`;

        return whatsappService.sendMessage(cliente.telefone, mensagem);
    },

    /**
     * Envia link de rastreamento temporário
     */
    sendTrackingLink: async (cliente, link) => {
        const mensagem = `Olá, ${cliente.nome}! 🚚
    
Seu pedido está a caminho!
Acompanhe a entrega em tempo real pelo link abaixo:

🔗 ${link}

_Móveis Pedro II_`;
        return whatsappService.sendMessage(cliente.telefone, mensagem);
    },
    /**
     * Envia aviso de próxima parada com link de rastreio
     * @param {string} telefone
     * @param {object} entrega
     * @param {string} linkRastreio
     */
    sendDeliveryNextStop: async (telefone, entrega, linkRastreio) => {
        const nomeCliente = entrega.cliente_nome?.split(' ')[0] || 'Cliente';
        const msg = `Olá ${nomeCliente}! 🚚\n\n` +
            `Sua entrega é a próxima!\n` +
            `Estamos a caminho do endereço: ${entrega.endereco_entrega}\n\n` +
            `Acompanhe a chegada do caminhão em tempo real:\n${linkRastreio}\n\n` +
            `Por favor, deixe alguém responsável para receber.`;

        return whatsappService.sendMessage(telefone, msg);
    },

    /**
     * Envia aviso de início de rota (opcional, pode ser usado para todos da rota)
     * @param {string} telefone
     * @param {string} nomeCliente
     * @param {string} previsao
     */
    sendDeliveryStart: async (telefone, nomeCliente, previsao) => {
        const msg = `Bom dia ${nomeCliente}! ☀️\n\n` +
            `Seu pedido saiu para entrega hoje!\n` +
            `Previsão de entrega: ${previsao}\n\n` +
            `Fique atento ao celular, avisaremos quando estivermos chegando.`;

        return whatsappService.sendMessage(telefone, msg);
    },

    /**
     * Notifica falha na entrega
     * @param {string} telefone 
     * @param {string} nomeCliente 
     * @param {string} motivo 
     */
    sendDeliveryFailure: async (telefone, nomeCliente, motivo) => {
        const msg = `Olá ${nomeCliente}.\n\n` +
            `Tentamos realizar sua entrega mas não conseguimos.\n` +
            `Motivo: ${motivo}\n\n` +
            `Entraremos em contato para reagendar.`;

        return whatsappService.sendMessage(telefone, msg);
    },

    /**
     * Notifica início de rota (Backend processa em lote)
     * @param {Array} entregas 
     */
    notifyRouteStart: async (entregas) => {
        try {
            const response = await fetch(`${API_URL}/aviso-inicio-rota`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entregas })
            });
            return response.ok;
        } catch (error) {
            console.error("Erro ao notificar início de rota:", error);
            return false;
        }
    },

    /**
     * Notifica conclusão de entrega (Backend processa e avisa próximo)
     * @param {number} idConcluida 
     * @param {object} updateData 
     */
    notifyDeliveryCompletion: async (idConcluida, updateData) => {
        try {
            const response = await fetch(`${API_URL}/concluir-entrega`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id_concluida: idConcluida,
                    update_data: updateData
                })
            });
            return response.ok;
        } catch (error) {
            console.error("Erro ao notificar conclusão:", error);
            throw error; // Re-throw para fallback no frontend
        }
    },
    /**
     * Envia confirmações em lote (usado no Kanban)
     * @param {Array} entregas - Array de objetos de entrega formatados
     */
    sendConfirmations: async (entregas) => {
        try {
            const response = await fetch(`${API_URL}/disparar-confirmacoes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entregas })
            });
            return response; // Retorna response para tratar erros específicos se necessário
        } catch (error) {
            console.error("Erro ao enviar confirmações:", error);
            throw error;
        }
    },

    /**
     * Reagenda entregas e notifica clientes
     * @param {Array} entregas - Array de {telefone, nome, numero_pedido}
     */
    rescheduleDeliveries: async (entregas) => {
        try {
            const response = await fetch(`${API_URL}/reagendar-entregas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entregas })
            });
            return response.ok;
        } catch (error) {
            console.error("Erro ao reagendar entregas:", error);
            return false;
        }
    },

    /**
     * Notifica agendamento de montagem (Montador Externo)
     * @param {object} data
     */
    notifyAssemblyScheduled: async (data) => {
        try {
            const response = await fetch(`${API_URL}/aviso-montagem-agendada`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return response.ok;
        } catch (error) {
            console.error("Erro ao notificar agendamento de montagem:", error);
            throw error;
        }
    },

    /**
     * Notifica cancelamento de montagem
     * @param {object} data
     */
    notifyAssemblyCancelled: async (data) => {
        try {
            const response = await fetch(`${API_URL}/aviso-montagem-cancelada`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return response.ok;
        } catch (error) {
            console.error("Erro ao notificar cancelamento de montagem:", error);
            throw error;
        }
    },

    /**
     * Notifica reagendamento de montagem
     * @param {object} data
     */
    notifyAssemblyRescheduled: async (data) => {
        try {
            const response = await fetch(`${API_URL}/aviso-montagem-reagendada`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return response.ok;
        } catch (error) {
            console.error("Erro ao notificar reagendamento de montagem:", error);
            throw error;
        }
    },

    /**
     * Envia mensagem de marketing
     * @param {object} data 
     */
    sendMarketingMessage: async (data) => {
        try {
            const response = await fetch(`${API_URL}/enviar-mensagem-marketing`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return response.ok;
        } catch (error) {
            console.error("Erro ao enviar mensagem de marketing:", error);
            throw error;
        }
    },

    /**
     * Envia mensagem de aniversário
     * @param {object} data 
     */
    sendBirthdayMessage: async (data) => {
        try {
            const response = await fetch(`${API_URL}/enviar-mensagem-aniversario`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return response.ok;
        } catch (error) {
            console.error("Erro ao enviar mensagem de aniversário:", error);
            throw error;
        }
    }
};

