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
const Entregas = lazy(() => import("./Entregas.jsx"));
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
const RecursosHumanos = lazy(() => import("./RecursosHumanos.jsx"));
const RelatoriosAvancados = lazy(() => import("./RelatoriosAvancados.jsx"));
const TransferenciaEstoque = lazy(() => import("./TransferenciaEstoque.jsx"));
const Inventario = lazy(() => import("./Inventario.jsx"));
const AlertasRecompra = lazy(() => import("./AlertasRecompra.jsx"));
const Estoque = lazy(() => import("./Estoque.jsx"));
const ModoReuniao = lazy(() => import("./ModoReuniao.jsx"));
const PDV = lazy(() => import("./PDV.jsx"));
const CatalogoWhatsApp = lazy(() => import("./CatalogoWhatsApp.jsx"));
const NotasFiscais = lazy(() => import("./NotasFiscais.jsx"));
const LogisticaSemanal = lazy(() => import("./LogisticaSemanal.jsx"));
const Entregador = lazy(() => import("./Entregador.jsx"));
const Marketing = lazy(() => import("./Marketing.jsx"));
const MontadorExterno = lazy(() => import("./MontadorExterno.jsx"));
const CadastroMobile = lazy(() => import("./CadastroMobile.jsx"));
const ExportacaoContabil = lazy(() => import("./ExportacaoContabil.jsx"));
const PedidosCompra = lazy(() => import("./SetorCompras.jsx"));
const SetorCompras = lazy(() => import("./SetorCompras.jsx"));
const DashboardBI = lazy(() => import("./DashboardBI.jsx"));
const DashboardGerente = lazy(() => import("./DashboardGerente.jsx"));
const AvaliacaoNPS = lazy(() => import("./AvaliacaoNPS.jsx"));
const Mostruario = lazy(() => import("./Mostruario.jsx"));
const EntradaEstoque = lazy(() => import("./EntradaEstoque.jsx"));
const SaneamentoEstoque = lazy(() => import("./SaneamentoEstoque.jsx"));

// ============================================================================
// CARREGAMENTO SÍNCRONO - Páginas Públicas (críticas para SEO e primeira impressão)
// ============================================================================
import LandingPage from "./LandingPage.jsx";
import LandingVIP from "./LandingVIP.jsx";
import ClienteAuth from "./ClienteAuth.jsx";
import ClienteDashboard from "./ClienteDashboard.jsx";
import AutoAtendimento from "./AutoAtendimento.jsx";

import { BrowserRouter as Router, Route, Routes, useLocation, Navigate } from 'react-router-dom';

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
    Dashboard, Produtos, Clientes, Vendas, Entregas, Orcamentos, AssistenciaTecnica,
    Configuracoes, SelecaoVendedor, RelatorioComissoes,
    BoasVindas, GerenciamentoUsuarios, Financeiro, Montagem, Fornecedores,
    RecursosHumanos, RelatoriosAvancados, TransferenciaEstoque, Inventario,
    AlertasRecompra, Estoque, ModoReuniao, PDV, CatalogoWhatsApp, NotasFiscais,
    LogisticaSemanal, Entregador, Marketing, MontadorExterno,
    ExportacaoContabil, PedidosCompra, SetorCompras, DashboardBI, DashboardGerente, Mostruario,
    EntradaEstoque, SaneamentoEstoque
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
    const { user, loading } = useAuth();
    const currentPage = _getCurrentPage(location.pathname);

    if (loading) {
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

    // ===== LOGIN DE FUNCIONÁRIOS =====
    if (location.pathname === '/login') {
        const VALID_CARGOS = ['Administrador', 'Gerente', 'Vendedor', 'Estoque', 'Financeiro', 'RH', 'Entregador', 'Montador Externo'];

        // Se já está logado como funcionário E tem cargo válido, redireciona
        if (user && user.cargo && VALID_CARGOS.includes(user.cargo)) {
            return <Navigate to="/admin/Dashboard" replace />;
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

        // Bloquear clientes (usuários sem cargo ou com cargo inválido)
        const VALID_CARGOS = ['Administrador', 'Gerente', 'Vendedor', 'Estoque', 'Financeiro', 'RH', 'Entregador', 'Montador Externo'];
        if (!user.cargo || !VALID_CARGOS.includes(user.cargo)) {
            console.warn('[Router] Usuário sem cargo válido tentando acessar /admin:', user.email, '- Cargo:', user.cargo);
            // Redirecionar para login de funcionário (não área cliente)
            return <Navigate to="/login" replace />;
        }

        // ===== RESTRICAO POR CARGO =====
        // Montador Externo só pode acessar /admin/MontadorExterno
        if (user.cargo === 'Montador Externo') {
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
        if (user.cargo === 'Entregador') {
            if (!location.pathname.toLowerCase().includes('entregador')) {
                return <Navigate to="/admin/Entregador" replace />;
            }
            return (
                <Suspense fallback={<PageLoadingFallback />}>
                    <Entregador />
                </Suspense>
            );
        }

        return (
            <Layout currentPageName={currentPage}>
                <Suspense fallback={<PageLoadingFallback />}>
                    <Routes>
                        <Route path="/admin" element={<Dashboard />} />

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
                        <Route path="/admin/Entregas" element={<Entregas />} />
                        <Route path="/admin/LogisticaSemanal" element={<LogisticaSemanal />} />
                        <Route path="/admin/Montagem" element={<Montagem />} />
                        <Route path="/admin/AssistenciaTecnica" element={<AssistenciaTecnica />} />
                        <Route path="/admin/TransferenciaEstoque" element={<TransferenciaEstoque />} />
                        <Route path="/admin/Inventario" element={<Inventario />} />
                        <Route path="/admin/AlertasRecompra" element={<AlertasRecompra />} />
                        <Route path="/admin/Entregador" element={<Entregador />} />
                        <Route path="/admin/MontadorExterno" element={<MontadorExterno />} />
                        <Route path="/admin/Mostruario" element={<Mostruario />} />
                        <Route path="/admin/Produtos" element={<Produtos />} />
                        <Route path="/admin/Fornecedores" element={<Fornecedores />} />
                        <Route path="/admin/Entrada" element={<EntradaEstoque />} />
                        <Route path="/admin/Saneamento" element={<SaneamentoEstoque />} />

                        {/* Gestão e Financeiro */}
                        <Route path="/admin/Financeiro" element={<Financeiro />} />
                        <Route path="/admin/NotasFiscais" element={<NotasFiscais />} />
                        <Route path="/admin/RelatorioComissoes" element={<RelatorioComissoes />} />
                        <Route path="/admin/RelatoriosAvancados" element={<RelatoriosAvancados />} />
                        <Route path="/admin/RecursosHumanos" element={<RecursosHumanos />} />
                        <Route path="/admin/Marketing" element={<Marketing />} />
                        <Route path="/admin/ExportacaoContabil" element={<ExportacaoContabil />} />
                        <Route path="/admin/PedidosCompra" element={<PedidosCompra />} />
                        <Route path="/admin/SetorCompras" element={<SetorCompras />} />
                        <Route path="/admin/DashboardBI" element={<DashboardBI />} />
                        <Route path="/admin/DashboardGerente" element={<DashboardGerente />} />

                        {/* Admin e Configurações */}
                        <Route path="/admin/GerenciamentoUsuarios" element={<GerenciamentoUsuarios />} />
                        <Route path="/admin/Configuracoes" element={<Configuracoes />} />
                        <Route path="/admin/BoasVindas" element={<BoasVindas />} />
                        <Route path="/admin/ModoReuniao" element={<ModoReuniao />} />

                        {/* Fallback para Dashboard */}
                        <Route path="/admin/*" element={<Dashboard />} />
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