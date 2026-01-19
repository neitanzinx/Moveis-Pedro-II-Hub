import React, { useState, useMemo, createElement } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Shield, Info } from "lucide-react";
import { MENU_ITEMS, ROLE_RULES } from "@/config/permissions";
import { getCargoConfig } from "@/config/cargos";

/**
 * Editor Visual de Permissoes por Cargo
 * Exibe mini-preview do sidebar com toggle de permissoes
 */
export default function RolePermissionEditorModal({ cargo, currentPermissions = [], onSave, onClose, isSaving = false }) {
    if (!cargo) return null;

    const cargoConfig = getCargoConfig(cargo);
    const roleRules = ROLE_RULES[cargo] || ROLE_RULES['Vendedor'];

    // Se for admin, nao pode editar (tem acesso total)
    const isAdmin = cargo === 'Administrador';

    // Estado das permissoes - inicia com as atuais ou do ROLE_RULES
    const initialPermissions = currentPermissions.length > 0
        ? currentPermissions
        : (roleRules.can.includes('*') ? [] : roleRules.can);

    const [permissions, setPermissions] = useState(initialPermissions);

    // Agrupa menu items por secao
    const menuBySection = useMemo(() => {
        const sections = {};
        MENU_ITEMS.forEach(item => {
            if (item.permission === '*' || item.permission === 'admin_only') return;
            const section = item.section || 'Outros';
            if (!sections[section]) sections[section] = [];
            sections[section].push(item);
        });
        return sections;
    }, []);

    // Toggle uma permissao
    const togglePermission = (permission) => {
        if (isAdmin) return; // Admin nao pode ser editado

        if (permissions.includes(permission)) {
            setPermissions(prev => prev.filter(p => p !== permission));
        } else {
            setPermissions(prev => [...prev, permission]);
        }
    };

    const handleSave = () => {
        onSave(permissions);
    };

    const getItemStyle = (permission) => {
        const isActive = isAdmin || permissions.includes(permission);

        if (isActive) {
            return {
                backgroundColor: '#d1fae5',
                borderColor: '#10b981',
                opacity: 1
            };
        }
        return {
            backgroundColor: '#f3f4f6',
            borderColor: '#e5e7eb',
            opacity: 0.4
        };
    };

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: cargoConfig?.bgColor || '#f3f4f6' }}
                        >
                            {cargoConfig?.icon && createElement(cargoConfig.icon, {
                                className: "w-4 h-4",
                                style: { color: cargoConfig?.color }
                            })}
                        </div>
                        Permissoes do Cargo: {cargo}
                    </DialogTitle>
                    <DialogDescription>
                        Clique nos itens para permitir ou negar acesso para todos os usuarios deste cargo.
                    </DialogDescription>
                </DialogHeader>

                {isAdmin ? (
                    <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                        <div className="flex items-center gap-2 text-amber-700">
                            <Shield className="w-5 h-5" />
                            <span className="font-medium">Administrador tem acesso total</span>
                        </div>
                        <p className="text-sm text-amber-600 mt-1">
                            O cargo de Administrador nao pode ser editado pois possui acesso irrestrito ao sistema.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Legenda */}
                        <div className="flex gap-4 text-xs text-gray-600 p-2 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-1">
                                <div className="w-4 h-4 rounded bg-green-100 border border-green-500" />
                                <span>Permitido</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-4 h-4 rounded bg-gray-100 border border-gray-300 opacity-40" />
                                <span>Negado</span>
                            </div>
                        </div>

                        {/* Mini Sidebar Preview */}
                        <Card className="border-2" style={{ borderColor: cargoConfig?.color || '#07593f' }}>
                            <CardContent className="p-0">
                                <div className="p-3 border-b" style={{ backgroundColor: cargoConfig?.color || '#07593f' }}>
                                    <p className="text-white text-sm font-medium">Pre-visualizacao do Menu</p>
                                </div>
                                <ScrollArea className="h-[350px]">
                                    <div className="p-2 space-y-4">
                                        {Object.entries(menuBySection).map(([section, items]) => (
                                            <div key={section}>
                                                <p className="text-xs font-semibold text-gray-400 uppercase mb-2 px-2">{section}</p>
                                                <div className="space-y-1">
                                                    {items.map(item => {
                                                        const isActive = permissions.includes(item.permission);
                                                        const style = getItemStyle(item.permission);

                                                        return (
                                                            <button
                                                                key={item.url}
                                                                onClick={() => togglePermission(item.permission)}
                                                                className="w-full flex items-center gap-3 p-2 rounded-lg border transition-all hover:scale-[1.02]"
                                                                style={{
                                                                    ...style,
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                {createElement(item.icon, {
                                                                    className: "w-4 h-4 flex-shrink-0",
                                                                    style: { opacity: isActive ? 1 : 0.4 }
                                                                })}
                                                                <span
                                                                    className="flex-1 text-left text-sm"
                                                                    style={{ opacity: isActive ? 1 : 0.5 }}
                                                                >
                                                                    {item.title}
                                                                </span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>

                        {/* Info */}
                        <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 p-2 rounded-lg">
                            <Info className="w-4 h-4" />
                            <span>{permissions.length} permissao(oes) ativas</span>
                        </div>
                    </>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        {isAdmin ? 'Fechar' : 'Cancelar'}
                    </Button>
                    {!isAdmin && (
                        <Button
                            onClick={handleSave}
                            disabled={isSaving}
                            style={{ background: `linear-gradient(135deg, ${cargoConfig?.color || '#07593f'} 0%, ${cargoConfig?.color || '#07593f'}dd 100%)` }}
                        >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Salvar Permissoes
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
