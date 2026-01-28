import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Store, CheckCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { base44, supabase } from "@/api/base44Client";

export default function StoreSelectorModal() {
    const { user, selectedStore, setSelectedStore, loading } = useAuth();
    const [lojas, setLojas] = useState([]);
    const [fetching, setFetching] = useState(false);

    // Derived state: Modal MUST be open if user is admin (no fixed loja) and hasn't selected a store yet.
    const isOpen = !loading && !!user && !user.loja && !selectedStore;

    useEffect(() => {
        if (isOpen) {
            fetchLojas();
        }
    }, [isOpen]);

    const fetchLojas = async () => {
        setFetching(true);
        try {
            // Tenta buscar da tabela 'lojas'
            const { data, error } = await supabase.from('lojas').select('*').eq('ativa', true);
            if (error) throw error;
            setLojas(data || []);
        } catch (err) {
            console.error("Erro ao buscar lojas:", err);
            // Fallback
            setLojas([
                { id: 1, nome: 'Centro' },
                { id: 2, nome: 'Depósito' }
            ]);
        } finally {
            setFetching(false);
        }
    };

    const handleSelect = (lojaNome) => {
        setSelectedStore(lojaNome);
    };

    const handleOpenChange = (newOpen) => {
        // Prevent closing if we are in the "forced selection" state
        if (!newOpen && isOpen) {
            return;
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Store className="w-5 h-5" /> Selecione a Loja de Operação
                    </DialogTitle>
                </DialogHeader>

                <div className="py-4">
                    <p className="text-sm text-gray-500 mb-4">
                        Você está logado como Administrador/Gerente sem loja fixa.
                        Por favor, selecione em qual unidade deseja operar agora.
                    </p>

                    {fetching ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3">
                            {lojas.map(loja => (
                                <Button
                                    key={loja.id}
                                    variant="outline"
                                    className="h-24 flex flex-col items-center justify-center gap-2 border-2 hover:border-green-500 hover:bg-green-50 text-wrap transition-all"
                                    onClick={() => handleSelect(loja.nome)}
                                >
                                    <Store className="w-6 h-6 text-gray-500" />
                                    <span className="font-semibold">{loja.nome}</span>
                                </Button>
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
