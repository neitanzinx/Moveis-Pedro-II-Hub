import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";

export default function Login() {
  const { brandName, brandLogo } = useTenant();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Campos do formulario
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Verificar se ja esta logado
  useEffect(() => {
    base44.auth.me().then(user => {
      if (user) {
        redirectByRole(user.cargo);
      }
    }).catch(() => { });
  }, []);

  const redirectByRole = (userCargo) => {
    if (userCargo === 'Montador Externo') {
      window.location.href = '/montador-externo';
    } else if (userCargo === 'Entregador') {
      window.location.href = '/entregador';
    } else {
      window.location.reload();
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data, error } = await base44.auth.login(email, password);
      if (error) throw error;

      const user = await base44.auth.me();

      // Verificar se é funcionário (tem cargo válido)
      if (!user || !user.cargo) {
        setError("Acesso restrito a funcionários. Clientes devem usar a Área do Cliente.");
        await base44.auth.logout();
        setLoading(false);
        return;
      }

      redirectByRole(user.cargo);
    } catch (err) {
      console.error("Login error:", err);
      setError("Email ou senha incorretos. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

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
            Entre com suas credenciais para acessar
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
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
              {loading ? "Entrando..." : "Entrar"}
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