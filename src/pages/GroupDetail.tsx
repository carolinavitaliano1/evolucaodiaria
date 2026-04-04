import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Users, Pencil, Archive, ArchiveRestore, Link2, Loader2, FileText, ListTodo, MessageSquare, Newspaper, Calendar, DollarSign, ClipboardList, UserCheck, PenLine, FolderOpen, Plus, Save, Wand2, Trash2 } from 'lucide-react';
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
  is_archived: boolean;
  created_at: string;
}

interface MemberPatient {
  id: string;
  name: string;
  avatar_url: string | null;
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
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('info');

  // Evolutions state
  const [evolutions, setEvolutions] = useState<any[]>([]);
  const [loadingEvos, setLoadingEvos] = useState(false);

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

  useEffect(() => {
    if (!id) return;
    loadGroup();
  }, [id]);

  useEffect(() => {
    if (activeTab === 'evolutions' && members.length > 0) {
      loadEvolutions();
    }
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

    // Load members
    const { data: memberRows } = await supabase
      .from('therapeutic_group_members')
      .select('patient_id')
      .eq('group_id', id!)
      .eq('status', 'active');

    if (memberRows && memberRows.length > 0) {
      const patientIds = memberRows.map((m: any) => m.patient_id);
      const { data: patients } = await supabase
        .from('patients')
        .select('id, name, avatar_url')
        .in('id', patientIds);
      if (patients) setMembers(patients as MemberPatient[]);
    }
    setLoading(false);
  };

  const loadEvolutions = async () => {
    if (members.length === 0) return;
    setLoadingEvos(true);
    const { data } = await supabase
      .from('evolutions')
      .select('*')
      .eq('group_id', id!)
      .order('date', { ascending: false })
      .limit(100);
    if (data) setEvolutions(data);
    setLoadingEvos(false);
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
      toast.error('Selecione ao menos um participante');
      return;
    }
    if (!evoText.trim() && evoStatus === 'presente') {
      toast.error('Preencha o texto da evolução');
      return;
    }

    setSavingEvo(true);
    try {
      const selectedIds = Array.from(evoSelectedMembers);
      const isFaltaOrFeriado = (status: string) => ['falta', 'falta_remunerada', 'feriado_remunerado', 'feriado_nao_remunerado'].includes(status);
      const autoTexts: Record<string, string> = {
        falta: 'Paciente faltou à sessão de grupo.',
        falta_remunerada: 'Paciente faltou à sessão de grupo (falta remunerada).',
        feriado_remunerado: 'Feriado — sessão de grupo não realizada (remunerado).',
        feriado_nao_remunerado: 'Feriado — sessão de grupo não realizada.',
      };

      const rows = selectedIds.map(patientId => {
        const status = evoStatusMode === 'individual' ? (evoIndividualStatus[patientId] || 'presente') : evoStatus;
        const text = isFaltaOrFeriado(status) ? (autoTexts[status] || evoText) : evoText;
        return {
          patient_id: patientId,
          clinic_id: group.clinic_id,
          user_id: user.id,
          group_id: group.id,
          date: evoDate,
          text,
          attendance_status: status,
        };
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
    { value: 'financial', label: 'Financeiro', icon: <DollarSign className="w-4 h-4" /> },
  ];

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

        {/* Info Tab */}
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

          {group.default_price != null && (
            <div className="bg-card border rounded-xl p-4">
              <span className="text-sm font-medium text-muted-foreground">Preço padrão por paciente: </span>
              <span className="text-sm font-semibold text-foreground">R$ {Number(group.default_price).toFixed(2)}</span>
            </div>
          )}
        </TabsContent>

        {/* Session Tab */}
        <TabsContent value="session" className="mt-4">
          <GroupSessionTab
            groupId={group.id}
            groupName={group.name}
            clinicId={group.clinic_id}
            members={members}
          />
        </TabsContent>

        <TabsContent value="evolutions" className="mt-4">
          {loadingEvos ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : evolutions.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">Nenhuma evolução registrada para os participantes deste grupo</p>
            </div>
          ) : (
            <div className="space-y-3">
              {evolutions.map(evo => {
                const patient = members.find(m => m.id === evo.patient_id);
                return (
                  <div key={evo.id} className="bg-card border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{patient?.name || 'Paciente'}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(evo.date).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <Badge variant={evo.attendance_status === 'presente' ? 'default' : 'secondary'} className="text-xs">
                        {evo.attendance_status}
                      </Badge>
                    </div>
                    {evo.text && <p className="text-sm text-foreground line-clamp-3 mt-1">{evo.text}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Portal Tab */}
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

        {/* Mural Tab */}
        <TabsContent value="mural" className="mt-4">
          <div className="text-center py-12">
            <Newspaper className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">Mural do grupo — em breve</p>
            <p className="text-xs text-muted-foreground mt-1">Posts do mural vinculados aos participantes serão exibidos aqui</p>
          </div>
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="mt-4">
          <div className="text-center py-12">
            <ListTodo className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">Tarefas do grupo — em breve</p>
          </div>
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes" className="mt-4">
          <div className="text-center py-12">
            <MessageSquare className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">Notas do grupo — em breve</p>
          </div>
        </TabsContent>

        {/* Attendance Tab */}
        <TabsContent value="attendance" className="mt-4">
          <div className="text-center py-12">
            <Calendar className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">Frequência do grupo — em breve</p>
          </div>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="mt-4">
          <div className="text-center py-12">
            <FolderOpen className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">Documentos do grupo — em breve</p>
          </div>
        </TabsContent>

        {/* Financial Tab */}
        <TabsContent value="financial" className="mt-4">
          <div className="text-center py-12">
            <DollarSign className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">Financeiro do grupo — em breve</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
