import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Truck } from "lucide-react";

export default function ModalUsuario({ usuario, cargos, caminhoes, onClose }) {
  const [dados, setDados] = useState({
    full_name: usuario?.full_name || "",
    email: usuario?.email || "",
    telefone: usuario?.telefone || "",
    loja: usuario?.loja || "",
    cargos: usuario?.cargos || [],
    caminhao_master_id: usuario?.caminhao_master_id || "",
    ativo: usuario?.ativo ?? true
  });

  const queryClient = useQueryClient();

  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas'],
    queryFn: () => base44.entities.Loja.list('nome'),
    select: (data) => data.filter(l => l.ativa),
  });

  const salvarMutation = useMutation({
    mutationFn: async (data) => {
      const cargosSelecionados = cargos.filter(c => data.cargos.includes(c.id));
      const dadosUsuario = {
        ...data,
        cargos_nomes: cargosSelecionados.map(c => c.nome),
        cargo: cargosSelecionados[0]?.nome || data.cargo,
        caminhao_master_nome: caminhoes.find(c => c.id === data.caminhao_master_id)?.nome || null
      };

      if (usuario) {
        return base44.asServiceRole.entities.User.update(usuario.id, dadosUsuario);
      } else {
        return base44.asServiceRole.entities.User.create(dadosUsuario);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      alert(usuario ? 'Usuário atualizado!' : 'Usuário criado!');
      onClose();
    },
    onError: (error) => {
      console.error('Erro ao salvar usuário:', error);
      alert('Erro ao salvar usuário: ' + (error.message || 'Erro desconhecido'));
    }
  });

  const toggleCargo = (cargoId) => {
    const novos = dados.cargos.includes(cargoId)
      ? dados.cargos.filter(id => id !== cargoId)
      : [...dados.cargos, cargoId];
    setDados({ ...dados, cargos: novos });
  };

  const cargosPorCategoria = {
    'Principal': cargos.filter(c => c.categoria === 'Principal'),
    'Vendas': cargos.filter(c => c.categoria === 'Vendas'),
    'Operacional': cargos.filter(c => c.categoria === 'Operacional'),
    'Gestão': cargos.filter(c => c.categoria === 'Gestão'),
    'Admin': cargos.filter(c => c.categoria === 'Admin')
  };

  const caminhoesMaster = caminhoes.filter(c =>
    dados.cargos.some(cargoId => {
      const cargo = cargos.find(cg => cg.id === cargoId);
      return cargo?.e_master_caminhao;
    })
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {usuario ? 'Editar Usuário' : 'Adicionar Usuário'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Nome Completo *</Label>
              <Input
                value={dados.full_name}
                onChange={(e) => setDados({ ...dados, full_name: e.target.value })}
                placeholder="João Silva"
              />
            </div>
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={dados.email}
                onChange={(e) => setDados({ ...dados, email: e.target.value })}
                placeholder="joao@exemplo.com"
                disabled={!!usuario}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Telefone</Label>
              <Input
                value={dados.telefone}
                onChange={(e) => setDados({ ...dados, telefone: e.target.value })}
                placeholder="(27) 99999-9999"
              />
            </div>
            <div>
              <Label>Loja</Label>
              <Select value={dados.loja} onValueChange={(val) => setDados({ ...dados, loja: val })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {lojas.length === 0 ? (
                    <SelectItem value="Centro" disabled>Carregando...</SelectItem>
                  ) : (
                    lojas.map((loja) => (
                      <SelectItem key={loja.id} value={loja.nome}>
                        {loja.nome}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="mb-3 block">Cargos (selecione múltiplos)</Label>
            <div className="space-y-4">
              {Object.entries(cargosPorCategoria).map(([categoria, cargosCat]) => (
                cargosCat.length > 0 && (
                  <div key={categoria} className="border rounded-lg p-3">
                    <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">
                      {categoria}
                    </h4>
                    <div className="space-y-2">
                      {cargosCat.map(cargo => (
                        <label
                          key={cargo.id}
                          className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-neutral-800 cursor-pointer"
                        >
                          <Checkbox
                            checked={dados.cargos.includes(cargo.id)}
                            onCheckedChange={() => toggleCargo(cargo.id)}
                          />
                          <div
                            className="w-3 h-3 rounded"
                            style={{ backgroundColor: cargo.cor }}
                          />
                          <span className="flex-1">{cargo.nome}</span>
                          {cargo.e_vendedor && (
                            <Badge variant="outline" className="text-xs">Comissões</Badge>
                          )}
                          {cargo.e_master_caminhao && (
                            <Badge variant="outline" className="text-xs">Master</Badge>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>

          {caminhoesMaster.length > 0 && (
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <Truck className="w-4 h-4" />
                Caminhão Master (opcional)
              </Label>
              <Select
                value={dados.caminhao_master_id}
                onValueChange={(val) => setDados({ ...dados, caminhao_master_id: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um caminhão" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Nenhum</SelectItem>
                  {caminhoesMaster.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome} - {c.placa || 'Sem placa'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                Este usuário enviará a localização GPS deste caminhão
              </p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Checkbox
              checked={dados.ativo}
              onCheckedChange={(checked) => setDados({ ...dados, ativo: checked })}
              id="ativo"
            />
            <Label htmlFor="ativo">Usuário ativo</Label>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => salvarMutation.mutate(dados)}
            disabled={!dados.full_name || !dados.email || dados.cargos.length === 0 || salvarMutation.isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            {salvarMutation.isPending ? 'Salvando...' : (usuario ? 'Salvar' : 'Criar')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}