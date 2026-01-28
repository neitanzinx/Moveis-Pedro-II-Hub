import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserCog, ArrowRight, ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function NovoUsuarioModal({ isOpen, onClose }) {
  const navigate = useNavigate();

  const handleNavigate = () => {
    onClose();
    navigate("/admin/RecursosHumanos");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <ShieldAlert className="w-5 h-5" />
            Mudança no Processo
          </DialogTitle>
          <DialogDescription>
            A criação de usuários foi unificada com o gerenciamento de colaboradores (RH).
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="bg-amber-50 p-4 rounded-lg flex items-start gap-3 border border-amber-200">
            <UserCog className="w-5 h-5 text-amber-600 mt-1 shrink-0" />
            <div className="text-sm text-gray-700">
              <p className="font-semibold text-amber-800 mb-1">Novo Fluxo:</p>
              <ol className="list-decimal pl-4 space-y-1">
                <li>Acesse o menu <strong>RH</strong>.</li>
                <li>Cadastre um novo <strong>Colaborador</strong> (ou edite um existente).</li>
                <li>Vá até a aba <strong>Sistema</strong> para gerar o acesso.</li>
              </ol>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:justify-between">
          <Button variant="ghost" onClick={onClose} className="text-gray-500">
            Cancelar
          </Button>
          <Button onClick={handleNavigate} className="bg-amber-600 hover:bg-amber-700 text-white gap-2">
            Ir para RH <ArrowRight className="w-4 h-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
