
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Activity, 
  Search, 
  User, 
  Calendar,
  Plus,
  Edit,
  Trash2,
  CheckCircle2,
  XCircle,
  Ban,
  LogIn,
  LogOut,
  Clock
} from "lucide-react";

const actionIcons = {
  CREATE: Plus,
  UPDATE: Edit,
  DELETE: Trash2,
  APPROVE: CheckCircle2,
  REJECT: XCircle,
  CANCEL: Ban,
  LOGIN: LogIn,
  LOGOUT: LogOut
};

const actionColors = {
  CREATE: { bg: "#D1FAE5", text: "#065F46", border: "#10B981" },
  UPDATE: { bg: "#DBEAFE", text: "#1E40AF", border: "#3B82F6" },
  DELETE: { bg: "#FEE2E2", text: "#991B1B", border: "#EF4444" },
  APPROVE: { bg: "#D1FAE5", text: "#065F46", border: "#10B981" },
  REJECT: { bg: "#FEE2E2", text: "#991B1B", border: "#EF4444" },
  CANCEL: { bg: "#FEF3C7", text: "#92400E", border: "#F59E0B" },
  LOGIN: { bg: "#E0E7FF", text: "#3730A3", border: "#6366F1" },
  LOGOUT: { bg: "#F3F4F6", text: "#4B5563", border: "#9CA3AF" }
};

const cargoColors = {
  Administrador: "#dc2626",
  Gerente: "#07593f",
  Vendedor: "#f38a4c",
  Estoque: "#2563eb"
};

export default function AuditLogTab({ logs, isLoading, users }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterAction, setFilterAction] = useState("all");
  const [filterEntity, setFilterEntity] = useState("all");
  const [filterUser, setFilterUser] = useState("all");

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entity_description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = filterAction === "all" || log.action === filterAction;
    const matchesEntity = filterEntity === "all" || log.entity_type === filterEntity;
    const matchesUser = filterUser === "all" || log.user_email === filterUser;
    
    return matchesSearch && matchesAction && matchesEntity && matchesUser;
  });

  const uniqueEntities = [...new Set(logs.map(log => log.entity_type))].filter(Boolean);
  const uniqueActions = [...new Set(logs.map(log => log.action))];

  const getActionBadge = (action) => {
    const Icon = actionIcons[action] || Activity;
    const colors = actionColors[action] || { bg: "#F3F4F6", text: "#4B5563", border: "#9CA3AF" };
    
    return (
      <Badge 
        className="flex items-center gap-1"
        style={{ 
          backgroundColor: colors.bg, 
          color: colors.text,
          border: `1px solid ${colors.border}40`
        }}
      >
        <Icon className="w-3 h-3" />
        {action}
      </Badge>
    );
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const isToday = date.toDateString() === today.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    if (isToday) return `Hoje às ${time}`;
    if (isYesterday) return `Ontem às ${time}`;
    return date.toLocaleString('pt-BR');
  };

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" style={{ color: '#07593f' }} />
            Log de Auditoria do Sistema
          </CardTitle>
          <CardDescription>
            Registro completo de todas as ações realizadas no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: '#8B8B8B' }} />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger>
                <SelectValue placeholder="Ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Ações</SelectItem>
                {uniqueActions.map(action => (
                  <SelectItem key={action} value={action}>{action}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterEntity} onValueChange={setFilterEntity}>
              <SelectTrigger>
                <SelectValue placeholder="Entidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Entidades</SelectItem>
                {uniqueEntities.map(entity => (
                  <SelectItem key={entity} value={entity}>{entity}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterUser} onValueChange={setFilterUser}>
              <SelectTrigger>
                <SelectValue placeholder="Usuário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Usuários</SelectItem>
                {users.map(user => (
                  <SelectItem key={user.email} value={user.email}>
                    {user.full_name}
                  </SelectItem>
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
      ) : filteredLogs.length === 0 ? (
        <Card className="border-0 shadow-lg">
          <CardContent className="p-12 text-center">
            <Activity className="w-16 h-16 mx-auto mb-4 opacity-20" style={{ color: '#07593f' }} />
            <p className="text-xl" style={{ color: '#8B8B8B' }}>
              Nenhum registro encontrado
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log) => (
            <Card key={log.id} className="border-0 shadow-md hover:shadow-lg transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ 
                      backgroundColor: `${cargoColors[log.user_cargo] || '#8B8B8B'}20`,
                      border: `2px solid ${cargoColors[log.user_cargo] || '#8B8B8B'}40`
                    }}
                  >
                    <User className="w-5 h-5" style={{ color: cargoColors[log.user_cargo] || '#8B8B8B' }} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between flex-wrap">
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-semibold" style={{ color: '#07593f' }}>
                            {log.user_name}
                          </span>
                          {log.user_cargo && (
                            <Badge 
                              variant="outline" 
                              className="text-xs"
                              style={{ 
                                color: cargoColors[log.user_cargo],
                                borderColor: `${cargoColors[log.user_cargo]}40`
                              }}
                            >
                              {log.user_cargo}
                            </Badge>
                          )}
                          {getActionBadge(log.action)}
                          <Badge variant="outline" className="text-xs">
                            {log.entity_type}
                          </Badge>
                        </div>
                        
                        {log.entity_description && (
                          <p className="text-sm" style={{ color: '#4B5563' }}>
                            {log.entity_description}
                          </p>
                        )}
                        
                        {/* Show changes for UPDATE actions */}
                        {log.action === 'UPDATE' && log.changes && (
                          <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: '#f0f9ff' }}>
                            <p className="text-xs font-semibold mb-2" style={{ color: '#07593f' }}>
                              Alterações:
                            </p>
                            <div className="space-y-1">
                              {Object.entries(log.changes).map(([field, change]) => (
                                <div key={field} className="text-xs">
                                  <span className="font-semibold">{field}:</span>
                                  {' '}
                                  <span className="line-through text-red-600">
                                    {typeof change.before === 'object' 
                                      ? JSON.stringify(change.before) 
                                      : change.before || '(vazio)'}
                                  </span>
                                  {' → '}
                                  <span className="text-green-600 font-semibold">
                                    {typeof change.after === 'object' 
                                      ? JSON.stringify(change.after) 
                                      : change.after || '(vazio)'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs flex-shrink-0" style={{ color: '#8B8B8B' }}>
                        <Clock className="w-3 h-3" />
                        {formatTimestamp(log.timestamp)}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-sm">Estatísticas do Log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold" style={{ color: '#07593f' }}>
                {logs.length}
              </p>
              <p className="text-xs" style={{ color: '#8B8B8B' }}>Total de Ações</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">
                {logs.filter(l => l.action === 'CREATE').length}
              </p>
              <p className="text-xs" style={{ color: '#8B8B8B' }}>Criações</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">
                {logs.filter(l => l.action === 'UPDATE').length}
              </p>
              <p className="text-xs" style={{ color: '#8B8B8B' }}>Atualizações</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">
                {logs.filter(l => l.action === 'DELETE').length}
              </p>
              <p className="text-xs" style={{ color: '#8B8B8B' }}>Exclusões</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
