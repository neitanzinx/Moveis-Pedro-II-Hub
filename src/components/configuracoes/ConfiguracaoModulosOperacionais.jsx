import React, { useState, useEffect } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/lib/supabase';
import { SYSTEM_MODULES, MODULE_CATEGORIES } from '@/config/modules';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Sliders, Save, Loader2, PackageCheck, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function ConfiguracaoModulosOperacionais() {
    const { organization, settings, plano, isModuleAllowedByPlan, refreshTenant } = useTenant();
    const [modulosState, setModulosState] = useState({});
    const [saving, setSaving] = useState(false);


    useEffect(() => {
        const initialMap = {};
        const activeFromSettings = settings?.modulos_ativos || {};

        SYSTEM_MODULES.forEach(mod => {
            if (Object.prototype.hasOwnProperty.call(activeFromSettings, mod.key)) {
                initialMap[mod.key] = activeFromSettings[mod.key] !== false;
            } else {
                initialMap[mod.key] = mod.defaultActive;
            }
        });

        setModulosState(initialMap);
    }, [settings]);

    const handleToggle = (key, value) => {
        setModulosState(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const orgId = organization?.id || '00000000-0000-0000-0000-000000000001';

            const modulosAtuais = settings?.modulos_ativos || {};
            const novosModulos = {
                ...modulosAtuais,
                ...modulosState
            };

            const { error } = await supabase
                .from('organization_settings')
                .upsert(
                    {
                        organization_id: orgId,
                        modulos_ativos: novosModulos,
                        updated_at: new Date().toISOString()
                    },
                    { onConflict: 'organization_id' }
                );

            if (error) throw error;

            await refreshTenant();
            toast.success('Módulos e recursos atualizados com sucesso!');
        } catch (error) {
            console.error('Erro ao salvar módulos da organização:', error);
            toast.error(`Erro ao salvar: ${error.message || error}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Sliders className="h-5 w-5 text-slate-700" />
                        Módulos & Recursos do Sistema
                    </CardTitle>
                    <CardDescription>
                        Ative ou desative as funcionalidades do sistema de acordo com a estrutura da sua empresa. Recursos desativados serão ocultados dos menus para manter o sistema simples.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                    {MODULE_CATEGORIES.map(cat => {
                        const modulesInCategory = SYSTEM_MODULES.filter(m => m.category === cat.key);
                        return (
                            <div key={cat.key} className="space-y-4">
                                <div className="border-b pb-2">
                                    <h3 className="text-lg font-semibold text-slate-900">{cat.label}</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {modulesInCategory.map(mod => {
                                        const isAllowedByPlan = isModuleAllowedByPlan ? isModuleAllowedByPlan(mod.key) : true;
                                        const isChecked = isAllowedByPlan && modulosState[mod.key] !== false;
                                        return (
                                            <div
                                                key={mod.key}
                                                className={`flex items-start justify-between p-4 rounded-xl border transition-all ${
                                                    !isAllowedByPlan
                                                        ? 'border-slate-200 bg-slate-100/80 opacity-60'
                                                        : isChecked
                                                            ? 'border-slate-200 bg-white shadow-sm'
                                                            : 'border-slate-100 bg-slate-50/80'
                                                }`}
                                            >
                                                <div className="space-y-1 pr-4">
                                                    <div className="flex items-center gap-2">
                                                        <Label
                                                            htmlFor={`toggle-${mod.key}`}
                                                            className={`text-sm font-semibold text-slate-900 ${!isAllowedByPlan ? 'cursor-not-allowed text-slate-500' : 'cursor-pointer'}`}
                                                        >
                                                            {mod.label}
                                                        </Label>
                                                        {!isAllowedByPlan ? (
                                                            <span className="inline-flex items-center text-[10px] font-medium text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                                                                🔒 Requer Upgrade
                                                            </span>
                                                        ) : isChecked ? (
                                                            <span className="inline-flex items-center text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                                                Ativo
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                                                                Desativado
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-slate-500 leading-relaxed">
                                                        {!isAllowedByPlan
                                                            ? 'Este recurso não está incluso no plano de assinatura atual da sua empresa.'
                                                            : mod.description}
                                                    </p>
                                                </div>
                                                <Switch
                                                    id={`toggle-${mod.key}`}
                                                    checked={isChecked}
                                                    disabled={!isAllowedByPlan}
                                                    onCheckedChange={(val) => handleToggle(mod.key, val)}
                                                />
                                            </div>
                                        );
                                    })}

                                </div>
                            </div>
                        );
                    })}

                    <div className="flex items-center justify-between border-t pt-4">
                        <p className="text-xs text-slate-500">
                            As alterações afetam os menus e permissões de acesso da empresa imediatamente após salvar.
                        </p>
                        <Button onClick={handleSave} disabled={saving} className="bg-slate-900 hover:bg-slate-800 text-white">
                            {saving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" />
                                    Salvar Módulos
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
