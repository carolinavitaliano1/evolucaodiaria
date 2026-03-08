import { Building2, Users, DollarSign, TrendingUp, TrendingDown, Filter, Download, AlertTriangle, Briefcase, Loader2, FileText, Stamp, ChevronLeft, ChevronRight, Stethoscope, CalendarCheck, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { TeamFinancialReport } from '@/components/clinics/TeamFinancialReport';
import { useClinicOrg } from '@/hooks/useClinicOrg';
import { format, subMonths, addMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
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
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type PaymentStatusFilter = 'all' | 'paid' | 'pending';

export default function Financial() {
  const { clinics, patients, evolutions, payments, clinicPackages, loadAllEvolutions } = useApp();
  const { getMonthlyAppointments } = usePrivateAppointments();
  const { user } = useAuth();

  useEffect(() => {
    if (user) loadAllEvolutions();
  }, [user]);

  const [isExporting, setIsExporting] = useState(false);
  const [isExportingInvoice, setIsExportingInvoice] = useState(false);
  const [invoiceClinicId, setInvoiceClinicId] = useState<string>('');
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [stamps, setStamps] = useState<any[]>([]);
  const [selectedStampId, setSelectedStampId] = useState<string>('');
  const [profile, setProfile] = useState<any>(null);
  const [invoiceStartDate, setInvoiceStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [invoiceEndDate, setInvoiceEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  const [selectedDate, setSelectedDate] = useState(new Date());
  const selectedMonth = selectedDate.getMonth();
  const selectedYear = selectedDate.getFullYear();
  const monthName = format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR });

  // Filters
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatusFilter>('all');
  const [tableStartDate, setTableStartDate] = useState('');
  const [tableEndDate, setTableEndDate] = useState('');

  // Patient payment records keyed by patient_id
  const [patientPaymentRecords, setPatientPaymentRecords] = useState<Record<string, any>>({});
  const [savingPatientPayment, setSavingPatientPayment] = useState<string | null>(null);

  const goToPreviousMonth = () => setSelectedDate(prev => {
    const d = subMonths(prev, 1);
    setInvoiceStartDate(format(startOfMonth(d), 'yyyy-MM-dd'));
    setInvoiceEndDate(format(endOfMonth(d), 'yyyy-MM-dd'));
    return d;
  });
  const goToNextMonth = () => setSelectedDate(prev => {
    const d = addMonths(prev, 1);
    setInvoiceStartDate(format(startOfMonth(d), 'yyyy-MM-dd'));
    setInvoiceEndDate(format(endOfMonth(d), 'yyyy-MM-dd'));
    return d;
  });
  const goToCurrentMonth = () => {
    const d = new Date();
    setSelectedDate(d);
    setInvoiceStartDate(format(startOfMonth(d), 'yyyy-MM-dd'));
    setInvoiceEndDate(format(endOfMonth(d), 'yyyy-MM-dd'));
  };

  const isCurrentMonth = selectedMonth === new Date().getMonth() && selectedYear === new Date().getFullYear();

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

  // Load patient payment records for selected month
  useEffect(() => {
    if (!user) return;
    const m = selectedDate.getMonth() + 1;
    const y = selectedDate.getFullYear();
    supabase
      .from('patient_payment_records' as any)
      .select('*')
      .eq('user_id', user.id)
      .eq('month', m)
      .eq('year', y)
      .then(({ data }) => {
        if (data) {
          const map: Record<string, any> = {};
          (data as any[]).forEach(r => { map[r.patient_id] = r; });
          setPatientPaymentRecords(map);
        }
      });
  }, [selectedDate, user]);

  const monthlyEvolutions = evolutions.filter(e => {
    const date = new Date(e.date + 'T12:00:00');
    return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
  });

  const presentEvolutions = monthlyEvolutions.filter(e => e.attendanceStatus === 'presente' || e.attendanceStatus === 'reposicao');
  const absentEvolutions = monthlyEvolutions.filter(e => e.attendanceStatus === 'falta');
  const paidAbsenceEvolutions = monthlyEvolutions.filter(e => e.attendanceStatus === 'falta_remunerada');
  const reposicaoEvolutions = monthlyEvolutions.filter(e => e.attendanceStatus === 'reposicao');
  const feriadoRemEvolutions = monthlyEvolutions.filter(e => e.attendanceStatus === 'feriado_remunerado');
  const feriadoNaoRemEvolutions = monthlyEvolutions.filter(e => e.attendanceStatus === 'feriado_nao_remunerado');

  const calculatePatientRevenue = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    if (!patient || !patient.paymentValue) return 0;
    if (patient.paymentType === 'fixo') return patient.paymentValue;
    const presentCount = presentEvolutions.filter(e => e.patientId === patientId).length;
    const paidAbsenceCount = paidAbsenceEvolutions.filter(e => e.patientId === patientId).length;
    const feriadoRemCount = feriadoRemEvolutions.filter(e => e.patientId === patientId).length;
    const clinic = clinics.find(c => c.id === patient.clinicId);
    const absenceType = clinic?.absencePaymentType || (clinic?.paysOnAbsence === false ? 'never' : 'always');
    let paidRegularAbsences = 0;
    const regularAbsences = absentEvolutions.filter(e => e.patientId === patientId);
    if (absenceType === 'always') paidRegularAbsences = regularAbsences.length;
    else if (absenceType === 'confirmed_only') paidRegularAbsences = regularAbsences.filter(e => e.confirmedAttendance).length;
    return (presentCount + paidAbsenceCount + paidRegularAbsences + feriadoRemCount) * patient.paymentValue;
  };

  const calculatePatientLoss = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    if (!patient || !patient.paymentValue || patient.paymentType === 'fixo') return 0;
    const clinic = clinics.find(c => c.id === patient.clinicId);
    const absenceType = clinic?.absencePaymentType || (clinic?.paysOnAbsence === false ? 'never' : 'always');
    if (absenceType === 'always') return 0;
    const patientAbsences = absentEvolutions.filter(e => e.patientId === patientId);
    if (absenceType === 'never') return patientAbsences.length * patient.paymentValue;
    if (absenceType === 'confirmed_only') {
      const nonConfirmedAbsences = patientAbsences.filter(e => !e.confirmedAttendance);
      return nonConfirmedAbsences.length * patient.paymentValue;
    }
    return 0;
  };

  const monthlyPrivateAppointments = getMonthlyAppointments(selectedMonth, selectedYear);
  const linkedServiceAppointments = monthlyPrivateAppointments.filter(a => a.clinic_id);
  const standaloneServiceAppointments = monthlyPrivateAppointments.filter(a => !a.clinic_id);

  const standaloneRevenue = standaloneServiceAppointments
    .filter(a => a.status === 'concluído')
    .reduce((sum, a) => sum + (a.price || 0), 0);

  const privateRevenue = monthlyPrivateAppointments
    .filter(a => a.status === 'concluído')
    .reduce((sum, a) => sum + (a.price || 0), 0);

  const propriaClinics = clinics.filter(c => c.type === 'propria' && !c.isArchived);
  const contratanteClinics = clinics.filter(c => c.type !== 'propria' && !c.isArchived);

  const revenueByClinicType = (type: 'propria' | 'contratante') => {
    const targetClinics = type === 'propria' ? propriaClinics : contratanteClinics;
    return targetClinics.reduce((sum, clinic) => {
      const clinicPatients = patients.filter(p => p.clinicId === clinic.id);
      const patientsRevenue = clinicPatients.reduce((s, p) => s + calculatePatientRevenue(p.id), 0);
      const clinicServicesRevenue = linkedServiceAppointments
        .filter(a => a.clinic_id === clinic.id && a.status === 'concluído')
        .reduce((s, a) => s + (a.price || 0), 0);
      return sum + patientsRevenue + clinicServicesRevenue;
    }, 0);
  };

  const revenuePropriaClinicas = revenueByClinicType('propria');
  const revenueContratante = revenueByClinicType('contratante');
  const totalRevenue = patients.reduce((sum, p) => sum + calculatePatientRevenue(p.id), 0);
  const totalLoss = patients.reduce((sum, p) => sum + calculatePatientLoss(p.id), 0);
  const linkedServicesRevenue = linkedServiceAppointments
    .filter(a => a.status === 'concluído')
    .reduce((sum, a) => sum + (a.price || 0), 0);
  const netRevenue = totalRevenue + linkedServicesRevenue + standaloneRevenue;

  const clinicStats = clinics.map(clinic => {
    const clinicPatients = patients.filter(p => p.clinicId === clinic.id);
    const revenue = clinicPatients.reduce((sum, p) => sum + calculatePatientRevenue(p.id), 0);
    const loss = clinicPatients.reduce((sum, p) => sum + calculatePatientLoss(p.id), 0);
    const sessions = presentEvolutions.filter(e => clinicPatients.some(p => p.id === e.patientId)).length;
    const paidAbsences = paidAbsenceEvolutions.filter(e => clinicPatients.some(p => p.id === e.patientId)).length;
    const absences = absentEvolutions.filter(e => clinicPatients.some(p => p.id === e.patientId)).length;
    return { clinic, patientCount: clinicPatients.length, revenue, loss, sessions, paidAbsences, absences };
  });

  const allPatientStats = patients.map(patient => {
    const clinic = clinics.find(c => c.id === patient.clinicId);
    const revenue = calculatePatientRevenue(patient.id);
    const loss = calculatePatientLoss(patient.id);
    const sessions = presentEvolutions.filter(e => e.patientId === patient.id).length;
    const paidAbsences = paidAbsenceEvolutions.filter(e => e.patientId === patient.id).length;
    const absences = absentEvolutions.filter(e => e.patientId === patient.id).length;
    const pr = patientPaymentRecords[patient.id];
    return { patient, clinic, revenue, loss, sessions, paidAbsences, absences, paymentType: patient.paymentType, paymentValue: patient.paymentValue || 0, pr };
  }).filter(p => p.paymentValue > 0);

  // Apply filters
  const patientStats = allPatientStats.filter(({ pr, patient }) => {
    // Status filter
    if (paymentStatusFilter === 'paid' && !pr?.paid) return false;
    if (paymentStatusFilter === 'pending' && pr?.paid) return false;
    // Period filter on payment_date
    if (tableStartDate && pr?.payment_date && pr.payment_date < tableStartDate) return false;
    if (tableEndDate && pr?.payment_date && pr.payment_date > tableEndDate) return false;
    // If filtering by date range and patient has no payment_date, hide when filter is active
    if ((tableStartDate || tableEndDate) && paymentStatusFilter === 'paid' && !pr?.payment_date) return false;
    return true;
  });

  const handleTogglePatientPayment = async (patientId: string, currentPr: any, revenue: number) => {
    if (!user) return;
    setSavingPatientPayment(patientId);
    const m = selectedDate.getMonth() + 1;
    const y = selectedDate.getFullYear();
    const newPaid = !currentPr?.paid;
    const newDate = newPaid ? new Date().toISOString().split('T')[0] : null;
    try {
      if (currentPr?.id) {
        await supabase.from('patient_payment_records' as any).update({ paid: newPaid, payment_date: newDate }).eq('id', currentPr.id);
        setPatientPaymentRecords(prev => ({ ...prev, [patientId]: { ...currentPr, paid: newPaid, payment_date: newDate } }));
      } else {
        const { data } = await supabase.from('patient_payment_records' as any).insert({
          user_id: user.id, patient_id: patientId, clinic_id: patients.find(p => p.id === patientId)?.clinicId, month: m, year: y, amount: revenue, paid: newPaid, payment_date: newDate
        }).select().maybeSingle();
        setPatientPaymentRecords(prev => ({ ...prev, [patientId]: data }));
      }
    } finally {
      setSavingPatientPayment(null);
    }
  };

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
      if (paymentStatusFilter !== 'all') {
        doc.setFontSize(10);
        doc.text(`Filtro: ${paymentStatusFilter === 'paid' ? 'Apenas Pagos' : 'Apenas Pendentes'}`, margin + 80, y);
      }
      y += 15;

      doc.setFontSize(14);
      doc.setTextColor(51, 51, 51);
      doc.text('Resumo Mensal', margin, y);
      y += 8;

      doc.setFontSize(11);
      doc.setTextColor(80, 80, 80);
      doc.text(`Faturamento Total: R$ ${netRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin, y); y += 6;
      doc.text(`Receita Clínicas Próprias: R$ ${revenuePropriaClinicas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin, y); y += 6;
      doc.text(`Receita Contratante: R$ ${revenueContratante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin, y); y += 6;
      doc.text(`Serviços Particulares: R$ ${standaloneRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin, y); y += 6;
      if (totalLoss > 0) {
        doc.setTextColor(220, 53, 69);
        doc.text(`Perdas por Faltas: - R$ ${totalLoss.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin, y);
        doc.setTextColor(80, 80, 80);
      }
      y += 6;
      doc.text(`Total de Atendimentos: ${presentEvolutions.length}`, margin, y); y += 6;
      doc.text(`Faltas Remuneradas: ${paidAbsenceEvolutions.length}`, margin, y); y += 6;
      doc.text(`Faltas: ${absentEvolutions.length}`, margin, y); y += 15;

      if (clinicStats.length > 0) {
        doc.setFontSize(14);
        doc.setTextColor(51, 51, 51);
        doc.text('Faturamento por Clínica', margin, y);
        y += 10;
        doc.setFontSize(10);
        clinicStats.forEach(({ clinic, patientCount, revenue, loss, sessions, paidAbsences, absences }) => {
          if (y > 270) { doc.addPage(); y = 20; }
          doc.setTextColor(51, 51, 51);
          doc.text(`${clinic.name} (${clinic.type === 'propria' ? 'Própria' : 'Contratante'})`, margin, y);
          doc.setTextColor(80, 80, 80);
          doc.text(`R$ ${revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, pageWidth - margin - 40, y);
          y += 5;
          doc.setFontSize(9);
          doc.text(`${patientCount} pacientes | ${sessions} sessões | ${paidAbsences} faltas rem. | ${absences} faltas`, margin + 5, y);
          doc.setFontSize(10);
          y += 8;
        });
        y += 5;
      }

      if (standaloneRevenue > 0) {
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFontSize(14);
        doc.setTextColor(51, 51, 51);
        doc.text('Serviços Particulares (fora de clínica)', margin, y);
        y += 8;
        doc.setFontSize(10);
        doc.setTextColor(80, 80, 80);
        doc.text(`${standaloneServiceAppointments.filter(a => a.status === 'concluído').length} atendimentos concluídos`, margin, y); y += 5;
        doc.text(`R$ ${standaloneRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin, y);
        y += 15;
      }

      if (patientStats.length > 0) {
        if (y > 200) { doc.addPage(); y = 20; }
        doc.setFontSize(14);
        doc.setTextColor(51, 51, 51);
        doc.text('Controle de Pagamentos por Paciente', margin, y);
        y += 10;
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        // Headers with payment columns
        const col1 = margin, col2 = margin + 42, col3 = margin + 82, col4 = margin + 105, col5 = margin + 127, col6 = pageWidth - margin - 18;
        doc.text('Paciente', col1, y);
        doc.text('Clínica', col2, y);
        doc.text('Tipo', col3, y);
        doc.text('Sess.', col4, y);
        doc.text('Status Pgto', col5, y);
        doc.text('Valor', col6, y, { align: 'right' });
        y += 3;
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, y, pageWidth - margin, y);
        y += 5;
        doc.setFontSize(8);

        let totalPaid = 0, totalPending = 0;
        patientStats.forEach(({ patient, clinic, revenue, sessions, paymentType, paymentValue, pr }) => {
          if (y > 275) { doc.addPage(); y = 20; }
          doc.setTextColor(51, 51, 51);
          doc.text(patient.name.substring(0, 18), col1, y);
          doc.setTextColor(80, 80, 80);
          doc.text((clinic?.name || '').substring(0, 14), col2, y);
          doc.text(paymentType === 'fixo' ? 'Fixo' : 'Sessão', col3, y);
          doc.text(sessions.toString(), col4, y);
          // Payment status
          if (pr?.paid) {
            doc.setTextColor(34, 139, 34);
            doc.text(`Pago${pr.payment_date ? ' ' + format(new Date(pr.payment_date + 'T00:00:00'), 'dd/MM') : ''}`, col5, y);
            totalPaid += revenue;
          } else {
            doc.setTextColor(200, 100, 0);
            doc.text('Pendente', col5, y);
            totalPending += revenue;
          }
          doc.setTextColor(51, 51, 51);
          doc.text(`R$ ${revenue.toFixed(2)}`, col6, y, { align: 'right' });
          y += 6;
        });

        // Summary footer
        if (y > 270) { doc.addPage(); y = 20; }
        y += 3;
        doc.setDrawColor(180, 180, 180);
        doc.line(margin, y, pageWidth - margin, y);
        y += 5;
        doc.setFontSize(9);
        doc.setTextColor(34, 139, 34);
        doc.text(`✓ Total Pago: R$ ${totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin, y); y += 5;
        doc.setTextColor(200, 100, 0);
        doc.text(`⏳ Total Pendente: R$ ${totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin, y);
      }

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')} | Página ${i} de ${pageCount}`, pageWidth / 2, 290, { align: 'center' });
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
    if (!invoiceClinicId) { toast.error('Selecione uma clínica'); return; }
    setIsExportingInvoice(true);
    try {
      const clinic = clinics.find(c => c.id === invoiceClinicId);
      if (!clinic) throw new Error('Clínica não encontrada');
      const clinicPatients = patients.filter(p => p.clinicId === clinic.id);
      const useCustomRange = invoiceStartDate && invoiceEndDate;
      const rangeStart = useCustomRange ? invoiceStartDate : format(startOfMonth(selectedDate), 'yyyy-MM-dd');
      const rangeEnd = useCustomRange ? invoiceEndDate : format(endOfMonth(selectedDate), 'yyyy-MM-dd');
      const clinicEvolutions = evolutions.filter(e => {
        if (!clinicPatients.some(p => p.id === e.patientId)) return false;
        return e.date >= rangeStart && e.date <= rangeEnd;
      }).sort((a, b) => a.date.localeCompare(b.date));
      const periodLabel = useCustomRange
        ? `${format(parseISO(invoiceStartDate), 'dd/MM/yyyy')} a ${format(parseISO(invoiceEndDate), 'dd/MM/yyyy')}`
        : monthName.charAt(0).toUpperCase() + monthName.slice(1);
      const stamp = selectedStampId && selectedStampId !== 'none' ? stamps.find(s => s.id === selectedStampId) : null;
      const therapistName = profile?.name || user?.user_metadata?.full_name || 'Terapeuta';

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const contentW = pageWidth - margin * 2;
      let y = 20;
      const ensureSpace = (needed: number) => { if (y + needed > 275) { doc.addPage(); y = 20; } };

      doc.setFontSize(16);
      doc.setTextColor(51, 51, 51);
      doc.text('EXTRATO DE ATENDIMENTOS', pageWidth / 2, y, { align: 'center' });
      y += 8;
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(periodLabel, pageWidth / 2, y, { align: 'center' });
      y += 12;

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

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(51, 51, 51);
      doc.text('PROFISSIONAL', margin, y); y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      doc.text(`Nome: ${therapistName}`, margin, y); y += 5;
      if (stamp) { doc.text(`Área: ${stamp.clinical_area}`, margin, y); y += 5; }
      if (profile?.professional_id) { doc.text(`Registro: ${profile.professional_id}`, margin, y); y += 5; }
      y += 3;
      doc.setDrawColor(180, 180, 180);
      doc.line(margin, y, pageWidth - margin, y);
      y += 8;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(51, 51, 51);
      doc.text('DETALHAMENTO DE SESSÕES', margin, y);
      y += 8;

      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      const col1 = margin, col2 = margin + 25, col3 = margin + 80, col4 = margin + 115, col5 = pageWidth - margin - 25;
      doc.text('Data', col1, y);
      doc.text('Paciente', col2, y);
      doc.text('Status', col3, y);
      doc.text('Tipo Pgto', col4, y);
      doc.text('Valor', col5, y);
      y += 3;
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y, pageWidth - margin, y);
      y += 5;

      let totalSessions = 0, totalPaidAbsences = 0, totalAbsences = 0, totalInvoiceValue = 0;
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

        if (evo.attendanceStatus === 'presente' || evo.attendanceStatus === 'reposicao') {
          statusLabel = evo.attendanceStatus === 'reposicao' ? 'Reposição' : 'Presente';
          totalSessions++;
          if (patient.paymentType === 'sessao' && patient.paymentValue) sessionValue = patient.paymentValue;
        } else if (evo.attendanceStatus === 'falta_remunerada') {
          statusLabel = 'Falta Rem.';
          totalPaidAbsences++;
          if (patient.paymentType === 'sessao' && patient.paymentValue) sessionValue = patient.paymentValue;
        } else if (evo.attendanceStatus === 'feriado_remunerado') {
          statusLabel = 'Feriado Rem.';
          if (patient.paymentType === 'sessao' && patient.paymentValue) sessionValue = patient.paymentValue;
        } else if (evo.attendanceStatus === 'feriado_nao_remunerado') {
          statusLabel = 'Feriado';
        } else if (evo.attendanceStatus === 'falta') {
          statusLabel = 'Falta';
          totalAbsences++;
          const absenceType = clinic.absencePaymentType || (clinic.paysOnAbsence === false ? 'never' : 'always');
          if (patient.paymentType === 'sessao' && patient.paymentValue) {
            if (absenceType === 'always') sessionValue = patient.paymentValue;
            else if (absenceType === 'confirmed_only' && evo.confirmedAttendance) sessionValue = patient.paymentValue;
          }
        }

        totalInvoiceValue += sessionValue;
        doc.setTextColor(51, 51, 51);
        doc.text(dateStr, col1, y);
        doc.text(patientName, col2, y);
        if (evo.attendanceStatus === 'presente' || evo.attendanceStatus === 'reposicao' || evo.attendanceStatus === 'feriado_remunerado') doc.setTextColor(34, 139, 34);
        else if (evo.attendanceStatus === 'falta_remunerada') doc.setTextColor(200, 150, 0);
        else if (evo.attendanceStatus === 'feriado_nao_remunerado') doc.setTextColor(100, 100, 100);
        else doc.setTextColor(220, 53, 69);
        doc.text(statusLabel, col3, y);
        doc.setTextColor(80, 80, 80);
        doc.text(patient.paymentType === 'fixo' ? 'Fixo' : 'Sessão', col4, y);
        doc.text(sessionValue > 0 ? `R$ ${sessionValue.toFixed(2)}` : '-', col5, y);
        y += 6;
      });

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
      if (totalPaidAbsences > 0) { doc.text(`Faltas remuneradas: ${totalPaidAbsences}`, margin, y); y += 5; }
      if (totalAbsences > 0) { doc.text(`Faltas: ${totalAbsences}`, margin, y); y += 5; }
      y += 3;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(`VALOR BRUTO: R$ ${totalInvoiceValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin, y);

      const discountPct = clinic.discountPercentage || 0;
      if (discountPct > 0) {
        y += 7;
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`Desconto da clínica: ${discountPct}%`, margin, y);
        y += 7;
        const netValue = totalInvoiceValue * (1 - discountPct / 100);
        doc.setFontSize(12);
        doc.setTextColor(34, 139, 34);
        doc.text(`VALOR LÍQUIDO: R$ ${netValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin, y);
      }
      y += 15;

      // Payment status section in invoice
      const invoicePatientPayments = clinicPatients.map(p => ({
        patient: p,
        pr: patientPaymentRecords[p.id],
        revenue: calculatePatientRevenue(p.id),
      })).filter(r => r.revenue > 0);

      if (invoicePatientPayments.length > 0) {
        ensureSpace(20 + invoicePatientPayments.length * 7);
        doc.setDrawColor(180, 180, 180);
        doc.line(margin, y, pageWidth - margin, y);
        y += 6;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(51, 51, 51);
        doc.text('STATUS DE PAGAMENTO POR PACIENTE', margin, y); y += 7;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        invoicePatientPayments.forEach(({ patient, pr, revenue }) => {
          ensureSpace(7);
          doc.setTextColor(51, 51, 51);
          doc.text(patient.name.substring(0, 28), margin, y);
          if (pr?.paid) {
            doc.setTextColor(34, 139, 34);
            doc.text(`Pago${pr.payment_date ? ' em ' + format(new Date(pr.payment_date + 'T00:00:00'), 'dd/MM/yyyy') : ''}`, margin + 70, y);
          } else {
            doc.setTextColor(200, 100, 0);
            doc.text('Pendente', margin + 70, y);
          }
          doc.setTextColor(80, 80, 80);
          doc.text(`R$ ${revenue.toFixed(2)}`, pageWidth - margin - 5, y, { align: 'right' });
          y += 6;
        });
      }

      ensureSpace(60);
      doc.setDrawColor(180, 180, 180);
      doc.line(margin, y, pageWidth - margin, y);
      y += 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      doc.text(`Data: ${format(new Date(), 'dd/MM/yyyy')}`, margin, y);
      y += 8;

      const centerX = pageWidth / 2;
      const lineWidth = contentW * 0.5;
      const lineStartX = centerX - lineWidth / 2;

      if (stamp?.stamp_image) { try { doc.addImage(stamp.stamp_image, 'PNG', centerX - 25, y, 50, 25); y += 26; } catch (e) {} }
      if (stamp?.signature_image) { try { doc.addImage(stamp.signature_image, 'PNG', centerX - 25, y - 3, 50, 20); y += 17; } catch (e) {} }

      doc.setDrawColor(100, 100, 100);
      doc.line(lineStartX, y, lineStartX + lineWidth, y);
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text(therapistName, centerX, y + 5, { align: 'center' });
      if (stamp) doc.text(stamp.clinical_area, centerX, y + 10, { align: 'center' });

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Extrato gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')} | Página ${i} de ${pageCount}`, pageWidth / 2, 290, { align: 'center' });
      }

      const fileSuffix = useCustomRange ? `${invoiceStartDate}_${invoiceEndDate}` : format(selectedDate, 'yyyy-MM');
      doc.save(`extrato-${clinic.name.trim().replace(/\s+/g, '-').toLowerCase()}-${fileSuffix}.pdf`);
      toast.success('Extrato exportado com sucesso!');
      setInvoiceDialogOpen(false);
    } catch (error) {
      console.error('Error exporting invoice:', error);
      toast.error('Erro ao exportar extrato');
    } finally {
      setIsExportingInvoice(false);
    }
  };

  const grandTotal = totalRevenue + standaloneRevenue;
  const paidTotal = allPatientStats.reduce((sum, { pr, revenue }) => sum + (pr?.paid ? revenue : 0), 0);
  const pendingTotal = allPatientStats.reduce((sum, { pr, revenue }) => sum + (!pr?.paid ? revenue : 0), 0);

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto pb-24">
      {/* Header */}
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
            <span className="text-3xl sm:text-4xl">💰</span>
            Financeiro
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Visão consolidada das suas receitas</p>
        </div>

        {/* Month selector */}
        <div className="flex items-center gap-2 bg-card border border-border rounded-xl p-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToPreviousMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <button
            onClick={goToCurrentMonth}
            className={cn(
              "text-sm font-semibold px-3 py-1 rounded-lg transition-colors capitalize min-w-[140px] text-center",
              isCurrentMonth ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {monthName}
          </button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToNextMonth} disabled={isCurrentMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Hero revenue card */}
      <div className="rounded-2xl sm:rounded-3xl p-6 sm:p-8 gradient-primary shadow-glow mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-primary-foreground/70 text-sm mb-1">Faturamento Total do Mês</p>
            <h2 className="text-3xl sm:text-5xl font-bold text-primary-foreground mb-3 break-words">
              R$ {grandTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </h2>
            <div className="flex flex-wrap gap-2 sm:gap-4 text-primary-foreground/80 text-xs sm:text-sm">
              <span className="flex items-center gap-1.5 bg-primary-foreground/10 px-2.5 py-1 rounded-full">
                <CalendarCheck className="w-3.5 h-3.5" />
                {presentEvolutions.length} atend.
              </span>
              {reposicaoEvolutions.length > 0 && (
                <span className="flex items-center gap-1.5 bg-primary-foreground/10 px-2.5 py-1 rounded-full">
                  🔄 {reposicaoEvolutions.length} repos.
                </span>
              )}
              {paidAbsenceEvolutions.length > 0 && (
                <span className="flex items-center gap-1.5 bg-amber-500/20 px-2.5 py-1 rounded-full text-amber-200">
                  {paidAbsenceEvolutions.length} faltas rem.
                </span>
              )}
              {absentEvolutions.length > 0 && (
                <span className="flex items-center gap-1.5 bg-red-500/20 px-2.5 py-1 rounded-full text-red-200">
                  <TrendingDown className="w-3.5 h-3.5" />
                  {absentEvolutions.length} faltas
                </span>
              )}
            </div>
            {totalLoss > 0 && (
              <p className="text-red-200 text-xs mt-2 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Estimativa de perda por faltas: R$ {totalLoss.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            )}
          </div>
          <DollarSign className="w-14 h-14 sm:w-20 sm:h-20 text-primary-foreground/20 shrink-0" />
        </div>
      </div>

      {/* Revenue breakdown cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 sm:mb-8">
        {/* Receita Contratante */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-blue-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Receita Contratante</p>
              <p className="text-[10px] text-muted-foreground/70">Clínicas terceirizadas</p>
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">
            R$ {revenueContratante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {contratanteClinics.length} {contratanteClinics.length === 1 ? 'clínica' : 'clínicas'}
          </p>
          {grandTotal > 0 && (
            <div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${(revenueContratante / grandTotal) * 100}%` }} />
            </div>
          )}
        </div>

        {/* Receita Clínicas Próprias */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
              <Stethoscope className="w-5 h-5 text-success" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Receita Clínicas Próprias</p>
              <p className="text-[10px] text-muted-foreground/70">Unidades próprias</p>
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">
            R$ {revenuePropriaClinicas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {propriaClinics.length} {propriaClinics.length === 1 ? 'clínica' : 'clínicas'}
          </p>
          {grandTotal > 0 && (
            <div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-success rounded-full transition-all" style={{ width: `${(revenuePropriaClinicas / grandTotal) * 100}%` }} />
            </div>
          )}
        </div>

        {/* Serviços Particulares */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
              <Briefcase className="w-5 h-5 text-amber-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Serviços Particulares</p>
              <p className="text-[10px] text-muted-foreground/70">Agendamentos fora de clínica</p>
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">
            R$ {standaloneRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {standaloneServiceAppointments.filter(a => a.status === 'concluído').length} atend. concluídos
          </p>
          {grandTotal > 0 && (
            <div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${(standaloneRevenue / grandTotal) * 100}%` }} />
            </div>
          )}
        </div>
      </div>

      {/* Revenue by Clinic */}
      <div className="bg-card rounded-2xl p-5 sm:p-6 border border-border mb-6 sm:mb-8">
        <h2 className="font-bold text-foreground mb-5 flex items-center gap-2 text-sm sm:text-base">
          <Building2 className="w-4 h-4 text-primary" />
          Detalhamento por Clínica
        </h2>

        <div className="space-y-4">
          {clinicStats.map(({ clinic, patientCount, revenue, loss, sessions, paidAbsences, absences }) => {
            const discountPct = clinic.discountPercentage || 0;
            const netAfterDiscount = revenue * (1 - discountPct / 100);
            const percentage = grandTotal > 0 ? (revenue / grandTotal) * 100 : 0;
            const isPropria = clinic.type === 'propria';

            return (
              <div key={clinic.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl bg-secondary/40 border border-border/50">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full font-medium",
                      isPropria ? "bg-success/10 text-success" : "bg-blue-500/10 text-blue-500"
                    )}>
                      {isPropria ? 'Própria' : 'Contratante'}
                    </span>
                    <h3 className="font-semibold text-foreground text-sm truncate">{clinic.name}</h3>
                    {clinic.absencePaymentType === 'never' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Não paga faltas</span>
                    )}
                    {clinic.absencePaymentType === 'confirmed_only' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Paga só confirmados</span>
                    )}
                    {discountPct > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{discountPct}% desc.</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {patientCount} pacientes · {sessions} sessões{paidAbsences > 0 && ` · ${paidAbsences} faltas rem.`}
                  </p>
                  <div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", isPropria ? "gradient-primary" : "bg-blue-500")}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
                <div className="text-left sm:text-right shrink-0">
                  {discountPct > 0 ? (
                    <>
                      <p className="text-xs text-muted-foreground line-through">R$ {revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      <p className="font-bold text-lg text-success">R$ {netAfterDiscount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </>
                  ) : (
                    <p className="font-bold text-lg text-foreground">R$ {revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  )}
                  {loss > 0 && (
                    <p className="text-xs text-destructive flex items-center sm:justify-end gap-1">
                      <AlertTriangle className="w-3 h-3" /> {absences} faltas (-R$ {loss.toFixed(2)})
                    </p>
                  )}
                  {loss === 0 && grandTotal > 0 && (
                    <p className="text-xs text-muted-foreground">{percentage.toFixed(0)}% do total</p>
                  )}
                </div>
              </div>
            );
          })}

          {/* Standalone private services */}
          {standaloneRevenue > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-500/10 text-amber-600">Particular</span>
                  <h3 className="font-semibold text-foreground text-sm">Serviços Particulares</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  {standaloneServiceAppointments.filter(a => a.status === 'concluído').length} atendimentos concluídos · sem vínculo com clínica
                </p>
                <div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${grandTotal > 0 ? (standaloneRevenue / grandTotal) * 100 : 0}%` }} />
                </div>
              </div>
              <div className="text-left sm:text-right shrink-0">
                <p className="font-bold text-lg text-foreground">R$ {standaloneRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                {grandTotal > 0 && <p className="text-xs text-muted-foreground">{((standaloneRevenue / grandTotal) * 100).toFixed(0)}% do total</p>}
              </div>
            </div>
          )}

          {clinicStats.length === 0 && standaloneRevenue === 0 && (
            <p className="text-center text-muted-foreground py-8">Nenhuma clínica cadastrada</p>
          )}
        </div>
      </div>

      {/* Team Financial Reports */}
      {clinics
        .filter(c => !c.isArchived && (c as any).organization_id)
        .map(orgClinic => (
          <div key={orgClinic.id} className="mb-6 sm:mb-8">
            <div className="bg-card rounded-2xl p-5 sm:p-6 border border-border">
              <h2 className="font-bold text-foreground mb-4 flex items-center gap-2 text-sm sm:text-base">
                <Users className="w-4 h-4 text-primary" />
                Equipe — {orgClinic.name}
              </h2>
              <TeamFinancialReport clinicId={orgClinic.id} />
            </div>
          </div>
        ))}

      {/* Payments Table */}
      <div className="bg-card rounded-2xl p-5 sm:p-6 border border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="font-bold text-foreground flex items-center gap-2 text-sm sm:text-base">
            💳 Controle de Pagamentos por Paciente
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
                      <SelectTrigger><SelectValue placeholder="Selecione a clínica" /></SelectTrigger>
                      <SelectContent>
                        {clinics.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium text-foreground mb-2 block">Data Início</label>
                      <Input type="date" value={invoiceStartDate} onChange={(e) => setInvoiceStartDate(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground mb-2 block">Data Fim</label>
                      <Input type="date" value={invoiceEndDate} onChange={(e) => setInvoiceEndDate(e.target.value)} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">As datas são pré-preenchidas com o mês selecionado. Ajuste se necessário.</p>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">Carimbo (opcional)</label>
                    <Select value={selectedStampId} onValueChange={setSelectedStampId}>
                      <SelectTrigger><SelectValue placeholder="Sem carimbo" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem carimbo</SelectItem>
                        {stamps.map(s => <SelectItem key={s.id} value={s.id}>{s.name} - {s.clinical_area}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleExportClinicInvoice} disabled={isExportingInvoice || !invoiceClinicId} className="w-full gap-2">
                    {isExportingInvoice ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    {isExportingInvoice ? 'Gerando...' : 'Exportar Extrato PDF'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="outline" className="gap-2 w-full sm:w-auto text-xs sm:text-sm" onClick={handleExportPDF} disabled={isExporting}>
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {isExporting ? 'Exportando...' : 'Relatório Geral PDF'}
            </Button>
          </div>
        </div>

        {/* Payment summary mini-cards */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-xl bg-secondary/40 border border-border/50 p-3 text-center">
            <p className="text-[10px] text-muted-foreground mb-0.5">Total Previsto</p>
            <p className="font-bold text-foreground text-sm">R$ {(paidTotal + pendingTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="rounded-xl bg-success/5 border border-success/20 p-3 text-center">
            <p className="text-[10px] text-success/80 mb-0.5 flex items-center justify-center gap-1"><CheckCircle2 className="w-3 h-3" />Recebido</p>
            <p className="font-bold text-success text-sm">R$ {paidTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="rounded-xl bg-warning/5 border border-warning/20 p-3 text-center">
            <p className="text-[10px] text-warning/80 mb-0.5 flex items-center justify-center gap-1"><Clock className="w-3 h-3" />Pendente</p>
            <p className="font-bold text-warning text-sm">R$ {pendingTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-secondary/30 rounded-xl border border-border/50">
          <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground font-medium">Filtros:</span>

          {/* Status filter */}
          <div className="flex items-center gap-1 rounded-lg bg-card border border-border p-0.5">
            {(['all', 'paid', 'pending'] as PaymentStatusFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setPaymentStatusFilter(f)}
                className={cn(
                  'text-xs px-2.5 py-1 rounded-md transition-colors',
                  paymentStatusFilter === f
                    ? f === 'paid' ? 'bg-success text-white' : f === 'pending' ? 'bg-warning text-white' : 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {f === 'all' ? 'Todos' : f === 'paid' ? '✓ Pagos' : '⏳ Pendentes'}
              </button>
            ))}
          </div>

          {/* Date range filter */}
          <div className="flex items-center gap-1.5 ml-auto">
            <label className="text-[10px] text-muted-foreground">Data pgto:</label>
            <Input
              type="date"
              value={tableStartDate}
              onChange={e => setTableStartDate(e.target.value)}
              className="h-7 text-xs w-32 px-2"
              placeholder="De"
            />
            <span className="text-muted-foreground text-xs">–</span>
            <Input
              type="date"
              value={tableEndDate}
              onChange={e => setTableEndDate(e.target.value)}
              className="h-7 text-xs w-32 px-2"
              placeholder="Até"
            />
            {(tableStartDate || tableEndDate) && (
              <button onClick={() => { setTableStartDate(''); setTableEndDate(''); }} className="text-xs text-muted-foreground hover:text-foreground px-1.5">✕</button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b-2 border-border">
                <th className="text-left py-3 px-3 font-semibold text-foreground text-xs">Paciente</th>
                <th className="text-left py-3 px-3 font-semibold text-foreground text-xs hidden sm:table-cell">Clínica</th>
                <th className="text-left py-3 px-3 font-semibold text-foreground text-xs">Tipo</th>
                <th className="text-center py-3 px-3 font-semibold text-foreground text-xs">Sess.</th>
                <th className="text-center py-3 px-3 font-semibold text-foreground text-xs">Faltas</th>
                <th className="text-center py-3 px-3 font-semibold text-foreground text-xs">Status Pgto</th>
                <th className="text-center py-3 px-3 font-semibold text-foreground text-xs hidden md:table-cell">Data Pgto</th>
                <th className="text-right py-3 px-3 font-semibold text-foreground text-xs">Valor</th>
              </tr>
            </thead>
            <tbody>
              {patientStats.map(({ patient, clinic, revenue, loss, sessions, paidAbsences, absences, paymentType, paymentValue, pr }) => (
                <tr key={patient.id} className="border-b border-border/60 hover:bg-secondary/40 transition-colors">
                  <td className="py-3 px-3 text-foreground text-xs">
                    <span className="truncate block max-w-[100px] sm:max-w-none font-medium">{patient.name}</span>
                    {patient.packageId && (() => {
                      const pkg = clinicPackages.find(p => p.id === patient.packageId);
                      return pkg ? <span className="block text-[10px] text-muted-foreground">{pkg.name}</span> : null;
                    })()}
                  </td>
                  <td className="py-3 px-3 text-muted-foreground text-xs hidden sm:table-cell">{clinic?.name}</td>
                  <td className="py-3 px-3 text-xs">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', paymentType === 'fixo' ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent')}>
                      {paymentType === 'fixo' ? 'Fixo' : `R$${paymentValue}/sessão`}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center text-foreground text-xs">
                    {sessions}
                    {paidAbsences > 0 && <span className="text-amber-600 text-[10px] block">+{paidAbsences} rem.</span>}
                  </td>
                  <td className="py-3 px-3 text-center text-xs">
                    {absences > 0 ? (
                      <span className={cn('inline-flex items-center gap-0.5', loss > 0 ? 'text-destructive' : 'text-amber-600')}>
                        {absences}{loss > 0 && <AlertTriangle className="w-2.5 h-2.5" />}
                      </span>
                    ) : <span className="text-muted-foreground">0</span>}
                  </td>
                  {/* Payment status column */}
                  <td className="py-3 px-3 text-center">
                    <button
                      type="button"
                      disabled={savingPatientPayment === patient.id}
                      title={pr?.paid ? 'Marcar como pendente' : 'Marcar como pago'}
                      onClick={() => handleTogglePatientPayment(patient.id, pr, revenue)}
                      className={cn(
                        'inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-full border transition-colors disabled:opacity-50',
                        pr?.paid
                          ? 'bg-success/10 text-success border-success/30 hover:bg-success/20'
                          : 'bg-warning/10 text-warning border-warning/30 hover:bg-warning/20'
                      )}
                    >
                      {pr?.paid ? <><CheckCircle2 className="w-3 h-3" />Pago</> : <><Clock className="w-3 h-3" />Pendente</>}
                    </button>
                  </td>
                  {/* Payment date column */}
                  <td className="py-3 px-3 text-center text-xs text-muted-foreground hidden md:table-cell">
                    {pr?.paid && pr.payment_date
                      ? <span className="text-success font-medium">{format(new Date(pr.payment_date + 'T00:00:00'), 'dd/MM/yyyy')}</span>
                      : <span className="text-muted-foreground/50">—</span>
                    }
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex flex-col items-end">
                      <span className={cn('font-bold text-xs', loss > 0 ? 'text-foreground' : 'text-success')}>
                        R$ {revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      {loss > 0 && <span className="text-xs text-destructive hidden sm:block">-R$ {loss.toFixed(2)}</span>}
                    </div>
                  </td>
                </tr>
              ))}
              {patientStats.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-muted-foreground">
                    {paymentStatusFilter !== 'all' || tableStartDate || tableEndDate
                      ? 'Nenhum resultado para os filtros aplicados'
                      : 'Nenhum paciente com valor configurado'}
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
