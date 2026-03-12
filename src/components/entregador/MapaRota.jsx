import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8ZyBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiPgogICAgPHJlY3QgeD0iNSIgeT0iMTUiIHdpZHRoPSIyMCIgaGVpZ2h0PSIxNSIgcng9IjIiIGZpbGw9IiNmOTczMTYiLz4KICAgIDxwYXRoIGQ9Ik0yNSAyMEgzMkwzNSAzMFgyNUgyMFoiIGZpbGw9IiMyMmM1NWUiLz4KICAgIDxjaXJjbGUgY3g9IjEwIiBjeT0iMzAiIHI9IjMiIGZpbGw9IiMzMzMiLz4KICAgIDxjaXJjbGUgY3g9IjI4IiBjeT0iMzAiIHI9IjMiIGZpbGw9IiMzMzMiLz4KICA8L2c+Cjwvc3ZnPg==',
  iconSize: [40, 40],
  iconAnchor: [20, 20]
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
  const [coordsGeocodificadas, setCoordsGeocodificadas] = useState({});

  // Função auxiliar para extrair coordenadas (Banco -> JSONB -> Cache)
  const getCoords = (ent) => {
    if (ent.latitude && ent.longitude) return { lat: Number(ent.latitude), lng: Number(ent.longitude) };

    const geo = ent.geolocalizacao_entrega;
    if (geo) {
      if (geo.lat && geo.lng) return { lat: Number(geo.lat), lng: Number(geo.lng) };
      if (geo.latitude && geo.longitude) return { lat: Number(geo.latitude), lng: Number(geo.longitude) };
    }

    // Tenta pegar do cache de geocodificação
    if (ent.endereco_entrega && coordsGeocodificadas[ent.endereco_entrega]) {
      return coordsGeocodificadas[ent.endereco_entrega];
    }

    return null;
  };

  // Geocodificação Automática de endereços sem coordenadas
  useEffect(() => {
    const geocodificar = async () => {
      const novosCoords = { ...coordsGeocodificadas };
      let mudou = false;

      for (const ent of entregas) {
        const enderecoLimpo = ent.endereco_entrega?.split(',')[0].trim();
        if (!getCoords(ent) && enderecoLimpo) {
          try {
            // Tenta logradouro + Petrópolis
            const query = encodeURIComponent(`${enderecoLimpo}, Petrópolis, RJ, Brasil`);
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`);
            let data = await res.json();

            // Fallback: Tenta sem o número se falhar ou apenas o bairro
            if ((!data || data.length === 0) && ent.endereco_entrega.includes('-')) {
              const bairro = ent.endereco_entrega.split('-').pop().trim();
              const queryBairro = encodeURIComponent(`${bairro}, Petrópolis, RJ`);
              const resB = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${queryBairro}&limit=1`);
              data = await resB.json();
            }

            if (data && data.length > 0) {
              novosCoords[ent.endereco_entrega] = {
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lon)
              };
              mudou = true;
            }
          } catch (e) {
            console.error("Erro Geocoder:", e);
          }
        }
      }

      if (mudou) setCoordsGeocodificadas(novosCoords);
    };

    if (entregas?.length > 0) geocodificar();
  }, [entregas]);

  // Atualiza a Rota Visual (apenas pontos reais/localizados)
  useEffect(() => {
    if (localizacaoAtual) {
      const pontos = [
        localizacaoAtual,
        ...entregas
          .map(e => {
            const c = getCoords(e);
            return c ? { ...c, id: e.id } : null;
          })
          .filter(Boolean)
      ];
      setRotaOtimizada(pontos);
    }
  }, [entregas, localizacaoAtual, coordsGeocodificadas]);

  const coordsDestino = entregaAtual ? getCoords(entregaAtual) : null;

  // Condição de renderização: precisa de PELO MENOS motorista OU destino
  if (!localizacaoAtual && !coordsDestino) {
    return (
      <Card className="p-10 text-center border-none shadow-none bg-transparent">
        <MapPin className="w-16 h-16 mx-auto text-orange-200 mb-4 animate-bounce" />
        <p className="text-gray-500 font-medium italic animate-pulse">Aguardando sinal de GPS...</p>
      </Card>
    );
  }

  const center = coordsDestino
    ? [coordsDestino.lat, coordsDestino.lng]
    : [localizacaoAtual.lat, localizacaoAtual.lng];

  return (
    <div className="h-full w-full rounded-2xl overflow-hidden shadow-2xl border border-white/20 bg-gray-100 ring-1 ring-black/5">
      <MapContainer
        center={center}
        zoom={14}
        scrollWheelZoom={false}
        className="h-full w-full z-0"
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />

        {/* Motorista (Apenas se tiver sinal) */}
        {localizacaoAtual && (
          <Marker position={[localizacaoAtual.lat, localizacaoAtual.lng]} icon={iconAtual}>
            <Popup className="custom-popup">
              <div className="p-2">
                <p className="font-bold text-blue-600 flex items-center gap-1.5">
                  <Navigation className="w-4 h-4 fill-current" /> Motorista
                </p>
                <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-tighter">Posição em tempo real</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Destinos */}
        {entregas.map((entrega) => {
          const c = getCoords(entrega);
          if (!c) return null;

          const isProxima = entregaAtual?.id === entrega.id;

          return (
            <Marker
              key={entrega.id}
              position={[c.lat, c.lng]}
              icon={isProxima ? iconProximo : iconOutros}
            >
              <Popup>
                <div className="text-xs p-1 min-w-[140px]">
                  <div className="flex justify-between items-center mb-1.5 border-b pb-1">
                    <span className="font-black text-gray-900 uppercase">PEDIDO {entrega.numero_pedido}</span>
                    {isProxima && <Badge className="text-[9px] bg-green-100 text-green-700 border-green-200">DESTINO</Badge>}
                  </div>
                  <p className="text-gray-700 font-bold mb-0.5">{entrega.cliente_nome}</p>
                  <p className="text-gray-500 text-[10px] leading-tight line-clamp-2 italic">{entrega.endereco_entrega}</p>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Traçado da Rota */}
        {rotaOtimizada.length > 1 && (
          <Polyline
            positions={rotaOtimizada.map(p => [p.lat, p.lng])}
            color="#10b981"
            weight={6}
            opacity={0.4}
            dashArray="1, 15"
            lineCap="round"
          />
        )}
      </MapContainer>
    </div>
  );
}
