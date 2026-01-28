import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
    Plus, Pencil, Trash2, Loader2, Crown, Gift,
    Save, Sparkles, ArrowRight, Check, AlertCircle,
    Settings, ShoppingBag, Coins, Percent, DollarSign, Truck,
    Package
} from "lucide-react";

// Tipos de recompensa disponíveis
const REWARD_TYPES = [
    { value: 'cupom_percentual', label: 'Cupom % Desconto', icon: Percent, example: '10% de desconto' },
    { value: 'cupom_valor', label: 'Cupom R$ Desconto', icon: DollarSign, example: 'R$ 50 de desconto' },
    { value: 'frete_gratis', label: 'Frete Grátis', icon: Truck, example: 'Entrega grátis' },
    { value: 'item_gratis', label: 'Item Grátis', icon: Gift, example: 'Brinde/Produto grátis' },
    { value: 'cashback', label: 'Cashback', icon: Coins, example: 'Crédito para compras' },
    { value: 'desconto_proximo', label: 'Desconto Próxima Compra', icon: ShoppingBag, example: '% na próxima compra' },
];

export default function FidelidadeRegras() {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingReward, setEditingReward] = useState(null);
    const [savingConfig, setSavingConfig] = useState(false);

    // Form para configuração global
    const [config, setConfig] = useState({
        purchase_value_threshold: 50,
        steps_per_purchase: 10,
        signup_bonus: 5,
        is_active: true
    });

    // Form para recompensa
    const [rewardForm, setRewardForm] = useState({
        nome: '',
        reward_type: 'cupom_percentual',
        value: '',
        coroas_necessarias: '',
        desconta_coroas: true,
        expiracao_dias: 30,
        mensagem_cliente: ''
    });

    // Buscar configuração global
    const { data: configData, isLoading: loadingConfig } = useQuery({
        queryKey: ['fidelidade_config'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('fidelidade_config')
                .select('*')
                .eq('is_active', true)
                .single();
            if (error && error.code !== 'PGRST116') throw error;
            return data;
        },
    });

    // Atualizar state quando config carrega
    React.useEffect(() => {
        if (configData) {
            setConfig(configData);
        }
    }, [configData]);

    // Buscar catálogo de recompensas
    const { data: rewards = [], isLoading: loadingRewards } = useQuery({
        queryKey: ['fidelidade_rewards_catalog'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('fidelidade_recompensas')
                .select(`
                    *,
                    fidelidade_regras (id, nome, is_active)
                `)
                .gt('coroas_necessarias', 0)
                .order('coroas_necessarias', { ascending: true });
            if (error) throw error;
            return data || [];
        },
    });

    // Salvar configuração global
    const saveConfig = async () => {
        setSavingConfig(true);
        try {
            const { error } = await supabase
                .from('fidelidade_config')
                .upsert({
                    id: config.id || 1,
                    purchase_value_threshold: parseFloat(config.purchase_value_threshold) || 50,
                    steps_per_purchase: parseInt(config.steps_per_purchase) || 10,
                    signup_bonus: parseInt(config.signup_bonus) || 5,
                    is_active: config.is_active
                });
            if (error) throw error;
            toast.success('Configuração salva!');
            queryClient.invalidateQueries({ queryKey: ['fidelidade_config'] });
        } catch (err) {
            toast.error('Erro ao salvar: ' + err.message);
        } finally {
            setSavingConfig(false);
        }
    };

    // Criar recompensa
    const createRewardMutation = useMutation({
        mutationFn: async (data) => {
            // 1. Criar regra de resgate
            const { data: regra, error: regraError } = await supabase
                .from('fidelidade_regras')
                .insert({
                    nome: data.nome,
                    descricao: `Troque ${data.coroas_necessarias} Coroas`,
                    trigger_type: 'resgate',
                    is_active: true,
                    priority: 10
                })
                .select()
                .single();
            if (regraError) throw regraError;

            // 2. Criar recompensa vinculada
            const { error: rewardError } = await supabase
                .from('fidelidade_recompensas')
                .insert({
                    regra_id: regra.id,
                    reward_type: data.reward_type,
                    value: parseFloat(data.value) || 0,
                    coroas_necessarias: parseInt(data.coroas_necessarias) || 0,
                    desconta_coroas: data.desconta_coroas,
                    expiracao_dias: parseInt(data.expiracao_dias) || 30,
                    mensagem_cliente: data.mensagem_cliente || null
                });
            if (rewardError) throw rewardError;

            return regra;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['fidelidade_rewards_catalog'] });
            toast.success('Recompensa criada!');
            setIsModalOpen(false);
            resetRewardForm();
        },
        onError: (err) => toast.error('Erro: ' + err.message)
    });

    // Deletar recompensa
    const deleteRewardMutation = useMutation({
        mutationFn: async (regraId) => {
            const { error } = await supabase
                .from('fidelidade_regras')
                .delete()
                .eq('id', regraId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['fidelidade_rewards_catalog'] });
            toast.success('Recompensa excluída!');
        }
    });

    // Toggle ativo
    const toggleActiveMutation = useMutation({
        mutationFn: async ({ regraId, is_active }) => {
            const { error } = await supabase
                .from('fidelidade_regras')
                .update({ is_active })
                .eq('id', regraId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['fidelidade_rewards_catalog'] });
        }
    });

    const resetRewardForm = () => {
        setRewardForm({
            nome: '',
            reward_type: 'cupom_percentual',
            value: '',
            coroas_necessarias: '',
            desconta_coroas: true,
            expiracao_dias: 30,
            mensagem_cliente: ''
        });
        setEditingReward(null);
    };

    const handleSubmitReward = (e) => {
        e.preventDefault();
        if (!rewardForm.nome.trim()) return toast.error('Nome é obrigatório');
        if (!rewardForm.coroas_necessarias) return toast.error('Coroas necessárias é obrigatório');
        if (!rewardForm.value && !['frete_gratis', 'item_gratis'].includes(rewardForm.reward_type)) return toast.error('Valor é obrigatório');

        createRewardMutation.mutate(rewardForm);
    };

    const getRewardIcon = (type) => {
        const r = REWARD_TYPES.find(t => t.value === type);
        return r?.icon || Gift;
    };

    const formatReward = (type, value) => {
        if (type === 'cupom_percentual') return `${value}% de desconto`;
        if (type === 'cupom_valor') return `R$ ${value} de desconto`;
        if (type === 'frete_gratis') return 'Frete Grátis';
        if (type === 'item_gratis') return 'Item Grátis';
        if (type === 'cashback') return `R$ ${value} de Cashback`;
        if (type === 'desconto_proximo') return `${value}% na próxima compra`;
        return `${value}`;
    };

    if (loadingConfig || loadingRewards) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* SEÇÃO 1: Configuração de Ganho */}
            <Card className="border-0 shadow-lg">
                <CardHeader className="border-b bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                            <Coins className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <CardTitle className="text-lg text-amber-800">Como Ganhar Coroas</CardTitle>
                            <CardDescription>Configure quanto o cliente ganha em compras</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="grid md:grid-cols-3 gap-6">
                        <div>
                            <Label className="flex items-center gap-2 mb-2">
                                <DollarSign className="w-4 h-4 text-green-600" />
                                A cada R$
                            </Label>
                            <Input
                                type="number"
                                min="1"
                                value={config.purchase_value_threshold}
                                onChange={(e) => setConfig(p => ({ ...p, purchase_value_threshold: e.target.value }))}
                            />
                            <p className="text-xs text-gray-500 mt-1">Valor em reais</p>
                        </div>
                        <div>
                            <Label className="flex items-center gap-2 mb-2">
                                <Crown className="w-4 h-4 text-amber-500" />
                                Ganha
                            </Label>
                            <Input
                                type="number"
                                min="1"
                                value={config.steps_per_purchase}
                                onChange={(e) => setConfig(p => ({ ...p, steps_per_purchase: e.target.value }))}
                            />
                            <p className="text-xs text-gray-500 mt-1">Coroas por unidade</p>
                        </div>
                        <div>
                            <Label className="flex items-center gap-2 mb-2">
                                <Sparkles className="w-4 h-4 text-purple-500" />
                                Bônus Cadastro
                            </Label>
                            <Input
                                type="number"
                                min="0"
                                value={config.signup_bonus}
                                onChange={(e) => setConfig(p => ({ ...p, signup_bonus: e.target.value }))}
                            />
                            <p className="text-xs text-gray-500 mt-1">Coroas de boas-vindas</p>
                        </div>
                    </div>

                    {/* Preview da regra */}
                    <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200">
                        <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="w-4 h-4 text-green-600" />
                            <span className="font-medium text-green-800">Exemplo</span>
                        </div>
                        <p className="text-sm text-green-700">
                            Cliente compra <strong>R$ {(config.purchase_value_threshold * 2) || 100}</strong>
                            <ArrowRight className="w-3 h-3 inline mx-2" />
                            Ganha <strong className="text-amber-600">{(config.steps_per_purchase * 2) || 20} Coroas</strong>
                        </p>
                    </div>

                    <div className="mt-6 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Switch
                                checked={config.is_active}
                                onCheckedChange={(checked) => setConfig(p => ({ ...p, is_active: checked }))}
                            />
                            <span className="text-sm text-gray-600">Programa Ativo</span>
                        </div>
                        <Button onClick={saveConfig} disabled={savingConfig} style={{ backgroundColor: '#07593f' }}>
                            {savingConfig ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            Salvar
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* SEÇÃO 2: Catálogo de Recompensas */}
            <Card className="border-0 shadow-lg">
                <CardHeader className="border-b flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                            <Gift className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                            <CardTitle className="text-lg" style={{ color: '#07593f' }}>Catálogo de Recompensas</CardTitle>
                            <CardDescription>Defina o que o cliente pode trocar com Coroas</CardDescription>
                        </div>
                    </div>
                    <Button onClick={() => setIsModalOpen(true)} style={{ backgroundColor: '#07593f' }}>
                        <Plus className="w-4 h-4 mr-2" />
                        Nova Recompensa
                    </Button>
                </CardHeader>
                <CardContent className="p-0">
                    {rewards.length === 0 ? (
                        <div className="text-center py-12 px-6">
                            <Gift className="w-16 h-16 mx-auto mb-4 opacity-20 text-purple-500" />
                            <p className="text-gray-500 font-medium">Nenhuma recompensa cadastrada</p>
                            <p className="text-sm text-gray-400 mt-1">Crie recompensas para o cliente trocar suas Coroas</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {rewards.map((reward) => {
                                const Icon = getRewardIcon(reward.reward_type);
                                const isActive = reward.fidelidade_regras?.is_active;

                                return (
                                    <div key={reward.id} className={`p-4 hover:bg-gray-50 transition-colors ${!isActive ? 'opacity-50' : ''}`}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isActive ? 'bg-purple-100' : 'bg-gray-100'}`}>
                                                    <Icon className={`w-6 h-6 ${isActive ? 'text-purple-600' : 'text-gray-400'}`} />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-amber-600">{reward.coroas_necessarias} Coroas</span>
                                                        <ArrowRight className="w-4 h-4 text-gray-400" />
                                                        <span className="font-medium text-gray-900">
                                                            {formatReward(reward.reward_type, reward.value)}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                                        <span>{reward.fidelidade_regras?.nome}</span>
                                                        {reward.desconta_coroas ? (
                                                            <Badge variant="outline" className="text-[10px]">Desconta Coroas</Badge>
                                                        ) : (
                                                            <Badge variant="secondary" className="text-[10px]">Não desconta</Badge>
                                                        )}
                                                        <span>Expira em {reward.expiracao_dias}d</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Switch
                                                    checked={isActive}
                                                    onCheckedChange={(checked) => toggleActiveMutation.mutate({ regraId: reward.fidelidade_regras?.id, is_active: checked })}
                                                />
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-red-500 hover:text-red-700"
                                                    onClick={() => deleteRewardMutation.mutate(reward.fidelidade_regras?.id)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* SEÇÃO 3: Tiers de Clientes */}
            <Card className="border-0 shadow-lg">
                <CardHeader className="border-b bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                            <span className="text-xl">🏆</span>
                        </div>
                        <div>
                            <CardTitle className="text-lg text-purple-800">Níveis de Clientes</CardTitle>
                            <CardDescription>Clientes sobem de nível automaticamente ao acumular Coroas</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { nome: 'Cliente', icone: '⭐', cor: '#6B7280', coroas: 0, mult: '1.0x' },
                            { nome: 'Prime', icone: '✨', cor: '#10B981', coroas: 100, mult: '1.1x' },
                            { nome: 'Master', icone: '👑', cor: '#F59E0B', coroas: 500, mult: '1.25x' },
                            { nome: 'Elite', icone: '💎', cor: '#8B5CF6', coroas: 1000, mult: '1.5x' },
                        ].map((tier, idx) => (
                            <div
                                key={tier.nome}
                                className="relative p-4 rounded-xl border-2 text-center transition-all hover:shadow-lg"
                                style={{ borderColor: tier.cor, backgroundColor: `${tier.cor}15` }}
                            >
                                <span className="text-3xl">{tier.icone}</span>
                                <h4 className="font-bold mt-2" style={{ color: tier.cor }}>{tier.nome}</h4>
                                <p className="text-xs text-gray-500 mt-1">A partir de {tier.coroas} Coroas</p>
                                <Badge className="mt-2" style={{ backgroundColor: tier.cor, color: '#fff' }}>
                                    {tier.mult} Coroas
                                </Badge>
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-4 text-center">
                        O multiplicador aumenta as Coroas em cada compra. Ex: Cliente Master ganha 25% mais Coroas!
                    </p>
                </CardContent>
            </Card>

            {/* Alert informativo */}
            <Alert className="bg-blue-50 border-blue-200">
                <AlertCircle className="w-4 h-4 text-blue-600" />
                <AlertDescription className="text-blue-700 text-sm">
                    <strong>Como funciona:</strong> O cliente acumula Coroas em compras.
                    Ao atingir certos níveis de Coroas, sobe de tier e ganha bônus!
                </AlertDescription>
            </Alert>

            {/* Modal Nova Recompensa */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Gift className="w-5 h-5 text-purple-500" />
                            Nova Recompensa
                        </DialogTitle>
                        <DialogDescription>
                            Defina uma recompensa que o cliente pode trocar usando Coroas
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmitReward} className="space-y-4">
                        <div>
                            <Label>Nome da Recompensa *</Label>
                            <Input
                                value={rewardForm.nome}
                                onChange={(e) => setRewardForm(p => ({ ...p, nome: e.target.value }))}
                                placeholder="Ex: Cupom 10% de Desconto"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="flex items-center gap-2">
                                    <Crown className="w-4 h-4 text-amber-500" />
                                    Coroas Necessárias *
                                </Label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={rewardForm.coroas_necessarias}
                                    onChange={(e) => setRewardForm(p => ({ ...p, coroas_necessarias: e.target.value }))}
                                    placeholder="Ex: 50"
                                />
                            </div>
                            <div>
                                <Label>Tipo de Recompensa</Label>
                                <Select
                                    value={rewardForm.reward_type}
                                    onValueChange={(v) => setRewardForm(p => ({ ...p, reward_type: v }))}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {REWARD_TYPES.map(r => (
                                            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>
                                    {['frete_gratis', 'item_gratis'].includes(rewardForm.reward_type)
                                        ? 'Valor (não aplicável)'
                                        : 'Valor *'}
                                </Label>
                                <Input
                                    type="number"
                                    value={['frete_gratis', 'item_gratis'].includes(rewardForm.reward_type) ? '' : rewardForm.value}
                                    onChange={(e) => setRewardForm(p => ({ ...p, value: e.target.value }))}
                                    placeholder={rewardForm.reward_type.includes('percentual') ? 'Ex: 10' : 'Ex: 50'}
                                    disabled={['frete_gratis', 'item_gratis'].includes(rewardForm.reward_type)}
                                />
                            </div>
                            <div>
                                <Label>Expiração (dias)</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={rewardForm.expiracao_dias}
                                    onChange={(e) => setRewardForm(p => ({ ...p, expiracao_dias: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                            <Checkbox
                                id="desconta_coroas"
                                checked={rewardForm.desconta_coroas}
                                onCheckedChange={(checked) => setRewardForm(p => ({ ...p, desconta_coroas: checked }))}
                            />
                            <div>
                                <label htmlFor="desconta_coroas" className="text-sm font-medium cursor-pointer">
                                    Descontar Coroas ao resgatar
                                </label>
                                <p className="text-xs text-gray-500">
                                    Se marcado, o saldo de Coroas do cliente será reduzido
                                </p>
                            </div>
                        </div>

                        <div>
                            <Label>Mensagem para o Cliente</Label>
                            <Input
                                value={rewardForm.mensagem_cliente}
                                onChange={(e) => setRewardForm(p => ({ ...p, mensagem_cliente: e.target.value }))}
                                placeholder="Parabéns! Você ganhou..."
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={createRewardMutation.isPending} style={{ backgroundColor: '#07593f' }}>
                                {createRewardMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                Criar Recompensa
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
