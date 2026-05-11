import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/base44Client";
import { adicionarCoroas } from "@/utils/fidelidadeEngine";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
    Plus, Pencil, Trash2, Loader2, Crown, Gift,
    Save, Sparkles, ArrowRight, AlertCircle,
    ShoppingBag, Coins, Percent, DollarSign, Truck,
    Package, Users, Calendar, Star, Clock, Target,
    Megaphone, History, Search, Settings2
} from "lucide-react";

const REWARD_TYPES = [
    { value: "cupom_percentual", label: "Cupom % Desconto", icon: Percent },
    { value: "cupom_valor",      label: "Cupom R$ Desconto", icon: DollarSign },
    { value: "frete_gratis",     label: "Frete Gratis",       icon: Truck },
    { value: "item_gratis",      label: "Item Gratis",         icon: Gift },
    { value: "cashback",         label: "Cashback",            icon: Coins },
    { value: "desconto_proximo", label: "Desconto Proxima Compra", icon: ShoppingBag },
];

const UNIDADES = [
    { value: "horas",   label: "Horas" },
    { value: "dias",    label: "Dias" },
    { value: "semanas", label: "Semanas" },
    { value: "meses",   label: "Meses" },
    { value: "anos",    label: "Anos" },
];

const TIER_CORES = {
    0: { bg: "bg-gray-100", text: "text-gray-600", border: "border-gray-300" },
    1: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-300" },
    2: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-300" },
    3: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-300" },
};

export default function FidelidadeRegras() {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState("compras");
    const [savingConfig, setSavingConfig] = useState(false);
    const [isRewardModalOpen, setIsRewardModalOpen] = useState(false);
    const [isTierModalOpen, setIsTierModalOpen] = useState(false);
    const [editingTier, setEditingTier] = useState(null);
    const [isCatModalOpen, setIsCatModalOpen] = useState(false);
    const [campanhaClienteQ, setCampanhaClienteQ] = useState("");
    const [campanhaFiltroTier, setCampanhaFiltroTier] = useState("todos");
    const [campanhaQtd, setCampanhaQtd] = useState("");
    const [campanhaMotivo, setCampanhaMotivo] = useState("");
    const [campanhaLoading, setCampanhaLoading] = useState(false);

    const [config, setConfig] = useState({
        purchase_value_threshold: 50, steps_per_purchase: 10, signup_bonus: 5, is_active: true,
        reward_threshold: 100, desconto_por_coroa: 0.10,
        aniversario_ativo: false, aniversario_coroas: 50,
        indicacao_ativo: false, indicacao_coroas: 30,
        avaliacao_ativo: false, avaliacao_coroas: 10,
        frequencia_ativo: false, frequencia_coroas: 20, frequencia_minima: 2,
        produto_especifico_ativo: false,
        pagamento_avista_ativo: false, pagamento_avista_coroas: 10,
        expiracao_ativo: false, expiracao_valor: 12, expiracao_unidade: "meses",
    });

    const [rewardForm, setRewardForm] = useState({
        nome: "", reward_type: "cupom_percentual", value: "",
        coroas_necessarias: "", desconta_coroas: true, expiracao_dias: 30, mensagem_cliente: ""
    });

    const [tierForm, setTierForm] = useState({ nome: "", coroas_minimas: 0, multiplicador_coroas: 1.0, ordem: 1 });
    const [catForm, setCatForm] = useState({ categoria: "", coroas_bonus: 10, multiplicador: 1.0 });

    // --- Queries ---
    const { data: configData, isLoading: loadingConfig } = useQuery({
        queryKey: ["fidelidade_config"],
        queryFn: async () => {
            const { data, error } = await supabase.from("fidelidade_config").select("*").eq("is_active", true).maybeSingle();
            if (error && error.code !== "PGRST116") throw error;
            return data;
        },
    });

    React.useEffect(() => { if (configData) setConfig(prev => ({ ...prev, ...configData })); }, [configData]);

    const { data: rewards = [], isLoading: loadingRewards } = useQuery({
        queryKey: ["fidelidade_rewards_catalog"],
        queryFn: async () => {
            const { data, error } = await supabase.from("fidelidade_recompensas")
                .select("*, fidelidade_regras (id, nome, is_active)")
                .gt("coroas_necessarias", 0).order("coroas_necessarias", { ascending: true });
            if (error) throw error;
            return data || [];
        },
    });

    const { data: tiers = [], isLoading: loadingTiers } = useQuery({
        queryKey: ["fidelidade_tiers"],
        queryFn: async () => {
            const { data, error } = await supabase.from("fidelidade_tiers")
                .select("*").order("ordem", { ascending: true });
            if (error) throw error;
            return data || [];
        },
    });

    const { data: categoriasBonus = [] } = useQuery({
        queryKey: ["fidelidade_categorias_bonus"],
        queryFn: async () => {
            const { data, error } = await supabase.from("fidelidade_categorias_bonus")
                .select("*").order("categoria");
            if (error) throw error;
            return data || [];
        },
    });

    const { data: historicoCampanha = [] } = useQuery({
        queryKey: ["fidelidade_historico_campanha"],
        queryFn: async () => {
            const { data, error } = await supabase.from("fidelidade_historico")
                .select("*, clientes (nome_completo)")
                .eq("tipo_evento", "campanha")
                .order("created_at", { ascending: false }).limit(50);
            if (error) throw error;
            return data || [];
        },
    });

    const { data: clientesCampanha = [] } = useQuery({
        queryKey: ["clientes_campanha", campanhaClienteQ, campanhaFiltroTier],
        queryFn: async () => {
            if (!campanhaClienteQ && campanhaFiltroTier === "todos") return [];
            let q = supabase.from("clientes").select("id, nome_completo, coroas, tier_id");
            if (campanhaClienteQ) q = q.ilike("nome_completo", `%${campanhaClienteQ}%`);
            if (campanhaFiltroTier !== "todos") q = q.eq("tier_id", campanhaFiltroTier);
            const { data } = await q.limit(20);
            return data || [];
        },
        enabled: !!(campanhaClienteQ || campanhaFiltroTier !== "todos"),
    });

    // --- Mutations ---
    const saveConfig = async () => {
        setSavingConfig(true);
        try {
            const { error } = await supabase.from("fidelidade_config").upsert({
                id: config.id || 1,
                purchase_value_threshold: parseFloat(config.purchase_value_threshold) || 50,
                steps_per_purchase: parseInt(config.steps_per_purchase) || 10,
                signup_bonus: parseInt(config.signup_bonus) || 5,
                is_active: config.is_active,
                reward_threshold: parseInt(config.reward_threshold) || 100,
                desconto_por_coroa: parseFloat(config.desconto_por_coroa) || 0.10,
                aniversario_ativo: config.aniversario_ativo,
                aniversario_coroas: parseInt(config.aniversario_coroas) || 50,
                indicacao_ativo: config.indicacao_ativo,
                indicacao_coroas: parseInt(config.indicacao_coroas) || 30,
                avaliacao_ativo: config.avaliacao_ativo,
                avaliacao_coroas: parseInt(config.avaliacao_coroas) || 10,
                frequencia_ativo: config.frequencia_ativo,
                frequencia_coroas: parseInt(config.frequencia_coroas) || 20,
                frequencia_minima: parseInt(config.frequencia_minima) || 2,
                produto_especifico_ativo: config.produto_especifico_ativo,
                pagamento_avista_ativo: config.pagamento_avista_ativo,
                pagamento_avista_coroas: parseInt(config.pagamento_avista_coroas) || 10,
                expiracao_ativo: config.expiracao_ativo,
                expiracao_valor: parseInt(config.expiracao_valor) || 12,
                expiracao_unidade: config.expiracao_unidade || "meses",
            });
            if (error) throw error;
            toast.success("Configuracao salva!");
            queryClient.invalidateQueries({ queryKey: ["fidelidade_config"] });
        } catch (err) { toast.error("Erro ao salvar: " + err.message); }
        finally { setSavingConfig(false); }
    };

    const createRewardMutation = useMutation({
        mutationFn: async (data) => {
            const { data: regra, error: re } = await supabase.from("fidelidade_regras")
                .insert({ nome: data.nome, descricao: `Troque ${data.coroas_necessarias} Coroas`, trigger_type: "resgate", is_active: true, priority: 10 })
                .select().single();
            if (re) throw re;
            const { error: rwe } = await supabase.from("fidelidade_recompensas").insert({
                regra_id: regra.id, reward_type: data.reward_type, value: parseFloat(data.value) || 0,
                coroas_necessarias: parseInt(data.coroas_necessarias) || 0, desconta_coroas: data.desconta_coroas,
                expiracao_dias: parseInt(data.expiracao_dias) || 30, mensagem_cliente: data.mensagem_cliente || null
            });
            if (rwe) throw rwe;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["fidelidade_rewards_catalog"] });
            toast.success("Recompensa criada!");
            setIsRewardModalOpen(false);
            setRewardForm({ nome: "", reward_type: "cupom_percentual", value: "", coroas_necessarias: "", desconta_coroas: true, expiracao_dias: 30, mensagem_cliente: "" });
        },
        onError: (err) => toast.error("Erro: " + err.message)
    });

    const deleteRewardMutation = useMutation({
        mutationFn: async (regraId) => {
            const { error } = await supabase.from("fidelidade_regras").delete().eq("id", regraId);
            if (error) throw error;
        },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["fidelidade_rewards_catalog"] }); toast.success("Recompensa excluida!"); }
    });

    const toggleRewardMutation = useMutation({
        mutationFn: async ({ regraId, is_active }) => {
            const { error } = await supabase.from("fidelidade_regras").update({ is_active }).eq("id", regraId);
            if (error) throw error;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["fidelidade_rewards_catalog"] })
    });

    const saveTierMutation = useMutation({
        mutationFn: async (data) => {
            if (data.id) {
                const { error } = await supabase.from("fidelidade_tiers").update({
                    nome: data.nome, coroas_minimas: parseInt(data.coroas_minimas),
                    multiplicador_coroas: parseFloat(data.multiplicador_coroas), ordem: parseInt(data.ordem)
                }).eq("id", data.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from("fidelidade_tiers").insert({
                    nome: data.nome, coroas_minimas: parseInt(data.coroas_minimas),
                    multiplicador_coroas: parseFloat(data.multiplicador_coroas), ordem: parseInt(data.ordem), is_active: true
                });
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["fidelidade_tiers"] });
            toast.success("Tier salvo!");
            setIsTierModalOpen(false);
            setEditingTier(null);
            setTierForm({ nome: "", coroas_minimas: 0, multiplicador_coroas: 1.0, ordem: 1 });
        },
        onError: (err) => toast.error("Erro: " + err.message)
    });

    const deleteTierMutation = useMutation({
        mutationFn: async (id) => { const { error } = await supabase.from("fidelidade_tiers").delete().eq("id", id); if (error) throw error; },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["fidelidade_tiers"] }); toast.success("Tier excluido!"); }
    });

    const saveCatMutation = useMutation({
        mutationFn: async (data) => {
            const { error } = await supabase.from("fidelidade_categorias_bonus").insert({
                categoria: data.categoria, coroas_bonus: parseInt(data.coroas_bonus),
                multiplicador: parseFloat(data.multiplicador) || 1.0, is_active: true
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["fidelidade_categorias_bonus"] });
            toast.success("Categoria adicionada!");
            setIsCatModalOpen(false);
            setCatForm({ categoria: "", coroas_bonus: 10, multiplicador: 1.0 });
        },
        onError: (err) => toast.error("Erro: " + err.message)
    });

    const deleteCatMutation = useMutation({
        mutationFn: async (id) => { const { error } = await supabase.from("fidelidade_categorias_bonus").delete().eq("id", id); if (error) throw error; },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["fidelidade_categorias_bonus"] })
    });

    const handleConcederCoroas = async (clienteId, nome) => {
        if (!campanhaQtd || parseInt(campanhaQtd) === 0) { toast.error("Informe a quantidade de Coroas"); return; }
        if (!campanhaMotivo.trim()) { toast.error("Informe o motivo"); return; }
        setCampanhaLoading(true);
        const resultado = await adicionarCoroas(clienteId, parseInt(campanhaQtd), campanhaMotivo);
        setCampanhaLoading(false);
        if (resultado.sucesso) {
            toast.success(`${campanhaQtd} Coroas concedidas para ${nome}!`);
            queryClient.invalidateQueries({ queryKey: ["fidelidade_historico_campanha"] });
            queryClient.invalidateQueries({ queryKey: ["clientes"] });
        } else {
            toast.error("Erro ao conceder coroas");
        }
    };

    const openEditTier = (tier) => {
        setEditingTier(tier);
        setTierForm({ ...tier });
        setIsTierModalOpen(true);
    };

    const formatReward = (type, value) => {
        if (type === "cupom_percentual") return `${value}% de desconto`;
        if (type === "cupom_valor") return `R$ ${value} de desconto`;
        if (type === "frete_gratis") return "Frete Gratis";
        if (type === "item_gratis") return "Item Gratis";
        if (type === "cashback") return `R$ ${value} de Cashback`;
        if (type === "desconto_proximo") return `${value}% na proxima compra`;
        return `${value}`;
    };

    if (loadingConfig) {
        return <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold" style={{ color: "#07593f" }}>Programa de Fidelidade</h2>
                    <p className="text-sm text-gray-500">Configure como os clientes ganham e resgatam Coroas</p>
                </div>
                <div className="flex items-center gap-2">
                    <Switch checked={config.is_active} onCheckedChange={(v) => setConfig(p => ({ ...p, is_active: v }))} />
                    <span className="text-sm text-gray-600">Programa {config.is_active ? "Ativo" : "Inativo"}</span>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-6 w-full">
                    <TabsTrigger value="compras"><ShoppingBag className="w-4 h-4 mr-1" />Compras</TabsTrigger>
                    <TabsTrigger value="relacionamento"><Users className="w-4 h-4 mr-1" />Relacionamento</TabsTrigger>
                    <TabsTrigger value="tiers"><Crown className="w-4 h-4 mr-1" />Niveis</TabsTrigger>
                    <TabsTrigger value="resgates"><Gift className="w-4 h-4 mr-1" />Resgates</TabsTrigger>
                    <TabsTrigger value="expiracao"><Clock className="w-4 h-4 mr-1" />Expiracao</TabsTrigger>
                    <TabsTrigger value="campanhas"><Megaphone className="w-4 h-4 mr-1" />Campanhas</TabsTrigger>
                </TabsList>

                {/* ============================================================ */}
                {/* TAB 1: COMPRAS                                                 */}
                {/* ============================================================ */}
                <TabsContent value="compras" className="space-y-4 mt-4">
                    <Card className="border-0 shadow">
                        <CardHeader className="border-b bg-amber-50">
                            <div className="flex items-center gap-2">
                                <Coins className="w-5 h-5 text-amber-600" />
                                <CardTitle className="text-amber-800">Coroas por Compra</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            <div className="grid md:grid-cols-3 gap-4">
                                <div>
                                    <Label className="flex items-center gap-2 mb-2">
                                        <DollarSign className="w-4 h-4 text-green-600" />A cada R$
                                    </Label>
                                    <Input type="number" min="1" value={config.purchase_value_threshold}
                                        onChange={(e) => setConfig(p => ({ ...p, purchase_value_threshold: e.target.value }))} />
                                    <p className="text-xs text-gray-500 mt-1">Valor em reais</p>
                                </div>
                                <div>
                                    <Label className="flex items-center gap-2 mb-2">
                                        <Crown className="w-4 h-4 text-amber-500" />Ganha
                                    </Label>
                                    <Input type="number" min="1" value={config.steps_per_purchase}
                                        onChange={(e) => setConfig(p => ({ ...p, steps_per_purchase: e.target.value }))} />
                                    <p className="text-xs text-gray-500 mt-1">Coroas por unidade</p>
                                </div>
                                <div>
                                    <Label className="flex items-center gap-2 mb-2">
                                        <Sparkles className="w-4 h-4 text-purple-500" />Bonus Cadastro
                                    </Label>
                                    <Input type="number" min="0" value={config.signup_bonus}
                                        onChange={(e) => setConfig(p => ({ ...p, signup_bonus: e.target.value }))} />
                                    <p className="text-xs text-gray-500 mt-1">Coroas de boas-vindas</p>
                                </div>
                            </div>

                            <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                                <div className="flex items-center gap-2 mb-1">
                                    <Sparkles className="w-4 h-4 text-green-600" />
                                    <span className="font-medium text-green-800">Exemplo</span>
                                </div>
                                <p className="text-sm text-green-700">
                                    Cliente compra <strong>R$ {(config.purchase_value_threshold * 2) || 100}</strong>
                                    <ArrowRight className="w-3 h-3 inline mx-2" />
                                    Ganha <strong className="text-amber-600">{(config.steps_per_purchase * 2) || 20} Coroas</strong>
                                </p>
                            </div>

                            {/* Bonus pagamento a vista */}
                            <div className="border rounded-xl p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <Coins className="w-4 h-4 text-blue-500" />
                                        <span className="font-medium">Bonus Pagamento a Vista</span>
                                        <Badge variant="secondary" className="text-xs">Dinheiro, Pix, Debito</Badge>
                                    </div>
                                    <Switch checked={config.pagamento_avista_ativo}
                                        onCheckedChange={(v) => setConfig(p => ({ ...p, pagamento_avista_ativo: v }))} />
                                </div>
                                {config.pagamento_avista_ativo && (
                                    <div className="flex items-center gap-3">
                                        <Label className="whitespace-nowrap text-sm">Coroas extras:</Label>
                                        <Input type="number" min="1" className="w-28" value={config.pagamento_avista_coroas}
                                            onChange={(e) => setConfig(p => ({ ...p, pagamento_avista_coroas: e.target.value }))} />
                                    </div>
                                )}
                            </div>

                            {/* Categorias bonus */}
                            <div className="border rounded-xl p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <Package className="w-4 h-4 text-orange-500" />
                                        <span className="font-medium">Categorias com Coroas Extras</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Switch checked={config.produto_especifico_ativo}
                                            onCheckedChange={(v) => setConfig(p => ({ ...p, produto_especifico_ativo: v }))} />
                                        <Button size="sm" variant="outline" onClick={() => setIsCatModalOpen(true)}>
                                            <Plus className="w-3 h-3 mr-1" />Categoria
                                        </Button>
                                    </div>
                                </div>
                                {categoriasBonus.length === 0 ? (
                                    <p className="text-sm text-gray-400 text-center py-2">Nenhuma categoria configurada</p>
                                ) : (
                                    <div className="space-y-2">
                                        {categoriasBonus.map(cat => (
                                            <div key={cat.id} className="flex items-center justify-between bg-orange-50 rounded-lg px-3 py-2">
                                                <div className="flex items-center gap-2">
                                                    <Badge className="bg-orange-200 text-orange-800">{cat.categoria}</Badge>
                                                    <span className="text-sm">+{cat.coroas_bonus} Coroas</span>
                                                    {cat.multiplicador > 1 && <span className="text-xs text-gray-500">x{cat.multiplicador}</span>}
                                                </div>
                                                <Button size="sm" variant="ghost" className="text-red-400 h-6 w-6 p-0"
                                                    onClick={() => deleteCatMutation.mutate(cat.id)}>
                                                    <Trash2 className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex justify-end">
                        <Button onClick={saveConfig} disabled={savingConfig} style={{ backgroundColor: "#07593f" }}>
                            {savingConfig ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            Salvar Configuracoes
                        </Button>
                    </div>
                </TabsContent>

                {/* ============================================================ */}
                {/* TAB 2: RELACIONAMENTO                                         */}
                {/* ============================================================ */}
                <TabsContent value="relacionamento" className="space-y-4 mt-4">
                    <Card className="border-0 shadow">
                        <CardHeader className="border-b bg-blue-50">
                            <div className="flex items-center gap-2">
                                <Users className="w-5 h-5 text-blue-600" />
                                <CardTitle className="text-blue-800">Gatilhos de Relacionamento</CardTitle>
                                <CardDescription>Configure bonus por interacoes alem das compras</CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                            {/* Aniversario */}
                            <div className="border rounded-xl p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-pink-500" />
                                        <span className="font-medium">Aniversario</span>
                                        <span className="text-xs text-gray-500">Uma vez por ano</span>
                                    </div>
                                    <Switch checked={config.aniversario_ativo}
                                        onCheckedChange={(v) => setConfig(p => ({ ...p, aniversario_ativo: v }))} />
                                </div>
                                {config.aniversario_ativo && (
                                    <div className="flex items-center gap-3 mt-2">
                                        <Label className="text-sm whitespace-nowrap">Coroas no mes de aniversario:</Label>
                                        <Input type="number" min="1" className="w-28" value={config.aniversario_coroas}
                                            onChange={(e) => setConfig(p => ({ ...p, aniversario_coroas: e.target.value }))} />
                                    </div>
                                )}
                            </div>

                            {/* Indicacao */}
                            <div className="border rounded-xl p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <Users className="w-4 h-4 text-emerald-500" />
                                        <span className="font-medium">Indicacao de Amigo</span>
                                        <span className="text-xs text-gray-500">Quando o indicado faz a 1a compra</span>
                                    </div>
                                    <Switch checked={config.indicacao_ativo}
                                        onCheckedChange={(v) => setConfig(p => ({ ...p, indicacao_ativo: v }))} />
                                </div>
                                {config.indicacao_ativo && (
                                    <div className="flex items-center gap-3 mt-2">
                                        <Label className="text-sm whitespace-nowrap">Coroas para quem indicou:</Label>
                                        <Input type="number" min="1" className="w-28" value={config.indicacao_coroas}
                                            onChange={(e) => setConfig(p => ({ ...p, indicacao_coroas: e.target.value }))} />
                                    </div>
                                )}
                            </div>

                            {/* Avaliacao */}
                            <div className="border rounded-xl p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <Star className="w-4 h-4 text-yellow-500" />
                                        <span className="font-medium">Avaliacao / Feedback</span>
                                        <span className="text-xs text-gray-500">Cooldown de 30 dias</span>
                                    </div>
                                    <Switch checked={config.avaliacao_ativo}
                                        onCheckedChange={(v) => setConfig(p => ({ ...p, avaliacao_ativo: v }))} />
                                </div>
                                {config.avaliacao_ativo && (
                                    <div className="flex items-center gap-3 mt-2">
                                        <Label className="text-sm whitespace-nowrap">Coroas por avaliacao:</Label>
                                        <Input type="number" min="1" className="w-28" value={config.avaliacao_coroas}
                                            onChange={(e) => setConfig(p => ({ ...p, avaliacao_coroas: e.target.value }))} />
                                    </div>
                                )}
                            </div>

                            {/* Frequencia */}
                            <div className="border rounded-xl p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <Target className="w-4 h-4 text-violet-500" />
                                        <span className="font-medium">Frequencia de Compras</span>
                                        <span className="text-xs text-gray-500">Bonus ao atingir X compras no mes</span>
                                    </div>
                                    <Switch checked={config.frequencia_ativo}
                                        onCheckedChange={(v) => setConfig(p => ({ ...p, frequencia_ativo: v }))} />
                                </div>
                                {config.frequencia_ativo && (
                                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                                        <div className="flex items-center gap-2">
                                            <Label className="text-sm whitespace-nowrap">Minimo de compras no mes:</Label>
                                            <Input type="number" min="2" className="w-20" value={config.frequencia_minima}
                                                onChange={(e) => setConfig(p => ({ ...p, frequencia_minima: e.target.value }))} />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Label className="text-sm whitespace-nowrap">Coroas de bonus:</Label>
                                            <Input type="number" min="1" className="w-24" value={config.frequencia_coroas}
                                                onChange={(e) => setConfig(p => ({ ...p, frequencia_coroas: e.target.value }))} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                    <div className="flex justify-end">
                        <Button onClick={saveConfig} disabled={savingConfig} style={{ backgroundColor: "#07593f" }}>
                            {savingConfig ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            Salvar Configuracoes
                        </Button>
                    </div>
                </TabsContent>

                {/* ============================================================ */}
                {/* TAB 3: NIVEIS (TIERS)                                         */}
                {/* ============================================================ */}
                <TabsContent value="tiers" className="space-y-4 mt-4">
                    <Card className="border-0 shadow">
                        <CardHeader className="border-b flex-row items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Crown className="w-5 h-5 text-amber-500" />
                                <CardTitle style={{ color: "#07593f" }}>Niveis de Clientes</CardTitle>
                            </div>
                            <Button size="sm" onClick={() => { setEditingTier(null); setTierForm({ nome: "", coroas_minimas: 0, multiplicador_coroas: 1.0, ordem: (tiers.length || 0) + 1 }); setIsTierModalOpen(true); }} style={{ backgroundColor: "#07593f" }}>
                                <Plus className="w-4 h-4 mr-1" />Novo Nivel
                            </Button>
                        </CardHeader>
                        <CardContent className="p-4">
                            {loadingTiers ? (
                                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
                            ) : tiers.length === 0 ? (
                                <p className="text-center text-gray-400 py-8">Nenhum nivel cadastrado. Crie o primeiro!</p>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {tiers.map((tier, idx) => {
                                        const cores = TIER_CORES[Math.min(idx, 3)];
                                        return (
                                            <div key={tier.id} className={`relative p-4 rounded-xl border-2 text-center ${cores.bg} ${cores.border}`}>
                                                <h4 className={`font-bold text-lg ${cores.text}`}>{tier.nome}</h4>
                                                <p className="text-xs text-gray-500 mt-1">A partir de</p>
                                                <p className={`text-2xl font-black ${cores.text}`}>{tier.coroas_minimas}</p>
                                                <p className="text-xs text-gray-500">Coroas</p>
                                                <Badge className="mt-2 bg-white border" style={{ color: "#07593f", borderColor: "#07593f" }}>
                                                    {tier.multiplicador_coroas}x multiplicador
                                                </Badge>
                                                <div className="absolute top-2 right-2 flex gap-1">
                                                    <button className="text-gray-400 hover:text-blue-500" onClick={() => openEditTier(tier)}>
                                                        <Pencil className="w-3 h-3" />
                                                    </button>
                                                    <button className="text-gray-400 hover:text-red-500" onClick={() => deleteTierMutation.mutate(tier.id)}>
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            <Alert className="mt-4 bg-blue-50 border-blue-200">
                                <AlertCircle className="w-4 h-4 text-blue-600" />
                                <AlertDescription className="text-sm text-blue-700">
                                    O multiplicador e aplicado automaticamente ao total de Coroas ganhas em compras. Ex: nivel 1.5x = cliente ganha 50% mais Coroas.
                                </AlertDescription>
                            </Alert>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ============================================================ */}
                {/* TAB 4: RESGATES                                               */}
                {/* ============================================================ */}
                <TabsContent value="resgates" className="space-y-4 mt-4">
                    {/* Resgate direto por desconto */}
                    <Card className="border-0 shadow">
                        <CardHeader className="border-b bg-green-50">
                            <div className="flex items-center gap-2">
                                <DollarSign className="w-5 h-5 text-green-600" />
                                <CardTitle className="text-green-800">Desconto por Coroas</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <Label className="mb-2 block">Valor por Coroa (R$)</Label>
                                    <Input type="number" step="0.01" min="0.01" value={config.desconto_por_coroa}
                                        onChange={(e) => setConfig(p => ({ ...p, desconto_por_coroa: e.target.value }))} />
                                    <p className="text-xs text-gray-500 mt-1">Ex: 0.10 = cada Coroa vale R$ 0,10</p>
                                </div>
                                <div>
                                    <Label className="mb-2 block">Minimo de Coroas para Resgatar</Label>
                                    <Input type="number" min="1" value={config.reward_threshold}
                                        onChange={(e) => setConfig(p => ({ ...p, reward_threshold: e.target.value }))} />
                                    <p className="text-xs text-gray-500 mt-1">Quantidade minima para solicitar resgate</p>
                                </div>
                            </div>
                            <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                                <p className="text-sm text-green-700">
                                    Exemplo: <strong>{config.reward_threshold || 100} Coroas</strong> = <strong className="text-green-800">R$ {((config.reward_threshold || 100) * (config.desconto_por_coroa || 0.10)).toFixed(2)} de desconto</strong>
                                </p>
                            </div>
                            <div className="flex justify-end mt-4">
                                <Button onClick={saveConfig} disabled={savingConfig} style={{ backgroundColor: "#07593f" }}>
                                    {savingConfig ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                    Salvar
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Catalogo de recompensas */}
                    <Card className="border-0 shadow">
                        <CardHeader className="border-b flex-row items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Gift className="w-5 h-5 text-purple-600" />
                                <div>
                                    <CardTitle style={{ color: "#07593f" }}>Catalogo de Recompensas</CardTitle>
                                    <CardDescription>Cupons e brindes disponiveis para troca</CardDescription>
                                </div>
                            </div>
                            <Button onClick={() => setIsRewardModalOpen(true)} style={{ backgroundColor: "#07593f" }}>
                                <Plus className="w-4 h-4 mr-2" />Nova Recompensa
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            {loadingRewards ? (
                                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
                            ) : rewards.length === 0 ? (
                                <div className="text-center py-10 text-gray-400">
                                    <Gift className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                    <p>Nenhuma recompensa cadastrada</p>
                                </div>
                            ) : (
                                <div className="divide-y">
                                    {rewards.map((reward) => {
                                        const isActive = reward.fidelidade_regras?.is_active;
                                        return (
                                            <div key={reward.id} className={`p-4 flex items-center justify-between hover:bg-gray-50 ${!isActive ? "opacity-50" : ""}`}>
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isActive ? "bg-purple-100" : "bg-gray-100"}`}>
                                                        <Gift className={`w-5 h-5 ${isActive ? "text-purple-600" : "text-gray-400"}`} />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-amber-600">{reward.coroas_necessarias} Coroas</span>
                                                            <ArrowRight className="w-3 h-3 text-gray-400" />
                                                            <span className="font-medium">{formatReward(reward.reward_type, reward.value)}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                                            <span>{reward.fidelidade_regras?.nome}</span>
                                                            <span>Expira em {reward.expiracao_dias}d</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Switch checked={isActive}
                                                        onCheckedChange={(v) => toggleRewardMutation.mutate({ regraId: reward.fidelidade_regras?.id, is_active: v })} />
                                                    <Button size="sm" variant="ghost" className="text-red-400"
                                                        onClick={() => deleteRewardMutation.mutate(reward.fidelidade_regras?.id)}>
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ============================================================ */}
                {/* TAB 5: EXPIRACAO                                              */}
                {/* ============================================================ */}
                <TabsContent value="expiracao" className="space-y-4 mt-4">
                    <Card className="border-0 shadow">
                        <CardHeader className="border-b bg-orange-50">
                            <div className="flex items-center gap-2">
                                <Clock className="w-5 h-5 text-orange-600" />
                                <CardTitle className="text-orange-800">Expiracao de Coroas</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                            <div className="flex items-center gap-3">
                                <Switch checked={config.expiracao_ativo}
                                    onCheckedChange={(v) => setConfig(p => ({ ...p, expiracao_ativo: v }))} />
                                <span className="font-medium">Ativar expiracao de Coroas</span>
                            </div>

                            {config.expiracao_ativo && (
                                <div className="p-4 border rounded-xl space-y-4">
                                    <p className="text-sm text-gray-600">
                                        As Coroas expiram se o cliente <strong>nao realizar nenhuma compra</strong> dentro do prazo definido abaixo.
                                    </p>
                                    <div className="flex items-center gap-3">
                                        <Label className="whitespace-nowrap">Expirar apos:</Label>
                                        <Input type="number" min="1" className="w-24" value={config.expiracao_valor}
                                            onChange={(e) => setConfig(p => ({ ...p, expiracao_valor: e.target.value }))} />
                                        <Select value={config.expiracao_unidade}
                                            onValueChange={(v) => setConfig(p => ({ ...p, expiracao_unidade: v }))}>
                                            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {UNIDADES.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <span className="text-sm text-gray-500">sem comprar</span>
                                    </div>
                                    <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                                        <p className="text-sm text-orange-700">
                                            Cliente que ficar {config.expiracao_valor} {UNIDADES.find(u => u.value === config.expiracao_unidade)?.label?.toLowerCase() || "meses"} sem comprar perdera todas as Coroas acumuladas.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {!config.expiracao_ativo && (
                                <div className="p-4 bg-gray-50 rounded-xl border text-sm text-gray-500">
                                    Com a expiracao desativada, as Coroas acumuladas nunca vencem.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                    <div className="flex justify-end">
                        <Button onClick={saveConfig} disabled={savingConfig} style={{ backgroundColor: "#07593f" }}>
                            {savingConfig ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            Salvar Configuracoes
                        </Button>
                    </div>
                </TabsContent>

                {/* ============================================================ */}
                {/* TAB 6: CAMPANHAS                                              */}
                {/* ============================================================ */}
                <TabsContent value="campanhas" className="space-y-4 mt-4">
                    <Card className="border-0 shadow">
                        <CardHeader className="border-b bg-violet-50">
                            <div className="flex items-center gap-2">
                                <Megaphone className="w-5 h-5 text-violet-600" />
                                <CardTitle className="text-violet-800">Conceder Coroas Manualmente</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <Label className="mb-2 block">Quantidade de Coroas</Label>
                                    <Input type="number" placeholder="Ex: 50 (use negativo para deduzir)"
                                        value={campanhaQtd} onChange={(e) => setCampanhaQtd(e.target.value)} />
                                </div>
                                <div>
                                    <Label className="mb-2 block">Motivo</Label>
                                    <Input placeholder="Ex: Campanha de inauguracao"
                                        value={campanhaMotivo} onChange={(e) => setCampanhaMotivo(e.target.value)} />
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <Label className="mb-2 block">Buscar cliente por nome</Label>
                                    <div className="relative">
                                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <Input className="pl-9" placeholder="Nome do cliente..."
                                            value={campanhaClienteQ} onChange={(e) => setCampanhaClienteQ(e.target.value)} />
                                    </div>
                                </div>
                                <div>
                                    <Label className="mb-2 block">Filtrar por nivel</Label>
                                    <Select value={campanhaFiltroTier} onValueChange={setCampanhaFiltroTier}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="todos">Todos os clientes</SelectItem>
                                            {tiers.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {clientesCampanha.length > 0 && (
                                <div className="border rounded-xl divide-y max-h-64 overflow-y-auto">
                                    {clientesCampanha.map(c => (
                                        <div key={c.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                                            <div>
                                                <p className="font-medium text-sm">{c.nome_completo}</p>
                                                <p className="text-xs text-amber-600">{c.coroas || 0} Coroas atuais</p>
                                            </div>
                                            <Button size="sm" style={{ backgroundColor: "#07593f" }}
                                                disabled={campanhaLoading}
                                                onClick={() => handleConcederCoroas(c.id, c.nome_completo)}>
                                                {campanhaLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Conceder"}
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Historico de campanhas */}
                    <Card className="border-0 shadow">
                        <CardHeader className="border-b flex-row items-center gap-2">
                            <History className="w-5 h-5 text-gray-500" />
                            <CardTitle className="text-gray-700">Historico de Campanhas</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {historicoCampanha.length === 0 ? (
                                <p className="text-center text-gray-400 py-8">Nenhuma campanha registrada</p>
                            ) : (
                                <div className="divide-y max-h-80 overflow-y-auto">
                                    {historicoCampanha.map(h => (
                                        <div key={h.id} className="flex items-center justify-between px-4 py-3">
                                            <div>
                                                <p className="font-medium text-sm">{h.clientes?.nome_completo}</p>
                                                <p className="text-xs text-gray-500">{h.descricao}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className={`font-bold ${h.coroas > 0 ? "text-green-600" : "text-red-500"}`}>
                                                    {h.coroas > 0 ? "+" : ""}{h.coroas} Coroas
                                                </p>
                                                <p className="text-xs text-gray-400">
                                                    {new Date(h.created_at).toLocaleDateString("pt-BR")}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* ============================================================ */}
            {/* MODAL: NOVA RECOMPENSA                                        */}
            {/* ============================================================ */}
            <Dialog open={isRewardModalOpen} onOpenChange={setIsRewardModalOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Gift className="w-5 h-5 text-purple-500" />Nova Recompensa
                        </DialogTitle>
                        <DialogDescription>Defina uma recompensa do catalogo que o cliente pode resgatar</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={(e) => { e.preventDefault(); if (!rewardForm.nome.trim()) return toast.error("Nome e obrigatorio"); if (!rewardForm.coroas_necessarias) return toast.error("Coroas necessarias e obrigatorio"); createRewardMutation.mutate(rewardForm); }} className="space-y-4">
                        <div>
                            <Label>Nome da Recompensa *</Label>
                            <Input value={rewardForm.nome} onChange={(e) => setRewardForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Cupom 10% de Desconto" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Coroas Necessarias *</Label>
                                <Input type="number" min="1" value={rewardForm.coroas_necessarias}
                                    onChange={(e) => setRewardForm(p => ({ ...p, coroas_necessarias: e.target.value }))} placeholder="Ex: 100" />
                            </div>
                            <div>
                                <Label>Tipo</Label>
                                <Select value={rewardForm.reward_type} onValueChange={(v) => setRewardForm(p => ({ ...p, reward_type: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {REWARD_TYPES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Valor</Label>
                                <Input type="number" value={rewardForm.value}
                                    onChange={(e) => setRewardForm(p => ({ ...p, value: e.target.value }))}
                                    disabled={["frete_gratis", "item_gratis"].includes(rewardForm.reward_type)}
                                    placeholder={rewardForm.reward_type?.includes("percentual") ? "Ex: 10" : "Ex: 50"} />
                            </div>
                            <div>
                                <Label>Expiracao (dias)</Label>
                                <Input type="number" min="1" value={rewardForm.expiracao_dias}
                                    onChange={(e) => setRewardForm(p => ({ ...p, expiracao_dias: e.target.value }))} />
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                            <Checkbox id="dc" checked={rewardForm.desconta_coroas}
                                onCheckedChange={(v) => setRewardForm(p => ({ ...p, desconta_coroas: v }))} />
                            <label htmlFor="dc" className="text-sm cursor-pointer">Descontar Coroas ao resgatar</label>
                        </div>
                        <div>
                            <Label>Mensagem para o Cliente</Label>
                            <Input value={rewardForm.mensagem_cliente}
                                onChange={(e) => setRewardForm(p => ({ ...p, mensagem_cliente: e.target.value }))}
                                placeholder="Parabens! Voce ganhou..." />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsRewardModalOpen(false)}>Cancelar</Button>
                            <Button type="submit" disabled={createRewardMutation.isPending} style={{ backgroundColor: "#07593f" }}>
                                {createRewardMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                Criar Recompensa
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ============================================================ */}
            {/* MODAL: TIER                                                   */}
            {/* ============================================================ */}
            <Dialog open={isTierModalOpen} onOpenChange={setIsTierModalOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Crown className="w-5 h-5 text-amber-500" />{editingTier ? "Editar Nivel" : "Novo Nivel"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Nome do Nivel *</Label>
                            <Input value={tierForm.nome} onChange={(e) => setTierForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Ouro" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Coroas Minimas</Label>
                                <Input type="number" min="0" value={tierForm.coroas_minimas}
                                    onChange={(e) => setTierForm(p => ({ ...p, coroas_minimas: e.target.value }))} />
                            </div>
                            <div>
                                <Label>Multiplicador de Coroas</Label>
                                <Input type="number" step="0.1" min="1.0" value={tierForm.multiplicador_coroas}
                                    onChange={(e) => setTierForm(p => ({ ...p, multiplicador_coroas: e.target.value }))} />
                                <p className="text-xs text-gray-500 mt-1">Ex: 1.5 = 50% a mais</p>
                            </div>
                        </div>
                        <div>
                            <Label>Ordem de exibicao</Label>
                            <Input type="number" min="1" value={tierForm.ordem}
                                onChange={(e) => setTierForm(p => ({ ...p, ordem: e.target.value }))} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsTierModalOpen(false)}>Cancelar</Button>
                        <Button disabled={saveTierMutation.isPending} style={{ backgroundColor: "#07593f" }}
                            onClick={() => saveTierMutation.mutate({ ...tierForm, id: editingTier?.id })}>
                            {saveTierMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            Salvar Nivel
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ============================================================ */}
            {/* MODAL: CATEGORIA BONUS                                        */}
            {/* ============================================================ */}
            <Dialog open={isCatModalOpen} onOpenChange={setIsCatModalOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Package className="w-5 h-5 text-orange-500" />Categoria com Bonus
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Nome da Categoria *</Label>
                            <Input value={catForm.categoria} onChange={(e) => setCatForm(p => ({ ...p, categoria: e.target.value }))} placeholder="Ex: Sofas, Camas, Armarios" />
                            <p className="text-xs text-gray-500 mt-1">Deve corresponder a categoria dos produtos</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Coroas Extras</Label>
                                <Input type="number" min="1" value={catForm.coroas_bonus}
                                    onChange={(e) => setCatForm(p => ({ ...p, coroas_bonus: e.target.value }))} />
                            </div>
                            <div>
                                <Label>Multiplicador</Label>
                                <Input type="number" step="0.1" min="1.0" value={catForm.multiplicador}
                                    onChange={(e) => setCatForm(p => ({ ...p, multiplicador: e.target.value }))} />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCatModalOpen(false)}>Cancelar</Button>
                        <Button disabled={saveCatMutation.isPending} style={{ backgroundColor: "#07593f" }}
                            onClick={() => { if (!catForm.categoria.trim()) return toast.error("Categoria obrigatoria"); saveCatMutation.mutate(catForm); }}>
                            {saveCatMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            Adicionar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
