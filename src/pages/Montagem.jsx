import React from "react";
import { AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import MontagemInterna from "../components/logistica/MontagemInterna";
import { hasAnyRole } from "@/config/permissions";

export default function Montagem() {
  const { user, loading } = useAuth();

  if (loading || !user) return <div className="flex h-screen items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" /></div>;

  const cargoNormalizado = String(user?.cargo || '').trim().toLowerCase();
  const isAdmin =
    user?.role === 'admin' ||
    ['administrador', 'admin', 'adm'].includes(cargoNormalizado) ||
    cargoNormalizado.includes('master');
  const isEstoque = hasAnyRole(user, ['Estoque']);
  const isLogistica = hasAnyRole(user, ['Logística']);
  const isMontador = hasAnyRole(user, ['Montador']);

  if (!isAdmin && !isEstoque && !isLogistica && !isMontador) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center text-gray-500">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <h2 className="text-lg font-semibold">Acesso Restrito</h2>
          <p className="text-sm">Esta página é para o setor de montagem interna.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <MontagemInterna />
    </div>
  );
}