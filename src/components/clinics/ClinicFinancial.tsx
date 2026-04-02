import { useState, useEffect, useRef, useCallback } from 'react';
import { DollarSign, Loader2, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, AlertTriangle, Percent, Users, Briefcase, CheckCircle2, Clock, XCircle, CalendarIcon, FileDown, CalendarDays, Receipt } from 'lucide-react';
import { PatientBillingManager } from './PatientBillingManager';
import { getDynamicSessionValue, calculateMensalRevenueWithDeductions } from '@/utils/dateHelpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApp } from '@/contexts/AppContext';
import { useClinicOrg } from '@/hooks/useClinicOrg';
import { TeamFinancialReport } from './TeamFinancialReport';
import { format, subMonths, addMonths, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { QuickWhatsAppButton } from '@/components/whatsapp/QuickWhatsAppButton';
import { resolveTemplate } from '@/hooks/useMessageTemplates';
import jsPDF from 'jspdf';

interface ClinicFinancialProps {
  clinicId: string;
}

interface ServiceRecord {
  id: string;
  price: number;
  status: string;
  paid: boolean | null;
  payment_date: string | null;
  date: string;
  time: string;
  client_name: string;
  service_name: string | null;
}

interface ClinicPaymentRecord {
  id?: string;
  month: number;
  year: number;
  amount: number;
  paid: boolean;
  payment_date: string | null;
  notes: string | null;
}

export function ClinicFinancial({ clinicId }: ClinicFinancialProps) {
  const { clinics, patients, evolutions, updateClinic, clinicPackages } = useApp();
  const { user } = useAuth();
  const { isOrg } = useClinicOrg(clinicId);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [clinicServices, setClinicServices] = useState<ServiceRecord[]>([]);
  const [patientPaymentRecords, setPatientPaymentRecords] = useState<Record<string, { paid: boolean; payment_date: string | null }>>({});
  const [savingPatientPayment, setSavingPatientPayment] = useState<string | null>(null);
  const [therapistName, setTherapistName] = useState('');

  // Dias específicos state
  const [specificDays, setSpecificDays] = useState<Date[]>([]);
  const [isExportingDays, setIsExportingDays] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('name').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => { if (data?.name) setTherapistName(data.name); });
  }, [user]);

  // Filters
  type PaymentFilter = 'all' | 'paid' | 'pending';
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Contratante payment record for selected month
  const [paymentRecord, setPaymentRecord] = useState<ClinicPaymentRecord | null>(null);
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentDateOpen, setPaymentDateOpen] = useState(false);

  const clinic = clinics.find(c => c.id === clinicId);
  const [discountPercent, setDiscountPercent] = useState(clinic?.discountPercentage || 0);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (clinic) setDiscountPercent(clinic.discountPercentage || 0);
  }, [clinic?.discountPercentage]);

  // Load private_appointments with service name
  useEffect(() => {
    supabase
      .from('private_appointments')
      .select('id, price, status, paid, payment_date, date, time, client_name, services(name)')
      .eq('clinic_id', clinicId)
      .order('date', { ascending: false })
      .then(({ data }) => {
        if (data) {
          setClinicServices(data.map((d: any) => ({
            id: d.id,
            price: d.price,
            status: d.status,
            paid: d.paid,
            payment_date: d.payment_date ?? null,
            date: d.date,
            time: d.time,
            client_name: d.client_name,
            service_name: d.services?.name ?? null,
          })));
        }
      });
  }, [clinicId]);

  // Load patient payment records for selected month
  useEffect(() => {
    if (!user || !clinicId) return;
    const m = selectedDate.getMonth() + 1;
    const y = selectedDate.getFullYear();
    supabase
      .from('patient_payment_records' as any)
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('month', m)
      .eq('year', y)
      .then(({ data }) => {
        if (data) {
          const map: Record<string, any> = {};
          (data as any[]).forEach(r => { map[r.patient_id] = r; });
          setPatientPaymentRecords(map);
        }
      });
  }, [clinicId, selectedDate, user]);

  // Load payment record for contratante clinic selected month
  useEffect(() => {
    if (!clinic || clinic.type !== 'terceirizada' || !user) return;
    const m = selectedDate.getMonth() + 1;
    const y = selectedDate.getFullYear();
    supabase
      .from('clinic_payment_records' as any)
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('month', m)
      .eq('year', y)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setPaymentRecord({
            id: (data as any).id,
            month: (data as any).month,
            year: (data as any).year,
            amount: (data as any).amount,
            paid: (data as any).paid,
            payment_date: (data as any).payment_date,
            notes: (data as any).notes,
          });
        } else {
          setPaymentRecord(null);
        }
      });
  }, [clinic?.type, clinicId, selectedDate, user]);

  const savePaymentRecord = async (updates: Partial<ClinicPaymentRecord>) => {
    if (!user) return;
    setSavingPayment(true);
    const m = selectedDate.getMonth() + 1;
    const y = selectedDate.getFullYear();
    const base = paymentRecord ?? { month: m, year: y, amount: totalPatientRevenue, paid: false, payment_date: null, notes: null };
    const merged = { ...base, ...updates };
    try {
      if (paymentRecord?.id) {
        await supabase.from('clinic_payment_records' as any).update({
          paid: merged.paid,
          payment_date: merged.payment_date,
          amount: merged.amount,
          notes: merged.notes,
        }).eq('id', paymentRecord.id);
      } else {
        const { data } = await supabase.from('clinic_payment_records' as any).insert({
          user_id: user.id,
          clinic_id: clinicId,
          month: m,
          year: y,
          amount: merged.amount,
          paid: merged.paid,
          payment_date: merged.payment_date,
          notes: merged.notes,
        }).select().maybeSingle();
        if (data) merged.id = (data as any).id;
      }
      setPaymentRecord(merged as ClinicPaymentRecord);
    } finally {
      setSavingPayment(false);
    }
  };

  const saveDiscount = useCallback((value: number) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateClinic(clinicId, { discountPercentage: value });
    }, 800);
  }, [clinicId, updateClinic]);

  const handleDiscountChange = (val: string) => {
    const num = Math.min(100, Math.max(0, parseFloat(val) || 0));
    setDiscountPercent(num);
    saveDiscount(num);
  };

  if (!clinic) return null;

  const selectedMonth = selectedDate.getMonth();
  const selectedYear = selectedDate.getFullYear();
  const monthName = format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR });

  const clinicPatients = patients.filter(p => p.clinicId === clinicId);

  const monthlyEvolutions = evolutions.filter(e => {
    if (!clinicPatients.some(p => p.id === e.patientId)) return false;
    const date = new Date(e.date + 'T12:00:00');
    return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
  });

  const presentEvos = monthlyEvolutions.filter(e => e.attendanceStatus === 'presente' || e.attendanceStatus === 'reposicao');
  const absentEvos = monthlyEvolutions.filter(e => e.attendanceStatus === 'falta');
  const paidAbsenceEvos = monthlyEvolutions.filter(e => e.attendanceStatus === 'falta_remunerada');
  const reposicaoEvos = monthlyEvolutions.filter(e => e.attendanceStatus === 'reposicao');
  const feriadoRemEvos = monthlyEvolutions.filter(e => e.attendanceStatus === 'feriado_remunerado');

  const absenceType = clinic.absencePaymentType || (clinic.paysOnAbsence === false ? 'never' : 'always');

  // Determine clinic-level payment type
  const clPayType = (clinic.paymentType as string | undefined);
  const isClinicFixoMensal = clPayType === 'fixo_mensal';
  const isClinicFixoDiario = clPayType === 'fixo_diario';
  const clinicBaseValue = clinic.paymentAmount || 0;

  // Count unique work days across all patients for the month (for fixo_diario)
  const uniqueWorkDays = isClinicFixoDiario
    ? new Set(presentEvos.map(e => e.date)).size
    : 0;

  // Helper: get effective per-session value for a patient (handles personalizado packages)
  const getEffectiveSessionValue = (patient: typeof clinicPatients[0]) => {
    if (!patient.paymentValue) return 0;
    const pkg = patient.packageId ? clinicPackages.find(pk => pk.id === patient.packageId) : null;
    const isPersonalizado = pkg?.packageType === 'personalizado' && (pkg?.sessionLimit ?? 0) > 0;
    return isPersonalizado ? patient.paymentValue / pkg!.sessionLimit! : patient.paymentValue;
  };

  // Helper: calculate revenue for a single patient based on CONFIRMED evolutions only
  const calcPatientRevenue = (patient: typeof clinicPatients[0]) => {
    if (!patient.paymentValue) return 0;

    // Billable evolutions for this patient
    const billableEvolutions = monthlyEvolutions.filter(
      e => e.patientId === patient.id && (
        e.attendanceStatus === 'presente' ||
        e.attendanceStatus === 'reposicao' ||
        e.attendanceStatus === 'falta_remunerada' ||
        e.attendanceStatus === 'feriado_remunerado'
      )
    );

    if (patient.paymentType === 'fixo') {
      // For fixo patients, calculate per-session value dynamically
      const patientWeekdays = patient.weekdays || (patient.scheduleByDay ? Object.keys(patient.scheduleByDay as Record<string, any>) : []);
      const dynamic = getDynamicSessionValue(patient.paymentValue, patientWeekdays, selectedMonth, selectedYear);
      if (dynamic.occurrences > 0) {
        return billableEvolutions.length * dynamic.perSession;
      }
      // Fallback: single session patient
      return billableEvolutions.length * patient.paymentValue;
    }

    // Per-session / personalizado / variado
    const effectiveValue = getEffectiveSessionValue(patient);
    return billableEvolutions.length * effectiveValue;
  };

  // Total patient revenue — for fixed models this is a single global amount
  const totalPatientRevenue = (() => {
    if (isClinicFixoMensal) return clinicBaseValue;
    if (isClinicFixoDiario) return uniqueWorkDays * clinicBaseValue;
    return clinicPatients.reduce((sum, p) => sum + calcPatientRevenue(p), 0);
  })();

  // Filter services by selected month
  const monthlyServices = clinicServices.filter(s => {
    const d = new Date(s.date + 'T12:00:00');
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
  });

  const servicesScheduled = monthlyServices.filter(s => s.status === 'agendado');
  const servicesConcluded = monthlyServices.filter(s => s.status === 'concluído');
  const servicesPaid = monthlyServices.filter(s => s.status === 'concluído' && s.paid);

  const servicesRevenue = servicesConcluded.reduce((sum, s) => sum + s.price, 0);
  const servicesScheduledRevenue = servicesScheduled.reduce((sum, s) => sum + s.price, 0);
  const servicesPaidRevenue = servicesPaid.reduce((sum, s) => sum + s.price, 0);

  const totalRevenueWithServices = totalPatientRevenue + servicesRevenue;
  const netRevenue = totalRevenueWithServices * (1 - discountPercent / 100);
  const totalSessions = presentEvos.length;
  const totalAbsences = absentEvos.length;
  const totalPaidAbsences = paidAbsenceEvos.length;
  const totalReposicoes = reposicaoEvos.length;

  const isGlobalFixed = isClinicFixoMensal || isClinicFixoDiario;

  const allPatientBreakdown = clinicPatients
    .map(patient => {
      const patientPresentEvos = presentEvos.filter(e => e.patientId === patient.id);
      const sessions = patientPresentEvos.length;
      const absences = absentEvos.filter(e => e.patientId === patient.id).length;
      const paidAbsences = paidAbsenceEvos.filter(e => e.patientId === patient.id).length;
      const reposicoes = reposicaoEvos.filter(e => e.patientId === patient.id).length;
      // For fixed-global clinics, don't assign revenue per patient
      let revenue = 0;
      if (!isGlobalFixed && patient.paymentValue) {
        revenue = calcPatientRevenue(patient);
      }
      return { patient, revenue, sessions, absences, paidAbsences, reposicoes };
    })
    .filter(p => p.sessions > 0 || p.absences > 0 || (!isGlobalFixed && p.revenue > 0))
    .sort((a, b) => isGlobalFixed ? b.sessions - a.sessions : b.revenue - a.revenue);

  const patientBreakdown = allPatientBreakdown.filter(({ patient }) => {
    const pr = patientPaymentRecords[patient.id];
    if (paymentFilter === 'paid' && !pr?.paid) return false;
    if (paymentFilter === 'pending' && pr?.paid) return false;
    if (filterStartDate && pr?.payment_date && pr.payment_date < filterStartDate) return false;
    if (filterEndDate && pr?.payment_date && pr.payment_date > filterEndDate) return false;
    if ((filterStartDate || filterEndDate) && paymentFilter === 'paid' && !pr?.payment_date) return false;
    return true;
  });

  const statusConfig = {
    'agendado': { label: 'Agendado', icon: Clock, className: 'text-primary bg-primary/10' },
    'concluído': { label: 'Concluído', icon: CheckCircle2, className: 'text-success bg-success/10' },
    'cancelado': { label: 'Cancelado', icon: XCircle, className: 'text-destructive bg-destructive/10' },
  };

  const SoloView = (
    <div className="space-y-5">
      {/* Month navigation */}
      <div className="flex items-center justify-between bg-card rounded-2xl px-4 py-3 border border-border">
        <Button variant="ghost" size="icon" onClick={() => setSelectedDate(prev => subMonths(prev, 1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h3 className="font-bold text-foreground capitalize text-sm">{monthName}</h3>
        <Button variant="ghost" size="icon" onClick={() => setSelectedDate(prev => addMonths(prev, 1))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card rounded-2xl p-4 border border-border">
          <div className="w-8 h-8 rounded-xl bg-success/10 flex items-center justify-center mb-2">
            <DollarSign className="w-4 h-4 text-success" />
          </div>
          <p className="text-muted-foreground text-xs mb-0.5">Faturamento Bruto</p>
          <p className="text-lg font-bold text-foreground">
            R$ {totalRevenueWithServices.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {isClinicFixoMensal
              ? 'Valor Fixo Mensal'
              : isClinicFixoDiario
                ? `Total de ${uniqueWorkDays} diária(s)`
                : `${totalSessions} sessões`}
          </p>
          {discountPercent > 0 && (
            <div className="mt-2 pt-2 border-t border-border">
              <p className="text-muted-foreground text-[10px]">Líquido ({discountPercent}% desc.)</p>
              <p className="text-base font-bold text-success">
                R$ {netRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          )}
        </div>
        <div className="bg-card rounded-2xl p-4 border border-border">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          <p className="text-muted-foreground text-xs mb-0.5">Sessões</p>
          <p className="text-lg font-bold text-foreground">{totalSessions}</p>
          {totalReposicoes > 0 && <p className="text-[10px] text-muted-foreground">🔄 {totalReposicoes} repos.</p>}
        </div>
        <div className="bg-card rounded-2xl p-4 border border-border">
          <div className="w-8 h-8 rounded-xl bg-warning/10 flex items-center justify-center mb-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
          </div>
          <p className="text-muted-foreground text-xs mb-0.5">Faltas Rem.</p>
          <p className="text-lg font-bold text-foreground">{totalPaidAbsences}</p>
        </div>
        <div className="bg-card rounded-2xl p-4 border border-border">
          <div className="w-8 h-8 rounded-xl bg-destructive/10 flex items-center justify-center mb-2">
            <TrendingDown className="w-4 h-4 text-destructive" />
          </div>
          <p className="text-muted-foreground text-xs mb-0.5">Faltas</p>
          <p className="text-lg font-bold text-foreground">{totalAbsences}</p>
        </div>
      </div>

      {/* Services summary */}
      {monthlyServices.length > 0 && (
        <div className="bg-card rounded-2xl p-5 border border-border">
          <div className="flex items-center gap-2 mb-4">
            <Briefcase className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-foreground text-sm">Serviços do Mês</h3>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-secondary/50 rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Agendado</p>
              <p className="font-bold text-foreground text-sm">R$ {servicesScheduledRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              <p className="text-[10px] text-muted-foreground">{servicesScheduled.length} serviço(s)</p>
            </div>
            <div className="bg-secondary/50 rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Concluído</p>
              <p className="font-bold text-success text-sm">R$ {servicesRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              <p className="text-[10px] text-muted-foreground">{servicesConcluded.length} serviço(s)</p>
            </div>
            <div className="bg-secondary/50 rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Recebido</p>
              <p className="font-bold text-primary text-sm">R$ {servicesPaidRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              <p className="text-[10px] text-muted-foreground">{servicesPaid.length} pago(s)</p>
            </div>
          </div>

          <div className="space-y-2">
            {monthlyServices.map(service => {
              const cfg = statusConfig[service.status as keyof typeof statusConfig] ?? statusConfig['agendado'];
              const StatusIcon = cfg.icon;
              return (
                <div key={service.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border/50 gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", cfg.className)}>
                      <StatusIcon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{service.client_name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {service.service_name ?? 'Serviço'} · {format(new Date(service.date + 'T12:00:00'), 'dd/MM')}
                    {service.status === 'concluído' && service.paid && (
                      <span className="text-success ml-1">
                        · Pago{service.payment_date ? ` em ${format(new Date(service.payment_date + 'T00:00:00'), 'dd/MM')}` : ''}
                      </span>
                    )}
                    {service.status === 'concluído' && !service.paid && (
                      <span className="text-warning ml-1">· Não recebido</span>
                    )}
                  </p>
                    </div>
                  </div>
                  <p className="font-bold text-foreground text-xs shrink-0">
                    R$ {service.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Discount simulator */}
      <div className="bg-card rounded-2xl p-5 border border-border">
        <div className="flex items-center gap-2 mb-2">
          <Percent className="w-4 h-4 text-primary" />
          <h3 className="font-bold text-foreground text-sm">Simulador de Desconto</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Porcentagem que a clínica retém do faturamento. Salvo automaticamente.
        </p>
        <div className="flex items-center gap-3">
          <div className="relative w-28">
            <Input
              type="number" min={0} max={100} step={1}
              value={discountPercent}
              onChange={(e) => handleDiscountChange(e.target.value)}
              className="pr-8"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
          </div>
          <div className="flex-1 text-xs text-muted-foreground">
            {discountPercent > 0 ? (
              <span>
                Bruto <strong className="text-foreground">R$ {totalRevenueWithServices.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                {' → '}
                Líquido <strong className="text-success">R$ {netRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
              </span>
            ) : (
              <span>Sem desconto aplicado</span>
            )}
          </div>
        </div>
      </div>

      {/* Patient breakdown */}
      <div className="bg-card rounded-2xl p-5 border border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <h3 className="font-bold text-foreground text-sm">Detalhamento por Paciente</h3>
          {clinic.type === 'propria' && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Status filter */}
              <div className="flex items-center gap-0.5 rounded-lg bg-secondary border border-border p-0.5">
                {(['all', 'paid', 'pending'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setPaymentFilter(f)}
                    className={cn(
                      'text-[10px] px-2 py-1 rounded-md transition-colors',
                      paymentFilter === f
                        ? f === 'paid' ? 'bg-success text-white' : f === 'pending' ? 'bg-warning text-white' : 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {f === 'all' ? 'Todos' : f === 'paid' ? '✓ Pagos' : '⏳ Pend.'}
                  </button>
                ))}
              </div>
              {/* Date range filter */}
              <div className="flex items-center gap-1">
                <Input
                  type="date"
                  value={filterStartDate}
                  onChange={e => setFilterStartDate(e.target.value)}
                  className="h-7 text-xs w-28 px-2"
                  placeholder="De"
                />
                <span className="text-muted-foreground text-xs">–</span>
                <Input
                  type="date"
                  value={filterEndDate}
                  onChange={e => setFilterEndDate(e.target.value)}
                  className="h-7 text-xs w-28 px-2"
                  placeholder="Até"
                />
                {(filterStartDate || filterEndDate) && (
                  <button onClick={() => { setFilterStartDate(''); setFilterEndDate(''); }} className="text-xs text-muted-foreground hover:text-foreground px-1">✕</button>
                )}
              </div>
            </div>
          )}
        </div>
        {patientBreakdown.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">
            {paymentFilter !== 'all' || filterStartDate || filterEndDate ? 'Nenhum resultado para os filtros' : 'Nenhum registro neste mês'}
          </p>
        ) : (
          <div className="space-y-2">
            {patientBreakdown.map(({ patient, revenue, sessions, absences, paidAbsences, reposicoes }) => {
              const pr = patientPaymentRecords[patient.id];
              const anyPatient = patient as any;
              return (
                <div key={patient.id} className="flex flex-col gap-2 p-3 rounded-xl bg-secondary/40 border border-border/50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">{patient.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {sessions} sessões
                        {reposicoes > 0 && ` (🔄${reposicoes})`}
                        {paidAbsences > 0 && ` · ${paidAbsences} faltas rem.`}
                        {absences > 0 && ` · ${absences} faltas`}
                        {anyPatient.payment_due_day && ` · Vence dia ${anyPatient.payment_due_day}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isGlobalFixed ? (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                          {isClinicFixoMensal ? 'Coberto pelo Fixo' : 'Contrato de Diária'}
                        </span>
                      ) : (
                        <>
                          <p className="font-bold text-foreground text-sm">
                            R$ {revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                          {/* WhatsApp reminder for pending payments */}
                          {clinic.type === 'propria' && !pr?.paid && (
                            <QuickWhatsAppButton
                              phone={(patient as any).whatsapp || (patient as any).phone || (patient as any).responsible_whatsapp}
                              tooltip="Enviar lembrete de pagamento via WhatsApp"
                              message={resolveTemplate(
                                'Olá, {{nome_paciente}}! 😊 Passando para lembrar sobre o pagamento de R$ {{valor_sessao}} referente ao mês de {{data_consulta}}. Qualquer dúvida, estou à disposição. — {{nome_terapeuta}}',
                                {
                                  nome_paciente: patient.name,
                                  valor_sessao: revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
                                  data_consulta: format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR }),
                                  nome_terapeuta: therapistName,
                                }
                              )}
                            />
                          )}
                          {clinic.type === 'propria' && (
                            <button
                              type="button"
                              disabled={savingPatientPayment === patient.id}
                              title={pr?.paid ? 'Marcar como pendente' : 'Marcar como pago'}
                              onClick={async () => {
                                if (!user) return;
                                setSavingPatientPayment(patient.id);
                                const m = selectedDate.getMonth() + 1;
                                const y = selectedDate.getFullYear();
                                const newPaid = !pr?.paid;
                                const newDate = newPaid ? new Date().toISOString().split('T')[0] : null;
                                const existing = pr as any;
                                if (existing?.id) {
                                  await supabase.from('patient_payment_records' as any).update({ paid: newPaid, payment_date: newDate }).eq('id', existing.id);
                                } else {
                                  await supabase.from('patient_payment_records' as any).insert({ user_id: user.id, patient_id: patient.id, clinic_id: clinicId, month: m, year: y, amount: revenue, paid: newPaid, payment_date: newDate });
                                }
                                setPatientPaymentRecords(prev => ({ ...prev, [patient.id]: { ...(prev[patient.id] || {}), paid: newPaid, payment_date: newDate, id: existing?.id } as any }));
                                setSavingPatientPayment(null);
                              }}
                              className={cn(
                                'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors disabled:opacity-50',
                                pr?.paid ? 'bg-success' : 'bg-input'
                              )}
                            >
                              <span className={cn('pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg transition-transform', pr?.paid ? 'translate-x-4' : 'translate-x-0')} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  {!isGlobalFixed && clinic.type === 'propria' && pr?.paid && pr.payment_date && (
                    <p className="text-[10px] text-success flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Pago em {format(new Date(pr.payment_date + 'T00:00:00'), 'dd/MM/yyyy')}
                    </p>
                  )}
                </div>
              );
            })}
            <div className="flex justify-between items-center pt-3 border-t border-border">
              <div>
                <p className="font-bold text-foreground text-sm">Total Pacientes</p>
                {servicesRevenue > 0 && (
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Briefcase className="w-3 h-3" />+ R$ {servicesRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} serviços
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="font-bold text-foreground text-base">
                  R$ {totalRevenueWithServices.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                {discountPercent > 0 && (
                  <p className="font-bold text-success text-sm">
                    Líquido: R$ {netRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Contratante payment record */}
      {clinic.type === 'terceirizada' && (
        <div className="bg-card rounded-2xl p-5 border border-border">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-foreground text-sm">Pagamento da Clínica</h3>
            <span className="ml-auto text-[10px] text-muted-foreground capitalize">{monthName}</span>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Registre se você já recebeu o pagamento desta clínica contratante para este mês.
          </p>

          <div className="flex flex-col gap-3">
            {/* Toggle pago/pendente */}
            <div className="flex items-center justify-between rounded-xl bg-secondary/40 border border-border/60 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {paymentRecord?.paid ? '✅ Pago' : '⏳ Pendente'}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Valor previsto: R$ {netRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <button
                type="button"
                disabled={savingPayment}
                onClick={() => savePaymentRecord({ paid: !paymentRecord?.paid, payment_date: !paymentRecord?.paid ? new Date().toISOString().split('T')[0] : null })}
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors disabled:opacity-50',
                  paymentRecord?.paid ? 'bg-success' : 'bg-input'
                )}
              >
                <span className={cn(
                  'pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform',
                  paymentRecord?.paid ? 'translate-x-5' : 'translate-x-0'
                )} />
              </button>
            </div>

            {/* Payment date picker — shown when paid */}
            {paymentRecord?.paid && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Data do Recebimento</label>
                <Popover open={paymentDateOpen} onOpenChange={setPaymentDateOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-sm h-9 gap-2", !paymentRecord.payment_date && "text-muted-foreground")}>
                      <CalendarIcon className="w-3.5 h-3.5 shrink-0" />
                      {paymentRecord.payment_date
                        ? format(new Date(paymentRecord.payment_date + 'T00:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                        : 'Selecionar data'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={paymentRecord.payment_date ? new Date(paymentRecord.payment_date + 'T00:00:00') : undefined}
                      onSelect={(d) => {
                        if (d) {
                          savePaymentRecord({ payment_date: d.toISOString().split('T')[0] });
                          setPaymentDateOpen(false);
                        }
                      }}
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // =================== DIAS ESPECÍFICOS ===================
  const selectedDaysStr = specificDays.map(d => format(d, 'yyyy-MM-dd'));

  const dayEvolutions = evolutions.filter(e => {
    if (!clinicPatients.some(p => p.id === e.patientId)) return false;
    return selectedDaysStr.includes(e.date);
  });

  const dayPresentEvos = dayEvolutions.filter(e => e.attendanceStatus === 'presente' || e.attendanceStatus === 'reposicao');
  const dayAbsentEvos = dayEvolutions.filter(e => e.attendanceStatus === 'falta');
  const dayPaidAbsenceEvos = dayEvolutions.filter(e => e.attendanceStatus === 'falta_remunerada');
  const dayFeriadoRemEvos = dayEvolutions.filter(e => e.attendanceStatus === 'feriado_remunerado');

  const calculateDayPatientRevenue = (patientId: string) => {
    const patient = clinicPatients.find(p => p.id === patientId);
    if (!patient || !patient.paymentValue) return 0;
    if (patient.paymentType === 'fixo') {
      // For fixed, prorate by days selected that fall in patient's scheduled days
      const hasEvo = dayEvolutions.some(e => e.patientId === patientId);
      return hasEvo ? patient.paymentValue : 0;
    }
    const presentCount = dayPresentEvos.filter(e => e.patientId === patientId).length;
    const paidAbsenceCount = dayPaidAbsenceEvos.filter(e => e.patientId === patientId).length;
    const feriadoRemCount = dayFeriadoRemEvos.filter(e => e.patientId === patientId).length;
    let paidRegularAbsences = 0;
    const regularAbsences = dayAbsentEvos.filter(e => e.patientId === patientId);
    if (absenceType === 'always') paidRegularAbsences = regularAbsences.length;
    else if (absenceType === 'confirmed_only') paidRegularAbsences = regularAbsences.filter(e => e.confirmedAttendance).length;
    return (presentCount + paidAbsenceCount + paidRegularAbsences + feriadoRemCount) * patient.paymentValue;
  };

  const dayServicesFiltered = clinicServices.filter(s => selectedDaysStr.includes(s.date));
  const dayServicesConcluded = dayServicesFiltered.filter(s => s.status === 'concluído');
  const dayServicesRevenue = dayServicesConcluded.reduce((sum, s) => sum + s.price, 0);

  const dayPatientBreakdown = clinicPatients
    .map(patient => ({
      patient,
      revenue: calculateDayPatientRevenue(patient.id),
      sessions: dayPresentEvos.filter(e => e.patientId === patient.id).length,
      absences: dayAbsentEvos.filter(e => e.patientId === patient.id).length,
      paidAbsences: dayPaidAbsenceEvos.filter(e => e.patientId === patient.id).length,
      evosInDays: dayEvolutions.filter(e => e.patientId === patient.id),
    }))
    .filter(p => p.evosInDays.length > 0 || p.sessions > 0)
    .sort((a, b) => b.revenue - a.revenue);

  const dayTotalRevenue = dayPatientBreakdown.reduce((sum, p) => sum + p.revenue, 0) + dayServicesRevenue;

  // Group evolutions by day for display
  const evosByDay = selectedDaysStr.reduce<Record<string, typeof dayEvolutions>>((acc, d) => {
    acc[d] = dayEvolutions.filter(e => e.date === d);
    return acc;
  }, {});

  const handleExportDaysPDF = async () => {
    setIsExportingDays(true);
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pw = 210;
      const margin = 14;
      const contentW = pw - margin * 2;
      let y = margin;

      const fmt = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

      // Header
      doc.setFillColor(99, 102, 241);
      doc.rect(0, 0, pw, 28, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(clinic?.name || 'Clínica', margin, 12);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const daysLabel = specificDays.length === 1
        ? format(specificDays[0], "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
        : `${specificDays.length} dias selecionados`;
      doc.text(`Relatório por Dias Específicos — ${daysLabel}`, margin, 20);
      if (therapistName) doc.text(therapistName, pw - margin, 20, { align: 'right' });
      y = 36;

      // Summary
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Resumo do Período', margin, y);
      y += 6;

      const cards = [
        { label: 'Faturamento Total', value: fmt(dayTotalRevenue) },
        { label: 'Sessões Realizadas', value: String(dayPresentEvos.length) },
        { label: 'Faltas Remuneradas', value: String(dayPaidAbsenceEvos.length) },
        { label: 'Faltas', value: String(dayAbsentEvos.length) },
      ];
      const cw = contentW / 4;
      cards.forEach((card, i) => {
        const cx = margin + i * cw;
        doc.setFillColor(245, 245, 255);
        doc.roundedRect(cx, y, cw - 2, 18, 3, 3, 'F');
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 120);
        doc.text(card.label, cx + (cw - 2) / 2, y + 6, { align: 'center' });
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 30, 30);
        doc.text(card.value, cx + (cw - 2) / 2, y + 13, { align: 'center' });
      });
      y += 24;

      // Days list
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 30, 30);
      doc.text('Dias Selecionados', margin, y);
      y += 5;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      selectedDaysStr.forEach(dayStr => {
        const dayEvos = evosByDay[dayStr] || [];
        const dayLabel = format(new Date(dayStr + 'T12:00:00'), "EEEE, dd 'de' MMMM", { locale: ptBR });
        if (y > 260) { doc.addPage(); y = margin; }
        doc.setFillColor(237, 233, 254);
        doc.rect(margin, y, contentW, 7, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(99, 102, 241);
        doc.text(dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1), margin + 2, y + 5);
        const dayTotal = dayEvos.reduce((sum, e) => {
          const p = clinicPatients.find(pt => pt.id === e.patientId);
          if (!p || !p.paymentValue) return sum;
          if (e.attendanceStatus === 'presente' || e.attendanceStatus === 'reposicao' || e.attendanceStatus === 'falta_remunerada' || e.attendanceStatus === 'feriado_remunerado') return sum + p.paymentValue;
          if (e.attendanceStatus === 'falta' && absenceType === 'always') return sum + p.paymentValue;
          return sum;
        }, 0);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 30, 30);
        doc.text(fmt(dayTotal), pw - margin, y + 5, { align: 'right' });
        y += 9;
        if (dayEvos.length === 0) {
          doc.setTextColor(150, 150, 150);
          doc.text('Sem evoluções registradas', margin + 4, y + 3);
          y += 7;
        } else {
          dayEvos.forEach(e => {
            const p = clinicPatients.find(pt => pt.id === e.patientId);
            if (!p) return;
            if (y > 268) { doc.addPage(); y = margin; }
            const statusMap: Record<string, string> = { presente: 'Presente', falta: 'Falta', reposicao: 'Reposição', falta_remunerada: 'Falta Rem.', feriado_remunerado: 'Feriado Rem.' };
            doc.setTextColor(50, 50, 50);
            doc.text(`• ${p.name}`, margin + 4, y + 3);
            doc.setTextColor(120, 120, 120);
            doc.text(statusMap[e.attendanceStatus] || e.attendanceStatus, margin + 70, y + 3);
            const val = calculateDayPatientRevenue(p.id);
            doc.setTextColor(30, 30, 30);
            if (val > 0) doc.text(fmt(val / (dayPatientBreakdown.find(x => x.patient.id === p.id)?.sessions || 1 )), pw - margin, y + 3, { align: 'right' });
            y += 6;
          });
        }
        y += 2;
      });

      // Patient breakdown table
      if (dayPatientBreakdown.length > 0) {
        if (y > 220) { doc.addPage(); y = margin; }
        y += 4;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 30, 30);
        doc.text('Detalhamento por Paciente', margin, y);
        y += 5;
        // Header row
        doc.setFillColor(99, 102, 241);
        doc.rect(margin, y, contentW, 7, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.text('Paciente', margin + 2, y + 5);
        doc.text('Sessões', margin + 80, y + 5);
        doc.text('Faltas', margin + 110, y + 5);
        doc.text('Valor', pw - margin, y + 5, { align: 'right' });
        y += 8;
        dayPatientBreakdown.forEach((item, idx) => {
          if (y > 268) { doc.addPage(); y = margin; }
          doc.setFillColor(idx % 2 === 0 ? 248 : 255, idx % 2 === 0 ? 248 : 255, idx % 2 === 0 ? 255 : 255);
          doc.rect(margin, y, contentW, 7, 'F');
          doc.setTextColor(30, 30, 30);
          doc.setFont('helvetica', 'normal');
          doc.text(item.patient.name.substring(0, 35), margin + 2, y + 5);
          doc.text(String(item.sessions), margin + 83, y + 5);
          doc.text(String(item.absences), margin + 113, y + 5);
          doc.setFont('helvetica', 'bold');
          doc.text(fmt(item.revenue), pw - margin, y + 5, { align: 'right' });
          y += 7;
        });
        // Total row
        doc.setFillColor(237, 233, 254);
        doc.rect(margin, y, contentW, 8, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(99, 102, 241);
        doc.text('TOTAL', margin + 2, y + 6);
        doc.text(fmt(dayTotalRevenue), pw - margin, y + 6, { align: 'right' });
      }

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setTextColor(170, 170, 170);
        doc.setFontSize(7);
        doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")} — ${i}/${pageCount}`, pw / 2, 292, { align: 'center' });
      }

      const safeName = (clinic?.name || 'clinica').replace(/[^a-z0-9]/gi, '-').toLowerCase();
      const dayTag = specificDays.length === 1
        ? format(specificDays[0], 'dd-MM-yyyy')
        : `${specificDays.length}-dias`;
      doc.save(`financeiro-${safeName}-${dayTag}.pdf`);
    } finally {
      setIsExportingDays(false);
    }
  };

  const DaysView = (
    <div className="space-y-5">
      {/* Calendar */}
      <div className="bg-card rounded-2xl p-4 border border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-foreground text-sm">Selecionar Dias</h3>
          </div>
          {specificDays.length > 0 && (
            <button
              onClick={() => setSpecificDays([])}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Limpar ({specificDays.length})
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Clique em um ou mais dias para ver o rendimento específico.
        </p>
        <Calendar
          mode="multiple"
          selected={specificDays}
          onSelect={(days) => setSpecificDays(days || [])}
          className="p-0 pointer-events-auto w-full"
          classNames={{ months: 'w-full', month: 'w-full', table: 'w-full', head_cell: 'w-full', cell: 'w-full', day: 'w-full h-9' }}
        />
      </div>

      {specificDays.length === 0 ? (
        <div className="text-center text-muted-foreground py-12 text-sm">
          <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Selecione dias no calendário acima</p>
          <p className="text-xs mt-1">Você pode selecionar múltiplos dias</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card rounded-2xl p-4 border border-border col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Faturamento do Período</p>
                  <p className="text-2xl font-bold text-foreground">
                    {`R$ ${dayTotalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {specificDays.length === 1
                      ? format(specificDays[0], "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                      : `${specificDays.length} dias selecionados`}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={handleExportDaysPDF}
                  disabled={isExportingDays}
                  className="gap-1.5 shrink-0"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  {isExportingDays ? 'Gerando...' : 'Exportar PDF'}
                </Button>
              </div>
            </div>
            <div className="bg-card rounded-2xl p-4 border border-border">
              <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                <TrendingUp className="w-3.5 h-3.5 text-primary" />
              </div>
              <p className="text-muted-foreground text-xs">Sessões</p>
              <p className="text-xl font-bold text-foreground">{dayPresentEvos.length}</p>
            </div>
            <div className="bg-card rounded-2xl p-4 border border-border">
              <div className="w-7 h-7 rounded-xl bg-destructive/10 flex items-center justify-center mb-2">
                <TrendingDown className="w-3.5 h-3.5 text-destructive" />
              </div>
              <p className="text-muted-foreground text-xs">Faltas</p>
              <p className="text-xl font-bold text-foreground">{dayAbsentEvos.length}</p>
            </div>
          </div>

          {/* Per-day breakdown */}
          <div className="bg-card rounded-2xl p-4 border border-border space-y-3">
            <h3 className="font-bold text-foreground text-sm">Por Dia</h3>
            {[...specificDays].sort((a, b) => a.getTime() - b.getTime()).map(day => {
              const dayStr = format(day, 'yyyy-MM-dd');
              const dayEvosForDay = evosByDay[dayStr] || [];
              const dayServicesForDay = clinicServices.filter(s => s.date === dayStr && s.status === 'concluído');
              const daySvcRevenue = dayServicesForDay.reduce((sum, s) => sum + s.price, 0);
              const dayPatRevenue = dayEvosForDay.reduce((sum, e) => {
                const p = clinicPatients.find(pt => pt.id === e.patientId);
                if (!p || !p.paymentValue) return sum;
                if (p.paymentType === 'fixo') return sum;
                if (e.attendanceStatus === 'presente' || e.attendanceStatus === 'reposicao' || e.attendanceStatus === 'falta_remunerada' || e.attendanceStatus === 'feriado_remunerado') return sum + p.paymentValue;
                if (e.attendanceStatus === 'falta' && absenceType === 'always') return sum + p.paymentValue;
                return sum;
              }, 0);
              const dayTotal = dayPatRevenue + daySvcRevenue;
              const presentOnDay = dayEvosForDay.filter(e => e.attendanceStatus === 'presente' || e.attendanceStatus === 'reposicao').length;
              const absentOnDay = dayEvosForDay.filter(e => e.attendanceStatus === 'falta').length;
              const dayLabel = format(day, "EEE, dd 'de' MMM", { locale: ptBR });

              return (
                <div key={dayStr} className="rounded-xl bg-secondary/40 border border-border/50 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2.5 bg-primary/5">
                    <div>
                      <p className="text-sm font-semibold text-foreground capitalize">{dayLabel}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {presentOnDay} sessões{absentOnDay > 0 ? ` · ${absentOnDay} faltas` : ''}
                        {dayServicesForDay.length > 0 ? ` · ${dayServicesForDay.length} serviços` : ''}
                      </p>
                    </div>
                    <p className="font-bold text-primary text-sm">
                      {`R$ ${dayTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    </p>
                  </div>
                  {dayEvosForDay.length > 0 && (
                    <div className="px-3 py-2 space-y-1">
                      {dayEvosForDay.map(e => {
                        const p = clinicPatients.find(pt => pt.id === e.patientId);
                        if (!p) return null;
                        const statusMap: Record<string, { label: string; color: string }> = {
                          presente: { label: 'Presente', color: 'text-success' },
                          falta: { label: 'Falta', color: 'text-destructive' },
                          reposicao: { label: 'Reposição', color: 'text-primary' },
                          falta_remunerada: { label: 'Falta Rem.', color: 'text-warning' },
                          feriado_remunerado: { label: 'Feriado Rem.', color: 'text-primary' },
                        };
                        const st = statusMap[e.attendanceStatus] || { label: e.attendanceStatus, color: 'text-muted-foreground' };
                        return (
                          <div key={e.id} className="flex items-center justify-between text-xs">
                            <span className="text-foreground truncate max-w-[140px]">{p.name}</span>
                            <span className={cn('text-[10px] font-medium', st.color)}>{st.label}</span>
                          </div>
                        );
                      })}
                      {dayServicesForDay.map(s => (
                        <div key={s.id} className="flex items-center justify-between text-xs">
                          <span className="text-foreground truncate max-w-[140px]">{s.client_name} <span className="text-muted-foreground">({s.service_name || 'Serviço'})</span></span>
                          <span className="text-[10px] font-medium text-success">{`R$ ${s.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {dayEvosForDay.length === 0 && dayServicesForDay.length === 0 && (
                    <p className="text-xs text-muted-foreground px-3 py-2">Sem registros neste dia</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Patient breakdown */}
          {dayPatientBreakdown.length > 0 && (
            <div className="bg-card rounded-2xl p-4 border border-border">
              <h3 className="font-bold text-foreground text-sm mb-3">Por Paciente</h3>
              <div className="space-y-2">
                {dayPatientBreakdown.map(({ patient, revenue, sessions, absences }) => (
                  <div key={patient.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border/50">
                    <div>
                      <p className="text-sm font-medium text-foreground">{patient.name}</p>
                      <p className="text-[10px] text-muted-foreground">{sessions} sessões{absences > 0 ? ` · ${absences} faltas` : ''}</p>
                    </div>
                    <p className="font-bold text-foreground text-sm">
                      {`R$ ${revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    </p>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-2 border-t border-border">
                  <p className="font-bold text-foreground text-sm">Total</p>
                  <p className="font-bold text-foreground text-base">
                    {`R$ ${dayTotalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  const FinancialWithDays = (
    <Tabs defaultValue="mensal" className="space-y-4">
      <TabsList className="grid w-full grid-cols-3 h-11 bg-muted/50 p-1 rounded-xl mb-4">
        <TabsTrigger value="mensal" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
          <DollarSign className="w-4 h-4" />
          Faturamento
        </TabsTrigger>
        <TabsTrigger value="billing" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
          <Receipt className="w-4 h-4" />
          Cobranças
        </TabsTrigger>
        <TabsTrigger value="dias" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
          <CalendarDays className="w-4 h-4" />
          Dias Específicos
        </TabsTrigger>
      </TabsList>
      <TabsContent value="mensal">{SoloView}</TabsContent>
      <TabsContent value="billing">
        <PatientBillingManager clinicId={clinicId} />
      </TabsContent>
      <TabsContent value="dias">{DaysView}</TabsContent>
    </Tabs>
  );

  if (isOrg) {
    return (
      <Tabs defaultValue="meu" className="space-y-4">
        <TabsList className="h-auto p-0.5 gap-0.5">
          <TabsTrigger value="meu" className="text-xs px-3 py-1.5 gap-1">
            <DollarSign className="w-3 h-3" />
            Meu Financeiro
          </TabsTrigger>
          <TabsTrigger value="equipe" className="text-xs px-3 py-1.5 gap-1">
            <Users className="w-3 h-3" />
            Equipe
          </TabsTrigger>
        </TabsList>
        <TabsContent value="meu">{FinancialWithDays}</TabsContent>
        <TabsContent value="equipe">
          <TeamFinancialReport clinicId={clinicId} />
        </TabsContent>
      </Tabs>
    );
  }

  return FinancialWithDays;
}
