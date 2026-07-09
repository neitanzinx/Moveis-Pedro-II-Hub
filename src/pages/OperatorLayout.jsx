import { Link, useLocation } from "react-router-dom";
import { Activity, LogOut, Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useOperatorAuth } from "@/hooks/useOperatorAuth";

export default function OperatorLayout({ children }) {
  const location = useLocation();
  const { operatorProfile, signOut } = useOperatorAuth();

  const menuItems = [
    { title: "Painel", href: "/operador", icon: Activity },
    { title: "Gestão de Planos", href: "/operador/planos", icon: Shield },
  ];

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/operador/login";
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="h-16 border-b bg-white px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <p className="font-semibold leading-none">Operador SaaS</p>
            <p className="text-xs text-slate-500 mt-1">Ambiente isolado do ERP das lojas</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600 hidden sm:inline">{operatorProfile?.email || "operador"}</span>
          <Button type="button" variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] min-h-[calc(100vh-64px)]">
        <aside className="border-r bg-white p-4">
          <nav className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.href;

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                    active
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.title}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
