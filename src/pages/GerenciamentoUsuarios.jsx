import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Shield, UserPlus } from "lucide-react";
import UserManagementTab from "@/components/users/UserManagementTab";
import GestaoCargos from "@/components/configuracoes/GestaoCargos";
import ModalUsuario from "@/components/usuarios/ModalUsuario";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";

export default function GerenciamentoUsuarios() {
  const { loading, can, currentUser } = useAuth();
  const [novoUsuarioOpen, setNovoUsuarioOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: usuarios = [], isLoading: loadingUsuarios } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => base44.entities.User.list()
  });

  if (!loading && !can('manage_user_access')) {
    return <Navigate to="/admin" replace />;
  }

  if (loadingUsuarios) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Users className="w-8 h-8 text-green-600" />
            Gerenciamento de Usuários
          </h1>
          <p className="text-gray-500 mt-1">
            Gerenciamento de contas, cargos e permissões
          </p>
        </div>
      </div>

      <Tabs defaultValue="usuarios" className="space-y-4">
        <TabsList>
          <TabsTrigger value="usuarios" className="gap-2">
            <Users className="w-4 h-4" />
            Usuários ({usuarios.length})
          </TabsTrigger>
          <TabsTrigger value="cargos" className="gap-2">
            <Shield className="w-4 h-4" />
            Cargos e Permissões
          </TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => setNovoUsuarioOpen(true)}
              style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Novo Usuário
            </Button>
          </div>
          <UserManagementTab
            users={usuarios}
            isLoading={loadingUsuarios}
            currentUser={currentUser}
          />
        </TabsContent>

        <TabsContent value="cargos">
          <GestaoCargos />
        </TabsContent>
      </Tabs>

      {novoUsuarioOpen && (
        <ModalUsuario
          usuario={null}
          cargos={[]}
          caminhoes={[]}
          onClose={() => {
            setNovoUsuarioOpen(false);
            queryClient.invalidateQueries({ queryKey: ['usuarios'] });
          }}
        />
      )}
    </div>
  );
}
