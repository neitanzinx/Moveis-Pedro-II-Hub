import React, { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Bell, Check, X, AlertCircle, Truck, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AMBIENTES } from "@/constants/productConstants";

const CATEGORIAS_NOTIFICACAO_PRODUTO = [
  'Sofá',
  'Cama',
  'Mesa',
  'Cadeira',
  'Armário',
  'Estante',
  'Rack',
  'Poltrona',
  'Escrivaninha',
  'Criado-mudo',
  'Buffet',
  'Aparador',
  'Banco',
  'Colchão',
  'Guarda-roupa',
  'Cômoda',
  'Painel',
  'Sapateira',
  'Cristaleira',
  'Balcão',
  'Cabeceira',
  'Box',
  'Penteadeira',
  'Travesseiro',
  'Almofada',
  'Decorações',
  'Utensílios',
  'Outros',
];

const CATEGORIAS_NOTIFICACAO_KEY = 'notificacoes_categorias_ativas';
const AMBIENTES_NOTIFICACAO_KEY = 'notificacoes_ambientes_ativos';

const AMBIENTES_NOTIFICACAO_PRODUTO = Array.from(new Set([
  ...(Array.isArray(AMBIENTES) ? AMBIENTES : []),
  'Área Externa',
]));

const normalizeKey = (value = '') => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const resolveConfiguredValue = (rawValue, options) => {
  const normalizedRaw = normalizeKey(rawValue);
  if (!normalizedRaw) return '';
  return options.find((option) => normalizeKey(option) === normalizedRaw) || '';
};

const getCategoriaFromNotification = (n) => {
  if (!n) return '';
  return (
    n.categoria_produto ||
    n.categoria ||
    n?.metadata?.categoria ||
    n?.detalhes?.categoria ||
    ''
  );
};

const getAmbienteFromNotification = (n) => {
  if (!n) return '';
  return (
    n.ambiente_produto ||
    n.ambiente ||
    n?.metadata?.ambiente ||
    n?.detalhes?.ambiente ||
    ''
  );
};

const createDefaultCategoriasState = () => {
  const defaults = {};
  CATEGORIAS_NOTIFICACAO_PRODUTO.forEach((categoria) => {
    defaults[categoria] = true;
  });
  return defaults;
};

const createDefaultAmbientesState = () => {
  const defaults = {};
  AMBIENTES_NOTIFICACAO_PRODUTO.forEach((ambiente) => {
    defaults[ambiente] = true;
  });
  return defaults;
};

export default function NotificacoesPanel({ user }) {
  const [open, setOpen] = useState(false);
  const [showCategoriaManager, setShowCategoriaManager] = useState(false);
  const [categoriasAtivas, setCategoriasAtivas] = useState(() => {
    try {
      const raw = localStorage.getItem(CATEGORIAS_NOTIFICACAO_KEY);
      if (!raw) return createDefaultCategoriasState();
      const parsed = JSON.parse(raw);
      return {
        ...createDefaultCategoriasState(),
        ...(parsed || {}),
      };
    } catch {
      return createDefaultCategoriasState();
    }
  });
  const [ambientesAtivos, setAmbientesAtivos] = useState(() => {
    try {
      const raw = localStorage.getItem(AMBIENTES_NOTIFICACAO_KEY);
      if (!raw) return createDefaultAmbientesState();
      const parsed = JSON.parse(raw);
      return {
        ...createDefaultAmbientesState(),
        ...(parsed || {}),
      };
    } catch {
      return createDefaultAmbientesState();
    }
  });
  const queryClient = useQueryClient();

  useEffect(() => {
    localStorage.setItem(CATEGORIAS_NOTIFICACAO_KEY, JSON.stringify(categoriasAtivas));
  }, [categoriasAtivas]);

  useEffect(() => {
    localStorage.setItem(AMBIENTES_NOTIFICACAO_KEY, JSON.stringify(ambientesAtivos));
  }, [ambientesAtivos]);

  const { data: notificacoes = [] } = useQuery({
    queryKey: ['notificacoes', user?.email],
    queryFn: async () => {
      const todas = await base44.entities.Notificacao.list('-created_date');
      return todas.filter(n => 
        n.destinatario_email === user?.email || 
        n.destinatario_cargo === user?.cargo
      );
    },
    refetchInterval: 5000,
    enabled: !!user
  });

  const marcarLidaMutation = useMutation({
    mutationFn: (id) => base44.entities.Notificacao.update(id, {
      lida: true,
      data_leitura: new Date().toISOString()
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notificacoes'] })
  });

  const deletarMutation = useMutation({
    mutationFn: (id) => base44.entities.Notificacao.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notificacoes'] })
  });

  const notificacoesFiltradas = notificacoes.filter((n) => {
    const categoria = resolveConfiguredValue(getCategoriaFromNotification(n), CATEGORIAS_NOTIFICACAO_PRODUTO);
    const ambiente = resolveConfiguredValue(getAmbienteFromNotification(n), AMBIENTES_NOTIFICACAO_PRODUTO);

    const categoriaAtiva = !categoria || categoriasAtivas[categoria] !== false;
    const ambienteAtivo = !ambiente || ambientesAtivos[ambiente] !== false;

    return categoriaAtiva && ambienteAtivo;
  });

  const naoLidas = notificacoesFiltradas.filter(n => !n.lida);

  const toggleCategoria = (categoria) => {
    setCategoriasAtivas((prev) => ({
      ...prev,
      [categoria]: prev[categoria] === false,
    }));
  };

  const toggleAmbiente = (ambiente) => {
    setAmbientesAtivos((prev) => ({
      ...prev,
      [ambiente]: prev[ambiente] === false,
    }));
  };

  const getIcon = (tipo) => {
    switch(tipo) {
      case 'nova_entrega': return <Truck className="w-4 h-4 text-blue-600" />;
      case 'entrega_concluida': return <Check className="w-4 h-4 text-green-600" />;
      case 'problema_entrega': return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'alteracao_rota': return <Package className="w-4 h-4 text-orange-600" />;
      case 'atraso': return <AlertCircle className="w-4 h-4 text-yellow-600" />;
      default: return <Bell className="w-4 h-4 text-gray-600" />;
    }
  };

  const getPrioridadeCor = (prioridade) => {
    switch(prioridade) {
      case 'urgente': return 'bg-red-100 border-red-300';
      case 'alta': return 'bg-orange-100 border-orange-300';
      case 'media': return 'bg-blue-100 border-blue-300';
      default: return 'bg-gray-100 border-gray-300';
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {naoLidas.length > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500 text-white text-[10px]">
              {naoLidas.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-bold text-sm">Notificações</h3>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => setShowCategoriaManager((prev) => !prev)}
            >
              Categorias
            </Button>
            {naoLidas.length > 0 && (
              <Badge variant="outline">{naoLidas.length} novas</Badge>
            )}
          </div>
        </div>
        {showCategoriaManager && (
          <div className="border-b px-4 py-3">
            <p className="text-[11px] text-gray-500 mb-2">Gerenciar categorias de produto nas notificações</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIAS_NOTIFICACAO_PRODUTO.map((categoria) => (
                <button
                  key={categoria}
                  type="button"
                  onClick={() => toggleCategoria(categoria)}
                  className={`rounded-full border px-2 py-1 text-[10px] transition-colors ${
                    categoriasAtivas[categoria] !== false
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                      : 'border-gray-300 bg-gray-100 text-gray-500'
                  }`}
                >
                  {categoria}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-500 mt-3 mb-2">Gerenciar ambientes de produto nas notificações</p>
            <div className="flex flex-wrap gap-2">
              {AMBIENTES_NOTIFICACAO_PRODUTO.map((ambiente) => (
                <button
                  key={ambiente}
                  type="button"
                  onClick={() => toggleAmbiente(ambiente)}
                  className={`rounded-full border px-2 py-1 text-[10px] transition-colors ${
                    ambientesAtivos[ambiente] !== false
                      ? 'border-sky-300 bg-sky-50 text-sky-800'
                      : 'border-gray-300 bg-gray-100 text-gray-500'
                  }`}
                >
                  {ambiente}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="max-h-[400px] overflow-y-auto">
          {notificacoesFiltradas.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Bell className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">Nenhuma notificação</p>
            </div>
          ) : (
            notificacoesFiltradas.map(notif => (
              <Card 
                key={notif.id}
                className={`m-2 p-3 border-l-4 ${getPrioridadeCor(notif.prioridade)} ${
                  notif.lida ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{getIcon(notif.tipo)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-bold text-sm">{notif.titulo}</p>
                        <p className="text-xs text-gray-600 mt-0.5">{notif.mensagem}</p>
                        {notif.numero_pedido && (
                          <p className="text-xs text-blue-600 mt-1">Pedido #{notif.numero_pedido}</p>
                        )}
                        <p className="text-[10px] text-gray-400 mt-1">
                          {new Date(notif.created_date).toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {!notif.lida && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => marcarLidaMutation.mutate(notif.id)}
                          >
                            <Check className="w-3 h-3" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => deletarMutation.mutate(notif.id)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}