import { useState, useEffect, useRef, useCallback } from 'react';
import { DollarSign, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, AlertTriangle, Percent, Users, Briefcase } from 'lucide-react';
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

interface ClinicFinancialProps {
  clinicId: string;
}

export function ClinicFinancial({ clinicId }: ClinicFinancialProps) {
  const { clinics, patients, evolutions, updateClinic } = useApp();
  const { isOrg } = useClinicOrg(clinicId);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [clinicServices, setClinicServices] = useState<{ price: number; status: string; paid: boolean | null }[]>([]);

  const clinic = clinics.find(c => c.id === clinicId);
  const [discountPercent, setDiscountPercent] = useState(clinic?.discountPercentage || 0);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (clinic) setDiscountPercent(clinic.discountPercentage || 0);
  }, [clinic?.discountPercentage]);

  // Load private_appointments linked to this clinic
  useEffect(() => {
    supabase
      .from('private_appointments')
      .select('price, status, paid')
      .eq('clinic_id', clinicId)
      .then(({ data }) => { if (data) setClinicServices(data as any[]); });
  }, [clinicId]);

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

  const totalRevenue = clinicPatients.reduce((sum, p) => sum + calculatePatientRevenue(p.id), 0);

  // Services revenue for selected month (concluído status, paid)
  const servicesMonthRevenue = clinicServices
    .filter(s => s.status === 'concluído')
    .reduce((sum, s) => sum + s.price, 0);
  const servicesMonthPaid = clinicServices
    .filter(s => s.status === 'concluído' && s.paid)
    .reduce((sum, s) => sum + s.price, 0);

  const totalRevenueWithServices = totalRevenue + servicesMonthRevenue;
  const netRevenue = totalRevenueWithServices * (1 - discountPercent / 100);
  const totalSessions = presentEvos.length;
  const totalAbsences = absentEvos.length;
  const totalPaidAbsences = paidAbsenceEvos.length;
  const totalReposicoes = reposicaoEvos.length;

  const patientBreakdown = clinicPatients
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

  const SoloView = (
    <div className="space-y-6">
      {/* Month navigation */}
      <div className="flex items-center justify-between bg-card rounded-2xl p-4 border border-border">
        <Button variant="ghost" size="icon" onClick={() => setSelectedDate(prev => subMonths(prev, 1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="text-center">
          <h3 className="font-bold text-foreground capitalize">{monthName}</h3>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setSelectedDate(prev => addMonths(prev, 1))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-2xl p-5 border border-border">
          <DollarSign className="w-6 h-6 text-success mb-2" />
          <p className="text-muted-foreground text-xs">Faturamento Bruto</p>
          <p className="text-xl font-bold text-foreground">
            R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          {discountPercent > 0 && (
            <div className="mt-2 pt-2 border-t border-border">
              <p className="text-muted-foreground text-xs">Valor Líquido ({discountPercent}% desc.)</p>
              <p className="text-lg font-bold text-success">
                R$ {netRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          )}
        </div>
        <div className="bg-card rounded-2xl p-5 border border-border">
          <TrendingUp className="w-6 h-6 text-primary mb-2" />
          <p className="text-muted-foreground text-xs">Sessões</p>
          <p className="text-xl font-bold text-foreground">{totalSessions}</p>
          {totalReposicoes > 0 && <p className="text-xs text-muted-foreground">🔄 {totalReposicoes} repos.</p>}
        </div>
        <div className="bg-card rounded-2xl p-5 border border-border">
          <AlertTriangle className="w-6 h-6 text-warning mb-2" />
          <p className="text-muted-foreground text-xs">Faltas Rem.</p>
          <p className="text-xl font-bold text-foreground">{totalPaidAbsences}</p>
        </div>
        <div className="bg-card rounded-2xl p-5 border border-border">
          <TrendingDown className="w-6 h-6 text-destructive mb-2" />
          <p className="text-muted-foreground text-xs">Faltas</p>
          <p className="text-xl font-bold text-foreground">{totalAbsences}</p>
        </div>
      </div>

      {/* Discount simulator */}
      <div className="bg-card rounded-2xl p-5 border border-border">
        <div className="flex items-center gap-2 mb-3">
          <Percent className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-foreground text-sm">Simulador de Desconto da Clínica</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Defina a porcentagem que a clínica retém. O valor é salvo automaticamente.
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
          <div className="flex-1 text-sm text-muted-foreground">
            {discountPercent > 0 ? (
              <span>
                Bruto <strong className="text-foreground">R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
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
      <div className="bg-card rounded-2xl p-6 border border-border">
        <h3 className="font-bold text-foreground mb-4">Detalhamento por Paciente</h3>
        {patientBreakdown.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhum registro neste mês</p>
        ) : (
          <div className="space-y-3">
            {patientBreakdown.map(({ patient, revenue, sessions, absences, paidAbsences, reposicoes }) => (
              <div key={patient.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-secondary/50 border border-border gap-2">
                <div>
                  <p className="font-medium text-foreground text-sm">{patient.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {sessions} sessões
                    {reposicoes > 0 && ` (🔄${reposicoes})`}
                    {paidAbsences > 0 && ` • ${paidAbsences} faltas rem.`}
                    {absences > 0 && ` • ${absences} faltas`}
                    {' • '}{patient.paymentType === 'fixo' ? 'Fixo' : 'Por sessão'}
                  </p>
                </div>
                <p className="font-bold text-foreground text-sm">
                  R$ {revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            ))}
            <div className="flex justify-between items-center pt-3 border-t border-border">
              <p className="font-bold text-foreground">Total Bruto</p>
              <p className="font-bold text-foreground text-lg">
                R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            {discountPercent > 0 && (
              <div className="flex justify-between items-center">
                <p className="font-bold text-success">Valor Líquido ({discountPercent}%)</p>
                <p className="font-bold text-success text-lg">
                  R$ {netRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // Org mode: show tabs with individual and team views
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
