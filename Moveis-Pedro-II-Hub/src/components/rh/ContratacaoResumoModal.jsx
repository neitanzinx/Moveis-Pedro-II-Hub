import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
    User, Briefcase, DollarSign, Gift, Calendar, CreditCard,
    Phone, Mail, MapPin, CheckCircle2, Printer, X
} from "lucide-react";

// Utility function to format currency
const formatCurrency = (value) => {
    const num = Number(value) || 0;
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// Section Header Component
function SectionHeader({ icon: Icon, title, color }) {
    return (
        <div className="flex items-center gap-2 mb-3">
            <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${color}15` }}
            >
                <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <h3 className="font-semibold text-gray-900">{title}</h3>
        </div>
    );
}

// Data Row Component
function DataRow({ label, value, highlight = false }) {
    return (
        <div className="flex justify-between items-center py-1.5">
            <span className="text-sm text-gray-600">{label}</span>
            <span className={`text-sm ${highlight ? 'font-bold text-green-600' : 'font-medium text-gray-900'}`}>
                {value}
            </span>
        </div>
    );
}

// Benefit Badge Component
function BenefitBadge({ label, value, active = true }) {
    if (!active || Number(value) <= 0) return null;

    return (
        <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg border border-blue-100">
            <span className="text-sm text-blue-800">{label}</span>
            <span className="text-sm font-semibold text-blue-900">{formatCurrency(value)}</span>
        </div>
    );
}

export default function ContratacaoResumoModal({ colaborador, onClose }) {
    if (!colaborador) return null;

    // Calculate totals
    const salarioBase = Number(colaborador.salario_base) || 0;
    const valeTransporte = Number(colaborador.vale_transporte) || 0;
    const valeAlimentacao = Number(colaborador.vale_alimentacao) || 0;
    const valeRefeicao = Number(colaborador.vale_refeicao) || 0;
    const planoSaude = Number(colaborador.plano_saude) || 0;
    const planoOdontologico = Number(colaborador.plano_odontologico) || 0;
    const bonusMensal = Number(colaborador.bonus_mensal) || 0;
    const outrosBeneficios = Number(colaborador.outros_beneficios) || 0;

    const totalBeneficios = valeTransporte + valeAlimentacao + valeRefeicao +
        planoSaude + planoOdontologico + bonusMensal + outrosBeneficios;

    const totalBruto = salarioBase + totalBeneficios;

    // Estimated deductions (simplified)
    const estimativaINSS = salarioBase * 0.11; // ~11% average
    const estimativaFGTS = salarioBase * 0.08; // 8%
    const totalDescontos = estimativaINSS;
    const totalLiquido = salarioBase - totalDescontos + totalBeneficios;

    const diaPagamento = colaborador.dia_pagamento || 5;
    const tipoPagamento = colaborador.tipo_pagamento || 'Mensal';

    const handlePrint = () => {
        window.print();
    };

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}>
                            <CheckCircle2 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <span className="text-xl" style={{ color: '#07593f' }}>Resumo de Contratação</span>
                            <p className="text-sm font-normal text-gray-500">Funcionário cadastrado com sucesso!</p>
                        </div>
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 mt-4">
                    {/* Dados Pessoais */}
                    <Card className="border-0 shadow-sm bg-gray-50">
                        <CardContent className="pt-4">
                            <SectionHeader icon={User} title="Dados do Funcionário" color="#07593f" />
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <DataRow label="Nome Completo" value={colaborador.nome_completo || '-'} />
                                    <DataRow label="CPF" value={colaborador.cpf || '-'} />
                                    <DataRow label="Telefone" value={colaborador.telefone || '-'} />
                                    <DataRow label="Email" value={colaborador.email || '-'} />
                                </div>
                                <div>
                                    <DataRow label="Cargo" value={colaborador.cargo || '-'} />
                                    <DataRow label="Setor" value={colaborador.setor || '-'} />
                                    <DataRow label="Tipo Contrato" value={colaborador.tipo_contrato || 'CLT'} />
                                    <DataRow label="Data Admissão" value={colaborador.data_admissao ? new Date(colaborador.data_admissao).toLocaleDateString('pt-BR') : '-'} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Remuneração */}
                    <Card className="border-0 shadow-sm bg-green-50">
                        <CardContent className="pt-4">
                            <SectionHeader icon={DollarSign} title="Remuneração" color="#22c55e" />
                            <div className="space-y-2">
                                <DataRow label="Salário Base" value={formatCurrency(salarioBase)} highlight />
                                <DataRow label="Carga Horária" value={`${colaborador.carga_horaria || 44}h semanais`} />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Benefícios */}
                    {totalBeneficios > 0 && (
                        <Card className="border-0 shadow-sm bg-blue-50/50">
                            <CardContent className="pt-4">
                                <SectionHeader icon={Gift} title="Benefícios" color="#3b82f6" />
                                <div className="grid grid-cols-2 gap-2">
                                    <BenefitBadge label="Vale Transporte" value={valeTransporte} />
                                    <BenefitBadge label="Vale Alimentação" value={valeAlimentacao} />
                                    <BenefitBadge label="Vale Refeição" value={valeRefeicao} />
                                    <BenefitBadge label="Plano de Saúde" value={planoSaude} />
                                    <BenefitBadge label="Plano Odontológico" value={planoOdontologico} />
                                    <BenefitBadge label="Bônus Mensal" value={bonusMensal} />
                                    {outrosBeneficios > 0 && (
                                        <div className="col-span-2">
                                            <BenefitBadge
                                                label={`Outros: ${colaborador.descricao_outros_beneficios || 'Benefícios adicionais'}`}
                                                value={outrosBeneficios}
                                            />
                                        </div>
                                    )}
                                </div>
                                <Separator className="my-3" />
                                <DataRow label="Total em Benefícios" value={formatCurrency(totalBeneficios)} highlight />
                            </CardContent>
                        </Card>
                    )}

                    {/* Resumo Financeiro */}
                    <Card className="border-2" style={{ borderColor: '#07593f' }}>
                        <CardContent className="pt-4">
                            <SectionHeader icon={CreditCard} title="Resumo Financeiro Mensal" color="#07593f" />

                            <div className="space-y-2 mb-4">
                                <DataRow label="Salário Base" value={formatCurrency(salarioBase)} />
                                {totalBeneficios > 0 && (
                                    <DataRow label="(+) Benefícios" value={formatCurrency(totalBeneficios)} />
                                )}
                                <div className="border-t pt-2">
                                    <DataRow label="Total Bruto" value={formatCurrency(totalBruto)} highlight />
                                </div>
                            </div>

                            <div className="p-3 bg-gray-100 rounded-lg mb-4">
                                <p className="text-xs text-gray-600 mb-2">Estimativa de Descontos (CLT):</p>
                                <DataRow label="INSS (~11%)" value={`- ${formatCurrency(estimativaINSS)}`} />
                                <DataRow label="FGTS (8%)" value={formatCurrency(estimativaFGTS)} />
                            </div>

                            <div className="p-4 rounded-xl" style={{ backgroundColor: '#07593f10' }}>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="text-sm text-gray-600">Valor Líquido Estimado</p>
                                        <p className="text-xs text-gray-500">(após descontos obrigatórios)</p>
                                    </div>
                                    <span className="text-2xl font-bold" style={{ color: '#07593f' }}>
                                        {formatCurrency(totalLiquido)}
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Informações de Pagamento */}
                    <Card className="border-0 shadow-sm bg-amber-50">
                        <CardContent className="pt-4">
                            <SectionHeader icon={Calendar} title="Informações de Pagamento" color="#f59e0b" />
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">Dia de Pagamento</p>
                                    <p className="text-lg font-bold text-amber-700">Todo dia {diaPagamento}</p>
                                </div>
                                <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                                    {tipoPagamento}
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Dados Bancários */}
                    {colaborador.banco && (
                        <Card className="border-0 shadow-sm">
                            <CardContent className="pt-4">
                                <SectionHeader icon={CreditCard} title="Dados Bancários" color="#8b5cf6" />
                                <div className="grid grid-cols-2 gap-4">
                                    <DataRow label="Banco" value={colaborador.banco} />
                                    <DataRow label="Agência" value={colaborador.agencia || '-'} />
                                    <DataRow label="Conta" value={colaborador.conta || '-'} />
                                    <DataRow label="PIX" value={colaborador.pix || '-'} />
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="flex justify-between gap-3 mt-6 pt-4 border-t">
                    <Button variant="outline" onClick={handlePrint} className="flex items-center gap-2">
                        <Printer className="w-4 h-4" />
                        Imprimir
                    </Button>
                    <Button
                        onClick={onClose}
                        style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
                    >
                        Concluir
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
