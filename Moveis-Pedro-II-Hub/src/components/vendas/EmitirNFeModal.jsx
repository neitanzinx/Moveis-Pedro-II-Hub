import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle, FileCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

export default function EmitirNFeModal({ isOpen, onClose, venda, cliente }) {
    const [loading, setLoading] = useState(false);
    const [ambiente, setAmbiente] = useState('homologacao');

    if (!venda || !cliente) return null;

    const handleEmitir = async () => {
        try {
            setLoading(true);

            const { data, error } = await supabase.functions.invoke('emitir-nfe', {
                body: {
                    venda_id: venda.id,
                    ambiente
                }
            });

            if (error) throw error;
            // Verifica sucesso na resposta da business logic
            // A edge function retorna { success: true/false, ... } no corpo
            if (!data.success) {
                throw new Error(data.error || data.message || 'Erro desconhecido ao emitir NFe');
            }

            toast.success(`NFe enviada com sucesso! Ref: ${data.ref}`);
            onClose();
        } catch (error) {
            console.error('Erro ao emitir NFe:', error);
            let msg = error.message || 'Erro de conexão';

            // Tenta ler erro detalhado se vier do Edge Function como exceção HTTP
            if (error.context && typeof error.context.json === 'function') {
                try {
                    const body = await error.context.json();
                    if (body && body.error) msg = body.error;
                } catch (e) { /* ignore */ }
            }

            toast.error('Falha ao emitir NFe: ' + msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileCheck className="w-5 h-5 text-green-600" />
                        Emitir Nota Fiscal (NFe)
                    </DialogTitle>
                    <DialogDescription>
                        Pedido #{venda.numero_pedido} - {cliente.nome_completo || cliente.razao_social}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex gap-3 text-sm text-yellow-800">
                        <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0" />
                        <div>
                            <p className="font-medium">Atenção</p>
                            <p>Certifique-se que o cadastro do cliente (CPF/CNPJ, Endereço) e os NCMs dos produtos estão corretos antes de emitir.</p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Ambiente de Emissão</Label>
                        <Select value={ambiente} onValueChange={setAmbiente}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="homologacao">Homologação (Teste)</SelectItem>
                                <SelectItem value="producao">Produção (Validade Jurídica)</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-gray-500">
                            Use "Homologação" para testar sem valor fiscal neste momento.
                        </p>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={onClose} disabled={loading}>
                        Cancelar
                    </Button>
                    <Button onClick={handleEmitir} disabled={loading} className="bg-green-600 hover:bg-green-700 text-white">
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Processando...
                            </>
                        ) : (
                            'Confirmar Emissão'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
