import { Building2, Users, DollarSign, TrendingUp, TrendingDown, Filter, Download, AlertTriangle, Briefcase, Loader2, FileText, Stamp, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, subMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';
import { usePrivateAppointments } from '@/hooks/usePrivateAppointments';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export default function Financial() {
  const { clinics, patients, evolutions, payments, clinicPackages } = useApp();
  const { getMonthlyAppointments } = usePrivateAppointments();
  const { user } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingInvoice, setIsExportingInvoice] = useState(false);
  const [invoiceClinicId, setInvoiceClinicId] = useState<string>('');
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [stamps, setStamps] = useState<any[]>([]);
  const [selectedStampId, setSelectedStampId] = useState<string>('');
  const [profile, setProfile] = useState<any>(null);

  // Month filter state
  const [selectedDate, setSelectedDate] = useState(new Date());
  const selectedMonth = selectedDate.getMonth();
  const selectedYear = selectedDate.getFullYear();
  const monthName = format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR });

  const goToPreviousMonth = () => setSelectedDate(prev => subMonths(prev, 1));
  const goToNextMonth = () => setSelectedDate(prev => addMonths(prev, 1));
  const goToCurrentMonth = () => setSelectedDate(new Date());

  const isCurrentMonth = selectedMonth === new Date().getMonth() && selectedYear === new Date().getFullYear();

  // Load stamps and profile
  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from('stamps').select('*').eq('user_id', user.id),
      supabase.from('profiles').select('*').eq('user_id', user.id).single(),
    ]).then(([stampsRes, profileRes]) => {
      if (stampsRes.data) setStamps(stampsRes.data);
      if (profileRes.data) setProfile(profileRes.data);
    });
  }, [user]);

  // Get all evolutions for the selected month
  const monthlyEvolutions = evolutions.filter(e => {
    const date = new Date(e.date + 'T12:00:00');
    return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
  });

  // Separate by attendance status
  const presentEvolutions = monthlyEvolutions.filter(e => e.attendanceStatus === 'presente');
  const absentEvolutions = monthlyEvolutions.filter(e => e.attendanceStatus === 'falta');
  const paidAbsenceEvolutions = monthlyEvolutions.filter(e => e.attendanceStatus === 'falta_remunerada');

  const calculatePatientRevenue = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    if (!patient || !patient.paymentValue) return 0;

    if (patient.paymentType === 'fixo') {
      return patient.paymentValue;
    }

    const presentCount = presentEvolutions.filter(e => e.patientId === patientId).length;
    const paidAbsenceCount = paidAbsenceEvolutions.filter(e => e.patientId === patientId).length;

    const clinic = clinics.find(c => c.id === patient.clinicId);
    const absenceType = clinic?.absencePaymentType || (clinic?.paysOnAbsence === false ? 'never' : 'always');
    
    let paidRegularAbsences = 0;
    const regularAbsences = absentEvolutions.filter(e => e.patientId === patientId);
    
    if (absenceType === 'always') {
      paidRegularAbsences = regularAbsences.length;
    } else if (absenceType === 'confirmed_only') {
      paidRegularAbsences = regularAbsences.filter(e => e.confirmedAttendance).length;
    }

    return (presentCount + paidAbsenceCount + paidRegularAbsences) * patient.paymentValue;
  };

  const calculatePatientLoss = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    if (!patient || !patient.paymentValue || patient.paymentType === 'fixo') return 0;

    const clinic = clinics.find(c => c.id === patient.clinicId);
    const absenceType = clinic?.absencePaymentType || (clinic?.paysOnAbsence === false ? 'never' : 'always');
    
    if (absenceType === 'always') return 0;
    
    const patientAbsences = absentEvolutions.filter(e => e.patientId === patientId);
    
    if (absenceType === 'never') {
      return patientAbsences.length * patient.paymentValue;
    }
    
    if (absenceType === 'confirmed_only') {
      const nonConfirmedAbsences = patientAbsences.filter(e => !e.confirmedAttendance);
      return nonConfirmedAbsences.length * patient.paymentValue;
    }
    
    return 0;
  };

  const monthlyPrivateAppointments = getMonthlyAppointments(selectedMonth, selectedYear);
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
    const sessions = presentEvolutions.filter(e =>
      clinicPatients.some(p => p.id === e.patientId)
    ).length;
    const paidAbsences = paidAbsenceEvolutions.filter(e =>
      clinicPatients.some(p => p.id === e.patientId)
    ).length;
    const absences = absentEvolutions.filter(e => 
      clinicPatients.some(p => p.id === e.patientId)
    ).length;
    
    return {
      clinic,
      patientCount: clinicPatients.length,
      revenue,
      loss,
      sessions,
      paidAbsences,
      absences,
    };
  });

  const patientStats = patients.map(patient => {
    const clinic = clinics.find(c => c.id === patient.clinicId);
    const revenue = calculatePatientRevenue(patient.id);
    const loss = calculatePatientLoss(patient.id);
    const sessions = presentEvolutions.filter(e => e.patientId === patient.id).length;
    const paidAbsences = paidAbsenceEvolutions.filter(e => e.patientId === patient.id).length;
    const absences = absentEvolutions.filter(e => e.patientId === patient.id).length;

    return {
      patient,
      clinic,
      revenue,
      loss,
      sessions,
      paidAbsences,
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

      doc.setFontSize(20);
      doc.setTextColor(51, 51, 51);
      doc.text('Relatório Financeiro', margin, y);
      y += 10;
      
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text(monthName.charAt(0).toUpperCase() + monthName.slice(1), margin, y);
      y += 15;

      doc.setFontSize(14);
      doc.setTextColor(51, 51, 51);
      doc.text('Resumo Mensal', margin, y);
      y += 8;

      doc.setFontSize(11);
      doc.setTextColor(80, 80, 80);
      doc.text(`Faturamento Total: R$ ${netRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin, y);
      y += 6;
      doc.text(`Receita Clínicas: R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin, y);
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
      doc.text(`Faltas Remuneradas: ${paidAbsenceEvolutions.length}`, margin, y);
      y += 6;
      doc.text(`Faltas: ${absentEvolutions.length}`, margin, y);
      y += 15;

      if (clinicStats.length > 0) {
        doc.setFontSize(14);
        doc.setTextColor(51, 51, 51);
        doc.text('Faturamento por Clínica', margin, y);
        y += 10;

        doc.setFontSize(10);
        clinicStats.forEach(({ clinic, patientCount, revenue, loss, sessions, paidAbsences, absences }) => {
          if (y > 270) { doc.addPage(); y = 20; }
          const netClinicRevenue = revenue - loss;
          doc.setTextColor(51, 51, 51);
          doc.text(clinic.name, margin, y);
          doc.setTextColor(80, 80, 80);
          doc.text(`R$ ${netClinicRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, pageWidth - margin - 40, y);
          y += 5;
          doc.setFontSize(9);
          doc.text(`${patientCount} pacientes | ${sessions} sessões | ${paidAbsences} faltas rem. | ${absences} faltas`, margin + 5, y);
          doc.setFontSize(10);
          y += 8;
        });
        y += 5;
      }

      if (privateRevenue > 0) {
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFontSize(14);
        doc.setTextColor(51, 51, 51);
        doc.text('Atendimentos Particulares', margin, y);
        y += 8;
        doc.setFontSize(10);
        doc.setTextColor(80, 80, 80);
        doc.text(`${monthlyPrivateAppointments.filter(a => a.status === 'concluído').length} atendimentos concluídos`, margin, y);
        y += 5;
        doc.text(`R$ ${privateRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin, y);
        y += 15;
      }

      if (patientStats.length > 0) {
        if (y > 200) { doc.addPage(); y = 20; }
        doc.setFontSize(14);
        doc.setTextColor(51, 51, 51);
        doc.text('Detalhamento por Paciente', margin, y);
        y += 10;

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
          if (y > 275) { doc.addPage(); y = 20; }
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

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')} | Página ${i} de ${pageCount}`,
          pageWidth / 2, 290, { align: 'center' }
        );
      }

      doc.save(`financeiro-${format(selectedDate, 'yyyy-MM')}.pdf`);
      toast.success('Relatório exportado com sucesso!');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Erro ao exportar relatório');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportClinicInvoice = async () => {
    if (!invoiceClinicId) {
      toast.error('Selecione uma clínica');
      return;
    }
    setIsExportingInvoice(true);
    try {
      const clinic = clinics.find(c => c.id === invoiceClinicId);
      if (!clinic) throw new Error('Clínica não encontrada');

      const clinicPatients = patients.filter(p => p.clinicId === clinic.id);
      const clinicEvolutions = monthlyEvolutions.filter(e =>
        clinicPatients.some(p => p.id === e.patientId)
      ).sort((a, b) => a.date.localeCompare(b.date));

      const stamp = selectedStampId && selectedStampId !== 'none' ? stamps.find(s => s.id === selectedStampId) : null;
      const therapistName = profile?.name || user?.user_metadata?.full_name || 'Terapeuta';

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const contentW = pageWidth - margin * 2;
      let y = 20;

      const ensureSpace = (needed: number) => {
        if (y + needed > 275) { doc.addPage(); y = 20; }
      };

      // Header
      doc.setFontSize(16);
      doc.setTextColor(51, 51, 51);
      doc.text('EXTRATO DE ATENDIMENTOS', pageWidth / 2, y, { align: 'center' });
      y += 8;
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(monthName.charAt(0).toUpperCase() + monthName.slice(1), pageWidth / 2, y, { align: 'center' });
      y += 12;

      // Clinic info
      doc.setDrawColor(180, 180, 180);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;
      doc.setFontSize(11);
      doc.setTextColor(51, 51, 51);
      doc.setFont('helvetica', 'bold');
      doc.text('DADOS DA CLÍNICA', margin, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      doc.text(`Clínica: ${clinic.name.trim()}`, margin, y); y += 5;
      if (clinic.cnpj) { doc.text(`CNPJ: ${clinic.cnpj}`, margin, y); y += 5; }
      if (clinic.address) { doc.text(`Endereço: ${clinic.address}`, margin, y); y += 5; }
      if (clinic.phone) { doc.text(`Telefone: ${clinic.phone}`, margin, y); y += 5; }
      if (clinic.email) { doc.text(`E-mail: ${clinic.email}`, margin, y); y += 5; }
      y += 3;

      // Therapist info
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(51, 51, 51);
      doc.text('PROFISSIONAL', margin, y); y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      doc.text(`Nome: ${therapistName}`, margin, y); y += 5;
      if (stamp) {
        doc.text(`Área: ${stamp.clinical_area}`, margin, y); y += 5;
      }
      if (profile?.professional_id) {
        doc.text(`Registro: ${profile.professional_id}`, margin, y); y += 5;
      }
      y += 3;
      doc.setDrawColor(180, 180, 180);
      doc.line(margin, y, pageWidth - margin, y);
      y += 8;

      // Session table
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(51, 51, 51);
      doc.text('DETALHAMENTO DE SESSÕES', margin, y);
      y += 8;

      // Table header
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      const col1 = margin;
      const col2 = margin + 25;
      const col3 = margin + 80;
      const col4 = margin + 115;
      const col5 = pageWidth - margin - 25;
      doc.text('Data', col1, y);
      doc.text('Paciente', col2, y);
      doc.text('Status', col3, y);
      doc.text('Tipo Pgto', col4, y);
      doc.text('Valor', col5, y);
      y += 3;
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y, pageWidth - margin, y);
      y += 5;

      let totalSessions = 0;
      let totalPaidAbsences = 0;
      let totalAbsences = 0;
      let totalInvoiceValue = 0;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);

      clinicEvolutions.forEach(evo => {
        ensureSpace(8);
        const patient = clinicPatients.find(p => p.id === evo.patientId);
        if (!patient) return;

        const dateStr = format(new Date(evo.date + 'T12:00:00'), 'dd/MM/yyyy');
        const patientName = patient.name.substring(0, 22);
        
        let statusLabel = '';
        let sessionValue = 0;

        if (evo.attendanceStatus === 'presente') {
          statusLabel = 'Presente';
          totalSessions++;
          if (patient.paymentType === 'sessao' && patient.paymentValue) {
            sessionValue = patient.paymentValue;
          }
        } else if (evo.attendanceStatus === 'falta_remunerada') {
          statusLabel = 'Falta Rem.';
          totalPaidAbsences++;
          if (patient.paymentType === 'sessao' && patient.paymentValue) {
            sessionValue = patient.paymentValue;
          }
        } else if (evo.attendanceStatus === 'falta') {
          statusLabel = 'Falta';
          totalAbsences++;
          const absenceType = clinic.absencePaymentType || (clinic.paysOnAbsence === false ? 'never' : 'always');
          if (patient.paymentType === 'sessao' && patient.paymentValue) {
            if (absenceType === 'always') {
              sessionValue = patient.paymentValue;
            } else if (absenceType === 'confirmed_only' && evo.confirmedAttendance) {
              sessionValue = patient.paymentValue;
            }
          }
        }

        totalInvoiceValue += sessionValue;

        doc.setTextColor(51, 51, 51);
        doc.text(dateStr, col1, y);
        doc.text(patientName, col2, y);
        
        if (evo.attendanceStatus === 'presente') {
          doc.setTextColor(34, 139, 34);
        } else if (evo.attendanceStatus === 'falta_remunerada') {
          doc.setTextColor(200, 150, 0);
        } else {
          doc.setTextColor(220, 53, 69);
        }
        doc.text(statusLabel, col3, y);
        
        doc.setTextColor(80, 80, 80);
        doc.text(patient.paymentType === 'fixo' ? 'Fixo' : 'Sessão', col4, y);
        doc.text(sessionValue > 0 ? `R$ ${sessionValue.toFixed(2)}` : '-', col5, y);
        y += 6;
      });

      // Add fixed-payment patients
      const fixedPatients = clinicPatients.filter(p => p.paymentType === 'fixo' && p.paymentValue);
      fixedPatients.forEach(patient => {
        ensureSpace(8);
        doc.setTextColor(51, 51, 51);
        doc.text('-', col1, y);
        doc.text(patient.name.substring(0, 22), col2, y);
        doc.setTextColor(100, 100, 200);
        doc.text('Fixo Mensal', col3, y);
        doc.setTextColor(80, 80, 80);
        doc.text('Fixo', col4, y);
        doc.text(`R$ ${patient.paymentValue!.toFixed(2)}`, col5, y);
        totalInvoiceValue += patient.paymentValue!;
        y += 6;
      });

      // Totals
      y += 2;
      ensureSpace(25);
      doc.setDrawColor(180, 180, 180);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(51, 51, 51);
      doc.text('RESUMO', margin, y); y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Sessões realizadas: ${totalSessions}`, margin, y); y += 5;
      if (totalPaidAbsences > 0) {
        doc.text(`Faltas remuneradas: ${totalPaidAbsences}`, margin, y); y += 5;
      }
      if (totalAbsences > 0) {
        doc.text(`Faltas: ${totalAbsences}`, margin, y); y += 5;
      }
      y += 3;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(`VALOR TOTAL: R$ ${totalInvoiceValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin, y);
      y += 15;

      // Signature area
      ensureSpace(60);
      doc.setDrawColor(180, 180, 180);
      doc.line(margin, y, pageWidth - margin, y);
      y += 8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      doc.text(`Data: ${format(new Date(), 'dd/MM/yyyy')}`, margin, y);
      y += 15;

      const centerX = pageWidth / 2;
      const lineWidth = contentW * 0.5;
      const lineStartX = centerX - lineWidth / 2;

      if (stamp?.stamp_image) {
        try {
          doc.addImage(stamp.stamp_image, 'PNG', centerX - 25, y - 15, 50, 25);
          y += 15;
        } catch (e) { /* ignore */ }
      }

      if (stamp?.signature_image) {
        try {
          doc.addImage(stamp.signature_image, 'PNG', centerX - 25, y - 5, 50, 20);
          y += 10;
        } catch (e) { /* ignore */ }
      }

      doc.setDrawColor(100, 100, 100);
      doc.line(lineStartX, y + 10, lineStartX + lineWidth, y + 10);
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text(therapistName, centerX, y + 15, { align: 'center' });
      if (stamp) {
        doc.text(stamp.clinical_area, centerX, y + 20, { align: 'center' });
      }

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Extrato gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')} | Página ${i} de ${pageCount}`,
          pageWidth / 2, 290, { align: 'center' }
        );
      }

      doc.save(`extrato-${clinic.name.trim().replace(/\s+/g, '-').toLowerCase()}-${format(selectedDate, 'yyyy-MM')}.pdf`);
      toast.success('Extrato exportado com sucesso!');
      setInvoiceDialogOpen(false);
    } catch (error) {
      console.error('Error exporting invoice:', error);
      toast.error('Erro ao exportar extrato');
    } finally {
      setIsExportingInvoice(false);
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
        
        {/* Month selector */}
        <div className="flex items-center gap-2 mt-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToPreviousMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <button 
            onClick={goToCurrentMonth}
            className={cn(
              "text-sm sm:text-base font-medium px-3 py-1 rounded-lg transition-colors capitalize",
              isCurrentMonth ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {monthName}
          </button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToNextMonth} disabled={isCurrentMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          {!isCurrentMonth && (
            <Button variant="ghost" size="sm" className="text-xs text-primary" onClick={goToCurrentMonth}>
              Mês atual
            </Button>
          )}
        </div>
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
                {paidAbsenceEvolutions.length > 0 && (
                  <span className="flex items-center gap-1 sm:gap-2 text-amber-200">
                    {paidAbsenceEvolutions.length} faltas rem.
                  </span>
                )}
                {absentEvolutions.length > 0 && (
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
          {clinicStats.map(({ clinic, patientCount, revenue, loss, sessions, paidAbsences, absences }) => {
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
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {patientCount} pacientes | {sessions} sessões
                      {paidAbsences > 0 && ` | ${paidAbsences} faltas rem.`}
                    </p>
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
                  <p className="text-sm text-muted-foreground">{monthlyPrivateAppointments.filter(a => a.status === 'concluído').length} atendimentos concluídos</p>
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
          <div className="flex flex-col sm:flex-row gap-2">
            <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2 w-full sm:w-auto text-xs sm:text-sm">
                  <FileText className="w-4 h-4" />
                  Extrato por Clínica
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Emitir Extrato de Atendimentos</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">Clínica</label>
                    <Select value={invoiceClinicId} onValueChange={setInvoiceClinicId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a clínica" />
                      </SelectTrigger>
                      <SelectContent>
                        {clinics.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">Carimbo (opcional)</label>
                    <Select value={selectedStampId} onValueChange={setSelectedStampId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sem carimbo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem carimbo</SelectItem>
                        {stamps.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name} - {s.clinical_area}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    O extrato incluirá todas as sessões de <strong className="capitalize">{monthName}</strong> com detalhamento por paciente, valores e totais.
                  </p>
                  <Button 
                    onClick={handleExportClinicInvoice} 
                    disabled={isExportingInvoice || !invoiceClinicId}
                    className="w-full gap-2"
                  >
                    {isExportingInvoice ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    {isExportingInvoice ? 'Gerando...' : 'Exportar Extrato PDF'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
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
              {isExporting ? 'Exportando...' : 'Relatório Geral PDF'}
            </Button>
          </div>
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
              {patientStats.map(({ patient, clinic, revenue, loss, sessions, paidAbsences, absences, paymentType, paymentValue }) => {
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
                    <td className="py-2 sm:py-3 px-2 text-center text-foreground text-xs sm:text-sm">
                      {sessions}
                      {paidAbsences > 0 && (
                        <span className="text-amber-600 text-[10px] block">+{paidAbsences} rem.</span>
                      )}
                    </td>
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
