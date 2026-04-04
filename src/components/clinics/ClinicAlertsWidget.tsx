import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toLocalDateString } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, DollarSign, FileText, MessageSquare,
  UserPlus, Sparkles,
} from 'lucide-react';

interface ClinicAlertsWidgetProps {
  clinicId: string;
}

export function ClinicAlertsWidget({ clinicId }: ClinicAlertsWidgetProps) {
  const { patients, evolutions } = useApp();
  const { user } = useAuth();

  const [overduePayments, setOverduePayments] = useState(0);
  const [pendingEnrollments, setPendingEnrollments] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [intakeReviews, setIntakeReviews] = useState(0);
  const [loading, setLoading] = useState(true);

  const clinicPatients = useMemo(
    () => patients.filter(p => p.clinicId === clinicId && !p.isArchived),
    [patients, clinicId]
  );

  // Missing evolutions for this clinic (last 7 days)
  const missingEvolutions = useMemo(() => {
    const today = new Date();
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    let missing = 0;

    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = toLocalDateString(d);
      const dayName = days[d.getDay()];

      for (const p of clinicPatients) {
        if (new Date(p.createdAt) > d) continue;
        if (!p.weekdays?.includes(dayName)) continue;
        const hasEvolution = evolutions.some(
          e => e.patientId === p.id && e.clinicId === clinicId && e.date === dateStr
        );
        if (!hasEvolution) missing++;
      }
    }
    return missing;
  }, [clinicPatients, evolutions, clinicId]);

  // Fetch clinic-specific counts
  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    const clinicPatientIds = clinicPatients.map(p => p.id);

    Promise.all([
      // Overdue payments for this clinic
      clinicPatientIds.length > 0
        ? supabase
            .from('patient_payment_records')
            .select('id', { count: 'exact', head: true })
            .eq('clinic_id', clinicId)
            .eq('month', currentMonth)
            .eq('year', currentYear)
            .eq('paid', false)
        : Promise.resolve({ count: 0 }),
      // Pending enrollments for this clinic
      supabase
        .from('patients')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', clinicId)
        .eq('status', 'pendente'),
      // Unread portal messages from patients in this clinic
      clinicPatientIds.length > 0
        ? supabase
            .from('portal_messages')
            .select('id', { count: 'exact', head: true })
            .eq('therapist_user_id', user.id)
            .eq('sender_type', 'patient')
            .eq('read_by_therapist', false)
            .in('patient_id', clinicPatientIds)
        : Promise.resolve({ count: 0 }),
      // Intake forms needing review for patients in this clinic
      clinicPatientIds.length > 0
        ? supabase
            .from('patient_intake_forms')
            .select('id', { count: 'exact', head: true })
            .eq('therapist_user_id', user.id)
            .eq('needs_review', true)
            .in('patient_id', clinicPatientIds)
        : Promise.resolve({ count: 0 }),
    ]).then(([payments, enrollments, messages, intakes]) => {
      setOverduePayments((payments as any).count ?? 0);
      setPendingEnrollments((enrollments as any).count ?? 0);
      setUnreadMessages((messages as any).count ?? 0);
      setIntakeReviews((intakes as any).count ?? 0);
      setLoading(false);
    });
  }, [user, clinicId, clinicPatients.length]);

  const alerts = useMemo(() => {
    const items: { key: string; icon: React.ReactNode; label: string; count: number; color: string }[] = [];

    if (overduePayments > 0) {
      items.push({
        key: 'payments',
        icon: <DollarSign className="w-3.5 h-3.5" />,
        label: `${overduePayments} pagamento${overduePayments > 1 ? 's' : ''} pendente${overduePayments > 1 ? 's' : ''}`,
        count: overduePayments,
        color: 'text-orange-500',
      });
    }

    if (missingEvolutions > 0) {
      items.push({
        key: 'evolutions',
        icon: <FileText className="w-3.5 h-3.5" />,
        label: `${missingEvolutions} evolução${missingEvolutions > 1 ? 'ões' : ''} em atraso`,
        count: missingEvolutions,
        color: 'text-red-500',
      });
    }

    if (unreadMessages > 0) {
      items.push({
        key: 'messages',
        icon: <MessageSquare className="w-3.5 h-3.5" />,
        label: `${unreadMessages} mensagem${unreadMessages > 1 ? 'ns' : ''} não lida${unreadMessages > 1 ? 's' : ''}`,
        count: unreadMessages,
        color: 'text-blue-500',
      });
    }

    if (pendingEnrollments > 0) {
      items.push({
        key: 'enrollments',
        icon: <UserPlus className="w-3.5 h-3.5" />,
        label: `${pendingEnrollments} matrícula${pendingEnrollments > 1 ? 's' : ''} pendente${pendingEnrollments > 1 ? 's' : ''}`,
        count: pendingEnrollments,
        color: 'text-purple-500',
      });
    }

    if (intakeReviews > 0) {
      items.push({
        key: 'intake-reviews',
        icon: <FileText className="w-3.5 h-3.5" />,
        label: `${intakeReviews} ficha${intakeReviews > 1 ? 's' : ''} atualizada${intakeReviews > 1 ? 's' : ''} p/ revisão`,
        count: intakeReviews,
        color: 'text-teal-500',
      });
    }

    return items;
  }, [overduePayments, missingEvolutions, unreadMessages, pendingEnrollments, intakeReviews]);

  const allClear = alerts.length === 0 && !loading;

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-primary" />
          <span className="font-medium text-foreground text-sm">Alertas</span>
        </div>
        <div className="space-y-2">
          {[1, 2].map(i => (
            <div key={i} className="h-6 bg-muted/50 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (allClear) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary/60" />
          <span className="text-sm text-muted-foreground">Tudo em dia nesta unidade ✨</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
      <div className="flex items-center gap-2 mb-2.5">
        <AlertTriangle className="w-4 h-4 text-warning" />
        <span className="font-medium text-foreground text-sm">Alertas e Pendências</span>
        <span className="ml-auto text-xs bg-destructive/15 text-destructive px-2 py-0.5 rounded-full font-semibold">
          {alerts.reduce((a, b) => a + b.count, 0)}
        </span>
      </div>
      <div className="space-y-1">
        {alerts.map(alert => (
          <div
            key={alert.key}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-left"
          >
            <span className={cn("shrink-0", alert.color)}>{alert.icon}</span>
            <span className="text-xs text-foreground">{alert.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
