import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { base44, supabase } from "@/api/base44Client";
import { AlertCircle, CheckCircle, Copy, User, Building2, Briefcase, Mail } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getZapApiUrl } from "@/utils/zapApiUrl";
import { toast } from "sonner";

// Cargos que NÃO precisam de loja (acessam tudo ou setor específico)
// Entregadores e Montadores trabalham para todas as lojas
const CARGOS_SEM_LOJA = ['Administrador', 'Gerente Geral', 'Financeiro', 'RH', 'Estoque', 'Logística', 'Agendamento', 'Entregador', 'Montador Externo'];

// Lista de cargos disponíveis
const CARGOS_DISPONIVEIS = [
  { value: 'Administrador', label: 'Administrador', desc: 'Acesso total ao sistema' },
  { value: 'Gerente Geral', label: 'Gerente Geral', desc: 'Vê todas as lojas' },
  { value: 'Gerente', label: 'Gerente de Loja', desc: 'Gerencia uma loja específica' },
  { value: 'Vendedor', label: 'Vendedor', desc: 'Vendas na loja' },
  { value: 'Estoque', label: 'Estoque', desc: 'Gestão de estoque' },
  { value: 'Financeiro', label: 'Financeiro', desc: 'Setor financeiro' },
  { value: 'Logística', label: 'Logística', desc: 'Entregas e montagens' },
  { value: 'Entregador', label: 'Entregador', desc: 'App de entregas' },
  { value: 'Montador Externo', label: 'Montador Externo', desc: 'App de montagem' },
  { value: 'RH', label: 'RH', desc: 'Recursos humanos' },
  { value: 'Agendamento', label: 'Agendamento', desc: 'Agendamentos' },
];

export default function NovoUsuarioModal({ isOpen, onClose }) {
  const [formData, setFormData] = useState({
    email: "",
    full_name: "",
    cargo: "Vendedor",
    loja: ""
  });
  const [error, setError] = useState("");
  const [credenciais, setCredenciais] = useState(null); // { matricula, senha_temporaria }
  const [copiado, setCopiado] = useState(false);
  const queryClient = useQueryClient();

  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas'],
    queryFn: () => base44.entities.Loja.list('nome'),
    select: (data) => data.filter(l => l.is_active !== false),
  });

  const precisaLoja = !CARGOS_SEM_LOJA.includes(formData.cargo);

  const createUserMutation = useMutation({
    mutationFn: async (userData) => {
      // Gera uma senha temporária aleatória
      const senhaTemp = 'Temp' + Math.random().toString(36).substring(2, 8) + '1';

      // Cria o usuário via Supabase Auth
      const { data: authUser, error: authError } = await base44.auth.signUp({
        email: userData.email,
        password: senhaTemp
      });

      if (authError) throw new Error(authError.message);

      if (!authUser?.user?.id) {
        throw new Error("Supabase não retornou um ID de usuário válido.");
      }

      // Define o setor baseado no cargo
      const setorMap = {
        'Administrador': 'AD',
        'Gerente Geral': 'GG',
        'Gerente': 'GE',
        'Vendedor': 'VE',
        'Estoque': 'ES',
        'Financeiro': 'FI',
        'Logística': 'LO',
        'Entregador': 'EN',
        'Montador Externo': 'MO',
        'RH': 'RH',
        'Agendamento': 'AG'
      };
      const setor = setorMap[userData.cargo] || 'AD';

      // Cria credenciais via backend (gera matrícula)
      const apiUrl = getZapApiUrl();
      const response = await fetch(`${apiUrl}/api/auth/employee/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer temp-admin-token`
        },
        body: JSON.stringify({
          user_id: authUser.user.id,
          setor_code: setor
        })
      });

      if (!response.ok) {
        // Se falha ao gerar matrícula, ainda salva o usuário
        console.warn('Falha ao gerar matrícula, salvando sem matrícula');
      }

      const credenciaisData = response.ok ? await response.json() : null;

      // Cria o registro na tabela public_users
      const userPayload = {
        id: authUser.user.id,
        email: userData.email,
        full_name: userData.full_name,
        cargo: userData.cargo,
        loja: userData.loja || null,
        status_aprovacao: 'Aprovado',
        is_vendedor: userData.cargo === 'Vendedor',
        meta_mensal: 0,
        ativo: true,
        primeiro_acesso: true,
        matricula: credenciaisData?.matricula || null,
        // senha_hash removido daqui para não sobrescrever o que o backend gerou
      };

      try {
        // Usar upsert ao invés de create porque o trigger on_auth_user_created
        // já cria um registro básico em public_users automaticamente
        const { data: user, error } = await supabase
          .from('public_users')
          .upsert(userPayload, { onConflict: 'id' })
          .select()
          .single();

        if (error) throw error;

        return {
          user,
          matricula: credenciaisData?.matricula,
          senha_temporaria: credenciaisData?.senha_temporaria || senhaTemp
        };
      } catch (error) {
        console.error('Erro ao criar/atualizar usuário:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setCredenciais({
        matricula: data.matricula,
        senha_temporaria: data.senha_temporaria
      });
    },
    onError: (err) => {
      setError(err.message || "Erro ao criar usuário");
    }
  });

  const handleClose = () => {
    setFormData({
      email: "",
      full_name: "",
      cargo: "Vendedor",
      loja: ""
    });
    setError("");
    setCredenciais(null);
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (!formData.email || !formData.full_name) {
      setError("Preenchimento obrigatório: Nome e Email");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError("Email inválido");
      return;
    }

    if (precisaLoja && !formData.loja) {
      setError(`O cargo ${formData.cargo} precisa de uma loja associada`);
      return;
    }

    createUserMutation.mutate({
      email: formData.email.toLowerCase(),
      full_name: formData.full_name,
      cargo: formData.cargo,
      loja: precisaLoja ? formData.loja : null
    });
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError("");
  };

  const copiarCredenciais = () => {
    if (credenciais) {
      const texto = `
*Credenciais de Acesso - Móveis Pedro II*
👤 Nome: ${formData.full_name}
🆔 Matrícula: ${credenciais.matricula || 'N/A'}
🔑 Senha Temporária: ${credenciais.senha_temporaria}

Acesse: ${window.location.origin}/login
`.trim();

      navigator.clipboard.writeText(texto);
      toast.success("Credenciais copiadas!");

      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-white">
            Adicionar Novo Funcionário
          </DialogTitle>
        </DialogHeader>

        {credenciais ? (
          <div className="py-6">
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  Funcionário criado com sucesso!
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Passe as credenciais abaixo para o funcionário:
                </p>
              </div>

              <div className="w-full bg-gray-50 dark:bg-neutral-800 rounded-lg p-4 mt-2">
                <div className="space-y-3">
                  {credenciais.matricula && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Matrícula:</span>
                      <span className="font-mono font-bold text-lg text-green-600">{credenciais.matricula}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Senha Temporária:</span>
                    <span className="font-mono font-bold text-lg text-orange-600">{credenciais.senha_temporaria}</span>
                  </div>
                </div>
              </div>

              <Alert className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-700 dark:text-amber-400">
                  No primeiro login, o funcionário deverá criar sua própria senha.
                </AlertDescription>
              </Alert>

              <div className="flex gap-2 w-full mt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={copiarCredenciais}
                >
                  {copiado ? <CheckCircle className="w-4 h-4 mr-2 text-green-600" /> : <Copy className="w-4 h-4 mr-2" />}
                  {copiado ? "Copiado!" : "Copiar Credenciais"}
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={handleClose}
                >
                  Concluir
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive" className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                <AlertDescription className="text-red-700 dark:text-red-400">{error}</AlertDescription>
              </Alert>
            )}

            <div>
              <Label htmlFor="name" className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <User className="w-4 h-4" />
                Nome Completo *
              </Label>
              <Input
                id="name"
                value={formData.full_name}
                onChange={(e) => handleChange("full_name", e.target.value)}
                placeholder="Ex: João Silva"
                className="mt-1 border-gray-200 dark:border-neutral-700"
              />
            </div>

            <div>
              <Label htmlFor="email" className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email *
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="Ex: joao@moveispedroii.com.br"
                className="mt-1 border-gray-200 dark:border-neutral-700"
              />
            </div>

            <div>
              <Label htmlFor="cargo" className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                Cargo *
              </Label>
              <Select value={formData.cargo} onValueChange={(value) => handleChange("cargo", value)}>
                <SelectTrigger className="mt-1 border-gray-200 dark:border-neutral-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CARGOS_DISPONIVEIS.map((cargo) => (
                    <SelectItem key={cargo.value} value={cargo.value}>
                      <div className="flex flex-col">
                        <span>{cargo.label}</span>
                        <span className="text-xs text-gray-500">{cargo.desc}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {precisaLoja && (
              <div>
                <Label htmlFor="loja" className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Loja *
                </Label>
                <Select value={formData.loja} onValueChange={(value) => handleChange("loja", value)}>
                  <SelectTrigger className="mt-1 border-gray-200 dark:border-neutral-700">
                    <SelectValue placeholder="Selecione a loja" />
                  </SelectTrigger>
                  <SelectContent>
                    {lojas.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">Carregando...</div>
                    ) : (
                      lojas.map((loja) => (
                        <SelectItem key={loja.id} value={loja.nome}>
                          {loja.nome}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  {formData.cargo === 'Gerente'
                    ? 'O gerente só verá dados desta loja'
                    : 'Loja onde o funcionário trabalha'
                  }
                </p>
              </div>
            )}

            <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-700 dark:text-blue-400 text-sm">
                Uma senha temporária será gerada automaticamente. O funcionário criará sua própria senha no primeiro acesso.
              </AlertDescription>
            </Alert>

            <DialogFooter className="gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="border-gray-200 dark:border-neutral-700"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createUserMutation.isPending}
                className="bg-green-700 hover:bg-green-800 text-white"
              >
                {createUserMutation.isPending ? "Criando..." : "Criar Funcionário"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
