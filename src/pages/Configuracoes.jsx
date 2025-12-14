import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Percent, Plug, Users, Truck, Image } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import ConfiguracaoComissoes from "../components/configuracoes/ConfiguracaoComissoes";
import ConfiguracaoFrota from "../components/configuracoes/ConfiguracaoFrota";
import ConfiguracaoLogo from "../components/configuracoes/ConfiguracaoLogo";
import GerenciamentoUsuariosTab from "../components/users/UserManagementTab";
import AuditLogPage from "./AuditLog";
import { useQuery } from "@tanstack/react-query";

export default function Configuracoes() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    let mounted = true;
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        if (mounted) setUser(currentUser);
      } catch (error) {
        console.error("Erro ao carregar usuário:", error);
      }
    };
    loadUser();
    return () => { mounted = false; };
  }, []);

  const { data: users, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list('-created_date'),
    initialData: [],
    enabled: !!user && user.cargo === 'Administrador',
  });

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#07593f' }} />
      </div>
    );
  }

  const isAdmin = user.cargo === 'Administrador';

  if (!isAdmin) {
    return (
      <div className="p-8">
        <Alert className="border-2 border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-600">
            <strong>Acesso Restrito</strong><br />
            Apenas administradores podem acessar as configurações do sistema.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2" style={{ color: '#07593f' }}>
            Configurações do Sistema
          </h1>
          <p style={{ color: '#8B8B8B' }}>
            Gerencie comissões, integrações e usuários do sistema
          </p>
        </div>

        <Tabs defaultValue="comissoes" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6 h-auto">
            <TabsTrigger value="comissoes" className="flex items-center gap-2 py-3">
              <Percent className="w-4 h-4" />
              <span className="hidden sm:inline">Comissões</span>
            </TabsTrigger>
            <TabsTrigger value="frota" className="flex items-center gap-2 py-3">
              <Truck className="w-4 h-4" />
              <span className="hidden sm:inline">Frota</span>
            </TabsTrigger>
            <TabsTrigger value="logo" className="flex items-center gap-2 py-3">
              <Image className="w-4 h-4" />
              <span className="hidden sm:inline">Logo</span>
            </TabsTrigger>
            <TabsTrigger value="integracoes" className="flex items-center gap-2 py-3">
              <Plug className="w-4 h-4" />
              <span className="hidden sm:inline">Integrações</span>
            </TabsTrigger>
            <TabsTrigger value="usuarios" className="flex items-center gap-2 py-3">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Usuários</span>
            </TabsTrigger>
            <TabsTrigger value="auditoria" className="flex items-center gap-2 py-3">
              <AlertCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Auditoria</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="comissoes">
            <ConfiguracaoComissoes />
          </TabsContent>

          <TabsContent value="frota">
            <ConfiguracaoFrota />
          </TabsContent>

          <TabsContent value="logo">
            <ConfiguracaoLogo user={user} />
          </TabsContent>

          <TabsContent value="integracoes">
            <Card className="border-0 shadow-lg">
              <CardContent className="p-12">
                <div className="text-center">
                  <Plug className="w-16 h-16 mx-auto mb-4 opacity-20" style={{ color: '#07593f' }} />
                  <h3 className="text-xl font-bold mb-2" style={{ color: '#07593f' }}>
                    Integrações com Sistemas Externos
                  </h3>
                  <p className="mb-6" style={{ color: '#8B8B8B' }}>
                    Configure integrações com emissor fiscal, ERP, transportadoras e outros sistemas
                  </p>
                  
                  <div className="grid md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                    <div className="p-4 rounded-lg border-2 text-left" style={{ borderColor: '#E5E0D8' }}>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#8B8B8B', opacity: 0.2 }}>
                          <span className="text-xl">○</span>
                        </div>
                        <div>
                          <p className="font-bold" style={{ color: '#07593f' }}>SEFAZ / NFe</p>
                          <p className="text-xs" style={{ color: '#8B8B8B' }}>Configurar</p>
                        </div>
                      </div>
                      <p className="text-sm" style={{ color: '#8B8B8B' }}>
                        Consulta de notas fiscais via API SERPRO
                      </p>
                    </div>

                    <div className="p-4 rounded-lg border-2 text-left" style={{ borderColor: '#E5E0D8' }}>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#8B8B8B', opacity: 0.2 }}>
                          <span className="text-xl">○</span>
                        </div>
                        <div>
                          <p className="font-bold" style={{ color: '#07593f' }}>ERP</p>
                          <p className="text-xs" style={{ color: '#8B8B8B' }}>Em breve</p>
                        </div>
                      </div>
                      <p className="text-sm" style={{ color: '#8B8B8B' }}>
                        Integração com sistema ERP externo
                      </p>
                    </div>
                  </div>

                  <p className="mt-6 text-sm" style={{ color: '#8B8B8B' }}>
                    Para configurar novas integrações, entre em contato com o suporte.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="usuarios">
            <GerenciamentoUsuariosTab 
              users={users} 
              isLoading={isLoadingUsers} 
              currentUser={user}
            />
          </TabsContent>

          <TabsContent value="auditoria">
            <AuditLogPage />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}