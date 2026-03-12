import { toast } from "sonner";
import { ZAP_API_URL as API_URL } from "@/utils/zapApiUrl";
import { saveToOfflineQueue } from "@/utils/offlineQueue";

export const whatsappService = {
    /**
     * Verifica o status da conexão com a API do WhatsApp
     * @returns {Promise<boolean>}
     */
    checkStatus: async () => {
        try {
            const response = await fetch(`${API_URL}/status`);
            if (!response.ok) return false;

            const data = await response.json();
            return data.status === 'connected' || data.status === 'online';
        } catch (error) {
            console.error("Erro ao verificar status do WhatsApp:", error);
            return false;
        }
    },

    sendMessage: async (telefone, mensagem) => {
        if (!telefone) return;

        // Limpar caracteres não numéricos
        const numbersOnly = telefone.replace(/\D/g, '');
        const formattedPhone = numbersOnly.startsWith('55') ? numbersOnly : `55${numbersOnly}`;

        const payload = {
            phone: formattedPhone,
            message: mensagem,
        };

        if (!navigator.onLine) {
            await saveToOfflineQueue('sendMessage', [telefone, mensagem]);
            toast.info("Sem internet: Mensagem do Zap salva para envio posterior.");
            return true; // Retorna true para a UI prosseguir achando que deu certo offline
        }

        try {
            const response = await fetch(`${API_URL}/send-text`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                console.error("Detalhes do erro do servidor:", errData);
                throw new Error(errData.error || 'Falha ao enviar mensagem');
            }
            return true;
        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                await saveToOfflineQueue('sendMessage', [telefone, mensagem]);
                toast.info("Sem conexão com servidor: Mensagem do Zap salva para envio posterior.");
                return true;
            }
            console.error("Erro no envio do WhatsApp:", error);
            toast.error("Erro ao enviar mensagem automática do WhatsApp");
            return false;
        }
    },

    sendImageMessage: async (telefone, imageUrl, caption) => {
        if (!telefone || !imageUrl) return false;

        const numbersOnly = telefone.replace(/\D/g, '');
        const formattedPhone = numbersOnly.startsWith('55') ? numbersOnly : `55${numbersOnly}`;

        const payload = {
            phone: formattedPhone,
            imageUrl: imageUrl,
            caption: caption,
        };

        try {
            const response = await fetch(`${API_URL}/send-image-url`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || 'Falha ao enviar imagem');
            }
            return true;
        } catch (error) {
            console.error("Erro no envio de imagem WhatsApp:", error);
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
        if (!navigator.onLine) {
            await saveToOfflineQueue('notifyRouteStart', [entregas]);
            toast.info("Sem internet: Aviso de início de rota salvo para envio posterior.");
            return true;
        }

        try {
            const response = await fetch(`${API_URL}/aviso-inicio-rota`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entregas })
            });
            return response.ok;
        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                await saveToOfflineQueue('notifyRouteStart', [entregas]);
                toast.info("Servidor inacessível: Aviso de rota salvo para envio posterior.");
                return true;
            }
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
        if (!navigator.onLine) {
            await saveToOfflineQueue('notifyDeliveryCompletion', [idConcluida, updateData]);
            toast.info("Sem internet: Confirmação de entrega salva para envio posterior.");
            return true;
        }

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
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                await saveToOfflineQueue('notifyDeliveryCompletion', [idConcluida, updateData]);
                toast.info("Servidor inacessível: Confirmação de entrega salva para posterior.");
                return true;
            }
            console.error("Erro ao notificar conclusão:", error);
            throw error; // Re-throw para fallback no frontend
        }
    },
    /**
     * Envia confirmações em lote (usado no Kanban)
     * @param {Array} entregas - Array de objetos de entrega formatados
     */
    sendConfirmations: async (entregas) => {
        if (!navigator.onLine) {
            await saveToOfflineQueue('sendConfirmations', [entregas]);
            toast.info("Sem internet: Confirmações salvas para envio posterior.");
            return { ok: true, status: 200 }; // Fake response for UI success
        }

        try {
            const response = await fetch(`${API_URL}/disparar-confirmacoes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entregas })
            });
            return response; // Retorna response para tratar erros específicos se necessário
        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                await saveToOfflineQueue('sendConfirmations', [entregas]);
                toast.info("Servidor inacessível: Confirmações salvas para envio posterior.");
                return { ok: true, status: 200 }; // Fake response
            }
            console.error("Erro ao enviar confirmações:", error);
            throw error;
        }
    },

    /**
     * Reagenda entregas e notifica clientes
     * @param {Array} entregas - Array de {telefone, nome, numero_pedido}
     */
    rescheduleDeliveries: async (entregas) => {
        if (!navigator.onLine) {
            await saveToOfflineQueue('rescheduleDeliveries', [entregas]);
            toast.info("Sem internet: Notificação de reagendamento salva offline.");
            return true;
        }

        try {
            const response = await fetch(`${API_URL}/reagendar-entregas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entregas })
            });
            return response.ok;
        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                await saveToOfflineQueue('rescheduleDeliveries', [entregas]);
                toast.info("Servidor inacessível: Reagendamento salvo offline.");
                return true;
            }
            console.error("Erro ao reagendar entregas:", error);
            return false;
        }
    },

    /**
     * Notifica agendamento de montagem (Montador Externo)
     * @param {object} data
     */
    notifyAssemblyScheduled: async (data) => {
        if (!navigator.onLine) {
            await saveToOfflineQueue('notifyAssemblyScheduled', [data]);
            toast.info("Sem internet: Aviso de agendamento salvo offline.");
            return true;
        }

        try {
            const response = await fetch(`${API_URL}/aviso-montagem-agendada`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok && response.status === 503) {
                await saveToOfflineQueue('notifyAssemblyScheduled', [data]);
                return true;
            }
            return response.ok;
        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                await saveToOfflineQueue('notifyAssemblyScheduled', [data]);
                toast.info("Servidor inacessível: Aviso de agendamento salvo offline.");
                return true;
            }
            console.error("Erro ao notificar agendamento de montagem:", error);
            throw error;
        }
    },

    /**
     * Notifica cancelamento de montagem
     * @param {object} data
     */
    notifyAssemblyCancelled: async (data) => {
        if (!navigator.onLine) {
            await saveToOfflineQueue('notifyAssemblyCancelled', [data]);
            toast.info("Sem internet: Aviso de cancelamento salvo offline.");
            return true;
        }

        try {
            const response = await fetch(`${API_URL}/aviso-montagem-cancelada`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok && response.status === 503) {
                await saveToOfflineQueue('notifyAssemblyCancelled', [data]);
                return true;
            }
            return response.ok;
        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                await saveToOfflineQueue('notifyAssemblyCancelled', [data]);
                toast.info("Servidor inacessível: Aviso de cancelamento salvo offline.");
                return true;
            }
            console.error("Erro ao notificar cancelamento de montagem:", error);
            throw error;
        }
    },

    /**
     * Notifica reagendamento de montagem
     * @param {object} data
     */
    notifyAssemblyRescheduled: async (data) => {
        if (!navigator.onLine) {
            await saveToOfflineQueue('notifyAssemblyRescheduled', [data]);
            toast.info("Sem internet: Aviso de reagendamento salvo offline.");
            return true;
        }

        try {
            const response = await fetch(`${API_URL}/aviso-montagem-reagendada`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok && response.status === 503) {
                await saveToOfflineQueue('notifyAssemblyRescheduled', [data]);
                return true;
            }
            return response.ok;
        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                await saveToOfflineQueue('notifyAssemblyRescheduled', [data]);
                toast.info("Servidor inacessível: Aviso de reagendamento salvo offline.");
                return true;
            }
            console.error("Erro ao notificar reagendamento de montagem:", error);
            throw error;
        }
    },

    /**
     * Envia mensagem de marketing
     * @param {object} data 
     */
    sendMarketingMessage: async (data) => {
        if (!navigator.onLine) {
            await saveToOfflineQueue('sendMarketingMessage', [data]);
            toast.info("Sem internet: Marketing salvo offline.");
            return true;
        }
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
     * Envia confirmação de venda pós-venda via WhatsApp (com PDF anexo)
     * @param {object} data - { telefone, nome, pedido, prazo, produtos, pdf_base64 }
     */
    sendSaleConfirmation: async (data) => {
        if (!navigator.onLine) {
            await saveToOfflineQueue('sendSaleConfirmation', [data]);
            toast.info("Sem internet: Comprovante de venda salvo para envio posterior via WhatsApp.");
            return true;
        }

        try {
            const response = await fetch(`${API_URL}/mensagem-pos-venda`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const responseData = await response.json().catch(() => ({}));

            if (!response.ok) {
                console.error('❌ Bot respondeu com erro:', responseData);
                if (response.status === 503) {
                    // WhatsApp desconectado — salva na fila para reenviar quando reconectar
                    await saveToOfflineQueue('sendSaleConfirmation', [data]);
                    toast.info("WhatsApp desconectado: Comprovante salvo para envio automático quando reconectar.");
                    return true;
                } else {
                    toast.error("Erro ao enviar comprovante no WhatsApp.");
                }
                return false;
            }

            console.log("✅ WhatsApp enviado:", responseData);
            toast.success("Comprovante enviado ao cliente via WhatsApp!");
            return true;
        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                await saveToOfflineQueue('sendSaleConfirmation', [data]);
                toast.info("Servidor inacessível: Comprovante de venda salvo para envio posterior.");
                return true;
            }
            console.error("❌ Erro conexão bot:", error);
            toast.warning("Não foi possível conectar ao robô de WhatsApp agora.");
            return false;
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

