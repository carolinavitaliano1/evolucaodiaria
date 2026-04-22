import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShieldCheck, Plus, Pencil, Trash2, Users, Phone, FileBadge2, Search, X, UserPlus, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Props { clinicId: string; }

interface HealthPlan {
  id: string;
  name: string;
  ans_registry: string | null;
  phone: string | null;
  reimbursement_value: number;
  reimbursement_type: string;
  notes: string | null;
  is_active: boolean;
}

interface PatientLink {
  id: string;
  name: string;
  health_plan_id: string | null;
  health_plan_card_number: string | null;
  health_plan_authorized_sessions: number | null;
  health_plan_authorization_expires_at: string | null;
}

const empty = { name: '', ans_registry: '', phone: '', reimbursement_value: 0, reimbursement_type: 'por_sessao', notes: '', is_active: true };

export function ClinicHealthPlans({ clinicId }: Props) {
  const { user } = useAuth();
  const [plans, setPlans] = useState<HealthPlan[]>([]);
  const [patients, setPatients] = useState<PatientLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<HealthPlan | null>(null);
  const [form, setForm] = useState(empty);
  const [viewingPlan, setViewingPlan] = useState<HealthPlan | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: pl }, { data: pa }] = await Promise.all([
      supabase.from('health_plans').select('*').eq('clinic_id', clinicId).order('name'),
      supabase.from('patients')
        .select('id, name, health_plan_id, health_plan_card_number, health_plan_authorized_sessions, health_plan_authorization_expires_at')
        .eq('clinic_id', clinicId)
        .order('name'),
    ]);
    setPlans((pl as HealthPlan[]) || []);
    setPatients((pa as PatientLink[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [clinicId]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    patients.forEach(p => { if (p.health_plan_id) m.set(p.health_plan_id, (m.get(p.health_plan_id) || 0) + 1); });
    return m;
  }, [patients]);

  const openNew = () => { setEditing(null); setForm(empty); setDialogOpen(true); };
  const openEdit = (p: HealthPlan) => {
    setEditing(p);
    setForm({
      name: p.name, ans_registry: p.ans_registry || '', phone: p.phone || '',
      reimbursement_value: Number(p.reimbursement_value) || 0,
      reimbursement_type: p.reimbursement_type || 'por_sessao',
      notes: p.notes || '', is_active: p.is_active,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error('Informe o nome do convênio'); return; }
    if (!user?.id) return;
    const payload = { ...form, name: form.name.trim(), clinic_id: clinicId, user_id: user.id };
    const { error } = editing
      ? await supabase.from('health_plans').update(payload).eq('id', editing.id)
      : await supabase.from('health_plans').insert(payload);
    if (error) { toast.error('Erro ao salvar', { description: error.message }); return; }
    toast.success(editing ? 'Convênio atualizado' : 'Convênio cadastrado');
    setDialogOpen(false);
    load();
  };

  const remove = async (p: HealthPlan) => {
    if (!confirm(`Excluir o convênio "${p.name}"?`)) return;
    const { error } = await supabase.from('health_plans').delete().eq('id', p.id);
    if (error) { toast.error('Erro ao excluir', { description: error.message }); return; }
    toast.success('Convênio excluído');
    load();
  };

  return (
    <div className="bg-card rounded-2xl p-6 border border-border">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          Planos de Saúde / Convênios
        </h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2" onClick={openNew}>
              <Plus className="w-4 h-4" /> Novo Convênio
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar Convênio' : 'Novo Convênio'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div>
                <Label>Nome *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Unimed, Bradesco Saúde" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Registro ANS</Label>
                  <Input value={form.ans_registry} onChange={e => setForm({ ...form, ans_registry: e.target.value })} placeholder="000000" />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="(00) 0000-0000" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Valor reembolso</Label>
                  <Input type="number" step="0.01" value={form.reimbursement_value}
                    onChange={e => setForm({ ...form, reimbursement_value: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={form.reimbursement_type} onValueChange={v => setForm({ ...form, reimbursement_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="por_sessao">Por Sessão</SelectItem>
                      <SelectItem value="mensal">Mensal</SelectItem>
                      <SelectItem value="pacote">Por Pacote</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Procedimentos, prazos, particularidades..." />
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button className="flex-1" onClick={save}>{editing ? 'Salvar' : 'Cadastrar'}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-12 text-sm text-muted-foreground">Carregando...</div>
      ) : plans.length === 0 ? (
        <div className="text-center py-12">
          <ShieldCheck className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-1">Nenhum convênio cadastrado</p>
          <p className="text-xs text-muted-foreground">Cadastre os planos de saúde que esta clínica atende.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {plans.map(p => {
            const count = counts.get(p.id) || 0;
            return (
              <div key={p.id} className="rounded-xl border border-border bg-background/50 p-4 hover:border-primary/40 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-foreground truncate">{p.name}</h3>
                    {p.ans_registry && <p className="text-[11px] text-muted-foreground">ANS {p.ans_registry}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => remove(p)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  {Number(p.reimbursement_value) > 0 && (
                    <Badge variant="secondary" className="font-medium">
                      R$ {Number(p.reimbursement_value).toFixed(2)} / {p.reimbursement_type === 'mensal' ? 'mês' : p.reimbursement_type === 'pacote' ? 'pacote' : 'sessão'}
                    </Badge>
                  )}
                  {p.phone && (
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{p.phone}</span>
                  )}
                  {!p.is_active && <Badge variant="outline" className="text-warning">Inativo</Badge>}
                </div>
                <button
                  onClick={() => setViewingPlan(p)}
                  className="w-full flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-primary/5 hover:bg-primary/10 text-primary font-medium transition-colors"
                >
                  <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />{count} paciente{count !== 1 ? 's' : ''} vinculado{count !== 1 ? 's' : ''}</span>
                  <span className="text-[11px]">Gerenciar →</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      <PlanPatientsDialog
        plan={viewingPlan}
        onOpenChange={(v) => !v && setViewingPlan(null)}
        patients={patients}
        clinicId={clinicId}
        onChanged={load}
      />
    </div>
  );
}

function PlanPatientsDialog({ plan, onOpenChange, patients, clinicId, onChanged }: {
  plan: HealthPlan | null;
  onOpenChange: (v: boolean) => void;
  patients: PatientLink[];
  clinicId: string;
  onChanged: () => void;
}) {
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingPatient, setEditingPatient] = useState<PatientLink | null>(null);
  const [card, setCard] = useState('');
  const [sessions, setSessions] = useState<string>('');
  const [expires, setExpires] = useState('');

  const linked = useMemo(() => patients.filter(p => p.health_plan_id === plan?.id), [patients, plan?.id]);
  const linkable = useMemo(
    () => patients.filter(p => p.health_plan_id !== plan?.id)
      .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase())),
    [patients, plan?.id, search],
  );

  const link = async (patientId: string) => {
    if (!plan) return;
    const { error } = await supabase.from('patients').update({ health_plan_id: plan.id }).eq('id', patientId);
    if (error) { toast.error('Erro ao vincular', { description: error.message }); return; }
    toast.success('Paciente vinculado');
    onChanged();
  };

  const unlink = async (patientId: string) => {
    const { error } = await supabase.from('patients').update({
      health_plan_id: null, health_plan_card_number: null,
      health_plan_authorized_sessions: null, health_plan_authorization_expires_at: null,
    }).eq('id', patientId);
    if (error) { toast.error('Erro ao desvincular', { description: error.message }); return; }
    toast.success('Paciente desvinculado');
    onChanged();
  };

  const openEditDetails = (p: PatientLink) => {
    setEditingPatient(p);
    setCard(p.health_plan_card_number || '');
    setSessions(p.health_plan_authorized_sessions != null ? String(p.health_plan_authorized_sessions) : '');
    setExpires(p.health_plan_authorization_expires_at || '');
  };

  const saveDetails = async () => {
    if (!editingPatient) return;
    const { error } = await supabase.from('patients').update({
      health_plan_card_number: card.trim() || null,
      health_plan_authorized_sessions: sessions ? parseInt(sessions, 10) : null,
      health_plan_authorization_expires_at: expires || null,
    }).eq('id', editingPatient.id);
    if (error) { toast.error('Erro ao salvar', { description: error.message }); return; }
    toast.success('Dados atualizados');
    setEditingPatient(null);
    onChanged();
  };

  if (!plan) return null;

  return (
    <Dialog open={!!plan} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            {plan.name}
          </DialogTitle>
        </DialogHeader>

        {editingPatient ? (
          <div className="space-y-3">
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-sm font-medium text-foreground">{editingPatient.name}</p>
              <p className="text-[11px] text-muted-foreground">Dados do convênio</p>
            </div>
            <div>
              <Label>Número da carteirinha</Label>
              <Input value={card} onChange={e => setCard(e.target.value)} placeholder="Ex: 0000.0000.0000.00" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Sessões autorizadas</Label>
                <Input type="number" min="0" value={sessions} onChange={e => setSessions(e.target.value)} placeholder="Ex: 12" />
              </div>
              <div>
                <Label>Validade</Label>
                <Input type="date" value={expires} onChange={e => setExpires(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditingPatient(null)}>Cancelar</Button>
              <Button className="flex-1" onClick={saveDetails}>Salvar</Button>
            </div>
          </div>
        ) : !adding ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">{linked.length}</strong> paciente(s) vinculado(s)
              </p>
              <Button size="sm" className="h-8 gap-1.5" onClick={() => setAdding(true)}>
                <UserPlus className="w-3 h-3" /> Vincular
              </Button>
            </div>

            {linked.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Nenhum paciente neste convênio.
              </div>
            ) : (
              <ScrollArea className="max-h-80">
                <div className="space-y-1.5">
                  {linked.map(p => (
                    <div key={p.id} className="rounded-lg border border-border bg-card p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                            {p.health_plan_card_number && (
                              <span className="text-[11px] text-muted-foreground flex items-center gap-1"><FileBadge2 className="w-3 h-3" />{p.health_plan_card_number}</span>
                            )}
                            {p.health_plan_authorized_sessions != null && (
                              <span className="text-[11px] text-muted-foreground">{p.health_plan_authorized_sessions} sessões aut.</span>
                            )}
                            {p.health_plan_authorization_expires_at && (
                              <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" />até {new Date(p.health_plan_authorization_expires_at + 'T00:00').toLocaleDateString('pt-BR')}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDetails(p)} title="Editar dados">
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => unlink(p.id)} title="Desvincular">
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar paciente..." className="pl-8 h-9 text-sm" />
              </div>
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => { setAdding(false); setSearch(''); }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            {linkable.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                {search ? 'Nenhum paciente encontrado' : 'Todos os pacientes da clínica já estão vinculados'}
              </div>
            ) : (
              <ScrollArea className="max-h-72">
                <div className="space-y-1">
                  {linkable.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                        {p.health_plan_id && <p className="text-[10px] text-warning">Trocará de convênio</p>}
                      </div>
                      <Button size="sm" variant="outline" className="h-7" onClick={() => link(p.id)}>Vincular</Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
