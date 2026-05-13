import React, { useMemo, createElement } from "react";
import { CARGOS } from "@/config/cargos";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

export default function ConfiguracaoPapeisSistema() {
  const rolesInfo = useMemo(() => {
    return CARGOS.filter((c) => c?.value).map((c) => ({
      value: c.value,
      label: c.label,
      icon: c.icon,
      color: c.color,
      bgColor: c.bgColor,
      description: c.description,
      permissions: c.permissions || [],
      requiresStore: c.requiresStore,
      canRegister: c.canRegister,
      mobileAppOnly: c.mobileAppOnly,
      prefix: c.prefix,
    }));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Papéis do Sistema</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Visualize os papéis (roles) disponíveis que podem ser atribuídos aos colaboradores para definir suas permissões no sistema.
        </p>
      </div>

      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          <strong>Como funciona:</strong> Um colaborador pode ter múltiplos papéis atribuídos simultaneamente. 
          Os papéis definem as permissões e acessos que o colaborador terá no sistema. 
          O campo "Descrição do Cargo" (ex: Gerente de Loja) é separado e serve para descrever a função do colaborador no RH.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 gap-4">
        {rolesInfo.map((role) => (
          <Card key={role.value} className="overflow-hidden border-l-4" style={{ borderLeftColor: role.color }}>
            <CardHeader className="pb-3" style={{ backgroundColor: role.bgColor }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  {createElement(role.icon, {
                    className: "w-6 h-6",
                    style: { color: role.color },
                  })}
                  <div>
                    <CardTitle className="text-lg">{role.label}</CardTitle>
                    <CardDescription className="mt-1">{role.description}</CardDescription>
                  </div>
                </div>
                <Badge style={{ backgroundColor: role.color, color: 'white' }} className="whitespace-nowrap">
                  {role.value}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="pt-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Permissões</p>
                  <ul className="space-y-1">
                    {role.permissions && role.permissions.length > 0 ? (
                      role.permissions.map((perm, idx) => (
                        <li key={idx} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                          <span className="text-green-600 mt-1">✓</span>
                          {perm}
                        </li>
                      ))
                    ) : (
                      <li className="text-sm text-gray-500 italic">Nenhuma permissão específica listada</li>
                    )}
                  </ul>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Características</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700 dark:text-gray-300">Requer Loja:</span>
                      <Badge variant={role.requiresStore ? "default" : "secondary"} className="text-xs">
                        {role.requiresStore ? "Sim" : "Não"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700 dark:text-gray-300">Auto-cadastro permitido:</span>
                      <Badge variant={role.canRegister ? "default" : "secondary"} className="text-xs">
                        {role.canRegister ? "Sim" : "Não"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700 dark:text-gray-300">Apenas App Mobile:</span>
                      <Badge variant={role.mobileAppOnly ? "default" : "secondary"} className="text-xs">
                        {role.mobileAppOnly ? "Sim" : "Não"}
                      </Badge>
                    </div>
                    {role.prefix && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-700 dark:text-gray-300">Prefixo ID:</span>
                        <Badge variant="outline" className="text-xs font-mono">
                          {role.prefix}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Alert className="bg-amber-50 border-amber-200">
        <Info className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          <strong>Nota:</strong> Para adicionar ou modificar papéis do sistema, edite o arquivo de configuração <code className="bg-amber-100 px-1 rounded">src/config/cargos.js</code>.
        </AlertDescription>
      </Alert>
    </div>
  );
}
