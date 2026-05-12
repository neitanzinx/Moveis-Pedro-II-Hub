import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    User, Phone, Mail, MapPin, Calendar, DollarSign,
    Briefcase, Building, CreditCard, Edit, FileText,
    Clock, UserCheck, KeyRound, ShieldAlert, Moon, Zap
} from "lucide-react";

export default function ColaboradorDetalhesModal({ colaborador, onClose, onEdit, canEdit = false }) {
    if (!colaborador) return null;

    const getStatusBadgeStyle = (status) => {
        switch (status) {
            case 'Ativo':
                return { backgroundColor: '#D1FAE5', color: '#065F46' };
            case 'Férias':
                return { backgroundColor: '#DBEAFE', color: '#1E40AF' };
            case 'Licença':
                return { backgroundColor: '#FEF3C7', color: '#92400E' };
            case 'Afastado':
                return { backgroundColor: '#FED7AA', color: '#C2410C' };
            case 'Desligado':
                return { backgroundColor: '#FEE2E2', color: '#991B1B' };
            default:
                return { backgroundColor: '#E5E7EB', color: '#374151' };
        }
    };

    const calcularTempoEmpresa = () => {
        if (!colaborador.data_admissao) return null;
        const inicio = new Date(colaborador.data_admissao);
        const fim = colaborador.data_demissao ? new Date(colaborador.data_demissao) : new Date();
        const diffTime = Math.abs(fim - inicio);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const years = Math.floor(diffDays / 365);
        const months = Math.floor((diffDays % 365) / 30);
        if (years > 0) {
            return `${years} ano${years > 1 ? 's' : ''} e ${months} mês${months !== 1 ? 'es' : ''}`;
        }
        return `${months} mês${months !== 1 ? 'es' : ''}`;
    };

    const InfoItem = ({ icon: Icon, label, value, className = "" }) => (
        value ? (
            <div className={`flex items-start gap-3 ${className}`}>
                <Icon className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0" />
                <div>
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className="font-medium" style={{ color: '#07593f' }}>{value}</p>
                </div>
            </div>
        ) : null
    );

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <DialogTitle className="flex items-center gap-3">
                            <div
                                className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold text-white"
                                style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
                            >
                                {colaborador.nome_completo?.charAt(0).toUpperCase() || '?'}
                            </div>
                            <div>
                                <h2 className="text-xl font-bold" style={{ color: '#07593f' }}>
                                    {colaborador.nome_completo}
                                </h2>
                                <p className="text-sm text-gray-500">
                                    {colaborador.cargo || 'Sem cargo'}
                                </p>
                            </div>
                        </DialogTitle>
                        <div className="flex items-center gap-2">
                            <Badge style={getStatusBadgeStyle(colaborador.status)}>
                                {colaborador.status || 'Indefinido'}
                            </Badge>
                            {colaborador.tipo_contrato && (
                                <Badge variant="outline">{colaborador.tipo_contrato}</Badge>
                            )}
                        </div>
                    </div>
                </DialogHeader>

                <div className="mt-6 space-y-6">
                    {/* Resumo Rápido */}
                    <div className="grid grid-cols-3 gap-4">
                        {colaborador.salario_base && (
                            <div className="p-4 rounded-xl" style={{ backgroundColor: '#f0f9ff' }}>
                                <div className="flex items-center gap-2 mb-1">
                                    <DollarSign className="w-4 h-4" style={{ color: '#07593f' }} />
                                    <span className="text-xs text-gray-500">Salário Base</span>
                                </div>
                                <p className="text-xl font-bold" style={{ color: '#07593f' }}>
                                    R$ {Number(colaborador.salario_base).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                        )}
                        {colaborador.data_admissao && (
                            <div className="p-4 rounded-xl" style={{ backgroundColor: '#f0f9ff' }}>
                                <div className="flex items-center gap-2 mb-1">
                                    <Clock className="w-4 h-4" style={{ color: '#07593f' }} />
                                    <span className="text-xs text-gray-500">Tempo de Empresa</span>
                                </div>
                                <p className="text-xl font-bold" style={{ color: '#07593f' }}>
                                    {calcularTempoEmpresa()}
                                </p>
                            </div>
                        )}
                        {colaborador.carga_horaria && (
                            <div className="p-4 rounded-xl" style={{ backgroundColor: '#f0f9ff' }}>
                                <div className="flex items-center gap-2 mb-1">
                                    <Briefcase className="w-4 h-4" style={{ color: '#07593f' }} />
                                    <span className="text-xs text-gray-500">Carga Horária</span>
                                </div>
                                <p className="text-xl font-bold" style={{ color: '#07593f' }}>
                                    {colaborador.carga_horaria}h/semana
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Dados Pessoais */}
                    <div>
                        <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: '#07593f' }}>
                            <User className="w-4 h-4" />
                            Dados Pessoais
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 rounded-xl border" style={{ borderColor: '#E5E0D8' }}>
                            <InfoItem icon={FileText} label="CPF" value={colaborador.cpf} />
                            <InfoItem icon={FileText} label="RG" value={colaborador.rg} />
                            <InfoItem icon={Calendar} label="Data de Nascimento" value={colaborador.data_nascimento ? new Date(colaborador.data_nascimento).toLocaleDateString('pt-BR') : null} />
                            <InfoItem icon={Phone} label="Telefone" value={colaborador.telefone} />
                            <InfoItem icon={Mail} label="Email" value={colaborador.email} className="col-span-2" />
                        </div>
                    </div>

                    {/* Dados Profissionais */}
                    <div>
                        <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: '#07593f' }}>
                            <Briefcase className="w-4 h-4" />
                            Dados Profissionais
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 rounded-xl border" style={{ borderColor: '#E5E0D8' }}>
                            <InfoItem icon={Building} label="Cargo" value={colaborador.cargo} />
                            <InfoItem icon={KeyRound} label="Matrícula" value={colaborador.matricula} />

                            <InfoItem icon={FileText} label="Tipo de Contrato" value={colaborador.tipo_contrato} />
                            <InfoItem icon={Calendar} label="Data de Admissão" value={colaborador.data_admissao ? new Date(colaborador.data_admissao).toLocaleDateString('pt-BR') : null} />
                            <InfoItem icon={DollarSign} label="Salário Base" value={colaborador.salario_base ? `R$ ${Number(colaborador.salario_base).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null} />
                            <InfoItem icon={Clock} label="Carga Horária" value={colaborador.carga_horaria ? `${colaborador.carga_horaria}h/semana` : null} />
                            {colaborador.status === 'Desligado' && (
                                <>
                                    <InfoItem icon={Calendar} label="Data de Demissão" value={colaborador.data_demissao ? new Date(colaborador.data_demissao).toLocaleDateString('pt-BR') : null} />
                                    <InfoItem icon={FileText} label="Motivo da Demissão" value={colaborador.motivo_demissao} className="col-span-2" />
                                </>
                            )}
                        </div>
                    </div>

                    {/* Endereço */}
                    {(colaborador.endereco || colaborador.cidade) && (
                        <div>
                            <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: '#07593f' }}>
                                <MapPin className="w-4 h-4" />
                                Endereço
                            </h3>
                            <div className="p-4 rounded-xl border" style={{ borderColor: '#E5E0D8' }}>
                                <p className="font-medium" style={{ color: '#07593f' }}>
                                    {[
                                        colaborador.endereco,
                                        colaborador.numero,
                                        colaborador.complemento
                                    ].filter(Boolean).join(', ')}
                                </p>
                                <p className="text-sm text-gray-500">
                                    {[
                                        colaborador.bairro,
                                        colaborador.cidade,
                                        colaborador.estado,
                                        colaborador.cep
                                    ].filter(Boolean).join(' - ')}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Benefícios */}
                    {(colaborador.recebe_vale !== undefined || colaborador.dia_vale || colaborador.vale_transporte || colaborador.vale_alimentacao || colaborador.vale_refeicao || colaborador.plano_saude || colaborador.plano_odontologico || colaborador.bonus_mensal || colaborador.outros_beneficios || colaborador.pensao_alimenticia || colaborador.adicional_noturno || colaborador.periculosidade || colaborador.insalubridade_grau) && (
                        <div>
                            <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: '#07593f' }}>
                                <DollarSign className="w-4 h-4" />
                                Benefícios e Adicionais
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 rounded-xl border" style={{ borderColor: '#E5E0D8' }}>
                                <InfoItem icon={Calendar} label="Recebe Vale" value={colaborador.recebe_vale ? 'Sim' : 'Não'} />
                                {colaborador.recebe_vale && (
                                    <InfoItem icon={Calendar} label="Dia do Vale" value={colaborador.dia_vale ? `Todo dia ${colaborador.dia_vale}` : null} />
                                )}
                                <InfoItem icon={DollarSign} label="Vale Transporte" value={colaborador.vale_transporte ? `R$ ${Number(colaborador.vale_transporte).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null} />
                                <InfoItem icon={DollarSign} label="Vale Alimentação" value={colaborador.vale_alimentacao ? `R$ ${Number(colaborador.vale_alimentacao).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null} />
                                <InfoItem icon={DollarSign} label="Vale Refeição" value={colaborador.vale_refeicao ? `R$ ${Number(colaborador.vale_refeicao).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null} />
                                <InfoItem icon={DollarSign} label="Plano de Saúde" value={colaborador.plano_saude ? `R$ ${Number(colaborador.plano_saude).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null} />
                                <InfoItem icon={DollarSign} label="Plano Odontológico" value={colaborador.plano_odontologico ? `R$ ${Number(colaborador.plano_odontologico).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null} />
                                <InfoItem icon={DollarSign} label="Bônus Mensal" value={colaborador.bonus_mensal ? `R$ ${Number(colaborador.bonus_mensal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null} />
                                {colaborador.outros_beneficios && <InfoItem icon={DollarSign} label={colaborador.descricao_outros_beneficios || "Outros Benefícios"} value={`R$ ${Number(colaborador.outros_beneficios).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />}
                                <InfoItem icon={DollarSign} label="Pensão Alimentícia" value={colaborador.pensao_alimenticia ? `R$ ${Number(colaborador.pensao_alimenticia).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null} />
                                {colaborador.adicional_noturno && <InfoItem icon={Moon} label="Adicional Noturno" value="+20%" />}
                                {colaborador.periculosidade && <InfoItem icon={Zap} label="Periculosidade" value="+30%" />}
                                <InfoItem icon={ShieldAlert} label="Insalubridade" value={colaborador.insalubridade_grau ? { minimo: 'Grau Mínimo (10%)', medio: 'Grau Médio (20%)', maximo: 'Grau Máximo (40%)' }[colaborador.insalubridade_grau] : null} />
                            </div>
                        </div>
                    )}

                    {/* Dados Bancários */}
                    {(colaborador.banco || colaborador.pix) && (
                        <div>
                            <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: '#07593f' }}>
                                <CreditCard className="w-4 h-4" />
                                Dados Bancários
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl border" style={{ borderColor: '#E5E0D8' }}>
                                <InfoItem icon={CreditCard} label="Banco" value={colaborador.banco} />
                                <InfoItem icon={CreditCard} label="Agência" value={colaborador.agencia} />
                                <InfoItem icon={CreditCard} label="Conta" value={colaborador.conta} />
                                <InfoItem icon={CreditCard} label="Chave PIX" value={colaborador.pix} />
                            </div>
                        </div>
                    )}

                    {/* Vínculo Sistema */}
                    {colaborador.user_id && (
                        <div>
                            <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: '#07593f' }}>
                                <UserCheck className="w-4 h-4" />
                                Vínculo com Sistema
                            </h3>
                            <div className="p-4 rounded-xl" style={{ backgroundColor: '#D1FAE5' }}>
                                <p className="text-sm text-green-800">
                                    Este colaborador está vinculado a um usuário do sistema e possui acesso à plataforma.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Observações */}
                    {colaborador.observacoes && (
                        <div>
                            <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: '#07593f' }}>
                                <FileText className="w-4 h-4" />
                                Observações
                            </h3>
                            <div className="p-4 rounded-xl border" style={{ borderColor: '#E5E0D8' }}>
                                <p className="text-gray-600 whitespace-pre-wrap">{colaborador.observacoes}</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                    <Button variant="outline" onClick={onClose}>
                        Fechar
                    </Button>
                    {canEdit && (
                        <Button
                            onClick={onEdit}
                            style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
                        >
                            <Edit className="w-4 h-4 mr-2" />
                            Editar Colaborador
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
