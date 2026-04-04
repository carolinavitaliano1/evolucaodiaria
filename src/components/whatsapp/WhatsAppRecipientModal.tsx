import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { WhatsAppIcon } from '@/components/ui/whatsapp-icon';
import { User, Users, Wallet } from 'lucide-react';

interface Recipient {
  label: string;
  name: string;
  number: string;
}

interface WhatsAppRecipientModalProps {
  open: boolean;
  onClose: () => void;
  patientName: string;
  recipients: Recipient[];
  message?: string;
}

function openWa(number: string, message?: string) {
  const cleaned = number.replace(/\D/g, '');
  const full = cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
  const encoded = message ? `?text=${encodeURIComponent(message)}` : '';
  window.open(`https://wa.me/${full}${encoded}`, '_blank');
}

function getIcon(label: string) {
  if (label.toLowerCase().includes('financeiro')) return <Wallet className="w-4 h-4 text-[#25D366]" />;
  if (label.toLowerCase().includes('responsável') || label.toLowerCase().includes('guardião')) return <Users className="w-4 h-4 text-[#25D366]" />;
  return <User className="w-4 h-4 text-[#25D366]" />;
}

export function WhatsAppRecipientModal({
  open,
  onClose,
  patientName,
  recipients,
  message,
}: WhatsAppRecipientModalProps) {
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
            Enviar mensagem para quem?
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground -mt-1">
          Escolha o destinatário da mensagem de <span className="font-medium text-foreground">{patientName}</span>:
        </p>

        <div className="flex flex-col gap-2 pt-1">
          {recipients.map((r, i) => (
            <button
              key={i}
              onClick={() => { openWa(r.number, message); onClose(); }}
              className="flex items-center gap-3 rounded-xl border border-border bg-card hover:bg-accent/60 transition-colors p-4 text-left group"
            >
              <div className="w-9 h-9 rounded-full bg-[#25D366]/15 flex items-center justify-center shrink-0 group-hover:bg-[#25D366]/25 transition-colors">
                {getIcon(r.label)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{r.label}</p>
                <p className="text-xs text-muted-foreground truncate">{r.name}</p>
                <p className="text-xs text-[#25D366] font-medium">{r.number}</p>
              </div>
              <WhatsAppIcon className="w-4 h-4 text-[#25D366]/60 group-hover:text-[#25D366] transition-colors shrink-0" />
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
