import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Search, Warehouse, AlertTriangle, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Estoque() {
  const [searchTerm, setSearchTerm] = useState("");
  const [user, setUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  const { data: produtos, isLoading } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => base44.entities.Produto.list('nome'),
    initialData: [],
  });

  const { data: fornecedores } = useQuery({
    queryKey: ['fornecedores'],
    queryFn: () => base44.entities.Fornecedor.list(),
    initialData: [],
  });

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#07593f' }} />
      </div>
    );
  }

  const isWarehouse = user.cargo === 'Estoque';
  const isAdmin = user.cargo === 'Administrador';
  const isManager = user.cargo === 'Gerente';

  const filteredProdutos = produtos.filter(produto =>
    produto.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    produto.categoria?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    produto.fornecedor_nome?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const produtosEstoqueBaixo = filteredProdutos.filter(
    p => p.quantidade_estoque <= p.estoque_minimo && p.ativo
  );

  const produtosComReserva = filteredProdutos.filter(
    p => (p.quantidade_reservada || 0) > 0
  );

  const estoqueTotal = filteredProdutos.reduce((sum, p) => sum + (p.quantidade_estoque || 0), 0);
  const estoqueReservado = filteredProdutos.reduce((sum, p) => sum + (p.quantidade_reservada || 0), 0);
  const estoqueDisponivel = estoqueTotal - estoqueReservado;

  const getEstoqueStatus = (produto) => {
    const disponivel = (produto.quantidade_estoque || 0) - (produto.quantidade_reservada || 0);
    
    if (disponivel <= 0) {
      return { label: 'Esgotado', color: 'bg-red-100 text-red-800' };
    } else if (produto.quantidade_estoque <= produto.estoque_minimo) {
      return { label: 'Baixo', color: 'bg-yellow-100 text-yellow-800' };
    } else if ((produto.quantidade_reservada || 0) > 0) {
      return { label: 'Com Reserva', color: 'bg-blue-100 text-blue-800' };
    } else {
      return { label: 'Normal', color: 'bg-green-100 text-green-800' };
    }
  };

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Warehouse className="w-8 h-8" style={{ color: '#07593f' }} />
            <h1 className="text-3xl md:text-4xl font-bold" style={{ color: '#07593f' }}>
              Controle de Estoque
            </h1>
          </div>
          <p style={{ color: '#8B8B8B' }}>
            Visualização de produtos em estoque e suas movimentações
          </p>
        </div>

        {produtosEstoqueBaixo.length > 0 && (
          <Alert className="mb-6 border-2 border-yellow-200 bg-yellow-50">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              <strong>{produtosEstoqueBaixo.length} produto(s)</strong> com estoque baixo precisam de reposição!
            </AlertDescription>
          </Alert>
        )}

        <div className="grid md:grid-cols-3 gap-6 mb-6">
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium" style={{ color: '#8B8B8B' }}>
                Estoque Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Package className="w-8 h-8" style={{ color: '#07593f' }} />
                <div>
                  <p className="text-2xl font-bold" style={{ color: '#07593f' }}>
                    {estoqueTotal}
                  </p>
                  <p className="text-xs" style={{ color: '#8B8B8B' }}>
                    unidades
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium" style={{ color: '#8B8B8B' }}>
                Disponível
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Package className="w-8 h-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold text-green-600">
                    {estoqueDisponivel}
                  </p>
                  <p className="text-xs" style={{ color: '#8B8B8B' }}>
                    unidades livres
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium" style={{ color: '#8B8B8B' }}>
                Reservado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Package className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold text-blue-600">
                    {estoqueReservado}
                  </p>
                  <p className="text-xs" style={{ color: '#8B8B8B' }}>
                    aguardando pagamento
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-0 shadow-lg mb-6">
          <CardContent className="p-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: '#8B8B8B' }} />
              <Input
                placeholder="Buscar produto, categoria ou fornecedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-12 border-2"
                style={{ borderColor: '#E5E0D8' }}
              />
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: '#07593f' }} />
          </div>
        ) : (
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>
                Produtos em Estoque ({filteredProdutos.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-center">Total</TableHead>
                      <TableHead className="text-center">Reservado</TableHead>
                      <TableHead className="text-center">Disponível</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      {(isAdmin || isManager || isWarehouse) && (
                        <TableHead className="text-right">Preço Venda</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProdutos.map((produto) => {
                      const disponivel = (produto.quantidade_estoque || 0) - (produto.quantidade_reservada || 0);
                      const status = getEstoqueStatus(produto);
                      
                      return (
                        <TableRow key={produto.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium" style={{ color: '#07593f' }}>
                                {produto.nome}
                              </p>
                              {produto.codigo_barras && (
                                <p className="text-xs" style={{ color: '#8B8B8B' }}>
                                  Cód: {produto.codigo_barras}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm" style={{ color: '#8B8B8B' }}>
                              {produto.fornecedor_nome || '-'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {produto.categoria}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center font-semibold">
                            {produto.quantidade_estoque || 0}
                          </TableCell>
                          <TableCell className="text-center">
                            {(produto.quantidade_reservada || 0) > 0 ? (
                              <span className="text-blue-600 font-semibold">
                                {produto.quantidade_reservada}
                              </span>
                            ) : (
                              <span style={{ color: '#8B8B8B' }}>-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={disponivel <= 0 ? 'text-red-600 font-bold' : 'font-semibold'}>
                              {disponivel}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={status.color}>
                              {status.label}
                            </Badge>
                          </TableCell>
                          {(isAdmin || isManager || isWarehouse) && (
                            <TableCell className="text-right font-semibold" style={{ color: '#07593f' }}>
                              R$ {produto.preco_venda?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {filteredProdutos.length === 0 && !isLoading && (
          <div className="text-center py-16">
            <Warehouse className="w-16 h-16 mx-auto mb-4 opacity-20" style={{ color: '#07593f' }} />
            <p className="text-xl" style={{ color: '#8B8B8B' }}>
              Nenhum produto encontrado
            </p>
          </div>
        )}

        <Card className="border-0 shadow-lg mt-6" style={{ background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)' }}>
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#07593f' }}>
                <Package className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold mb-2" style={{ color: '#07593f' }}>
                  💡 Sobre o Controle de Estoque
                </h3>
                <ul className="text-sm space-y-1" style={{ color: '#8B8B8B' }}>
                  <li>• <strong>Total:</strong> Quantidade total em estoque</li>
                  <li>• <strong>Reservado:</strong> Produtos em vendas com pagamento pendente</li>
                  <li>• <strong>Disponível:</strong> Produtos livres para novas vendas</li>
                  <li>• O estoque é atualizado automaticamente nas vendas</li>
                  {(isAdmin || isManager || isWarehouse) && (
                    <li>• Para adicionar produtos, use a aba "Movimentação de Estoque"</li>
                  )}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}