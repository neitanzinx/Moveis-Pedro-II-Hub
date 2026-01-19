import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { AlertCircle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function NovoUsuarioModal({ isOpen, onClose }) {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    full_name: "",
    cargo: "Vendedor",
    loja: "Centro"
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const queryClient = useQueryClient();

  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas'],
    queryFn: () => base44.entities.Loja.list('nome'),
    select: (data) => data.filter(l => l.ativa),
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData) => {
      // Cria o usuário via Supabase Auth
      const { data: authUser, error: authError } = await base44.auth.signUp({
        email: userData.email,
        password: userData.password
      });

      if (authError) throw new Error(authError.message);

      console.log("Signup Result:", authUser); // Debug log

      if (!authUser?.user?.id) {
        throw new Error("Supabase não retornou um ID de usuário válido. Verifique se o cadastro foi realizado.");
      }

      // Cria o registro no banco de dados
      // Usuario criado pelo admin ja vem aprovado
      const userPayload = {
        id: authUser.user.id,
        email: userData.email,
        full_name: userData.full_name,
        cargo: userData.cargo,
        loja: userData.loja,
        status_aprovacao: 'Aprovado', // Admin cria usuarios ja aprovados
        is_vendedor: userData.cargo === 'Vendedor',
        meta_mensal: 0
      };

      console.log("Creating public user with payload:", userPayload);

      try {
        const user = await base44.entities.User.create(userPayload);
        return user;
      } catch (error) {
        console.error("Erro ao criar usuário na tabela pública:", error);

        // Erro de duplicidade (Postgres code 23505)
        if (error.code === '23505' || error.message?.includes('duplicate key')) {
          throw new Error("Este usuário já está cadastrado no sistema (Email já existente).");
        }

        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setSuccess(true);
      setTimeout(() => {
        handleClose();
      }, 2000);
    },
    onError: (err) => {
      setError(err.message || "Erro ao criar usuário");
    }
  });

  const handleClose = () => {
    setFormData({
      email: "",
      password: "",
      confirmPassword: "",
      full_name: "",
      cargo: "Vendedor",
      loja: "Centro"
    });
    setError("");
    setSuccess(false);
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    // Validações
    if (!formData.email || !formData.password || !formData.full_name) {
      setError("Preenchimento obrigatório: Email, Senha e Nome");
      return;
    }

    if (formData.password.length < 6) {
      setError("A senha deve ter no mínimo 6 caracteres");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("As senhas não coincidem");
      return;
    }

    // Validação de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError("Email inválido");
      return;
    }

    // Validação de loja apenas para Vendedor
    if (formData.cargo === "Vendedor" && !formData.loja) {
      setError("Selecione uma loja para o vendedor");
      return;
    }

    createUserMutation.mutate({
      email: formData.email.toLowerCase(),
      password: formData.password,
      full_name: formData.full_name,
      cargo: formData.cargo,
      loja: formData.cargo === "Vendedor" ? formData.loja : null
    });
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-white">
            Adicionar Novo Usuário
          </DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="py-8">
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-gray-900 dark:text-white">Usuário criado com sucesso!</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Um email de confirmação foi enviado para <span className="font-medium">{formData.email}</span>
                </p>
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
              <Label htmlFor="name" className="text-sm font-medium text-gray-900 dark:text-white">
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
              <Label htmlFor="email" className="text-sm font-medium text-gray-900 dark:text-white">
                Email *
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="Ex: usuario@example.com"
                className="mt-1 border-gray-200 dark:border-neutral-700"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="password" className="text-sm font-medium text-gray-900 dark:text-white">
                  Senha *
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleChange("password", e.target.value)}
                  placeholder="Min. 6 caracteres"
                  className="mt-1 border-gray-200 dark:border-neutral-700"
                />
              </div>
              <div>
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-900 dark:text-white">
                  Confirmar Senha *
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => handleChange("confirmPassword", e.target.value)}
                  placeholder="Confirme a senha"
                  className="mt-1 border-gray-200 dark:border-neutral-700"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="cargo" className="text-sm font-medium text-gray-900 dark:text-white">
                Cargo *
              </Label>
              <Select value={formData.cargo} onValueChange={(value) => handleChange("cargo", value)}>
                <SelectTrigger className="mt-1 border-gray-200 dark:border-neutral-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Administrador">Administrador</SelectItem>
                  <SelectItem value="Gerente">Gerente</SelectItem>
                  <SelectItem value="Vendedor">Vendedor</SelectItem>
                  <SelectItem value="Estoque">Estoque</SelectItem>
                  <SelectItem value="Logística">Logística</SelectItem>
                  <SelectItem value="Entregador">Entregador</SelectItem>
                  <SelectItem value="Montador Externo">Montador Externo</SelectItem>
                  <SelectItem value="Financeiro">Financeiro</SelectItem>
                  <SelectItem value="RH">RH</SelectItem>
                  <SelectItem value="Agendamento">Agendamento</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.cargo === "Vendedor" && (
              <div>
                <Label htmlFor="loja" className="text-sm font-medium text-gray-900 dark:text-white">
                  Loja *
                </Label>
                <Select value={formData.loja} onValueChange={(value) => handleChange("loja", value)}>
                  <SelectTrigger className="mt-1 border-gray-200 dark:border-neutral-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {lojas.length === 0 ? (
                      <SelectItem value="Centro" disabled>Carregando...</SelectItem>
                    ) : (
                      lojas.map((loja) => (
                        <SelectItem key={loja.id} value={loja.nome}>
                          {loja.nome}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

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
                {createUserMutation.isPending ? "Criando..." : "Criar Usuário"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
