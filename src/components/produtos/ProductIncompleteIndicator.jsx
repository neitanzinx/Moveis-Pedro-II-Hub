import { useMemo, useState } from 'react';
import { AlertCircle, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { getProductMissingItems } from '@/utils/productMissingItems';

export default function ProductIncompleteIndicator({
  produto,
  onSelectMissing,
  canEdit = true,
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);

  const missingItems = useMemo(
    () => getProductMissingItems(produto),
    [produto]
  );

  if (missingItems.length === 0) {
    return null;
  }

  const handleOpen = (event) => {
    event?.stopPropagation?.();
    setIsOpen(true);
  };

  const handleSelect = (event, item) => {
    event.stopPropagation();

    if (canEdit && onSelectMissing) {
      onSelectMissing(item);
      setIsOpen(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={`group relative inline-flex h-5 w-5 items-center justify-center rounded-full ${className}`}
        aria-label={`Produto com cadastro parcial. ${missingItems.length} pendência(s).`}
        title={`Cadastro parcial: ${missingItems.length} pendência(s)`}
      >
        <span className="h-2.5 w-2.5 rounded-full bg-yellow-400 ring-2 ring-yellow-100 transition-colors group-hover:bg-yellow-500" />
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-yellow-700">
              <AlertCircle className="h-5 w-5" />
              Cadastro parcial
            </DialogTitle>
            <DialogDescription>
              Clique em um item para abrir a edição exatamente no campo faltante.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {missingItems.map((item) => (
              <Button
                key={item.key}
                type="button"
                variant="outline"
                className="w-full justify-between"
                onClick={(event) => handleSelect(event, item)}
                disabled={!canEdit}
              >
                <span>{item.label}</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            ))}
          </div>

          {!canEdit && (
            <p className="text-sm text-gray-500">
              Você não possui permissão para editar este produto.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
