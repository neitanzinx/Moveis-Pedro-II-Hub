import React, { createElement, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { CARGOS, getCargoConfig } from "@/config/cargos";
import { useLojas } from "@/hooks/useLojas";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    User,
    Briefcase,
    Save,
    Loader2,
    DollarSign,
    Calendar,
    KeyRound,
    CheckCircle2,
    UserX,
    UserCheck,
    ExternalLink,
    Info,
    Users,
    MapPin,
    CreditCard,
    Shield,
} from "lucide-react";
import { toast } from "sonner";
import { formatarCEP, formatarCPF, formatarTelefone } from "@/utils/formatters";
import { gerarResumoEstimado } from "@/utils/calculosTrabalhistas";

const STATUS_OPTIONS = ["Ativo", "Férias", "Licença", "Afastado", "Desligado"];
const CONTRATO_OPTIONS = ["CLT", "PJ", "Estagiário", "Temporário"];
const ESTADOS = [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
    "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
    "SP", "SE", "TO",
];
const TIPO_PAGAMENTO = ["Mensal", "Quinzenal", "Semanal"];
const DIAS_PAGAMENTO = Array.from({ length: 31 }, (_, i) => i + 1);
const INSALUBRIDADE_OPCOES = [
    { value: "", label: "Não aplicável" },
    { value: "minimo", label: "Grau Mínimo (10%)" },
    { value: "medio", label: "Grau Médio (20%)" },
    { value: "maximo", label: "Grau Máximo (40%)" },
];

const formatCurrency = (value) => {
    const num = Number(value) || 0;
    return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

function SectionTitle({ children }) {
    return (
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3 mt-1">
            {children}
        </p>
    );
}

export default function ColaboradorModal({
    colaborador,
    usuarios = [],
    onClose,
    onSuccess,
    initialTab = "pessoal",
}) {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { can } = useAuth();
    const canManageAccess = can("manage_user_access");
    const { data: lojasReal = [] } = useLojas();
    const isEditing = !!colaborador && !colaborador.isAcessoRapido;

    const [formData, setFormData] = useState({
        nome_completo: colaborador?.nome_completo || "",
        cpf: colaborador?.cpf || "",
        rg: colaborador?.rg || "",
        data_nascimento: colaborador?.data_nascimento || "",
        telefone: colaborador?.telefone || "",
        email: colaborador?.email || "",
        // Endereço — merged into pessoal tab
        cep: colaborador?.cep || "",
        endereco: colaborador?.endereco || "",
        numero: colaborador?.numero || "",
        complemento: colaborador?.complemento || "",
        bairro: colaborador?.bairro || "",
        cidade: colaborador?.cidade || "",
        estado: colaborador?.estado || "",
        // Profissional
        cargo: colaborador?.cargo || "",
        loja: colaborador?.loja || "",
        status: colaborador?.status || "Ativo",
        tipo_contrato: colaborador?.tipo_contrato || "CLT",
        data_admissao: colaborador?.data_admissao || "",
        carga_horaria: colaborador?.carga_horaria || 44,
        data_demissao: colaborador?.data_demissao || "",
        motivo_demissao: colaborador?.motivo_demissao || "",
        adicional_noturno: colaborador?.adicional_noturno || false,
        insalubridade_grau: colaborador?.insalubridade_grau || "",
        periculosidade: colaborador?.periculosidade || false,
        pin_montagem: colaborador?.pin_montagem || "",
        observacoes: colaborador?.observacoes || "",
        // Remuneração
        salario_base: colaborador?.salario_base || "",
        numero_dependentes: colaborador?.numero_dependentes || 0,
        dia_pagamento: colaborador?.dia_pagamento || 5,
        tipo_pagamento: colaborador?.tipo_pagamento || "Mensal",
        vale_transporte: colaborador?.vale_transporte || "",
        vale_alimentacao: colaborador?.vale_alimentacao || "",
        vale_refeicao: colaborador?.vale_refeicao || "",
        plano_saude: colaborador?.plano_saude || "",
        plano_odontologico: colaborador?.plano_odontologico || "",
        bonus_mensal: colaborador?.bonus_mensal || "",
        outros_beneficios: colaborador?.outros_beneficios || "",
        descricao_outros_beneficios: colaborador?.descricao_outros_beneficios || "",
        // Dados bancários
        banco: colaborador?.banco || "",
        agencia: colaborador?.agencia || "",
        conta: colaborador?.conta || "",
        pix: colaborador?.pix || "",
        // Sistema
        user_id: colaborador?.user_id || "",
    });

    const [saving, setSaving] = useState(false);
    const usaPinMontagem = formData.cargo === "Montador";

    const totals = useMemo(() => gerarResumoEstimado(formData), [formData]);

    const createMutation = useMutation({
        mutationFn: async (data) => {
            const colaboradorData = { ...data };
            delete colaboradorData.loja;
            colaboradorData.pin_montagem = data.cargo === "Montador" ? data.pin_montagem : null;
            const createdColab = await base44.entities.Colaborador.create(colaboradorData);
            if (data.user_id && data.cargo) {
                try {
                    const cargoConfig = getCargoConfig(data.cargo);
                    await base44.entities.User.update(data.user_id, {
                        cargo: data.cargo,
                        full_name: data.nome_completo,
                        loja: cargoConfig?.requiresStore ? data.loja : null,
                        is_vendedor: data.cargo === "Vendedor",
                    });
                } catch (syncError) {
                    console.error("Erro ao sincronizar com public_users:", syncError);
                }
            }
            return createdColab;
        },
        onSuccess: (createdData) => {
            queryClient.invalidateQueries(["colaboradores"]);
            queryClient.invalidateQueries(["users"]);
            toast.success("Colaborador cadastrado com sucesso!");
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
            colaboradorData.pin_montagem = data.cargo === "Montador" ? data.pin_montagem : null;
            const updatedColab = await base44.entities.Colaborador.update(id, colaboradorData);
            if (data.user_id && data.cargo) {
                try {
                    const cargoConfig = getCargoConfig(data.cargo);
                    await base44.entities.User.update(data.user_id, {
                        cargo: data.cargo,
                        full_name: data.nome_completo,
                        loja: cargoConfig?.requiresStore ? data.loja : null,
                        is_vendedor: data.cargo === "Vendedor",
                    });
                } catch (syncError) {
                    console.error("Erro ao sincronizar com public_users:", syncError);
                }
            }
            return updatedColab;
        },
        onSuccess: () => {
            queryClient.invalidateQueries(["colaboradores"]);
            queryClient.invalidateQueries(["users"]);
            toast.success("Colaborador atualizado com sucesso!");
            onClose();
        },
        onError: (error) => {
            toast.error("Erro ao atualizar colaborador: " + error.message);
        },
    });

    const { data: todosColaboradores = [] } = useQuery({
        queryKey: ["colaboradores_lista_completa"],
        queryFn: () => base44.entities.Colaborador.list(),
        staleTime: 5000,
    });

    const linkedUser = useMemo(
        () => usuarios.find((u) => u.id === formData.user_id),
        [formData.user_id, usuarios]
    );

    const usuariosDisponiveis = useMemo(() => {
        const userIdsEmUso = new Set(
            todosColaboradores
                .filter((c) => c.id !== colaborador?.id)
                .map((c) => c.user_id)
                .filter(Boolean)
        );
        return usuarios.filter((u) => !userIdsEmUso.has(u.id));
    }, [usuarios, todosColaboradores, colaborador]);

    const handleChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const buscarCep = async () => {
        const cep = formData.cep?.replace(/\D/g, "");
        if (cep?.length === 8) {
            try {
                const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                const data = await response.json();
                if (!data.erro) {
                    setFormData((prev) => ({
                        ...prev,
                        endereco: data.logradouro,
                        bairro: data.bairro,
                        cidade: data.localidade,
                        estado: data.uf,
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
            const suggestedUser =
                !formData.user_id && formData.email
                    ? usuariosDisponiveis.find(
                          (user) =>
                              user.email?.toLowerCase() === formData.email.toLowerCase()
                      )
                    : null;

            const payload = {
                ...formData,
                user_id: canManageAccess
                    ? formData.user_id || suggestedUser?.id || ""
                    : colaborador?.user_id || "",
            };

            if (isEditing) {
                await updateMutation.mutateAsync({ id: colaborador.id, data: payload });
            } else {
                await createMutation.mutateAsync(payload);
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
                    <DialogTitle
                        className="flex items-center gap-2 text-xl font-bold"
                        style={{ color: "#07593f" }}
                    >
                        {isEditing ? (
                            <UserCheck className="w-5 h-5" />
                        ) : (
                            <User className="w-5 h-5" />
                        )}
                        {isEditing ? "Editar Colaborador" : "Novo Colaborador"}
                    </DialogTitle>
                </DialogHeader>

                <Tabs defaultValue={initialTab} className="mt-2">
                    <TabsList className="grid grid-cols-4 h-auto p-1 bg-gray-100 rounded-xl">
                        <TabsTrigger value="pessoal" className="rounded-lg py-2 text-xs sm:text-sm">
                            <User className="w-4 h-4 mr-1.5 hidden sm:inline" />
                            Pessoal
                        </TabsTrigger>
                        <TabsTrigger value="profissional" className="rounded-lg py-2 text-xs sm:text-sm">
                            <Briefcase className="w-4 h-4 mr-1.5 hidden sm:inline" />
                            Profissional
                        </TabsTrigger>
                        <TabsTrigger value="remuneracao" className="rounded-lg py-2 text-xs sm:text-sm">
                            <DollarSign className="w-4 h-4 mr-1.5 hidden sm:inline" />
                            Remuneração
                        </TabsTrigger>
                        <TabsTrigger value="sistema" className="rounded-lg py-2 text-xs sm:text-sm">
                            <KeyRound className="w-4 h-4 mr-1.5 hidden sm:inline" />
                            Sistema
                        </TabsTrigger>
                    </TabsList>

                    {/* ── Pessoal ── */}
                    <TabsContent value="pessoal" className="space-y-5 mt-4">
                        <SectionTitle>Dados de Identificação</SectionTitle>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-2">
                                <Label>Nome Completo</Label>
                                <Input
                                    value={formData.nome_completo}
                                    onChange={(e) =>
                                        handleChange("nome_completo", e.target.value)
                                    }
                                    placeholder="Nome completo do colaborador"
                                />
                            </div>
                            <div>
                                <Label>Data de Nascimento</Label>
                                <Input
                                    type="date"
                                    value={formData.data_nascimento}
                                    onChange={(e) =>
                                        handleChange("data_nascimento", e.target.value)
                                    }
                                />
                            </div>
                            <div>
                                <Label>CPF</Label>
                                <Input
                                    value={formData.cpf}
                                    onChange={(e) =>
                                        handleChange("cpf", formatarCPF(e.target.value))
                                    }
                                    maxLength={14}
                                    placeholder="000.000.000-00"
                                />
                            </div>
                            <div>
                                <Label>RG</Label>
                                <Input
                                    value={formData.rg}
                                    onChange={(e) => handleChange("rg", e.target.value)}
                                    placeholder="Número do RG"
                                />
                            </div>
                            <div>
                                <Label>Telefone</Label>
                                <Input
                                    value={formData.telefone}
                                    onChange={(e) =>
                                        handleChange(
                                            "telefone",
                                            formatarTelefone(e.target.value)
                                        )
                                    }
                                    placeholder="(00) 00000-0000"
                                />
                            </div>
                            <div className="col-span-3">
                                <Label>Email</Label>
                                <Input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => handleChange("email", e.target.value)}
                                    placeholder="email@empresa.com.br"
                                />
                            </div>
                        </div>

                        <div className="border-t pt-4" style={{ borderColor: "#E5E0D8" }}>
                            <SectionTitle>Endereço</SectionTitle>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <Label>CEP</Label>
                                    <Input
                                        value={formData.cep}
                                        onChange={(e) =>
                                            handleChange("cep", formatarCEP(e.target.value))
                                        }
                                        onBlur={buscarCep}
                                        maxLength={9}
                                        placeholder="00000-000"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <Label>Logradouro</Label>
                                    <Input
                                        value={formData.endereco}
                                        onChange={(e) =>
                                            handleChange("endereco", e.target.value)
                                        }
                                        placeholder="Rua, Avenida..."
                                    />
                                </div>
                                <div>
                                    <Label>Número</Label>
                                    <Input
                                        value={formData.numero}
                                        onChange={(e) =>
                                            handleChange("numero", e.target.value)
                                        }
                                    />
                                </div>
                                <div>
                                    <Label>Complemento</Label>
                                    <Input
                                        value={formData.complemento}
                                        onChange={(e) =>
                                            handleChange("complemento", e.target.value)
                                        }
                                    />
                                </div>
                                <div>
                                    <Label>Bairro</Label>
                                    <Input
                                        value={formData.bairro}
                                        onChange={(e) =>
                                            handleChange("bairro", e.target.value)
                                        }
                                    />
                                </div>
                                <div className="col-span-2">
                                    <Label>Cidade</Label>
                                    <Input
                                        value={formData.cidade}
                                        onChange={(e) =>
                                            handleChange("cidade", e.target.value)
                                        }
                                    />
                                </div>
                                <div>
                                    <Label>Estado</Label>
                                    <Select
                                        value={formData.estado}
                                        onValueChange={(v) => handleChange("estado", v)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="UF" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {ESTADOS.map((uf) => (
                                                <SelectItem key={uf} value={uf}>
                                                    {uf}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    {/* ── Profissional ── */}
                    <TabsContent value="profissional" className="space-y-5 mt-4">
                        <SectionTitle>Cargo e Vínculo</SectionTitle>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Cargo</Label>
                                <Select
                                    value={formData.cargo}
                                    onValueChange={(v) => handleChange("cargo", v)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione o cargo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CARGOS.map((c) => (
                                            <SelectItem key={c.value} value={c.value}>
                                                <div className="flex items-center gap-2">
                                                    {createElement(c.icon, {
                                                        className: "w-4 h-4",
                                                        style: { color: c.color },
                                                    })}
                                                    {c.label}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {getCargoConfig(formData.cargo)?.requiresStore && (
                                <div>
                                    <Label>Loja</Label>
                                    <Select
                                        value={formData.loja}
                                        onValueChange={(v) => handleChange("loja", v)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione a loja" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {lojasReal.map((l) => (
                                                <SelectItem key={l.id} value={l.nome}>
                                                    {l.nome}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            <div>
                                <Label>Status</Label>
                                <Select
                                    value={formData.status}
                                    onValueChange={(v) => handleChange("status", v)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {STATUS_OPTIONS.map((s) => (
                                            <SelectItem key={s} value={s}>
                                                {s}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Tipo de Contrato</Label>
                                <Select
                                    value={formData.tipo_contrato}
                                    onValueChange={(v) => handleChange("tipo_contrato", v)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CONTRATO_OPTIONS.map((c) => (
                                            <SelectItem key={c} value={c}>
                                                {c}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Data de Admissão</Label>
                                <Input
                                    type="date"
                                    value={formData.data_admissao}
                                    onChange={(e) =>
                                        handleChange("data_admissao", e.target.value)
                                    }
                                />
                            </div>

                            <div>
                                <Label>Carga Horária (h/semana)</Label>
                                <Input
                                    type="number"
                                    value={formData.carga_horaria}
                                    onChange={(e) =>
                                        handleChange(
                                            "carga_horaria",
                                            Number(e.target.value)
                                        )
                                    }
                                />
                            </div>

                            {formData.status === "Desligado" && (
                                <>
                                    <div>
                                        <Label>Data de Demissão</Label>
                                        <Input
                                            type="date"
                                            value={formData.data_demissao}
                                            onChange={(e) =>
                                                handleChange(
                                                    "data_demissao",
                                                    e.target.value
                                                )
                                            }
                                        />
                                    </div>
                                    <div>
                                        <Label>Motivo da Demissão</Label>
                                        <Input
                                            value={formData.motivo_demissao}
                                            onChange={(e) =>
                                                handleChange(
                                                    "motivo_demissao",
                                                    e.target.value
                                                )
                                            }
                                        />
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="border-t pt-4" style={{ borderColor: "#E5E0D8" }}>
                            <SectionTitle>Adicionais Trabalhistas</SectionTitle>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Insalubridade</Label>
                                    <Select
                                        value={formData.insalubridade_grau}
                                        onValueChange={(v) =>
                                            handleChange("insalubridade_grau", v)
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione o grau" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {INSALUBRIDADE_OPCOES.map((opt) => (
                                                <SelectItem key={opt.value} value={opt.value}>
                                                    {opt.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                {usaPinMontagem && (
                                    <div>
                                        <Label>PIN de Montagem</Label>
                                        <Input
                                            value={formData.pin_montagem}
                                            onChange={(e) =>
                                                handleChange("pin_montagem", e.target.value.replace(/\D/g, "").slice(0, 4))
                                            }
                                            placeholder="PIN numérico"
                                            maxLength={4}
                                        />
                                    </div>
                                )}
                                <div className="flex items-center gap-3 pt-2">
                                    <Checkbox
                                        id="adicional_noturno"
                                        checked={!!formData.adicional_noturno}
                                        onCheckedChange={(v) =>
                                            handleChange("adicional_noturno", v)
                                        }
                                    />
                                    <Label htmlFor="adicional_noturno" className="cursor-pointer">
                                        Adicional Noturno (+20%)
                                    </Label>
                                </div>
                                <div className="flex items-center gap-3 pt-2">
                                    <Checkbox
                                        id="periculosidade"
                                        checked={!!formData.periculosidade}
                                        onCheckedChange={(v) =>
                                            handleChange("periculosidade", v)
                                        }
                                    />
                                    <Label htmlFor="periculosidade" className="cursor-pointer">
                                        Periculosidade (+30%)
                                    </Label>
                                </div>
                            </div>
                        </div>

                        <div className="border-t pt-4" style={{ borderColor: "#E5E0D8" }}>
                            <SectionTitle>Observações</SectionTitle>
                            <Textarea
                                value={formData.observacoes}
                                onChange={(e) =>
                                    handleChange("observacoes", e.target.value)
                                }
                                className="min-h-[100px]"
                                placeholder="Observações internas sobre o colaborador..."
                            />
                        </div>
                    </TabsContent>

                    {/* ── Remuneração ── */}
                    <TabsContent value="remuneracao" className="space-y-5 mt-4">
                        <SectionTitle>Salário e Pagamento</SectionTitle>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Salário Base (R$)</Label>
                                <Input
                                    type="number"
                                    value={formData.salario_base}
                                    onChange={(e) =>
                                        handleChange("salario_base", Number(e.target.value))
                                    }
                                    placeholder="0,00"
                                />
                            </div>
                            <div>
                                <Label>Nº de Dependentes</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    max="20"
                                    value={formData.numero_dependentes}
                                    onChange={(e) =>
                                        handleChange(
                                            "numero_dependentes",
                                            Number(e.target.value) || 0
                                        )
                                    }
                                />
                            </div>
                            <div>
                                <Label>Tipo de Pagamento</Label>
                                <Select
                                    value={formData.tipo_pagamento}
                                    onValueChange={(v) =>
                                        handleChange("tipo_pagamento", v)
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {TIPO_PAGAMENTO.map((t) => (
                                            <SelectItem key={t} value={t}>
                                                {t}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Dia do Pagamento</Label>
                                <Select
                                    value={String(formData.dia_pagamento)}
                                    onValueChange={(v) =>
                                        handleChange("dia_pagamento", Number(v))
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Dia" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {DIAS_PAGAMENTO.map((d) => (
                                            <SelectItem key={d} value={String(d)}>
                                                Dia {d}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="border-t pt-4" style={{ borderColor: "#E5E0D8" }}>
                            <SectionTitle>Benefícios</SectionTitle>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <Label>Vale Transporte (R$)</Label>
                                    <Input
                                        type="number"
                                        value={formData.vale_transporte}
                                        onChange={(e) =>
                                            handleChange(
                                                "vale_transporte",
                                                Number(e.target.value)
                                            )
                                        }
                                        placeholder="0,00"
                                    />
                                </div>
                                <div>
                                    <Label>Vale Alimentação (R$)</Label>
                                    <Input
                                        type="number"
                                        value={formData.vale_alimentacao}
                                        onChange={(e) =>
                                            handleChange(
                                                "vale_alimentacao",
                                                Number(e.target.value)
                                            )
                                        }
                                        placeholder="0,00"
                                    />
                                </div>
                                <div>
                                    <Label>Vale Refeição (R$)</Label>
                                    <Input
                                        type="number"
                                        value={formData.vale_refeicao}
                                        onChange={(e) =>
                                            handleChange(
                                                "vale_refeicao",
                                                Number(e.target.value)
                                            )
                                        }
                                        placeholder="0,00"
                                    />
                                </div>
                                <div>
                                    <Label>Plano de Saúde (R$)</Label>
                                    <Input
                                        type="number"
                                        value={formData.plano_saude}
                                        onChange={(e) =>
                                            handleChange(
                                                "plano_saude",
                                                Number(e.target.value)
                                            )
                                        }
                                        placeholder="0,00"
                                    />
                                </div>
                                <div>
                                    <Label>Plano Odontológico (R$)</Label>
                                    <Input
                                        type="number"
                                        value={formData.plano_odontologico}
                                        onChange={(e) =>
                                            handleChange(
                                                "plano_odontologico",
                                                Number(e.target.value)
                                            )
                                        }
                                        placeholder="0,00"
                                    />
                                </div>
                                <div>
                                    <Label>Bônus Mensal (R$)</Label>
                                    <Input
                                        type="number"
                                        value={formData.bonus_mensal}
                                        onChange={(e) =>
                                            handleChange(
                                                "bonus_mensal",
                                                Number(e.target.value)
                                            )
                                        }
                                        placeholder="0,00"
                                    />
                                </div>
                                <div>
                                    <Label>Outros Benefícios (R$)</Label>
                                    <Input
                                        type="number"
                                        value={formData.outros_beneficios}
                                        onChange={(e) =>
                                            handleChange(
                                                "outros_beneficios",
                                                Number(e.target.value)
                                            )
                                        }
                                        placeholder="0,00"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <Label>Descrição dos Outros Benefícios</Label>
                                    <Input
                                        value={formData.descricao_outros_beneficios}
                                        onChange={(e) =>
                                            handleChange(
                                                "descricao_outros_beneficios",
                                                e.target.value
                                            )
                                        }
                                        placeholder="Ex: Combustível, estacionamento..."
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="border-t pt-4" style={{ borderColor: "#E5E0D8" }}>
                            <SectionTitle>Dados Bancários</SectionTitle>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Banco</Label>
                                    <Input
                                        value={formData.banco}
                                        onChange={(e) =>
                                            handleChange("banco", e.target.value)
                                        }
                                        placeholder="Nome do banco"
                                    />
                                </div>
                                <div>
                                    <Label>Chave PIX</Label>
                                    <Input
                                        value={formData.pix}
                                        onChange={(e) =>
                                            handleChange("pix", e.target.value)
                                        }
                                        placeholder="CPF, email, telefone ou chave aleatória"
                                    />
                                </div>
                                <div>
                                    <Label>Agência</Label>
                                    <Input
                                        value={formData.agencia}
                                        onChange={(e) =>
                                            handleChange("agencia", e.target.value)
                                        }
                                        placeholder="0000"
                                    />
                                </div>
                                <div>
                                    <Label>Conta</Label>
                                    <Input
                                        value={formData.conta}
                                        onChange={(e) =>
                                            handleChange("conta", e.target.value)
                                        }
                                        placeholder="00000-0"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Salary summary */}
                        <Card className="border-2" style={{ borderColor: "#07593f" }}>
                            <CardContent className="pt-4 pb-4">
                                <h3
                                    className="font-semibold mb-3 text-sm"
                                    style={{ color: "#07593f" }}
                                >
                                    Resumo Mensal Estimado (CLT 2025)
                                </h3>
                                <div className="grid grid-cols-3 gap-3 text-sm">
                                    <div className="bg-gray-50 rounded-lg p-3">
                                        <p className="text-xs text-gray-500">Salário Bruto</p>
                                        <p className="font-bold mt-0.5">
                                            {formatCurrency(totals.salario_base)}
                                        </p>
                                    </div>
                                    <div
                                        className="rounded-lg p-3"
                                        style={{ backgroundColor: "#D1FAE5" }}
                                    >
                                        <p
                                            className="text-xs"
                                            style={{ color: "#065F46" }}
                                        >
                                            Líquido Estimado
                                        </p>
                                        <p
                                            className="font-bold mt-0.5"
                                            style={{ color: "#07593f" }}
                                        >
                                            {formatCurrency(totals.salario_liquido)}
                                        </p>
                                    </div>
                                    <div className="bg-orange-50 rounded-lg p-3">
                                        <p className="text-xs text-orange-600">
                                            Custo Total Empresa
                                        </p>
                                        <p className="font-bold text-orange-700 mt-0.5">
                                            {formatCurrency(totals.custo_total_empresa)}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ── Sistema ── */}
                    <TabsContent value="sistema" className="space-y-4 mt-4">
                        {!formData.user_id ? (
                            <div className="space-y-5">
                                <Alert className="bg-blue-50 border-blue-200">
                                    <KeyRound className="w-4 h-4 text-blue-600" />
                                    <AlertDescription className="text-blue-800">
                                        Este colaborador ainda não possui vínculo com uma
                                        conta do sistema. Criação de credenciais e reset de
                                        senha são feitos na área Admin de Usuários.
                                    </AlertDescription>
                                </Alert>

                                <Card>
                                    <CardContent className="pt-5">
                                        <div className="space-y-4">
                                            <h3 className="font-semibold flex items-center gap-2 text-sm">
                                                <Info className="w-4 h-4 text-gray-500" />
                                                Vínculo de Usuário
                                            </h3>
                                            <p className="text-sm text-gray-500">
                                                O RH realiza somente o cadastro do funcionário.
                                                O vínculo com conta de acesso e a geração de
                                                credenciais são realizados pelo Administrador na
                                                área de Gestão de Acessos.
                                            </div>

                                            <Button
                                                variant="outline"
                                                className="gap-2"
                                                onClick={() =>
                                                    navigate("/admin/GerenciamentoUsuarios")
                                                }
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                                Abrir Gestão de Acessos (Admin)
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        ) : (
                            <div className="space-y-5">
                                <Alert className="bg-green-50 border-green-200">
                                    <UserCheck className="w-4 h-4 text-green-600" />
                                    <AlertDescription className="text-green-800">
                                        Este colaborador possui vínculo com usuário do sistema.
                                    </AlertDescription>
                                </Alert>

                                <Card>
                                    <CardContent className="pt-5">
                                        <div className="space-y-4">
                                            <h3 className="font-semibold text-sm">
                                                Resumo de Vínculo
                                            </h3>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="bg-gray-50 p-3 rounded-lg">
                                                    <span className="text-xs text-gray-500">
                                                        Usuário
                                                    </span>
                                                    <div className="font-medium text-sm mt-0.5">
                                                        {linkedUser?.full_name || "..."}
                                                    </div>
                                                    <div className="text-xs text-gray-400">
                                                        {linkedUser?.email}
                                                    </div>
                                                </div>
                                                <div className="bg-gray-50 p-3 rounded-lg">
                                                    <span className="text-xs text-gray-500">
                                                        Matrícula
                                                    </span>
                                                    <div className="text-xl font-mono font-bold tracking-wider mt-0.5">
                                                        {linkedUser?.matricula || "---"}
                                                    </div>
                                                </div>
                                                <div className="bg-gray-50 p-3 rounded-lg">
                                                    <span className="text-xs text-gray-500">
                                                        Status
                                                    </span>
                                                    <div className="mt-0.5">
                                                        {linkedUser?.ativo === false ? (
                                                            <span className="text-red-600 flex items-center gap-1 font-semibold text-sm">
                                                                <UserX className="w-3 h-3" />
                                                                Desativado
                                                            </span>
                                                        ) : (
                                                            <span className="text-green-600 flex items-center gap-1 font-semibold text-sm">
                                                                <CheckCircle2 className="w-3 h-3" />
                                                                Ativo
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="bg-gray-50 p-3 rounded-lg">
                                                    <span className="text-xs text-gray-500">
                                                        Último Login
                                                    </span>
                                                    <div className="text-sm mt-0.5">
                                                        {linkedUser?.ultimo_login
                                                            ? new Date(
                                                                  linkedUser.ultimo_login
                                                              ).toLocaleDateString("pt-BR")
                                                            : "Nunca"}
                                                    </div>
                                                </div>
                                            </div>

                                            <Button
                                                variant="outline"
                                                className="gap-2"
                                                onClick={() =>
                                                    navigate("/admin/GerenciamentoUsuarios")
                                                }
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                                Gerenciar Credenciais no Admin
                                            </Button>

                                            {canManageAccess && (
                                                <div className="pt-3 border-t">
                                                    <Button
                                                        variant="ghost"
                                                        className="w-full text-red-500 hover:text-red-700 hover:bg-red-50"
                                                        onClick={() =>
                                                            handleChange("user_id", "")
                                                        }
                                                    >
                                                        Desvincular Usuário (apenas remove link)
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>

                <div className="flex justify-end gap-3 mt-4 pt-4 border-t">
                    <Button variant="outline" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={saving}
                        style={{
                            background:
                                "linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)",
                        }}
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
