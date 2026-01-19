import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Image as ImageIcon, Upload, Loader2, CheckCircle, X, Trash2, Palette } from "lucide-react";

export default function ConfiguracaoLogo({ user }) {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);
  const queryClient = useQueryClient();

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Por favor, selecione um arquivo de imagem válido (PNG, JPG).' });
      return;
    }

    // Validar tamanho (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'A imagem é muito grande. O limite máximo é 2MB.' });
      return;
    }

    setUploading(true);
    setMessage(null);

    try {
      // Upload do arquivo
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      // Atualizar o usuário
      await base44.auth.updateMe({ logo_url: file_url });

      // Recarregar caches
      queryClient.invalidateQueries({ queryKey: ['users'] });

      setMessage({ type: 'success', text: 'Identidade visual atualizada com sucesso!' });

      // Reload sutil para atualizar sidebar e headers globais
      setTimeout(() => window.location.reload(), 1500);

    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      setMessage({ type: 'error', text: 'Falha ao processar o upload. Tente novamente.' });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!confirm('Isso removerá a logo de todo o sistema. Deseja continuar?')) return;

    setUploading(true);
    try {
      await base44.auth.updateMe({ logo_url: null });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setMessage({ type: 'success', text: 'Logo removida.' });
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error('Erro ao remover logo:', error);
      setMessage({ type: 'error', text: 'Erro ao remover a logo.' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Palette className="w-8 h-8 text-green-600" />
          Identidade Visual
        </h2>
        <p className="text-gray-500 mt-1">Personalize a aparência do sistema com a marca da sua empresa.</p>
      </div>

      <Card className="border-t-4 border-t-green-600 shadow-sm">
        <CardHeader>
          <CardTitle>Logo da Empresa</CardTitle>
          <CardDescription>
            Esta logo será exibida no menu lateral, relatórios impressos e tela de login.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">

          <div className="flex flex-col md:flex-row gap-8 items-start">
            {/* Preview Area */}
            <div className="flex-1 w-full">
              <div className="bg-gray-100 rounded-xl p-8 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center min-h-[300px] relative overflow-hidden group">

                {/* Checkered Background Pattern for Transparency Check */}
                <div className="absolute inset-0 opacity-[0.03]"
                  style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }}
                />

                {user?.logo_url ? (
                  <div className="relative z-10 text-center">
                    <img
                      src={user.logo_url}
                      alt="Logo Atual"
                      className="max-w-[240px] max-h-[160px] object-contain drop-shadow-sm mb-6 transition-transform hover:scale-105 duration-300"
                    />
                    <div className="flex justify-center">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleRemoveLogo}
                        disabled={uploading}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Remover Logo
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center z-10">
                    <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                      <ImageIcon className="w-10 h-10" />
                    </div>
                    <p className="text-gray-500 font-medium">Nenhuma logo definida</p>
                    <p className="text-xs text-gray-400 mt-1">O sistema usará o nome da empresa em texto.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Config & Upload Area */}
            <div className="w-full md:w-80 flex-shrink-0 space-y-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Alterar Imagem</h3>
                <label className="block w-full">
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                  <div className={`
                    w-full flex items-center justify-center gap-2 px-4 py-3 
                    border border-gray-300 rounded-lg shadow-sm 
                    text-sm font-medium text-gray-700 bg-white
                    hover:bg-gray-50 cursor-pointer transition-colors
                    ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
                  `}>
                    {uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-green-600" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 text-gray-500" />
                        Escolher Arquivo
                      </>
                    )}
                  </div>
                </label>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-800">
                <h4 className="font-medium mb-1 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" /> Recomendações
                </h4>
                <ul className="list-disc list-inside space-y-1 text-blue-700/80 text-xs ml-1">
                  <li>Formato: <strong>PNG (Fundo Transparente)</strong></li>
                  <li>Dimensões ideais: <strong>200x200px</strong> ou retangular horizontal</li>
                  <li>Evite textos muito pequenos</li>
                </ul>
              </div>

              {message && (
                <Alert className={`
                  ${message.type === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-green-200 bg-green-50 text-green-800'}
                `}>
                  <AlertDescription className="flex items-center gap-2">
                    {message.type === 'error' ? <X className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                    {message.text}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}