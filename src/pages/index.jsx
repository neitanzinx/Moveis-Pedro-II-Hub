import Layout from "./Layout.jsx";

// Importando TODAS as páginas diretamente (Carregamento Imediato)
import Dashboard from "./Dashboard.jsx";
import Produtos from "./Produtos.jsx";
import Clientes from "./Clientes.jsx";
import Vendas from "./Vendas.jsx";
import Entregas from "./Entregas.jsx";
import Orcamentos from "./Orcamentos.jsx";
import Devolucoes from "./Devolucoes.jsx";
import Configuracoes from "./Configuracoes.jsx";
import SelecaoVendedor from "./SelecaoVendedor.jsx";
import RelatorioComissoes from "./RelatorioComissoes.jsx";
import DashboardVendedor from "./DashboardVendedor.jsx";
import BoasVindas from "./BoasVindas.jsx";
import GerenciamentoUsuarios from "./GerenciamentoUsuarios.jsx";
import Financeiro from "./Financeiro.jsx";
import Montagem from "./Montagem.jsx";
import Fornecedores from "./Fornecedores.jsx";
import RecursosHumanos from "./RecursosHumanos.jsx";
import RelatoriosAvancados from "./RelatoriosAvancados.jsx";
import TransferenciaEstoque from "./TransferenciaEstoque.jsx";
import Inventario from "./Inventario.jsx";
import AlertasRecompra from "./AlertasRecompra.jsx";
import Estoque from "./Estoque.jsx";
import ModoReuniao from "./ModoReuniao.jsx";
import PDV from "./PDV.jsx";
import CatalogoWhatsApp from "./CatalogoWhatsApp.jsx";
import NotasFiscais from "./NotasFiscais.jsx";
import LogisticaSemanal from "./LogisticaSemanal.jsx";
import Entregador from "./Entregador.jsx";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

const PAGES = {
    Dashboard, Produtos, Clientes, Vendas, Entregas, Orcamentos, Devolucoes,
    Configuracoes, SelecaoVendedor, RelatorioComissoes, DashboardVendedor,
    BoasVindas, GerenciamentoUsuarios, Financeiro, Montagem, Fornecedores,
    RecursosHumanos, RelatoriosAvancados, TransferenciaEstoque, Inventario,
    AlertasRecompra, Estoque, ModoReuniao, PDV, CatalogoWhatsApp, NotasFiscais,
    LogisticaSemanal, Entregador
};

function _getCurrentPage(url) {
    if (!url) return "Dashboard";
    if (url.endsWith('/')) url = url.slice(0, -1);
    let urlLastPart = url.split('/').pop();
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
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <Layout currentPageName={currentPage}>
            <Routes>            
                <Route path="/" element={<Dashboard />} />
                
                {/* Rotas Principais */}
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/pdv" element={<PDV />} />
                <Route path="/vendas" element={<Vendas />} />
                <Route path="/orcamentos" element={<Orcamentos />} />
                <Route path="/clientes" element={<Clientes />} />
                <Route path="/dashboard-vendedor" element={<DashboardVendedor />} />
                <Route path="/selecao-vendedor" element={<SelecaoVendedor />} />
                <Route path="/catalogo-whatsapp" element={<CatalogoWhatsApp />} />

                {/* Operacional e Logística */}
                <Route path="/estoque" element={<Estoque />} />
                <Route path="/entregas" element={<Entregas />} />
                <Route path="/logistica-semanal" element={<LogisticaSemanal />} />
                <Route path="/montagem" element={<Montagem />} />
                <Route path="/devolucoes" element={<Devolucoes />} />
                <Route path="/transferencia-estoque" element={<TransferenciaEstoque />} />
                <Route path="/inventario" element={<Inventario />} />
                <Route path="/alertas-recompra" element={<AlertasRecompra />} />
                <Route path="/entregador" element={<Entregador />} />
                <Route path="/produtos" element={<Produtos />} />
                <Route path="/fornecedores" element={<Fornecedores />} />

                {/* Gestão e Financeiro */}
                <Route path="/financeiro" element={<Financeiro />} />
                <Route path="/notas-fiscais" element={<NotasFiscais />} />
                <Route path="/relatorio-comissoes" element={<RelatorioComissoes />} />
                <Route path="/relatorios-avancados" element={<RelatoriosAvancados />} />
                <Route path="/recursos-humanos" element={<RecursosHumanos />} />
                
                {/* Admin e Configurações */}
                <Route path="/gerenciamento-usuarios" element={<GerenciamentoUsuarios />} />
                <Route path="/configuracoes" element={<Configuracoes />} />
                <Route path="/boas-vindas" element={<BoasVindas />} />
                <Route path="/modo-reuniao" element={<ModoReuniao />} />
                
                {/* Compatibilidade de Rotas Antigas */}
                <Route path="/LogisticaSemanal" element={<LogisticaSemanal />} />
                <Route path="/Entregador" element={<Entregador />} />
            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}