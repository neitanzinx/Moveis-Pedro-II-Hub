import React, { useState, createElement } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Search, KeyRound, UserCheck, UserX, RotateCcw, Shield,
    Clock, CheckCircle2, AlertCircle, Loader2, Copy, Eye, EyeOff,
    Users, Edit, Store, TrendingUp, Trash2
} from "lucide-react";
import { toast } from "sonner";
import { CARGOS, LOJAS, getCargoConfig } from "@/config/cargos";

const API_URL = import.meta.env.VITE_ZAP_API_URL || "http://localhost:3001";

export default function GestaoFuncionarios({ currentUser }) {
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");
    const [filterCargo, setFilterCargo] = useState("all");

    // Estados dos modais
    const [selectedUser, setSelectedUser] = useState(null);
    const [modalType, setModalType] = useState(null); // 'create' | 'reset' | 'toggle' | 'edit'
    const [showPassword, setShowPassword] = useState(false);
    const [generatedPassword, setGeneratedPassword] = useState(null);
    const [generatedMatricula, setGeneratedMatricula] = useState(null);

    // Estado de edição
    const [editData, setEditData] = useState(null);

    const queryClient = useQueryClient();

    // Buscar todos os usuários aprovados (funcionários)
    const { data: users = [], isLoading } = useQuery({
        queryKey: ['funcionarios-gestao'],
        queryFn: async () => {
            const allUsers = await base44.entities.User.list('-created_date');
            // Filtrar apenas usuários que são funcionários (não clientes)
            return allUsers.filter(u =>
                u.status_aprovacao === 'Aprovado' &&
                u.cargo &&
                !['Cliente'].includes(u.cargo)
            );
        }
    });

    // Mutation para criar credenciais
    const createCredentialsMutation = useMutation({
        mutationFn: async (userId) => {
            const token = localStorage.getItem('employee_token');
            const response = await fetch(`${API_URL}/api/auth/employee/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({ user_id: userId })
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Erro ao criar credenciais');
            }
            return response.json();
        },
        onSuccess: (data) => {
            setGeneratedMatricula(data.matricula);
            setGeneratedPassword(data.senha_temporaria);
            queryClient.invalidateQueries({ queryKey: ['funcionarios-gestao'] });
            toast.success("Acesso ativado com sucesso!");
        },
        onError: (error) => {
            toast.error(error.message);
            handleCloseModal();
        }
    });

    // Mutation para resetar senha
    const resetPasswordMutation = useMutation({
        mutationFn: async (userId) => {
            const response = await fetch(`${API_URL}/api/auth/employee/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId })
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Erro ao resetar senha');
            }
            return response.json();
        },
        onSuccess: (data) => {
            setGeneratedPassword(data.senha_temporaria);
            setGeneratedMatricula(selectedUser?.matricula);
            queryClient.invalidateQueries({ queryKey: ['funcionarios-gestao'] });
            toast.success(data.whatsapp_enviado
                ? "Senha resetada e enviada via WhatsApp!"
                : "Senha resetada! (WhatsApp não disponível)");
        },
        onError: (error) => {
            toast.error(error.message);
            handleCloseModal();
        }
    });

    // Mutation para ativar/desativar conta
    const toggleAccountMutation = useMutation({
        mutationFn: async ({ userId, ativo }) => {
            await base44.entities.User.update(userId, { ativo });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['funcionarios-gestao'] });
            toast.success(selectedUser?.ativo === false ? "Conta ativada!" : "Conta desativada!");
            handleCloseModal();
        },
        onError: (error) => {
            toast.error("Erro ao alterar status: " + error.message);
        }
    });

    // Mutation para editar funcionário
    const updateUserMutation = useMutation({
        mutationFn: async ({ userId, updates }) => {
            await base44.entities.User.update(userId, updates);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['funcionarios-gestao'] });
            toast.success("Funcionário atualizado!");
            handleCloseModal();
        },
        onError: (error) => {
            toast.error("Erro: " + error.message);
        }
    });

    // Mutation para deletar usuário
    const deleteUserMutation = useMutation({
        mutationFn: async (userId) => {
            await base44.entities.User.delete(userId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['funcionarios-gestao'] });
            toast.success("Funcionário removido!");
        },
        onError: () => toast.error("Erro ao remover funcionário")
    });

    // Filtrar usuários
    const filteredUsers = users.filter(user => {
        const matchesSearch =
            user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.matricula?.toLowerCase().includes(searchTerm.toLowerCase());

        let matchesStatus = true;
        if (filterStatus === 'with') matchesStatus = !!user.matricula && user.ativo !== false;
        if (filterStatus === 'without') matchesStatus = !user.matricula;
        if (filterStatus === 'inactive') matchesStatus = user.ativo === false;

        let matchesCargo = true;
        if (filterCargo !== 'all') matchesCargo = user.cargo === filterCargo;

        return matchesSearch && matchesStatus && matchesCargo;
    });

    // Estatísticas
    const stats = {
        total: users.length,
        withAccess: users.filter(u => u.matricula && u.ativo !== false).length,
        withoutAccess: users.filter(u => !u.matricula).length,
        inactive: users.filter(u => u.ativo === false).length
    };

    const handleOpenModal = (user, type) => {
        setSelectedUser(user);
        setModalType(type);
        setGeneratedPassword(null);
        setGeneratedMatricula(null);
        setShowPassword(false);
        if (type === 'edit') {
            setEditData({
                full_name: user.full_name || '',
                cargo: user.cargo || '',
                loja: user.loja || '',
                is_vendedor: user.is_vendedor || false,
                meta_mensal: user.meta_mensal || 0
            });
        }
    };

    const handleCloseModal = () => {
        setModalType(null);
        setSelectedUser(null);
        setGeneratedPassword(null);
        setGeneratedMatricula(null);
        setShowPassword(false);
        setEditData(null);
    };

    const handleSaveEdit = () => {
        if (!selectedUser || !editData) return;
        const cargoConfig = getCargoConfig(editData.cargo);
        updateUserMutation.mutate({
            userId: selectedUser.id,
            updates: {
                full_name: editData.full_name,
                cargo: editData.cargo,
                loja: cargoConfig?.requiresStore ? editData.loja : null,
                is_vendedor: editData.is_vendedor,
                meta_mensal: editData.is_vendedor ? parseFloat(editData.meta_mensal) || 0 : 0
            }
        });
    };

    const handleDeleteUser = (user) => {
        if (user.id === currentUser?.id) {
            toast.error("Você não pode remover sua própria conta");
            return;
        }
        if (confirm(`⚠️ REMOVER "${user.full_name}" permanentemente?\n\nEsta ação não pode ser desfeita!`)) {
            deleteUserMutation.mutate(user.id);
        }
    };

    const copyToClipboard = (text, label) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copiado!`);
    };

    const getStatusBadge = (user) => {
        if (!user.matricula) {
            return (
                <Badge variant="outline" className="bg-gray-50 text-gray-600">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Sem Acesso
                </Badge>
            );
        }
        if (user.ativo === false) {
            return (
                <Badge className="bg-red-100 text-red-700">
                    <UserX className="w-3 h-3 mr-1" />
                    Desativado
                </Badge>
            );
        }
        if (user.primeiro_acesso) {
            return (
                <Badge className="bg-yellow-100 text-yellow-700">
                    <Clock className="w-3 h-3 mr-1" />
                    Aguardando 1º Acesso
                </Badge>
            );
        }
        return (
            <Badge className="bg-green-100 text-green-700">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Ativo
            </Badge>
        );
    };

    const editCargoConfig = editData ? getCargoConfig(editData.cargo) : null;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-green-600" />
                    Gestão de Funcionários
                </h2>
                <p className="text-gray-500 text-sm mt-1">
                    Gerencie os acessos, cargos e permissões dos funcionários do sistema
                </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
                <Card className="border-0 shadow-sm">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Total</p>
                                <p className="text-2xl font-bold" style={{ color: '#07593f' }}>{stats.total}</p>
                            </div>
                            <Users className="w-8 h-8 text-gray-200" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-sm">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Com Acesso</p>
                                <p className="text-2xl font-bold text-green-600">{stats.withAccess}</p>
                            </div>
                            <UserCheck className="w-8 h-8 text-green-100" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-sm">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Sem Acesso</p>
                                <p className="text-2xl font-bold text-gray-600">{stats.withoutAccess}</p>
                            </div>
                            <AlertCircle className="w-8 h-8 text-gray-100" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-sm">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Desativados</p>
                                <p className="text-2xl font-bold text-red-600">{stats.inactive}</p>
                            </div>
                            <UserX className="w-8 h-8 text-red-100" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card className="border-0 shadow-lg">
                <CardContent className="p-4">
                    <div className="flex gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                placeholder="Buscar por nome, email ou matrícula..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                            <SelectTrigger className="w-40">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos</SelectItem>
                                <SelectItem value="with">Com Acesso</SelectItem>
                                <SelectItem value="without">Sem Acesso</SelectItem>
                                <SelectItem value="inactive">Desativados</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={filterCargo} onValueChange={setFilterCargo}>
                            <SelectTrigger className="w-40">
                                <SelectValue placeholder="Cargo" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos Cargos</SelectItem>
                                {CARGOS.filter(c => c.value !== 'Pendente Definição').map(c => (
                                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-green-700" />
                </div>
            ) : (
                <Card className="border-0 shadow-lg">
                    <CardHeader className="pb-0">
                        <CardTitle className="text-lg">Funcionários ({filteredUsers.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Funcionário</TableHead>
                                    <TableHead>Cargo / Loja</TableHead>
                                    <TableHead>Matrícula</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Último Login</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredUsers.map((user) => {
                                    const cargoConfig = getCargoConfig(user.cargo);
                                    return (
                                        <TableRow key={user.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="w-10 h-10 rounded-full flex items-center justify-center font-semibold"
                                                        style={{
                                                            backgroundColor: cargoConfig?.bgColor || '#f3f4f6',
                                                            color: cargoConfig?.color || '#6b7280'
                                                        }}
                                                    >
                                                        {user.full_name?.charAt(0).toUpperCase() || 'U'}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-sm">{user.full_name || 'Sem nome'}</p>
                                                        <p className="text-xs text-gray-500">{user.email}</p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="space-y-1">
                                                    {cargoConfig ? (
                                                        <Badge
                                                            style={{
                                                                backgroundColor: `${cargoConfig.color}15`,
                                                                color: cargoConfig.color,
                                                                border: `1px solid ${cargoConfig.color}40`
                                                            }}
                                                        >
                                                            {createElement(cargoConfig.icon, { className: "w-3 h-3 mr-1" })}
                                                            {cargoConfig.label}
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline">{user.cargo || 'N/A'}</Badge>
                                                    )}
                                                    {user.loja && (
                                                        <div className="flex items-center gap-1 text-xs text-gray-500">
                                                            <Store className="w-3 h-3" />
                                                            {user.loja}
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {user.matricula ? (
                                                    <code className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">
                                                        {user.matricula}
                                                    </code>
                                                ) : (
                                                    <span className="text-gray-400 text-sm">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell>{getStatusBadge(user)}</TableCell>
                                            <TableCell>
                                                {user.ultimo_login ? (
                                                    <span className="text-xs text-gray-600">
                                                        {new Date(user.ultimo_login).toLocaleDateString('pt-BR', {
                                                            day: '2-digit',
                                                            month: '2-digit',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 text-xs">Nunca</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex justify-end gap-1">
                                                    {!user.matricula ? (
                                                        <Button
                                                            size="sm"
                                                            className="h-8 bg-green-600 hover:bg-green-700"
                                                            onClick={() => handleOpenModal(user, 'create')}
                                                        >
                                                            <KeyRound className="w-4 h-4 mr-1" />
                                                            Ativar Acesso
                                                        </Button>
                                                    ) : (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-8"
                                                                onClick={() => handleOpenModal(user, 'reset')}
                                                                title="Resetar Senha"
                                                            >
                                                                <RotateCcw className="w-4 h-4" />
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant={user.ativo === false ? "default" : "destructive"}
                                                                className={`h-8 ${user.ativo === false ? 'bg-green-600 hover:bg-green-700' : ''}`}
                                                                onClick={() => handleOpenModal(user, 'toggle')}
                                                                title={user.ativo === false ? "Ativar" : "Desativar"}
                                                            >
                                                                {user.ativo === false ? (
                                                                    <UserCheck className="w-4 h-4" />
                                                                ) : (
                                                                    <UserX className="w-4 h-4" />
                                                                )}
                                                            </Button>
                                                        </>
                                                    )}
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-8"
                                                        onClick={() => handleOpenModal(user, 'edit')}
                                                        title="Editar"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                    {currentUser?.cargo === 'Administrador' && user.id !== currentUser?.id && (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                            onClick={() => handleDeleteUser(user)}
                                                            title="Remover"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                        {filteredUsers.length === 0 && (
                            <div className="text-center py-12 text-gray-500">
                                <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>Nenhum funcionário encontrado</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Modal: Ativar Acesso */}
            <Dialog open={modalType === 'create'} onOpenChange={() => !generatedPassword && handleCloseModal()}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <KeyRound className="w-5 h-5 text-green-600" />
                            Ativar Acesso ao Sistema
                        </DialogTitle>
                        <DialogDescription>
                            Criar credenciais para {selectedUser?.full_name}
                        </DialogDescription>
                    </DialogHeader>

                    {!generatedPassword ? (
                        <>
                            <div className="py-4 space-y-4">
                                <Alert className="bg-blue-50 border-blue-200">
                                    <AlertCircle className="w-4 h-4 text-blue-600" />
                                    <AlertDescription className="text-blue-800">
                                        Será gerada uma <strong>matrícula única</strong> e uma <strong>senha temporária</strong>.
                                        O funcionário deverá trocar a senha no primeiro acesso.
                                    </AlertDescription>
                                </Alert>

                                <div className="p-4 bg-gray-50 rounded-lg">
                                    <p className="text-sm text-gray-600">Funcionário:</p>
                                    <p className="font-semibold">{selectedUser?.full_name}</p>
                                    <p className="text-sm text-gray-500">{selectedUser?.cargo} {selectedUser?.loja ? `- ${selectedUser.loja}` : ''}</p>
                                </div>
                            </div>

                            <DialogFooter>
                                <Button variant="outline" onClick={handleCloseModal}>Cancelar</Button>
                                <Button
                                    onClick={() => createCredentialsMutation.mutate(selectedUser?.id)}
                                    disabled={createCredentialsMutation.isPending}
                                    className="bg-green-600 hover:bg-green-700"
                                >
                                    {createCredentialsMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    Ativar Acesso
                                </Button>
                            </DialogFooter>
                        </>
                    ) : (
                        <>
                            <div className="py-4 space-y-4">
                                <Alert className="bg-green-50 border-green-200">
                                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                                    <AlertDescription className="text-green-800">
                                        Acesso ativado com sucesso! Anote os dados abaixo:
                                    </AlertDescription>
                                </Alert>

                                <div className="space-y-3">
                                    <div className="p-3 bg-gray-50 rounded-lg">
                                        <p className="text-xs text-gray-500 mb-1">Matrícula</p>
                                        <div className="flex items-center justify-between">
                                            <code className="text-lg font-mono font-bold">{generatedMatricula}</code>
                                            <Button size="sm" variant="ghost" onClick={() => copyToClipboard(generatedMatricula, 'Matrícula')}>
                                                <Copy className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="p-3 bg-gray-50 rounded-lg">
                                        <p className="text-xs text-gray-500 mb-1">Senha Temporária</p>
                                        <div className="flex items-center justify-between">
                                            <code className="text-lg font-mono font-bold">
                                                {showPassword ? generatedPassword : '••••••••'}
                                            </code>
                                            <div className="flex gap-1">
                                                <Button size="sm" variant="ghost" onClick={() => setShowPassword(!showPassword)}>
                                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </Button>
                                                <Button size="sm" variant="ghost" onClick={() => copyToClipboard(generatedPassword, 'Senha')}>
                                                    <Copy className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <Alert className="bg-yellow-50 border-yellow-200">
                                    <AlertCircle className="w-4 h-4 text-yellow-600" />
                                    <AlertDescription className="text-yellow-800 text-sm">
                                        <strong>Importante:</strong> Anote esses dados! A senha não poderá ser visualizada novamente.
                                    </AlertDescription>
                                </Alert>
                            </div>

                            <DialogFooter>
                                <Button onClick={handleCloseModal} className="bg-green-600 hover:bg-green-700">Fechar</Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Modal: Resetar Senha */}
            <Dialog open={modalType === 'reset'} onOpenChange={() => !generatedPassword && handleCloseModal()}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <RotateCcw className="w-5 h-5 text-orange-600" />
                            Resetar Senha
                        </DialogTitle>
                        <DialogDescription>
                            Resetar senha de {selectedUser?.full_name}
                        </DialogDescription>
                    </DialogHeader>

                    {!generatedPassword ? (
                        <>
                            <div className="py-4 space-y-4">
                                <Alert className="bg-orange-50 border-orange-200">
                                    <AlertCircle className="w-4 h-4 text-orange-600" />
                                    <AlertDescription className="text-orange-800">
                                        Será gerada uma nova <strong>senha temporária</strong>.
                                        Se o funcionário tiver telefone cadastrado, a nova senha será enviada via WhatsApp.
                                    </AlertDescription>
                                </Alert>

                                <div className="p-4 bg-gray-50 rounded-lg">
                                    <p className="text-sm text-gray-600">Funcionário:</p>
                                    <p className="font-semibold">{selectedUser?.full_name}</p>
                                    <p className="text-sm text-gray-500">Matrícula: {selectedUser?.matricula}</p>
                                </div>
                            </div>

                            <DialogFooter>
                                <Button variant="outline" onClick={handleCloseModal}>Cancelar</Button>
                                <Button
                                    onClick={() => resetPasswordMutation.mutate(selectedUser?.id)}
                                    disabled={resetPasswordMutation.isPending}
                                    className="bg-orange-600 hover:bg-orange-700"
                                >
                                    {resetPasswordMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    Resetar Senha
                                </Button>
                            </DialogFooter>
                        </>
                    ) : (
                        <>
                            <div className="py-4 space-y-4">
                                <Alert className="bg-green-50 border-green-200">
                                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                                    <AlertDescription className="text-green-800">Senha resetada com sucesso!</AlertDescription>
                                </Alert>

                                <div className="space-y-3">
                                    <div className="p-3 bg-gray-50 rounded-lg">
                                        <p className="text-xs text-gray-500 mb-1">Matrícula</p>
                                        <code className="text-lg font-mono font-bold">{generatedMatricula}</code>
                                    </div>

                                    <div className="p-3 bg-gray-50 rounded-lg">
                                        <p className="text-xs text-gray-500 mb-1">Nova Senha Temporária</p>
                                        <div className="flex items-center justify-between">
                                            <code className="text-lg font-mono font-bold">
                                                {showPassword ? generatedPassword : '••••••••'}
                                            </code>
                                            <div className="flex gap-1">
                                                <Button size="sm" variant="ghost" onClick={() => setShowPassword(!showPassword)}>
                                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </Button>
                                                <Button size="sm" variant="ghost" onClick={() => copyToClipboard(generatedPassword, 'Senha')}>
                                                    <Copy className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <DialogFooter>
                                <Button onClick={handleCloseModal} className="bg-green-600 hover:bg-green-700">Fechar</Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Modal: Ativar/Desativar */}
            <Dialog open={modalType === 'toggle'} onOpenChange={handleCloseModal}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {selectedUser?.ativo === false ? (
                                <><UserCheck className="w-5 h-5 text-green-600" /> Ativar Conta</>
                            ) : (
                                <><UserX className="w-5 h-5 text-red-600" /> Desativar Conta</>
                            )}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="py-4 space-y-4">
                        {selectedUser?.ativo === false ? (
                            <Alert className="bg-green-50 border-green-200">
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                                <AlertDescription className="text-green-800">
                                    Ao ativar, o funcionário poderá fazer login novamente.
                                </AlertDescription>
                            </Alert>
                        ) : (
                            <Alert className="bg-red-50 border-red-200">
                                <AlertCircle className="w-4 h-4 text-red-600" />
                                <AlertDescription className="text-red-800">
                                    Ao desativar, o funcionário <strong>não poderá mais fazer login</strong>.
                                </AlertDescription>
                            </Alert>
                        )}

                        <div className="p-4 bg-gray-50 rounded-lg">
                            <p className="font-semibold">{selectedUser?.full_name}</p>
                            <p className="text-sm text-gray-500">Matrícula: {selectedUser?.matricula}</p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={handleCloseModal}>Cancelar</Button>
                        <Button
                            onClick={() => toggleAccountMutation.mutate({ userId: selectedUser?.id, ativo: selectedUser?.ativo === false })}
                            disabled={toggleAccountMutation.isPending}
                            className={selectedUser?.ativo === false ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
                        >
                            {toggleAccountMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {selectedUser?.ativo === false ? 'Ativar' : 'Desativar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal: Editar Funcionário */}
            <Dialog open={modalType === 'edit'} onOpenChange={handleCloseModal}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Edit className="w-5 h-5 text-blue-600" />
                            Editar Funcionário
                        </DialogTitle>
                    </DialogHeader>

                    {editData && (
                        <div className="space-y-4 py-4">
                            <div>
                                <Label>Nome Completo</Label>
                                <Input
                                    value={editData.full_name}
                                    onChange={(e) => setEditData({ ...editData, full_name: e.target.value })}
                                />
                            </div>

                            <div>
                                <Label>E-mail</Label>
                                <Input value={selectedUser?.email || ''} disabled className="bg-gray-50" />
                            </div>

                            <div>
                                <Label>Cargo</Label>
                                <Select
                                    value={editData.cargo}
                                    onValueChange={(v) => setEditData({ ...editData, cargo: v })}
                                >
                                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                                    <SelectContent>
                                        {CARGOS.filter(c => c.value !== 'Pendente Definição').map(c => (
                                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {editCargoConfig?.requiresStore && (
                                <div>
                                    <Label>Loja</Label>
                                    <Select
                                        value={editData.loja}
                                        onValueChange={(v) => setEditData({ ...editData, loja: v })}
                                    >
                                        <SelectTrigger><SelectValue placeholder="Selecione a loja" /></SelectTrigger>
                                        <SelectContent>
                                            {LOJAS.map(l => (
                                                <SelectItem key={l} value={l}>{l}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            <div className="p-4 rounded-xl bg-blue-50 border-2 border-blue-200">
                                <div className="flex items-start gap-3">
                                    <Checkbox
                                        checked={editData.is_vendedor}
                                        onCheckedChange={(v) => setEditData({ ...editData, is_vendedor: v })}
                                    />
                                    <div>
                                        <Label className="cursor-pointer font-semibold text-blue-700">Atua como Vendedor</Label>
                                        <p className="text-xs text-gray-500 mt-1">Incluído no cálculo de comissões</p>
                                    </div>
                                </div>
                                {editData.is_vendedor && (
                                    <div className="mt-3">
                                        <Label>Meta Mensal (R$)</Label>
                                        <Input
                                            type="number"
                                            value={editData.meta_mensal}
                                            onChange={(e) => setEditData({ ...editData, meta_mensal: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>
                                )}
                            </div>

                            {editCargoConfig && (
                                <Alert style={{ backgroundColor: editCargoConfig.bgColor }}>
                                    <Shield className="h-4 w-4" style={{ color: editCargoConfig.color }} />
                                    <AlertDescription>
                                        <strong>Permissões do Cargo: </strong>
                                        {editCargoConfig.permissions.join(', ')}
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={handleCloseModal}>Cancelar</Button>
                        <Button
                            onClick={handleSaveEdit}
                            disabled={updateUserMutation.isPending}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {updateUserMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Salvar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
