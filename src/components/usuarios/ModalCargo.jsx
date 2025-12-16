import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Search, Info } from "lucide-react";

const PERMISSOES_INFO = {
  'view_dashboard': 'Visualizar dashboard principal com métricas gerais',
  'view_dashboard_vendedor': 'Visualizar painel pessoal do vendedor com suas métricas',
  'create_vendas': 'Criar novas vendas e pedidos',
  'view_vendas': 'Visualizar lista de vendas',
  'manage_vendas': 'Editar e gerenciar vendas existentes',
  'cancel_vendas': 'Cancelar vendas e pedidos',
  'view_orcamentos': 'Visualizar orçamentos',
  'create_orcamentos': 'Criar novos orçamentos',
  'view_clientes': 'Visualizar cadastro de clientes',
  'manage_clientes': 'Editar e gerenciar clientes',
  'create_clientes': 'Cadastrar novos clientes',
  'view_produtos': 'Visualizar catálogo de produtos',
  'manage_produtos': 'Editar e gerenciar produtos',
  'view_catalogo': 'Acessar catálogo para WhatsApp',
  'view_estoque': 'Visualizar níveis de estoque',
  'manage_estoque': 'Gerenciar movimentações de estoque',
  'view_entregas': 'Visualizar entregas agendadas',
  'manage_entregas': 'Gerenciar e confirmar entregas',
  'view_montagem': 'Visualizar agendamentos de montagem',
  'manage_montagem': 'Gerenciar e agendar montagens',
  'view_devolucoes': 'Visualizar devoluções',
  'approve_devolucoes': 'Aprovar ou rejeitar devoluções',
  'view_financeiro': 'Visualizar dados financeiros',
  'manage_financeiro': 'Gerenciar lançamentos financeiros',
  'view_notas': 'Visualizar notas fiscais',
  'view_relatorios': 'Acessar relatórios e análises',
  'view_rh': 'Visualizar dados de RH',
  'manage_rh': 'Gerenciar folha de pagamento e colaboradores',
  '*': 'Acesso total ao sistema (Administrador)'
};

const PERMISSOES_DISPONIVEIS = Object.keys(PERMISSOES_INFO);

export default function ModalCargo({ cargo, onClose }) {
  const [dados, setDados] = useState({
    nome: cargo?.nome || "",
    cor: cargo?.cor || "#10b981",
    categoria: cargo?.categoria || "Vendas",
    hierarquia: cargo?.hierarquia || 0,
    permissoes: cargo?.permissoes || [],
    e_vendedor: cargo?.e_vendedor || false,
    e_master_caminhao: cargo?.e_master_caminhao || false,
    descricao: cargo?.descricao || "",
    ativo: cargo?.ativo ?? true
  });

  const [buscaPermissao, setBuscaPermissao] = useState("");

  const queryClient = useQueryClient();

  const salvarMutation = useMutation({
    mutationFn: (data) => {
      if (cargo) {
        return base44.entities.Cargo.update(cargo.id, data);
      } else {
        return base44.entities.Cargo.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargos'] });
      alert(cargo ? 'Cargo atualizado!' : 'Cargo criado!');
      onClose();
    },
    onError: (error) => {
      console.error('Erro ao salvar cargo:', error);
      alert('Erro ao salvar cargo: ' + (error.message || 'Erro desconhecido'));
    }
  });

  const togglePermissao = (perm) => {
    const novas = dados.permissoes.includes(perm)
      ? dados.permissoes.filter(p => p !== perm)
      : [...dados.permissoes, perm];
    setDados({ ...dados, permissoes: novas });
  };

  const permissoesFiltradas = PERMISSOES_DISPONIVEIS.filter(p => {
    const busca = buscaPermissao.toLowerCase();
    return p.toLowerCase().includes(busca) || 
           PERMISSOES_INFO[p].toLowerCase().includes(busca);
  });

  const permissoesPorCategoria = {
    'Dashboard': permissoesFiltradas.filter(p => p.includes('dashboard')),
    'Vendas & Orçamentos': permissoesFiltradas.filter(p => p.includes('venda') || p.includes('orcamento')),
    'Clientes': permissoesFiltradas.filter(p => p.includes('cliente')),
    'Produtos & Catálogo': permissoesFiltradas.filter(p => p.includes('produto') || p.includes('catalogo')),
    'Estoque': permissoesFiltradas.filter(p => p.includes('estoque')),
    'Entregas & Logística': permissoesFiltradas.filter(p => p.includes('entrega')),
    'Montagem': permissoesFiltradas.filter(p => p.includes('montagem')),
    'Devoluções': permissoesFiltradas.filter(p => p.includes('devolucao')),
    'Financeiro': permissoesFiltradas.filter(p => p.includes('financeiro')),
    'Notas Fiscais': permissoesFiltradas.filter(p => p.includes('notas')),
    'Relatórios': permissoesFiltradas.filter(p => p.includes('relatorio')),
    'Recursos Humanos': permissoesFiltradas.filter(p => p.includes('rh')),
    'Administração Total': permissoesFiltradas.filter(p => p === '*')
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {cargo ? 'Editar Cargo' : 'Criar Cargo'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Nome do Cargo *</Label>
              <Input
                value={dados.nome}
                onChange={(e) => setDados({ ...dados, nome: e.target.value })}
                placeholder="Vendedor"
              />
            </div>
            <div>
              <Label>Cor</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={dados.cor}
                  onChange={(e) => setDados({ ...dados, cor: e.target.value })}
                  className="w-16 h-10 p-1"
                />
                <Input
                  value={dados.cor}
                  onChange={(e) => setDados({ ...dados, cor: e.target.value })}
                  placeholder="#10b981"
                />
              </div>
            </div>
            <div>
              <Label>Hierarquia (0-10)</Label>
              <Input
                type="number"
                value={dados.hierarquia}
                onChange={(e) => setDados({ ...dados, hierarquia: parseInt(e.target.value) || 0 })}
                min="0"
                max="10"
              />
            </div>
          </div>

          <div>
            <Label>Categoria *</Label>
            <Select value={dados.categoria} onValueChange={(val) => setDados({ ...dados, categoria: val })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Principal">Principal</SelectItem>
                <SelectItem value="Vendas">Vendas</SelectItem>
                <SelectItem value="Operacional">Operacional</SelectItem>
                <SelectItem value="Gestão">Gestão</SelectItem>
                <SelectItem value="Admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea
              value={dados.descricao}
              onChange={(e) => setDados({ ...dados, descricao: e.target.value })}
              placeholder="Descrição do cargo..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 p-2 border rounded hover:bg-gray-50 dark:hover:bg-neutral-800 cursor-pointer">
              <Checkbox
                checked={dados.e_vendedor}
                onCheckedChange={(checked) => setDados({ ...dados, e_vendedor: checked })}
              />
              <div className="flex-1">
                <span className="font-medium">Participa do sistema de comissões</span>
                <p className="text-xs text-gray-500">
                  Vendas deste cargo serão contabilizadas para comissões
                </p>
              </div>
            </label>

            <label className="flex items-center gap-2 p-2 border rounded hover:bg-gray-50 dark:hover:bg-neutral-800 cursor-pointer">
              <Checkbox
                checked={dados.e_master_caminhao}
                onCheckedChange={(checked) => setDados({ ...dados, e_master_caminhao: checked })}
              />
              <div className="flex-1">
                <span className="font-medium">Pode ser Master de Caminhão</span>
                <p className="text-xs text-gray-500">
                  Usuário com este cargo pode enviar localização GPS de caminhões
                </p>
              </div>
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <Label>
                Permissões ({dados.permissoes.length} selecionadas)
              </Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setDados({ ...dados, permissoes: [] })}
                  disabled={dados.permissoes.length === 0}
                >
                  Limpar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setDados({ ...dados, permissoes: PERMISSOES_DISPONIVEIS })}
                >
                  Selecionar Todas
                </Button>
              </div>
            </div>

            <div className="relative mb-3">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Buscar permissões..."
                value={buscaPermissao}
                onChange={(e) => setBuscaPermissao(e.target.value)}
                className="pl-9"
              />
            </div>

            <TooltipProvider>
              <div className="space-y-4 max-h-96 overflow-y-auto border rounded-lg p-4 bg-gray-50 dark:bg-neutral-900">
                {Object.entries(permissoesPorCategoria).map(([cat, perms]) => (
                  perms.length > 0 && (
                    <div key={cat} className="bg-white dark:bg-neutral-800 p-3 rounded-lg">
                      <h4 className="font-bold text-sm text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        {cat}
                        <Badge variant="secondary" className="text-xs">
                          {perms.filter(p => dados.permissoes.includes(p)).length}/{perms.length}
                        </Badge>
                      </h4>
                      <div className="grid grid-cols-1 gap-2">
                        {perms.map(perm => (
                          <Tooltip key={perm}>
                            <TooltipTrigger asChild>
                              <label className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-neutral-700 cursor-pointer text-sm border border-transparent hover:border-gray-200 dark:hover:border-neutral-600 transition-all">
                                <Checkbox
                                  checked={dados.permissoes.includes(perm)}
                                  onCheckedChange={() => togglePermissao(perm)}
                                />
                                <span className="text-xs font-medium flex-1">{perm}</span>
                                <Info className="w-3 h-3 text-gray-400" />
                              </label>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-xs">
                              <p className="text-xs">{PERMISSOES_INFO[perm]}</p>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    </div>
                  )
                ))}
                {permissoesFiltradas.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhuma permissão encontrada</p>
                  </div>
                )}
              </div>
            </TooltipProvider>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => salvarMutation.mutate(dados)}
            disabled={!dados.nome || (!dados.permissoes.includes('*') && dados.permissoes.length === 0) || salvarMutation.isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            {salvarMutation.isPending ? 'Salvando...' : (cargo ? 'Salvar Alterações' : 'Criar Cargo')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}