import { Shield, Briefcase, UserCircle, Package, Calendar, TrendingUp, DollarSign, Users, Truck, Clock } from "lucide-react";

// Definição centralizada de todos os cargos do sistema
export const CARGOS = [
    {
        value: 'Pendente Definição',
        label: 'Pendente Definição',
        icon: Clock,
        color: '#9ca3af',
        bgColor: '#f3f4f6',
        description: 'Aguardando definição pelo admin',
        permissions: ['Nenhuma - aguardando aprovação'],
        requiresStore: false,
        canRegister: false,
        mobileAppOnly: false
    },
    {
        value: 'Administrador',
        label: 'Administrador',
        icon: Shield,
        color: '#dc2626',
        bgColor: '#fef2f2',
        description: 'Acesso total ao sistema',
        permissions: ['Acesso total ao sistema', 'Gerenciar usuários', 'Aprovar cadastros', 'Editar configurações'],
        requiresStore: false,
        canRegister: false, // Não pode se auto-cadastrar
        mobileAppOnly: false
    },
    {
        value: 'Gerente',
        label: 'Gerente de Loja',
        icon: Briefcase,
        color: '#f38a4c',
        bgColor: '#fff7ed',
        description: 'Gerencia uma loja especifica',
        permissions: ['Acesso completo da loja', 'Aprovar devolucoes', 'Ver relatorios da loja', 'Gerenciar equipe da loja'],
        requiresStore: true,
        canRegister: false,
        mobileAppOnly: false
    },
    {
        value: 'Gerente Geral',
        label: 'Gerente Geral',
        icon: Briefcase,
        color: '#ea580c',
        bgColor: '#fff7ed',
        description: 'Gerencia todas as lojas',
        permissions: ['Acesso completo de todas lojas', 'Aprovar devolucoes', 'Ver relatorios gerais', 'Gerenciar todas equipes'],
        requiresStore: false,
        canRegister: false,
        mobileAppOnly: false
    },
    {
        value: 'Vendedor',
        label: 'Vendedor',
        icon: UserCircle,
        color: '#3b82f6',
        bgColor: '#eff6ff',
        description: 'Realiza vendas e atendimento',
        permissions: ['Criar vendas e orcamentos', 'Gerenciar clientes', 'Ver comissoes proprias'],
        requiresStore: true,
        canRegister: true,
        mobileAppOnly: false
    },
    {
        value: 'Estoque',
        label: 'Estoque',
        icon: Package,
        color: '#10b981',
        bgColor: '#ecfdf5',
        description: 'Controla produtos e inventário',
        permissions: ['Gerenciar produtos', 'Movimentação de estoque', 'Gerenciar entregas'],
        requiresStore: true,
        canRegister: true,
        mobileAppOnly: false
    },
    {
        value: 'Logística',
        label: 'Logística',
        icon: Truck,
        color: '#0ea5e9',
        bgColor: '#f0f9ff',
        description: 'Coordena entregas e rotas',
        permissions: ['Gerenciar entregas', 'Agendar montagens', 'Ver clientes'],
        requiresStore: false,
        canRegister: true,
        mobileAppOnly: false
    },
    {
        value: 'Financeiro',
        label: 'Financeiro',
        icon: DollarSign,
        color: '#8b5cf6',
        bgColor: '#f5f3ff',
        description: 'Controle financeiro e fiscal',
        permissions: ['Controle financeiro completo', 'Emitir notas fiscais', 'Relatórios financeiros'],
        requiresStore: false,
        canRegister: true,
        mobileAppOnly: false
    },
    {
        value: 'Agendamento',
        label: 'Agendamento',
        icon: Calendar,
        color: '#06b6d4',
        bgColor: '#ecfeff',
        description: 'Agenda entregas e montagens',
        permissions: ['Agendar montagens', 'Gerenciar montadores', 'Confirmar entregas'],
        requiresStore: false,
        canRegister: true,
        mobileAppOnly: false
    },
    {
        value: 'RH',
        label: 'RH',
        icon: Users,
        color: '#ec4899',
        bgColor: '#fdf2f8',
        description: 'Gestão de pessoas',
        permissions: ['Gerenciar colaboradores', 'Folha de pagamento', 'Férias e licenças'],
        requiresStore: false,
        canRegister: true,
        mobileAppOnly: false
    },
    {
        value: 'Entregador',
        label: 'Entregador',
        icon: Truck,
        color: '#22c55e',
        bgColor: '#f0fdf4',
        description: 'App móvel de entregas',
        permissions: ['App de entregas', 'Registrar entregas', 'Capturar assinaturas'],
        requiresStore: false,
        canRegister: true,
        mobileAppOnly: true
    },
    {
        value: 'Montador Externo',
        label: 'Montador Externo',
        icon: Package,
        color: '#f97316',
        bgColor: '#fff7ed',
        description: 'App móvel de montagens',
        permissions: ['App de montagem', 'Pegar montagens', 'Registrar conclusão'],
        requiresStore: false,
        canRegister: true,
        mobileAppOnly: true
    }
];

// Lista de lojas disponíveis
export const LOJAS = ["Centro", "Carangola", "Ponte Branca"];

// Status de aprovação possíveis
export const STATUS_APROVACAO = {
    PENDENTE: 'Pendente',
    APROVADO: 'Aprovado',
    REJEITADO: 'Rejeitado'
};

// Funções auxiliares
export const getCargoConfig = (cargo) => {
    return CARGOS.find(c => c.value === cargo) || null;
};

export const getCargosParaCadastro = () => {
    return CARGOS.filter(c => c.canRegister);
};

export const getCargosMobileOnly = () => {
    return CARGOS.filter(c => c.mobileAppOnly);
};

export const getCargosComLoja = () => {
    return CARGOS.filter(c => c.requiresStore);
};
