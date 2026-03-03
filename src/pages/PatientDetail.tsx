import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Phone, Cake, FileText, Plus, CheckCircle2, Image, Stamp as StampIcon, Download, CalendarRange, PenLine, Edit, X, Paperclip, ListTodo, Package, Sparkles, Pencil, Trash2, Loader2, Wand2, Archive, ArchiveRestore } from 'lucide-react';
import { generateEvolutionPdf, generateMultipleEvolutionsPdf } from '@/utils/generateEvolutionPdf';
import { Button } from '@/components/ui/button';
import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { FileUpload, UploadedFile } from '@/components/ui/file-upload';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar, Calendar as CalendarComponent } from '@/components/ui/calendar';
import { EditEvolutionDialog } from '@/components/evolutions/EditEvolutionDialog';
import { EditPatientDialog } from '@/components/patients/EditPatientDialog';
import TemplateForm from '@/components/evolutions/TemplateForm';
import { EvolutionTemplate, TemplateField } from '@/types';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Evolution } from '@/types';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { generateReportPdf } from '@/utils/generateReportPdf';

const MOOD_OPTIONS = [
  { value: 'otima', emoji: '😄', label: 'Ótima', score: 5 },
  { value: 'boa', emoji: '😊', label: 'Boa', score: 4 },
  { value: 'neutra', emoji: '😐', label: 'Neutra', score: 3 },
  { value: 'ruim', emoji: '😟', label: 'Ruim', score: 2 },
  { value: 'muito_ruim', emoji: '😢', label: 'Muito ruim', score: 1 },
] as const;

function getMoodInfo(mood?: string) {
  return MOOD_OPTIONS.find(m => m.value === mood);
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

const MoodTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  const moodInfo = MOOD_OPTIONS.find(m => m.score === data.score);
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
    generateReportPdf({
      title: report.title,
      content: report.content,
      clinicName,
      clinicAddress,
      clinicLetterhead,
      clinicEmail,
      clinicCnpj,
      clinicPhone,
      clinicServicesDescription,
    });
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
    addTask, toggleTask, deleteTask, getPatientTasks, getPatientAttachments, addAttachment, deleteAttachment, clinicPackages, updatePatient, deletePatient, getClinicPackages } = useApp();
  const { user } = useAuth();

  const patient = patients.find(p => p.id === id);
  const clinic = clinics.find(c => c.id === patient?.clinicId);
  const patientEvolutions = useMemo(() => {
    const evos = evolutions
      .filter(e => e.patientId === id)
      .sort((a, b) => new Date(b.date + 'T12:00:00').getTime() - new Date(a.date + 'T12:00:00').getTime());
    // Join attachments from state to evolutions
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
  // Load stamps and templates
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

  // Convert attachments to UploadedFile format for FileUpload component
  const patientDocsAsUploadedFiles: UploadedFile[] = useMemo(() => patientAttachments.map(a => ({
    id: a.id, name: a.name, filePath: a.data, fileType: a.type,
    url: a.data.startsWith('http') ? a.data : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/attachments/${a.data}`,
  })), [patientAttachments]);

  if (!patient) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Paciente não encontrado</p>
        <Button onClick={() => navigate('/clinics')} className="mt-4">Voltar</Button>
      </div>
    );
  }

  // Summaries
  const totalPresent = patientEvolutions.filter(e => e.attendanceStatus === 'presente').length;
  const totalReposicao = patientEvolutions.filter(e => e.attendanceStatus === 'reposicao').length;
  const totalAbsent = patientEvolutions.filter(e => e.attendanceStatus === 'falta').length;
  const totalPaidAbsent = patientEvolutions.filter(e => e.attendanceStatus === 'falta_remunerada').length;
  const totalFeriadoRem = patientEvolutions.filter(e => e.attendanceStatus === 'feriado_remunerado').length;
  const totalFeriadoNaoRem = patientEvolutions.filter(e => e.attendanceStatus === 'feriado_nao_remunerado').length;
  const totalSessions = patientEvolutions.length;
  const attendanceRate = totalSessions > 0 ? Math.round(((totalPresent + totalReposicao) / totalSessions) * 100) : 0;
  const totalFinancial = (totalPresent + totalReposicao + totalPaidAbsent + totalFeriadoRem) * (patient.paymentValue || 0);

  const moodCounts = MOOD_OPTIONS.map(m => ({
    ...m, count: patientEvolutions.filter(e => e.mood === m.value).length,
  }));
  const totalMoods = moodCounts.reduce((sum, m) => sum + m.count, 0);

  // Mood chart data (chronological)
  const moodChartData = patientEvolutions
    .filter(e => e.mood)
    .sort((a, b) => new Date(a.date + 'T12:00:00').getTime() - new Date(b.date + 'T12:00:00').getTime())
    .map(e => {
      const moodInfo = getMoodInfo(e.mood);
      return {
        date: e.date,
        dateLabel: format(new Date(e.date + 'T12:00:00'), 'dd/MM', { locale: ptBR }),
        score: moodInfo?.score || 3,
        emoji: moodInfo?.emoji || '😐',
      };
    });

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
        const templateSection = `📋 ${selectedTemplate.name}\n${templateLines.join('\n')}`;
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

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" onClick={handleBack} className="mb-4 gap-2">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
        <div className="flex flex-col lg:flex-row lg:items-start gap-6">
          <div className="flex-1">
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-3 flex items-center gap-3">
              {patient.name}
              {patient.isArchived && (
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-warning/20 text-warning">Arquivado</span>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-primary"
                onClick={() => setEditPatientOpen(true)}
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-warning"
                title={patient.isArchived ? 'Desarquivar paciente' : 'Arquivar paciente'}
                onClick={() => setArchivePatientOpen(true)}
              >
                {patient.isArchived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => setDeletePatientOpen(true)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </h1>
            <div className="flex flex-wrap gap-3">
              {patient.birthdate && calculateAge(patient.birthdate) !== null && (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm">
                  <Cake className="w-4 h-4" /> {calculateAge(patient.birthdate)} anos
                </span>
              )}
              {patient.phone && (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 text-success text-sm">
                  <Phone className="w-4 h-4" /> {patient.phone}
                </span>
              )}
              {patient.clinicalArea && (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-sm">
                  {patient.clinicalArea}
                </span>
              )}
              {patientPackage && (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-foreground text-sm">
                  <Package className="w-4 h-4" /> {patientPackage.name}
                </span>
              )}
            </div>
          </div>
          {clinic && (
            <div className="bg-secondary rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Atendimento em</p>
              <p className="font-semibold text-foreground">{clinic.name}</p>
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
          <p className="text-sm font-medium text-muted-foreground mb-3">📊 Frequência</p>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-2xl font-bold text-foreground">{attendanceRate}%</span>
            <span className="text-sm text-muted-foreground">presença</span>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="text-success">✅ {totalPresent}</span>
            {totalReposicao > 0 && <span className="text-primary">🔄 {totalReposicao}</span>}
            {totalPaidAbsent > 0 && <span className="text-warning">💰 {totalPaidAbsent}</span>}
            {totalFeriadoRem > 0 && <span className="text-primary">🎉 {totalFeriadoRem}</span>}
            {totalFeriadoNaoRem > 0 && <span className="text-muted-foreground">📅 {totalFeriadoNaoRem}</span>}
            <span className="text-destructive">❌ {totalAbsent}</span>
            <span className="text-muted-foreground">Total: {totalSessions}</span>
          </div>
        </div>

        <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
          <p className="text-sm font-medium text-muted-foreground mb-3">💰 Financeiro</p>
          <p className="text-2xl font-bold text-success mb-1">R$ {totalFinancial.toFixed(2)}</p>
          <p className="text-sm text-muted-foreground">
            {totalPresent + totalReposicao + totalPaidAbsent + totalFeriadoRem} sessões pagas × R$ {(patient.paymentValue || 0).toFixed(2)}
          </p>
        </div>

        <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
          <p className="text-sm font-medium text-muted-foreground mb-3">🎭 Humor</p>
          {totalMoods === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum registro ainda</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {moodCounts.filter(m => m.count > 0).map(m => (
                <div key={m.value} className="flex items-center gap-1 px-2 py-1 rounded-full bg-secondary text-sm">
                  <span>{m.emoji}</span>
                  <span className="font-medium">{m.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mood Chart */}
      {moodChartData.length >= 2 && (
        <div className="bg-card rounded-2xl p-6 border border-border shadow-sm mb-8">
          <h2 className="font-bold text-foreground mb-4 flex items-center gap-2">📈 Evolução do Humor</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={moodChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(v) => {
                    const m = MOOD_OPTIONS.find(o => o.score === v);
                    return m?.emoji || '';
                  }}
                />
                <Tooltip content={<MoodTooltip />} />
                <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2.5}
                  dot={{ fill: 'hsl(var(--primary))', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Clinical Info */}
      {(patient.diagnosis || patient.observations || patient.paymentValue) && (
        <div className="bg-card rounded-2xl p-6 border-l-4 border-primary shadow-lg mb-8">
          <h2 className="font-bold text-foreground mb-4 flex items-center gap-2">📋 Informações Clínicas</h2>
          <div className="space-y-4">
            {patient.diagnosis && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Diagnóstico</p>
                <p className="text-foreground">{patient.diagnosis}</p>
              </div>
            )}
            {patient.observations && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Observações</p>
                <p className="text-foreground whitespace-pre-wrap">{patient.observations}</p>
              </div>
            )}
            {patient.paymentValue && (
              <div className="pt-3 border-t">
                <p className="text-sm font-medium text-muted-foreground mb-1">💰 Financeiro</p>
                <p className="text-success font-bold">
                  R$ {patient.paymentValue.toFixed(2)}
                  {patient.paymentType === 'sessao' ? '/sessão' : '/mês'}
                  {patientPackage && <span className="text-muted-foreground font-normal text-sm ml-2">({patientPackage.name})</span>}
                </p>
              </div>
            )}
            {(patient.weekdays?.length || patient.scheduleTime) && (
              <div className="pt-3 border-t">
                <p className="text-sm font-medium text-muted-foreground mb-1">📅 Horários</p>
                {patient.weekdays?.length && <p className="text-foreground">{patient.weekdays.join(', ')}</p>}
                {patient.scheduleTime && <p className="text-foreground">🕐 {patient.scheduleTime}</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="evolutions" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="evolutions" className="gap-2"><FileText className="w-4 h-4" /> Evoluções</TabsTrigger>
          <TabsTrigger value="documents" className="gap-2"><Paperclip className="w-4 h-4" /> Documentos</TabsTrigger>
          <TabsTrigger value="tasks" className="gap-2"><ListTodo className="w-4 h-4" /> Tarefas</TabsTrigger>
        </TabsList>

        {/* Evolutions Tab */}
        <TabsContent value="evolutions" className="space-y-6">
          <div className="bg-card rounded-2xl p-6 shadow-lg border border-border">
            <h2 className="font-bold text-foreground mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" /> Nova Evolução
            </h2>
            <form onSubmit={handleSubmitEvolution} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Data</Label>
                  <Input type="date" value={evolutionDate} onChange={(e) => setEvolutionDate(e.target.value)} />
                </div>
                <div>
                  <Label>Presença</Label>
                  <Select value={attendanceStatus} onValueChange={(v) => setAttendanceStatus(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
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
                  <Label>Humor da Sessão</Label>
                  <div className="flex gap-1 mt-1">
                    {MOOD_OPTIONS.map(m => (
                      <button key={m.value} type="button"
                        onClick={() => setSelectedMood(selectedMood === m.value ? '' : m.value)}
                        className={cn(
                          "flex-1 flex flex-col items-center gap-0.5 p-2 rounded-lg border-2 transition-all text-center",
                          selectedMood === m.value ? "border-primary bg-primary/10" : "border-transparent bg-secondary hover:bg-secondary/80"
                        )} title={m.label}>
                        <span className="text-lg">{m.emoji}</span>
                        <span className="text-[10px] text-muted-foreground leading-tight">{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Template selector */}
              {clinicTemplates.length > 0 && (
                <div>
                  <Label className="flex items-center gap-2 mb-1">📋 Modelo de Evolução</Label>
                  <Select value={selectedTemplateId} onValueChange={(v) => {
                    setSelectedTemplateId(v === 'none' ? '' : v);
                    if (v === 'none' || !v) setTemplateFormValues({});
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um modelo (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem modelo</SelectItem>
                      {clinicTemplates.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Template form */}
              {selectedTemplateId && clinicTemplates.find(t => t.id === selectedTemplateId) && (
                <TemplateForm
                  template={clinicTemplates.find(t => t.id === selectedTemplateId)!}
                  values={templateFormValues}
                  onChange={setTemplateFormValues}
                  showAiImprove
                  isImprovingText={isImprovingText}
                  onImproveText={async (textToImprove) => {
                    setIsImprovingText(true);
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
                      setIsImprovingText(false);
                    }
                  }}
                />
              )}

              {/* Free text only when no template selected */}
              {!selectedTemplateId && (
                <div>
                  <Label>Evolução</Label>
                  <Textarea value={evolutionText} onChange={(e) => setEvolutionText(e.target.value)}
                    placeholder="Digite a evolução do paciente..." className="min-h-32" />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2 gap-2"
                    disabled={!evolutionText.trim() || isImprovingText}
                    onClick={async () => {
                      setIsImprovingText(true);
                      try {
                        const { data, error } = await supabase.functions.invoke('improve-evolution', {
                          body: { text: evolutionText },
                        });
                        if (error) throw error;
                        if (data?.improved) {
                          setEvolutionText(data.improved);
                          toast.success('Texto melhorado com IA!');
                        }
                      } catch (e) {
                        toast.error('Erro ao melhorar texto');
                      } finally {
                        setIsImprovingText(false);
                      }
                    }}
                  >
                    {isImprovingText ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                    Melhorar com IA
                  </Button>
                </div>
              )}
              <div>
                <Label className="flex items-center gap-2 mb-2"><Image className="w-4 h-4" /> Anexos (opcional)</Label>
                <FileUpload parentType="evolution" parentId={patient.id} existingFiles={attachedFiles}
                  onUpload={(files) => setAttachedFiles(prev => [...prev, ...files])}
                  onRemove={(fileId) => setAttachedFiles(prev => prev.filter(f => f.id !== fileId))} maxFiles={5} />
              </div>
              {stamps.length > 0 && (
                <div>
                  <Label className="flex items-center gap-2 mb-2"><StampIcon className="w-4 h-4" /> Carimbo</Label>
                  <Select value={selectedStampId} onValueChange={setSelectedStampId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um carimbo (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem carimbo</SelectItem>
                      {stamps.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} — {s.clinical_area} {s.is_default ? '⭐' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button type="submit" className="gradient-primary gap-2"><Plus className="w-4 h-4" /> Salvar Evolução</Button>
            </form>
          </div>

          {/* History */}
          <div className="bg-card rounded-2xl p-4 sm:p-6 shadow-lg border border-border">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
              <h2 className="font-bold text-foreground flex flex-wrap items-center gap-2 text-sm sm:text-base">
                📜 Histórico ({patientEvolutions.length})
              </h2>
              {patientEvolutions.length > 0 && (
                <Dialog open={periodDialogOpen} onOpenChange={setPeriodDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 text-xs sm:text-sm w-full sm:w-auto">
                      <CalendarRange className="w-4 h-4" /> PDF por Período
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
                              <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
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
                              <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
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
                          {patientEvolutions.filter(evo => { const d = new Date(evo.date + 'T12:00:00'); return d >= startDate && d <= endDate; }).length} evoluções
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

            {patientEvolutions.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-5xl mb-3">📝</div>
                <p className="text-muted-foreground">Nenhuma evolução registrada ainda.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {patientEvolutions.map((evo) => {
                  const moodInfo = getMoodInfo(evo.mood);
                  return (
                    <div key={evo.id} className="bg-secondary/50 rounded-xl p-3 sm:p-4">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-foreground text-sm sm:text-base">
                            {format(new Date(evo.date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                          </span>
                          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap',
                            evo.attendanceStatus === 'presente' ? 'bg-success/10 text-success' :
                            evo.attendanceStatus === 'falta_remunerada' ? 'bg-warning/10 text-warning' :
                            evo.attendanceStatus === 'reposicao' ? 'bg-primary/10 text-primary' :
                            evo.attendanceStatus === 'feriado_remunerado' ? 'bg-primary/10 text-primary' :
                            evo.attendanceStatus === 'feriado_nao_remunerado' ? 'bg-muted text-muted-foreground' :
                            'bg-destructive/10 text-destructive'
                          )}>
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
                        </div>
                        <div className="flex items-center gap-1 flex-wrap">
                          <Button variant="ghost" size="sm" className="gap-1 h-8 px-2 text-xs" onClick={() => setEditingEvolution(evo)}>
                            <Edit className="w-3 h-3" /> <span className="hidden sm:inline">Editar</span>
                          </Button>
                          <Button variant="outline" size="sm" className="gap-1 h-8 px-2 text-xs"
                            onClick={() => generateEvolutionPdf({ evolution: evo, patient, clinic, stamps })}>
                            <Download className="w-3 h-3" /> PDF
                          </Button>
                          <Button variant="ghost" size="sm" className="text-destructive h-8 px-2 text-xs" onClick={() => deleteEvolution(evo.id)}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-foreground whitespace-pre-wrap">{evo.text}</p>
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
                                  <a
                                    href={fileUrl}
                                    target="_blank" rel="noopener noreferrer"
                                    download={att.name}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs hover:bg-primary/20">
                                    {isImage ? <Image className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                                    <span className="max-w-[120px] truncate">{att.name}</span>
                                    <Download className="w-3 h-3" />
                                  </a>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {evo.signature && (
                        <div className="mt-3 flex items-center gap-2">
                          <span className="text-xs text-muted-foreground flex items-center gap-1"><PenLine className="w-3 h-3" /> Assinatura:</span>
                          <img src={evo.signature} alt="Assinatura" className="h-8 object-contain" />
                        </div>
                      )}
                      {evo.stampId && (() => {
                        const stamp = stamps.find(s => s.id === evo.stampId);
                        return stamp?.stamp_image ? (
                          <div className="mt-4 pt-3 border-t border-border/50">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                              <StampIcon className="w-3 h-3" /> {stamp.name} — {stamp.clinical_area}
                            </div>
                            <img src={stamp.stamp_image} alt="Carimbo" className="h-12 object-contain opacity-70" />
                          </div>
                        ) : stamp ? (
                          <div className="mt-4 pt-3 border-t border-border/50 text-xs text-muted-foreground flex items-center gap-1">
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
        </TabsContent>

        {/* Documents Tab - persisted */}
        <TabsContent value="documents">
          <div className="bg-card rounded-2xl p-6 shadow-lg border border-border space-y-6">
            <h2 className="font-bold text-foreground mb-4 flex items-center gap-2">
              <Paperclip className="w-5 h-5 text-primary" /> Documentos do Paciente
            </h2>
            <FileUpload parentType="patient" parentId={patient.id}
              existingFiles={patientDocsAsUploadedFiles}
              onUpload={handleDocUpload} onRemove={handleDocRemove}
              maxFiles={20} label="Anexe laudos, receitas, documentos e outros arquivos do paciente" />
            
            {/* Evolution attachments */}
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
            
            {/* AI Reports linked to this patient */}
            <PatientSavedReports patientId={patient.id} clinicName={clinic?.name} clinicAddress={clinic?.address || undefined} clinicLetterhead={clinic?.letterhead || undefined} clinicEmail={clinic?.email} clinicCnpj={clinic?.cnpj} clinicPhone={clinic?.phone} clinicServicesDescription={clinic?.servicesDescription} />
          </div>
        </TabsContent>

        {/* Tasks Tab - persisted */}
        <TabsContent value="tasks">
          <div className="bg-card rounded-2xl p-6 shadow-lg border border-border">
            <h2 className="font-bold text-foreground mb-4 flex items-center gap-2">
              <ListTodo className="w-5 h-5 text-primary" /> Tarefas do Paciente
            </h2>
            <div className="flex gap-2 mb-6">
              <Input value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Nova tarefa..." onKeyDown={(e) => e.key === 'Enter' && handleAddPatientTask()} />
              <Button onClick={handleAddPatientTask} disabled={!newTaskTitle.trim()} className="gap-2">
                <Plus className="w-4 h-4" /> Adicionar
              </Button>
            </div>
            {patientTasksList.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-5xl mb-3">📋</div>
                <p className="text-muted-foreground">Nenhuma tarefa cadastrada.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {patientTasksList.map(task => (
                  <div key={task.id} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50">
                    <button onClick={() => toggleTask(task.id)}
                      className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                        task.completed ? "bg-success border-success text-success-foreground" : "border-muted-foreground")}>
                      {task.completed && <CheckCircle2 className="w-3 h-3" />}
                    </button>
                    <span className={cn("flex-1 text-foreground", task.completed && "line-through text-muted-foreground")}>{task.title}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteTask(task.id)}>
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

      {/* Edit Patient Dialog */}
      <EditPatientDialog
        patient={patient}
        open={editPatientOpen}
        onOpenChange={setEditPatientOpen}
        onSave={updatePatient}
        clinicPackages={clinic ? getClinicPackages(clinic.id) : []}
      />

      {/* Delete Patient Dialog */}
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
            <AlertDialogAction
              onClick={() => {
                deletePatient(patient.id);
                toast.success('Paciente excluído!');
                handleBack();
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive Patient Dialog */}
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
            <AlertDialogAction
              onClick={() => {
                const newVal = !patient.isArchived;
                updatePatient(patient.id, { isArchived: newVal });
                toast.success(newVal ? 'Paciente arquivado' : 'Paciente reativado');
              }}
            >
              {patient.isArchived ? 'Reativar' : 'Arquivar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
