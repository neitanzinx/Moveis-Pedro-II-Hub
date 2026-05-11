import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useOperatorAuth } from "@/hooks/useOperatorAuth";

export default function OperadorLogin() {
  const navigate = useNavigate();
  const { loading, hasSession, isOperator, signInWithPassword } = useOperatorAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!loading && isOperator) {
      navigate("/operador", { replace: true });
    }
  }, [loading, isOperator, navigate]);

  if (!loading && isOperator) {
    return <Navigate to="/operador" replace />;
  }

  if (!loading && hasSession && !isOperator) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-100 via-white to-slate-200">
        <Card className="w-full max-w-md border-slate-200 shadow-xl">
          <CardHeader className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <CardTitle className="text-2xl">Area exclusiva do operador SaaS</CardTitle>
            <CardDescription>
              Esta area nao faz parte do ambiente das lojas. Sua sessao atual nao tem permissao para acessar /operador.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Button type="button" className="w-full" onClick={() => navigate('/login', { replace: true })}>
              Voltar para o login do ERP
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setSubmitting(true);

    try {
      await signInWithPassword({ email, password });
      navigate("/operador", { replace: true });
    } catch (error) {
      setErrorMessage(error.message || "Falha no login do operador.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-100 via-white to-slate-200">
      <Card className="w-full max-w-md border-slate-200 shadow-xl">
        <CardHeader className="space-y-3">
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl">Painel Operador</CardTitle>
          <CardDescription>
            Acesso exclusivo para operação SaaS. Este login e separado do ambiente das lojas.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="operator-email">Email</Label>
              <Input
                id="operator-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="operador@empresa.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="operator-password">Senha</Label>
              <Input
                id="operator-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="********"
                required
              />
            </div>

            {errorMessage && (
              <div className="text-sm rounded-md border border-red-200 bg-red-50 text-red-700 p-3">
                {errorMessage}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Entrando...
                </>
              ) : (
                "Entrar"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
