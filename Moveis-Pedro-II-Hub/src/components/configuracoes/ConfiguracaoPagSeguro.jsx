import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Save, Loader2, CheckCircle, AlertCircle, Eye, EyeOff, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export default function ConfiguracaoPagSeguro() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showToken, setShowToken] = useState(false);
    const [config, setConfig] = useState({
        pagseguro_token: "",
        pagseguro_email: "",
        pagseguro_ambiente: "sandbox"
    });
    const [originalConfig, setOriginalConfig] = useState(null);

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            const configs = await base44.entities.ConfiguracaoSistema.list();
            const configMap = {};
            configs.forEach(c => {
                if (c.chave.startsWith('pagseguro_')) {
                    configMap[c.chave] = c.valor || "";
                }
            });
            setConfig(prev => ({ ...prev, ...configMap }));
            setOriginalConfig(configMap);
        } catch (error) {
            console.error("Erro ao carregar configurações:", error);
            toast.error("Erro ao carregar configurações do PagSeguro");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Get existing configs to know their IDs
            const existingConfigs = await base44.entities.ConfiguracaoSistema.list();

            for (const [chave, valor] of Object.entries(config)) {
                const existing = existingConfigs.find(c => c.chave === chave);
                if (existing) {
                    await base44.entities.ConfiguracaoSistema.update(existing.id, { valor, updated_at: new Date().toISOString() });
                } else {
                    await base44.entities.ConfiguracaoSistema.create({ chave, valor });
                }
            }

            setOriginalConfig({ ...config });
            toast.success("Configurações salvas com sucesso!");
        } catch (error) {
            console.error("Erro ao salvar:", error);
            toast.error("Erro ao salvar configurações");
        } finally {
            setSaving(false);
        }
    };

    const hasChanges = JSON.stringify(config) !== JSON.stringify(originalConfig);
    const isConfigured = config.pagseguro_token && config.pagseguro_email;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-green-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">PagSeguro / PagBank</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Configure suas credenciais para gerar links de pagamento
                    </p>
                </div>
                <Badge variant={isConfigured ? "default" : "secondary"} className={isConfigured ? "bg-green-100 text-green-800" : ""}>
                    {isConfigured ? (
                        <><CheckCircle className="w-3 h-3 mr-1" /> Configurado</>
                    ) : (
                        <><AlertCircle className="w-3 h-3 mr-1" /> Não Configurado</>
                    )}
                </Badge>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-orange-500" />
                        Credenciais da API
                    </CardTitle>
                    <CardDescription>
                        Obtenha suas credenciais no painel do PagBank Developers
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="ambiente">Ambiente</Label>
                        <Select
                            value={config.pagseguro_ambiente}
                            onValueChange={(v) => setConfig({ ...config, pagseguro_ambiente: v })}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="sandbox">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-yellow-500" />
                                        Sandbox (Testes)
                                    </div>
                                </SelectItem>
                                <SelectItem value="production">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-green-500" />
                                        Produção (Real)
                                    </div>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-amber-600">
                            {config.pagseguro_ambiente === 'sandbox'
                                ? "⚠️ Modo de testes - pagamentos não são reais"
                                : "✅ Modo produção - pagamentos reais serão processados"
                            }
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">Email da Conta PagBank</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="seu-email@empresa.com"
                            value={config.pagseguro_email}
                            onChange={(e) => setConfig({ ...config, pagseguro_email: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="token">Token de Acesso (Bearer Token)</Label>
                        <div className="relative">
                            <Input
                                id="token"
                                type={showToken ? "text" : "password"}
                                placeholder="Seu token de autenticação"
                                value={config.pagseguro_token}
                                onChange={(e) => setConfig({ ...config, pagseguro_token: e.target.value })}
                                className="pr-10 font-mono text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => setShowToken(!showToken)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        <p className="text-xs text-gray-500">
                            O token é armazenado de forma segura e só é acessado pelo servidor
                        </p>
                    </div>

                    <Alert className="border-blue-200 bg-blue-50">
                        <ExternalLink className="w-4 h-4 text-blue-600" />
                        <AlertDescription className="text-blue-800">
                            <strong>Como obter suas credenciais:</strong>
                            <ol className="list-decimal ml-4 mt-1 text-sm space-y-1">
                                <li>Acesse <a href="https://dev.pagbank.uol.com.br" target="_blank" rel="noopener noreferrer" className="underline">dev.pagbank.uol.com.br</a></li>
                                <li>Faça login com sua conta PagBank</li>
                                <li>Vá em "Credenciais" no menu</li>
                                <li>Copie o Token de Sandbox ou Produção</li>
                            </ol>
                        </AlertDescription>
                    </Alert>

                    <div className="flex justify-end pt-4 border-t">
                        <Button
                            onClick={handleSave}
                            disabled={saving || !hasChanges}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            {saving ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</>
                            ) : (
                                <><Save className="w-4 h-4 mr-2" /> Salvar Configurações</>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {isConfigured && (
                <Card className="border-green-200 bg-green-50">
                    <CardContent className="pt-6">
                        <div className="flex items-start gap-3">
                            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                            <div>
                                <p className="font-medium text-green-800">Integração Configurada</p>
                                <p className="text-sm text-green-700 mt-1">
                                    Você pode gerar links de pagamento diretamente do PDV após finalizar uma venda.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
