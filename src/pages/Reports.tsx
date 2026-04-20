import { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isWithinInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart3, PieChartIcon, TrendingUp, Users, Check, X, Download, Loader2, Smile, DollarSign, Table2, CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { calculatePatientMonthlyRevenue } from '@/utils/financialHelpers';

const CHART_COLORS = ['#6366f1', '#ef4444', '#eab308'];
const PDF_COLORS = { primary: '#6366f1', destructive: '#ef4444', green: '#22c55e', yellow: '#eab308' };

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [0, 0, 0];
}

const MOOD_LABELS: Record<string, { emoji: string; label: string }> = {
  otima: { emoji: '😄', label: 'Ótima' },
  boa: { emoji: '🙂', label: 'Boa' },
  neutra: { emoji: '😐', label: 'Neutra' },
  ruim: { emoji: '😟', label: 'Ruim' },
  muito_ruim: { emoji: '😢', label: 'Muito Ruim' },
};

export default function Reports() {
  const { clinics, patients, evolutions, loadAllEvolutions, clinicPackages } = useApp();
  const { user } = useAuth();

  // Load all evolutions for report generation
  useEffect(() => {
    if (user) loadAllEvolutions();
  }, [user]);


  const [selectedClinic, setSelectedClinic] = useState<string>('all');
  const [period, setPeriod] = useState<'week' | 'month' | 'custom'>('week');
  const [customStart, setCustomStart] = useState<Date | undefined>(undefined);
  const [customEnd, setCustomEnd] = useState<Date | undefined>(undefined);
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const [profile, setProfile] = useState<{ name: string | null; professional_id: string | null } | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('name, professional_id').eq('user_id', user.id).single().then(({ data }) => {
      if (data) setProfile(data);
    });
  }, [user]);

  const dateRange = useMemo(() => {
    const today = new Date();
    if (period === 'custom' && customStart && customEnd) {
      return {
        start: customStart,
        end: customEnd,
        label: `${format(customStart, 'dd/MM/yyyy')} a ${format(customEnd, 'dd/MM/yyyy')}`
      };
    } else if (period === 'month') {
      return {
        start: startOfMonth(today),
        end: endOfMonth(today),
        label: 'Este Mês'
      };
    } else {
      return {
        start: startOfWeek(today, { weekStartsOn: 1 }),
        end: endOfWeek(today, { weekStartsOn: 1 }),
        label: 'Esta Semana'
      };
    }
  }, [period, customStart, customEnd]);

  const filteredEvolutions = useMemo(() => {
    return evolutions.filter(e => {
      const matchesClinic = selectedClinic === 'all' || e.clinicId === selectedClinic;
      const evolutionDate = parseISO(e.date);
      const withinRange = isWithinInterval(evolutionDate, { start: dateRange.start, end: dateRange.end });
      return matchesClinic && withinRange;
    });
  }, [evolutions, selectedClinic, dateRange]);

  const attendanceStats = useMemo(() => {
    const present = filteredEvolutions.filter(e => e.attendanceStatus === 'presente').length;
    const reposicao = filteredEvolutions.filter(e => e.attendanceStatus === 'reposicao').length;
    const absent = filteredEvolutions.filter(e => e.attendanceStatus === 'falta').length;
    const paidAbsent = filteredEvolutions.filter(e => e.attendanceStatus === 'falta_remunerada').length;
    const feriadoRem = filteredEvolutions.filter(e => e.attendanceStatus === 'feriado_remunerado').length;
    const feriadoNaoRem = filteredEvolutions.filter(e => e.attendanceStatus === 'feriado_nao_remunerado').length;
    const total = present + reposicao + absent + paidAbsent + feriadoRem + feriadoNaoRem;
    const presenceRate = total > 0 ? Math.round(((present + reposicao) / total) * 100) : 0;
    return { present, reposicao, absent, paidAbsent, feriadoRem, feriadoNaoRem, total, presenceRate };
  }, [filteredEvolutions]);

  // Mood stats
  const moodStats = useMemo(() => {
    const stats: Record<string, number> = {};
    filteredEvolutions.forEach(e => {
      if (e.mood) {
        stats[e.mood] = (stats[e.mood] || 0) + 1;
      }
    });
    return stats;
  }, [filteredEvolutions]);

  // Per-patient detailed stats (delegado ao helper central — fonte única da verdade)
  const patientDetailedStats = useMemo(() => {
    const patientIds = [...new Set(filteredEvolutions.map(e => e.patientId))];
    return patientIds.map(pid => {
      const patient = patients.find(p => p.id === pid);
      const clinic = clinics.find(c => c.id === patient?.clinicId);
      const pEvolutions = filteredEvolutions.filter(e => e.patientId === pid);
      const present = pEvolutions.filter(e => e.attendanceStatus === 'presente').length;
      const reposicao = pEvolutions.filter(e => e.attendanceStatus === 'reposicao').length;
      const absent = pEvolutions.filter(e => e.attendanceStatus === 'falta').length;
      const paidAbsent = pEvolutions.filter(e => e.attendanceStatus === 'falta_remunerada').length;
      const feriadoRem = pEvolutions.filter(e => e.attendanceStatus === 'feriado_remunerado').length;
      const total = present + reposicao + absent + paidAbsent + feriadoRem;
      const rate = total > 0 ? Math.round(((present + reposicao) / total) * 100) : 0;

      let revenue = 0;
      if (patient) {
        const evosLike = pEvolutions.map(e => ({
          id: e.id, patientId: e.patientId, groupId: e.groupId, date: e.date,
          attendanceStatus: e.attendanceStatus, confirmedAttendance: e.confirmedAttendance,
        }));
        // Usa o mês de referência mais frequente nas evoluções (período pode abranger múltiplos meses)
        const refDate = pEvolutions[0] ? new Date(pEvolutions[0].date + 'T12:00:00') : new Date();
        revenue = calculatePatientMonthlyRevenue({
          patient, clinic, evolutions: evosLike,
          month: refDate.getMonth(), year: refDate.getFullYear(),
          packages: clinicPackages,
        }).total;
      }

      // Mood counts
      const moods: Record<string, number> = {};
      pEvolutions.forEach(e => {
        if (e.mood) moods[e.mood] = (moods[e.mood] || 0) + 1;
      });
      const predominantMood = Object.entries(moods).sort((a, b) => b[1] - a[1])[0]?.[0];

      return {
        patientName: patient?.name || 'Desconhecido',
        clinicName: clinic?.name || '-',
        present,
        reposicao,
        absent,
        paidAbsent,
        total,
        rate,
        revenue,
        predominantMood,
        moods,
      };
    }).sort((a, b) => a.clinicName.localeCompare(b.clinicName) || b.total - a.total);
  }, [filteredEvolutions, patients, clinics, clinicPackages]);

  const dailyData = useMemo(() => {
    const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayEvolutions = filteredEvolutions.filter(e => e.date === dayStr);
      const present = dayEvolutions.filter(e => e.attendanceStatus === 'presente').length;
      const reposicao = dayEvolutions.filter(e => e.attendanceStatus === 'reposicao').length;
      const absent = dayEvolutions.filter(e => e.attendanceStatus === 'falta').length;
      const paidAbsent = dayEvolutions.filter(e => e.attendanceStatus === 'falta_remunerada').length;
      return {
        date: format(day, period === 'week' ? 'EEE' : 'dd', { locale: ptBR }),
        fullDate: format(day, 'dd/MM', { locale: ptBR }),
        Presenças: present + reposicao,
        Faltas: absent,
        'Faltas Rem.': paidAbsent,
      };
    });
  }, [filteredEvolutions, dateRange, period]);

  const pieData = useMemo(() => [
    { name: 'Presenças', value: attendanceStats.present },
    { name: 'Faltas', value: attendanceStats.absent },
    { name: 'Faltas Rem.', value: attendanceStats.paidAbsent },
  ].filter(d => d.value > 0), [attendanceStats]);

  const clinicComparison = useMemo(() => {
    return clinics
      .filter(clinic => !clinic.isArchived) // exclude archived clinics
      .map(clinic => {
        const clinicEvolutions = evolutions.filter(e => {
          const evolutionDate = parseISO(e.date);
          return e.clinicId === clinic.id && isWithinInterval(evolutionDate, { start: dateRange.start, end: dateRange.end });
        });
        const present = clinicEvolutions.filter(e => e.attendanceStatus === 'presente').length;
        const reposicao = clinicEvolutions.filter(e => e.attendanceStatus === 'reposicao').length;
        const absent = clinicEvolutions.filter(e => e.attendanceStatus === 'falta').length;
        const paidAbsent = clinicEvolutions.filter(e => e.attendanceStatus === 'falta_remunerada').length;
        const total = present + reposicao + absent + paidAbsent;
        const rate = total > 0 ? Math.round(((present + reposicao) / total) * 100) : 0;
        return {
          name: clinic.name.length > 15 ? clinic.name.slice(0, 15) + '...' : clinic.name,
          fullName: clinic.name,
          Presenças: present + reposicao,
          Faltas: absent,
          'Faltas Rem.': paidAbsent,
          taxa: rate,
          total,
        };
      })
      .filter(c => c.total > 0); // only show clinics with activity in the period
  }, [clinics, evolutions, dateRange]);

  const totalRevenue = useMemo(() => {
    return patientDetailedStats.reduce((sum, p) => sum + p.revenue, 0);
  }, [patientDetailedStats]);

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;

      const selectedClinicObj = selectedClinic !== 'all' ? clinics.find(c => c.id === selectedClinic) : null;

      // --- HEADER: Letterhead ---
      if (selectedClinicObj?.letterhead) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject();
            img.src = selectedClinicObj.letterhead!;
          });
          const imgW = contentWidth;
          const imgH = Math.min((img.height / img.width) * imgW, 40);
          pdf.addImage(selectedClinicObj.letterhead!, 'PNG', margin, y, imgW, imgH);
          y += imgH + 6;
        } catch { /* skip */ }
      }

      // Clinic or general header
      if (selectedClinicObj) {
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(50, 50, 50);
        pdf.text(selectedClinicObj.name, pageWidth / 2, y, { align: 'center' });
        y += 6;
        if (selectedClinicObj.address) {
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(100, 100, 100);
          pdf.text(selectedClinicObj.address, pageWidth / 2, y, { align: 'center' });
          y += 5;
        }
        const details: string[] = [];
        if (selectedClinicObj.phone) details.push(`Tel: ${selectedClinicObj.phone}`);
        if (selectedClinicObj.email) details.push(`Email: ${selectedClinicObj.email}`);
        if (selectedClinicObj.cnpj) details.push(`CNPJ: ${selectedClinicObj.cnpj}`);
        if (details.length > 0) {
          pdf.setFontSize(8);
          pdf.text(details.join(' | '), pageWidth / 2, y, { align: 'center' });
          y += 5;
        }
      }

      // Divider
      y += 3;
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 10;

      // Title
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(30, 30, 30);
      pdf.text('RELATÓRIO COMPLETO', pageWidth / 2, y, { align: 'center' });
      y += 8;

      // Period & therapist
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(80, 80, 80);
      const selectedClinicName = selectedClinic === 'all' ? 'Todas as clínicas' : (selectedClinicObj?.name || '');
      pdf.text(
        `Período: ${format(dateRange.start, 'dd/MM/yyyy', { locale: ptBR })} a ${format(dateRange.end, 'dd/MM/yyyy', { locale: ptBR })} | ${selectedClinicName}`,
        pageWidth / 2, y, { align: 'center' }
      );
      y += 6;

      if (profile?.name) {
        const terapeutaLine = profile.professional_id
          ? `Terapeuta: ${profile.name} (${profile.professional_id})`
          : `Terapeuta: ${profile.name}`;
        pdf.text(terapeutaLine, pageWidth / 2, y, { align: 'center' });
        y += 6;
      }

      y += 5;

      // ===== SECTION 1: RESUMO GERAL (Stats Cards) =====
      pdf.setTextColor(50, 50, 50);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Resumo de Frequência', margin, y);
      y += 8;

      const cardWidth = (contentWidth - 15) / 4;
      const cardHeight = 25;
      const statsCards = [
        { label: 'Total Atendimentos', value: String(attendanceStats.total), color: PDF_COLORS.primary },
        { label: 'Presenças', value: String(attendanceStats.present + attendanceStats.reposicao), color: PDF_COLORS.green },
        { label: 'Faltas', value: String(attendanceStats.absent), color: PDF_COLORS.destructive },
        { label: 'Taxa de Presença', value: `${attendanceStats.presenceRate}%`, color: PDF_COLORS.primary },
      ];

      statsCards.forEach((card, i) => {
        const x = margin + i * (cardWidth + 5);
        pdf.setFillColor(248, 250, 252);
        pdf.roundedRect(x, y, cardWidth, cardHeight, 3, 3, 'F');
        const rgb = hexToRgb(card.color);
        pdf.setFillColor(rgb[0], rgb[1], rgb[2]);
        pdf.roundedRect(x, y, 3, cardHeight, 1, 1, 'F');
        pdf.setTextColor(rgb[0], rgb[1], rgb[2]);
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text(card.value, x + 8, y + 12);
        pdf.setTextColor(100, 100, 100);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.text(card.label, x + 8, y + 20);
      });

      y += cardHeight + 12;

      // Faltas remuneradas info
      if (attendanceStats.paidAbsent > 0) {
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(180, 140, 30);
        pdf.text(`Faltas Remuneradas: ${attendanceStats.paidAbsent}`, margin, y);
        y += 8;
      }

      // ===== SECTION 2: HUMOR =====
      const moodEntries = Object.entries(moodStats).filter(([, v]) => v > 0);
      if (moodEntries.length > 0) {
        if (y > pageHeight - 50) { pdf.addPage(); y = margin; }
        pdf.setTextColor(50, 50, 50);
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Distribuição de Humor', margin, y);
        y += 8;

        pdf.setFillColor(245, 245, 245);
        const moodBoxH = 8 * moodEntries.length + 8;
        pdf.roundedRect(margin, y - 2, contentWidth, moodBoxH, 3, 3, 'F');
        
        pdf.setFontSize(9);
        moodEntries.forEach(([key, count]) => {
          const ml = MOOD_LABELS[key];
          if (!ml) return;
          const percent = attendanceStats.total > 0 ? Math.round((count / attendanceStats.total) * 100) : 0;
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(50, 50, 50);
          pdf.text(`${ml.label}:`, margin + 5, y + 4);
          pdf.setFont('helvetica', 'normal');
          pdf.text(`${count} registros (${percent}%)`, margin + 35, y + 4);

          // Mini bar
          const barMaxW = 80;
          const barW = (count / attendanceStats.total) * barMaxW;
          pdf.setFillColor(99, 102, 241);
          pdf.roundedRect(margin + 85, y + 1, barW, 4, 1, 1, 'F');

          y += 8;
        });
        y += 10;
      }

      // ===== SECTION 3: FATURAMENTO =====
      if (y > pageHeight - 50) { pdf.addPage(); y = margin; }
      pdf.setTextColor(50, 50, 50);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Resumo Financeiro', margin, y);
      y += 8;

      pdf.setFillColor(34, 197, 94);
      pdf.roundedRect(margin, y, contentWidth, 14, 3, 3, 'F');
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(255, 255, 255);
      pdf.text('RECEITA TOTAL NO PERÍODO', margin + 8, y + 9);
      pdf.text(`R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, pageWidth - margin - 8, y + 9, { align: 'right' });
      y += 22;

      // ===== SECTION 4: TABELA DETALHADA POR PACIENTE (agrupada por clínica) =====
      if (y > pageHeight - 40) { pdf.addPage(); y = margin; }
      pdf.setTextColor(50, 50, 50);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Detalhamento por Paciente', margin, y);
      y += 8;

      // Table header
      const cols = { name: margin, pres: margin + 62, falt: margin + 77, frem: margin + 90, taxa: margin + 104, mood: margin + 118, rev: pageWidth - margin };

      const drawTableHeader = () => {
        pdf.setFillColor(235, 235, 240);
        pdf.roundedRect(margin, y - 3, contentWidth, 9, 2, 2, 'F');
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(80, 80, 80);
        pdf.text('Paciente', cols.name + 2, y + 2);
        pdf.text('Pres.', cols.pres, y + 2);
        pdf.text('Faltas', cols.falt, y + 2);
        pdf.text('F.Rem.', cols.frem, y + 2);
        pdf.text('Taxa', cols.taxa, y + 2);
        pdf.text('Humor', cols.mood, y + 2);
        pdf.text('Receita', cols.rev, y + 2, { align: 'right' });
        y += 9;
      };

      // Group patients by clinic
      const clinicGroups: Record<string, typeof patientDetailedStats> = {};
      patientDetailedStats.forEach(p => {
        if (!clinicGroups[p.clinicName]) clinicGroups[p.clinicName] = [];
        clinicGroups[p.clinicName].push(p);
      });

      const clinicNames = Object.keys(clinicGroups).sort();

      clinicNames.forEach((clinicName, clinicIdx) => {
        const groupPatients = clinicGroups[clinicName];

        // Clinic group header
        if (y > pageHeight - 35) { pdf.addPage(); y = margin; }
        if (clinicIdx > 0) y += 4;
        pdf.setFillColor(99, 102, 241);
        pdf.roundedRect(margin, y - 3, contentWidth, 9, 2, 2, 'F');
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(255, 255, 255);
        pdf.text(clinicName, margin + 4, y + 2);
        y += 10;

        drawTableHeader();

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        let rowIdx = 0;
        groupPatients.forEach((p) => {
          if (y > pageHeight - 25) { pdf.addPage(); y = margin; drawTableHeader(); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); rowIdx = 0; }

          if (rowIdx % 2 === 0) {
            pdf.setFillColor(250, 250, 252);
            pdf.rect(margin, y - 3, contentWidth, 6, 'F');
          }

          pdf.setTextColor(50, 50, 50);
          pdf.text(p.patientName.substring(0, 30), cols.name + 2, y);

          pdf.setTextColor(34, 197, 94);
          pdf.text(String(p.present + p.reposicao), cols.pres + 3, y);
          pdf.setTextColor(239, 68, 68);
          pdf.text(String(p.absent), cols.falt + 3, y);
          pdf.setTextColor(234, 179, 8);
          pdf.text(String(p.paidAbsent), cols.frem + 3, y);

          pdf.setTextColor(50, 50, 50);
          pdf.text(`${p.rate}%`, cols.taxa, y);

          const moodLabel = p.predominantMood ? (MOOD_LABELS[p.predominantMood]?.label || '-') : '-';
          pdf.text(moodLabel, cols.mood, y);

          pdf.setFont('helvetica', 'bold');
          pdf.text(`R$ ${p.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, cols.rev, y, { align: 'right' });
          pdf.setFont('helvetica', 'normal');
          y += 6;
          rowIdx++;
        });

        // Subtotal per clinic
        const cPresent = groupPatients.reduce((s, p) => s + p.present + p.reposicao, 0);
        const cAbsent = groupPatients.reduce((s, p) => s + p.absent, 0);
        const cPaid = groupPatients.reduce((s, p) => s + p.paidAbsent, 0);
        const cTotal = cPresent + cAbsent + cPaid;
        const cRate = cTotal > 0 ? Math.round((cPresent / cTotal) * 100) : 0;
        const cRevenue = groupPatients.reduce((s, p) => s + p.revenue, 0);

        pdf.setDrawColor(180, 180, 180);
        pdf.line(margin, y, pageWidth - margin, y);
        y += 4;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7);
        pdf.setTextColor(80, 80, 80);
        pdf.text('Subtotal', cols.name + 2, y);
        pdf.setTextColor(34, 197, 94);
        pdf.text(String(cPresent), cols.pres + 3, y);
        pdf.setTextColor(239, 68, 68);
        pdf.text(String(cAbsent), cols.falt + 3, y);
        pdf.setTextColor(234, 179, 8);
        pdf.text(String(cPaid), cols.frem + 3, y);
        pdf.setTextColor(80, 80, 80);
        pdf.text(`${cRate}%`, cols.taxa, y);
        pdf.text(`R$ ${cRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, cols.rev, y, { align: 'right' });
        y += 8;
      });

      // Grand total
      y += 2;
      pdf.setDrawColor(60, 60, 60);
      pdf.setLineWidth(0.5);
      pdf.line(margin, y, pageWidth - margin, y);
      pdf.setLineWidth(0.2);
      y += 5;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(50, 50, 50);
      pdf.text('TOTAL GERAL', cols.name + 2, y);
      pdf.setTextColor(34, 197, 94);
      pdf.text(String(attendanceStats.present + attendanceStats.reposicao), cols.pres + 3, y);
      pdf.setTextColor(239, 68, 68);
      pdf.text(String(attendanceStats.absent), cols.falt + 3, y);
      pdf.setTextColor(234, 179, 8);
      pdf.text(String(attendanceStats.paidAbsent), cols.frem + 3, y);
      pdf.setTextColor(50, 50, 50);
      pdf.text(`${attendanceStats.presenceRate}%`, cols.taxa, y);
      pdf.text(`R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, cols.rev, y, { align: 'right' });
      y += 12;

      // ===== SECTION 5: RESUMO POR CLÍNICA =====
      if (clinicComparison.length > 1) {
        if (y > pageHeight - 50) { pdf.addPage(); y = margin; }
        pdf.setTextColor(50, 50, 50);
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Resumo por Clínica', margin, y);
        y += 8;

        pdf.setFillColor(235, 235, 240);
        pdf.roundedRect(margin, y - 3, contentWidth, 9, 2, 2, 'F');
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(80, 80, 80);
        pdf.text('Clínica', margin + 2, y + 2);
        pdf.text('Presenças', margin + 70, y + 2);
        pdf.text('Faltas', margin + 95, y + 2);
        pdf.text('F.Rem.', margin + 115, y + 2);
        pdf.text('Total', margin + 135, y + 2);
        pdf.text('Taxa', pageWidth - margin, y + 2, { align: 'right' });
        y += 9;

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        clinicComparison.forEach((c, idx) => {
          if (y > pageHeight - 25) { pdf.addPage(); y = margin; }
          if (idx % 2 === 0) {
            pdf.setFillColor(250, 250, 252);
            pdf.rect(margin, y - 3, contentWidth, 7, 'F');
          }
          pdf.setTextColor(50, 50, 50);
          pdf.text(c.fullName.substring(0, 30), margin + 2, y);
          pdf.setTextColor(34, 197, 94);
          pdf.text(String(c.Presenças), margin + 75, y);
          pdf.setTextColor(239, 68, 68);
          pdf.text(String(c.Faltas), margin + 100, y);
          pdf.setTextColor(234, 179, 8);
          pdf.text(String(c['Faltas Rem.']), margin + 120, y);
          pdf.setTextColor(50, 50, 50);
          pdf.text(String(c.Presenças + c.Faltas + c['Faltas Rem.']), margin + 138, y);
          pdf.text(`${c.taxa}%`, pageWidth - margin, y, { align: 'right' });
          y += 7;
        });
      }

      // Stamp if single clinic selected
      if (selectedClinicObj?.stamp) {
        try {
          const stampImg = new Image();
          stampImg.crossOrigin = 'anonymous';
          await new Promise<void>((resolve, reject) => {
            stampImg.onload = () => resolve();
            stampImg.onerror = () => reject();
            stampImg.src = selectedClinicObj.stamp!;
          });
          const maxW = 50;
          const maxH = 30;
          let sw = maxW;
          let sh = (stampImg.height / stampImg.width) * sw;
          if (sh > maxH) { sh = maxH; sw = (stampImg.width / stampImg.height) * sh; }
          const stampY = pageHeight - 50 - sh;
          if (y + 15 < stampY) {
            pdf.addImage(selectedClinicObj.stamp, 'PNG', pageWidth - margin - sw, stampY, sw, sh);
            pdf.setDrawColor(100, 100, 100);
            pdf.line(pageWidth - margin - sw, stampY + sh + 3, pageWidth - margin, stampY + sh + 3);
            pdf.setFontSize(7);
            pdf.setTextColor(128, 128, 128);
            pdf.text('Carimbo', pageWidth - margin - sw / 2, stampY + sh + 7, { align: 'center' });
          }
        } catch { /* skip */ }
      }

      // Footer on all pages
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(128, 128, 128);
        pdf.setFont('helvetica', 'normal');
        pdf.text(
          `Página ${i} de ${totalPages} | Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
          pageWidth / 2, pageHeight - 10, { align: 'center' }
        );
        pdf.setFontSize(6);
        pdf.setTextColor(190, 190, 190);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Plataforma Clínica - Evolução Diária', margin, pageHeight - 5);
        pdf.setFont('helvetica', 'normal');
      }

      pdf.save(`relatorio-completo-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6" ref={reportRef}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground">Análise completa de frequência, humor e faturamento</p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <Select value={period} onValueChange={(v: 'week' | 'month' | 'custom') => setPeriod(v)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Semanal</SelectItem>
              <SelectItem value="month">Mensal</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>

          {period === 'custom' && (
            <>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[140px] justify-start text-left font-normal", !customStart && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customStart ? format(customStart, 'dd/MM/yyyy') : 'Início'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customStart} onSelect={setCustomStart} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[140px] justify-start text-left font-normal", !customEnd && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customEnd ? format(customEnd, 'dd/MM/yyyy') : 'Fim'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customEnd} onSelect={setCustomEnd} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </>
          )}

          <Select value={selectedClinic} onValueChange={setSelectedClinic}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todas as clínicas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as clínicas</SelectItem>
              {clinics.map(clinic => (
                <SelectItem key={clinic.id} value={clinic.id}>{clinic.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={handleExportPDF} disabled={isExporting} className="gap-2">
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{attendanceStats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Check className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-500">{attendanceStats.present}</p>
                <p className="text-xs text-muted-foreground">Presenças</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <X className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold text-destructive">{attendanceStats.absent}</p>
                <p className="text-xs text-muted-foreground">Faltas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <DollarSign className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-500">{attendanceStats.paidAbsent}</p>
                <p className="text-xs text-muted-foreground">Faltas Rem.</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{attendanceStats.presenceRate}%</p>
                <p className="text-xs text-muted-foreground">Taxa Presença</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mood Summary */}
      {Object.keys(moodStats).length > 0 && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Smile className="w-5 h-5" /> Distribuição de Humor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {Object.entries(MOOD_LABELS).map(([key, { emoji, label }]) => {
                const count = moodStats[key] || 0;
                if (count === 0) return null;
                const percent = attendanceStats.total > 0 ? Math.round((count / attendanceStats.total) * 100) : 0;
                return (
                  <div key={key} className="flex items-center gap-2 bg-secondary/50 rounded-xl px-4 py-3">
                    <span className="text-2xl">{emoji}</span>
                    <div>
                      <p className="font-bold text-foreground">{count}</p>
                      <p className="text-xs text-muted-foreground">{label} ({percent}%)</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div data-charts>
        <Tabs defaultValue="daily" className="space-y-4">
          <TabsList className="grid w-full max-w-lg grid-cols-4">
            <TabsTrigger value="daily" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Diário</span>
            </TabsTrigger>
            <TabsTrigger value="distribution" className="gap-2">
              <PieChartIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Distribuição</span>
            </TabsTrigger>
            <TabsTrigger value="clinics" className="gap-2">
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">Clínicas</span>
            </TabsTrigger>
            <TabsTrigger value="detailed" className="gap-2">
              <Table2 className="w-4 h-4" />
              <span className="hidden sm:inline">Detalhado</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="daily">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-lg">Frequência Diária - {dateRange.label}</CardTitle>
              </CardHeader>
              <CardContent>
                {dailyData.some(d => d.Presenças > 0 || d.Faltas > 0) ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={dailyData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey={period === 'week' ? 'date' : 'fullDate'} tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Presenças" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Faltas" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Faltas Rem." fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Nenhum dado de frequência para o período selecionado
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="distribution">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-lg">Distribuição de Frequência - {dateRange.label}</CardTitle>
              </CardHeader>
              <CardContent>
                {attendanceStats.total > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {pieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Nenhum dado de frequência para o período selecionado
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="clinics">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-lg">Comparativo por Clínica - {dateRange.label}</CardTitle>
              </CardHeader>
              <CardContent>
                {clinicComparison.some(c => c.Presenças > 0 || c.Faltas > 0) ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={clinicComparison} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Presenças" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Faltas" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Faltas Rem." fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Nenhum dado de frequência para o período selecionado
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Detailed Patient Table */}
          <TabsContent value="detailed">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-lg">Relatório Detalhado por Paciente - {dateRange.label}</CardTitle>
              </CardHeader>
              <CardContent>
                {patientDetailedStats.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-3 px-2 font-medium text-muted-foreground">Paciente</th>
                          <th className="text-left py-3 px-2 font-medium text-muted-foreground hidden md:table-cell">Clínica</th>
                          <th className="text-center py-3 px-2 font-medium text-muted-foreground">Pres.</th>
                          <th className="text-center py-3 px-2 font-medium text-muted-foreground">Repos.</th>
                          <th className="text-center py-3 px-2 font-medium text-muted-foreground">Faltas</th>
                          <th className="text-center py-3 px-2 font-medium text-muted-foreground">F.Rem.</th>
                          <th className="text-center py-3 px-2 font-medium text-muted-foreground">Taxa</th>
                          <th className="text-center py-3 px-2 font-medium text-muted-foreground hidden sm:table-cell">Humor</th>
                          <th className="text-right py-3 px-2 font-medium text-muted-foreground">Receita</th>
                        </tr>
                      </thead>
                      <tbody>
                        {patientDetailedStats.map((p, i) => (
                          <tr key={i} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                            <td className="py-3 px-2 font-medium text-foreground">{p.patientName}</td>
                            <td className="py-3 px-2 text-muted-foreground hidden md:table-cell">{p.clinicName}</td>
                            <td className="py-3 px-2 text-center text-green-500 font-semibold">{p.present}</td>
                            <td className="py-3 px-2 text-center text-primary font-semibold">{p.reposicao}</td>
                            <td className="py-3 px-2 text-center text-destructive font-semibold">{p.absent}</td>
                            <td className="py-3 px-2 text-center text-amber-500 font-semibold">{p.paidAbsent}</td>
                            <td className="py-3 px-2 text-center">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                p.rate >= 80 ? 'bg-green-500/10 text-green-500' :
                                p.rate >= 50 ? 'bg-yellow-500/10 text-yellow-500' :
                                'bg-destructive/10 text-destructive'
                              }`}>
                                {p.rate}%
                              </span>
                            </td>
                            <td className="py-3 px-2 text-center hidden sm:table-cell">
                              {p.predominantMood ? (
                                <span title={MOOD_LABELS[p.predominantMood]?.label}>
                                  {MOOD_LABELS[p.predominantMood]?.emoji || '-'}
                                </span>
                              ) : '-'}
                            </td>
                            <td className="py-3 px-2 text-right font-semibold text-foreground">
                              R$ {p.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                        {/* Totals row */}
                        <tr className="border-t-2 border-border font-bold">
                          <td className="py-3 px-2 text-foreground">Total</td>
                          <td className="py-3 px-2 hidden md:table-cell"></td>
                          <td className="py-3 px-2 text-center text-green-500">{attendanceStats.present}</td>
                          <td className="py-3 px-2 text-center text-primary">{attendanceStats.reposicao}</td>
                          <td className="py-3 px-2 text-center text-destructive">{attendanceStats.absent}</td>
                          <td className="py-3 px-2 text-center text-amber-500">{attendanceStats.paidAbsent}</td>
                          <td className="py-3 px-2 text-center">{attendanceStats.presenceRate}%</td>
                          <td className="py-3 px-2 hidden sm:table-cell"></td>
                          <td className="py-3 px-2 text-right text-foreground">
                            R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                    Nenhum dado para o período selecionado
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Clinic Summary Table */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg">Resumo por Clínica</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Clínica</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Presenças</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Faltas</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">F.Rem.</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Total</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Taxa</th>
                </tr>
              </thead>
              <tbody>
                {clinicComparison.map((clinic, index) => (
                  <tr key={index} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="py-3 px-4 font-medium text-foreground">{clinic.fullName}</td>
                    <td className="py-3 px-4 text-center text-green-500 font-semibold">{clinic.Presenças}</td>
                    <td className="py-3 px-4 text-center text-destructive font-semibold">{clinic.Faltas}</td>
                    <td className="py-3 px-4 text-center text-amber-500 font-semibold">{clinic['Faltas Rem.']}</td>
                    <td className="py-3 px-4 text-center text-foreground">{clinic.Presenças + clinic.Faltas + clinic['Faltas Rem.']}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        clinic.taxa >= 80 ? 'bg-green-500/10 text-green-500' :
                        clinic.taxa >= 50 ? 'bg-yellow-500/10 text-yellow-500' :
                        'bg-destructive/10 text-destructive'
                      }`}>
                        {clinic.taxa}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
