import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ShieldCheck, Search, User, Calendar, Edit, Trash2, 
  CheckCircle, XCircle, UserPlus, LogIn, LogOut 
} from "lucide-react";
import { format } from "date-fns";

const actionIcons = {
  CREATE: UserPlus,
  UPDATE: Edit,
  DELETE: Trash2,
  APPROVE: CheckCircle,
  REJECT: XCircle,
  CANCEL: XCircle,
  LOGIN: LogIn,
  LOGOUT: LogOut
};

const actionColors = {
  CREATE: 'bg-green-100 text-green-700 border-green-300',
  UPDATE: 'bg-blue-100 text-blue-700 border-blue-300',
  DELETE: 'bg-red-100 text-red-700 border-red-300',
  APPROVE: 'bg-green-100 text-green-700 border-green-300',
  REJECT: 'bg-red-100 text-red-700 border-red-300',
  CANCEL: 'bg-orange-100 text-orange-700 border-orange-300',
  LOGIN: 'bg-purple-100 text-purple-700 border-purple-300',
  LOGOUT: 'bg-gray-100 text-gray-700 border-gray-300'
};

export default function AuditLogPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterAction, setFilterAction] = useState("all");
  const [filterEntity, setFilterEntity] = useState("all");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => base44.entities.AuditLog.list('-timestamp', 200),
    initialData: [],
    refetchInterval: 10000
  });

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entity_description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = filterAction === "all" || log.action === filterAction;
    const matchesEntity = filterEntity === "all" || log.entity_type === filterEntity;

    return matchesSearch && matchesAction && matchesEntity;
  });

  const entityTypes = [...new Set(logs.map(l => l.entity_type))].filter(Boolean);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-green-700" />
          Registro de Auditoria
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Histórico completo de todas as ações realizadas no sistema
        </p>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder="Buscar usuário ou ação..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo de Ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Ações</SelectItem>
                <SelectItem value="CREATE">Criar</SelectItem>
                <SelectItem value="UPDATE">Editar</SelectItem>
                <SelectItem value="DELETE">Deletar</SelectItem>
                <SelectItem value="APPROVE">Aprovar</SelectItem>
                <SelectItem value="REJECT">Rejeitar</SelectItem>
                <SelectItem value="CANCEL">Cancelar</SelectItem>
                <SelectItem value="LOGIN">Login</SelectItem>
                <SelectItem value="LOGOUT">Logout</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterEntity} onValueChange={setFilterEntity}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo de Entidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Entidades</SelectItem>
                {entityTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
        </div>
      ) : (
        <Card className="border-0 shadow-lg">
          <CardContent className="p-0">
            <div className="divide-y divide-gray-200 dark:divide-neutral-800">
              {filteredLogs.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <ShieldCheck className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p>Nenhum registro encontrado</p>
                </div>
              ) : (
                filteredLogs.map(log => {
                  const ActionIcon = actionIcons[log.action] || Edit;
                  
                  return (
                    <div key={log.id} className="p-4 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors">
                      <div className="flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${actionColors[log.action] || 'bg-gray-100'}`}>
                          <ActionIcon className="w-5 h-5" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {log.user_name || 'Usuário Desconhecido'}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {log.user_cargo || 'Sem cargo'}
                            </Badge>
                            <Badge className={`text-xs ${actionColors[log.action]}`}>
                              {log.action}
                            </Badge>
                          </div>
                          
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            {log.entity_type && (
                              <span className="font-medium">{log.entity_type}</span>
                            )}
                            {log.entity_description && (
                              <span> - {log.entity_description}</span>
                            )}
                          </p>

                          {log.changes && Object.keys(log.changes).length > 0 && (
                            <div className="bg-gray-50 dark:bg-neutral-900 rounded p-2 text-xs mt-2">
                              <p className="font-semibold mb-1 text-gray-700 dark:text-gray-300">Alterações:</p>
                              {Object.entries(log.changes).map(([key, value]) => (
                                <div key={key} className="text-gray-600 dark:text-gray-400 mb-1">
                                  <span className="font-medium">{key}:</span>{' '}
                                  {value.before !== undefined && (
                                    <>
                                      <span className="line-through text-red-600">
                                        {JSON.stringify(value.before)}
                                      </span>
                                      {' → '}
                                    </>
                                  )}
                                  <span className="text-green-600">
                                    {JSON.stringify(value.after)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <div className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {log.user_email}
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {log.timestamp && format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm')}
                            </div>
                            {log.ip_address && (
                              <div className="text-gray-400">
                                IP: {log.ip_address}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}