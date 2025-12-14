import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck, MapPin, Navigation, CheckCircle, Send, Radio } from "lucide-react";

export default function Entregador() {
  const [user, setUser] = useState(null);
  const [rotaIniciada, setRotaIniciada] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [caminhaoId, setCaminhaoId] = useState(null);
  const watchId = useRef(null);
  
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      // Tenta descobrir o caminhão do usuário (simulação: pega o primeiro ativo ou do perfil)
      // Em produção, isso viria do login do motorista
      base44.entities.Caminhao.list().then(caminhoes => {
        const meuCaminhao = caminhoes.find(c => c.motorista_padrao === u.full_name || c.ativo);
        if (meuCaminhao) setCaminhaoId(meuCaminhao.id);
      });
    });

    return () => {
      if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
    };
  }, []);

  const { data: entregas = [] } = useQuery({
    queryKey: ['entregas-rota'],
    queryFn: async () => {
        const todas = await base44.entities.Entrega.list('-ordem_rota');
        const hoje = new Date().toISOString().split('T')[0];
        return todas.filter(e => 
            e.data_agendada === hoje && 
            e.status !== 'Entregue' && 
            e.status !== 'Cancelada'
        ).sort((a, b) => (a.ordem_rota || 99) - (b.ordem_rota || 99));
    },
    refetchInterval: 10000 
  });

  const updateEntrega = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Entrega.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['entregas-rota'] })
  });

  const updatePosicao = useMutation({
    mutationFn: (coords) => {
        if (!caminhaoId) return;
        return base44.entities.Caminhao.update(caminhaoId, {
            latitude: coords.latitude,
            longitude: coords.longitude,
            ultima_atualizacao: new Date().toISOString(),
            status_rota: 'Em Trânsito'
        });
    }
  });

  // --- RASTREAMENTO EM TEMPO REAL ---
  const iniciarRastreamento = () => {
    if (!navigator.geolocation) return alert("GPS não suportado.");

    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        updatePosicao.mutate({ latitude, longitude });
        console.log("📍 Localização atualizada:", latitude, longitude);
      },
      (error) => console.error("Erro GPS:", error),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  const iniciarRota = async () => {
    if (!confirm(`Iniciar rota com ${entregas.length} entregas? Os clientes serão avisados.`)) return;
    
    setEnviando(true);
    try {
        await fetch('http://localhost:3001/aviso-inicio-rota', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entregas })
        });
        
        setRotaIniciada(true);
        iniciarRastreamento(); // <--- LIGA O GPS
        alert("Rota iniciada! Rastreamento ativado.");
    } catch (e) {
        alert("Erro ao conectar.");
    } finally {
        setEnviando(false);
    }
  };

  const avisarProximo = async (entrega) => {
    setEnviando(true);
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const linkMaps = `https://www.google.com/maps?q=${lat},${lng}`;

            try {
                await fetch('http://localhost:3001/aviso-proxima-parada', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        telefone: entrega.cliente_telefone,
                        nome: entrega.cliente_nome,
                        linkLocalizacao: linkMaps
                    })
                });
                alert(`Cliente avisado!`);
            } catch (e) { alert("Erro ao enviar."); } 
            finally { setEnviando(false); }
        });
    }
  };

  const finalizarEntrega = (entrega) => {
      if(confirm("Confirmar entrega realizada?")) {
          updateEntrega.mutate({
              id: entrega.id,
              data: { status: 'Entregue', data_realizada: new Date().toISOString() }
          });
      }
  };

  return (
    <div className="max-w-md mx-auto p-4 space-y-6 pb-24 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sticky top-4 z-10">
        <div className="flex justify-between items-center mb-4">
            <div>
                <h1 className="text-xl font-bold text-gray-900">Modo Entrega</h1>
                <p className="text-sm text-gray-500">
                    {rotaIniciada ? '📡 Rastreamento Ativo' : 'Aguardando início'}
                </p>
            </div>
            <div className={`p-3 rounded-full ${rotaIniciada ? 'bg-green-100 text-green-700 animate-pulse' : 'bg-gray-100 text-gray-500'}`}>
                {rotaIniciada ? <Radio className="w-6 h-6" /> : <Truck className="w-6 h-6" />}
            </div>
        </div>

        {!rotaIniciada ? (
            <Button 
                onClick={iniciarRota} 
                disabled={enviando || entregas.length === 0}
                className="w-full h-12 text-lg font-bold bg-blue-600 hover:bg-blue-700"
            >
                <Navigation className="w-5 h-5 mr-2" /> INICIAR ROTA
            </Button>
        ) : (
            <div className="flex items-center justify-center gap-2 p-2 bg-green-50 text-green-800 rounded border border-green-200 text-sm font-medium">
                <span className="w-2 h-2 bg-green-600 rounded-full animate-ping"/>
                Enviando localização em tempo real
            </div>
        )}
      </div>

      <div className="space-y-4">
        {entregas.map((entrega, index) => (
            <Card key={entrega.id} className={`border-0 shadow-sm ${index === 0 ? 'ring-2 ring-blue-500' : 'opacity-90'}`}>
                {index === 0 && (
                    <div className="bg-blue-600 text-white text-[10px] font-bold px-3 py-1 text-center">
                        PRÓXIMA PARADA
                    </div>
                )}
                <CardContent className="p-5">
                    <div className="flex justify-between mb-2">
                        <Badge variant="outline">#{index + 1}</Badge>
                        <span className="font-bold">#{entrega.numero_pedido}</span>
                    </div>
                    <h3 className="font-bold mb-1">{entrega.cliente_nome}</h3>
                    <div className="flex items-start gap-2 text-gray-600 mb-4 text-sm">
                        <MapPin className="w-4 h-4 mt-0.5 text-red-500 flex-shrink-0" />
                        <p>{entrega.endereco_entrega}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => avisarProximo(entrega)}
                            disabled={enviando}
                        >
                            <Send className="w-4 h-4 mr-2" /> Avisar
                        </Button>
                        <Button 
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => finalizarEntrega(entrega)}
                        >
                            <CheckCircle className="w-4 h-4 mr-2" /> Entregue
                        </Button>
                    </div>
                </CardContent>
            </Card>
        ))}
        {entregas.length === 0 && (
            <div className="text-center py-10 text-gray-400">
                <CheckCircle className="w-16 h-16 mx-auto mb-3 opacity-20" />
                <p>Todas as entregas concluídas!</p>
            </div>
        )}
      </div>
    </div>
  );
}