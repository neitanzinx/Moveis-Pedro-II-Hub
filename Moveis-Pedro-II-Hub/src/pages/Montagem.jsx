import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { AlertCircle } from "lucide-react";
import MontagemInterna from "../components/logistica/MontagemInterna";

export default function Montagem() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(console.error);
  }, []);

  if (!user) return <div className="flex h-screen items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" /></div>;

  const isAdmin = user.cargo === 'Administrador';
  const isEstoque = user.cargo === 'Estoque';
  const isLogistica = user.cargo === 'Logística';
  const isAgendamento = user.cargo === 'Agendamento';

  if (!isAdmin && !isEstoque && !isLogistica && !isAgendamento) {
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