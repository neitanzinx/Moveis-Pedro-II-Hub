import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useTenant } from "@/contexts/TenantContext";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle, Mail, User, Shield, XCircle } from "lucide-react";

export default function BoasVindas() {
  const { brandName, brandLogo } = useTenant();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  const handleLogout = () => {
    base44.auth.logout();
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#07593f' }} />
      </div>
    );
  }

  // Se foi rejeitado
  if (user.status_aprovacao === 'Rejeitado') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)' }}>
        <Card className="w-full max-w-2xl border-0 shadow-2xl">
          <CardHeader className="text-center pb-6" style={{ background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)' }}>
            <div className="mx-auto mb-4 bg-white rounded-2xl p-4 inline-block">
              {brandLogo ? (
                <img
                  src={brandLogo}
                  alt={brandName}
                  style={{ width: '100px', height: 'auto', objectFit: 'contain' }}
                />
              ) : null}
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Cadastro Não Aprovado
            </h1>
            <p className="text-white/90 text-lg">
              {brandName} - Sistema de Gestão
            </p>
          </CardHeader>

          <CardContent className="p-8 space-y-6">
            <div className="text-center mb-6">
              <div
                className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center"
                style={{ backgroundColor: '#fee2e2' }}
              >
                <XCircle className="w-10 h-10 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2 text-red-600">
                Acesso Negado
              </h2>
              <p className="text-lg" style={{ color: '#8B8B8B' }}>
                Infelizmente seu cadastro não foi aprovado
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 rounded-lg" style={{ backgroundColor: '#fee2e2' }}>
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: '#dc2626' }}
                >
                  <User className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1 text-red-700">
                    Seus Dados
                  </h3>
                  <p className="text-sm" style={{ color: '#8B8B8B' }}>
                    <strong>Nome:</strong> {user.full_name}
                  </p>
                  <p className="text-sm" style={{ color: '#8B8B8B' }}>
                    <strong>E-mail:</strong> {user.email}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-lg" style={{ backgroundColor: '#f0f9ff' }}>
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: '#07593f' }}
                >
                  <Mail className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1" style={{ color: '#07593f' }}>
                    Precisa de Ajuda?
                  </h3>
                  <p className="text-sm mb-2" style={{ color: '#8B8B8B' }}>
                    Entre em contato conosco para mais informações sobre o motivo da recusa
                  </p>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4" style={{ color: '#07593f' }} />
                    <span style={{ color: '#07593f' }}>contato@moveispedro2.com.br</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t" style={{ borderColor: '#E5E0D8' }}>
              <Button
                onClick={handleLogout}
                variant="outline"
                className="w-full"
              >
                Sair do Sistema
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Se está pendente (padrão)
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)' }}>
      <Card className="w-full max-w-2xl border-0 shadow-2xl">
        <CardHeader className="text-center pb-6" style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}>
          <div className="mx-auto mb-4 bg-white rounded-2xl p-4 inline-block">
            {brandLogo ? (
              <img
                src={brandLogo}
                alt={brandName}
                style={{ width: '100px', height: 'auto', objectFit: 'contain' }}
              />
            ) : null}
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Bem-vindo ao Sistema!
          </h1>
          <p className="text-white/90 text-lg">
            {brandName} - Sistema de Gestão
          </p>
        </CardHeader>

        <CardContent className="p-8 space-y-6">
          <div className="text-center mb-6">
            <div
              className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center"
              style={{ backgroundColor: '#FEF3C7' }}
            >
              <Clock className="w-10 h-10" style={{ color: '#f38a4c' }} />
            </div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: '#07593f' }}>
              Cadastro Realizado com Sucesso! 🎉
            </h2>
            <p className="text-lg" style={{ color: '#8B8B8B' }}>
              Seu acesso está em análise
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 rounded-lg" style={{ backgroundColor: '#f0f9ff' }}>
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: '#07593f' }}
              >
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1" style={{ color: '#07593f' }}>
                  Seus Dados
                </h3>
                <p className="text-sm" style={{ color: '#8B8B8B' }}>
                  <strong>Nome:</strong> {user.full_name}
                </p>
                <p className="text-sm" style={{ color: '#8B8B8B' }}>
                  <strong>E-mail:</strong> {user.email}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-lg" style={{ backgroundColor: '#FEF3C7' }}>
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: '#f38a4c' }}
              >
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1" style={{ color: '#f38a4c' }}>
                  Aguardando Aprovação
                </h3>
                <p className="text-sm" style={{ color: '#8B8B8B' }}>
                  Seu cadastro foi recebido e está sendo analisado por um administrador.
                  Você receberá um e-mail assim que seu acesso for aprovado.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-lg" style={{ backgroundColor: '#D1FAE5' }}>
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: '#07593f' }}
              >
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1" style={{ color: '#07593f' }}>
                  Próximos Passos
                </h3>
                <ul className="text-sm space-y-1" style={{ color: '#8B8B8B' }}>
                  <li>✅ Aguarde a aprovação do administrador</li>
                  <li>✅ Verifique seu e-mail regularmente</li>
                  <li>✅ Após aprovação, faça login novamente</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t" style={{ borderColor: '#E5E0D8' }}>
            <div className="text-center mb-4">
              <p className="text-sm mb-2" style={{ color: '#8B8B8B' }}>
                Precisa de ajuda? Entre em contato com um administrador
              </p>
              <div className="flex items-center justify-center gap-2 text-sm">
                <Mail className="w-4 h-4" style={{ color: '#07593f' }} />
                <span style={{ color: '#07593f' }}>contato@moveispedro2.com.br</span>
              </div>
            </div>

            <Button
              onClick={handleLogout}
              variant="outline"
              className="w-full"
            >
              Sair do Sistema
            </Button>
          </div>

          <div className="text-center pt-4">
            <p className="text-xs" style={{ color: '#8B8B8B' }}>
              Normalmente, aprovações são realizadas em até 24 horas úteis
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}