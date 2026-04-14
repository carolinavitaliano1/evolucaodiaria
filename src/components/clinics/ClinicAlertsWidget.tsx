import { useState, useEffect, useMemo } from 'react';
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
}

interface ClinicAlertsWidgetProps {
  clinicId: string;
}

export function ClinicAlertsWidget({ clinicId }: ClinicAlertsWidgetProps) {
  const { patients, evolutions } = useApp();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [overduePaymentPatients, setOverduePaymentPatients] = useState<PatientRef[]>([]);
  const [pendingEnrollmentPatients, setPendingEnrollmentPatients] = useState<PatientRef[]>([]);
  const [unreadMessagePatients, setUnreadMessagePatients] = useState<PatientRef[]>([]);
  const [intakeReviewPatients, setIntakeReviewPatients] = useState<PatientRef[]>([]);
  const [pendingReceiptPatients, setPendingReceiptPatients] = useState<PatientRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const clinicPatients = useMemo(
    () => patients.filter(p => p.clinicId === clinicId && !p.isArchived),
    [patients, clinicId]
  );

  // Missing evolutions for this clinic (last 7 days) — with patient details
  const missingEvolutionPatients = useMemo(() => {
    const today = new Date();
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const patientSet = new Map<string, PatientRef>();

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
        if (!hasEvolution) {
          patientSet.set(p.id, { id: p.id, name: p.name });
        }
      }
    }
    return Array.from(patientSet.values());
  }, [clinicPatients, evolutions, clinicId]);

  // Fetch clinic-specific detailed data
  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    const clinicPatientIds = clinicPatients.map(p => p.id);

    Promise.all([
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
    ]).then(([paymentsRes, enrollmentsRes, messagesRes, intakesRes]) => {
      // Map patient_ids to names
      const findPatient = (pid: string): PatientRef => {
        const p = clinicPatients.find(cp => cp.id === pid);
        return { id: pid, name: p?.name || 'Paciente' };
      };

      // Deduplicate by patient_id
      const uniqueByPatient = (items: { patient_id: string }[]): PatientRef[] => {
        const seen = new Set<string>();
        return items.filter(i => {
          if (seen.has(i.patient_id)) return false;
          seen.add(i.patient_id);
          return true;
        }).map(i => findPatient(i.patient_id));
      };

      setOverduePaymentPatients(uniqueByPatient((paymentsRes.data as any[]) || []));
      setPendingEnrollmentPatients(
        ((enrollmentsRes.data as any[]) || []).map((p: any) => ({ id: p.id, name: p.name }))
      );
      setUnreadMessagePatients(uniqueByPatient((messagesRes.data as any[]) || []));
      setIntakeReviewPatients(uniqueByPatient((intakesRes.data as any[]) || []));
      setLoading(false);
    });
  }, [user, clinicId, clinicPatients.length]);

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
        label: `${missingEvolutionPatients.length} paciente${missingEvolutionPatients.length > 1 ? 's' : ''} com evolução em atraso`,
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

    return items;
  }, [overduePaymentPatients, missingEvolutionPatients, unreadMessagePatients, pendingEnrollmentPatients, intakeReviewPatients]);

  const allClear = alerts.length === 0 && !loading;

  const handlePatientClick = (patientId: string, alertKey: string) => {
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
        navigate(`/patients/${patientId}`);
        break;
      case 'enrollments':
        // Pending enrollments aren't active patients yet
        navigate(`/patients`);
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
                  handlePatientClick(alert.patients[0].id, alert.key);
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
                    key={p.id}
                    onClick={() => handlePatientClick(p.id, alert.key)}
                    className="w-full flex items-center gap-2 px-2 py-1 rounded-md hover:bg-muted/80 transition-colors text-left group"
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
    </div>
  );
}
