import React, { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Store, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLojas } from "@/hooks/useLojas";

export default function StoreSelectorModal() {
    const { user, selectedStore, setSelectedStore, loading } = useAuth();
    const { data: lojas = [], isLoading: fetching } = useLojas();

    // Derived state: Modal MUST be open if user is admin/manager (no fixed loja) and hasn't selected a store yet.
    // Roles that require a store context:
    const ROLES_REQUIRING_STORE = ['Administrador', 'Gerente Geral', 'Gerente', 'Vendedor'];
    const isOpen = !loading && !!user && !user.loja && !selectedStore && ROLES_REQUIRING_STORE.includes(user.cargo);

    useEffect(() => {
        // Mantido para preservar comportamento de abertura controlada.
    }, [isOpen]);

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
                    ) : lojas.length === 0 ? (
                        <div className="py-6 text-sm text-gray-500">
                            Nenhuma loja cadastrada ativa em Configurações.
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
