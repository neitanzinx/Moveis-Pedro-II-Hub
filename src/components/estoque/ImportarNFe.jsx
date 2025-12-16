import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, CheckCircle, AlertTriangle, Loader2, Plus, Search, Barcode, KeyRound, Upload } from "lucide-react";

export default function ImportarNFe() {
  const [activeTab, setActiveTab] = useState("chave");
  const [chaveAcesso, setChaveAcesso] = useState("");
  const [processando, setProcessando] = useState(false);
  const [consultandoAPI, setConsultandoAPI] = useState(false);
  const [produtosEncontrados, setProdutosEncontrados] = useState([]);
  const [resultado, setResultado] = useState(null);
  const [dadosNota, setDadosNota] = useState(null);
  
  const queryClient = useQueryClient();

  // =================================================================================
  // 🔐 CREDENCIAIS E CNPJ DA EMPRESA
  // =================================================================================
  const CLIENT_ID = "eUiMbKqFlRlDdS11FzOJ"; 
  const CLIENT_SECRET = "M1nyIzhYXtnjGC1hJJbq2FsXcYNIf0gQ0u5B7Dby";
  const CNPJ_EMPRESA = "49129137000130"; // CNPJ DO ATACADÃO OUTLET (Sem pontos)

  useEffect(() => {
    console.log("✅ CÓDIGO CARREGADO: Versão com parametro 'ambiente=producao'");
  }, []);

  // 1. Autenticação
  const getAuthToken = async () => {
    const params = new URLSearchParams();
    params.append("grant_type", "client_credentials");
    params.append("client_id", CLIENT_ID);
    params.append("client_secret", CLIENT_SECRET);
    params.append("scope", "nfe distribuicao-nfe");

    const response = await fetch("https://auth.nuvemfiscal.com.br/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(`Falha na autenticação: ${err.error_description || "Verifique as credenciais"}`);
    }
    const data = await response.json();
    return data.access_token;
  };

  // 2. Consulta de Nota de Entrada (Fornecedor)
  const consultarNotaNaAPI = async () => {
    const chaveLimpa = chaveAcesso.replace(/\D/g, '');
    
    if (chaveLimpa.length !== 44) {
      setResultado({ tipo: 'erro', texto: 'A chave deve ter 44 números.' });
      return;
    }

    setConsultandoAPI(true);
    setResultado(null);
    setProdutosEncontrados([]);
    setDadosNota(null);

    try {
      const token = await getAuthToken();
      let xmlContent = null;

      // PASSO A: Buscar nota na Distribuição (Adicionado 'ambiente=producao')
      console.log(`Buscando nota para CNPJ ${CNPJ_EMPRESA}...`);
      
      // 👇 CORREÇÃO AQUI: Adicionado &ambiente=producao na URL
      const buscaResponse = await fetch(`https://api.nuvemfiscal.com.br/distribuicao/nfe/documentos?cpf_cnpj=${CNPJ_EMPRESA}&chave_acesso=${chaveLimpa}&ambiente=producao`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (!buscaResponse.ok && buscaResponse.status !== 404) {
         const err = await buscaResponse.json();
         console.error("Erro na busca:", err);
         throw new Error(`Erro API (${buscaResponse.status}): ${err.error?.message || JSON.stringify(err)}`);
      }

      const buscaData = buscaResponse.ok ? await buscaResponse.json() : { data: [] };
      let documentoId = null;

      if (buscaData.data && buscaData.data.length > 0) {
        documentoId = buscaData.data[0].id;
      }

      // PASSO B: Se não encontrou, manifestar Ciência (Adicionado 'ambiente' no corpo)
      if (!documentoId) {
        console.log("Nota não encontrada. Manifestando ciência...");
        
        const manifestarResponse = await fetch(`https://api.nuvemfiscal.com.br/distribuicao/nfe/manifestacoes`, {
          method: "POST",
          headers: { 
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            cpf_cnpj: CNPJ_EMPRESA, 
            chave_acesso: chaveLimpa,
            tipo_evento: "ciencia_operacao",
            ambiente: "producao" // 👇 CORREÇÃO AQUI TAMBÉM
          })
        });

        if (!manifestarResponse.ok) {
             const errM = await manifestarResponse.json();
             if (manifestarResponse.status !== 409 && errM?.error?.code !== "AlreadyExists") {
                 console.warn("Erro ao manifestar:", errM);
                 if(manifestarResponse.status === 400) {
                     throw new Error(`Erro na manifestação: ${errM.error?.message}`);
                 }
             }
        }

        // Aguarda a SEFAZ processar
        await new Promise(r => setTimeout(r, 5000));

        // Tenta buscar novamente (Com o parametro de ambiente)
        const novaBusca = await fetch(`https://api.nuvemfiscal.com.br/distribuicao/nfe/documentos?cpf_cnpj=${CNPJ_EMPRESA}&chave_acesso=${chaveLimpa}&ambiente=producao`, {
            method: "GET",
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        if (novaBusca.ok) {
            const novaBuscaData = await novaBusca.json();
            if (novaBuscaData.data && novaBuscaData.data.length > 0) {
                documentoId = novaBuscaData.data[0].id;
            }
        }
      }

      if (!documentoId) {
        throw new Error("Nota não localizada na SEFAZ. Tente novamente em 1 minuto.");
      }

      // PASSO C: Baixar XML
      console.log("Baixando XML do documento:", documentoId);
      const xmlResponse = await fetch(`https://api.nuvemfiscal.com.br/distribuicao/nfe/documentos/${documentoId}/xml`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (!xmlResponse.ok) {
        throw new Error("XML ainda não disponível. A SEFAZ está processando.");
      }

      xmlContent = await xmlResponse.text();

      // PASSO D: Processar XML
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlContent, "text/xml");
      
      const infNFe = xmlDoc.getElementsByTagName("infNFe")[0];
      if (!infNFe) throw new Error("XML baixado é inválido.");

      const emit = xmlDoc.getElementsByTagName("emit")[0];
      const ide = xmlDoc.getElementsByTagName("ide")[0];
      const dets = xmlDoc.getElementsByTagName("det");

      setDadosNota({
        emitente: emit?.getElementsByTagName("xNome")[0]?.textContent || "Fornecedor",
        cnpj_emitente: emit?.getElementsByTagName("CNPJ")[0]?.textContent,
        numero: ide?.getElementsByTagName("nNF")[0]?.textContent,
        data_emissao: ide?.getElementsByTagName("dhEmi")[0]?.textContent
      });

      const produtos = [];
      for (let i = 0; i < dets.length; i++) {
        const prod = dets[i].getElementsByTagName("prod")[0];
        let ean = prod.getElementsByTagName("cEAN")[0]?.textContent;
        if (!ean || ean === "SEM GTIN") ean = prod.getElementsByTagName("cProd")[0]?.textContent;

        produtos.push({
          codigo_barras: ean,
          nome: prod.getElementsByTagName("xProd")[0]?.textContent,
          quantidade: parseFloat(prod.getElementsByTagName("qCom")[0]?.textContent),
          valor_custo: parseFloat(prod.getElementsByTagName("vUnCom")[0]?.textContent),
          ncm: prod.getElementsByTagName("NCM")[0]?.textContent,
          novo: true
        });
      }

      setProdutosEncontrados(produtos);
      setResultado({ tipo: 'sucesso', texto: `Nota carregada com sucesso!` });

    } catch (error) {
      console.error("Erro detalhado:", error);
      setResultado({
        tipo: 'erro',
        texto: error.message || "Erro ao processar a nota."
      });
    } finally {
      setConsultandoAPI(false);
    }
  };

  const lerXML = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(e.target.result, "text/xml");
        const chave = xmlDoc.getElementsByTagName("infNFe")[0]?.getAttribute("Id")?.replace("NFe", "") || "";
        setChaveAcesso(chave);
        
        const dets = xmlDoc.getElementsByTagName("det");
        const produtos = [];
        for (let i = 0; i < dets.length; i++) {
          const prod = dets[i].getElementsByTagName("prod")[0];
          let ean = prod.getElementsByTagName("cEAN")[0]?.textContent;
          if (!ean || ean === "SEM GTIN") ean = prod.getElementsByTagName("cProd")[0]?.textContent;
          produtos.push({
            codigo_barras: ean,
            nome: prod.getElementsByTagName("xProd")[0]?.textContent,
            quantidade: parseFloat(prod.getElementsByTagName("qCom")[0]?.textContent),
            valor_custo: parseFloat(prod.getElementsByTagName("vUnCom")[0]?.textContent),
            novo: true
          });
        }
        setProdutosEncontrados(produtos);
        setDadosNota({ emitente: "Importado via XML", numero: "XML", data_emissao: new Date().toISOString() });
      } catch (err) {
        setResultado({ tipo: 'erro', texto: "XML inválido." });
      }
    };
    reader.readAsText(file);
  };

  const processarEntradaEstoque = async () => {
    setProcessando(true);
    let atualizados = 0;
    let criados = 0;

    try {
      const produtosExistentes = await base44.entities.Produto.list();

      for (const item of produtosEncontrados) {
        const existente = produtosExistentes.find(p => 
          p.codigo_barras === item.codigo_barras || 
          p.nome.toLowerCase().trim() === item.nome.toLowerCase().trim()
        );

        if (existente) {
          await base44.entities.Produto.update(existente.id, {
            quantidade_estoque: (existente.quantidade_estoque || 0) + item.quantidade,
            preco_custo: item.valor_custo
          });
          atualizados++;
        } else {
          await base44.entities.Produto.create({
            nome: item.nome,
            codigo_barras: item.codigo_barras,
            categoria: "Outros",
            preco_custo: item.valor_custo,
            preco_venda: item.valor_custo * 1.8,
            quantidade_estoque: item.quantidade,
            estoque_minimo: 5,
            ativo: true,
            descricao: `Importado via NFe ${dadosNota?.numero || ''}`
          });
          criados++;
        }
      }

      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      setResultado({
        tipo: 'sucesso',
        texto: `Concluído! ${criados} produtos cadastrados e ${atualizados} estoques somados.`
      });
      setProdutosEncontrados([]);
      setChaveAcesso("");
      setDadosNota(null);

    } catch (error) {
      console.error(error);
      setResultado({ tipo: 'erro', texto: "Erro ao salvar no banco de dados." });
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ color: '#07593f' }}>
            <FileText className="w-6 h-6" />
            Entrada de Nota Fiscal (Sefaz)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert className="bg-blue-50 border-blue-200 mb-4">
            <KeyRound className="h-5 w-5 text-blue-600" />
            <AlertDescription className="text-blue-800 ml-2">
              O sistema buscará a nota na SEFAZ para o CNPJ: <strong>{CNPJ_EMPRESA.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")}</strong>
            </AlertDescription>
          </Alert>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="chave">
                <Barcode className="w-4 h-4 mr-2" />
                Chave de Acesso
              </TabsTrigger>
              <TabsTrigger value="arquivo">
                <Upload className="w-4 h-4 mr-2" />
                Arquivo XML
              </TabsTrigger>
            </TabsList>

            <TabsContent value="chave">
              <div className="flex gap-3 items-start">
                <div className="relative flex-1">
                  <Barcode className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input 
                    placeholder="Chave de Acesso (44 dígitos)" 
                    className="pl-10 h-12 font-mono text-lg"
                    value={chaveAcesso}
                    onChange={(e) => setChaveAcesso(e.target.value)}
                    maxLength={44}
                    autoFocus
                  />
                  <p className="text-xs text-gray-400 mt-1 ml-1">
                    {chaveAcesso.length}/44 dígitos
                  </p>
                </div>
                <Button 
                  onClick={consultarNotaNaAPI}
                  disabled={consultandoAPI || chaveAcesso.length < 44}
                  className="h-12 px-8 text-lg"
                  style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
                >
                  {consultandoAPI ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5 mr-2" />}
                  Buscar
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="arquivo">
              <label className="cursor-pointer block">
                <input type="file" accept=".xml" onChange={lerXML} className="hidden" />
                <div className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl hover:bg-gray-50 transition-colors" style={{ borderColor: '#E5E0D8' }}>
                  <FileText className="w-10 h-10 mb-2" style={{ color: '#07593f' }} />
                  <span className="text-sm font-medium text-gray-600">Clique para selecionar o XML</span>
                </div>
              </label>
            </TabsContent>
          </Tabs>

          {dadosNota && (
            <div className="bg-[#f0f9ff] p-4 rounded-lg border border-blue-100 flex justify-between items-center animate-in fade-in">
              <div>
                <p className="text-sm text-gray-500">Fornecedor</p>
                <p className="font-bold text-[#07593f] text-lg line-clamp-1">{dadosNota.emitente}</p>
                <p className="text-xs text-gray-500">CNPJ: {dadosNota.cnpj_emitente}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Nota Fiscal</p>
                <p className="font-bold text-lg">#{dadosNota.numero}</p>
                <p className="text-xs text-gray-500">{new Date(dadosNota.data_emissao).toLocaleDateString('pt-BR')}</p>
              </div>
            </div>
          )}

          {produtosEncontrados.length > 0 && (
            <div className="border rounded-lg overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-gray-800">Itens da Nota</h3>
                  <p className="text-xs text-gray-500">{produtosEncontrados.length} produtos encontrados</p>
                </div>
                <Button 
                  onClick={processarEntradaEstoque} 
                  disabled={processando}
                  style={{ background: '#07593f' }}
                >
                  {processando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  {processando ? "Salvando..." : "Confirmar Entrada"}
                </Button>
              </div>
              
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 font-medium">
                    <tr>
                      <th className="text-left p-3">Cód.</th>
                      <th className="text-left p-3">Produto</th>
                      <th className="text-center p-3">Qtd</th>
                      <th className="text-right p-3">Custo</th>
                      <th className="text-right p-3">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {produtosEncontrados.map((prod, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="p-3 font-mono text-xs">{prod.codigo_barras}</td>
                        <td className="p-3 font-medium text-gray-800">{prod.nome}</td>
                        <td className="p-3 text-center">
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            {prod.quantidade}
                          </Badge>
                        </td>
                        <td className="p-3 text-right">R$ {prod.valor_custo.toFixed(2)}</td>
                        <td className="p-3 text-right font-bold">R$ {(prod.quantidade * prod.valor_custo).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {resultado && (
            <Alert className={`border-2 ${resultado.tipo === 'erro' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
              {resultado.tipo === 'erro' ? <AlertTriangle className="h-5 w-5 text-red-600" /> : <CheckCircle className="h-5 w-5 text-green-600" />}
              <AlertDescription className={`ml-2 ${resultado.tipo === 'erro' ? 'text-red-800' : 'text-green-800'}`}>
                {resultado.texto}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}