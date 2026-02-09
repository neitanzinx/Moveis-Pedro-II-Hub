import React, { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { base44, supabase } from "@/api/base44Client";
import { Truck, User, Mail, Phone, Building2, Briefcase, KeyRound, RotateCcw, Copy, Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

// Função para gerar matrícula no padrão MP-XX0001
async function gerarMatricula(setorCode) {
  // Buscar a maior matrícula existente para este setor
  const { data: existingMatriculas, error } = await supabase
    .from('public_users')
    .select('matricula')
    .like('matricula', `MP-${setorCode}%`)
    .order('matricula', { ascending: false })
    .limit(1);

  if (error) {
    console.error("Erro ao buscar matrículas:", error);
  }

  let nextNumber = 1;
  if (existingMatriculas && existingMatriculas.length > 0) {
    const lastMatricula = existingMatriculas[0].matricula; // MP-VE0005
    const lastNumberStr = lastMatricula.replace(`MP-${setorCode}`, ''); // 0005
    const lastNumber = parseInt(lastNumberStr, 10);
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

  // Formatar com 4 dígitos: 0001, 0002, etc.
  const matricula = `MP-${setorCode}${nextNumber.toString().padStart(4, '0')}`;
  return matricula;
}

export default function ModalUsuario({ usuario, cargos, caminhoes, onClose }) {
  const isEditing = !!usuario;
  const [dados, setDados] = useState({
    full_name: usuario?.full_name || "",
    email: usuario?.email || "",
    telefone: usuario?.telefone || "",
    cargo: usuario?.cargo || "Vendedor",
    loja: usuario?.loja || "",
    ativo: usuario?.ativo ?? true
  });
  const [resetandoSenha, setResetandoSenha] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState(null);
  const [generatedMatricula, setGeneratedMatricula] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const queryClient = useQueryClient();

  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas'],
    queryFn: () => base44.entities.Loja.list('nome'),
    select: (data) => data.filter(l => l.is_active !== false),
  });

  const precisaLoja = !CARGOS_SEM_LOJA.includes(dados.cargo);

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // 1. Verificar se email já existe no public_users
      const { data: existingUser } = await supabase
        .from('public_users')
        .select('id, email')
        .eq('email', data.email)
        .maybeSingle();

      if (existingUser) {
        throw new Error("Este email já está cadastrado no sistema.");
      }

      // 2. Criar cliente temporário para signup (evita sobrescrever sessão atual)
      const tempSupabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        { auth: { persistSession: false, storageKey: 'temp-signup-session' } }
      );

      // 3. SignUp no Supabase Auth
      const senhaTemp = 'Temp' + Math.random().toString(36).substring(2, 8) + '1';
      console.log('[SignUp] Criando usuário:', data.email);

      const { data: authUser, error: authError } = await tempSupabase.auth.signUp({
        email: data.email,
        password: senhaTemp
      });

      if (authError) {
        console.error('[SignUp] Erro:', authError);
        if (authError.message?.includes('already registered') || authError.status === 422) {
          throw new Error("Este email já está cadastrado no sistema.");
        }
        throw new Error(authError.message);
      }

      if (!authUser?.user?.id) {
        throw new Error("Erro ao criar usuário: ID não retornado.");
      }

      // Supabase retorna identities vazio se email já existe
      if (authUser?.user?.identities?.length === 0) {
        throw new Error("Este email já está cadastrado no sistema.");
      }

      // 4. Gerar matrícula
      const setorMap = {
        'Administrador': 'AD', 'Gerente Geral': 'GG', 'Gerente': 'GE',
        'Vendedor': 'VE', 'Estoque': 'ES', 'Financeiro': 'FI',
        'Logística': 'LO', 'Entregador': 'EN', 'Montador': 'LO',
        'Montador Externo': 'MO', 'RH': 'RH', 'Agendamento': 'AG'
      };
      const setor = setorMap[data.cargo] || 'AD';
      const matricula = await gerarMatricula(setor);

      // 5. Criar registro em public_users (upsert para lidar com registros órfãos)
      const isVendedor = data.cargo === 'Vendedor';
      const userPayload = {
        id: authUser.user.id,
        email: data.email,
        full_name: data.full_name,
        cargo: data.cargo,
        loja: precisaLoja ? data.loja : null,
        ativo: true,
        primeiro_acesso: true,
        matricula: matricula,
        is_vendedor: isVendedor,
        meta_mensal: 0
      };

      console.log('[SignUp] Inserindo em public_users:', userPayload);

      const { error: insertError } = await supabase
        .from('public_users')
        .upsert(userPayload, {
          onConflict: 'id',
          ignoreDuplicates: false
        });

      if (insertError) {
        console.error('[SignUp] Erro no insert:', insertError);
        throw new Error(insertError.message);
      }

      console.log('[SignUp] Sucesso!');
      return {
        matricula: matricula,
        senha_temporaria: senhaTemp
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      setGeneratedMatricula(data.matricula);
      setGeneratedPassword(data.senha_temporaria);
      toast.success('Usuário criado com sucesso!');
    },
    onError: (error) => {
      console.error('[CreateUser] Erro:', error);
      toast.error("Erro ao criar usuário: " + error.message);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const dadosUsuario = {
        full_name: data.full_name,
        telefone: data.telefone,
        cargo: data.cargo,
        loja: precisaLoja ? data.loja : null,
        ativo: data.ativo,
        is_vendedor: data.cargo === 'Vendedor'
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

  const handleSave = () => {
    if (isEditing) {
      updateMutation.mutate(dados);
    } else {
      createMutation.mutate(dados);
    }
  };



  // Se acabou de criar sucesso
  if (generatedPassword) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="w-6 h-6" />
              Usuário Criado com Sucesso!
            </DialogTitle>
          </DialogHeader>

          <div className="bg-green-50 p-6 rounded-xl border border-green-200 mt-2 space-y-4">
            <p className="text-green-800 text-sm">
              O usuário foi criado e já pode acessar o sistema. Envie as credenciais abaixo:
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-lg border shadow-sm">
                <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Matrícula</span>
                <div className="flex justify-between items-center mt-1">
                  <code className="text-xl font-bold text-gray-800">{generatedMatricula || 'N/A'}</code>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-green-600" onClick={() => copyToClipboard(generatedMatricula, 'Matrícula')}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg border shadow-sm">
                <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Senha Temporária</span>
                <div className="flex justify-between items-center mt-1">
                  <div className="flex items-center gap-2">
                    <code className="text-xl font-bold text-gray-800 tracking-wider">
                      {showPassword ? generatedPassword : '••••••••'}
                    </code>
                    <button onClick={() => setShowPassword(!showPassword)} className="text-gray-400 hover:text-green-600 focus:outline-none">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-green-600" onClick={() => copyToClipboard(generatedPassword, 'Senha')}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-green-700 bg-green-100 p-2 rounded">
              <AlertDescription>
                Esta senha é temporária e o usuário deverá alterá-la no primeiro acesso.
              </AlertDescription>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={onClose} className="bg-green-600 hover:bg-green-700 w-full md:w-auto">
              Concluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            {isEditing ? "Editar Usuário" : "Novo Usuário"}
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
                Email *
              </Label>
              <Input
                type="email"
                value={dados.email}
                onChange={!isEditing ? (e) => setDados({ ...dados, email: e.target.value }) : undefined}
                disabled={isEditing}
                placeholder="email@empresa.com"
                className="mt-1 disabled:bg-gray-50"
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
            onClick={handleSave}
            disabled={!dados.full_name || !dados.email || (precisaLoja && !dados.loja) || updateMutation.isPending || createMutation.isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            {updateMutation.isPending || createMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : 'Salvar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}