import { Building2, Users, DollarSign, TrendingUp, TrendingDown, Filter, Download } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';

export default function Financial() {
  const { clinics, patients, evolutions, payments } = useApp();

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Calculate monthly stats
  const monthlyEvolutions = evolutions.filter(e => {
    const date = new Date(e.date);
    return date.getMonth() === currentMonth && 
           date.getFullYear() === currentYear &&
           e.attendanceStatus === 'presente';
  });

  const calculatePatientRevenue = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    if (!patient || !patient.paymentValue) return 0;

    if (patient.paymentType === 'fixo') {
      return patient.paymentValue;
    }

    const patientEvos = monthlyEvolutions.filter(e => e.patientId === patientId);
    return patientEvos.length * patient.paymentValue;
  };

  const totalRevenue = patients.reduce((sum, p) => sum + calculatePatientRevenue(p.id), 0);

  const clinicStats = clinics.map(clinic => {
    const clinicPatients = patients.filter(p => p.clinicId === clinic.id);
    const revenue = clinicPatients.reduce((sum, p) => sum + calculatePatientRevenue(p.id), 0);
    
    return {
      clinic,
      patientCount: clinicPatients.length,
      revenue,
    };
  });

  const patientStats = patients.map(patient => {
    const clinic = clinics.find(c => c.id === patient.clinicId);
    const revenue = calculatePatientRevenue(patient.id);
    const sessions = monthlyEvolutions.filter(e => e.patientId === patient.id).length;

    return {
      patient,
      clinic,
      revenue,
      sessions,
      paymentType: patient.paymentType,
      paymentValue: patient.paymentValue || 0,
    };
  }).filter(p => p.paymentValue > 0);

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
          <span className="text-4xl">💰</span>
          Financeiro
        </h1>
        <p className="text-muted-foreground">
          {format(now, "MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 rounded-3xl p-8 gradient-primary shadow-glow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-primary-foreground/80 mb-2">Faturamento do Mês</p>
              <h2 className="text-4xl lg:text-5xl font-bold text-primary-foreground mb-4">
                R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </h2>
              <div className="flex items-center gap-2 text-primary-foreground/80">
                <TrendingUp className="w-5 h-5" />
                <span>Baseado em {monthlyEvolutions.length} atendimentos</span>
              </div>
            </div>
            <DollarSign className="w-16 h-16 text-primary-foreground/30" />
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-card rounded-2xl p-5 border border-border">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-success/10">
                <Building2 className="w-5 h-5 text-success" />
              </div>
              <span className="text-muted-foreground">Clínicas Ativas</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{clinics.length}</p>
          </div>

          <div className="bg-card rounded-2xl p-5 border border-border">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-accent/10">
                <Users className="w-5 h-5 text-accent" />
              </div>
              <span className="text-muted-foreground">Pacientes Ativos</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{patients.length}</p>
          </div>
        </div>
      </div>

      {/* Revenue by Clinic */}
      <div className="bg-card rounded-2xl p-6 border border-border mb-8">
        <h2 className="font-bold text-foreground mb-6 flex items-center gap-2">
          🏥 Faturamento por Clínica
        </h2>

        <div className="space-y-6">
          {clinicStats.map(({ clinic, patientCount, revenue }) => {
            const percentage = totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0;
            const isPropria = clinic.type === 'propria';

            return (
              <div key={clinic.id} className="border-b border-border pb-6 last:border-0 last:pb-0">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-foreground text-lg">{clinic.name}</h3>
                    <p className="text-sm text-muted-foreground">{patientCount} pacientes</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-xl text-foreground">
                      R$ {revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-sm text-muted-foreground">{percentage.toFixed(0)}% do total</p>
                  </div>
                </div>

                <div className="relative w-full h-3 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'absolute h-full transition-all duration-500 rounded-full',
                      isPropria ? 'gradient-primary' : 'gradient-secondary'
                    )}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}

          {clinicStats.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma clínica cadastrada
            </p>
          )}
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-card rounded-2xl p-6 border border-border">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-bold text-foreground flex items-center gap-2">
            💳 Controle de Pagamentos
          </h2>
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Exportar
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-border">
                <th className="text-left py-3 px-2 font-semibold text-foreground">Paciente</th>
                <th className="text-left py-3 px-2 font-semibold text-foreground">Clínica</th>
                <th className="text-left py-3 px-2 font-semibold text-foreground">Tipo</th>
                <th className="text-right py-3 px-2 font-semibold text-foreground">Sessões</th>
                <th className="text-right py-3 px-2 font-semibold text-foreground">Valor</th>
              </tr>
            </thead>
            <tbody>
              {patientStats.map(({ patient, clinic, revenue, sessions, paymentType, paymentValue }) => (
                <tr key={patient.id} className="border-b border-border hover:bg-secondary/50">
                  <td className="py-3 px-2 text-foreground">{patient.name}</td>
                  <td className="py-3 px-2 text-muted-foreground text-sm">{clinic?.name}</td>
                  <td className="py-3 px-2 text-sm">
                    <span className={cn(
                      'px-2 py-1 rounded-full text-xs font-medium',
                      paymentType === 'fixo' ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent'
                    )}>
                      {paymentType === 'fixo' ? 'Fixo Mensal' : `R$ ${paymentValue}/sessão`}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-right text-foreground">{sessions}</td>
                  <td className="py-3 px-2 text-right font-bold text-success">
                    R$ {revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}

              {patientStats.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum paciente com valor configurado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
