import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Truck, MapPin, Navigation } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export default function RastreadorFrota() {
  const { data: caminhoesAtivos = [] } = useQuery({
    queryKey: ['caminhoes-ativos'],
    queryFn: async () => {
      const todos = await base44.entities.Caminhao.list();
      return todos.filter(c => c.ativo);
    },
    refetchInterval: 5000
  });

  const verNoMapa = (lat, lng) => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
  };

  const getStatusTempo = (dataAtualizacao) => {
    if (!dataAtualizacao) return { texto: 'Sem sinal', cor: 'text-gray-400', bg: 'bg-gray-100' };
    
    const diff = (new Date() - new Date(dataAtualizacao)) / 1000 / 60;
    if (diff < 2) return { texto: 'Agora', cor: 'text-green-600', bg: 'bg-green-100' };
    if (diff < 10) return { texto: `${Math.floor(diff)} min atrás`, cor: 'text-yellow-600', bg: 'bg-yellow-100' };
    return { texto: 'Offline', cor: 'text-red-600', bg: 'bg-red-100' };
  };

  return (
    <Card className="border-0 shadow-lg h-full flex flex-col">
      <CardHeader className="border-b bg-gray-50/50 dark:bg-neutral-900 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Navigation className="w-5 h-5 text-blue-600" />
            Rastreamento da Frota
          </CardTitle>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400">
            {caminhoesAtivos.length} veículos
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="p-0 flex-1 overflow-y-auto">
        {caminhoesAtivos.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <Truck className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>Nenhum veículo ativo no momento</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-neutral-800">
            {caminhoesAtivos.map(caminhao => {
              const status = getStatusTempo(caminhao.ultima_atualizacao);
              
              return (
                <div key={caminhao.id} className="p-4 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${status.bg}`}>
                        <Truck className={`w-5 h-5 ${status.cor}`} />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 dark:text-white">{caminhao.nome}</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{caminhao.motorista_padrao}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={`${status.bg} ${status.cor} border-0`}>
                      {status.texto}
                    </Badge>
                  </div>
                  
                  {caminhao.latitude && caminhao.longitude ? (
                    <div className="pl-11">
                      <div className="flex items-center gap-2 mb-3">
                        <MapPin className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                          {caminhao.latitude.toFixed(5)}, {caminhao.longitude.toFixed(5)}
                        </span>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="w-full h-8 text-xs border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/20"
                        onClick={() => verNoMapa(caminhao.latitude, caminhao.longitude)}
                      >
                        Ver Localização no Mapa
                      </Button>
                    </div>
                  ) : (
                    <div className="pl-11 text-xs text-gray-400 italic">
                      Aguardando sinal de GPS...
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}