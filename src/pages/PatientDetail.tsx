import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Phone, Cake, FileText, Plus, CheckCircle2, Image, Stamp as StampIcon, Download, CalendarRange, PenLine, Edit, X, Paperclip, ListTodo, Package, Sparkles, Pencil, Trash2, Loader2, Wand2, Archive, ArchiveRestore, BarChart3, ChevronLeft, ChevronRight, TrendingUp, DollarSign, Users, Calendar } from 'lucide-react';
import { generateEvolutionPdf, generateMultipleEvolutionsPdf } from '@/utils/generateEvolutionPdf';
import { useClinicOrg } from '@/hooks/useClinicOrg';
import { Button } from '@/components/ui/button';
import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { FileUpload, UploadedFile } from '@/components/ui/file-upload';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { EditEvolutionDialog } from '@/components/evolutions/EditEvolutionDialog';
import { EditPatientDialog } from '@/components/patients/EditPatientDialog';
import TemplateForm from '@/components/evolutions/TemplateForm';
import { MoodSelector, DEFAULT_MOOD_OPTIONS } from '@/components/evolutions/MoodSelector';
import { useCustomMoods } from '@/hooks/useCustomMoods';
import { EvolutionTemplate, TemplateField } from '@/types';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Evolution } from '@/types';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { generateReportPdf } from '@/utils/generateReportPdf';
import jsPDF from 'jspdf';

const MOOD_OPTIONS = DEFAULT_MOOD_OPTIONS.map((m, i) => ({
  ...m,
  score: [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 3, 2, 2, 2, 3][i] ?? 5,
}));

function getMoodInfo(mood?: string, customMoods?: { id: string; emoji: string; label: string; score: number }[]) {
  const found = MOOD_OPTIONS.find(m => m.value === mood);
  if (found) return found;
  const custom = customMoods?.find(m => m.id === mood);
  if (custom) return { value: custom.id, emoji: custom.emoji, label: custom.label, score: custom.score };
  return undefined;
}

function calculateAge(birthdate: string | null | undefined): number | null {
  if (!birthdate) return null;
  const today = new Date();
  const birth = new Date(birthdate);
  if (isNaN(birth.getTime())) return null;
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

const MoodTooltip = ({ active, payload, customMoods }: any) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  const moodInfo = getMoodInfo(data.moodValue, customMoods) || MOOD_OPTIONS.find(o => o.score === data.score);
  return (
    <div className="bg-card border border-border rounded-lg p-2 shadow-lg text-xs">
      <p className="font-medium">{data.dateLabel}</p>
      <p>{moodInfo?.emoji} {moodInfo?.label}</p>
    </div>
  );
};

function PatientSavedReports({ patientId, clinicName, clinicAddress, clinicLetterhead, clinicEmail, clinicCnpj, clinicPhone, clinicServicesDescription }: { patientId: string; clinicName?: string; clinicAddress?: string; clinicLetterhead?: string; clinicEmail?: string; clinicCnpj?: string; clinicPhone?: string; clinicServicesDescription?: string }) {
  const [reports, setReports] = useState<{ id: string; title: string; content: string; created_at: string }[]>([]);

  useEffect(() => {
    supabase.from('saved_reports').select('id, title, content, created_at')
      .eq('patient_id', patientId).order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setReports(data); });
  }, [patientId]);

  const handleDownloadPdf = (report: { title: string; content: string }) => {
    generateReportPdf({ title: report.title, content: report.content, clinicName, clinicAddress, clinicLetterhead, clinicEmail, clinicCnpj, clinicPhone, clinicServicesDescription });
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('saved_reports').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir'); return; }
    setReports(prev => prev.filter(r => r.id !== id));
    toast.success('Relatório excluído!');
  };

  if (reports.length === 0) return null;

  return (
    <div className="pt-4 border-t border-border">
      <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2 text-sm">
        <Sparkles className="w-4 h-4 text-primary" /> Relatórios IA deste paciente
      </h3>
      <div className="space-y-2">
        {reports.map(r => (
          <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
            <div>
              <p className="font-medium text-foreground text-sm">{r.title}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(r.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1" onClick={() => handleDownloadPdf(r)}>
                <Download className="w-3 h-3" /> PDF
              </Button>
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(r.id)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { patients, clinics, evolutions, attachments, addEvolution, updateEvolution, deleteEvolution, currentClinic,
    addTask, toggleTask, deleteTask, getPatientTasks, getPatientAttachments, addAttachment, deleteAttachment, clinicPackages, updatePatient, deletePatient, getClinicPackages, loadEvolutionsForClinic, loadAttachmentsForPatient } = useApp();
  const { user } = useAuth();
  const { customMoods } = useCustomMoods();

  const patient = patients.find(p => p.id === id);
  const clinic = clinics.find(c => c.id === patient?.clinicId);
  const { isOrg, members } = useClinicOrg(patient?.clinicId || '');

  useEffect(() => {
    if (!patient?.clinicId) return;
    loadEvolutionsForClinic(patient.clinicId);
  }, [patient?.clinicId]);

  useEffect(() => {
    if (!id) return;
    loadAttachmentsForPatient(id);
  }, [id]);

  const patientEvolutions = useMemo(() => {
    const evos = evolutions
      .filter(e => e.patientId === id)
      .sort((a, b) => new Date(b.date + 'T12:00:00').getTime() - new Date(a.date + 'T12:00:00').getTime());
    return evos.map(evo => ({
      ...evo,
      attachments: evo.attachments && evo.attachments.length > 0
        ? evo.attachments
        : attachments.filter(a => a.parentId === evo.id && a.parentType === 'evolution'),
    }));
  }, [evolutions, attachments, id]);

  const patientTasksList = id ? getPatientTasks(id) : [];
  const patientAttachments = id ? getPatientAttachments(id) : [];
  const patientPackage = patient?.packageId ? clinicPackages.find(p => p.id === patient.packageId) : null;

  const [evolutionText, setEvolutionText] = useState('');
  const [evolutionDate, setEvolutionDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [attendanceStatus, setAttendanceStatus] = useState<Evolution['attendanceStatus']>('presente');
  const [selectedMood, setSelectedMood] = useState<string>('');
  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [periodDialogOpen, setPeriodDialogOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [editingEvolution, setEditingEvolution] = useState<Evolution | null>(null);
  const [editPatientOpen, setEditPatientOpen] = useState(false);
  const [deletePatientOpen, setDeletePatientOpen] = useState(false);
  const [archivePatientOpen, setArchivePatientOpen] = useState(false);
  const [stamps, setStamps] = useState<{ id: string; name: string; clinical_area: string; stamp_image: string | null; signature_image: string | null; is_default: boolean }[]>([]);
  const [selectedStampId, setSelectedStampId] = useState<string>('');
  const [isImprovingText, setIsImprovingText] = useState(false);
  const [clinicTemplates, setClinicTemplates] = useState<EvolutionTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [templateFormValues, setTemplateFormValues] = useState<Record<string, any>>({});

  // Monthly report state
  const [reportMonth, setReportMonth] = useState(new Date());
  const [isExportingMonthly, setIsExportingMonthly] = useState(false);
  const [isExportingFinancial, setIsExportingFinancial] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('stamps').select('*').eq('user_id', user.id).order('created_at').then(({ data }) => {
      if (data) {
        setStamps(data);
        const defaultStamp = data.find(s => s.is_default);
        if (defaultStamp) setSelectedStampId(defaultStamp.id);
      }
    });
  }, [user]);

  useEffect(() => {
    if (!user || !patient?.clinicId) return;
    supabase.from('evolution_templates').select('*')
      .eq('clinic_id', patient.clinicId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        if (data) {
          setClinicTemplates(data.map(t => ({
            id: t.id, clinicId: t.clinic_id, name: t.name,
            description: t.description || undefined,
            fields: (t.fields as any as TemplateField[]) || [],
            isActive: t.is_active ?? true,
            createdAt: t.created_at, updatedAt: t.updated_at,
          })));
        }
      });
  }, [user, patient?.clinicId]);

  const patientDocsAsUploadedFiles: UploadedFile[] = useMemo(() => patientAttachments.map(a => ({
    id: a.id, name: a.name, filePath: a.data, fileType: a.type,
    url: a.data.startsWith('http') ? a.data : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/attachments/${a.data}`,
  })), [patientAttachments]);

  // All-time summaries (computed before early return so hooks order is stable)
  const totalPresent = patientEvolutions.filter(e => e.attendanceStatus === 'presente').length;
  const totalReposicao = patientEvolutions.filter(e => e.attendanceStatus === 'reposicao').length;
  const totalAbsent = patientEvolutions.filter(e => e.attendanceStatus === 'falta').length;
  const totalPaidAbsent = patientEvolutions.filter(e => e.attendanceStatus === 'falta_remunerada').length;
  const totalFeriadoRem = patientEvolutions.filter(e => e.attendanceStatus === 'feriado_remunerado').length;
  const totalFeriadoNaoRem = patientEvolutions.filter(e => e.attendanceStatus === 'feriado_nao_remunerado').length;
  const totalSessions = patientEvolutions.length;
  const attendanceRate = totalSessions > 0 ? Math.round(((totalPresent + totalReposicao) / totalSessions) * 100) : 0;
  const totalFinancial = (totalPresent + totalReposicao + totalPaidAbsent + totalFeriadoRem) * (patient?.paymentValue || 0);

  const allMoodOptions = [
    ...MOOD_OPTIONS,
    ...customMoods.map(m => ({ value: m.id, emoji: m.emoji, label: m.label, score: m.score })),
  ];
  const moodCounts = allMoodOptions.map(m => ({
    ...m, count: patientEvolutions.filter(e => e.mood === m.value).length,
  }));
  const totalMoods = moodCounts.reduce((sum, m) => sum + m.count, 0);

  const moodChartData = patientEvolutions
    .filter(e => e.mood)
    .sort((a, b) => new Date(a.date + 'T12:00:00').getTime() - new Date(b.date + 'T12:00:00').getTime())
    .map(e => {
      const moodInfo = getMoodInfo(e.mood, customMoods);
      return {
        date: e.date,
        moodValue: e.mood,
        dateLabel: format(new Date(e.date + 'T12:00:00'), 'dd/MM', { locale: ptBR }),
        score: moodInfo?.score || 3,
        emoji: moodInfo?.emoji || '😐',
      };
    });

  // Monthly report data
  const monthlyEvolutions = useMemo(() => {
    const start = startOfMonth(reportMonth);
    const end = endOfMonth(reportMonth);
    return patientEvolutions.filter(e => {
      const d = new Date(e.date + 'T12:00:00');
      return d >= start && d <= end;
    }).sort((a, b) => new Date(a.date + 'T12:00:00').getTime() - new Date(b.date + 'T12:00:00').getTime());
  }, [patientEvolutions, reportMonth]);

  const monthlyPresent = monthlyEvolutions.filter(e => e.attendanceStatus === 'presente').length;
  const monthlyReposicao = monthlyEvolutions.filter(e => e.attendanceStatus === 'reposicao').length;
  const monthlyAbsent = monthlyEvolutions.filter(e => e.attendanceStatus === 'falta').length;
  const monthlyPaidAbsent = monthlyEvolutions.filter(e => e.attendanceStatus === 'falta_remunerada').length;
  const monthlyFeriadoRem = monthlyEvolutions.filter(e => e.attendanceStatus === 'feriado_remunerado').length;
  const monthlyFeriadoNaoRem = monthlyEvolutions.filter(e => e.attendanceStatus === 'feriado_nao_remunerado').length;
  const monthlyTotal = monthlyEvolutions.length;
  const monthlyRevenue = (monthlyPresent + monthlyReposicao + monthlyPaidAbsent + monthlyFeriadoRem) * ((patient?.paymentValue) || 0);
  const monthlyAttendanceRate = monthlyTotal > 0 ? Math.round(((monthlyPresent + monthlyReposicao) / monthlyTotal) * 100) : 0;
  const monthlyMoodCounts = allMoodOptions.map(m => ({
    ...m, count: monthlyEvolutions.filter(e => e.mood === m.value).length,
  }));

  if (!patient) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Paciente não encontrado</p>
        <Button onClick={() => navigate('/clinics')} className="mt-4">Voltar</Button>
      </div>
    );
  }

  // ── shared PDF builder helpers ──────────────────────────────────────────────
  const buildPdfBase = (doc: jsPDF) => {
    const W = 210, margin = 20, contentW = W - margin * 2;
    const darkText: [number, number, number] = [30, 30, 40];
    const mutedText: [number, number, number] = [100, 100, 115];
    const borderColor: [number, number, number] = [210, 210, 220];
    const accentDark: [number, number, number] = [50, 50, 100];
    return { W, margin, contentW, darkText, mutedText, borderColor, accentDark };
  };

  const addSignatureBlock = async (
    doc: jsPDF, y: number,
    { W, margin, darkText, mutedText, borderColor, accentDark }: ReturnType<typeof buildPdfBase>,
    stampOverride?: typeof stamps[0] | null,
    showBlankLine = true,
  ) => {
    if (y > 230) { doc.addPage(); y = 20; }

    doc.setDrawColor(...borderColor);
    doc.line(margin, y + 4, W - margin, y + 4);
    y += 12;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...accentDark);
    doc.text('RESPONSÁVEL PELO ATENDIMENTO', margin, y);
    y += 7;

    if (stampOverride) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...darkText);
      doc.text(stampOverride.name, margin, y);
      doc.setTextColor(...mutedText);
      doc.text(stampOverride.clinical_area, margin + 60, y);
      y += 8;

      if (stampOverride.signature_image) {
        try {
          const imgEl = document.createElement('img');
          imgEl.src = stampOverride.signature_image;
          await new Promise<void>(r => { imgEl.onload = () => r(); imgEl.onerror = () => r(); });
          doc.addImage(stampOverride.signature_image, 'PNG', margin, y, 60, 18, undefined, 'FAST');
          y += 22;
        } catch { /* skip */ }
      }

      if (stampOverride.stamp_image) {
        try {
          const imgEl2 = document.createElement('img');
          imgEl2.src = stampOverride.stamp_image;
          await new Promise<void>(r => { imgEl2.onload = () => r(); imgEl2.onerror = () => r(); });
          doc.addImage(stampOverride.stamp_image, 'PNG', margin, y, 40, 40, undefined, 'FAST');
          y += 44;
        } catch { /* skip */ }
      }
    } else if (showBlankLine) {
      // blank signature line
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...mutedText);
      doc.text('Nome:', margin, y);
      doc.setDrawColor(...borderColor);
      doc.line(margin + 14, y + 1, margin + 100, y + 1);
      y += 10;
      doc.text('Assinatura:', margin, y);
      doc.line(margin + 24, y + 1, margin + 100, y + 1);
      y += 10;
      doc.text('Data:', margin, y);
      doc.line(margin + 12, y + 1, margin + 60, y + 1);
      y += 8;
    }
    return y;
  };

  // ── RELATÓRIO DE ATENDIMENTO (presença + falta + reposição) ──────────────
  const handleExportMonthlyPDF = async () => {
    if (monthlyEvolutions.length === 0) { toast.error('Nenhuma evolução neste mês.'); return; }
    setIsExportingMonthly(true);
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const base = buildPdfBase(doc);
      const { W, margin, contentW, darkText, mutedText, borderColor, accentDark } = base;
      const monthLabel = format(reportMonth, 'MMMM yyyy', { locale: ptBR });
      const monthLabelCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
      let y = margin;

      // ── HEADER ──────────────────────────────────────────────────
      doc.setTextColor(...darkText);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('RELATÓRIO MENSAL DE ATENDIMENTO', margin, y);
      y += 7;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...mutedText);
      doc.text(`${patient.name}   —   ${monthLabelCap}`, margin, y);
      y += 5;
      doc.setDrawColor(...borderColor);
      doc.line(margin, y, W - margin, y);
      y += 8;

      // ── IDENTIFICAÇÃO ────────────────────────────────────────────
      const idLines: [string, string][] = [];
      if (patient.name) idLines.push(['Paciente:', patient.name]);
      if (patient.birthdate) {
        const age = calculateAge(patient.birthdate);
        idLines.push(['Data de Nascimento:', `${format(new Date(patient.birthdate + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}${age !== null ? ` (${age} anos)` : ''}`]);
      }
      if (clinic?.name) idLines.push(['Unidade Clínica:', clinic.name]);
      if (patient.clinicalArea) idLines.push(['Área Clínica:', patient.clinicalArea]);
      if (patient.diagnosis) idLines.push(['Diagnóstico:', patient.diagnosis]);
      if (patient.professionals) idLines.push(['Profissional(is):', patient.professionals]);
      idLines.push(['Período de Referência:', monthLabelCap]);
      idLines.push(['Data de Emissão:', format(new Date(), 'dd/MM/yyyy', { locale: ptBR })]);

      idLines.forEach(([label, value]) => {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...darkText);
        doc.text(label, margin, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...mutedText);
        const wrapped = doc.splitTextToSize(value, contentW - 52);
        doc.text(wrapped, margin + 52, y);
        y += wrapped.length > 1 ? wrapped.length * 5 + 1 : 6;
      });

      doc.setDrawColor(...borderColor);
      doc.line(margin, y + 2, W - margin, y + 2);
      y += 10;

      // ── 1. RESUMO DE FREQUÊNCIA ──────────────────────────────────
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...accentDark);
      doc.text('1. RESUMO DE FREQUÊNCIA', margin, y); y += 8;

      const summaryRows: [string, string][] = [
        ['Total de sessões registradas:', String(monthlyTotal)],
        ['Presenças:', String(monthlyPresent)],
        ['Reposições:', String(monthlyReposicao)],
        ['Sessões realizadas (presença + reposição):', String(monthlyPresent + monthlyReposicao)],
        ['Faltas:', String(monthlyAbsent)],
        ['Taxa de frequência:', `${monthlyAttendanceRate}%`],
      ];
      summaryRows.forEach(([label, value]) => {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...darkText);
        doc.text(label, margin + 4, y);
        doc.setFont('helvetica', 'bold');
        doc.text(value, W - margin - 2, y, { align: 'right' });
        y += 6;
      });
      doc.setDrawColor(...borderColor); doc.line(margin, y + 2, W - margin, y + 2); y += 10;

      // ── 2. HUMOR ─────────────────────────────────────────────────
      const moodsWithData = monthlyMoodCounts.filter(m => m.count > 0);
      if (moodsWithData.length > 0) {
        doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...accentDark);
        doc.text('2. HUMOR DO MÊS', margin, y); y += 8;
        moodsWithData.forEach(m => {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...darkText);
          doc.text(`${m.label}:`, margin + 4, y);
          doc.setFont('helvetica', 'bold');
          doc.text(String(m.count), W - margin - 2, y, { align: 'right' });
          y += 6;
        });
        doc.setDrawColor(...borderColor); doc.line(margin, y + 2, W - margin, y + 2); y += 10;
      }

      // ── 3. REGISTRO DAS SESSÕES ──────────────────────────────────
      const section3 = moodsWithData.length > 0 ? '3' : '2';
      const visibleEvolutions = monthlyEvolutions.filter(e =>
        ['presente', 'falta', 'reposicao'].includes(e.attendanceStatus)
      );
      const statusLabelMap: Record<string, string> = {
        presente: 'Presente', falta: 'Falta', reposicao: 'Reposição',
      };
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...accentDark);
      doc.text(`${section3}. REGISTRO DAS SESSÕES (${visibleEvolutions.length})`, margin, y); y += 8;

      for (const evo of visibleEvolutions) {
        if (y > 252) { doc.addPage(); y = margin; }
        const dateStr = format(new Date(evo.date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR });
        const status = statusLabelMap[evo.attendanceStatus] || evo.attendanceStatus;
        const moodInfo = getMoodInfo(evo.mood, customMoods);
        doc.setDrawColor(...borderColor);
        doc.line(margin, y - 1, W - margin, y - 1);
        doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...darkText);
        doc.text(dateStr, margin + 2, y + 5);
        doc.setFont('helvetica', 'normal'); doc.setTextColor(...mutedText);
        doc.text(`Status: ${status}`, margin + 32, y + 5);
        if (moodInfo) doc.text(`Humor: ${moodInfo.label}`, margin + 100, y + 5);
        y += 9;
        if (evo.text) {
          doc.setTextColor(...darkText); doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
          const textLines = doc.splitTextToSize(evo.text, contentW - 4);
          textLines.forEach((line: string) => {
            if (y > 268) { doc.addPage(); y = margin; }
            doc.text(line, margin + 2, y); y += 5;
          });
          y += 3;
        } else { y += 2; }
      }

      // ── ASSINATURA (sempre presente) ─────────────────────────────
      const chosenStamp = selectedStampId && selectedStampId !== 'none'
        ? stamps.find(s => s.id === selectedStampId)
        : stamps.find(s => s.is_default);
      y = await addSignatureBlock(doc, y, base, chosenStamp ?? null, true);

      // ── RODAPÉ ───────────────────────────────────────────────────
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFontSize(7.5); doc.setTextColor(...mutedText);
        doc.text(
          `${patient.name}  —  Relatório de Referência: ${monthLabelCap}  —  Emitido em: ${format(new Date(), 'dd/MM/yyyy', { locale: ptBR })}  —  Pag. ${p}/${pageCount}`,
          W / 2, 291, { align: 'center' }
        );
      }
      doc.save(`relatorio-atendimento-${patient.name.replace(/\s+/g, '-').toLowerCase()}-${format(reportMonth, 'yyyy-MM')}.pdf`);
      toast.success('PDF gerado com sucesso!');
    } catch (err) { console.error(err); toast.error('Erro ao gerar PDF'); }
    finally { setIsExportingMonthly(false); }
  };

  // ── RELATÓRIO FINANCEIRO (todos os status + valores) ─────────────────────
  const handleExportFinancialPDF = async () => {
    if (monthlyEvolutions.length === 0) { toast.error('Nenhuma evolução neste mês.'); return; }
    setIsExportingFinancial(true);
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const base = buildPdfBase(doc);
      const { W, margin, contentW, darkText, mutedText, borderColor, accentDark } = base;
      const monthLabel = format(reportMonth, 'MMMM yyyy', { locale: ptBR });
      const monthLabelCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
      let y = margin;

      // ── HEADER ──────────────────────────────────────────────────
      doc.setTextColor(...darkText); doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.text('RELATÓRIO FINANCEIRO MENSAL', margin, y); y += 7;
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...mutedText);
      doc.text(`${patient.name}   —   ${monthLabelCap}`, margin, y); y += 5;
      doc.setDrawColor(...borderColor); doc.line(margin, y, W - margin, y); y += 8;

      // ── IDENTIFICAÇÃO ────────────────────────────────────────────
      const idLines: [string, string][] = [];
      if (patient.name) idLines.push(['Paciente:', patient.name]);
      if (clinic?.name) idLines.push(['Unidade Clínica:', clinic.name]);
      if (patient.clinicalArea) idLines.push(['Área Clínica:', patient.clinicalArea]);
      if (patient.professionals) idLines.push(['Profissional(is):', patient.professionals]);
      if (patient.paymentValue) idLines.push(['Valor por Sessão:', `R$ ${patient.paymentValue.toFixed(2)}`]);
      idLines.push(['Período de Referência:', monthLabelCap]);
      idLines.push(['Data de Emissão:', format(new Date(), 'dd/MM/yyyy', { locale: ptBR })]);
      idLines.forEach(([label, value]) => {
        doc.setFont('helvetica', 'bold'); doc.setTextColor(...darkText);
        doc.text(label, margin, y);
        doc.setFont('helvetica', 'normal'); doc.setTextColor(...mutedText);
        const wrapped = doc.splitTextToSize(value, contentW - 52);
        doc.text(wrapped, margin + 52, y);
        y += wrapped.length > 1 ? wrapped.length * 5 + 1 : 6;
      });
      doc.setDrawColor(...borderColor); doc.line(margin, y + 2, W - margin, y + 2); y += 10;

      // ── 1. RESUMO FINANCEIRO ─────────────────────────────────────
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...accentDark);
      doc.text('1. RESUMO FINANCEIRO', margin, y); y += 8;

      const paidSessions = monthlyPresent + monthlyReposicao + monthlyPaidAbsent + monthlyFeriadoRem;
      const finRows: [string, string][] = [
        ['Sessões realizadas (presença + reposição):', String(monthlyPresent + monthlyReposicao)],
        ['Faltas remuneradas:', String(monthlyPaidAbsent)],
        ['Feriados remunerados:', String(monthlyFeriadoRem)],
        ['Total de sessões cobradas:', String(paidSessions)],
        ['Valor por sessão:', `R$ ${(patient.paymentValue ?? 0).toFixed(2)}`],
        ['TOTAL FATURADO NO MÊS:', `R$ ${monthlyRevenue.toFixed(2)}`],
      ];
      finRows.forEach(([label, value], i) => {
        const isBold = i === finRows.length - 1;
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
        doc.setFontSize(9); doc.setTextColor(...(isBold ? accentDark : darkText));
        doc.text(label, margin + 4, y);
        doc.setFont('helvetica', 'bold');
        doc.text(value, W - margin - 2, y, { align: 'right' });
        y += 6;
      });
      doc.setDrawColor(...borderColor); doc.line(margin, y + 2, W - margin, y + 2); y += 10;

      // ── 2. DETALHAMENTO DE FREQUÊNCIA ────────────────────────────
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...accentDark);
      doc.text('2. DETALHAMENTO DE FREQUÊNCIA', margin, y); y += 8;

      const freqRows: [string, string][] = [
        ['Total de sessões registradas:', String(monthlyTotal)],
        ['Presenças:', String(monthlyPresent)],
        ['Reposições:', String(monthlyReposicao)],
        ['Faltas:', String(monthlyAbsent)],
        ['Faltas remuneradas:', String(monthlyPaidAbsent)],
        ['Feriados remunerados:', String(monthlyFeriadoRem)],
        ['Feriados não remunerados:', String(monthlyFeriadoNaoRem)],
        ['Taxa de frequência (presença/total):', `${monthlyAttendanceRate}%`],
      ];
      freqRows.forEach(([label, value]) => {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...darkText);
        doc.text(label, margin + 4, y);
        doc.setFont('helvetica', 'bold');
        doc.text(value, W - margin - 2, y, { align: 'right' });
        y += 6;
      });
      doc.setDrawColor(...borderColor); doc.line(margin, y + 2, W - margin, y + 2); y += 10;

      // ── 3. REGISTRO COMPLETO DAS SESSÕES ─────────────────────────
      const allStatusLabel: Record<string, string> = {
        presente: 'Presente', falta: 'Falta', falta_remunerada: 'Falta Remunerada',
        reposicao: 'Reposição', feriado_remunerado: 'Feriado Remunerado',
        feriado_nao_remunerado: 'Feriado Não Remunerado',
      };
      const paidStatuses = ['presente', 'reposicao', 'falta_remunerada', 'feriado_remunerado'];
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...accentDark);
      doc.text(`3. REGISTRO COMPLETO DAS SESSÕES (${monthlyEvolutions.length})`, margin, y); y += 8;

      for (const evo of monthlyEvolutions) {
        if (y > 258) { doc.addPage(); y = margin; }
        const dateStr = format(new Date(evo.date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR });
        const status = allStatusLabel[evo.attendanceStatus] || evo.attendanceStatus;
        const isPaid = paidStatuses.includes(evo.attendanceStatus);
        doc.setDrawColor(...borderColor); doc.line(margin, y - 1, W - margin, y - 1);
        doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...darkText);
        doc.text(dateStr, margin + 2, y + 5);
        doc.setFont('helvetica', 'normal'); doc.setTextColor(...mutedText);
        doc.text(`Status: ${status}`, margin + 32, y + 5);
        if (isPaid && patient.paymentValue) {
          doc.setTextColor(...accentDark);
          doc.text(`R$ ${patient.paymentValue.toFixed(2)}`, W - margin - 2, y + 5, { align: 'right' });
        }
        y += 9;
        if (evo.text) {
          doc.setTextColor(...darkText); doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
          const textLines = doc.splitTextToSize(evo.text, contentW - 4);
          textLines.forEach((line: string) => {
            if (y > 268) { doc.addPage(); y = margin; }
            doc.text(line, margin + 2, y); y += 5;
          });
          y += 3;
        } else { y += 2; }
      }

      // ── ASSINATURA ───────────────────────────────────────────────
      const chosenStamp = selectedStampId && selectedStampId !== 'none'
        ? stamps.find(s => s.id === selectedStampId)
        : stamps.find(s => s.is_default);
      y = await addSignatureBlock(doc, y, base, chosenStamp ?? null, true);

      // ── RODAPÉ ───────────────────────────────────────────────────
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFontSize(7.5); doc.setTextColor(...mutedText);
        doc.text(
          `${patient.name}  —  Relatório Financeiro: ${monthLabelCap}  —  Emitido em: ${format(new Date(), 'dd/MM/yyyy', { locale: ptBR })}  —  Pag. ${p}/${pageCount}`,
          W / 2, 291, { align: 'center' }
        );
      }
      doc.save(`relatorio-financeiro-${patient.name.replace(/\s+/g, '-').toLowerCase()}-${format(reportMonth, 'yyyy-MM')}.pdf`);
      toast.success('Relatório financeiro gerado!');
    } catch (err) { console.error(err); toast.error('Erro ao gerar PDF financeiro'); }
    finally { setIsExportingFinancial(false); }
  };



      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const base = buildPdfBase(doc);
      const { W, margin, contentW, darkText, mutedText, borderColor, accentDark } = base;
      const monthLabel = format(reportMonth, 'MMMM yyyy', { locale: ptBR });
      const monthLabelCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);



      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('RELATÓRIO MENSAL DE ATENDIMENTO', margin, y);
      y += 7;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...mutedText);
      doc.text(`${patient.name}   —   ${monthLabelCap}`, margin, y);
      y += 5;
      doc.setDrawColor(...borderColor);
      doc.line(margin, y, W - margin, y);
      y += 8;

      // Patient / clinic identification block
      doc.setTextColor(...darkText);
      doc.setFontSize(9);
      const idLines: [string, string][] = [];
      if (patient.name) idLines.push(['Paciente:', patient.name]);
      if (patient.birthdate) {
        const age = calculateAge(patient.birthdate);
        idLines.push(['Data de Nascimento:', `${format(new Date(patient.birthdate + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}${age !== null ? ` (${age} anos)` : ''}`]);
      }
      if (clinic?.name) idLines.push(['Unidade Clínica:', clinic.name]);
      if (patient.clinicalArea) idLines.push(['Área Clínica:', patient.clinicalArea]);
      if (patient.diagnosis) idLines.push(['Diagnóstico:', patient.diagnosis]);
      if (patient.professionals) idLines.push(['Profissional(is):', patient.professionals]);
      idLines.push(['Período de Referência:', monthLabelCap]);
      idLines.push(['Data de Emissão:', format(new Date(), 'dd/MM/yyyy', { locale: ptBR })]);

      idLines.forEach(([label, value]) => {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...darkText);
        doc.text(label, margin, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...mutedText);
        const wrapped = doc.splitTextToSize(value, contentW - 52);
        doc.text(wrapped, margin + 52, y);
        y += wrapped.length > 1 ? wrapped.length * 5 + 1 : 6;
      });

      // Divider
      doc.setDrawColor(...borderColor);
      doc.line(margin, y + 2, W - margin, y + 2);
      y += 10;

      // ── RESUMO QUANTITATIVO ──────────────────────────────────────
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...accentDark);
      doc.text('1. RESUMO QUANTITATIVO', margin, y);
      y += 8;

      // Only show presence, reposition and absence — no paid leaves/holidays
      const summaryRows: [string, string][] = [
        ['Total de sessões registradas:', String(monthlyTotal)],
        ['Presenças:', String(monthlyPresent)],
        ['Reposições:', String(monthlyReposicao)],
        ['Sessões realizadas (presença + reposição):', String(monthlyPresent + monthlyReposicao)],
        ['Faltas:', String(monthlyAbsent)],
        ['Taxa de frequência:', `${monthlyAttendanceRate}%`],
      ];

      summaryRows.forEach(([label, value]) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...darkText);
        doc.text(label, margin + 4, y);
        doc.setFont('helvetica', 'bold');
        doc.text(value, W - margin - 2, y, { align: 'right' });
        y += 6;
      });

      doc.setDrawColor(...borderColor);
      doc.line(margin, y + 2, W - margin, y + 2);
      y += 10;

      // ── HUMOR DO MÊS ────────────────────────────────────────────
      const moodsWithData = monthlyMoodCounts.filter(m => m.count > 0);
      if (moodsWithData.length > 0) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...accentDark);
        doc.text('2. HUMOR DO MÊS', margin, y);
        y += 8;
        moodsWithData.forEach(m => {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(...darkText);
          // Use label only — no emoji to avoid rendering issues
          doc.text(`${m.label}:`, margin + 4, y);
          doc.setFont('helvetica', 'bold');
          doc.text(String(m.count), W - margin - 2, y, { align: 'right' });
          y += 6;
        });
        doc.setDrawColor(...borderColor);
        doc.line(margin, y + 2, W - margin, y + 2);
        y += 10;
      }

      // ── REGISTRO DAS SESSÕES ─────────────────────────────────────
      const statusLabelMap: Record<string, string> = {
        presente: 'Presente', falta: 'Falta', reposicao: 'Reposicao',
      };

      // Only show: presente, falta, reposicao — skip paid leaves/holidays
      const visibleEvolutions = monthlyEvolutions.filter(e =>
        ['presente', 'falta', 'reposicao'].includes(e.attendanceStatus)
      );

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...accentDark);
      doc.text(`${moodsWithData.length > 0 ? '3' : '2'}. REGISTRO DAS SESSÕES (${visibleEvolutions.length})`, margin, y);
      y += 8;

      for (const evo of visibleEvolutions) {
        if (y > 252) { doc.addPage(); y = margin; }
        const dateStr = format(new Date(evo.date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR });
        const status = statusLabelMap[evo.attendanceStatus] || evo.attendanceStatus;

        const moodInfo = getMoodInfo(evo.mood, customMoods);

        // Thin separator line between sessions
        doc.setDrawColor(...borderColor);
        doc.line(margin, y - 1, W - margin, y - 1);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...darkText);
        doc.text(dateStr, margin + 2, y + 5);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...mutedText);
        doc.text(`Status: ${status}`, margin + 32, y + 5);

        if (moodInfo) {
          // Label only — no emoji
          doc.text(`Humor: ${moodInfo.label}`, margin + 100, y + 5);
        }

        y += 9;

        if (evo.text) {
          doc.setTextColor(...darkText);
          doc.setFontSize(8.5);
          doc.setFont('helvetica', 'normal');
          const textLines = doc.splitTextToSize(evo.text, contentW - 4);
          textLines.forEach((line: string) => {
            if (y > 268) { doc.addPage(); y = margin; }
            doc.text(line, margin + 2, y);
            y += 5;
          });
          y += 3;
        } else {
          y += 2;
        }
      }

      // ── STAMP / SIGNATURE ────────────────────────────────────────
      const selectedStamp = selectedStampId && selectedStampId !== 'none'
        ? stamps.find(s => s.id === selectedStampId)
        : stamps.find(s => s.is_default);

      if (selectedStamp) {
        // Ensure enough space; add page if needed
        if (y > 220) { doc.addPage(); y = margin; }

        doc.setDrawColor(...borderColor);
        doc.line(margin, y + 4, W - margin, y + 4);
        y += 12;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...darkText);
        doc.text('RESPONSÁVEL PELO ATENDIMENTO', margin, y);
        y += 6;

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...mutedText);
        doc.text(`${selectedStamp.name}   —   ${selectedStamp.clinical_area}`, margin, y);
        y += 8;

        // Signature image
        if (selectedStamp.signature_image) {
          try {
            const imgEl = document.createElement('img');
            imgEl.src = selectedStamp.signature_image;
            await new Promise<void>(res => { imgEl.onload = () => res(); imgEl.onerror = () => res(); });
            doc.addImage(selectedStamp.signature_image, 'PNG', margin, y, 60, 18, undefined, 'FAST');
            y += 22;
          } catch { /* skip if image fails */ }
        }

        // Stamp image
        if (selectedStamp.stamp_image) {
          try {
            const imgEl2 = document.createElement('img');
            imgEl2.src = selectedStamp.stamp_image;
            await new Promise<void>(res => { imgEl2.onload = () => res(); imgEl2.onerror = () => res(); });
            doc.addImage(selectedStamp.stamp_image, 'PNG', margin, y, 40, 40, undefined, 'FAST');
            y += 44;
          } catch { /* skip if image fails */ }
        }
      }

      // ── FOOTER ───────────────────────────────────────────────────
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFontSize(7.5);
        doc.setTextColor(...mutedText);
        doc.text(
          `${patient.name}  —  Relatório de Referência: ${monthLabelCap}  —  Emitido em: ${format(new Date(), 'dd/MM/yyyy', { locale: ptBR })}  —  Pag. ${p}/${pageCount}`,
          W / 2, 291, { align: 'center' }
        );
      }

      doc.save(`relatorio-${patient.name.replace(/\s+/g, '-').toLowerCase()}-${format(reportMonth, 'yyyy-MM')}.pdf`);
      toast.success('PDF gerado com sucesso!');



  const handleGeneratePeriodPdf = () => {
    if (!startDate || !endDate) return;
    const filtered = patientEvolutions.filter(evo => {
      const d = new Date(evo.date + 'T12:00:00');
      return d >= startDate && d <= endDate;
    });
    if (filtered.length === 0) { toast.error('Nenhuma evolução no período.'); return; }
    generateMultipleEvolutionsPdf({
      evolutions: filtered.sort((a, b) => new Date(a.date + 'T12:00:00').getTime() - new Date(b.date + 'T12:00:00').getTime()),
      patient, clinic, startDate, endDate, stamps,
    });
    setPeriodDialogOpen(false);
  };

  const handleSubmitEvolution = (e: React.FormEvent) => {
    e.preventDefault();
    if (!evolutionText.trim() && attachedFiles.length === 0 && Object.keys(templateFormValues).length === 0) return;

    const selectedTemplate = clinicTemplates.find(t => t.id === selectedTemplateId);
    let fullText = evolutionText;

    if (selectedTemplate && Object.keys(templateFormValues).length > 0) {
      const templateLines = selectedTemplate.fields
        .map(f => {
          const val = templateFormValues[f.id];
          if (val === undefined || val === '' || val === false) return null;
          if (f.type === 'checkbox' && val === true) return `✅ ${f.label}`;
          return `${f.label}: ${val}`;
        })
        .filter(Boolean);
      if (templateLines.length > 0) {
        const templateSection = templateLines.join('\n');
        fullText = fullText ? `${templateSection}\n\n---\n\n${fullText}` : templateSection;
      }
    }

    addEvolution({
      patientId: patient.id, clinicId: patient.clinicId, date: evolutionDate,
      text: fullText, attendanceStatus,
      mood: (selectedMood || undefined) as Evolution['mood'],
      stampId: selectedStampId && selectedStampId !== 'none' ? selectedStampId : undefined,
      templateId: selectedTemplateId || undefined,
      templateData: Object.keys(templateFormValues).length > 0 ? templateFormValues : undefined,
      attachments: attachedFiles.map(f => ({
        id: f.id, parentId: '', parentType: 'evolution' as const,
        name: f.name, data: f.filePath, type: f.fileType, createdAt: new Date().toISOString(),
      })),
    });
    setEvolutionText(''); setAttachedFiles([]); setSelectedMood('');
    setSelectedTemplateId(''); setTemplateFormValues({});
  };

  const handleBack = () => {
    if (currentClinic) navigate(`/clinics/${currentClinic.id}`);
    else navigate('/clinics');
  };

  const handleAddPatientTask = () => {
    if (!newTaskTitle.trim()) return;
    addTask(newTaskTitle, patient.id);
    setNewTaskTitle('');
  };

  const handleDocUpload = (files: UploadedFile[]) => {
    files.forEach(f => {
      addAttachment({ parentId: patient.id, parentType: 'patient', name: f.name, data: f.filePath, type: f.fileType });
    });
  };

  const handleDocRemove = (fileId: string) => {
    deleteAttachment(fileId);
  };

  const age = calculateAge(patient.birthdate);

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6">

      {/* Back button */}
      <Button variant="ghost" onClick={handleBack} className="gap-2 -ml-2">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Button>

      {/* Hero Card */}
      <div className="relative bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        {/* Colored accent strip */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/70 to-primary/30 rounded-t-2xl" />

        <div className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-start gap-5">
            {/* Avatar */}
            <label className="relative cursor-pointer group flex-shrink-0">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 border-2 border-border overflow-hidden flex items-center justify-center shadow-sm">
                {patient.avatarUrl ? (
                  <img src={patient.avatarUrl} alt={patient.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl">👤</span>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center">
                  <Image className="w-5 h-5 text-white" />
                </div>
              </div>
              <input type="file" accept="image/*" className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file || !user) return;
                  const ext = file.name.split('.').pop();
                  const path = `patient-avatars/${patient.id}.${ext}`;
                  const { error } = await supabase.storage.from('attachments').upload(path, file, { upsert: true });
                  if (error) { toast.error('Erro ao enviar foto'); return; }
                  const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(path);
                  updatePatient(patient.id, { avatarUrl: urlData.publicUrl });
                  toast.success('Foto atualizada!');
                }} />
            </label>

            {/* Name + tags */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h1 className="text-2xl font-bold text-foreground">{patient.name}</h1>
                {patient.isArchived && (
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-warning/20 text-warning">Arquivado</span>
                )}
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                {age !== null && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                    <Cake className="w-3 h-3" /> {age} anos
                  </span>
                )}
                {patient.phone && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/10 text-success text-xs font-medium">
                    <Phone className="w-3 h-3" /> {patient.phone}
                  </span>
                )}
                {patient.clinicalArea && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium">
                    {patient.clinicalArea}
                  </span>
                )}
                {patientPackage && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary text-foreground text-xs font-medium">
                    <Package className="w-3 h-3" /> {patientPackage.name}
                  </span>
                )}
                {clinic && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-xs font-medium">
                    🏥 {clinic.name}
                  </span>
                )}
              </div>

              {/* Quick info row */}
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {patient.paymentValue && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5" />
                    R$ {patient.paymentValue.toFixed(2)}{patient.paymentType === 'sessao' ? '/sessão' : '/mês'}
                  </span>
                )}
                {patient.diagnosis && (
                  <span className="truncate max-w-xs">📋 {patient.diagnosis}</span>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => setEditPatientOpen(true)} title="Editar">
                <Pencil className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-warning" onClick={() => setArchivePatientOpen(true)} title={patient.isArchived ? 'Desarquivar' : 'Arquivar'}>
                {patient.isArchived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeletePatientOpen(true)} title="Excluir">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <p className="text-xs font-medium text-muted-foreground">Total</p>
          </div>
          <p className="text-2xl font-bold text-foreground">{totalSessions}</p>
          <p className="text-xs text-muted-foreground mt-0.5">sessões</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-success" />
            </div>
            <p className="text-xs font-medium text-muted-foreground">Frequência</p>
          </div>
          <p className="text-2xl font-bold text-foreground">{attendanceRate}%</p>
          <p className="text-xs text-muted-foreground mt-0.5">{totalPresent} presentes</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-success" />
            </div>
            <p className="text-xs font-medium text-muted-foreground">Receita Total</p>
          </div>
          <p className="text-2xl font-bold text-success">R$ {totalFinancial.toFixed(0)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{totalPresent + totalReposicao + totalPaidAbsent + totalFeriadoRem} pagas</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-destructive" />
            </div>
            <p className="text-xs font-medium text-muted-foreground">Faltas</p>
          </div>
          <p className="text-2xl font-bold text-foreground">{totalAbsent}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{totalPaidAbsent} remuneradas</p>
        </div>
      </div>

      {/* Clinical Info Card */}
      {(patient.diagnosis || patient.observations || (patient.weekdays && patient.weekdays.length > 0) || patient.professionals || patient.responsibleName) && (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-foreground text-sm">Informações Clínicas</h2>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {patient.diagnosis && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Diagnóstico</p>
                <p className="text-sm text-foreground">{patient.diagnosis}</p>
              </div>
            )}
            {patient.professionals && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Profissional(is)</p>
                <p className="text-sm text-foreground">{patient.professionals}</p>
              </div>
            )}
            {patient.responsibleName && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Responsável</p>
                <p className="text-sm text-foreground">{patient.responsibleName}</p>
              </div>
            )}
            {patient.weekdays && patient.weekdays.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Dias de Atendimento</p>
                <div className="flex flex-wrap gap-1.5">
                  {patient.weekdays.map(day => (
                    <span key={day} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                      {day.charAt(0).toUpperCase() + day.slice(1)}
                    </span>
                  ))}
                  {patient.scheduleTime && (
                    <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs">
                      ⏰ {patient.scheduleTime}
                    </span>
                  )}
                </div>
              </div>
            )}
            {patient.observations && (
              <div className="md:col-span-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Observações</p>
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{patient.observations}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mood Chart */}

      {moodChartData.length >= 2 && (
        <div className="bg-card rounded-xl p-5 border border-border shadow-sm">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2 text-sm">
            <BarChart3 className="w-4 h-4 text-primary" /> Evolução do Humor
          </h2>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={moodChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis domain={[1, 10]} ticks={[1, 3, 5, 7, 9]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(v) => { const m = allMoodOptions.find(o => o.score === v); return m?.emoji || ''; }} />
                <Tooltip content={<MoodTooltip customMoods={customMoods} />} />
                <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2.5}
                  dot={{ fill: 'hsl(var(--primary))', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="evolutions" className="space-y-4">
        <TabsList className="w-full sm:w-auto grid grid-cols-4 sm:inline-grid gap-0">
          <TabsTrigger value="evolutions" className="gap-1.5 text-xs sm:text-sm">
            <FileText className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Evoluções</span><span className="sm:hidden">Evol.</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-1.5 text-xs sm:text-sm">
            <BarChart3 className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Relatório Mensal</span><span className="sm:hidden">Relat.</span>
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-1.5 text-xs sm:text-sm">
            <Paperclip className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Documentos</span><span className="sm:hidden">Docs</span>
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-1.5 text-xs sm:text-sm">
            <ListTodo className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Tarefas</span><span className="sm:hidden">Tasks</span>
          </TabsTrigger>
        </TabsList>

        {/* Evolutions Tab */}
        <TabsContent value="evolutions" className="space-y-4">
          {/* New Evolution Form */}
          <div className="bg-card rounded-xl p-5 shadow-sm border border-border">
            <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2 text-sm">
              <FileText className="w-4 h-4 text-primary" /> Nova Evolução
            </h2>
            <form onSubmit={handleSubmitEvolution} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs">Data</Label>
                  <Input type="date" value={evolutionDate} onChange={(e) => setEvolutionDate(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Presença</Label>
                  <Select value={attendanceStatus} onValueChange={(v) => setAttendanceStatus(v as any)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="presente">✅ Presente</SelectItem>
                      <SelectItem value="falta">❌ Falta</SelectItem>
                      {clinic && (clinic.absencePaymentType !== 'never' || clinic.paysOnAbsence !== false) && (
                        <SelectItem value="falta_remunerada">💰 Falta Remunerada</SelectItem>
                      )}
                      <SelectItem value="reposicao">🔄 Reposição</SelectItem>
                      <SelectItem value="feriado_remunerado">🎉 Feriado Remunerado</SelectItem>
                      <SelectItem value="feriado_nao_remunerado">📅 Feriado Não Remunerado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <MoodSelector value={selectedMood} onChange={setSelectedMood} />
                </div>
              </div>

              {clinicTemplates.length > 0 && (
                <div>
                  <Label className="text-xs flex items-center gap-2 mb-1">📋 Modelo de Evolução</Label>
                  <Select value={selectedTemplateId} onValueChange={(v) => {
                    setSelectedTemplateId(v === 'none' ? '' : v);
                    if (v === 'none' || !v) setTemplateFormValues({});
                  }}>
                    <SelectTrigger><SelectValue placeholder="Selecione um modelo (opcional)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem modelo</SelectItem>
                      {clinicTemplates.map(t => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedTemplateId && clinicTemplates.find(t => t.id === selectedTemplateId) && (
                <TemplateForm template={clinicTemplates.find(t => t.id === selectedTemplateId)!} values={templateFormValues} onChange={setTemplateFormValues} showAiImprove isImprovingText={isImprovingText}
                  onImproveText={async (textToImprove) => {
                    setIsImprovingText(true);
                    try {
                      const { data, error } = await supabase.functions.invoke('improve-evolution', { body: { text: textToImprove } });
                      if (error) throw error;
                      return data?.improved || textToImprove;
                    } catch { toast.error('Erro ao melhorar texto'); return textToImprove; }
                    finally { setIsImprovingText(false); }
                  }} />
              )}

              {!selectedTemplateId && (
                <div>
                  <Label className="text-xs">Evolução</Label>
                  <Textarea value={evolutionText} onChange={(e) => setEvolutionText(e.target.value)}
                    placeholder="Digite a evolução do paciente..." className="min-h-28 mt-1" />
                  <Button type="button" variant="outline" size="sm" className="mt-2 gap-2"
                    disabled={!evolutionText.trim() || isImprovingText}
                    onClick={async () => {
                      setIsImprovingText(true);
                      try {
                        const { data, error } = await supabase.functions.invoke('improve-evolution', { body: { text: evolutionText } });
                        if (error) throw error;
                        if (data?.improved) { setEvolutionText(data.improved); toast.success('Texto melhorado com IA!'); }
                      } catch { toast.error('Erro ao melhorar texto'); }
                      finally { setIsImprovingText(false); }
                    }}>
                    {isImprovingText ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                    Melhorar com IA
                  </Button>
                </div>
              )}

              <div>
                <Label className="text-xs flex items-center gap-2 mb-2"><Image className="w-3.5 h-3.5" /> Anexos (opcional)</Label>
                <FileUpload parentType="evolution" parentId={patient.id} existingFiles={attachedFiles}
                  onUpload={(files) => setAttachedFiles(prev => [...prev, ...files])}
                  onRemove={(fileId) => setAttachedFiles(prev => prev.filter(f => f.id !== fileId))} maxFiles={5} />
              </div>

              {stamps.length > 0 && (
                <div>
                  <Label className="text-xs flex items-center gap-2 mb-1.5"><StampIcon className="w-3.5 h-3.5" /> Carimbo</Label>
                  <Select value={selectedStampId} onValueChange={setSelectedStampId}>
                    <SelectTrigger><SelectValue placeholder="Selecione um carimbo (opcional)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem carimbo</SelectItem>
                      {stamps.map(s => (<SelectItem key={s.id} value={s.id}>{s.name} — {s.clinical_area} {s.is_default ? '⭐' : ''}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button type="submit" className="gap-2"><Plus className="w-4 h-4" /> Salvar Evolução</Button>
            </form>
          </div>

          {/* History */}
          <div className="bg-card rounded-xl shadow-sm border border-border">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-border">
              <h2 className="font-semibold text-foreground flex items-center gap-2 text-sm">
                📜 Histórico <span className="text-muted-foreground font-normal">({patientEvolutions.length})</span>
              </h2>
              {patientEvolutions.length > 0 && (
                <Dialog open={periodDialogOpen} onOpenChange={setPeriodDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 text-xs">
                      <CalendarRange className="w-3.5 h-3.5" /> PDF por Período
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>Gerar PDF de Evoluções</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Data Início</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className={cn("w-full justify-start text-left font-normal mt-1", !startDate && "text-muted-foreground")}>
                                <CalendarRange className="mr-2 h-4 w-4" />
                                {startDate ? format(startDate, "dd/MM/yyyy") : "Selecione"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <CalendarComponent mode="single" selected={startDate} onSelect={setStartDate} initialFocus className="p-3 pointer-events-auto" />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div>
                          <Label>Data Fim</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className={cn("w-full justify-start text-left font-normal mt-1", !endDate && "text-muted-foreground")}>
                                <CalendarRange className="mr-2 h-4 w-4" />
                                {endDate ? format(endDate, "dd/MM/yyyy") : "Selecione"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <CalendarComponent mode="single" selected={endDate} onSelect={setEndDate} initialFocus className="p-3 pointer-events-auto" />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                      {startDate && endDate && (
                        <p className="text-sm text-muted-foreground">
                          {patientEvolutions.filter(evo => { const d = new Date(evo.date + 'T12:00:00'); return d >= startDate && d <= endDate; }).length} evoluções no período
                        </p>
                      )}
                      <Button className="w-full gap-2" onClick={handleGeneratePeriodPdf} disabled={!startDate || !endDate}>
                        <Download className="w-4 h-4" /> Gerar PDF
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            <div className="p-5">
              {patientEvolutions.length === 0 ? (
                <div className="text-center py-10">
                  <div className="text-5xl mb-3">📝</div>
                  <p className="text-muted-foreground text-sm">Nenhuma evolução registrada ainda.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {patientEvolutions.map((evo) => {
                    const moodInfo = getMoodInfo(evo.mood, customMoods);
                    const evoAuthorId = (evo as any).user_id;
                    const evoAuthor = isOrg && evoAuthorId ? members.find(m => m.userId === evoAuthorId) : null;
                    const authorLabel = evoAuthor ? (evoAuthor.name || evoAuthor.email) : null;
                    return (
                      <div key={evo.id} className="bg-secondary/40 rounded-xl p-4 border border-border/50 hover:border-border transition-colors">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-foreground text-sm">
                              {format(new Date(evo.date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                            </span>
                            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                              evo.attendanceStatus === 'presente' ? 'bg-success/10 text-success' :
                              evo.attendanceStatus === 'falta_remunerada' ? 'bg-warning/10 text-warning' :
                              evo.attendanceStatus === 'reposicao' ? 'bg-primary/10 text-primary' :
                              evo.attendanceStatus === 'feriado_remunerado' ? 'bg-primary/10 text-primary' :
                              evo.attendanceStatus === 'feriado_nao_remunerado' ? 'bg-muted text-muted-foreground' :
                              'bg-destructive/10 text-destructive')}>
                              {evo.attendanceStatus === 'presente' ? '✅ Presente' :
                               evo.attendanceStatus === 'falta_remunerada' ? '💰 Falta Remunerada' :
                               evo.attendanceStatus === 'reposicao' ? '🔄 Reposição' :
                               evo.attendanceStatus === 'feriado_remunerado' ? '🎉 Feriado Rem.' :
                               evo.attendanceStatus === 'feriado_nao_remunerado' ? '📅 Feriado' :
                               '❌ Falta'}
                            </span>
                            {moodInfo && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">
                                {moodInfo.emoji} {moodInfo.label}
                              </span>
                            )}
                            {authorLabel && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                                👤 {authorLabel}{evoAuthorId === user?.id ? ' (você)' : ''}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" className="gap-1 h-7 px-2 text-xs" onClick={() => setEditingEvolution(evo)}>
                              <Edit className="w-3 h-3" /> <span className="hidden sm:inline">Editar</span>
                            </Button>
                            <Button variant="outline" size="sm" className="gap-1 h-7 px-2 text-xs"
                              onClick={() => generateEvolutionPdf({ evolution: evo, patient, clinic, stamps })}>
                              <Download className="w-3 h-3" /> PDF
                            </Button>
                            <Button variant="ghost" size="sm" className="text-destructive h-7 w-7 p-0" onClick={() => deleteEvolution(evo.id)}>
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        {evo.text && <p className="text-foreground text-sm whitespace-pre-wrap">{evo.text}</p>}
                        {evo.attachments && evo.attachments.length > 0 && (
                          <div className="mt-3 space-y-2">
                            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                              <Paperclip className="w-3 h-3" /> {evo.attachments.length} anexo(s)
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {evo.attachments.map((att) => {
                                const fileUrl = att.data.startsWith('http') ? att.data : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/attachments/${att.data}`;
                                const isImage = att.type.startsWith('image/');
                                return (
                                  <div key={att.id} className="flex flex-col gap-1">
                                    {isImage && (
                                      <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                                        <img src={fileUrl} alt={att.name} className="w-20 h-20 object-cover rounded-lg border border-border hover:opacity-80 transition-opacity" />
                                      </a>
                                    )}
                                    <a href={fileUrl} target="_blank" rel="noopener noreferrer" download={att.name}
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs hover:bg-primary/20">
                                      {isImage ? <Image className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                                      <span className="max-w-[100px] truncate">{att.name}</span>
                                      <Download className="w-3 h-3" />
                                    </a>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {evo.signature && (
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-xs text-muted-foreground flex items-center gap-1"><PenLine className="w-3 h-3" /> Assinatura:</span>
                            <img src={evo.signature} alt="Assinatura" className="h-8 object-contain" />
                          </div>
                        )}
                        {evo.stampId && (() => {
                          const stamp = stamps.find(s => s.id === evo.stampId);
                          return stamp?.stamp_image ? (
                            <div className="mt-3 pt-2 border-t border-border/40">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                                <StampIcon className="w-3 h-3" /> {stamp.name} — {stamp.clinical_area}
                              </div>
                              <img src={stamp.stamp_image} alt="Carimbo" className="h-12 object-contain opacity-70" />
                            </div>
                          ) : stamp ? (
                            <div className="mt-3 pt-2 border-t border-border/40 text-xs text-muted-foreground flex items-center gap-1">
                              <StampIcon className="w-3 h-3" /> {stamp.name} — {stamp.clinical_area}
                            </div>
                          ) : null;
                        })()}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Monthly Report Tab */}
        <TabsContent value="reports" className="space-y-4">
          <div className="bg-card rounded-xl shadow-sm border border-border">
            {/* Month navigator */}
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setReportMonth(m => subMonths(m, 1))}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <h2 className="font-semibold text-foreground capitalize min-w-[140px] text-center">
                  {format(reportMonth, 'MMMM yyyy', { locale: ptBR })}
                </h2>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setReportMonth(m => addMonths(m, 1))}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <Button
                onClick={handleExportMonthlyPDF}
                disabled={isExportingMonthly || monthlyEvolutions.length === 0}
                className="gap-2"
                size="sm"
              >
                {isExportingMonthly ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Baixar PDF
              </Button>
            </div>

            <div className="p-5 space-y-5">
              {monthlyEvolutions.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-3">📅</div>
                  <p className="text-muted-foreground text-sm">Nenhuma evolução em {format(reportMonth, 'MMMM yyyy', { locale: ptBR })}.</p>
                  <p className="text-xs text-muted-foreground mt-1">Navegue pelos meses usando as setas acima.</p>
                </div>
              ) : (
                <>
                  {/* Monthly stat cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-primary/5 rounded-xl p-4 border border-primary/20">
                      <p className="text-xs font-medium text-primary mb-1">Sessões</p>
                      <p className="text-2xl font-bold text-foreground">{monthlyTotal}</p>
                      <p className="text-xs text-muted-foreground">{monthlyPresent} presentes</p>
                    </div>
                    <div className="bg-success/5 rounded-xl p-4 border border-success/20">
                      <p className="text-xs font-medium text-success mb-1">Frequência</p>
                      <p className="text-2xl font-bold text-foreground">{monthlyAttendanceRate}%</p>
                      <p className="text-xs text-muted-foreground">{monthlyPresent + monthlyReposicao} realizadas</p>
                    </div>
                    <div className="bg-success/5 rounded-xl p-4 border border-success/20">
                      <p className="text-xs font-medium text-success mb-1">Receita</p>
                      <p className="text-2xl font-bold text-success">R$ {monthlyRevenue.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{monthlyPresent + monthlyReposicao + monthlyPaidAbsent + monthlyFeriadoRem} pagas</p>
                    </div>
                    <div className="bg-destructive/5 rounded-xl p-4 border border-destructive/20">
                      <p className="text-xs font-medium text-destructive mb-1">Faltas</p>
                      <p className="text-2xl font-bold text-foreground">{monthlyAbsent + monthlyPaidAbsent}</p>
                      <p className="text-xs text-muted-foreground">{monthlyPaidAbsent} remuneradas</p>
                    </div>
                  </div>

                  {/* Status breakdown */}
                  <div className="bg-secondary/40 rounded-xl p-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Detalhamento</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        { label: 'Presente', value: monthlyPresent, emoji: '✅', cls: 'text-success' },
                        { label: 'Reposição', value: monthlyReposicao, emoji: '🔄', cls: 'text-primary' },
                        { label: 'Falta Remunerada', value: monthlyPaidAbsent, emoji: '💰', cls: 'text-warning' },
                        { label: 'Feriado Rem.', value: monthlyFeriadoRem, emoji: '🎉', cls: 'text-primary' },
                        { label: 'Feriado', value: monthlyFeriadoNaoRem, emoji: '📅', cls: 'text-muted-foreground' },
                        { label: 'Falta', value: monthlyAbsent, emoji: '❌', cls: 'text-destructive' },
                      ].map(item => (
                        <div key={item.label} className="flex items-center gap-2">
                          <span className="text-sm">{item.emoji}</span>
                          <div>
                            <p className="text-xs text-muted-foreground">{item.label}</p>
                            <p className={cn('text-sm font-bold', item.cls)}>{item.value}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Mood summary for month */}
                  {monthlyMoodCounts.some(m => m.count > 0) && (
                    <div className="bg-secondary/40 rounded-xl p-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Humor do Mês</p>
                      <div className="flex flex-wrap gap-2">
                        {monthlyMoodCounts.filter(m => m.count > 0).map(m => (
                          <div key={m.value} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border text-sm">
                            <span>{m.emoji}</span>
                            <span className="text-muted-foreground text-xs">{m.label}</span>
                            <span className="font-semibold text-foreground">{m.count}×</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Evolution list for month */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                      Sessões do Mês ({monthlyEvolutions.length})
                    </p>
                    <div className="space-y-2">
                      {monthlyEvolutions.map(evo => {
                        const moodInfo = getMoodInfo(evo.mood, customMoods);
                        return (
                          <div key={evo.id} className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border/60">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <span className="text-sm font-semibold text-foreground">
                                  {format(new Date(evo.date + 'T12:00:00'), 'dd/MM', { locale: ptBR })}
                                </span>
                                <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                                  evo.attendanceStatus === 'presente' ? 'bg-success/10 text-success' :
                                  evo.attendanceStatus === 'falta_remunerada' ? 'bg-warning/10 text-warning' :
                                  evo.attendanceStatus === 'reposicao' ? 'bg-primary/10 text-primary' :
                                  evo.attendanceStatus === 'feriado_remunerado' ? 'bg-primary/10 text-primary' :
                                  evo.attendanceStatus === 'feriado_nao_remunerado' ? 'bg-muted text-muted-foreground' :
                                  'bg-destructive/10 text-destructive')}>
                                  {evo.attendanceStatus === 'presente' ? '✅ Presente' :
                                   evo.attendanceStatus === 'falta_remunerada' ? '💰 Falta Rem.' :
                                   evo.attendanceStatus === 'reposicao' ? '🔄 Reposição' :
                                   evo.attendanceStatus === 'feriado_remunerado' ? '🎉 Feriado Rem.' :
                                   evo.attendanceStatus === 'feriado_nao_remunerado' ? '📅 Feriado' : '❌ Falta'}
                                </span>
                                {moodInfo && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                                    {moodInfo.emoji} {moodInfo.label}
                                  </span>
                                )}
                                {patient.paymentValue && ['presente','reposicao','falta_remunerada','feriado_remunerado'].includes(evo.attendanceStatus) && (
                                  <span className="text-xs text-success font-medium ml-auto">
                                    + R$ {patient.paymentValue.toFixed(2)}
                                  </span>
                                )}
                              </div>
                              {evo.text && (
                                <p className="text-xs text-muted-foreground line-clamp-2">{evo.text}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <div className="bg-card rounded-xl p-5 shadow-sm border border-border space-y-6">
            <h2 className="font-semibold text-foreground flex items-center gap-2 text-sm">
              <Paperclip className="w-4 h-4 text-primary" /> Documentos do Paciente
            </h2>
            <FileUpload parentType="patient" parentId={patient.id}
              existingFiles={patientDocsAsUploadedFiles}
              onUpload={handleDocUpload} onRemove={handleDocRemove}
              maxFiles={20} label="Anexe laudos, receitas, documentos e outros arquivos do paciente" />

            {(() => {
              const evoAttachments = patientEvolutions.flatMap(evo =>
                (evo.attachments || []).map(att => ({ ...att, evoDate: evo.date }))
              );
              if (evoAttachments.length === 0) return null;
              return (
                <div className="pt-4 border-t border-border">
                  <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2 text-sm">
                    <FileText className="w-4 h-4 text-primary" /> Anexos das Evoluções ({evoAttachments.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {evoAttachments.map(att => {
                      const fileUrl = att.data.startsWith('http') ? att.data : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/attachments/${att.data}`;
                      return (
                        <a key={att.id} href={fileUrl} target="_blank" rel="noopener noreferrer" download={att.name}
                          className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 border border-border hover:border-primary/50 transition-colors">
                          {att.type.startsWith('image/') ? (
                            <img src={fileUrl} alt={att.name} className="w-10 h-10 rounded object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <FileText className="w-5 h-5 text-primary" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{att.name}</p>
                            <p className="text-xs text-muted-foreground">Evolução de {format(new Date(att.evoDate + 'T00:00:00'), "dd/MM/yyyy")}</p>
                          </div>
                          <Download className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        </a>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            <PatientSavedReports patientId={patient.id} clinicName={clinic?.name} clinicAddress={clinic?.address || undefined} clinicLetterhead={clinic?.letterhead || undefined} clinicEmail={clinic?.email} clinicCnpj={clinic?.cnpj} clinicPhone={clinic?.phone} clinicServicesDescription={clinic?.servicesDescription} />
          </div>
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks">
          <div className="bg-card rounded-xl p-5 shadow-sm border border-border">
            <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2 text-sm">
              <ListTodo className="w-4 h-4 text-primary" /> Tarefas do Paciente
            </h2>
            <div className="flex gap-2 mb-5">
              <Input value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Nova tarefa..." onKeyDown={(e) => e.key === 'Enter' && handleAddPatientTask()} />
              <Button onClick={handleAddPatientTask} disabled={!newTaskTitle.trim()} className="gap-2 shrink-0">
                <Plus className="w-4 h-4" /> Adicionar
              </Button>
            </div>
            {patientTasksList.length === 0 ? (
              <div className="text-center py-10">
                <div className="text-5xl mb-3">📋</div>
                <p className="text-muted-foreground text-sm">Nenhuma tarefa cadastrada.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {patientTasksList.map(task => (
                  <div key={task.id} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 border border-border/50">
                    <button onClick={() => toggleTask(task.id)}
                      className={cn("w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors",
                        task.completed ? "bg-success border-success text-success-foreground" : "border-muted-foreground hover:border-primary")}>
                      {task.completed && <CheckCircle2 className="w-3 h-3" />}
                    </button>
                    <span className={cn("flex-1 text-sm text-foreground", task.completed && "line-through text-muted-foreground")}>{task.title}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => deleteTask(task.id)}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {editingEvolution && (
        <EditEvolutionDialog evolution={editingEvolution} open={!!editingEvolution}
          onOpenChange={(open) => !open && setEditingEvolution(null)}
          onSave={(updates) => updateEvolution(editingEvolution.id, updates)}
          showFaltaRemunerada={!!(clinic && (clinic.absencePaymentType !== 'never' || clinic.paysOnAbsence !== false))} />
      )}

      <EditPatientDialog patient={patient} open={editPatientOpen} onOpenChange={setEditPatientOpen}
        onSave={updatePatient} clinicPackages={clinic ? getClinicPackages(clinic.id) : []} />

      <AlertDialog open={deletePatientOpen} onOpenChange={setDeletePatientOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir paciente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso excluirá permanentemente o paciente
              <span className="font-semibold"> {patient.name}</span> e todas as evoluções associadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { deletePatient(patient.id); toast.success('Paciente excluído!'); handleBack(); }}
              className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={archivePatientOpen} onOpenChange={setArchivePatientOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{patient.isArchived ? 'Reativar paciente?' : 'Arquivar paciente?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {patient.isArchived
                ? <>O paciente <span className="font-semibold">{patient.name}</span> será reativado e voltará a aparecer na agenda e lista de pacientes.</>
                : <>O paciente <span className="font-semibold">{patient.name}</span> será removido da agenda e da lista ativa. Você poderá reativá-lo a qualquer momento.</>
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { const newVal = !patient.isArchived; updatePatient(patient.id, { isArchived: newVal }); toast.success(newVal ? 'Paciente arquivado' : 'Paciente reativado'); }}>
              {patient.isArchived ? 'Reativar' : 'Arquivar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
