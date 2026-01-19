import React, { useState, createElement } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Check, Info, Key } from "lucide-react";
import { CARGOS, getCargoConfig } from "@/config/cargos";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import RolePermissionEditorModal from "./RolePermissionEditorModal";

export default function GestaoCargos() {
    const [selectedCargo, setSelectedCargo] = useState(null);
    const [editingCargo, setEditingCargo] = useState(null);
    const queryClient = useQueryClient();

    // Buscar permissoes salvas no banco
    const { data: rolePermissions = [] } = useQuery({
        queryKey: ['role_permissions'],
        queryFn: () => base44.entities.RolePermission.list()
    });

    // Mutation para salvar
    const savePermissionsMutation = useMutation({
        mutationFn: async ({ cargo, permissions }) => {
            // Tentar atualizar primeiro
            const existing = rolePermissions.find(r => r.cargo === cargo);
            if (existing) {
                await base44.entities.RolePermission.update(cargo, {
                    permissions,
                    updated_at: new Date().toISOString()
                });
            } else {
                await base44.entities.RolePermission.create({
                    cargo,
                    permissions
                });
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['role_permissions'] });
            setEditingCargo(null);
            toast.success("Permissoes do cargo atualizadas!");
        },
        onError: (e) => toast.error("Erro: " + e.message)
    });

    const getCargoPermissions = (cargoValue) => {
        const saved = rolePermissions.find(r => r.cargo === cargoValue);
        return saved?.permissions || [];
    };

    return (
        <div className="space-y-6">
            <Card className="border-0 shadow-lg">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2" style={{ color: '#07593f' }}>
                        <Shield className="w-6 h-6" />
                        Cargos do Sistema
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-gray-500 mb-6">
                        Gerencie os cargos e suas permissoes. Clique em "Editar Permissoes" para modificar o acesso.
                    </p>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {CARGOS.map((cargo) => {
                            const isSelected = selectedCargo?.value === cargo.value;
                            const Icon = cargo.icon;
                            const savedPerms = getCargoPermissions(cargo.value);
                            const hasCustomPerms = savedPerms.length > 0;

                            return (
                                <div
                                    key={cargo.value}
                                    className={`p-4 rounded-xl border-2 transition-all ${isSelected
                                        ? 'ring-2 ring-offset-2'
                                        : 'hover:shadow-md'
                                        }`}
                                    style={{
                                        backgroundColor: cargo.bgColor,
                                        borderColor: cargo.color,
                                        ...(isSelected && { ringColor: cargo.color })
                                    }}
                                >
                                    <div className="flex items-start gap-3">
                                        <div
                                            className="w-12 h-12 rounded-xl flex items-center justify-center cursor-pointer"
                                            style={{ backgroundColor: `${cargo.color}20` }}
                                            onClick={() => setSelectedCargo(isSelected ? null : cargo)}
                                        >
                                            <Icon className="w-6 h-6" style={{ color: cargo.color }} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between">
                                                <h3
                                                    className="font-bold cursor-pointer"
                                                    style={{ color: cargo.color }}
                                                    onClick={() => setSelectedCargo(isSelected ? null : cargo)}
                                                >
                                                    {cargo.label}
                                                </h3>
                                                <div className="flex gap-1">
                                                    {hasCustomPerms && (
                                                        <Badge className="bg-blue-100 text-blue-700 text-xs">
                                                            <Key className="w-3 h-3 mr-1" />
                                                            Custom
                                                        </Badge>
                                                    )}
                                                    {cargo.mobileAppOnly && (
                                                        <Badge variant="outline" className="text-xs">App</Badge>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="text-sm text-gray-500 mt-1">{cargo.description}</p>

                                            {/* Botao Editar Permissoes */}
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="mt-3 w-full"
                                                onClick={() => setEditingCargo(cargo.value)}
                                                style={{ borderColor: cargo.color, color: cargo.color }}
                                            >
                                                <Key className="w-4 h-4 mr-2" />
                                                Editar Permissoes
                                            </Button>
                                        </div>
                                    </div>

                                    {isSelected && (
                                        <div className="mt-4 pt-4 border-t" style={{ borderColor: `${cargo.color}30` }}>
                                            <p className="text-xs font-semibold text-gray-600 mb-2">Permissoes Padrao:</p>
                                            <ul className="space-y-1">
                                                {cargo.permissions.map((perm, i) => (
                                                    <li key={i} className="flex items-center gap-2 text-sm">
                                                        <Check className="w-4 h-4" style={{ color: cargo.color }} />
                                                        {perm}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            <Alert className="bg-blue-50 border-blue-200">
                <Info className="w-4 h-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                    <strong>Sobre os Cargos:</strong> Cada cargo pode ter permissoes customizadas. Clique em "Editar Permissoes" para ajustar o acesso dos usuarios desse cargo.
                </AlertDescription>
            </Alert>

            {/* Modal de Edicao */}
            {editingCargo && (
                <RolePermissionEditorModal
                    cargo={editingCargo}
                    currentPermissions={getCargoPermissions(editingCargo)}
                    onClose={() => setEditingCargo(null)}
                    onSave={(permissions) => {
                        savePermissionsMutation.mutate({ cargo: editingCargo, permissions });
                    }}
                    isSaving={savePermissionsMutation.isPending}
                />
            )}
        </div>
    );
}

