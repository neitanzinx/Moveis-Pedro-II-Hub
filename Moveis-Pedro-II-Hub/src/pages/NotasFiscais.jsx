import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Search, Copy, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function NotasFiscais() {
  const [user, setUser] = useState(null);
  const [busca, setBusca] = useState("");
  const [copiado, setCopiado] = useState(null);

  useEffect(() => {
    let mounted = true;
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        if (mounted) setUser(currentUser);
      } catch (error) {
        console.error("Erro:", error);
      }
    };
    loadUser();
    return () => { mounted = false; };
  }, []);

  const { data: vendas } = useQuery({
    queryKey: ['vendas'],
    queryFn: () => base44.entities.Venda.list('-data_venda'),
    enabled: !!user,
  });

  const { data: clientes } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list(),
    enabled: !!user,
  });

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#07593f' }} />
      </div>
    );
  }

  const isAdmin = user.cargo === 'Administrador';
  const isManager = user.cargo === 'Gerente';
  const isFinanceiro = user.cargo === 'Financeiro';

  if (!isAdmin && !isManager && !isFinanceiro) {
    return (
      <div className="p-8">
        <Alert className="border-2 border-red-200 bg-red-50">
          <AlertDescription className="text-red-600">
            Apenas administradores, gerentes e financeiro podem acessar esta área.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const vendasFiltradas = (vendas || []).filter(v =>
    v.numero_pedido?.includes(busca) ||
    v.cliente_nome?.toLowerCase().includes(busca.toLowerCase())
  );

  const copiarTexto = (texto, campo) => {
    navigator.clipboard.writeText(texto);
    setCopiado(campo);
    setTimeout(() => setCopiado(null), 2000);
  };

  const formatarCPFCNPJ = (texto) => {
    if (!texto) return '-';
    const numeros = texto.replace(/\D/g, '');
    if (numeros.length === 11) {
      return numeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } else if (numeros.length === 14) {
      return numeros.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return texto;
  };

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="w-8 h-8" style={{ color: '#07593f' }} />
            <h1 className="text-3xl md:text-4xl font-bold" style={{ color: '#07593f' }}>
              Dados para Nota Fiscal
            </h1>
          </div>
          <p style={{ color: '#8B8B8B' }}>
            Busque pedidos e copie os dados para emitir notas fiscais em sistema externo
          </p>
        </div>

        <Alert className="mb-6 border-2" style={{ borderColor: '#3b82f6', backgroundColor: '#eff6ff' }}>
          <AlertDescription className="text-blue-800">
            <strong>Como usar:</strong> Busque o pedido desejado e clique nos botões de copiar para usar os dados no sistema de emissão de notas fiscais.
          </AlertDescription>
        </Alert>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: '#8B8B8B' }} />
            <Input
              placeholder="Buscar por número do pedido ou cliente..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-10 h-12 border-2"
              style={{ borderColor: '#E5E0D8' }}
            />
          </div>
        </div>

        <div className="grid gap-4">
          {vendasFiltradas.map(venda => {
            const cliente = clientes.find(c => c.id === venda.cliente_id);

            return (
              <Card key={venda.id} className="border-0 shadow-lg">
                <CardHeader>
                  <div className="flex justify-between items-start flex-wrap gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2 mb-2">
                        <span style={{ color: '#07593f' }}>Pedido #{venda.numero_pedido}</span>
                        <Badge style={{
                          backgroundColor: venda.status === 'Pago' ? '#D1FAE5' :
                            venda.status === 'Pago & Retirado' ? '#DBEAFE' : '#FEF3C7',
                          color: venda.status === 'Pago' ? '#065f46' :
                            venda.status === 'Pago & Retirado' ? '#1E40AF' : '#92400E'
                        }}>
                          {venda.status}
                        </Badge>
                      </CardTitle>
                      <p className="text-sm" style={{ color: '#8B8B8B' }}>
                        Data: {new Date(venda.data_venda).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <p className="text-2xl font-bold" style={{ color: '#07593f' }}>
                      R$ {venda.valor_total?.toFixed(2)}
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Dados do Cliente */}
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: '#07593f' }}>
                      <span>📋 Dados do Cliente</span>
                    </h3>
                    <div className="grid md:grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg border" style={{ borderColor: '#E5E0D8', backgroundColor: '#FAF8F5' }}>
                        <div className="flex justify-between items-start mb-1">
                          <p className="text-xs font-semibold" style={{ color: '#8B8B8B' }}>Nome Completo</p>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2"
                            onClick={() => copiarTexto(venda.cliente_nome, `nome-${venda.id}`)}
                          >
                            {copiado === `nome-${venda.id}` ? (
                              <CheckCircle className="w-3 h-3 text-green-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </Button>
                        </div>
                        <p className="font-bold text-sm">{venda.cliente_nome || '-'}</p>
                      </div>

                      <div className="p-3 rounded-lg border" style={{ borderColor: '#E5E0D8', backgroundColor: '#FAF8F5' }}>
                        <div className="flex justify-between items-start mb-1">
                          <p className="text-xs font-semibold" style={{ color: '#8B8B8B' }}>CPF/CNPJ</p>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2"
                            onClick={() => copiarTexto(cliente?.cpf || cliente?.cnpj || '', `doc-${venda.id}`)}
                            disabled={!cliente?.cpf && !cliente?.cnpj}
                          >
                            {copiado === `doc-${venda.id}` ? (
                              <CheckCircle className="w-3 h-3 text-green-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </Button>
                        </div>
                        <p className="font-bold text-sm">{formatarCPFCNPJ(cliente?.cpf || cliente?.cnpj)}</p>
                      </div>

                      <div className="p-3 rounded-lg border" style={{ borderColor: '#E5E0D8', backgroundColor: '#FAF8F5' }}>
                        <div className="flex justify-between items-start mb-1">
                          <p className="text-xs font-semibold" style={{ color: '#8B8B8B' }}>Telefone</p>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2"
                            onClick={() => copiarTexto(venda.cliente_telefone || cliente?.telefone || '', `tel-${venda.id}`)}
                          >
                            {copiado === `tel-${venda.id}` ? (
                              <CheckCircle className="w-3 h-3 text-green-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </Button>
                        </div>
                        <p className="font-bold text-sm">{venda.cliente_telefone || cliente?.telefone || '-'}</p>
                      </div>

                      <div className="p-3 rounded-lg border" style={{ borderColor: '#E5E0D8', backgroundColor: '#FAF8F5' }}>
                        <div className="flex justify-between items-start mb-1">
                          <p className="text-xs font-semibold" style={{ color: '#8B8B8B' }}>E-mail</p>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2"
                            onClick={() => copiarTexto(cliente?.email || '', `email-${venda.id}`)}
                            disabled={!cliente?.email}
                          >
                            {copiado === `email-${venda.id}` ? (
                              <CheckCircle className="w-3 h-3 text-green-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </Button>
                        </div>
                        <p className="font-bold text-sm">{cliente?.email || '-'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Endereço */}
                  {cliente && (cliente.endereco || cliente.cep) && (
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: '#07593f' }}>
                        <span>📍 Endereço</span>
                      </h3>
                      <div className="grid md:grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg border" style={{ borderColor: '#E5E0D8', backgroundColor: '#FAF8F5' }}>
                          <div className="flex justify-between items-start mb-1">
                            <p className="text-xs font-semibold" style={{ color: '#8B8B8B' }}>CEP</p>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2"
                              onClick={() => copiarTexto(cliente.cep || '', `cep-${venda.id}`)}
                            >
                              {copiado === `cep-${venda.id}` ? (
                                <CheckCircle className="w-3 h-3 text-green-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </Button>
                          </div>
                          <p className="font-bold text-sm">{cliente.cep || '-'}</p>
                        </div>

                        <div className="p-3 rounded-lg border md:col-span-1" style={{ borderColor: '#E5E0D8', backgroundColor: '#FAF8F5' }}>
                          <div className="flex justify-between items-start mb-1">
                            <p className="text-xs font-semibold" style={{ color: '#8B8B8B' }}>Logradouro</p>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2"
                              onClick={() => copiarTexto(cliente.endereco || '', `end-${venda.id}`)}
                            >
                              {copiado === `end-${venda.id}` ? (
                                <CheckCircle className="w-3 h-3 text-green-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </Button>
                          </div>
                          <p className="font-bold text-sm">{cliente.endereco || '-'}</p>
                        </div>

                        <div className="p-3 rounded-lg border" style={{ borderColor: '#E5E0D8', backgroundColor: '#FAF8F5' }}>
                          <div className="flex justify-between items-start mb-1">
                            <p className="text-xs font-semibold" style={{ color: '#8B8B8B' }}>Número</p>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2"
                              onClick={() => copiarTexto(cliente.numero || '', `num-${venda.id}`)}
                            >
                              {copiado === `num-${venda.id}` ? (
                                <CheckCircle className="w-3 h-3 text-green-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </Button>
                          </div>
                          <p className="font-bold text-sm">{cliente.numero || '-'}</p>
                        </div>

                        <div className="p-3 rounded-lg border" style={{ borderColor: '#E5E0D8', backgroundColor: '#FAF8F5' }}>
                          <div className="flex justify-between items-start mb-1">
                            <p className="text-xs font-semibold" style={{ color: '#8B8B8B' }}>Complemento</p>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2"
                              onClick={() => copiarTexto(cliente.complemento || '', `comp-${venda.id}`)}
                            >
                              {copiado === `comp-${venda.id}` ? (
                                <CheckCircle className="w-3 h-3 text-green-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </Button>
                          </div>
                          <p className="font-bold text-sm">{cliente.complemento || '-'}</p>
                        </div>

                        <div className="p-3 rounded-lg border" style={{ borderColor: '#E5E0D8', backgroundColor: '#FAF8F5' }}>
                          <div className="flex justify-between items-start mb-1">
                            <p className="text-xs font-semibold" style={{ color: '#8B8B8B' }}>Bairro</p>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2"
                              onClick={() => copiarTexto(cliente.bairro || '', `bairro-${venda.id}`)}
                            >
                              {copiado === `bairro-${venda.id}` ? (
                                <CheckCircle className="w-3 h-3 text-green-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </Button>
                          </div>
                          <p className="font-bold text-sm">{cliente.bairro || '-'}</p>
                        </div>

                        <div className="p-3 rounded-lg border" style={{ borderColor: '#E5E0D8', backgroundColor: '#FAF8F5' }}>
                          <div className="flex justify-between items-start mb-1">
                            <p className="text-xs font-semibold" style={{ color: '#8B8B8B' }}>Cidade</p>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2"
                              onClick={() => copiarTexto(cliente.cidade || '', `cidade-${venda.id}`)}
                            >
                              {copiado === `cidade-${venda.id}` ? (
                                <CheckCircle className="w-3 h-3 text-green-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </Button>
                          </div>
                          <p className="font-bold text-sm">{cliente.cidade || '-'}</p>
                        </div>

                        <div className="p-3 rounded-lg border" style={{ borderColor: '#E5E0D8', backgroundColor: '#FAF8F5' }}>
                          <div className="flex justify-between items-start mb-1">
                            <p className="text-xs font-semibold" style={{ color: '#8B8B8B' }}>Estado (UF)</p>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2"
                              onClick={() => copiarTexto(cliente.estado || '', `estado-${venda.id}`)}
                            >
                              {copiado === `estado-${venda.id}` ? (
                                <CheckCircle className="w-3 h-3 text-green-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </Button>
                          </div>
                          <p className="font-bold text-sm">{cliente.estado || '-'}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Itens da Venda */}
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: '#07593f' }}>
                      <span>📦 Itens do Pedido</span>
                    </h3>
                    <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#E5E0D8' }}>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead style={{ backgroundColor: '#FAF8F5' }}>
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color: '#8B8B8B' }}>Produto</th>
                              <th className="px-4 py-2 text-center text-xs font-semibold" style={{ color: '#8B8B8B' }}>Qtd</th>
                              <th className="px-4 py-2 text-right text-xs font-semibold" style={{ color: '#8B8B8B' }}>Preço Unit.</th>
                              <th className="px-4 py-2 text-right text-xs font-semibold" style={{ color: '#8B8B8B' }}>Subtotal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {venda.itens?.map((item, index) => (
                              <tr key={index} className="border-t" style={{ borderColor: '#E5E0D8' }}>
                                <td className="px-4 py-3 text-sm">{item.produto_nome}</td>
                                <td className="px-4 py-3 text-center text-sm font-bold">{item.quantidade}</td>
                                <td className="px-4 py-3 text-right text-sm">R$ {item.preco_unitario?.toFixed(2)}</td>
                                <td className="px-4 py-3 text-right text-sm font-bold">R$ {item.subtotal?.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Valores */}
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: '#07593f' }}>
                      <span>💰 Valores</span>
                    </h3>
                    <div className="grid md:grid-cols-3 gap-3">
                      <div className="p-3 rounded-lg border" style={{ borderColor: '#E5E0D8', backgroundColor: '#FAF8F5' }}>
                        <p className="text-xs font-semibold mb-1" style={{ color: '#8B8B8B' }}>Valor Total</p>
                        <div className="flex justify-between items-center">
                          <p className="text-xl font-bold" style={{ color: '#07593f' }}>
                            R$ {venda.valor_total?.toFixed(2)}
                          </p>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2"
                            onClick={() => copiarTexto(venda.valor_total?.toFixed(2) || '', `total-${venda.id}`)}
                          >
                            {copiado === `total-${venda.id}` ? (
                              <CheckCircle className="w-3 h-3 text-green-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </Button>
                        </div>
                      </div>

                      {venda.desconto > 0 && (
                        <div className="p-3 rounded-lg border" style={{ borderColor: '#E5E0D8', backgroundColor: '#FAF8F5' }}>
                          <p className="text-xs font-semibold mb-1" style={{ color: '#8B8B8B' }}>Desconto</p>
                          <div className="flex justify-between items-center">
                            <p className="text-xl font-bold text-red-600">
                              - R$ {venda.desconto?.toFixed(2)}
                            </p>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2"
                              onClick={() => copiarTexto(venda.desconto?.toFixed(2) || '', `desc-${venda.id}`)}
                            >
                              {copiado === `desc-${venda.id}` ? (
                                <CheckCircle className="w-3 h-3 text-green-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </Button>
                          </div>
                        </div>
                      )}

                      <div className="p-3 rounded-lg border" style={{ borderColor: '#E5E0D8', backgroundColor: '#FAF8F5' }}>
                        <p className="text-xs font-semibold mb-1" style={{ color: '#8B8B8B' }}>Loja</p>
                        <div className="flex justify-between items-center">
                          <p className="text-lg font-bold">{venda.loja}</p>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2"
                            onClick={() => copiarTexto(venda.loja || '', `loja-${venda.id}`)}
                          >
                            {copiado === `loja-${venda.id}` ? (
                              <CheckCircle className="w-3 h-3 text-green-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {vendasFiltradas.length === 0 && (
            <Card className="border-0 shadow-lg">
              <CardContent className="p-12 text-center">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" style={{ color: '#07593f' }} />
                <p className="text-xl" style={{ color: '#8B8B8B' }}>
                  Nenhum pedido encontrado
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}