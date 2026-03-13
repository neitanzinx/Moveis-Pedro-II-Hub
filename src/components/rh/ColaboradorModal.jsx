import React, { useState, useMemo, createElement } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { base44, supabase } from "@/api/base44Client";
import { CARGOS, getCargoConfig, getCargoPrefix } from "@/config/cargos";
import { useLojas } from "@/hooks/useLojas";
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
    KeyRound, CheckCircle2, AlertCircle, Copy, Eye, EyeOff, RotateCcw, UserX, UserCheck, Trash2,
    Shield, Moon, AlertTriangle, Users
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { getZapApiUrl } from "@/utils/zapApiUrl";
import { formatarCPF, formatarTelefone, formatarCEP } from "@/utils/formatters";
import { gerarResumoEstimado, INSALUBRIDADE_GRAUS } from "@/utils/calculosTrabalhistas";



const STATUS_OPTIONS = ["Ativo", "Férias", "Licença", "Afastado", "Desligado"];
const CONTRATO_OPTIONS = ["CLT", "PJ", "Estagiário", "Temporário"];
const ESTADOS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
const TIPO_PAGAMENTO = ["Mensal", "Quinzenal", "Semanal"];
const DIAS_PAGAMENTO = Array.from({ length: 31 }, (_, i) => i + 1);

// Sector field has been removed, permissions and views are now driven purely by Cargo.

// Utility function to format currency
const formatCurrency = (value) => {
    const num = Number(value) || 0;
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export default function ColaboradorModal({ colaborador, usuarios = [], onClose, onSuccess, initialTab = "pessoal" }) {
    const queryClient = useQueryClient();
    const { data: lojasReal = [] } = useLojas();
    const isEditing = !!colaborador && !colaborador.isAcessoRapido;

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
        loja: colaborador?.loja || "",
        pin_montagem: colaborador?.pin_montagem || "",
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
        // Adicionais CLT
        adicional_noturno: colaborador?.adicional_noturno || false,
        insalubridade_grau: colaborador?.insalubridade_grau || "",
        periculosidade: colaborador?.periculosidade || false,
        numero_dependentes: colaborador?.numero_dependentes || 0,
    });

    const [saving, setSaving] = useState(false);

    // Calculate totals for preview using the centralized CLT engine
    const totals = useMemo(() => {
        return gerarResumoEstimado(formData);
    }, [formData]);

    const createMutation = useMutation({
        mutationFn: async (data) => {
            const colaboradorData = { ...data };
            delete colaboradorData.loja;

            // 1. Create Colaborador record
            const createdColab = await base44.entities.Colaborador.create(colaboradorData);

            // 2. Sync with public_users if linked
            if (data.user_id && data.cargo) {
                try {
                    const cargoConfig = getCargoConfig(data.cargo);
                    await base44.entities.User.update(data.user_id, {
                        cargo: data.cargo,
                        full_name: data.nome_completo,
                        loja: cargoConfig?.requiresStore ? data.loja : null,
                        is_vendedor: data.cargo === 'Vendedor'
                    });
                } catch (syncError) {
                    console.error("Erro ao sincronizar com public_users:", syncError);
                }
            }

            return createdColab;
        },
        onSuccess: (createdData) => {
            queryClient.invalidateQueries(['colaboradores']);
            queryClient.invalidateQueries(['users']);
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
        mutationFn: async ({ id, data }) => {
            const colaboradorData = { ...data };
            delete colaboradorData.loja;
            // 1. Update Colaborador record
            const updatedColab = await base44.entities.Colaborador.update(id, colaboradorData);

            // 2. Sync with public_users if linked
            if (data.user_id && data.cargo) {
                try {
                    const cargoConfig = getCargoConfig(data.cargo);
                    await base44.entities.User.update(data.user_id, {
                        cargo: data.cargo,
                        full_name: data.nome_completo,
                        loja: cargoConfig?.requiresStore ? data.loja : null,
                        is_vendedor: data.cargo === 'Vendedor'
                    });
                } catch (syncError) {
                    console.error("Erro ao sincronizar com public_users:", syncError);
                }
            }
            return updatedColab;
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['colaboradores']);
            queryClient.invalidateQueries(['users']); // Invalidate users too
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

    // Fetch all collaborators to check for used user_ids
    const { data: todosColaboradores = [] } = useQuery({
        queryKey: ['colaboradores_lista_completa'],
        queryFn: () => base44.entities.Colaborador.list(),
        staleTime: 5000
    });

    // Find linked user object
    const linkedUser = useMemo(() => {
        return usuarios.find(u => u.id === formData.user_id);
    }, [formData.user_id, usuarios]);

    // Filter available users (not linked to another collaborator)
    const usuariosDisponiveis = useMemo(() => {
        const userIdsEmUso = new Set(
            todosColaboradores
                .filter(c => c.id !== colaborador?.id) // Exclude current collaborator
                .map(c => c.user_id)
                .filter(Boolean)
        );

        return usuarios.filter(u => !userIdsEmUso.has(u.id));
    }, [usuarios, todosColaboradores, colaborador]);

    const copyToClipboard = (text, label) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copiado!`);
    };

    const createAccessMutation = useMutation({
        mutationFn: async () => {
            if (!formData.email) throw new Error("Email é obrigatório para criar acesso.");
            if (!formData.cargo) throw new Error("Cargo é obrigatório.");

            const cargoConfig = getCargoConfig(formData.cargo);
            const senhaTemp = 'Temp' + Math.random().toString(36).substring(2, 8) + '1';
            
            const { data: authUser, error: authError } = await base44.auth.signUp({
                email: formData.email,
                password: senhaTemp
            });
            if (authError) throw new Error(authError.message);
            if (!authUser?.user?.id) throw new Error("ID de usuário não retornado.");

            const setor = getCargoPrefix(formData.cargo);
            const matricula = await (async () => {
                const { data: existingMatriculas } = await supabase
                    .from('public_users')
                    .select('matricula')
                    .like('matricula', `MP-${setor}%`)
                    .order('matricula', { ascending: false })
                    .limit(1);

                let nextNumber = 1;
                if (existingMatriculas?.length > 0) {
                    const lastMatricula = existingMatriculas[0].matricula;
                    const lastNumberStr = lastMatricula.replace(`MP-${setor}`, '');
                    const lastNumber = parseInt(lastNumberStr, 10);
                    if (!isNaN(lastNumber)) nextNumber = lastNumber + 1;
                }
                return `MP-${setor}${nextNumber.toString().padStart(4, '0')}`;
            })();

            const userPayload = {
                id: authUser.user.id,
                email: formData.email,
                full_name: formData.nome_completo,
                cargo: formData.cargo,
                loja: cargoConfig?.requiresStore ? formData.loja : null,
                ativo: true,
                primeiro_acesso: true,
                matricula: matricula,
                is_vendedor: formData.cargo === 'Vendedor'
            };

            const { error: insertError } = await supabase.from('public_users').upsert(userPayload);
            if (insertError) throw new Error(insertError.message);

            return { matricula, senha_temporaria: senhaTemp, user_id: authUser.user.id };
        },
        onSuccess: (data) => {
            setGeneratedMatricula(data.matricula);
            setGeneratedPassword(data.senha_temporaria);
            setFormData(prev => ({ ...prev, user_id: data.user_id }));
            queryClient.invalidateQueries(['users']);
            toast.success("Acesso criado com sucesso!");
        },
        onError: (error) => toast.error("Erro ao criar acesso: " + error.message)
    });

    const resetPasswordMutation = useMutation({
        mutationFn: async () => {
            const apiUrl = getZapApiUrl();
            const response = await fetch(`${apiUrl}/api/auth/employee/reset-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('employee_token')}`
                },
                body: JSON.stringify({ user_id: formData.user_id })
            });
            if (!response.ok) throw new Error('Falha ao resetar senha');
            return response.json();
        },
        onSuccess: (data) => {
            setGeneratedPassword(data.senha_temporaria);
            setShowPassword(true);
            toast.success("Senha resetada com sucesso!");
        },
        onError: (error) => toast.error("Erro ao resetar senha: " + error.message)
    });

    const toggleAccessMutation = useMutation({
        mutationFn: async () => {
            const novoStatus = linkedUser?.ativo === false;
            return base44.entities.User.update(formData.user_id, { ativo: novoStatus });
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['users']);
            toast.success("Status de acesso alterado!");
        },
        onError: (error) => toast.error("Erro ao alterar acesso: " + error.message)
    });

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const buscarCep = async () => {
        const cep = formData.cep?.replace(/\D/g, "");
        if (cep?.length === 8) {
            try {
                const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                const data = await response.json();
                if (!data.erro) {
                    setFormData(prev => ({
                        ...prev,
                        endereco: data.logradouro,
                        bairro: data.bairro,
                        cidade: data.localidade,
                        estado: data.uf
                    }));
                }
            } catch (error) {
                console.error("Erro ao buscar CEP:", error);
            }
        }
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        setSaving(true);
        try {
            if (isEditing) {
                await updateMutation.mutateAsync({ id: colaborador.id, data: formData });
            } else {
                await createMutation.mutateAsync(formData);
            }
        } catch (error) {
            console.error("Erro ao salvar:", error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-2xl font-bold" style={{ color: '#07593f' }}>
                        {isEditing ? <UserCheck className="w-6 h-6" /> : <User className="w-6 h-6" />}
                        {isEditing ? "Editar Colaborador" : "Novo Colaborador"}
                    </DialogTitle>
                </DialogHeader>

                <Tabs defaultValue={initialTab} className="mt-4">
                    <TabsList className="grid grid-cols-5 h-auto p-1 bg-gray-100 rounded-xl">
                        <TabsTrigger value="pessoal" className="rounded-lg py-2">
                            <User className="w-4 h-4 mr-2" /> Pessoal
                        </TabsTrigger>
                        <TabsTrigger value="profissional" className="rounded-lg py-2">
                            <Briefcase className="w-4 h-4 mr-2" /> Profissional
                        </TabsTrigger>
                        <TabsTrigger value="financeiro" className="rounded-lg py-2">
                            <DollarSign className="w-4 h-4 mr-2" /> Remuneração
                        </TabsTrigger>
                        <TabsTrigger value="endereco" className="rounded-lg py-2">
                            <MapPin className="w-4 h-4 mr-2" /> Endereço
                        </TabsTrigger>
                        <TabsTrigger value="sistema" className="rounded-lg py-2">
                            <KeyRound className="w-4 h-4 mr-2" /> Sistema
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="pessoal" className="space-y-4 mt-4">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-2">
                                <Label htmlFor="nome_completo">Nome Completo</Label>
                                <Input
                                    id="nome_completo"
                                    value={formData.nome_completo}
                                    onChange={(e) => handleChange("nome_completo", e.target.value)}
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
                                <Label htmlFor="cpf">CPF</Label>
                                <Input
                                    id="cpf"
                                    value={formData.cpf}
                                    onChange={(e) => handleChange("cpf", formatarCPF(e.target.value))}
                                    maxLength={14}
                                />
                            </div>
                            <div>
                                <Label htmlFor="rg">RG</Label>
                                <Input
                                    id="rg"
                                    value={formData.rg}
                                    onChange={(e) => handleChange("rg", e.target.value)}
                                />
                            </div>
                            <div>
                                <Label htmlFor="telefone">Telefone</Label>
                                <Input
                                    id="telefone"
                                    value={formData.telefone}
                                    onChange={(e) => handleChange("telefone", formatarTelefone(e.target.value))}
                                />
                            </div>
                            <div className="col-span-3">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => handleChange("email", e.target.value)}
                                />
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="profissional" className="space-y-4 mt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="cargo">Cargo</Label>
                                <Select value={formData.cargo} onValueChange={(v) => handleChange("cargo", v)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione o cargo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CARGOS.map(c => (
                                            <SelectItem key={c.value} value={c.value}>
                                                <div className="flex items-center gap-2">
                                                    {createElement(c.icon, { className: "w-4 h-4", style: { color: c.color } })}
                                                    {c.label}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {getCargoConfig(formData.cargo)?.requiresStore && (
                                <div>
                                    <Label htmlFor="loja">Loja</Label>
                                    <Select value={formData.loja} onValueChange={(v) => handleChange("loja", v)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione a loja" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {lojasReal.map(l => (
                                                <SelectItem key={l.id} value={l.nome}>{l.nome}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            <div>
                                <Label htmlFor="status">Status</Label>
                                <Select value={formData.status} onValueChange={(v) => handleChange("status", v)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label htmlFor="tipo_contrato">Contrato</Label>
                                <Select value={formData.tipo_contrato} onValueChange={(v) => handleChange("tipo_contrato", v)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {CONTRATO_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            <div>
                                <Label htmlFor="data_admissao">Admissão</Label>
                                <Input type="date" value={formData.data_admissao} onChange={(e) => handleChange("data_admissao", e.target.value)} />
                            </div>
                            
                            <div>
                                <Label htmlFor="carga_horaria">Carga Horária</Label>
                                <Input type="number" value={formData.carga_horaria} onChange={(e) => handleChange("carga_horaria", Number(e.target.value))} />
                            </div>
                        </div>

                        {(formData.cargo === 'Montador' || formData.cargo === 'Montador Externo') && (
                            <div className="bg-blue-50 p-4 rounded-lg border">
                                <Label className="font-bold">PIN de Montagem</Label>
                                <Input type="password" maxLength={4} value={formData.pin_montagem} onChange={(e) => handleChange("pin_montagem", e.target.value.replace(/\D/g, ''))} />
                            </div>
                        )}
                        
                        <div className="space-y-2">
                             <Label htmlFor="observacoes">Observações</Label>
                             <Textarea id="observacoes" value={formData.observacoes} onChange={(e) => handleChange("observacoes", e.target.value)} className="min-h-[100px]" />
                        </div>
                    </TabsContent>

                    <TabsContent value="financeiro" className="space-y-6 mt-4">
                        <Card className="border-0 shadow-sm bg-blue-50">
                            <CardContent className="pt-4">
                                <Label>Salário Base</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2 text-gray-400">R$</span>
                                    <Input type="number" className="pl-9" value={formData.salario_base} onChange={(e) => handleChange("salario_base", Number(e.target.value))} />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-4 space-y-4">
                                <Label className="font-bold text-gray-700">Adicionais e Benefícios</Label>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="p-3 bg-white rounded-lg border">
                                        <div className="flex items-center justify-between mb-2">
                                            <Label className="text-sm">Noturno</Label>
                                            <button
                                                type="button"
                                                onClick={() => handleChange("adicional_noturno", !formData.adicional_noturno)}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.adicional_noturno ? 'bg-indigo-600' : 'bg-gray-300'}`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.adicional_noturno ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="p-3 bg-white rounded-lg border">
                                        <div className="flex items-center justify-between mb-2">
                                            <Label className="text-sm">Periculos.</Label>
                                            <button
                                                type="button"
                                                onClick={() => handleChange("periculosidade", !formData.periculosidade)}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.periculosidade ? 'bg-red-500' : 'bg-gray-300'}`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.periculosidade ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="p-3 bg-white rounded-lg border">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Shield className="w-4 h-4 text-amber-500" />
                                            <Label className="text-sm font-medium">Insalubridade</Label>
                                        </div>
                                        <Select
                                            value={formData.insalubridade_grau || "nenhuma"}
                                            onValueChange={(v) => handleChange("insalubridade_grau", v === "nenhuma" ? "" : v)}
                                        >
                                            <SelectTrigger className="h-8">
                                                <SelectValue placeholder="Nenhuma" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="nenhuma">Nenhuma</SelectItem>
                                                <SelectItem value="minimo">Mínimo (10% do S.M.)</SelectItem>
                                                <SelectItem value="medio">Médio (20% do S.M.)</SelectItem>
                                                <SelectItem value="maximo">Máximo (40% do S.M.)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="p-3 bg-white rounded-lg border">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Users className="w-4 h-4 text-green-600" />
                                            <Label className="text-sm font-medium">Nº Dependentes</Label>
                                        </div>
                                        <Input
                                            type="number"
                                            min="0"
                                            max="20"
                                            value={formData.numero_dependentes}
                                            onChange={(e) => handleChange("numero_dependentes", Number(e.target.value) || 0)}
                                            className="h-8"
                                            placeholder="0"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Para IRRF e Sal. Família</p>
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

                        {/* Resumo Mensal Expandido */}
                        <Card className="border-2" style={{ borderColor: '#07593f' }}>
                            <CardContent className="pt-4">
                                <h3 className="font-semibold mb-3" style={{ color: '#07593f' }}>Resumo Mensal (CLT)</h3>
                                <div className="space-y-1.5">
                                    {/* Base */}
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Salário Base</span>
                                        <span className="font-medium">{formatCurrency(totals.salario_base)}</span>
                                    </div>

                                    {/* Adicionais */}
                                    {totals.adicional_noturno > 0 && (
                                        <div className="flex justify-between text-indigo-600">
                                            <span>(+) Adic. Noturno 20%</span>
                                            <span>+ {formatCurrency(totals.adicional_noturno)}</span>
                                        </div>
                                    )}
                                    {totals.insalubridade > 0 && (
                                        <div className="flex justify-between text-amber-600">
                                            <span>(+) Insalubridade</span>
                                            <span>+ {formatCurrency(totals.insalubridade)}</span>
                                        </div>
                                    )}
                                    {totals.periculosidade > 0 && (
                                        <div className="flex justify-between text-red-600">
                                            <span>(+) Periculosidade 30%</span>
                                            <span>+ {formatCurrency(totals.periculosidade)}</span>
                                        </div>
                                    )}

                                    {/* Bruto */}
                                    <div className="border-t pt-1.5 flex justify-between font-semibold">
                                        <span>Salário Bruto</span>
                                        <span>{formatCurrency(totals.salario_bruto)}</span>
                                    </div>

                                    {/* Benefícios empresa */}
                                    {totals.beneficios_empresa > 0 && (
                                        <div className="flex justify-between text-blue-600">
                                            <span>(+) Benefícios Empresa</span>
                                            <span>+ {formatCurrency(totals.beneficios_empresa)}</span>
                                        </div>
                                    )}

                                    {/* Descontos */}
                                    <div className="border-t pt-1.5">
                                        <p className="text-xs text-gray-500 mb-1">Descontos obrigatórios:</p>
                                    </div>
                                    <div className="flex justify-between text-red-600">
                                        <span>(-) INSS ({totals.inss_faixa})</span>
                                        <span>- {formatCurrency(totals.inss)}</span>
                                    </div>
                                    {totals.irrf > 0 && (
                                        <div className="flex justify-between text-red-600">
                                            <span>(-) IRRF ({totals.irrf_faixa})</span>
                                            <span>- {formatCurrency(totals.irrf)}</span>
                                        </div>
                                    )}
                                    {totals.vale_transporte > 0 && (
                                        <div className="flex justify-between text-red-600">
                                            <span>(-) Desc. VT (6% CLT)</span>
                                            <span>- {formatCurrency(totals.vale_transporte)}</span>
                                        </div>
                                    )}

                                    {/* Benefícios trabalhador */}
                                    {totals.salario_familia > 0 && (
                                        <div className="flex justify-between text-green-600">
                                            <span>(+) Salário Família</span>
                                            <span>+ {formatCurrency(totals.salario_familia)}</span>
                                        </div>
                                    )}

                                    {/* Líquido */}
                                    <div className="border-t pt-2 flex justify-between">
                                        <span className="font-bold text-lg" style={{ color: '#07593f' }}>Líquido Estimado</span>
                                        <span className="font-bold text-lg" style={{ color: '#07593f' }}>{formatCurrency(totals.salario_liquido)}</span>
                                    </div>

                                    {/* FGTS e custo empresa */}
                                    <div className="border-t pt-1.5 mt-2">
                                        <p className="text-xs text-gray-500 mb-1">Encargos empresa (não desconta do funcionário):</p>
                                    </div>
                                    <div className="flex justify-between text-orange-600">
                                        <span>FGTS (8%)</span>
                                        <span>{formatCurrency(totals.fgts)}</span>
                                    </div>
                                    <div className="flex justify-between font-semibold text-gray-700">
                                        <span>Custo Total Empresa</span>
                                        <span>{formatCurrency(totals.custo_total_empresa)}</span>
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
                                    onChange={(e) => handleChange("cep", formatarCEP(e.target.value))}
                                    onBlur={buscarCep}
                                    placeholder="00000-000"
                                    maxLength={9}
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
                                            {usuariosDisponiveis.map(u => (
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
