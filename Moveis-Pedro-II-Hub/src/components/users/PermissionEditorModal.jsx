import React, { useState, useMemo, createElement } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Plus, Minus, Shield, Info } from "lucide-react";
import { MENU_ITEMS, ROLE_RULES, getPermissionStates } from "@/config/permissions";
import { getCargoConfig } from "@/config/cargos";

/**
 * Editor Visual de Permissoes
 * Exibe mini-preview do sidebar com toggle de permissoes
 */
export default function PermissionEditorModal({ user, onSave, onClose, isSaving = false }) {
    if (!user) return null;

    const cargo = user.cargo || 'Vendedor';
    const cargoConfig = getCargoConfig(cargo);

    // Estado inicial das custom_permissions
    const initialCustom = user.custom_permissions || { inherit: true, allowed: [], denied: [] };

    const [inherit, setInherit] = useState(initialCustom.inherit !== false);
    const [allowed, setAllowed] = useState(initialCustom.allowed || []);
    const [denied, setDenied] = useState(initialCustom.denied || []);

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

    // Calcula estado de cada permissao
    const permissionStates = useMemo(() => {
        const roleRules = ROLE_RULES[cargo] || ROLE_RULES['Vendedor'];
        const states = {};

        MENU_ITEMS.forEach(item => {
            if (item.permission === '*' || item.permission === 'admin_only') return;

            const perm = item.permission;
            const fromRole = roleRules.can.includes('*') || roleRules.can.includes(perm);
            const inAllowed = allowed.includes(perm);
            const inDenied = denied.includes(perm);

            let active = false;
            let source = 'role';

            if (!inherit) {
                active = inAllowed;
                source = inAllowed ? 'custom_allowed' : 'none';
            } else {
                if (inDenied) {
                    active = false;
                    source = 'custom_denied';
                } else if (inAllowed) {
                    active = true;
                    source = 'custom_allowed';
                } else {
                    active = fromRole;
                    source = 'role';
                }
            }

            states[perm] = { active, source, fromRole };
        });

        return states;
    }, [cargo, inherit, allowed, denied]);

    // Toggle uma permissao
    const togglePermission = (permission) => {
        const state = permissionStates[permission];
        if (!state) return;

        if (inherit) {
            // Modo heranca
            if (state.fromRole) {
                // Permissao vem do cargo - toggle adiciona ao denied
                if (state.source === 'custom_denied') {
                    // Ja esta no denied, remove
                    setDenied(prev => prev.filter(p => p !== permission));
                } else {
                    // Adiciona ao denied
                    setDenied(prev => [...prev, permission]);
                    setAllowed(prev => prev.filter(p => p !== permission));
                }
            } else {
                // Permissao NAO vem do cargo - toggle adiciona ao allowed
                if (state.source === 'custom_allowed') {
                    // Ja esta no allowed, remove
                    setAllowed(prev => prev.filter(p => p !== permission));
                } else {
                    // Adiciona ao allowed
                    setAllowed(prev => [...prev, permission]);
                    setDenied(prev => prev.filter(p => p !== permission));
                }
            }
        } else {
            // Modo sem heranca - apenas allowed importa
            if (allowed.includes(permission)) {
                setAllowed(prev => prev.filter(p => p !== permission));
            } else {
                setAllowed(prev => [...prev, permission]);
            }
        }
    };

    const handleSave = () => {
        const customPermissions = {
            inherit,
            allowed: allowed.filter(a => a),
            denied: inherit ? denied.filter(d => d) : []
        };
        onSave(customPermissions);
    };

    const getItemStyle = (state) => {
        if (!state) return {};

        if (state.active) {
            if (state.source === 'custom_allowed') {
                return {
                    backgroundColor: '#dbeafe',
                    borderColor: '#3b82f6',
                    opacity: 1
                };
            }
            return {
                backgroundColor: '#d1fae5',
                borderColor: '#10b981',
                opacity: 1
            };
        } else {
            if (state.source === 'custom_denied') {
                return {
                    backgroundColor: '#fee2e2',
                    borderColor: '#ef4444',
                    opacity: 0.7,
                    textDecoration: 'line-through'
                };
            }
            return {
                backgroundColor: '#f3f4f6',
                borderColor: '#e5e7eb',
                opacity: 0.4
            };
        }
    };

    const getBadge = (state) => {
        if (!state) return null;

        if (state.source === 'custom_allowed') {
            return <Badge className="bg-blue-100 text-blue-700 text-xs px-1"><Plus className="w-3 h-3" /></Badge>;
        }
        if (state.source === 'custom_denied') {
            return <Badge className="bg-red-100 text-red-700 text-xs px-1"><Minus className="w-3 h-3" /></Badge>;
        }
        return null;
    };

    const countCustom = allowed.length + denied.length;

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Shield className="w-5 h-5" style={{ color: '#07593f' }} />
                        Permissoes de {user.full_name}
                    </DialogTitle>
                    <DialogDescription>
                        Clique nos itens para permitir ou negar acesso. Cargo atual: <strong>{cargo}</strong>
                    </DialogDescription>
                </DialogHeader>

                {/* Legenda */}
                <div className="flex gap-4 text-xs text-gray-600 p-2 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-1">
                        <div className="w-4 h-4 rounded bg-green-100 border border-green-500" />
                        <span>Do cargo</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-4 h-4 rounded bg-blue-100 border border-blue-500" />
                        <span>Adicionado</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-4 h-4 rounded bg-red-100 border border-red-500 opacity-70" />
                        <span>Removido</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-4 h-4 rounded bg-gray-100 border border-gray-300 opacity-40" />
                        <span>Sem acesso</span>
                    </div>
                </div>

                {/* Checkbox heranca */}
                <div className="flex items-center gap-3 p-3 rounded-lg border" style={{ backgroundColor: inherit ? '#f0fdf4' : '#fef3c7' }}>
                    <Checkbox
                        checked={inherit}
                        onCheckedChange={setInherit}
                        id="inherit"
                    />
                    <div>
                        <Label htmlFor="inherit" className="cursor-pointer font-medium">
                            Herdar permissoes do cargo ({cargo})
                        </Label>
                        <p className="text-xs text-gray-500">
                            {inherit
                                ? "Customizacoes adicionam ou removem permissoes do cargo base"
                                : "Usuario tera APENAS as permissoes marcadas manualmente"}
                        </p>
                    </div>
                </div>

                {/* Mini Sidebar Preview */}
                <Card className="border-2" style={{ borderColor: '#07593f' }}>
                    <CardContent className="p-0">
                        <div className="p-3 border-b" style={{ backgroundColor: '#07593f' }}>
                            <p className="text-white text-sm font-medium">Pre-visualizacao do Menu</p>
                        </div>
                        <ScrollArea className="h-[300px]">
                            <div className="p-2 space-y-4">
                                {Object.entries(menuBySection).map(([section, items]) => (
                                    <div key={section}>
                                        <p className="text-xs font-semibold text-gray-400 uppercase mb-2 px-2">{section}</p>
                                        <div className="space-y-1">
                                            {items.map(item => {
                                                const state = permissionStates[item.permission];
                                                const style = getItemStyle(state);

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
                                                            style: { opacity: state?.active ? 1 : 0.4 }
                                                        })}
                                                        <span
                                                            className="flex-1 text-left text-sm"
                                                            style={{
                                                                opacity: state?.active ? 1 : 0.5,
                                                                textDecoration: style.textDecoration
                                                            }}
                                                        >
                                                            {item.title}
                                                        </span>
                                                        {getBadge(state)}
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
                {countCustom > 0 && (
                    <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 p-2 rounded-lg">
                        <Info className="w-4 h-4" />
                        <span>{countCustom} permissao(oes) customizada(s)</span>
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Salvar Permissoes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
