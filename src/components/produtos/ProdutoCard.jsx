import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Package, AlertTriangle } from "lucide-react";

export default function ProdutoCard({ produto, onEdit, onDelete }) {
  const isEstoqueBaixo = produto.quantidade_estoque <= (produto.estoque_minimo || 5);
  const imagemPrincipal = produto.fotos?.[0] || 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400';

  return (
    <Card className="group hover:shadow-xl transition-all duration-300 border-0 overflow-hidden">
      <div className="relative h-48 overflow-hidden bg-gray-100">
        <img
          src={imagemPrincipal}
          alt={produto.nome}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          onError={(e) => {
            e.target.src = 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400';
          }}
        />
        {isEstoqueBaixo && (
          <div className="absolute top-3 left-3">
            <Badge className="bg-amber-500 text-white border-0 shadow-lg">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Estoque Baixo
            </Badge>
          </div>
        )}
        {!produto.ativo && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Badge variant="outline" className="bg-white text-gray-900">
              Inativo
            </Badge>
          </div>
        )}
      </div>
      
      <CardContent className="p-4">
        <div className="mb-3">
          <h3 className="font-bold text-lg mb-1 line-clamp-1" style={{ color: 'var(--charcoal)' }}>
            {produto.nome}
          </h3>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline" style={{ borderColor: 'var(--emerald)', color: 'var(--emerald)' }}>
              {produto.categoria}
            </Badge>
            {produto.ambiente && (
              <Badge variant="outline" style={{ color: '#8B8B8B' }}>
                {produto.ambiente}
              </Badge>
            )}
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-sm" style={{ color: '#8B8B8B' }}>Preço de venda</span>
            <span className="font-bold text-lg" style={{ color: 'var(--emerald)' }}>
              R$ {produto.preco_venda?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm" style={{ color: '#8B8B8B' }}>Estoque</span>
            <span className={`font-semibold ${isEstoqueBaixo ? 'text-amber-600' : ''}`}>
              {produto.quantidade_estoque} un.
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(produto)}
            className="flex-1"
          >
            <Pencil className="w-4 h-4 mr-1" />
            Editar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(produto.id)}
            className="text-red-600 hover:text-red-700 hover:border-red-600"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}