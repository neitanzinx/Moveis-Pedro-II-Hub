import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, TrendingUp, Users, DollarSign, Package, Sparkles, Heart, Target, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ['#07593f', '#f38a4c', '#3b82f6', '#10b981', '#f59e0b'];

export default function ApresentacaoReuniao({ configuracao, vendas, clientes, produtos, onClose }) {
  const [slideAtual, setSlideAtual] = useState(0);
  const [slides, setSlides] = useState([]);

  useEffect(() => {
    const slidesGerados = gerarSlides();
    setSlides(slidesGerados);

    // Auto-avançar slides
    const interval = setInterval(() => {
      setSlideAtual(prev => (prev + 1) % slidesGerados.length);
    }, 8000); // 8 segundos por slide

    return () => clearInterval(interval);
  }, [configuracao, vendas, clientes, produtos]);

  const gerarSlides = () => {
    const novoSlides = [];

    // Slide 1: Boas-vindas
    novoSlides.push({
      tipo: 'boas-vindas',
      conteudo: configuracao.mensagemPersonalizada || "Bem-vindos à Reunião!"
    });

    // Slide 2: Indicadores Principais
    if (configuracao.indicadoresSelecionados.faturamento || 
        configuracao.indicadoresSelecionados.vendasQuantidade ||
        configuracao.indicadoresSelecionados.clientes) {
      novoSlides.push({
        tipo: 'indicadores',
        dados: calcularIndicadores()
      });
    }

    // Slide 3: Gráfico de Vendas
    if (configuracao.indicadoresSelecionados.vendasQuantidade) {
      novoSlides.push({
        tipo: 'grafico-vendas',
        dados: gerarDadosGraficoVendas()
      });
    }

    // Slide 4: Top Produtos
    if (configuracao.indicadoresSelecionados.estoque) {
      novoSlides.push({
        tipo: 'top-produtos',
        dados: calcularTopProdutos()
      });
    }

    // Slide 5: História da Empresa
    if (configuracao.exibirHistoriaEmpresa) {
      novoSlides.push({
        tipo: 'historia-empresa',
        dados: configuracao.historiaEmpresa
      });
    }

    // Slides 6+: Frases Motivacionais
    if (configuracao.exibirFrases && configuracao.frases.length > 0) {
      configuracao.frases.forEach(frase => {
        novoSlides.push({
          tipo: 'frase',
          conteudo: frase
        });
      });
    }

    // Slides: Fotos Personalizadas
    if (configuracao.fotosPersonalizadas.length > 0) {
      configuracao.fotosPersonalizadas.forEach(foto => {
        novoSlides.push({
          tipo: 'foto',
          url: foto
        });
      });
    }

    return novoSlides;
  };

  const calcularIndicadores = () => {
    const hoje = new Date();
    const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    
    const vendasMes = vendas.filter(v => {
      const dataVenda = new Date(v.data_venda);
      return dataVenda >= primeiroDiaMes;
    });

    const faturamento = vendasMes.reduce((sum, v) => sum + (v.valor_total || 0), 0);
    const quantidadeVendas = vendasMes.length;
    const totalClientes = clientes.length;
    const estoqueTotal = produtos.reduce((sum, p) => sum + (p.quantidade_estoque || 0), 0);

    return {
      faturamento,
      quantidadeVendas,
      totalClientes,
      estoqueTotal
    };
  };

  const gerarDadosGraficoVendas = () => {
    const hoje = new Date();
    const ultimos7Dias = [];
    
    for (let i = 6; i >= 0; i--) {
      const data = new Date(hoje);
      data.setDate(data.getDate() - i);
      const dataStr = data.toISOString().split('T')[0];
      
      const vendasDia = vendas.filter(v => v.data_venda === dataStr);
      
      ultimos7Dias.push({
        dia: data.toLocaleDateString('pt-BR', { weekday: 'short' }),
        vendas: vendasDia.length,
        valor: vendasDia.reduce((sum, v) => sum + (v.valor_total || 0), 0)
      });
    }

    return ultimos7Dias;
  };

  const calcularTopProdutos = () => {
    const produtosVendidos = {};
    
    vendas.forEach(v => {
      v.itens?.forEach(item => {
        if (!produtosVendidos[item.produto_id]) {
          produtosVendidos[item.produto_id] = {
            nome: item.produto_nome,
            quantidade: 0,
            valor: 0
          };
        }
        produtosVendidos[item.produto_id].quantidade += item.quantidade;
        produtosVendidos[item.produto_id].valor += item.subtotal;
      });
    });

    return Object.values(produtosVendidos)
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5);
  };

  const renderSlide = (slide) => {
    switch (slide.tipo) {
      case 'boas-vindas':
        return <SlideBoasVindas conteudo={slide.conteudo} />;
      case 'indicadores':
        return <SlideIndicadores dados={slide.dados} config={configuracao.indicadoresSelecionados} />;
      case 'grafico-vendas':
        return <SlideGraficoVendas dados={slide.dados} />;
      case 'top-produtos':
        return <SlideTopProdutos dados={slide.dados} />;
      case 'historia-empresa':
        return <SlideHistoriaEmpresa dados={slide.dados} />;
      case 'frase':
        return <SlideFrase conteudo={slide.conteudo} />;
      case 'foto':
        return <SlideFoto url={slide.url} />;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Botão Fechar */}
      <Button
        onClick={onClose}
        size="icon"
        className="absolute top-6 right-6 z-50 bg-red-600 hover:bg-red-700"
      >
        <X className="w-6 h-6" />
      </Button>

      {/* Indicador de Progresso */}
      <div className="absolute top-6 left-6 z-50 flex gap-2">
        {slides.map((_, index) => (
          <div
            key={index}
            className="w-2 h-2 rounded-full transition-all"
            style={{
              backgroundColor: index === slideAtual ? '#f38a4c' : '#333',
              transform: index === slideAtual ? 'scale(1.5)' : 'scale(1)'
            }}
          />
        ))}
      </div>

      {/* Slides */}
      <AnimatePresence mode="wait">
        <motion.div
          key={slideAtual}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.1 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          className="w-full h-full flex items-center justify-center p-12"
        >
          {slides[slideAtual] && renderSlide(slides[slideAtual])}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// Componentes de Slides

function SlideBoasVindas({ conteudo }) {
  return (
    <div className="text-center">
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <Sparkles className="w-24 h-24 mx-auto mb-8" style={{ color: '#f38a4c' }} />
        <h1 
          className="text-8xl font-bold mb-6" 
          style={{ 
            fontFamily: 'Times New Roman, serif',
            color: '#fff',
            textShadow: '0 0 40px rgba(243, 138, 76, 0.5)'
          }}
        >
          {conteudo}
        </h1>
        <p className="text-3xl" style={{ color: '#8B8B8B', fontFamily: 'Times New Roman, serif' }}>
          Vamos começar a apresentação
        </p>
      </motion.div>
    </div>
  );
}

function SlideIndicadores({ dados, config }) {
  const indicadores = [
    { 
      key: 'faturamento',
      label: 'Faturamento do Mês', 
      valor: `R$ ${(dados.faturamento / 1000).toFixed(1)}k`, 
      icon: DollarSign, 
      cor: '#07593f',
      mostrar: config.faturamento 
    },
    { 
      key: 'vendasQuantidade',
      label: 'Vendas Realizadas', 
      valor: dados.quantidadeVendas, 
      icon: TrendingUp, 
      cor: '#f38a4c',
      mostrar: config.vendasQuantidade 
    },
    { 
      key: 'clientes',
      label: 'Clientes Ativos', 
      valor: dados.totalClientes, 
      icon: Users, 
      cor: '#3b82f6',
      mostrar: config.clientes 
    },
    { 
      key: 'estoque',
      label: 'Itens em Estoque', 
      valor: dados.estoqueTotal, 
      icon: Package, 
      cor: '#10b981',
      mostrar: config.estoque 
    },
  ].filter(ind => ind.mostrar);

  return (
    <div className="w-full max-w-7xl">
      <motion.h2
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-5xl font-bold text-center mb-16"
        style={{ color: '#f38a4c', fontFamily: 'Times New Roman, serif' }}
      >
        Indicadores em Tempo Real
      </motion.h2>
      <div className="grid grid-cols-2 gap-8">
        {indicadores.map((ind, index) => (
          <motion.div
            key={ind.key}
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: index * 0.15, type: "spring" }}
            className="p-12 rounded-3xl text-center"
            style={{ 
              background: `linear-gradient(135deg, ${ind.cor}20 0%, ${ind.cor}10 100%)`,
              border: `2px solid ${ind.cor}40`
            }}
          >
            <ind.icon className="w-20 h-20 mx-auto mb-6" style={{ color: ind.cor }} />
            <p className="text-2xl mb-4" style={{ color: '#8B8B8B' }}>{ind.label}</p>
            <p className="text-7xl font-bold" style={{ color: ind.cor }}>{ind.valor}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function SlideGraficoVendas({ dados }) {
  return (
    <div className="w-full max-w-7xl">
      <motion.h2
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-5xl font-bold text-center mb-12"
        style={{ color: '#f38a4c', fontFamily: 'Times New Roman, serif' }}
      >
        Evolução de Vendas - Últimos 7 Dias
      </motion.h2>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="bg-zinc-900 p-12 rounded-3xl"
      >
        <ResponsiveContainer width="100%" height={500}>
          <BarChart data={dados}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="dia" stroke="#8B8B8B" style={{ fontSize: '18px' }} />
            <YAxis stroke="#8B8B8B" style={{ fontSize: '18px' }} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1a1a1a', 
                border: '2px solid #f38a4c',
                borderRadius: '12px',
                fontSize: '16px'
              }}
              formatter={(value) => typeof value === 'number' && value > 100
                ? `R$ ${value.toFixed(2)}`
                : value
              }
            />
            <Bar dataKey="vendas" fill="#07593f" radius={[10, 10, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>
    </div>
  );
}

function SlideTopProdutos({ dados }) {
  return (
    <div className="w-full max-w-7xl">
      <motion.h2
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-5xl font-bold text-center mb-12"
        style={{ color: '#f38a4c', fontFamily: 'Times New Roman, serif' }}
      >
        Top 5 Produtos Mais Vendidos
      </motion.h2>
      <div className="space-y-6">
        {dados.map((produto, index) => (
          <motion.div
            key={index}
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center gap-6 p-8 rounded-2xl bg-zinc-900"
          >
            <div 
              className="w-16 h-16 rounded-full flex items-center justify-center text-3xl font-bold"
              style={{ backgroundColor: COLORS[index], color: 'white' }}
            >
              {index + 1}
            </div>
            <div className="flex-1">
              <h3 className="text-3xl font-bold text-white mb-2">{produto.nome}</h3>
              <p className="text-xl" style={{ color: '#8B8B8B' }}>
                {produto.quantidade} unidades vendidas
              </p>
            </div>
            <div className="text-right">
              <p className="text-4xl font-bold" style={{ color: COLORS[index] }}>
                R$ {produto.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function SlideHistoriaEmpresa({ dados }) {
  return (
    <div className="w-full max-w-6xl text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <h2 
          className="text-7xl font-bold mb-16"
          style={{ color: '#f38a4c', fontFamily: 'Times New Roman, serif' }}
        >
          {dados.titulo}
        </h2>
        
        <div className="grid md:grid-cols-3 gap-12 mt-12">
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="p-8 rounded-2xl bg-zinc-900"
          >
            <Target className="w-16 h-16 mx-auto mb-6" style={{ color: '#07593f' }} />
            <h3 className="text-3xl font-bold mb-4" style={{ color: '#07593f' }}>Missão</h3>
            <p className="text-xl text-gray-300">{dados.missao}</p>
          </motion.div>

          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="p-8 rounded-2xl bg-zinc-900"
          >
            <Eye className="w-16 h-16 mx-auto mb-6" style={{ color: '#f38a4c' }} />
            <h3 className="text-3xl font-bold mb-4" style={{ color: '#f38a4c' }}>Visão</h3>
            <p className="text-xl text-gray-300">{dados.visao}</p>
          </motion.div>

          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="p-8 rounded-2xl bg-zinc-900"
          >
            <Heart className="w-16 h-16 mx-auto mb-6" style={{ color: '#3b82f6' }} />
            <h3 className="text-3xl font-bold mb-4" style={{ color: '#3b82f6' }}>Valores</h3>
            <p className="text-xl text-gray-300">{dados.valores}</p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

function SlideFrase({ conteudo }) {
  return (
    <motion.div
      initial={{ scale: 0.5, rotate: -5 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: "spring", damping: 10 }}
      className="text-center"
    >
      <Sparkles className="w-20 h-20 mx-auto mb-8" style={{ color: '#f38a4c' }} />
      <h1 
        className="text-7xl font-bold px-12"
        style={{ 
          color: '#fff',
          fontFamily: 'Times New Roman, serif',
          lineHeight: '1.4',
          textShadow: '0 0 30px rgba(243, 138, 76, 0.4)'
        }}
      >
        {conteudo}
      </h1>
    </motion.div>
  );
}

function SlideFoto({ url }) {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="w-full h-full flex items-center justify-center"
    >
      <img 
        src={url} 
        alt="Foto da empresa" 
        className="max-w-full max-h-full object-contain rounded-3xl shadow-2xl"
        style={{ boxShadow: '0 0 50px rgba(243, 138, 76, 0.3)' }}
      />
    </motion.div>
  );
}