import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, AlertTriangle } from "lucide-react";

export default function ProdutoListItem({ produto, onEdit, onDelete }) {
  const isEstoqueBaixo = produto.quantidade_estoque <= (produto.estoque_minimo || 5);

  return (
    <div 
      className="flex items-center gap-4 p-4 rounded-xl hover:shadow-md transition-all border bg-white"
      style={{ borderColor: '#E5E0D8' }}
    >
      <img
        src={produto.fotos?.[0] || 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=200'}
        alt={produto.nome}
        className="w-20 h-20 object-cover rounded-lg"
        onError={(e) => {
          e.target.src = 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=200';
        }}
      />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 mb-2">
          <h3 className="font-bold text-lg" style={{ color: 'var(--charcoal)' }}>
            {produto.nome}
          </h3>
          {isEstoqueBaixo && (
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          )}
        </div>
        <div className="flex gap-2 flex-wrap mb-2">
          <Badge variant="outline" style={{ borderColor: 'var(--emerald)', color: 'var(--emerald)' }}>
            {produto.categoria}
          </Badge>
          {produto.ambiente && (
            <Badge variant="outline" style={{ color: '#8B8B8B' }}>
              {produto.ambiente}
            </Badge>
          )}
          <Badge variant="outline" className={isEstoqueBaixo ? 'border-amber-500 text-amber-600' : ''}>
            Estoque: {produto.quantidade_estoque} un.
          </Badge>
        </div>
      </div>

      <div className="text-right mr-4">
        <p className="text-sm mb-1" style={{ color: '#8B8B8B' }}>Preço</p>
        <p className="font-bold text-xl" style={{ color: 'var(--emerald)' }}>
          R$ {produto.preco_venda?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onEdit(produto)}
        >
          <Pencil className="w-4 h-4" />
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
    </div>
  );
}