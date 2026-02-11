import React, { useState, useEffect } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff, Lock, IdCard, Loader2 } from "lucide-react";
import { supabase } from "@/api/base44Client";



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



    const redirectByRole = (cargo) => {
        // Verificar parametro de redirecionamento na URL
        const params = new URLSearchParams(window.location.search);
        const redirect = params.get('redirect');
        if (redirect) {
            window.location.href = redirect;
            return;
        }

        if (!cargo) {
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
        } else if (cargo === 'Montador') {
            window.location.href = '/admin/Montagem';
        } else {
            window.location.href = '/admin';
        }
    };

    // Verificação de sessão removida para evitar loop de redirecionamento.
    // O controle de redirecionamento se já estiver logado é feito no App.jsx (PagesContent) usando o hook useAuth.

    // [FIX] Mas se o usuário JÁ estiver logado e cair aqui (porque o App.jsx permitiu por ser primeiro acesso),
    // precisamos ativar o modo de troca de senha imediatamente.
    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                // Verificar perfil
                const { data: profile } = await supabase.from('public_users').select('*').eq('id', session.user.id).single();
                if (profile?.primeiro_acesso) {
                    console.log("Sessão ativa detectada com primeiro_acesso=true. Ativando wizard.");
                    setPrimeiroAcesso(true);
                    setTokenTemp(session.access_token);
                }
            }
        };
        checkSession();
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            // Login via Supabase - busca por matrícula no banco
            const { data: userProfile, error: profileError } = await supabase
                .from('public_users')
                .select('*')
                .eq('matricula', matricula.toUpperCase())
                .eq('ativo', true)
                .single();

            if (profileError || !userProfile) {
                throw new Error("Matrícula não encontrada ou usuário inativo.");
            }

            // Verificar senha (usando Supabase Auth com o email do usuário)
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: userProfile.email,
                password: senha
            });

            if (authError) {
                throw new Error("Senha incorreta.");
            }

            // [FIX] Buscar perfil novamente, agora AUTENTICADO, para garantir que estamos vendo o status real de 'primeiro_acesso'
            // A leitura anterior era anônima e poderia estar sofrendo cache ou restrição de RLS
            const { data: freshProfile, error: freshError } = await supabase
                .from('public_users')
                .select('*')
                .eq('id', authData.session.user.id)
                .single();

            if (freshProfile) {
                // Perfil carregado com sucesso
            }

            const profileToUse = freshProfile || userProfile;

            // Verificar primeiro acesso
            if (profileToUse && profileToUse.primeiro_acesso) { // Check for existance too
                setPrimeiroAcesso(true);
                // Para troca de senha, precisamos do token da sessão
                setTokenTemp(authData.session?.access_token || '');
                setError("");
                return;
            }


            // [FEATURE] Atualizar último login
            if (profileToUse && profileToUse.id) {
                supabase.from('public_users')
                    .update({ ultimo_login: new Date().toISOString() })
                    .eq('id', profileToUse.id)
                    .then(({ error }) => {
                        if (error) console.error("Erro ao atualizar ultimo_login:", error);
                    });
            }

            // Salvar dados do usuário no localStorage para compatibilidade
            localStorage.setItem('employee_user', JSON.stringify(userProfile));

            // Redirecionar por cargo
            redirectByRole(userProfile.cargo);

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
            // Atualizar senha via Supabase Auth (usuário já está logado via tokenTemp/session)
            const { error: updateError } = await supabase.auth.updateUser({
                password: novaSenha
            });

            if (updateError) {
                throw new Error(updateError.message);
            }

            // Marcar primeiro_acesso como false no banco
            const { data: sessionData } = await supabase.auth.getSession();
            if (sessionData?.session?.user?.id) {
                await supabase
                    .from('public_users')
                    .update({ primeiro_acesso: false })
                    .eq('id', sessionData.session.user.id);
            }

            // Buscar perfil do usuário
            const { data: userProfile } = await supabase
                .from('public_users')
                .select('*')
                .eq('matricula', matricula.toUpperCase())
                .single();

            if (userProfile) {
                localStorage.setItem('employee_user', JSON.stringify(userProfile));
            }

            alert("Senha alterada com sucesso! Você será redirecionado.");
            redirectByRole(userProfile?.cargo);

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
