import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Image, Upload, Loader2, CheckCircle, X } from "lucide-react";

export default function ConfiguracaoLogo({ user }) {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);
  const queryClient = useQueryClient();

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Por favor, selecione uma imagem válida.' });
      return;
    }

    // Validar tamanho (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'A imagem deve ter no máximo 2MB.' });
      return;
    }

    setUploading(true);
    setMessage(null);

    try {
      // Upload do arquivo
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      // Atualizar o usuário com a URL da logo
      await base44.auth.updateMe({ logo_url: file_url });
      
      // Recarregar dados
      queryClient.invalidateQueries({ queryKey: ['users'] });
      
      setMessage({ type: 'success', text: 'Logo atualizada com sucesso!' });
      
      // Recarregar a página para mostrar a nova logo
      setTimeout(() => window.location.reload(), 1000);
      
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      setMessage({ type: 'error', text: 'Erro ao fazer upload da logo.' });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!confirm('Tem certeza que deseja remover a logo?')) return;

    setUploading(true);
    try {
      await base44.auth.updateMe({ logo_url: null });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setMessage({ type: 'success', text: 'Logo removida com sucesso!' });
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error('Erro ao remover logo:', error);
      setMessage({ type: 'error', text: 'Erro ao remover a logo.' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
          <Image className="w-5 h-5" />
          Logo da Empresa
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-center">
          {user?.logo_url ? (
            <div className="space-y-4">
              <div className="inline-block p-4 bg-gray-50 dark:bg-neutral-800 rounded-xl">
                <img 
                  src={user.logo_url} 
                  alt="Logo" 
                  className="max-w-xs max-h-32 object-contain mx-auto"
                />
              </div>
              <div className="flex gap-2 justify-center">
                <label>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileUpload} 
                    className="hidden"
                    disabled={uploading}
                  />
                  <Button 
                    variant="outline" 
                    disabled={uploading}
                    onClick={() => document.querySelector('input[type="file"]').click()}
                    className="cursor-pointer"
                  >
                    {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                    Trocar Logo
                  </Button>
                </label>
                <Button 
                  variant="destructive" 
                  onClick={handleRemoveLogo}
                  disabled={uploading}
                >
                  <X className="w-4 h-4 mr-2" />
                  Remover
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <div className="w-32 h-32 mx-auto mb-4 bg-gray-100 dark:bg-neutral-800 rounded-xl flex items-center justify-center">
                <Image className="w-12 h-12 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500 mb-4">Nenhuma logo configurada</p>
              <label>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileUpload} 
                  className="hidden"
                  disabled={uploading}
                />
                <Button 
                  disabled={uploading}
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => document.querySelector('input[type="file"]').click()}
                >
                  {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  {uploading ? 'Enviando...' : 'Fazer Upload'}
                </Button>
              </label>
            </div>
          )}
        </div>

        {message && (
          <Alert className={message.type === 'error' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}>
            {message.type === 'error' ? (
              <X className="h-4 w-4 text-red-600" />
            ) : (
              <CheckCircle className="h-4 w-4 text-green-600" />
            )}
            <AlertDescription className={message.type === 'error' ? 'text-red-800' : 'text-green-800'}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-400">
            <strong>Dica:</strong> Use uma imagem com fundo transparente (PNG) para melhor resultado. Tamanho recomendado: 200x200px.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}