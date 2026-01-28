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
  Users, UserX, Shield, Search, CheckCircle2, Clock,
  Store, Edit, Eye, TrendingUp, Trash2, UserCircle, Loader2, Key
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { CARGOS, LOJAS, getCargoConfig } from "@/config/cargos";
import PermissionEditorModal from "./PermissionEditorModal";

export default function UserManagementTab({ users = [], isLoading, currentUser }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [selectedUser, setSelectedUser] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [viewingUser, setViewingUser] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [permissionUser, setPermissionUser] = useState(null);
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);

  const queryClient = useQueryClient();

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, updates, telefone, currentData }) => {
      await base44.entities.User.update(userId, updates);

      // Se o cargo é "Montador Externo", criar registro em montadores
      if (updates.cargo === 'Montador Externo') {
        try {
          const montadores = await base44.entities.Montador.list();
          const existe = montadores.find(m => m.usuario_id === userId);
          if (!existe) {
            await base44.entities.Montador.create({
              usuario_id: userId,
              nome: updates.full_name || currentData?.full_name || 'Montador',
              telefone: telefone || '',
              status: 'ativo',
              tipo: 'externo'
            });
          } else if (telefone && telefone !== existe.telefone) {
            await base44.entities.Montador.update(existe.id, { telefone });
          }
        } catch (err) {
          console.error('Erro ao criar/atualizar montador:', err);
        }
      }

      // Log de auditoria
      const changes = {};
      Object.keys(updates).forEach(key => {
        if (updates[key] !== currentData?.[key]) {
          changes[key] = { before: currentData?.[key], after: updates[key] };
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
        } catch (e) { }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['montadores'] });
      setEditModalOpen(false);
      setSelectedUser(null);
      toast.success("Usuário atualizado!");
    },
    onError: (e) => toast.error("Erro: " + e.message)
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId) => {
      try {
        const montadores = await base44.entities.Montador.list();
        const montador = montadores.find(m => m.usuario_id === userId);
        if (montador) await base44.entities.Montador.delete(montador.id);
      } catch (e) { }
      await base44.entities.User.delete(userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success("Usuário deletado");
    },
    onError: () => toast.error("Erro ao deletar usuário")
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: async ({ userId, customPermissions }) => {
      await base44.entities.User.update(userId, { custom_permissions: customPermissions });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsPermissionModalOpen(false);
      setPermissionUser(null);
      toast.success("Permissoes atualizadas!");
    },
    onError: (e) => toast.error("Erro: " + e.message)
  });

  const handleEditUser = (user) => {
    setSelectedUser({ ...user, is_vendedor: user.is_vendedor || false, meta_mensal: user.meta_mensal || 0 });
    setEditModalOpen(true);
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
    toast.success(`${user.full_name} aprovado!`);
  };

  const handleReject = (user) => {
    if (confirm(`Rejeitar ${user.full_name}?`)) {
      updateUserMutation.mutate({
        userId: user.id,
        updates: { status_aprovacao: 'Rejeitado' },
        currentData: user
      });
    }
  };

  const handleDeleteUser = (user) => {
    if (user.id === currentUser?.id) {
      toast.error("Você não pode deletar sua própria conta");
      return;
    }
    if (confirm(`⚠️ DELETAR "${user.full_name}" permanentemente?\n\nEsta ação não pode ser desfeita!`)) {
      deleteUserMutation.mutate(user.id);
    }
  };

  const handleSaveEdit = () => {
    if (!selectedUser) return;
    const cargoConfig = getCargoConfig(selectedUser.cargo);
    const updates = {
      full_name: selectedUser.full_name,
      cargo: selectedUser.cargo,
      loja: cargoConfig?.requiresStore ? selectedUser.loja : null,
      status_aprovacao: selectedUser.status_aprovacao,
      is_vendedor: selectedUser.is_vendedor,
      meta_mensal: selectedUser.is_vendedor ? parseFloat(selectedUser.meta_mensal) || 0 : 0
    };
    updateUserMutation.mutate({
      userId: selectedUser.id,
      updates,
      telefone: selectedUser.telefone,
      currentData: users.find(u => u.id === selectedUser.id)
    });
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === "all" || user.cargo === filterRole;
    return matchesSearch && matchesRole;
  });

  const getStatusBadge = (status) => {
    const styles = {
      'Aprovado': { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle2 },
      'Pendente': { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock },
      'Rejeitado': { bg: 'bg-red-100', text: 'text-red-800', icon: UserX }
    };
    const s = styles[status] || styles['Pendente'];
    return (
      <Badge className={`${s.bg} ${s.text} hover:${s.bg}`}>
        {createElement(s.icon, { className: "w-3 h-3 mr-1" })}
        {status || 'Pendente'}
      </Badge>
    );
  };

  const getRoleBadge = (cargo) => {
    const config = getCargoConfig(cargo);
    if (!config) return <Badge variant="outline">{cargo || 'Não definido'}</Badge>;
    return (
      <Badge style={{ backgroundColor: `${config.color}15`, color: config.color, border: `1px solid ${config.color}40` }}>
        {createElement(config.icon, { className: "w-3 h-3 mr-1" })}
        {config.label}
      </Badge>
    );
  };

  const selectedCargoConfig = selectedUser ? getCargoConfig(selectedUser.cargo) : null;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total</p>
                <p className="text-2xl font-bold" style={{ color: '#07593f' }}>{users.length}</p>
              </div>
              <Users className="w-8 h-8 text-gray-200" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Por Cargo</p>
                <p className="text-2xl font-bold text-blue-600">{new Set(users.map(u => u.cargo)).size}</p>
              </div>
              <Shield className="w-8 h-8 text-blue-100" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Vendedores</p>
                <p className="text-2xl font-bold text-green-600">{users.filter(u => u.is_vendedor).length}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-100" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-lg">
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Cargo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Cargos</SelectItem>
                {CARGOS.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-green-700" />
        </div>
      ) : (
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-0">
            <CardTitle className="text-lg">Usuários ({filteredUsers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Loja</TableHead>
                  <TableHead>Permissoes</TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => {
                  const config = getCargoConfig(user.cargo);
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: config?.bgColor || '#f3f4f6' }}
                          >
                            {createElement(config?.icon || UserCircle, {
                              className: "w-5 h-5",
                              style: { color: config?.color || '#6b7280' }
                            })}
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{user.full_name || 'Sem nome'}</p>
                            <p className="text-xs text-gray-500">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(user.cargo)}</TableCell>
                      <TableCell>
                        {user.loja && (
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <Store className="w-4 h-4" />
                            {user.loja}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {user.custom_permissions &&
                            (user.custom_permissions.allowed?.length > 0 || user.custom_permissions.denied?.length > 0) ? (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 text-xs">
                              <Key className="w-3 h-3 mr-1" />
                              Customizadas
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-gray-500 text-xs">
                              Do cargo
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" className="h-8" onClick={() => { setViewingUser(user); setIsViewModalOpen(true); }}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline" className="h-8" onClick={() => handleEditUser(user)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={() => { setPermissionUser(user); setIsPermissionModalOpen(true); }}
                            title="Editar Permissoes"
                          >
                            <Key className="w-4 h-4" />
                          </Button>
                          {currentUser?.cargo === 'Administrador' && user.id !== currentUser?.id && (
                            <Button size="sm" variant="destructive" className="h-8" onClick={() => handleDeleteUser(user)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {filteredUsers.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>Nenhum usuário encontrado</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>Altere as informações do usuário</DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-4 py-4">
              <div>
                <Label>Nome Completo</Label>
                <Input
                  value={selectedUser.full_name || ''}
                  onChange={(e) => setSelectedUser({ ...selectedUser, full_name: e.target.value })}
                />
              </div>

              <div>
                <Label>E-mail</Label>
                <Input value={selectedUser.email || ''} disabled className="bg-gray-50" />
              </div>

              {selectedUser.cargo === 'Montador Externo' && (
                <div>
                  <Label>Telefone</Label>
                  <Input
                    value={selectedUser.telefone || ''}
                    onChange={(e) => setSelectedUser({ ...selectedUser, telefone: e.target.value })}
                    placeholder="(27) 99999-9999"
                  />
                </div>
              )}

              <div>
                <Label>Status</Label>
                <Select
                  value={selectedUser.status_aprovacao}
                  onValueChange={(v) => setSelectedUser({ ...selectedUser, status_aprovacao: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pendente">Pendente</SelectItem>
                    <SelectItem value="Aprovado">Aprovado</SelectItem>
                    <SelectItem value="Rejeitado">Rejeitado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Cargo</Label>
                <Select
                  value={selectedUser.cargo || ''}
                  onValueChange={(v) => setSelectedUser({ ...selectedUser, cargo: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {CARGOS.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedCargoConfig?.requiresStore && (
                <div className={`${selectedUser.cargo === 'Gerente' ? 'p-3 bg-orange-50 rounded-lg border border-orange-200' : ''}`}>
                  <Label className={selectedUser.cargo === 'Gerente' ? 'text-orange-700 font-semibold' : ''}>
                    {selectedUser.cargo === 'Gerente' ? '⚠️ Loja que o Gerente irá gerenciar' : 'Loja'}
                  </Label>
                  {selectedUser.cargo === 'Gerente' && (
                    <p className="text-xs text-orange-600 mb-2">
                      Este gerente só verá dados da loja selecionada abaixo.
                    </p>
                  )}
                  <Select
                    value={selectedUser.loja || ''}
                    onValueChange={(v) => setSelectedUser({ ...selectedUser, loja: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione a loja" /></SelectTrigger>
                    <SelectContent>
                      {LOJAS.map(l => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedUser.cargo === 'Gerente Geral' && (
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm text-green-700 font-medium">
                    ✓ Gerente Geral tem acesso a todas as lojas
                  </p>
                </div>
              )}

              <div className="p-4 rounded-xl bg-blue-50 border-2 border-blue-200">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={selectedUser.is_vendedor}
                    onCheckedChange={(v) => setSelectedUser({ ...selectedUser, is_vendedor: v })}
                  />
                  <div>
                    <Label className="cursor-pointer font-semibold text-blue-700">Atua como Vendedor</Label>
                    <p className="text-xs text-gray-500 mt-1">Incluído no cálculo de comissões</p>
                  </div>
                </div>
                {selectedUser.is_vendedor && (
                  <div className="mt-3">
                    <Label>Meta Mensal (R$)</Label>
                    <Input
                      type="number"
                      value={selectedUser.meta_mensal || 0}
                      onChange={(e) => setSelectedUser({ ...selectedUser, meta_mensal: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                )}
              </div>

              {selectedCargoConfig && (
                <Alert style={{ backgroundColor: selectedCargoConfig.bgColor }}>
                  <Shield className="h-4 w-4" style={{ color: selectedCargoConfig.color }} />
                  <AlertDescription>
                    <strong>Permissões: </strong>
                    {selectedCargoConfig.permissions.join(', ')}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={updateUserMutation.isPending} className="bg-green-700 hover:bg-green-800">
              {updateUserMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes do Usuário</DialogTitle>
          </DialogHeader>
          {viewingUser && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold"
                  style={{ backgroundColor: getCargoConfig(viewingUser.cargo)?.bgColor || '#f3f4f6', color: getCargoConfig(viewingUser.cargo)?.color || '#6b7280' }}
                >
                  {viewingUser.full_name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div>
                  <h3 className="text-xl font-bold">{viewingUser.full_name}</h3>
                  <p className="text-gray-500">{viewingUser.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Status</Label><div className="mt-1">{getStatusBadge(viewingUser.status_aprovacao)}</div></div>
                <div><Label>Cargo</Label><div className="mt-1">{getRoleBadge(viewingUser.cargo)}</div></div>
                {viewingUser.loja && <div><Label>Loja</Label><div className="mt-1 flex items-center gap-1"><Store className="w-4 h-4" />{viewingUser.loja}</div></div>}
                <div><Label>Cadastrado em</Label><div className="mt-1 text-sm text-gray-600">{new Date(viewingUser.created_at).toLocaleDateString('pt-BR')}</div></div>
              </div>
              {viewingUser.is_vendedor && (
                <Alert className="bg-blue-50 border-blue-200">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    <strong>Vendedor Ativo</strong> - Meta: R$ {(viewingUser.meta_mensal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsViewModalOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permission Editor Modal */}
      {isPermissionModalOpen && permissionUser && (
        <PermissionEditorModal
          user={permissionUser}
          onClose={() => {
            setIsPermissionModalOpen(false);
            setPermissionUser(null);
          }}
          onSave={(customPermissions) => {
            updatePermissionsMutation.mutate({
              userId: permissionUser.id,
              customPermissions
            });
          }}
          isSaving={updatePermissionsMutation.isPending}
        />
      )}
    </div>
  );
}