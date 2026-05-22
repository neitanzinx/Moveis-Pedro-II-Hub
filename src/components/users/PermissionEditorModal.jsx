import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Shield, Search, ChevronDown, ChevronRight, Check, X, Plus, Minus } from "lucide-react";
import { ROLE_RULES, PERMISSION_CATALOG, PERMISSION_CATEGORIES, getUserRoles } from "@/config/permissions";

/**
 * Editor visual de permissões por usuário (sobrepõe o cargo).
 * Suporta múltiplos cargos: calcula base como union de ROLE_RULES dos cargos do usuário.
 * Mantém a API onSave({ inherit, allowed, denied }) inalterada.
 */
export default function PermissionEditorModal({ user, onSave, onClose, isSaving = false }) {
    // Multi-cargo support: getUserRoles retorna array de cargos do usuário
    const roles       = getUserRoles(user);
    const primaryRole = roles[0] || 'Vendedor';

    // Estado inicial das custom_permissions
    const initialCustom = user?.custom_permissions || { inherit: true, allowed: [], denied: [] };

    const [inherit, setInherit] = useState(initialCustom.inherit !== false);
    const [allowed, setAllowed] = useState(initialCustom.allowed || []);
    const [denied,  setDenied]  = useState(initialCustom.denied  || []);
    const [search,             setSearch]             = useState('');
    const [expandedCategories, setExpandedCategories] = useState({});

    // Union of base permissions from all user roles
    const roleBasePerms = useMemo(() => {
        const perms = new Set();
        roles.forEach(role => {
            const rule = ROLE_RULES[role];
            if (!rule) return;
            if (rule.can.includes('*')) {
                PERMISSION_CATALOG.forEach(({ code }) => perms.add(code));
            } else {
                rule.can.forEach(p => perms.add(p));
            }
        });
        return perms;
    }, [roles]);

    // Compute display state for every catalog permission
    const permState = useMemo(() => {
        const states = {};
        PERMISSION_CATALOG.forEach(({ code }) => {
            const fromRole  = roleBasePerms.has(code);
            const inAllowed = allowed.includes(code);
            const inDenied  = denied.includes(code);

            let active = false;
            let source = 'none';

            if (!inherit) {
                active = inAllowed;
                source = inAllowed ? 'custom_allowed' : 'none';
            } else if (inDenied) {
                active = false;
                source = 'custom_denied';
            } else if (inAllowed) {
                active = true;
                source = 'custom_allowed';
            } else if (fromRole) {
                active = true;
                source = 'role';
            }

            states[code] = { active, source, fromRole };
        });
        return states;
    }, [roleBasePerms, inherit, allowed, denied]);

    const togglePerm = (code) => {
        const state = permState[code];
        if (!state) return;

        if (inherit) {
            if (state.fromRole) {
                if (state.source === 'custom_denied') {
                    setDenied(prev => prev.filter(p => p !== code));
                } else {
                    setDenied(prev  => [...prev, code]);
                    setAllowed(prev => prev.filter(p => p !== code));
                }
            } else {
                if (state.source === 'custom_allowed') {
                    setAllowed(prev => prev.filter(p => p !== code));
                } else {
                    setAllowed(prev => [...prev, code]);
                    setDenied(prev  => prev.filter(p => p !== code));
                }
            }
        } else {
            if (allowed.includes(code)) {
                setAllowed(prev => prev.filter(p => p !== code));
            } else {
                setAllowed(prev => [...prev, code]);
            }
        }
    };

    const handleSave = () => {
        onSave({
            inherit,
            allowed: allowed.filter(Boolean),
            denied:  inherit ? denied.filter(Boolean) : [],
        });
    };

    // Group catalog by category with search filter
    const catalogByCategory = useMemo(() => {
        const q = search.toLowerCase().trim();
        const result = {};
        PERMISSION_CATALOG.forEach(item => {
            if (
                q &&
                !item.label.toLowerCase().includes(q) &&
                !item.code.toLowerCase().includes(q) &&
                !item.description.toLowerCase().includes(q)
            ) return;
            if (!result[item.category]) result[item.category] = [];
            result[item.category].push(item);
        });
        return result;
    }, [search]);

    const toggleCategory = (cat) =>
        setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));

    const isCategoryExpanded = (cat) => expandedCategories[cat] !== false;

    const getPermStyle = (code) => {
        const s = permState[code];
        if (!s || s.source === 'none')   return { bg: 'bg-gray-50', border: 'border-gray-200', opacity: 'opacity-50' };
        if (s.source === 'custom_denied') return { bg: 'bg-red-50',  border: 'border-red-300',  opacity: '' };
        if (s.source === 'custom_allowed') return { bg: 'bg-blue-50', border: 'border-blue-300', opacity: '' };
        if (s.active)                      return { bg: 'bg-green-50', border: 'border-green-300', opacity: '' };
        return { bg: 'bg-gray-50', border: 'border-gray-200', opacity: 'opacity-50' };
    };

    const activeCount = Object.values(permState).filter(s => s.active).length;
    const customCount = allowed.length + denied.length;

    if (!user) return null;

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col gap-3">
                <DialogHeader className="flex-shrink-0">
                    <DialogTitle className="flex items-center gap-2">
                        <Shield className="w-5 h-5" style={{ color: '#07593f' }} />
                        Permissões de {user.full_name}
                    </DialogTitle>
                    <DialogDescription>
                        Cargo(s): <strong>{roles.join(', ') || 'Nenhum'}</strong>.
                        Clique nas permissões para personalizar o acesso individual.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-shrink-0 space-y-3">
                    {/* Legend */}
                    <div className="flex gap-3 text-xs text-gray-600 flex-wrap">
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded bg-green-100 border border-green-400 inline-block" />
                            Do cargo
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded bg-blue-100 border border-blue-400 inline-block" />
                            Adicionado
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded bg-red-100 border border-red-400 inline-block" />
                            Removido
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded bg-gray-100 border border-gray-300 inline-block opacity-50" />
                            Sem acesso
                        </span>
                    </div>

                    {/* Inherit toggle */}
                    <div
                        className="flex items-center gap-3 p-3 rounded-lg border"
                        style={{ backgroundColor: inherit ? '#f0fdf4' : '#fef3c7' }}
                    >
                        <Checkbox checked={inherit} onCheckedChange={setInherit} id="inherit-user" />
                        <div>
                            <Label htmlFor="inherit-user" className="cursor-pointer font-medium">
                                Herdar permissões do cargo ({primaryRole})
                            </Label>
                            <p className="text-xs text-gray-500">
                                {inherit
                                    ? 'Customizações adicionam ou removem permissões do cargo base'
                                    : 'Usuário terá APENAS as permissões marcadas manualmente'}
                            </p>
                        </div>
                    </div>

                    {!inherit && (
                        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                            Modo manual: apenas permissões marcadas abaixo serão concedidas.
                        </div>
                    )}

                    {/* Search */}
                    <div className="flex items-center gap-3">
                        <div className="flex-1 relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                            <Input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Filtrar permissões..."
                                className="pl-7 h-8 text-sm"
                            />
                        </div>
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                            {activeCount} ativa(s){customCount > 0 ? ` · ${customCount} customiz.` : ''}
                        </span>
                    </div>
                </div>

                {/* Permissions by category */}
                <ScrollArea className="flex-1 min-h-0">
                    <div className="space-y-3 pr-2">
                        {Object.entries(catalogByCategory).map(([category, items]) => {
                            const catConfig   = PERMISSION_CATEGORIES.find(c => c.key === category);
                            const expanded    = isCategoryExpanded(category);
                            const activeInCat = items.filter(i => permState[i.code]?.active).length;

                            return (
                                <div key={category} className="border rounded-lg overflow-hidden">
                                    <button
                                        type="button"
                                        className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                                        onClick={() => toggleCategory(category)}
                                    >
                                        <div className="flex items-center gap-2">
                                            {expanded
                                                ? <ChevronDown  className="w-4 h-4 text-gray-500" />
                                                : <ChevronRight className="w-4 h-4 text-gray-500" />
                                            }
                                            <span
                                                className="font-medium text-sm"
                                                style={{ color: catConfig?.color || '#374151' }}
                                            >
                                                {catConfig?.label || category}
                                            </span>
                                        </div>
                                        <Badge
                                            className="text-xs"
                                            style={{
                                                backgroundColor: `${catConfig?.color || '#6b7280'}20`,
                                                color:           catConfig?.color || '#6b7280',
                                            }}
                                        >
                                            {activeInCat}/{items.length}
                                        </Badge>
                                    </button>

                                    {expanded && (
                                        <div className="p-2 grid sm:grid-cols-2 gap-1">
                                            {items.map(item => {
                                                const style = getPermStyle(item.code);
                                                const state = permState[item.code];
                                                return (
                                                    <button
                                                        key={item.code}
                                                        type="button"
                                                        onClick={() => togglePerm(item.code)}
                                                        className={`w-full text-left p-2 rounded-lg border transition-all hover:scale-[1.01] ${style.bg} ${style.border} ${style.opacity}`}
                                                    >
                                                        <div className="flex items-start gap-2">
                                                            <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                                                state?.source === 'custom_denied'  ? 'bg-red-200'   :
                                                                state?.active                      ? 'bg-green-200' :
                                                                'bg-gray-200'
                                                            }`}>
                                                                {state?.source === 'custom_denied'              && <X     className="w-3 h-3 text-red-600"   />}
                                                                {state?.active && state?.source !== 'custom_denied' && <Check className="w-3 h-3 text-green-600" />}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-xs font-medium leading-tight">{item.label}</p>
                                                                <p className="text-xs text-gray-500 leading-tight">{item.description}</p>
                                                            </div>
                                                            {state?.source === 'custom_allowed' && (
                                                                <Badge className="bg-blue-100 text-blue-700 text-xs px-1 flex-shrink-0">
                                                                    <Plus className="w-2 h-2" />
                                                                </Badge>
                                                            )}
                                                            {state?.source === 'custom_denied' && (
                                                                <Badge className="bg-red-100 text-red-700 text-xs px-1 flex-shrink-0">
                                                                    <Minus className="w-2 h-2" />
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {Object.keys(catalogByCategory).length === 0 && (
                            <p className="text-center text-gray-400 py-8 text-sm">
                                Nenhuma permissão encontrada para este filtro.
                            </p>
                        )}
                    </div>
                </ScrollArea>

                <DialogFooter className="flex-shrink-0">
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
                    >
                        {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        Salvar Permissões
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
