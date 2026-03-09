import { useParams, useNavigate } from 'react-router-dom';
import { toLocalDateString } from '@/lib/utils';
import { ArrowLeft, Plus, Users, MapPin, Clock, DollarSign, Calendar, Phone, Cake, Check, X, ClipboardList, FileText, Package, Trash2, Edit, Pencil, Stamp as StampIcon, CalendarIcon, Wand2, Loader2, Sparkles, Download, Search, StickyNote, TrendingUp, Archive, ArchiveRestore, LayoutTemplate, Briefcase, MoreVertical, Mail, CheckCircle2, MessageSquare } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import jsPDF from 'jspdf';
import { ServiceDialog } from '@/components/services/ServiceDialog';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
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

import TemplateForm from '@/components/evolutions/TemplateForm';
import { EditEvolutionDialog } from '@/components/evolutions/EditEvolutionDialog';
import { FileUpload, UploadedFile } from '@/components/ui/file-upload';
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
  const [reports, setReports] = useState<{ id: string; title: string; content: string; created_at: string }[]>([]);

  useEffect(() => {
    supabase.from('saved_reports').select('id, title, content, created_at')
      .eq('clinic_id', clinicId).order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setReports(data); });
  }, [clinicId]);

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

  return (
    <div className="bg-card rounded-2xl p-6 border border-border">
      <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-primary" /> Documentos desta Clínica
      </h2>
      {reports.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📄</div>
          <p className="text-muted-foreground">Nenhum relatório salvo nesta clínica</p>
          <p className="text-sm text-muted-foreground mt-1">Gere relatórios na página de Relatórios IA e salve na pasta da clínica</p>
        </div>
      ) : (
        <div className="space-y-3">
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
    </div>
  );
}

export default function ClinicDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { clinics, patients, appointments, evolutions, addPatient, updatePatient, addEvolution, updateEvolution, setCurrentPatient, updateClinic, getClinicPackages, addPackage, updatePackage, deletePackage, loadEvolutionsForClinic, loadAppointmentsForClinic } = useApp();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [whatsAppPatient, setWhatsAppPatient] = useState<{ name: string; phone: string } | null>(null);
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
  const [stamps, setStamps] = useState<{ id: string; name: string; clinical_area: string; cbo?: string | null; stamp_image: string | null; signature_image?: string | null; is_default: boolean | null }[]>([]);
  const [therapistProfile, setTherapistProfile] = useState<{ name: string | null; professional_id: string | null } | null>(null);
  const [packageDialogOpen, setPackageDialogOpen] = useState(false);
  const [newPackage, setNewPackage] = useState({ name: '', description: '', price: '' });
  const [editingPackage, setEditingPackage] = useState<{id: string; name: string; description: string; price: string} | null>(null);
  const [isImprovingBatchText, setIsImprovingBatchText] = useState(false);
  const [batchSearch, setBatchSearch] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [evolutionsSubTab, setEvolutionsSubTab] = useState<'day' | 'batch' | 'templates'>('day');
  const [batchSelectedTemplateId, setBatchSelectedTemplateId] = useState<string>('none');
  const [batchTemplateFormValues, setBatchTemplateFormValues] = useState<Record<string, any>>({});
  const { user } = useAuth();

  // Lazy-load evolutions and appointments for this clinic
  useEffect(() => {
    if (!id) return;
    loadEvolutionsForClinic(id);
    loadAppointmentsForClinic(id);
  }, [id]);


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
  const clinicPatients = allClinicPatients.filter(p => !p.isArchived);

  // Get today's weekday for filtering patients
  const todayWeekday = getTodayWeekday();
  
  // Get patients scheduled for today based on their weekdays
  const todayPatients = useMemo(() => {
    return clinicPatients.filter(p => p.weekdays?.includes(todayWeekday));
  }, [clinicPatients, todayWeekday]);

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
    cpf: '',
    clinicalArea: '',
    diagnosis: '',
    professionals: '',
    observations: '',
    responsibleName: '',
    responsibleEmail: '',
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
    service_id?: string | null; clinic_id?: string | null; date: string; time: string;
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
      .select('*, services(name)')
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

    const firstDayTime = formData.weekdays.length > 0 
      ? formData.scheduleByDay[formData.weekdays[0]]?.start || ''
      : '';

    const selectedPkg = formData.packageId ? clinicPackages.find(p => p.id === formData.packageId) : null;

    // Save patient with payment_due_day via direct supabase call
    const { data: newPatient } = await supabase
      .from('patients')
      .insert({
        clinic_id: clinic.id,
        user_id: user?.id!,
        name: formData.name,
        birthdate: formData.birthdate,
        phone: formData.phone || null,
        cpf: formData.cpf || null,
        clinical_area: formData.clinicalArea || null,
        diagnosis: formData.diagnosis || null,
        professionals: formData.professionals || null,
        observations: formData.observations || null,
        responsible_name: formData.responsibleName || null,
        responsible_email: formData.responsibleEmail || null,
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

    // Also add to context so UI updates
    addPatient({
      clinicId: clinic.id,
      name: formData.name,
      birthdate: formData.birthdate,
      phone: formData.phone,
      clinicalArea: formData.clinicalArea,
      diagnosis: formData.diagnosis,
      professionals: formData.professionals,
      observations: formData.observations,
      responsibleName: formData.responsibleName,
      responsibleEmail: formData.responsibleEmail,
      paymentType: clinic.paymentType === 'sessao' ? 'sessao' : clinic.paymentType === 'fixo_mensal' ? 'fixo' : 'sessao',
      paymentValue: selectedPkg ? selectedPkg.price : clinic.paymentAmount,
      contractStartDate: formData.contractStartDate,
      weekdays: formData.weekdays,
      scheduleTime: firstDayTime,
      scheduleByDay: formData.scheduleByDay,
      packageId: formData.packageId || undefined,
    });

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
      cpf: '',
      clinicalArea: '',
      diagnosis: '',
      professionals: '',
      observations: '',
      responsibleName: '',
      responsibleEmail: '',
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

    if (!batchTemplate && !batchEvolutionText.trim()) {
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
      
      const status = batchAttendanceStatus[patientId] || 'presente';
      
      await addEvolution({
        patientId,
        clinicId: clinic.id,
        date: dateStr,
        text: fullText,
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
    const patientsWithoutEvolution = clinicPatients
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

        {clinic.weekdays?.length && (
          <div className="bg-card rounded-xl lg:rounded-2xl p-3 lg:p-5 border border-border flex items-center gap-3 lg:block">
            <Clock className="w-6 h-6 lg:w-8 lg:h-8 text-warning lg:mb-2 shrink-0" />
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs">Dias</p>
              <p className="text-xs lg:text-sm font-bold text-foreground truncate">{clinic.weekdays.join(', ')}</p>
            </div>
          </div>
        )}

        {clinic.paymentAmount && (
          <div className="bg-card rounded-xl lg:rounded-2xl p-3 lg:p-5 border border-border flex items-center gap-3 lg:block">
            <DollarSign className="w-6 h-6 lg:w-8 lg:h-8 text-success lg:mb-2 shrink-0" />
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs">Remuneração</p>
              <p className="text-base lg:text-lg font-bold text-foreground">
                R$ {clinic.paymentAmount.toFixed(2)}
              </p>
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
            { value: 'reports', icon: <Sparkles className="w-5 h-5" />, label: 'Docs', color: 'text-amber-500' },
            { value: 'whatsapp', icon: <span className="w-5 h-5 flex items-center justify-center text-base">💬</span>, label: 'WhatsApp', color: 'text-green-500' },
            ...(isPropria ? [{ value: 'services', icon: <Briefcase className="w-5 h-5" />, label: 'Serviços', color: 'text-cyan-500' }] : []),
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
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Batch Evolution Tab */}
        <TabsContent value="batch" className="space-y-4">
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

              {clinicPatients.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum paciente cadastrado nesta clínica
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {clinicPatients.filter(p => !batchSearch || p.name.toLowerCase().includes(batchSearch.toLowerCase())).map((patient) => {
                    const hasEvolution = !!getPatientBatchDateEvolution(patient.id);
                    const isSelected = selectedPatients.includes(patient.id);
                    const status = batchAttendanceStatus[patient.id] || 'presente';
                    return (
                      <div
                        key={patient.id}
                        className={cn(
                          "flex flex-col gap-2 p-3 rounded-xl border transition-colors",
                          hasEvolution 
                            ? "bg-muted/50 border-muted opacity-60"
                            : isSelected
                              ? "bg-primary/10 border-primary"
                              : "bg-secondary/50 border-border hover:border-primary/50"
                        )}
                      >
                        <label className="flex items-center gap-3 cursor-pointer">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => !hasEvolution && togglePatientSelection(patient.id)}
                            disabled={hasEvolution}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground truncate">{patient.name}</p>
                            <p className="text-xs text-muted-foreground">{patient.scheduleTime || '--:--'} • {patient.clinicalArea || 'Sem área'}</p>
                          </div>
                          {hasEvolution && (
                            <span className="text-xs bg-success/20 text-success px-2 py-1 rounded-full">
                              Feito
                            </span>
                          )}
                        </label>
                        {isSelected && !hasEvolution && (
                          <div className="flex items-center gap-2 pl-7 flex-wrap">
                            <Button
                              type="button"
                              size="sm"
                              variant={status === 'presente' ? 'default' : 'outline'}
                              className={cn("h-7 text-xs gap-1", status === 'presente' && "bg-success hover:bg-success/90 text-success-foreground")}
                              onClick={() => setBatchAttendanceStatus(prev => ({ ...prev, [patient.id]: 'presente' }))}
                            >
                              <Check className="w-3 h-3" /> Presente
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={status === 'falta' ? 'default' : 'outline'}
                              className={cn("h-7 text-xs gap-1", status === 'falta' && "bg-destructive hover:bg-destructive/90 text-destructive-foreground")}
                              onClick={() => setBatchAttendanceStatus(prev => ({ ...prev, [patient.id]: 'falta' }))}
                            >
                              <X className="w-3 h-3" /> Falta
                            </Button>
                            {clinic && (clinic.absencePaymentType !== 'never' || clinic.paysOnAbsence !== false) && (
                              <Button
                                type="button"
                                size="sm"
                                variant={status === 'falta_remunerada' ? 'default' : 'outline'}
                                className={cn("h-7 text-xs gap-1", status === 'falta_remunerada' && "bg-warning hover:bg-warning/90 text-warning-foreground")}
                                onClick={() => setBatchAttendanceStatus(prev => ({ ...prev, [patient.id]: 'falta_remunerada' }))}
                              >
                                <DollarSign className="w-3 h-3" /> Falta Rem.
                              </Button>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              variant={status === 'reposicao' ? 'default' : 'outline'}
                              className={cn("h-7 text-xs gap-1", status === 'reposicao' && "bg-primary hover:bg-primary/90 text-primary-foreground")}
                              onClick={() => setBatchAttendanceStatus(prev => ({ ...prev, [patient.id]: 'reposicao' }))}
                            >
                              🔄 Repos.
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={status === 'feriado_remunerado' ? 'default' : 'outline'}
                              className={cn("h-7 text-xs gap-1", status === 'feriado_remunerado' && "bg-primary hover:bg-primary/90 text-primary-foreground")}
                              onClick={() => setBatchAttendanceStatus(prev => ({ ...prev, [patient.id]: 'feriado_remunerado' }))}
                            >
                              🎉 Fer. Rem.
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={status === 'feriado_nao_remunerado' ? 'default' : 'outline'}
                              className={cn("h-7 text-xs gap-1", status === 'feriado_nao_remunerado' && "bg-muted hover:bg-muted/80 text-muted-foreground")}
                              onClick={() => setBatchAttendanceStatus(prev => ({ ...prev, [patient.id]: 'feriado_nao_remunerado' }))}
                            >
                              📅 Feriado
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="pt-4 border-t border-border space-y-4">
                {/* Date Picker */}
                <div>
                  <Label className="flex items-center gap-2 mb-2">
                    <CalendarIcon className="w-4 h-4" /> Data da Evolução
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full sm:w-[280px] justify-start text-left font-normal", !batchDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(batchDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={batchDate}
                        onSelect={(d) => d && setBatchDate(d)}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Stamp Selection */}
                <div>
                  <Label className="flex items-center gap-2 mb-2">
                    <StampIcon className="w-4 h-4" /> Carimbo
                  </Label>
                  <div className="flex items-center gap-4 mb-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="stampMode" checked={batchStampMode === 'same'} onChange={() => setBatchStampMode('same')} className="accent-primary" />
                      <span className="text-sm">Mesmo para todos</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="stampMode" checked={batchStampMode === 'individual'} onChange={() => setBatchStampMode('individual')} className="accent-primary" />
                      <span className="text-sm">Individual por paciente</span>
                    </label>
                  </div>

                  {batchStampMode === 'same' ? (
                    <Select value={batchGlobalStampId} onValueChange={setBatchGlobalStampId}>
                      <SelectTrigger className="w-full sm:w-[280px]">
                        <SelectValue placeholder="Selecione um carimbo (opcional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem carimbo</SelectItem>
                        {stamps.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name} — {s.clinical_area}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    selectedPatients.length > 0 ? (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {selectedPatients.map(pid => {
                          const patient = clinicPatients.find(p => p.id === pid);
                          if (!patient) return null;
                          return (
                            <div key={pid} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/50">
                              <span className="text-sm font-medium min-w-[120px] truncate">{patient.name}</span>
                              <Select value={batchIndividualStamps[pid] || 'none'} onValueChange={(v) => setBatchIndividualStamps(prev => ({ ...prev, [pid]: v }))}>
                                <SelectTrigger className="flex-1">
                                  <SelectValue placeholder="Carimbo" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Sem carimbo</SelectItem>
                                  {stamps.map(s => (
                                    <SelectItem key={s.id} value={s.id}>{s.name} — {s.clinical_area}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Selecione pacientes primeiro para atribuir carimbos individuais.</p>
                    )
                  )}
                </div>

                {/* Template Selector */}
                {clinicTemplates.length > 0 && (
                  <div>
                    <Label>Modelo de Evolução</Label>
                    <Select value={batchSelectedTemplateId} onValueChange={v => { setBatchSelectedTemplateId(v); setBatchTemplateFormValues({}); }}>
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

                {/* Template Form */}
                {batchSelectedTemplateId !== 'none' && (() => {
                  const tpl = clinicTemplates.find(t => t.id === batchSelectedTemplateId);
                  return tpl ? (
                    <TemplateForm
                      template={tpl}
                      values={batchTemplateFormValues}
                      onChange={setBatchTemplateFormValues}
                      showAiImprove
                      isImprovingText={isImprovingBatchText}
                      onImproveText={async (textToImprove) => {
                        setIsImprovingBatchText(true);
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
                          setIsImprovingBatchText(false);
                        }
                      }}
                    />
                  ) : null;
                })()}

                {/* Evolution Text (only when no template) */}
                {batchSelectedTemplateId === 'none' && (
                  <div>
                    <Label className="mb-2 block">Texto da Evolução</Label>
                    <Textarea
                      value={batchEvolutionText}
                      onChange={(e) => setBatchEvolutionText(e.target.value)}
                      placeholder="Digite a evolução que será aplicada a todos os pacientes selecionados..."
                      className="min-h-[120px]"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2 gap-2"
                      disabled={!batchEvolutionText.trim() || isImprovingBatchText}
                      onClick={async () => {
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
                )}
              </div>

              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                  {selectedPatients.length} paciente(s) selecionado(s)
                </p>
                <Button 
                  className="gradient-primary gap-2"
                  onClick={handleBatchEvolution}
                  disabled={isArchived || selectedPatients.length === 0 || (batchSelectedTemplateId === 'none' && !batchEvolutionText.trim())}
                >
                  <FileText className="w-4 h-4" />
                  Aplicar Evolução
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Patients Tab */}
        <TabsContent value="patients">
          <div className="bg-card rounded-2xl p-6 border border-border">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-foreground">Pacientes</h2>
              
              {!isArchived && (
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

                     <div>
                      <Label>Telefone</Label>
                      <Input
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="(00) 00000-0000"
                      />
                    </div>

                    <div>
                      <Label>CPF do Paciente <span className="text-muted-foreground font-normal text-xs">(para fins de cadastro)</span></Label>
                      <Input
                        value={formData.cpf}
                        onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                        placeholder="000.000.000-00"
                      />
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
                      <p className="font-semibold">👤 Responsável Legal <span className="text-muted-foreground font-normal text-sm">(obrigatório para menores de 18 anos)</span></p>
                      <p className="text-xs text-muted-foreground -mt-1">O CPF do responsável será usado na nota fiscal quando o paciente for menor de idade.</p>
                      <div>
                        <Label>Nome do Responsável</Label>
                        <Input
                          value={formData.responsibleName}
                          onChange={(e) => setFormData({ ...formData, responsibleName: e.target.value })}
                          placeholder="Ex: Maria Silva"
                        />
                      </div>
                      <div>
                        <Label>CPF do Responsável <span className="text-muted-foreground font-normal text-xs">(para nota fiscal)</span></Label>
                        <Input
                          value={formData.responsible_cpf}
                          onChange={(e) => setFormData({ ...formData, responsible_cpf: e.target.value })}
                          placeholder="000.000.000-00"
                        />
                      </div>
                      <div>
                        <Label>E-mail do Responsável</Label>
                        <Input
                          type="email"
                          value={formData.responsibleEmail}
                          onChange={(e) => setFormData({ ...formData, responsibleEmail: e.target.value })}
                          placeholder="email@exemplo.com"
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
              )}
            </div>

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

                    {patient.paymentValue && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <span className="text-success font-semibold">
                          R$ {patient.paymentValue.toFixed(2)}
                          {patient.paymentType === 'sessao' ? '/sessão' : '/mês'}
                        </span>
                      </div>
                    )}

                    {patient.phone && (
                      <div className="mt-2 pt-2 border-t border-border">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full h-8 gap-1.5 text-xs text-[#25D366] hover:text-[#1ebe57] hover:bg-[#25D366]/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            setWhatsAppPatient({ name: patient.name, phone: patient.phone! });
                          }}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          Enviar WhatsApp
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Archived Patients */}
            {allClinicPatients.filter(p => p.isArchived).length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-semibold text-muted-foreground mb-4 flex items-center gap-2">
                  <Archive className="w-5 h-5" />
                  Pacientes Arquivados ({allClinicPatients.filter(p => p.isArchived).length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {allClinicPatients.filter(p => p.isArchived).map((patient) => (
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
                            updatePatient(patient.id, { isArchived: false });
                            toast.success('Paciente reativado!');
                          }}
                        >
                          <ArchiveRestore className="w-3.5 h-3.5" />
                          Reativar
                        </Button>
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
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
                    <div>
                      <Label>Valor (R$) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={newPackage.price}
                        onChange={(e) => setNewPackage({ ...newPackage, price: e.target.value })}
                        placeholder="0.00"
                      />
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
                        });
                        setNewPackage({ name: '', description: '', price: '' });
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
                          onClick={() => setEditingPackage({ id: pkg.id, name: pkg.name, description: pkg.description || '', price: pkg.price.toString() })}>
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
                    <p className="text-lg font-bold text-success">
                      R$ {pkg.price.toFixed(2)}
                    </p>
                  </div>
                ))}
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

        {/* Templates (nested) */}
        <TabsContent value="evolutions-templates">
          <EvolutionTemplates clinicId={clinic.id} />
        </TabsContent>

        {/* WhatsApp Tab */}
        <TabsContent value="whatsapp">
          <div className="bg-card rounded-xl border border-border p-4 lg:p-6 space-y-6">
            {/* Send to patients panel */}
            <WhatsAppSendPanel patients={clinicPatients.map(p => ({ id: p.id, name: p.name, phone: p.phone }))} />
            <div className="border-t border-border pt-6">
              <MessageTemplatesManager />
            </div>
          </div>
        </TabsContent>

        {/* Evolutions merged tab with sub-tabs */}
        <TabsContent value="evolutions">
          <Tabs defaultValue="evolutions-day" className="space-y-0">
            {/* Sub-tab bar */}
            <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit mb-4">
              {[
                { value: 'evolutions-day', label: 'Evoluções do Dia', icon: <TrendingUp className="w-3.5 h-3.5" /> },
                { value: 'evolutions-batch', label: 'Lote', icon: <FileText className="w-3.5 h-3.5" /> },
                { value: 'evolutions-templates', label: 'Modelos', icon: <LayoutTemplate className="w-3.5 h-3.5" /> },
              ].map(sub => (
                <TabsList key={sub.value} className="p-0 h-auto bg-transparent">
                  <TabsTrigger
                    value={sub.value}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground transition-all"
                  >
                    {sub.icon}
                    {sub.label}
                  </TabsTrigger>
                </TabsList>
              ))}
            </div>
            <TabsContent value="evolutions-day">
              <ClinicEvolutionsTab clinicId={clinic.id} clinic={clinic} />
            </TabsContent>
            <TabsContent value="evolutions-batch" className="space-y-4">
              <div className="bg-card rounded-2xl p-6 border border-border">
                <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Evolução em Lote
                </h2>
              </div>
            </TabsContent>
            <TabsContent value="evolutions-templates">
              <EvolutionTemplates clinicId={clinic.id} />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports">
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
              <div>
                <Label>Valor (R$) *</Label>
                <Input type="number" step="0.01" value={editingPackage.price}
                  onChange={(e) => setEditingPackage({ ...editingPackage, price: e.target.value })}
                  placeholder="0.00" />
              </div>
              <Button className="w-full" disabled={!editingPackage.name.trim() || !editingPackage.price}
                onClick={() => {
                  updatePackage(editingPackage.id, {
                    name: editingPackage.name,
                    description: editingPackage.description || undefined,
                    price: parseFloat(editingPackage.price),
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
          clinicType={clinic?.type as 'propria' | 'terceirizada' | undefined}
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
    </div>
  );
}

