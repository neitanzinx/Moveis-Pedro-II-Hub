import { Shield, Briefcase, UserCircle, Package, TrendingUp, DollarSign, Users, Truck } from "lucide-react";

// Definição centralizada de todos os cargos do sistema
export const CARGOS = [
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
        mobileAppOnly: false,
        prefix: 'AD'
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
        mobileAppOnly: false,
        prefix: 'GE'
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
        permissions: ['Fazer vendas', 'Consultar estoque', 'Ver clientes', 'Criar crediario', 'Agenda entregas'],
        requiresStore: true,
        canRegister: true, // Vendedor pode se cadastrar (acesso rápido)
        mobileAppOnly: false,
        prefix: 'VE'
    },
    {
        value: 'Estoque',
        label: 'Estoque',
        icon: Package,
        color: '#10b981',
        bgColor: '#ecfdf5',
        description: 'Controla produtos e inventário',
        permissions: ['Receber mercadoria', 'Conferir carga', 'Movimentar estoque', 'Inventario'],
        requiresStore: false,
        canRegister: false,
        mobileAppOnly: false,
        prefix: 'ES'
    },
    {
        value: 'Logística',
        label: 'Logística',
        icon: Truck,
        color: '#0ea5e9',
        bgColor: '#f0f9ff',
        description: 'Coordena entregas e rotas',
        permissions: ['Roteirizar entregas', 'Alocar montagem', 'Status frota', 'Painel separador'],
        requiresStore: false,
        canRegister: false,
        mobileAppOnly: false,
        prefix: 'LO'
    },
    {
        value: 'Financeiro',
        label: 'Financeiro',
        icon: DollarSign,
        color: '#8b5cf6',
        bgColor: '#f5f3ff',
        description: 'Controle financeiro e fiscal',
        permissions: ['Aprovar crediario', 'Contas pagas/receber', 'Fechamento caixa', 'Relatorios financeiros'],
        requiresStore: false,
        canRegister: false,
        mobileAppOnly: false,
        prefix: 'FI'
    },
    {
        value: 'RH',
        label: 'RH',
        icon: Users,
        color: '#ec4899',
        bgColor: '#fdf2f8',
        description: 'Gestão de pessoas',
        permissions: ['Gestao de funcionarios', 'Folha pagamento', 'Controle ponto', 'Atestados'],
        requiresStore: false,
        canRegister: false,
        mobileAppOnly: false,
        prefix: 'RH'
    },
    {
        value: 'Entregador',
        label: 'Entregador',
        icon: Truck,
        color: '#22c55e',
        bgColor: '#f0fdf4',
        description: 'App móvel de entregas',
        permissions: ['APP Motorista', 'Baixar entregas', 'Registrar ocorrencias', 'Anexar fotos'],
        requiresStore: false,
        canRegister: true, // Foco do cadastro rápido atual
        mobileAppOnly: true, // Indica que usa apenas o app na rua
        prefix: 'EN'
    },
    {
        value: 'Montador',
        label: 'Montador',
        icon: Package,
        color: '#f59e0b',
        bgColor: '#fffbeb',
        description: 'Montador interno de móveis',
        permissions: ['Baixar entregas', 'APP Ajudante'],
        requiresStore: false,
        canRegister: true,
        mobileAppOnly: true,
        prefix: 'AJ'
    },
    {
        value: 'Montador Externo',
        label: 'Montador Externo',
        icon: Package,
        color: '#f97316',
        bgColor: '#fff7ed',
        description: 'App móvel de montagens',
        permissions: ['APP Montador', 'Baixar montagens', 'Aprovar laudos', 'Registrar assistencia'],
        requiresStore: false,
        canRegister: true,
        mobileAppOnly: true,
        prefix: 'MO'
    }
];

// Lista de lojas disponíveis - DEPRECATED: Use o hook useLojas() para obter dados do banco
// export const LOJAS = ["Centro", "Carangola", "Ponte Branca"];
export const LOJAS = []; // Mantido como array vazio para evitar quebras imediatas em imports legados

// Status de aprovação possíveis
export const STATUS_APROVACAO = {
    PENDENTE: 'Pendente',
    APROVADO: 'Aprovado',
    REJEITADO: 'Rejeitado'
};

// Funções auxiliares
export const getCargoConfig = (value) => {
    const fallback = CARGOS.find(c => c.value === 'Vendedor') || CARGOS[0];
    return CARGOS.find(c => c.value === value) || fallback;
};

export const getCargoPrefix = (cargoValue) => {
    const config = getCargoConfig(cargoValue);
    return config?.prefix || 'AD';
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
