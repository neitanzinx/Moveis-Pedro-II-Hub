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
import { Truck, User, Mail, Phone, Building2, Briefcase, KeyRound, RotateCcw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getZapApiUrl } from "@/utils/zapApiUrl";
import { toast } from "sonner";

// Cargos que NÃO precisam de loja (trabalham para todas)
const CARGOS_SEM_LOJA = ['Administrador', 'Gerente Geral', 'Financeiro', 'RH', 'Estoque', 'Logística', 'Agendamento', 'Entregador', 'Montador Externo'];

// Lista de cargos disponíveis
const CARGOS_DISPONIVEIS = [
  { value: 'Administrador', label: 'Administrador' },
  { value: 'Gerente Geral', label: 'Gerente Geral' },
  { value: 'Gerente', label: 'Gerente de Loja' },
  { value: 'Vendedor', label: 'Vendedor' },
  { value: 'Estoque', label: 'Estoque' },
  { value: 'Financeiro', label: 'Financeiro' },
  { value: 'Logística', label: 'Logística' },
  { value: 'Entregador', label: 'Entregador' },
  { value: 'Montador Externo', label: 'Montador Externo' },
  { value: 'RH', label: 'RH' },
  { value: 'Agendamento', label: 'Agendamento' },
];

export default function ModalUsuario({ usuario, cargos, caminhoes, onClose }) {
  const [dados, setDados] = useState({
    full_name: usuario?.full_name || "",
    email: usuario?.email || "",
    telefone: usuario?.telefone || "",
    cargo: usuario?.cargo || "Vendedor",
    loja: usuario?.loja || "",
    caminhao_master_id: usuario?.caminhao_master_id || "",
    ativo: usuario?.ativo ?? true
  });
  const [resetandoSenha, setResetandoSenha] = useState(false);

  const queryClient = useQueryClient();

  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas'],
    queryFn: () => base44.entities.Loja.list('nome'),
    select: (data) => data.filter(l => l.is_active !== false),
  });

  const precisaLoja = !CARGOS_SEM_LOJA.includes(dados.cargo);

  const salvarMutation = useMutation({
    mutationFn: async (data) => {
      const dadosUsuario = {
        full_name: data.full_name,
        telefone: data.telefone,
        cargo: data.cargo,
        loja: precisaLoja ? data.loja : null,
        ativo: data.ativo,
        is_vendedor: data.cargo === 'Vendedor',
        caminhao_master_id: data.caminhao_master_id || null
      };

      return base44.entities.User.update(usuario.id, dadosUsuario);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      toast.success('Usuário atualizado com sucesso!');
      onClose();
    },
    onError: (error) => {
      console.error('Erro ao salvar usuário:', error);
      toast.error('Erro ao salvar: ' + (error.message || 'Erro desconhecido'));
    }
  });

  const resetarSenhaMutation = useMutation({
    mutationFn: async () => {
      const apiUrl = getZapApiUrl();
      const response = await fetch(`${apiUrl}/api/auth/employee/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('employee_token')}`
        },
        body: JSON.stringify({ user_id: usuario.id })
      });

      if (!response.ok) {
        throw new Error('Falha ao resetar senha');
      }

      return response.json();
    },
    onSuccess: (data) => {
      setResetandoSenha(false);
      toast.success(
        <div>
          <p>Senha resetada com sucesso!</p>
          <p className="font-mono text-sm mt-1">
            Nova senha: <strong>{data.senha_temporaria}</strong>
          </p>
          {data.whatsapp_enviado && <p className="text-xs mt-1">Enviada via WhatsApp</p>}
        </div>,
        { duration: 10000 }
      );
    },
    onError: (error) => {
      toast.error('Erro ao resetar senha: ' + error.message);
    }
  });

  // Verificar se este cargo pode ter caminhão master
  const podeTerCaminhao = ['Entregador', 'Logística'].includes(dados.cargo);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Editar Usuário
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Matrícula (somente leitura) */}
          {usuario?.matricula && (
            <div className="bg-gray-50 dark:bg-neutral-800 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Matrícula:</span>
                  <span className="font-mono font-bold text-green-600">{usuario.matricula}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetarSenhaMutation.mutate()}
                  disabled={resetarSenhaMutation.isPending}
                  className="text-orange-600 hover:text-orange-700"
                >
                  <RotateCcw className={`w-4 h-4 mr-1 ${resetarSenhaMutation.isPending ? 'animate-spin' : ''}`} />
                  Resetar Senha
                </Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Nome Completo *
              </Label>
              <Input
                value={dados.full_name}
                onChange={(e) => setDados({ ...dados, full_name: e.target.value })}
                placeholder="João Silva"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email
              </Label>
              <Input
                type="email"
                value={dados.email}
                disabled
                className="mt-1 bg-gray-50 dark:bg-neutral-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Telefone
              </Label>
              <Input
                value={dados.telefone}
                onChange={(e) => setDados({ ...dados, telefone: e.target.value })}
                placeholder="(27) 99999-9999"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                Cargo *
              </Label>
              <Select value={dados.cargo} onValueChange={(val) => setDados({ ...dados, cargo: val })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CARGOS_DISPONIVEIS.map((cargo) => (
                    <SelectItem key={cargo.value} value={cargo.value}>
                      {cargo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {precisaLoja && (
            <div>
              <Label className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Loja *
              </Label>
              <Select value={dados.loja} onValueChange={(val) => setDados({ ...dados, loja: val })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione a loja" />
                </SelectTrigger>
                <SelectContent>
                  {lojas.map((loja) => (
                    <SelectItem key={loja.id} value={loja.nome}>
                      {loja.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                {dados.cargo === 'Gerente'
                  ? 'O gerente só verá dados desta loja'
                  : 'Loja do funcionário'
                }
              </p>
            </div>
          )}

          {podeTerCaminhao && caminhoes?.length > 0 && (
            <div>
              <Label className="flex items-center gap-2">
                <Truck className="w-4 h-4" />
                Caminhão Master (opcional)
              </Label>
              <Select
                value={dados.caminhao_master_id || "none"}
                onValueChange={(val) => setDados({ ...dados, caminhao_master_id: val === "none" ? "" : val })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione um caminhão" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {caminhoes.map(c => (
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

          <div className="flex items-center gap-2 pt-2">
            <Checkbox
              checked={dados.ativo}
              onCheckedChange={(checked) => setDados({ ...dados, ativo: checked })}
              id="ativo"
            />
            <Label htmlFor="ativo">Usuário ativo</Label>
            {!dados.ativo && (
              <Badge variant="destructive" className="ml-2">Desativado</Badge>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => salvarMutation.mutate(dados)}
            disabled={!dados.full_name || (precisaLoja && !dados.loja) || salvarMutation.isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            {salvarMutation.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}