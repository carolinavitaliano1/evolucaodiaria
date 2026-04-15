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
  CheckCircle2, X, Paperclip, Building2,
} from 'lucide-react';

interface PatientRef {
  id: string;
  name: string;
  clinicId?: string;
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

function isAlertDismissed(_key: string): boolean {
  return false;
}

export function ClinicAlertsCard() {
  const { patients, tasks, evolutions, clinics } = useApp();
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { count: pendingEnrollments } = usePendingEnrollments();

  const [overduePaymentPatients, setOverduePaymentPatients] = useState<PatientRef[]>([]);
  const [unreadMessagePatients, setUnreadMessagePatients] = useState<PatientRef[]>([]);
  const [intakeReviewPatients, setIntakeReviewPatients] = useState<PatientRef[]>([]);
  const [pendingReceiptPatients, setPendingReceiptPatients] = useState<PatientRef[]>([]);
  const [pendingEnrollmentPatients, setPendingEnrollmentPatients] = useState<PatientRef[]>([]);
  const [dbLoading, setDbLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Record<string, string>>(getDismissedAlerts());

  const todayStr = toLocalDateString(new Date());

  // Consider loading until both DB queries and context patients are ready
  const contextReady = patients.length > 0 || clinics.length === 0;
  const loading = dbLoading || !contextReady;

  const pendingTasks = useMemo(() => tasks.filter(t => !t.completed).length, [tasks]);

  // Build clinic name map for display
  const clinicNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    clinics.forEach(c => { map[c.id] = c.name; });
    return map;
  }, [clinics]);

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
          patientSet.set(p.id, { id: p.id, name: p.name, clinicId: p.clinicId });
        }
      }
    }
    return Array.from(patientSet.values());
  }, [patients, evolutions, user]);

  useEffect(() => {
    if (!user) return;
    setDbLoading(true);

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
      supabase
        .from('patients')
        .select('id, name, clinic_id')
        .eq('user_id', user.id)
        .eq('status', 'pendente'),
    ]).then(([paymentsRes, messagesRes, intakesRes, receiptsRes, enrollmentsRes]) => {
      // Build a set of valid patient IDs from context for filtering orphaned data
      

      const findPatient = (pid: string): PatientRef | null => {
        const p = patients.find(cp => cp.id === pid);
        if (!p) return null; // Skip orphaned references
        return { id: pid, name: p.name, clinicId: p.clinicId };
      };

      const uniqueByPatient = (items: { patient_id: string }[]): PatientRef[] => {
        const seen = new Set<string>();
        const result: PatientRef[] = [];
        for (const i of items) {
          if (seen.has(i.patient_id)) continue;
          seen.add(i.patient_id);
          const ref = findPatient(i.patient_id);
          if (ref) result.push(ref);
        }
        return result;
      };

      setOverduePaymentPatients(uniqueByPatient((paymentsRes.data as any[]) || []));
      setUnreadMessagePatients(uniqueByPatient((messagesRes.data as any[]) || []));
      setIntakeReviewPatients(uniqueByPatient((intakesRes.data as any[]) || []));
      setPendingReceiptPatients(uniqueByPatient((receiptsRes.data as any[]) || []));
      setPendingEnrollmentPatients(
        ((enrollmentsRes.data as any[]) || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          clinicId: p.clinic_id,
        }))
      );
      setDbLoading(false);
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
      case 'enrollments':
        navigate(`/patients/${patientId}`);
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

    dismissAlert(alertKey);
    setDismissed({ ...getDismissedAlerts() });
    toast.success('Alerta marcado como lido');
  }, [user, unreadMessagePatients, intakeReviewPatients, pendingReceiptPatients]);

  // Group patients by clinic for display
  const groupByClinic = useCallback((patientsArr: PatientRef[]): { clinicName: string; patients: PatientRef[] }[] => {
    const groups: Record<string, PatientRef[]> = {};
    for (const p of patientsArr) {
      const key = p.clinicId || '_sem_clinica';
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    }
    return Object.entries(groups).map(([clinicId, pts]) => ({
      clinicName: clinicId === '_sem_clinica' ? 'Sem unidade' : (clinicNameMap[clinicId] || 'Unidade'),
      patients: pts,
    }));
  }, [clinicNameMap]);

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

    if (pendingEnrollmentPatients.length > 0) {
      items.push({
        key: 'enrollments',
        icon: <UserPlus className="w-4 h-4" />,
        label: `${pendingEnrollmentPatients.length} matrícula${pendingEnrollmentPatients.length > 1 ? 's' : ''} aguardando revisão`,
        count: pendingEnrollmentPatients.length,
        color: 'text-purple-500',
        patients: pendingEnrollmentPatients,
      });
    } else if (pendingEnrollments > 0) {
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

    if (pendingReceiptPatients.length > 0) {
      items.push({
        key: 'receipts',
        icon: <Paperclip className="w-4 h-4" />,
        label: `${pendingReceiptPatients.length} comprovante${pendingReceiptPatients.length > 1 ? 's' : ''} de pagamento não revisado${pendingReceiptPatients.length > 1 ? 's' : ''}`,
        count: pendingReceiptPatients.length,
        color: 'text-emerald-500',
        patients: pendingReceiptPatients,
      });
    }

    return items.filter(a => !isAlertDismissed(a.key));
  }, [overduePaymentPatients, missingEvolutionPatients, unreadMessagePatients, pendingTasks, pendingEnrollments, pendingEnrollmentPatients, intakeReviewPatients, pendingReceiptPatients, navigate, dismissed]);

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
          {alerts.map(alert => {
            const clinicGroups = alert.patients.length > 0 ? groupByClinic(alert.patients) : [];
            const hasMultipleClinics = clinicGroups.length > 1;

            return (
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
                    {alert.patients.length === 1 ? (
                      <>
                        {alert.patients[0].clinicId && clinicNameMap[alert.patients[0].clinicId] && (
                          <span className="text-[10px] text-muted-foreground bg-muted/80 px-1.5 py-0.5 rounded-md truncate max-w-[100px] shrink-0">
                            {clinicNameMap[alert.patients[0].clinicId]}
                          </span>
                        )}
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </>
                    ) : alert.fallbackClick ? (
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
                  <div className="ml-7 mt-0.5 mb-1 space-y-1">
                    {hasMultipleClinics ? (
                      clinicGroups.map(group => (
                        <div key={group.clinicName}>
                          <div className="flex items-center gap-1.5 px-2 py-1">
                            <Building2 className="w-3 h-3 text-muted-foreground shrink-0" />
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide truncate">
                              {group.clinicName}
                            </span>
                            <span className="text-[10px] text-muted-foreground">({group.patients.length})</span>
                          </div>
                          <div className="space-y-0.5">
                            {group.patients.map(p => (
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
                        </div>
                      ))
                    ) : (
                      <>
                        {clinicGroups.length === 1 && clinicGroups[0].clinicName !== 'Sem unidade' && (
                          <div className="flex items-center gap-1.5 px-2 py-0.5">
                            <Building2 className="w-3 h-3 text-muted-foreground shrink-0" />
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide truncate">
                              {clinicGroups[0].clinicName}
                            </span>
                          </div>
                        )}
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
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
