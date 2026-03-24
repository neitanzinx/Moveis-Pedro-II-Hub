import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useScanListener } from '@/hooks/useScanListener';
import { eanService } from '@/services/eanService';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, CheckCircle, AlertTriangle, Search, Link as LinkIcon, Plus } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import ProdutoModal from '@/components/produtos/ProdutoModal'; // Reusing existing modal if possible or creating a simpler one

// Audio Context (lazy initialization)
let audioCtx = null;

const playSound = (type) => {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
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
            osc.start(); osc.stop(audioCtx.currentTime + 0.1);
        } else if (type === 'error') {
            osc.frequency.setValueAtTime(220, audioCtx.currentTime);
            osc.type = 'sawtooth';
            gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
            osc.start(); osc.stop(audioCtx.currentTime + 0.3);
        } else if (type === 'wait') {
            osc.frequency.setValueAtTime(440, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
            osc.start(); osc.stop(audioCtx.currentTime + 0.2);
        }
    } catch (e) {
        console.warn('Audio playback failed:', e);
    }
};

export default function BipagemTab() {
    const { user } = useAuth();
    const [scannedItems, setScannedItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [currentCard, setCurrentCard] = useState(null);
    const [manualCode, setManualCode] = useState('');

    // Association State
    const [isAssociateModalOpen, setIsAssociateModalOpen] = useState(false);
    const [pendingGtin, setPendingGtin] = useState(null);
    const [externalProductInfo, setExternalProductInfo] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);

    const handleScan = async (gtin) => {
        if (!gtin || loading) return;
        setLoading(true);
        setCurrentCard(null);

        try {
            // 1. Lookup
            const result = await eanService.lookup(gtin);

            if (result.found && result.source === 'internal') {
                // INTERNAL FOUND: Increment Stock
                await incrementStock(result.product);
            } else if (result.found && result.source === 'api') {
                // EXTERNAL FOUND: Offer Link
                playSound('wait');
                setPendingGtin(gtin);
                setExternalProductInfo(result.product);
                setIsAssociateModalOpen(true);
            } else {
                // NOT FOUND: Offer Link with empty info
                playSound('error');
                setPendingGtin(gtin);
                setExternalProductInfo(null);
                setIsAssociateModalOpen(true);
            }

        } catch (error) {
            console.error(error);
            playSound('error');
            setCurrentCard({ status: 'error', message: 'Erro ao processar: ' + error.message });
        } finally {
            setLoading(false);
        }
    };

    const incrementStock = async (produto) => {
        const tenantId = user?.loja || 'CD';

        // 1. Insert into estoque_loja
        const { error } = await supabase.from('estoque_loja').insert({
            gtin: produto.codigo_barras || produto.gtin,
            tenant_id: tenantId,
            quantidade: 1,
            data_movimento: new Date().toISOString()
        });

        if (error) throw error;

        // 2. Update Global Stock (Cache)
        await supabase.rpc('increment_estoque_global', { p_id: produto.id, p_qtd: 1 });

        playSound('success');
        setCurrentCard({ status: 'success', message: 'Estoque +1', product: produto });
        addToHistory(produto, 'success');
    };

    const addToHistory = (product, status) => {
        setScannedItems(prev => [{ ...product, time: new Date().toLocaleTimeString(), status }, ...prev.slice(0, 9)]);
    };

    const searchInternalProducts = async (term) => {
        if (!term) return;
        const { data } = await supabase
            .from('produtos')
            .select('*')
            .ilike('nome', `%${term}%`)
            .limit(10);
        setSearchResults(data || []);
    };

    const handleAssociate = async (produtoInterno) => {
        if (!pendingGtin) return;

        // 1. Update Product EAN
        const { error } = await supabase
            .from('produtos')
            .update({ codigo_barras: pendingGtin })
            .eq('id', produtoInterno.id);

        if (error) {
            alert("Erro ao associar: " + error.message);
            return;
        }

        // 2. If we have external info (e.g. NCM), maybe update that too? 
        // For now, just linking EAN.

        setIsAssociateModalOpen(false);
        setPendingGtin(null);
        setExternalProductInfo(null);

        // 3. Increment Item
        await incrementStock({ ...produtoInterno, codigo_barras: pendingGtin });
    };

    useScanListener(handleScan);

    return (
        <div className="flex flex-col">
            <h1 className="text-3xl font-bold mb-6 flex items-center gap-2 text-slate-800">
                <Package className="h-8 w-8 text-primary" />
                Bipagem de Estoque
            </h1>

            <div className="flex gap-4 mb-8">
                <Input
                    value={manualCode}
                    onChange={e => setManualCode(e.target.value)}
                    placeholder="Digitar código..."
                    className="text-lg py-6"
                    onKeyDown={e => e.key === 'Enter' && handleScan(manualCode)}
                />
                <Button size="lg" onClick={() => handleScan(manualCode)} disabled={loading}>
                    PROCESSAR
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1">
                {/* Status Card */}
                <div className="flex items-center justify-center">
                    {currentCard ? (
                        <Card className={`w-full max-w-md border-4 shadow-xl ${currentCard.status === 'success' ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
                            <CardContent className="p-8 text-center">
                                {currentCard.status === 'success' ?
                                    <CheckCircle className="w-24 h-24 text-green-500 mx-auto mb-4" /> :
                                    <AlertTriangle className="w-24 h-24 text-red-500 mx-auto mb-4" />
                                }
                                <h2 className="text-3xl font-bold mb-2">{currentCard.message}</h2>
                                {currentCard.product && (
                                    <div className="mt-4">
                                        <p className="text-xl font-medium">{currentCard.product.nome}</p>
                                        {currentCard.product.cor && <Badge variant="outline" className="mt-2 text-lg">{currentCard.product.cor}</Badge>}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="text-center text-gray-400 border-2 border-dashed border-gray-300 rounded-xl p-12 w-full max-w-md">
                            <p className="text-xl">Aguardando leitura...</p>
                        </div>
                    )}
                </div>

                {/* History */}
                <Card className="flex flex-col">
                    <CardContent className="p-4 flex-1">
                        <h3 className="font-semibold mb-4 text-gray-700">Histórico Recente</h3>
                        <div className="space-y-2">
                            {scannedItems.map((item, i) => (
                                <div key={i} className="flex justify-between items-center p-3 bg-white border rounded shadow-sm">
                                    <div>
                                        <p className="font-medium">{item.nome}</p>
                                        <p className="text-xs text-gray-500">{item.gtin || item.codigo_barras}</p>
                                    </div>
                                    <span className="text-sm text-gray-400">{item.time}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Association Modal */}
            <Dialog open={isAssociateModalOpen} onOpenChange={setIsAssociateModalOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Produto Não Encontrado</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="bg-yellow-50 p-4 rounded border border-yellow-200">
                            <p className="font-medium text-yellow-800">Código: {pendingGtin}</p>
                            {externalProductInfo ? (
                                <div className="mt-2 text-sm text-yellow-700">
                                    <p>Identificado externamente como:</p>
                                    <p className="font-bold text-lg">{externalProductInfo.nome}</p>
                                </div>
                            ) : (
                                <p className="text-yellow-700 text-sm mt-1">Nenhuma informação externa encontrada.</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <h4 className="font-medium">Vincular a produto existente:</h4>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Buscar por nome (ex: Guarda Roupa Henn)"
                                    value={searchTerm}
                                    onChange={e => { setSearchTerm(e.target.value); searchInternalProducts(e.target.value); }}
                                />
                                <Button size="icon"><Search className="h-4 w-4" /></Button>
                            </div>

                            <ScrollArea className="h-60 border rounded-md p-2">
                                {searchResults.map(prod => (
                                    <div key={prod.id} className="flex justify-between items-center p-2 hover:bg-slate-100 rounded cursor-pointer border-b" onClick={() => handleAssociate(prod)}>
                                        <div>
                                            <p className="font-medium text-sm">{prod.nome}</p>
                                            <div className="flex gap-2 mt-1">
                                                {prod.cor && <Badge variant="secondary" className="text-xs">{prod.cor}</Badge>}
                                                {prod.modelo && <span className="text-xs text-gray-500">{prod.modelo}</span>}
                                            </div>
                                        </div>
                                        <Button size="sm" variant="ghost"><LinkIcon className="h-4 w-4" /></Button>
                                    </div>
                                ))}
                                {searchTerm && searchResults.length === 0 && (
                                    <p className="text-center text-gray-500 py-4">Nenhum produto encontrado.</p>
                                )}
                            </ScrollArea>
                        </div>

                        <div className="pt-4 border-t flex justify-end">
                            <Button variant="outline" className="mr-2" onClick={() => setIsAssociateModalOpen(false)}>Cancelar</Button>
                            <Button>Cadastrar Novo (Em Breve)</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
