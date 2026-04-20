import { Dialog, DialogContent } from '@/components/ui/dialog';
import { UpgradeBlock } from '@/components/UpgradeBlock';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function AIUpgradeDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-4">
        <UpgradeBlock feature="ia" title="Melhorar com IA é exclusivo do plano Pro" description="Aprimore evoluções, gere documentos e relatórios com IA assinando o plano Pro." />
      </DialogContent>
    </Dialog>
  );
}
