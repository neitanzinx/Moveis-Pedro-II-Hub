import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Shield, Search, ChevronDown, ChevronRight, Check, X } from "lucide-react";
import { ROLE_RULES, SCOPES, PERMISSION_CATALOG, PERMISSION_CATEGORIES } from "@/config/permissions";

const SCOPE_OPTIONS = [
    { value: SCOPES.ALL,   label: 'Todos os dados (toda a empresa)' },
    { value: SCOPES.STORE, label: 'Dados da loja do usuário' },
    { value: SCOPES.OWN,   label: 'Apenas dados próprios' },
];

/**
 * Editor visual de permissões por cargo.
 * - Cargos estáticos: mostra permissões do ROLE_RULES como base (verde),
 *   permite adicionar extras (azul) ou remover do base (vermelho).
 * - Cargos personalizados: lista limpa; cada item marcado = permissão concedida.
 * Props: cargo, cargoLabel, cargoColor, currentPermissions, currentDenied,
 *        currentScope, isCustomCargo, onSave({permissions, deniedPermissions, scope}),
 *        onClose, isSaving
 */
export default function RolePermissionEditorModal({
    cargo,
    cargoLabel,
    cargoColor,
    currentPermissions = [],
    currentDenied      = [],
    currentScope,
    isCustomCargo      = false,
    onSave,
    onClose,
    isSaving           = false,
}) {
    const isAdmin    = cargo === 'Administrador';
    const roleRules  = ROLE_RULES[cargo] || null;
    // Base permissions from ROLE_RULES (for static cargos). Wildcard (*) means all.
    const basePerms  = roleRules?.can?.includes('*') ? [] : (roleRules?.can || []);

    const [scope,              setScope]              = useState(currentScope || ROLE_RULES[cargo]?.scope || SCOPES.OWN);
    // added: permissions explicitly added (extra beyond base, or full list for custom cargo)
    const [added,              setAdded]              = useState(currentPermissions);
    // denied: permissions explicitly removed from base (only relevant for static cargos)
    const [denied,             setDenied]             = useState(currentDenied);
    const [search,             setSearch]             = useState('');
    const [expandedCategories, setExpandedCategories] = useState({});

    // Derive display state for every permission in the catalog
    const permState = useMemo(() => {
        const states = {};
        PERMISSION_CATALOG.forEach(({ code }) => {
            const inBase    = basePerms.includes(code);
            const inAdded   = added.includes(code);
            const inDenied  = denied.includes(code);

            let active = false;
            let source = 'none'; // 'role' | 'added' | 'denied' | 'none'

            if (isCustomCargo) {
                // Custom cargo: no implicit base — added list IS the full permission set
                active = inAdded;
                source = inAdded ? 'added' : 'none';
            } else if (inDenied) {
                active = false;
                source = 'denied';
            } else if (inBase) {
                active = true;
                source = inAdded ? 'added' : 'role';
            } else if (inAdded) {
                active = true;
                source = 'added';
            }

            states[code] = { active, source, inBase };
        });
        return states;
    }, [added, denied, basePerms, isCustomCargo]);

    const togglePerm = (code) => {
        if (isAdmin) return;
        const state = permState[code];
        if (!state) return;

        if (isCustomCargo) {
            // Simple toggle on the added set
            setAdded(prev => prev.includes(code) ? prev.filter(p => p !== code) : [...prev, code]);
        } else if (state.inBase) {
            if (state.source === 'denied') {
                // Restore: remove from denied
                setDenied(prev => prev.filter(p => p !== code));
            } else {
                // Deny: add to denied, remove from added (in case it was there)
                setDenied(prev => [...prev, code]);
                setAdded(prev => prev.filter(p => p !== code));
            }
        } else {
            if (state.source === 'added') {
                // Remove extra
                setAdded(prev => prev.filter(p => p !== code));
            } else {
                // Add extra, ensure not in denied
                setAdded(prev => [...prev, code]);
                setDenied(prev => prev.filter(p => p !== code));
            }
        }
    };

    const handleSave = () => {
        onSave({
            // For static cargos: only store extras that are not already in base
            permissions:        isCustomCargo ? added : added.filter(p => !basePerms.includes(p)),
            deniedPermissions:  isCustomCargo ? []   : denied,
            scope,
        });
    };

    // Group catalog by category, applying search filter
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

    // Default: all categories expanded
    const isCategoryExpanded = (cat) => expandedCategories[cat] !== false;

    const getPermStyle = (code) => {
        const s = permState[code];
        if (!s || s.source === 'none') return { bg: 'bg-gray-50', border: 'border-gray-200', opacity: 'opacity-50' };
        if (s.source === 'denied')     return { bg: 'bg-red-50',   border: 'border-red-300',  opacity: '' };
        if (s.source === 'added')      return { bg: 'bg-blue-50',  border: 'border-blue-300', opacity: '' };
        if (s.active)                  return { bg: 'bg-green-50', border: 'border-green-300', opacity: '' };
        return { bg: 'bg-gray-50', border: 'border-gray-200', opacity: 'opacity-50' };
    };

    const activeCount = Object.values(permState).filter(s => s.active).length;
    const customCount = added.length + denied.length;

    if (!cargo) return null;

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col gap-3">
                <DialogHeader className="flex-shrink-0">
                    <DialogTitle className="flex items-center gap-2">
                        <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: `${cargoColor || '#07593f'}25` }}
                        >
                            <Shield className="w-4 h-4" style={{ color: cargoColor || '#07593f' }} />
                        </div>
                        Permissões: {cargoLabel || cargo}
                    </DialogTitle>
                    <DialogDescription>
                        {isAdmin
                            ? 'Administrador possui acesso irrestrito ao sistema e não pode ser editado.'
                            : 'Verde = do cargo, Azul = adicionado, Vermelho = removido. Clique para alternar.'}
                    </DialogDescription>
                </DialogHeader>

                {isAdmin ? (
                    <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                        <div className="flex items-center gap-2 text-amber-700">
                            <Shield className="w-5 h-5" />
                            <span className="font-medium">
                                Administrador tem acesso total ao sistema e não pode ser editado.
                            </span>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Scope selector */}
                        <div className="flex-shrink-0">
                            <Label className="text-sm font-medium">Escopo de dados</Label>
                            <Select value={scope} onValueChange={setScope}>
                                <SelectTrigger className="mt-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {SCOPE_OPTIONS.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Legend + search + counters */}
                        <div className="flex-shrink-0 space-y-2">
                            <div className="flex items-center gap-3 flex-wrap">
                                <div className="flex gap-3 text-xs text-gray-600">
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
                                <div className="flex-1 min-w-40 relative">
                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                                    <Input
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        placeholder="Filtrar permissões..."
                                        className="pl-7 h-8 text-sm"
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-gray-500">
                                {activeCount} ativa(s) &nbsp;|&nbsp; {customCount} customização(ões)
                            </p>
                        </div>

                        {/* Permissions grouped by category */}
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
                                                                        state?.source === 'denied' ? 'bg-red-200'  :
                                                                        state?.active              ? 'bg-green-200' :
                                                                        'bg-gray-200'
                                                                    }`}>
                                                                        {state?.source === 'denied'              && <X     className="w-3 h-3 text-red-600"   />}
                                                                        {state?.active && state?.source !== 'denied' && <Check className="w-3 h-3 text-green-600" />}
                                                                    </div>
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="text-xs font-medium leading-tight">{item.label}</p>
                                                                        <p className="text-xs text-gray-500 leading-tight">{item.description}</p>
                                                                    </div>
                                                                    {state?.source === 'added' && (
                                                                        <Badge className="bg-blue-100 text-blue-700 text-xs px-1 flex-shrink-0">+</Badge>
                                                                    )}
                                                                    {state?.source === 'denied' && (
                                                                        <Badge className="bg-red-100 text-red-700 text-xs px-1 flex-shrink-0">-</Badge>
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
                    </>
                )}

                <DialogFooter className="flex-shrink-0">
                    <Button variant="outline" onClick={onClose}>
                        {isAdmin ? 'Fechar' : 'Cancelar'}
                    </Button>
                    {!isAdmin && (
                        <Button
                            onClick={handleSave}
                            disabled={isSaving}
                            style={{
                                background: `linear-gradient(135deg, ${cargoColor || '#07593f'} 0%, ${cargoColor || '#07593f'}cc 100%)`,
                            }}
                        >
                            {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                            Salvar Permissões
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


