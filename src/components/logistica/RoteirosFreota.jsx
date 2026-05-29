import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Truck, User, Phone, MapPin, Package, ChevronDown, ChevronUp,
  CheckCircle2, Clock, Navigation, AlertCircle, Wrench, FileText,
  PhoneCall, Banknote, MessageSquare, Info, GripVertical
} from "lucide-react";
import { isStatusCancelado } from "@/utils/vendaStatus";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

// ─── Helpers ────────────────────────────────────────────────────────────────

const hojeStr = () => new Date().toISOString().split("T")[0];

const formatarTelefoneLink = (tel) => {
  if (!tel) return null;
  const digits = tel.replace(/\D/g, "");
  return `https://wa.me/55${digits}`;
};

const formatarValor = (valor) => {
  const num = Number(valor);
  if (isNaN(num)) return "—";
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const statusConfig = {
  Entregue: { label: "Entregue", color: "bg-green-100 text-green-800 border-green-200" },
  "Em rota": { label: "Em rota", color: "bg-blue-100 text-blue-800 border-blue-200" },
  "A caminho": { label: "A caminho", color: "bg-blue-100 text-blue-800 border-blue-200" },
  "Próxima parada": { label: "Próxima parada", color: "bg-sky-100 text-sky-800 border-sky-200" },
  Pendente: { label: "Pendente", color: "bg-gray-100 text-gray-700 border-gray-200" },
  default: { label: "Pendente", color: "bg-gray-100 text-gray-700 border-gray-200" },
};

const getStatusConfig = (status) => {
  if (!status) return statusConfig.default;
  if (isStatusCancelado(status)) return { label: status, color: "bg-red-100 text-red-700 border-red-200" };
  return statusConfig[status] || statusConfig.default;
};

const turnoOrder = { "Manhã": 0, "Tarde": 1, "Comercial": 2 };
const sortTurnos = (a, b) => (turnoOrder[a] ?? 9) - (turnoOrder[b] ?? 9);

const moverItem = (arr, from, to) => {
  const novo = [...arr];
  const [item] = novo.splice(from, 1);
  novo.splice(to, 0, item);
  return novo;
};

// ─── Card de Detalhe de Entrega (expansível) ────────────────────────────────

function EntregaDetalhe({ entrega, venda, cliente, posicao, total, modoReorganizar = false, onDragStart, onDragOver, onDrop }) {
  const [aberto, setAberto] = useState(false);
  const st = getStatusConfig(entrega.status);
  const entregue = entrega.status === "Entregue";

  // Itens do pedido
  const itens = Array.isArray(venda?.itens) ? venda.itens : [];

  // Contatos alternativos do cliente (JSONB array)
  const contatosExtras = Array.isArray(cliente?.contatos) ? cliente.contatos : [];

  // Endereço formatado
  const enderecoPartes = [
    entrega.endereco_entrega_rua,
    entrega.endereco_entrega_numero && `Nº ${entrega.endereco_entrega_numero}`,
    entrega.endereco_entrega_complemento,
    entrega.endereco_entrega_bairro,
    entrega.endereco_entrega_cidade && entrega.endereco_entrega_estado
      ? `${entrega.endereco_entrega_cidade}/${entrega.endereco_entrega_estado}`
      : entrega.endereco_entrega_cidade || entrega.endereco_entrega_estado,
  ].filter(Boolean);
  const enderecoFormatado = enderecoPartes.join(", ") || entrega.endereco_entrega || "Endereço não informado";
  const mapsLink = enderecoFormatado !== "Endereço não informado"
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoFormatado)}`
    : null;

  return (
    <div
      className={`rounded-xl border transition-all duration-200 ${entregue
        ? "bg-green-50 border-green-200 opacity-80"
        : "bg-white border-gray-200 hover:border-gray-300 shadow-sm"
        }`}
    >
      {/* Cabeçalho do card – clicável para expandir */}
      <button
        className="w-full text-left p-4 flex items-start gap-3"
        onClick={() => !modoReorganizar && setAberto((v) => !v)}
        aria-expanded={aberto}
      >
        {modoReorganizar && (
          <span
            draggable
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onClick={(e) => e.preventDefault()}
            className="flex-shrink-0 mt-1 p-2 rounded-md border border-dashed border-gray-300 text-gray-400 hover:text-gray-600 hover:border-gray-400 cursor-grab active:cursor-grabbing"
            title="Arraste para reordenar"
          >
            <GripVertical className="w-4 h-4" />
          </span>
        )}

        {/* Posição na rota */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${entregue ? "bg-green-200 text-green-800" : "bg-gray-100 text-gray-700"
          }`}>
          {entregue ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : posicao}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-semibold text-gray-900 truncate">
              {entrega.cliente_nome || "Cliente não informado"}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${st.color}`}>
              {st.label}
            </span>
            {entrega.pagamento_na_entrega && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                <Banknote className="w-3 h-3" />
                Cobrança
              </span>
            )}
            {(entrega.tipo_montagem === "externa" || entrega.tipo_montagem === "terceirizada") && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
                <Wrench className="w-3 h-3" />
                Montagem
              </span>
            )}
          </div>

          <p className="text-xs text-gray-500 truncate flex items-center gap-1">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            {enderecoFormatado}
          </p>

          {entrega.cliente_telefone && (
            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
              <Phone className="w-3 h-3 flex-shrink-0" />
              {entrega.cliente_telefone}
            </p>
          )}
        </div>

        {/* Ícone expandir */}
        {!modoReorganizar && (
          <div className="flex-shrink-0 text-gray-400 mt-1">
            {aberto ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        )}
      </button>

      {/* Detalhes expandidos */}
      {aberto && !modoReorganizar && (
        <div className="px-4 pb-4 border-t border-gray-100 mt-0 pt-4 space-y-4">
          {/* Bloco: Cliente & Contatos */}
          <Section icon={<User className="w-4 h-4" />} titulo="Cliente e Contatos">
            <Linha rotulo="Nome" valor={entrega.cliente_nome || cliente?.nome_completo || "—"} />
            <Linha rotulo="N° Pedido" valor={entrega.numero_pedido || venda?.numero_pedido || "—"} />

            {/* Telefone principal */}
            {entrega.cliente_telefone && (
              <div className="flex items-center justify-between py-1 border-b border-gray-50">
                <span className="text-xs text-gray-500">Telefone Principal</span>
                <a
                  href={formatarTelefoneLink(entrega.cliente_telefone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs font-medium text-green-700 hover:underline"
                >
                  <PhoneCall className="w-3 h-3" />
                  {entrega.cliente_telefone}
                </a>
              </div>
            )}

            {/* Telefone alternativo do cliente */}
            {cliente?.telefone_alternativo && (
              <div className="flex items-center justify-between py-1 border-b border-gray-50">
                <span className="text-xs text-gray-500">Contato Alternativo</span>
                <a
                  href={formatarTelefoneLink(cliente.telefone_alternativo)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs font-medium text-green-700 hover:underline"
                >
                  <PhoneCall className="w-3 h-3" />
                  {cliente.telefone_alternativo}
                </a>
              </div>
            )}

            {/* Contatos extras (JSONB) */}
            {contatosExtras.map((contato, i) => (
              <div key={i} className="flex items-center justify-between py-1 border-b border-gray-50">
                <span className="text-xs text-gray-500">
                  {contato.nome || contato.tipo || `Contato ${i + 1}`}
                </span>
                {contato.telefone ? (
                  <a
                    href={formatarTelefoneLink(contato.telefone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs font-medium text-green-700 hover:underline"
                  >
                    <PhoneCall className="w-3 h-3" />
                    {contato.telefone}
                  </a>
                ) : (
                  <span className="text-xs text-gray-700">{contato.email || "—"}</span>
                )}
              </div>
            ))}

            {/* Email */}
            {cliente?.email && (
              <Linha rotulo="E-mail" valor={cliente.email} />
            )}
          </Section>

          {/* Bloco: Endereço */}
          <Section icon={<MapPin className="w-4 h-4" />} titulo="Endereço de Entrega">
            {entrega.endereco_entrega_cep && (
              <Linha rotulo="CEP" valor={entrega.endereco_entrega_cep} />
            )}
            <Linha rotulo="Endereço" valor={enderecoFormatado} />
            {entrega.endereco_entrega_ponto_referencia && (
              <div className="mt-1 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs font-semibold text-amber-800 mb-0.5">Ponto de Referência</p>
                <p className="text-xs text-amber-900">{entrega.endereco_entrega_ponto_referencia}</p>
              </div>
            )}
            {mapsLink && (
              <a
                href={mapsLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1"
              >
                <Navigation className="w-3 h-3" />
                Abrir no Google Maps
              </a>
            )}
          </Section>

          {/* Bloco: Itens do Pedido */}
          {itens.length > 0 && (
            <Section icon={<Package className="w-4 h-4" />} titulo={`Itens do Pedido (${itens.length})`}>
              <div className="space-y-1">
                {itens.map((item, i) => (
                  <div key={i} className="flex items-start justify-between text-xs py-1 border-b border-gray-50 last:border-0">
                    <span className="text-gray-800 flex-1 pr-2">
                      {item.descricao || item.nome || item.produto_nome || `Item ${i + 1}`}
                    </span>
                    <span className="text-gray-500 flex-shrink-0">
                      {item.quantidade > 1 ? `${item.quantidade}x ` : ""}
                      {item.valor_unitario ? formatarValor(item.valor_unitario) : ""}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Bloco: Pagamento */}
          {(entrega.pagamento_na_entrega || entrega.valor_a_receber > 0 || venda?.forma_pagamento) && (
            <Section icon={<Banknote className="w-4 h-4" />} titulo="Pagamento">
              {entrega.pagamento_na_entrega && (
                <div className="mb-1 px-2 py-1 bg-amber-100 rounded text-xs font-semibold text-amber-900">
                  Pagamento a ser recebido na entrega
                </div>
              )}
              {entrega.valor_a_receber > 0 && (
                <Linha rotulo="Valor a Receber" valor={formatarValor(entrega.valor_a_receber)} destaque />
              )}
              {(entrega.forma_pagamento_entrega || venda?.forma_pagamento) && (
                <Linha rotulo="Forma de Pagamento" valor={entrega.forma_pagamento_entrega || venda?.forma_pagamento} />
              )}
              {venda?.valor_total && (
                <Linha rotulo="Total do Pedido" valor={formatarValor(venda.valor_total)} />
              )}
            </Section>
          )}

          {/* Bloco: Montagem */}
          {entrega.tipo_montagem && entrega.tipo_montagem !== "sem_montagem" && entrega.tipo_montagem !== "" && (
            <Section icon={<Wrench className="w-4 h-4" />} titulo="Montagem">
              <Linha rotulo="Tipo" valor={entrega.tipo_montagem} />
              {entrega.montagem_status && (
                <Linha rotulo="Status" valor={entrega.montagem_status} />
              )}
              {entrega.montagem_concluida_em && (
                <Linha rotulo="Concluída em" valor={new Date(entrega.montagem_concluida_em).toLocaleString("pt-BR")} />
              )}
            </Section>
          )}

          {/* Bloco: Observações */}
          {(entrega.observacoes || venda?.observacoes) && (
            <Section icon={<MessageSquare className="w-4 h-4" />} titulo="Observações">
              {entrega.observacoes && (
                <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-900">
                  <span className="font-semibold">Entrega: </span>{entrega.observacoes}
                </div>
              )}
              {venda?.observacoes && (
                <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 mt-1">
                  <span className="font-semibold">Pedido: </span>{venda.observacoes}
                </div>
              )}
            </Section>
          )}

          {/* Bloco: NF / NFe */}
          {(venda?.nfe_numero || venda?.nfe_chave || venda?.nfe_status) && (
            <Section icon={<FileText className="w-4 h-4" />} titulo="Nota Fiscal">
              {venda.nfe_numero && <Linha rotulo="Número NF" valor={venda.nfe_numero} />}
              {venda.nfe_status && <Linha rotulo="Status NF" valor={venda.nfe_status} />}
              {venda.nfe_chave && (
                <div className="mt-1">
                  <p className="text-xs text-gray-500 mb-0.5">Chave de Acesso</p>
                  <p className="text-xs font-mono text-gray-700 break-all">{venda.nfe_chave}</p>
                </div>
              )}
            </Section>
          )}

          {/* Bloco: Restrição / Reagendamento */}
          {entrega.motivo_restricao && (
            <Section icon={<AlertCircle className="w-4 h-4 text-orange-600" />} titulo="Restrição de Entrega">
              <div className="p-2 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-900">
                {entrega.motivo_restricao}
              </div>
              {entrega.data_restricao && (
                <Linha rotulo="Data Alternativa" valor={new Date(entrega.data_restricao + "T00:00:00").toLocaleDateString("pt-BR")} />
              )}
              {entrega.turno_restricao && (
                <Linha rotulo="Turno Alternativo" valor={entrega.turno_restricao} />
              )}
            </Section>
          )}

          {/* Comprovante entregue */}
          {entregue && entrega.data_hora_entrega && (
            <div className="flex items-center gap-2 p-2 bg-green-100 rounded-lg">
              <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
              <p className="text-xs text-green-800 font-medium">
                Entregue em {new Date(entrega.data_hora_entrega).toLocaleString("pt-BR")}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sub-componentes utilitários ────────────────────────────────────────────

function Section({ icon, titulo, children }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-gray-500">{icon}</span>
        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{titulo}</p>
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Linha({ rotulo, valor, destaque = false }) {
  return (
    <div className="flex items-start justify-between py-1 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-500 mr-2 flex-shrink-0">{rotulo}</span>
      <span className={`text-xs text-right ${destaque ? "font-bold text-gray-900" : "font-medium text-gray-800"}`}>
        {valor || "—"}
      </span>
    </div>
  );
}

// ─── Card do Caminhão ────────────────────────────────────────────────────────

function CardCaminhao({
  caminhao,
  entregasDoCaminhao,
  vendas,
  clientes,
  modoReorganizar,
  obterEntregasOrdenadas,
  onDragStart,
  onDragOver,
  onDrop
}) {
  const [turnoAberto, setTurnoAberto] = useState(null);

  // Agrupar por turno
  const porTurno = entregasDoCaminhao.reduce((acc, e) => {
    const turno = e.turno || "Comercial";
    if (!acc[turno]) acc[turno] = [];
    acc[turno].push(e);
    return acc;
  }, {});

  const turnos = Object.keys(porTurno).sort(sortTurnos);

  // Quando só há 1 turno, abrimos por padrão
  const turnoUnico = turnos.length === 1 ? turnos[0] : null;
  const turnoAtivo = turnoAberto ?? turnoUnico;

  const totalEntregas = entregasDoCaminhao.length;
  const totalEntregues = entregasDoCaminhao.filter((e) => e.status === "Entregue").length;
  const progresso = totalEntregas > 0 ? Math.round((totalEntregues / totalEntregas) * 100) : 0;
  const emTransito = caminhao?.status_rota === "Em Trânsito";

  const vendaMap = Object.fromEntries((vendas || []).map((v) => [v.id, v]));
  const clienteMap = Object.fromEntries((clientes || []).map((c) => [c.id, c]));

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      {/* Cabeçalho do caminhão */}
      <CardHeader className={`pb-3 ${emTransito ? "bg-green-50 border-b border-green-100" : "bg-gray-50 border-b border-gray-100"}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${emTransito ? "bg-green-100" : "bg-gray-200"}`}>
              <Truck className={`w-5 h-5 ${emTransito ? "text-green-700" : "text-gray-600"}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">
                  {caminhao?.placa || caminhao?.nome || "Caminhão sem placa"}
                </CardTitle>
                {emTransito && (
                  <span className="flex items-center gap-1 text-xs font-medium text-green-700">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    Em Trânsito
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {caminhao?.modelo || ""}
                {caminhao?.motorista_atual_nome && (
                  <> &bull; <User className="w-3 h-3 inline mx-0.5" />{caminhao.motorista_atual_nome}</>
                )}
                {!caminhao?.motorista_atual_nome && caminhao?.motorista_nome && (
                  <> &bull; <User className="w-3 h-3 inline mx-0.5" />{caminhao.motorista_nome}</>
                )}
              </p>
            </div>
          </div>

          {/* Progresso */}
          <div className="text-right flex-shrink-0">
            <p className="text-sm font-bold text-gray-900">{totalEntregues}/{totalEntregas}</p>
            <p className="text-xs text-gray-500">entregas</p>
          </div>
        </div>

        {/* Barra de progresso */}
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Progresso da rota</span>
            <span>{progresso}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${progresso === 100 ? "bg-green-500" : "bg-blue-500"}`}
              style={{ width: `${progresso}%` }}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {turnos.map((turno) => {
          const entregasBase = porTurno[turno].sort(
            (a, b) => (a.ordem_rota ?? 999) - (b.ordem_rota ?? 999)
          );
          const routeKey = `${caminhao?.id || "__sem_caminhao__"}::${turno}`;
          const entregasTurno = obterEntregasOrdenadas(routeKey, entregasBase);
          const aberto = turnoAtivo === turno;
          const entreguesTurno = entregasTurno.filter((e) => e.status === "Entregue").length;

          return (
            <div key={turno} className="border-b border-gray-100 last:border-0">
              {/* Header do turno (clicável se houver múltiplos turnos) */}
              <button
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                onClick={() => setTurnoAberto(aberto && turnos.length > 1 ? null : turno)}
                disabled={turnos.length === 1}
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-semibold text-gray-800">Turno {turno}</span>
                  <span className="text-xs text-gray-500">
                    {entreguesTurno}/{entregasTurno.length} entregues
                  </span>
                </div>
                {turnos.length > 1 && (
                  aberto ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {/* Lista de entregas */}
              {aberto && (
                <div className="px-4 pb-4 space-y-2">
                  {modoReorganizar && (
                    <div className="text-[11px] text-gray-500 mb-1">
                      Arraste pelas 3 barras para reorganizar a sequência da rota.
                    </div>
                  )}
                  {entregasTurno.map((entrega, i) => {
                    const venda = vendaMap[entrega.venda_id] || null;
                    const cliente = clienteMap[venda?.cliente_id] || null;
                    return (
                      <EntregaDetalhe
                        key={entrega.id}
                        entrega={entrega}
                        venda={venda}
                        cliente={cliente}
                        posicao={i + 1}
                        total={entregasTurno.length}
                        modoReorganizar={modoReorganizar}
                        onDragStart={(e) => onDragStart(e, routeKey, entrega.id)}
                        onDragOver={(e) => onDragOver(e, routeKey)}
                        onDrop={(e) => onDrop(e, routeKey, entrega.id)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function RoteirosFreota({ entregas = [], vendas = [], caminhoes = [], clientes = [] }) {
  const hoje = hojeStr();
  const queryClient = useQueryClient();
  const [modoReorganizar, setModoReorganizar] = useState(false);
  const [dragState, setDragState] = useState(null);
  const [ordemManualPorRota, setOrdemManualPorRota] = useState({});

  // Filtrar entregas de hoje (excluir canceladas)
  const entregasHoje = entregas.filter(
    (e) => e.data_agendada?.startsWith(hoje) && !isStatusCancelado(e.status)
  );

  // Agrupar por caminhao_id
  const porCaminhao = entregasHoje.reduce((acc, e) => {
    const cid = e.caminhao_id || "__sem_caminhao__";
    if (!acc[cid]) acc[cid] = [];
    acc[cid].push(e);
    return acc;
  }, {});

  // Ordenar caminhões: primeiro os em trânsito
  const caminhaoMap = Object.fromEntries(caminhoes.map((c) => [c.id, c]));
  const idsComEntregas = Object.keys(porCaminhao).filter((id) => id !== "__sem_caminhao__");
  const idsOrdenados = [...idsComEntregas].sort((a, b) => {
    const cA = caminhaoMap[a];
    const cB = caminhaoMap[b];
    const aTransito = cA?.status_rota === "Em Trânsito" ? 0 : 1;
    const bTransito = cB?.status_rota === "Em Trânsito" ? 0 : 1;
    return aTransito - bTransito;
  });

  const semCaminhao = porCaminhao["__sem_caminhao__"] || [];

  const obterEntregasOrdenadas = (routeKey, entregasBase) => {
    const ordemManual = ordemManualPorRota[routeKey];
    if (!Array.isArray(ordemManual) || ordemManual.length === 0) return entregasBase;

    const entregaMap = Object.fromEntries(entregasBase.map((e) => [e.id, e]));
    const ordenadas = ordemManual
      .map((id) => entregaMap[id])
      .filter(Boolean);

    const restantes = entregasBase.filter((e) => !ordemManual.includes(e.id));
    return [...ordenadas, ...restantes];
  };

  const persistirNovaOrdem = async (routeKey, novaOrdemIds, entregasBase) => {
    const entregaMap = Object.fromEntries(entregasBase.map((e) => [e.id, e]));
    const payload = novaOrdemIds
      .map((id, idx) => {
        const entrega = entregaMap[id];
        if (!entrega) return null;
        return { id: entrega.id, ordem_rota: idx + 1 };
      })
      .filter(Boolean);

    if (payload.length === 0) return;

    try {
      await Promise.all(payload.map((item) => base44.entities.Entrega.update(item.id, { ordem_rota: item.ordem_rota })));
      queryClient.invalidateQueries({ queryKey: ["entregas"] });
      toast.success("Ordem das paradas atualizada");
    } catch (error) {
      console.error("Erro ao reorganizar paradas:", error);
      setOrdemManualPorRota((prev) => {
        const copia = { ...prev };
        delete copia[routeKey];
        return copia;
      });
      toast.error("Nao foi possivel salvar a nova ordem das paradas");
    }
  };

  const iniciarDrag = (event, routeKey, entregaId) => {
    event.dataTransfer.effectAllowed = "move";
    setDragState({ routeKey, entregaId });
  };

  const permitirDrop = (event, routeKey) => {
    if (!dragState || dragState.routeKey !== routeKey) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const finalizarDrop = async (event, routeKey, targetId) => {
    if (!dragState || dragState.routeKey !== routeKey) return;
    event.preventDefault();

    const entregasBase = entregasHoje
      .filter((e) => `${e.caminhao_id || "__sem_caminhao__"}::${e.turno || "Comercial"}` === routeKey)
      .sort((a, b) => (a.ordem_rota ?? 999) - (b.ordem_rota ?? 999));

    const entregasOrdenadas = obterEntregasOrdenadas(routeKey, entregasBase);
    const fromIndex = entregasOrdenadas.findIndex((e) => e.id === dragState.entregaId);
    const toIndex = entregasOrdenadas.findIndex((e) => e.id === targetId);

    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
      setDragState(null);
      return;
    }

    const novaOrdemEntregas = moverItem(entregasOrdenadas, fromIndex, toIndex);
    const novaOrdemIds = novaOrdemEntregas.map((e) => e.id);

    setOrdemManualPorRota((prev) => ({
      ...prev,
      [routeKey]: novaOrdemIds
    }));

    setDragState(null);
    await persistirNovaOrdem(routeKey, novaOrdemIds, entregasBase);
  };

  // Totais gerais
  const totalHoje = entregasHoje.length;
  const totalEntregues = entregasHoje.filter((e) => e.status === "Entregue").length;
  const totalEmRota = entregasHoje.filter((e) => ["Em rota", "A caminho", "Próxima parada"].includes(e.status)).length;
  const totalPendentes = entregasHoje.filter((e) => !["Entregue"].includes(e.status) && !isStatusCancelado(e.status)).length;
  const caminhoesEmTransito = caminhoes.filter((c) => c.status_rota === "Em Trânsito").length;

  if (totalHoje === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <Truck className="w-16 h-16 mb-4 opacity-20" />
        <p className="text-lg font-medium">Nenhuma entrega agendada para hoje</p>
        <p className="text-sm mt-1">As entregas aparecerão aqui quando forem planejadas no Kanban.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Barra de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard
          icon={<Truck className="w-5 h-5 text-blue-600" />}
          bg="bg-blue-50"
          label="Caminhões em rota"
          value={`${caminhoesEmTransito} / ${idsOrdenados.length}`}
        />
        <SummaryCard
          icon={<CheckCircle2 className="w-5 h-5 text-green-600" />}
          bg="bg-green-50"
          label="Entregues hoje"
          value={`${totalEntregues} / ${totalHoje}`}
        />
        <SummaryCard
          icon={<Navigation className="w-5 h-5 text-sky-600" />}
          bg="bg-sky-50"
          label="Em deslocamento"
          value={totalEmRota}
        />
        <SummaryCard
          icon={<Clock className="w-5 h-5 text-orange-600" />}
          bg="bg-orange-50"
          label="Pendentes"
          value={totalPendentes}
        />
      </div>

      {/* Atualização em tempo real */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          Atualização automática a cada 5 segundos
        </div>
        <Button
          variant={modoReorganizar ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setModoReorganizar((prev) => {
              if (prev) setDragState(null);
              return !prev;
            });
          }}
          className="gap-2"
        >
          <GripVertical className="w-4 h-4" />
          {modoReorganizar ? "Concluir reorganização" : "Reorganizar paradas"}
        </Button>
      </div>

      {/* Cards por caminhão */}
      <div className="space-y-4">
        {idsOrdenados.map((cid) => (
          <CardCaminhao
            key={cid}
            caminhao={caminhaoMap[cid] || null}
            entregasDoCaminhao={porCaminhao[cid]}
            vendas={vendas}
            clientes={clientes}
            modoReorganizar={modoReorganizar}
            obterEntregasOrdenadas={obterEntregasOrdenadas}
            onDragStart={iniciarDrag}
            onDragOver={permitirDrop}
            onDrop={finalizarDrop}
          />
        ))}

        {/* Entregas sem caminhão atribuído */}
        {semCaminhao.length > 0 && (
          <Card className="border-0 shadow-sm border-l-4 border-l-orange-400">
            <CardHeader className="pb-2 bg-orange-50 border-b border-orange-100">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-orange-600" />
                <CardTitle className="text-base text-orange-800">
                  Sem caminhão atribuído ({semCaminhao.length})
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              {obterEntregasOrdenadas(
                "__sem_caminhao__::Comercial",
                semCaminhao.sort((a, b) => (a.ordem_rota ?? 999) - (b.ordem_rota ?? 999))
              ).map((entrega, i) => {
                  const vendaMap2 = Object.fromEntries((vendas || []).map((v) => [v.id, v]));
                  const clienteMap2 = Object.fromEntries((clientes || []).map((c) => [c.id, c]));
                  const venda = vendaMap2[entrega.venda_id] || null;
                  const cliente = clienteMap2[venda?.cliente_id] || null;
                  return (
                    <EntregaDetalhe
                      key={entrega.id}
                      entrega={entrega}
                      venda={venda}
                      cliente={cliente}
                      posicao={i + 1}
                      total={semCaminhao.length}
                      modoReorganizar={modoReorganizar}
                      onDragStart={(e) => iniciarDrag(e, "__sem_caminhao__::Comercial", entrega.id)}
                      onDragOver={(e) => permitirDrop(e, "__sem_caminhao__::Comercial")}
                      onDrop={(e) => finalizarDrop(e, "__sem_caminhao__::Comercial", entrega.id)}
                    />
                  );
                })}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ icon, bg, label, value }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${bg}`}>{icon}</div>
          <div>
            <p className="text-xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
