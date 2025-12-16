import { 
  LayoutDashboard, Warehouse, Users, ShoppingCart, Truck, Building2,
  FileText, DollarSign, UserCog, BarChart3, Receipt, MessageCircle, CreditCard,
  Settings, RotateCcw, CalendarDays
} from "lucide-react";

// Níveis de Acesso aos Dados
export const SCOPES = {
  ALL: 'all',       // Vê tudo (Admin)
  STORE: 'store',   // Vê da loja (Gerente)
  OWN: 'own'        // Vê só o seu (Vendedor)
};

// Regras por Cargo
export const ROLE_RULES = {
  'Administrador': {
    can: ['*'], 
    scope: SCOPES.ALL
  },
  'Gerente': {
    can: [
      'view_dashboard', 'view_vendas', 'manage_vendas', 'cancel_vendas',
      'view_estoque', 'view_clientes', 'manage_clientes',
      'view_entregas', 'manage_entregas', 'approve_devolucoes',
      'view_financeiro', 'view_relatorios', 'view_rh', 'view_notas',
      'view_orcamentos', 'create_vendas', 'view_produtos', 'view_catalogo',
      'view_montagem', 'view_devolucoes'
    ],
    scope: SCOPES.STORE
  },
  'Vendedor': {
    can: [
      'view_dashboard_vendedor', 'view_vendas', 'create_vendas',
      'view_produtos', 'view_clientes', 'create_clientes',
      'view_orcamentos', 'create_orcamentos', 'view_catalogo'
    ],
    scope: SCOPES.OWN
  },
  'Estoque': {
    can: [
      'view_estoque', 'manage_estoque', 'view_entregas', 'manage_entregas',
      'view_montagem', 'view_produtos'
    ],
    scope: SCOPES.ALL
  },
  'Financeiro': {
    can: [
      'view_financeiro', 'manage_financeiro', 'view_notas', 'view_vendas',
      'view_montagem', 'view_clientes'
    ],
    scope: SCOPES.ALL
  },
  'Agendamento': {
    can: [
      'view_entregas', 'manage_entregas', 'view_montagem', 'manage_montagem',
      'view_clientes'
    ],
    scope: SCOPES.ALL
  },
  'RH': {
    can: ['view_rh', 'manage_rh'],
    scope: SCOPES.ALL
  },
  'Entregador': {
    can: ['view_entregas'],
    scope: SCOPES.OWN
  }
};

// Menu Lateral Configurado
// ATENÇÃO: Links em PascalCase para bater com o nome dos arquivos (Limitação da plataforma)
export const MENU_ITEMS = [
  { title: "Dashboard", url: "/Dashboard", icon: LayoutDashboard, permission: 'view_dashboard', section: "Principal" },
  { title: "Meu Painel", url: "/DashboardVendedor", icon: LayoutDashboard, permission: 'view_dashboard_vendedor', section: "Principal" },
  { title: "PDV", url: "/PDV", icon: CreditCard, permission: 'create_vendas', section: "Principal" },
  
  { title: "Vendas", url: "/Vendas", icon: ShoppingCart, permission: 'view_vendas', section: "Vendas" },
  { title: "Orçamentos", url: "/Orcamentos", icon: FileText, permission: 'view_orcamentos', section: "Vendas" },
  { title: "Clientes", url: "/Clientes", icon: Users, permission: 'view_clientes', section: "Vendas" },
  
  { title: "Estoque", url: "/Estoque", icon: Warehouse, permission: 'view_estoque', section: "Operacional" },
  // AQUI ESTÁ A MUDANÇA CRÍTICA: /LogisticaSemanal em vez de /logistica-semanal
  { title: "Logística", url: "/LogisticaSemanal", icon: CalendarDays, permission: 'view_entregas', section: "Operacional" },
  { title: "Montagem", url: "/Montagem", icon: Building2, permission: 'view_montagem', section: "Operacional" },
  { title: "Devoluções", url: "/Devolucoes", icon: RotateCcw, permission: 'view_devolucoes', section: "Operacional" },
  
  { title: "Financeiro", url: "/Financeiro", icon: DollarSign, permission: 'view_financeiro', section: "Gestão" },
  { title: "Notas Fiscais", url: "/NotasFiscais", icon: Receipt, permission: 'view_notas', section: "Gestão" },
  { title: "Comissões", url: "/RelatorioComissoes", icon: DollarSign, permission: 'view_relatorios', section: "Gestão" },
  { title: "Relatórios", url: "/RelatoriosAvancados", icon: BarChart3, permission: 'view_relatorios', section: "Gestão" },
  { title: "RH", url: "/RecursosHumanos", icon: UserCog, permission: 'view_rh', section: "Gestão" },
  
  { title: "WhatsApp", url: "/CatalogoWhatsApp", icon: MessageCircle, permission: 'view_catalogo', section: "Ferramentas" },
  { title: "Configurações", url: "/Configuracoes", icon: Settings, permission: '*', section: "Admin" }
];