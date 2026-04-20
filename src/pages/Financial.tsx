import { Building2, Users, DollarSign, TrendingUp, TrendingDown, Filter, Download, AlertTriangle, Briefcase, Loader2, FileText, Stamp, ChevronLeft, ChevronRight, Stethoscope, CalendarCheck, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { TeamFinancialReport } from '@/components/clinics/TeamFinancialReport';
import { useClinicOrg } from '@/hooks/useClinicOrg';
import { format, subMonths, addMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';
import { usePrivateAppointments } from '@/hooks/usePrivateAppointments';
import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { calculatePatientMonthlyRevenue, calculateClinicMonthlyRevenue, calculatePatientProportionalShare, isBillableStatus, isClinicFixedMonthly, isClinicFixedDaily, type EvolutionLike } from '@/utils/financialHelpers';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { type GroupBillingMap, type GroupMemberPaymentMap } from '@/utils/groupFinancial';
import { generateClinicInternalStatementPdf } from '@/utils/generateClinicInternalStatementPdf';

type PaymentStatusFilter = 'all' | 'paid' | 'pending';

export default function Financial() {
  const { clinics, patients, evolutions, payments, clinicPackages, loadAllEvolutions } = useApp();
  const { getMonthlyAppointments } = usePrivateAppointments();
  const { user } = useAuth();

  const [groupBillingMap, setGroupBillingMap] = useState<GroupBillingMap>({});
  const [memberPaymentMap, setMemberPaymentMap] = useState<GroupMemberPaymentMap>({});

  useEffect(() => {
    if (user) {
      loadAllEvolutions();
      supabase.from('therapeutic_groups').select('id, default_price, financial_enabled, payment_type, package_id')
        .then(({ data }) => {
          if (data) {
            const map: GroupBillingMap = {};
            data.forEach((g: any) => {
              map[g.id] = {
                defaultPrice: g.default_price ?? null,
                paymentType: g.payment_type ?? null,
                packageId: g.package_id ?? null,
                financialEnabled: g.financial_enabled ?? false,
              };
            });
            setGroupBillingMap(map);
          }
        });
      supabase.from('therapeutic_group_members').select('group_id, patient_id, is_paying, member_payment_value')
        .eq('status', 'active')
        .then(({ data }) => {
          if (data) {
            const map: GroupMemberPaymentMap = {};
            data.forEach((m: any) => {
              if (!map[m.group_id]) map[m.group_id] = {};
              map[m.group_id][m.patient_id] = {
                isPaying: m.is_paying ?? true,
                value: m.member_payment_value ?? null,
              };
            });
            setMemberPaymentMap(map);
          }
        });
    }
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
  // Clinic-level payment records for contratante clinics keyed by clinic_id
  const [clinicPaymentRecords, setClinicPaymentRecords] = useState<Record<string, any>>({});

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

  // Load patient payment records AND clinic payment records for selected month
  useEffect(() => {
    if (!user) return;
    const m = selectedDate.getMonth() + 1;
    const y = selectedDate.getFullYear();
    Promise.all([
      supabase.from('patient_payment_records' as any).select('*').eq('user_id', user.id).eq('month', m).eq('year', y),
      supabase.from('clinic_payment_records' as any).select('*').eq('user_id', user.id).eq('month', m).eq('year', y),
    ]).then(([patientRes, clinicRes]) => {
      if (patientRes.data) {
        const map: Record<string, any> = {};
        (patientRes.data as any[]).forEach(r => { map[r.patient_id] = r; });
        setPatientPaymentRecords(map);
      }
      if (clinicRes.data) {
        const map: Record<string, any> = {};
        (clinicRes.data as any[]).forEach(r => { map[r.clinic_id] = r; });
        setClinicPaymentRecords(map);
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

  // 🔒 Cálculos delegados ao helper central (financialHelpers).
  // NÃO duplicar lógica financeira aqui — qualquer ajuste deve ir lá.
  const buildRevenueCtx = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return null;
    const clinic = clinics.find(c => c.id === patient.clinicId);
    const patientEvos: EvolutionLike[] = monthlyEvolutions
      .filter(e => e.patientId === patientId)
      .map(e => ({
        id: e.id,
        patientId: e.patientId,
        groupId: e.groupId,
        date: e.date,
        attendanceStatus: e.attendanceStatus,
        confirmedAttendance: e.confirmedAttendance,
        userId: e.userId,
      }));
    return {
      patient,
      clinic,
      evolutions: patientEvos,
      month: selectedMonth,
      year: selectedYear,
      packages: clinicPackages,
      groupBillingMap,
      memberPaymentMap,
    };
  };

  const calculatePatientRevenue = (patientId: string) => {
    const ctx = buildRevenueCtx(patientId);
    if (!ctx) return 0;
    return calculatePatientMonthlyRevenue(ctx).total;
  };

  const calculatePatientLoss = (patientId: string) => {
    const ctx = buildRevenueCtx(patientId);
    if (!ctx) return 0;
    return calculatePatientMonthlyRevenue(ctx).loss;
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

  // Helper: faturamento de UMA clínica no mês (respeita modelo fixo/diário/variado)
  const calculateClinicRevenue = (clinic: typeof clinics[0]) => {
    const cPatients = patients.filter(p => p.clinicId === clinic.id && !p.isArchived);
    const cEvos: EvolutionLike[] = monthlyEvolutions
      .filter(e => cPatients.some(p => p.id === e.patientId))
      .map(e => ({
        id: e.id, patientId: e.patientId, groupId: e.groupId, date: e.date,
        attendanceStatus: e.attendanceStatus, confirmedAttendance: e.confirmedAttendance, userId: e.userId,
      }));
    return calculateClinicMonthlyRevenue({
      clinic, patients: cPatients, evolutions: cEvos,
      month: selectedMonth, year: selectedYear,
      packages: clinicPackages, groupBillingMap, memberPaymentMap,
    }).total;
  };

  const revenueByClinicType = (type: 'propria' | 'contratante') => {
    const targetClinics = type === 'propria' ? propriaClinics : contratanteClinics;
    return targetClinics.reduce((sum, clinic) => {
      const clinicRev = calculateClinicRevenue(clinic);
      const clinicServicesRevenue = linkedServiceAppointments
        .filter(a => a.clinic_id === clinic.id && a.status === 'concluído')
        .reduce((s, a) => s + (a.price || 0), 0);
      return sum + clinicRev + clinicServicesRevenue;
    }, 0);
  };

  const revenuePropriaClinicas = revenueByClinicType('propria');
  const revenueContratante = revenueByClinicType('contratante');
  const totalRevenue = clinics.filter(c => !c.isArchived).reduce((sum, c) => sum + calculateClinicRevenue(c), 0);
  const totalLoss = patients.reduce((sum, p) => sum + calculatePatientLoss(p.id), 0);
  const linkedServicesRevenue = linkedServiceAppointments
    .filter(a => a.status === 'concluído')
    .reduce((sum, a) => sum + (a.price || 0), 0);
  const netRevenue = totalRevenue + linkedServicesRevenue + standaloneRevenue;

  // Revenue breakdown by session type (individual, fixo, group)
  const { revenueIndividualSession, revenueFixo, revenueGroup } = useMemo(() => {
    let individualSession = 0;
    let fixo = 0;
    let group = 0;
    for (const patient of patients) {
      const ctx = buildRevenueCtx(patient.id);
      if (!ctx) continue;
      const breakdown = calculatePatientMonthlyRevenue(ctx);
      group += breakdown.groupRevenue;
      // Individual + faltas cobradas vão para "fixo" se o paciente é mensalista
      const individualPart = breakdown.individualRevenue + breakdown.chargedAbsenceRevenue;
      if (patient.paymentType === 'fixo') {
        fixo += individualPart;
      } else {
        individualSession += individualPart;
      }
    }
    return { revenueIndividualSession: individualSession, revenueFixo: fixo, revenueGroup: group };
  }, [patients, monthlyEvolutions, groupBillingMap, memberPaymentMap, clinicPackages, selectedMonth, selectedYear, clinics]);

  const totalServicesRevenue = privateRevenue;

  const clinicStats = clinics.filter(c => !c.isArchived).map(clinic => {
    const clinicPatients = patients.filter(p => p.clinicId === clinic.id);
    const revenue = calculateClinicRevenue(clinic);
    const loss = clinicPatients.reduce((sum, p) => sum + calculatePatientLoss(p.id), 0);
    const sessions = presentEvolutions.filter(e => clinicPatients.some(p => p.id === e.patientId)).length;
    const paidAbsences = paidAbsenceEvolutions.filter(e => clinicPatients.some(p => p.id === e.patientId)).length;
    const absences = absentEvolutions.filter(e => clinicPatients.some(p => p.id === e.patientId)).length;
    const isFixedClinic = isClinicFixedMonthly(clinic.paymentType) || isClinicFixedDaily(clinic.paymentType);
    return { clinic, patientCount: clinicPatients.length, revenue, loss, sessions, paidAbsences, absences, isFixedClinic };
  });

  const allPatientStats = patients.map(patient => {
    const clinic = clinics.find(c => c.id === patient.clinicId);
    const revenue = calculatePatientRevenue(patient.id);
    const loss = calculatePatientLoss(patient.id);
    const patientEvos = monthlyEvolutions.filter(e => e.patientId === patient.id);
    const sessions = presentEvolutions.filter(e => e.patientId === patient.id).length;
    const paidAbsences = paidAbsenceEvolutions.filter(e => e.patientId === patient.id).length;
    const absences = absentEvolutions.filter(e => e.patientId === patient.id).length;
    const pr = patientPaymentRecords[patient.id];
    const hasGroupEvos = patientEvos.some(e => e.groupId);
    const hasIndividualEvos = patientEvos.some(e => !e.groupId);
    const tipoLabel = patient.paymentType === 'fixo' ? 'Fixo' : (hasGroupEvos && hasIndividualEvos ? 'Sessão/Grupo' : hasGroupEvos ? 'Grupo' : 'Sessão');
    return { patient, clinic, revenue, loss, sessions, paidAbsences, absences, paymentType: patient.paymentType, paymentValue: patient.paymentValue || 0, pr, tipoLabel };
  }).filter(p => p.sessions > 0 || p.paidAbsences > 0 || p.absences > 0 || p.revenue > 0 || p.loss > 0);

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
    const patient = patients.find(p => p.id === patientId);
    try {
      if (currentPr?.id) {
        await supabase.from('patient_payment_records' as any).update({ paid: newPaid, payment_date: newDate }).eq('id', currentPr.id);
        setPatientPaymentRecords(prev => ({ ...prev, [patientId]: { ...currentPr, paid: newPaid, payment_date: newDate } }));
      } else {
        const newRecord = {
          user_id: user.id,
          patient_id: patientId,
          clinic_id: patient?.clinicId,
          month: m,
          year: y,
          amount: revenue,
          paid: newPaid,
          payment_date: newDate,
        };
        const { data } = await supabase.from('patient_payment_records' as any).insert(newRecord).select().maybeSingle();
        // Use returned data if available, otherwise construct from local values
        setPatientPaymentRecords(prev => ({ ...prev, [patientId]: data ?? { ...newRecord, id: crypto.randomUUID() } }));
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
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 18;
      const contentW = pageWidth - margin * 2;
      let y = 0;

      // ─── Color palette ───────────────────────────────────────────────
      const C = {
        primary:    [79, 56, 140] as [number,number,number],   // deep purple
        primaryLight:[240, 236, 255] as [number,number,number],
        accent:     [124, 99, 198] as [number,number,number],
        dark:       [33, 33, 50] as [number,number,number],
        mid:        [80, 75, 105] as [number,number,number],
        muted:      [130, 125, 155] as [number,number,number],
        light:      [248, 247, 252] as [number,number,number],
        white:      [255, 255, 255] as [number,number,number],
        green:      [22, 130, 80] as [number,number,number],
        greenLight: [220, 245, 235] as [number,number,number],
        orange:     [195, 90, 20] as [number,number,number],
        orangeLight:[255, 237, 218] as [number,number,number],
        red:        [200, 40, 40] as [number,number,number],
        redLight:   [255, 230, 230] as [number,number,number],
        border:     [220, 215, 240] as [number,number,number],
        rowAlt:     [251, 250, 255] as [number,number,number],
      };

      const setFill  = (c: [number,number,number]) => doc.setFillColor(c[0], c[1], c[2]);
      const setTxt   = (c: [number,number,number]) => doc.setTextColor(c[0], c[1], c[2]);
      const setDraw  = (c: [number,number,number]) => doc.setDrawColor(c[0], c[1], c[2]);

      const ensureSpace = (needed: number) => {
        if (y + needed > pageHeight - 18) { doc.addPage(); addPageHeader(); y = 48; }
      };

      const addPageHeader = () => {
        // top bar
        setFill(C.primary);
        doc.rect(0, 0, pageWidth, 14, 'F');
        setTxt(C.white);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('RELATÓRIO FINANCEIRO', margin, 9);
        doc.setFont('helvetica', 'normal');
        doc.text(monthName.charAt(0).toUpperCase() + monthName.slice(1), pageWidth - margin, 9, { align: 'right' });
      };

      const addPageFooter = (page: number, total: number) => {
        const fy = pageHeight - 8;
        setDraw(C.border);
        doc.setLineWidth(0.3);
        doc.line(margin, fy - 3, pageWidth - margin, fy - 3);
        setTxt(C.muted);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, margin, fy);
        doc.text(`Página ${page} de ${total}`, pageWidth - margin, fy, { align: 'right' });
      };

      const sectionTitle = (title: string) => {
        ensureSpace(14);
        setFill(C.primaryLight);
        setDraw(C.accent);
        doc.setLineWidth(0.4);
        doc.roundedRect(margin, y, contentW, 10, 2, 2, 'FD');
        setTxt(C.primary);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(title, margin + 4, y + 6.8);
        y += 14;
      };

      // ─── Page 1 header ───────────────────────────────────────────────
      addPageHeader();

      // ─── Cover title block ───────────────────────────────────────────
      y = 22;
      setTxt(C.dark);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text('Relatório Financeiro', margin, y);
      y += 8;
      setTxt(C.accent);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.text(monthName.charAt(0).toUpperCase() + monthName.slice(1), margin, y);
      if (paymentStatusFilter !== 'all') {
        setTxt(C.muted);
        doc.setFontSize(9);
        doc.text(`Filtro: ${paymentStatusFilter === 'paid' ? 'Apenas Pagos' : 'Apenas Pendentes'}`, margin + 70, y);
      }
      y += 10;
      setDraw(C.border);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 8;

      // ─── Summary cards ────────────────────────────────────────────────
      sectionTitle('RESUMO MENSAL');

      const summaryItems = [
        { label: 'Faturamento Total',        value: `R$ ${netRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,                   bold: true },
        { label: 'Receita Consultórios',value: `R$ ${revenuePropriaClinicas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
        { label: 'Receita Contratante',      value: `R$ ${revenueContratante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
        { label: 'Serviços Particulares',    value: `R$ ${standaloneRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
        ...(totalLoss > 0 ? [{ label: 'Perdas por Faltas', value: `- R$ ${totalLoss.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, loss: true }] : []),
        { label: 'Total de Atendimentos',    value: `${presentEvolutions.length}` },
        { label: 'Faltas Remuneradas',       value: `${paidAbsenceEvolutions.length}` },
        { label: 'Faltas',                   value: `${absentEvolutions.length}` },
      ];

      // Two-column grid for summary
      const colW = (contentW - 4) / 2;
      summaryItems.forEach((item, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        if (col === 0 && row > 0) ensureSpace(12);
        const bx = margin + col * (colW + 4);
        const by = y + row * 12;
        const isLoss = (item as any).loss;
        setFill(isLoss ? C.redLight : ((item as any).bold ? C.primaryLight : C.light));
        setDraw(isLoss ? C.red : C.border);
        doc.setLineWidth(0.2);
        doc.roundedRect(bx, by, colW, 10, 1.5, 1.5, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        setTxt(isLoss ? C.red : C.mid);
        doc.text(item.label + ':', bx + 3, by + 4.2);
        doc.setFont('helvetica', (item as any).bold ? 'bold' : 'normal');
        setTxt(isLoss ? C.red : ((item as any).bold ? C.primary : C.dark));
        doc.setFontSize((item as any).bold ? 9 : 8);
        doc.text(item.value, bx + colW - 3, by + 6.5, { align: 'right' });
      });
      y += Math.ceil(summaryItems.length / 2) * 12 + 8;

      // ─── Revenue breakdown by type ────────────────────────────────────
      sectionTitle('DETALHAMENTO POR TIPO DE ATENDIMENTO');

      const breakdownItems = [
        { label: 'Sessões Individuais', value: revenueIndividualSession, color: C.primary },
        { label: 'Mensalidades Fixas', value: revenueFixo, color: [40, 120, 180] as [number,number,number] },
        { label: 'Sessões em Grupo', value: revenueGroup, color: C.accent },
        { label: 'Serviços Particulares', value: totalServicesRevenue, color: C.green },
      ];
      const breakdownTotal = revenueIndividualSession + revenueFixo + revenueGroup + totalServicesRevenue;

      breakdownItems.forEach((item, idx) => {
        ensureSpace(16);
        const rowColor = idx % 2 === 0 ? C.white : C.rowAlt;
        setFill(rowColor);
        setDraw(C.border);
        doc.setLineWidth(0.2);
        doc.rect(margin, y, contentW, 12, 'FD');

        // Color strip
        setFill(item.color);
        doc.rect(margin, y, 3, 12, 'F');

        // Label
        setTxt(C.dark);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(item.label, margin + 6, y + 5);

        // Percentage
        const pct = breakdownTotal > 0 ? ((item.value / breakdownTotal) * 100).toFixed(1) : '0.0';
        setTxt(C.muted);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.text(`${pct}%`, margin + 6, y + 9.5);

        // Progress bar
        const barX = margin + 70;
        const barW = 60;
        const barH = 3;
        const barY = y + 4;
        setFill(C.light);
        doc.roundedRect(barX, barY, barW, barH, 1, 1, 'F');
        if (breakdownTotal > 0 && item.value > 0) {
          setFill(item.color);
          const fillW = Math.max(2, (item.value / breakdownTotal) * barW);
          doc.roundedRect(barX, barY, fillW, barH, 1, 1, 'F');
        }

        // Value
        setTxt(item.color);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(`R$ ${item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, pageWidth - margin - 3, y + 7, { align: 'right' });
        y += 13;
      });
      y += 6;

      // ─── Clinic breakdown ─────────────────────────────────────────────
      if (clinicStats.length > 0) {
        sectionTitle('FATURAMENTO POR CLÍNICA');

        clinicStats.forEach(({ clinic, patientCount, revenue, sessions, paidAbsences, absences }, idx) => {
          ensureSpace(16);
          const rowColor = idx % 2 === 0 ? C.white : C.rowAlt;
          setFill(rowColor);
          setDraw(C.border);
          doc.setLineWidth(0.2);
          doc.rect(margin, y, contentW, 14, 'FD');

          // Accent left strip
          const isContratante = clinic.type !== 'propria';
          setFill(isContratante ? C.accent : C.primary);
          doc.rect(margin, y, 3, 14, 'F');

          // Clinic name + type badge
          setTxt(C.dark);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.text(clinic.name, margin + 6, y + 5.5);
          const clinicNameW = doc.getTextWidth(clinic.name);
          // Badge — set font FIRST, then measure, then draw
          const badge = isContratante ? 'Contratante' : 'Consultório';
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6.5);
          const badgeTextW = doc.getTextWidth(badge);
          const badgePadX = 4; // generous padding so text never clips
          const badgeW = badgeTextW + badgePadX * 2;
          const badgeX = margin + 6 + clinicNameW + 4;
          setFill(isContratante ? C.accent : C.primary);
          doc.roundedRect(badgeX, y + 1.2, badgeW, 5.5, 1.2, 1.2, 'F');
          setTxt(C.white);
          // text x = left edge of badge + half of badge width (true center)
          doc.text(badge, badgeX + badgeW / 2, y + 4.9, { align: 'center' });

          // Stats line
          setTxt(C.muted);
          doc.setFontSize(7.5);
          doc.text(`${patientCount} pacientes  •  ${sessions} sessões  •  ${paidAbsences} faltas rem.  •  ${absences} faltas`, margin + 6, y + 10.5);

          // Revenue
          setTxt(C.primary);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.text(`R$ ${revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, pageWidth - margin - 3, y + 7, { align: 'right' });
          y += 15;
        });
        y += 6;
      }

      // ─── Standalone services ──────────────────────────────────────────
      if (standaloneServiceAppointments.length > 0) {
        sectionTitle('SERVIÇOS PARTICULARES (FORA DE CLÍNICA)');

        // Table header
        ensureSpace(10);
        setFill(C.primary);
        doc.rect(margin, y, contentW, 9, 'F');
        setTxt(C.white);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        const ts = {
          cli: margin + 2,
          srv: margin + 46,
          pay: margin + 92,
          sta: margin + 118,
          dat: margin + 138,
          val: pageWidth - margin - 2,
        };
        doc.text('CLIENTE', ts.cli, y + 5.8);
        doc.text('SERVIÇO', ts.srv, y + 5.8);
        doc.text('PAG.', ts.pay, y + 5.8);
        doc.text('STATUS', ts.sta, y + 5.8);
        doc.text('CONTRATAÇÃO', ts.dat, y + 5.8);
        doc.text('VALOR', ts.val, y + 5.8, { align: 'right' });
        y += 10;

        let svcTotalPaid = 0;
        let svcTotalPending = 0;

        standaloneServiceAppointments.forEach((apt: any, idx: number) => {
          ensureSpace(9);
          setFill(idx % 2 === 0 ? C.white : C.rowAlt);
          doc.rect(margin, y, contentW, 8, 'F');

          // Cliente
          setTxt(C.dark);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.text((apt.client_name || '').substring(0, 20), ts.cli, y + 5.2);

          // Serviço
          setTxt(C.mid);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          const svcName = (apt as any).services?.name || '—';
          doc.text(svcName.substring(0, 22), ts.srv, y + 5.2);

          // Status pagamento (Pago / Pendente)
          if (apt.paid) {
            setFill(C.greenLight);
            doc.roundedRect(ts.pay - 1, y + 0.8, 22, 6, 1, 1, 'F');
            setTxt(C.green);
            doc.setFont('helvetica', 'bold');
            doc.text('Pago', ts.pay + 1, y + 5.2);
            svcTotalPaid += apt.price || 0;
          } else {
            setFill(C.orangeLight);
            doc.roundedRect(ts.pay - 1, y + 0.8, 22, 6, 1, 1, 'F');
            setTxt(C.orange);
            doc.setFont('helvetica', 'bold');
            doc.text('Pendente', ts.pay + 1, y + 5.2);
            svcTotalPending += apt.price || 0;
          }

          // Status atendimento (Concluído / Aguardando / etc.)
          const statusMap: Record<string, { label: string; color: [number,number,number]; bg: [number,number,number] }> = {
            'concluído':  { label: 'Concluído',  color: C.green,  bg: C.greenLight },
            'agendado':   { label: 'Aguardando', color: C.accent, bg: C.primaryLight },
            'cancelado':  { label: 'Cancelado',  color: C.red,    bg: C.redLight },
          };
          const sm = statusMap[apt.status] || { label: apt.status || '—', color: C.mid, bg: C.light };
          setFill(sm.bg);
          const smW = doc.getTextWidth(sm.label) + 4;
          doc.roundedRect(ts.sta - 1, y + 0.8, smW, 6, 1, 1, 'F');
          setTxt(sm.color);
          doc.setFont('helvetica', 'bold');
          doc.text(sm.label, ts.sta + 1, y + 5.2);

          // Data contratação
          setTxt(C.mid);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          const dateStr = apt.date ? format(new Date(apt.date + 'T12:00:00'), 'dd/MM/yyyy') : '—';
          doc.text(dateStr, ts.dat, y + 5.2);

          // Data finalização (se concluído e tiver payment_date)
          if (apt.status === 'concluído' && apt.payment_date) {
            const finDate = format(new Date(apt.payment_date + 'T12:00:00'), 'dd/MM/yyyy');
            doc.setFontSize(6.5);
            setTxt(C.muted);
            doc.text(`Fin: ${finDate}`, ts.dat, y + 7.8);
          }

          // Valor
          setTxt(C.dark);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.text(`R$ ${(apt.price || 0).toFixed(2)}`, ts.val, y + 5.2, { align: 'right' });

          setDraw(C.border);
          doc.setLineWidth(0.1);
          doc.line(margin, y + 8, pageWidth - margin, y + 8);
          y += 8;
        });

        // Totals footer
        ensureSpace(22);
        y += 4;
        const svcFooterH = 9;
        setFill(C.greenLight);
        setDraw(C.green);
        doc.setLineWidth(0.3);
        doc.roundedRect(margin, y, contentW / 2 - 2, svcFooterH, 1.5, 1.5, 'FD');
        setTxt(C.green);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('Total Pago:', margin + 4, y + 6);
        doc.text(`R$ ${svcTotalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin + contentW / 2 - 5, y + 6, { align: 'right' });

        setFill(C.orangeLight);
        setDraw(C.orange);
        doc.roundedRect(margin + contentW / 2 + 2, y, contentW / 2 - 2, svcFooterH, 1.5, 1.5, 'FD');
        setTxt(C.orange);
        doc.text('Total Pendente:', margin + contentW / 2 + 6, y + 6);
        doc.text(`R$ ${svcTotalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, pageWidth - margin - 3, y + 6, { align: 'right' });
        y += svcFooterH + 6;
      }

      // ─── Patient payments table ────────────────────────────────────────
      // Only include patients with at least some billable activity in the month
      const pdfPatientStats = patientStats.filter(({ revenue }) => revenue > 0);
      if (pdfPatientStats.length > 0) {
        sectionTitle('CONTROLE DE PAGAMENTOS POR PACIENTE');

        // Table header row — Clínica removed (now shown as group header)
        ensureSpace(10);
        setFill(C.primary);
        doc.rect(margin, y, contentW, 9, 'F');
        setTxt(C.white);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        const th = { p: margin + 2, t: margin + 90, s: margin + 112, st: margin + 130, v: pageWidth - margin - 2 };
        doc.text('PACIENTE', th.p, y + 5.8);
        doc.text('TIPO', th.t, y + 5.8);
        doc.text('SESS.', th.s, y + 5.8);
        doc.text('STATUS', th.st, y + 5.8);
        doc.text('VALOR', th.v, y + 5.8, { align: 'right' });
        y += 10;

        // Group patientStats by clinic
        const grouped = pdfPatientStats.reduce((acc, stat) => {
          const key = stat.clinic?.id || 'sem-clinica';
          if (!acc[key]) acc[key] = { clinic: stat.clinic, items: [] };
          acc[key].items.push(stat);
          return acc;
        }, {} as Record<string, { clinic: any; items: typeof patientStats }>);

        let totalPaid = 0, totalPending = 0;
        let rowIdx = 0;

        Object.values(grouped).forEach(({ clinic: grpClinic, items }) => {
          // Clinic group header
          ensureSpace(14);
          const isContratanteGrp = grpClinic?.type !== 'propria';
          setFill(isContratanteGrp ? C.primaryLight : [235, 245, 255] as [number,number,number]);
          setDraw(isContratanteGrp ? C.accent : C.primary);
          doc.setLineWidth(0.3);
          doc.rect(margin, y, contentW, 8, 'FD');
          setFill(isContratanteGrp ? C.accent : C.primary);
          doc.rect(margin, y, 3, 8, 'F');
          setTxt(isContratanteGrp ? C.accent : C.primary);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.text((grpClinic?.name || 'Sem Clínica').toUpperCase(), margin + 6, y + 5.5);
          const badge = isContratanteGrp ? 'Contratante' : 'Consultório';
          doc.setFontSize(6.5);
          const bw = doc.getTextWidth(badge) + 6;
          const bx = margin + 6 + doc.getTextWidth((grpClinic?.name || 'Sem Clínica').toUpperCase()) + 5;
          setFill(isContratanteGrp ? C.accent : C.primary);
          doc.roundedRect(bx, y + 1.5, bw, 5, 1, 1, 'F');
          setTxt(C.white);
          doc.text(badge, bx + bw / 2, y + 5, { align: 'center' });
          y += 9;

          items.forEach(({ patient, clinic, revenue, sessions, paymentType, pr, tipoLabel }) => {
            ensureSpace(8);
            const isContratante = clinic?.type !== 'propria';
            const clinicPr = isContratante ? clinicPaymentRecords[clinic?.id || ''] : null;
            const effectivePaid = isContratante ? !!clinicPr?.paid : !!pr?.paid;
            const effectiveDate = isContratante ? clinicPr?.payment_date : pr?.payment_date;

            setFill(rowIdx % 2 === 0 ? C.white : C.rowAlt);
            doc.rect(margin, y, contentW, 7.5, 'F');

            setTxt(C.dark);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.text(patient.name.substring(0, 30), th.p, y + 5);
            setTxt(C.mid);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.text(tipoLabel || (paymentType === 'fixo' ? 'Fixo' : 'Sessão'), th.t, y + 5);
            doc.text(sessions.toString(), th.s, y + 5);

            if (effectivePaid) {
              const paidLabel = `Pago${effectiveDate ? ' ' + format(new Date(effectiveDate + 'T00:00:00'), 'dd/MM') : ''}`;
              setFill(C.greenLight);
              doc.roundedRect(th.st - 1, y + 0.8, doc.getTextWidth(paidLabel) + 4, 6, 1, 1, 'F');
              setTxt(C.green);
              doc.setFont('helvetica', 'bold');
              doc.text(paidLabel, th.st + 1, y + 5);
              totalPaid += revenue;
            } else {
              setFill(C.orangeLight);
              doc.roundedRect(th.st - 1, y + 0.8, doc.getTextWidth('Pendente') + 4, 6, 1, 1, 'F');
              setTxt(C.orange);
              doc.setFont('helvetica', 'bold');
              doc.text('Pendente', th.st + 1, y + 5);
              totalPending += revenue;
            }

            setTxt(C.dark);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.text(`R$ ${revenue.toFixed(2)}`, th.v, y + 5, { align: 'right' });

            setDraw(C.border);
            doc.setLineWidth(0.1);
            doc.line(margin, y + 7.5, pageWidth - margin, y + 7.5);
            y += 7.5;
            rowIdx++;
          });
          y += 3; // space between clinic groups
        });

        // Totals footer row
        ensureSpace(22);
        y += 4;
        const footerRowH = 9;

        setFill(C.greenLight);
        setDraw(C.green);
        doc.setLineWidth(0.3);
        doc.roundedRect(margin, y, contentW / 2 - 2, footerRowH, 1.5, 1.5, 'FD');
        setTxt(C.green);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('Total Pago:', margin + 4, y + 6);
        doc.text(`R$ ${totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin + contentW / 2 - 5, y + 6, { align: 'right' });

        setFill(C.orangeLight);
        setDraw(C.orange);
        doc.roundedRect(margin + contentW / 2 + 2, y, contentW / 2 - 2, footerRowH, 1.5, 1.5, 'FD');
        setTxt(C.orange);
        doc.text('Total Pendente:', margin + contentW / 2 + 6, y + 6);
        doc.text(`R$ ${totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, pageWidth - margin - 3, y + 6, { align: 'right' });
        y += footerRowH + 5;
      }

      // ─── Page footers ─────────────────────────────────────────────────
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        addPageFooter(i, pageCount);
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

      await generateClinicInternalStatementPdf({
        clinicId: clinic.id,
        clinicName: clinic.name,
        clinicAddress: clinic.address ?? null,
        clinicCnpj: (clinic as any)?.cnpj ?? null,
        month: selectedMonth,
        year: selectedYear,
        patients: clinicPatients.map(p => ({ id: p.id, name: p.name })),
      });

      setInvoiceDialogOpen(false);
    } catch (error) {
      console.error('Error exporting invoice:', error);
      toast.error('Erro ao exportar extrato');
    } finally {
      setIsExportingInvoice(false);
    }
  };

// Add CSV export function before the return statement
  const handleExportCSV = () => {
    const rows = [
      ['Paciente', 'Clínica', 'Tipo', 'Sessões', 'Faltas Rem.', 'Faltas', 'Valor (R$)', 'Status Pagamento', 'Data Pagamento'],
      ...patientStats.map(({ patient, clinic, sessions, paidAbsences, absences, paymentType, paymentValue, revenue, pr, tipoLabel }) => [
        patient.name,
        clinic?.name || '',
        tipoLabel || (paymentType === 'fixo' ? 'Fixo Mensal' : `Por Sessão (R$${paymentValue}/sessão)`),
        sessions.toString(),
        paidAbsences.toString(),
        absences.toString(),
        revenue.toFixed(2).replace('.', ','),
        pr?.paid ? 'Pago' : 'Pendente',
        pr?.paid && pr.payment_date ? format(new Date(pr.payment_date + 'T00:00:00'), 'dd/MM/yyyy') : '',
      ])
    ];
    const csvContent = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financeiro-${monthName.replace(/ /g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const grandTotal = totalRevenue + standaloneRevenue;

  // Paid total for patients in PROPRIA clinics (tracked individually)
  const propriaPatientIds = new Set(
    patients.filter(p => propriaClinics.some(c => c.id === p.clinicId)).map(p => p.id)
  );
  const paidPatientTotal = allPatientStats
    .filter(({ patient }) => propriaPatientIds.has(patient.id))
    .reduce((sum, { pr, revenue, paymentValue }) =>
      sum + (pr?.paid ? (pr.amount > 0 ? pr.amount : (revenue > 0 ? revenue : paymentValue)) : 0), 0);

  // Paid total for CONTRATANTE clinics (tracked at clinic level)
  const clinicPaidTotal = contratanteClinics.reduce((sum, clinic) => {
    const cr = clinicPaymentRecords[clinic.id];
    if (!cr?.paid) return sum;
    const clinicRevenue = clinicStats.find(s => s.clinic.id === clinic.id)?.revenue ?? 0;
    return sum + (cr.amount > 0 ? cr.amount : clinicRevenue);
  }, 0);

  const paidTotal = paidPatientTotal + clinicPaidTotal;
  const pendingTotal = Math.max(0, grandTotal - paidTotal);

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
              <p className="text-xs text-muted-foreground">Receita Consultórios</p>
              <p className="text-[10px] text-muted-foreground/70">Consultórios próprios</p>
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">
            R$ {revenuePropriaClinicas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {propriaClinics.length} {propriaClinics.length === 1 ? 'consultório' : 'consultórios'}
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

      {/* Revenue breakdown by session type */}
      <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2 text-sm">
        <CalendarCheck className="w-4 h-4 text-primary" />
        Detalhamento por Tipo de Atendimento
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 sm:mb-8">
        {/* Sessões Individuais */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Stethoscope className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Sessões Individuais</p>
              <p className="text-[10px] text-muted-foreground/70">Por sessão (1 a 1)</p>
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">
            R$ {revenueIndividualSession.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          {grandTotal > 0 && (
            <div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(revenueIndividualSession / grandTotal) * 100}%` }} />
            </div>
          )}
        </div>

        {/* Mensalidades Fixas */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
              <DollarSign className="w-5 h-5 text-blue-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Mensalidades Fixas</p>
              <p className="text-[10px] text-muted-foreground/70">Pagamento fixo mensal</p>
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">
            R$ {revenueFixo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          {grandTotal > 0 && (
            <div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${(revenueFixo / grandTotal) * 100}%` }} />
            </div>
          )}
        </div>

        {/* Sessões em Grupo */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-violet-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Sessões em Grupo</p>
              <p className="text-[10px] text-muted-foreground/70">Grupos terapêuticos</p>
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">
            R$ {revenueGroup.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          {grandTotal > 0 && (
            <div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${(revenueGroup / grandTotal) * 100}%` }} />
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
              <p className="text-[10px] text-muted-foreground/70">Agendamentos avulsos</p>
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">
            R$ {privateRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          {grandTotal > 0 && (
            <div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${(privateRevenue / grandTotal) * 100}%` }} />
            </div>
          )}
        </div>
      </div>


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
                      {isPropria ? 'Consultório' : 'Contratante'}
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
                  <DialogTitle>Emitir Extrato Completo Interno</DialogTitle>
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
                  <p className="text-xs text-muted-foreground">
                    O extrato será gerado para o mês selecionado: <span className="font-medium capitalize">{monthName}</span>.
                  </p>
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
            <Button variant="outline" className="gap-2 w-full sm:w-auto text-xs sm:text-sm" onClick={handleExportCSV}>
              <Download className="w-4 h-4" />
              Exportar CSV
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
              {patientStats.map(({ patient, clinic, revenue, loss, sessions, paidAbsences, absences, paymentType, paymentValue, pr, tipoLabel, proportionalShare }) => (
                <tr key={patient.id} className="border-b border-border/60 hover:bg-secondary/40 transition-colors">
                  <td className="py-3 px-3 text-foreground text-xs">
                    <button
                      onClick={() => navigate(`/patient/${patient.id}#financeiro`)}
                      className="text-left hover:text-primary hover:underline transition-colors font-medium"
                    >
                      {patient.name}
                    </button>
                  </td>
                  <td className="py-3 px-3 text-muted-foreground text-xs hidden sm:table-cell">{clinic?.name}</td>
                  <td className="py-3 px-3 text-xs">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', paymentType === 'fixo' ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent')}>
                      {tipoLabel || (paymentType === 'fixo' ? 'Fixo' : `R$${paymentValue}/sessão`)}
                    </span>
                  </td>
                  {/* keep middle cells unchanged */}
                  <td className="py-3 px-3 text-center text-foreground text-xs">{sessions}</td>
                  <td className="py-3 px-3 text-center text-foreground text-xs">{absences}</td>
                  <td className="py-3 px-3 text-center">
                    <button
                      onClick={() => togglePatientPaid(patient.id)}
                      disabled={savingPatientPayment === patient.id}
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border transition-colors',
                        pr?.paid
                          ? 'bg-success/10 text-success border-success/30 hover:bg-success/20'
                          : 'bg-warning/10 text-warning border-warning/30 hover:bg-warning/20'
                      )}
                    >
                      {savingPatientPayment === patient.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : pr?.paid
                          ? <><CheckCircle2 className="w-3 h-3" />Pago</>
                          : <><Clock className="w-3 h-3" />Pendente</>}
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
                      {proportionalShare?.isProportional ? (
                        <TooltipProvider delayDuration={150}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex flex-col items-end cursor-help">
                                <span className="font-bold text-xs text-muted-foreground">
                                  R$ {proportionalShare.share.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                                <span className="text-[10px] text-muted-foreground/70 italic">(rateio)</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-xs text-xs">
                              Valor proporcional ao salário fixo da clínica
                              {' '}(R$ {proportionalShare.clinicSalary.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).
                              Não é receita adicional — apenas representa o peso deste paciente
                              ({proportionalShare.patientSessions}/{proportionalShare.totalSessions} sessões) no salário.
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <>
                          <span className={cn('font-bold text-xs', loss > 0 ? 'text-foreground' : 'text-success')}>
                            R$ {revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                          {loss > 0 && <span className="text-xs text-destructive hidden sm:block">-R$ {loss.toFixed(2)}</span>}
                        </>
                      )}
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
