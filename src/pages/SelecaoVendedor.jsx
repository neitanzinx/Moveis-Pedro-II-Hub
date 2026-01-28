import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useTenant, useLojas } from "@/contexts/TenantContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { MapPin, UserCheck, ArrowRight } from "lucide-react";

export default function SelecaoVendedor() {
  const { brandName, brandLogo, primaryColor, secondaryColor } = useTenant();
  const { lojas } = useLojas();
  const [user, setUser] = useState(null);
  const [lojaSelecionada, setLojaSelecionada] = useState("");
  const [vendedorSelecionado, setVendedorSelecionado] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      // Se já tiver loja e vendedor configurados, redireciona
      if (currentUser.loja && currentUser.vendedor_id) {
        navigate(createPageUrl("Dashboard"));
      }
    };
    loadUser();
  }, []);

  const { data: vendedores } = useQuery({
    queryKey: ['vendedores'],
    queryFn: () => base44.entities.Vendedor.list(),
  });

  const vendedoresFiltrados = vendedores.filter(
    v => v.loja === lojaSelecionada && v.ativo
  );

  const handleConfirmar = async () => {
    if (!lojaSelecionada || !vendedorSelecionado) {
      alert("Selecione a loja e o vendedor");
      return;
    }

    const vendedor = vendedores.find(v => v.id === vendedorSelecionado);

    await base44.auth.updateMe({
      loja: lojaSelecionada,
      vendedor_id: vendedorSelecionado,
      vendedor_nome: vendedor?.nome
    });

    navigate(createPageUrl("Dashboard"));
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#07593f' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#FAF8F5' }}>
      <Card className="w-full max-w-md border-0 shadow-2xl">
        <CardHeader className="text-center pb-6" style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}>
          <div className="w-20 mx-auto mb-4 rounded-full bg-white flex items-center justify-center p-3">
            <img
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/690ce4cb64e20af6b4a46b6f/3474ff954_undefined-Imgur.png"
              alt="Logo"
              style={{ width: '100%', height: 'auto', objectFit: 'contain' }}
            />
          </div>
          <CardTitle className="text-white text-2xl">
            {brandName}
          </CardTitle>
          <p className="text-white/80 mt-2">Bem-vindo, {user.full_name}!</p>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold mb-2" style={{ color: '#07593f' }}>
              Configuração Inicial
            </h2>
            <p className="text-sm" style={{ color: '#8B8B8B' }}>
              Selecione sua loja e identifique-se para começar
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="loja" className="flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4" style={{ color: '#07593f' }} />
                Selecione sua Loja *
              </Label>
              <Select value={lojaSelecionada} onValueChange={setLojaSelecionada}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha a loja" />
                </SelectTrigger>
                <SelectContent>
                  {lojas.map(loja => (
                    <SelectItem key={loja.id} value={loja.codigo}>
                      🏪 {loja.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {lojaSelecionada && (
              <div>
                <Label htmlFor="vendedor" className="flex items-center gap-2 mb-2">
                  <UserCheck className="w-4 h-4" style={{ color: '#07593f' }} />
                  Quem é você? *
                </Label>
                <Select value={vendedorSelecionado} onValueChange={setVendedorSelecionado}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione seu nome" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendedoresFiltrados.length === 0 ? (
                      <div className="p-4 text-center text-sm" style={{ color: '#8B8B8B' }}>
                        Nenhum vendedor cadastrado nesta loja
                      </div>
                    ) : (
                      vendedoresFiltrados.map(vendedor => (
                        <SelectItem key={vendedor.id} value={vendedor.id}>
                          👤 {vendedor.nome}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <Button
            onClick={handleConfirmar}
            disabled={!lojaSelecionada || !vendedorSelecionado}
            className="w-full h-12 text-lg shadow-lg"
            style={{ background: 'linear-gradient(135deg, #f38a4c 0%, #f5a164 100%)' }}
          >
            Confirmar e Continuar
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>

          <p className="text-xs text-center mt-4" style={{ color: '#8B8B8B' }}>
            Esta configuração é necessária apenas na primeira vez que você acessa o sistema
          </p>
        </CardContent>
      </Card>
    </div>
  );
}