import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Edit, Trash2, Crown, Truck } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export default function ListaUsuarios({ usuarios, cargos, caminhoes, onEditar }) {
  const queryClient = useQueryClient();

  const deletarUsuarioMutation = useMutation({
    mutationFn: (id) => base44.asServiceRole.entities.User.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      alert('Usuário removido com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao remover usuário:', error);
      alert('Erro ao remover usuário: ' + (error.message || 'Erro desconhecido'));
    }
  });

  const confirmarRemocao = (usuario) => {
    if (confirm(`Tem certeza que deseja remover ${usuario.full_name}?`)) {
      deletarUsuarioMutation.mutate(usuario.id);
    }
  };

  const getCargo = (cargoId) => cargos.find(c => c.id === cargoId);

  return (
    <div className="grid gap-3">
      {usuarios.map(usuario => {
        const cargosUsuario = usuario.cargos?.map(getCargo).filter(Boolean) || [];
        const caminhaoMaster = caminhoes.find(c => c.id === usuario.caminhao_master_id);
        
        return (
          <Card key={usuario.id} className="p-4 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-4">
              <Avatar className="w-12 h-12">
                <AvatarImage src={usuario.avatar_url} />
                <AvatarFallback className="bg-gradient-to-br from-green-600 to-green-700 text-white font-bold">
                  {usuario.full_name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-gray-900 dark:text-white">
                    {usuario.full_name}
                  </h3>
                  {usuario.role === 'admin' && (
                    <Crown className="w-4 h-4 text-yellow-500" />
                  )}
                  {caminhaoMaster && (
                    <Badge variant="secondary" className="gap-1">
                      <Truck className="w-3 h-3" />
                      Master: {caminhaoMaster.nome}
                    </Badge>
                  )}
                </div>
                
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {usuario.email}
                </p>

                <div className="flex flex-wrap gap-2">
                  {cargosUsuario.map(cargo => (
                    <Badge
                      key={cargo.id}
                      style={{
                        backgroundColor: cargo.cor + '20',
                        color: cargo.cor,
                        borderColor: cargo.cor
                      }}
                      className="border"
                    >
                      {cargo.nome}
                    </Badge>
                  ))}
                  {usuario.loja && (
                    <Badge variant="outline">
                      🏪 {usuario.loja}
                    </Badge>
                  )}
                  {!usuario.ativo && (
                    <Badge variant="destructive">Inativo</Badge>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEditar(usuario)}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => confirmarRemocao(usuario)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}