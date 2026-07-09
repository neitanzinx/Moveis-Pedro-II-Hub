import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSearchParams } from "react-router-dom";
import { Building2, DollarSign, Truck, FileText, Users, Shield, AlertCircle, Image, Store, Calculator, Package, UserCheck, ClipboardList, ChevronRight, CreditCard, Sparkles, Bot, MessageCircle, TrendingDown } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import ConfiguracaoComissoes from "../components/configuracoes/ConfiguracaoComissoes";
import ConfiguracaoFrota from "../components/configuracoes/ConfiguracaoFrota";
import ConfiguracaoLogo from "../components/configuracoes/ConfiguracaoLogo";
import GestaoLojas from "../components/configuracoes/GestaoLojas";
import ConfiguracaoTaxas from "../components/configuracoes/ConfiguracaoTaxas";
import GestaoCargos from "../components/configuracoes/GestaoCargos";
import ConfiguracaoNfe from "../components/configuracoes/ConfiguracaoNfe"; // Mantido para o cadastro de empresas
import ConfiguracaoPrecificacao from "../components/configuracoes/ConfiguracaoPrecificacao";
import ConfiguracaoMarkup from "../components/configuracoes/ConfiguracaoMarkup";
import AuditLogPage from "./AuditLog";
import ConfiguracaoWhatsAppBot from "../components/configuracoes/ConfiguracaoWhatsAppBot";
import GestaoFuncionarios from "../components/configuracoes/GestaoFuncionarios";
import ConfiguracaoPrazos from "../components/configuracoes/ConfiguracaoPrazos";
import ConfiguracaoComprasPagamento from "../components/configuracoes/ConfiguracaoComprasPagamento";
import ConfiguracaoPapeisSistema from "../components/configuracoes/ConfiguracaoPapeisSistema";
import ConfiguracaoAssinatura from "../components/configuracoes/ConfiguracaoAssinatura";



const MENU_CONFIG = {
  empresa: {
    label: "Empresa",
    icon: Building2,
    items: [
      { id: "logo", label: "Identidade Visual", icon: Image },
      { id: "lojas", label: "Filiais / Estoques", icon: Store },
      { id: "fiscais", label: "Dados Fiscais (Empresas)", icon: FileText },
    ]
  },
  financeiro: {
    label: "Financeiro",
    icon: DollarSign,
    items: [
      { id: "comissoes", label: "Líq. do Vendedor", icon: TrendingDown },
      { id: "taxas", label: "Taxas", icon: Calculator },
      { id: "precos", label: "Precificação", icon: Package },
      { id: "markup", label: "Markup Automático", icon: Sparkles },
    ]
  },
  cobranca: {
    label: "Cobrança",
    icon: CreditCard,
    items: [
      { id: "assinatura", label: "Plano & Assinatura", icon: CreditCard },
    ]
  },
  operacao: {
    label: "Operação",
    icon: Truck,
    items: [
      { id: "frota", label: "Frota de Veículos", icon: Truck },
      { id: "prazos", label: "Prazos de Entrega", icon: ClipboardList },
      { id: "compras-pagamento", label: "Aprovação de Compras", icon: CreditCard },
    ]

  },
  automacao: {
    label: "Automação",
    icon: Bot,
    items: [
      { id: "whatsapp", label: "WhatsApp Bot", icon: MessageCircle },
    ]
  },
  equipe: {
    label: "Equipe",
    icon: Users,
    items: [
      { id: "funcionarios", label: "Funcionários", icon: Users },
      { id: "cargos", label: "Perfis de Acesso", icon: Shield },
      { id: "papeis-sistema", label: "Papéis do Sistema", icon: UserCheck },
    ]
  },
  seguranca: {
    label: "Segurança",
    icon: Shield,
    items: [
      { id: "auditoria", label: "Log de Auditoria", icon: ClipboardList },
    ]
  },
};

export default function Configuracoes() {
  const { user, loading, can } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeCategory, setActiveCategory] = useState("empresa");
  const [activeItem, setActiveItem] = useState("logo");

  // Auto-navigate to NF-e tab when URL has ?tab=nfe
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'nfe') {
      setActiveCategory('nfe');
      setActiveItem('nfe');
      // Clean the URL param after applying
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]);

  // Ao mudar categoria, seleciona o primeiro item
  const handleCategoryChange = (category) => {
    setActiveCategory(category);
    setActiveItem(MENU_CONFIG[category].items[0].id);
  };

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#07593f' }} />
      </div>
    );
  }

  const isAdmin = can('manage_user_access');

  if (!isAdmin) {
    return (
      <div className="p-8">
        <Alert className="border-2 border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-600">
            <strong>Acesso Restrito</strong><br />
            Apenas administradores podem acessar as configurações do sistema.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const currentCategory = MENU_CONFIG[activeCategory] || MENU_CONFIG.empresa;

  // Renderiza o conteudo baseado na selecao
  const renderContent = () => {
    switch (activeItem) {
      case "logo": return <ConfiguracaoLogo user={user} />;
      case "lojas": return <GestaoLojas />;
      case "comissoes": return <ConfiguracaoComissoes />;
      case "taxas": return <ConfiguracaoTaxas />;
      case "precos": return <ConfiguracaoPrecificacao />;
      case "markup": return <ConfiguracaoMarkup />;
      case "frota": return <ConfiguracaoFrota />;
      case "whatsapp": return <ConfiguracaoWhatsAppBot />;
      case "fiscais": return <ConfiguracaoNfe />;
      case "funcionarios": return <GestaoFuncionarios currentUser={user} />;
      case "cargos": return <GestaoCargos />;
      case "papeis-sistema": return <ConfiguracaoPapeisSistema />;
      case "auditoria": return <AuditLogPage />;
      case "prazos": return <ConfiguracaoPrazos />;
      case "compras-pagamento": return <ConfiguracaoComprasPagamento />;
      case "assinatura": return <ConfiguracaoAssinatura />;

      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="py-4">
            <h1 className="text-2xl font-bold" style={{ color: '#07593f' }}>
              Configurações
            </h1>
          </div>

          {/* Tabs Principais */}
          <div className="flex gap-1 -mb-px overflow-x-auto">
            {Object.entries(MENU_CONFIG).map(([key, config]) => {
              const Icon = config.icon;
              const isActive = activeCategory === key;
              return (
                <button
                  key={key}
                  onClick={() => handleCategoryChange(key)}
                  className={`flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${isActive
                    ? "border-green-600 text-green-700"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  {config.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Layout com Sidebar */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        <div className="flex gap-6">
          {/* Sidebar Esquerda */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden sticky top-28">
              <div className="p-4 border-b bg-gray-50">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {currentCategory.label}
                </p>
              </div>
              <nav className="p-2">
                {currentCategory.items.map((item) => {
                  const ItemIcon = item.icon;
                  const isActive = activeItem === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveItem(item.id)}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${isActive
                        ? "bg-green-50 text-green-700 font-medium"
                        : "text-gray-600 hover:bg-gray-50"
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <ItemIcon className={`w-4 h-4 ${isActive ? "text-green-600" : "text-gray-400"}`} />
                        <span className="text-sm">{item.label}</span>
                      </div>
                      {isActive && <ChevronRight className="w-4 h-4 text-green-600" />}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Conteudo Principal */}
          <div className="flex-1 min-w-0">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}