import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Users, Pencil, Archive, ArchiveRestore, Link2, Loader2, FileText, ListTodo, MessageSquare, Newspaper, Calendar, DollarSign, ClipboardList, UserCheck, PenLine, FolderOpen, Plus, Save, Wand2, Trash2, CheckCircle2, Circle, Upload, Download, X, Filter } from 'lucide-react';
import { generateMultipleEvolutionsPdf } from '@/utils/generateEvolutionPdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { GroupSessionTab } from '@/components/clinics/GroupSessionTab';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { PatientFeed } from '@/components/feed/PatientFeed';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface GroupData {
  id: string;
  name: string;
  clinic_id: string;
  description: string | null;
  therapeutic_focus: string | null;
  objectives: string | null;
  support_reason: string | null;
  shared_goals: string | null;
  communication_patterns: string | null;
  conflict_areas: string | null;
  meeting_frequency: string | null;
  duration_minutes: number | null;
  meeting_format: string | null;
  facilitation_style: string | null;
  open_to_new: boolean;
  max_participants: number | null;
  waitlist_policy: string | null;
  follow_up_plan: string | null;
  entry_criteria: string | null;
  exclusion_criteria: string | null;
  confidentiality_agreement: string | null;
  group_rules: string | null;
  materials: string | null;
  support_resources: string | null;
  assessment_method: string | null;
  next_topics: string | null;
  facilitation_notes: string | null;
  supervision_notes: string | null;
  general_notes: string | null;
  session_link: string | null;
  default_price: number | null;
  payment_type: string | null;
  package_id: string | null;
  financial_enabled: boolean;
  is_archived: boolean;
  created_at: string;
}

interface MemberPatient {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface MemberPaymentConfig {
  isPaying: boolean;
  memberPaymentValue: number | null;
}

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 py-2 border-b border-border last:border-0">
      <span className="text-sm font-medium text-muted-foreground sm:w-48 shrink-0">{label}</span>
      <span className="text-sm text-foreground whitespace-pre-wrap">{value || '—'}</span>
    </div>
  );
}

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [group, setGroup] = useState<GroupData | null>(null);
  const [members, setMembers] = useState<MemberPatient[]>([]);
  const [memberPaymentConfigs, setMemberPaymentConfigs] = useState<Record<string, MemberPaymentConfig>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('info');

  // Evolutions state
  const [evolutions, setEvolutions] = useState<any[]>([]);
  const [loadingEvos, setLoadingEvos] = useState(false);
  const [evoFilterMember, setEvoFilterMember] = useState('all');
  
  const [evoFilterStartDate, setEvoFilterStartDate] = useState<Date | undefined>(undefined);
  const [evoFilterEndDate, setEvoFilterEndDate] = useState<Date | undefined>(undefined);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);
  const [exportingEvos, setExportingEvos] = useState(false);
  const [stamps, setStamps] = useState<any[]>([]);

  // Group evolution form state
  const [showEvoForm, setShowEvoForm] = useState(false);
  const [evoDate, setEvoDate] = useState(new Date().toISOString().slice(0, 10));
  const [evoText, setEvoText] = useState('');
  const [evoStatus, setEvoStatus] = useState('presente');
  const [evoStatusMode, setEvoStatusMode] = useState<'same' | 'individual'>('same');
  const [evoIndividualStatus, setEvoIndividualStatus] = useState<Record<string, string>>({});
  const [evoSelectedMembers, setEvoSelectedMembers] = useState<Set<string>>(new Set());
  const [savingEvo, setSavingEvo] = useState(false);
  const [improvingEvo, setImprovingEvo] = useState(false);

  // Tasks state
  const [tasks, setTasks] = useState<any[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // Notes state
  const [notes, setNotes] = useState<any[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteCategory, setNewNoteCategory] = useState('general');

  // Documents state
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Financial state
  const [payments, setPayments] = useState<any[]>([]);
  const [loadingFinancial, setLoadingFinancial] = useState(false);
  const [clinicPackages, setClinicPackages] = useState<any[]>([]);

  // Mural state
  const [muralMember, setMuralMember] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    loadGroup();
  }, [id]);

  useEffect(() => {
    if (user) {
      supabase.from('stamps').select('*').eq('user_id', user.id).then(({ data }) => {
        if (data) setStamps(data);
      });
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === 'evolutions' && members.length > 0) loadEvolutions();
    if (activeTab === 'tasks') loadTasks();
    if (activeTab === 'notes') loadNotes();
    if (activeTab === 'documents') loadDocuments();
    if (activeTab === 'financial' && members.length > 0) loadFinancial();
    if (activeTab === 'mural' && members.length > 0 && !muralMember) setMuralMember(members[0]?.id || null);
  }, [activeTab, members]);

  const loadGroup = async () => {
    setLoading(true);
    const { data: g } = await supabase
      .from('therapeutic_groups')
      .select('*')
      .eq('id', id!)
      .single();
    if (!g) { setLoading(false); return; }
    setGroup(g as unknown as GroupData);

    // Load clinic packages
    const { data: pkgs } = await supabase
      .from('clinic_packages')
      .select('*')
      .eq('clinic_id', g.clinic_id)
      .eq('is_active', true)
      .order('name');
    if (pkgs) setClinicPackages(pkgs);

    const { data: memberRows } = await supabase
      .from('therapeutic_group_members')
      .select('patient_id, is_paying, member_payment_value')
      .eq('group_id', id!)
      .eq('status', 'active');

    if (memberRows && memberRows.length > 0) {
      const patientIds = memberRows.map((m: any) => m.patient_id);
      const { data: patients } = await supabase
        .from('patients')
        .select('id, name, avatar_url')
        .in('id', patientIds);
      if (patients) setMembers(patients as MemberPatient[]);

      // Build payment config map
      const configMap: Record<string, MemberPaymentConfig> = {};
      memberRows.forEach((m: any) => {
        configMap[m.patient_id] = {
          isPaying: m.is_paying ?? true,
          memberPaymentValue: m.member_payment_value ?? null,
        };
      });
      setMemberPaymentConfigs(configMap);
    }
    setLoading(false);
  };

  // ─── Evolutions ───
  const loadEvolutions = async () => {
    if (!user || members.length === 0) { setLoadingEvos(false); return; }
    setLoadingEvos(true);
    
    // Load only group evolutions
    const { data: groupEvos } = await supabase
      .from('evolutions')
      .select('*')
      .eq('group_id', id!)
      .order('date', { ascending: false })
      .limit(500);
    
    setEvolutions((groupEvos || []).map((e: any) => ({ ...e, _evoType: 'group' })));
    setLoadingEvos(false);
  };

  const filteredEvolutions = evolutions.filter(evo => {
    if (evoFilterMember !== 'all' && evo.patient_id !== evoFilterMember) return false;
    if (evoFilterStartDate && evo.date < format(evoFilterStartDate, 'yyyy-MM-dd')) return false;
    if (evoFilterEndDate && evo.date > format(evoFilterEndDate, 'yyyy-MM-dd')) return false;
    return true;
  });

  const handleExportFilteredEvolutions = async () => {
    if (filteredEvolutions.length === 0) { toast.error('Nenhuma evolução para exportar com os filtros selecionados'); return; }
    setExportingEvos(true);
    try {
      // Group by patient
      const byPatient: Record<string, any[]> = {};
      for (const evo of filteredEvolutions) {
        if (!byPatient[evo.patient_id]) byPatient[evo.patient_id] = [];
        byPatient[evo.patient_id].push(evo);
      }
      
      // Load clinic data
      let clinicData: any = null;
      if (group) {
        const { data: c } = await supabase.from('clinics').select('*').eq('id', group.clinic_id).single();
        clinicData = c;
      }
      
      for (const [patientId, patientEvos] of Object.entries(byPatient)) {
        const member = members.find(m => m.id === patientId);
        if (!member) continue;
        
        // Load full patient data for PDF
        const { data: fullPatient } = await supabase.from('patients').select('*').eq('id', patientId).single();
        if (!fullPatient) continue;
        
        const mappedPatient = {
          id: fullPatient.id,
          name: fullPatient.name,
          clinicId: fullPatient.clinic_id,
          birthdate: fullPatient.birthdate,
          clinicalArea: fullPatient.clinical_area,
          diagnosis: fullPatient.diagnosis,
          whatsapp: fullPatient.whatsapp,
          responsibleWhatsapp: fullPatient.responsible_whatsapp,
          isArchived: fullPatient.is_archived,
        } as any;
        
        const mappedEvos = patientEvos.map((e: any) => ({
          id: e.id,
          patientId: e.patient_id,
          clinicId: e.clinic_id,
          date: e.date,
          text: e.text,
          attendanceStatus: e.attendance_status,
          mood: e.mood,
          templateData: e.template_data,
          groupId: e.group_id,
          signature: e.signature,
          stampId: e.stamp_id,
        })) as any[];

        const mappedClinic = clinicData ? {
          id: clinicData.id,
          name: clinicData.name,
          address: clinicData.address,
          letterhead: clinicData.letterhead,
        } as any : undefined;
        
        await generateMultipleEvolutionsPdf({
          evolutions: mappedEvos,
          patient: mappedPatient,
          clinic: mappedClinic,
          stamps,
          startDate: evoFilterStartDate,
          endDate: evoFilterEndDate,
        });
      }
      
      toast.success(`PDF(s) exportados para ${Object.keys(byPatient).length} participante(s)!`);
    } catch (e: any) {
      toast.error('Erro ao exportar: ' + (e.message || ''));
    }
    setExportingEvos(false);
  };

  const initEvoForm = () => {
    setEvoDate(new Date().toISOString().slice(0, 10));
    setEvoText('');
    setEvoStatus('presente');
    setEvoStatusMode('same');
    setEvoIndividualStatus({});
    setEvoSelectedMembers(new Set(members.map(m => m.id)));
    setShowEvoForm(true);
  };

  const toggleMemberSelection = (memberId: string) => {
    setEvoSelectedMembers(prev => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

  const handleImproveEvoText = async () => {
    if (!evoText.trim()) return;
    setImprovingEvo(true);
    try {
      const res = await supabase.functions.invoke('improve-evolution', { body: { text: evoText } });
      if (res.data?.improved) setEvoText(res.data.improved);
      else toast.error('Não foi possível melhorar o texto');
    } catch { toast.error('Erro ao melhorar texto'); }
    setImprovingEvo(false);
  };

  const ATTENDANCE_OPTIONS = [
    { value: 'presente', label: 'Presente' },
    { value: 'falta', label: 'Falta' },
    { value: 'falta_remunerada', label: 'Falta remunerada' },
    { value: 'reposicao', label: 'Reposição' },
    { value: 'feriado_remunerado', label: 'Feriado remunerado' },
    { value: 'feriado_nao_remunerado', label: 'Feriado não remunerado' },
  ];

  const handleSaveGroupEvolution = async () => {
    if (!user || !group || evoSelectedMembers.size === 0) {
      toast.error('Selecione ao menos um participante'); return;
    }
    if (!evoText.trim() && evoStatus === 'presente') {
      toast.error('Preencha o texto da evolução'); return;
    }
    setSavingEvo(true);
    try {
      const selectedIds = Array.from(evoSelectedMembers);
      const isFaltaOrFeriado = (s: string) => ['falta', 'falta_remunerada', 'feriado_remunerado', 'feriado_nao_remunerado'].includes(s);
      const autoTexts: Record<string, string> = {
        falta: 'Paciente faltou à sessão de grupo.',
        falta_remunerada: 'Paciente faltou à sessão de grupo (falta remunerada).',
        feriado_remunerado: 'Feriado — sessão de grupo não realizada (remunerado).',
        feriado_nao_remunerado: 'Feriado — sessão de grupo não realizada.',
      };
      const rows = selectedIds.map(patientId => {
        const status = evoStatusMode === 'individual' ? (evoIndividualStatus[patientId] || 'presente') : evoStatus;
        const text = isFaltaOrFeriado(status) ? (autoTexts[status] || evoText) : evoText;
        return { patient_id: patientId, clinic_id: group.clinic_id, user_id: user.id, group_id: group.id, date: evoDate, text, attendance_status: status };
      });
      const { error } = await supabase.from('evolutions').insert(rows);
      if (error) throw error;
      toast.success(`Evolução registrada para ${selectedIds.length} participante(s)!`);
      setShowEvoForm(false);
      loadEvolutions();
    } catch (e: any) {
      toast.error('Erro ao salvar: ' + (e.message || ''));
    }
    setSavingEvo(false);
  };

  // ─── Tasks ───
  const loadTasks = async () => {
    if (!user) return;
    setLoadingTasks(true);
    const { data } = await (supabase.from('tasks')
      .select('*')
      .eq('user_id', user.id) as any)
      .eq('group_id', id!)
      .order('created_at', { ascending: false });
    if (data) setTasks(data);
    setLoadingTasks(false);
  };

  const addTask = async () => {
    if (!user || !newTaskTitle.trim()) return;
    await supabase.from('tasks').insert({ user_id: user.id, title: newTaskTitle, group_id: id } as any);
    setNewTaskTitle('');
    loadTasks();
  };

  const toggleTask = async (taskId: string, completed: boolean) => {
    await supabase.from('tasks').update({ completed: !completed }).eq('id', taskId);
    loadTasks();
  };

  const deleteTask = async (taskId: string) => {
    await supabase.from('tasks').delete().eq('id', taskId);
    loadTasks();
  };

  // ─── Notes ───
  const loadNotes = async () => {
    if (!user || !group) return;
    setLoadingNotes(true);
    const { data } = await (supabase.from('clinic_notes')
      .select('*')
      .eq('user_id', user.id) as any)
      .eq('group_id', id!)
      .order('created_at', { ascending: false });
    if (data) setNotes(data);
    setLoadingNotes(false);
  };

  const addNote = async () => {
    if (!user || !group || !newNoteText.trim()) return;
    await supabase.from('clinic_notes').insert({
      user_id: user.id,
      clinic_id: group.clinic_id,
      group_id: id,
      text: newNoteText,
      category: newNoteCategory,
    } as any);
    setNewNoteText('');
    loadNotes();
    toast.success('Nota adicionada');
  };

  const deleteNote = async (noteId: string) => {
    await supabase.from('clinic_notes').delete().eq('id', noteId);
    loadNotes();
    toast.success('Nota removida');
  };

  // ─── Documents ───
  const loadDocuments = async () => {
    if (!user) return;
    setLoadingDocs(true);
    const { data } = await supabase.from('attachments')
      .select('*')
      .eq('parent_id', id!)
      .eq('parent_type', 'group')
      .order('created_at', { ascending: false });
    if (data) setDocuments(data);
    setLoadingDocs(false);
  };

  const handleUploadDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    setUploadingDoc(true);
    try {
      const filePath = `group-docs/${id}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage.from('attachments').upload(filePath, file);
      if (uploadErr) throw uploadErr;
      await supabase.from('attachments').insert({
        user_id: user.id,
        parent_id: id!,
        parent_type: 'group',
        name: file.name,
        file_path: filePath,
        file_type: file.type,
        file_size: file.size,
      });
      toast.success('Documento enviado!');
      loadDocuments();
    } catch (err: any) {
      toast.error('Erro no upload: ' + (err.message || ''));
    }
    setUploadingDoc(false);
    e.target.value = '';
  };

  const downloadDoc = async (doc: any) => {
    const { data } = await supabase.storage.from('attachments').download(doc.file_path);
    if (data) {
      const url = URL.createObjectURL(data);
      const a = document.createElement('a'); a.href = url; a.download = doc.name; a.click();
      URL.revokeObjectURL(url);
    }
  };

  const deleteDoc = async (doc: any) => {
    await supabase.storage.from('attachments').remove([doc.file_path]);
    await supabase.from('attachments').delete().eq('id', doc.id);
    loadDocuments();
    toast.success('Documento removido');
  };

  // ─── Financial ───
  const loadFinancial = async () => {
    if (members.length === 0) return;
    setLoadingFinancial(true);
    const patientIds = members.map(m => m.id);
    const { data } = await supabase.from('patient_payment_records')
      .select('*')
      .in('patient_id', patientIds)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(200);
    if (data) setPayments(data);
    setLoadingFinancial(false);
  };

  // ─── Attendance ───
  const getAttendanceData = () => {
    const dates = [...new Set(evolutions.map(e => e.date))].sort().reverse().slice(0, 20);
    return { dates, grid: dates.map(d => ({
      date: d,
      members: members.map(m => {
        const evo = evolutions.find(e => e.date === d && e.patient_id === m.id);
        return { ...m, status: evo?.attendance_status || null };
      }),
    }))};
  };

  const toggleArchive = async () => {
    if (!group) return;
    await supabase.from('therapeutic_groups').update({ is_archived: !group.is_archived } as any).eq('id', group.id);
    toast.success(group.is_archived ? 'Grupo reativado' : 'Grupo arquivado');
    loadGroup();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Grupo não encontrado</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>
      </div>
    );
  }

  const tabs = [
    { value: 'info', label: 'Informações', icon: <ClipboardList className="w-4 h-4" /> },
    { value: 'session', label: 'Sessão', icon: <PenLine className="w-4 h-4" /> },
    { value: 'evolutions', label: 'Evoluções', icon: <FileText className="w-4 h-4" /> },
    { value: 'portal', label: 'Portal', icon: <UserCheck className="w-4 h-4" /> },
    { value: 'mural', label: 'Mural', icon: <Newspaper className="w-4 h-4" /> },
    { value: 'tasks', label: 'Tarefas', icon: <ListTodo className="w-4 h-4" /> },
    { value: 'notes', label: 'Notas', icon: <MessageSquare className="w-4 h-4" /> },
    { value: 'attendance', label: 'Frequência', icon: <Calendar className="w-4 h-4" /> },
    { value: 'documents', label: 'Documentos', icon: <FolderOpen className="w-4 h-4" /> },
    ...(group.financial_enabled ? [{ value: 'financial', label: 'Financeiro', icon: <DollarSign className="w-4 h-4" /> }] : []),
  ];

  const attendanceData = getAttendanceData();
  const statusColors: Record<string, string> = {
    presente: 'bg-green-500',
    falta: 'bg-destructive',
    falta_remunerada: 'bg-orange-400',
    reposicao: 'bg-blue-400',
    feriado_remunerado: 'bg-yellow-400',
    feriado_nao_remunerado: 'bg-muted',
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" className="self-start -ml-2" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground">{group.name}</h1>
                {group.is_archived && <Badge variant="secondary">Arquivado</Badge>}
              </div>
              {group.therapeutic_focus && (
                <p className="text-sm text-muted-foreground">{group.therapeutic_focus}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {group.session_link && (
              <Button variant="outline" size="sm" onClick={() => window.open(group.session_link!, '_blank')}>
                <Link2 className="w-4 h-4 mr-1" /> Sessão online
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={toggleArchive}>
              {group.is_archived ? <ArchiveRestore className="w-4 h-4 mr-1" /> : <Archive className="w-4 h-4 mr-1" />}
              {group.is_archived ? 'Reativar' : 'Arquivar'}
            </Button>
          </div>
        </div>

        {/* Participants chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-muted-foreground">Participantes:</span>
          {members.length === 0 ? (
            <span className="text-sm text-muted-foreground">Nenhum participante</span>
          ) : (
            members.map(m => (
              <Link key={m.id} to={`/patients/${m.id}`}>
                <Badge variant="secondary" className="cursor-pointer hover:bg-accent transition-colors gap-1">
                  {m.name}
                </Badge>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent p-0">
          {tabs.map(t => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-3 py-1.5 text-xs gap-1.5"
            >
              {t.icon}
              <span className="hidden sm:inline">{t.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ═══ Info Tab ═══ */}
        <TabsContent value="info" className="mt-4 space-y-4">
          <Accordion type="multiple" defaultValue={['overview', 'structure', 'criteria', 'tracking']} className="space-y-3">
            <AccordionItem value="overview" className="border rounded-xl px-4">
              <AccordionTrigger className="text-base font-semibold">Visão geral</AccordionTrigger>
              <AccordionContent>
                <InfoRow label="Descrição" value={group.description} />
                <InfoRow label="Foco terapêutico" value={group.therapeutic_focus} />
                <InfoRow label="Objetivos" value={group.objectives} />
                <InfoRow label="Motivo do suporte" value={group.support_reason} />
                <InfoRow label="Metas compartilhadas" value={group.shared_goals} />
                <InfoRow label="Padrões de comunicação" value={group.communication_patterns} />
                <InfoRow label="Áreas de conflito" value={group.conflict_areas} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="structure" className="border rounded-xl px-4">
              <AccordionTrigger className="text-base font-semibold">Estrutura</AccordionTrigger>
              <AccordionContent>
                <InfoRow label="Frequência dos encontros" value={group.meeting_frequency} />
                <InfoRow label="Duração (min)" value={group.duration_minutes} />
                <InfoRow label="Formato do encontro" value={group.meeting_format} />
                <InfoRow label="Estilo de facilitação" value={group.facilitation_style} />
                <InfoRow label="Grupo aberto" value={group.open_to_new ? 'Sim' : 'Não'} />
                <InfoRow label="Máximo de participantes" value={group.max_participants} />
                <InfoRow label="Política de lista de espera" value={group.waitlist_policy} />
                <InfoRow label="Plano de acompanhamento" value={group.follow_up_plan} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="criteria" className="border rounded-xl px-4">
              <AccordionTrigger className="text-base font-semibold">Critérios e combinados</AccordionTrigger>
              <AccordionContent>
                <InfoRow label="Critérios de entrada" value={group.entry_criteria} />
                <InfoRow label="Critérios de exclusão" value={group.exclusion_criteria} />
                <InfoRow label="Confidencialidade" value={group.confidentiality_agreement} />
                <InfoRow label="Regras do grupo" value={group.group_rules} />
                <InfoRow label="Materiais" value={group.materials} />
                <InfoRow label="Recursos de apoio" value={group.support_resources} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="tracking" className="border rounded-xl px-4">
              <AccordionTrigger className="text-base font-semibold">Acompanhamento</AccordionTrigger>
              <AccordionContent>
                <InfoRow label="Método de avaliação" value={group.assessment_method} />
                <InfoRow label="Próximos tópicos" value={group.next_topics} />
                <InfoRow label="Notas da facilitação" value={group.facilitation_notes} />
                <InfoRow label="Notas de supervisão" value={group.supervision_notes} />
                <InfoRow label="Observações gerais" value={group.general_notes} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Financial toggle & pricing */}
          <div className="bg-card border rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Módulo financeiro</p>
                <p className="text-xs text-muted-foreground">Habilite para acompanhar pagamentos dos participantes do grupo</p>
              </div>
              <Switch
                checked={group.financial_enabled}
                onCheckedChange={async (checked) => {
                  await supabase.from('therapeutic_groups').update({ financial_enabled: checked } as any).eq('id', group.id);
                  setGroup(prev => prev ? { ...prev, financial_enabled: checked } : prev);
                  toast.success(checked ? 'Financeiro habilitado' : 'Financeiro desabilitado');
                }}
              />
            </div>
            {group.financial_enabled && (
              <div className="space-y-4 pt-2 border-t border-border">
                {/* Payment type selector */}
                <div>
                  <Label className="text-sm font-medium">Tipo de cobrança</Label>
                  <Select
                    value={group.payment_type || 'por_sessao'}
                    onValueChange={async (val) => {
                      const updates: any = { payment_type: val };
                      if (val === 'pacote') {
                        // keep package_id
                      } else {
                        updates.package_id = null;
                      }
                      await supabase.from('therapeutic_groups').update(updates).eq('id', group.id);
                      setGroup(prev => prev ? { ...prev, payment_type: val, ...(val !== 'pacote' ? { package_id: null } : {}) } : prev);
                    }}
                  >
                    <SelectTrigger className="mt-1 max-w-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="por_sessao">Por Sessão</SelectItem>
                      <SelectItem value="mensal">Mensal</SelectItem>
                      <SelectItem value="pacote">Pacote</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Package selector (when type is pacote) */}
                {group.payment_type === 'pacote' && (
                  <div>
                    <Label className="text-sm font-medium">Pacote da clínica</Label>
                    {clinicPackages.length === 0 ? (
                      <p className="text-xs text-muted-foreground mt-1">Nenhum pacote ativo nesta clínica. Crie pacotes na página da clínica.</p>
                    ) : (
                      <Select
                        value={group.package_id || ''}
                        onValueChange={async (val) => {
                          const pkg = clinicPackages.find(p => p.id === val);
                          const updates: any = { package_id: val, default_price: pkg?.price ?? group.default_price };
                          await supabase.from('therapeutic_groups').update(updates).eq('id', group.id);
                          setGroup(prev => prev ? { ...prev, package_id: val, default_price: pkg?.price ?? prev.default_price } : prev);
                        }}
                      >
                        <SelectTrigger className="mt-1 max-w-xs">
                          <SelectValue placeholder="Selecione um pacote" />
                        </SelectTrigger>
                        <SelectContent>
                          {clinicPackages.map(pkg => (
                            <SelectItem key={pkg.id} value={pkg.id}>
                              {pkg.name} — R$ {Number(pkg.price).toFixed(2)}
                              {pkg.session_limit ? ` (${pkg.session_limit} sessões)` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {group.package_id && (() => {
                      const pkg = clinicPackages.find(p => p.id === group.package_id);
                      if (!pkg || !pkg.session_limit) return null;
                      const perSession = (Number(pkg.price) / pkg.session_limit).toFixed(2);
                      return (
                        <p className="text-xs text-muted-foreground mt-1.5">
                          Valor por sessão: R$ {perSession} ({pkg.session_limit} sessões)
                        </p>
                      );
                    })()}
                  </div>
                )}

                {/* Fixed price (for por_sessao and mensal) */}
                {(group.payment_type !== 'pacote') && (
                  <div>
                    <Label className="text-sm font-medium">
                      {group.payment_type === 'mensal' ? 'Valor mensal do grupo (R$)' : 'Valor por sessão do grupo (R$)'}
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={group.default_price ?? ''}
                      onChange={(e) => {
                        const val = e.target.value ? parseFloat(e.target.value) : null;
                        setGroup(prev => prev ? { ...prev, default_price: val } : prev);
                      }}
                      onBlur={async () => {
                        await supabase.from('therapeutic_groups').update({ default_price: group.default_price } as any).eq('id', group.id);
                      }}
                      className="mt-1 max-w-xs"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ═══ Session Tab ═══ */}
        <TabsContent value="session" className="mt-4">
          <GroupSessionTab groupId={group.id} groupName={group.name} clinicId={group.clinic_id} members={members} />
        </TabsContent>

        {/* ═══ Evolutions Tab ═══ */}
        <TabsContent value="evolutions" className="mt-4 space-y-4">
          {/* Filters */}
          <div className="bg-card border rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Filter className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Filtros</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Member filter */}
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Participante</Label>
                <Select value={evoFilterMember} onValueChange={setEvoFilterMember}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os participantes</SelectItem>
                    {members.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>


              {/* Start date */}
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Data início</Label>
                <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full h-9 justify-start text-sm font-normal', !evoFilterStartDate && 'text-muted-foreground')}>
                      <Calendar className="w-3.5 h-3.5 mr-2" />
                      {evoFilterStartDate ? format(evoFilterStartDate, 'dd/MM/yyyy') : 'Sem limite'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={evoFilterStartDate}
                      onSelect={(d) => { setEvoFilterStartDate(d || undefined); setStartDateOpen(false); }}
                      locale={ptBR}
                      className="p-3 pointer-events-auto"
                    />
                    {evoFilterStartDate && (
                      <div className="p-2 border-t border-border">
                        <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => { setEvoFilterStartDate(undefined); setStartDateOpen(false); }}>
                          Limpar data
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>

              {/* End date */}
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Data fim</Label>
                <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full h-9 justify-start text-sm font-normal', !evoFilterEndDate && 'text-muted-foreground')}>
                      <Calendar className="w-3.5 h-3.5 mr-2" />
                      {evoFilterEndDate ? format(evoFilterEndDate, 'dd/MM/yyyy') : 'Sem limite'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={evoFilterEndDate}
                      onSelect={(d) => { setEvoFilterEndDate(d || undefined); setEndDateOpen(false); }}
                      locale={ptBR}
                      className="p-3 pointer-events-auto"
                    />
                    {evoFilterEndDate && (
                      <div className="p-2 border-t border-border">
                        <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => { setEvoFilterEndDate(undefined); setEndDateOpen(false); }}>
                          Limpar data
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground">
                {filteredEvolutions.length} evolução(ões) encontrada(s)
              </p>
              <div className="flex gap-2">
                {(evoFilterMember !== 'all' || evoFilterStartDate || evoFilterEndDate) && (
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => {
                    setEvoFilterMember('all');
                    setEvoFilterStartDate(undefined);
                    setEvoFilterEndDate(undefined);
                  }}>
                    <X className="w-3 h-3 mr-1" /> Limpar filtros
                  </Button>
                )}
                <Button
                  size="sm"
                  className="gap-2 h-8"
                  onClick={handleExportFilteredEvolutions}
                  disabled={exportingEvos || filteredEvolutions.length === 0}
                >
                  {exportingEvos ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Baixar PDF
                </Button>
              </div>
            </div>
          </div>

          {/* New evolution form */}
          {!showEvoForm && (
            <Button onClick={initEvoForm} className="gap-2">
              <Plus className="w-4 h-4" /> Nova evolução em grupo
            </Button>
          )}

          {showEvoForm && (
            <div className="bg-card border rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Registrar evolução do grupo</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowEvoForm(false)}><Trash2 className="w-4 h-4" /></Button>
              </div>
              <div>
                <Label className="text-sm font-medium">Data</Label>
                <Input type="date" value={evoDate} onChange={e => setEvoDate(e.target.value)} className="mt-1 max-w-xs" />
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Participantes</Label>
                <div className="flex flex-wrap gap-2">
                  {members.map(m => (
                    <label key={m.id} className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors",
                      evoSelectedMembers.has(m.id) ? "bg-primary/10 border-primary text-foreground" : "bg-card border-border text-muted-foreground"
                    )}>
                      <Checkbox checked={evoSelectedMembers.has(m.id)} onCheckedChange={() => toggleMemberSelection(m.id)} />
                      {m.name}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Status de presença</Label>
                <div className="flex gap-2 mb-2">
                  <Button size="sm" variant={evoStatusMode === 'same' ? 'default' : 'outline'} onClick={() => setEvoStatusMode('same')}>Mesmo para todos</Button>
                  <Button size="sm" variant={evoStatusMode === 'individual' ? 'default' : 'outline'} onClick={() => setEvoStatusMode('individual')}>Individual</Button>
                </div>
                {evoStatusMode === 'same' ? (
                  <Select value={evoStatus} onValueChange={setEvoStatus}>
                    <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ATTENDANCE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="space-y-2">
                    {members.filter(m => evoSelectedMembers.has(m.id)).map(m => (
                      <div key={m.id} className="flex items-center gap-3">
                        <span className="text-sm w-40 truncate">{m.name}</span>
                        <Select value={evoIndividualStatus[m.id] || 'presente'} onValueChange={v => setEvoIndividualStatus(prev => ({ ...prev, [m.id]: v }))}>
                          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ATTENDANCE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-sm font-medium">Texto da evolução</Label>
                  <Button variant="ghost" size="sm" className="gap-1 text-xs h-7" onClick={handleImproveEvoText} disabled={improvingEvo || !evoText.trim()}>
                    {improvingEvo ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                    Melhorar com IA
                  </Button>
                </div>
                <Textarea placeholder="Descreva a sessão em grupo..." value={evoText} onChange={e => setEvoText(e.target.value)} rows={6} />
                <p className="text-xs text-muted-foreground mt-1">Texto compartilhado para presentes. Para faltas/feriados, texto automático.</p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowEvoForm(false)}>Cancelar</Button>
                <Button onClick={handleSaveGroupEvolution} disabled={savingEvo} className="gap-2">
                  {savingEvo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar para {evoSelectedMembers.size} participante(s)
                </Button>
              </div>
            </div>
          )}

          {/* Evolutions list */}
          {loadingEvos ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : filteredEvolutions.length === 0 && !showEvoForm ? (
            <div className="text-center py-12">
              <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">Nenhuma evolução encontrada com os filtros selecionados</p>
            </div>
          ) : filteredEvolutions.length > 0 ? (
            <div className="space-y-3">
              {Object.entries(
                filteredEvolutions.reduce((acc, evo) => {
                  const d = evo.date;
                  if (!acc[d]) acc[d] = [];
                  acc[d].push(evo);
                  return acc;
                }, {} as Record<string, any[]>)
              ).map(([date, evosByDate]) => (
                <div key={date} className="bg-card border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">
                      {new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                    </span>
                    <Badge variant="outline" className="text-xs">{(evosByDate as any[]).length} registro(s)</Badge>
                  </div>
                  <div className="space-y-2">
                    {(evosByDate as any[]).map((evo: any) => {
                      const patient = members.find(m => m.id === evo.patient_id);
                      return (
                        <div key={evo.id} className="flex items-start gap-3 pl-2 border-l-2 border-primary/20 py-1">
                          <Badge variant="outline" className="text-xs shrink-0">{patient?.name || 'Paciente'}</Badge>
                          <Badge variant={evo.attendance_status === 'presente' ? 'default' : 'secondary'} className="text-xs shrink-0">
                            {evo.attendance_status}
                          </Badge>
                          {evo.text && <p className="text-sm text-muted-foreground line-clamp-2">{evo.text}</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </TabsContent>

        {/* ═══ Portal Tab ═══ */}
        <TabsContent value="portal" className="mt-4">
          <div className="space-y-3">
            {members.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum participante no grupo</p>
            ) : (
              members.map(m => (
                <Link key={m.id} to={`/patients/${m.id}`} className="block">
                  <div className="bg-card border rounded-xl p-4 hover:bg-accent/50 transition-colors flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-foreground">{m.name}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">Ver portal →</Badge>
                  </div>
                </Link>
              ))
            )}
          </div>
        </TabsContent>

        {/* ═══ Mural Tab ═══ */}
        <TabsContent value="mural" className="mt-4 space-y-4">
          {members.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum participante</p>
          ) : (
            <>
              <div className="flex gap-2 flex-wrap">
                {members.map(m => (
                  <Button
                    key={m.id}
                    size="sm"
                    variant={muralMember === m.id ? 'default' : 'outline'}
                    onClick={() => setMuralMember(m.id)}
                    className="text-xs"
                  >
                    {m.name}
                  </Button>
                ))}
              </div>
              {muralMember && user && (
                <PatientFeed
                  patientId={muralMember}
                  therapistId={user.id}
                  isTherapist={true}
                  currentUserId={user.id}
                  currentUserName=""
                />
              )}
            </>
          )}
        </TabsContent>

        {/* ═══ Tasks Tab ═══ */}
        <TabsContent value="tasks" className="mt-4 space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Nova tarefa do grupo..."
              value={newTaskTitle}
              onChange={e => setNewTaskTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTask()}
              className="flex-1"
            />
            <Button onClick={addTask} disabled={!newTaskTitle.trim()} className="gap-1">
              <Plus className="w-4 h-4" /> Adicionar
            </Button>
          </div>

          {loadingTasks ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12">
              <ListTodo className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">Nenhuma tarefa do grupo</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map(task => (
                <div key={task.id} className="flex items-center gap-3 bg-card border rounded-xl p-3">
                  <button onClick={() => toggleTask(task.id, task.completed)} className="shrink-0">
                    {task.completed
                      ? <CheckCircle2 className="w-5 h-5 text-primary" />
                      : <Circle className="w-5 h-5 text-muted-foreground" />}
                  </button>
                  <span className={cn("flex-1 text-sm", task.completed && "line-through text-muted-foreground")}>
                    {task.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(task.created_at).toLocaleDateString('pt-BR')}
                  </span>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => deleteTask(task.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ═══ Notes Tab ═══ */}
        <TabsContent value="notes" className="mt-4 space-y-4">
          <div className="bg-card border rounded-xl p-4 space-y-3">
            <div className="flex gap-2">
              <Select value={newNoteCategory} onValueChange={setNewNoteCategory}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">Geral</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                  <SelectItem value="protocol">Protocolo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Textarea placeholder="Escreva uma nota do grupo..." value={newNoteText} onChange={e => setNewNoteText(e.target.value)} rows={3} />
            <Button onClick={addNote} disabled={!newNoteText.trim()} className="gap-1">
              <Plus className="w-4 h-4" /> Adicionar nota
            </Button>
          </div>

          {loadingNotes ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : notes.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">Nenhuma nota do grupo</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map(note => (
                <div key={note.id} className="bg-card border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant={note.category === 'urgent' ? 'destructive' : note.category === 'protocol' ? 'default' : 'secondary'} className="text-xs">
                      {note.category === 'urgent' ? 'Urgente' : note.category === 'protocol' ? 'Protocolo' : 'Geral'}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{new Date(note.created_at).toLocaleDateString('pt-BR')}</span>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => deleteNote(note.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{note.text}</p>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ═══ Attendance Tab ═══ */}
        <TabsContent value="attendance" className="mt-4 space-y-4">
          {evolutions.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">Registre evoluções para ver a frequência</p>
            </div>
          ) : (
            <>
              {/* Legend */}
              <div className="flex flex-wrap gap-3 text-xs">
                {ATTENDANCE_OPTIONS.map(o => (
                  <div key={o.value} className="flex items-center gap-1.5">
                    <div className={cn("w-3 h-3 rounded-full", statusColors[o.value])} />
                    <span className="text-muted-foreground">{o.label}</span>
                  </div>
                ))}
              </div>

              {/* Grid */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left p-2 text-muted-foreground font-medium border-b border-border">Participante</th>
                      {attendanceData.dates.map(d => (
                        <th key={d} className="p-2 text-center text-muted-foreground font-medium border-b border-border whitespace-nowrap">
                          {new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {members.map(m => (
                      <tr key={m.id} className="border-b border-border">
                        <td className="p-2 font-medium text-foreground whitespace-nowrap">{m.name}</td>
                        {attendanceData.dates.map(d => {
                          const evo = evolutions.find(e => e.date === d && e.patient_id === m.id);
                          const status = evo?.attendance_status;
                          return (
                            <td key={d} className="p-2 text-center">
                              {status ? (
                                <div className={cn("w-4 h-4 rounded-full mx-auto", statusColors[status] || 'bg-muted')} title={status} />
                              ) : (
                                <div className="w-4 h-4 rounded-full mx-auto border border-border" title="Sem registro" />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {members.map(m => {
                  const memberEvos = evolutions.filter(e => e.patient_id === m.id);
                  const presentes = memberEvos.filter(e => e.attendance_status === 'presente').length;
                  const total = memberEvos.length;
                  const pct = total > 0 ? Math.round((presentes / total) * 100) : 0;
                  return (
                    <div key={m.id} className="bg-card border rounded-xl p-3">
                      <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                      <p className="text-2xl font-bold text-primary">{pct}%</p>
                      <p className="text-xs text-muted-foreground">{presentes}/{total} presenças</p>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </TabsContent>

        {/* ═══ Documents Tab ═══ */}
        <TabsContent value="documents" className="mt-4 space-y-4">
          <div>
            <label className="cursor-pointer">
              <Button asChild variant="outline" className="gap-2" disabled={uploadingDoc}>
                <span>
                  {uploadingDoc ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Enviar documento
                </span>
              </Button>
              <input type="file" className="hidden" onChange={handleUploadDoc} />
            </label>
          </div>

          {loadingDocs ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : documents.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">Nenhum documento do grupo</p>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map(doc => (
                <div key={doc.id} className="flex items-center gap-3 bg-card border rounded-xl p-3">
                  <FileText className="w-5 h-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                      {doc.file_size && ` · ${(doc.file_size / 1024).toFixed(0)} KB`}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => downloadDoc(doc)}>
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => deleteDoc(doc)}>
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ═══ Financial Tab ═══ */}
        <TabsContent value="financial" className="mt-4 space-y-4">
          {loadingFinancial ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : members.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum participante</p>
          ) : (
            <>
              {/* Financial summary per member */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {members.map(m => {
                  const memberPayments = payments.filter(p => p.patient_id === m.id);
                  const totalPaid = memberPayments.filter(p => p.paid).reduce((s, p) => s + Number(p.amount), 0);
                  const totalPending = memberPayments.filter(p => !p.paid).reduce((s, p) => s + Number(p.amount), 0);
                  return (
                    <div key={m.id} className="bg-card border rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                          {m.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-foreground text-sm">{m.name}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Pago</p>
                          <p className="text-lg font-bold text-primary">R$ {totalPaid.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Pendente</p>
                          <p className="text-lg font-bold text-destructive">R$ {totalPending.toFixed(2)}</p>
                        </div>
                      </div>
                      <Link to={`/patients/${m.id}`}>
                        <Button variant="outline" size="sm" className="mt-3 w-full text-xs">Ver detalhes →</Button>
                      </Link>
                    </div>
                  );
                })}
              </div>

              {/* Recent payments */}
              {payments.length > 0 && (
                <div className="bg-card border rounded-xl p-4">
                  <h3 className="font-semibold text-foreground mb-3">Últimos registros</h3>
                  <div className="space-y-2">
                    {payments.slice(0, 20).map(p => {
                      const patient = members.find(m => m.id === p.patient_id);
                      return (
                        <div key={p.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">{patient?.name || 'Paciente'}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {String(p.month).padStart(2, '0')}/{p.year}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground">R$ {Number(p.amount).toFixed(2)}</span>
                            <Badge variant={p.paid ? 'default' : 'destructive'} className="text-xs">
                              {p.paid ? 'Pago' : 'Pendente'}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {payments.length === 0 && (
                <div className="text-center py-8">
                  <DollarSign className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">Nenhum registro financeiro dos participantes</p>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
