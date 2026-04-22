import { useState, useEffect } from 'react';
import { isPatientActiveOn } from '@/utils/dateHelpers';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { QuickWhatsAppButton } from '@/components/whatsapp/QuickWhatsAppButton';
import { resolveTemplate } from '@/hooks/useMessageTemplates';
import { openWhatsApp } from '@/hooks/useMessageTemplates';
import { Bell, CheckCircle2, X, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { WhatsAppIcon } from '@/components/ui/whatsapp-icon';

interface ReminderItem {
  patientId: string;
  patientName: string;
  phone: string | null;
  dueDay: number;
  daysUntilDue: number;
  amount: number;
  clinicName: string;
  isMinor: boolean;
  guardianName: string | null;
  guardianPhone: string | null;
  responsibleName: string | null;
  responsibleWhatsapp: string | null;
  financialResponsibleName: string | null;
  financialResponsibleWhatsapp: string | null;
  responsibleIsFinancial: boolean;
}

interface RecipientOption {
  label: string;
  name: string;
  phone: string;
}

export function PaymentReminders() {
  const { patients, clinics } = useApp();
  const { user } = useAuth();
  const [paidPatientIds, setPaidPatientIds] = useState<Set<string>>(new Set());
  const [therapistName, setTherapistName] = useState('');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [recipientModal, setRecipientModal] = useState<{ open: boolean; item: ReminderItem | null }>({ open: false, item: null });

  const today = new Date();
  const todayDay = today.getDate();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from('profiles').select('name').eq('user_id', user.id).maybeSingle(),
      supabase
        .from('patient_payment_records')
        .select('patient_id')
        .eq('user_id', user.id)
        .eq('month', currentMonth)
        .eq('year', currentYear)
        .eq('paid', true),
    ]).then(([profileRes, paidRes]) => {
      if (profileRes.data?.name) setTherapistName(profileRes.data.name);
      if (paidRes.data) setPaidPatientIds(new Set(paidRes.data.map((r: any) => r.patient_id)));
      setLoading(false);
    });
  }, [user, currentMonth, currentYear]);

  const reminders: ReminderItem[] = patients
    .filter(p => {
      if (!isPatientActiveOn(p)) return false;
      const dueDay = (p as any).paymentDueDay ?? (p as any).payment_due_day;
      if (!dueDay) return false;
      if (paidPatientIds.has(p.id)) return false;
      if (dismissed.has(p.id)) return false;
      const daysUntil = dueDay - todayDay;
      return daysUntil >= -7 && daysUntil <= 3;
    })
    .map(p => {
      const dueDay: number = (p as any).paymentDueDay ?? (p as any).payment_due_day;
      const clinic = clinics.find(c => c.id === p.clinicId);
      const phone = (p as any).whatsapp || (p as any).phone || null;
      return {
        patientId: p.id,
        patientName: p.name,
        phone,
        dueDay,
        daysUntilDue: dueDay - todayDay,
        amount: (p as any).paymentValue ?? (p as any).payment_value ?? 0,
        clinicName: clinic?.name || '',
        isMinor: (p as any).isMinor ?? (p as any).is_minor ?? false,
        guardianName: (p as any).guardianName ?? (p as any).guardian_name ?? null,
        guardianPhone: (p as any).guardianPhone ?? (p as any).guardian_phone ?? null,
        responsibleName: (p as any).responsibleName ?? (p as any).responsible_name ?? null,
        responsibleWhatsapp: (p as any).responsibleWhatsapp ?? (p as any).responsible_whatsapp ?? null,
        financialResponsibleName: (p as any).financialResponsibleName ?? (p as any).financial_responsible_name ?? null,
        financialResponsibleWhatsapp: (p as any).financialResponsibleWhatsapp ?? (p as any).financial_responsible_whatsapp ?? null,
        responsibleIsFinancial: (p as any).responsibleIsFinancial ?? (p as any).responsible_is_financial ?? true,
      };
    })
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);

  if (loading || reminders.length === 0) return null;

  const getMessageForRecipient = (item: ReminderItem, recipientName: string) => {
    const template = item.daysUntilDue <= 0
      ? 'Olá, {{nome_paciente}}! 😊 Passando para lembrar que o pagamento de R$ {{valor_sessao}} venceu no dia {{horario}}. Se já realizou, por favor desconsidere. Qualquer dúvida, estou à disposição! — {{nome_terapeuta}}'
      : 'Olá, {{nome_paciente}}! 😊 Tudo bem? Passando para avisar com antecedência que o pagamento de R$ {{valor_sessao}} vence no dia {{horario}}. Fico à disposição para qualquer dúvida! — {{nome_terapeuta}}';

    return resolveTemplate(template, {
      nome_paciente: recipientName,
      valor_sessao: item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
      horario: `${item.dueDay.toString().padStart(2, '0')}/${currentMonth.toString().padStart(2, '0')}`,
      nome_terapeuta: therapistName,
    });
  };

  const getRecipientOptions = (item: ReminderItem): RecipientOption[] => {
    const options: RecipientOption[] = [];

    if (item.isMinor) {
      // Guardian (legal responsible)
      if (item.guardianPhone) {
        options.push({
          label: 'Responsável Legal',
          name: item.guardianName || 'Responsável',
          phone: item.guardianPhone,
        });
      } else if (item.responsibleWhatsapp) {
        options.push({
          label: 'Responsável Legal',
          name: item.responsibleName || 'Responsável',
          phone: item.responsibleWhatsapp,
        });
      }

      // Financial responsible (if different from legal)
      if (!item.responsibleIsFinancial && item.financialResponsibleWhatsapp) {
        options.push({
          label: 'Responsável Financeiro',
          name: item.financialResponsibleName || 'Resp. Financeiro',
          phone: item.financialResponsibleWhatsapp,
        });
      }
    }

    // Fallback: patient's own phone
    if (options.length === 0 && item.phone) {
      options.push({
        label: 'Paciente',
        name: item.patientName,
        phone: item.phone,
      });
    }

    return options;
  };

  const handleWhatsAppClick = (item: ReminderItem) => {
    const options = getRecipientOptions(item);

    if (options.length <= 1) {
      // Single recipient or no recipients — direct send
      const recipient = options[0];
      if (recipient) {
        openWhatsApp(recipient.phone, getMessageForRecipient(item, recipient.name));
      }
    } else {
      // Multiple recipients — show modal
      setRecipientModal({ open: true, item });
    }
  };

  const handleSendToRecipient = (recipient: RecipientOption) => {
    if (!recipientModal.item) return;
    openWhatsApp(recipient.phone, getMessageForRecipient(recipientModal.item, recipient.name));
  };

  const handleSendToBoth = () => {
    if (!recipientModal.item) return;
    const options = getRecipientOptions(recipientModal.item);
    options.forEach((recipient, i) => {
      setTimeout(() => {
        openWhatsApp(recipient.phone, getMessageForRecipient(recipientModal.item!, recipient.name));
      }, i * 800);
    });
    setRecipientModal({ open: false, item: null });
  };

  const getDaysLabel = (daysUntil: number) => {
    if (daysUntil < 0) return { text: `${Math.abs(daysUntil)}d em atraso`, urgent: true };
    if (daysUntil === 0) return { text: 'Vence hoje', urgent: true };
    if (daysUntil === 1) return { text: 'Vence amanhã', urgent: false };
    return { text: `Em ${daysUntil} dias`, urgent: false };
  };

  const modalOptions = recipientModal.item ? getRecipientOptions(recipientModal.item) : [];

  return (
    <>
      <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Bell className="w-4 h-4 text-warning" />
          <h3 className="font-medium text-foreground text-sm">
            Lembretes de Pagamento
          </h3>
          <span className="ml-auto text-xs bg-warning/15 text-warning px-2 py-0.5 rounded-full font-semibold">
            {reminders.length}
          </span>
        </div>

        <div className="space-y-2">
          {reminders.map(item => {
            const { text, urgent } = getDaysLabel(item.daysUntilDue);
            const hasPhone = getRecipientOptions(item).length > 0;
            return (
              <div
                key={item.patientId}
                className={cn(
                  'flex items-center gap-2 p-2.5 rounded-lg border',
                  urgent
                    ? 'bg-destructive/5 border-destructive/20'
                    : 'bg-card border-border'
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.patientName}</p>
                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                    {item.amount > 0 && (
                      <span className="text-xs text-muted-foreground">
                        R$ {item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    )}
                    {item.clinicName && (
                      <span className="text-xs text-muted-foreground truncate">· {item.clinicName}</span>
                    )}
                    {item.isMinor && (
                      <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">Menor</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={cn(
                    'text-xs font-semibold px-2 py-0.5 rounded-full',
                    urgent
                      ? 'bg-destructive/10 text-destructive'
                      : 'bg-warning/10 text-warning'
                  )}>
                    {text}
                  </span>

                  {hasPhone && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleWhatsAppClick(item);
                      }}
                      className={cn(
                        'flex items-center justify-center rounded-full transition-colors shrink-0 w-6 h-6',
                        'bg-[hsl(142,70%,45%)/15] hover:bg-[hsl(142,70%,45%)/25] text-[hsl(142,70%,45%)]',
                      )}
                      aria-label="Enviar lembrete via WhatsApp"
                    >
                      <WhatsAppIcon className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    title="Dispensar aviso"
                    onClick={() => setDismissed(prev => new Set([...prev, item.patientId]))}
                    className="w-5 h-5 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          Os avisos somem automaticamente quando o pagamento for marcado como pago no Financeiro.
        </p>
      </div>

      {/* Recipient selection modal for minor patients */}
      <Dialog open={recipientModal.open} onOpenChange={(open) => setRecipientModal({ open, item: open ? recipientModal.item : null })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <WhatsAppIcon className="w-5 h-5 text-[#25D366]" />
              Enviar lembrete de pagamento
            </DialogTitle>
          </DialogHeader>

          {recipientModal.item && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Paciente: <span className="font-medium text-foreground">{recipientModal.item.patientName}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Escolha para quem deseja enviar o lembrete:
              </p>

              <div className="space-y-2">
                {modalOptions.map((opt) => (
                  <button
                    key={opt.phone}
                    onClick={() => {
                      handleSendToRecipient(opt);
                      setRecipientModal({ open: false, item: null });
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/60 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-[hsl(142,70%,45%)/15] flex items-center justify-center shrink-0">
                      <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{opt.name}</p>
                      <p className="text-xs text-muted-foreground">{opt.label} · {opt.phone}</p>
                    </div>
                    <Send className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>

              {modalOptions.length > 1 && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleSendToBoth}
                >
                  <WhatsAppIcon className="w-4 h-4 mr-2 text-[#25D366]" />
                  Enviar para ambos
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
