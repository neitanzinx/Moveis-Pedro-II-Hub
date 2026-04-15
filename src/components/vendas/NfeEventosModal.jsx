import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck, ShieldX } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

const TIPOS_EVENTO = {
  cancelamento: 'Cancelamento',
  carta_correcao: 'Carta de Correcao (CC-e)',
  inutilizacao: 'Inutilizacao de Numeracao',
};

function statusBadge(status) {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'pendente_aprovacao') return <Badge className="bg-yellow-500 text-white">Pendente aprovacao</Badge>;
  if (normalized === 'aprovado') return <Badge className="bg-blue-600 text-white">Aprovado</Badge>;
  if (normalized === 'reprovado') return <Badge className="bg-red-600 text-white">Reprovado</Badge>;
  if (normalized === 'executando') return <Badge className="bg-orange-500 text-white">Executando</Badge>;
  if (normalized === 'executado') return <Badge className="bg-green-600 text-white">Executado</Badge>;
  if (normalized === 'erro_execucao') return <Badge className="bg-red-700 text-white">Erro execucao</Badge>;
  return <Badge variant="outline">{status || 'Sem status'}</Badge>;
}

export default function NfeEventosModal({ isOpen, onClose, venda, nfeRef, ambiente = 'homologacao', onUpdated }) {
  const { user, can } = useAuth();
  const [loading, setLoading] = useState(false);
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [tipoEvento, setTipoEvento] = useState('cancelamento');
  const [justificativa, setJustificativa] = useState('');
  const [descricaoCorrecao, setDescricaoCorrecao] = useState('');
  const [motivoReprovacao, setMotivoReprovacao] = useState('');
  const [inutilizacao, setInutilizacao] = useState({
    cnpj: '',
    ano: new Date().getFullYear() % 100,
    serie: 1,
    numero_inicial: '',
    numero_final: '',
    justificativa: '',
  });
  const [diasDesdeAutorizacao, setDiasDesdeAutorizacao] = useState(null);

  const permsByTipo = {
    cancelamento: {
      solicitar: can('solicitar_cancelamento_nfe') || can('solicitar_nfe'),
      aprovar: can('aprovar_cancelamento_nfe') || can('aprovar_nfe') || can('cancelar_nfe'),
    },
    carta_correcao: {
      solicitar: can('solicitar_cce_nfe') || can('solicitar_nfe'),
      aprovar: can('aprovar_cce_nfe') || can('aprovar_nfe') || can('corrigir_nfe'),
    },
    inutilizacao: {
      solicitar: can('solicitar_inutilizacao_nfe') || can('solicitar_nfe'),
      aprovar: can('aprovar_inutilizacao_nfe') || can('aprovar_nfe'),
    },
  };

  const podeSolicitar = permsByTipo[tipoEvento]?.solicitar;
  const podeAprovar = permsByTipo[tipoEvento]?.aprovar;

  const solicitacaoPendente = useMemo(() => {
    return solicitacoes.find((s) => s.status_solicitacao === 'pendente_aprovacao');
  }, [solicitacoes]);

  const carregarSolicitacoes = async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      let query = supabase
        .from('nfe_eventos_solicitacoes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);

      if (nfeRef) {
        query = query.eq('nfe_ref', nfeRef);
      } else if (venda?.id) {
        query = query.eq('venda_id', venda.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setSolicitacoes(data || []);
    } catch (err) {
      toast.error(`Erro ao carregar solicitacoes: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const carregarPrazoAviso = async () => {
    if (!isOpen || !nfeRef) {
      setDiasDesdeAutorizacao(null);
      return;
    }

    const { data } = await supabase
      .from('notas_fiscais_emitidas')
      .select('data_autorizacao')
      .eq('nuvem_fiscal_id', nfeRef)
      .maybeSingle();

    if (!data?.data_autorizacao) {
      setDiasDesdeAutorizacao(null);
      return;
    }

    const diffMs = Date.now() - new Date(data.data_autorizacao).getTime();
    setDiasDesdeAutorizacao(Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  };

  useEffect(() => {
    if (!isOpen) return;
    carregarSolicitacoes();
    carregarPrazoAviso();
  }, [isOpen, nfeRef, venda?.id]);

  const acionarWorkflow = async (body) => {
    const { data, error } = await supabase.functions.invoke('gerir-evento-nfe', { body });
    if (error || !data?.success) throw new Error(data?.error || error?.message || 'Erro desconhecido');
    return data;
  };

  const handleSolicitar = async () => {
    if (!podeSolicitar) return;

    try {
      setLoading(true);

      const body = {
        acao: 'solicitar',
        tipo_evento: tipoEvento,
        venda_id: venda?.id,
        nfe_ref: nfeRef || venda?.nfe_ref || null,
        organization_id: venda?.organization_id,
        user_id: user?.id,
        ambiente,
        justificativa: tipoEvento === 'cancelamento' ? justificativa : undefined,
        descricao_correcao: tipoEvento === 'carta_correcao' ? descricaoCorrecao : undefined,
        inutilizacao: tipoEvento === 'inutilizacao' ? inutilizacao : undefined,
      };

      await acionarWorkflow(body);
      toast.success('Solicitacao registrada para aprovacao.');
      setJustificativa('');
      setDescricaoCorrecao('');
      setMotivoReprovacao('');
      await carregarSolicitacoes();
      onUpdated?.();
    } catch (err) {
      toast.error(`Falha ao solicitar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAprovar = async (solicitacaoId) => {
    try {
      setLoading(true);
      await acionarWorkflow({
        acao: 'aprovar',
        tipo_evento: tipoEvento,
        solicitacao_id: solicitacaoId,
        user_id: user?.id,
      });
      toast.success('Solicitacao aprovada.');
      await carregarSolicitacoes();
      onUpdated?.();
    } catch (err) {
      toast.error(`Falha ao aprovar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReprovar = async (solicitacaoId) => {
    try {
      setLoading(true);
      await acionarWorkflow({
        acao: 'reprovar',
        tipo_evento: tipoEvento,
        solicitacao_id: solicitacaoId,
        user_id: user?.id,
        motivo_reprovacao: motivoReprovacao,
      });
      toast.success('Solicitacao reprovada.');
      setMotivoReprovacao('');
      await carregarSolicitacoes();
      onUpdated?.();
    } catch (err) {
      toast.error(`Falha ao reprovar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExecutar = async (solicitacao) => {
    try {
      setLoading(true);
      await acionarWorkflow({
        acao: 'executar',
        tipo_evento: solicitacao.tipo_evento,
        solicitacao_id: solicitacao.id,
        user_id: user?.id,
      });
      toast.success('Evento executado com sucesso.');
      await carregarSolicitacoes();
      onUpdated?.();
    } catch (err) {
      toast.error(`Falha na execucao: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const solicitacoesFiltradas = solicitacoes.filter((s) => s.tipo_evento === tipoEvento);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gestao de Eventos NF-e</DialogTitle>
          <DialogDescription>
            Solicite, aprove e execute eventos fiscais (cancelamento, CC-e e inutilizacao) em fluxo controlado.
          </DialogDescription>
        </DialogHeader>

        {diasDesdeAutorizacao != null && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5" />
            <div>
              Esta NF-e foi autorizada ha {diasDesdeAutorizacao} dia(s). Prazo legal de 30 dias para cancelamento/CC-e pode se aplicar.
            </div>
          </div>
        )}

        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>Tipo de Evento</Label>
            <Select value={tipoEvento} onValueChange={setTipoEvento}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cancelamento">Cancelamento</SelectItem>
                <SelectItem value="carta_correcao">Carta de Correcao (CC-e)</SelectItem>
                <SelectItem value="inutilizacao">Inutilizacao de Numeracao</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {tipoEvento === 'cancelamento' && (
            <div className="space-y-2">
              <Label>Justificativa do Cancelamento</Label>
              <Textarea
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                rows={3}
                placeholder="Minimo de 15 caracteres"
              />
            </div>
          )}

          {tipoEvento === 'carta_correcao' && (
            <div className="space-y-2">
              <Label>Descricao da Correcao (CC-e)</Label>
              <Textarea
                value={descricaoCorrecao}
                onChange={(e) => setDescricaoCorrecao(e.target.value)}
                rows={3}
                placeholder="Minimo de 15 caracteres"
              />
            </div>
          )}

          {tipoEvento === 'inutilizacao' && (
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Label>CNPJ</Label>
                <Input value={inutilizacao.cnpj} onChange={(e) => setInutilizacao((p) => ({ ...p, cnpj: e.target.value }))} />
              </div>
              <div>
                <Label>Ano (2 digitos)</Label>
                <Input value={inutilizacao.ano} onChange={(e) => setInutilizacao((p) => ({ ...p, ano: e.target.value }))} />
              </div>
              <div>
                <Label>Serie</Label>
                <Input value={inutilizacao.serie} onChange={(e) => setInutilizacao((p) => ({ ...p, serie: e.target.value }))} />
              </div>
              <div>
                <Label>Numero inicial</Label>
                <Input value={inutilizacao.numero_inicial} onChange={(e) => setInutilizacao((p) => ({ ...p, numero_inicial: e.target.value }))} />
              </div>
              <div>
                <Label>Numero final</Label>
                <Input value={inutilizacao.numero_final} onChange={(e) => setInutilizacao((p) => ({ ...p, numero_final: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <Label>Justificativa</Label>
                <Textarea
                  value={inutilizacao.justificativa}
                  onChange={(e) => setInutilizacao((p) => ({ ...p, justificativa: e.target.value }))}
                  rows={2}
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              onClick={handleSolicitar}
              disabled={loading || !podeSolicitar || (tipoEvento !== 'inutilizacao' && !nfeRef)}
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Solicitar {TIPOS_EVENTO[tipoEvento]}
            </Button>
            {!podeSolicitar && <span className="text-xs text-red-600">Seu perfil nao pode solicitar eventos fiscais.</span>}
            {tipoEvento !== 'inutilizacao' && !nfeRef && <span className="text-xs text-red-600">NF-e sem referencia (nfe_ref).</span>}
          </div>

          <div className="border rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Historico ({TIPOS_EVENTO[tipoEvento]})</h4>
              {solicitacaoPendente && <Badge className="bg-yellow-500 text-white">Ha solicitacao pendente</Badge>}
            </div>

            {solicitacoesFiltradas.length === 0 && (
              <p className="text-xs text-gray-500">Nenhuma solicitacao registrada para este tipo.</p>
            )}

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {solicitacoesFiltradas.map((s) => (
                <div key={s.id} className="border rounded-md p-2 text-xs space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{new Date(s.created_at).toLocaleString('pt-BR')}</div>
                    <div>{statusBadge(s.status_solicitacao)}</div>
                  </div>

                  <div className="text-gray-600">Solicitante: {s.solicitante_nome || '-'}</div>
                  {s.aprovador_nome && <div className="text-gray-600">Aprovador: {s.aprovador_nome}</div>}
                  {s.reprovado_motivo && <div className="text-red-700">Motivo: {s.reprovado_motivo}</div>}
                  {s.mensagem_status && <div className="text-gray-700">{s.mensagem_status}</div>}

                  <div className="flex gap-2 flex-wrap">
                    {podeAprovar && s.status_solicitacao === 'pendente_aprovacao' && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => handleAprovar(s.id)} disabled={loading}>
                          <ShieldCheck className="w-3 h-3 mr-1" /> Aprovar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleReprovar(s.id)} disabled={loading || motivoReprovacao.trim().length < 5}>
                          <ShieldX className="w-3 h-3 mr-1" /> Reprovar
                        </Button>
                      </>
                    )}

                    {podeAprovar && s.status_solicitacao === 'aprovado' && (
                      <Button size="sm" onClick={() => handleExecutar(s)} disabled={loading}>
                        {loading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
                        Executar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {podeAprovar && (
              <div className="space-y-1">
                <Label>Motivo da Reprovacao (min 5)</Label>
                <Input
                  value={motivoReprovacao}
                  onChange={(e) => setMotivoReprovacao(e.target.value)}
                  placeholder="Informe o motivo"
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
