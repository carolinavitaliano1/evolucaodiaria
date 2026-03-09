import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { QuickWhatsAppButton } from '@/components/whatsapp/QuickWhatsAppButton';
import { resolveTemplate } from '@/hooks/useMessageTemplates';
import { Bell, CheckCircle2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReminderItem {
  patientId: string;
  patientName: string;
  phone: string | null;
  dueDay: number;
  daysUntilDue: number; // negative = overdue
  amount: number;
  clinicName: string;
}

export function PaymentReminders() {
  const { patients, clinics } = useApp();
  const { user } = useAuth();
  const [paidPatientIds, setPaidPatientIds] = useState<Set<string>>(new Set());
  const [therapistName, setTherapistName] = useState('');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const todayDay = today.getDate();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  useEffect(() => {
    if (!user) return;
    // Load therapist name and already-paid patients for current month
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

  // Build reminders: patients with payment_due_day set, not archived, due in ≤3 days (or overdue up to 7 days)
  const reminders: ReminderItem[] = patients
    .filter(p => {
      if (p.isArchived) return false;
      if (!p.paymentDueDay) return false;
      if (paidPatientIds.has(p.id)) return false;
      if (dismissed.has(p.id)) return false;
      const dueDay = p.paymentDueDay;
      // How many days until due this month
      const daysUntil = dueDay - todayDay;
      // Show if due within 3 days (including today) or overdue up to 7 days
      return daysUntil >= -7 && daysUntil <= 3;
    })
    .map(p => {
      const clinic = clinics.find(c => c.id === p.clinicId);
      const phone = (p as any).whatsapp || (p as any).phone || (p as any).responsible_whatsapp || null;
      return {
        patientId: p.id,
        patientName: p.name,
        phone,
        dueDay: p.paymentDueDay!,
        daysUntilDue: p.paymentDueDay! - todayDay,
        amount: p.paymentValue || 0,
        clinicName: clinic?.name || '',
      };
    })
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);

  if (loading || reminders.length === 0) return null;

  const getMessageForDays = (item: ReminderItem) => {
    if (item.daysUntilDue <= 0) {
      // Due today or overdue
      return resolveTemplate(
        'Olá, {{nome_paciente}}! 😊 Passando para lembrar que o pagamento de R$ {{valor_sessao}} venceu hoje, dia {{horario}}. Se já realizou, por favor desconsidere. Qualquer dúvida, estou à disposição! — {{nome_terapeuta}}',
        {
          nome_paciente: item.patientName,
          valor_sessao: item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
          horario: `${item.dueDay.toString().padStart(2, '0')}/${currentMonth.toString().padStart(2, '0')}`,
          nome_terapeuta: therapistName,
        }
      );
    }
    // 1-3 days before
    return resolveTemplate(
      'Olá, {{nome_paciente}}! 😊 Tudo bem? Passando para avisar com antecedência que o pagamento de R$ {{valor_sessao}} vence no dia {{horario}}. Fico à disposição para qualquer dúvida! — {{nome_terapeuta}}',
      {
        nome_paciente: item.patientName,
        valor_sessao: item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
        horario: `${item.dueDay.toString().padStart(2, '0')}/${currentMonth.toString().padStart(2, '0')}`,
        nome_terapeuta: therapistName,
      }
    );
  };

  const getDaysLabel = (daysUntil: number) => {
    if (daysUntil < 0) return { text: `${Math.abs(daysUntil)}d em atraso`, urgent: true };
    if (daysUntil === 0) return { text: 'Vence hoje', urgent: true };
    if (daysUntil === 1) return { text: 'Vence amanhã', urgent: false };
    return { text: `Em ${daysUntil} dias`, urgent: false };
  };

  return (
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

                <QuickWhatsAppButton
                  phone={item.phone}
                  size="xs"
                  tooltip={item.daysUntilDue <= 0 ? 'Enviar cobrança via WhatsApp' : 'Enviar aviso antecipado via WhatsApp'}
                  message={getMessageForDays(item)}
                />

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
  );
}
