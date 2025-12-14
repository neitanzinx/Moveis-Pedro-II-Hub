import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, UserCheck, Users, Store, Lock, Check, X } from "lucide-react";

const roles = [
  { 
    value: "Administrador", 
    label: "Administrador", 
    icon: Shield, 
    color: "#dc2626",
    description: "Controle total sobre o sistema",
    permissions: {
      produtos: { create: true, read: true, update: true, delete: true },
      clientes: { create: true, read: true, update: true, delete: true },
      vendas: { create: true, read: true, update: true, delete: true, cancel: true },
      orcamentos: { create: true, read: true, update: true, delete: true },
      entregas: { create: true, read: true, update: true, delete: true },
      devolucoes: { create: true, read: true, update: true, delete: true, approve: true },
      financeiro: { read: true, update: true },
      comissoes: { read: true },
      usuarios: { create: true, read: true, update: true, delete: false },
      configuracoes: { read: true, update: true }
    }
  },
  { 
    value: "Gerente", 
    label: "Gerente", 
    icon: UserCheck, 
    color: "#07593f",
    description: "Gestão completa da loja",
    permissions: {
      produtos: { create: true, read: true, update: true, delete: false },
      clientes: { create: true, read: true, update: true, delete: true },
      vendas: { create: true, read: true, update: true, delete: false, cancel: false },
      orcamentos: { create: true, read: true, update: true, delete: true },
      entregas: { create: true, read: true, update: true, delete: true },
      devolucoes: { create: true, read: true, update: true, delete: false, approve: true },
      financeiro: { read: true, update: true },
      comissoes: { read: false },
      usuarios: { create: false, read: false, update: false, delete: false },
      configuracoes: { read: false, update: false }
    }
  },
  { 
    value: "Vendedor", 
    label: "Vendedor", 
    icon: Users, 
    color: "#f38a4c",
    description: "Vendas e atendimento ao cliente",
    permissions: {
      produtos: { create: false, read: true, update: false, delete: false },
      clientes: { create: true, read: true, update: true, delete: false },
      vendas: { create: true, read: true, update: true, delete: false, cancel: false },
      orcamentos: { create: true, read: true, update: true, delete: false },
      entregas: { create: false, read: true, update: false, delete: false },
      devolucoes: { create: true, read: true, update: true, delete: false, approve: false },
      financeiro: { read: false, update: false },
      comissoes: { read: false },
      usuarios: { create: false, read: false, update: false, delete: false },
      configuracoes: { read: false, update: false }
    }
  },
  { 
    value: "Estoque", 
    label: "Estoque", 
    icon: Store, 
    color: "#2563eb",
    description: "Gerenciamento de produtos e entregas",
    permissions: {
      produtos: { create: true, read: true, update: true, delete: false },
      clientes: { create: false, read: false, update: false, delete: false },
      vendas: { create: false, read: false, update: false, delete: false, cancel: false },
      orcamentos: { create: false, read: false, update: false, delete: false },
      entregas: { create: true, read: true, update: true, delete: false },
      devolucoes: { create: false, read: false, update: false, delete: false, approve: false },
      financeiro: { read: false, update: false },
      comissoes: { read: false },
      usuarios: { create: false, read: false, update: false, delete: false },
      configuracoes: { read: false, update: false }
    }
  }
];

const entities = [
  { name: "Produtos", key: "produtos" },
  { name: "Clientes", key: "clientes" },
  { name: "Vendas", key: "vendas" },
  { name: "Orçamentos", key: "orcamentos" },
  { name: "Entregas", key: "entregas" },
  { name: "Devoluções", key: "devolucoes" },
  { name: "Financeiro", key: "financeiro" },
  { name: "Comissões", key: "comissoes" },
  { name: "Usuários", key: "usuarios" },
  { name: "Configurações", key: "configuracoes" }
];

const actions = [
  { name: "Criar", key: "create" },
  { name: "Ler", key: "read" },
  { name: "Editar", key: "update" },
  { name: "Deletar", key: "delete" },
  { name: "Aprovar", key: "approve" },
  { name: "Cancelar", key: "cancel" }
];

export default function RolesPermissionsTab() {
  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" style={{ color: '#07593f' }} />
            Sistema de Cargos e Permissões
          </CardTitle>
          <CardDescription>
            Visão geral das permissões granulares por cargo no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {roles.map(role => {
              const Icon = role.icon;
              return (
                <Card key={role.value} className="border-2" style={{ borderColor: `${role.color}40` }}>
                  <CardHeader>
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="w-5 h-5" style={{ color: role.color }} />
                      <CardTitle className="text-base" style={{ color: role.color }}>
                        {role.label}
                      </CardTitle>
                    </div>
                    <CardDescription className="text-xs">
                      {role.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2" style={{ borderColor: '#E5E0D8' }}>
                  <th className="text-left p-3 font-semibold" style={{ color: '#07593f' }}>
                    Módulo / Ação
                  </th>
                  {roles.map(role => (
                    <th key={role.value} className="text-center p-3">
                      <div className="flex items-center justify-center gap-2">
                        <role.icon className="w-4 h-4" style={{ color: role.color }} />
                        <span className="text-xs font-medium" style={{ color: role.color }}>
                          {role.label}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entities.map(entity => (
                  <React.Fragment key={entity.key}>
                    <tr className="border-t" style={{ borderColor: '#E5E0D8', backgroundColor: '#FAF8F5' }}>
                      <td colSpan={roles.length + 1} className="p-3 font-semibold" style={{ color: '#07593f' }}>
                        {entity.name}
                      </td>
                    </tr>
                    {actions.map(action => {
                      const hasAnyPermission = roles.some(role => 
                        role.permissions[entity.key]?.[action.key]
                      );
                      
                      if (!hasAnyPermission) return null;

                      return (
                        <tr key={`${entity.key}-${action.key}`} className="border-t hover:bg-gray-50" style={{ borderColor: '#E5E0D8' }}>
                          <td className="p-3 pl-6 text-sm" style={{ color: '#8B8B8B' }}>
                            {action.name}
                          </td>
                          {roles.map(role => {
                            const hasPermission = role.permissions[entity.key]?.[action.key];
                            return (
                              <td key={role.value} className="p-3 text-center">
                                {hasPermission ? (
                                  <Check className="w-5 h-5 mx-auto text-green-600" />
                                ) : (
                                  <X className="w-5 h-5 mx-auto text-red-400 opacity-30" />
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Notas Importantes sobre Permissões</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm" style={{ color: '#8B8B8B' }}>
            <div className="flex items-start gap-2">
              <Badge className="mt-0.5" style={{ backgroundColor: '#07593f' }}>RLS</Badge>
              <p>
                <strong>Row Level Security (RLS):</strong> Todas as permissões são aplicadas no nível do banco de dados através do sistema RLS do Base44, garantindo segurança mesmo em caso de bugs no frontend.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Badge className="mt-0.5" style={{ backgroundColor: '#f38a4c' }}>Devoluções</Badge>
              <p>
                <strong>Aprovação de Devoluções:</strong> Apenas Administradores e Gerentes podem aprovar ou rejeitar devoluções. Vendedores podem criar e editar apenas suas próprias devoluções pendentes.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Badge className="mt-0.5" style={{ backgroundColor: '#2563eb' }}>Vendas</Badge>
              <p>
                <strong>Edição de Vendas:</strong> Vendedores podem editar apenas suas próprias vendas que não foram canceladas. Gerentes e Administradores podem editar qualquer venda.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Badge className="mt-0.5" style={{ backgroundColor: '#dc2626' }}>Deletar</Badge>
              <p>
                <strong>Exclusão de Registros:</strong> A maioria das exclusões é restrita apenas a Administradores para evitar perda acidental de dados críticos.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Badge className="mt-0.5" style={{ backgroundColor: '#07593f' }}>Loja</Badge>
              <p>
                <strong>Filtro por Loja:</strong> Gerentes, Vendedores e Estoquistas veem apenas dados da loja à qual estão vinculados. Administradores veem todas as lojas.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}