import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { X, Play, Upload, Sparkles, TrendingUp, Users, DollarSign, Package, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";
import ApresentacaoReuniao from "../components/reuniao/ApresentacaoReuniao";

export default function ModoReuniao() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [apresentacaoAtiva, setApresentacaoAtiva] = useState(false);
  const [configuracao, setConfiguracao] = useState({
    mensagemPersonalizada: "",
    fotosPersonalizadas: [],
    indicadoresSelecionados: {
      faturamento: true,
      vendasQuantidade: true,
      clientes: true,
      estoque: true,
      metas: true,
    },
    exibirHistoriaEmpresa: true,
    exibirFrases: true,
    exibirClima: false,
    exibirNoticias: false,
    frases: [
      "Juntos somos mais fortes! 💪",
      "O sucesso é construído todos os dias 🚀",
      "Foco, força e fé! ✨",
      "Cada desafio é uma oportunidade de crescer 🌟",
    ],
    historiaEmpresa: {
      titulo: "Móveis Pedro II",
      missao: "Oferecer móveis de qualidade com atendimento excepcional",
      visao: "Ser referência em móveis planejados na região",
      valores: "Qualidade, Comprometimento, Inovação e Respeito",
    }
  });
  const [uploadingFotos, setUploadingFotos] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        if (mounted) {
          setUser(currentUser);
        }
      } catch (error) {
        console.error("Erro ao carregar usuário:", error);
      }
    };
    loadUser();
    return () => {
      mounted = false;
    };
  }, []);

  const { data: vendas } = useQuery({
    queryKey: ['vendas'],
    queryFn: () => base44.entities.Venda.list(),
    enabled: !!user && !apresentacaoAtiva,
    staleTime: 60000,
    retry: 1,
  });

  const { data: clientes } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list(),
    enabled: !!user && !apresentacaoAtiva,
    staleTime: 60000,
    retry: 1,
  });

  const { data: produtos } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => base44.entities.Produto.list(),
    enabled: !!user && !apresentacaoAtiva,
    staleTime: 60000,
    retry: 1,
  });

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#07593f' }} />
      </div>
    );
  }

  const isAdmin = user.cargo === 'Administrador';

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen p-8">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: '#FEE2E2' }}>
              <X className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ color: '#07593f' }}>
              Acesso Restrito
            </h2>
            <p style={{ color: '#8B8B8B' }}>
              Apenas administradores podem acessar o Modo Reunião.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleUploadFotos = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploadingFotos(true);

    try {
      const uploadPromises = files.map(file => base44.integrations.Core.UploadFile({ file }));
      const results = await Promise.all(uploadPromises);
      const urls = results.map(result => result.file_url);

      setConfiguracao(prev => ({
        ...prev,
        fotosPersonalizadas: [...prev.fotosPersonalizadas, ...urls]
      }));
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      alert("Erro ao fazer upload das fotos");
    }

    setUploadingFotos(false);
  };

  const removerFoto = (index) => {
    setConfiguracao(prev => ({
      ...prev,
      fotosPersonalizadas: prev.fotosPersonalizadas.filter((_, i) => i !== index)
    }));
  };

  const adicionarFrase = () => {
    const novaFrase = prompt("Digite a nova frase motivacional:");
    if (novaFrase && novaFrase.trim()) {
      setConfiguracao(prev => ({
        ...prev,
        frases: [...prev.frases, novaFrase.trim()]
      }));
    }
  };

  const removerFrase = (index) => {
    setConfiguracao(prev => ({
      ...prev,
      frases: prev.frases.filter((_, i) => i !== index)
    }));
  };

  if (apresentacaoAtiva) {
    return (
      <ApresentacaoReuniao
        configuracao={configuracao}
        vendas={vendas}
        clientes={clientes}
        produtos={produtos}
        onClose={() => setApresentacaoAtiva(false)}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative" style={{ backgroundColor: '#0a0a0a' }}>
      {/* Botão de Sair */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="absolute top-6 right-6 z-50"
      >
        <Button
          onClick={() => navigate(createPageUrl("Dashboard"))}
          variant="outline"
          size="lg"
          className="group hover:scale-105 transition-all duration-300 border-2"
          style={{ 
            borderColor: '#f38a4c',
            backgroundColor: 'rgba(243, 138, 76, 0.1)',
            backdropFilter: 'blur(10px)'
          }}
        >
          <ArrowLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" style={{ color: '#f38a4c' }} />
          <span className="font-semibold" style={{ color: '#f38a4c' }}>Sair</span>
        </Button>
      </motion.div>

      {/* Header com título elegante */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-12 px-4"
      >
        <h1 
          className="text-5xl md:text-7xl mb-3" 
          style={{ 
            fontFamily: 'Georgia, Times New Roman, serif',
            color: '#f38a4c',
            textShadow: '0 0 30px rgba(243, 138, 76, 0.4)',
            letterSpacing: '0.02em'
          }}
        >
          <span style={{ fontStyle: 'italic', fontWeight: 'bold' }}>M</span>odo <span style={{ fontStyle: 'italic' }}>Reunião</span>
        </h1>
        <p className="text-sm tracking-widest uppercase" style={{ color: '#8B8B8B' }}>
          Apresentações Profissionais
        </p>
        <div className="flex items-center justify-center gap-4 mt-6">
          <div className="h-px w-32 bg-gradient-to-r from-transparent via-[#f38a4c] to-transparent"></div>
          <Sparkles className="w-6 h-6 animate-pulse" style={{ color: '#f38a4c' }} />
          <div className="h-px w-32 bg-gradient-to-r from-transparent via-[#f38a4c] to-transparent"></div>
        </div>
      </motion.div>

      {/* Layout principal dividido */}
      <div className="flex-1 container mx-auto px-4 md:px-8 pb-12">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 max-w-7xl mx-auto">
          {/* Lado ESQUERDO - Começar */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center justify-center"
          >
            <Card className="w-full border-2 hover:shadow-2xl transition-all duration-500 group" 
                  style={{ 
                    borderColor: '#07593f', 
                    backgroundColor: '#1a1a1a',
                    boxShadow: '0 0 40px rgba(7, 89, 63, 0.2)'
                  }}>
              <CardContent className="p-8 md:p-12 text-center">
                <div className="mb-8">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
                       style={{ 
                         background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)',
                         boxShadow: '0 0 30px rgba(7, 89, 63, 0.5)'
                       }}>
                    <Play className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-3xl font-bold mb-2" style={{ color: '#07593f', fontFamily: 'Georgia, serif' }}>
                    Iniciar Apresentação
                  </h2>
                  <p className="text-sm" style={{ color: '#8B8B8B' }}>
                    Modo tela cheia com métricas em tempo real
                  </p>
                </div>

                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    onClick={() => setApresentacaoAtiva(true)}
                    size="lg"
                    className="w-full h-24 text-2xl md:text-3xl font-bold shadow-2xl group-hover:shadow-green-900/50 transition-all duration-300"
                    style={{ 
                      background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)',
                      fontFamily: 'Georgia, serif'
                    }}
                  >
                    <Play className="w-8 h-8 mr-3 group-hover:translate-x-1 transition-transform" />
                    Começar Agora
                  </Button>
                </motion.div>

                <div className="mt-8 pt-8 border-t border-zinc-800 space-y-4">
                  <div className="flex items-center justify-center gap-3 text-sm" style={{ color: '#8B8B8B' }}>
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#07593f' }}></div>
                    <TrendingUp className="w-4 h-4" style={{ color: '#07593f' }} />
                    <span>Indicadores em Tempo Real</span>
                  </div>
                  <div className="flex items-center justify-center gap-3 text-sm" style={{ color: '#8B8B8B' }}>
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#f38a4c' }}></div>
                    <Sparkles className="w-4 h-4" style={{ color: '#f38a4c' }} />
                    <span>Design Profissional e Elegante</span>
                  </div>
                  <div className="flex items-center justify-center gap-3 text-sm" style={{ color: '#8B8B8B' }}>
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#10b981' }}></div>
                    <Users className="w-4 h-4" style={{ color: '#10b981' }} />
                    <span>Ideal para Reuniões de Equipe</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Divisor Vertical */}
          <div className="hidden lg:block absolute left-1/2 top-48 bottom-12 w-px bg-gradient-to-b from-transparent via-[#f38a4c] to-transparent opacity-30"></div>

          {/* Lado DIREITO - Personalizar */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="overflow-y-auto rounded-xl"
            style={{ maxHeight: 'calc(100vh - 250px)' }}
          >
            <Card className="border-2 hover:border-opacity-100 transition-all duration-300" 
                  style={{ 
                    borderColor: '#f38a4c', 
                    backgroundColor: '#1a1a1a',
                    boxShadow: '0 0 40px rgba(243, 138, 76, 0.2)'
                  }}>
              <CardContent className="p-6 md:p-8 space-y-6">
                <div className="text-center mb-8 pb-6 border-b border-zinc-800">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                       style={{ 
                         background: 'linear-gradient(135deg, #f38a4c 0%, #f5a164 100%)',
                         boxShadow: '0 0 30px rgba(243, 138, 76, 0.4)'
                       }}>
                    <Sparkles className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold mb-2" style={{ color: '#f38a4c', fontFamily: 'Georgia, serif' }}>
                    Personalizar
                  </h2>
                  <p className="text-sm" style={{ color: '#8B8B8B' }}>
                    Ajuste todos os detalhes da apresentação
                  </p>
                </div>

                {/* Mensagem Personalizada */}
                <div className="p-4 rounded-lg" style={{ backgroundColor: '#0d0d0d', border: '1px solid #2a2a2a' }}>
                  <Label className="text-white mb-3 block font-semibold flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#f38a4c' }}></span>
                    Mensagem de Boas-Vindas
                  </Label>
                  <Input
                    value={configuracao.mensagemPersonalizada}
                    onChange={(e) => setConfiguracao({ ...configuracao, mensagemPersonalizada: e.target.value })}
                    placeholder="Ex: Olá, Natan! Bem-vindo à reunião semanal"
                    className="bg-black/50 border-zinc-700 text-white placeholder:text-zinc-600 focus:border-[#f38a4c] transition-colors"
                  />
                </div>

                {/* Indicadores a Exibir */}
                <div className="p-4 rounded-lg" style={{ backgroundColor: '#0d0d0d', border: '1px solid #2a2a2a' }}>
                  <Label className="text-white mb-3 block font-semibold flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#07593f' }}></span>
                    Indicadores a Exibir
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: 'faturamento', label: 'Faturamento', icon: DollarSign },
                      { key: 'vendasQuantidade', label: 'Qtd. Vendas', icon: TrendingUp },
                      { key: 'clientes', label: 'Clientes', icon: Users },
                      { key: 'estoque', label: 'Estoque', icon: Package },
                    ].map(({ key, label, icon: Icon }) => (
                      <Button
                        key={key}
                        variant="outline"
                        onClick={() => setConfiguracao(prev => ({
                          ...prev,
                          indicadoresSelecionados: {
                            ...prev.indicadoresSelecionados,
                            [key]: !prev.indicadoresSelecionados[key]
                          }
                        }))}
                        className={`justify-start ${
                          configuracao.indicadoresSelecionados[key]
                            ? 'bg-green-900/30 border-green-700'
                            : 'bg-zinc-900 border-zinc-700'
                        }`}
                      >
                        <Icon className="w-4 h-4 mr-2" />
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Opções Extras */}
                <div className="p-4 rounded-lg" style={{ backgroundColor: '#0d0d0d', border: '1px solid #2a2a2a' }}>
                  <Label className="text-white mb-3 block font-semibold flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#10b981' }}></span>
                    Conteúdo Extra
                  </Label>
                  <div className="space-y-2">
                    {[
                      { key: 'exibirHistoriaEmpresa', label: 'História da Empresa' },
                      { key: 'exibirFrases', label: 'Frases Motivacionais' },
                      { key: 'exibirClima', label: 'Previsão do Tempo' },
                      { key: 'exibirNoticias', label: 'Notícias Rápidas' },
                    ].map(({ key, label }) => (
                      <Button
                        key={key}
                        variant="outline"
                        onClick={() => setConfiguracao(prev => ({
                          ...prev,
                          [key]: !prev[key]
                        }))}
                        className={`w-full justify-start ${
                          configuracao[key]
                            ? 'bg-orange-900/30 border-orange-700'
                            : 'bg-zinc-900 border-zinc-700'
                        }`}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Frases Motivacionais */}
                <div className="p-4 rounded-lg" style={{ backgroundColor: '#0d0d0d', border: '1px solid #2a2a2a' }}>
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-white font-semibold flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#8b5cf6' }}></span>
                      Frases Motivacionais
                    </Label>
                    <Button
                      size="sm"
                      onClick={adicionarFrase}
                      style={{ background: '#f38a4c' }}
                    >
                      + Adicionar
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {configuracao.frases.map((frase, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 rounded bg-zinc-900">
                        <p className="flex-1 text-sm text-white">{frase}</p>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removerFrase(index)}
                          className="text-red-500 hover:text-red-600"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Upload de Fotos */}
                <div className="p-4 rounded-lg" style={{ backgroundColor: '#0d0d0d', border: '1px solid #2a2a2a' }}>
                  <Label className="text-white mb-3 block font-semibold flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#3b82f6' }}></span>
                    Fotos Personalizadas
                  </Label>
                  <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-zinc-900 transition-colors border-zinc-700">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleUploadFotos}
                      className="hidden"
                      disabled={uploadingFotos}
                    />
                    <Upload className="w-6 h-6 mb-2 text-gray-400" />
                    <p className="text-sm text-gray-400">
                      {uploadingFotos ? "Enviando..." : "Clique para adicionar fotos"}
                    </p>
                  </label>
                  
                  {configuracao.fotosPersonalizadas.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      {configuracao.fotosPersonalizadas.map((foto, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={foto}
                            alt={`Foto ${index + 1}`}
                            className="w-full h-20 object-cover rounded"
                          />
                          <button
                            onClick={() => removerFoto(index)}
                            className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* História da Empresa */}
                <div className="p-4 rounded-lg" style={{ backgroundColor: '#0d0d0d', border: '1px solid #2a2a2a' }}>
                  <Label className="text-white mb-4 block font-semibold flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#ec4899' }}></span>
                    Informações da Empresa
                  </Label>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs text-gray-400">Missão</Label>
                      <Textarea
                        value={configuracao.historiaEmpresa.missao}
                        onChange={(e) => setConfiguracao(prev => ({
                          ...prev,
                          historiaEmpresa: { ...prev.historiaEmpresa, missao: e.target.value }
                        }))}
                        className="bg-zinc-900 border-zinc-700 text-white text-sm"
                        rows={2}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-400">Visão</Label>
                      <Textarea
                        value={configuracao.historiaEmpresa.visao}
                        onChange={(e) => setConfiguracao(prev => ({
                          ...prev,
                          historiaEmpresa: { ...prev.historiaEmpresa, visao: e.target.value }
                        }))}
                        className="bg-zinc-900 border-zinc-700 text-white text-sm"
                        rows={2}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-400">Valores</Label>
                      <Input
                        value={configuracao.historiaEmpresa.valores}
                        onChange={(e) => setConfiguracao(prev => ({
                          ...prev,
                          historiaEmpresa: { ...prev.historiaEmpresa, valores: e.target.value }
                        }))}
                        className="bg-zinc-900 border-zinc-700 text-white text-sm"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}