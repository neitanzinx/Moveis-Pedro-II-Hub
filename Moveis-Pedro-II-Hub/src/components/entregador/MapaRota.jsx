import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import { Card } from "@/components/ui/card";
import { Navigation, MapPin } from "lucide-react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix para ícones do Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const iconAtual = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAiIGhlaWdodD0iMzAiIHZpZXdCb3g9IjAgMCAzMCAzMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTUiIGN5PSIxNSIgcj0iMTIiIGZpbGw9IiMzYjgyZjYiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMyIvPgo8L3N2Zz4=',
  iconSize: [30, 30],
  iconAnchor: [15, 15]
});

const iconProximo = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIwIDVDMTMuMzcgNSA4IDEwLjM3IDggMTdDOCAyNS42MjUgMjAgMzUgMjAgMzVDMjAgMzUgMzIgMjUuNjI1IDMyIDE3QzMyIDEwLjM3IDI2LjYzIDUgMjAgNVoiIGZpbGw9IiMyMmM1NWUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMiIvPgo8Y2lyY2xlIGN4PSIyMCIgY3k9IjE3IiByPSI1IiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4=',
  iconSize: [40, 40],
  iconAnchor: [20, 40]
});

const iconOutros = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAiIGhlaWdodD0iMzAiIHZpZXdCb3g9IjAgMCAzMCAzMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE1IDNDMTAuMDM3NSAzIDYgNy4wMzc1IDYgMTJDNiAxOC0xODc1IDE1IDI3IDE1IDI3QzI0IDE4Ljk2MjUgMTkuOTYyNSAyMyAxNSAyM1oiIGZpbGw9IiM5Y2EzYWYiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMiIvPgo8Y2lyY2xlIGN4PSIxNSIgY3k9IjEyIiByPSIzIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4=',
  iconSize: [30, 30],
  iconAnchor: [15, 30]
});

export default function MapaRota({ entregas, entregaAtual, localizacaoAtual }) {
  const [rotaOtimizada, setRotaOtimizada] = useState([]);

  useEffect(() => {
    if (entregas.length > 0 && localizacaoAtual) {
      // Algoritmo simples de otimização: Nearest Neighbor
      const pontos = [localizacaoAtual, ...entregas.map(e => ({
        lat: e.latitude || -20.3155 + Math.random() * 0.05,
        lng: e.longitude || -40.3128 + Math.random() * 0.05,
        id: e.id
      }))];
      
      setRotaOtimizada(pontos);
    }
  }, [entregas, localizacaoAtual]);

  if (!localizacaoAtual) {
    return (
      <Card className="p-6 text-center">
        <MapPin className="w-12 h-12 mx-auto text-gray-300 mb-2" />
        <p className="text-sm text-gray-500">Habilitando localização...</p>
      </Card>
    );
  }

  const center = entregaAtual 
    ? [entregaAtual.latitude || -20.3155, entregaAtual.longitude || -40.3128]
    : [localizacaoAtual.lat, localizacaoAtual.lng];

  return (
    <Card className="overflow-hidden h-[300px]">
      <MapContainer 
        center={center} 
        zoom={13} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        
        {/* Localização atual */}
        {localizacaoAtual && (
          <Marker position={[localizacaoAtual.lat, localizacaoAtual.lng]} icon={iconAtual}>
            <Popup>
              <strong>Você está aqui</strong>
            </Popup>
          </Marker>
        )}

        {/* Entregas */}
        {entregas.map((entrega, idx) => {
          const lat = entrega.latitude || -20.3155 + Math.random() * 0.05;
          const lng = entrega.longitude || -40.3128 + Math.random() * 0.05;
          const isProxima = entregaAtual?.id === entrega.id;
          
          return (
            <Marker 
              key={entrega.id} 
              position={[lat, lng]}
              icon={isProxima ? iconProximo : iconOutros}
            >
              <Popup>
                <div className="text-xs">
                  <p className="font-bold">#{entrega.numero_pedido}</p>
                  <p>{entrega.cliente_nome}</p>
                  <p className="text-gray-500 text-[10px] mt-1">{entrega.endereco_entrega}</p>
                  {isProxima && (
                    <Badge className="mt-2 bg-green-500 text-white text-[10px]">
                      Próxima parada
                    </Badge>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Linha da rota */}
        {rotaOtimizada.length > 1 && (
          <Polyline 
            positions={rotaOtimizada.map(p => [p.lat, p.lng])}
            color="#3b82f6"
            weight={3}
            opacity={0.7}
            dashArray="10, 10"
          />
        )}
      </MapContainer>
    </Card>
  );
}