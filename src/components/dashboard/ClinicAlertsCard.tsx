import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { usePendingEnrollments } from '@/hooks/usePendingEnrollments';
import { toLocalDateString } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import {
  AlertTriangle, DollarSign, FileText, MessageSquare,
  ClipboardList, UserPlus, CheckCircle2, ChevronRight, Sparkles,
} from 'lucide-react';

interface AlertItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  count: number;
  color: string;
  onClick: () => void;
}

export function ClinicAlertsCard() {
  const { patients, clinics, tasks, evolutions } = useApp();
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { count: pendingEnrollments } = usePendingEnrollments();

  const [overduePayments, setOverduePayments] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [intakeReviews, setIntakeReviews] = useState(0);
  const [loading, setLoading] = useState(true);

  const todayStr = toLocalDateString(new Date());

  // Pending tasks for today
  const pendingTasks = useMemo(() => tasks.filter(t => !t.completed).length, [tasks]);

  // Missing evolutions (sessions with no evolution in the last 7 days)
  const missingEvolutions = useMemo(() => {
    if (!user) return 0;
    const today = new Date();
    const activePatients = patients.filter(p => !p.isArchived && p.clinicId);
    let missing = 0;

    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = toLocalDateString(d);
      const dayName = days[d.getDay()];

      for (const p of activePatients) {
        if (new Date(p.createdAt) > d) continue;
        if (!p.weekdays?.includes(dayName)) continue;
        const hasEvolution = evolutions.some(
          e => e.patientId === p.id && e.date === dateStr
        );
        if (!hasEvolution) missing++;
      }
    }
    return missing;
  }, [patients, evolutions, user]);

  // Fetch overdue payments and unread portal messages
  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    const todayDay = today.getDate();

    Promise.all([
      // Overdue / upcoming payments (due within 3 days or already overdue this month)
      supabase
        .from('patient_payment_records')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('month', currentMonth)
        .eq('year', currentYear)
        .eq('paid', false),
      // Unread portal messages
      supabase
        .from('portal_messages')
        .select('id', { count: 'exact', head: true })
        .eq('therapist_user_id', user.id)
        .eq('sender_type', 'patient')
        .eq('read_by_therapist', false),
    ]).then(([payments, messages]) => {
      setOverduePayments(payments.count ?? 0);
      setUnreadMessages(messages.count ?? 0);
      setLoading(false);
    });
  }, [user, todayStr]);

  const alerts: AlertItem[] = useMemo(() => {
    const items: AlertItem[] = [];

    if (overduePayments > 0) {
      items.push({
        key: 'payments',
        icon: <DollarSign className="w-4 h-4" />,
        label: `${overduePayments} pagamento${overduePayments > 1 ? 's' : ''} pendente${overduePayments > 1 ? 's' : ''}`,
        count: overduePayments,
        color: 'text-orange-500',
        onClick: () => navigate('/financial'),
      });
    }

    if (missingEvolutions > 0) {
      items.push({
        key: 'evolutions',
        icon: <FileText className="w-4 h-4" />,
        label: `${missingEvolutions} evolução${missingEvolutions > 1 ? 'ões' : ''} em atraso`,
        count: missingEvolutions,
        color: 'text-red-500',
        onClick: () => {}, // handled by MissingEvolutionsAlert
      });
    }

    if (unreadMessages > 0) {
      items.push({
        key: 'messages',
        icon: <MessageSquare className="w-4 h-4" />,
        label: `${unreadMessages} mensagem${unreadMessages > 1 ? 'ns' : ''} não lida${unreadMessages > 1 ? 's' : ''}`,
        count: unreadMessages,
        color: 'text-blue-500',
        onClick: () => navigate('/patients'),
      });
    }

    if (pendingTasks > 0) {
      items.push({
        key: 'tasks',
        icon: <ClipboardList className="w-4 h-4" />,
        label: `${pendingTasks} tarefa${pendingTasks > 1 ? 's' : ''} pendente${pendingTasks > 1 ? 's' : ''}`,
        count: pendingTasks,
        color: 'text-yellow-500',
        onClick: () => navigate('/tasks'),
      });
    }

    if (pendingEnrollments > 0) {
      items.push({
        key: 'enrollments',
        icon: <UserPlus className="w-4 h-4" />,
        label: `${pendingEnrollments} matrícula${pendingEnrollments > 1 ? 's' : ''} aguardando revisão`,
        count: pendingEnrollments,
        color: 'text-purple-500',
        onClick: () => {}, // handled inline by PendingEnrollmentsCard
      });
    }

    return items;
  }, [overduePayments, missingEvolutions, unreadMessages, pendingTasks, pendingEnrollments, navigate]);

  const allClear = alerts.length === 0 && !loading;

  return (
    <div className={cn(
      "rounded-xl border p-4",
      theme === 'lilas' ? 'calendar-grid border-0' : 'bg-card border-border'
    )}>
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-primary" />
        <h3 className="font-medium text-foreground text-sm">Alertas e Pendências</h3>
        {!allClear && !loading && (
          <span className="ml-auto bg-destructive/15 text-destructive text-xs font-semibold px-2 py-0.5 rounded-full">
            {alerts.reduce((a, b) => a + b.count, 0)}
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-8 bg-muted/50 rounded animate-pulse" />
          ))}
        </div>
      ) : allClear ? (
        <div className="text-center py-4">
          <Sparkles className="w-8 h-8 text-primary/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Tudo em dia por aqui! ✨</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {alerts.map(alert => (
            <button
              key={alert.key}
              onClick={alert.onClick}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted/60 transition-colors text-left group"
            >
              <span className={cn("shrink-0", alert.color)}>{alert.icon}</span>
              <span className="text-sm text-foreground flex-1">{alert.label}</span>
              {alert.onClick.toString() !== '() => {}' && (
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
