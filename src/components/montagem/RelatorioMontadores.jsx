import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, Users, Calendar } from "lucide-react";

export default function RelatorioMontadores({ montagens }) {
  const [mesAno, setMesAno] = useState(new Date().toISOString().slice(0, 7));

  const dadosPorMontador = useMemo(() => {
    const montagensMes = montagens.filter(m => 
      m.data_montagem?.slice(0, 7) === mesAno &&
      m.status === 'Concluída'
    );

    const montadores = ['Carlos', 'Luis', 'Guilherme'];
    
    return montadores.map(montador => {
      const montagensMontador = montagensMes.filter(m => m.montador === montador);
      const total = montagensMontador.reduce((sum, m) => sum + (m.valor_total_montagem || 0), 0);
      
      return {
        montador,
        quantidade: montagensMontador.length,
        total,
        montagens: montagensMontador
      };
    });
  }, [montagens, mesAno]);

  const totalGeral = dadosPorMontador.reduce((sum, d) => sum + d.total, 0);
  const totalMontagens = dadosPorMontador.reduce((sum, d) => sum + d.quantidade, 0);

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Fechamento de Montadores
            </CardTitle>
            <div className="w-48">
              <Label htmlFor="mes">Mês/Ano</Label>
              <Input
                id="mes"
                type="month"
                value={mesAno}
                onChange={(e) => setMesAno(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 rounded-lg text-center" style={{ backgroundColor: '#f0f9ff' }}>
              <DollarSign className="w-8 h-8 mx-auto mb-2" style={{ color: '#07593f' }} />
              <p className="text-sm mb-1" style={{ color: '#8B8B8B' }}>Total a Pagar</p>
              <p className="text-2xl font-bold" style={{ color: '#07593f' }}>
                R$ {totalGeral.toFixed(2)}
              </p>
            </div>
            <div className="p-4 rounded-lg text-center" style={{ backgroundColor: '#FEF3C7' }}>
              <Calendar className="w-8 h-8 mx-auto mb-2" style={{ color: '#f38a4c' }} />
              <p className="text-sm mb-1" style={{ color: '#8B8B8B' }}>Montagens Realizadas</p>
              <p className="text-2xl font-bold" style={{ color: '#f38a4c' }}>
                {totalMontagens}
              </p>
            </div>
            <div className="p-4 rounded-lg text-center" style={{ backgroundColor: '#D1FAE5' }}>
              <TrendingUp className="w-8 h-8 mx-auto mb-2" style={{ color: '#059669' }} />
              <p className="text-sm mb-1" style={{ color: '#8B8B8B' }}>Ticket Médio</p>
              <p className="text-2xl font-bold" style={{ color: '#059669' }}>
                R$ {totalMontagens > 0 ? (totalGeral / totalMontagens).toFixed(2) : '0.00'}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {dadosPorMontador.map((dados) => (
              <Card key={dados.montador} className="border-2" style={{ borderColor: '#E5E0D8' }}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-12 h-12 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: '#07593f', color: 'white' }}
                      >
                        <Users className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold" style={{ color: '#07593f' }}>
                          {dados.montador}
                        </h3>
                        <p className="text-sm" style={{ color: '#8B8B8B' }}>
                          {dados.quantidade} montagem(ns) realizada(s)
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm mb-1" style={{ color: '#8B8B8B' }}>Total a Receber</p>
                      <p className="text-2xl font-bold" style={{ color: '#07593f' }}>
                        R$ {dados.total.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {dados.montagens.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold mb-2" style={{ color: '#8B8B8B' }}>
                        Detalhamento:
                      </p>
                      {dados.montagens.map((m, idx) => (
                        <div 
                          key={idx} 
                          className="flex items-center justify-between p-3 rounded-lg"
                          style={{ backgroundColor: '#FAF8F5' }}
                        >
                          <div>
                            <p className="font-semibold" style={{ color: '#07593f' }}>
                              Pedido #{m.numero_pedido} - {m.cliente_nome}
                            </p>
                            <p className="text-sm" style={{ color: '#8B8B8B' }}>
                              {new Date(m.data_montagem).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                          <Badge style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}>
                            R$ {m.valor_total_montagem?.toFixed(2)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {totalMontagens === 0 && (
            <div className="text-center py-12" style={{ color: '#8B8B8B' }}>
              <Calendar className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p className="text-xl">Nenhuma montagem concluída neste período</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}