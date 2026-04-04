import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Plus, Users, Archive, ArchiveRestore, Pencil, X, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface Patient {
  id: string;
  name: string;
}

interface TherapeuticGroup {
  id: string;
  name: string;
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

interface TherapeuticGroupsTabProps {
  clinicId: string;
  patients: Patient[];
}

const emptyForm = (): Partial<TherapeuticGroup> & { name: string } => ({
  name: '',
  description: null,
  therapeutic_focus: null,
  objectives: null,
  support_reason: null,
  shared_goals: null,
  communication_patterns: null,
  conflict_areas: null,
  meeting_frequency: null,
  duration_minutes: null,
  meeting_format: null,
  facilitation_style: null,
  open_to_new: false,
  max_participants: null,
  waitlist_policy: null,
  follow_up_plan: null,
  entry_criteria: null,
  exclusion_criteria: null,
  confidentiality_agreement: null,
  group_rules: null,
  materials: null,
  support_resources: null,
  assessment_method: null,
  next_topics: null,
  facilitation_notes: null,
  supervision_notes: null,
  general_notes: null,
  session_link: null,
  default_price: null,
  is_archived: false,
});

export function TherapeuticGroupsTab({ clinicId, patients }: TherapeuticGroupsTabProps) {
  const { user } = useAuth();
  const [groups, setGroups] = useState<TherapeuticGroup[]>([]);
  const [members, setMembers] = useState<Record<string, string[]>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [selectedPatients, setSelectedPatients] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const loadGroups = async () => {
    const { data } = await supabase
      .from('therapeutic_groups')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false });
    if (data) setGroups(data as unknown as TherapeuticGroup[]);

    const { data: membersData } = await supabase
      .from('therapeutic_group_members')
      .select('group_id, patient_id')
      .eq('status', 'active');
    if (membersData) {
      const map: Record<string, string[]> = {};
      membersData.forEach((m: any) => {
        if (!map[m.group_id]) map[m.group_id] = [];
        map[m.group_id].push(m.patient_id);
      });
      setMembers(map);
    }
  };

  useEffect(() => { loadGroups(); }, [clinicId]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setSelectedPatients([]);
    setDialogOpen(true);
  };

  const openEdit = (g: TherapeuticGroup) => {
    setEditingId(g.id);
    setForm({ ...g });
    setSelectedPatients(members[g.id] || []);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nome do grupo é obrigatório'); return; }
    if (!user) return;
    setLoading(true);
    try {
      if (editingId) {
        const { id, created_at, ...rest } = form as any;
        await supabase.from('therapeutic_groups').update(rest).eq('id', editingId);
        // Sync members
        await supabase.from('therapeutic_group_members').delete().eq('group_id', editingId);
        if (selectedPatients.length > 0) {
          await supabase.from('therapeutic_group_members').insert(
            selectedPatients.map(pid => ({ group_id: editingId, patient_id: pid }))
          );
        }
        toast.success('Grupo atualizado');
      } else {
        const { data } = await supabase.from('therapeutic_groups').insert({
          ...form,
          user_id: user.id,
          clinic_id: clinicId,
        } as any).select('id').single();
        if (data && selectedPatients.length > 0) {
          await supabase.from('therapeutic_group_members').insert(
            selectedPatients.map(pid => ({ group_id: data.id, patient_id: pid }))
          );
        }
        toast.success('Grupo criado');
      }
      setDialogOpen(false);
      loadGroups();
    } catch {
      toast.error('Erro ao salvar grupo');
    } finally {
      setLoading(false);
    }
  };

  const toggleArchive = async (g: TherapeuticGroup) => {
    await supabase.from('therapeutic_groups').update({ is_archived: !g.is_archived } as any).eq('id', g.id);
    toast.success(g.is_archived ? 'Grupo reativado' : 'Grupo arquivado');
    loadGroups();
  };

  const filteredPatients = patients.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) && !selectedPatients.includes(p.id)
  );

  const visibleGroups = groups.filter(g => showArchived ? g.is_archived : !g.is_archived);

  const setField = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-500" />
          Grupos Terapêuticos
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? <ArchiveRestore className="w-4 h-4 mr-1" /> : <Archive className="w-4 h-4 mr-1" />}
            {showArchived ? 'Ativos' : 'Arquivados'}
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" /> Novo Grupo
          </Button>
        </div>
      </div>

      {visibleGroups.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-5xl mb-3">👥</div>
          <p className="text-muted-foreground">{showArchived ? 'Nenhum grupo arquivado' : 'Nenhum grupo terapêutico cadastrado'}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {visibleGroups.map(g => (
            <div key={g.id} className="bg-card rounded-xl border border-border p-4 flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-foreground">{g.name}</h3>
                  {g.therapeutic_focus && <p className="text-xs text-muted-foreground">{g.therapeutic_focus}</p>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(g)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleArchive(g)}>
                    {g.is_archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-xs">
                  <Users className="w-3 h-3 mr-1" />
                  {(members[g.id] || []).length} participante{(members[g.id] || []).length !== 1 ? 's' : ''}
                </Badge>
                {g.meeting_frequency && <Badge variant="outline" className="text-xs">{g.meeting_frequency}</Badge>}
                {g.duration_minutes && <Badge variant="outline" className="text-xs">{g.duration_minutes} min</Badge>}
                {g.session_link && (
                  <Badge variant="outline" className="text-xs cursor-pointer" onClick={() => window.open(g.session_link!, '_blank')}>
                    <Link2 className="w-3 h-3 mr-1" /> Link
                  </Badge>
                )}
              </div>
              {g.description && <p className="text-xs text-muted-foreground line-clamp-2">{g.description}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Dialog de cadastro/edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Grupo' : 'Cadastrar Grupo'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Nome */}
            <div>
              <Label>Nome do grupo *</Label>
              <Input value={form.name} onChange={e => setField('name', e.target.value)} placeholder="Ex: Grupo Familiar" />
            </div>

            {/* Participantes */}
            <div>
              <Label>Participantes *</Label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedPatients.map(pid => {
                  const p = patients.find(pt => pt.id === pid);
                  return p ? (
                    <Badge key={pid} variant="secondary" className="gap-1 pr-1">
                      {p.name}
                      <button onClick={() => setSelectedPatients(prev => prev.filter(x => x !== pid))} className="ml-0.5 hover:text-destructive">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ) : null;
                })}
              </div>
              <Input placeholder="Buscar paciente..." value={search} onChange={e => setSearch(e.target.value)} className="mb-1" />
              {search && filteredPatients.length > 0 && (
                <div className="border rounded-lg max-h-32 overflow-y-auto">
                  {filteredPatients.slice(0, 8).map(p => (
                    <button
                      key={p.id}
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                      onClick={() => { setSelectedPatients(prev => [...prev, p.id]); setSearch(''); }}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Accordion sections */}
            <Accordion type="multiple" className="w-full">
              {/* Sobre o grupo */}
              <AccordionItem value="about">
                <AccordionTrigger>Sobre o grupo</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    <div><Label>Descrição</Label><Textarea value={form.description || ''} onChange={e => setField('description', e.target.value)} /></div>
                    <div><Label>Foco terapêutico</Label><Textarea value={form.therapeutic_focus || ''} onChange={e => setField('therapeutic_focus', e.target.value)} /></div>
                    <div><Label>Objetivos</Label><Textarea value={form.objectives || ''} onChange={e => setField('objectives', e.target.value)} /></div>
                    <div><Label>Motivo do suporte</Label><Textarea value={form.support_reason || ''} onChange={e => setField('support_reason', e.target.value)} /></div>
                    <div><Label>Metas compartilhadas</Label><Textarea value={form.shared_goals || ''} onChange={e => setField('shared_goals', e.target.value)} /></div>
                    <div><Label>Padrões de comunicação</Label><Textarea value={form.communication_patterns || ''} onChange={e => setField('communication_patterns', e.target.value)} /></div>
                    <div><Label>Áreas de conflito</Label><Textarea value={form.conflict_areas || ''} onChange={e => setField('conflict_areas', e.target.value)} /></div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Estrutura dos encontros */}
              <AccordionItem value="meetings">
                <AccordionTrigger>Estrutura dos encontros</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    <div><Label>Frequência dos encontros</Label><Input value={form.meeting_frequency || ''} onChange={e => setField('meeting_frequency', e.target.value)} placeholder="Ex: Semanal" /></div>
                    <div><Label>Duração (minutos)</Label><Input type="number" value={form.duration_minutes ?? ''} onChange={e => setField('duration_minutes', e.target.value ? Number(e.target.value) : null)} /></div>
                    <div><Label>Formato do encontro</Label><Input value={form.meeting_format || ''} onChange={e => setField('meeting_format', e.target.value)} placeholder="Ex: Presencial, Online" /></div>
                    <div><Label>Estilo de facilitação</Label><Input value={form.facilitation_style || ''} onChange={e => setField('facilitation_style', e.target.value)} /></div>
                    <div className="flex items-center gap-2">
                      <Switch checked={form.open_to_new || false} onCheckedChange={v => setField('open_to_new', v)} />
                      <Label>Grupo aberto a novos participantes</Label>
                    </div>
                    <div><Label>Número máximo de participantes</Label><Input type="number" value={form.max_participants ?? ''} onChange={e => setField('max_participants', e.target.value ? Number(e.target.value) : null)} /></div>
                    <div><Label>Política de lista de espera</Label><Textarea value={form.waitlist_policy || ''} onChange={e => setField('waitlist_policy', e.target.value)} /></div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Plano de acompanhamento */}
              <AccordionItem value="followup">
                <AccordionTrigger>Plano de acompanhamento</AccordionTrigger>
                <AccordionContent>
                  <Textarea value={form.follow_up_plan || ''} onChange={e => setField('follow_up_plan', e.target.value)} rows={4} />
                </AccordionContent>
              </AccordionItem>

              {/* Critérios e materiais */}
              <AccordionItem value="criteria">
                <AccordionTrigger>Critérios e materiais</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    <div><Label>Critérios de entrada</Label><Textarea value={form.entry_criteria || ''} onChange={e => setField('entry_criteria', e.target.value)} /></div>
                    <div><Label>Critérios de exclusão</Label><Textarea value={form.exclusion_criteria || ''} onChange={e => setField('exclusion_criteria', e.target.value)} /></div>
                    <div><Label>Acordo de confidencialidade</Label><Textarea value={form.confidentiality_agreement || ''} onChange={e => setField('confidentiality_agreement', e.target.value)} /></div>
                    <div><Label>Regras do grupo</Label><Textarea value={form.group_rules || ''} onChange={e => setField('group_rules', e.target.value)} /></div>
                    <div><Label>Materiais</Label><Textarea value={form.materials || ''} onChange={e => setField('materials', e.target.value)} /></div>
                    <div><Label>Recursos de apoio</Label><Textarea value={form.support_resources || ''} onChange={e => setField('support_resources', e.target.value)} /></div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Acompanhamento clínico */}
              <AccordionItem value="clinical">
                <AccordionTrigger>Acompanhamento clínico</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    <div><Label>Método de avaliação</Label><Textarea value={form.assessment_method || ''} onChange={e => setField('assessment_method', e.target.value)} /></div>
                    <div><Label>Próximos tópicos</Label><Textarea value={form.next_topics || ''} onChange={e => setField('next_topics', e.target.value)} /></div>
                    <div><Label>Notas da facilitação</Label><Textarea value={form.facilitation_notes || ''} onChange={e => setField('facilitation_notes', e.target.value)} /></div>
                    <div><Label>Notas de supervisão</Label><Textarea value={form.supervision_notes || ''} onChange={e => setField('supervision_notes', e.target.value)} /></div>
                    <div><Label>Notas gerais</Label><Textarea value={form.general_notes || ''} onChange={e => setField('general_notes', e.target.value)} /></div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Configurações de sessão */}
              <AccordionItem value="session">
                <AccordionTrigger>Configurações de sessão</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    <div><Label>Link externo da sessão</Label><Input value={form.session_link || ''} onChange={e => setField('session_link', e.target.value)} placeholder="https://..." /></div>
                    <div>
                      <Label>Preço padrão por paciente</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                        <Input
                          type="number"
                          className="pl-10"
                          value={form.default_price ?? ''}
                          onChange={e => setField('default_price', e.target.value ? Number(e.target.value) : null)}
                        />
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={loading}>
                {loading ? 'Salvando...' : 'Salvar grupo'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
