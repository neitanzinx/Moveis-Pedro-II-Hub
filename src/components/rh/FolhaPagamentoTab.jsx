import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
    DollarSign, FileDown, Calculator, Check, Clock,
    Calendar, Users, Loader2, Eye, Printer
} from "lucide-react";
import { toast } from "sonner";

const MESES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const STATUS_FOLHA = ["Gerado", "Pago", "Cancelado"];

export default function FolhaPagamentoTab() {
    const queryClient = useQueryClient();
    const [mesReferencia, setMesReferencia] = useState(new Date().getMonth() + 1);
    const [anoReferencia, setAnoReferencia] = useState(new Date().getFullYear());
    const [modalGerar, setModalGerar] = useState(false);
    const [modalDetalhes, setModalDetalhes] = useState(false);
    const [folhaSelecionada, setFolhaSelecionada] = useState(null);
    const [gerando, setGerando] = useState(false);

    const { data: colaboradores = [] } = useQuery({
        queryKey: ['colaboradores'],
        queryFn: () => base44.entities.Colaborador.list(),
    });

    const { data: folhas = [], isLoading } = useQuery({
        queryKey: ['folhas_pagamento'],
        queryFn: () => base44.entities.FolhaPagamento.list('-created_at'),
    });

    const colaboradoresAtivos = colaboradores.filter(c => c.status === 'Ativo' && c.salario_base);

    // Filter folhas by selected period
    const folhasPeriodo = folhas.filter(f =>
        f.mes_referencia === mesReferencia && f.ano_referencia === anoReferencia
    );

    // Metrics
    const totalBruto = folhasPeriodo.reduce((sum, f) => sum + (Number(f.salario_bruto) || 0), 0);
    const totalLiquido = folhasPeriodo.reduce((sum, f) => sum + (Number(f.salario_liquido) || 0), 0);
    const totalInss = folhasPeriodo.reduce((sum, f) => sum + (Number(f.inss) || 0), 0);
    const totalFgts = folhasPeriodo.reduce((sum, f) => sum + (Number(f.fgts) || 0), 0);
    const folhasPagas = folhasPeriodo.filter(f => f.status === 'Pago').length;
    const folhasPendentes = folhasPeriodo.filter(f => f.status === 'Gerado').length;

    const getStatusBadgeStyle = (status) => {
        switch (status) {
            case 'Pago':
                return { backgroundColor: '#D1FAE5', color: '#065F46' };
            case 'Gerado':
                return { backgroundColor: '#FEF3C7', color: '#92400E' };
            case 'Cancelado':
                return { backgroundColor: '#FEE2E2', color: '#991B1B' };
            default:
                return { backgroundColor: '#E5E7EB', color: '#374151' };
        }
    };

    // Simple INSS calculation (simplified)
    const calcularINSS = (salario) => {
        if (salario <= 1412.00) return salario * 0.075;
        if (salario <= 2666.68) return salario * 0.09;
        if (salario <= 4000.03) return salario * 0.12;
        return salario * 0.14;
    };

    // Simple FGTS calculation (8%)
    const calcularFGTS = (salario) => salario * 0.08;

    const gerarFolhaMes = async () => {
        setGerando(true);
        try {
            const existentes = folhas.filter(f =>
                f.mes_referencia === mesReferencia && f.ano_referencia === anoReferencia
            );
            const colaboradoresJaGerados = existentes.map(f => f.colaborador_id);

            const colaboradoresParaGerar = colaboradoresAtivos.filter(
                c => !colaboradoresJaGerados.includes(c.id)
            );

            if (colaboradoresParaGerar.length === 0) {
                toast.info("Folha já gerada para todos os colaboradores neste período");
                setGerando(false);
                setModalGerar(false);
                return;
            }

            for (const colab of colaboradoresParaGerar) {
                const salarioBruto = Number(colab.salario_base) || 0;
                const inss = calcularINSS(salarioBruto);
                const fgts = calcularFGTS(salarioBruto);
                const salarioLiquido = salarioBruto - inss;

                await base44.entities.FolhaPagamento.create({
                    colaborador_id: colab.id,
                    colaborador_nome: colab.nome_completo,
                    mes_referencia: mesReferencia,
                    ano_referencia: anoReferencia,
                    salario_bruto: salarioBruto,
                    inss: inss,
                    irrf: 0, // Simplified - no IRRF calculation
                    fgts: fgts,
                    vale_transporte: 0,
                    vale_refeicao: 0,
                    outros_descontos: 0,
                    outros_beneficios: 0,
                    salario_liquido: salarioLiquido,
                    status: 'Gerado',
                });
            }

            queryClient.invalidateQueries(['folhas_pagamento']);
            toast.success(`Folha gerada para ${colaboradoresParaGerar.length} colaborador(es)!`);
            setModalGerar(false);
        } catch (error) {
            toast.error("Erro ao gerar folha: " + error.message);
        } finally {
            setGerando(false);
        }
    };

    const marcarComoPago = async (folha) => {
        try {
            await base44.entities.FolhaPagamento.update(folha.id, {
                status: 'Pago',
                data_pagamento: new Date().toISOString().slice(0, 10),
            });
            queryClient.invalidateQueries(['folhas_pagamento']);
            toast.success("Pagamento registrado!");
        } catch (error) {
            toast.error("Erro: " + error.message);
        }
    };

    const exportarCSV = () => {
        let csv = "Colaborador,Salário Bruto,INSS,FGTS,Salário Líquido,Status\n";
        folhasPeriodo.forEach(f => {
            csv += `"${f.colaborador_nome}",${f.salario_bruto},${f.inss},${f.fgts},${f.salario_liquido},${f.status}\n`;
        });
        csv += `\nTOTAIS,${totalBruto.toFixed(2)},${totalInss.toFixed(2)},${totalFgts.toFixed(2)},${totalLiquido.toFixed(2)},`;

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `folha_pagamento_${MESES[mesReferencia - 1]}_${anoReferencia}.csv`;
        a.click();
    };

    return (
        <div className="space-y-6">
            {/* Period Selector */}
            <Card className="border-0 shadow-lg">
                <CardContent className="p-4">
                    <div className="flex flex-wrap items-end gap-4">
                        <div>
                            <Label>Mês</Label>
                            <Select value={String(mesReferencia)} onValueChange={(v) => setMesReferencia(Number(v))}>
                                <SelectTrigger className="w-40">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {MESES.map((m, i) => (
                                        <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Ano</Label>
                            <Select value={String(anoReferencia)} onValueChange={(v) => setAnoReferencia(Number(v))}>
                                <SelectTrigger className="w-28">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {[2023, 2024, 2025, 2026].map(a => (
                                        <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button
                            onClick={() => setModalGerar(true)}
                            style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
                        >
                            <Calculator className="w-4 h-4 mr-2" />
                            Gerar Folha do Mês
                        </Button>
                        <Button variant="outline" onClick={exportarCSV} disabled={folhasPeriodo.length === 0}>
                            <FileDown className="w-4 h-4 mr-2" />
                            Exportar CSV
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="border-0 shadow-lg">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-gray-500">Total Bruto</p>
                                <p className="text-xl font-bold" style={{ color: '#07593f' }}>
                                    R$ {totalBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                            <DollarSign className="w-8 h-8 opacity-50" style={{ color: '#07593f' }} />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-lg">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-gray-500">Total Líquido</p>
                                <p className="text-xl font-bold text-blue-600">
                                    R$ {totalLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                            <DollarSign className="w-8 h-8 text-blue-600 opacity-50" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-lg">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-gray-500">Pagos</p>
                                <p className="text-xl font-bold text-green-600">{folhasPagas}</p>
                            </div>
                            <Check className="w-8 h-8 text-green-600 opacity-50" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-lg">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-gray-500">Pendentes</p>
                                <p className="text-xl font-bold text-orange-600">{folhasPendentes}</p>
                            </div>
                            <Clock className="w-8 h-8 text-orange-600 opacity-50" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* INSS and FGTS Summary */}
            <div className="grid md:grid-cols-2 gap-4">
                <Card className="border-0 shadow-lg" style={{ backgroundColor: '#f0f9ff' }}>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Total INSS (Descontado)</p>
                                <p className="text-2xl font-bold text-blue-700">
                                    R$ {totalInss.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-lg" style={{ backgroundColor: '#FEF3C7' }}>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Total FGTS (A Recolher)</p>
                                <p className="text-2xl font-bold" style={{ color: '#92400E' }}>
                                    R$ {totalFgts.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Payroll List */}
            <Card className="border-0 shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2" style={{ color: '#07593f' }}>
                        <DollarSign className="w-5 h-5" />
                        Folha de Pagamento - {MESES[mesReferencia - 1]} {anoReferencia}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#07593f' }} />
                        </div>
                    ) : folhasPeriodo.length === 0 ? (
                        <div className="text-center py-12">
                            <DollarSign className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                            <p className="text-gray-500 mb-4">Nenhuma folha gerada para este período</p>
                            <Button
                                onClick={() => setModalGerar(true)}
                                style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
                            >
                                <Calculator className="w-4 h-4 mr-2" />
                                Gerar Folha do Mês
                            </Button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b" style={{ borderColor: '#E5E0D8' }}>
                                        <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Colaborador</th>
                                        <th className="text-right py-3 px-2 text-sm font-medium text-gray-500">Bruto</th>
                                        <th className="text-right py-3 px-2 text-sm font-medium text-gray-500">INSS</th>
                                        <th className="text-right py-3 px-2 text-sm font-medium text-gray-500">FGTS</th>
                                        <th className="text-right py-3 px-2 text-sm font-medium text-gray-500">Líquido</th>
                                        <th className="text-center py-3 px-2 text-sm font-medium text-gray-500">Status</th>
                                        <th className="text-center py-3 px-2 text-sm font-medium text-gray-500">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {folhasPeriodo.map(folha => (
                                        <tr key={folha.id} className="border-b hover:bg-gray-50" style={{ borderColor: '#E5E0D8' }}>
                                            <td className="py-3 px-2">
                                                <p className="font-medium" style={{ color: '#07593f' }}>{folha.colaborador_nome}</p>
                                            </td>
                                            <td className="text-right py-3 px-2">
                                                R$ {Number(folha.salario_bruto).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="text-right py-3 px-2 text-red-600">
                                                - R$ {Number(folha.inss).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="text-right py-3 px-2 text-orange-600">
                                                R$ {Number(folha.fgts).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="text-right py-3 px-2 font-bold" style={{ color: '#07593f' }}>
                                                R$ {Number(folha.salario_liquido).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="text-center py-3 px-2">
                                                <Badge style={getStatusBadgeStyle(folha.status)}>{folha.status}</Badge>
                                            </td>
                                            <td className="text-center py-3 px-2">
                                                <div className="flex justify-center gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7"
                                                        onClick={() => { setFolhaSelecionada(folha); setModalDetalhes(true); }}
                                                    >
                                                        <Eye className="w-3 h-3" />
                                                    </Button>
                                                    {folha.status === 'Gerado' && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 text-green-600"
                                                            onClick={() => marcarComoPago(folha)}
                                                        >
                                                            <Check className="w-3 h-3" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="font-bold" style={{ backgroundColor: '#f0f9ff' }}>
                                        <td className="py-3 px-2">TOTAL</td>
                                        <td className="text-right py-3 px-2">
                                            R$ {totalBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="text-right py-3 px-2 text-red-600">
                                            - R$ {totalInss.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="text-right py-3 px-2 text-orange-600">
                                            R$ {totalFgts.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="text-right py-3 px-2" style={{ color: '#07593f' }}>
                                            R$ {totalLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td></td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Generate Modal */}
            <Dialog open={modalGerar} onOpenChange={setModalGerar}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2" style={{ color: '#07593f' }}>
                            <Calculator className="w-5 h-5" />
                            Gerar Folha de Pagamento
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 mt-4">
                        <div className="p-4 rounded-lg" style={{ backgroundColor: '#f0f9ff' }}>
                            <p className="text-sm text-gray-600 mb-2">
                                <strong>Período:</strong> {MESES[mesReferencia - 1]} de {anoReferencia}
                            </p>
                            <p className="text-sm text-gray-600">
                                <strong>Colaboradores ativos com salário:</strong> {colaboradoresAtivos.length}
                            </p>
                        </div>

                        <div className="p-4 rounded-lg border" style={{ borderColor: '#E5E0D8' }}>
                            <p className="text-sm text-gray-600 mb-2">
                                A folha será gerada automaticamente com:
                            </p>
                            <ul className="text-sm text-gray-500 space-y-1">
                                <li>• Salário bruto conforme cadastro</li>
                                <li>• Cálculo automático de INSS</li>
                                <li>• Cálculo automático de FGTS (8%)</li>
                                <li>• Salário líquido = Bruto - INSS</li>
                            </ul>
                        </div>

                        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                            <p className="text-sm text-amber-800">
                                <strong>Nota:</strong> Os cálculos são simplificados. Para cálculos precisos de IRRF e outros descontos,
                                edite cada folha individualmente ou utilize um sistema contábilidade especializado.
                            </p>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <Button variant="outline" onClick={() => setModalGerar(false)}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={gerarFolhaMes}
                            disabled={gerando || colaboradoresAtivos.length === 0}
                            style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
                        >
                            {gerando ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Gerando...
                                </>
                            ) : (
                                <>
                                    <Calculator className="w-4 h-4 mr-2" />
                                    Gerar Folha
                                </>
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Details Modal */}
            {modalDetalhes && folhaSelecionada && (
                <FolhaDetalhesModal
                    folha={folhaSelecionada}
                    onClose={() => { setModalDetalhes(false); setFolhaSelecionada(null); }}
                />
            )}
        </div>
    );
}

// Details Modal
function FolhaDetalhesModal({ folha, onClose }) {
    const queryClient = useQueryClient();
    const [editing, setEditing] = useState(false);
    const [formData, setFormData] = useState({ ...folha });
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            const salarioBruto = Number(formData.salario_bruto) || 0;
            const inss = Number(formData.inss) || 0;
            const outrosDescontos = Number(formData.outros_descontos) || 0;
            const salarioLiquido = salarioBruto - inss - outrosDescontos;

            await base44.entities.FolhaPagamento.update(folha.id, {
                ...formData,
                salario_bruto: salarioBruto,
                inss: inss,
                fgts: Number(formData.fgts) || 0,
                outros_descontos: outrosDescontos,
                salario_liquido: salarioLiquido,
            });
            queryClient.invalidateQueries(['folhas_pagamento']);
            toast.success("Folha atualizada!");
            setEditing(false);
        } catch (error) {
            toast.error("Erro: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2" style={{ color: '#07593f' }}>
                        <DollarSign className="w-5 h-5" />
                        Detalhes do Holerite
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 mt-4">
                    <div className="p-4 rounded-lg" style={{ backgroundColor: '#f0f9ff' }}>
                        <p className="font-bold text-lg" style={{ color: '#07593f' }}>{folha.colaborador_nome}</p>
                        <p className="text-sm text-gray-500">
                            {MESES[(folha.mes_referencia || 1) - 1]} de {folha.ano_referencia}
                        </p>
                    </div>

                    {editing ? (
                        <div className="space-y-3">
                            <div>
                                <Label>Salário Bruto</Label>
                                <Input
                                    type="number"
                                    value={formData.salario_bruto}
                                    onChange={(e) => setFormData(prev => ({ ...prev, salario_bruto: e.target.value }))}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label>INSS</Label>
                                    <Input
                                        type="number"
                                        value={formData.inss}
                                        onChange={(e) => setFormData(prev => ({ ...prev, inss: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <Label>FGTS</Label>
                                    <Input
                                        type="number"
                                        value={formData.fgts}
                                        onChange={(e) => setFormData(prev => ({ ...prev, fgts: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <div>
                                <Label>Outros Descontos</Label>
                                <Input
                                    type="number"
                                    value={formData.outros_descontos}
                                    onChange={(e) => setFormData(prev => ({ ...prev, outros_descontos: e.target.value }))}
                                />
                            </div>
                            <div>
                                <Label>Observações</Label>
                                <Textarea
                                    value={formData.observacoes || ""}
                                    onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex justify-between py-2 border-b" style={{ borderColor: '#E5E0D8' }}>
                                <span className="text-gray-600">Salário Bruto</span>
                                <span className="font-medium">R$ {Number(folha.salario_bruto).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b text-red-600" style={{ borderColor: '#E5E0D8' }}>
                                <span>INSS</span>
                                <span>- R$ {Number(folha.inss).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            {Number(folha.outros_descontos) > 0 && (
                                <div className="flex justify-between py-2 border-b text-red-600" style={{ borderColor: '#E5E0D8' }}>
                                    <span>Outros Descontos</span>
                                    <span>- R$ {Number(folha.outros_descontos).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                            )}
                            <div className="flex justify-between py-2 border-b text-orange-600" style={{ borderColor: '#E5E0D8' }}>
                                <span>FGTS (a recolher)</span>
                                <span>R$ {Number(folha.fgts).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between py-3 font-bold text-lg" style={{ color: '#07593f' }}>
                                <span>Salário Líquido</span>
                                <span>R$ {Number(folha.salario_liquido).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between py-2">
                                <span className="text-gray-600">Status</span>
                                <Badge style={folha.status === 'Pago' ? { backgroundColor: '#D1FAE5', color: '#065F46' } : { backgroundColor: '#FEF3C7', color: '#92400E' }}>
                                    {folha.status}
                                </Badge>
                            </div>
                            {folha.data_pagamento && (
                                <div className="flex justify-between py-2">
                                    <span className="text-gray-600">Data Pagamento</span>
                                    <span>{new Date(folha.data_pagamento).toLocaleDateString('pt-BR')}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    {editing ? (
                        <>
                            <Button variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
                            <Button onClick={handleSave} disabled={saving} style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}>
                                {saving ? "Salvando..." : "Salvar"}
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="outline" onClick={onClose}>Fechar</Button>
                            <Button variant="outline" onClick={() => setEditing(true)}>
                                Editar
                            </Button>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
