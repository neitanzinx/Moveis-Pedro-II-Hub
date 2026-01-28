import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    Search, KeyRound, UserCheck, UserX, RotateCcw, Shield,
    Clock, CheckCircle2, AlertCircle, Loader2, Copy, Eye, EyeOff,
    MessageCircle, Users
} from "lucide-react";
import { toast } from "sonner";
import { CARGOS, getCargoConfig } from "@/config/cargos";

const API_URL = import.meta.env.VITE_ZAP_API_URL || "http://localhost:3001";

export default function ConfiguracaoCredenciais() {
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");
    const [selectedUser, setSelectedUser] = useState(null);
    const [modalType, setModalType] = useState(null); // 'create' | 'reset' | 'toggle'
    const [showPassword, setShowPassword] = useState(false);
    const [generatedPassword, setGeneratedPassword] = useState(null);
    const [generatedMatricula, setGeneratedMatricula] = useState(null);

    const queryClient = useQueryClient();

    // Buscar usuários aprovados (funcionários)
    const { data: users = [], isLoading } = useQuery({
        queryKey: ['users-credentials'],
        queryFn: async () => {
            const allUsers = await base44.entities.User.list('-created_date');
            // Filtrar apenas usuários aprovados que são funcionários (não clientes)
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
            const response = await fetch(`${API_URL}/api/auth/employee/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
            queryClient.invalidateQueries({ queryKey: ['users-credentials'] });
            toast.success("Credenciais criadas com sucesso!");
        },
        onError: (error) => {
            toast.error(error.message);
            setModalType(null);
            setSelectedUser(null);
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
            queryClient.invalidateQueries({ queryKey: ['users-credentials'] });
            toast.success(data.whatsapp_enviado
                ? "Senha resetada e enviada via WhatsApp!"
                : "Senha resetada! (WhatsApp não disponível)");
        },
        onError: (error) => {
            toast.error(error.message);
            setModalType(null);
            setSelectedUser(null);
        }
    });

    // Mutation para ativar/desativar conta
    const toggleAccountMutation = useMutation({
        mutationFn: async ({ userId, ativo }) => {
            // Atualizar diretamente no Supabase
            await base44.entities.User.update(userId, { ativo });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users-credentials'] });
            toast.success(selectedUser?.ativo ? "Conta desativada!" : "Conta ativada!");
            setModalType(null);
            setSelectedUser(null);
        },
        onError: (error) => {
            toast.error("Erro ao alterar status: " + error.message);
        }
    });

    // Filtrar usuários
    const filteredUsers = users.filter(user => {
        const matchesSearch =
            user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.matricula?.toLowerCase().includes(searchTerm.toLowerCase());

        let matchesStatus = true;
        if (filterStatus === 'with') matchesStatus = !!user.matricula;
        if (filterStatus === 'without') matchesStatus = !user.matricula;
        if (filterStatus === 'active') matchesStatus = user.matricula && user.ativo !== false;
        if (filterStatus === 'inactive') matchesStatus = user.matricula && user.ativo === false;

        return matchesSearch && matchesStatus;
    });

    // Estatísticas
    const stats = {
        total: users.length,
        withCredentials: users.filter(u => u.matricula).length,
        active: users.filter(u => u.matricula && u.ativo !== false).length,
        pendingFirstAccess: users.filter(u => u.matricula && u.primeiro_acesso).length
    };

    const handleOpenModal = (user, type) => {
        setSelectedUser(user);
        setModalType(type);
        setGeneratedPassword(null);
        setGeneratedMatricula(null);
        setShowPassword(false);
    };

    const handleCloseModal = () => {
        setModalType(null);
        setSelectedUser(null);
        setGeneratedPassword(null);
        setGeneratedMatricula(null);
        setShowPassword(false);
    };

    const handleCreateCredentials = () => {
        if (selectedUser) {
            createCredentialsMutation.mutate(selectedUser.id);
        }
    };

    const handleResetPassword = () => {
        if (selectedUser) {
            resetPasswordMutation.mutate(selectedUser.id);
        }
    };

    const handleToggleAccount = () => {
        if (selectedUser) {
            toggleAccountMutation.mutate({
                userId: selectedUser.id,
                ativo: !selectedUser.ativo
            });
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
                    Sem Credencial
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
                    Primeiro Acesso
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

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-green-600" />
                    Credenciais de Acesso
                </h2>
                <p className="text-gray-500 text-sm mt-1">
                    Gerencie as matrículas e senhas de acesso dos funcionários ao sistema
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
                                <p className="text-sm text-gray-500">Com Credencial</p>
                                <p className="text-2xl font-bold text-blue-600">{stats.withCredentials}</p>
                            </div>
                            <KeyRound className="w-8 h-8 text-blue-100" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-sm">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Ativos</p>
                                <p className="text-2xl font-bold text-green-600">{stats.active}</p>
                            </div>
                            <UserCheck className="w-8 h-8 text-green-100" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-sm">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Primeiro Acesso</p>
                                <p className="text-2xl font-bold text-yellow-600">{stats.pendingFirstAccess}</p>
                            </div>
                            <Clock className="w-8 h-8 text-yellow-100" />
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
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="px-3 py-2 border rounded-md text-sm"
                        >
                            <option value="all">Todos</option>
                            <option value="with">Com Credencial</option>
                            <option value="without">Sem Credencial</option>
                            <option value="active">Ativos</option>
                            <option value="inactive">Desativados</option>
                        </select>
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
                                    <TableHead>Cargo</TableHead>
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
                                                {cargoConfig ? (
                                                    <Badge
                                                        style={{
                                                            backgroundColor: `${cargoConfig.color}15`,
                                                            color: cargoConfig.color,
                                                            border: `1px solid ${cargoConfig.color}40`
                                                        }}
                                                    >
                                                        {cargoConfig.label}
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline">{user.cargo || 'N/A'}</Badge>
                                                )}
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
                                                    <span className="text-sm text-gray-600">
                                                        {new Date(user.ultimo_login).toLocaleDateString('pt-BR', {
                                                            day: '2-digit',
                                                            month: '2-digit',
                                                            year: '2-digit',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 text-sm">Nunca</span>
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
                                                            >
                                                                <RotateCcw className="w-4 h-4" />
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant={user.ativo === false ? "default" : "destructive"}
                                                                className={`h-8 ${user.ativo === false ? 'bg-green-600 hover:bg-green-700' : ''}`}
                                                                onClick={() => handleOpenModal(user, 'toggle')}
                                                            >
                                                                {user.ativo === false ? (
                                                                    <UserCheck className="w-4 h-4" />
                                                                ) : (
                                                                    <UserX className="w-4 h-4" />
                                                                )}
                                                            </Button>
                                                        </>
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

            {/* Modal: Criar Credenciais */}
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
                                    <p className="text-sm text-gray-500">{selectedUser?.cargo} - {selectedUser?.loja || 'Sem loja'}</p>
                                </div>
                            </div>

                            <DialogFooter>
                                <Button variant="outline" onClick={handleCloseModal}>Cancelar</Button>
                                <Button
                                    onClick={handleCreateCredentials}
                                    disabled={createCredentialsMutation.isPending}
                                    className="bg-green-600 hover:bg-green-700"
                                >
                                    {createCredentialsMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    Criar Credenciais
                                </Button>
                            </DialogFooter>
                        </>
                    ) : (
                        <>
                            <div className="py-4 space-y-4">
                                <Alert className="bg-green-50 border-green-200">
                                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                                    <AlertDescription className="text-green-800">
                                        Credenciais criadas com sucesso! Anote os dados abaixo:
                                    </AlertDescription>
                                </Alert>

                                <div className="space-y-3">
                                    <div className="p-3 bg-gray-50 rounded-lg">
                                        <p className="text-xs text-gray-500 mb-1">Matrícula</p>
                                        <div className="flex items-center justify-between">
                                            <code className="text-lg font-mono font-bold">{generatedMatricula}</code>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => copyToClipboard(generatedMatricula, 'Matrícula')}
                                            >
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
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                >
                                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => copyToClipboard(generatedPassword, 'Senha')}
                                                >
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
                                <Button onClick={handleCloseModal} className="bg-green-600 hover:bg-green-700">
                                    Fechar
                                </Button>
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
                                        Se o funcionário tiver telefone cadastrado e o WhatsApp estiver conectado,
                                        a nova senha será enviada automaticamente.
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
                                    onClick={handleResetPassword}
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
                                    <AlertDescription className="text-green-800">
                                        Senha resetada com sucesso!
                                    </AlertDescription>
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
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                >
                                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => copyToClipboard(generatedPassword, 'Senha')}
                                                >
                                                    <Copy className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <DialogFooter>
                                <Button onClick={handleCloseModal} className="bg-green-600 hover:bg-green-700">
                                    Fechar
                                </Button>
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
                                <>
                                    <UserCheck className="w-5 h-5 text-green-600" />
                                    Ativar Conta
                                </>
                            ) : (
                                <>
                                    <UserX className="w-5 h-5 text-red-600" />
                                    Desativar Conta
                                </>
                            )}
                        </DialogTitle>
                        <DialogDescription>
                            {selectedUser?.ativo === false
                                ? `Reativar o acesso de ${selectedUser?.full_name}?`
                                : `Desativar o acesso de ${selectedUser?.full_name}?`
                            }
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-4">
                        {selectedUser?.ativo === false ? (
                            <Alert className="bg-green-50 border-green-200">
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                                <AlertDescription className="text-green-800">
                                    Ao ativar, o funcionário poderá fazer login novamente com sua matrícula.
                                </AlertDescription>
                            </Alert>
                        ) : (
                            <Alert className="bg-red-50 border-red-200">
                                <AlertCircle className="w-4 h-4 text-red-600" />
                                <AlertDescription className="text-red-800">
                                    Ao desativar, o funcionário <strong>não poderá mais fazer login</strong>.
                                    A matrícula e senha serão mantidas para possível reativação futura.
                                </AlertDescription>
                            </Alert>
                        )}

                        <div className="p-4 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-600">Funcionário:</p>
                            <p className="font-semibold">{selectedUser?.full_name}</p>
                            <p className="text-sm text-gray-500">Matrícula: {selectedUser?.matricula}</p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={handleCloseModal}>Cancelar</Button>
                        <Button
                            onClick={handleToggleAccount}
                            disabled={toggleAccountMutation.isPending}
                            className={selectedUser?.ativo === false
                                ? "bg-green-600 hover:bg-green-700"
                                : "bg-red-600 hover:bg-red-700"
                            }
                        >
                            {toggleAccountMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {selectedUser?.ativo === false ? 'Ativar' : 'Desativar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
