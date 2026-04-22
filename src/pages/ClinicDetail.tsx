import { useParams, useNavigate } from 'react-router-dom';
import { isPatientActiveOn } from '@/utils/dateHelpers';
import { toLocalDateString } from '@/lib/utils';
import { ArrowLeft, Plus, Users, MapPin, Clock, DollarSign, Calendar, Phone, Cake, Check, X, ClipboardList, FileText, Package, Trash2, Edit, Pencil, Stamp as StampIcon, CalendarIcon, Wand2, Loader2, Sparkles, Download, Search, StickyNote, TrendingUp, Archive, ArchiveRestore, LayoutTemplate, Briefcase, MoreVertical, Mail, CheckCircle2, MessageSquare, Link2, Copy, Upload, Receipt, UserCheck } from 'lucide-react';
import { PackagePatientsModal } from '@/components/clinics/PackagePatientsModal';
import { EditableReceiptModal } from '@/components/financial/EditableReceiptModal';
import { FileUpload, UploadedFile } from '@/components/ui/file-upload';
import { PendingEnrollmentsPanel } from '@/components/clinics/PendingEnrollmentsPanel';
import { WhatsAppIcon } from '@/components/ui/whatsapp-icon';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import jsPDF from 'jspdf';
import { ServiceDialog } from '@/components/services/ServiceDialog';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { AIUpgradeDialog } from '@/components/AIUpgradeDialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TimeWithDurationPicker } from '@/components/ui/time-picker';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { EditClinicDialog } from '@/components/clinics/EditClinicDialog';
import { EditPatientDialog } from '@/components/patients/EditPatientDialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { generateReportPdf } from '@/utils/generateReportPdf';
import { Clinic } from '@/types';
import { ClinicFinancial } from '@/components/clinics/ClinicFinancial';
import { ClinicAgenda } from '@/components/clinics/ClinicAgenda';
import { ClinicNotes } from '@/components/clinics/ClinicNotes';
import EvolutionTemplates from '@/components/clinics/EvolutionTemplates';
import { ClinicEvolutionsTab } from '@/components/clinics/ClinicEvolutionsTab';
import { MessageTemplatesManager } from '@/components/whatsapp/MessageTemplatesManager';
import { WhatsAppMessageModal } from '@/components/whatsapp/WhatsAppMessageModal';
import { WhatsAppSendPanel } from '@/components/whatsapp/WhatsAppSendPanel';
import { WhatsAppTabContent } from '@/components/whatsapp/WhatsAppTabContent';
import { WhatsAppRecipientModal } from '@/components/whatsapp/WhatsAppRecipientModal';
import { QuickWhatsAppButton } from '@/components/whatsapp/QuickWhatsAppButton';
import { QuickWhatsAppModal } from '@/components/whatsapp/QuickWhatsAppModal';
import { resolveTemplate } from '@/hooks/useMessageTemplates';
import { ClinicAttendanceSheet } from '@/components/attendance/ClinicAttendanceSheet';
import { ClinicAlertsWidget } from '@/components/clinics/ClinicAlertsWidget';
import { TherapeuticGroupsTab } from '@/components/clinics/TherapeuticGroupsTab';
import { UsersRound } from 'lucide-react';

import TemplateForm from '@/components/evolutions/TemplateForm';
import { EditEvolutionDialog } from '@/components/evolutions/EditEvolutionDialog';
import { MoodSelector } from '@/components/evolutions/MoodSelector';




const WEEKDAYS = [
  { value: 'Segunda', label: 'Segunda-feira' },
  { value: 'Terça', label: 'Terça-feira' },
  { value: 'Quarta', label: 'Quarta-feira' },
  { value: 'Quinta', label: 'Quinta-feira' },
  { value: 'Sexta', label: 'Sexta-feira' },
  { value: 'Sábado', label: 'Sábado' },
];

function calculateAge(birthdate: string | null | undefined): number | null {
  if (!birthdate) return null;
  const today = new Date();
  const birth = new Date(birthdate);
  if (isNaN(birth.getTime())) return null;
  
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
}

function getTodayWeekday() {
  const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return days[new Date().getDay()];
}

function ClinicReports({ clinicId, clinicName, clinicAddress, clinicLetterhead, clinic, therapistName, therapistProfessionalId, therapistCbo, therapistClinicalArea, therapistStampImage, therapistSignatureImage }: { clinicId: string; clinicName?: string; clinicAddress?: string; clinicLetterhead?: string; clinic?: Clinic; therapistName?: string; therapistProfessionalId?: string; therapistCbo?: string; therapistClinicalArea?: string; therapistStampImage?: string | null; therapistSignatureImage?: string | null }) {
  const { user } = useAuth();
  const [reports, setReports] = useState<{ id: string; title: string; content: string; created_at: string }[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>([]);

  useEffect(() => {
    supabase.from('saved_reports').select('id, title, content, created_at')
      .eq('clinic_id', clinicId).order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setReports(data); });
    // Load attached files
    if (user) {
      supabase.from('attachments').select('*')
        .eq('parent_type', 'clinic_docs')
        .eq('parent_id', clinicId)
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          if (data) setAttachedFiles(data.map((a: any) => ({
            id: a.id, name: a.name, filePath: a.file_path, fileType: a.file_type, fileSize: a.file_size,
          })));
        });
    }
  }, [clinicId, user]);

  const handleDownloadPdf = (report: { title: string; content: string }) => {
    generateReportPdf({
      title: report.title,
      content: report.content,
      clinicName,
      clinicAddress,
      clinicLetterhead,
      clinicEmail: clinic?.email,
      clinicCnpj: clinic?.cnpj,
      clinicPhone: clinic?.phone,
      clinicServicesDescription: clinic?.servicesDescription,
      therapistName,
      therapistProfessionalId,
      therapistCbo,
      therapistClinicalArea,
      therapistStampImage,
      therapistSignatureImage,
    });
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('saved_reports').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir'); return; }
    setReports(prev => prev.filter(r => r.id !== id));
    toast.success('Relatório excluído!');
  };

  const handleUploadFiles = async (files: UploadedFile[]) => {
    if (!user) return;
    const inserts = files.map(f => ({
      user_id: user.id,
      parent_id: clinicId,
      parent_type: 'clinic_docs',
      name: f.name,
      file_path: f.filePath,
      file_type: f.fileType,
      file_size: f.fileSize || null,
    }));
    const { data } = await supabase.from('attachments').insert(inserts).select();
    if (data) {
      const newFiles: UploadedFile[] = data.map((a: any) => ({
        id: a.id, name: a.name, filePath: a.file_path, fileType: a.file_type, fileSize: a.file_size,
      }));
      setAttachedFiles(prev => [...newFiles, ...prev]);
    }
  };

  const handleRemoveFile = async (fileId: string) => {
    const file = attachedFiles.find(f => f.id === fileId);
    if (file) {
      await supabase.storage.from('attachments').remove([file.filePath]);
      await supabase.from('attachments').delete().eq('id', fileId);
      setAttachedFiles(prev => prev.filter(f => f.id !== fileId));
      toast.success('Arquivo removido');
    }
  };

  return (
    <div className="bg-card rounded-2xl p-6 border border-border space-y-6">
      <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-primary" /> Documentos desta Clínica
      </h2>

      {/* AI Reports */}
      {reports.length === 0 && attachedFiles.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-5xl mb-4">📄</div>
          <p className="text-muted-foreground">Nenhum documento nesta clínica</p>
          <p className="text-sm text-muted-foreground mt-1">Gere relatórios IA ou anexe documentos manualmente</p>
        </div>
      ) : null}

      {reports.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> Relatórios IA
          </p>
          {reports.map(r => (
            <div key={r.id} className="flex items-center justify-between p-4 rounded-xl bg-secondary/50 border border-border">
              <div>
                <p className="font-medium text-foreground">{r.title}</p>
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
      )}

      {/* Manual file uploads */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
          <Upload className="w-3.5 h-3.5" /> Documentos Anexados
        </p>
        <FileUpload
          parentType="clinic_docs"
          parentId={clinicId}
          existingFiles={attachedFiles}
          onUpload={handleUploadFiles}
          onRemove={handleRemoveFile}
          accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
          maxFiles={20}
        />
      </div>
    </div>
  );
}

export default function ClinicDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { clinics, patients, appointments, evolutions, addPatient, updatePatient, addEvolution, updateEvolution, setCurrentPatient, updateClinic, getClinicPackages, addPackage, updatePackage, deletePackage, loadEvolutionsForClinic, loadAppointmentsForClinic, addPatientToState, isLoading: appLoading } = useApp();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [submittingPatient, setSubmittingPatient] = useState(false);
  const [pendingPatients, setPendingPatients] = useState<any[]>([]);
  const [whatsAppPatient, setWhatsAppPatient] = useState<{ name: string; phone: string } | null>(null);
  const [quickWaPatient, setQuickWaPatient] = useState<{ id: string; name: string; phone: string | null; whatsapp: string | null; responsibleWhatsapp?: string | null; paymentValue?: number | null; clinicName?: string } | null>(null);
  const [whatsAppRecipient, setWhatsAppRecipient] = useState<{
    patientName: string;
    patientWhatsapp?: string | null;
    patientPhone?: string | null;
    responsibleName?: string | null;
    responsibleWhatsapp: string;
  } | null>(null);
  const [editClinicOpen, setEditClinicOpen] = useState(false);
  const [editPatientOpen, setEditPatientOpen] = useState(false);
  const [patientToEdit, setPatientToEdit] = useState<typeof patients[0] | null>(null);
  const [selectedDate, setSelectedDate] = useState(toLocalDateString(new Date()));
  const [batchEvolutionText, setBatchEvolutionText] = useState('');
  const [selectedPatients, setSelectedPatients] = useState<string[]>([]);
  const [batchDate, setBatchDate] = useState<Date>(new Date());
  const [batchStampMode, setBatchStampMode] = useState<'same' | 'individual'>('same');
  const [batchGlobalStampId, setBatchGlobalStampId] = useState<string>('none');
  const [batchIndividualStamps, setBatchIndividualStamps] = useState<Record<string, string>>({});
  const [batchAttendanceStatus, setBatchAttendanceStatus] = useState<Record<string, import('@/types').Evolution['attendanceStatus']>>({});
  const [batchStatusMode, setBatchStatusMode] = useState<'same' | 'individual'>('same');
  const [batchGlobalStatus, setBatchGlobalStatus] = useState<import('@/types').Evolution['attendanceStatus']>('presente');
  const [stamps, setStamps] = useState<{ id: string; name: string; clinical_area: string; cbo?: string | null; stamp_image: string | null; signature_image?: string | null; is_default: boolean | null }[]>([]);
  const [therapistProfile, setTherapistProfile] = useState<{ name: string | null; professional_id: string | null } | null>(null);
  const [packageDialogOpen, setPackageDialogOpen] = useState(false);
  const [newPackage, setNewPackage] = useState({ name: '', description: '', price: '', packageType: 'mensal' as 'mensal' | 'por_sessao' | 'personalizado', sessionLimit: '' });
  const [editingPackage, setEditingPackage] = useState<{id: string; name: string; description: string; price: string; packageType: 'mensal' | 'por_sessao' | 'personalizado'; sessionLimit: string} | null>(null);
  const [viewingPackagePatients, setViewingPackagePatients] = useState<any | null>(null);
  const [isImprovingBatchText, setIsImprovingBatchText] = useState(false);
  const [improvingBatchTemplateFieldId, setImprovingBatchTemplateFieldId] = useState<string | null>(null);
  const [aiUpgradeOpen, setAiUpgradeOpen] = useState(false);
  const [batchSearch, setBatchSearch] = useState('');
  const [batchFilterByDay, setBatchFilterByDay] = useState(true);
  const [patientSearch, setPatientSearch] = useState('');
  const [evolutionsSubTab, setEvolutionsSubTab] = useState<'evolutions' | 'batch' | 'templates'>('evolutions');
  const [batchSelectedTemplateId, setBatchSelectedTemplateId] = useState<string>('none');
  const [batchTemplateFormValues, setBatchTemplateFormValues] = useState<Record<string, any>>({});
  const { user } = useAuth();
  const { hasAI } = useFeatureAccess();

  // Lazy-load evolutions and appointments for this clinic
  useEffect(() => {
    if (!id) return;
    loadEvolutionsForClinic(id);
    loadAppointmentsForClinic(id);
  }, [id]);

  // Load pending enrollments
  const fetchPendingEnrollments = () => {
    if (!id || !user) return;
    supabase
      .from('patients')
      .select('id, name, birthdate, cpf, phone, whatsapp, email, responsible_name, responsible_cpf, responsible_whatsapp, responsible_email, responsible_is_financial, financial_responsible_name, financial_responsible_cpf, financial_responsible_whatsapp, professionals, diagnosis, observations, created_at')
      .eq('clinic_id', id)
      .eq('status', 'pendente')
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setPendingPatients(data); });
  };

  useEffect(() => {
    fetchPendingEnrollments();
  }, [id, user]);

  // Realtime: listen for new pending enrollments in this clinic
  useEffect(() => {
    if (!id || !user) return;
    const channel = supabase
      .channel(`clinic-pending-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patients', filter: `clinic_id=eq.${id}` },
        () => fetchPendingEnrollments()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, user]);



  // Load stamps + therapist profile
  useEffect(() => {
    if (!user) return;
    supabase.from('stamps').select('*').eq('user_id', user.id).then(({ data }) => {
      if (data) {
        setStamps(data);
        const defaultStamp = data.find((s: any) => s.is_default);
        if (defaultStamp) setBatchGlobalStampId(defaultStamp.id);
      }
    });
    supabase.from('profiles').select('name, professional_id').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => { if (data) setTherapistProfile(data); });
  }, [user]);

  // Load clinic templates
  useEffect(() => {
    if (!user || !id) return;
    supabase
      .from('evolution_templates')
      .select('*')
      .eq('clinic_id', id)
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        if (data) {
          setClinicTemplates(data.map((t: any) => ({
            id: t.id,
            clinicId: t.clinic_id,
            name: t.name,
            description: t.description,
            fields: t.fields || [],
            isActive: t.is_active,
            createdAt: t.created_at,
          })));
        }
      });
  }, [user, id]);

  const clinic = clinics.find(c => c.id === id);
  const allClinicPatients = patients.filter(p => p.clinicId === id);
  const clinicPatients = allClinicPatients.filter(p => isPatientActiveOn(p));

  // Get today's weekday for filtering patients
  const todayWeekday = getTodayWeekday();
  
  // Get patients scheduled for today based on their weekdays
  const todayPatients = useMemo(() => {
    return clinicPatients.filter(p => p.weekdays?.includes(todayWeekday));
  }, [clinicPatients, todayWeekday]);

  // Patients scheduled for the selected batch date (by weekday)
  const batchDateWeekday = useMemo(() => {
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    return days[batchDate.getDay()];
  }, [batchDate]);

  const batchDayPatients = useMemo(() => {
    if (!batchFilterByDay) return clinicPatients;
    return clinicPatients.filter(p => p.weekdays?.includes(batchDateWeekday));
  }, [clinicPatients, batchFilterByDay, batchDateWeekday]);

  // Get appointments for today at this clinic
  const todayAppointments = useMemo(() => {
    const today = toLocalDateString(new Date());
    return appointments.filter(a => a.clinicId === id && a.date === today);
  }, [appointments, id]);

  // Check if evolution already exists for patient today at this clinic
  const getPatientTodayEvolution = (patientId: string) => {
    const today = toLocalDateString(new Date());
    return evolutions.find(e => e.patientId === patientId && e.clinicId === id && e.date === today);
  };

  // Combine scheduled patients with appointments
  const todaySchedule = useMemo(() => {
    const scheduleMap = new Map<string, { patient: typeof clinicPatients[0], time: string, hasEvolution: boolean, evolution?: typeof evolutions[0] }>();
    
    // Add patients based on their weekday schedule
    todayPatients.forEach(patient => {
      const evolution = getPatientTodayEvolution(patient.id);
      scheduleMap.set(patient.id, {
        patient,
        time: patient.scheduleTime || '00:00',
        hasEvolution: !!evolution,
        evolution
      });
    });

    // Sort by time
    return Array.from(scheduleMap.values()).sort((a, b) => a.time.localeCompare(b.time));
  }, [todayPatients, evolutions]);

  const [formData, setFormData] = useState({
    name: '',
    birthdate: '',
    phone: '',
    whatsapp: '',
    email: '',
    cpf: '',
    clinicalArea: '',
    diagnosis: '',
    professionals: '',
    observations: '',
    responsibleName: '',
    responsibleEmail: '',
    responsibleWhatsapp: '',
    responsible_cpf: '',
    contractStartDate: '',
    weekdays: [] as string[],
    scheduleByDay: {} as { [day: string]: { start: string; end: string } },
    sessionDuration: '50',
    packageId: '',
    paymentDueDay: '',
    initialPaymentPaid: false,
    initialPaymentDate: '',
  });

  const clinicPackages = clinic ? getClinicPackages(clinic.id) : [];

  // Quick evolution state
  const [quickEvolutionPatient, setQuickEvolutionPatient] = useState<string | null>(null);
  const [quickEvolutionText, setQuickEvolutionText] = useState('');
  const [quickEvolutionStatus, setQuickEvolutionStatus] = useState<import('@/types').Evolution['attendanceStatus']>('presente');
  const [quickEvolutionStampId, setQuickEvolutionStampId] = useState<string>('none');
  const [quickEvolutionMood, setQuickEvolutionMood] = useState<string>('');
  const [quickEvolutionDate, setQuickEvolutionDate] = useState<Date>(new Date());
  const [quickEvolutionDateOpen, setQuickEvolutionDateOpen] = useState(false);
  const [quickEvolutionFiles, setQuickEvolutionFiles] = useState<UploadedFile[]>([]);
  const [isImprovingQuickText, setIsImprovingQuickText] = useState(false);
  const [clinicTemplates, setClinicTemplates] = useState<import('@/types').EvolutionTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('none');
  const [templateFormValues, setTemplateFormValues] = useState<Record<string, any>>({});
  const [editingEvolution, setEditingEvolution] = useState<typeof evolutions[0] | null>(null);

  // Services (private_appointments) for this propria clinic
  interface ClinicPrivateApt {
    id: string; client_name: string; client_email?: string | null; client_phone?: string | null;
    service_id?: string | null; clinic_id?: string | null; patient_id?: string | null;
    date: string; time: string;
    price: number; status: string; notes?: string | null; paid?: boolean | null;
    payment_date?: string | null; created_at: string;
    service_name?: string | null;
  }
  const [clinicServices, setClinicServices] = useState<ClinicPrivateApt[]>([]);
  const [loadingClinicServices, setLoadingClinicServices] = useState(false);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [editServiceApt, setEditServiceApt] = useState<ClinicPrivateApt | null>(null);
  const [editServiceAptOpen, setEditServiceAptOpen] = useState(false);
  const [deleteServiceAptOpen, setDeleteServiceAptOpen] = useState(false);
  const [serviceAptToDelete, setServiceAptToDelete] = useState<ClinicPrivateApt | null>(null);
  const [servicesStatusFilter, setServicesStatusFilter] = useState<'all' | 'agendado' | 'concluído' | 'cancelado'>('all');
  const [servicesPeriodFilter, setServicesPeriodFilter] = useState<'month' | 'all'>('month');

  const loadClinicServices = async () => {
    if (!id) return;
    setLoadingClinicServices(true);
    const { data } = await supabase
      .from('private_appointments')
      .select('id, client_name, client_email, client_phone, service_id, clinic_id, patient_id, date, time, price, status, notes, paid, payment_date, created_at, services(name)')
      .eq('clinic_id', id)
      .order('date', { ascending: false })
      .order('time', { ascending: true });
    const mapped = (data as any[] || []).map((apt: any) => ({
      ...apt,
      service_name: apt.services?.name ?? null,
    }));
    setClinicServices(mapped);
    setLoadingClinicServices(false);
  };

  // Auto-load services list when entering a propria clinic so the history is ready
  useEffect(() => {
    if (id && clinic?.type === 'propria') {
      loadClinicServices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, clinic?.type]);

  const updateClinicServiceStatus = async (aptId: string, status: string) => {
    await supabase.from('private_appointments').update({ status }).eq('id', aptId);
    loadClinicServices();
  };

  const toggleClinicServicePaid = async (aptId: string, current: boolean, paymentDate?: string) => {
    const newPaid = !current;
    await supabase.from('private_appointments').update({
      paid: newPaid,
      payment_date: newPaid ? (paymentDate || new Date().toISOString().split('T')[0]) : null,
    }).eq('id', aptId);
    loadClinicServices();
  };

  const deleteClinicServiceApt = async () => {
    if (!serviceAptToDelete) return;
    await supabase.from('private_appointments').delete().eq('id', serviceAptToDelete.id);
    toast.success('Agendamento apagado!');
    setDeleteServiceAptOpen(false);
    setServiceAptToDelete(null);
    loadClinicServices();
  };

  const [generatingReceiptId, setGeneratingReceiptId] = useState<string | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptModalData, setReceiptModalData] = useState<{
    initial: { payerName: string; payerCpf?: string | null; amount: number; serviceName: string; period: string; paymentMethod: string; paymentDate: string; initialStampId?: string | null };
    therapist: { name: string; cpf?: string | null; professionalId?: string | null; cbo?: string | null; address?: string | null };
  } | null>(null);

  const handleGenerateServiceReceipt = async (apt: ClinicPrivateApt) => {
    if (!user) return;
    setGeneratingReceiptId(apt.id);
    try {
      const [{ data: prof }, { data: stampsData }, { data: pat }] = await Promise.all([
        supabase.from('profiles').select('name, professional_id, cpf, cbo').eq('user_id', user.id).maybeSingle(),
        supabase.from('stamps').select('*').eq('user_id', user.id),
        apt.patient_id
          ? supabase.from('patients').select('name, cpf, is_minor, guardian_name, responsible_cpf').eq('id', apt.patient_id).maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);
      const defaultStamp = (stampsData || []).find((s: any) => s.is_default) || (stampsData || [])[0] || null;
      const payerName = pat
        ? (pat.is_minor && pat.guardian_name ? pat.guardian_name : pat.name)
        : apt.client_name;
      const payerCpf = pat
        ? (pat.is_minor ? pat.responsible_cpf : pat.cpf)
        : null;
      setReceiptModalData({
        initial: {
          payerName,
          payerCpf,
          amount: apt.price,
          serviceName: apt.service_name || 'Serviço prestado',
          period: format(new Date(apt.date + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR }),
          paymentMethod: 'transferência bancária',
          paymentDate: apt.payment_date || apt.date,
          initialStampId: defaultStamp?.id ?? null,
        },
        therapist: {
          name: prof?.name || 'Profissional',
          cpf: prof?.cpf,
          professionalId: prof?.professional_id,
          cbo: prof?.cbo,
          address: null,
        },
      });
      setReceiptModalOpen(true);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao preparar recibo');
    } finally {
      setGeneratingReceiptId(null);
    }
  };

  const getServiceStatusColor = (status: string) => {
    switch (status) {
      case 'agendado': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'concluído': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'cancelado': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  // Filtered services list
  const filteredClinicServices = useMemo(() => {
    const now = new Date();
    return clinicServices.filter(apt => {
      if (servicesStatusFilter !== 'all' && apt.status !== servicesStatusFilter) return false;
      if (servicesPeriodFilter === 'month') {
        const d = new Date(apt.date + 'T00:00:00');
        if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false;
      }
      return true;
    });
  }, [clinicServices, servicesStatusFilter, servicesPeriodFilter]);

  // Services financial summary (current month)
  const servicesMonthSummary = useMemo(() => {
    const now = new Date();
    const thisMonth = clinicServices.filter(a => {
      const d = new Date(a.date + 'T00:00:00');
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    return {
      totalAgendado: thisMonth.filter(a => a.status === 'agendado').reduce((s, a) => s + a.price, 0),
      totalConcluido: thisMonth.filter(a => a.status === 'concluído').reduce((s, a) => s + a.price, 0),
      totalRecebido: thisMonth.filter(a => a.status === 'concluído' && a.paid).reduce((s, a) => s + a.price, 0),
    };
  }, [clinicServices]);

  // Chart data: last 6 months agendado vs concluído
  const servicesChartData = useMemo(() => {
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = d.getMonth();
      const y = d.getFullYear();
      const label = format(d, 'MMM/yy', { locale: ptBR });
      const monthSvcs = clinicServices.filter(a => {
        const ad = new Date(a.date + 'T00:00:00');
        return ad.getMonth() === m && ad.getFullYear() === y;
      });
      months.push({
        label,
        Agendado: Number(monthSvcs.filter(a => a.status === 'agendado').reduce((s, a) => s + a.price, 0).toFixed(2)),
        Concluído: Number(monthSvcs.filter(a => a.status === 'concluído').reduce((s, a) => s + a.price, 0).toFixed(2)),
      });
    }
    return months;
  }, [clinicServices]);

  const [isExportingServicesPDF, setIsExportingServicesPDF] = useState(false);

  const handleExportServicesPDF = async () => {
    setIsExportingServicesPDF(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      let y = 20;

      const periodLabel = servicesPeriodFilter === 'month'
        ? format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })
        : 'Todos os períodos';

      doc.setFontSize(18);
      doc.setTextColor(51, 51, 51);
      doc.text('Relatório de Serviços', margin, y); y += 8;
      doc.setFontSize(11);
      doc.setTextColor(100, 100, 100);
      doc.text(`${clinic?.name ?? ''} — ${periodLabel}`, margin, y); y += 5;
      if (servicesStatusFilter !== 'all') {
        doc.text(`Filtro: ${servicesStatusFilter}`, margin, y); y += 5;
      }
      y += 6;

      // Summary
      doc.setDrawColor(180, 180, 180);
      doc.line(margin, y, pageWidth - margin, y); y += 6;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(51, 51, 51);
      doc.text('RESUMO DO MÊS ATUAL', margin, y); y += 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      doc.text(`Agendado: R$ ${servicesMonthSummary.totalAgendado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin, y); y += 5;
      doc.text(`Concluído: R$ ${servicesMonthSummary.totalConcluido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin, y); y += 5;
      doc.text(`Recebido: R$ ${servicesMonthSummary.totalRecebido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin, y); y += 8;

      doc.setDrawColor(180, 180, 180);
      doc.line(margin, y, pageWidth - margin, y); y += 8;

      // Services list
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(51, 51, 51);
      doc.text('SERVIÇOS', margin, y); y += 8;

      // Table header
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      const c1 = margin, c2 = margin + 28, c3 = margin + 80, c4 = margin + 115, c5 = pageWidth - margin - 20;
      doc.text('Data', c1, y);
      doc.text('Cliente', c2, y);
      doc.text('Status', c3, y);
      doc.text('Pago', c4, y);
      doc.text('Valor', c5, y);
      y += 3;
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y, pageWidth - margin, y); y += 5;

      doc.setFont('helvetica', 'normal');
      let totalListed = 0;
      filteredClinicServices.forEach(apt => {
        if (y > 275) { doc.addPage(); y = 20; }
        const dateStr = format(new Date(apt.date + 'T00:00:00'), 'dd/MM/yyyy');
        doc.setTextColor(51, 51, 51);
        doc.text(dateStr, c1, y);
        doc.text(apt.client_name.substring(0, 24), c2, y);

        if (apt.status === 'concluído') doc.setTextColor(34, 139, 34);
        else if (apt.status === 'cancelado') doc.setTextColor(220, 53, 69);
        else doc.setTextColor(59, 130, 246);
        doc.text(apt.status, c3, y);

        doc.setTextColor(80, 80, 80);
        doc.text(apt.paid ? 'Sim' : 'Não', c4, y);
        doc.text(`R$ ${apt.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, c5, y);
        if (apt.status !== 'cancelado') totalListed += apt.price;
        y += 6;
      });

      y += 3;
      doc.setDrawColor(180, 180, 180);
      doc.line(margin, y, pageWidth - margin, y); y += 6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(51, 51, 51);
      doc.text(`Total listado: R$ ${totalListed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin, y);
      doc.text(`${filteredClinicServices.length} serviço(s)`, pageWidth - margin - 30, y);

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')} | Página ${i} de ${pageCount}`, pageWidth / 2, 290, { align: 'center' });
      }

      doc.save(`servicos-${clinic?.name?.replace(/\s+/g, '-').toLowerCase() ?? 'clinica'}-${format(new Date(), 'yyyy-MM')}.pdf`);
      toast.success('PDF exportado com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao exportar PDF');
    } finally {
      setIsExportingServicesPDF(false);
    }
  };

  if (!clinic) {
    if (appLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Clínica não encontrada</p>
        <Button onClick={() => navigate('/clinics')} className="mt-4">
          Voltar para Clínicas
        </Button>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.birthdate) return;
    if (submittingPatient) return;
    setSubmittingPatient(true);

    try {
    const firstDayTime = formData.weekdays.length > 0 
      ? formData.scheduleByDay[formData.weekdays[0]]?.start || ''
      : '';

    const selectedPkg = formData.packageId ? clinicPackages.find(p => p.id === formData.packageId) : null;

    // Single insert via addPatient (handles both DB insert and state update)
    const { data: newPatient, error: insertError } = await supabase
      .from('patients')
      .insert({
        clinic_id: clinic.id,
        user_id: user?.id!,
        name: formData.name,
        birthdate: formData.birthdate,
        phone: formData.phone || null,
        whatsapp: formData.whatsapp || null,
        email: formData.email || null,
        cpf: formData.cpf || null,
        clinical_area: formData.clinicalArea || null,
        diagnosis: formData.diagnosis || null,
        professionals: formData.professionals || null,
        observations: formData.observations || null,
        responsible_name: formData.responsibleName || null,
        responsible_email: formData.responsibleEmail || null,
        responsible_whatsapp: formData.responsibleWhatsapp || null,
        responsible_cpf: formData.responsible_cpf || null,
        payment_type: clinic.paymentType === 'sessao' ? 'sessao' : clinic.paymentType === 'fixo_mensal' ? 'fixo' : 'sessao',
        payment_value: selectedPkg ? selectedPkg.price : (clinic.paymentAmount ?? null),
        contract_start_date: formData.contractStartDate || null,
        weekdays: formData.weekdays.length > 0 ? formData.weekdays : null,
        schedule_time: firstDayTime || null,
        schedule_by_day: Object.keys(formData.scheduleByDay).length > 0 ? formData.scheduleByDay : null,
        package_id: formData.packageId || null,
        payment_due_day: formData.paymentDueDay ? parseInt(formData.paymentDueDay) : null,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Sync new patient into context state (no second DB call)
    if (newPatient) {
      addPatientToState(newPatient as any);
    }

    // If initial payment status was set, create payment record
    if (newPatient && (formData.initialPaymentPaid || formData.paymentDueDay) && user) {
      const now = new Date();
      const paymentValue = selectedPkg ? selectedPkg.price : (clinic.paymentAmount ?? 0);
      await supabase.from('patient_payment_records' as any).insert({
        user_id: user.id,
        patient_id: newPatient.id,
        clinic_id: clinic.id,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        amount: paymentValue,
        paid: formData.initialPaymentPaid,
        payment_date: formData.initialPaymentPaid && formData.initialPaymentDate ? formData.initialPaymentDate : (formData.initialPaymentPaid ? now.toISOString().split('T')[0] : null),
        notes: null,
      });
    }

    setFormData({
      name: '',
      birthdate: '',
      phone: '',
      whatsapp: '',
      email: '',
      cpf: '',
      clinicalArea: '',
      diagnosis: '',
      professionals: '',
      observations: '',
      responsibleName: '',
      responsibleEmail: '',
      responsibleWhatsapp: '',
      responsible_cpf: '',
      contractStartDate: '',
      weekdays: [],
      scheduleByDay: {},
      sessionDuration: '50',
      packageId: '',
      paymentDueDay: '',
      initialPaymentPaid: false,
      initialPaymentDate: '',
    });
    setIsDialogOpen(false);
    toast.success('Paciente cadastrado com sucesso!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao cadastrar paciente');
    } finally {
      setSubmittingPatient(false);
    }
  };

  const handleOpenPatient = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    if (patient) {
      setCurrentPatient(patient);
      navigate(`/patients/${patientId}`);
    }
  };

  const handleQuickAttendance = (patientId: string, status: 'presente' | 'falta') => {
    const today = toLocalDateString(new Date());
    
    addEvolution({
      patientId,
      clinicId: clinic.id,
      date: today,
      text: status === 'falta' ? 'Paciente faltou à sessão.' : '',
      attendanceStatus: status,
    });
    
    toast.success(status === 'presente' ? 'Presença registrada!' : 'Falta registrada!');
  };

  const handleQuickEvolutionSubmit = async () => {
    if (!quickEvolutionPatient) return;
    
    const dateStr = format(quickEvolutionDate, 'yyyy-MM-dd');

    // Build evolution text including template data if present
    let fullText = quickEvolutionText;
    const selectedTemplate = selectedTemplateId !== 'none' ? clinicTemplates.find(t => t.id === selectedTemplateId) : null;
    
    if (selectedTemplate && Object.keys(templateFormValues).length > 0) {
      const templateLines = selectedTemplate.fields
        .map(f => {
          const val = templateFormValues[f.id];
          if (val === undefined || val === '' || val === false) return null;
          if (f.type === 'checkbox') return val ? `✅ ${f.label}` : null;
          return `${f.label}: ${val}`;
        })
        .filter(Boolean);
      
      if (templateLines.length > 0) {
        const templateSection = templateLines.join('\n');
        fullText = fullText ? `${templateSection}\n\n---\n\n${fullText}` : templateSection;
      }
    }
    
    addEvolution({
      patientId: quickEvolutionPatient,
      clinicId: clinic.id,
      date: dateStr,
      text: fullText,
      attendanceStatus: quickEvolutionStatus,
      stampId: quickEvolutionStampId !== 'none' ? quickEvolutionStampId : undefined,
      mood: quickEvolutionMood as 'otima' | 'boa' | 'neutra' | 'ruim' | 'muito_ruim' | undefined || undefined,
    });

    // Save template_data, mood and attachments to evolution
    const { data: latestEvolution } = await supabase
      .from('evolutions')
      .select('id')
      .eq('patient_id', quickEvolutionPatient)
      .eq('clinic_id', clinic.id)
      .eq('date', dateStr)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (latestEvolution) {
      const updates: Record<string, any> = {};
      if (selectedTemplate) {
        updates.template_id = selectedTemplate.id;
        updates.template_data = templateFormValues;
      }
      if (Object.keys(updates).length > 0) {
        await supabase.from('evolutions').update(updates).eq('id', latestEvolution.id);
      }
      // Save attachments
      if (quickEvolutionFiles.length > 0 && user) {
        const attachmentInserts = quickEvolutionFiles.map(f => ({
          parent_id: latestEvolution.id,
          parent_type: 'evolution',
          name: f.name,
          file_path: f.filePath,
          file_type: f.fileType,
          user_id: user.id,
        }));
        await supabase.from('attachments').insert(attachmentInserts);
      }
    }
    
    // Reset state
    setQuickEvolutionPatient(null);
    setQuickEvolutionText('');
    setQuickEvolutionStatus('presente');
    setQuickEvolutionStampId('none');
    setQuickEvolutionMood('');
    setQuickEvolutionDate(new Date());
    setQuickEvolutionFiles([]);
    setSelectedTemplateId('none');
    setTemplateFormValues({});
    toast.success('Evolução registrada com sucesso!');
  };


  const handleBatchEvolution = async () => {
    if (!clinic) return;
    if (selectedPatients.length === 0) {
      toast.error('Selecione pelo menos um paciente');
      return;
    }

    const batchTemplate = batchSelectedTemplateId !== 'none' ? clinicTemplates.find(t => t.id === batchSelectedTemplateId) : null;

    const globalStatus = batchStatusMode === 'same' ? batchGlobalStatus : 'presente';
    const isNonPresentGlobal = batchStatusMode === 'same' && ['falta', 'falta_remunerada', 'feriado_remunerado', 'feriado_nao_remunerado'].includes(globalStatus);

    if (!batchTemplate && !batchEvolutionText.trim() && !isNonPresentGlobal) {
      toast.error('Digite o texto da evolução');
      return;
    }

    const dateStr = format(batchDate, 'yyyy-MM-dd');

    // Build full text
    let fullText = batchEvolutionText;
    if (batchTemplate && Object.keys(batchTemplateFormValues).length > 0) {
      const templateLines = batchTemplate.fields
        .map(f => {
          const val = batchTemplateFormValues[f.id];
          if (val === undefined || val === '' || val === false) return null;
          if (f.type === 'checkbox') return val ? `✅ ${f.label}` : null;
          return `${f.label}: ${val}`;
        })
        .filter(Boolean);
      if (templateLines.length > 0) {
        const templateSection = templateLines.join('\n');
        fullText = fullText ? `${templateSection}\n\n---\n\n${fullText}` : templateSection;
      }
    }
    
    for (const patientId of selectedPatients) {
      const stampId = batchStampMode === 'same' 
        ? (batchGlobalStampId !== 'none' ? batchGlobalStampId : undefined)
        : (batchIndividualStamps[patientId] && batchIndividualStamps[patientId] !== 'none' ? batchIndividualStamps[patientId] : undefined);
      
      const status = batchStatusMode === 'same' ? batchGlobalStatus : (batchAttendanceStatus[patientId] || 'presente');
      const autoText = ['falta', 'falta_remunerada'].includes(status) && !fullText ? 'Paciente faltou à sessão.' 
        : ['feriado_remunerado', 'feriado_nao_remunerado'].includes(status) && !fullText ? 'Feriado.' 
        : fullText;
      
      await addEvolution({
        patientId,
        clinicId: clinic.id,
        date: dateStr,
        text: autoText,
        attendanceStatus: status,
        stampId,
      });

      // Save template data if template selected
      if (batchTemplate) {
        const { data: ev } = await supabase
          .from('evolutions')
          .select('id')
          .eq('patient_id', patientId)
          .eq('clinic_id', clinic.id)
          .eq('date', dateStr)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        if (ev) {
          await supabase.from('evolutions').update({
            template_id: batchTemplate.id,
            template_data: batchTemplateFormValues,
          }).eq('id', ev.id);
        }
      }
    }

    toast.success(`Evolução registrada para ${selectedPatients.length} paciente(s)!`);
    setSelectedPatients([]);
    setBatchEvolutionText('');
    setBatchIndividualStamps({});
    setBatchAttendanceStatus({});
    setBatchGlobalStatus('presente');
    setBatchStatusMode('same');
    setBatchSelectedTemplateId('none');
    setBatchTemplateFormValues({});
  };

  const togglePatientSelection = (patientId: string) => {
    setSelectedPatients(prev => 
      prev.includes(patientId) 
        ? prev.filter(id => id !== patientId)
        : [...prev, patientId]
    );
  };

  // Check if evolution exists for patient on the selected batch date
  const getPatientBatchDateEvolution = (patientId: string) => {
    const dateStr = format(batchDate, 'yyyy-MM-dd');
    return evolutions.find(e => e.patientId === patientId && e.date === dateStr);
  };

  const selectAllPatients = () => {
    const patientsWithoutEvolution = batchDayPatients
      .filter(p => !getPatientBatchDateEvolution(p.id))
      .map(p => p.id);
    setSelectedPatients(patientsWithoutEvolution);
  };

  const isPropria = clinic.type === 'propria';
  const isArchived = clinic.isArchived === true;

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" onClick={() => navigate('/clinics')} className="mb-4 gap-2">
          <ArrowLeft className="w-4 h-4" />
          Voltar para Clínicas
        </Button>

        {isArchived && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
            <Archive className="w-4 h-4 shrink-0" />
            <span>Esta clínica está <strong>arquivada</strong>. Você pode visualizar os dados, mas não é possível editar ou adicionar informações.</span>
          </div>
        )}

        <div className={cn(
          'rounded-3xl p-6 lg:p-8',
          isPropria ? 'gradient-primary' : 'gradient-secondary'
        )}>
          <span className={cn(
            "inline-block px-3 py-1 rounded-full text-xs font-semibold mb-3",
            isPropria ? "bg-white/20 text-primary-foreground" : "bg-primary/10 text-primary"
          )}>
            {isPropria ? 'Consultório' : 'Clínica Contratante'}
          </span>
          <div className="flex items-start justify-between">
            <div>
              <h1 className={cn(
                "text-2xl lg:text-3xl font-bold mb-2",
                isPropria ? "text-primary-foreground" : "text-foreground"
              )}>{clinic.name}</h1>
              <div className={cn(
                "flex flex-wrap gap-4",
                isPropria ? "text-primary-foreground/80" : "text-muted-foreground"
              )}>
                {clinic.address && (
                  <span className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {clinic.address}
                  </span>
                )}
                {clinic.scheduleTime && (
                  <span className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {clinic.scheduleTime}
                  </span>
                )}
              </div>
            </div>
            {!isArchived && (
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  isPropria 
                    ? "text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/20" 
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
                onClick={() => setEditClinicOpen(true)}
              >
                <Pencil className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6 lg:mb-8">
        <div className="bg-card rounded-xl lg:rounded-2xl p-3 lg:p-5 border border-border flex items-center gap-3 lg:block">
          <Users className="w-6 h-6 lg:w-8 lg:h-8 text-primary lg:mb-2 shrink-0" />
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs">Pacientes</p>
            <p className="text-xl lg:text-2xl font-bold text-foreground">{clinicPatients.length}</p>
          </div>
        </div>
        
        <div className="bg-card rounded-xl lg:rounded-2xl p-3 lg:p-5 border border-border flex items-center gap-3 lg:block">
          <Calendar className="w-6 h-6 lg:w-8 lg:h-8 text-accent lg:mb-2 shrink-0" />
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs">Hoje ({todayWeekday})</p>
            <p className="text-xl lg:text-2xl font-bold text-foreground">{todaySchedule.length}</p>
          </div>
        </div>

        <div className="bg-card rounded-xl lg:rounded-2xl p-3 lg:p-5 border border-border flex items-center gap-3 lg:block">
            <Clock className="w-6 h-6 lg:w-8 lg:h-8 text-warning lg:mb-2 shrink-0" />
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs">Dias</p>
              <p className="text-xs lg:text-sm font-bold text-foreground truncate">
                {clinic.weekdays?.length ? clinic.weekdays.join(', ') : '—'}
              </p>
            </div>
          </div>

        {(clinic.paymentAmount || clinic.paymentType === 'variado') && (
          <div className="bg-card rounded-xl lg:rounded-2xl p-3 lg:p-5 border border-border flex items-center gap-3 lg:block">
            <DollarSign className="w-6 h-6 lg:w-8 lg:h-8 text-success lg:mb-2 shrink-0" />
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs">Remuneração</p>
              {clinic.paymentType === 'variado' ? (
                <p className="text-base lg:text-lg font-bold text-foreground">Variado</p>
              ) : (
                <p className="text-base lg:text-lg font-bold text-foreground">
                  R$ {clinic.paymentAmount?.toFixed(2)}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="today" className="space-y-4 lg:space-y-6">
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {[
            { value: 'today', icon: <ClipboardList className="w-5 h-5" />, label: 'Hoje', color: 'text-primary' },
            { value: 'agenda', icon: <Calendar className="w-5 h-5" />, label: 'Agenda', color: 'text-blue-500' },
            { value: 'patients', icon: <Users className="w-5 h-5" />, label: 'Pacientes', color: 'text-violet-500' },
            { value: 'financial', icon: <DollarSign className="w-5 h-5" />, label: 'Financeiro', color: 'text-success' },
            { value: 'notes', icon: <StickyNote className="w-5 h-5" />, label: 'Notas', color: 'text-yellow-500' },
            { value: 'evolutions', icon: <TrendingUp className="w-5 h-5" />, label: 'Evoluções', color: 'text-teal-500' },
            { value: 'packages', icon: <Package className="w-5 h-5" />, label: 'Pacotes', color: 'text-pink-500' },
            { value: 'attendance', icon: <ClipboardList className="w-5 h-5" />, label: 'Frequência', color: 'text-orange-500' },
            { value: 'reports', icon: <Sparkles className="w-5 h-5" />, label: 'Docs', color: 'text-amber-500' },
            { value: 'whatsapp', icon: <span className="w-5 h-5 flex items-center justify-center text-base">💬</span>, label: 'WhatsApp', color: 'text-green-500' },
            ...(isPropria ? [{ value: 'services', icon: <Briefcase className="w-5 h-5" />, label: 'Serviços', color: 'text-cyan-500' }] : []),
            { value: 'groups', icon: <UsersRound className="w-5 h-5" />, label: 'Grupos', color: 'text-indigo-500' },
          ].map(tab => (
            <TabsList key={tab.value} className="p-0 h-auto bg-transparent">
              <TabsTrigger
                value={tab.value}
                className={cn(
                  'flex flex-col items-center gap-1.5 w-full h-auto py-3 px-2 rounded-xl border border-border bg-card',
                  'hover:bg-accent transition-all duration-150',
                  'data-[state=active]:bg-primary/10 data-[state=active]:border-primary/40 data-[state=active]:shadow-sm',
                  '[&[data-state=active]_svg]:scale-110 [&_svg]:transition-transform'
                )}
              >
                <span className={tab.color}>{tab.icon}</span>
                <span className="text-[10px] font-medium text-foreground leading-none">{tab.label}</span>
              </TabsTrigger>
            </TabsList>
          ))}
        </div>

        <TabsContent value="today" className="space-y-4">
          {/* Alerts widget for this clinic */}
          <ClinicAlertsWidget clinicId={id!} />

          <div className="bg-card rounded-xl lg:rounded-2xl p-4 lg:p-6 border border-border">
            <h2 className="text-lg lg:text-xl font-bold text-foreground mb-3 lg:mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4 lg:w-5 lg:h-5 text-primary" />
              Atendimentos de Hoje - {todayWeekday}
            </h2>

            {todaySchedule.length === 0 ? (
              <div className="text-center py-8 lg:py-12">
                <div className="text-5xl lg:text-6xl mb-3 lg:mb-4">📅</div>
                <p className="text-muted-foreground text-sm lg:text-base">Nenhum atendimento agendado para hoje</p>
              </div>
            ) : (
              <div className="space-y-2 lg:space-y-3">
                {todaySchedule.map(({ patient, time, hasEvolution, evolution }) => (
                  <div
                    key={patient.id}
                    className={cn(
                      "flex flex-col lg:flex-row lg:items-center justify-between p-3 lg:p-4 rounded-xl border transition-colors",
                      hasEvolution 
                        ? evolution?.attendanceStatus === 'presente' || evolution?.attendanceStatus === 'reposicao'
                          ? "bg-success/10 border-success/30"
                          : evolution?.attendanceStatus === 'falta_remunerada'
                            ? "bg-warning/10 border-warning/30"
                            : "bg-destructive/10 border-destructive/30"
                        : "bg-secondary/50 border-border"
                    )}
                  >
                    <div className="flex items-center gap-3 lg:gap-4 mb-2 lg:mb-0">
                      <div className="flex items-center justify-center w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-primary/10 text-primary font-bold text-sm lg:text-base">
                        {time}
                      </div>
                      <div>
                        <h3 
                          className={cn("font-semibold text-foreground transition-colors", !isArchived && "cursor-pointer hover:text-primary")}
                          onClick={() => {
                            if (isArchived) return;
                            if (!hasEvolution) {
                              setQuickEvolutionPatient(patient.id);
                              setQuickEvolutionText('');
                              setQuickEvolutionStatus('presente');
                              setQuickEvolutionStampId(stamps.find(s => s.is_default)?.id || 'none');
                            } else {
                              handleOpenPatient(patient.id);
                            }
                          }}
                        >
                          {patient.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {patient.clinicalArea}{calculateAge(patient.birthdate) !== null ? ` • ${calculateAge(patient.birthdate)} anos` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {hasEvolution ? (
                        <>
                          <div className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
                            evolution?.attendanceStatus === 'presente' || evolution?.attendanceStatus === 'reposicao'
                              ? "bg-success/20 text-success"
                              : evolution?.attendanceStatus === 'falta_remunerada'
                                ? "bg-warning/20 text-warning"
                                : "bg-destructive/20 text-destructive"
                          )}>
                            {evolution?.attendanceStatus === 'presente' ? (
                              <><Check className="w-4 h-4" />Presente</>
                            ) : evolution?.attendanceStatus === 'reposicao' ? (
                              <>🔄 Reposição</>
                            ) : evolution?.attendanceStatus === 'falta_remunerada' ? (
                              <><DollarSign className="w-4 h-4" />Falta Remunerada</>
                            ) : (
                              <><X className="w-4 h-4" />Faltou</>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() => !isArchived && evolution && setEditingEvolution(evolution)}
                            disabled={isArchived}
                            title={isArchived ? "Clínica arquivada" : "Editar evolução"}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">⏳ Aguardando</span>
                      )}
                      {!isArchived && (
                        <QuickWhatsAppButton
                          phone={patient.whatsapp || patient.phone || patient.responsibleWhatsapp}
                          tooltip="Confirmar sessão via WhatsApp"
                          message={resolveTemplate(
                            'Olá, {{nome_paciente}}! 😊 Passando para confirmar sua sessão hoje às {{horario}}. Por favor, confirme sua presença. — {{nome_terapeuta}}',
                            {
                              nome_paciente: patient.name,
                              horario: time,
                              nome_terapeuta: therapistProfile?.name || '',
                            }
                          )}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>


        {/* Patients Tab */}
        <TabsContent value="patients">
          <div className="bg-card rounded-2xl p-6 border border-border">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-foreground">Pacientes</h2>
              
              {!isArchived && (
              <div className="flex items-center gap-2">
                {/* Enrollment link button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-xs"
                  onClick={() => {
                    const link = `https://evolucaodiaria.app.br/matricula/${id}`; // Production domain for external sharing
                    navigator.clipboard.writeText(link);
                    toast.success('Link de cadastro copiado!');
                  }}
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copiar Link de Cadastro
                </Button>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gradient-primary gap-2">
                    <Plus className="w-4 h-4" />
                    Novo Paciente
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Novo Paciente</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label>Nome Completo *</Label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Ex: João Silva"
                        required
                      />
                    </div>

                    <div>
                      <Label>Data de Nascimento *</Label>
                      <Input
                        type="date"
                        value={formData.birthdate}
                        onChange={(e) => setFormData({ ...formData, birthdate: e.target.value })}
                        required
                      />
                    </div>

                     <div className="grid grid-cols-2 gap-3">
                       <div>
                         <Label>Telefone</Label>
                         <Input
                           value={formData.phone}
                           onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                           placeholder="(00) 00000-0000"
                         />
                       </div>
                       <div>
                         <Label>CPF do Paciente <span className="text-muted-foreground font-normal text-xs">(para cadastro)</span></Label>
                         <Input
                           value={formData.cpf}
                           onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                           placeholder="000.000.000-00"
                         />
                       </div>
                     </div>

                     <div className="grid grid-cols-2 gap-3">
                       <div>
                         <Label className="flex items-center gap-1.5">
                           <WhatsAppIcon className="w-3.5 h-3.5 text-[#25D366]" />
                           WhatsApp do Paciente
                         </Label>
                         <Input
                           value={formData.whatsapp}
                           onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                           placeholder="(11) 99999-9999"
                         />
                       </div>
                       <div>
                         <Label>E-mail do Paciente</Label>
                         <Input
                           type="email"
                           value={formData.email}
                           onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                           placeholder="email@exemplo.com"
                         />
                       </div>
                     </div>

                     <div>
                       <Label>Área Clínica</Label>
                       <Input
                         value={formData.clinicalArea}
                         onChange={(e) => setFormData({ ...formData, clinicalArea: e.target.value })}
                         placeholder="Ex: Psicologia Clínica"
                       />
                     </div>

                     <div>
                       <Label>Profissionais</Label>
                       <Input
                         value={formData.professionals}
                         onChange={(e) => setFormData({ ...formData, professionals: e.target.value })}
                         placeholder="Ex: Dr. João"
                       />
                     </div>

                     <div>
                       <Label>Hipótese Diagnóstica (CID/DSM)</Label>
                       <Input
                         value={formData.diagnosis}
                         onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                         placeholder="Ex: F84 - TEA"
                       />
                     </div>

                     <div>
                       <Label>Observações</Label>
                       <Textarea
                         value={formData.observations}
                         onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                         placeholder="Queixa inicial, histórico..."
                       />
                     </div>

                     <div className="border-t pt-4 space-y-3">
                       <p className="font-semibold">📅 Contrato</p>
                       <div>
                         <Label className="text-xs">Data de Início do Contrato</Label>
                         <Input
                           type="date"
                           value={formData.contractStartDate}
                           onChange={(e) => setFormData({ ...formData, contractStartDate: e.target.value })}
                         />
                       </div>
                     </div>

                     <div className="border-t pt-4 space-y-3">
                       <p className="font-semibold">👤 Responsável Legal <span className="text-muted-foreground font-normal text-sm">(obrigatório para menores de 18 anos)</span></p>
                       <p className="text-xs text-muted-foreground -mt-1">O CPF do responsável será usado na nota fiscal quando o paciente for menor de idade.</p>
                       <div className="grid grid-cols-2 gap-3">
                         <div>
                           <Label className="text-xs">Nome do Responsável</Label>
                           <Input
                             value={formData.responsibleName}
                             onChange={(e) => setFormData({ ...formData, responsibleName: e.target.value })}
                             placeholder="Ex: Maria Silva"
                           />
                         </div>
                         <div>
                           <Label className="text-xs">CPF do Responsável <span className="text-muted-foreground font-normal text-xs">(nota fiscal)</span></Label>
                           <Input
                             value={formData.responsible_cpf}
                             onChange={(e) => setFormData({ ...formData, responsible_cpf: e.target.value })}
                             placeholder="000.000.000-00"
                           />
                         </div>
                       </div>
                       <div>
                         <Label className="text-xs">E-mail do Responsável</Label>
                         <Input
                           type="email"
                           value={formData.responsibleEmail}
                           onChange={(e) => setFormData({ ...formData, responsibleEmail: e.target.value })}
                           placeholder="email@exemplo.com"
                         />
                       </div>
                       <div>
                         <Label className="text-xs flex items-center gap-1.5">
                           <WhatsAppIcon className="w-3 h-3 text-[#25D366]" />
                           WhatsApp do Responsável
                         </Label>
                         <Input
                           value={formData.responsibleWhatsapp}
                           onChange={(e) => setFormData({ ...formData, responsibleWhatsapp: e.target.value })}
                           placeholder="(11) 99999-9999"
                         />
                       </div>
                     </div>


                    {/* Package selection and payment info */}
                    <div className="border-t pt-4">
                      <p className="font-semibold mb-2">💰 Pagamento</p>
                      
                      {clinicPackages.length > 0 && (
                        <div className="mb-3">
                          <Label>Pacote</Label>
                          <Select
                            value={formData.packageId}
                            onValueChange={(v) => setFormData({ ...formData, packageId: v === 'none' ? '' : v })}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Selecione um pacote (opcional)" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Sem pacote (valor da clínica)</SelectItem>
                              {clinicPackages.map(pkg => (
                                <SelectItem key={pkg.id} value={pkg.id}>
                                  {pkg.name} - R$ {pkg.price.toFixed(2)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {formData.packageId ? (
                        <p className="text-sm text-muted-foreground bg-secondary/50 p-3 rounded-lg">
                          Pacote: <span className="font-semibold text-foreground">{clinicPackages.find(p => p.id === formData.packageId)?.name}</span>
                          {' - '}
                          <span className="font-semibold text-success">R$ {clinicPackages.find(p => p.id === formData.packageId)?.price.toFixed(2)}</span>
                        </p>
                      ) : clinic.paymentAmount ? (
                        <p className="text-sm text-muted-foreground bg-secondary/50 p-3 rounded-lg">
                          Valor herdado da clínica: <span className="font-semibold text-foreground">R$ {clinic.paymentAmount.toFixed(2)}</span>
                          {clinic.paymentType === 'sessao' && ' por sessão'}
                          {clinic.paymentType === 'fixo_mensal' && ' mensal'}
                          {clinic.paymentType === 'fixo_diario' && ' por dia'}
                        </p>
                      ) : null}

                      {/* Payment due day */}
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Dia de vencimento</Label>
                          <div className="relative">
                            <Input
                              type="number"
                              min={1}
                              max={31}
                              placeholder="Ex: 10"
                              value={formData.paymentDueDay}
                              onChange={(e) => setFormData({ ...formData, paymentDueDay: e.target.value })}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">dia</span>
                          </div>
                          {formData.paymentDueDay && (
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                              🔔 Aviso automático 3 dias antes no dashboard
                            </p>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Status inicial</Label>
                          <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-3 h-10">
                            <span className={`text-xs font-medium ${formData.initialPaymentPaid ? 'text-success' : 'text-muted-foreground'}`}>
                              {formData.initialPaymentPaid ? 'Pago' : 'Pendente'}
                            </span>
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, initialPaymentPaid: !formData.initialPaymentPaid, initialPaymentDate: !formData.initialPaymentPaid ? new Date().toISOString().split('T')[0] : '' })}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${formData.initialPaymentPaid ? 'bg-success' : 'bg-input'}`}
                            >
                              <span className={`pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg transition-transform ${formData.initialPaymentPaid ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Payment date — shown when initial payment is set to Pago */}
                      {formData.initialPaymentPaid && (
                        <div className="mt-3 space-y-1.5">
                          <Label className="text-xs">Data do pagamento</Label>
                          <Input
                            type="date"
                            value={formData.initialPaymentDate}
                            onChange={(e) => setFormData({ ...formData, initialPaymentDate: e.target.value })}
                          />
                        </div>
                      )}
                    </div>


                    <div className="border-t pt-4">
                      <p className="font-semibold mb-3">📅 Horários de Atendimento</p>
                      
                      <Label className="mb-2 block">Selecione os dias e defina o horário de entrada e saída:</Label>
                      <div className="space-y-3 mt-2">
                        {WEEKDAYS.map((day) => {
                          const isSelected = formData.weekdays.includes(day.value);
                          return (
                            <div key={day.value} className="flex items-center gap-3 flex-wrap">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setFormData({
                                      ...formData,
                                      weekdays: [...formData.weekdays, day.value],
                                    });
                                  } else {
                                    const newScheduleByDay = { ...formData.scheduleByDay };
                                    delete newScheduleByDay[day.value];
                                    setFormData({
                                      ...formData,
                                      weekdays: formData.weekdays.filter(d => d !== day.value),
                                      scheduleByDay: newScheduleByDay,
                                    });
                                  }
                                }}
                              />
                              <span className="text-sm w-24">{day.label}</span>
                              {isSelected && (
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="time"
                                    value={formData.scheduleByDay[day.value]?.start || ''}
                                    onChange={(e) => setFormData({
                                      ...formData,
                                      scheduleByDay: {
                                        ...formData.scheduleByDay,
                                        [day.value]: {
                                          start: e.target.value,
                                          end: formData.scheduleByDay[day.value]?.end || ''
                                        }
                                      }
                                    })}
                                    className="w-24"
                                    placeholder="Entrada"
                                  />
                                  <span className="text-xs text-muted-foreground">até</span>
                                  <Input
                                    type="time"
                                    value={formData.scheduleByDay[day.value]?.end || ''}
                                    onChange={(e) => setFormData({
                                      ...formData,
                                      scheduleByDay: {
                                        ...formData.scheduleByDay,
                                        [day.value]: {
                                          start: formData.scheduleByDay[day.value]?.start || '',
                                          end: e.target.value
                                        }
                                      }
                                    })}
                                    className="w-24"
                                    placeholder="Saída"
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-4 flex items-center gap-3">
                        <Label>Duração da sessão:</Label>
                        <Select
                          value={formData.sessionDuration}
                          onValueChange={(v) => setFormData({ ...formData, sessionDuration: v })}
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="30">30 min</SelectItem>
                            <SelectItem value="40">40 min</SelectItem>
                            <SelectItem value="50">50 min</SelectItem>
                            <SelectItem value="60">60 min</SelectItem>
                            <SelectItem value="90">90 min</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button type="submit" className="flex-1 gradient-primary">
                        Salvar Paciente
                      </Button>
                      <Button type="button" variant="outline" className="flex-1" onClick={() => setIsDialogOpen(false)}>
                        Cancelar
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
              </div>
              )}
            </div>

            {/* Pending Enrollments Panel */}
            {id && (
              <PendingEnrollmentsPanel
                clinicId={id}
                pendingPatients={pendingPatients}
                onActivated={(patientId) => {
                  setPendingPatients(prev => prev.filter(p => p.id !== patientId));
                }}
              />
            )}

            {/* Search */}
            {clinicPatients.length > 0 && (
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar paciente..."
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            )}

            {clinicPatients.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">👥</div>
                <p className="text-muted-foreground">Nenhum paciente cadastrado nesta clínica</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {clinicPatients.filter(p => !patientSearch || p.name.toLowerCase().includes(patientSearch.toLowerCase())).map((patient) => (
                  <div
                    key={patient.id}
                    className="bg-secondary/50 rounded-xl p-4 hover:bg-secondary transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 
                        className="font-semibold text-foreground cursor-pointer hover:text-primary transition-colors"
                        onClick={() => handleOpenPatient(patient.id)}
                      >
                        {patient.name}
                      </h3>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPatientToEdit(patient);
                          setEditPatientOpen(true);
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    
                    <div className="space-y-1 text-sm text-muted-foreground cursor-pointer" onClick={() => handleOpenPatient(patient.id)}>
                      {patient.birthdate && (
                        <p className="flex items-center gap-2">
                          <Cake className="w-4 h-4" />
                          {calculateAge(patient.birthdate)} anos
                        </p>
                      )}
                      {patient.phone && (
                        <p className="flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          {patient.phone}
                        </p>
                      )}
                      {patient.clinicalArea && (
                        <p className="text-primary font-medium">{patient.clinicalArea}</p>
                      )}
                    </div>

                    {patient.paymentValue && clinic?.paymentType !== 'fixo_mensal' && clinic?.paymentType !== 'fixo_diario' && (() => {
                      const pkg = patient.packageId ? clinicPackages.find(pk => pk.id === patient.packageId) : null;
                      const isPersonalizado = pkg?.packageType === 'personalizado' && (pkg?.sessionLimit ?? 0) > 0;
                      const displayValue = isPersonalizado
                        ? patient.paymentValue / pkg!.sessionLimit!
                        : patient.paymentValue;
                      return (
                        <div className="mt-3 pt-3 border-t border-border">
                          <span className="text-success font-semibold">
                            R$ {displayValue.toFixed(2)}/sessão
                            {isPersonalizado && (
                              <span className="text-xs text-muted-foreground font-normal ml-1">(Pacote de {pkg!.sessionLimit})</span>
                            )}
                          </span>
                        </div>
                      );
                    })()}

                    {(patient.whatsapp || patient.phone || patient.responsibleWhatsapp) && (
                      <div className="mt-2 pt-2 border-t border-border flex justify-end gap-2">
                        <button
                          title="Enviar mensagem via WhatsApp"
                          onClick={(e) => {
                            e.stopPropagation();
                            const phone = patient.whatsapp || patient.phone || patient.responsibleWhatsapp || null;
                            setQuickWaPatient({
                              id: patient.id,
                              name: patient.name,
                              phone,
                              whatsapp: patient.whatsapp || null,
                              responsibleWhatsapp: patient.responsibleWhatsapp || null,
                              paymentValue: patient.paymentValue,
                              clinicName: clinic?.name,
                            });
                          }}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-[#25D366] transition-colors px-2 py-1 rounded-lg hover:bg-[#25D366]/10"
                        >
                          <WhatsAppIcon className="w-4 h-4" />
                          <span>Enviar mensagem</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Pacientes que saíram da clínica */}
            {allClinicPatients.filter(p => !isPatientActiveOn(p)).length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-semibold text-muted-foreground mb-4 flex items-center gap-2">
                  <Archive className="w-5 h-5" />
                  Pacientes que saíram ({allClinicPatients.filter(p => !isPatientActiveOn(p)).length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {allClinicPatients.filter(p => !isPatientActiveOn(p)).map((patient) => (
                    <div
                      key={patient.id}
                      className="bg-secondary/30 rounded-xl p-4 opacity-70 hover:opacity-100 transition-opacity"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 
                          className="font-semibold text-foreground cursor-pointer hover:text-primary transition-colors"
                          onClick={() => handleOpenPatient(patient.id)}
                        >
                          {patient.name}
                        </h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs text-muted-foreground hover:text-primary"
                          onClick={() => {
                            updatePatient(patient.id, { isArchived: false, departureDate: '' as any, departureReason: '' as any });
                            toast.success('Paciente reativado!');
                          }}
                        >
                          <ArchiveRestore className="w-3.5 h-3.5" />
                          Reativar
                        </Button>
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        {patient.departureDate && (
                          <p className="text-xs">
                            Saiu em {new Date(patient.departureDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                            {patient.departureReason ? ` — ${patient.departureReason}` : ''}
                          </p>
                        )}
                        {patient.clinicalArea && (
                          <p className="text-primary/70 font-medium">{patient.clinicalArea}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Packages Tab */}
        <TabsContent value="packages">
          <div className="bg-card rounded-2xl p-6 border border-border">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                Pacotes
              </h2>
              
              <Dialog open={packageDialogOpen} onOpenChange={setPackageDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2">
                    <Plus className="w-4 h-4" />
                    Novo Pacote
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Novo Pacote</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div>
                      <Label>Nome do Pacote *</Label>
                      <Input
                        value={newPackage.name}
                        onChange={(e) => setNewPackage({ ...newPackage, name: e.target.value })}
                        placeholder="Ex: Pacote Social, Pacote Premium"
                      />
                    </div>
                    <div>
                      <Label>Descrição</Label>
                      <Textarea
                        value={newPackage.description}
                        onChange={(e) => setNewPackage({ ...newPackage, description: e.target.value })}
                        placeholder="Detalhes do pacote..."
                        rows={2}
                      />
                    </div>
                    {/* Tipo de Pacote */}
                    <div>
                      <Label>Tipo de Pacote</Label>
                      <Select
                        value={newPackage.packageType}
                        onValueChange={(v) => setNewPackage({ ...newPackage, packageType: v as typeof newPackage.packageType, sessionLimit: '' })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mensal">Mensal</SelectItem>
                          <SelectItem value="por_sessao">Por Sessão</SelectItem>
                          <SelectItem value="personalizado">Personalizado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Qtd. de sessões — só para personalizado */}
                    {newPackage.packageType === 'personalizado' && (
                      <div className="animate-in fade-in duration-200">
                        <Label>Quantidade de Sessões</Label>
                        <Input
                          type="number"
                          min={1}
                          value={newPackage.sessionLimit}
                          onChange={(e) => setNewPackage({ ...newPackage, sessionLimit: e.target.value })}
                          placeholder="Ex: 8"
                          className="mt-1"
                        />
                      </div>
                    )}
                    <div>
                      <Label>Valor Total (R$) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={newPackage.price}
                        onChange={(e) => setNewPackage({ ...newPackage, price: e.target.value })}
                        placeholder="0.00"
                      />
                      {/* Calculadora automática */}
                      {newPackage.packageType === 'personalizado' && newPackage.price && newPackage.sessionLimit && Number(newPackage.sessionLimit) > 0 && (
                        <p className="mt-1.5 text-sm text-muted-foreground animate-in fade-in duration-200">
                          Valor equivalente por sessão:{' '}
                          <span className="font-semibold">
                            {(parseFloat(newPackage.price) / parseInt(newPackage.sessionLimit)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                        </p>
                      )}
                    </div>
                    <Button
                      className="w-full"
                      disabled={!newPackage.name.trim() || !newPackage.price}
                      onClick={() => {
                        addPackage({
                          userId: '',
                          clinicId: clinic.id,
                          name: newPackage.name,
                          description: newPackage.description || undefined,
                          price: parseFloat(newPackage.price),
                          isActive: true,
                          packageType: newPackage.packageType,
                          sessionLimit: newPackage.packageType === 'personalizado' && newPackage.sessionLimit ? parseInt(newPackage.sessionLimit) : null,
                        });
                        setNewPackage({ name: '', description: '', price: '', packageType: 'mensal', sessionLimit: '' });
                        setPackageDialogOpen(false);
                      }}
                    >
                      Criar Pacote
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {clinicPackages.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📦</div>
                <p className="text-muted-foreground mb-2">Nenhum pacote cadastrado</p>
                <p className="text-sm text-muted-foreground">
                  Crie pacotes com valores diferentes para organizar seus atendimentos
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {clinicPackages.map((pkg) => (
                   <div key={pkg.id} className="bg-secondary/50 rounded-xl p-4 border border-border">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-foreground">{pkg.name}</h3>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => setEditingPackage({ id: pkg.id, name: pkg.name, description: pkg.description || '', price: pkg.price.toString(), packageType: (pkg.packageType || 'mensal') as 'mensal' | 'por_sessao' | 'personalizado', sessionLimit: pkg.sessionLimit?.toString() || '' })}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => deletePackage(pkg.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    {pkg.description && (
                      <p className="text-sm text-muted-foreground mb-3">{pkg.description}</p>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-lg font-bold text-success">
                        R$ {pkg.price.toFixed(2)}
                      </p>
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        pkg.packageType === 'por_sessao' ? 'bg-primary/10 text-primary' :
                        pkg.packageType === 'personalizado' ? 'bg-warning/10 text-warning' :
                        'bg-muted text-muted-foreground'
                      )}>
                        {pkg.packageType === 'por_sessao' ? 'Por Sessão' : pkg.packageType === 'personalizado' ? 'Personalizado' : 'Mensal'}
                      </span>
                    </div>
                    {pkg.packageType === 'personalizado' && pkg.sessionLimit && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {pkg.sessionLimit} sessões · {(pkg.price / pkg.sessionLimit).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/sessão
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <PackagePatientsModal
            open={!!viewingPackagePatients}
            onOpenChange={(v) => !v && setViewingPackagePatients(null)}
            pkg={viewingPackagePatients}
          />
        </TabsContent>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Financial Tab */}
        <TabsContent value="financial">
          <ClinicFinancial clinicId={clinic.id} />
        </TabsContent>

        {/* Agenda Tab */}
        <TabsContent value="agenda">
          <ClinicAgenda clinicId={clinic.id} />
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes">
          <ClinicNotes clinicId={clinic.id} />
        </TabsContent>


        {/* WhatsApp Tab */}
        <TabsContent value="whatsapp">
          <WhatsAppTabContent
            clinicPatients={clinicPatients}
            clinic={{ name: clinic.name, address: clinic.address, phone: clinic.phone }}
          />
        </TabsContent>

        {/* Evolutions merged tab with sub-tabs (state-based) */}
        <TabsContent value="evolutions">
          {/* Sub-nav */}
          <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit mb-4">
            {([
              { value: 'evolutions', label: 'Evoluções do Dia', icon: <TrendingUp className="w-3.5 h-3.5" /> },
              { value: 'batch', label: 'Lote', icon: <FileText className="w-3.5 h-3.5" /> },
              { value: 'templates', label: 'Modelos', icon: <LayoutTemplate className="w-3.5 h-3.5" /> },
            ] as const).map(sub => (
              <button
                key={sub.value}
                onClick={() => setEvolutionsSubTab(sub.value)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  evolutionsSubTab === sub.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {sub.icon}{sub.label}
              </button>
            ))}
          </div>
          {evolutionsSubTab === 'evolutions' && <ClinicEvolutionsTab clinicId={clinic.id} clinic={clinic} />}
          {evolutionsSubTab === 'batch' && (
            <div className="space-y-4">
              <div className="bg-card rounded-2xl p-6 border border-border">
                <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Evolução Rápida em Lote
                </h2>
                <p className="text-muted-foreground text-sm mb-6">
                  Aplique a mesma evolução para múltiplos pacientes do dia de uma só vez.
                </p>

                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <Label className="text-base font-medium">Selecione os pacientes:</Label>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <div className="relative flex-1 sm:flex-initial">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar paciente..."
                          value={batchSearch}
                          onChange={(e) => setBatchSearch(e.target.value)}
                          className="pl-9 h-9 w-full sm:w-[220px]"
                        />
                      </div>
                      <Button variant="outline" size="sm" onClick={selectAllPatients}>
                        Selecionar todos
                      </Button>
                    </div>
                  </div>

                  {/* Batch date picker + day filter toggle */}
                  <div className="flex flex-wrap items-center gap-3">
                    <Label className="text-sm font-medium shrink-0">Data:</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                          <CalendarIcon className="w-4 h-4" />
                          {format(batchDate, "dd/MM/yyyy")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={batchDate}
                          onSelect={(d) => { if (d) { setBatchDate(d); setSelectedPatients([]); } }}
                          locale={ptBR}
                        />
                      </PopoverContent>
                    </Popover>
                    <button
                      onClick={() => { setBatchFilterByDay(v => !v); setSelectedPatients([]); }}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all",
                        batchFilterByDay
                          ? "bg-primary/10 text-primary border-primary/30"
                          : "bg-muted text-muted-foreground border-border hover:text-foreground"
                      )}
                    >
                      {batchFilterByDay ? '📅 Só pacientes do dia' : '👥 Todos os pacientes'}
                    </button>
                    {batchFilterByDay && batchDayPatients.length === 0 && (
                      <p className="text-xs text-muted-foreground italic">Nenhum paciente agendado neste dia da semana.</p>
                    )}
                  </div>

                  {/* Patient list */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[320px] overflow-y-auto pr-1">
                    {batchDayPatients
                      .filter(p => p.name.toLowerCase().includes(batchSearch.toLowerCase()))
                      .map((patient) => {
                        const existingEvo = getPatientBatchDateEvolution(patient.id);
                        const isSelected = selectedPatients.includes(patient.id);
                        return (
                          <div
                            key={patient.id}
                            onClick={() => !existingEvo && !isArchived && togglePatientSelection(patient.id)}
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                              existingEvo
                                ? "opacity-50 cursor-not-allowed bg-muted border-border"
                                : isSelected
                                  ? "bg-primary/10 border-primary/40"
                                  : "bg-card border-border hover:bg-accent"
                            )}
                          >
                            <div className={cn(
                              "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0",
                              isSelected ? "bg-primary border-primary" : "border-muted-foreground"
                            )}>
                              {isSelected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{patient.name}</p>
                              {existingEvo && (
                                <p className="text-xs text-muted-foreground">Já registrado</p>
                              )}
                            </div>
                          </div>
                        );
                    })}
                  </div>

                  {/* Attendance status mode */}
                  <div className="space-y-3 pt-2">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                      <Label className="text-sm font-medium shrink-0">Status:</Label>
                      <div className="flex gap-2">
                        <Button
                          variant={batchStatusMode === 'same' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setBatchStatusMode('same')}
                        >
                          Mesmo para todos
                        </Button>
                        <Button
                          variant={batchStatusMode === 'individual' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setBatchStatusMode('individual')}
                        >
                          Individual
                        </Button>
                      </div>
                    </div>

                    {batchStatusMode === 'same' && (
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant={batchGlobalStatus === 'presente' ? 'default' : 'outline'}
                          className={cn("gap-2", batchGlobalStatus === 'presente' && "bg-success hover:bg-success/90")}
                          size="sm" onClick={() => setBatchGlobalStatus('presente')}>
                          <Check className="w-4 h-4" /> Presente
                        </Button>
                        <Button type="button" variant={batchGlobalStatus === 'falta' ? 'default' : 'outline'}
                          className={cn("gap-2", batchGlobalStatus === 'falta' && "bg-destructive hover:bg-destructive/90")}
                          size="sm" onClick={() => setBatchGlobalStatus('falta')}>
                          <X className="w-4 h-4" /> Falta
                        </Button>
                        <Button type="button" variant={batchGlobalStatus === 'reposicao' ? 'default' : 'outline'}
                          className={cn("gap-2", batchGlobalStatus === 'reposicao' && "bg-primary hover:bg-primary/90")}
                          size="sm" onClick={() => setBatchGlobalStatus('reposicao')}>
                          🔄 Reposição
                        </Button>
                        <Button type="button" variant={batchGlobalStatus === 'falta_remunerada' ? 'default' : 'outline'}
                          className={cn("gap-2", batchGlobalStatus === 'falta_remunerada' && "bg-warning hover:bg-warning/90 text-warning-foreground")}
                          size="sm" onClick={() => setBatchGlobalStatus('falta_remunerada')}>
                          <DollarSign className="w-4 h-4" /> Falta Rem.
                        </Button>
                        <Button type="button" variant={batchGlobalStatus === 'feriado_remunerado' ? 'default' : 'outline'}
                          className={cn("gap-2", batchGlobalStatus === 'feriado_remunerado' && "bg-primary hover:bg-primary/90")}
                          size="sm" onClick={() => setBatchGlobalStatus('feriado_remunerado')}>
                          🎉 Feriado Rem.
                        </Button>
                        <Button type="button" variant={batchGlobalStatus === 'feriado_nao_remunerado' ? 'default' : 'outline'}
                          className={cn("gap-2", batchGlobalStatus === 'feriado_nao_remunerado' && "bg-muted hover:bg-muted/80 text-muted-foreground")}
                          size="sm" onClick={() => setBatchGlobalStatus('feriado_nao_remunerado')}>
                          📅 Feriado
                        </Button>
                      </div>
                    )}

                    {batchStatusMode === 'individual' && selectedPatients.length > 0 && (
                      <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                        {selectedPatients.map(pid => {
                          const patient = patients.find(p => p.id === pid);
                          const st = batchAttendanceStatus[pid] || 'presente';
                          return (
                            <div key={pid} className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-secondary/50 border border-border">
                              <span className="text-sm font-medium min-w-[120px]">{patient?.name}</span>
                              <div className="flex flex-wrap gap-1">
                                {([
                                  { val: 'presente', label: '✅', title: 'Presente' },
                                  { val: 'falta', label: '❌', title: 'Falta' },
                                  { val: 'reposicao', label: '🔄', title: 'Reposição' },
                                  { val: 'falta_remunerada', label: '💰', title: 'Falta Rem.' },
                                  { val: 'feriado_remunerado', label: '🎉', title: 'Feriado Rem.' },
                                  { val: 'feriado_nao_remunerado', label: '📅', title: 'Feriado' },
                                ] as const).map(opt => (
                                  <Button key={opt.val} type="button" size="sm"
                                    variant={st === opt.val ? 'default' : 'outline'}
                                    className={cn("h-7 px-2 text-xs", st === opt.val && (
                                      opt.val === 'presente' ? "bg-success hover:bg-success/90" :
                                      opt.val === 'falta' ? "bg-destructive hover:bg-destructive/90" :
                                      opt.val === 'falta_remunerada' ? "bg-warning hover:bg-warning/90 text-warning-foreground" :
                                      opt.val === 'feriado_nao_remunerado' ? "bg-muted hover:bg-muted/80 text-muted-foreground" :
                                      "bg-primary hover:bg-primary/90"
                                    ))}
                                    title={opt.title}
                                    onClick={() => setBatchAttendanceStatus(prev => ({ ...prev, [pid]: opt.val as any }))}
                                  >
                                    {opt.label}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Stamp mode */}
                  {stamps.length > 1 && (
                    <div className="flex items-center gap-3 pt-2">
                      <Label className="text-sm font-medium shrink-0">Carimbo:</Label>
                      <div className="flex gap-2">
                        <Button
                          variant={batchStampMode === 'same' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setBatchStampMode('same')}
                        >
                          Mesmo para todos
                        </Button>
                        <Button
                          variant={batchStampMode === 'individual' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setBatchStampMode('individual')}
                        >
                          Individual
                        </Button>
                      </div>
                    </div>
                  )}

                  {batchStampMode === 'same' && stamps.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Carimbo global:</Label>
                      <Select value={batchGlobalStampId} onValueChange={setBatchGlobalStampId}>
                        <SelectTrigger className="w-full sm:w-[280px]">
                          <SelectValue placeholder="Selecionar carimbo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sem carimbo</SelectItem>
                          {stamps.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name} — {s.clinical_area}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Template selector */}
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Modelo de evolução (opcional):</Label>
                    <Select value={batchSelectedTemplateId} onValueChange={(v) => { setBatchSelectedTemplateId(v); setBatchTemplateFormValues({}); }}>
                      <SelectTrigger className="w-full sm:w-[280px]">
                        <SelectValue placeholder="Selecionar modelo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem modelo (texto livre)</SelectItem>
                        {clinicTemplates.map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {batchSelectedTemplateId !== 'none' && (() => {
                    const tmpl = clinicTemplates.find(t => t.id === batchSelectedTemplateId);
                    if (!tmpl) return null;
                    const fields = tmpl.fields as any[];
                    return (
                      <div className="space-y-3 p-4 rounded-xl bg-secondary/50 border border-border">
                        {fields.map((field: any) => (
                          <div key={field.id}>
                            <Label className="text-sm mb-1 block">{field.label}{field.required && ' *'}</Label>
                            {field.type === 'select' ? (
                              <Select
                                value={batchTemplateFormValues[field.id] || ''}
                                onValueChange={(v) => setBatchTemplateFormValues(prev => ({ ...prev, [field.id]: v }))}
                              >
                                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                                <SelectContent>
                                  {(field.options || []).map((opt: string) => (
                                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : field.type === 'textarea' ? (
                              <div className="space-y-1">
                                <Textarea
                                  value={batchTemplateFormValues[field.id] || ''}
                                  onChange={(e) => setBatchTemplateFormValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                                  placeholder={field.placeholder || ''}
                                  rows={3}
                                />
                                {batchTemplateFormValues[field.id]?.trim() && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5 h-7 text-xs"
                                    disabled={improvingBatchTemplateFieldId !== null}
                                    onClick={async () => {
                                      const currentVal = batchTemplateFormValues[field.id];
                                      if (!currentVal?.trim()) return;
                                      if (!hasAI) { setAiUpgradeOpen(true); return; }
                                      setImprovingBatchTemplateFieldId(field.id);
                                      try {
                                        const { data, error } = await supabase.functions.invoke('improve-evolution', {
                                          body: { text: currentVal },
                                        });
                                        if (error) throw error;
                                        if (data?.improved) {
                                          setBatchTemplateFormValues(prev => ({ ...prev, [field.id]: data.improved }));
                                          toast.success('Texto melhorado com IA!');
                                        }
                                      } catch {
                                        toast.error('Erro ao melhorar texto');
                                      } finally {
                                        setImprovingBatchTemplateFieldId(null);
                                      }
                                    }}
                                  >
                                    {improvingBatchTemplateFieldId === field.id
                                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      : <Wand2 className="w-3.5 h-3.5" />}
                                    Melhorar com IA
                                  </Button>
                                )}
                              </div>
                            ) : (
                              <Input
                                value={batchTemplateFormValues[field.id] || ''}
                                onChange={(e) => setBatchTemplateFormValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                                placeholder={field.placeholder || ''}
                                type={field.type === 'number' ? 'number' : 'text'}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {batchSelectedTemplateId === 'none' && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-sm font-medium">Texto da evolução:</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 h-7 text-xs"
                          disabled={!batchEvolutionText.trim() || isImprovingBatchText}
                          onClick={async () => {
                            if (!batchEvolutionText.trim()) return;
                            if (!hasAI) { setAiUpgradeOpen(true); return; }
                            setIsImprovingBatchText(true);
                            try {
                              const { data, error } = await supabase.functions.invoke('improve-evolution', {
                                body: { text: batchEvolutionText },
                              });
                              if (error) throw error;
                              if (data?.improved) {
                                setBatchEvolutionText(data.improved);
                                toast.success('Texto melhorado com IA!');
                              }
                            } catch (e) {
                              toast.error('Erro ao melhorar texto');
                            } finally {
                              setIsImprovingBatchText(false);
                            }
                          }}
                        >
                          {isImprovingBatchText ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                          Melhorar com IA
                        </Button>
                      </div>
                      <Textarea
                        value={batchEvolutionText}
                        onChange={(e) => setBatchEvolutionText(e.target.value)}
                        placeholder="Descreva a evolução para todos os pacientes selecionados..."
                        rows={4}
                        disabled={isArchived}
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4">
                    <p className="text-sm text-muted-foreground">
                      {selectedPatients.length} paciente(s) selecionado(s)
                    </p>
                    <Button
                      className="gradient-primary gap-2"
                      onClick={handleBatchEvolution}
                      disabled={isArchived || selectedPatients.length === 0 || (batchSelectedTemplateId === 'none' && !batchEvolutionText.trim() && batchStatusMode === 'same' && ['presente', 'reposicao'].includes(batchGlobalStatus))}
                    >
                      <FileText className="w-4 h-4" />
                      Aplicar Evolução
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {evolutionsSubTab === 'templates' && <EvolutionTemplates clinicId={clinic.id} />}
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-6">
          <ClinicReports
            clinicId={clinic.id}
            clinicName={clinic.name}
            clinicAddress={clinic.address || undefined}
            clinicLetterhead={clinic.letterhead || undefined}
            clinic={clinic}
            therapistName={therapistProfile?.name || undefined}
            therapistProfessionalId={therapistProfile?.professional_id || undefined}
            therapistCbo={stamps.find(s => s.is_default)?.cbo || stamps[0]?.cbo || undefined}
            therapistClinicalArea={stamps.find(s => s.is_default)?.clinical_area || stamps[0]?.clinical_area || undefined}
            therapistStampImage={stamps.find(s => s.is_default)?.stamp_image || stamps[0]?.stamp_image || undefined}
            therapistSignatureImage={(stamps.find(s => s.is_default) as any)?.signature_image || (stamps[0] as any)?.signature_image || undefined}
          />
        </TabsContent>

        {/* Attendance Tab */}
        <TabsContent value="attendance">
          <ClinicAttendanceSheet
            clinicName={clinic.name}
            patients={clinicPatients}
            evolutions={evolutions.filter(e => e.clinicId === clinic.id)}
          />
        </TabsContent>

        {/* Serviços Tab — only for propria clinics */}
        {isPropria && (
          <TabsContent value="services" className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-primary" />
                Serviços
              </h2>
              <div className="flex items-center gap-2">
                {clinicServices.length > 0 && (
                  <Button size="sm" variant="outline" className="gap-2 text-xs"
                    onClick={handleExportServicesPDF} disabled={isExportingServicesPDF}>
                    {isExportingServicesPDF ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                    <span className="hidden sm:inline">Exportar PDF</span>
                  </Button>
                )}
                <Button size="sm" className="gap-2"
                  onClick={() => { loadClinicServices(); setServiceDialogOpen(true); }}
                  disabled={isArchived}>
                  <Plus className="w-4 h-4" /> Novo Serviço
                </Button>
              </div>
            </div>

            {/* Financial summary cards — month */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-card rounded-xl border border-border p-3 lg:p-4">
                <p className="text-xs text-muted-foreground mb-1">Agendado (mês)</p>
                <p className="text-base lg:text-lg font-bold text-foreground">
                  R$ {servicesMonthSummary.totalAgendado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-card rounded-xl border border-border p-3 lg:p-4">
                <p className="text-xs text-muted-foreground mb-1">Concluído (mês)</p>
                <p className="text-base lg:text-lg font-bold text-success">
                  R$ {servicesMonthSummary.totalConcluido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-card rounded-xl border border-border p-3 lg:p-4">
                <p className="text-xs text-muted-foreground mb-1">Recebido (mês)</p>
                <p className="text-base lg:text-lg font-bold text-success">
                  R$ {servicesMonthSummary.totalRecebido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {/* Bar chart — last 6 months */}
            {clinicServices.length > 0 && (
              <div className="bg-card rounded-xl border border-border p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Evolução dos últimos 6 meses (R$)</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={servicesChartData} barCategoryGap="30%" barGap={4}>
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v}`} width={55} />
                    <Tooltip
                      formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, '']}
                      contentStyle={{ fontSize: 11, borderRadius: 8 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Agendado" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Concluído" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <div className="flex rounded-lg border border-border overflow-hidden text-xs">
                {([['month', 'Mês atual'], ['all', 'Todos']] as const).map(([val, label]) => (
                  <button key={val} onClick={() => setServicesPeriodFilter(val)}
                    className={cn('px-3 py-1.5 font-medium transition-colors',
                      servicesPeriodFilter === val ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-accent')}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex rounded-lg border border-border overflow-hidden text-xs">
                {([['all', 'Todos'], ['agendado', 'Agendado'], ['concluído', 'Concluído'], ['cancelado', 'Cancelado']] as const).map(([val, label]) => (
                  <button key={val} onClick={() => setServicesStatusFilter(val)}
                    className={cn('px-3 py-1.5 font-medium transition-colors',
                      servicesStatusFilter === val ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-accent')}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {loadingClinicServices ? (
              <div className="text-center py-12 text-muted-foreground">Carregando...</div>
            ) : clinicServices.length === 0 ? (
              <div className="text-center py-12 bg-card rounded-xl border border-border">
                <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">Nenhum serviço agendado</h3>
                <p className="text-sm text-muted-foreground mb-4">Agende o primeiro atendimento particular nesta clínica</p>
                <Button size="sm" className="gap-2" onClick={() => setServiceDialogOpen(true)} disabled={isArchived}>
                  <Plus className="w-4 h-4" /> Novo Serviço
                </Button>
              </div>
            ) : filteredClinicServices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhum serviço para os filtros selecionados.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredClinicServices.map((apt) => (
                  <div key={apt.id} className="bg-card rounded-xl border border-border p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <h3 className="font-medium text-foreground text-sm truncate max-w-[150px] sm:max-w-none">{apt.client_name}</h3>
                          <Badge className={cn("text-xs shrink-0", getServiceStatusColor(apt.status))}>
                            {apt.status === 'agendado' && 'Agendado'}
                            {apt.status === 'concluído' && 'Concluído'}
                            {apt.status === 'cancelado' && 'Cancelado'}
                          </Badge>
                          {apt.paid && (
                            <Badge variant="outline" className="text-xs border-success/50 text-success shrink-0">Pago</Badge>
                          )}
                          {apt.patient_id && (
                            <Badge variant="outline" className="text-xs border-primary/50 text-primary shrink-0 flex items-center gap-1">
                              <UserCheck className="w-3 h-3" /> Paciente
                            </Badge>
                          )}
                        </div>
                        {apt.service_name && (
                          <p className="text-xs text-primary font-medium mb-1 flex items-center gap-1">
                            <Briefcase className="w-3 h-3 shrink-0" />
                            {apt.service_name}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground mb-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(apt.date + 'T00:00:00'), "dd/MM/yy", { locale: ptBR })}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {apt.time}
                          </span>
                          <span className="flex items-center gap-1 text-success font-medium">
                            <DollarSign className="w-3 h-3" />
                            R$ {apt.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                          {apt.paid && apt.payment_date && (
                            <span className="flex items-center gap-1 text-success">
                              <CheckCircle2 className="w-3 h-3" />
                              Pago em {format(new Date(apt.payment_date + 'T00:00:00'), 'dd/MM/yy')}
                            </span>
                          )}
                        </div>
                        {(apt.client_phone || apt.client_email) && (
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {apt.client_phone && (
                              <span className="flex items-center gap-1"><Phone className="w-3 h-3 shrink-0" />{apt.client_phone}</span>
                            )}
                            {apt.client_email && (
                              <span className="flex items-center gap-1 truncate max-w-[180px] sm:max-w-none">
                                <Mail className="w-3 h-3 shrink-0" />{apt.client_email}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {apt.status === 'agendado' && (
                          <>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-success hover:text-success hover:bg-success/10"
                              onClick={() => updateClinicServiceStatus(apt.id, 'concluído')} title="Concluir">
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => updateClinicServiceStatus(apt.id, 'cancelado')} title="Cancelar">
                              <X className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        {apt.status === 'concluído' && !apt.paid && (
                          <Button size="sm" variant="outline" className="text-success border-success/50 hover:bg-success/10 text-xs"
                            onClick={() => toggleClinicServicePaid(apt.id, apt.paid || false)}>
                            <DollarSign className="w-4 h-4 mr-1" />
                            <span className="hidden sm:inline">Confirmar Pagamento</span>
                            <span className="sm:hidden">Pago</span>
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEditServiceApt(apt); setEditServiceAptOpen(true); }}>
                              <Edit className="w-4 h-4 mr-2" /> Editar
                            </DropdownMenuItem>
                            {apt.status === 'concluído' && (
                              <DropdownMenuItem onClick={() => handleGenerateServiceReceipt(apt)} disabled={generatingReceiptId === apt.id}>
                                {generatingReceiptId === apt.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Receipt className="w-4 h-4 mr-2" />}
                                Emitir Recibo
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="text-destructive focus:text-destructive"
                              onClick={() => { setServiceAptToDelete(apt); setDeleteServiceAptOpen(true); }}>
                              <Trash2 className="w-4 h-4 mr-2" /> Apagar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        )}
        {/* Grupos Terapêuticos Tab */}
        <TabsContent value="groups" className="space-y-4">
          <TherapeuticGroupsTab
            clinicId={clinic.id}
            patients={clinicPatients.map(p => ({ id: p.id, name: p.name }))}
          />
        </TabsContent>
      </Tabs>



      {/* Edit Package Dialog */}
      {editingPackage && (
        <Dialog open={!!editingPackage} onOpenChange={(open) => !open && setEditingPackage(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Editar Pacote</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label>Nome do Pacote *</Label>
                <Input value={editingPackage.name}
                  onChange={(e) => setEditingPackage({ ...editingPackage, name: e.target.value })}
                  placeholder="Ex: Pacote Social" />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={editingPackage.description}
                  onChange={(e) => setEditingPackage({ ...editingPackage, description: e.target.value })}
                  placeholder="Detalhes do pacote..." rows={2} />
              </div>
              {/* Tipo de Pacote */}
              <div>
                <Label>Tipo de Pacote</Label>
                <Select
                  value={editingPackage.packageType}
                  onValueChange={(v) => setEditingPackage({ ...editingPackage, packageType: v as typeof editingPackage.packageType, sessionLimit: '' })}
                >
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="por_sessao">Por Sessão</SelectItem>
                    <SelectItem value="personalizado">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editingPackage.packageType === 'personalizado' && (
                <div className="animate-in fade-in duration-200">
                  <Label>Quantidade de Sessões</Label>
                  <Input
                    type="number"
                    min={1}
                    value={editingPackage.sessionLimit}
                    onChange={(e) => setEditingPackage({ ...editingPackage, sessionLimit: e.target.value })}
                    placeholder="Ex: 8"
                    className="mt-1"
                  />
                </div>
              )}
              <div>
                <Label>Valor Total (R$) *</Label>
                <Input type="number" step="0.01" value={editingPackage.price}
                  onChange={(e) => setEditingPackage({ ...editingPackage, price: e.target.value })}
                  placeholder="0.00" />
                {editingPackage.packageType === 'personalizado' && editingPackage.price && editingPackage.sessionLimit && Number(editingPackage.sessionLimit) > 0 && (
                  <p className="mt-1.5 text-sm text-muted-foreground animate-in fade-in duration-200">
                    Valor equivalente por sessão:{' '}
                    <span className="font-semibold">
                      {(parseFloat(editingPackage.price) / parseInt(editingPackage.sessionLimit)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </p>
                )}
              </div>
              <Button className="w-full" disabled={!editingPackage.name.trim() || !editingPackage.price}
                onClick={() => {
                  updatePackage(editingPackage.id, {
                    name: editingPackage.name,
                    description: editingPackage.description || undefined,
                    price: parseFloat(editingPackage.price),
                    packageType: editingPackage.packageType,
                    sessionLimit: editingPackage.packageType === 'personalizado' && editingPackage.sessionLimit ? parseInt(editingPackage.sessionLimit) : null,
                  });
                  setEditingPackage(null);
                  toast.success('Pacote atualizado!');
                }}>
                Salvar Alterações
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Quick Evolution Dialog */}
      <Dialog open={!!quickEvolutionPatient} onOpenChange={(open) => { if (!open) { setQuickEvolutionPatient(null); setSelectedTemplateId('none'); setTemplateFormValues({}); setQuickEvolutionMood(''); setQuickEvolutionDate(new Date()); setQuickEvolutionFiles([]); } }}>
        <DialogContent className={cn("max-h-[90vh] overflow-y-auto", selectedTemplateId !== 'none' ? "max-w-2xl" : "max-w-lg")}>
          <DialogHeader>
            <DialogTitle>Evolução Rápida</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Template Selector */}
            {clinicTemplates.length > 0 && (
              <div>
                <Label>Modelo de Evolução</Label>
                <Select value={selectedTemplateId} onValueChange={v => { setSelectedTemplateId(v); setTemplateFormValues({}); }}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Sem modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem modelo (texto livre)</SelectItem>
                    {clinicTemplates.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Status de Presença</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Button
                  type="button"
                  variant={quickEvolutionStatus === 'presente' ? 'default' : 'outline'}
                  className={cn("gap-2", quickEvolutionStatus === 'presente' && "bg-success hover:bg-success/90")}
                  onClick={() => setQuickEvolutionStatus('presente')}
                >
                  <Check className="w-4 h-4" /> Presente
                </Button>
                <Button
                  type="button"
                  variant={quickEvolutionStatus === 'falta' ? 'default' : 'outline'}
                  className={cn("gap-2", quickEvolutionStatus === 'falta' && "bg-destructive hover:bg-destructive/90")}
                  onClick={() => setQuickEvolutionStatus('falta')}
                >
                  <X className="w-4 h-4" /> Falta
                </Button>
                <Button
                  type="button"
                  variant={quickEvolutionStatus === 'reposicao' ? 'default' : 'outline'}
                  className={cn("gap-2", quickEvolutionStatus === 'reposicao' && "bg-primary hover:bg-primary/90")}
                  onClick={() => setQuickEvolutionStatus('reposicao')}
                >
                  🔄 Reposição
                </Button>
                <Button
                  type="button"
                  variant={quickEvolutionStatus === 'falta_remunerada' ? 'default' : 'outline'}
                  className={cn("gap-2", quickEvolutionStatus === 'falta_remunerada' && "bg-warning hover:bg-warning/90 text-warning-foreground")}
                  onClick={() => setQuickEvolutionStatus('falta_remunerada')}
                >
                  <DollarSign className="w-4 h-4" /> Falta Rem.
                </Button>
                <Button
                  type="button"
                  variant={quickEvolutionStatus === 'feriado_remunerado' ? 'default' : 'outline'}
                  className={cn("gap-2", quickEvolutionStatus === 'feriado_remunerado' && "bg-primary hover:bg-primary/90")}
                  onClick={() => setQuickEvolutionStatus('feriado_remunerado')}
                >
                  🎉 Feriado Rem.
                </Button>
                <Button
                  type="button"
                  variant={quickEvolutionStatus === 'feriado_nao_remunerado' ? 'default' : 'outline'}
                  className={cn("gap-2", quickEvolutionStatus === 'feriado_nao_remunerado' && "bg-muted hover:bg-muted/80 text-muted-foreground")}
                  onClick={() => setQuickEvolutionStatus('feriado_nao_remunerado')}
                >
                  📅 Feriado
                </Button>
              </div>
            </div>

            {/* Template Form (when template selected) */}
            {selectedTemplateId !== 'none' && (() => {
              const tpl = clinicTemplates.find(t => t.id === selectedTemplateId);
              return tpl ? (
                <TemplateForm
                  template={tpl}
                  values={templateFormValues}
                  onChange={setTemplateFormValues}
                  showAiImprove
                  isImprovingText={isImprovingQuickText}
                  onImproveText={async (textToImprove) => {
                    setIsImprovingQuickText(true);
                    try {
                      const { data, error } = await supabase.functions.invoke('improve-evolution', {
                        body: { text: textToImprove },
                      });
                      if (error) throw error;
                      return data?.improved || textToImprove;
                    } catch (e) {
                      toast.error('Erro ao melhorar texto');
                      return textToImprove;
                    } finally {
                      setIsImprovingQuickText(false);
                    }
                  }}
                />
              ) : null;
            })()}

            {/* Free text only when no template selected */}
            {selectedTemplateId === 'none' && (
              <div>
                <Label>Evolução</Label>
                <Textarea
                  value={quickEvolutionText}
                  onChange={(e) => setQuickEvolutionText(e.target.value)}
                  placeholder="Descreva a evolução do atendimento..."
                  className="min-h-[120px] mt-2"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 gap-2"
                  disabled={!quickEvolutionText.trim() || isImprovingQuickText}
                  onClick={async () => {
                    if (!hasAI) { setAiUpgradeOpen(true); return; }
                    setIsImprovingQuickText(true);
                    try {
                      const { data, error } = await supabase.functions.invoke('improve-evolution', {
                        body: { text: quickEvolutionText },
                      });
                      if (error) throw error;
                      if (data?.improved) {
                        setQuickEvolutionText(data.improved);
                        toast.success('Texto melhorado com IA!');
                      }
                    } catch (err) {
                      console.error(err);
                      toast.error('Erro ao melhorar texto');
                    } finally {
                      setIsImprovingQuickText(false);
                    }
                  }}
                >
                  {isImprovingQuickText ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  Melhorar com IA
                </Button>
              </div>
            )}

            {/* Stamp Selector */}
            {stamps.length > 0 && (
              <div>
                <Label>Carimbo</Label>
                <Select value={quickEvolutionStampId} onValueChange={setQuickEvolutionStampId}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Selecione o carimbo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem carimbo</SelectItem>
                    {stamps.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} — {s.clinical_area}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Date Picker */}
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <CalendarIcon className="w-4 h-4" /> Data da Evolução
              </Label>
              <Popover open={quickEvolutionDateOpen} onOpenChange={setQuickEvolutionDateOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal gap-2">
                    <CalendarIcon className="w-4 h-4" />
                    {format(quickEvolutionDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={quickEvolutionDate}
                    onSelect={(d) => { if (d) { setQuickEvolutionDate(d); setQuickEvolutionDateOpen(false); } }}
                    locale={ptBR}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Mood */}
            <div>
              <MoodSelector value={quickEvolutionMood} onChange={setQuickEvolutionMood} />
            </div>

            {/* Attachments */}
            <div>
              <Label className="mb-2 block">Anexos</Label>
              <FileUpload
                onUpload={setQuickEvolutionFiles}
                existingFiles={quickEvolutionFiles}
                onRemove={(id) => setQuickEvolutionFiles(prev => prev.filter(f => f.id !== id))}
                parentType="evolution"
                maxFiles={5}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                className="flex-1 gradient-primary"
                onClick={handleQuickEvolutionSubmit}
                disabled={isArchived}
              >
                Salvar Evolução
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setQuickEvolutionPatient(null)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Clinic Dialog */}
      <EditClinicDialog
        clinic={clinic}
        open={editClinicOpen}
        onOpenChange={setEditClinicOpen}
        onSave={updateClinic}
      />

      {/* Editable Receipt Modal (clinic services) */}
      {receiptModalData && (
        <EditableReceiptModal
          open={receiptModalOpen}
          onOpenChange={setReceiptModalOpen}
          initial={receiptModalData.initial}
          therapist={receiptModalData.therapist}
          clinic={{ name: clinic?.name ?? null, address: clinic?.address ?? null, cnpj: (clinic as any)?.cnpj ?? null }}
        />
      )}

      {/* Edit Patient Dialog */}
      {patientToEdit && (
        <EditPatientDialog
          patient={patientToEdit}
          open={editPatientOpen}
          onOpenChange={(open) => {
            setEditPatientOpen(open);
            if (!open) setPatientToEdit(null);
          }}
          onSave={updatePatient}
          clinicPackages={clinicPackages}
          clinicType={clinic?.type as 'propria' | 'terceirizada' | 'clinica' | undefined}
          clinicPaymentType={clinic?.paymentType as any}
          clinicPaymentAmount={clinic?.paymentAmount}
        />
      )}

      {/* Edit Evolution Dialog (from Today's schedule) */}
      {editingEvolution && (
        <EditEvolutionDialog
          evolution={editingEvolution}
          open={!!editingEvolution}
          onOpenChange={(open) => { if (!open) setEditingEvolution(null); }}
          onSave={(updates) => updateEvolution(editingEvolution.id, updates)}
          showFaltaRemunerada={clinic?.paysOnAbsence}
        />
      )}

      {/* Serviços tab — ServiceDialog and dialogs */}
      {isPropria && (
        <>
          <ServiceDialog
            open={serviceDialogOpen}
            onOpenChange={(open) => { setServiceDialogOpen(open); if (!open) loadClinicServices(); }}
            clinicId={clinic.id}
            onAppointmentSaved={loadClinicServices}
          />
          <ServiceDialog
            open={editServiceAptOpen}
            onOpenChange={(open) => { setEditServiceAptOpen(open); if (!open) { setEditServiceApt(null); loadClinicServices(); } }}
            editAppointment={editServiceApt as any}
            clinicId={clinic.id}
            onAppointmentSaved={loadClinicServices}
          />
          <AlertDialog open={deleteServiceAptOpen} onOpenChange={setDeleteServiceAptOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Apagar agendamento?</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja apagar o agendamento de <strong>{serviceAptToDelete?.client_name}</strong>? Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={deleteClinicServiceApt} className="bg-destructive hover:bg-destructive/90">Apagar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}

      {/* WhatsApp Message Modal */}
      {whatsAppPatient && (
        <WhatsAppMessageModal
          open={!!whatsAppPatient}
          onClose={() => setWhatsAppPatient(null)}
          patientName={whatsAppPatient.name}
          patientPhone={whatsAppPatient.phone}
        />
      )}

      {/* WhatsApp Recipient Picker */}
      {whatsAppRecipient && (
        <WhatsAppRecipientModal
          open={!!whatsAppRecipient}
          onClose={() => setWhatsAppRecipient(null)}
          patientName={whatsAppRecipient.patientName}
          recipients={[
            ...(whatsAppRecipient.patientWhatsapp || whatsAppRecipient.patientPhone
              ? [{ label: 'Paciente', name: whatsAppRecipient.patientName, number: (whatsAppRecipient.patientWhatsapp || whatsAppRecipient.patientPhone)! }]
              : []),
            ...(whatsAppRecipient.responsibleWhatsapp
              ? [{ label: 'Responsável', name: whatsAppRecipient.responsibleName || 'Responsável', number: whatsAppRecipient.responsibleWhatsapp }]
              : []),
          ]}
        />
      )}

      {/* Quick WhatsApp Modal — patients tab */}
      {quickWaPatient && (
        <QuickWhatsAppModal
          open={!!quickWaPatient}
          onClose={() => setQuickWaPatient(null)}
          phone={quickWaPatient.whatsapp || quickWaPatient.phone}
          patientName={quickWaPatient.name}
          vars={{
            nome_paciente: quickWaPatient.name,
            nome_clinica: quickWaPatient.clinicName,
            nome_terapeuta: therapistProfile?.name || '',
            valor_sessao: quickWaPatient.paymentValue
              ? quickWaPatient.paymentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
              : '',
          }}
        />
      )}
      <AIUpgradeDialog open={aiUpgradeOpen} onOpenChange={setAiUpgradeOpen} />
    </div>
  );
}




