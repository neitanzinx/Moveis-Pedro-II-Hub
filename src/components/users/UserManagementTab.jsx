import React, { useState, createElement } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Users,
  UserCheck,
  UserX,
  Shield,
  Search,
  CheckCircle2,
  Clock,
  Store,
  Edit,
  Eye,
  Briefcase,
  UserCircle,
  Package,
  DollarSign,
  Calendar,
  TrendingUp
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";


const roles = [
  {
    value: 'Administrador',
    label: 'Administrador',
    icon: Shield,
    color: '#dc2626',
    permissions: ['Acesso total ao sistema', 'Gerenciar usuários', 'Aprovar/rejeitar cadastros', 'Editar configurações']
  },
  {
    value: 'Gerente',
    label: 'Gerente',
    icon: Briefcase,
    color: '#f38a4c',
    permissions: ['Acesso completo da loja', 'Aprovar devoluções', 'Ver relatórios financeiros', 'Gerenciar equipe']
  },
  {
    value: 'Vendedor',
    label: 'Vendedor',
    icon: UserCircle,
    color: '#3b82f6',
    permissions: ['Criar vendas e orçamentos', 'Gerenciar clientes', 'Ver comissões próprias']
  },
  {
    value: 'Estoque',
    label: 'Estoque',
    icon: Package,
    color: '#10b981',
    permissions: ['Gerenciar produtos', 'Movimentação de estoque', 'Gerenciar entregas']
  },
  {
    value: 'Financeiro',
    label: 'Financeiro',
    icon: DollarSign,
    color: '#8b5cf6',
    permissions: ['Controle financeiro completo', 'Emitir notas fiscais', 'Relatórios financeiros']
  },
  {
    value: 'Agendamento',
    label: 'Agendamento',
    icon: Calendar,
    color: '#06b6d4',
    permissions: ['Agendar montagens', 'Gerenciar montadores', 'Confirmar entregas']
  },
  {
    value: 'RH',
    label: 'RH',
    icon: Users,
    color: '#ec4899',
    permissions: ['Gerenciar colaboradores', 'Folha de pagamento', 'Férias e licenças']
  }
];

const lojas = ["Centro", "Carangola", "Ponte Branca"];

export default function UserManagementTab({ users, isLoading, currentUser }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterRole, setFilterRole] = useState("all");
  const [selectedUser, setSelectedUser] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [viewingUser, setViewingUser] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  const queryClient = useQueryClient();

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, updates, currentData }) => {
      await base44.entities.User.update(userId, updates);

      const changes = {};
      Object.keys(updates).forEach(key => {
        if (updates[key] !== currentData?.[key]) {
          changes[key] = {
            before: currentData?.[key],
            after: updates[key]
          };
        }
      });

      if (Object.keys(changes).length > 0) {
        try {
          await base44.entities.AuditLog.create({
            user_email: currentUser.email,
            user_name: currentUser.full_name,
            user_cargo: currentUser.cargo,
            action: 'UPDATE',
            entity_type: 'User',
            entity_id: userId,
            entity_description: `Usuário ${currentData?.full_name || updates?.full_name || ''}`,
            changes,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          console.log('Log de auditoria não criado:', error.message);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      setEditModalOpen(false);
      setSelectedUser(null);
    }
  });

  const handleEditUser = (user) => {
    setSelectedUser({
      ...user,
      is_vendedor: user.is_vendedor || false,
      meta_mensal: user.meta_mensal || 0
    });
    setEditModalOpen(true);
  };

  const handleView = (user) => {
    setViewingUser(user);
    setIsViewModalOpen(true);
  };

  const handleApprove = async (user) => {
    await updateUserMutation.mutateAsync({
      userId: user.id,
      updates: {
        cargo: user.cargo || 'Vendedor',
        loja: user.loja || 'Centro',
        status_aprovacao: 'Aprovado',
        data_aprovacao: new Date().toISOString()
      },
      currentData: user
    });
  };

  const handleReject = (user) => {
    if (confirm(`Tem certeza que deseja rejeitar o usuário ${user.full_name}?`)) {
      updateUserMutation.mutate({
        userId: user.id,
        updates: {
          status_aprovacao: 'Rejeitado'
        },
        currentData: user
      });
    }
  };

  const handleSaveEdit = () => {
    if (selectedUser) {
      const updates = {
        full_name: selectedUser.full_name,
        cargo: selectedUser.cargo,
        loja: selectedUser.loja,
        status_aprovacao: selectedUser.status_aprovacao,
        is_vendedor: selectedUser.is_vendedor,
        meta_mensal: selectedUser.is_vendedor ? parseFloat(selectedUser.meta_mensal) || 0 : 0
      };

      updateUserMutation.mutate({
        userId: selectedUser.id,
        updates,
        currentData: users.find(u => u.id === selectedUser.id)
      });
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === "all" || user.status_aprovacao === filterStatus;
    const matchesRole = filterRole === "all" || user.cargo === filterRole;

    return matchesSearch && matchesStatus && matchesRole;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Aprovado':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100"><CheckCircle2 className="w-3 h-3 mr-1" />Aprovado</Badge>;
      case 'Pendente':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
      case 'Rejeitado':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100"><UserX className="w-3 h-3 mr-1" />Rejeitado</Badge>;
      default:
        return null;
    }
  };

  const getRoleBadge = (cargo) => {
    const roleData = roles.find(r => r.value === cargo);
    if (!roleData) return <Badge variant="outline">{cargo || 'Não definido'}</Badge>;

    return (
      <Badge className="flex items-center gap-1" style={{ backgroundColor: `${roleData.color}15`, color: roleData.color, border: `1px solid ${roleData.color}40` }}>
        {createElement(roleData.icon, { className: "w-3 h-3" })}
        {roleData.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Filtros e Busca</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: '#8B8B8B' }} />
              <Input
                placeholder="Buscar por nome ou e-mail..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="Pendente">Pendente</SelectItem>
                <SelectItem value="Aprovado">Aprovado</SelectItem>
                <SelectItem value="Rejeitado">Rejeitado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger>
                <SelectValue placeholder="Cargo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Cargos</SelectItem>
                {roles.map(role => (
                  <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: '#07593f' }} />
        </div>
      ) : (
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Usuários ({filteredUsers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Loja</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{
                            backgroundColor: roles.find(r => r.value === user.cargo)?.color + '20' || '#E5E0D8'
                          }}
                        >
                          {createElement(
                            roles.find(r => r.value === user.cargo)?.icon || UserCircle,
                            {
                              className: "w-5 h-5",
                              style: { color: roles.find(r => r.value === user.cargo)?.color || '#8B8B8B' }
                            }
                          )}
                        </div>
                        <div>
                          <p className="font-semibold" style={{ color: '#07593f' }}>
                            {user.full_name || 'Sem nome'}
                          </p>
                          <p className="text-sm" style={{ color: '#8B8B8B' }}>
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getRoleBadge(user.cargo)}
                    </TableCell>
                    <TableCell>
                      {user.loja && (
                        <div className="flex items-center gap-1 text-sm" style={{ color: '#8B8B8B' }}>
                          <Store className="w-4 h-4" />
                          {user.loja}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(user.status_aprovacao)}
                    </TableCell>
                    <TableCell>
                      {user.is_vendedor && (
                        <Badge className="bg-blue-100 text-blue-800 flex items-center gap-1 w-fit">
                          <TrendingUp className="w-3 h-3" />
                          Vendedor
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {user.status_aprovacao === 'Pendente' && (
                          <>
                            <Button
                              onClick={() => handleApprove(user)}
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              disabled={updateUserMutation.isPending}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </Button>
                            <Button
                              onClick={() => handleReject(user)}
                              size="sm"
                              variant="destructive"
                              disabled={updateUserMutation.isPending}
                            >
                              <UserX className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        <Button
                          onClick={() => handleView(user)}
                          size="sm"
                          variant="outline"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditUser(user)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {filteredUsers.length === 0 && !isLoading && (
        <Card className="border-0 shadow-lg">
          <CardContent className="p-12 text-center">
            <Users className="w-16 h-16 mx-auto mb-4 opacity-20" style={{ color: '#07593f' }} />
            <p className="text-xl" style={{ color: '#8B8B8B' }}>
              Nenhum usuário encontrado
            </p>
          </CardContent>
        </Card>
      )}

      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Altere as informações do usuário e defina se atua como vendedor
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="edit-name">Nome Completo</Label>
                <Input
                  id="edit-name"
                  value={selectedUser.full_name || ''}
                  onChange={(e) => setSelectedUser({
                    ...selectedUser,
                    full_name: e.target.value
                  })}
                />
              </div>

              <div>
                <Label htmlFor="edit-email">E-mail</Label>
                <Input
                  id="edit-email"
                  value={selectedUser.email || ''}
                  disabled
                  className="bg-gray-50"
                />
              </div>

              <div>
                <Label htmlFor="edit-status">Status *</Label>
                <Select
                  value={selectedUser.status_aprovacao}
                  onValueChange={(value) => setSelectedUser({ ...selectedUser, status_aprovacao: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pendente">Pendente</SelectItem>
                    <SelectItem value="Aprovado">Aprovado</SelectItem>
                    <SelectItem value="Rejeitado">Rejeitado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="edit-cargo">Cargo *</Label>
                <Select
                  value={selectedUser.cargo || ''}
                  onValueChange={(value) => setSelectedUser({
                    ...selectedUser,
                    cargo: value
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um cargo" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map(role => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedUser.cargo !== 'Administrador' && (
                <div>
                  <Label htmlFor="edit-loja">Loja *</Label>
                  <Select
                    value={selectedUser.loja || ''}
                    onValueChange={(value) => setSelectedUser({
                      ...selectedUser,
                      loja: value
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma loja" />
                    </SelectTrigger>
                    <SelectContent>
                      {lojas.map(loja => (
                        <SelectItem key={loja} value={loja}>{loja}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="p-4 rounded-lg border-2" style={{ borderColor: '#3b82f6', backgroundColor: '#eff6ff' }}>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="is-vendedor"
                    checked={selectedUser.is_vendedor}
                    onCheckedChange={(checked) => setSelectedUser({
                      ...selectedUser,
                      is_vendedor: checked
                    })}
                  />
                  <div className="flex-1">
                    <Label htmlFor="is-vendedor" className="cursor-pointer font-semibold" style={{ color: '#3b82f6' }}>
                      Atua como Vendedor
                    </Label>
                    <p className="text-xs mt-1" style={{ color: '#8B8B8B' }}>
                      Marcando esta opção, o usuário será incluído no cálculo de comissões e relatórios de vendas
                    </p>
                  </div>
                </div>

                {selectedUser.is_vendedor && (
                  <div className="mt-4">
                    <Label htmlFor="meta-mensal">Meta Mensal (R$)</Label>
                    <Input
                      id="meta-mensal"
                      type="number"
                      step="0.01"
                      min="0"
                      value={selectedUser.meta_mensal || 0}
                      onChange={(e) => setSelectedUser({
                        ...selectedUser,
                        meta_mensal: parseFloat(e.target.value) || 0
                      })}
                      placeholder="0.00"
                    />
                  </div>
                )}
              </div>

              {selectedUser.cargo && (
                <Alert className="border-2" style={{ borderColor: '#07593f', backgroundColor: '#f0f9ff' }}>
                  <Shield className="h-4 w-4" style={{ color: '#07593f' }} />
                  <AlertDescription className="ml-2 text-sm">
                    <strong>Permissões do Cargo {selectedUser.cargo}:</strong>
                    <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                      {roles.find(r => r.value === selectedUser.cargo)?.permissions.map((perm, i) => (
                        <li key={i}>{perm}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={updateUserMutation.isPending}
              style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
            >
              {updateUserMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Usuário</DialogTitle>
          </DialogHeader>

          {viewingUser && (
            <div className="space-y-6 py-4">
              <div className="flex items-center gap-4">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: '#f38a4c', opacity: 0.2 }}
                >
                  <span className="text-2xl font-bold" style={{ color: '#07593f' }}>
                    {viewingUser.full_name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-bold" style={{ color: '#07593f' }}>
                    {viewingUser.full_name}
                  </h3>
                  <p className="text-sm" style={{ color: '#8B8B8B' }}>
                    {viewingUser.email}
                  </p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <div>{getStatusBadge(viewingUser.status_aprovacao)}</div>
                </div>
                <div className="space-y-2">
                  <Label>Cargo</Label>
                  <div>{getRoleBadge(viewingUser.cargo)}</div>
                </div>
                {viewingUser.loja && (
                  <div className="space-y-2">
                    <Label>Loja</Label>
                    <div className="flex items-center gap-2">
                      <Store className="w-4 h-4" style={{ color: '#8B8B8B' }} />
                      <span>{viewingUser.loja}</span>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Cadastrado em</Label>
                  <div className="text-sm" style={{ color: '#8B8B8B' }}>
                    {new Date(viewingUser.created_date).toLocaleDateString('pt-BR')}
                  </div>
                </div>
                {viewingUser.data_aprovacao && (
                  <div className="space-y-2">
                    <Label>Aprovado em</Label>
                    <div className="text-sm" style={{ color: '#8B8B8B' }}>
                      {new Date(viewingUser.data_aprovacao).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                )}
              </div>

              {viewingUser.is_vendedor && (
                <Alert className="border-2" style={{ borderColor: '#3b82f6', backgroundColor: '#eff6ff' }}>
                  <TrendingUp className="h-4 w-4" style={{ color: '#3b82f6' }} />
                  <AlertDescription style={{ color: '#1e40af' }}>
                    <strong>Vendedor Ativo</strong>
                    {viewingUser.meta_mensal > 0 && (
                      <p className="text-sm mt-1">
                        Meta Mensal: R$ {viewingUser.meta_mensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {viewingUser.cargo && (
                <div>
                  <Label className="mb-2 block">Permissões do Cargo</Label>
                  <Alert style={{ backgroundColor: '#f0f9ff', border: '1px solid #07593f40' }}>
                    <Shield className="h-4 w-4" style={{ color: '#07593f' }} />
                    <AlertDescription className="ml-2">
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {roles.find(r => r.value === viewingUser.cargo)?.permissions.map((perm, i) => (
                          <li key={i}>{perm}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setIsViewModalOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}