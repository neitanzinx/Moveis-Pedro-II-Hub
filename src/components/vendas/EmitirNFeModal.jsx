import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle, FileCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

// Empresas base para emissao de NFe (Importado da Config ou duplicado por segurança)
// Idealmente isso viria de um contexto ou store, mas vamos replicar a const para garantir acesso
const EMPRESAS_BASE = [
    { cnpj: "49129137000130", nome: "Atacadao Outlet", cnpjFormatado: "49.129.137/0001-30" },
    { cnpj: "04842257000141", nome: "Moveis Pedro II", cnpjFormatado: "04.842.257/0001-41" },
    { cnpj: "42316614000127", nome: "Massi Home Design", cnpjFormatado: "42.316.614/0001-27" },
    { cnpj: "53795479000166", nome: "Alta Performance Decoracoes", cnpjFormatado: "53.795.479/0001-66" },
];

import { NfeGenerator } from "@/services/NfeGenerator";
import { Download, FileCode } from "lucide-react";

export default function EmitirNFeModal({ isOpen, onClose, venda, cliente }) {
    const [loading, setLoading] = useState(false);
    const [ambiente, setAmbiente] = useState('homologacao');

    if (!venda || !cliente) return null;

    const getDadosEmitente = () => {
        const cnpjPadrao = localStorage.getItem("nfe_empresa_padrao");
        const dadosFiscaisRaw = localStorage.getItem("nfe_empresas_fiscais");
        const dadosFiscais = dadosFiscaisRaw ? JSON.parse(dadosFiscaisRaw) : {};

        const empresaBase = EMPRESAS_BASE.find(e => e.cnpj === cnpjPadrao) || EMPRESAS_BASE[0];
        const dadosComplementares = dadosFiscais[empresaBase.cnpj] || {};

        return {
            razao_social: empresaBase.nome,
            cnpj: empresaBase.cnpj,
            inscricao_estadual: dadosComplementares.ie || "",
            crt: dadosComplementares.regimeTributario || 1,
            endereco_fiscal: {
                logradouro: dadosComplementares.logradouro,
                numero: dadosComplementares.numero,
                bairro: dadosComplementares.bairro,
                municipio_codigo: dadosComplementares.codigoMunicipio || '3550308', // Default SP
                municipio_nome: dadosComplementares.municipio,
                uf: dadosComplementares.uf,
                cep: dadosComplementares.cep
            }
        };
    };

    const handleBaixarXmlSebrae = () => {
        try {
            setLoading(true);
            const emitente = getDadosEmitente();

            // Validação básica
            if (!emitente.inscricao_estadual || !emitente.endereco_fiscal.logradouro) {
                toast.error("Configure os dados fiscais da empresa (Endereço/IE) em Configurações > NFe antes de gerar.");
                setLoading(false);
                return;
            }

            // Validação de Produtos (NCM/CFOP)
            const produtosIrregulares = venda.itens.filter(item => !item.ncm || !item.cfop);
            if (produtosIrregulares.length > 0) {
                const listaProdutos = produtosIrregulares.map(p => `- ${p.nome}`).join('\n');
                toast.error(`Dados fiscais incompletos nestes produtos:\n${listaProdutos}\n\nConfigure NCM e CFOP no cadastro do produto.`);
                setLoading(false);
                return;
            }

            const xml = NfeGenerator.generateXML(venda, emitente, cliente);

            // Download
            const blob = new Blob([xml], { type: "application/xml" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `NFe_${venda.numero_pedido}_${emitente.razao_social.replace(/\s+/g, '_')}.xml`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast.success("XML gerado! Importe no emissor do Sebrae.");
            onClose();
        } catch (error) {
            console.error(error);
            toast.error("Erro ao gerar XML: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleEmitirAPI = async () => {
        try {
            setLoading(true);

            const { data, error } = await supabase.functions.invoke('emitir-nfe', {
                body: {
                    venda_id: venda.id,
                    ambiente
                }
            });

            if (error) throw error;
            if (!data.success) {
                throw new Error(data.error || data.message || 'Erro desconhecido ao emitir NFe');
            }

            toast.success(`NFe enviada com sucesso! Ref: ${data.ref}`);
            onClose();
        } catch (error) {
            console.error('Erro ao emitir NFe:', error);
            let msg = error.message || 'Erro de conexão';
            if (error.context && typeof error.context.json === 'function') {
                try {
                    const body = await error.context.json();
                    if (body && body.error) msg = body.error;
                } catch (e) { /* ignore */ }
            }
            toast.error('Falha ao emitir NFe: ' + msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileCheck className="w-5 h-5 text-green-600" />
                        Emitir Nota Fiscal (NFe)
                    </DialogTitle>
                    <DialogDescription>
                        Pedido #{venda.numero_pedido} - {cliente.nome_completo || cliente.razao_social}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3 text-sm text-blue-800">
                        <FileCode className="w-5 h-5 text-blue-600 shrink-0" />
                        <div>
                            <p className="font-bold mb-1">Exportação para Sebrae</p>
                            <p>Gere o arquivo XML e importe manualmente no emissor gratuito do Sebrae.</p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Opções de Emissão</Label>
                        <div className="grid grid-cols-2 gap-3">
                            <Button
                                variant="outline"
                                className="h-auto py-4 flex flex-col gap-2 items-center hover:bg-blue-50 border-dashed border-2"
                                onClick={handleBaixarXmlSebrae}
                                disabled={loading}
                            >
                                <Download className="w-6 h-6 text-blue-600" />
                                <span className="font-semibold text-blue-700">Baixar XML</span>
                                <span className="text-xs text-center text-gray-500 font-normal">Para Emissor Sebrae</span>
                            </Button>

                            <Button
                                variant="outline"
                                className="h-auto py-4 flex flex-col gap-2 items-center hover:bg-green-50 border-dashed border-2"
                                onClick={handleEmitirAPI}
                                disabled={loading}
                            >
                                <Loader2 className={`w-6 h-6 text-green-600 ${loading ? 'animate-spin' : ''}`} />
                                <span className="font-semibold text-green-700">Via API (Auto)</span>
                                <span className="text-xs text-center text-gray-500 font-normal">Nuvem Fiscal</span>
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t mt-2">
                        <Label className="text-xs text-gray-500">Ambiente (Apenas API)</Label>
                        <Select value={ambiente} onValueChange={setAmbiente}>
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="homologacao">Homologação (Teste)</SelectItem>
                                <SelectItem value="producao">Produção (Validade Jurídica)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={onClose} disabled={loading}>
                        Fechar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
