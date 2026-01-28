import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useScanListener } from '@/hooks/useScanListener';
import { productService } from '@/services/productService';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Package, CheckCircle, AlertTriangle, CloudOff } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Audio Context for feedback
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const playSound = (type) => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'success') {
        osc.frequency.setValueAtTime(660, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'error') {
        osc.frequency.setValueAtTime(220, audioCtx.currentTime);
        osc.type = 'sawtooth';
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'wait') {
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    }
};

export default function EntradaEstoque() {
    const { user, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const [scannedItems, setScannedItems] = useState([]);
    const [lastScanTime, setLastScanTime] = useState({}); // Map of GTIN -> timestamp
    const [scanBuffer, setScanBuffer] = useState({}); // Map of GTIN -> current volume count
    const [loading, setLoading] = useState(false);
    const [currentCard, setCurrentCard] = useState(null); // The card currently being processed/displayed

    // Animation state
    const [shake, setShake] = useState(false);

    const triggerShake = () => {
        setShake(true);
        setTimeout(() => setShake(false), 500);
    };

    const handleScan = async (gtin) => {
        if (!gtin || !gtin.trim()) return; // Validação extra
        if (loading) return;
        setLoading(true);

        try {
            // 1. Check local DB (produtos_mestre)
            let { data: product, error } = await supabase
                .from('produtos_mestre')
                .select('*')
                .eq('gtin', gtin)
                .single();

            // 2. Fallback to API Proxy (Cosmos)
            let isNewProduct = false;
            if (!product) {
                const apiData = await productService.fetchProductByGtin(gtin);
                if (apiData) {
                    // Prepare skeleton product
                    const skeleton = {
                        gtin: apiData.gtin,
                        nome: apiData.nome || 'PRODUTO NOVO (Completar)',
                        marca: apiData.marca,
                        ncm: apiData.ncm,
                        foto_url: apiData.foto_url,
                        volumes_esperados: apiData.volumes || 1, // API usually doesn't return volumes, so default 1. Logic can be improved if we have specific volume data.
                        status: (!apiData.ncm || !apiData.nome) ? 'REVISAO_PENDENTE' : 'COMPLETO'
                    };

                    // 1. Tenta salvar o produto mestre
                    const { data: newProd, error: insertError } = await supabase
                        .from('produtos_mestre')
                        .upsert(skeleton, { onConflict: 'gtin' })
                        .select()
                        .maybeSingle(); // Use maybeSingle para evitar erros se vier vazio

                    // 2. Tratamento de Erro REAL
                    if (insertError) {
                        console.error('🚨 ERRO AO SALVAR:', insertError);
                        playSound('error');
                        alert(`Erro no Banco: ${insertError.message}`);
                        return;
                    }

                    // 3. A CORREÇÃO DE OURO:
                    const referenciaProduto = newProd?.gtin || skeleton.gtin;
                    console.log('✅ Produto garantido. Usando referência:', referenciaProduto);

                    // Garante que o objeto product exista para os próximos passos
                    product = newProd || skeleton;
                    isNewProduct = true;
                } else {
                    // Unknown product
                    playSound('error');
                    triggerShake();
                    setCurrentCard({ status: 'error', message: `Produto desconhecido: ${gtin}` });
                    setLoading(false);
                    return;
                }
            }

            // 3. Kit Logic
            const now = Date.now();
            const lastTime = lastScanTime[gtin] || 0;
            const currentVolume = scanBuffer[gtin] || 0;
            const expectedVolumes = product.volumes_esperados || 1;

            if (expectedVolumes > 1) {
                if (now - lastTime < 2000 && currentVolume < expectedVolumes && currentVolume > 0) {
                    // Cooldown active
                    playSound('wait');
                    setCurrentCard({ status: 'warning', message: 'Aguarde 2s para o próximo volume...', product });
                    setLoading(false);
                    return;
                }

                // Advance volume
                const nextVolume = currentVolume + 1;
                setScanBuffer(prev => ({ ...prev, [gtin]: nextVolume }));
                setLastScanTime(prev => ({ ...prev, [gtin]: now }));

                if (nextVolume < expectedVolumes) {
                    playSound('success'); // Soft success
                    setCurrentCard({ status: 'info', message: `Volume ${nextVolume}/${expectedVolumes} detectado`, product });
                    setLoading(false);
                    return;
                }
                // If reached here, we have all volumes
                // Clear buffer
                setScanBuffer(prev => {
                    const newState = { ...prev };
                    delete newState[gtin];
                    return newState;
                });
            }

            // 4. Register Stock Entry
            // Get user's store (tenant) - defaulting to first store found for now or hardcoded logic
            // Ideally should come from auth context.
            // Using a dummy insert for now as we need to fetch user context
            // Using getSession instead of getUser for better resilience (checks local cache first)
            // 4. Register Stock Entry
            if (authLoading) {
                throw new Error("Carregando autenticação...");
            }
            if (!user) {
                throw new Error("Usuário não autenticado");
            }

            // Se não tiver loja vinculada, assume que está no CD
            const tenantId = user.loja || 'CD';

            if (!tenantId) {
                // Should not happen if we default to CD, but keeping safe check or removing
                throw new Error("Erro interno: Local de estoque não definido.");
            }

            // Insert into estoque_loja
            const { error: stockError } = await supabase.from('estoque_loja').insert({
                gtin: product.gtin,
                tenant_id: tenantId,
                quantidade: 1, // Adding 1 unit (kit or item)
                volumes_recebidos: Array.from({ length: expectedVolumes }, (_, i) => i + 1) // [1, 2, ...]
            });

            if (stockError) throw stockError;

            playSound('success');
            setCurrentCard({
                status: 'success',
                message: isNewProduct ? 'Produto Cadastrado e Entrada Realizada!' : 'Entrada Realizada!',
                product
            });

            // Update history
            setScannedItems(prev => [
                { ...product, time: new Date().toLocaleTimeString() },
                ...prev.slice(0, 9) // Keep last 10
            ]);

        } catch (error) {
            console.error(error);
            playSound('error');
            triggerShake();
            setCurrentCard({ status: 'error', message: `Erro ao processar: ${error.message}` });
        } finally {
            setLoading(false);
        }
    };

    // Hook listener
    useScanListener(handleScan);

    // Manual input state
    const [manualCode, setManualCode] = useState('');

    const handleManualSubmit = (e) => {
        e.preventDefault();
        if (manualCode.trim()) {
            handleScan(manualCode.trim());
            setManualCode('');
        }
    };

    return (
        <div className="p-6 max-w-6xl mx-auto h-[calc(100vh-100px)] flex flex-col">
            <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
                <Package className="h-8 w-8" />
                Entrada Rápida de Estoque
            </h1>

            {/* Manual Entry Form */}
            <form onSubmit={handleManualSubmit} className="mb-6 flex gap-4">
                <Input
                    type="text"
                    placeholder="Digitar código de barras manualmente..."
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    className="flex-1 text-lg py-6"
                    autoFocus
                />
                <Button type="submit" size="lg" disabled={loading}>
                    {loading ? 'Processando...' : 'Inserir'}
                </Button>
            </form>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1">
                {/* Left: Main Scanner Feedback */}
                <div className="flex flex-col gap-4 justify-center">

                    {!currentCard && (
                        <div className="text-center text-gray-400 border-2 border-dashed border-gray-300 rounded-xl p-12">
                            <p className="text-xl">Biper um código de barras ou digite acima para começar...</p>
                        </div>
                    )}

                    {currentCard && (
                        <Card className={`
                            border-4 shadow-xl transform transition-all duration-300
                            ${shake ? 'animate-shake' : ''}
                            ${currentCard.status === 'success' ? 'border-green-500 bg-green-50' :
                                currentCard.status === 'warning' ? 'border-yellow-500 bg-yellow-50' :
                                    currentCard.status === 'info' ? 'border-blue-500 bg-blue-50' : // For volumes
                                        'border-red-500 bg-red-50'}
                        `}>
                            <CardContent className="p-8 flex flex-col items-center text-center">
                                {currentCard.status === 'success' && <CheckCircle className="h-24 w-24 text-green-500 mb-4" />}
                                {currentCard.status === 'error' && <AlertTriangle className="h-24 w-24 text-red-500 mb-4" />}
                                {currentCard.status === 'warning' && <AlertTriangle className="h-24 w-24 text-yellow-500 mb-4" />}
                                {currentCard.status === 'info' && <Package className="h-24 w-24 text-blue-500 mb-4" />}

                                <h2 className="text-3xl font-bold mb-2">
                                    {currentCard.message}
                                </h2>

                                {currentCard.product && (
                                    <div className="mt-4">
                                        <h3 className="text-xl font-semibold">{currentCard.product.nome}</h3>
                                        <p className="text-gray-600">{currentCard.product.gtin}</p>
                                        <Badge variant="outline" className="mt-2 text-lg">
                                            {currentCard.product.marca}
                                        </Badge>
                                        {currentCard.product.volumes_esperados > 1 && (
                                            <Badge variant="secondary" className="mt-2 ml-2 text-lg">
                                                Kit {currentCard.product.volumes_esperados} Volumes
                                            </Badge>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Right: History */}
                <div className="flex flex-col h-full bg-white rounded-xl shadow p-4">
                    <h3 className="text-lg font-semibold mb-4 text-gray-700">Últimos itens bipados</h3>
                    <div className="overflow-auto flex-1 space-y-3">
                        {scannedItems.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50">
                                <div className="h-10 w-10 bg-gray-200 rounded flex items-center justify-center">
                                    <Package className="h-5 w-5 text-gray-500" />
                                </div>
                                <div>
                                    <p className="font-medium">{item.nome}</p>
                                    <p className="text-sm text-gray-500">{item.time} - {item.gtin}</p>
                                </div>
                                {item.status === 'REVISAO_PENDENTE' && (
                                    <Badge variant="destructive" className="ml-auto">Revisão</Badge>
                                )}
                            </div>
                        ))}
                        {scannedItems.length === 0 && (
                            <p className="text-center text-gray-400 mt-10">Histórico vazio</p>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-5px); }
                    75% { transform: translateX(5px); }
                }
                .animate-shake {
                    animation: shake 0.5s ease-in-out;
                }
            `}</style>
        </div>
    );
}
