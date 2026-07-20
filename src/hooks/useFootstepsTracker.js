import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { base44, getActiveAuthMode, AUTH_MODES } from '@/lib/supabase';

// Dicionário amigável para traduzir rotas
const routeNames = {
  '/': 'Página Inicial',
  '/login': 'Página de Login',
  '/admin/Dashboard': 'Painel Principal',
  '/admin/PDV': 'Frente de Caixa (PDV)',
  '/admin/Vendas': 'Vendas',
  '/admin/Devolucoes': 'Devoluções',
  '/admin/Orcamentos': 'Orçamentos',
  '/admin/Clientes': 'Clientes',
  '/admin/Produtos': 'Produtos',
  '/admin/Fornecedores': 'Fornecedores',
  '/admin/Compras': 'Painel de Compras',
  '/admin/Financeiro': 'Painel Financeiro',
  '/admin/CentralAnalitica': 'Central Analítica',
  '/admin/RecursosHumanos': 'Recursos Humanos',
  '/admin/GerenciamentoUsuarios': 'Gestão de Usuários',
  '/admin/Configuracoes': 'Configurações',
  '/admin/Estoque': 'Estoque',
  '/admin/Montagem': 'Ordens de Montagem',
  '/admin/AssistenciaTecnica': 'Assistência Técnica',
  '/admin/LogisticaSemanal': 'Logística Semanal',
  '/admin/Entregador': 'Painel de Entrega',
  '/admin/MontadorExterno': 'Painel de Montagem Ext.',
};

export function useFootstepsTracker(user) {
  const location = useLocation();

  // 1. Rastrear navegação (Mudança de Página)
  useEffect(() => {
    if (!user) return;
    // ISOLAMENTO: Não rastrear em modo operador
    if (getActiveAuthMode() === AUTH_MODES.OPERATOR) return;
    const pathname = location.pathname;
    
    // Ignorar caminhos de operador para não poluir telemetria
    if (pathname.startsWith('/operador')) return;

    const pageFriendlyName = routeNames[pathname] || pathname.split('/').pop() || 'Início';
    base44.auth.trackStep(`Acessou a tela "${pageFriendlyName}"`, user.id);
  }, [location.pathname, user]);

  // 2. Rastrear Cliques em Ações Principais (Botões de Confirmar, Salvar, Excluir, etc.)
  useEffect(() => {
    if (!user) return;
    // ISOLAMENTO: Não rastrear em modo operador
    if (getActiveAuthMode() === AUTH_MODES.OPERATOR) return;

    const handleGlobalClick = (e) => {
      // Capturar cliques em botões ou elementos com papel de botão
      const target = e.target.closest('button, [role="button"]');
      if (!target) return;

      // Pegar o texto do elemento
      const text = (target.innerText || target.textContent || '').trim();
      
      // Limpar textos vazios, ícones sem texto ou textos longos demais
      if (!text || text.length < 2 || text.length > 30) return;

      // Ignorar cliques genéricos e botões de fechar
      const ignoredWords = ['x', 'fechar', 'cancelar', 'close', 'cancel', 'anterior', 'próximo', '...', 'voltar'];
      if (ignoredWords.includes(text.toLowerCase())) return;

      base44.auth.trackStep(`Clicou em "${text}"`, user.id);
    };

    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, [user]);
}
