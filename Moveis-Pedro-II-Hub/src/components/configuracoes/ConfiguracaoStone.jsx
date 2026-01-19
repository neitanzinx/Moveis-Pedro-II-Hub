import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    CreditCard, Save, Loader2, CheckCircle, AlertCircle,
    Eye, EyeOff, Key, Link2, Copy, RefreshCw, Webhook,
    TestTube, Building2, Shield, ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/api/base44Client";

export default function ConfiguracaoStone() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [showClientSecret, setShowClientSecret] = useState(false);
    const [showWebhookSecret, setShowWebhookSecret] = useState(false);

    const [config, setConfig] = useState({
        environment: 'sandbox',
        client_id: '',
        client_secret: '',
        account_id: '',
        webhook_secret: '',
        is_active: true
    });
    const [originalConfig, setOriginalConfig] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState(null); // null | 'success' | 'error'
    const [connectionMessage, setConnectionMessage] = useState('');

    // URLs baseadas no ambiente
    const getApiBaseUrl = () => {
        return config.environment === 'production'
            ? 'https://api.openbank.stone.com.br'
            : 'https://sandbox-api.openbank.stone.com.br';
    };

    const getAuthUrl = () => {
        return config.environment === 'production'
            ? 'https://login.stone.com.br'
            : 'https://login.sandbox.stone.com.br';
    };

    // Webhook URL para configurar na Stone (Supabase Edge Function)
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://stgatkuwnouzwczkpphs.supabase.co';
    const webhookUrl = `${supabaseUrl}/functions/v1/stone-payment-link/webhook`;

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            const { data, error } = await supabase
                .from('stone_config')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (data) {
                setConfig({
                    environment: data.environment || 'sandbox',
                    client_id: data.client_id || '',
                    client_secret: data.client_secret || '',
                    account_id: data.account_id || '',
                    webhook_secret: data.webhook_secret || '',
                    is_active: data.is_active ?? true
                });
                setOriginalConfig(data);
            }
        } catch (error) {
            // Tabela vazia ou não existe ainda - usar valores padrão
            console.log('Configuração Stone não encontrada, usando padrões');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!config.client_id || !config.client_secret) {
            toast.error("Client ID e Client Secret são obrigatórios");
            return;
        }

        setSaving(true);
        try {
            const payload = {
                environment: config.environment,
                client_id: config.client_id,
                client_secret: config.client_secret,
                account_id: config.account_id || null,
                webhook_secret: config.webhook_secret || null,
                is_active: config.is_active,
                updated_at: new Date().toISOString()
            };

            // Upsert baseado no ambiente
            const { data, error } = await supabase
                .from('stone_config')
                .upsert(payload, {
                    onConflict: 'environment',
                    ignoreDuplicates: false
                })
                .select()
                .single();

            if (error) throw error;

            setOriginalConfig(data);
            toast.success("Configurações da Stone salvas!");
        } catch (error) {
            console.error('Erro ao salvar:', error);
            toast.error("Erro ao salvar configurações");
        } finally {
            setSaving(false);
        }
    };

    const handleTestConnection = async () => {
        if (!config.client_id || !config.client_secret) {
            toast.error("Preencha Client ID e Client Secret primeiro");
            return;
        }

        setTesting(true);
        setConnectionStatus(null);
        setConnectionMessage('');

        try {
            // Tentar obter token OAuth
            const authUrl = `${getAuthUrl()}/auth/realms/stone_bank/protocol/openid-connect/token`;

            const response = await fetch(authUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'client_credentials',
                    client_id: config.client_id,
                    client_secret: config.client_secret
                })
            });

            if (response.ok) {
                const data = await response.json();
                setConnectionStatus('success');
                setConnectionMessage(`Token obtido! Expira em ${data.expires_in}s`);
                toast.success("Conexão com a Stone bem-sucedida!");
            } else {
                const errorData = await response.json();
                setConnectionStatus('error');
                setConnectionMessage(errorData.error_description || errorData.error || 'Credenciais inválidas');
                toast.error("Falha na autenticação");
            }
        } catch (error) {
            setConnectionStatus('error');
            setConnectionMessage(error.message || 'Erro de conexão');
            toast.error("Erro ao conectar com a Stone");
        } finally {
            setTesting(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        toast.success("Copiado para área de transferência!");
    };

    const hasChanges = JSON.stringify(config) !== JSON.stringify(originalConfig);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-green-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <CreditCard className="w-6 h-6 text-green-600" />
                        Stone Pagamentos
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Configure a integração com a Stone OpenBank para gerar links de pagamento
                    </p>
                </div>
                <Badge className={config.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                    {config.is_active ? "Ativo" : "Inativo"}
                </Badge>
            </div>

            {/* Ambiente */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Building2 className="w-5 h-5" />
                        Ambiente
                    </CardTitle>
                    <CardDescription>
                        Selecione o ambiente de integração
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs value={config.environment} onValueChange={(v) => setConfig({ ...config, environment: v })}>
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="sandbox" className="gap-2">
                                <TestTube className="w-4 h-4" />
                                Sandbox (Testes)
                            </TabsTrigger>
                            <TabsTrigger value="production" className="gap-2">
                                <Shield className="w-4 h-4" />
                                Produção
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>

                    {config.environment === 'sandbox' && (
                        <Alert className="mt-4 border-blue-200 bg-blue-50">
                            <TestTube className="w-4 h-4 text-blue-600" />
                            <AlertDescription className="text-blue-800">
                                <strong>Ambiente de Testes</strong> - Nenhuma transação real será processada.
                                <a
                                    href="https://docs.openbank.stone.com.br/docs/referencia-da-api/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ml-2 text-blue-600 hover:underline inline-flex items-center gap-1"
                                >
                                    Ver documentação <ExternalLink className="w-3 h-3" />
                                </a>
                            </AlertDescription>
                        </Alert>
                    )}

                    {config.environment === 'production' && (
                        <Alert className="mt-4 border-orange-200 bg-orange-50">
                            <Shield className="w-4 h-4 text-orange-600" />
                            <AlertDescription className="text-orange-800">
                                <strong>Ambiente de Produção</strong> - Transações reais serão processadas. Tenha cuidado!
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>

            {/* Credenciais */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Key className="w-5 h-5" />
                        Credenciais OAuth
                    </CardTitle>
                    <CardDescription>
                        Obtenha suas credenciais no painel da Stone OpenBank
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Client ID</Label>
                        <Input
                            value={config.client_id}
                            onChange={(e) => setConfig({ ...config, client_id: e.target.value })}
                            placeholder="Seu Client ID da Stone"
                            className="font-mono text-sm"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Client Secret</Label>
                        <div className="relative">
                            <Input
                                type={showClientSecret ? "text" : "password"}
                                value={config.client_secret}
                                onChange={(e) => setConfig({ ...config, client_secret: e.target.value })}
                                placeholder="Seu Client Secret da Stone"
                                className="pr-10 font-mono text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => setShowClientSecret(!showClientSecret)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                {showClientSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Account ID (Opcional)</Label>
                        <Input
                            value={config.account_id}
                            onChange={(e) => setConfig({ ...config, account_id: e.target.value })}
                            placeholder="ID da conta Stone"
                            className="font-mono text-sm"
                        />
                        <p className="text-xs text-gray-500">Necessário para algumas operações avançadas</p>
                    </div>

                    {/* Testar Conexão */}
                    <div className="pt-4 border-t">
                        <Button
                            onClick={handleTestConnection}
                            disabled={testing || !config.client_id || !config.client_secret}
                            variant="outline"
                            className="w-full"
                        >
                            {testing ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Testando conexão...</>
                            ) : (
                                <><RefreshCw className="w-4 h-4 mr-2" /> Testar Conexão</>
                            )}
                        </Button>

                        {connectionStatus && (
                            <Alert className={`mt-3 ${connectionStatus === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                                {connectionStatus === 'success' ? (
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                ) : (
                                    <AlertCircle className="w-4 h-4 text-red-600" />
                                )}
                                <AlertDescription className={connectionStatus === 'success' ? 'text-green-800' : 'text-red-800'}>
                                    {connectionMessage}
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Webhook */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Webhook className="w-5 h-5" />
                        Webhook de Notificações
                    </CardTitle>
                    <CardDescription>
                        Configure este URL na Stone para receber notificações de pagamento
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>URL do Webhook</Label>
                        <div className="flex gap-2">
                            <Input
                                value={webhookUrl}
                                readOnly
                                className="font-mono text-sm bg-gray-50"
                            />
                            <Button variant="outline" onClick={() => copyToClipboard(webhookUrl)}>
                                <Copy className="w-4 h-4" />
                            </Button>
                        </div>
                        <p className="text-xs text-gray-500">
                            Copie este URL e configure nas configurações de webhook do seu aplicativo Stone
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label>Webhook Secret (Opcional)</Label>
                        <div className="relative">
                            <Input
                                type={showWebhookSecret ? "text" : "password"}
                                value={config.webhook_secret}
                                onChange={(e) => setConfig({ ...config, webhook_secret: e.target.value })}
                                placeholder="Secret para validar webhooks"
                                className="pr-10 font-mono text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                {showWebhookSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        <p className="text-xs text-gray-500">
                            Usado para validar que as notificações vieram da Stone
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Status e Salvar */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <Switch
                                checked={config.is_active}
                                onCheckedChange={(v) => setConfig({ ...config, is_active: v })}
                            />
                            <div>
                                <Label className="font-medium">Integração Ativa</Label>
                                <p className="text-xs text-gray-500">
                                    Quando desativada, links de pagamento não serão gerados
                                </p>
                            </div>
                        </div>
                    </div>

                    <Button
                        onClick={handleSave}
                        disabled={saving || !hasChanges}
                        className="w-full bg-green-600 hover:bg-green-700"
                    >
                        {saving ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</>
                        ) : (
                            <><Save className="w-4 h-4 mr-2" /> Salvar Configurações</>
                        )}
                    </Button>
                </CardContent>
            </Card>

            {/* Links úteis */}
            <div className="text-center text-sm text-gray-500">
                <a
                    href="https://docs.openbank.stone.com.br"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-600 hover:underline inline-flex items-center gap-1"
                >
                    Documentação Stone OpenBank <ExternalLink className="w-3 h-3" />
                </a>
            </div>
        </div>
    );
}
