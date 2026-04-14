import { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { usePendingEnrollments } from '@/hooks/usePendingEnrollments';
import { toLocalDateString } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { toast } from 'sonner';
import {
  AlertTriangle, DollarSign, FileText, MessageSquare,
  ClipboardList, UserPlus, ChevronRight, ChevronDown, Sparkles,
  CheckCircle2, X, Paperclip,
} from 'lucide-react';

interface PatientRef {
  id: string;
  name: string;
}

interface AlertGroup {
  key: string;
  icon: React.ReactNode;
  label: string;
  count: number;
  color: string;
  patients: PatientRef[];
  fallbackClick?: () => void;
}

const DISMISSED_KEY = 'clinipro_dismissed_alerts';

function getDismissedAlerts(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '{}');
  } catch { return {}; }
}

function dismissAlert(key: string) {
  const current = getDismissedAlerts();
  current[key] = toLocalDateString(new Date());
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(current));
}

function isAlertDismissed(key: string): boolean {
  const current = getDismissedAlerts();
  return current[key] === toLocalDateString(new Date());
}

export function ClinicAlertsCard() {
  const { patients, tasks, evolutions } = useApp();
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { count: pendingEnrollments } = usePendingEnrollments();

  const [overduePaymentPatients, setOverduePaymentPatients] = useState<PatientRef[]>([]);
  const [unreadMessagePatients, setUnreadMessagePatients] = useState<PatientRef[]>([]);
  const [intakeReviewPatients, setIntakeReviewPatients] = useState<PatientRef[]>([]);
  const [pendingReceiptPatients, setPendingReceiptPatients] = useState<PatientRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Record<string, string>>(getDismissedAlerts());

  const todayStr = toLocalDateString(new Date());

  const pendingTasks = useMemo(() => tasks.filter(t => !t.completed).length, [tasks]);

  const missingEvolutionPatients = useMemo(() => {
    if (!user) return [];
    const today = new Date();
    const activePatients = patients.filter(p => !p.isArchived && p.clinicId);
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const patientSet = new Map<string, PatientRef>();

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
        if (!hasEvolution) {
          patientSet.set(p.id, { id: p.id, name: p.name });
        }
      }
    }
    return Array.from(patientSet.values());
  }, [patients, evolutions, user]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();

    Promise.all([
      supabase
        .from('patient_payment_records')
        .select('patient_id')
        .eq('user_id', user.id)
        .eq('month', currentMonth)
        .eq('year', currentYear)
        .eq('paid', false),
      supabase
        .from('portal_messages')
        .select('patient_id')
        .eq('therapist_user_id', user.id)
        .eq('sender_type', 'patient')
        .eq('read_by_therapist', false),
      supabase
        .from('patient_intake_forms')
        .select('patient_id')
        .eq('therapist_user_id', user.id)
        .eq('needs_review', true),
      supabase
        .from('portal_documents')
        .select('patient_id')
        .eq('therapist_user_id', user.id)
        .eq('therapist_reviewed', false)
        .ilike('name', 'Comprovante%'),
    ]).then(([paymentsRes, messagesRes, intakesRes, receiptsRes]) => {
      const findPatient = (pid: string): PatientRef => {
        const p = patients.find(cp => cp.id === pid);
        return { id: pid, name: p?.name || 'Paciente' };
      };

      const uniqueByPatient = (items: { patient_id: string }[]): PatientRef[] => {
        const seen = new Set<string>();
        return items.filter(i => {
          if (seen.has(i.patient_id)) return false;
          seen.add(i.patient_id);
          return true;
        }).map(i => findPatient(i.patient_id));
      };

      setOverduePaymentPatients(uniqueByPatient((paymentsRes.data as any[]) || []));
      setUnreadMessagePatients(uniqueByPatient((messagesRes.data as any[]) || []));
      setIntakeReviewPatients(uniqueByPatient((intakesRes.data as any[]) || []));
      setPendingReceiptPatients(uniqueByPatient((receiptsRes.data as any[]) || []));
      setLoading(false);
    });
  }, [user, todayStr, patients]);

  const handlePatientClick = (patientId: string, alertKey: string) => {
    switch (alertKey) {
      case 'payments':
        navigate(`/patients/${patientId}#financeiro`);
        break;
      case 'messages':
        navigate(`/patients/${patientId}#portal`);
        break;
      case 'intake-reviews':
        navigate(`/patients/${patientId}#portal`);
        break;
      case 'evolutions':
        navigate(`/patients/${patientId}`);
        break;
      case 'receipts':
        navigate(`/patients/${patientId}#financeiro`);
        break;
      default:
        navigate(`/patients/${patientId}`);
    }
  };

  const handleDismiss = useCallback((alertKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    dismissAlert(alertKey);
    setDismissed({ ...getDismissedAlerts() });
    toast.success('Alerta ocultado por hoje');
  }, []);

  const handleMarkRead = useCallback(async (alertKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;

    if (alertKey === 'messages') {
      const patientIds = unreadMessagePatients.map(p => p.id);
      if (patientIds.length > 0) {
        await supabase
          .from('portal_messages')
          .update({ read_by_therapist: true })
          .eq('therapist_user_id', user.id)
          .eq('sender_type', 'patient')
          .eq('read_by_therapist', false)
          .in('patient_id', patientIds);
        setUnreadMessagePatients([]);
        toast.success('Mensagens marcadas como lidas');
        return;
      }
    }

    if (alertKey === 'intake-reviews') {
      const patientIds = intakeReviewPatients.map(p => p.id);
      if (patientIds.length > 0) {
        await supabase
          .from('patient_intake_forms')
          .update({ needs_review: false })
          .eq('therapist_user_id', user.id)
          .in('patient_id', patientIds);
        setIntakeReviewPatients([]);
        toast.success('Fichas marcadas como revisadas');
        return;
      }
    }

    if (alertKey === 'receipts') {
      const patientIds = pendingReceiptPatients.map(p => p.id);
      if (patientIds.length > 0) {
        await supabase
          .from('portal_documents')
          .update({ therapist_reviewed: true } as any)
          .eq('therapist_user_id', user.id)
          .eq('therapist_reviewed', false)
          .ilike('name', 'Comprovante%');
        setPendingReceiptPatients([]);
        toast.success('Comprovantes marcados como revisados');
        return;
      }
    }

    // For other types, just dismiss for today
    dismissAlert(alertKey);
    setDismissed({ ...getDismissedAlerts() });
    toast.success('Alerta marcado como lido');
  }, [user, unreadMessagePatients, intakeReviewPatients, pendingReceiptPatients]);

  const alerts: AlertGroup[] = useMemo(() => {
    const items: AlertGroup[] = [];

    if (overduePaymentPatients.length > 0) {
      items.push({
        key: 'payments',
        icon: <DollarSign className="w-4 h-4" />,
        label: `${overduePaymentPatients.length} pagamento${overduePaymentPatients.length > 1 ? 's' : ''} pendente${overduePaymentPatients.length > 1 ? 's' : ''}`,
        count: overduePaymentPatients.length,
        color: 'text-orange-500',
        patients: overduePaymentPatients,
      });
    }

    if (missingEvolutionPatients.length > 0) {
      items.push({
        key: 'evolutions',
        icon: <FileText className="w-4 h-4" />,
        label: `${missingEvolutionPatients.length} paciente${missingEvolutionPatients.length > 1 ? 's' : ''} com evolução em atraso`,
        count: missingEvolutionPatients.length,
        color: 'text-red-500',
        patients: missingEvolutionPatients,
      });
    }

    if (unreadMessagePatients.length > 0) {
      items.push({
        key: 'messages',
        icon: <MessageSquare className="w-4 h-4" />,
        label: `${unreadMessagePatients.length} mensagem${unreadMessagePatients.length > 1 ? 'ns' : ''} não lida${unreadMessagePatients.length > 1 ? 's' : ''}`,
        count: unreadMessagePatients.length,
        color: 'text-blue-500',
        patients: unreadMessagePatients,
      });
    }

    if (pendingTasks > 0) {
      items.push({
        key: 'tasks',
        icon: <ClipboardList className="w-4 h-4" />,
        label: `${pendingTasks} tarefa${pendingTasks > 1 ? 's' : ''} pendente${pendingTasks > 1 ? 's' : ''}`,
        count: pendingTasks,
        color: 'text-yellow-500',
        patients: [],
        fallbackClick: () => navigate('/tasks'),
      });
    }

    if (pendingEnrollments > 0) {
      items.push({
        key: 'enrollments',
        icon: <UserPlus className="w-4 h-4" />,
        label: `${pendingEnrollments} matrícula${pendingEnrollments > 1 ? 's' : ''} aguardando revisão`,
        count: pendingEnrollments,
        color: 'text-purple-500',
        patients: [],
      });
    }

    if (intakeReviewPatients.length > 0) {
      items.push({
        key: 'intake-reviews',
        icon: <FileText className="w-4 h-4" />,
        label: `${intakeReviewPatients.length} ficha${intakeReviewPatients.length > 1 ? 's' : ''} atualizada${intakeReviewPatients.length > 1 ? 's' : ''} aguardando revisão`,
        count: intakeReviewPatients.length,
        color: 'text-teal-500',
        patients: intakeReviewPatients,
      });
    }

    return items.filter(a => !isAlertDismissed(a.key));
  }, [overduePaymentPatients, missingEvolutionPatients, unreadMessagePatients, pendingTasks, pendingEnrollments, intakeReviewPatients, navigate, dismissed]);

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
            <div key={alert.key}>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    if (alert.patients.length === 1) {
                      handlePatientClick(alert.patients[0].id, alert.key);
                    } else if (alert.patients.length > 1) {
                      setExpanded(expanded === alert.key ? null : alert.key);
                    } else if (alert.fallbackClick) {
                      alert.fallbackClick();
                    }
                  }}
                  className="flex-1 flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted/60 transition-colors text-left group min-w-0"
                >
                  <span className={cn("shrink-0", alert.color)}>{alert.icon}</span>
                  <span className="text-sm text-foreground flex-1 truncate">{alert.label}</span>
                  {alert.patients.length === 1 || alert.fallbackClick ? (
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  ) : alert.patients.length > 1 ? (
                    <ChevronDown className={cn(
                      "w-3.5 h-3.5 text-muted-foreground transition-transform shrink-0",
                      expanded === alert.key && "rotate-180"
                    )} />
                  ) : null}
                </button>
                <button
                  onClick={(e) => handleMarkRead(alert.key, e)}
                  title="Marcar como lido"
                  className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors shrink-0"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => handleDismiss(alert.key, e)}
                  title="Ocultar alerta"
                  className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {expanded === alert.key && alert.patients.length > 1 && (
                <div className="ml-7 mt-0.5 mb-1 space-y-0.5">
                  {alert.patients.map(p => (
                    <button
                      key={p.id}
                      onClick={() => handlePatientClick(p.id, alert.key)}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-muted/80 transition-colors text-left group"
                    >
                      <span className="text-xs text-foreground truncate flex-1">{p.name}</span>
                      <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
