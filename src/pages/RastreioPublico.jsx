import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { getZapApiUrl } from "@/utils/zapApiUrl";
import MapaRota from "@/components/entregador/MapaRota";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck, MapPin, Package, AlertCircle, Clock, Smartphone, Hash } from "lucide-react";

export default function RastreioPublico({ idProp }) {
    const params = useParams();
    const idUrlOriginal = idProp || params.id || (window.location.pathname.split('/').pop() !== 'rastreio' ? window.location.pathname.split('/').pop() : null);
    const tokenUrl = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('token') : null;

    const [termoBusca, setTermoBusca] = useState("");
    const [confirmacaoTelefone, setConfirmacaoTelefone] = useState("");
    const [etapa, setEtapa] = useState("busca"); // "busca", "confirmacao", "detalhes"
    const [entrega, setEntrega] = useState(null);
    const [loading, setLoading] = useState(false);
    const [pesquisando, setPesquisando] = useState(false);
    const [erro, setErro] = useState(null);
    const [localizacaoMotorista, setLocalizacaoMotorista] = useState(null);
    const [paradasNaFrente, setParadasNaFrente] = useState(null);
    const [organizacao, setOrganizacao] = useState({
        name: "Móveis Pedro II",
        logo_url: null,
        primary_color: "#16a34a", // green-600
        secondary_color: "#f38a4c"
    });

    // Busca dados da organização para branding
    useEffect(() => {
        async function fetchBranding() {
            try {
                const { data } = await supabase
                    .from("organizations")
                    .select("name, logo_url, primary_color, secondary_color")
                    .limit(1)
                    .single();

                if (data) {
                    setOrganizacao({
                        name: data.name || "Móveis Pedro II",
                        logo_url: data.logo_url,
                        primary_color: data.primary_color || "#16a34a",
                        secondary_color: data.secondary_color || "#f38a4c"
                    });
                }
            } catch (err) {
                console.error("Erro branding:", err);
            }
        }
        fetchBranding();
    }, []);

    // Formatação de telefone em tempo real
    function formatarTelefone(valor) {
        const v = valor.replace(/\D/g, '');
        if (v.length <= 10) {
            return v.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
        }
        return v.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
    }

    // Busca inicial pelo número do pedido ou ID
    async function handleBuscarPedido(e, searchId = null) {
        if (e) e.preventDefault();
        
        const searchValue = searchId || termoBusca.trim();
        if (!searchValue) return;

        setErro(null);
        setPesquisando(true);

        try {
            // Se foi passado um ID da URL, busca direto pelo ID (Primary Key)
            // Se foi digitado na tela, busca pelo numero_pedido
            const query = searchId 
                ? supabase.from("entregas").select("*").eq("id", searchId)
                : supabase.from("entregas").select("*").eq("numero_pedido", searchValue);

            const { data, error } = await query
                .order('id', { ascending: false })
                .limit(1)
                .single();

            if (error || !data) {
                setErro("Pedido não encontrado. Verifique o número digitado.");
                return;
            }

            setEntrega(data);
            setEtapa("confirmacao");
        } catch (err) {
            console.error("Erro na busca:", err);
            setErro("Erro ao realizar a busca. Tente novamente.");
        } finally {
            setPesquisando(false);
        }
    }

    async function validarTokenRastreio(token) {
        setErro(null);
        setLoading(true);

        try {
            const apiUrl = getZapApiUrl();
            const response = await fetch(`${apiUrl}/api/tracking/validate?token=${encodeURIComponent(token)}`);
            const data = await response.json().catch(() => ({}));

            if (!response.ok || !data?.ok || !data?.entrega) {
                throw new Error(data?.error || 'Link de rastreio inválido ou expirado');
            }

            setEntrega(data.entrega);
            setParadasNaFrente(typeof data.paradasNaFrente === 'number' ? data.paradasNaFrente : 0);

            if (data.localizacaoMotorista?.lat && data.localizacaoMotorista?.lng) {
                setLocalizacaoMotorista({
                    lat: data.localizacaoMotorista.lat,
                    lng: data.localizacaoMotorista.lng
                });
            }

            setEtapa('detalhes');
        } catch (err) {
            console.error('Erro ao validar token de rastreio:', err);
            setErro(err.message || 'Link de rastreio inválido ou expirado.');
            setEtapa('busca');
        } finally {
            setLoading(false);
        }
    }

    // Efeito para auto-preencher se houver ID na URL
    useEffect(() => {
        if (etapa !== "busca" || entrega) return;

        if (tokenUrl) {
            validarTokenRastreio(tokenUrl);
            return;
        }

        if (idUrlOriginal) {
            handleBuscarPedido(null, idUrlOriginal);
        }
    }, [idUrlOriginal, tokenUrl, etapa, entrega]);

    // Verificação do telefone
    async function handleConfirmarTelefone(e) {
        if (e) e.preventDefault();
        const telLimpoDigitado = confirmacaoTelefone.replace(/\D/g, '');
        const telLimpoBanco = (entrega.cliente_telefone || "").replace(/\D/g, '');

        // Comparação robusta: compara os últimos 8 dígitos (o "corpo" do número)
        // Isso resolve o problema de ter ou não o dígito 9 extra, código de país ou DDD.
        const matches = (telLimpoDigitado.length >= 8 && telLimpoBanco.length >= 8) &&
            (telLimpoDigitado.slice(-8) === telLimpoBanco.slice(-8));

        if (!matches) {
            setErro("Telefone incorreto. Verifique o número e tente novamente.");
            return;
        }

        setErro(null);
        setLoading(true);
        await processarEntregaEncontrada(entrega);
        setEtapa("detalhes");
        setLoading(false);
    }

    async function processarEntregaEncontrada(dadosEntrega) {
        const statusNormalizado = (dadosEntrega.status || "").trim().toLowerCase();
        const statusAtivos = ["a caminho", "em rota", "próxima parada", "próximo"];

        if (["entregue", "cancelada", "cancelado", "pendente", "agendada", "agendado", "finalizada"].includes(statusNormalizado)) {
            return;
        }

        if (!statusAtivos.includes(statusNormalizado)) {
            return;
        }

        if (dadosEntrega.caminhao_id) {
            try {
                const dataBase = dadosEntrega.data_agendada ? dadosEntrega.data_agendada.split('T')[0] : null;

                let query = supabase
                    .from("entregas")
                    .select("id, status, ordem_rota, dt_agendada:data_agendada, turnoTr:turno")
                    .eq("caminhao_id", dadosEntrega.caminhao_id)
                    .not("status", "in", '("Entregue","Cancelada","Cancelado","Finalizada")');

                if (dataBase) {
                    query = query.gte("data_agendada", `${dataBase}T00:00:00`)
                        .lte("data_agendada", `${dataBase}T23:59:59`);
                }

                if (dadosEntrega.turno) {
                    query = query.eq("turno", dadosEntrega.turno);
                }

                const { data: routeDeliveries, error: routeError } = await query;

                if (!routeError && routeDeliveries) {
                    const sortedDeliveries = [...routeDeliveries].sort((a, b) => (a.ordem_rota || 99) - (b.ordem_rota || 99));
                    const minhaPosicaoIdx = sortedDeliveries.findIndex(d => d.id === dadosEntrega.id);

                    if (minhaPosicaoIdx > 0) {
                        setParadasNaFrente(minhaPosicaoIdx);
                    } else if (minhaPosicaoIdx === 0) {
                        setParadasNaFrente(0);
                        if (!["próxima parada", "em rota", "a caminho"].includes(dadosEntrega.status?.toLowerCase())) {
                            dadosEntrega.status = 'Próxima parada';
                        }
                        setEntrega({ ...dadosEntrega });
                        await buscarLocalizacaoAtual(dadosEntrega.caminhao_id);
                    }
                } else {
                    if (["próxima parada", "a caminho", "em rota"].includes(dadosEntrega.status?.toLowerCase())) {
                        setParadasNaFrente(0);
                        await buscarLocalizacaoAtual(dadosEntrega.caminhao_id);
                    }
                }
            } catch (filaErr) {
                console.error("Erro ao calcular fila:", filaErr);
            }
        }
    }

    async function buscarLocalizacaoAtual(caminhaoId) {
        const { data: veiculo } = await supabase
            .from("caminhoes")
            .select("latitude, longitude, ultima_atualizacao")
            .eq("id", caminhaoId)
            .single();

        if (veiculo) {
            setLocalizacaoMotorista({
                lat: veiculo.latitude,
                lng: veiculo.longitude
            });
        }
    }

    useEffect(() => {
        let interval;
        if (entrega && paradasNaFrente === 0 && entrega.caminhao_id) {
            interval = setInterval(() => {
                buscarLocalizacaoAtual(entrega.caminhao_id);
            }, 30000);
        }
        return () => { if (interval) clearInterval(interval); };
    }, [entrega, paradasNaFrente]);

    // Máscara para o telefone no DB (exibe apenas os últimos 4 dígitos)
    const renderMascaraTelefone = (tel) => {
        if (!tel) return "";
        const limpo = tel.replace(/\D/g, '');
        const ultimos = limpo.slice(-4);
        return `(XX) *****-${ultimos}`;
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="animate-pulse flex flex-col items-center">
                {organizacao.logo_url ? (
                    <img src={organizacao.logo_url} alt="Logo" className="w-20 h-20 object-contain mb-4" />
                ) : (
                    <Truck className="w-12 h-12 mb-4" style={{ color: organizacao.primary_color }} />
                )}
                <p className="text-gray-500">Localizando informações...</p>
            </div>
        </div>
    );

    return (
        <div
            className="min-h-screen bg-gray-50 p-4 md:p-8"
            style={{
                "--primary": organizacao.primary_color,
                "--secondary": organizacao.secondary_color
            }}
        >
            <div className="max-w-2xl mx-auto space-y-4">
                <div className="flex items-center justify-center flex-col gap-3 mb-8 mt-4 text-center">
                    {organizacao.logo_url ? (
                        <div className="relative">
                            <img
                                src={organizacao.logo_url}
                                alt={organizacao.name}
                                className="h-20 md:h-24 w-auto object-contain drop-shadow-md"
                            />
                        </div>
                    ) : (
                        <div className="p-3 rounded-full shadow-lg" style={{ backgroundColor: organizacao.primary_color }}>
                            <Truck className="w-8 h-8 text-white" />
                        </div>
                    )}
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{organizacao.name}</h1>
                        <p className="text-sm text-gray-500 mt-1">Rastreamento de Entregas</p>
                    </div>
                </div>

                {etapa === "busca" && (
                    <Card className="shadow-lg border-green-100">
                        <CardHeader className="text-center pb-2">
                            <CardTitle className="text-xl">Encontre seu pedido</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <form onSubmit={handleBuscarPedido} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 block flex items-center gap-2">
                                        <Hash className="w-4 h-4" style={{ color: organizacao.primary_color }} /> Número do Pedido
                                    </label>
                                    <input
                                        type="text"
                                        value={termoBusca}
                                        onChange={(e) => setTermoBusca(e.target.value)}
                                        placeholder="Ex: 10001"
                                        className="w-full text-center p-3 border rounded-lg transition-all outline-none font-bold text-lg focus:ring-2"
                                        style={{ "--tw-ring-color": organizacao.primary_color, borderColor: "var(--tw-ring-color)" }}
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={pesquisando || !termoBusca.trim()}
                                    className="w-full text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50 flex justify-center items-center gap-2 shadow-md hover:brightness-110"
                                    style={{ backgroundColor: organizacao.primary_color }}
                                >
                                    {pesquisando ? (
                                        <><div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> Buscando pedido...</>
                                    ) : (
                                        <>Continuar</>
                                    )}
                                </button>

                                {erro && (
                                    <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm flex items-start gap-2 mt-4 animate-in fade-in">
                                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                                        <span>{erro}</span>
                                    </div>
                                )}
                            </form>
                        </CardContent>
                    </Card>
                )}

                {etapa === "confirmacao" && (
                    <Card className="shadow-lg border-green-100 animate-in slide-in-from-right-4">
                        <CardHeader className="text-center pb-2">
                            <CardTitle className="text-xl">Confirme sua Identidade</CardTitle>
                            <p className="text-sm text-muted-foreground">Para sua segurança, informe o telefone cadastrado no pedido #{entrega.numero_pedido}</p>
                        </CardHeader>
                        <CardContent className="space-y-4 text-center">
                            <div
                                className="p-3 rounded-lg inline-block border mb-2"
                                style={{ backgroundColor: `${organizacao.primary_color}10`, borderColor: `${organizacao.primary_color}30` }}
                            >
                                <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: organizacao.primary_color }}>Telefone Vinculado</p>
                                <p className="text-lg font-mono font-bold" style={{ color: organizacao.primary_color }}>{renderMascaraTelefone(entrega.cliente_telefone)}</p>
                            </div>

                            <form onSubmit={handleConfirmarTelefone} className="space-y-4">
                                <div className="space-y-2 text-left">
                                    <label className="text-sm font-medium text-gray-700 block flex items-center gap-2">
                                        <Smartphone className="w-4 h-4" style={{ color: organizacao.primary_color }} /> Seu número completo
                                    </label>
                                    <input
                                        type="text"
                                        value={confirmacaoTelefone}
                                        onChange={(e) => setConfirmacaoTelefone(formatarTelefone(e.target.value))}
                                        placeholder="(XX) XXXXX-XXXX"
                                        className="w-full text-center p-3 border rounded-lg transition-all outline-none font-bold text-lg focus:ring-2"
                                        style={{ "--tw-ring-color": organizacao.primary_color, borderColor: "var(--tw-ring-color)" }}
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => { setEtapa("busca"); setErro(null); setConfirmacaoTelefone(""); }}
                                        className="w-full bg-gray-100 text-gray-600 font-bold py-3 rounded-lg hover:bg-gray-200 transition-colors"
                                    >
                                        Voltar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={confirmacaoTelefone.replace(/\D/g, '').length < 8}
                                        className="w-full text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50 shadow-md hover:brightness-110"
                                        style={{ backgroundColor: organizacao.primary_color }}
                                    >
                                        Verificar e Acessar
                                    </button>
                                </div>

                                {erro && (
                                    <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm flex items-start gap-2 mt-4 animate-in fade-in">
                                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                                        <span>{erro}</span>
                                    </div>
                                )}
                            </form>
                        </CardContent>
                    </Card>
                )}

                {etapa === "detalhes" && entrega && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                        <button
                            onClick={() => { setEntrega(null); setEtapa("busca"); setErro(null); setConfirmacaoTelefone(""); setTermoBusca(""); }}
                            className="text-sm font-medium bg-white px-4 py-2 rounded-full shadow-sm inline-flex items-center w-fit transition-colors mb-2 hover:brightness-95"
                            style={{ color: organizacao.primary_color }}
                        >
                            ← Logout / Nova pesquisa
                        </button>
                        {(() => {
                            const statusAtualLow = (entrega.status || "").trim().toLowerCase();
                            return (
                                <Card className="shadow-lg">
                                    <CardHeader className="pb-4 border-b">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <CardTitle className="text-lg">Pedido #{entrega.numero_pedido}</CardTitle>
                                                <p className="text-sm text-gray-500 mt-1 uppercase tracking-wide">{entrega.cliente_nome}</p>
                                            </div>
                                            <Badge
                                                className="text-white px-3 py-1 shadow-sm"
                                                style={{
                                                    backgroundColor: statusAtualLow === "entregue" ? "#10b981" :
                                                        (statusAtualLow === "cancelada" || statusAtualLow === "cancelado") ? "#ef4444" :
                                                            statusAtualLow === "pendente" || statusAtualLow === "agendada" || statusAtualLow === "agendado" ? "#f59e0b" :
                                                                organizacao.primary_color
                                                }}
                                            >
                                                {statusAtualLow === 'entregue' ? 'Entrega Concluída' : entrega.status}
                                            </Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-6 pt-6">

                                        {statusAtualLow === "entregue" || statusAtualLow === "finalizada" ? (
                                            <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-xl flex flex-col items-center justify-center text-center space-y-3">
                                                <div className="bg-emerald-100 p-3 rounded-full">
                                                    <Package className="w-8 h-8 text-emerald-600" />
                                                </div>
                                                <div>
                                                    <h3 className="text-emerald-800 font-bold text-lg">Entrega Concluída</h3>
                                                    <p className="text-sm text-emerald-600 mt-1">Seu pedido foi entregue com sucesso.</p>
                                                </div>
                                            </div>
                                        ) : (["cancelada", "cancelado", "pendente", "agendada", "agendado"].includes(statusAtualLow)) ? (
                                            <div className="bg-amber-50 border border-amber-200 p-6 rounded-xl flex flex-col items-center justify-center text-center space-y-3">
                                                <div className="bg-amber-100 p-3 rounded-full">
                                                    <Clock className="w-8 h-8 text-amber-600" />
                                                </div>
                                                <div>
                                                    <h3 className="text-amber-800 font-bold text-lg">
                                                        {["agendada", "agendado"].includes(statusAtualLow) ? "Entrega Agendada" :
                                                            ["cancelado", "cancelada"].includes(statusAtualLow) ? "Entrega Cancelada" :
                                                                `Entrega ${entrega.status}`}
                                                    </h3>
                                                    <p className="text-sm text-amber-600 mt-1">
                                                        {["agendada", "agendado"].includes(statusAtualLow) ? "Seu pedido está agendado e aguardando o início da rota." :
                                                            "Sua entrega não está na rota de hoje ou foi cancelada."}
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                {paradasNaFrente > 0 ? (
                                                    <div className="bg-blue-50 border border-blue-200 p-6 rounded-xl flex flex-col items-center justify-center text-center space-y-3">
                                                        <div className="bg-blue-100 p-3 rounded-full">
                                                            <Truck className="w-8 h-8 text-blue-600" />
                                                        </div>
                                                        <div>
                                                            <h3 className="text-blue-800 font-bold text-lg">O caminhão está a caminho!</h3>
                                                            <div className="mt-2 text-blue-900 border border-blue-100 px-4 py-2 rounded-full font-semibold bg-white shadow-sm inline-block">
                                                                Faltam <span className="text-xl text-blue-600 mx-1">{paradasNaFrente}</span> parada(s) antes da sua
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : paradasNaFrente === 0 ? (
                                                    <div className="space-y-3">
                                                        <div
                                                            className="border p-4 rounded-xl flex items-center justify-center gap-3 text-center"
                                                            style={{ backgroundColor: `${organizacao.primary_color}10`, borderColor: `${organizacao.primary_color}30` }}
                                                        >
                                                            <div className="relative flex h-3 w-3">
                                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: organizacao.primary_color }}></span>
                                                                <span className="relative inline-flex rounded-full h-3 w-3" style={{ backgroundColor: organizacao.primary_color }}></span>
                                                            </div>
                                                            <span className="font-bold text-sm uppercase tracking-wider" style={{ color: organizacao.primary_color }}>Você é a nossa próxima parada!</span>
                                                        </div>

                                                        <div className="rounded-xl overflow-hidden border shadow-inner bg-gray-100 relative h-64 md:h-80 w-full z-0">
                                                            {localizacaoMotorista ? (
                                                                <MapaRota
                                                                    entregas={[entrega]}
                                                                    entregaAtual={entrega}
                                                                    localizacaoAtual={localizacaoMotorista}
                                                                />
                                                            ) : (
                                                                <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                                                                    <MapPin className="w-8 h-8 mb-2 animate-bounce" />
                                                                    <p className="text-sm">Buscando sinal do GPS...</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="bg-gray-50 border p-6 rounded-xl text-center">
                                                        <Truck className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                                        <p className="text-gray-600">Seu pedido está carregado no caminhão.</p>
                                                    </div>
                                                )}
                                            </>
                                        )}

                                        <div className="space-y-4 pt-4 border-t border-gray-100">
                                            <div className="flex flex-col gap-1 p-3 bg-gray-50 rounded-lg">
                                                <p className="text-[10px] text-gray-500 uppercase font-bold flex items-center gap-1.5"><MapPin className="w-3 h-3" /> Destino</p>
                                                <p className="text-sm font-medium text-gray-900">{entrega.endereco_entrega || "Endereço cadastrado"}</p>
                                            </div>
                                            <div className="flex flex-col gap-1 p-3 bg-gray-50 rounded-lg">
                                                <p className="text-[10px] text-gray-500 uppercase font-bold flex items-center gap-1.5"><Clock className="w-3 h-3" /> Agendamento</p>
                                                <p className="text-sm font-medium text-gray-900">
                                                    {entrega.data_agendada ? new Date(entrega.data_agendada).toLocaleDateString('pt-BR') : "Sem data"}
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })()}
                    </div>
                )}

                <p className="text-center text-[10px] text-gray-400 uppercase tracking-widest mt-8 pb-8">
                    {organizacao.name} • CNPJ 12.345.678/0001-90
                </p>
            </div>
        </div>
    );
}
