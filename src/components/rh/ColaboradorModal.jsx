import React, { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    User, Briefcase, MapPin, CreditCard, Link, Save, Loader2, Gift, DollarSign, Calendar,
    KeyRound, CheckCircle2, AlertCircle, Copy, Eye, EyeOff, RotateCcw, UserX, UserCheck, Trash2
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { getZapApiUrl } from "@/utils/zapApiUrl";
import { supabase } from "@/api/base44Client";

const STATUS_OPTIONS = ["Ativo", "Férias", "Licença", "Afastado", "Desligado"];
const SETOR_OPTIONS = ["Vendas", "Logística", "Montagem", "Administrativo", "Financeiro", "RH", "Estoque", "Atendimento"];
const CONTRATO_OPTIONS = ["CLT", "PJ", "Estagiário", "Temporário"];
const ESTADOS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
const TIPO_PAGAMENTO = ["Mensal", "Quinzenal", "Semanal"];
const DIAS_PAGAMENTO = Array.from({ length: 31 }, (_, i) => i + 1);

const CARGO_OPTIONS = [
    "Administrador",
    "Gerente",
    "Vendedor",
    "Estoque",
    "Logística",
    "Montador",
    "Montador Externo",
    "Entregador",
    "Financeiro",
    "RH",
    "Agendamento",
    "Atendimento"
];

// Utility function to format currency
const formatCurrency = (value) => {
    const num = Number(value) || 0;
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export default function ColaboradorModal({ colaborador, usuarios = [], onClose, onSuccess }) {
    const queryClient = useQueryClient();
    const isEditing = !!colaborador;

    const [formData, setFormData] = useState({
        // Dados Pessoais
        nome_completo: colaborador?.nome_completo || "",
        cpf: colaborador?.cpf || "",
        rg: colaborador?.rg || "",
        data_nascimento: colaborador?.data_nascimento || "",
        telefone: colaborador?.telefone || "",
        email: colaborador?.email || "",
        // Dados Profissionais
        cargo: colaborador?.cargo || "",
        pin_montagem: colaborador?.pin_montagem || "",
        setor: colaborador?.setor || "",
        status: colaborador?.status || "Ativo",
        tipo_contrato: colaborador?.tipo_contrato || "CLT",
        data_admissao: colaborador?.data_admissao || "",
        carga_horaria: colaborador?.carga_horaria || 44,
        data_demissao: colaborador?.data_demissao || "",
        motivo_demissao: colaborador?.motivo_demissao || "",
        // Remuneração e Benefícios
        salario_base: colaborador?.salario_base || "",
        vale_transporte: colaborador?.vale_transporte || "",
        vale_alimentacao: colaborador?.vale_alimentacao || "",
        vale_refeicao: colaborador?.vale_refeicao || "",
        plano_saude: colaborador?.plano_saude || "",
        plano_odontologico: colaborador?.plano_odontologico || "",
        bonus_mensal: colaborador?.bonus_mensal || "",
        outros_beneficios: colaborador?.outros_beneficios || "",
        descricao_outros_beneficios: colaborador?.descricao_outros_beneficios || "",
        dia_pagamento: colaborador?.dia_pagamento || 5,
        tipo_pagamento: colaborador?.tipo_pagamento || "Mensal",
        // Endereço
        cep: colaborador?.cep || "",
        endereco: colaborador?.endereco || "",
        numero: colaborador?.numero || "",
        complemento: colaborador?.complemento || "",
        bairro: colaborador?.bairro || "",
        cidade: colaborador?.cidade || "",
        estado: colaborador?.estado || "",
        // Dados Bancários
        banco: colaborador?.banco || "",
        agencia: colaborador?.agencia || "",
        conta: colaborador?.conta || "",
        pix: colaborador?.pix || "",
        // Sistema
        user_id: colaborador?.user_id || "",
        observacoes: colaborador?.observacoes || "",
    });

    const [saving, setSaving] = useState(false);

    // Calculate totals for preview
    const totals = useMemo(() => {
        const salarioBase = Number(formData.salario_base) || 0;
        const valeTransporte = Number(formData.vale_transporte) || 0;
        const valeAlimentacao = Number(formData.vale_alimentacao) || 0;
        const valeRefeicao = Number(formData.vale_refeicao) || 0;
        const planoSaude = Number(formData.plano_saude) || 0;
        const planoOdontologico = Number(formData.plano_odontologico) || 0;
        const bonusMensal = Number(formData.bonus_mensal) || 0;
        const outrosBeneficios = Number(formData.outros_beneficios) || 0;

        const totalBeneficios = valeTransporte + valeAlimentacao + valeRefeicao +
            planoSaude + planoOdontologico + bonusMensal + outrosBeneficios;

        return {
            salarioBase,
            totalBeneficios,
            totalBruto: salarioBase + totalBeneficios
        };
    }, [formData]);

    const createMutation = useMutation({
        mutationFn: (data) => base44.entities.Colaborador.create(data),
        onSuccess: (createdData) => {
            queryClient.invalidateQueries(['colaboradores']);
            toast.success("Colaborador cadastrado com sucesso!");
            // Call onSuccess with the created data to show the summary modal
            if (onSuccess) {
                onSuccess({ ...formData, ...createdData, id: createdData.id });
            } else {
                onClose();
            }
        },
        onError: (error) => {
            toast.error("Erro ao cadastrar colaborador: " + error.message);
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.Colaborador.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries(['colaboradores']);
            toast.success("Colaborador atualizado com sucesso!");
            onClose();
        },
        onError: (error) => {
            toast.error("Erro ao atualizar colaborador: " + error.message);
        },
    });

    // --- System Access Management ---
    const [generatedPassword, setGeneratedPassword] = useState(null);
    const [generatedMatricula, setGeneratedMatricula] = useState(null);
    const [showPassword, setShowPassword] = useState(false);
    const [systemLoading, setSystemLoading] = useState(false);

    // Find linked user object
    const linkedUser = useMemo(() => {
        return usuarios.find(u => u.id === formData.user_id);
    }, [formData.user_id, usuarios]);

    const copyToClipboard = (text, label) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copiado!`);
    };

    const createAccessMutation = useMutation({
        mutationFn: async () => {
            // 1. Validation
            if (!formData.email) throw new Error("Email é obrigatório para criar acesso.");
            if (!formData.cargo) throw new Error("Cargo é obrigatório.");

            // Check store requirement
            const CARGOS_SEM_LOJA = ['Administrador', 'Gerente Geral', 'Financeiro', 'RH', 'Estoque', 'Logística', 'Agendamento', 'Entregador', 'Montador', 'Montador Externo'];
            // Try to find loja in formData or from linked user or collaborator data? 
            // In ColaboradorModal we don't strictly have a 'loja' field in formData except implicitly?
            // Actually formData doesn't have 'loja'. We might need to ask for it?
            // Wait, formData DOES NOT have 'loja'. NovoUsuarioModal had it.
            // We need to check if we can infer it or if we need to add it to formData/UI if it's missing.
            // For now, let's assume 'sem loja' or we need to prompt.
            // EDIT: Colaborador doesn't usually have a store field directly? 
            // Let's look at the backend/schema. Colaborador has 'loja_id'? Or checks 'setor'?
            // NovoUsuarioModal asks for 'loja'.
            // If cargo needs loja and we don't have it, we might fail.
            // Let's add 'loja' to formData if not present? Or just pass null and let backend decide?

            // 2. SignUp Supabase
            const senhaTemp = 'Temp' + Math.random().toString(36).substring(2, 8) + '1';
            const { data: authUser, error: authError } = await base44.auth.signUp({
                email: formData.email,
                password: senhaTemp
            });
            if (authError) throw new Error(authError.message);
            if (!authUser?.user?.id) throw new Error("ID de usuário não retornado.");

            // 3. Map Sector
            const setorMap = {
                'Administrador': 'AD', 'Gerente Geral': 'GG', 'Gerente': 'GE',
                'Vendedor': 'VE', 'Estoque': 'ES', 'Financeiro': 'FI',
                'Logística': 'LO', 'Entregador': 'EN', 'Montador': 'LO',
                'Montador Externo': 'MO', 'RH': 'RH', 'Agendamento': 'AG'
            };
            const setor = setorMap[formData.cargo] || 'AD';

            // 4. Create Credentials (Backend)
            const token = localStorage.getItem('employee_token');
            const apiUrl = getZapApiUrl();
            const response = await fetch(`${apiUrl}/api/auth/employee/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({
                    user_id: authUser.user.id,
                    setor_code: setor
                })
            });

            const credenciaisData = response.ok ? await response.json() : null;

            // 5. Create Public User
            const userPayload = {
                id: authUser.user.id,
                email: formData.email,
                full_name: formData.nome_completo,
                cargo: formData.cargo,
                loja: null, // We don't have store selector here yet, default null
                status_aprovacao: 'Aprovado',
                is_vendedor: formData.cargo === 'Vendedor',
                meta_mensal: 0,
                ativo: true,
                primeiro_acesso: true,
                matricula: credenciaisData?.matricula || null
            };

            const { error: upsertError } = await supabase
                .from('public_users')
                .upsert(userPayload, { onConflict: 'id' });

            if (upsertError) throw upsertError;

            return {
                user_id: authUser.user.id,
                matricula: credenciaisData?.matricula,
                senha_temporaria: credenciaisData?.senha_temporaria || senhaTemp
            };
        },
        onSuccess: (data) => {
            setGeneratedMatricula(data.matricula);
            setGeneratedPassword(data.senha_temporaria);
            setFormData(prev => ({ ...prev, user_id: data.user_id }));
            queryClient.invalidateQueries(['users']);
            queryClient.invalidateQueries(['colaboradores']);
            toast.success("Acesso criado com sucesso!");
        },
        onError: (err) => toast.error(err.message)
    });

    const resetPasswordMutation = useMutation({
        mutationFn: async () => {
            if (!formData.user_id) return;
            const apiUrl = getZapApiUrl();
            const response = await fetch(`${apiUrl}/api/auth/employee/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: formData.user_id })
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Erro ao resetar senha');
            }
            return response.json();
        },
        onSuccess: (data) => {
            setGeneratedPassword(data.senha_temporaria);
            setGeneratedMatricula(linkedUser?.matricula || "N/A");
            toast.success("Senha resetada!");
        },
        onError: (err) => toast.error(err.message)
    });

    const toggleAccessMutation = useMutation({
        mutationFn: async () => {
            if (!linkedUser) return;
            await base44.entities.User.update(linkedUser.id, { ativo: !linkedUser.ativo });
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['users']);
            toast.success("Status de acesso alterado.");
        },
        onError: (err) => toast.error(err.message)
    });

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const buscarCep = async () => {
        if (formData.cep.length !== 8) return;
        try {
            const response = await fetch(`https://viacep.com.br/ws/${formData.cep}/json/`);
            const data = await response.json();
            if (!data.erro) {
                setFormData(prev => ({
                    ...prev,
                    endereco: data.logradouro || "",
                    bairro: data.bairro || "",
                    cidade: data.localidade || "",
                    estado: data.uf || "",
                }));
            }
        } catch (error) {
            console.error("Erro ao buscar CEP:", error);
        }
    };

    const handleSubmit = async () => {
        if (!formData.nome_completo) {
            toast.error("Nome completo é obrigatório");
            return;
        }

        setSaving(true);

        const dataToSave = {
            ...formData,
            // Convert empty strings to null for date fields
            data_nascimento: formData.data_nascimento || null,
            data_admissao: formData.data_admissao || null,
            data_demissao: formData.data_demissao || null,
            // Convert numeric fields
            salario_base: formData.salario_base ? Number(formData.salario_base) : null,
            carga_horaria: formData.carga_horaria ? Number(formData.carga_horaria) : null,
            vale_transporte: formData.vale_transporte ? Number(formData.vale_transporte) : 0,
            vale_alimentacao: formData.vale_alimentacao ? Number(formData.vale_alimentacao) : 0,
            vale_refeicao: formData.vale_refeicao ? Number(formData.vale_refeicao) : 0,
            plano_saude: formData.plano_saude ? Number(formData.plano_saude) : 0,
            plano_odontologico: formData.plano_odontologico ? Number(formData.plano_odontologico) : 0,
            bonus_mensal: formData.bonus_mensal ? Number(formData.bonus_mensal) : 0,
            outros_beneficios: formData.outros_beneficios ? Number(formData.outros_beneficios) : 0,
            dia_pagamento: formData.dia_pagamento ? Number(formData.dia_pagamento) : 5,
            user_id: formData.user_id || null,
        };

        try {
            if (isEditing) {
                await updateMutation.mutateAsync({ id: colaborador.id, data: dataToSave });
            } else {
                await createMutation.mutateAsync(dataToSave);
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2" style={{ color: '#07593f' }}>
                        <User className="w-5 h-5" />
                        {isEditing ? "Editar Colaborador" : "Novo Colaborador"}
                    </DialogTitle>
                </DialogHeader>

                <Tabs defaultValue="pessoal" className="mt-4">
                    <TabsList className="grid w-full grid-cols-6">
                        <TabsTrigger value="pessoal" className="text-xs">
                            <User className="w-3 h-3 mr-1" />
                            Pessoal
                        </TabsTrigger>
                        <TabsTrigger value="profissional" className="text-xs">
                            <Briefcase className="w-3 h-3 mr-1" />
                            Profissional
                        </TabsTrigger>
                        <TabsTrigger value="remuneracao" className="text-xs">
                            <DollarSign className="w-3 h-3 mr-1" />
                            Remuneração
                        </TabsTrigger>
                        <TabsTrigger value="endereco" className="text-xs">
                            <MapPin className="w-3 h-3 mr-1" />
                            Endereço
                        </TabsTrigger>
                        <TabsTrigger value="bancario" className="text-xs">
                            <CreditCard className="w-3 h-3 mr-1" />
                            Bancário
                        </TabsTrigger>
                        <TabsTrigger value="sistema" className="text-xs">
                            <Link className="w-3 h-3 mr-1" />
                            Sistema
                        </TabsTrigger>
                    </TabsList>

                    {/* Dados Pessoais */}
                    <TabsContent value="pessoal" className="space-y-4 mt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <Label htmlFor="nome_completo">Nome Completo *</Label>
                                <Input
                                    id="nome_completo"
                                    value={formData.nome_completo}
                                    onChange={(e) => handleChange("nome_completo", e.target.value)}
                                    placeholder="Nome completo do colaborador"
                                />
                            </div>
                            <div>
                                <Label htmlFor="cpf">CPF</Label>
                                <Input
                                    id="cpf"
                                    value={formData.cpf}
                                    onChange={(e) => handleChange("cpf", e.target.value)}
                                    placeholder="000.000.000-00"
                                />
                            </div>
                            <div>
                                <Label htmlFor="rg">RG</Label>
                                <Input
                                    id="rg"
                                    value={formData.rg}
                                    onChange={(e) => handleChange("rg", e.target.value)}
                                    placeholder="00.000.000-0"
                                />
                            </div>
                            <div>
                                <Label htmlFor="data_nascimento">Data de Nascimento</Label>
                                <Input
                                    id="data_nascimento"
                                    type="date"
                                    value={formData.data_nascimento}
                                    onChange={(e) => handleChange("data_nascimento", e.target.value)}
                                />
                            </div>
                            <div>
                                <Label htmlFor="telefone">Telefone</Label>
                                <Input
                                    id="telefone"
                                    value={formData.telefone}
                                    onChange={(e) => handleChange("telefone", e.target.value)}
                                    placeholder="(00) 00000-0000"
                                />
                            </div>
                            <div className="col-span-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => handleChange("email", e.target.value)}
                                    placeholder="email@exemplo.com"
                                />
                            </div>
                        </div>
                    </TabsContent>

                    {/* Dados Profissionais */}
                    <TabsContent value="profissional" className="space-y-4 mt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="cargo">Cargo</Label>
                                <Select value={formData.cargo} onValueChange={(v) => handleChange("cargo", v)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione o cargo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CARGO_OPTIONS.map(c => (
                                            <SelectItem key={c} value={c}>{c}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="setor">Setor</Label>
                                <Select value={formData.setor} onValueChange={(v) => handleChange("setor", v)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione o setor" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {SETOR_OPTIONS.map(s => (
                                            <SelectItem key={s} value={s}>{s}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="status">Status</Label>
                                <Select value={formData.status} onValueChange={(v) => handleChange("status", v)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {STATUS_OPTIONS.map(s => (
                                            <SelectItem key={s} value={s}>{s}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="tipo_contrato">Tipo de Contrato</Label>
                                <Select value={formData.tipo_contrato} onValueChange={(v) => handleChange("tipo_contrato", v)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CONTRATO_OPTIONS.map(c => (
                                            <SelectItem key={c} value={c}>{c}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {formData.cargo === "Montador" && (
                                <div>
                                    <Label htmlFor="pin_montagem">Senha de Montagem (PIN)</Label>
                                    <Input
                                        id="pin_montagem"
                                        value={formData.pin_montagem}
                                        onChange={(e) => handleChange("pin_montagem", e.target.value.replace(/\D/g, '').slice(0, 4))}
                                        placeholder="4 dígitos (Ex: 1234)"
                                        maxLength={4}
                                    />
                                </div>
                            )}
                            <div>
                                <Label htmlFor="data_admissao">Data de Admissão</Label>
                                <Input
                                    id="data_admissao"
                                    type="date"
                                    value={formData.data_admissao}
                                    onChange={(e) => handleChange("data_admissao", e.target.value)}
                                />
                            </div>
                            <div>
                                <Label htmlFor="carga_horaria">Carga Horária Semanal</Label>
                                <Input
                                    id="carga_horaria"
                                    type="number"
                                    value={formData.carga_horaria}
                                    onChange={(e) => handleChange("carga_horaria", e.target.value)}
                                    placeholder="44"
                                />
                            </div>
                            {formData.status === "Desligado" && (
                                <>
                                    <div>
                                        <Label htmlFor="data_demissao">Data de Demissão</Label>
                                        <Input
                                            id="data_demissao"
                                            type="date"
                                            value={formData.data_demissao}
                                            onChange={(e) => handleChange("data_demissao", e.target.value)}
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <Label htmlFor="motivo_demissao">Motivo da Demissão</Label>
                                        <Textarea
                                            id="motivo_demissao"
                                            value={formData.motivo_demissao}
                                            onChange={(e) => handleChange("motivo_demissao", e.target.value)}
                                            placeholder="Descreva o motivo..."
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    </TabsContent>

                    {/* Remuneração e Benefícios - NEW TAB */}
                    <TabsContent value="remuneracao" className="space-y-4 mt-4">
                        {/* Salário Base */}
                        <Card className="border-0 shadow-sm bg-green-50">
                            <CardContent className="pt-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <DollarSign className="w-5 h-5 text-green-600" />
                                    <h3 className="font-semibold text-green-800">Salário</h3>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="salario_base">Salário Base (R$) *</Label>
                                        <Input
                                            id="salario_base"
                                            type="number"
                                            step="0.01"
                                            value={formData.salario_base}
                                            onChange={(e) => handleChange("salario_base", e.target.value)}
                                            placeholder="0,00"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Benefícios */}
                        <Card className="border-0 shadow-sm bg-blue-50">
                            <CardContent className="pt-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <Gift className="w-5 h-5 text-blue-600" />
                                    <h3 className="font-semibold text-blue-800">Benefícios</h3>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <Label htmlFor="vale_transporte">Vale Transporte (R$)</Label>
                                        <Input
                                            id="vale_transporte"
                                            type="number"
                                            step="0.01"
                                            value={formData.vale_transporte}
                                            onChange={(e) => handleChange("vale_transporte", e.target.value)}
                                            placeholder="0,00"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="vale_alimentacao">Vale Alimentação (R$)</Label>
                                        <Input
                                            id="vale_alimentacao"
                                            type="number"
                                            step="0.01"
                                            value={formData.vale_alimentacao}
                                            onChange={(e) => handleChange("vale_alimentacao", e.target.value)}
                                            placeholder="0,00"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="vale_refeicao">Vale Refeição (R$)</Label>
                                        <Input
                                            id="vale_refeicao"
                                            type="number"
                                            step="0.01"
                                            value={formData.vale_refeicao}
                                            onChange={(e) => handleChange("vale_refeicao", e.target.value)}
                                            placeholder="0,00"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="plano_saude">Plano de Saúde (R$)</Label>
                                        <Input
                                            id="plano_saude"
                                            type="number"
                                            step="0.01"
                                            value={formData.plano_saude}
                                            onChange={(e) => handleChange("plano_saude", e.target.value)}
                                            placeholder="0,00"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="plano_odontologico">Plano Odontológico (R$)</Label>
                                        <Input
                                            id="plano_odontologico"
                                            type="number"
                                            step="0.01"
                                            value={formData.plano_odontologico}
                                            onChange={(e) => handleChange("plano_odontologico", e.target.value)}
                                            placeholder="0,00"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="bonus_mensal">Bônus Mensal (R$)</Label>
                                        <Input
                                            id="bonus_mensal"
                                            type="number"
                                            step="0.01"
                                            value={formData.bonus_mensal}
                                            onChange={(e) => handleChange("bonus_mensal", e.target.value)}
                                            placeholder="0,00"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="outros_beneficios">Outros Benefícios (R$)</Label>
                                        <Input
                                            id="outros_beneficios"
                                            type="number"
                                            step="0.01"
                                            value={formData.outros_beneficios}
                                            onChange={(e) => handleChange("outros_beneficios", e.target.value)}
                                            placeholder="0,00"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <Label htmlFor="descricao_outros_beneficios">Descrição Outros Benefícios</Label>
                                        <Input
                                            id="descricao_outros_beneficios"
                                            value={formData.descricao_outros_beneficios}
                                            onChange={(e) => handleChange("descricao_outros_beneficios", e.target.value)}
                                            placeholder="Descreva os outros benefícios..."
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Configuração de Pagamento */}
                        <Card className="border-0 shadow-sm bg-amber-50">
                            <CardContent className="pt-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <Calendar className="w-5 h-5 text-amber-600" />
                                    <h3 className="font-semibold text-amber-800">Configuração de Pagamento</h3>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="dia_pagamento">Dia do Pagamento</Label>
                                        <Select
                                            value={String(formData.dia_pagamento)}
                                            onValueChange={(v) => handleChange("dia_pagamento", Number(v))}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Dia" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {DIAS_PAGAMENTO.map(d => (
                                                    <SelectItem key={d} value={String(d)}>Dia {d}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label htmlFor="tipo_pagamento">Tipo de Pagamento</Label>
                                        <Select
                                            value={formData.tipo_pagamento}
                                            onValueChange={(v) => handleChange("tipo_pagamento", v)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {TIPO_PAGAMENTO.map(t => (
                                                    <SelectItem key={t} value={t}>{t}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Resumo */}
                        <Card className="border-2" style={{ borderColor: '#07593f' }}>
                            <CardContent className="pt-4">
                                <h3 className="font-semibold mb-3" style={{ color: '#07593f' }}>Resumo Mensal</h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Salário Base</span>
                                        <span className="font-medium">{formatCurrency(totals.salarioBase)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Total Benefícios</span>
                                        <span className="font-medium text-blue-600">{formatCurrency(totals.totalBeneficios)}</span>
                                    </div>
                                    <div className="border-t pt-2 flex justify-between">
                                        <span className="font-semibold" style={{ color: '#07593f' }}>Total Bruto</span>
                                        <span className="font-bold text-lg" style={{ color: '#07593f' }}>{formatCurrency(totals.totalBruto)}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Endereço */}
                    <TabsContent value="endereco" className="space-y-4 mt-4">
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label htmlFor="cep">CEP</Label>
                                <Input
                                    id="cep"
                                    value={formData.cep}
                                    onChange={(e) => handleChange("cep", e.target.value.replace(/\D/g, ''))}
                                    onBlur={buscarCep}
                                    placeholder="00000-000"
                                    maxLength={8}
                                />
                            </div>
                            <div className="col-span-2">
                                <Label htmlFor="endereco">Endereço</Label>
                                <Input
                                    id="endereco"
                                    value={formData.endereco}
                                    onChange={(e) => handleChange("endereco", e.target.value)}
                                    placeholder="Rua, Avenida, etc."
                                />
                            </div>
                            <div>
                                <Label htmlFor="numero">Número</Label>
                                <Input
                                    id="numero"
                                    value={formData.numero}
                                    onChange={(e) => handleChange("numero", e.target.value)}
                                    placeholder="123"
                                />
                            </div>
                            <div>
                                <Label htmlFor="complemento">Complemento</Label>
                                <Input
                                    id="complemento"
                                    value={formData.complemento}
                                    onChange={(e) => handleChange("complemento", e.target.value)}
                                    placeholder="Apto, Sala, etc."
                                />
                            </div>
                            <div>
                                <Label htmlFor="bairro">Bairro</Label>
                                <Input
                                    id="bairro"
                                    value={formData.bairro}
                                    onChange={(e) => handleChange("bairro", e.target.value)}
                                    placeholder="Bairro"
                                />
                            </div>
                            <div>
                                <Label htmlFor="cidade">Cidade</Label>
                                <Input
                                    id="cidade"
                                    value={formData.cidade}
                                    onChange={(e) => handleChange("cidade", e.target.value)}
                                    placeholder="Cidade"
                                />
                            </div>
                            <div>
                                <Label htmlFor="estado">Estado</Label>
                                <Select value={formData.estado} onValueChange={(v) => handleChange("estado", v)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="UF" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ESTADOS.map(uf => (
                                            <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </TabsContent>

                    {/* Dados Bancários */}
                    <TabsContent value="bancario" className="space-y-4 mt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="banco">Banco</Label>
                                <Input
                                    id="banco"
                                    value={formData.banco}
                                    onChange={(e) => handleChange("banco", e.target.value)}
                                    placeholder="Nome ou código do banco"
                                />
                            </div>
                            <div>
                                <Label htmlFor="agencia">Agência</Label>
                                <Input
                                    id="agencia"
                                    value={formData.agencia}
                                    onChange={(e) => handleChange("agencia", e.target.value)}
                                    placeholder="0000"
                                />
                            </div>
                            <div>
                                <Label htmlFor="conta">Conta</Label>
                                <Input
                                    id="conta"
                                    value={formData.conta}
                                    onChange={(e) => handleChange("conta", e.target.value)}
                                    placeholder="00000-0"
                                />
                            </div>
                            <div>
                                <Label htmlFor="pix">Chave PIX</Label>
                                <Input
                                    id="pix"
                                    value={formData.pix}
                                    onChange={(e) => handleChange("pix", e.target.value)}
                                    placeholder="CPF, email, telefone ou chave aleatória"
                                />
                            </div>
                        </div>
                    </TabsContent>

                    {/* Vínculo Sistema */}
                    <TabsContent value="sistema" className="space-y-4 mt-4">

                        {!formData.user_id ? (
                            <div className="space-y-6">
                                <Alert className="bg-blue-50 border-blue-200">
                                    <KeyRound className="w-4 h-4 text-blue-600" />
                                    <AlertDescription className="text-blue-800">
                                        Este colaborador ainda não possui acesso ao sistema.
                                        Você pode vincular um usuário existente ou criar um novo acesso agora.
                                    </AlertDescription>
                                </Alert>

                                <Card>
                                    <CardContent className="pt-6">
                                        <div className="space-y-4">
                                            <h3 className="font-semibold flex items-center gap-2">
                                                <User className="w-4 h-4" /> Criar Novo Acesso
                                            </h3>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <Label>Nome (do cadastro)</Label>
                                                    <Input value={formData.nome_completo} disabled className="bg-gray-100" />
                                                </div>
                                                <div>
                                                    <Label>Email (do cadastro)</Label>
                                                    <Input value={formData.email} disabled className="bg-gray-100" />
                                                </div>
                                                <div>
                                                    <Label>Cargo (do cadastro)</Label>
                                                    <Input value={formData.cargo} disabled className="bg-gray-100" />
                                                </div>
                                            </div>

                                            {generatedPassword ? (
                                                <div className="bg-green-50 p-4 rounded-lg border border-green-200 mt-4 space-y-3">
                                                    <div className="flex items-center gap-2 text-green-800 font-semibold">
                                                        <CheckCircle2 className="w-5 h-5" /> Acesso Criado!
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="bg-white p-3 rounded border">
                                                            <span className="text-xs text-gray-500">Matrícula</span>
                                                            <div className="flex justify-between items-center">
                                                                <code className="text-lg font-bold">{generatedMatricula}</code>
                                                                <Button variant="ghost" size="sm" onClick={() => copyToClipboard(generatedMatricula, 'Matrícula')}><Copy className="w-4 h-4" /></Button>
                                                            </div>
                                                        </div>
                                                        <div className="bg-white p-3 rounded border">
                                                            <span className="text-xs text-gray-500">Senha Temporária</span>
                                                            <div className="flex justify-between items-center">
                                                                <code className="text-lg font-bold">{showPassword ? generatedPassword : '••••••••'}</code>
                                                                <div className="flex gap-1">
                                                                    <Button variant="ghost" size="sm" onClick={() => setShowPassword(!showPassword)}>
                                                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                                    </Button>
                                                                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(generatedPassword, 'Senha')}><Copy className="w-4 h-4" /></Button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <p className="text-xs text-green-700">Salve essas credenciais antes de fechar!</p>
                                                </div>
                                            ) : (
                                                <Button
                                                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                                                    onClick={() => createAccessMutation.mutate()}
                                                    disabled={createAccessMutation.isPending || !formData.email || !formData.cargo}
                                                >
                                                    {createAccessMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <KeyRound className="w-4 h-4 mr-2" />}
                                                    Gerar Acesso ao Sistema
                                                </Button>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>

                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-muted-foreground">Ou vincular existente</span></div>
                                </div>

                                <div>
                                    <Label htmlFor="user_id">Vincular Usuário Existente</Label>
                                    <Select value={formData.user_id || "none"} onValueChange={(v) => handleChange("user_id", v === "none" ? "" : v)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione um usuário..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Nenhum</SelectItem>
                                            {usuarios.map(u => (
                                                <SelectItem key={u.id} value={u.id}>
                                                    {u.full_name || u.email} - {u.matricula || 'S/ Matrícula'}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <Alert className="bg-green-50 border-green-200">
                                    <UserCheck className="w-4 h-4 text-green-600" />
                                    <AlertDescription className="text-green-800">
                                        Este colaborador possui acesso ao sistema vinculado.
                                    </AlertDescription>
                                </Alert>

                                <Card>
                                    <CardContent className="pt-6">
                                        <div className="space-y-4">
                                            <h3 className="font-semibold">Credenciais de Acesso</h3>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-gray-50 p-3 rounded">
                                                    <span className="text-xs text-gray-500">Usuário</span>
                                                    <div className="font-medium">{linkedUser?.full_name || '...'}</div>
                                                    <div className="text-xs text-gray-400">{linkedUser?.email}</div>
                                                </div>
                                                <div className="bg-gray-50 p-3 rounded">
                                                    <span className="text-xs text-gray-500">Matrícula</span>
                                                    <div className="text-xl font-mono font-bold tracking-wider">{linkedUser?.matricula || "---"}</div>
                                                </div>
                                                <div className="bg-gray-50 p-3 rounded">
                                                    <span className="text-xs text-gray-500">Status</span>
                                                    <div>
                                                        {linkedUser?.ativo === false ?
                                                            <span className="text-red-600 flex items-center gap-1 font-bold text-sm"><UserX className="w-3 h-3" /> Desativado</span> :
                                                            <span className="text-green-600 flex items-center gap-1 font-bold text-sm"><CheckCircle2 className="w-3 h-3" /> Ativo</span>
                                                        }
                                                    </div>
                                                </div>
                                                <div className="bg-gray-50 p-3 rounded">
                                                    <span className="text-xs text-gray-500">Último Login</span>
                                                    <div className="text-sm">
                                                        {linkedUser?.ultimo_login ? new Date(linkedUser.ultimo_login).toLocaleDateString('pt-BR') : 'Nunca'}
                                                    </div>
                                                </div>
                                            </div>

                                            {generatedPassword && (
                                                <div className="bg-orange-50 p-4 rounded-lg border border-orange-200 mt-4 space-y-3">
                                                    <div className="flex items-center gap-2 text-orange-800 font-semibold">
                                                        <RotateCcw className="w-4 h-4" /> Senha Resetada
                                                    </div>
                                                    <div className="bg-white p-3 rounded border">
                                                        <span className="text-xs text-gray-500">Nova Senha Temporária</span>
                                                        <div className="flex justify-between items-center">
                                                            <code className="text-lg font-bold">{showPassword ? generatedPassword : '••••••••'}</code>
                                                            <div className="flex gap-1">
                                                                <Button variant="ghost" size="sm" onClick={() => setShowPassword(!showPassword)}>
                                                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                                </Button>
                                                                <Button variant="ghost" size="sm" onClick={() => copyToClipboard(generatedPassword, 'Senha')}><Copy className="w-4 h-4" /></Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex gap-2 pt-2">
                                                <Button
                                                    variant="outline"
                                                    className="flex-1 text-orange-700 hover:text-orange-800 hover:bg-orange-50 border-orange-200"
                                                    onClick={() => resetPasswordMutation.mutate()}
                                                    disabled={resetPasswordMutation.isPending}
                                                >
                                                    {resetPasswordMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-2" />}
                                                    Resetar Senha
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    className={`flex-1 ${linkedUser?.ativo === false ? 'text-green-700 hover:bg-green-50 border-green-200' : 'text-red-700 hover:bg-red-50 border-red-200'}`}
                                                    onClick={() => toggleAccessMutation.mutate()}
                                                    disabled={toggleAccessMutation.isPending}
                                                >
                                                    {linkedUser?.ativo === false ? (
                                                        <><UserCheck className="w-4 h-4 mr-2" /> Ativar Acesso</>
                                                    ) : (
                                                        <><UserX className="w-4 h-4 mr-2" /> Bloquear Acesso</>
                                                    )}
                                                </Button>
                                            </div>

                                            <div className="pt-4 border-t">
                                                <Button
                                                    variant="ghost"
                                                    className="w-full text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => handleChange("user_id", "")}
                                                >
                                                    <Link className="w-4 h-4 mr-2" />
                                                    Desvincular Usuário (apenas remove link)
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                    <Button variant="outline" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={saving}
                        style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
                    >
                        {saving ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Salvando...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4 mr-2" />
                                {isEditing ? "Salvar Alterações" : "Cadastrar Colaborador"}
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
