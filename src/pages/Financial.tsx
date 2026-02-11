import { Building2, Users, DollarSign, TrendingUp, TrendingDown, Filter, Download, AlertTriangle, Briefcase, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';
import { usePrivateAppointments } from '@/hooks/usePrivateAppointments';
import { useState } from 'react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

export default function Financial() {
  const { clinics, patients, evolutions, payments, clinicPackages } = useApp();
  const { getMonthlyAppointments } = usePrivateAppointments();
  const [isExporting, setIsExporting] = useState(false);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthName = format(now, "MMMM 'de' yyyy", { locale: ptBR });

  // Get all evolutions for the current month
  const monthlyEvolutions = evolutions.filter(e => {
    const date = new Date(e.date);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  });

  // Separate by attendance status
  const presentEvolutions = monthlyEvolutions.filter(e => e.attendanceStatus === 'presente');
  const absentEvolutions = monthlyEvolutions.filter(e => e.attendanceStatus === 'falta');

  const calculatePatientRevenue = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    if (!patient || !patient.paymentValue) return 0;

    if (patient.paymentType === 'fixo') {
      return patient.paymentValue;
    }

    const clinic = clinics.find(c => c.id === patient.clinicId);
    const absenceType = clinic?.absencePaymentType || (clinic?.paysOnAbsence === false ? 'never' : 'always');

    // Only count sessions where attendance was confirmed (confirmedAttendance = true)
    // or where the clinic policy doesn't require confirmation
    const patientEvos = presentEvolutions.filter(e => e.patientId === patientId);
    
    if (absenceType === 'confirmed_only') {
      // Only count revenue for confirmed sessions
      const confirmedSessions = patientEvos.filter(e => e.confirmedAttendance);
      return confirmedSessions.length * patient.paymentValue;
    }

    return patientEvos.length * patient.paymentValue;
  };

  // Calculate losses from absences (only for clinics that don't pay on absence)
  const calculatePatientLoss = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    if (!patient || !patient.paymentValue || patient.paymentType === 'fixo') return 0;

    const clinic = clinics.find(c => c.id === patient.clinicId);
    const absenceType = clinic?.absencePaymentType || (clinic?.paysOnAbsence === false ? 'never' : 'always');
    
    // If clinic always pays on absence, no loss
    if (absenceType === 'always') return 0;
    
    const patientAbsences = absentEvolutions.filter(e => e.patientId === patientId);
    
    if (absenceType === 'never') {
      return patientAbsences.length * patient.paymentValue;
    }
    
    // confirmed_only: loss only when patient confirmed attendance and then didn't show up
    if (absenceType === 'confirmed_only') {
      const confirmedAbsences = patientAbsences.filter(e => e.confirmedAttendance);
      return confirmedAbsences.length * patient.paymentValue;
    }
    
    return 0;
  };

  // Get private appointments revenue
  const monthlyPrivateAppointments = getMonthlyAppointments(currentMonth, currentYear);
  // Only count completed private appointments as revenue (not scheduled ones)
  const privateRevenue = monthlyPrivateAppointments
    .filter(a => a.status === 'concluído')
    .reduce((sum, a) => sum + (a.price || 0), 0);

  const totalRevenue = patients.reduce((sum, p) => sum + calculatePatientRevenue(p.id), 0);
  const totalLoss = patients.reduce((sum, p) => sum + calculatePatientLoss(p.id), 0);
  const netRevenue = totalRevenue + privateRevenue - totalLoss;

  const clinicStats = clinics.map(clinic => {
    const clinicPatients = patients.filter(p => p.clinicId === clinic.id);
    const revenue = clinicPatients.reduce((sum, p) => sum + calculatePatientRevenue(p.id), 0);
    const loss = clinicPatients.reduce((sum, p) => sum + calculatePatientLoss(p.id), 0);
    const absences = absentEvolutions.filter(e => 
      clinicPatients.some(p => p.id === e.patientId)
    ).length;
    
    return {
      clinic,
      patientCount: clinicPatients.length,
      revenue,
      loss,
      absences,
    };
  });

  const patientStats = patients.map(patient => {
    const clinic = clinics.find(c => c.id === patient.clinicId);
    const revenue = calculatePatientRevenue(patient.id);
    const loss = calculatePatientLoss(patient.id);
    const sessions = presentEvolutions.filter(e => e.patientId === patient.id).length;
    const absences = absentEvolutions.filter(e => e.patientId === patient.id).length;

    return {
      patient,
      clinic,
      revenue,
      loss,
      sessions,
      absences,
      paymentType: patient.paymentType,
      paymentValue: patient.paymentValue || 0,
    };
  }).filter(p => p.paymentValue > 0);

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      let y = 20;

      // Header
      doc.setFontSize(20);
      doc.setTextColor(51, 51, 51);
      doc.text('Relatório Financeiro', margin, y);
      y += 10;
      
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text(monthName.charAt(0).toUpperCase() + monthName.slice(1), margin, y);
      y += 15;

      // Summary Section
      doc.setFontSize(14);
      doc.setTextColor(51, 51, 51);
      doc.text('Resumo Mensal', margin, y);
      y += 8;

      doc.setFontSize(11);
      doc.setTextColor(80, 80, 80);
      doc.text(`Faturamento Líquido: R$ ${netRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin, y);
      y += 6;
      doc.text(`Receita Bruta (Clínicas): R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin, y);
      y += 6;
      doc.text(`Receita Particulares: R$ ${privateRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin, y);
      y += 6;
      if (totalLoss > 0) {
        doc.setTextColor(220, 53, 69);
        doc.text(`Perdas por Faltas: - R$ ${totalLoss.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin, y);
        doc.setTextColor(80, 80, 80);
      }
      y += 6;
      doc.text(`Total de Atendimentos: ${presentEvolutions.length}`, margin, y);
      y += 6;
      doc.text(`Total de Faltas: ${absentEvolutions.length}`, margin, y);
      y += 15;

      // Clinic Stats
      if (clinicStats.length > 0) {
        doc.setFontSize(14);
        doc.setTextColor(51, 51, 51);
        doc.text('Faturamento por Clínica', margin, y);
        y += 10;

        doc.setFontSize(10);
        clinicStats.forEach(({ clinic, patientCount, revenue, loss, absences }) => {
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
          const netClinicRevenue = revenue - loss;
          doc.setTextColor(51, 51, 51);
          doc.text(clinic.name, margin, y);
          doc.setTextColor(80, 80, 80);
          doc.text(`R$ ${netClinicRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, pageWidth - margin - 40, y);
          y += 5;
          doc.setFontSize(9);
          doc.text(`${patientCount} pacientes | ${absences} faltas`, margin + 5, y);
          doc.setFontSize(10);
          y += 8;
        });
        y += 5;
      }

      // Private Appointments
      if (privateRevenue > 0) {
        if (y > 250) {
          doc.addPage();
          y = 20;
        }
        doc.setFontSize(14);
        doc.setTextColor(51, 51, 51);
        doc.text('Atendimentos Particulares', margin, y);
        y += 8;
        doc.setFontSize(10);
        doc.setTextColor(80, 80, 80);
        doc.text(`${monthlyPrivateAppointments.length} atendimentos`, margin, y);
        y += 5;
        doc.text(`R$ ${privateRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin, y);
        y += 15;
      }

      // Patient Table
      if (patientStats.length > 0) {
        if (y > 200) {
          doc.addPage();
          y = 20;
        }
        doc.setFontSize(14);
        doc.setTextColor(51, 51, 51);
        doc.text('Detalhamento por Paciente', margin, y);
        y += 10;

        // Table header
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text('Paciente', margin, y);
        doc.text('Clínica', margin + 50, y);
        doc.text('Tipo', margin + 95, y);
        doc.text('Sessões', margin + 120, y);
        doc.text('Valor', pageWidth - margin - 20, y);
        y += 3;
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, y, pageWidth - margin, y);
        y += 5;

        doc.setFontSize(9);
        patientStats.forEach(({ patient, clinic, revenue, loss, sessions, absences, paymentType, paymentValue }) => {
          if (y > 275) {
            doc.addPage();
            y = 20;
          }
          const netPatientRevenue = revenue - loss;
          doc.setTextColor(51, 51, 51);
          doc.text(patient.name.substring(0, 20), margin, y);
          doc.setTextColor(80, 80, 80);
          doc.text((clinic?.name || '').substring(0, 15), margin + 50, y);
          doc.text(paymentType === 'fixo' ? 'Fixo' : 'Sessão', margin + 95, y);
          doc.text(sessions.toString(), margin + 125, y);
          doc.text(`R$ ${netPatientRevenue.toFixed(2)}`, pageWidth - margin - 20, y);
          y += 6;
        });
      }

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')} | Página ${i} de ${pageCount}`,
          pageWidth / 2,
          290,
          { align: 'center' }
        );
      }

      doc.save(`financeiro-${format(now, 'yyyy-MM')}.pdf`);
      toast.success('Relatório exportado com sucesso!');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Erro ao exportar relatório');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto pb-24">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground mb-1 sm:mb-2 flex items-center gap-2 sm:gap-3">
          <span className="text-2xl sm:text-4xl">💰</span>
          Financeiro
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          {monthName}
        </p>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <div className="lg:col-span-2 rounded-2xl sm:rounded-3xl p-4 sm:p-8 gradient-primary shadow-glow">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-primary-foreground/80 mb-1 sm:mb-2 text-sm sm:text-base">Faturamento do Mês</p>
              <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-primary-foreground mb-2 sm:mb-4 break-words">
                R$ {netRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </h2>
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-primary-foreground/80 text-xs sm:text-base">
                <span className="flex items-center gap-1 sm:gap-2">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
                  {presentEvolutions.length} atend.
                </span>
                {totalLoss > 0 && (
                  <span className="flex items-center gap-1 sm:gap-2 text-amber-200">
                    <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5" />
                    {absentEvolutions.length} faltas
                  </span>
                )}
              </div>
            </div>
            <DollarSign className="w-10 h-10 sm:w-16 sm:h-16 text-primary-foreground/30 shrink-0" />
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-card rounded-2xl p-5 border border-border">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-success/10">
                <TrendingUp className="w-5 h-5 text-success" />
              </div>
              <span className="text-muted-foreground">Receita Bruta</span>
            </div>
            <p className="text-2xl font-bold text-success">
              R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>

          {totalLoss > 0 && (
            <div className="bg-card rounded-2xl p-5 border border-destructive/30">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-xl bg-destructive/10">
                  <TrendingDown className="w-5 h-5 text-destructive" />
                </div>
                <span className="text-muted-foreground">Perdas por Faltas</span>
              </div>
              <p className="text-2xl font-bold text-destructive">
                - R$ {totalLoss.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          )}

          {totalLoss === 0 && (
            <div className="bg-card rounded-2xl p-5 border border-border">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-xl bg-accent/10">
                  <Users className="w-5 h-5 text-accent" />
                </div>
                <span className="text-muted-foreground">Pacientes Ativos</span>
              </div>
              <p className="text-3xl font-bold text-foreground">{patients.length}</p>
            </div>
          )}
        </div>
      </div>

      {/* Revenue by Clinic */}
      <div className="bg-card rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-border mb-6 sm:mb-8">
        <h2 className="font-bold text-foreground mb-4 sm:mb-6 flex items-center gap-2 text-sm sm:text-base">
          🏥 Faturamento por Clínica
        </h2>

        <div className="space-y-4 sm:space-y-6">
          {clinicStats.map(({ clinic, patientCount, revenue, loss, absences }) => {
            const netClinicRevenue = revenue - loss;
            const percentage = (totalRevenue + privateRevenue) > 0 ? (revenue / (totalRevenue + privateRevenue)) * 100 : 0;
            const isPropria = clinic.type === 'propria';

            return (
              <div key={clinic.id} className="border-b border-border pb-4 sm:pb-6 last:border-0 last:pb-0">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <h3 className="font-bold text-foreground text-sm sm:text-lg truncate">{clinic.name}</h3>
                      {(clinic.absencePaymentType === 'never' || (clinic.paysOnAbsence === false && !clinic.absencePaymentType)) && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 whitespace-nowrap">
                          Não paga faltas
                        </span>
                      )}
                      {clinic.absencePaymentType === 'confirmed_only' && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 whitespace-nowrap">
                          Paga só confirmados
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground">{patientCount} pacientes</p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="font-bold text-base sm:text-xl text-foreground">
                      R$ {netClinicRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    {loss > 0 && (
                      <p className="text-xs sm:text-sm text-destructive flex items-center sm:justify-end gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {absences} faltas (-R$ {loss.toFixed(2)})
                      </p>
                    )}
                    {loss === 0 && (
                      <p className="text-xs sm:text-sm text-muted-foreground">{percentage.toFixed(0)}% do total</p>
                    )}
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

          {/* Private Appointments Section */}
          {privateRevenue > 0 && (
            <div className="border-b border-border pb-6 last:border-0 last:pb-0">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-foreground text-lg flex items-center gap-2">
                      <Briefcase className="w-4 h-4" />
                      Atendimentos Particulares
                    </h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{monthlyPrivateAppointments.length} atendimentos</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-xl text-foreground">
                    R$ {privateRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {((privateRevenue / (totalRevenue + privateRevenue)) * 100).toFixed(0)}% do total
                  </p>
                </div>
              </div>

              <div className="relative w-full h-3 bg-secondary rounded-full overflow-hidden">
                <div
                  className="absolute h-full transition-all duration-500 rounded-full bg-gradient-to-r from-amber-500 to-orange-500"
                  style={{ width: `${(privateRevenue / (totalRevenue + privateRevenue)) * 100}%` }}
                />
              </div>
            </div>
          )}

          {clinicStats.length === 0 && privateRevenue === 0 && (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma clínica cadastrada
            </p>
          )}
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-card rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
          <h2 className="font-bold text-foreground flex items-center gap-2 text-sm sm:text-base">
            💳 Controle de Pagamentos
          </h2>
          <Button 
            variant="outline" 
            className="gap-2 w-full sm:w-auto text-xs sm:text-sm"
            onClick={handleExportPDF}
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {isExporting ? 'Exportando...' : 'Exportar PDF'}
          </Button>
        </div>

        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="border-b-2 border-border">
                <th className="text-left py-2 sm:py-3 px-2 font-semibold text-foreground text-xs sm:text-sm">Paciente</th>
                <th className="text-left py-2 sm:py-3 px-2 font-semibold text-foreground text-xs sm:text-sm hidden sm:table-cell">Clínica</th>
                <th className="text-left py-2 sm:py-3 px-2 font-semibold text-foreground text-xs sm:text-sm">Tipo</th>
                <th className="text-center py-2 sm:py-3 px-2 font-semibold text-foreground text-xs sm:text-sm">Sess.</th>
                <th className="text-center py-2 sm:py-3 px-2 font-semibold text-foreground text-xs sm:text-sm">Faltas</th>
                <th className="text-right py-2 sm:py-3 px-2 font-semibold text-foreground text-xs sm:text-sm">Valor</th>
              </tr>
            </thead>
            <tbody>
              {patientStats.map(({ patient, clinic, revenue, loss, sessions, absences, paymentType, paymentValue }) => {
                const netPatientRevenue = revenue - loss;
                
                return (
                  <tr key={patient.id} className="border-b border-border hover:bg-secondary/50">
                    <td className="py-2 sm:py-3 px-2 text-foreground text-xs sm:text-sm">
                      <span className="truncate block max-w-[100px] sm:max-w-none">{patient.name}</span>
                      {patient.packageId && (() => {
                        const pkg = clinicPackages.find(p => p.id === patient.packageId);
                        return pkg ? <span className="block text-[10px] text-muted-foreground">{pkg.name}</span> : null;
                      })()}
                    </td>
                    <td className="py-2 sm:py-3 px-2 text-muted-foreground text-xs sm:text-sm hidden sm:table-cell">{clinic?.name}</td>
                    <td className="py-2 sm:py-3 px-2 text-xs sm:text-sm">
                      <span className={cn(
                        'px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium whitespace-nowrap',
                        paymentType === 'fixo' ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent'
                      )}>
                        {paymentType === 'fixo' ? 'Fixo' : `R$${paymentValue}`}
                      </span>
                    </td>
                    <td className="py-2 sm:py-3 px-2 text-center text-foreground text-xs sm:text-sm">{sessions}</td>
                    <td className="py-2 sm:py-3 px-2 text-center text-xs sm:text-sm">
                      {absences > 0 ? (
                        <span className={cn(
                          'inline-flex items-center gap-0.5',
                          loss > 0 ? 'text-destructive' : 'text-amber-600'
                        )}>
                          {absences}
                          {loss > 0 && <AlertTriangle className="w-2.5 h-2.5 sm:w-3 sm:h-3" />}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="py-2 sm:py-3 px-2 text-right">
                      <div className="flex flex-col items-end">
                        <span className={cn(
                          'font-bold text-xs sm:text-sm',
                          loss > 0 ? 'text-foreground' : 'text-success'
                        )}>
                          R$ {netPatientRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        {loss > 0 && (
                          <span className="text-xs text-destructive hidden sm:block">
                            -R$ {loss.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {patientStats.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted-foreground">
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
