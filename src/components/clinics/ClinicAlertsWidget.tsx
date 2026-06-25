import { useState, useEffect, useMemo, useCallback } from 'react';
import { isPatientActiveOn } from '@/utils/dateHelpers';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toLocalDateString } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, DollarSign, FileText, MessageSquare,
  UserPlus, Sparkles, ChevronDown, ChevronRight, Paperclip,
} from 'lucide-react';
import { useCalendarBlocks } from '@/hooks/useCalendarBlocks';
import { getSessionKind, SESSION_KIND_LABEL, type SessionKind } from '@/utils/sessionTypeTags';

const DEFAULT_SESSION_DURATION = 50;
const DAYS_BACK = 7;

interface PatientRef {
  id: string;
  name: string;
  date?: string;
  startTime?: string;
  kind?: Exclude<SessionKind, 'regular'>;
}

interface AlertGroup {
  key: string;
  icon: React.ReactNode;
  label: string;
  count: number;
  color: string;
  patients: PatientRef[];
}

interface AppointmentRow {
  patient_id: string;
  date: string;
  time: string | null;
  notes: string | null;
}

interface PatientIdRow {
  patient_id: string;
}

interface EnrollmentRow {
  id: string;
  name: string;
}

interface ClinicAlertsWidgetProps {
  clinicId: string;
}

export function ClinicAlertsWidget({ clinicId }: ClinicAlertsWidgetProps) {
  const { patients, evolutions } = useApp();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isDateBlocked } = useCalendarBlocks();

  const [overduePaymentPatients, setOverduePaymentPatients] = useState<PatientRef[]>([]);
  const [pendingEnrollmentPatients, setPendingEnrollmentPatients] = useState<PatientRef[]>([]);
  const [unreadMessagePatients, setUnreadMessagePatients] = useState<PatientRef[]>([]);
  const [intakeReviewPatients, setIntakeReviewPatients] = useState<PatientRef[]>([]);
  const [pendingReceiptPatients, setPendingReceiptPatients] = useState<PatientRef[]>([]);
  const [extraAppointments, setExtraAppointments] = useState<Array<{ patientId: string; date: string; time: string; notes: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const clinicPatients = useMemo(
    () => patients.filter(p => p.clinicId === clinicId && isPatientActiveOn(p)),
    [patients, clinicId]
  );

  const toMin = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + (m || 0);
  };

  const fetchExtraAppointments = useCallback(async () => {
    if (!user || !clinicId) return;
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - DAYS_BACK);
    const startDate = toLocalDateString(start);
    const endDate = toLocalDateString(today);
    const { data } = await supabase
      .from('appointments')
      .select('patient_id, date, time, notes')
      .eq('clinic_id', clinicId)
      .gte('date', startDate)
      .lte('date', endDate);
    const extras = ((data as AppointmentRow[] | null) || [])
      .filter(a => getSessionKind(a.notes as string | null) !== 'regular')
      .map(a => ({
        patientId: a.patient_id as string,
        date: a.date as string,
        time: (a.time as string) || '',
        notes: (a.notes as string) || null,
      }));
    setExtraAppointments(extras);
  }, [user, clinicId]);

  useEffect(() => {
    fetchExtraAppointments();
  }, [fetchExtraAppointments]);

  // Missing evolutions for this clinic (last 7 days) — with patient details
  const missingEvolutionPatients = useMemo(() => {
    const today = new Date();
    const nowMinutes = today.getHours() * 60 + today.getMinutes();
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const patientSet = new Map<string, PatientRef>();

    for (let i = 0; i <= DAYS_BACK; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = toLocalDateString(d);
      const dayName = days[d.getDay()];
      const isPast = i > 0;
      // Skip dates marked as holiday/vacation for this clinic
      if (isDateBlocked(dateStr, clinicId)) continue;

      for (const p of clinicPatients) {
        if (p.createdAt && toLocalDateString(new Date(p.createdAt)) > dateStr) continue;
        const schedByDay = p.scheduleByDay as Record<string, { start?: string; end?: string }> | null;
        const scheduledDays = schedByDay ? Object.keys(schedByDay) : (p.weekdays || []);
        if (!scheduledDays.includes(dayName)) continue;
        const startTime = schedByDay?.[dayName]?.start || p.scheduleTime || '';
        if (!startTime || startTime === '00:00') continue;
        const endStr = schedByDay?.[dayName]?.end;
        const endMin = endStr ? toMin(endStr) : toMin(startTime) + DEFAULT_SESSION_DURATION;
        if (!isPast && nowMinutes <= endMin) continue;
        const hasEvolution = evolutions.some(
          e => e.patientId === p.id && e.clinicId === clinicId && e.date === dateStr
        );
        if (!hasEvolution) {
          patientSet.set(`${p.id}::${dateStr}`, { id: p.id, name: p.name, date: dateStr, startTime });
        }
      }

      extraAppointments
        .filter(a => a.date === dateStr)
        .forEach(a => {
          const patient = clinicPatients.find(p => p.id === a.patientId);
          if (!patient) return;
          const startTime = a.time || '';
          if (!startTime || startTime === '00:00') return;
          if (!isPast && nowMinutes <= toMin(startTime) + DEFAULT_SESSION_DURATION) return;
          const hasEvolution = evolutions.some(
            e => e.patientId === patient.id && e.clinicId === clinicId && e.date === dateStr
          );
          if (hasEvolution) return;
          const kind = getSessionKind(a.notes);
          if (kind === 'regular') return;
          patientSet.set(`${patient.id}::${dateStr}`, {
            id: patient.id,
            name: patient.name,
            date: dateStr,
            startTime,
            kind,
          });
        });
    }
    return Array.from(patientSet.values());
  }, [clinicPatients, evolutions, clinicId, isDateBlocked, extraAppointments]);

  // Fetch clinic-specific detailed data
  const fetchClinicDetails = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    const clinicPatientIds = clinicPatients.map(p => p.id);

    const [paymentsRes, enrollmentsRes, messagesRes, intakesRes, receiptsRes] = await Promise.all([
      // Overdue payments — get patient_ids
      clinicPatientIds.length > 0
        ? supabase
            .from('patient_payment_records')
            .select('patient_id')
            .eq('clinic_id', clinicId)
            .eq('month', currentMonth)
            .eq('year', currentYear)
            .eq('paid', false)
        : Promise.resolve({ data: [] }),
      // Pending enrollments
      supabase
        .from('patients')
        .select('id, name')
        .eq('clinic_id', clinicId)
        .eq('status', 'pendente'),
      // Unread portal messages — get patient_ids
      clinicPatientIds.length > 0
        ? supabase
            .from('portal_messages')
            .select('patient_id')
            .eq('therapist_user_id', user.id)
            .eq('sender_type', 'patient')
            .eq('read_by_therapist', false)
            .in('patient_id', clinicPatientIds)
        : Promise.resolve({ data: [] }),
      // Intake forms needing review
      clinicPatientIds.length > 0
        ? supabase
            .from('patient_intake_forms')
            .select('patient_id')
            .eq('therapist_user_id', user.id)
            .eq('needs_review', true)
            .in('patient_id', clinicPatientIds)
        : Promise.resolve({ data: [] }),
      // Pending receipt documents
      clinicPatientIds.length > 0
        ? supabase
            .from('portal_documents')
            .select('patient_id')
            .eq('therapist_user_id', user.id)
            .eq('therapist_reviewed', false)
            .ilike('name', 'Comprovante%')
            .in('patient_id', clinicPatientIds)
        : Promise.resolve({ data: [] }),
    ]);
    const findPatient = (pid: string): PatientRef => {
        const p = clinicPatients.find(cp => cp.id === pid);
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
    setOverduePaymentPatients(uniqueByPatient((paymentsRes.data as PatientIdRow[] | null) || []));
    setPendingEnrollmentPatients(
      ((enrollmentsRes.data as EnrollmentRow[] | null) || []).map(p => ({ id: p.id, name: p.name }))
    );
    setUnreadMessagePatients(uniqueByPatient((messagesRes.data as PatientIdRow[] | null) || []));
    setIntakeReviewPatients(uniqueByPatient((intakesRes.data as PatientIdRow[] | null) || []));
    setPendingReceiptPatients(uniqueByPatient((receiptsRes.data as PatientIdRow[] | null) || []));
    setLoading(false);
  }, [user, clinicId, clinicPatients]);

  useEffect(() => {
    fetchClinicDetails();
  }, [fetchClinicDetails]);

  // Auto-refresh on tab focus / online / visibility change (mobile PWA)
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'hidden') return;
      fetchExtraAppointments();
      fetchClinicDetails();
    };
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [fetchExtraAppointments, fetchClinicDetails]);

  const alerts = useMemo(() => {
    const items: AlertGroup[] = [];

    if (overduePaymentPatients.length > 0) {
      items.push({
        key: 'payments',
        icon: <DollarSign className="w-3.5 h-3.5" />,
        label: `${overduePaymentPatients.length} pagamento${overduePaymentPatients.length > 1 ? 's' : ''} pendente${overduePaymentPatients.length > 1 ? 's' : ''}`,
        count: overduePaymentPatients.length,
        color: 'text-orange-500',
        patients: overduePaymentPatients,
      });
    }

    if (missingEvolutionPatients.length > 0) {
      items.push({
        key: 'evolutions',
        icon: <FileText className="w-3.5 h-3.5" />,
        label: `${missingEvolutionPatients.length} evolução${missingEvolutionPatients.length > 1 ? 'ões' : ''} em atraso`,
        count: missingEvolutionPatients.length,
        color: 'text-red-500',
        patients: missingEvolutionPatients,
      });
    }

    if (unreadMessagePatients.length > 0) {
      items.push({
        key: 'messages',
        icon: <MessageSquare className="w-3.5 h-3.5" />,
        label: `${unreadMessagePatients.length} mensagem${unreadMessagePatients.length > 1 ? 'ns' : ''} não lida${unreadMessagePatients.length > 1 ? 's' : ''}`,
        count: unreadMessagePatients.length,
        color: 'text-blue-500',
        patients: unreadMessagePatients,
      });
    }

    if (pendingEnrollmentPatients.length > 0) {
      items.push({
        key: 'enrollments',
        icon: <UserPlus className="w-3.5 h-3.5" />,
        label: `${pendingEnrollmentPatients.length} matrícula${pendingEnrollmentPatients.length > 1 ? 's' : ''} pendente${pendingEnrollmentPatients.length > 1 ? 's' : ''}`,
        count: pendingEnrollmentPatients.length,
        color: 'text-purple-500',
        patients: pendingEnrollmentPatients,
      });
    }

    if (intakeReviewPatients.length > 0) {
      items.push({
        key: 'intake-reviews',
        icon: <FileText className="w-3.5 h-3.5" />,
        label: `${intakeReviewPatients.length} ficha${intakeReviewPatients.length > 1 ? 's' : ''} atualizada${intakeReviewPatients.length > 1 ? 's' : ''} p/ revisão`,
        count: intakeReviewPatients.length,
        color: 'text-teal-500',
        patients: intakeReviewPatients,
      });
    }

    if (pendingReceiptPatients.length > 0) {
      items.push({
        key: 'receipts',
        icon: <Paperclip className="w-3.5 h-3.5" />,
        label: `${pendingReceiptPatients.length} comprovante${pendingReceiptPatients.length > 1 ? 's' : ''} não revisado${pendingReceiptPatients.length > 1 ? 's' : ''}`,
        count: pendingReceiptPatients.length,
        color: 'text-emerald-500',
        patients: pendingReceiptPatients,
      });
    }

    return items;
  }, [overduePaymentPatients, missingEvolutionPatients, unreadMessagePatients, pendingEnrollmentPatients, intakeReviewPatients, pendingReceiptPatients]);

  const allClear = alerts.length === 0 && !loading;

  const handlePatientClick = (patientId: string, alertKey: string, date?: string) => {
    // Navigate directly to the patient detail page
    // The hash helps indicate which section to focus on
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
        navigate(`/patients/${patientId}${date ? `?date=${date}` : ''}#evolutions`);
        break;
      case 'enrollments':
        navigate(`/patients`);
        break;
      case 'receipts':
        navigate(`/patients/${patientId}#financeiro`);
        break;
      default:
        navigate(`/patients/${patientId}`);
    }
  };

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
          <div key={alert.key}>
            <button
              onClick={() => {
                if (alert.patients.length === 1) {
                  handlePatientClick(alert.patients[0].id, alert.key, alert.patients[0].date);
                } else {
                  setExpanded(expanded === alert.key ? null : alert.key);
                }
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/60 transition-colors text-left group"
            >
              <span className={cn("shrink-0", alert.color)}>{alert.icon}</span>
              <span className="text-xs text-foreground flex-1">{alert.label}</span>
              {alert.patients.length === 1 ? (
                <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              ) : (
                <ChevronDown className={cn(
                  "w-3 h-3 text-muted-foreground transition-transform shrink-0",
                  expanded === alert.key && "rotate-180"
                )} />
              )}
            </button>

            {/* Expanded patient list */}
            {expanded === alert.key && alert.patients.length > 1 && (
              <div className="ml-6 mt-0.5 mb-1 space-y-0.5">
                {alert.patients.map(p => (
                  <button
                    key={`${p.id}-${p.date || alert.key}`}
                    onClick={() => handlePatientClick(p.id, alert.key, p.date)}
                    className="w-full flex items-center gap-2 px-2 py-1 rounded-md hover:bg-muted/80 transition-colors text-left group"
                  >
                    <span className="text-xs text-foreground truncate flex-1">
                      {p.name}
                      {p.kind ? ` · ${SESSION_KIND_LABEL[p.kind]}` : ''}
                      {p.date === toLocalDateString(new Date()) ? ' · Hoje' : ''}
                      {p.startTime ? ` ${p.startTime.slice(0, 5)}` : ''}
                    </span>
                    <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
