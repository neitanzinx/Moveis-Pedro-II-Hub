import { supabase } from '@/lib/supabase';

/**
 * ApprovalEngine handles the logic for calculating approval levels,
 * creating approval queues, and managing the state of order approvals.
 */
export const ApprovalEngine = {
    /**
     * Calculates the required approval levels based on order total and items.
     * @param {number} total - Total value of the Purchase Order.
     * @param {Array} items - List of items in the order.
     * @returns {Array} List of required levels { nivel: number, label: string }.
     */
    calculateLevels(total, items = [], isPromotional = false) {
        // No approvals required as per user instruction
        return [];
    },

    /**
     * Initializes the approval process for an OC.
     */
    async startApprovalFlow(ocId, total, items, isPromotional = false) {
        const levels = this.calculateLevels(total, items, isPromotional);

        if (levels.length === 0) {
            // Auto-approve
            await supabase.from('compras_ordens').update({
                aprovacao_status: 'APROVADO',
                status: 'Aguardando Envio', // Matches standard column name
                aprovacao_nivel_atual: 0
            }).eq('id', ocId);
            return { status: 'APROVADO' };
        }

        // Create the queue
        const approvalEntries = levels.map(level => ({
            oc_id: ocId,
            nivel: level.nivel,
            status: 'PENDENTE',
            created_at: new Date().toISOString()
        }));

        await supabase.from('aprovacoes_oc').insert(approvalEntries);

        // Update OC to blocked status
        await supabase.from('compras_ordens').update({
            aprovacao_status: 'PENDENTE',
            status: 'Aguardando Envio', // Blocked visual status
            aprovacao_nivel_atual: levels[0].nivel
        }).eq('id', ocId);

        // Notify first level (Manager or Eduardo depending on levels)
        // In a real scenario, we'd fetch the specific user ID for 'Manager'
        // For now, we'll just return the status.

        return { status: 'PENDENTE', levelsCount: levels.length };
    },

    /**
     * Processes an approval action.
     */
    async processDecision(approvalId, ocId, userId, status, justification) {
        const now = new Date().toISOString();

        // 1. Update current approval entry
        const { data: updatedApproval, error: apvError } = await supabase
            .from('aprovacoes_oc')
            .update({
                status,
                justificativa: justification,
                aprovador_id: userId,
                data: now
            })
            .eq('id', approvalId)
            .select()
            .single();

        if (apvError) throw apvError;

        if (status === 'REJEITADO') {
            // Reset OC status and level
            await supabase.from('compras_ordens').update({
                aprovacao_status: 'REJEITADO',
                status: 'Rascunho' // Back to draft or similar
            }).eq('id', ocId);
            return { status: 'REJEITADO' };
        }

        // 2. Check if there are more pending levels
        const { data: nextLevel } = await supabase
            .from('aprovacoes_oc')
            .select('*')
            .eq('oc_id', ocId)
            .eq('status', 'PENDENTE')
            .order('nivel', { ascending: true })
            .limit(1)
            .single();

        if (nextLevel) {
            // Move to next level
            await supabase.from('compras_ordens').update({
                aprovacao_nivel_atual: nextLevel.nivel
            }).eq('id', ocId);
            return { status: 'PENDENTE_PROXIMO_NIVEL', nextNivel: nextLevel.nivel };
        } else {
            // All levels approved!
            await supabase.from('compras_ordens').update({
                aprovacao_status: 'APROVADO',
                status: 'Pedido Enviado'
            }).eq('id', ocId);
            return { status: 'APROVADO' };
        }
    }
};
