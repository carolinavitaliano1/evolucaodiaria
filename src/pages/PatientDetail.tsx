import { useParams, useNavigate } from 'react-router-dom';
// @ts-ignore
import { PortalTab } from '@/components/patients/PortalTab';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Phone, Cake, FileText, Plus, CheckCircle2, Image, Stamp as StampIcon, Download, CalendarRange, PenLine, Edit, X, Paperclip, ListTodo, Package, Sparkles, Pencil, Trash2, Loader2, Wand2, Archive, ArchiveRestore, BarChart3, ChevronLeft, ChevronRight, TrendingUp, DollarSign, Users, Calendar, Receipt, UserCheck, Clock, MessageSquare, AlertCircle, Newspaper } from 'lucide-react';
import { WhatsAppIcon } from '@/components/ui/whatsapp-icon';
import { generateEvolutionPdf, generateMultipleEvolutionsPdf } from '@/utils/generateEvolutionPdf';
import { useClinicOrg } from '@/hooks/useClinicOrg';
import { usePatientAssignments } from '@/hooks/usePatientAssignments';
import { useOrgPermissions } from '@/hooks/useOrgPermissions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { WhatsAppMessageModal } from '@/components/whatsapp/WhatsAppMessageModal';
import { WhatsAppRecipientModal } from '@/components/whatsapp/WhatsAppRecipientModal';
import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { getDynamicSessionValue, calculateMensalRevenueWithDeductions } from '@/utils/dateHelpers';
import { generateFiscalReceiptPdf } from '@/utils/generateFiscalReceiptPdf';
import { generatePaymentReceiptPdf, generatePaymentReceiptWord } from '@/utils/generatePaymentReceiptPdf';
import jsPDF from 'jspdf';
import { FeedbackIAModal } from '@/components/evolutions/FeedbackIAModal';
import { PatientFeed } from '@/components/feed/PatientFeed';

const MOOD_OPTIONS = DEFAULT_MOOD_OPTIONS.map((m, i) => ({
  ...m,
  score: [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 3, 2, 2, 2, 3][i] ?? 5,
}));

// Renders text with **bold** markdown support for evolution template titles
function EvolutionText({ text, className }: { text: string; className?: string }) {
  const lines = text.split('\n');
  return (
    <p className={className}>
      {lines.map((line, li) => {
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <span key={li}>
            {parts.map((part, i) =>
              part.startsWith('**') && part.endsWith('**')
                ? <strong key={i}>{part.slice(2, -2)}</strong>
                : <span key={i}>{part}</span>
            )}
            {li < lines.length - 1 && <br />}
          </span>
        );
      })}
    </p>
  );
}



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

function PatientSavedReports({ patientId, clinicName, clinicAddress, clinicLetterhead, clinicEmail, clinicCnpj, clinicPhone, clinicServicesDescription, therapistName, therapistProfessionalId, therapistCbo, therapistClinicalArea, therapistStampImage, therapistSignatureImage }: { patientId: string; clinicName?: string; clinicAddress?: string; clinicLetterhead?: string; clinicEmail?: string; clinicCnpj?: string; clinicPhone?: string; clinicServicesDescription?: string; therapistName?: string; therapistProfessionalId?: string; therapistCbo?: string; therapistClinicalArea?: string; therapistStampImage?: string | null; therapistSignatureImage?: string | null }) {
  const [reports, setReports] = useState<{ id: string; title: string; content: string; created_at: string }[]>([]);

  useEffect(() => {
    supabase.from('saved_reports').select('id, title, content, created_at')
      .eq('patient_id', patientId).order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setReports(data); });
  }, [patientId]);

  const handleDownloadPdf = (report: { title: string; content: string }) => {
    generateReportPdf({ title: report.title, content: report.content, clinicName, clinicAddress, clinicLetterhead, clinicEmail, clinicCnpj, clinicPhone, clinicServicesDescription, therapistName, therapistProfessionalId, therapistCbo, therapistClinicalArea, therapistStampImage, therapistSignatureImage });
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
  const { permissions: orgPermissions, isOwner: isOrgOwner } = useOrgPermissions();

  const patient = patients.find(p => p.id === id);
  const clinic = clinics.find(c => c.id === patient?.clinicId);
  const { isOrg, members } = useClinicOrg(patient?.clinicId || '');
  const { assignments: therapistAssignments, allMembers: orgMembers, loading: assignmentsLoading, canManage: canManageAssignments, toggleAssignment, updateScheduleTime } = usePatientAssignments(id || '', patient?.clinicId || '');

  // Whether current user can see clinical content
  const canSeeClinical = !orgPermissions.includes('patients.own_only') || isOrgOwner ||
    orgPermissions.includes('evolutions.view');
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [assignmentScheduleTimes, setAssignmentScheduleTimes] = useState<Record<string, string>>({});
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [whatsAppRecipientOpen, setWhatsAppRecipientOpen] = useState(false);

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
  const [feedbackEvolution, setFeedbackEvolution] = useState<Evolution | null>(null);
  const [feedbackBulkOpen, setFeedbackBulkOpen] = useState(false);
  const [editPatientOpen, setEditPatientOpen] = useState(false);
  const [deletePatientOpen, setDeletePatientOpen] = useState(false);
  const [archivePatientOpen, setArchivePatientOpen] = useState(false);
  const [stamps, setStamps] = useState<{ id: string; name: string; clinical_area: string; cbo?: string | null; stamp_image: string | null; signature_image: string | null; is_default: boolean }[]>([]);
  const [selectedStampId, setSelectedStampId] = useState<string>('');
  const [isImprovingText, setIsImprovingText] = useState(false);
  const [clinicTemplates, setClinicTemplates] = useState<EvolutionTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [templateFormValues, setTemplateFormValues] = useState<Record<string, any>>({});

  // Monthly report state
  const [reportMonth, setReportMonth] = useState(new Date());
  const [isExportingMonthly, setIsExportingMonthly] = useState(false);
  const [isExportingFinancial, setIsExportingFinancial] = useState(false);

  // Payment record state (for Financial tab)
  const [paymentRecord, setPaymentRecord] = useState<{ id?: string; paid: boolean; payment_date: string | null; amount: number } | null>(null);
  const [savingPaymentRecord, setSavingPaymentRecord] = useState(false);
  const [financialMonth, setFinancialMonth] = useState(new Date());
  const [financialStampId, setFinancialStampId] = useState<string>('');
  const currentMonth = financialMonth.getMonth() + 1;
  const currentYear = financialMonth.getFullYear();

  // Patient notes state
  const [patientNotes, setPatientNotes] = useState<{ id: string; title: string; content: string; created_at: string; updated_at: string }[]>([]);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteTitle, setEditingNoteTitle] = useState('');
  const [editingNoteContent, setEditingNoteContent] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Fiscal receipt state
  const [fiscalDialogOpen, setFiscalDialogOpen] = useState(false);
  const [fiscalStartDate, setFiscalStartDate] = useState<Date>();
  const [fiscalEndDate, setFiscalEndDate] = useState<Date>();
  const [fiscalStampId, setFiscalStampId] = useState<string>('');
  const [isExportingFiscalPdf, setIsExportingFiscalPdf] = useState(false);
  const [isExportingFiscalWord, setIsExportingFiscalWord] = useState(false);
  const [fiscalPaymentStatus, setFiscalPaymentStatus] = useState<'paid' | 'pending' | 'total'>('pending');
  const [fiscalPaymentDate, setFiscalPaymentDate] = useState<string>('');
  const [fiscalTotalPaid, setFiscalTotalPaid] = useState<string>('');
  const [fiscalTotalPaidFromApp, setFiscalTotalPaidFromApp] = useState<number | null>(null);
  const [fiscalPeriodMode, setFiscalPeriodMode] = useState<'month' | 'custom'>('month');
  const [fiscalMonthYear, setFiscalMonthYear] = useState<{ month: number; year: number }>(() => {
    const now = new Date();
    return { month: now.getMonth(), year: now.getFullYear() };
  });


  // Payment receipt state
  const [paymentReceiptOpen, setPaymentReceiptOpen] = useState(false);
  const [prAmount, setPrAmount] = useState('');
  const [prSessions, setPrSessions] = useState('');
  const [prUnitValue, setPrUnitValue] = useState('');
  const [prService, setPrService] = useState('');
  const [prPeriod, setPrPeriod] = useState('');
  const [prPaymentMethod, setPrPaymentMethod] = useState('transferência bancária');
  const [prPaymentDate, setPrPaymentDate] = useState('');
  const [prStampId, setPrStampId] = useState('');
  const [prLocation, setPrLocation] = useState('');
  const [prLocalDate, setPrLocalDate] = useState('');
  const [prSelectedSessions, setPrSelectedSessions] = useState<string[]>([]);
  const [prSessionMode, setPrSessionMode] = useState<'manual' | 'select'>('select');
  const [prUseResponsible, setPrUseResponsible] = useState(false);
  const [isExportingPR, setIsExportingPR] = useState(false);
  const [isExportingPRWord, setIsExportingPRWord] = useState(false);

  // Therapist profile for fiscal receipt
  const [therapistProfile, setTherapistProfile] = useState<{ name: string | null; professional_id: string | null; cpf?: string | null; cbo?: string | null } | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('name, professional_id, cpf, cbo').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => { if (data) setTherapistProfile(data); });
  }, [user]);

  // Load payment record for current month (Financial tab)
  useEffect(() => {
    if (!patient?.id || !user) return;
    supabase
      .from('patient_payment_records')
      .select('id, paid, payment_date, amount')
      .eq('patient_id', patient.id)
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .maybeSingle()
      .then(({ data }) => {
        setPaymentRecord(data ? { id: data.id, paid: data.paid, payment_date: data.payment_date, amount: data.amount } : null);
      });
  }, [patient?.id, user, currentMonth, currentYear]);

  const handleSavePaymentRecord = async (paid: boolean, paymentDate: string | null) => {
    if (!user || !patient) return;
    setSavingPaymentRecord(true);
    try {
      const amount = patient.paymentValue || 0;
      if (paymentRecord?.id) {
        await supabase.from('patient_payment_records').update({
          paid,
          payment_date: paid ? (paymentDate || new Date().toISOString().split('T')[0]) : null,
        }).eq('id', paymentRecord.id);
        setPaymentRecord(prev => prev ? { ...prev, paid, payment_date: paid ? (paymentDate || new Date().toISOString().split('T')[0]) : null } : prev);
      } else {
        const { data } = await supabase.from('patient_payment_records').insert({
          user_id: user.id,
          patient_id: patient.id,
          clinic_id: patient.clinicId,
          month: currentMonth,
          year: currentYear,
          amount,
          paid,
          payment_date: paid ? (paymentDate || new Date().toISOString().split('T')[0]) : null,
        }).select('id, paid, payment_date, amount').maybeSingle();
        if (data) setPaymentRecord({ id: data.id, paid: data.paid, payment_date: data.payment_date, amount: data.amount });
      }
    } finally {
      setSavingPaymentRecord(false);
    }
  };


  // Auto-fetch payment record when fiscal period is selected
  useEffect(() => {
    if (!fiscalStartDate || !patient?.id || !user) return;
    const month = fiscalStartDate.getMonth() + 1;
    const year = fiscalStartDate.getFullYear();
    supabase
      .from('patient_payment_records')
      .select('paid, payment_date, amount')
      .eq('patient_id', patient.id)
      .eq('user_id', user.id)
      .eq('month', month)
      .eq('year', year)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          // Only auto-set status if user hasn't manually chosen 'total'
          if (fiscalPaymentStatus !== 'total') {
            setFiscalPaymentStatus(data.paid ? 'paid' : 'pending');
          }
          setFiscalPaymentDate(data.payment_date || '');
          if (data.amount > 0) {
            setFiscalTotalPaid(data.amount.toFixed(2));
            setFiscalTotalPaidFromApp(data.amount);
          } else {
            setFiscalTotalPaid('');
            setFiscalTotalPaidFromApp(null);
          }
        } else {
          if (fiscalPaymentStatus !== 'total') {
            setFiscalPaymentStatus('pending');
          }
          setFiscalPaymentDate('');
          setFiscalTotalPaid('');
          setFiscalTotalPaidFromApp(null);
        }
      });
  }, [fiscalStartDate, patient?.id, user]);

  useEffect(() => {
    if (!user) return;
    supabase.from('stamps').select('*').eq('user_id', user.id).order('created_at').then(({ data }) => {
      if (data) {
        setStamps(data);
        const defaultStamp = data.find(s => s.is_default);
        if (defaultStamp) {
          setSelectedStampId(defaultStamp.id);
          setFiscalStampId(defaultStamp.id);
          setPrStampId(defaultStamp.id);
        }
      }
    });
  }, [user]);

  // Load patient private notes
  useEffect(() => {
    if (!patient?.id || !user) return;
    supabase.from('saved_reports')
      .select('id, title, content, created_at, updated_at')
      .eq('patient_id', patient.id)
      .eq('user_id', user.id)
      .eq('mode', 'patient_note')
      .order('updated_at', { ascending: false })
      .then(({ data }) => { if (data) setPatientNotes(data); });
  }, [patient?.id, user]);

  const handleAddNote = async () => {
    if (!newNoteContent.trim() || !patient?.id || !user) return;
    setIsSavingNote(true);
    const { data, error } = await supabase.from('saved_reports').insert({
      user_id: user.id,
      patient_id: patient.id,
      title: newNoteTitle.trim() || 'Sem título',
      content: newNoteContent.trim(),
      mode: 'patient_note',
    }).select().single();
    if (!error && data) {
      setPatientNotes(prev => [data, ...prev]);
      setNewNoteTitle('');
      setNewNoteContent('');
      setIsAddingNote(false);
    }
    setIsSavingNote(false);
  };

  const handleSaveEditNote = async () => {
    if (!editingNoteId) return;
    setIsSavingNote(true);
    const { data, error } = await supabase.from('saved_reports')
      .update({ title: editingNoteTitle.trim() || 'Sem título', content: editingNoteContent.trim(), updated_at: new Date().toISOString() })
      .eq('id', editingNoteId).select().single();
    if (!error && data) {
      setPatientNotes(prev => prev.map(n => n.id === editingNoteId ? data : n));
      setEditingNoteId(null);
    }
    setIsSavingNote(false);
  };

  const handleDeleteNote = async (id: string) => {
    await supabase.from('saved_reports').delete().eq('id', id);
    setPatientNotes(prev => prev.filter(n => n.id !== id));
  };



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

  const patientDocsAsUploadedFiles: UploadedFile[] = useMemo(() => patientAttachments.map(a => {
    let url = a.data;
    if (!a.data.startsWith('http')) {
      const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(a.data);
      url = urlData.publicUrl;
    }
    return { id: a.id, name: a.name, filePath: a.data, fileType: a.type, url };
  }), [patientAttachments]);

  // All-time summaries (computed before early return so hooks order is stable)
  const totalPresent = patientEvolutions.filter(e => e.attendanceStatus === 'presente').length;
  const totalReposicao = patientEvolutions.filter(e => e.attendanceStatus === 'reposicao').length;
  const totalAbsent = patientEvolutions.filter(e => e.attendanceStatus === 'falta').length;
  const totalPaidAbsent = patientEvolutions.filter(e => e.attendanceStatus === 'falta_remunerada').length;
  const totalFeriadoRem = patientEvolutions.filter(e => e.attendanceStatus === 'feriado_remunerado').length;
  const totalFeriadoNaoRem = patientEvolutions.filter(e => e.attendanceStatus === 'feriado_nao_remunerado').length;
  const totalSessions = totalPresent + totalReposicao;
  const totalRegistros = patientEvolutions.length;
  const attendanceRate = totalRegistros > 0 ? Math.round(((totalPresent + totalReposicao) / totalRegistros) * 100) : 0;
  const totalBillableEvos = patientEvolutions.filter(e => ['presente','reposicao','falta_remunerada','feriado_remunerado'].includes(e.attendanceStatus));
  const totalUniqueDays = new Set(totalBillableEvos.filter(e => e.attendanceStatus === 'presente' || e.attendanceStatus === 'reposicao').map(e => e.date)).size;
  const ptType = patient?.paymentType as string | undefined;
  // Effective billing mode: patient override → then check clinic payment type
  const clPaymentType = clinic?.paymentType as string | undefined;
  const isFixoDiario = ptType === 'fixo_diaria' || clPaymentType === 'fixo_diario';
  const isFixoMensal = ptType === 'fixo' || clPaymentType === 'fixo_mensal';
  const paymentValue = patient?.paymentValue || 0;
  // Package personalizado: per-session value = total / sessionLimit
  const isPackagePersonalizado = patientPackage?.packageType === 'personalizado' && (patientPackage?.sessionLimit ?? 0) > 0;
  const isPackageMensal = patientPackage?.packageType === 'mensal';
  const perSessionValue = isPackagePersonalizado
    ? paymentValue / (patientPackage!.sessionLimit!)
    : paymentValue;
  const totalBillableCount = totalPresent + totalReposicao + totalPaidAbsent + totalFeriadoRem;
  const totalFinancial = isFixoMensal
    ? paymentValue
    : isFixoDiario
      ? totalUniqueDays * perSessionValue
      : totalBillableCount * perSessionValue;
  const totalFinancialSubtitle = isFixoMensal
    ? 'Valor Fixo Mensal'
    : isFixoDiario
      ? `Total de ${totalUniqueDays} diária(s)`
      : `Total de ${totalBillableCount} sessões`;

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
  const monthlyTotal = monthlyPresent + monthlyReposicao;
  const monthlyBillableCount = monthlyPresent + monthlyReposicao + monthlyPaidAbsent + monthlyFeriadoRem;
  const monthlyUniqueDays = new Set(monthlyEvolutions.filter(e => e.attendanceStatus === 'presente' || e.attendanceStatus === 'reposicao').map(e => e.date)).size;
  const monthlyRevenue = isFixoMensal
    ? paymentValue
    : isFixoDiario
      ? monthlyUniqueDays * perSessionValue
      : monthlyBillableCount * perSessionValue;
  const monthlyRevenueSubtitle = isFixoMensal
    ? 'Valor Fixo'
    : isFixoDiario
      ? `${monthlyUniqueDays} diária(s)`
      : `${monthlyBillableCount} sessão(ões)`;
  const monthlyRegistros = monthlyEvolutions.length;
  const monthlyAttendanceRate = monthlyRegistros > 0 ? Math.round(((monthlyPresent + monthlyReposicao) / monthlyRegistros) * 100) : 0;
  const monthlyMoodCounts = allMoodOptions.map(m => ({
    ...m, count: monthlyEvolutions.filter(e => e.mood === m.value).length,
  }));

  // Financial tab data (uses financialMonth, independent from reportMonth)
  const financialEvolutions = useMemo(() => {
    const start = startOfMonth(financialMonth);
    const end = endOfMonth(financialMonth);
    return patientEvolutions.filter(e => {
      const d = new Date(e.date + 'T12:00:00');
      return d >= start && d <= end;
    }).sort((a, b) => new Date(a.date + 'T12:00:00').getTime() - new Date(b.date + 'T12:00:00').getTime());
  }, [patientEvolutions, financialMonth]);

  const finPresent = financialEvolutions.filter(e => e.attendanceStatus === 'presente').length;
  const finReposicao = financialEvolutions.filter(e => e.attendanceStatus === 'reposicao').length;
  const finAbsent = financialEvolutions.filter(e => e.attendanceStatus === 'falta').length;
  const finPaidAbsent = financialEvolutions.filter(e => e.attendanceStatus === 'falta_remunerada').length;
  const finFeriadoRem = financialEvolutions.filter(e => e.attendanceStatus === 'feriado_remunerado').length;
  const finTotal = finPresent + finReposicao;
  const finBillableCount = finPresent + finReposicao + finPaidAbsent + finFeriadoRem;
  const finUniqueDays = new Set(financialEvolutions.filter(e => e.attendanceStatus === 'presente' || e.attendanceStatus === 'reposicao').map(e => e.date)).size;
  const finRevenue = isFixoMensal
    ? paymentValue
    : isFixoDiario
      ? finUniqueDays * perSessionValue
      : finBillableCount * perSessionValue;
  const finRegistros = financialEvolutions.length;
  const finAttendanceRate = finRegistros > 0 ? Math.round(((finPresent + finReposicao) / finRegistros) * 100) : 0;


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
    // Estimate how much space the block needs
    const hasSig = !!(stampOverride?.signature_image);
    const hasStampImg = !!(stampOverride?.stamp_image);
    const stampCbo = (stampOverride as any)?.cbo;
    const profId = therapistProfile?.professional_id;
    // header (divider+title) + sig img + stamp img + line + name + area + cbo + reg
    const estimatedH =
      14 + // divider + title
      (hasSig ? 14 : 0) +
      (hasStampImg ? 22 : 0) +
      6 + // sig line
      6 + // name
      (stampOverride?.clinical_area ? 5 : 0) +
      (stampCbo ? 5 : 0) +
      (profId ? 5 : 0) +
      4; // bottom padding

    const PAGE_H = 297;
    const FOOTER_SAFE = 15; // leave 15 mm for footer
    const usableBottom = PAGE_H - FOOTER_SAFE;

    // If block won't fit, add a new page
    if (y + estimatedH > usableBottom) {
      doc.addPage();
      y = 20;
    }

    doc.setDrawColor(...borderColor);
    doc.line(margin, y + 4, W - margin, y + 4);
    y += 12;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...accentDark);
    doc.text('RESPONSÁVEL PELO ATENDIMENTO', margin, y);
    y += 7;

    if (stampOverride) {
      // 1. Assinatura (imagem) — proporcional, máx 45×12
      if (stampOverride.signature_image) {
        try {
          const imgEl = document.createElement('img');
          imgEl.src = stampOverride.signature_image;
          await new Promise<void>(r => { imgEl.onload = () => r(); imgEl.onerror = () => r(); });
          let sw = 45; let sh = (imgEl.height / imgEl.width) * sw;
          if (sh > 12) { sh = 12; sw = (imgEl.width / imgEl.height) * sh; }
          doc.addImage(stampOverride.signature_image, 'PNG', margin, y, sw, sh, undefined, 'FAST');
          y += sh + 2;
        } catch { /* skip */ }
      }

      // 2. Carimbo (imagem) — proporcional, máx 40×18
      if (stampOverride.stamp_image) {
        try {
          const imgEl2 = document.createElement('img');
          imgEl2.src = stampOverride.stamp_image;
          await new Promise<void>(r => { imgEl2.onload = () => r(); imgEl2.onerror = () => r(); });
          let sw = 40; let sh = (imgEl2.height / imgEl2.width) * sw;
          if (sh > 18) { sh = 18; sw = (imgEl2.width / imgEl2.height) * sh; }
          doc.addImage(stampOverride.stamp_image, 'PNG', margin, y, sw, sh, undefined, 'FAST');
          y += sh + 3;
        } catch { /* skip */ }
      }

      // 3. Linha de assinatura
      doc.setDrawColor(100, 100, 100);
      doc.setLineWidth(0.4);
      doc.line(margin, y, margin + 70, y);
      y += 5;

      // 4. Nome (negrito)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...darkText);
      doc.text(stampOverride.name, margin, y);
      y += 5.5;

      // 5. Área clínica
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...mutedText);
      if (stampOverride.clinical_area) {
        doc.text(stampOverride.clinical_area, margin, y);
        y += 5;
      }

      // 6. CBO
      if (stampCbo) {
        doc.text(`CBO: ${stampCbo}`, margin, y);
        y += 5;
      }

      // 7. Registro profissional
      if (profId) {
        doc.text(`Registro: ${profId}`, margin, y);
        y += 5;
      }
      y += 2;
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
      y += 6;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...mutedText);
      doc.text(`${patient.name}   —   ${monthLabelCap}`, margin, y);
      y += 4;
      doc.setDrawColor(...borderColor);
      doc.line(margin, y, W - margin, y);
      y += 6;

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
        y += wrapped.length > 1 ? wrapped.length * 4.5 + 1 : 5;
      });

      doc.setDrawColor(...borderColor);
      doc.line(margin, y + 2, W - margin, y + 2);
      y += 7;

      // ── 1. RESUMO DE FREQUÊNCIA ──────────────────────────────────
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...accentDark);
      doc.text('1. RESUMO DE FREQUÊNCIA', margin, y); y += 6;

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
        y += 5;
      });
      doc.setDrawColor(...borderColor); doc.line(margin, y + 2, W - margin, y + 2); y += 7;

      // ── 2. HUMOR ─────────────────────────────────────────────────
      const moodsWithData = monthlyMoodCounts.filter(m => m.count > 0);
      if (moodsWithData.length > 0) {
        doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...accentDark);
        doc.text('2. HUMOR DO MÊS', margin, y); y += 6;
        moodsWithData.forEach(m => {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...darkText);
          doc.text(`${m.label}:`, margin + 4, y);
          doc.setFont('helvetica', 'bold');
          doc.text(String(m.count), W - margin - 2, y, { align: 'right' });
          y += 5;
        });
        doc.setDrawColor(...borderColor); doc.line(margin, y + 2, W - margin, y + 2); y += 7;
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
      doc.text(`${section3}. REGISTRO DAS SESSÕES (${visibleEvolutions.length})`, margin, y); y += 6;

      for (const evo of visibleEvolutions) {
        if (y > 260) { doc.addPage(); y = margin; }
        const dateStr = format(new Date(evo.date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR });
        const status = statusLabelMap[evo.attendanceStatus] || evo.attendanceStatus;
        const moodInfo = getMoodInfo(evo.mood, customMoods);
        doc.setDrawColor(...borderColor);
        doc.line(margin, y - 1, W - margin, y - 1);
        doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...darkText);
        doc.text(dateStr, margin + 2, y + 4);
        doc.setFont('helvetica', 'normal'); doc.setTextColor(...mutedText);
        doc.text(`Status: ${status}`, margin + 32, y + 4);
        if (moodInfo) doc.text(`Humor: ${moodInfo.label}`, margin + 100, y + 4);
        y += 7;
        if (evo.text) {
          doc.setTextColor(...darkText); doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
          const textLines = doc.splitTextToSize(evo.text, contentW - 4);
          textLines.forEach((line: string) => {
            if (y > 272) { doc.addPage(); y = margin; }
            doc.text(line, margin + 2, y); y += 4.5;
          });
          y += 2;
        } else { y += 1; }
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

  // ── RECIBO FISCAL helpers ────────────────────────────────────────────────
  const getFiscalEvolutions = () => {
    if (!fiscalStartDate || !fiscalEndDate) return [];
    // Normalize dates to midnight for correct inclusive range comparison
    const start = new Date(fiscalStartDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(fiscalEndDate);
    end.setHours(23, 59, 59, 999);
    return patientEvolutions.filter(evo => {
      const d = new Date(evo.date + 'T12:00:00');
      return d >= start && d <= end;
    }).sort((a, b) => new Date(a.date + 'T12:00:00').getTime() - new Date(b.date + 'T12:00:00').getTime());
  };

  const buildFiscalReceiptOpts = () => {
    const fiscalStamp = fiscalStampId && fiscalStampId !== 'none' ? stamps.find(s => s.id === fiscalStampId) || null : null;
    const evos = getFiscalEvolutions();
    const rawPaymentValue = patient?.paymentValue || 0;
    const STATUS_BILLABLE: Record<string, boolean> = {
      presente: true, reposicao: true, falta_remunerada: true, feriado_remunerado: true,
      falta: false, feriado_nao_remunerado: false,
    };
    const billableEvos = evos.filter(e => STATUS_BILLABLE[e.attendanceStatus] ?? false);
    const billableCount = billableEvos.length;
    // Use per-session value for Personalizado packages
    const fiscalPerSession = isPackagePersonalizado ? perSessionValue : rawPaymentValue;
    const calculatedTotal = patient?.paymentType === 'fixo'
      ? rawPaymentValue
      : billableCount * fiscalPerSession;

    // For "total" mode: calculate paid sessions (those whose month/year has paid=true)
    // We use the paid amount from the record if available, otherwise calculate from sessions
    let totalPaidValue: number;
    let paidSubtotal: number | undefined;
    let pendingSubtotal: number | undefined;

    if (fiscalPaymentStatus === 'paid') {
      totalPaidValue = fiscalTotalPaid ? parseFloat(fiscalTotalPaid) : calculatedTotal;
    } else if (fiscalPaymentStatus === 'total') {
      // Split evolutions by month and check which months are paid
      // Use the fiscalTotalPaid as paid amount if available
      totalPaidValue = calculatedTotal;
      paidSubtotal = fiscalTotalPaid ? parseFloat(fiscalTotalPaid) : 0;
      pendingSubtotal = calculatedTotal - (paidSubtotal || 0);
      if (pendingSubtotal < 0) pendingSubtotal = 0;
    } else {
      totalPaidValue = calculatedTotal;
    }

    return {
      patient: {
        id: patient.id,
        name: patient.name,
        birthdate: patient.birthdate,
        cpf: (patient as any).cpf,
        phone: patient.phone || undefined,
        clinicalArea: patient.clinicalArea || undefined,
        responsibleName: patient.responsibleName || undefined,
        responsibleEmail: (patient as any).responsibleEmail || undefined,
        responsible_cpf: (patient as any).responsible_cpf || (patient as any).responsibleCpf || undefined,
        paymentType: patient.paymentType || undefined,
        paymentValue: patient.paymentValue || undefined,
        effectiveSessionValue: isPackagePersonalizado ? perSessionValue : undefined,
        packageSessionLimit: isPackagePersonalizado ? patientPackage!.sessionLimit! : undefined,
      },
      clinic: clinic ? {
        name: clinic.name,
        cnpj: clinic.cnpj || undefined,
        address: clinic.address || undefined,
        email: clinic.email || undefined,
        phone: clinic.phone || undefined,
      } : undefined,
      evolutions: evos.map(e => ({
        id: e.id, date: e.date, attendanceStatus: e.attendanceStatus, text: e.text,
      })),
      startDate: fiscalStartDate!,
      endDate: fiscalEndDate!,
      stamp: fiscalStamp ? {
        id: fiscalStamp.id, name: fiscalStamp.name,
        clinical_area: fiscalStamp.clinical_area,
        stamp_image: fiscalStamp.stamp_image,
        signature_image: fiscalStamp.signature_image,
      } : null,
      therapistName: fiscalStamp?.name || therapistProfile?.name || undefined,
      professionalId: therapistProfile?.professional_id || undefined,
      therapistCpf: therapistProfile?.cpf || undefined,
      cbo: fiscalStamp?.cbo || undefined,
      totalPaid: totalPaidValue,
      paidSubtotal,
      pendingSubtotal,
      paymentStatus: fiscalPaymentStatus,
      paymentDate: fiscalPaymentDate || null,
    };
  };

  const handleExportFiscalPdf = async () => {
    if (!fiscalStartDate || !fiscalEndDate) return;
    if (getFiscalEvolutions().length === 0) { toast.error('Nenhuma sessão no período selecionado.'); return; }
    setIsExportingFiscalPdf(true);
    try {
      await generateFiscalReceiptPdf(buildFiscalReceiptOpts());
    } catch { toast.error('Erro ao gerar recibo'); }
    finally { setIsExportingFiscalPdf(false); }
  };


  const handleExportFiscalWord = async () => {
    if (!fiscalStartDate || !fiscalEndDate) return;
    const fiscalEvos = getFiscalEvolutions();
    if (fiscalEvos.length === 0) { toast.error('Nenhuma sessão no período selecionado.'); return; }
    setIsExportingFiscalWord(true);
    try {
      const STATUS_LABELS: Record<string, { label: string; billable: boolean }> = {
        presente: { label: 'Presente', billable: true },
        reposicao: { label: 'Reposição', billable: true },
        falta_remunerada: { label: 'Falta Remunerada', billable: true },
        feriado_remunerado: { label: 'Feriado Remunerado', billable: true },
        falta: { label: 'Falta', billable: false },
        feriado_nao_remunerado: { label: 'Feriado', billable: false },
      };
      const formatCpf = (cpf: string) => {
        const d = cpf.replace(/\D/g, '');
        if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
        return cpf;
      };
      const periodLabel = `${format(fiscalStartDate, 'dd/MM/yyyy', { locale: ptBR })} a ${format(fiscalEndDate, 'dd/MM/yyyy', { locale: ptBR })}`;
      const fiscalStamp = fiscalStampId && fiscalStampId !== 'none' ? stamps.find(s => s.id === fiscalStampId) || null : null;
      const rawPayVal = patient.paymentValue || 0;
      // For Personalizado packages use per-session value
      const payVal = isPackagePersonalizado ? perSessionValue : rawPayVal;
      const areaLabel = patient.clinicalArea || fiscalStamp?.clinical_area || 'Atendimento';

      let sessionTotal = 0;
      let sessionCount = 0;
      const rows = fiscalEvos.map(e => {
        const st = STATUS_LABELS[e.attendanceStatus] ?? { label: e.attendanceStatus, billable: false };
        const val = st.billable && patient.paymentType !== 'fixo' ? payVal : 0;
        const dateStr = format(new Date(e.date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR });
        if (st.billable) { sessionTotal += val; sessionCount++; }
        return `<tr style="border-bottom:1px solid #eee"><td style="padding:4px 8px">${dateStr}</td><td style="padding:4px 8px">${areaLabel}</td><td style="padding:4px 8px">${st.label}</td><td style="padding:4px 8px;text-align:right">${val > 0 ? `R$ ${val.toFixed(2)}` : '—'}</td></tr>`;
      }).join('');
      if (patient.paymentType === 'fixo' && payVal > 0) {
        sessionTotal = payVal;
        sessionCount = fiscalEvos.filter(e => STATUS_LABELS[e.attendanceStatus]?.billable).length;
      }
      const displayTotal = fiscalTotalPaid ? parseFloat(fiscalTotalPaid) : sessionTotal;
      const payStatusLabel = fiscalPaymentStatus === 'paid' ? 'PAGO' : fiscalPaymentStatus === 'total' ? 'TOTAL (PAGO + PENDENTE)' : 'PENDENTE';
      const patCpf = (patient as any).cpf;
      const respCpf = (patient as any).responsible_cpf || (patient as any).responsibleCpf;

      // Determine if minor to show correct CPF labels
      const patientAgeWord = (() => {
        if (!patient.birthdate) return null;
        try {
          const b = new Date(patient.birthdate + 'T12:00:00');
          let a = new Date().getFullYear() - b.getFullYear();
          const m = new Date().getMonth() - b.getMonth();
          if (m < 0 || (m === 0 && new Date().getDate() < b.getDate())) a--;
          return a;
        } catch { return null; }
      })();
      const isMinorWord = patientAgeWord !== null && patientAgeWord < 18;

      const html = `<html><body style="font-family:Arial,sans-serif;font-size:11pt;margin:40px">
        <h2 style="color:#1e3a8a;margin-bottom:4px">RECIBO DE ATENDIMENTO</h2>
        <p style="color:#666;margin-top:0">Período: ${periodLabel} &nbsp;·&nbsp; Emissão: ${format(new Date(), 'dd/MM/yyyy', { locale: ptBR })}</p>
        <hr/>
        <h3 style="color:#1e3a8a">TOMADOR DO SERVIÇO</h3>
        <p><strong>Nome:</strong> ${patient.name}</p>
        ${patCpf ? `<p><strong>${isMinorWord ? 'CPF do Paciente' : 'CPF'}:</strong> ${formatCpf(patCpf)}</p>` : ''}
        ${patient.birthdate ? `<p><strong>Nascimento:</strong> ${format(new Date(patient.birthdate + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}${patientAgeWord !== null ? ` (${patientAgeWord} anos)` : ''}</p>` : ''}
        ${patient.phone ? `<p><strong>Telefone:</strong> ${patient.phone}</p>` : ''}
        ${(patient.responsibleName || isMinorWord) ? `<hr/><h4>Responsável Legal${isMinorWord ? ' (Pagador — menor de idade)' : ''}</h4>${patient.responsibleName ? `<p><strong>Nome:</strong> ${patient.responsibleName}</p>` : ''}${respCpf ? `<p><strong>${isMinorWord ? 'CPF (Nota Fiscal)' : 'CPF'}:</strong> ${formatCpf(respCpf)}</p>` : ''}` : ''}
        <hr/>
        <h3 style="color:#1e3a8a">PRESTADOR DE SERVIÇO</h3>
        ${(fiscalStamp?.name || therapistProfile?.name) ? `<p><strong>Nome:</strong> ${fiscalStamp?.name || therapistProfile?.name}</p>` : ''}
        ${therapistProfile?.professional_id ? `<p><strong>Registro:</strong> ${therapistProfile.professional_id}</p>` : ''}
        ${therapistProfile?.cpf ? `<p><strong>CPF:</strong> ${formatCpf(therapistProfile.cpf)}</p>` : ''}
        ${(fiscalStamp?.cbo) ? `<p><strong>CBO:</strong> ${fiscalStamp.cbo}</p>` : ''}
        ${fiscalStamp?.clinical_area ? `<p><strong>Área:</strong> ${fiscalStamp.clinical_area}</p>` : ''}
        ${clinic?.name ? `<p><strong>Clínica:</strong> ${clinic.name}</p>` : ''}
        ${clinic?.cnpj ? `<p><strong>CNPJ:</strong> ${formatCpf(clinic.cnpj)}</p>` : ''}
        ${clinic?.address ? `<p><strong>Endereço:</strong> ${clinic.address}</p>` : ''}
        <hr/>
        <h3 style="color:#1e3a8a">DETALHAMENTO DAS SESSÕES (${fiscalEvos.length})</h3>
        <table style="width:100%;border-collapse:collapse;font-size:10pt">
          <thead><tr style="background:#f0f4ff"><th style="padding:6px 8px;text-align:left">Data</th><th style="padding:6px 8px;text-align:left">Área / Serviço</th><th style="padding:6px 8px;text-align:left">Status</th><th style="padding:6px 8px;text-align:right">Valor</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <hr/>
        <h3 style="color:#1e3a8a">RESUMO FINANCEIRO</h3>
        ${patient.paymentType === 'fixo' ? `<p>Modalidade: Mensalidade fixa &nbsp;|&nbsp; Sessões: ${sessionCount} &nbsp;|&nbsp; Valor: R$ ${payVal.toFixed(2)}</p>` : `<p>Modalidade: Por sessão &nbsp;|&nbsp; Sessões cobráveis: ${sessionCount} &nbsp;|&nbsp; Valor/sessão: R$ ${payVal.toFixed(2)}</p>`}
        <p style="font-size:13pt"><strong>TOTAL DO PERÍODO: R$ ${displayTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></p>
        <p><strong>Status:</strong> ${payStatusLabel}${fiscalPaymentDate && fiscalPaymentStatus === 'paid' ? ` &nbsp;·&nbsp; Recebido em: ${format(new Date(fiscalPaymentDate + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}` : ''}</p>
        <hr/>
        <p style="color:#555;font-size:9pt">Declaro, para os devidos fins fiscais e legais, que prestei os serviços de ${areaLabel.toLowerCase()} ao(à) paciente ${patient.name} conforme sessões discriminadas neste documento, no período de ${periodLabel}.</p>
        <br/><br/>
        <p>___________________________</p>
        ${(fiscalStamp?.name || therapistProfile?.name) ? `<p><strong>${fiscalStamp?.name || therapistProfile?.name}</strong></p>` : ''}
        ${therapistProfile?.professional_id ? `<p>Registro: ${therapistProfile.professional_id}</p>` : ''}
        ${fiscalStamp?.clinical_area ? `<p>${fiscalStamp.clinical_area}</p>` : ''}
        </body></html>`;

      const { asBlob } = await import('html-docx-js-typescript');
      const blob = await asBlob(html) as Blob;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = patient.name.replace(/\s+/g, '-').toLowerCase();
      a.download = `recibo-fiscal-${safeName}-${format(fiscalStartDate, 'yyyy-MM-dd')}_${format(fiscalEndDate, 'yyyy-MM-dd')}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Recibo Word gerado com sucesso!');
    } catch { toast.error('Erro ao gerar recibo Word'); }
    finally { setIsExportingFiscalWord(false); }
  };

  // ── RECIBO DE PAGAMENTO ───────────────────────────────────────────────────
  const buildPaymentReceiptOpts = () => {
    const prStamp = prStampId && prStampId !== 'none' ? stamps.find(s => s.id === prStampId) || null : null;
    const p = patient as any;
    const isMinorPR = (() => {
      if (!patient.birthdate) return false;
      try {
        const b = new Date(patient.birthdate + 'T12:00:00');
        let a = new Date().getFullYear() - b.getFullYear();
        const m = new Date().getMonth() - b.getMonth();
        if (m < 0 || (m === 0 && new Date().getDate() < b.getDate())) a--;
        return a < 18;
      } catch { return false; }
    })();
    // Use responsible if patient is minor OR therapist manually chose responsible
    const useResp = prUseResponsible || isMinorPR;

    // Determine payer: if there's a separate financial responsible, use them; otherwise use the legal responsible or patient
    const hasFinancialResp = useResp && patient.responsibleName && p.responsible_is_financial === false && p.financial_responsible_name;
    let payerName: string;
    let payerCpf: string | null;
    if (hasFinancialResp) {
      payerName = p.financial_responsible_name;
      payerCpf = p.financial_responsible_cpf || null;
    } else if (useResp && patient.responsibleName) {
      payerName = patient.responsibleName;
      payerCpf = p.responsible_cpf || null;
    } else {
      payerName = patient.name;
      payerCpf = p.cpf || null;
    }

    return {
      therapistName: prStamp?.name || therapistProfile?.name || '',
      therapistCpf: therapistProfile?.cpf || null,
      therapistProfessionalId: therapistProfile?.professional_id || null,
      therapistCbo: prStamp?.cbo || therapistProfile?.cbo || null,
      therapistClinicalArea: prStamp?.clinical_area || patient.clinicalArea || null,
      stamp: prStamp,
      payerName,
      payerCpf,
      location: prLocation
        ? (prLocalDate
            ? `${prLocation}, ${new Date(prLocalDate + 'T12:00:00').toLocaleDateString('pt-BR')}`
            : prLocation)
        : null,
      amount: prAmount ? parseFloat(prAmount) : 0,
      serviceName: prService || patient.clinicalArea || 'Atendimento',
      period: prPeriod,
      paymentMethod: prPaymentMethod,
      paymentDate: prPaymentDate,
      clinicName: clinic?.name || null,
      clinicAddress: clinic?.address || null,
      clinicCnpj: clinic?.cnpj || null,
    };
  };

  const handleExportPaymentReceiptPdf = async () => {
    setIsExportingPR(true);
    try {
      await generatePaymentReceiptPdf(buildPaymentReceiptOpts());
    } catch { toast.error('Erro ao gerar recibo'); }
    finally { setIsExportingPR(false); }
  };

  const handleExportPaymentReceiptWord = async () => {
    setIsExportingPRWord(true);
    try {
      await generatePaymentReceiptWord(buildPaymentReceiptOpts());
    } catch { toast.error('Erro ao gerar recibo Word'); }
    finally { setIsExportingPRWord(false); }
  };


  // Helper to open payment receipt dialog and pre-fill data
  const openPaymentReceiptDialog = async () => {
    // Pre-fill service from patient
    setPrService(patient.clinicalArea || stamps.find(s => s.is_default)?.clinical_area || stamps[0]?.clinical_area || '');
    // Pre-fill period as current month
    const now = new Date();
    const monthName = format(now, 'MMMM/yyyy', { locale: ptBR });
    setPrPeriod(monthName);
    // Pre-fill location from clinic address
    setPrLocation(clinic?.address || '');
    // Auto-detect: use responsible if patient is minor OR has a responsible registered
    const isMinorAuto = (() => {
      if (!patient.birthdate) return false;
      try {
        const b = new Date(patient.birthdate + 'T12:00:00');
        let a = now.getFullYear() - b.getFullYear();
        const m = now.getMonth() - b.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
        return a < 18;
      } catch { return false; }
    })();
    const hasResponsible = !!(patient.responsibleName);
    setPrUseResponsible(isMinorAuto || hasResponsible);
    // Reset session fields
    setPrSessions('');
    setPrSelectedSessions([]);
    setPrSessionMode('select');
    setPrUnitValue(patient.paymentValue ? patient.paymentValue.toFixed(2) : '');
    // Try to fetch last payment record for amount/date
    if (user && patient.id) {
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      const { data } = await supabase
        .from('patient_payment_records')
        .select('amount, payment_date')
        .eq('patient_id', patient.id)
        .eq('user_id', user.id)
        .eq('month', month)
        .eq('year', year)
        .maybeSingle();
      if (data) {
        if (data.amount > 0) setPrAmount(data.amount.toFixed(2));
        else if (patient.paymentValue) setPrAmount(patient.paymentValue.toFixed(2));
        if (data.payment_date) setPrPaymentDate(data.payment_date);
      } else if (patient.paymentValue) {
        setPrAmount(patient.paymentValue.toFixed(2));
      }
    }
    setPaymentReceiptOpen(true);
  };
  // ── RELATÓRIO FINANCEIRO (todos os status + valores) ─────────────────────
  const handleExportFinancialPDF = async () => {
    if (financialEvolutions.length === 0) { toast.error('Nenhuma evolução neste mês.'); return; }
    setIsExportingFinancial(true);
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const base = buildPdfBase(doc);
      const { W, margin, contentW, darkText, mutedText, borderColor, accentDark } = base;
      const monthLabel = format(financialMonth, 'MMMM yyyy', { locale: ptBR });
      const monthLabelCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
      let y = margin;

      // ── HEADER ──────────────────────────────────────────────────
      doc.setTextColor(...darkText); doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.text('RELATÓRIO FINANCEIRO MENSAL', margin, y); y += 6;
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...mutedText);
      doc.text(`${patient.name}   —   ${monthLabelCap}`, margin, y); y += 4;
      doc.setDrawColor(...borderColor); doc.line(margin, y, W - margin, y); y += 6;

      // ── IDENTIFICAÇÃO ────────────────────────────────────────────
      const idLines: [string, string][] = [];
      if (patient.name) idLines.push(['Paciente:', patient.name]);
      if (clinic?.name) idLines.push(['Unidade Clínica:', clinic.name]);
      if (patient.clinicalArea) idLines.push(['Área Clínica:', patient.clinicalArea]);
      if (patient.professionals) idLines.push(['Profissional(is):', patient.professionals]);
      if (patient.paymentValue) idLines.push(
        isPackagePersonalizado
          ? ['Valor por Sessão:', `R$ ${perSessionValue.toFixed(2)} (Pacote ${patientPackage!.name} — ${patientPackage!.sessionLimit} sessões)`]
          : ['Valor por Sessão:', `R$ ${patient.paymentValue.toFixed(2)}`]
      );
      idLines.push(['Período de Referência:', monthLabelCap]);
      idLines.push(['Data de Emissão:', format(new Date(), 'dd/MM/yyyy', { locale: ptBR })]);
      idLines.forEach(([label, value]) => {
        doc.setFont('helvetica', 'bold'); doc.setTextColor(...darkText);
        doc.text(label, margin, y);
        doc.setFont('helvetica', 'normal'); doc.setTextColor(...mutedText);
        const wrapped = doc.splitTextToSize(value, contentW - 52);
        doc.text(wrapped, margin + 52, y);
        y += wrapped.length > 1 ? wrapped.length * 4.5 + 1 : 5;
      });
      doc.setDrawColor(...borderColor); doc.line(margin, y + 2, W - margin, y + 2); y += 7;

      // ── 1. RESUMO FINANCEIRO ─────────────────────────────────────
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...accentDark);
      doc.text('1. RESUMO FINANCEIRO', margin, y); y += 6;

      const paidSessions = finPresent + finReposicao + finPaidAbsent + finFeriadoRem;
      const finRows: [string, string][] = [
        ['Sessões realizadas (presença + reposição):', String(finPresent + finReposicao)],
        ['Faltas remuneradas:', String(finPaidAbsent)],
        ['Feriados remunerados:', String(finFeriadoRem)],
        ['Total de sessões cobradas:', String(paidSessions)],
        ...(isPackagePersonalizado
          ? [['Pacote:', `${paidSessions} sessão(ões) utilizadas de ${patientPackage!.sessionLimit} (${patientPackage!.name})`] as [string, string],
             ['Valor por sessão (fracionado):', `R$ ${perSessionValue.toFixed(2)}`] as [string, string]]
          : [['Valor por sessão:', `R$ ${(patient.paymentValue ?? 0).toFixed(2)}`] as [string, string]]
        ),
        ['TOTAL FATURADO NO MÊS:', `R$ ${finRevenue.toFixed(2)}`],
      ];
      finRows.forEach(([label, value], i) => {
        const isBold = i === finRows.length - 1;
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
        doc.setFontSize(9); doc.setTextColor(...(isBold ? accentDark : darkText));
        doc.text(label, margin + 4, y);
        doc.setFont('helvetica', 'bold');
        doc.text(value, W - margin - 2, y, { align: 'right' });
        y += 5;
      });
      doc.setDrawColor(...borderColor); doc.line(margin, y + 2, W - margin, y + 2); y += 7;

      // ── 2. DETALHAMENTO DE FREQUÊNCIA ────────────────────────────
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...accentDark);
      doc.text('2. DETALHAMENTO DE FREQUÊNCIA', margin, y); y += 6;

      const freqRows: [string, string][] = [
        ['Total de sessões registradas:', String(finTotal)],
        ['Presenças:', String(finPresent)],
        ['Reposições:', String(finReposicao)],
        ['Faltas:', String(finAbsent)],
        ['Faltas remuneradas:', String(finPaidAbsent)],
        ['Feriados remunerados:', String(finFeriadoRem)],
        ['Feriados não remunerados:', String(financialEvolutions.filter(e => e.attendanceStatus === 'feriado_nao_remunerado').length)],
        ['Taxa de frequência (presença/total):', `${finAttendanceRate}%`],
      ];
      freqRows.forEach(([label, value]) => {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...darkText);
        doc.text(label, margin + 4, y);
        doc.setFont('helvetica', 'bold');
        doc.text(value, W - margin - 2, y, { align: 'right' });
        y += 5;
      });
      doc.setDrawColor(...borderColor); doc.line(margin, y + 2, W - margin, y + 2); y += 7;

      // ── 3. REGISTRO COMPLETO DAS SESSÕES ─────────────────────────
      const allStatusLabel: Record<string, string> = {
        presente: 'Presente', falta: 'Falta', falta_remunerada: 'Falta Remunerada',
        reposicao: 'Reposição', feriado_remunerado: 'Feriado Remunerado',
        feriado_nao_remunerado: 'Feriado Não Remunerado',
      };
      const paidStatuses = ['presente', 'reposicao', 'falta_remunerada', 'feriado_remunerado'];
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...accentDark);
      doc.text(`3. REGISTRO COMPLETO DAS SESSÕES (${financialEvolutions.length})`, margin, y); y += 6;

      for (const evo of financialEvolutions) {
        if (y > 260) { doc.addPage(); y = margin; }
        const dateStr = format(new Date(evo.date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR });
        const status = allStatusLabel[evo.attendanceStatus] || evo.attendanceStatus;
        const isPaid = paidStatuses.includes(evo.attendanceStatus);
        doc.setDrawColor(...borderColor); doc.line(margin, y - 1, W - margin, y - 1);
        doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...darkText);
        doc.text(dateStr, margin + 2, y + 4);
        doc.setFont('helvetica', 'normal'); doc.setTextColor(...mutedText);
        doc.text(status, margin + 32, y + 4);
        if (isPaid && patient.paymentValue) {
          doc.setTextColor(...accentDark);
          doc.text(`R$ ${patient.paymentValue.toFixed(2)}`, W - margin - 2, y + 4, { align: 'right' });
        }
        y += 7;
      }

      // ── ASSINATURA ───────────────────────────────────────────────
      const chosenStamp = financialStampId && financialStampId !== 'none'
        ? stamps.find(s => s.id === financialStampId)
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
      doc.save(`relatorio-financeiro-${patient.name.replace(/\s+/g, '-').toLowerCase()}-${format(financialMonth, 'yyyy-MM')}.pdf`);
      toast.success('Relatório financeiro gerado!');
    } catch (err) { console.error(err); toast.error('Erro ao gerar PDF financeiro'); }
    finally { setIsExportingFinancial(false); }
  };

  const handleSubmitEvolution = (e: React.FormEvent) => {
    e.preventDefault();
    const isAbsence = ['falta', 'falta_remunerada', 'feriado_remunerado', 'feriado_nao_remunerado'].includes(attendanceStatus);
    if (!isAbsence && !evolutionText.trim() && attachedFiles.length === 0 && Object.keys(templateFormValues).length === 0) return;

    const selectedTemplate = clinicTemplates.find(t => t.id === selectedTemplateId);
    let fullText = evolutionText;

    if (selectedTemplate && Object.keys(templateFormValues).length > 0) {
      const templateLines = selectedTemplate.fields
        .map(f => {
          const val = templateFormValues[f.id];
          if (val === undefined || val === '' || val === false) return null;
          if (f.type === 'checkbox' && val === true) return `✅ **${f.label}**`;
          return `**${f.label}**: ${val}`;
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
                {(patient as any).status === 'pendente_revisao' && (
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-warning/20 text-warning flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Pendente de Revisão
                  </span>
                )}
                {(patient as any).status === 'rascunho' && (
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-muted text-muted-foreground">Rascunho</span>
                )}
              </div>

              {/* Guardian badge for minors */}
              {patient.isMinor && patient.guardianName && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-warning/10 text-warning text-xs font-medium border border-warning/20">
                    👨‍👩‍👧 Responsável: {patient.guardianName}{patient.guardianKinship ? ` (${patient.guardianKinship})` : ''}
                    {patient.guardianPhone && (
                      <button
                        type="button"
                        onClick={() => {
                          const cleaned = patient.guardianPhone!.replace(/\D/g, '');
                          const number = cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
                          const a = document.createElement('a');
                          a.href = `https://wa.me/${number}`;
                          a.target = '_blank';
                          a.rel = 'noopener noreferrer';
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                        }}
                        className="ml-1 text-[#25D366] hover:text-[#128C7E] transition-colors"
                        title={`WhatsApp do responsável: ${patient.guardianPhone}`}
                      >
                        <WhatsAppIcon className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                </div>
              )}

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
                    {isPackagePersonalizado
                      ? `R$ ${perSessionValue.toFixed(2)}/sessão (Pacote de ${patientPackage!.sessionLimit})`
                      : `R$ ${patient.paymentValue.toFixed(2)}${patient.paymentType === 'sessao' ? '/sessão' : '/mês'}`
                    }
                  </span>
                )}
                {patient.diagnosis && (
                  <span className="truncate max-w-xs">📋 {patient.diagnosis}</span>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {(patient.whatsapp || patient.guardianPhone || patient.responsibleWhatsapp || patient.phone) && (
                <Button
                  variant="ghost" size="icon"
                  className="h-8 w-8 text-[#25D366] hover:bg-[#25D366]/10"
                  onClick={() => {
                    // Guardian fallback: if minor and guardian phone → use guardian
                    if (patient.isMinor && patient.guardianPhone) {
                      const cleaned = patient.guardianPhone.replace(/\D/g, '');
                      const number = cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
                      const a = document.createElement('a');
                      a.href = `https://wa.me/${number}`;
                      a.target = '_blank'; a.rel = 'noopener noreferrer';
                      document.body.appendChild(a); a.click(); document.body.removeChild(a);
                      return;
                    }
                    const hasPatientNum = !!(patient.whatsapp || patient.phone);
                    const hasResponsible = !!patient.responsibleWhatsapp;
                    if (hasPatientNum && hasResponsible) {
                      setWhatsAppRecipientOpen(true);
                    } else if (hasPatientNum) {
                      const num = patient.whatsapp || patient.phone!;
                      const cleaned = num.replace(/\D/g, '');
                      const number = cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
                      window.open(`https://wa.me/${number}`, '_blank');
                    } else if (hasResponsible) {
                      const cleaned = patient.responsibleWhatsapp!.replace(/\D/g, '');
                      const number = cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
                      window.open(`https://wa.me/${number}`, '_blank');
                    }
                  }}
                  title={patient.isMinor && patient.guardianPhone ? `WhatsApp do Responsável: ${patient.guardianName}` : 'WhatsApp'}
                >
                  <WhatsAppIcon className="w-4 h-4" />
                </Button>
              )}
              {(patient as any).status === 'pendente_revisao' && (
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs text-success border-success/30 hover:bg-success/5"
                  onClick={async () => { await supabase.from('patients').update({ status: 'ativo' } as any).eq('id', patient.id); updatePatient(patient.id, {} as any); toast.success('Paciente ativado!'); }}
                  title="Ativar paciente">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Ativar
                </Button>
              )}
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
          <p className="text-xs text-muted-foreground mt-0.5">{totalFinancialSubtitle}</p>
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
      <Tabs defaultValue="evolutions" className="space-y-5">
        <TabsList className="w-full bg-transparent h-auto p-0 grid grid-cols-4 sm:grid-cols-4 gap-2.5">
          {[
            { value: 'evolutions', icon: TrendingUp, label: 'Evoluções' },
            { value: 'reports', icon: BarChart3, label: 'Rel. Mensal' },
            { value: 'financial', icon: DollarSign, label: 'Financeiro' },
            { value: 'documents', icon: Paperclip, label: 'Documentos' },
            { value: 'tasks', icon: ListTodo, label: 'Tarefas' },
            { value: 'notes', icon: PenLine, label: 'Notas' },
            { value: 'portal', icon: Users, label: 'Portal' },
            { value: 'mural', icon: Newspaper, label: 'Mural' },
            ...(isOrg ? [{ value: 'therapists', icon: UserCheck, label: 'Terapeutas' }] : []),
          ].map(({ value, icon: Icon, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="flex flex-col items-center justify-center gap-1.5 h-16 rounded-xl border border-border bg-card shadow-sm text-muted-foreground text-[11px] font-medium transition-all hover:border-primary/30 hover:text-foreground data-[state=active]:bg-primary/10 data-[state=active]:border-primary/40 data-[state=active]:text-primary data-[state=active]:shadow-none"
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{label}</span>
            </TabsTrigger>
          ))}
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
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="outline" size="sm" className="gap-2 text-xs text-primary border-primary/30 hover:bg-primary/5"
                    onClick={() => setFeedbackBulkOpen(true)}>
                    <Sparkles className="w-3.5 h-3.5" /> Feedback em Lote
                  </Button>
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
                </div>
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
                            <Button variant="ghost" size="sm" className="gap-1 h-7 px-2 text-xs text-primary hover:bg-primary/10"
                              onClick={() => setFeedbackEvolution(evo)} title="Gerar feedback para os pais">
                              <Sparkles className="w-3 h-3" />
                              <span className="hidden sm:inline">Feedback IA</span>
                            </Button>
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
                        {evo.text && <EvolutionText text={evo.text} className="text-foreground text-sm whitespace-pre-wrap" />}

                        {evo.attachments && evo.attachments.length > 0 && (
                          <div className="mt-3 space-y-2">
                            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                              <Paperclip className="w-3 h-3" /> {evo.attachments.length} anexo(s)
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {evo.attachments.map((att) => {
                                const fileUrl = att.data.startsWith('http') ? att.data : supabase.storage.from('attachments').getPublicUrl(att.data).data.publicUrl;
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
            <div className="flex flex-col gap-3 p-4 border-b border-border">
              <div className="flex items-center justify-center gap-3">
                <Button variant="outline" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => setReportMonth(m => subMonths(m, 1))}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <h2 className="font-semibold text-foreground capitalize text-center text-sm min-w-0 flex-1 truncate">
                  {format(reportMonth, 'MMMM yyyy', { locale: ptBR })}
                </h2>
                <Button variant="outline" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => setReportMonth(m => addMonths(m, 1))}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              {/* Download section */}
              <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5" /> Baixar Relatório
                </p>

                {/* Stamp selector */}
                <div className="flex items-center gap-2">
                  <StampIcon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <Select value={selectedStampId} onValueChange={setSelectedStampId}>
                    <SelectTrigger className="h-7 text-xs flex-1">
                      <SelectValue placeholder="Sem carimbo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem carimbo (linha em branco)</SelectItem>
                      {stamps.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} — {s.clinical_area}{s.is_default ? ' ⭐' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Export buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={handleExportMonthlyPDF}
                    disabled={isExportingMonthly || monthlyEvolutions.length === 0}
                    variant="outline"
                    className="gap-1.5 text-xs h-9 w-full"
                    size="sm"
                  >
                    {isExportingMonthly ? <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" /> : <Download className="w-3.5 h-3.5 flex-shrink-0" />}
                    <span className="truncate">Atendimento</span>
                  </Button>
                  <Button
                    onClick={handleExportFinancialPDF}
                    disabled={isExportingFinancial || monthlyEvolutions.length === 0}
                    className="gap-1.5 text-xs h-9 w-full"
                    size="sm"
                  >
                    {isExportingFinancial ? <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" /> : <Download className="w-3.5 h-3.5 flex-shrink-0" />}
                    <span className="truncate">Financeiro</span>
                  </Button>
                </div>

              </div>
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
                      <p className="text-xs text-muted-foreground">{monthlyRevenueSubtitle}</p>
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

                  {/* Payment info (PIX / bank data) */}
                  {(patient as any).payment_info && (
                    <div className="bg-primary/5 rounded-xl border border-primary/20 p-4">
                      <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5" /> Chave PIX / Dados de Pagamento
                        <span className="ml-auto text-[10px] font-normal text-primary/60">Visível no portal do paciente</span>
                      </p>
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{(patient as any).payment_info}</p>
                    </div>
                  )}
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
                      const fileUrl = att.data.startsWith('http') ? att.data : supabase.storage.from('attachments').getPublicUrl(att.data).data.publicUrl;
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

            <PatientSavedReports
              patientId={patient.id}
              clinicName={clinic?.name}
              clinicAddress={clinic?.address || undefined}
              clinicLetterhead={clinic?.letterhead || undefined}
              clinicEmail={clinic?.email}
              clinicCnpj={clinic?.cnpj}
              clinicPhone={clinic?.phone}
              clinicServicesDescription={clinic?.servicesDescription}
              therapistName={therapistProfile?.name || undefined}
              therapistProfessionalId={therapistProfile?.professional_id || undefined}
              therapistCbo={stamps.find(s => s.is_default)?.cbo || stamps[0]?.cbo || undefined}
              therapistClinicalArea={stamps.find(s => s.is_default)?.clinical_area || stamps[0]?.clinical_area || undefined}
              therapistStampImage={stamps.find(s => s.is_default)?.stamp_image || stamps[0]?.stamp_image || undefined}
              therapistSignatureImage={stamps.find(s => s.is_default)?.signature_image || stamps[0]?.signature_image || undefined}
            />
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

        {/* Financial Tab */}
        <TabsContent value="financial" className="space-y-4">
          {/* Month navigator */}
          <div className="bg-card rounded-xl px-4 py-3 shadow-sm border border-border flex items-center justify-between">
            <button
              onClick={() => setFinancialMonth(m => subMonths(m, 1))}
              className="p-1.5 rounded-lg hover:bg-secondary/60 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </button>
            <span className="text-sm font-semibold text-foreground capitalize">
              {format(financialMonth, 'MMMM yyyy', { locale: ptBR })}
            </span>
            <button
              onClick={() => setFinancialMonth(m => addMonths(m, 1))}
              className="p-1.5 rounded-lg hover:bg-secondary/60 transition-colors disabled:opacity-40"
              disabled={financialMonth.getFullYear() > new Date().getFullYear() || (financialMonth.getFullYear() === new Date().getFullYear() && financialMonth.getMonth() >= new Date().getMonth())}
            >
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Monthly payment status */}
          <div className="bg-card rounded-xl p-5 shadow-sm border border-border">
            <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2 text-sm">
              <DollarSign className="w-4 h-4 text-success" /> Pagamento — <span className="capitalize">{format(financialMonth, 'MMMM yyyy', { locale: ptBR })}</span>
            </h2>

            <div className="flex items-center justify-between rounded-xl bg-secondary/40 border border-border/60 px-4 py-3 mb-4">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {paymentRecord?.paid ? '✅ Pago' : '⏳ Pendente'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {patient.paymentValue
                    ? `R$ ${patient.paymentValue.toFixed(2)}${patient.paymentType === 'sessao' ? ' por sessão' : '/mês'}`
                    : 'Valor não configurado'}
                </p>
              </div>
              <Switch
                checked={paymentRecord?.paid || false}
                disabled={savingPaymentRecord}
                onCheckedChange={async (checked) => {
                  const dateVal = checked ? new Date().toISOString().split('T')[0] : null;
                  await handleSavePaymentRecord(checked, dateVal);
                }}
              />
            </div>

            {paymentRecord?.paid && (
              <div className="mb-4">
                <Label className="text-xs mb-1.5 block">Data do Pagamento</Label>
                <Input
                  type="date"
                  value={paymentRecord.payment_date || ''}
                  onChange={async (e) => {
                    await handleSavePaymentRecord(true, e.target.value);
                  }}
                  className="h-9 text-xs max-w-xs"
                />
              </div>
            )}

            {(patient as any).payment_due_day && (
              <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 mb-1">
                🗓 Vencimento: dia <strong>{(patient as any).payment_due_day}</strong> de cada mês
              </p>
            )}
          </div>

          {/* Document generators */}
          <div className="bg-card rounded-xl p-5 shadow-sm border border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground flex items-center gap-2 text-sm">
                <Receipt className="w-4 h-4 text-primary" /> Documentos Financeiros
              </h2>
            </div>
            {/* Stamp selector for documents */}
            {stamps.length > 0 && (
              <div className="mb-4">
                <Label className="text-xs mb-1.5 block text-muted-foreground flex items-center gap-1.5">
                  <StampIcon className="w-3.5 h-3.5" /> Carimbo nos documentos
                </Label>
                <Select value={financialStampId} onValueChange={setFinancialStampId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Sem carimbo (linha em branco)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem carimbo (linha em branco)</SelectItem>
                    {stamps.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} — {s.clinical_area}{s.is_default ? ' ⭐' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => {
                  if (financialStampId && financialStampId !== 'none') setPrStampId(financialStampId);
                  setPaymentReceiptOpen(true);
                }}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-secondary/30 hover:bg-secondary/60 hover:border-primary/40 transition-colors text-left group"
              >
                <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center group-hover:bg-success/20 transition-colors">
                  <FileText className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Recibo de Pagamento</p>
                  <p className="text-xs text-muted-foreground mt-0.5">PDF ou Word com assinatura</p>
                </div>
              </button>

              <button
                onClick={() => {
                  if (financialStampId && financialStampId !== 'none') setFiscalStampId(financialStampId);
                  setFiscalDialogOpen(true);
                }}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-secondary/30 hover:bg-secondary/60 hover:border-primary/40 transition-colors text-left group"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Receipt className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Extrato Fiscal</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Sessões por período</p>
                </div>
              </button>

              <button
                onClick={() => handleExportFinancialPDF()}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-secondary/30 hover:bg-secondary/60 hover:border-primary/40 transition-colors text-left group"
              >
                <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center group-hover:bg-warning/20 transition-colors">
                  {isExportingFinancial ? (
                    <Loader2 className="w-5 h-5 text-warning animate-spin" />
                  ) : (
                    <BarChart3 className="w-5 h-5 text-warning" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Relatório Financeiro</p>
                  <p className="text-xs text-muted-foreground mt-0.5">PDF com histórico completo</p>
                </div>
              </button>
            </div>
          </div>

          {/* Monthly summary */}
          <div className="bg-card rounded-xl p-5 shadow-sm border border-border">
            <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-accent" /> Resumo — <span className="capitalize">{format(financialMonth, 'MMMM yyyy', { locale: ptBR })}</span>
            </h2>
            {finTotal === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhuma evolução neste mês.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg bg-secondary/40 p-3 text-center">
                  <p className="text-xl font-bold text-foreground">{finPresent + finReposicao}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Sessões</p>
                </div>
                <div className="rounded-lg bg-secondary/40 p-3 text-center">
                  <p className="text-xl font-bold text-destructive">{finAbsent}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Faltas</p>
                </div>
                <div className="rounded-lg bg-secondary/40 p-3 text-center">
                  <p className="text-xl font-bold text-success">{finAttendanceRate}%</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Frequência</p>
                </div>
                <div className="rounded-lg bg-secondary/40 p-3 text-center">
                  <p className="text-xl font-bold text-success">R$ {finRevenue.toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Receita</p>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes">
          <div className="bg-card rounded-xl p-5 shadow-sm border border-border space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground flex items-center gap-2 text-sm">
                <PenLine className="w-4 h-4 text-primary" /> Anotações Privadas
                <span className="text-xs font-normal text-muted-foreground ml-1">— visíveis apenas para você</span>
              </h2>
              {!isAddingNote && (
                <Button size="sm" onClick={() => setIsAddingNote(true)} className="gap-1.5 h-8 text-xs">
                  <Plus className="w-3.5 h-3.5" /> Nova Nota
                </Button>
              )}
            </div>

            {/* New note form */}
            {isAddingNote && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                <Input
                  placeholder="Título (opcional)"
                  value={newNoteTitle}
                  onChange={e => setNewNoteTitle(e.target.value)}
                  className="h-8 text-sm"
                />
                <Textarea
                  placeholder="Escreva sua anotação privada aqui..."
                  value={newNoteContent}
                  onChange={e => setNewNoteContent(e.target.value)}
                  className="text-sm min-h-[100px] resize-none"
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setIsAddingNote(false); setNewNoteTitle(''); setNewNoteContent(''); }}>
                    Cancelar
                  </Button>
                  <Button size="sm" className="h-8 text-xs gap-1.5" onClick={handleAddNote} disabled={!newNoteContent.trim() || isSavingNote}>
                    {isSavingNote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Salvar
                  </Button>
                </div>
              </div>
            )}

            {/* Notes list */}
            {patientNotes.length === 0 && !isAddingNote ? (
              <div className="text-center py-10">
                <div className="text-5xl mb-3">📝</div>
                <p className="text-muted-foreground text-sm">Nenhuma anotação ainda.</p>
                <p className="text-muted-foreground text-xs mt-1">Clique em "Nova Nota" para adicionar.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {patientNotes.map(note => (
                  <div key={note.id} className="rounded-xl border border-border bg-secondary/30 p-4 space-y-2 group">
                    {editingNoteId === note.id ? (
                      <div className="space-y-2">
                        <Input
                          value={editingNoteTitle}
                          onChange={e => setEditingNoteTitle(e.target.value)}
                          placeholder="Título (opcional)"
                          className="h-8 text-sm"
                        />
                        <Textarea
                          value={editingNoteContent}
                          onChange={e => setEditingNoteContent(e.target.value)}
                          className="text-sm min-h-[80px] resize-none"
                          autoFocus
                        />
                        <div className="flex gap-2 justify-end">
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingNoteId(null)}>
                            Cancelar
                          </Button>
                          <Button size="sm" className="h-7 text-xs gap-1" onClick={handleSaveEditNote} disabled={isSavingNote}>
                            {isSavingNote ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                            Salvar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            {note.title && note.title !== 'Sem título' && (
                              <p className="text-sm font-semibold text-foreground truncate">{note.title}</p>
                            )}
                            <p className="text-sm text-foreground/80 whitespace-pre-wrap mt-0.5">{note.content}</p>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => { setEditingNoteId(note.id); setEditingNoteTitle(note.title === 'Sem título' ? '' : note.title); setEditingNoteContent(note.content); }}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteNote(note.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(note.updated_at), "dd 'de' MMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Portal Tab */}
        <TabsContent value="portal">
          <PortalTab
            patientId={patient.id}
            patientEmail={patient.email}
            patientName={patient.name}
            responsibleEmail={patient.responsibleEmail}
            responsibleName={patient.responsibleName}
          />
        </TabsContent>


        {/* Mural Tab */}
        <TabsContent value="mural">
          <PatientFeed
            patientId={patient.id}
            therapistId={user.id}
            therapistName={therapistProfile?.name ?? undefined}
            isTherapist={true}
            currentUserId={user.id}
            currentUserName={therapistProfile?.name ?? 'Terapeuta'}
          />
        </TabsContent>

        {/* Terapeutas Responsáveis Tab */}
        {isOrg && (
          <TabsContent value="therapists" className="space-y-4">
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-primary" />
                  <h2 className="font-semibold text-foreground text-sm">Terapeutas Responsáveis</h2>
                  {therapistAssignments.length > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-primary/10 text-primary">
                      {therapistAssignments.length}
                    </span>
                  )}
                </div>
                {canManageAssignments && (
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setAssignmentDialogOpen(true)}>
                    <Pencil className="w-3 h-3" /> Gerenciar vínculos
                  </Button>
                )}
              </div>
              <div className="p-5">
                {assignmentsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : therapistAssignments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                    <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center">
                      <UserCheck className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Nenhum terapeuta vinculado</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {canManageAssignments
                          ? 'Clique em "Gerenciar vínculos" para adicionar terapeutas responsáveis por este paciente.'
                          : 'Nenhum terapeuta foi vinculado a este paciente ainda.'}
                      </p>
                    </div>
                    {canManageAssignments && (
                      <Button size="sm" variant="outline" className="gap-1.5 mt-1" onClick={() => setAssignmentDialogOpen(true)}>
                        <Plus className="w-3.5 h-3.5" /> Adicionar terapeuta
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {therapistAssignments.map(t => (
                      <div key={t.memberId} className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border">
                        <Avatar className="w-10 h-10 shrink-0">
                          {t.avatarUrl && <AvatarImage src={t.avatarUrl} />}
                          <AvatarFallback className="text-sm bg-primary/10 text-primary font-semibold">
                            {(t.name || t.email)[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground leading-tight truncate">
                            {t.name || t.email}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{t.email}</p>
                          {t.scheduleTime && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3 shrink-0" /> {t.scheduleTime}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Inline management panel for owners/admins */}
            {canManageAssignments && orgMembers.length > 0 && (
              <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-border bg-muted/30">
                  <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" /> Todos os membros da equipe
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Clique em um membro para vincular ou desvincular deste paciente.</p>
                </div>
                <div className="p-4 space-y-2">
                  {orgMembers.map(member => {
                    const isAssigned = therapistAssignments.some(a => a.memberId === member.memberId);
                    const localTime = assignmentScheduleTimes[member.memberId] ?? (isAssigned ? member.scheduleTime || '' : '');
                    return (
                      <div key={member.memberId} className="space-y-1.5">
                        <div
                          className={cn(
                            'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                            isAssigned ? 'border-primary/40 bg-primary/5' : 'border-border hover:bg-muted/50'
                          )}
                          onClick={() => toggleAssignment(member, localTime || undefined)}
                        >
                          <Avatar className="w-9 h-9 shrink-0">
                            {member.avatarUrl && <AvatarImage src={member.avatarUrl} />}
                            <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                              {(member.name || member.email)[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{member.name || member.email}</p>
                            <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                          </div>
                          <div className={cn(
                            'flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full shrink-0',
                            isAssigned ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                          )}>
                            <UserCheck className="w-3.5 h-3.5" />
                            {isAssigned ? 'Vinculado' : 'Vincular'}
                          </div>
                        </div>
                        {isAssigned && (
                          <div className="pl-12">
                            <input
                              type="text"
                              placeholder="Horário do atendimento (ex: 14:00)"
                              defaultValue={member.scheduleTime || ''}
                              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                              onChange={e => setAssignmentScheduleTimes(prev => ({ ...prev, [member.memberId]: e.target.value }))}
                              onBlur={e => updateScheduleTime(member.memberId, e.target.value)}
                              onClick={e => e.stopPropagation()}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>
        )}

      </Tabs>

      {editingEvolution && (
        <EditEvolutionDialog evolution={editingEvolution} open={!!editingEvolution}
          onOpenChange={(open) => !open && setEditingEvolution(null)}
          onSave={(updates) => updateEvolution(editingEvolution.id, updates)}
          showFaltaRemunerada={!!(clinic && (clinic.absencePaymentType !== 'never' || clinic.paysOnAbsence !== false))} />
      )}

      {/* Feedback IA — individual */}
      {feedbackEvolution && (
        <FeedbackIAModal
          open={!!feedbackEvolution}
          onOpenChange={(v) => !v && setFeedbackEvolution(null)}
          evolutions={[feedbackEvolution]}
          patientId={patient.id}
          patientName={patient.name}
          patientWhatsapp={patient.whatsapp}
          responsibleWhatsapp={patient.responsibleWhatsapp}
          clinicalArea={patient.clinicalArea}
          isBulk={false}
        />
      )}

      {/* Feedback IA — em lote */}
      <FeedbackIAModal
        open={feedbackBulkOpen}
        onOpenChange={setFeedbackBulkOpen}
        evolutions={patientEvolutions}
        patientId={patient.id}
        patientName={patient.name}
        patientWhatsapp={patient.whatsapp}
        responsibleWhatsapp={patient.responsibleWhatsapp}
        clinicalArea={patient.clinicalArea}
        isBulk={true}
      />

      <EditPatientDialog patient={patient} open={editPatientOpen} onOpenChange={setEditPatientOpen}
        onSave={updatePatient} clinicPackages={clinic ? getClinicPackages(clinic.id) : []} />

      {/* ── PAYMENT RECEIPT DIALOG ───────────────────────────────────────── */}
      <Dialog open={paymentReceiptOpen} onOpenChange={setPaymentReceiptOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-success" /> Recibo de Pagamento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">

            {/* Missing data warnings — uses prUseResponsible to check correct CPF */}
            {(() => {
              const missingTherapistCpf = !therapistProfile?.cpf;
              const missingPayerCpf = prUseResponsible
                ? !(patient as any).responsible_cpf
                : !(patient as any).cpf;
              const payerLabel = prUseResponsible ? 'CPF do responsável financeiro' : 'CPF do paciente';
              const missingClinicCnpj = !clinic?.cnpj;
              const missingClinicAddress = !clinic?.address;
              const warnings: { msg: string; link: string; label: string }[] = [];
              if (missingTherapistCpf) warnings.push({ msg: 'CPF do terapeuta não cadastrado.', link: '/profile', label: 'Ir para Perfil' });
              if (missingPayerCpf) warnings.push({ msg: `${payerLabel} não cadastrado.`, link: `/patients/${patient.id}`, label: 'Editar paciente' });
              if (missingClinicCnpj && clinic) warnings.push({ msg: 'CNPJ da clínica não cadastrado.', link: `/clinics/${clinic.id}`, label: 'Editar clínica' });
              if (missingClinicAddress && clinic) warnings.push({ msg: 'Endereço da clínica não cadastrado.', link: `/clinics/${clinic.id}`, label: 'Editar clínica' });
              if (warnings.length === 0) return null;
              return (
                <div className="space-y-1.5">
                  {warnings.map((w, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs">
                      <span className="flex items-center gap-1.5 text-destructive/80"><span>⚠</span><span>{w.msg}</span></span>
                      <button onClick={() => { setPaymentReceiptOpen(false); navigate(w.link); }}
                        className="shrink-0 text-xs font-medium text-primary underline underline-offset-2 hover:no-underline">{w.label}</button>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Payer toggle */}
            {(() => {
              const pp = patient as any;
              const isMinorAuto = (() => {
                if (!patient.birthdate) return false;
                try {
                  const b = new Date(patient.birthdate + 'T12:00:00');
                  let a = new Date().getFullYear() - b.getFullYear();
                  const m = new Date().getMonth() - b.getMonth();
                  if (m < 0 || (m === 0 && new Date().getDate() < b.getDate())) a--;
                  return a < 18;
                } catch { return false; }
              })();
              const hasResponsibleAuto = !!(patient.responsibleName);
              const hasSeparateFinancial = prUseResponsible && patient.responsibleName && pp.responsible_is_financial === false && pp.financial_responsible_name;
              const displayName = hasSeparateFinancial
                ? pp.financial_responsible_name
                : prUseResponsible && patient.responsibleName
                  ? patient.responsibleName
                  : patient.name;
              const displayCpf = hasSeparateFinancial
                ? pp.financial_responsible_cpf
                : prUseResponsible ? pp.responsible_cpf : pp.cpf;
              return (
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-foreground">Pagador no recibo</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        <span className="text-foreground font-medium">{displayName}</span>
                        {displayCpf ? ` · CPF: ${displayCpf}` : ' · CPF não cadastrado'}
                        {hasSeparateFinancial && <span className="ml-1 text-primary">(resp. financeiro)</span>}
                      </p>
                    </div>
                    <Switch
                      checked={prUseResponsible}
                      onCheckedChange={setPrUseResponsible}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isMinorAuto
                      ? '⚠ Paciente menor de idade — selecionar responsável'
                      : hasResponsibleAuto
                        ? '⚠ Paciente com responsável cadastrado — selecionar responsável'
                        : 'Usar responsável no recibo'}
                  </p>
                </div>
              );
            })()}

            {/* Preview text */}
            <div className="bg-muted/40 rounded-lg p-3 text-xs text-muted-foreground leading-relaxed italic">
              {(() => {
                const pp = patient as any;
                const prStampPreview = prStampId && prStampId !== 'none' ? stamps.find(s => s.id === prStampId) : stamps.find(s => s.is_default) || stamps[0];
                const tName = prStampPreview?.name || therapistProfile?.name || '[Terapeuta]';
                const tCpf = therapistProfile?.cpf ? `, inscrito(a) no CPF/CNPJ sob o número ${therapistProfile.cpf},` : '';
                const hasSepFin = prUseResponsible && patient.responsibleName && pp.responsible_is_financial === false && pp.financial_responsible_name;
                const pName = hasSepFin ? pp.financial_responsible_name
                  : prUseResponsible && patient.responsibleName ? patient.responsibleName : patient.name;
                const pCpfRaw = hasSepFin ? pp.financial_responsible_cpf
                  : prUseResponsible ? pp.responsible_cpf : pp.cpf;
                const pCpf = pCpfRaw ? `, inscrito(a) no CPF sob o número ${pCpfRaw},` : '';
                const amtDisplay = prAmount ? `R$ ${parseFloat(prAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ [valor]';
                const dateDisplay = prPaymentDate ? format(new Date(prPaymentDate + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : '___/___/______';
                return <>
                  <p>Eu, <strong>{tName}</strong>{tCpf} declaro para os devidos fins que recebi de <strong>{pName}</strong>{pCpf} a importância de <strong>{amtDisplay}</strong>, referente ao pagamento do serviço de <strong>{prService || '[serviço]'}</strong>, realizado no período de <strong>{prPeriod || '[período]'}</strong>.</p>
                  <p className="mt-2">A quantia foi paga através de <strong>{prPaymentMethod}</strong> na data de <strong>{dateDisplay}</strong>.</p>
                </>;
              })()}
            </div>

            {/* Sessions selector — only shows performed (billable) sessions */}
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="flex border-b border-border">
                <button onClick={() => setPrSessionMode('select')}
                  className={cn('flex-1 text-xs py-2 font-medium transition-colors',
                    prSessionMode === 'select' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                  Selecionar Sessões
                </button>
                <button onClick={() => { setPrSessionMode('manual'); setPrSelectedSessions([]); }}
                  className={cn('flex-1 text-xs py-2 font-medium transition-colors',
                    prSessionMode === 'manual' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                  Digitar Manualmente
                </button>
              </div>
              <div className="p-3 space-y-2">
                {prSessionMode === 'select' ? (() => {
                  // Only billable sessions of THIS patient (deduped via patientEvolutions)
                  const billable = [...patientEvolutions]
                    .filter(e => ['presente', 'reposicao', 'falta_remunerada', 'feriado_remunerado'].includes(e.attendanceStatus))
                    .sort((a, b) => b.date.localeCompare(a.date));
                  const statusLabel: Record<string, string> = {
                    presente: 'Presente', falta_remunerada: 'Falta Rem.',
                    reposicao: 'Reposição', feriado_remunerado: 'Feriado Rem.',
                  };
                  if (billable.length === 0) return (
                    <p className="text-xs text-muted-foreground text-center py-2">Nenhuma sessão realizada registrada.</p>
                  );
                  const allSelected = prSelectedSessions.length === billable.length && billable.length > 0;
                  return (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">
                          {prSelectedSessions.length > 0
                            ? `${prSelectedSessions.length} sessão(ões) selecionada(s)`
                            : `${billable.length} sessão(ões) realizada(s) disponível(is)`}
                        </span>
                        <button
                          onClick={() => {
                            if (allSelected) {
                              setPrSelectedSessions([]); setPrAmount(''); setPrPeriod(''); setPrSessions('');
                            } else {
                              const ids = billable.map(e => e.id);
                              setPrSelectedSessions(ids);
                              const unit = parseFloat(prUnitValue);
                              if (!isNaN(unit) && unit > 0) setPrAmount((ids.length * unit).toFixed(2));
                              setPrSessions(String(ids.length));
                              const sorted = [...billable].sort((a, b) => a.date.localeCompare(b.date));
                              const first = format(new Date(sorted[0].date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR });
                              const last = format(new Date(sorted[sorted.length - 1].date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR });
                              setPrPeriod(first === last ? first : `${first} a ${last}`);
                            }
                          }}
                          className="text-xs text-primary underline underline-offset-2"
                        >
                          {allSelected ? 'Desmarcar todas' : 'Selecionar todas'}
                        </button>
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                        {billable.map(evo => {
                          const checked = prSelectedSessions.includes(evo.id);
                          return (
                            <label key={evo.id}
                              className={cn('flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer transition-colors text-xs border',
                                checked ? 'bg-primary/10 border-primary/30' : 'border-transparent hover:bg-muted/60')}>
                              <input type="checkbox" checked={checked} className="accent-primary"
                                onChange={e => {
                                  const newSelected = e.target.checked
                                    ? [...prSelectedSessions, evo.id]
                                    : prSelectedSessions.filter(id => id !== evo.id);
                                  setPrSelectedSessions(newSelected);
                                  const unit = parseFloat(prUnitValue);
                                  if (!isNaN(unit) && unit > 0) setPrAmount((newSelected.length * unit).toFixed(2));
                                  setPrSessions(String(newSelected.length));
                                  if (newSelected.length > 0) {
                                    const sel = evolutions.filter(ev => newSelected.includes(ev.id));
                                    const s = [...sel].sort((a, b) => a.date.localeCompare(b.date));
                                    const first = format(new Date(s[0].date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR });
                                    const last = format(new Date(s[s.length-1].date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR });
                                    setPrPeriod(first === last ? first : `${first} a ${last}`);
                                  } else { setPrPeriod(''); }
                                }}
                              />
                              <span className="flex-1 font-medium">{format(new Date(evo.date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}</span>
                              <span className="text-success text-xs">{statusLabel[evo.attendanceStatus] || evo.attendanceStatus}</span>
                            </label>
                          );
                        })}
                      </div>
                      <div>
                        <Label className="text-xs mb-1 block text-muted-foreground">Valor por Sessão (R$)</Label>
                        <Input type="number" min="0" step="0.01" value={prUnitValue} placeholder="0,00" className="h-8 text-xs"
                          onChange={e => {
                            const u = e.target.value; setPrUnitValue(u);
                            const unit = parseFloat(u);
                            if (!isNaN(unit) && unit > 0 && prSelectedSessions.length > 0)
                              setPrAmount((prSelectedSessions.length * unit).toFixed(2));
                          }} />
                      </div>
                    </>
                  );
                })() : (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs mb-1 block text-muted-foreground">Nº de Sessões</Label>
                      <Input type="number" min="1" step="1" value={prSessions} placeholder="Ex: 4" className="h-9 text-xs"
                        onChange={e => { const s = e.target.value; setPrSessions(s); const sessions = parseFloat(s); const unit = parseFloat(prUnitValue); if (!isNaN(sessions) && !isNaN(unit) && sessions > 0 && unit > 0) setPrAmount((sessions * unit).toFixed(2)); }} />
                    </div>
                    <div>
                      <Label className="text-xs mb-1 block text-muted-foreground">Valor por Sessão (R$)</Label>
                      <Input type="number" min="0" step="0.01" value={prUnitValue} placeholder="0,00" className="h-9 text-xs"
                        onChange={e => { const u = e.target.value; setPrUnitValue(u); const sessions = parseFloat(prSessions); const unit = parseFloat(u); if (!isNaN(sessions) && !isNaN(unit) && sessions > 0 && unit > 0) setPrAmount((sessions * unit).toFixed(2)); }} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">Valor Total (R$)</Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={prAmount}
                  onChange={e => { setPrAmount(e.target.value); setPrSessions(''); }}
                  placeholder="0,00"
                  className="h-9 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Data do Pagamento</Label>
                <Input
                  type="date"
                  value={prPaymentDate}
                  onChange={e => setPrPaymentDate(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>


            <div>
              <Label className="text-xs mb-1 block">Serviço / Área Clínica</Label>
              <Input
                value={prService}
                onChange={e => setPrService(e.target.value)}
                placeholder="Ex: Psicologia, Fonoaudiologia..."
                className="h-9 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs mb-1 block">Período / Referência</Label>
              <Input
                value={prPeriod}
                onChange={e => setPrPeriod(e.target.value)}
                placeholder="Ex: março/2026 ou 01/03/2026 a 31/03/2026"
                className="h-9 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs mb-1 block">Forma de Pagamento</Label>
              <Select value={prPaymentMethod} onValueChange={setPrPaymentMethod}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transferência bancária">Transferência bancária</SelectItem>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="cartão de crédito">Cartão de crédito</SelectItem>
                  <SelectItem value="cartão de débito">Cartão de débito</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs mb-1 block">Local (cidade/estado)</Label>
                <Input
                  value={prLocation}
                  onChange={e => setPrLocation(e.target.value)}
                  placeholder="Ex: São Paulo, SP"
                  className="h-9 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Data do recibo</Label>
                <Input
                  type="date"
                  value={prLocalDate}
                  onChange={e => setPrLocalDate(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {stamps.length > 0 && (
              <div>
                <Label className="text-xs flex items-center gap-1.5 mb-1.5">
                  <StampIcon className="w-3.5 h-3.5" /> Carimbo Profissional
                </Label>
                <Select value={prStampId} onValueChange={setPrStampId}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Selecione o carimbo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem carimbo</SelectItem>
                    {stamps.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} — {s.clinical_area}{s.is_default ? ' ⭐' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Export buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                onClick={handleExportPaymentReceiptPdf}
                disabled={isExportingPR || !prAmount || !prPeriod}
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-9"
              >
                {isExportingPR ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Baixar PDF
              </Button>
              <Button
                onClick={handleExportPaymentReceiptWord}
                disabled={isExportingPRWord || !prAmount || !prPeriod}
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-9"
              >
                {isExportingPRWord ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                Word (.docx)
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── FISCAL RECEIPT DIALOG ─────────────────────────────────────────── */}
      <Dialog open={fiscalDialogOpen} onOpenChange={setFiscalDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" /> Gerar Extrato Fiscal
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Period mode toggle */}
            {(() => {
              const MONTHS_PT   = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
              const MONTHS_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
              const applyMonth = (month: number, year: number) => {
                setFiscalStartDate(startOfMonth(new Date(year, month, 1)));
                setFiscalEndDate(endOfMonth(new Date(year, month, 1)));
              };
              const handleMonthSelect = (month: number) => {
                setFiscalMonthYear(prev => ({ ...prev, month }));
                applyMonth(month, fiscalMonthYear.year);
              };
              const handleYearChange = (delta: number) => {
                const newYear = fiscalMonthYear.year + delta;
                setFiscalMonthYear(prev => ({ ...prev, year: newYear }));
                applyMonth(fiscalMonthYear.month, newYear);
              };
              return (
                <div className="space-y-3">
                  {/* Toggle */}
                  <div className="flex rounded-lg border border-border overflow-hidden">
                    <button
                      onClick={() => setFiscalPeriodMode('month')}
                      className={cn('flex-1 text-xs py-1.5 font-medium transition-colors',
                        fiscalPeriodMode === 'month' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/50')}
                    >
                      📅 Mês Completo
                    </button>
                    <button
                      onClick={() => setFiscalPeriodMode('custom')}
                      className={cn('flex-1 text-xs py-1.5 font-medium transition-colors',
                        fiscalPeriodMode === 'custom' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/50')}
                    >
                      🗓 Período Livre
                    </button>
                  </div>

                  {fiscalPeriodMode === 'month' ? (
                    <div className="space-y-2">
                      {/* Year navigator */}
                      <div className="flex items-center justify-between px-1">
                        <button onClick={() => handleYearChange(-1)} className="p-1 rounded hover:bg-muted transition-colors">
                          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                        </button>
                        <span className="text-sm font-semibold">{fiscalMonthYear.year}</span>
                        <button onClick={() => handleYearChange(1)} className="p-1 rounded hover:bg-muted transition-colors">
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </div>
                      {/* Month chips */}
                      <div className="grid grid-cols-4 gap-1.5">
                        {MONTHS_PT.map((m, i) => {
                          const isSelected = fiscalStartDate?.getMonth() === i && fiscalStartDate?.getFullYear() === fiscalMonthYear.year;
                          return (
                            <button key={m} onClick={() => handleMonthSelect(i)}
                              className={cn('text-xs py-2 rounded-lg border font-medium transition-colors',
                                isSelected
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'border-border text-foreground hover:bg-muted/60 hover:border-primary/40')}>
                              {m}
                            </button>
                          );
                        })}
                      </div>
                      {fiscalStartDate && fiscalEndDate && (
                        <p className="text-xs text-muted-foreground text-center">
                          {MONTHS_FULL[fiscalStartDate.getMonth()]} {fiscalStartDate.getFullYear()}
                          {' · '}
                          {format(fiscalStartDate, 'dd/MM')} a {format(fiscalEndDate, 'dd/MM/yyyy')}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Data Início</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={cn("w-full justify-start text-left font-normal mt-1 text-xs h-9", !fiscalStartDate && "text-muted-foreground")}>
                              <CalendarRange className="mr-2 h-3.5 w-3.5" />
                              {fiscalStartDate ? format(fiscalStartDate, "dd/MM/yyyy") : "Selecione"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent mode="single" selected={fiscalStartDate} onSelect={setFiscalStartDate} initialFocus className="p-3 pointer-events-auto" />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div>
                        <Label className="text-xs">Data Fim</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={cn("w-full justify-start text-left font-normal mt-1 text-xs h-9", !fiscalEndDate && "text-muted-foreground")}>
                              <CalendarRange className="mr-2 h-3.5 w-3.5" />
                              {fiscalEndDate ? format(fiscalEndDate, "dd/MM/yyyy") : "Selecione"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent mode="single" selected={fiscalEndDate} onSelect={setFiscalEndDate} initialFocus className="p-3 pointer-events-auto" />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {fiscalStartDate && fiscalEndDate && (
              <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                {getFiscalEvolutions().length} sessão(ões) encontrada(s) no período
              </p>
            )}

            {/* Stamp selector */}
            {stamps.length > 0 && (
              <div>
                <Label className="text-xs flex items-center gap-1.5 mb-1.5">
                  <StampIcon className="w-3.5 h-3.5" /> Carimbo Profissional
                </Label>
                <Select value={fiscalStampId} onValueChange={setFiscalStampId}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Selecione o carimbo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem carimbo</SelectItem>
                    {stamps.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} — {s.clinical_area}{s.is_default ? ' ⭐' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Payment info */}
            <div className="space-y-3 bg-muted/30 rounded-lg p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Informações de Pagamento</p>
              <div>
                <Label className="text-xs mb-1.5 block">Status</Label>
                <div className="flex gap-2">
                  {(['pending', 'paid', 'total'] as const).map(s => (
                    <button key={s} onClick={() => setFiscalPaymentStatus(s)}
                      className={cn('flex-1 text-xs py-1.5 rounded-lg border font-medium transition-colors',
                        fiscalPaymentStatus === s
                          ? s === 'paid' ? 'bg-success/10 border-success text-success'
                            : s === 'total' ? 'bg-primary/10 border-primary text-primary'
                            : 'bg-muted border-border text-foreground'
                          : 'border-border text-muted-foreground hover:border-foreground/30')}>
                      {s === 'paid' ? '✓ Pago' : s === 'total' ? '∑ Total' : '⏳ Pendente'}
                    </button>
                  ))}
                </div>
              </div>
              {fiscalPaymentStatus === 'paid' && fiscalPaymentDate && (
                <p className="text-xs text-muted-foreground">
                  Recebido em: <span className="font-medium text-foreground">{format(new Date(fiscalPaymentDate + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}</span> <span className="text-muted-foreground/60">(registrado no financeiro)</span>
                </p>
              )}
              <div>
                <Label className="text-xs mb-1 block flex items-center gap-1.5">
                  Valor Total Pago
                  <span className="text-muted-foreground font-normal">
                    {fiscalTotalPaidFromApp !== null ? '— pré-preenchido do app (editável)' : '— opcional'}
                  </span>
                </Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={fiscalTotalPaid}
                  onChange={e => setFiscalTotalPaid(e.target.value)}
                  placeholder="R$ calculado automaticamente pelas sessões"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* CPF warning */}
            {!(patient as any).cpf && !patient.responsibleName && (
              <p className="text-xs text-warning bg-warning/10 rounded-lg px-3 py-2 flex items-start gap-2">
                ⚠️ O paciente não tem CPF cadastrado. Para fins de nota fiscal, edite o cadastro do paciente e adicione o CPF/CNPJ.
              </p>
            )}

            {/* Export buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                onClick={handleExportFiscalPdf}
                disabled={isExportingFiscalPdf || !fiscalStartDate || !fiscalEndDate}
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-9"
              >
                {isExportingFiscalPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Baixar PDF
              </Button>
              <Button
                onClick={handleExportFiscalWord}
                disabled={isExportingFiscalWord || !fiscalStartDate || !fiscalEndDate}
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-9"
              >
                {isExportingFiscalWord ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                Word (.docx)
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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

      {/* WhatsApp Message Modal */}
      <WhatsAppMessageModal
        open={whatsappOpen}
        onClose={() => setWhatsappOpen(false)}
        patientName={patient.name}
        patientPhone={patient.phone || ''}
        date={patient.scheduleTime ? format(new Date(), 'dd/MM/yyyy', { locale: ptBR }) : ''}
        time={patient.scheduleTime || ''}
      />

      {/* WhatsApp Recipient Picker */}
      <WhatsAppRecipientModal
        open={whatsAppRecipientOpen}
        onClose={() => setWhatsAppRecipientOpen(false)}
        patientName={patient.name}
        patientWhatsapp={patient.whatsapp}
        patientPhone={patient.phone}
        responsibleName={patient.responsibleName}
        responsibleWhatsapp={patient.responsibleWhatsapp!}
      />
    </div>
  );
}
