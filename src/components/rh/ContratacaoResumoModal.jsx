import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
    User, Briefcase, DollarSign, Gift, Calendar, CreditCard,
    Phone, Mail, MapPin, CheckCircle2, Printer, X, KeyRound
} from "lucide-react";
import { gerarResumoEstimado } from "@/utils/calculosTrabalhistas";
import html2pdf from "html2pdf.js";

// Utility function to format currency
const formatCurrency = (value) => {
    const num = Number(value) || 0;
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// Section Header Component
function SectionHeader({ icon: Icon, title, color }) {
    return (
        <div className="flex items-center gap-2 mb-2">
            <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${color}15` }}
            >
                <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <h3 className="font-semibold text-gray-900 leading-none">{title}</h3>
        </div>
    );
}

// Data Row Component
function DataRow({ label, value, highlight = false }) {
    return (
        <div className="flex justify-between items-center py-1">
            <span className="text-[11px] text-gray-600">{label}</span>
            <span className={`text-[11px] ${highlight ? 'font-bold text-green-600' : 'font-medium text-gray-900'}`}>
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

export default function ContratacaoResumoModal({ colaborador, onClose, onGenerateAccess }) {
    if (!colaborador) return null;

    // Calculate totals using the centralized CLT engine
    const resumo = gerarResumoEstimado(colaborador);

    const salarioBase = resumo.salario_base;
    const totalBeneficios = resumo.beneficios_empresa;
    const totalBruto = salarioBase + totalBeneficios;
    const totalLiquido = resumo.salario_liquido;
    const valeTransporte = Number(colaborador.vale_transporte) || 0;
    const valeAlimentacao = Number(colaborador.vale_alimentacao) || 0;
    const valeRefeicao = Number(colaborador.vale_refeicao) || 0;
    const planoSaude = Number(colaborador.plano_saude) || 0;
    const planoOdontologico = Number(colaborador.plano_odontologico) || 0;
    const bonusMensal = Number(colaborador.bonus_mensal) || 0;
    const outrosBeneficios = Number(colaborador.outros_beneficios) || 0;

    const diaPagamento = colaborador.dia_pagamento || 5;
    const tipoPagamento = colaborador.tipo_pagamento || 'Mensal';
    const recebeVale = typeof colaborador.recebe_vale === 'boolean'
        ? colaborador.recebe_vale
        : !!(valeTransporte || valeAlimentacao || valeRefeicao);
    const diaVale = colaborador.dia_vale || 20;

    const descontoPlanoSaude = Number(colaborador.desconto_plano_saude) || 0;
    const descontoAdiantamento = Number(colaborador.desconto_adiantamento) || 0;

    let descontosAdicionaisList = [];
    try {
        const parsed = JSON.parse(colaborador.descricao_outros_descontos || "[]");
        if (Array.isArray(parsed)) {
            descontosAdicionaisList = parsed;
        } else if (colaborador.outros_descontos > 0) {
            descontosAdicionaisList = [{ descricao: colaborador.descricao_outros_descontos || 'Outros Descontos', valor: colaborador.outros_descontos }];
        }
    } catch {
        if (colaborador.outros_descontos > 0) {
            descontosAdicionaisList = [{ descricao: colaborador.descricao_outros_descontos || 'Outros Descontos', valor: colaborador.outros_descontos }];
        }
    }

    const handlePrint = () => {
        const element = document.getElementById("resumo-contratacao-content");
        if (!element) return;

        const nomeArquivo = `Ficha_Contratacao_${colaborador.nome_completo?.replace(/\s+/g, '_') || 'Colaborador'}.pdf`;

        const opt = {
            margin: 10,
            filename: nomeArquivo,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(element).save();
    };

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <div id="resumo-contratacao-content" className="p-2">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}>
                                <CheckCircle2 className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex flex-col justify-center">
                                <span className="text-xl leading-none mb-1.5" style={{ color: '#07593f' }}>Resumo de Contratação</span>
                                <p className="text-xs font-normal text-gray-500 leading-none">Funcionário cadastrado com sucesso!</p>
                            </div>
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-3 mt-3">
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
                                    <DataRow label="Cargo" value={colaborador.descricao_cargo || '-'} />

                                    <DataRow label="Tipo Contrato" value={colaborador.tipo_contrato || 'CLT'} />
                                    <DataRow label="Data Admissão" value={colaborador.data_admissao ? new Date(colaborador.data_admissao).toLocaleDateString('pt-BR') : '-'} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Linha 1: Remuneração e Dados Bancários */}
                    <div className="grid grid-cols-2 gap-3">
                            {/* Remuneração e Pagamento */}
                            <Card className="border-0 shadow-sm bg-green-50 h-fit">
                                <CardContent className="pt-3 pb-3">
                                    <SectionHeader icon={DollarSign} title="Remuneração e Pagamento" color="#22c55e" />
                                    <div className="space-y-0.5 mb-2">
                                        <DataRow label="Salário Base" value={formatCurrency(salarioBase)} highlight />
                                        <DataRow label="Carga Horária" value={`${colaborador.carga_horaria || 44}h semanais`} />
                                    </div>
                                    <div className="pt-2 border-t border-green-200">
                                        <div className="flex items-center justify-between mb-1">
                                            <p className="text-[10px] text-gray-600">Dia de Pagamento</p>
                                            <p className="text-[11px] font-bold text-green-800">
                                                {resumo.tipo_dia_pagamento === "util" ? `${diaPagamento}º Dia Útil` : `Todo dia ${diaPagamento}`}
                                            </p>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <p className="text-[10px] text-gray-600">Recebe Vale</p>
                                            <p className="text-[11px] font-semibold text-green-800">
                                                {recebeVale 
                                                    ? `Sim, ${resumo.tipo_dia_vale === "util" ? `${diaVale}º Dia Útil` : `dia ${diaVale}`}`
                                                    : 'Não'}
                                            </p>
                                        </div>
                                        
                                        {recebeVale && (Number(colaborador.valor_dia_pagamento) > 0 || Number(colaborador.valor_dia_vale) > 0) && (
                                            <div className="mt-2 pt-2 border-t border-green-200">
                                                <p className="text-[10px] text-gray-600 mb-1">Distribuição do Salário</p>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {Number(colaborador.valor_dia_pagamento) > 0 && (
                                                        <div className="p-1 bg-green-100/50 rounded text-center">
                                                            <p className="text-[9px] text-green-700">
                                                                {resumo.tipo_dia_pagamento === "util" ? `${diaPagamento}º Dia Útil` : `Dia ${diaPagamento}`}
                                                            </p>
                                                            <p className="text-[10px] font-bold text-green-900">{formatCurrency(colaborador.valor_dia_pagamento)}</p>
                                                        </div>
                                                    )}
                                                    {Number(colaborador.valor_dia_vale) > 0 && (
                                                        <div className="p-1 bg-green-100/50 rounded text-center">
                                                            <p className="text-[9px] text-green-700">
                                                                {resumo.tipo_dia_vale === "util" ? `${diaVale}º Dia Útil (Vale)` : `Dia ${diaVale} (Vale)`}
                                                            </p>
                                                            <p className="text-[10px] font-bold text-green-900">{formatCurrency(colaborador.valor_dia_vale)}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                        {/* Dados Bancários */}
                        {colaborador.banco ? (
                            <Card className="border-0 shadow-sm h-fit">
                                <CardContent className="pt-3 pb-3">
                                    <SectionHeader icon={CreditCard} title="Dados Bancários" color="#8b5cf6" />
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                                        <DataRow label="Banco" value={colaborador.banco} />
                                        <DataRow label="Agência" value={colaborador.agencia || '-'} />
                                        <DataRow label="Conta" value={colaborador.conta || '-'} />
                                        <DataRow label="PIX" value={colaborador.pix || '-'} />
                                    </div>
                                </CardContent>
                            </Card>
                        ) : (
                            <Card className="border-0 shadow-sm opacity-50 h-fit">
                                <CardContent className="pt-3 pb-3 flex items-center justify-center h-full">
                                    <span className="text-[11px] text-gray-400">Dados bancários não informados</span>
                                </CardContent>
                            </Card>
                        )}
                    </div>

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
                        <CardContent className="pt-3 pb-3">
                            <SectionHeader icon={CreditCard} title="Resumo Financeiro Mensal" color="#07593f" />

                            <div className="space-y-1 mb-2">
                                <DataRow label="Salário Base" value={formatCurrency(salarioBase)} />
                                {totalBeneficios > 0 && (
                                    <DataRow label="(+) Benefícios" value={formatCurrency(totalBeneficios)} />
                                )}
                                <div className="border-t pt-1">
                                    <DataRow label="Total Bruto" value={formatCurrency(totalBruto)} highlight />
                                </div>
                            </div>

                            <div className="p-2 bg-gray-100 rounded-lg mb-2">
                                <p className="text-[10px] text-gray-600 mb-1">Descontos e Encargos (CLT 2025):</p>
                                <DataRow label={`INSS (${resumo.inss_faixa})`} value={`- ${formatCurrency(resumo.inss)}`} />
                                {resumo.irrf > 0 && (
                                    <DataRow label={`IRRF (${resumo.irrf_faixa})`} value={`- ${formatCurrency(resumo.irrf)}`} />
                                )}
                                {resumo.pensao_alimenticia > 0 && (
                                    <DataRow label="Pensão Alimentícia" value={`- ${formatCurrency(resumo.pensao_alimenticia)}`} />
                                )}
                                {resumo.vale_transporte > 0 && (
                                    <DataRow label="Desc. VT (6% CLT)" value={`- ${formatCurrency(resumo.vale_transporte)}`} />
                                )}
                                {resumo.adicional_noturno > 0 && (
                                    <DataRow label="(+) Adic. Noturno" value={`+ ${formatCurrency(resumo.adicional_noturno)}`} />
                                )}
                                {descontoPlanoSaude > 0 && (
                                    <DataRow label="Desc. Plano Saúde" value={`- ${formatCurrency(descontoPlanoSaude)}`} />
                                )}
                                {descontoAdiantamento > 0 && (
                                    <DataRow label="Adiantamento" value={`- ${formatCurrency(descontoAdiantamento)}`} />
                                )}
                                {descontosAdicionaisList.map((desc, idx) => {
                                    if (!desc.valor) return null;
                                    return (
                                        <DataRow key={`desc-${idx}`} label={desc.descricao || 'Outros Descontos'} value={`- ${formatCurrency(desc.valor)}`} />
                                    );
                                })}
                                {resumo.insalubridade > 0 && (
                                    <DataRow label="(+) Insalubridade" value={`+ ${formatCurrency(resumo.insalubridade)}`} />
                                )}
                                {resumo.periculosidade > 0 && (
                                    <DataRow label="(+) Periculosidade" value={`+ ${formatCurrency(resumo.periculosidade)}`} />
                                )}
                                {resumo.salario_familia > 0 && (
                                    <DataRow label="(+) Salário Família" value={`+ ${formatCurrency(resumo.salario_familia)}`} />
                                )}
                                <DataRow label="FGTS (8%)" value={formatCurrency(resumo.fgts)} />
                            </div>

                            <div className="p-2 rounded-lg" style={{ backgroundColor: '#07593f10' }}>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="text-xs text-gray-600">Valor Líquido Estimado</p>
                                        <p className="text-[10px] text-gray-500">(após descontos obrigatórios)</p>
                                    </div>
                                    <span className="text-xl font-bold" style={{ color: '#07593f' }}>
                                        {formatCurrency(totalLiquido)}
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Footer Actions */}
                <div className="flex justify-between gap-3 mt-6 pt-4 border-t">
                    <Button variant="outline" onClick={handlePrint} className="flex items-center gap-2">
                        <Printer className="w-4 h-4" />
                        Imprimir
                    </Button>
                    <div className="flex gap-2">
                        {onGenerateAccess && (
                            <Button
                                onClick={onGenerateAccess}
                                className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
                            >
                                <KeyRound className="w-4 h-4" />
                                Gerar Acesso ao Sistema
                            </Button>
                        )}
                        <Button
                            onClick={onClose}
                            style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
                        >
                            Concluir
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
