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
import { User, Briefcase, MapPin, CreditCard, Link, Save, Loader2, Gift, DollarSign, Calendar } from "lucide-react";
import { toast } from "sonner";

const STATUS_OPTIONS = ["Ativo", "Férias", "Licença", "Afastado", "Desligado"];
const SETOR_OPTIONS = ["Vendas", "Logística", "Montagem", "Administrativo", "Financeiro", "RH", "Estoque", "Atendimento"];
const CONTRATO_OPTIONS = ["CLT", "PJ", "Estagiário", "Temporário"];
const ESTADOS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
const TIPO_PAGAMENTO = ["Mensal", "Quinzenal", "Semanal"];
const DIAS_PAGAMENTO = Array.from({ length: 31 }, (_, i) => i + 1);

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
                                <Input
                                    id="cargo"
                                    value={formData.cargo}
                                    onChange={(e) => handleChange("cargo", e.target.value)}
                                    placeholder="Ex: Vendedor, Montador, etc."
                                />
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
                        <div className="p-4 rounded-lg" style={{ backgroundColor: '#f0f9ff', borderLeft: '4px solid #07593f' }}>
                            <p className="text-sm text-gray-600 mb-2">
                                <strong>Vínculo com Usuário do Sistema:</strong> Se este colaborador possui acesso ao sistema,
                                vincule-o a um usuário existente para que suas informações fiquem sincronizadas.
                            </p>
                        </div>
                        <div>
                            <Label htmlFor="user_id">Usuário do Sistema</Label>
                            <Select value={formData.user_id || "none"} onValueChange={(v) => handleChange("user_id", v === "none" ? "" : v)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione um usuário (opcional)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Nenhum (sem acesso ao sistema)</SelectItem>
                                    {usuarios.map(u => (
                                        <SelectItem key={u.id} value={u.id}>
                                            {u.full_name || u.nome || u.email} - {u.cargo || 'Sem cargo'}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="observacoes">Observações Gerais</Label>
                            <Textarea
                                id="observacoes"
                                value={formData.observacoes}
                                onChange={(e) => handleChange("observacoes", e.target.value)}
                                placeholder="Anotações internas sobre o colaborador..."
                                rows={4}
                            />
                        </div>
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
