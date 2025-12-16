
import React, { useState, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard, Warehouse, Users, ShoppingCart, Truck, Building2,
  FileText, Menu, Settings, DollarSign, LogOut, RotateCcw, Plus,
  UserCog, BarChart3, Presentation, Receipt, MessageCircle, CreditCard,
  Moon, Sun, ChevronLeft, ChevronRight, Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import NotificacoesPanel from "@/components/notificacoes/NotificacoesPanel";
import BuscaGlobal from "@/components/busca/BuscaGlobal";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
  SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
import { MENU_ITEMS } from "@/components/config/permissions";
import { useAuth } from "@/components/hooks/useAuth";

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading, can } = useAuth();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  const [buscaAberta, setBuscaAberta] = useState(false);

  useEffect(() => {
    localStorage.setItem('darkMode', darkMode);
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  // Atalho Ctrl+K para abrir busca
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setBuscaAberta(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const { data: alertasAtivos = [] } = useQuery({
    queryKey: ['alertas-ativos-menu'],
    queryFn: async () => {
      const alertas = await base44.entities.AlertaRecompra.list();
      return alertas.filter(a => a.status === 'Ativo');
    },
    initialData: [],
    refetchInterval: 60000,
    enabled: !!user && can('view_estoque')
  });

  if (location.pathname === "/boas-vindas" || location.pathname === "/modo-reuniao" || location.pathname === "/entregador") {
    return children;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-neutral-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
      </div>
    );
  }

  // Filtra menu baseado em permissões
  const menuFiltrado = MENU_ITEMS.filter(item => can(item.permission));
  const sections = [...new Set(menuFiltrado.map(i => i.section))];

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gray-50 dark:bg-neutral-950">
        <Sidebar className="border-r border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <SidebarHeader className="p-4 border-b border-gray-100 dark:border-neutral-800">
            <div className="flex items-center gap-3 mb-1">
              {user?.logo_url ? (
                <div className="w-8 h-8 rounded bg-white dark:bg-neutral-800 flex items-center justify-center overflow-hidden">
                  <img src={user.logo_url} alt="Logo" className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded bg-green-700 flex items-center justify-center text-white font-bold">M</div>
              )}
              <div>
                <h2 className="font-bold text-sm text-gray-900 dark:text-white">Móveis Pedro II</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">{user?.loja ? `Loja ${user.loja}` : 'Sistema'}</p>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full justify-start text-left font-normal mt-3"
              onClick={() => setBuscaAberta(true)}
            >
              <Search className="w-4 h-4 mr-2 text-gray-400" />
              <span className="text-gray-500">Buscar...</span>
              <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                <span className="text-xs">⌘</span>K
              </kbd>
            </Button>
          </SidebarHeader>

          <SidebarContent className="p-2">
            {sections.map(section => (
              <SidebarGroup key={section}>
                <SidebarGroupLabel className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1 mt-2">
                  {section}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {menuFiltrado.filter(i => i.section === section).map(item => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={location.pathname === item.url}
                          className={`w-full justify-start h-9 text-sm transition-colors ${
                            location.pathname === item.url 
                              ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 font-medium" 
                              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800"
                          }`}
                        >
                          <Link to={item.url} className="flex items-center gap-2 px-2">
                            <item.icon className={`w-4 h-4 ${location.pathname === item.url ? "text-green-600 dark:text-green-400" : "text-gray-500"}`} />
                            <span className="flex-1">{item.title}</span>
                            {item.title === 'Estoque' && alertasAtivos.length > 0 && (
                              <Badge className="h-5 w-5 flex items-center justify-center p-0 bg-red-500 hover:bg-red-600 text-white text-[10px]">
                                {alertasAtivos.length}
                              </Badge>
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>

          <SidebarFooter className="border-t border-gray-100 dark:border-neutral-800 p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center text-gray-600 dark:text-gray-300 font-semibold text-xs">
                {user?.full_name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.full_name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => setDarkMode(!darkMode)} className="h-8 text-xs">
                {darkMode ? <Sun className="w-3 h-3 mr-1" /> : <Moon className="w-3 h-3 mr-1" />}
                Tema
              </Button>
              <Button variant="ghost" size="sm" onClick={() => base44.auth.logout()} className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50">
                <LogOut className="w-3 h-3 mr-1" />
                Sair
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="md:hidden h-14 border-b border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center px-4 gap-3">
            <SidebarTrigger />
            <span className="font-bold text-gray-900 dark:text-white">Móveis Pedro II</span>
          </header>
          <div className="flex-1 overflow-auto p-6">
            {children}
          </div>
        </main>
        </div>

        <BuscaGlobal open={buscaAberta} onClose={() => setBuscaAberta(false)} />
        </SidebarProvider>
        );
        }
