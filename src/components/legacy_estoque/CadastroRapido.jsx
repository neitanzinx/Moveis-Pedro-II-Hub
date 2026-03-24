import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, CheckCircle } from "lucide-react";
import ProdutoForm from "../produtos/ProdutoForm";

export default function CadastroRapido() {
  const [mensagem, setMensagem] = useState(null);

  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Produto.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      setMensagem({
        tipo: 'sucesso',
        texto: 'Produto cadastrado com sucesso!'
      });
      setTimeout(() => {
        setMensagem(null);
      }, 3000);
    },
    onError: () => {
      setMensagem({
        tipo: 'erro',
        texto: 'Erro ao cadastrar produto'
      });
    }
  });

  const handleSave = (produtoData) => {
    createMutation.mutate(produtoData);
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2" style={{ color: '#07593f' }}>
          <Plus className="w-6 h-6" />
          Cadastro de Produto
        </CardTitle>
      </CardHeader>
      <CardContent>
        {mensagem && (
          <Alert className="border-2 bg-green-50 mb-6" style={{ borderColor: '#07593f' }}>
            <CheckCircle className="h-5 w-5" style={{ color: '#07593f' }} />
            <AlertDescription className="ml-2" style={{ color: '#07593f' }}>
              {mensagem.texto}
            </AlertDescription>
          </Alert>
        )}

        <ProdutoForm
          onSave={handleSave}
          isLoading={createMutation.isPending}
        />
      </CardContent>
    </Card>
  );
}