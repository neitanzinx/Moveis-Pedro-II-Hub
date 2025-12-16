import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Shield, UserPlus, Search } from "lucide-react";
import ListaUsuarios from "@/components/usuarios/ListaUsuarios";
import GerenciamentoCargos from "@/components/usuarios/GerenciamentoCargos";
import ModalUsuario from "@/components/usuarios/ModalUsuario";
import ModalCargo from "@/components/usuarios/ModalCargo";

export default function GerenciamentoUsuarios() {
  const [busca, setBusca] = useState("");
  const [modalUsuario, setModalUsuario] = useState(false);
  const [modalCargo, setModalCargo] = useState(false);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState(null);
  const [cargoSelecionado, setCargoSelecionado] = useState(null);
  const queryClient = useQueryClient();

  const { data: usuarios = [], isLoading: loadingUsuarios } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => base44.entities.User.list()
  });

  const { data: cargos = [], isLoading: loadingCargos } = useQuery({
    queryKey: ['cargos'],
    queryFn: () => base44.entities.Cargo.list()
  });

  const { data: caminhoes = [] } = useQuery({
    queryKey: ['caminhoes'],
    queryFn: () => base44.entities.Caminhao.list()
  });

  const usuariosFiltrados = usuarios.filter(u => 
    u.full_name?.toLowerCase().includes(busca.toLowerCase()) ||
    u.email?.toLowerCase().includes(busca.toLowerCase())
  );

  const abrirModalUsuario = (usuario = null) => {
    setUsuarioSelecionado(usuario);
    setModalUsuario(true);
  };

  const abrirModalCargo = (cargo = null) => {
    setCargoSelecionado(cargo);
    setModalCargo(true);
  };

  if (loadingUsuarios || loadingCargos) {
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
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Sistema de cargos e permissões estilo Discord
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
            Cargos ({cargos.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="space-y-4">
          <Card className="p-4">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Buscar usuários por nome ou email..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button onClick={() => abrirModalUsuario()} className="bg-green-600 hover:bg-green-700">
                <UserPlus className="w-4 h-4 mr-2" />
                Adicionar Usuário
              </Button>
            </div>
          </Card>

          <ListaUsuarios
            usuarios={usuariosFiltrados}
            cargos={cargos}
            caminhoes={caminhoes}
            onEditar={abrirModalUsuario}
          />
        </TabsContent>

        <TabsContent value="cargos" className="space-y-4">
          <Card className="p-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Configure cargos e permissões por categoria
              </p>
              <Button onClick={() => abrirModalCargo()} className="bg-green-600 hover:bg-green-700">
                <Shield className="w-4 h-4 mr-2" />
                Criar Cargo
              </Button>
            </div>
          </Card>

          <GerenciamentoCargos
            cargos={cargos}
            onEditar={abrirModalCargo}
          />
        </TabsContent>
      </Tabs>

      {modalUsuario && (
        <ModalUsuario
          usuario={usuarioSelecionado}
          cargos={cargos}
          caminhoes={caminhoes}
          onClose={() => {
            setModalUsuario(false);
            setUsuarioSelecionado(null);
          }}
        />
      )}

      {modalCargo && (
        <ModalCargo
          cargo={cargoSelecionado}
          onClose={() => {
            setModalCargo(false);
            setCargoSelecionado(null);
          }}
        />
      )}
    </div>
  );
}