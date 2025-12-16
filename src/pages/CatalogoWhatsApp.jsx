import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { MessageCircle, Download, Eye, Share2, Filter, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function CatalogoWhatsApp() {
  const [user, setUser] = useState(null);
  const [filtroCategoria, setFiltroCategoria] = useState("all");
  const [busca, setBusca] = useState("");
  const [produtosSelecionados, setProdutosSelecionados] = useState([]);
  const [visualizacao, setVisualizacao] = useState(false);

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

  const { data: produtos } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => base44.entities.Produto.list(),
    initialData: [],
    enabled: !!user,
  });

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#07593f' }} />
      </div>
    );
  }

  const produtosAtivos = produtos.filter(p => p.ativo && p.quantidade_estoque > 0);
  const categorias = [...new Set(produtosAtivos.map(p => p.categoria))].filter(Boolean);

  const produtosFiltrados = produtosAtivos.filter(p => {
    const matchCategoria = filtroCategoria === "all" || p.categoria === filtroCategoria;
    const matchBusca = !busca || p.nome?.toLowerCase().includes(busca.toLowerCase());
    return matchCategoria && matchBusca;
  });

  const toggleProduto = (produto) => {
    if (produtosSelecionados.find(p => p.id === produto.id)) {
      setProdutosSelecionados(produtosSelecionados.filter(p => p.id !== produto.id));
    } else {
      setProdutosSelecionados([...produtosSelecionados, produto]);
    }
  };

  const gerarTextoWhatsApp = () => {
    let texto = `🛋️ *CATÁLOGO MÓVEIS PEDRO II* 🛋️\n\n`;
    texto += `📱 Entre em contato pelo WhatsApp para mais informações!\n\n`;
    texto += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    const produtosPorCategoria = {};
    produtosSelecionados.forEach(p => {
      const cat = p.categoria || "Outros";
      if (!produtosPorCategoria[cat]) {
        produtosPorCategoria[cat] = [];
      }
      produtosPorCategoria[cat].push(p);
    });

    Object.keys(produtosPorCategoria).forEach(categoria => {
      texto += `📌 *${categoria.toUpperCase()}*\n\n`;
      produtosPorCategoria[categoria].forEach(p => {
        texto += `✨ *${p.nome}*\n`;
        if (p.descricao) texto += `   ${p.descricao}\n`;
        if (p.largura || p.altura || p.profundidade) {
          texto += `   📏 ${p.largura}cm x ${p.altura}cm x ${p.profundidade}cm\n`;
        }
        texto += `   💰 *R$ ${p.preco_venda.toFixed(2)}*\n`;
        texto += `   📦 Estoque disponível\n\n`;
      });
      texto += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    });

    texto += `📍 *Nossas Lojas:*\n`;
    texto += `   • Centro\n`;
    texto += `   • Carangola\n`;
    texto += `   • Ponte Branca\n\n`;
    texto += `💬 *Faça seu pedido pelo WhatsApp!*\n`;
    texto += `🚚 *Entregamos na sua casa!*\n`;

    return texto;
  };

  const copiarTexto = () => {
    const texto = gerarTextoWhatsApp();
    navigator.clipboard.writeText(texto);
    alert("Texto copiado! Cole no WhatsApp.");
  };

  const abrirWhatsApp = () => {
    const texto = gerarTextoWhatsApp();
    const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <MessageCircle className="w-8 h-8" style={{ color: '#25D366' }} />
              <h1 className="text-3xl md:text-4xl font-bold" style={{ color: '#07593f' }}>
                Catálogo para WhatsApp
              </h1>
            </div>
            <p style={{ color: '#8B8B8B' }}>
              Gere catálogos profissionais para enviar aos seus clientes
            </p>
          </div>
          <Badge className="text-lg px-4 py-2" style={{ backgroundColor: '#25D366', color: 'white' }}>
            {produtosSelecionados.length} selecionados
          </Badge>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Seleção de Produtos */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="border-0 shadow-xl">
              <CardHeader>
                <CardTitle>Selecione os Produtos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: '#8B8B8B' }} />
                    <Input
                      placeholder="Buscar produto..."
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <select
                    value={filtroCategoria}
                    onChange={(e) => setFiltroCategoria(e.target.value)}
                    className="p-2 rounded border-2"
                    style={{ borderColor: '#E5E0D8' }}
                  >
                    <option value="all">Todas Categorias</option>
                    {categorias.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="grid md:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto">
                  {produtosFiltrados.map(produto => {
                    const selecionado = produtosSelecionados.find(p => p.id === produto.id);
                    return (
                      <Card
                        key={produto.id}
                        className={`cursor-pointer transition-all ${
                          selecionado ? 'border-[#25D366] border-2 bg-green-50' : 'border-2 hover:border-[#07593f]'
                        }`}
                        onClick={() => toggleProduto(produto)}
                      >
                        <CardContent className="p-4">
                          {produto.fotos && produto.fotos[0] && (
                            <img
                              src={produto.fotos[0]}
                              alt={produto.nome}
                              className="w-full h-32 object-cover rounded mb-2"
                            />
                          )}
                          <h3 className="font-bold mb-1" style={{ color: '#07593f' }}>
                            {produto.nome}
                          </h3>
                          <Badge className="mb-2">{produto.categoria}</Badge>
                          <p className="text-2xl font-bold" style={{ color: '#f38a4c' }}>
                            R$ {produto.preco_venda.toFixed(2)}
                          </p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Preview e Ações */}
          <div className="space-y-4">
            <Card className="border-0 shadow-xl">
              <CardHeader>
                <CardTitle>Ações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={abrirWhatsApp}
                  disabled={produtosSelecionados.length === 0}
                  className="w-full h-12 text-lg"
                  style={{ backgroundColor: '#25D366', color: 'white' }}
                >
                  <MessageCircle className="w-5 h-5 mr-2" />
                  Enviar pelo WhatsApp
                </Button>

                <Button
                  onClick={copiarTexto}
                  disabled={produtosSelecionados.length === 0}
                  variant="outline"
                  className="w-full h-12"
                >
                  <Share2 className="w-5 h-5 mr-2" />
                  Copiar Texto
                </Button>

                <Button
                  onClick={() => setVisualizacao(!visualizacao)}
                  disabled={produtosSelecionados.length === 0}
                  variant="outline"
                  className="w-full h-12"
                >
                  <Eye className="w-5 h-5 mr-2" />
                  {visualizacao ? 'Ocultar' : 'Visualizar'} Preview
                </Button>

                <Button
                  onClick={() => setProdutosSelecionados([])}
                  disabled={produtosSelecionados.length === 0}
                  variant="outline"
                  className="w-full"
                >
                  Limpar Seleção
                </Button>
              </CardContent>
            </Card>

            {visualizacao && produtosSelecionados.length > 0 && (
              <Card className="border-0 shadow-xl">
                <CardHeader>
                  <CardTitle>Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-gray-100 p-4 rounded text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
                    {gerarTextoWhatsApp()}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}