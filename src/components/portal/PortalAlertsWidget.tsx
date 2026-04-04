import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { usePortal } from '@/contexts/PortalContext';
import { AlertTriangle, FileText, DollarSign, Bell, MessageSquare, ClipboardList, ChevronRight, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { differenceInDays, setDate, startOfDay, addMonths, isBefore } from 'date-fns';

interface PortalAlert {
  id: string;
  type: 'contract' | 'payment_due' | 'payment_overdue' | 'notices' | 'messages' | 'activities';
  title: string;
  description: string;
  icon: typeof AlertTriangle;
  color: string;
  route: string;
  priority: number;
}

export function PortalAlertsWidget() {
  const { portalAccount, patient, unreadCount } = usePortal();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<PortalAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!portalAccount || !patient) {
      setLoading(false);
      return;
    }
    loadAlerts();
  }, [portalAccount, patient, unreadCount]);

  const loadAlerts = async () => {
    if (!portalAccount || !patient) return;
    const newAlerts: PortalAlert[] = [];

    try {
      // 1. Check unsigned contracts
      const { data: contracts } = await supabase
        .from('patient_contracts')
        .select('id, status')
        .eq('patient_id', portalAccount.patient_id)
        .eq('status', 'pending');

      if (contracts && contracts.length > 0) {
        newAlerts.push({
          id: 'contract',
          type: 'contract',
          title: 'Contrato pendente',
          description: `Você tem ${contracts.length} contrato(s) aguardando assinatura.`,
          icon: FileText,
          color: 'text-orange-500',
          route: '/portal/contrato',
          priority: 1,
        });
      }

      // 2. Check payment status
      const paymentDueDay = patient.payment_due_day;
      if (paymentDueDay) {
        const today = startOfDay(new Date());
        let dueDate = startOfDay(setDate(new Date(), paymentDueDay));

        // Current month payment record
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();

        const { data: paymentRecord } = await supabase
          .from('patient_payment_records')
          .select('paid')
          .eq('patient_id', portalAccount.patient_id)
          .eq('month', currentMonth)
          .eq('year', currentYear)
          .maybeSingle();

        const isPaid = paymentRecord?.paid === true;

        if (!isPaid) {
          // Check if due date is past (overdue)
          const dueDateThisMonth = startOfDay(setDate(new Date(), paymentDueDay));
          const daysUntilDue = differenceInDays(dueDateThisMonth, today);

          if (daysUntilDue < 0) {
            // Overdue
            newAlerts.push({
              id: 'payment_overdue',
              type: 'payment_overdue',
              title: 'Pagamento em atraso',
              description: `O vencimento era dia ${paymentDueDay}. Regularize o pagamento.`,
              icon: AlertTriangle,
              color: 'text-destructive',
              route: '/portal/financeiro',
              priority: 0,
            });
          } else if (daysUntilDue <= 5) {
            // Due soon
            const label = daysUntilDue === 0
              ? 'O pagamento vence hoje!'
              : `Faltam ${daysUntilDue} dia(s) para o vencimento (dia ${paymentDueDay}).`;
            newAlerts.push({
              id: 'payment_due',
              type: 'payment_due',
              title: 'Pagamento próximo',
              description: label,
              icon: CalendarDays,
              color: 'text-yellow-500',
              route: '/portal/financeiro',
              priority: 2,
            });
          }
        }
      }

      // 3. Unread notices
      const { data: notices } = await supabase
        .from('portal_notices')
        .select('id')
        .eq('patient_id', portalAccount.patient_id)
        .eq('read_by_patient', false);

      if (notices && notices.length > 0) {
        newAlerts.push({
          id: 'notices',
          type: 'notices',
          title: 'Avisos não lidos',
          description: `Você tem ${notices.length} aviso(s) do terapeuta.`,
          icon: Bell,
          color: 'text-primary',
          route: '/portal/avisos',
          priority: 3,
        });
      }

      // 4. Unread messages
      if (unreadCount > 0) {
        newAlerts.push({
          id: 'messages',
          type: 'messages',
          title: 'Mensagens não lidas',
          description: `${unreadCount} mensagem(ns) nova(s) do terapeuta.`,
          icon: MessageSquare,
          color: 'text-primary',
          route: '/portal/mensagens',
          priority: 4,
        });
      }

      // 5. Pending activities
      const { data: activities } = await supabase
        .from('portal_activities')
        .select('id')
        .eq('patient_id', portalAccount.patient_id)
        .eq('status', 'pending');

      if (activities && activities.length > 0) {
        newAlerts.push({
          id: 'activities',
          type: 'activities',
          title: 'Atividades pendentes',
          description: `${activities.length} atividade(s) para completar.`,
          icon: ClipboardList,
          color: 'text-primary',
          route: '/portal/atividades',
          priority: 5,
        });
      }

      newAlerts.sort((a, b) => a.priority - b.priority);
      setAlerts(newAlerts);
    } catch (e) {
      console.error('Error loading portal alerts:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading || alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Pendências
      </p>
      {alerts.map(alert => {
        const Icon = alert.icon;
        return (
          <button
            key={alert.id}
            onClick={() => navigate(alert.route)}
            className={cn(
              'w-full flex items-center gap-3 bg-card rounded-2xl border border-border p-3.5',
              'hover:border-primary/30 transition-colors active:scale-[0.98]',
              alert.type === 'payment_overdue' && 'border-destructive/30 bg-destructive/5',
              alert.type === 'payment_due' && 'border-yellow-500/30 bg-yellow-500/5',
              alert.type === 'contract' && 'border-orange-500/30 bg-orange-500/5',
            )}
          >
            <div className={cn(
              'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
              alert.type === 'payment_overdue' && 'bg-destructive/10',
              alert.type === 'payment_due' && 'bg-yellow-500/10',
              alert.type === 'contract' && 'bg-orange-500/10',
              !['payment_overdue', 'payment_due', 'contract'].includes(alert.type) && 'bg-primary/10',
            )}>
              <Icon className={cn('w-4 h-4', alert.color)} />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-foreground">{alert.title}</p>
              <p className="text-xs text-muted-foreground">{alert.description}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        );
      })}
    </div>
  );
}
