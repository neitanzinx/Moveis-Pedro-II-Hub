
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Package } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function EstoqueBaixo({ produtos }) {
  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg" style={{ backgroundColor: '#f38a4c', opacity: 0.1 }}>
              <AlertTriangle className="w-5 h-5" style={{ color: '#f38a4c' }} />
            </div>
            <CardTitle style={{ color: '#07593f' }}>Estoque Baixo</CardTitle>
          </div>
          <Badge variant="outline" style={{ borderColor: '#f38a4c', color: '#f38a4c' }}>
            {produtos.length} itens
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {produtos.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 mx-auto mb-4 opacity-20" style={{ color: '#07593f' }} />
            <p style={{ color: '#8B8B8B' }}>Nenhum produto com estoque baixo</p>
          </div>
        ) : (
          <div className="space-y-3">
            {produtos.slice(0, 5).map((produto) => (
              <Link 
                key={produto.id}
                to={createPageUrl("Produtos")}
                className="flex items-center justify-between p-4 rounded-xl hover:shadow-md transition-all border"
                style={{ borderColor: '#E5E0D8', backgroundColor: 'white' }}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: '#f38a4c', opacity: 0.2 }}>
                    <Package className="w-4 h-4" style={{ color: '#07593f' }} />
                  </div>
                  <div>
                    <p className="font-medium" style={{ color: '#07593f' }}>{produto.nome}</p>
                    <p className="text-sm" style={{ color: '#8B8B8B' }}>{produto.categoria}</p>
                  </div>
                </div>
                <Badge 
                  variant="outline" 
                  className="font-semibold"
                  style={{ 
                    borderColor: produto.quantidade_estoque === 0 ? '#EF4444' : '#f38a4c',
                    color: produto.quantidade_estoque === 0 ? '#EF4444' : '#f38a4c'
                  }}
                >
                  {produto.quantidade_estoque} un.
                </Badge>
              </Link>
            ))}
            {produtos.length > 5 && (
              <Link to={createPageUrl("Produtos")}>
                <p className="text-center text-sm pt-2 hover:underline" style={{ color: '#07593f' }}>
                  Ver todos os {produtos.length} produtos
                </p>
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
