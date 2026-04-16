import { lazy, Suspense } from 'react';
import Layout from "./Layout.jsx";
import LoginFuncionario from "./LoginFuncionario.jsx";

// ============================================================================
// LAZY LOADING - Páginas Admin (carregadas sob demanda para melhor performance)
// ============================================================================
const Dashboard = lazy(() => import("./Dashboard.jsx"));
const Produtos = lazy(() => import("./Produtos.jsx"));
const Clientes = lazy(() => import("./Clientes.jsx"));
const Vendas = lazy(() => import("./Vendas.jsx"));

const Orcamentos = lazy(() => import("./Orcamentos.jsx"));
const AssistenciaTecnica = lazy(() => import("./AssistenciaTecnica.jsx"));
const Configuracoes = lazy(() => import("./Configuracoes.jsx"));
const SelecaoVendedor = lazy(() => import("./SelecaoVendedor.jsx"));
const RelatorioComissoes = lazy(() => import("./RelatorioComissoes.jsx"));
const BoasVindas = lazy(() => import("./BoasVindas.jsx"));
const GerenciamentoUsuarios = lazy(() => import("./GerenciamentoUsuarios.jsx"));
const Financeiro = lazy(() => import("./Financeiro.jsx"));
const Montagem = lazy(() => import("./Montagem.jsx"));
const Fornecedores = lazy(() => import("./Fornecedores.jsx"));
const Compras = lazy(() => import("./Compras.jsx"));
const RecursosHumanos = lazy(() => import("./RecursosHumanos.jsx"));
const RelatoriosAvancados = lazy(() => import("./RelatoriosAvancados.jsx"));
const TransferenciaEstoque = lazy(() => import("./TransferenciaEstoque.jsx"));
const Inventario = lazy(() => import("./Inventario.jsx"));
const Estoque = lazy(() => import("./Estoque.jsx"));
const ModoReuniao = lazy(() => import("./ModoReuniao.jsx"));
const PDV = lazy(() => import("./PDV.jsx"));
const CatalogoWhatsApp = lazy(() => import("./CatalogoWhatsApp.jsx"));
const LogisticaSemanal = lazy(() => import("./LogisticaSemanal.jsx"));
const Entregador = lazy(() => import("./Entregador.jsx"));
const Marketing = lazy(() => import("./Marketing.jsx"));
const MontadorExterno = lazy(() => import("./MontadorExterno.jsx"));
const CadastroMobile = lazy(() => import("./CadastroMobile.jsx"));
const ExportacaoContabil = lazy(() => import("./ExportacaoContabil.jsx"));
const DashboardBI = lazy(() => import("./DashboardBI.jsx"));
const DashboardGerente = lazy(() => import("./DashboardGerente.jsx"));
const AvaliacaoNPS = lazy(() => import("./AvaliacaoNPS.jsx"));
const EntradaEstoque = lazy(() => import("./EntradaEstoque.jsx"));
const PoliticasEstoque = lazy(() => import("./PoliticasEstoque.jsx"));
const AprovacaoSemEstoque = lazy(() => import("./AprovacaoSemEstoque.jsx"));

// ============================================================================
// CARREGAMENTO SÍNCRONO - Páginas Públicas (críticas para SEO e primeira impressão)
// ============================================================================
import LandingPage from "./LandingPage.jsx";
import LandingVIP from "./LandingVIP.jsx";
import ClienteAuth from "./cliente/ClienteAuth.jsx";
import ClienteDashboard from "./cliente/ClienteDashboard.jsx";
import AutoAtendimento from "./AutoAtendimento.jsx";
import RastreioPublico from "./RastreioPublico.jsx";
import RadioLoja from "./RadioLoja.jsx";

import { BrowserRouter as Router, Route, Routes, useLocation, Navigate } from 'react-router-dom';
import { hasAnyRole, getUserRoles } from "@/config/permissions";
import { MENU_ITEMS } from "@/config/permissions";
import { useTenant } from "@/contexts/TenantContext";

// ============================================================================
// COMPONENTE DE LOADING - Exibido enquanto páginas lazy são carregadas
// ============================================================================
function PageLoadingFallback() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-800 mx-auto mb-4"></div>
                <p className="text-green-800 font-medium">Carregando...</p>
            </div>
        </div>
    );
}
import { useAuth } from "@/hooks/useAuth";


const PAGES = {
    Dashboard, Produtos, Clientes, Vendas, Orcamentos, AssistenciaTecnica,
    Configuracoes, SelecaoVendedor, RelatorioComissoes,
    BoasVindas, GerenciamentoUsuarios, Financeiro, Montagem, Fornecedores, Compras,
    Inventario, Estoque, ModoReuniao, PDV, CatalogoWhatsApp,
    LogisticaSemanal, Entregador, Marketing, MontadorExterno,
    ExportacaoContabil, DashboardBI, DashboardGerente,
    EntradaEstoque, PoliticasEstoque, AprovacaoSemEstoque
};

function _getCurrentPage(url) {
    if (!url) return "Dashboard";
    // Remove /admin prefix if present
    let cleanUrl = url.replace(/^\/admin/, '');
    if (cleanUrl.endsWith('/')) cleanUrl = cleanUrl.slice(0, -1);
    let urlLastPart = cleanUrl.split('/').pop();
    if (urlLastPart.includes('?')) urlLastPart = urlLastPart.split('?')[0];
    if (!urlLastPart) return "Dashboard";

    // Normalização para encontrar o título correto (ex: logistica-semanal -> LogisticaSemanal)
    const normalizedUrl = urlLastPart.toLowerCase().replace(/-/g, '');
    const pageName = Object.keys(PAGES).find(page =>
        page.toLowerCase() === normalizedUrl
    );

    return pageName || "Dashboard";
}

function PagesContent() {
    const location = useLocation();
    const { user, loading, can } = useAuth();
    const { isModuleActive } = useTenant();
    const currentPage = _getCurrentPage(location.pathname);

    const menuFiltrado = MENU_ITEMS.filter((item) => {
        if (!can(item.permission)) return false;
        if (item.module && !isModuleActive(item.module)) return false;
        return true;
    });

    const firstAllowedAdminUrl = menuFiltrado[0]?.url || "/admin/Dashboard";

    // Mover lógica de loading para o final do "processamento de hooks"
    // ou garantir que as rotas públicas que não usam hooks extras venham depois do loading se necessário.

    if (loading && !location.pathname.startsWith('/avaliacao/') && location.pathname !== '/' && location.pathname !== '/home' && location.pathname !== '/vip') {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-800"></div>
            </div>
        );
    }

    // ===== ROTAS PÚBLICAS (Antes da verificação de autenticação) =====

    // Rota pública de avaliação NPS
    if (location.pathname.startsWith('/avaliacao/')) {
        return <AvaliacaoNPS />;
    }

    // Landing Page pública (raiz do site) - SEMPRE pública
    if (location.pathname === '/' || location.pathname === '/home') {
        return <LandingPage />;
    }

    // Página VIP - Landing simples com link do grupo
    if (location.pathname === '/vip') {
        return <LandingVIP />;
    }

    // Autenticação de clientes (público)
    if (location.pathname === '/cliente-login') {
        return <ClienteAuth />;
    }

    // Área do cliente (requer autenticação Supabase, mas não admin)
    if (location.pathname === '/area-cliente') {
        return <ClienteDashboard />;
    }

    // Rota de cadastro pública (mobile)
    if (location.pathname === '/CadastroMobile') {
        return <CadastroMobile />;
    }

    // Autoatendimento Assistência Técnica (Público)
    if (location.pathname === '/assistencia/auto') {
        return <AutoAtendimento />;
    }

    // Rota de rastreio pública
    if (location.pathname.startsWith('/rastreio')) {
        const id = location.pathname.split('/').pop();
        return <RastreioPublico idProp={id !== 'rastreio' ? id : null} />;
    }

    // Tela de Rádio (TV/Kiosk) - Pública
    if (location.pathname === '/radio') {
        return <RadioLoja />;
    }

    // ===== LOGIN DE FUNCIONÁRIOS =====
    if (location.pathname === '/login') {
        // Se já está logado como funcionário E tem cargo válido (qualquer cargo não vazio), redireciona
        // MAS APENAS se NÃO for primeiro acesso. Se for primeiro acesso, deixa renderizar o LoginFuncionario para trocar senha.
        if (user && getUserRoles(user).length > 0 && !user.primeiro_acesso) {
            const params = new URLSearchParams(location.search);
            const redirect = params.get('redirect');
            return <Navigate to={redirect || firstAllowedAdminUrl} replace />;
        }

        // Se está logado mas sem permissão, força logout ou mostra erro (aqui deixamos ficar no login para evitar loop)
        if (user) {
            console.warn('Usuário logado sem permissão de acesso ao admin. Permanecendo no login.');
            // Opcional: chamar logout() aqui se quiser forçar limpeza
        }

        return <LoginFuncionario />;
    }

    // ===== ROTAS ADMIN (Requerem autenticação do sistema interno) =====
    // Qualquer rota que começa com /admin requer autenticação de funcionário
    if (location.pathname.startsWith('/admin')) {
        if (!user) {
            return <Navigate to="/login" replace />;
        }

        // Bloquear clientes (usuários sem cargo)
        if (getUserRoles(user).length === 0) {
            console.warn('[Router] Usuário sem cargo válido tentando acessar /admin:', user.email, '- Cargos:', user.cargos || user.cargo);
            // Redirecionar para login de funcionário (não área cliente)
            return <Navigate to="/login" replace />;
        }

        // ===== RESTRICAO POR CARGO =====
        // Restrições de navegação mobile-only (Entregador, Montador, Montador Externo) só se
        // aplicam quando TODOS os cargos do usuário são mobile-only. Se o usuário tiver
        // qualquer cargo não-mobile (ex: Vendedor, Gerente), acessa o sistema completo.
        const MOBILE_ONLY_ROLES = ['Entregador', 'Montador', 'Montador Externo'];
        const userRoles = getUserRoles(user);
        const isMobileOnlyUser = userRoles.length > 0 && userRoles.every(role => MOBILE_ONLY_ROLES.includes(role));

        // Para perfis administrativos/comerciais, /admin deve abrir na primeira tela visível do menu.
        if (location.pathname === '/admin') {
            return <Navigate to={firstAllowedAdminUrl} replace />;
        }

        if (location.pathname.toLowerCase().startsWith('/admin/montagem') && !can('view_montagem')) {
            return <Navigate to={firstAllowedAdminUrl} replace />;
        }

        // Montador Externo só pode acessar /admin/MontadorExterno
        if (isMobileOnlyUser && hasAnyRole(user, ['Montador Externo'])) {
            if (!location.pathname.toLowerCase().includes('montadorexterno')) {
                return <Navigate to="/admin/MontadorExterno" replace />;
            }
            return (
                <Suspense fallback={<PageLoadingFallback />}>
                    <MontadorExterno />
                </Suspense>
            );
        }

        // Entregador só pode acessar /admin/Entregador
        if (isMobileOnlyUser && hasAnyRole(user, ['Entregador'])) {
            if (!location.pathname.toLowerCase().includes('entregador')) {
                return <Navigate to="/admin/Entregador" replace />;
            }
            return (
                <Suspense fallback={<PageLoadingFallback />}>
                    <Entregador />
                </Suspense>
            );
        }

        // Logística: soft redirect para LogisticaSemanal quando não tem outros cargos de gestão
        const NON_LOGISTICS_ROLES = ['Administrador', 'Gerente', 'Gerente Geral', 'Financeiro', 'RH', 'Comprador'];
        const hasOnlyLogisticsRoles = userRoles.every(role => role === 'Logística' || MOBILE_ONLY_ROLES.includes(role));
        const hasNonLogisticsRole = userRoles.some(role => NON_LOGISTICS_ROLES.includes(role));
        if (hasAnyRole(user, ['Logística']) && hasOnlyLogisticsRoles && !hasNonLogisticsRole) {
            if (location.pathname === '/admin' || location.pathname === '/admin/Dashboard') {
                return <Navigate to="/admin/LogisticaSemanal" replace />;
            }
            // Permite outras rotas
        }

        // Se o usuário não tiver acesso ao Dashboard padrão, evita cair nele como primeira tela.
        if (location.pathname === '/admin/Dashboard' && firstAllowedAdminUrl !== '/admin/Dashboard') {
            return <Navigate to={firstAllowedAdminUrl} replace />;
        }

        // Montador Interno só pode acessar /admin/Montagem
        if (isMobileOnlyUser && hasAnyRole(user, ['Montador'])) {
            if (!location.pathname.toLowerCase().includes('montagem')) {
                return <Navigate to="/admin/Montagem" replace />;
            }
            return (
                <Suspense fallback={<PageLoadingFallback />}>
                    <Montagem />
                </Suspense>
            );
        }

        return (
            <Layout currentPageName={currentPage}>
                <Suspense fallback={<PageLoadingFallback />}>
                    <Routes>
                        <Route path="/admin" element={<Navigate to={firstAllowedAdminUrl} replace />} />

                        {/* Rotas Principais */}
                        <Route path="/admin/Dashboard" element={<Dashboard />} />
                        <Route path="/admin/PDV" element={<PDV />} />
                        <Route path="/admin/Vendas" element={<Vendas />} />
                        <Route path="/admin/Orcamentos" element={<Orcamentos />} />
                        <Route path="/admin/Clientes" element={<Clientes />} />

                        <Route path="/admin/SelecaoVendedor" element={<SelecaoVendedor />} />
                        <Route path="/admin/CatalogoWhatsApp" element={<CatalogoWhatsApp />} />

                        {/* Operacional e Logística */}
                        <Route path="/admin/Estoque" element={<Estoque />} />

                        <Route path="/admin/LogisticaSemanal" element={<LogisticaSemanal />} />
                        <Route path="/admin/Montagem" element={<Montagem />} />
                        <Route path="/admin/AssistenciaTecnica" element={<AssistenciaTecnica />} />
                        <Route path="/admin/TransferenciaEstoque" element={<TransferenciaEstoque />} />
                        <Route path="/admin/Inventario" element={<Inventario />} />
                        <Route path="/admin/Entregador" element={<Entregador />} />
                        <Route path="/admin/MontadorExterno" element={<MontadorExterno />} />
                        <Route path="/admin/Produtos" element={<Produtos />} />
                        <Route path="/admin/Fornecedores" element={<Fornecedores />} />
                        <Route path="/admin/Compras" element={<Compras />} />
                        <Route path="/admin/Entrada" element={<EntradaEstoque />} />

                        {/* Gestão e Financeiro */}
                        <Route path="/admin/Financeiro" element={<Financeiro />} />
                        <Route path="/admin/RelatorioComissoes" element={<RelatorioComissoes />} />
                        <Route path="/admin/RelatoriosAvancados" element={<RelatoriosAvancados />} />
                        <Route path="/admin/RecursosHumanos" element={<RecursosHumanos />} />
                        <Route path="/admin/Marketing" element={<Marketing />} />
                        <Route path="/admin/ExportacaoContabil" element={<ExportacaoContabil />} />
                        <Route path="/admin/DashboardBI" element={<DashboardBI />} />
                        <Route path="/admin/DashboardGerente" element={<DashboardGerente />} />

                        {/* Estoque - Políticas e Aprovações */}
                        <Route path="/admin/PoliticasEstoque" element={<PoliticasEstoque />} />
                        <Route path="/admin/AprovacaoSemEstoque" element={<AprovacaoSemEstoque />} />

                        {/* Admin e Configurações */}
                        <Route path="/admin/GerenciamentoUsuarios" element={<GerenciamentoUsuarios />} />
                        <Route path="/admin/Configuracoes" element={<Configuracoes />} />
                        <Route path="/admin/BoasVindas" element={<BoasVindas />} />
                        <Route path="/admin/ModoReuniao" element={<ModoReuniao />} />

                        {/* Fallback para Dashboard */}
                        <Route path="/admin/*" element={<Navigate to={firstAllowedAdminUrl} replace />} />
                    </Routes>
                </Suspense>
            </Layout>
        );
    }

    // ===== FALLBACK: Redireciona rotas desconhecidas para Landing Page =====
    return <Navigate to="/" replace />;
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}