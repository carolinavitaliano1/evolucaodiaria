import { useState } from 'react';
import { DollarSign, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApp } from '@/contexts/AppContext';
import { format, subMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ClinicFinancialProps {
  clinicId: string;
}

export function ClinicFinancial({ clinicId }: ClinicFinancialProps) {
  const { clinics, patients, evolutions } = useApp();
  const [selectedDate, setSelectedDate] = useState(new Date());

  const clinic = clinics.find(c => c.id === clinicId);
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

  const absenceType = clinic.absencePaymentType || (clinic.paysOnAbsence === false ? 'never' : 'always');

  const calculatePatientRevenue = (patientId: string) => {
    const patient = clinicPatients.find(p => p.id === patientId);
    if (!patient || !patient.paymentValue) return 0;

    if (patient.paymentType === 'fixo') return patient.paymentValue;

    const presentCount = presentEvos.filter(e => e.patientId === patientId).length;
    const paidAbsenceCount = paidAbsenceEvos.filter(e => e.patientId === patientId).length;

    let paidRegularAbsences = 0;
    const regularAbsences = absentEvos.filter(e => e.patientId === patientId);
    if (absenceType === 'always') paidRegularAbsences = regularAbsences.length;
    else if (absenceType === 'confirmed_only') paidRegularAbsences = regularAbsences.filter(e => e.confirmedAttendance).length;

    return (presentCount + paidAbsenceCount + paidRegularAbsences) * patient.paymentValue;
  };

  const totalRevenue = clinicPatients.reduce((sum, p) => sum + calculatePatientRevenue(p.id), 0);
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

  return (
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
          <p className="text-muted-foreground text-xs">Faturamento</p>
          <p className="text-xl font-bold text-foreground">
            R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-card rounded-2xl p-5 border border-border">
          <TrendingUp className="w-6 h-6 text-primary mb-2" />
          <p className="text-muted-foreground text-xs">Sessões</p>
          <p className="text-xl font-bold text-foreground">{totalSessions}</p>
          {totalReposicoes > 0 && (
            <p className="text-xs text-muted-foreground">🔄 {totalReposicoes} repos.</p>
          )}
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
                    {' • '}
                    {patient.paymentType === 'fixo' ? 'Fixo' : 'Por sessão'}
                  </p>
                </div>
                <p className="font-bold text-foreground text-sm">
                  R$ {revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            ))}
            <div className="flex justify-between items-center pt-3 border-t border-border">
              <p className="font-bold text-foreground">Total</p>
              <p className="font-bold text-foreground text-lg">
                R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
