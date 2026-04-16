import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserCog, ArrowRight, ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function NovoUsuarioModal({ isOpen, onClose }) {
  const navigate = useNavigate();

  const handleNavigate = () => {
    onClose();
    navigate("/admin/GerenciamentoUsuarios");
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
            O vínculo entre funcionário e acesso do sistema agora é feito na área administrativa.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="bg-amber-50 p-4 rounded-lg flex items-start gap-3 border border-amber-200">
            <UserCog className="w-5 h-5 text-amber-600 mt-1 shrink-0" />
            <div className="text-sm text-gray-700">
              <p className="font-semibold text-amber-800 mb-1">Novo Fluxo:</p>
              <ol className="list-decimal pl-4 space-y-1">
                <li>O RH cadastra o <strong>funcionário</strong> no módulo de colaboradores.</li>
                <li>O administrador acessa <strong>Gestão de Acessos</strong>.</li>
                <li>Vincula funcionário e conta, e gera as credenciais.</li>
              </ol>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:justify-between">
          <Button variant="ghost" onClick={onClose} className="text-gray-500">
            Cancelar
          </Button>
          <Button onClick={handleNavigate} className="bg-amber-600 hover:bg-amber-700 text-white gap-2">
            Ir para Gestão de Acessos <ArrowRight className="w-4 h-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
