import { useState, useEffect, useRef, useCallback } from 'react';
import { DollarSign, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, AlertTriangle, Percent, Users, Briefcase, CheckCircle2, Clock, XCircle, CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApp } from '@/contexts/AppContext';
import { useClinicOrg } from '@/hooks/useClinicOrg';
import { TeamFinancialReport } from './TeamFinancialReport';
import { format, subMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

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
  const { clinics, patients, evolutions, updateClinic } = useApp();
  const { user } = useAuth();
  const { isOrg } = useClinicOrg(clinicId);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [clinicServices, setClinicServices] = useState<ServiceRecord[]>([]);
  const [patientPaymentRecords, setPatientPaymentRecords] = useState<Record<string, { paid: boolean; payment_date: string | null }>>({});
  const [savingPatientPayment, setSavingPatientPayment] = useState<string | null>(null);

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

  const calculatePatientRevenue = (patientId: string) => {
    const patient = clinicPatients.find(p => p.id === patientId);
    if (!patient || !patient.paymentValue) return 0;
    if (patient.paymentType === 'fixo') return patient.paymentValue;
    const presentCount = presentEvos.filter(e => e.patientId === patientId).length;
    const paidAbsenceCount = paidAbsenceEvos.filter(e => e.patientId === patientId).length;
    const feriadoRemCount = feriadoRemEvos.filter(e => e.patientId === patientId).length;
    let paidRegularAbsences = 0;
    const regularAbsences = absentEvos.filter(e => e.patientId === patientId);
    if (absenceType === 'always') paidRegularAbsences = regularAbsences.length;
    else if (absenceType === 'confirmed_only') paidRegularAbsences = regularAbsences.filter(e => e.confirmedAttendance).length;
    return (presentCount + paidAbsenceCount + paidRegularAbsences + feriadoRemCount) * patient.paymentValue;
  };

  const totalPatientRevenue = clinicPatients.reduce((sum, p) => sum + calculatePatientRevenue(p.id), 0);

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

  const allPatientBreakdown = clinicPatients
    .map(patient => ({
      patient,
      revenue: calculatePatientRevenue(patient.id),
      sessions: presentEvos.filter(e => e.patientId === patient.id).length,
      absences: absentEvos.filter(e => e.patientId === patient.id).length,
      paidAbsences: paidAbsenceEvos.filter(e => e.patientId === patient.id).length,
      reposicoes: reposicaoEvos.filter(e => e.patientId === patient.id).length,
    }))
    .filter(p => p.revenue > 0 || p.sessions > 0 || p.absences > 0)
    .sort((a, b) => b.revenue - a.revenue);

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
        <h3 className="font-bold text-foreground mb-4 text-sm">Detalhamento por Paciente</h3>
        {patientBreakdown.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">Nenhum registro neste mês</p>
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
                        {' · '}{patient.paymentType === 'fixo' ? 'Fixo' : 'Por sessão'}
                        {anyPatient.payment_due_day && ` · Vence dia ${anyPatient.payment_due_day}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className="font-bold text-foreground text-sm">
                        R$ {revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
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
                    </div>
                  </div>
                  {pr?.paid && pr.payment_date && (
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
        <TabsContent value="meu">{SoloView}</TabsContent>
        <TabsContent value="equipe">
          <TeamFinancialReport clinicId={clinicId} />
        </TabsContent>
      </Tabs>
    );
  }

  return SoloView;
}
