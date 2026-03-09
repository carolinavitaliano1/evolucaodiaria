import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { WhatsAppIcon } from '@/components/ui/whatsapp-icon';
import { User, Users } from 'lucide-react';

interface WhatsAppRecipientModalProps {
  open: boolean;
  onClose: () => void;
  patientName: string;
  patientWhatsapp?: string | null;
  patientPhone?: string | null;
  responsibleName?: string | null;
  responsibleWhatsapp: string;
}

function openWa(number: string) {
  const cleaned = number.replace(/\D/g, '');
  const full = cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
  window.open(`https://wa.me/${full}`, '_blank');
}

export function WhatsAppRecipientModal({
  open,
  onClose,
  patientName,
  patientWhatsapp,
  patientPhone,
  responsibleName,
  responsibleWhatsapp,
}: WhatsAppRecipientModalProps) {
  const patientNumber = patientWhatsapp || patientPhone;

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
          {patientName} tem dois números de WhatsApp cadastrados. Escolha o destinatário:
        </p>

        <div className="flex flex-col gap-2 pt-1">
          {patientNumber && (
            <button
              onClick={() => { openWa(patientNumber); onClose(); }}
              className="flex items-center gap-3 rounded-xl border border-border bg-card hover:bg-accent/60 transition-colors p-4 text-left group"
            >
              <div className="w-9 h-9 rounded-full bg-[#25D366]/15 flex items-center justify-center shrink-0 group-hover:bg-[#25D366]/25 transition-colors">
                <User className="w-4 h-4 text-[#25D366]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Paciente</p>
                <p className="text-xs text-muted-foreground truncate">{patientName}</p>
                <p className="text-xs text-[#25D366] font-medium">{patientNumber}</p>
              </div>
              <WhatsAppIcon className="w-4 h-4 text-[#25D366]/60 group-hover:text-[#25D366] transition-colors shrink-0" />
            </button>
          )}

          <button
            onClick={() => { openWa(responsibleWhatsapp); onClose(); }}
            className="flex items-center gap-3 rounded-xl border border-border bg-card hover:bg-accent/60 transition-colors p-4 text-left group"
          >
            <div className="w-9 h-9 rounded-full bg-[#25D366]/15 flex items-center justify-center shrink-0 group-hover:bg-[#25D366]/25 transition-colors">
              <Users className="w-4 h-4 text-[#25D366]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Responsável</p>
              {responsibleName && (
                <p className="text-xs text-muted-foreground truncate">{responsibleName}</p>
              )}
              <p className="text-xs text-[#25D366] font-medium">{responsibleWhatsapp}</p>
            </div>
            <WhatsAppIcon className="w-4 h-4 text-[#25D366]/60 group-hover:text-[#25D366] transition-colors shrink-0" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
