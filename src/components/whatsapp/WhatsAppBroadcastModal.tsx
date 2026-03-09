import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { WhatsAppIcon } from '@/components/ui/whatsapp-icon';
import { CheckCircle2, ChevronRight, X, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { openWhatsApp, resolveTemplate } from '@/hooks/useMessageTemplates';

interface BroadcastPatient {
  id: string;
  name: string;
  phone?: string | null;
  whatsapp?: string | null;
  responsible_name?: string | null;
  responsible_whatsapp?: string | null;
  email?: string | null;
  birthdate?: string | null;
}

interface BroadcastTemplate {
  id: string;
  name: string;
  content: string;
  category: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  patients: BroadcastPatient[];
  template: BroadcastTemplate;
  clinic?: { name?: string; address?: string; phone?: string };
  therapistName?: string;
}

export function WhatsAppBroadcastModal({ open, onClose, patients, template, clinic, therapistName = '' }: Props) {
  const [current, setCurrent] = useState(0);
  const [sent, setSent] = useState<Set<number>>(new Set());
  const [recipientChoice, setRecipientChoice] = useState<'patient' | 'responsible' | null>(null);

  const patient = patients[current];
  const total = patients.length;
  const done = current >= total;

  const hasPatientNum = !!(patient?.whatsapp || patient?.phone);
  const hasResponsible = !!patient?.responsible_whatsapp;
  const needsPick = hasPatientNum && hasResponsible && recipientChoice === null;

  function buildMsg(p: BroadcastPatient) {
    return resolveTemplate(template.content, {
      nome_paciente:     p.name,
      telefone_paciente: p.phone    || '',
      email_paciente:    p.email    || '',
      data_nascimento:   p.birthdate ? new Date(p.birthdate + 'T12:00:00').toLocaleDateString('pt-BR') : '',
      responsavel:       p.responsible_name || '',
      nome_clinica:      clinic?.name    || '',
      endereco_clinica:  clinic?.address || '',
      telefone_clinica:  clinic?.phone   || '',
    });
  }

  function sendCurrent() {
    if (!patient) return;

    let num: string;
    if (needsPick) return; // wait for choice

    if (hasPatientNum && hasResponsible) {
      num = recipientChoice === 'responsible'
        ? patient.responsible_whatsapp!
        : (patient.whatsapp || patient.phone!);
    } else if (hasResponsible) {
      num = patient.responsible_whatsapp!;
    } else {
      num = patient.whatsapp || patient.phone!;
    }

    openWhatsApp(num, buildMsg(patient));
    setSent(prev => new Set(prev).add(current));
  }

  function next() {
    sendCurrent();
    setRecipientChoice(null);
    setCurrent(c => c + 1);
  }

  function skip() {
    setRecipientChoice(null);
    setCurrent(c => c + 1);
  }

  function handleClose() {
    setCurrent(0);
    setSent(new Set());
    setRecipientChoice(null);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#25D366]/20 flex items-center justify-center">
              <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
            </div>
            Lista de Transmissão
          </DialogTitle>
        </DialogHeader>

        {/* Progress */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{Math.min(current, total)} de {total} enviados</span>
            <span className="font-medium text-foreground">{template.name}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-[#25D366] transition-all duration-300"
              style={{ width: `${(Math.min(current, total) / total) * 100}%` }}
            />
          </div>
        </div>

        {done ? (
          /* All done */
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="w-14 h-14 rounded-full bg-[#25D366]/15 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-[#25D366]" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Transmissão concluída!</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {sent.size} mensagem{sent.size !== 1 ? 'ns' : ''} enviada{sent.size !== 1 ? 's' : ''} de {total}
              </p>
            </div>
            <Button onClick={handleClose} className="mt-1 gap-2">
              <X className="w-4 h-4" />
              Fechar
            </Button>
          </div>
        ) : (
          /* Current patient card */
          <div className="space-y-4">
            {/* Patient info */}
            <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    {patient?.name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{patient?.name}</p>
                    {patient?.responsible_name && (
                      <p className="text-xs text-muted-foreground">Resp: {patient.responsible_name}</p>
                    )}
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">
                  {current + 1}/{total}
                </Badge>
              </div>

              {/* Recipient pick — only if both exist */}
              {needsPick ? (
                <div className="space-y-2 pt-1 border-t border-border mt-2">
                  <p className="text-xs text-muted-foreground font-medium">Enviar para quem?</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setRecipientChoice('patient')}
                      className={cn(
                        'rounded-lg border p-2.5 text-left transition-colors text-xs',
                        recipientChoice === 'patient'
                          ? 'border-[#25D366] bg-[#25D366]/10 text-foreground'
                          : 'border-border hover:border-[#25D366]/50'
                      )}
                    >
                      <WhatsAppIcon className="w-3.5 h-3.5 text-[#25D366] mb-1" />
                      <p className="font-medium">Paciente</p>
                      <p className="text-muted-foreground truncate">{patient?.whatsapp || patient?.phone}</p>
                    </button>
                    <button
                      onClick={() => setRecipientChoice('responsible')}
                      className={cn(
                        'rounded-lg border p-2.5 text-left transition-colors text-xs',
                        recipientChoice === 'responsible'
                          ? 'border-[#25D366] bg-[#25D366]/10 text-foreground'
                          : 'border-border hover:border-[#25D366]/50'
                      )}
                    >
                      <WhatsAppIcon className="w-3.5 h-3.5 text-[#25D366] mb-1" />
                      <p className="font-medium">Responsável</p>
                      <p className="text-muted-foreground truncate">{patient?.responsible_whatsapp}</p>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 pt-1 border-t border-border mt-1">
                  <WhatsAppIcon className="w-3 h-3 text-[#25D366]" />
                  <span className="text-xs text-muted-foreground">
                    {recipientChoice === 'responsible'
                      ? patient?.responsible_whatsapp
                      : (patient?.whatsapp || patient?.phone)}
                    {recipientChoice === 'responsible' && patient?.responsible_name
                      ? ` (${patient.responsible_name})`
                      : ''}
                  </span>
                </div>
              )}
            </div>

            {/* Message preview */}
            <div className="rounded-lg bg-[#25D366]/5 border border-[#25D366]/20 px-3 py-2">
              <p className="text-[11px] text-muted-foreground font-medium mb-1">Prévia da mensagem</p>
              <p className="text-xs text-foreground leading-relaxed line-clamp-3">
                {patient ? buildMsg(patient) : ''}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={skip}
                className="flex-none text-xs"
              >
                Pular
              </Button>
              <Button
                size="sm"
                onClick={next}
                disabled={needsPick && recipientChoice === null}
                className="flex-1 gap-1.5 bg-[#25D366] hover:bg-[#1ebe57] text-white border-0 text-xs"
              >
                <WhatsAppIcon className="w-3.5 h-3.5" />
                Abrir WhatsApp
                {current + 1 < total && <ChevronRight className="w-3 h-3" />}
              </Button>
            </div>

            {/* Remaining count */}
            {current + 1 < total && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="w-3 h-3" />
                Ainda {total - current - 1} paciente{total - current - 1 !== 1 ? 's' : ''} na fila
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
