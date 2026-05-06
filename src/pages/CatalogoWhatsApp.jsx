import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLojas } from "@/hooks/useLojas";
import { calcularEstoqueTotal } from "@/constants/productConstants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { MessageCircle, Download, Eye, Share2, Filter, Search, ImageIcon, ImagePlus, Upload, Loader2, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function CatalogoWhatsApp() {
  const [user, setUser] = useState(null);
  const [filtroCategoria, setFiltroCategoria] = useState("all");
  const [filtroAmbiente, setFiltroAmbiente] = useState("all");
  const [filtroDisponibilidade, setFiltroDisponibilidade] = useState("all");
  const [busca, setBusca] = useState("");
  const [produtosSelecionados, setProdutosSelecionados] = useState([]);
  const [visualizacao, setVisualizacao] = useState(false);
  const [paginaExibicao, setPaginaExibicao] = useState(1);
  const [vincularImagemOpen, setVincularImagemOpen] = useState(false);
  const [uploadingFor, setUploadingFor] = useState(null); // ID do produto sendo enviado
  const [fotosIndividuais, setFotosIndividuais] = useState({}); // { [id]: 'url' }
  const [savingImage, setSavingImage] = useState(false);
  const itensPorPagina = 50;
  const queryClient = useQueryClient();

  // Reset pagination when filters change
  useEffect(() => {
    setPaginaExibicao(1);
  }, [filtroCategoria, filtroAmbiente, filtroDisponibilidade, busca]);

  const { data: lojasAtivas = [] } = useLojas();

  const getEstoqueTotal = (p) => {
    return calcularEstoqueTotal(p, lojasAtivas);
  };

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
    enabled: !!user,
  });

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#07593f' }} />
      </div>
    );
  }

  const produtosAtivos = (produtos || []).filter(p => p.ativo !== false);

  const categorias = [...new Set(produtosAtivos.map(p => p.categoria))].filter(Boolean).sort();
  const ambientes = [...new Set(produtosAtivos.map(p => p.ambiente))].filter(Boolean).sort();


  const produtosFiltrados = produtosAtivos.filter(p => {
    const estoqueTotal = getEstoqueTotal(p);
    const matchCategoria = filtroCategoria === "all" || p.categoria === filtroCategoria;
    const matchAmbiente = filtroAmbiente === "all" || p.ambiente === filtroAmbiente;
    const matchDisponibilidade = filtroDisponibilidade === "all" ||
      (filtroDisponibilidade === "pronta" && estoqueTotal > 0) ||
      (filtroDisponibilidade === "encomenda" && estoqueTotal <= 0);
    const matchBusca = !busca ||
      p.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      p.modelo_referencia?.toLowerCase().includes(busca.toLowerCase());

    return matchCategoria && matchAmbiente && matchDisponibilidade && matchBusca;
  });


  const produtosPaginados = produtosFiltrados.slice(0, paginaExibicao * itensPorPagina);

  const selecionarTodosFiltrados = () => {
    const novosIds = new Set(produtosSelecionados.map(p => p.id));
    const novosSelecionados = [...produtosSelecionados];

    produtosFiltrados.forEach(p => {
      if (!novosIds.has(p.id)) {
        novosSelecionados.push(p);
        novosIds.add(p.id);
      }
    });

    setProdutosSelecionados(novosSelecionados);
  };

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
      texto += `📍 *${categoria.toUpperCase()}*\n\n`;
      produtosPorCategoria[categoria].forEach(p => {
        texto += `✨ *${p.nome} ${p.modelo_referencia || ''}*\n`;
        if (p.descricao) texto += `   ${p.descricao}\n`;
        if (p.material) texto += `   🧵 Material: ${p.material}\n`;
        if (p.cor) texto += `   🎨 Cor: ${p.cor}\n`;
        if (p.largura || p.altura || p.profundidade) {
          const dims = [];
          if (p.largura) dims.push(`Largura: ${p.largura}cm`);
          if (p.altura) dims.push(`Altura: ${p.altura}cm`);
          if (p.profundidade) dims.push(`Profundidade: ${p.profundidade}cm`);
          texto += `   📏 ${dims.join(', ')}\n`;
        }
        texto += `   💰 *R$ ${p.preco_venda?.toFixed(2) || 'Sob consulta'}*\n`;
        texto += `   📦 ${getEstoqueTotal(p) > 0 ? 'Pronta-entrega' : 'Disponível por encomenda'}\n\n`;
      });
      texto += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    });

    texto += `📍 *Nossas Lojas:*\n`;
    lojasAtivas.forEach(loja => {
      texto += `   • ${loja.nome}\n`;
    });
    texto += `\n`;
    texto += `💬 *Faça seu pedido pelo WhatsApp!*\n`;
    texto += `🚚 *Entregamos na sua casa!*\n`;

    return texto;
  };

  const gerarTextoProdutoIndividual = (p) => {
    let texto = `✨ *${p.nome} ${p.modelo_referencia || ''}*\n`;
    if (p.descricao) texto += `${p.descricao}\n`;
    if (p.material) texto += `🧵 Material: ${p.material}\n`;
    if (p.cor) texto += `🎨 Cor: ${p.cor}\n`;
    if (p.largura || p.altura || p.profundidade) {
      const dims = [];
      if (p.largura) dims.push(`Largura: ${p.largura}cm`);
      if (p.altura) dims.push(`Altura: ${p.altura}cm`);
      if (p.profundidade) dims.push(`Profundidade: ${p.profundidade}cm`);
      texto += `📏 ${dims.join(', ')}\n`;
    }
    texto += `💰 *R$ ${p.preco_venda?.toFixed(2) || 'Sob consulta'}*\n`;
    texto += `📦 ${getEstoqueTotal(p) > 0 ? 'Pronta-entrega' : 'Disponível por encomenda'}\n`;

    return texto;
  };

  const abrirWhatsApp = () => {
    if (produtosSelecionados.length === 0) {
      toast.error("Selecione pelo menos um produto!");
      return;
    }

    const texto = gerarTextoWhatsApp();
    const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(url, "_blank");
  };

  const handleImageUploadIndiv = async (e, produtoId) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingFor(produtoId);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFotosIndividuais(prev => ({ ...prev, [produtoId]: file_url }));
      toast.success("Imagem enviada com sucesso!");
    } catch (error) {
      console.error('Erro no upload:', error);
      toast.error('Erro ao enviar imagem');
    } finally {
      setUploadingFor(null);
    }
  };

  const salvarImagensIndividuais = async () => {
    const idsComFoto = Object.keys(fotosIndividuais).filter(id => fotosIndividuais[id]?.trim());

    if (idsComFoto.length === 0) {
      toast.error("Insira pelo menos uma imagem para algum produto.");
      return;
    }

    setSavingImage(true);
    try {
      const promises = idsComFoto.map(id =>
        base44.entities.Produto.update(id, {
          fotos: [fotosIndividuais[id].trim()]
        })
      );

      await Promise.all(promises);

      toast.success(`${promises.length} produto(s) atualizado(s) com sucesso!`);
      fecharModalVincular();

      queryClient.invalidateQueries(['produtos']);

      setProdutosSelecionados(prev => prev.map(p =>
        fotosIndividuais[p.id] ? { ...p, fotos: [fotosIndividuais[p.id].trim()] } : p
      ));

    } catch (error) {
      console.error("Erro ao salvar imagens:", error);
      toast.error("Erro ao vincular imagens");
    } finally {
      setSavingImage(false);
    }
  };

  const fecharModalVincular = () => {
    setVincularImagemOpen(false);
    setFotosIndividuais({});
    setUploadingFor(null);
  };

  const copiarTexto = () => {
    const texto = gerarTextoWhatsApp();
    navigator.clipboard.writeText(texto);
    toast.success("Texto copiado! Cole no WhatsApp.");
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
                <div className="flex flex-wrap gap-2">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: '#8B8B8B' }} />
                    <Input
                      placeholder="Buscar por nome ou referência..."
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      className="pl-9 h-10"
                    />
                  </div>

                  <select
                    value={filtroCategoria}
                    onChange={(e) => setFiltroCategoria(e.target.value)}
                    className="h-10 px-3 rounded border border-input bg-background text-sm"
                  >
                    <option value="all">Todas Categorias</option>
                    {categorias.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>

                  <select
                    value={filtroAmbiente}
                    onChange={(e) => setFiltroAmbiente(e.target.value)}
                    className="h-10 px-3 rounded border border-input bg-background text-sm"
                  >
                    <option value="all">Todos os Cômodos</option>
                    {ambientes.map(amb => (
                      <option key={amb} value={amb}>{amb}</option>
                    ))}
                  </select>

                  <select
                    value={filtroDisponibilidade}
                    onChange={(e) => setFiltroDisponibilidade(e.target.value)}
                    className="h-10 px-3 rounded border border-input bg-background text-sm"
                  >
                    <option value="all">Disponibilidade (Ver todos)</option>
                    <option value="pronta">Pronta-entrega</option>
                    <option value="encomenda">Por Encomenda</option>
                  </select>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-8"
                    onClick={selecionarTodosFiltrados}
                    disabled={produtosFiltrados.length === 0}
                  >
                    Selecionar Todos ({produtosFiltrados.length})
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-8 text-red-500 hover:text-red-700"
                    onClick={() => setProdutosSelecionados([])}
                    disabled={produtosSelecionados.length === 0}
                  >
                    Limpar Seleção
                  </Button>
                </div>

                <div className="grid md:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pr-2">
                  {produtosPaginados.map(produto => {
                    const selecionado = produtosSelecionados.find(p => p.id === produto.id);
                    return (
                      <Card
                        key={produto.id}
                        className={`cursor-pointer transition-all ${selecionado ? 'border-[#25D366] border-2 bg-green-50' : 'border-2 hover:border-[#07593f]'
                          }`}
                        onClick={() => toggleProduto(produto)}
                      >
                        <CardContent className="p-4">
                          <div className="relative">
                            {produto.fotos && produto.fotos[0] ? (
                              <img
                                src={produto.fotos[0]}
                                alt={produto.nome}
                                className="w-full h-32 object-cover rounded mb-2"
                              />
                            ) : (
                              <div className="w-full h-32 bg-gray-100 rounded mb-2 flex flex-col items-center justify-center border-2 border-dashed border-gray-200">
                                <ImageIcon className="w-8 h-8 text-gray-300 mb-1" />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-[10px] text-green-700 hover:bg-green-50"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setProdutosSelecionados([produto]);
                                    setVincularImagemOpen(true);
                                  }}
                                >
                                  <ImagePlus className="w-3 h-3 mr-1" />
                                  Vincular Imagem
                                </Button>
                              </div>
                            )}

                            {produto.fotos?.length > 0 && (
                              <Badge className="absolute top-1 right-1 bg-[#07593f]/80 text-white text-[9px] h-4 px-1 hover:bg-[#07593f] border-0">
                                {produto.fotos.length} {produto.fotos.length === 1 ? 'foto' : 'fotos'}
                              </Badge>
                            )}
                          </div>
                          <h3 className="font-bold text-sm leading-tight mb-1" style={{ color: '#07593f' }}>
                            {produto.nome}{produto.modelo_referencia ? ` - ${produto.modelo_referencia}` : ''}
                          </h3>
                          <div className="flex flex-wrap gap-1 mb-2">
                            <Badge variant="secondary" className="text-[10px] h-4 py-0">{produto.categoria}</Badge>
                            {produto.ambiente && <Badge variant="outline" className="text-[10px] h-4 py-0 border-blue-200 text-blue-700">{produto.ambiente}</Badge>}
                            <Badge variant="outline" className={`text-[10px] h-4 py-0 ${getEstoqueTotal(produto) > 0 ? 'border-green-200 text-green-700' : 'border-orange-200 text-orange-700'}`}>
                              {getEstoqueTotal(produto) > 0 ? 'Pronta' : 'Encomenda'}
                            </Badge>
                          </div>
                          <p className="text-xl font-bold" style={{ color: '#f38a4c' }}>
                            {produto.preco_venda ? `R$ ${produto.preco_venda.toFixed(2)}` : 'Consultar'}
                          </p>
                        </CardContent>
                      </Card>
                    );
                  })}

                  {produtosFiltrados.length > produtosPaginados.length && (
                    <div className="md:col-span-2 py-4 text-center">
                      <Button
                        variant="ghost"
                        onClick={() => setPaginaExibicao(p => p + 1)}
                        className="text-green-700 hover:bg-green-50"
                      >
                        Ver Mais ({produtosFiltrados.length - produtosPaginados.length} restantes)
                      </Button>
                    </div>
                  )}
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

                <Button
                  onClick={() => setVincularImagemOpen(true)}
                  disabled={produtosSelecionados.length === 0}
                  variant="secondary"
                  className="w-full h-12 border-2 border-dashed border-green-300 bg-green-50 hover:bg-green-100 text-green-700 font-semibold"
                >
                  <ImagePlus className="w-5 h-5 mr-2" />
                  Vincular Imagem ({produtosSelecionados.length})
                </Button>
              </CardContent>
            </Card>

            {/* Modal de Vincular Imagem Individual em Lote */}
            <Dialog open={vincularImagemOpen} onOpenChange={(open) => !open && fecharModalVincular()}>
              <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="px-6 pt-6 pb-4 border-b">
                  <DialogTitle>Vincular Imagens aos Produtos</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                  {produtosSelecionados.map((p, idx) => (
                    <div key={p.id} className="p-4 rounded-xl border-2 border-gray-100 bg-white shadow-sm space-y-4">
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-[#07593f] truncate">
                            {p.nome}{p.modelo_referencia ? ` (${p.modelo_referencia})` : ''}
                          </h4>
                        </div>
                        <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 h-5 px-1.5 shrink-0">
                          {idx + 1}/{produtosSelecionados.length}
                        </Badge>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <div className="relative border-2 border-dashed rounded-lg h-24 flex items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleImageUploadIndiv(e, p.id)}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              disabled={uploadingFor === p.id || savingImage}
                            />
                            <div className="text-center">
                              {uploadingFor === p.id ? (
                                <Loader2 className="w-6 h-6 mx-auto animate-spin text-green-600" />
                              ) : (
                                <>
                                  <Upload className="w-5 h-5 mx-auto text-green-600 mb-1" />
                                  <p className="text-[10px] font-medium text-gray-900">Upload de Arquivo</p>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[10px] text-gray-500 uppercase font-bold">Ou Link da Imagem</Label>
                            <Input
                              value={fotosIndividuais[p.id] || ''}
                              onChange={(e) => setFotosIndividuais(prev => ({ ...prev, [p.id]: e.target.value }))}
                              placeholder="https://..."
                              disabled={savingImage || uploadingFor === p.id}
                              className="h-8 text-[11px]"
                            />
                          </div>
                        </div>

                        <div className="relative border rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden aspect-video">
                          {fotosIndividuais[p.id] ? (
                            <img
                              src={fotosIndividuais[p.id]}
                              alt="Preview"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.onerror = null;
                                toast.error("Link inválido!");
                              }}
                            />
                          ) : (
                            p.fotos?.[0] ? (
                              <div className="relative w-full h-full group">
                                <img src={p.fotos[0]} className="w-full h-full object-cover opacity-60" alt="" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <Badge className="bg-white/90 text-gray-700 text-[10px] shadow-sm">Foto atual</Badge>
                                </div>
                              </div>
                            ) : (
                              <div className="text-center">
                                <ImageIcon className="w-8 h-8 text-gray-300 mx-auto" />
                                <p className="text-[10px] text-gray-400">Nenhuma foto</p>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <DialogFooter className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between sm:justify-between w-full">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={fecharModalVincular}
                    disabled={savingImage}
                  >
                    Descartar Alterações
                  </Button>
                  <Button
                    size="sm"
                    onClick={salvarImagensIndividuais}
                    disabled={savingImage || Object.keys(fotosIndividuais).length === 0}
                    className="bg-green-600 hover:bg-green-700 min-w-[140px] shadow-md transition-all hover:scale-105"
                  >
                    {savingImage ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4 mr-2" />
                    )}
                    Salvar Tudo ({Object.keys(fotosIndividuais).length})
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

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