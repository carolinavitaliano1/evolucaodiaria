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

        <TabsContent value="evolutions" className="mt-4 space-y-4">
          {/* New evolution button */}
          {!showEvoForm && (
            <Button onClick={initEvoForm} className="gap-2">
              <Plus className="w-4 h-4" /> Nova evolução em grupo
            </Button>
          )}

          {/* Group evolution form */}
          {showEvoForm && (
            <div className="bg-card border rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Registrar evolução do grupo</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowEvoForm(false)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              {/* Date */}
              <div>
                <Label className="text-sm font-medium">Data</Label>
                <Input type="date" value={evoDate} onChange={e => setEvoDate(e.target.value)} className="mt-1 max-w-xs" />
              </div>

              {/* Participants */}
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

              {/* Attendance status */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Status de presença</Label>
                <div className="flex gap-2 mb-2">
                  <Button size="sm" variant={evoStatusMode === 'same' ? 'default' : 'outline'} onClick={() => setEvoStatusMode('same')}>
                    Mesmo para todos
                  </Button>
                  <Button size="sm" variant={evoStatusMode === 'individual' ? 'default' : 'outline'} onClick={() => setEvoStatusMode('individual')}>
                    Individual
                  </Button>
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

              {/* Evolution text */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-sm font-medium">Texto da evolução</Label>
                  <Button variant="ghost" size="sm" className="gap-1 text-xs h-7" onClick={handleImproveEvoText} disabled={improvingEvo || !evoText.trim()}>
                    {improvingEvo ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                    Melhorar com IA
                  </Button>
                </div>
                <Textarea
                  placeholder="Descreva a sessão em grupo, dinâmicas, observações clínicas..."
                  value={evoText}
                  onChange={e => setEvoText(e.target.value)}
                  rows={6}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  O mesmo texto será registrado para todos os participantes com status "presente". Para faltas/feriados, um texto automático será usado.
                </p>
              </div>

              {/* Save */}
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
          ) : evolutions.length === 0 && !showEvoForm ? (
            <div className="text-center py-12">
              <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">Nenhuma evolução registrada neste grupo</p>
            </div>
          ) : evolutions.length > 0 ? (
            <div className="space-y-3">
              {/* Group evolutions by date */}
              {Object.entries(
                evolutions.reduce((acc, evo) => {
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
