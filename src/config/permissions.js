import {
  LayoutDashboard, Warehouse, Users, ShoppingCart, Truck, Building2,
  FileText, DollarSign, UserCog, BarChart3, Receipt, MessageCircle, CreditCard,
  Settings, CalendarDays, Tag, Smartphone, Wrench, PieChart, Package, FileSpreadsheet, Target
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
      'view_dashboard', 'view_dashboard_gerente', 'view_vendas', 'manage_vendas', 'cancel_vendas',
      'view_estoque', 'view_clientes', 'manage_clientes',
      'view_entregas', 'manage_entregas', 'view_assistencia', 'manage_assistencia',
      'view_financeiro', 'view_relatorios', 'view_rh', 'view_notas',
      'view_orcamentos', 'create_vendas', 'view_produtos', 'view_catalogo',
      'view_montagem', 'view_marketing'
    ],
    scope: SCOPES.STORE
  },
  'Gerente Geral': {
    can: [
      'view_dashboard', 'view_dashboard_gerente', 'view_vendas', 'manage_vendas', 'cancel_vendas',
      'view_estoque', 'view_clientes', 'manage_clientes',
      'view_entregas', 'manage_entregas', 'view_assistencia', 'manage_assistencia',
      'view_financeiro', 'view_relatorios', 'view_rh', 'view_notas',
      'view_orcamentos', 'create_vendas', 'view_produtos', 'view_catalogo',
      'view_montagem', 'view_marketing'
    ],
    scope: SCOPES.ALL
  },
  'Vendedor': {
    can: [
      'view_dashboard', 'view_vendas', 'create_vendas',
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
  'Logística': {
    can: [
      'view_entregas', 'manage_entregas', 'view_montagem', 'manage_montagem',
      'view_clientes'
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
    can: ['view_entregas', 'view_mobile_entregador'],
    scope: SCOPES.OWN
  },
  'Montador Externo': {
    can: ['view_mobile_montador'],
    scope: SCOPES.OWN
  }
};

// Menu Lateral Configurado
// ATENÇÃO: Links em PascalCase para bater com o nome dos arquivos (Limitação da plataforma)
// NOTA: A propriedade 'module' indica qual feature flag controla a visibilidade do item
export const MENU_ITEMS = [
  { title: "Meu Painel", url: "/admin/Dashboard", icon: LayoutDashboard, permission: 'view_dashboard', section: "Principal" },
  { title: "Painel Gerente", url: "/admin/DashboardGerente", icon: Target, permission: 'view_dashboard_gerente', section: "Principal" },
  { title: "PDV", url: "/admin/PDV", icon: CreditCard, permission: 'create_vendas', section: "Principal" },

  { title: "Vendas", url: "/admin/Vendas", icon: ShoppingCart, permission: 'view_vendas', section: "Vendas" },
  { title: "Orçamentos", url: "/admin/Orcamentos", icon: FileText, permission: 'view_orcamentos', section: "Vendas" },
  { title: "Clientes", url: "/admin/Clientes", icon: Users, permission: 'view_clientes', section: "Vendas" },

  { title: "Produtos", url: "/admin/Produtos", icon: Tag, permission: 'view_produtos', section: "Operacional" },
  { title: "Estoque", url: "/admin/Estoque", icon: Warehouse, permission: 'view_estoque', section: "Operacional" },
  { title: "Logística", url: "/admin/LogisticaSemanal", icon: CalendarDays, permission: 'view_entregas', section: "Operacional" },
  { title: "Montagem", url: "/admin/Montagem", icon: Building2, permission: 'view_montagem', section: "Operacional", module: 'montagem' },
  { title: "Assistência Técnica", url: "/admin/AssistenciaTecnica", icon: Wrench, permission: 'view_assistencia', section: "Operacional", module: 'assistencia_tecnica' },

  { title: "Financeiro", url: "/admin/Financeiro", icon: DollarSign, permission: 'view_financeiro', section: "Gestão" },
  { title: "Notas Fiscais", url: "/admin/NotasFiscais", icon: Receipt, permission: 'view_notas', section: "Gestão", module: 'nfe' },
  { title: "Comissões", url: "/admin/RelatorioComissoes", icon: DollarSign, permission: 'view_relatorios', section: "Gestão" },
  { title: "Marketing", url: "/admin/Marketing", icon: Tag, permission: 'view_marketing', section: "Gestão", module: 'marketing' },
  { title: "Relatórios", url: "/admin/RelatoriosAvancados", icon: BarChart3, permission: 'view_relatorios', section: "Gestão" },
  { title: "RH", url: "/admin/RecursosHumanos", icon: UserCog, permission: 'view_rh', section: "Gestão", module: 'rh' },
  { title: "Dashboard BI", url: "/admin/DashboardBI", icon: PieChart, permission: 'view_relatorios', section: "Gestão", module: 'bi_dashboard' },
  { title: "Exportação Contábil", url: "/admin/ExportacaoContabil", icon: FileSpreadsheet, permission: 'view_financeiro', section: "Gestão" },

  { title: "Setor de Compras", url: "/admin/SetorCompras", icon: Package, permission: 'view_estoque', section: "Operacional" },

  { title: "WhatsApp", url: "/admin/CatalogoWhatsApp", icon: MessageCircle, permission: 'view_catalogo', section: "Ferramentas", module: 'catalogo_whatsapp' },

  // Mobile Modules - Apenas Admin pode ver no menu (são apps separados)
  { title: "App Entregador", url: "/admin/Entregador", icon: Truck, permission: 'admin_only', section: "Mobile Modules" },
  { title: "App Montador", url: "/admin/MontadorExterno", icon: Wrench, permission: 'admin_only', section: "Mobile Modules", module: 'montagem' },

  { title: "Configurações", url: "/admin/Configuracoes", icon: Settings, permission: '*', section: "Admin" }
];

/**
 * Calcula as permissoes efetivas de um usuario
 * Combina ROLE_RULES do cargo com custom_permissions do usuario
 * 
 * @param {Object} user - Usuario com cargo e custom_permissions
 * @returns {Object} { permissions: string[], scope: string }
 */
export function getUserEffectivePermissions(user) {
  if (!user) return { permissions: [], scope: SCOPES.OWN };

  const cargo = user.cargo || 'Vendedor';
  const roleRules = ROLE_RULES[cargo] || ROLE_RULES['Vendedor'];

  // Administrador tem acesso total
  if (roleRules.can.includes('*')) {
    return {
      permissions: ['*'],
      scope: SCOPES.ALL
    };
  }

  // Pega permissoes base do cargo
  let basePermissions = [...roleRules.can];

  // Aplica custom_permissions se existir
  const custom = user.custom_permissions;
  if (custom && typeof custom === 'object') {
    // Se nao herda do cargo, comeca do zero
    if (custom.inherit === false) {
      basePermissions = [];
    }

    // Adiciona permissoes allowed
    if (Array.isArray(custom.allowed)) {
      custom.allowed.forEach(p => {
        if (!basePermissions.includes(p)) {
          basePermissions.push(p);
        }
      });
    }

    // Remove permissoes denied
    if (Array.isArray(custom.denied)) {
      basePermissions = basePermissions.filter(p => !custom.denied.includes(p));
    }
  }

  return {
    permissions: basePermissions,
    scope: roleRules.scope
  };
}

/**
 * Verifica se usuario tem uma permissao especifica
 * @param {Object} user - Usuario
 * @param {string} permission - Permissao a verificar
 * @returns {boolean}
 */
export function userCan(user, permission) {
  const { permissions } = getUserEffectivePermissions(user);

  // Wildcard tem acesso total
  if (permissions.includes('*')) return true;

  // Permissao especifica
  return permissions.includes(permission);
}

/**
 * Retorna os itens de menu visiveis para um usuario
 * @param {Object} user - Usuario
 * @returns {Array} Menu items filtrados
 */
export function getVisibleMenuItems(user) {
  const { permissions } = getUserEffectivePermissions(user);

  return MENU_ITEMS.filter(item => {
    // Itens com * sao visiveis para todos
    if (item.permission === '*') return true;

    // Admin only items
    if (item.permission === 'admin_only') {
      return permissions.includes('*');
    }

    // Verifica permissao
    if (permissions.includes('*')) return true;
    return permissions.includes(item.permission);
  });
}

/**
 * Retorna todas as permissoes unicas do sistema
 * @returns {Array} Lista de permissoes
 */
export function getAllPermissions() {
  const permSet = new Set();

  MENU_ITEMS.forEach(item => {
    if (item.permission && item.permission !== '*' && item.permission !== 'admin_only') {
      permSet.add(item.permission);
    }
  });

  // Adiciona permissoes extras que nao estao no menu
  Object.values(ROLE_RULES).forEach(rule => {
    rule.can.forEach(p => {
      if (p !== '*') permSet.add(p);
    });
  });

  return Array.from(permSet).sort();
}

/**
 * Retorna o estado de cada permissao para um usuario
 * @param {Object} user - Usuario
 * @returns {Object} { permission: { active: boolean, source: 'role'|'custom_allowed'|'custom_denied' } }
 */
export function getPermissionStates(user) {
  if (!user) return {};

  const cargo = user.cargo || 'Vendedor';
  const roleRules = ROLE_RULES[cargo] || ROLE_RULES['Vendedor'];
  const custom = user.custom_permissions || { inherit: true, allowed: [], denied: [] };
  const allPerms = getAllPermissions();

  const states = {};

  allPerms.forEach(perm => {
    const fromRole = roleRules.can.includes('*') || roleRules.can.includes(perm);
    const inAllowed = Array.isArray(custom.allowed) && custom.allowed.includes(perm);
    const inDenied = Array.isArray(custom.denied) && custom.denied.includes(perm);

    let active = false;
    let source = 'role';

    if (custom.inherit === false) {
      // Nao herda - apenas allowed conta
      active = inAllowed;
      source = inAllowed ? 'custom_allowed' : 'none';
    } else {
      // Herda do cargo
      if (inDenied) {
        active = false;
        source = 'custom_denied';
      } else if (inAllowed) {
        active = true;
        source = 'custom_allowed';
      } else {
        active = fromRole;
        source = 'role';
      }
    }

    states[perm] = { active, source, fromRole };
  });

  return states;
}