import React, { useState, useEffect } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff, Lock, IdCard, Loader2 } from "lucide-react";
import { supabase } from "@/api/base44Client";

// API URL baseada no ambiente
const API_URL = import.meta.env.VITE_ZAP_API_URL || '';

export default function LoginFuncionario() {
    const { brandName, brandLogo } = useTenant();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    // Estados do formulário
    const [matricula, setMatricula] = useState("");
    const [senha, setSenha] = useState("");

    // Estado de primeiro acesso
    const [primeiroAcesso, setPrimeiroAcesso] = useState(false);
    const [tokenTemp, setTokenTemp] = useState("");
    const [novaSenha, setNovaSenha] = useState("");
    const [confirmarSenha, setConfirmarSenha] = useState("");

    const VALID_CARGOS = ['Administrador', 'Gerente', 'Vendedor', 'Estoque', 'Financeiro', 'RH', 'Entregador', 'Montador Externo'];

    const redirectByRole = (cargo) => {
        if (!cargo || !VALID_CARGOS.includes(cargo)) {
            console.error('Cargo inválido ou pendente:', cargo);
            alert('Seu usuário está com cargo pendente ou inválido. Contate o administrador.');
            setError('Seu usuário está com cargo pendente. Contate o administrador.');
            // Limpar dados para permitir novo login
            localStorage.removeItem('employee_token');
            localStorage.removeItem('employee_user');
            return;
        }

        if (cargo === 'Montador Externo') {
            window.location.href = '/admin/MontadorExterno';
        } else if (cargo === 'Entregador') {
            window.location.href = '/admin/Entregador';
        } else {
            window.location.href = '/admin';
        }
    };

    // Verificar se já está logado
    useEffect(() => {
        const token = localStorage.getItem('employee_token');
        const user = localStorage.getItem('employee_user');

        if (token && user) {
            try {
                const userData = JSON.parse(user);
                // Validar cargo antes de redirecionar para evitar loop
                if (VALID_CARGOS.includes(userData.cargo)) {
                    redirectByRole(userData.cargo);
                } else {
                    console.warn('Usuário logado com cargo inválido:', userData.cargo);
                    localStorage.removeItem('employee_token');
                    localStorage.removeItem('employee_user');
                }
            } catch (e) {
                localStorage.removeItem('employee_token');
                localStorage.removeItem('employee_user');
            }
        }
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        // Garantir que não existe sessão do Supabase ativa para evitar conflitos
        await supabase.auth.signOut();

        try {
            const response = await fetch(`${API_URL}/api/auth/employee/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ matricula, senha })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erro ao fazer login');
            }

            // Verificar primeiro acesso
            if (data.primeiro_acesso) {
                setPrimeiroAcesso(true);
                setTokenTemp(data.token_temp);
                setError("");
                return;
            }

            // Salvar token e dados do usuário
            localStorage.setItem('employee_token', data.token);
            localStorage.setItem('employee_user', JSON.stringify(data.user));

            // Redirecionar por cargo
            redirectByRole(data.user.cargo);

        } catch (err) {
            console.error("Erro no login:", err);
            setError(err.message || "Erro ao fazer login");
        } finally {
            setLoading(false);
        }
    };

    const handleTrocarSenha = async (e) => {
        e.preventDefault();

        if (novaSenha !== confirmarSenha) {
            setError("As senhas não coincidem");
            return;
        }

        // Validar complexidade da senha
        if (novaSenha.length < 6) {
            setError("A senha deve ter pelo menos 6 caracteres");
            return;
        }
        if (!/[A-Z]/.test(novaSenha)) {
            setError("A senha deve conter pelo menos uma letra maiúscula");
            return;
        }
        if (!/[0-9]/.test(novaSenha)) {
            setError("A senha deve conter pelo menos um número");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const response = await fetch(`${API_URL}/api/auth/employee/change-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token_temp: tokenTemp,
                    nova_senha: novaSenha
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erro ao trocar senha');
            }

            // Sucesso - fazer login automático com a nova senha
            console.log('✅ Senha alterada, fazendo login automático...');

            // Garantir que não existe sessão do Supabase ativa
            await supabase.auth.signOut();

            // Tentar login automático
            // Nota: Usamos a senha nova que o usuário acabou de digitar
            const loginResponse = await fetch(`${API_URL}/api/auth/employee/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ matricula, senha: novaSenha })
            });

            const loginData = await loginResponse.json();

            if (loginResponse.ok && loginData.token) {
                // Salvar token e dados do usuário
                localStorage.setItem('employee_token', loginData.token);
                localStorage.setItem('employee_user', JSON.stringify(loginData.user));

                // Redirecionar por cargo
                alert("Senha alterada com sucesso! Você será redirecionado.");
                redirectByRole(loginData.user.cargo);
            } else {
                // Se login automático falhar, volta pro fluxo normal
                console.warn("Login automático falhou, solicitando login manual.");
                setPrimeiroAcesso(false);
                setSenha("");
                setNovaSenha("");
                setConfirmarSenha("");
                setTokenTemp("");
                alert("Senha alterada com sucesso! Faça login com sua nova senha.");
            }

        } catch (err) {
            console.error("Erro ao trocar senha:", err);
            alert(`Erro ao trocar senha: ${err.message || "Erro desconhecido"}`);
            setError(err.message || "Erro ao trocar senha");
        } finally {
            setLoading(false);
        }
    };

    // Formulário de troca de senha (primeiro acesso)
    if (primeiroAcesso) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-4">
                <Card className="w-full max-w-md shadow-xl">
                    <CardHeader className="text-center">
                        <div className="flex justify-center mb-4">
                            <img
                                src={brandLogo}
                                alt={brandName}
                                className="w-16 h-16 object-contain"
                            />
                        </div>
                        <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">
                            Primeiro Acesso
                        </CardTitle>
                        <CardDescription className="text-gray-600 dark:text-gray-400">
                            Defina uma nova senha para continuar
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleTrocarSenha} className="space-y-4">
                            {error && (
                                <Alert variant="destructive">
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="novaSenha">Nova Senha</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                    <Input
                                        id="novaSenha"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Mín 6 chars, 1 maiúscula, 1 número"
                                        value={novaSenha}
                                        onChange={(e) => setNovaSenha(e.target.value)}
                                        className="pl-10 pr-10"
                                        required
                                        disabled={loading}
                                        minLength={6}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirmarSenha">Confirmar Senha</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                    <Input
                                        id="confirmarSenha"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Repita a senha"
                                        value={confirmarSenha}
                                        onChange={(e) => setConfirmarSenha(e.target.value)}
                                        className="pl-10"
                                        required
                                        disabled={loading}
                                    />
                                </div>
                            </div>

                            <Button
                                type="submit"
                                className="w-full bg-green-600 hover:bg-green-700 text-white"
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Salvando...
                                    </>
                                ) : (
                                    "Definir Nova Senha"
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Formulário de login normal
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-4">
            <Card className="w-full max-w-md shadow-xl">
                <CardHeader className="text-center">
                    <div className="flex justify-center mb-4">
                        <img
                            src={brandLogo}
                            alt={brandName}
                            className="w-16 h-16 object-contain"
                        />
                    </div>
                    <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">
                        {brandName}
                    </CardTitle>
                    <CardDescription className="text-gray-600 dark:text-gray-400">
                        Acesso para funcionários
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleLogin} className="space-y-4">
                        {error && (
                            <Alert variant="destructive">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="matricula">Matrícula</Label>
                            <div className="relative">
                                <IdCard className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <Input
                                    id="matricula"
                                    type="text"
                                    placeholder="MP-VE0001"
                                    value={matricula}
                                    onChange={(e) => setMatricula(e.target.value.toUpperCase())}
                                    className="pl-10 uppercase"
                                    required
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="senha">Senha</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <Input
                                    id="senha"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Digite sua senha"
                                    value={senha}
                                    onChange={(e) => setSenha(e.target.value)}
                                    className="pl-10 pr-10"
                                    required
                                    disabled={loading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                                    disabled={loading}
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="w-full bg-green-600 hover:bg-green-700 text-white"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Entrando...
                                </>
                            ) : (
                                "Entrar"
                            )}
                        </Button>
                    </form>

                    <div className="mt-6 text-center text-xs text-gray-400">
                        Por Natan R.
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
