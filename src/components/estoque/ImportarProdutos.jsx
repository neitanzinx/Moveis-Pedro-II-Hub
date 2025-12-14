import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, Download, CheckCircle, AlertCircle, Loader2, FileSpreadsheet } from "lucide-react";

export default function ImportarProdutos() {
  const [arquivo, setArquivo] = useState(null);
  const [processando, setProcessando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const queryClient = useQueryClient();

  const handleDownloadModelo = () => {
    const csvContent = `codigo_barras,nome,categoria,preco_venda,quantidade_estoque
7891234567890,Sofá 3 Lugares,Sofá,1299.90,10
7891234567891,Mesa de Jantar 6 Lugares,Mesa,899.90,5
7891234567892,Guarda-Roupa 4 Portas,Armário,1599.90,3`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'modelo_importacao_produtos.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'text/csv') {
      setArquivo(file);
      setResultado(null);
    } else {
      setResultado({
        tipo: 'erro',
        texto: 'Por favor, selecione um arquivo CSV válido'
      });
    }
  };

  const handleImportar = async () => {
    if (!arquivo) {
      setResultado({
        tipo: 'erro',
        texto: 'Selecione um arquivo para importar'
      });
      return;
    }

    setProcessando(true);
    setResultado(null);

    try {
      // Upload do arquivo
      const { file_url } = await base44.integrations.Core.UploadFile({ file: arquivo });

      // Extrair dados do CSV
      const extractResult = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url: file_url,
        json_schema: {
          type: "object",
          properties: {
            produtos: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  codigo_barras: { type: "string" },
                  nome: { type: "string" },
                  categoria: { type: "string" },
                  preco_venda: { type: "number" },
                  quantidade_estoque: { type: "number" }
                }
              }
            }
          }
        }
      });

      if (extractResult.status === 'error') {
        throw new Error(extractResult.details);
      }

      const produtos = extractResult.output.produtos || extractResult.output;
      
      // Criar produtos
      const promises = produtos.map(produto => 
        base44.entities.Produto.create({
          ...produto,
          ativo: true
        })
      );

      await Promise.all(promises);

      queryClient.invalidateQueries({ queryKey: ['produtos'] });

      setResultado({
        tipo: 'sucesso',
        texto: `${produtos.length} produto(s) importado(s) com sucesso!`
      });

      setArquivo(null);
      document.getElementById('file-input').value = '';

    } catch (error) {
      console.error('Erro ao importar:', error);
      setResultado({
        tipo: 'erro',
        texto: `Erro ao importar produtos: ${error.message || 'Verifique o formato do arquivo'}`
      });
    }

    setProcessando(false);
  };

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ color: '#07593f' }}>
            <Upload className="w-6 h-6" />
            Importação em Massa (CSV)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert className="border-2" style={{ borderColor: '#f38a4c', backgroundColor: '#FEF3C7' }}>
            <FileSpreadsheet className="h-5 w-5" style={{ color: '#f38a4c' }} />
            <AlertDescription className="ml-2" style={{ color: '#07593f' }}>
              <strong>Formato do CSV:</strong> O arquivo deve conter as colunas: 
              codigo_barras, nome, categoria, preco_venda, quantidade_estoque
            </AlertDescription>
          </Alert>

          <div className="flex justify-center">
            <Button
              onClick={handleDownloadModelo}
              variant="outline"
              className="h-12"
              style={{ borderColor: '#07593f', color: '#07593f' }}
            >
              <Download className="w-5 h-5 mr-2" />
              Baixar Modelo CSV
            </Button>
          </div>

          <div className="border-2 border-dashed rounded-xl p-8 text-center" style={{ borderColor: '#E5E0D8' }}>
            <Upload className="w-12 h-12 mx-auto mb-4" style={{ color: '#8B8B8B' }} />
            <p className="mb-4" style={{ color: '#8B8B8B' }}>
              {arquivo ? arquivo.name : 'Selecione um arquivo CSV para importar'}
            </p>
            <input
              id="file-input"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              onClick={() => document.getElementById('file-input').click()}
              variant="outline"
            >
              Escolher Arquivo
            </Button>
          </div>

          {resultado && (
            <Alert className={`border-2 ${resultado.tipo === 'sucesso' ? 'bg-green-50' : 'bg-red-50'}`} 
              style={{ borderColor: resultado.tipo === 'sucesso' ? '#07593f' : '#EF4444' }}>
              {resultado.tipo === 'sucesso' ? 
                <CheckCircle className="h-5 w-5" style={{ color: '#07593f' }} /> :
                <AlertCircle className="h-5 w-5 text-red-600" />
              }
              <AlertDescription className="ml-2" style={{ color: resultado.tipo === 'sucesso' ? '#07593f' : '#991B1B' }}>
                {resultado.texto}
              </AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleImportar}
            disabled={!arquivo || processando}
            className="w-full h-14 text-lg"
            style={{ background: 'linear-gradient(135deg, #07593f 0%, #0a6b4d 100%)' }}
          >
            {processando ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5 mr-2" />
                Importar Produtos
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-lg" style={{ backgroundColor: '#DBEAFE' }}>
        <CardContent className="p-6">
          <h3 className="font-bold mb-3" style={{ color: '#07593f' }}>
            📋 Categorias Disponíveis:
          </h3>
          <p className="text-sm" style={{ color: '#8B8B8B' }}>
            Sofá, Cama, Mesa, Cadeira, Armário, Estante, Rack, Poltrona, 
            Escrivaninha, Criado-mudo, Buffet, Aparador, Banco, Outros
          </p>
        </CardContent>
      </Card>
    </div>
  );
}