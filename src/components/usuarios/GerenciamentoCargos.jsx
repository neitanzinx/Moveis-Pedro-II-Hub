import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Users, DollarSign, Truck, Shield } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export default function GerenciamentoCargos({ cargos, onEditar }) {
  const queryClient = useQueryClient();

  const deletarCargoMutation = useMutation({
    mutationFn: (id) => base44.entities.Cargo.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargos'] });
      alert('Cargo removido com sucesso!');
    }
  });

  const confirmarRemocao = (cargo) => {
    if (confirm(`Tem certeza que deseja remover o cargo "${cargo.nome}"?`)) {
      deletarCargoMutation.mutate(cargo.id);
    }
  };

  const cargosPorCategoria = {
    'Principal': cargos.filter(c => c.categoria === 'Principal'),
    'Vendas': cargos.filter(c => c.categoria === 'Vendas'),
    'Operacional': cargos.filter(c => c.categoria === 'Operacional'),
    'Gestão': cargos.filter(c => c.categoria === 'Gestão'),
    'Admin': cargos.filter(c => c.categoria === 'Admin')
  };

  if (cargos.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Shield className="w-16 h-16 mx-auto mb-4 text-gray-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Nenhum cargo criado ainda
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Comece criando cargos personalizados para sua equipe
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(cargosPorCategoria).map(([categoria, cargosCategoria]) => (
        cargosCategoria.length > 0 && (
          <div key={categoria}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              {categoria}
              <Badge variant="secondary">{cargosCategoria.length}</Badge>
            </h3>
            <div className="grid gap-3">
              {cargosCategoria.map(cargo => (
                <Card key={cargo.id} className="p-4">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-xl"
                      style={{ backgroundColor: cargo.cor }}
                    >
                      {cargo.nome.charAt(0)}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-gray-900 dark:text-white">
                          {cargo.nome}
                        </h4>
                        <Badge variant="outline">
                          Nível {cargo.hierarquia}
                        </Badge>
                        {cargo.e_vendedor && (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            <DollarSign className="w-3 h-3 mr-1" />
                            Comissões
                          </Badge>
                        )}
                        {cargo.e_master_caminhao && (
                          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            <Truck className="w-3 h-3 mr-1" />
                            Master
                          </Badge>
                        )}
                      </div>
                      
                      {cargo.descricao && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {cargo.descricao}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-1">
                        {cargo.permissoes?.slice(0, 5).map((perm, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {perm}
                          </Badge>
                        ))}
                        {cargo.permissoes?.length > 5 && (
                          <Badge variant="outline" className="text-xs">
                            +{cargo.permissoes.length - 5} mais
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEditar(cargo)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => confirmarRemocao(cargo)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )
      ))}
    </div>
  );
}