import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CheckCircle2, Circle, Plus, Trash2, Loader2, CalendarIcon, ListTodo, Flag, Clock } from 'lucide-react';
import { format, parseISO, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Member {
  user_id: string;
  email: string;
  role_label: string | null;
  role: string;
  name?: string;
}
interface TeamTask {
  id: string;
  title: string;
  notes: string | null;
  completed: boolean;
  due_date: string | null;
  priority: 'low' | 'medium' | 'high';
  assigned_to_user_id: string | null;
  assigned_by_user_id: string | null;
  created_at: string;
}

interface Props {
  organizationId: string;
  clinicId: string;
}

const PRIORITY_LABELS = { low: 'Baixa', medium: 'Média', high: 'Alta' } as const;
const PRIORITY_COLORS = {
  low: 'text-muted-foreground bg-muted',
  medium: 'text-primary bg-primary/10',
  high: 'text-destructive bg-destructive/10',
} as const;

export function TeamTasksTab({ organizationId, clinicId }: Props) {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [tasks, setTasks] = useState<TeamTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'mine' | 'created' | 'overdue' | 'completed'>('pending');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    notes: '',
    assignedTo: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    dueDate: undefined as Date | undefined,
  });

  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: memData } = await supabase
        .from('organization_members')
        .select('user_id, email, role, role_label')
        .eq('organization_id', organizationId)
        .eq('status', 'active');
      const memberList = (memData ?? []).filter((m) => m.user_id) as Member[];
      const ids = memberList.map((m) => m.user_id);
      const { data: profs } = ids.length
        ? await supabase.from('profiles').select('user_id, name').in('user_id', ids)
        : { data: [] as { user_id: string; name: string | null }[] };
      const nameMap = Object.fromEntries((profs ?? []).map((p) => [p.user_id, p.name ?? '']));
      setMembers(memberList.map((m) => ({ ...m, name: nameMap[m.user_id] || m.email.split('@')[0] })));

      const userIds = [...ids, user.id];
      const { data: taskData } = await supabase
        .from('tasks')
        .select('id, title, notes, completed, due_date, priority, assigned_to_user_id, assigned_by_user_id, created_at')
        .or(`assigned_to_user_id.in.(${userIds.join(',')}),assigned_by_user_id.eq.${user.id}`)
        .not('assigned_to_user_id', 'is', null)
        .order('created_at', { ascending: false });
      setTasks((taskData ?? []) as TeamTask[]);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar tarefas');
    } finally {
      setLoading(false);
    }
  }, [user, organizationId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const memberMap = Object.fromEntries(members.map((m) => [m.user_id, m]));

  const filtered = tasks.filter((t) => {
    if (filter === 'pending') return !t.completed;
    if (filter === 'completed') return t.completed;
    if (filter === 'mine') return !t.completed && t.assigned_to_user_id === user?.id;
    if (filter === 'created') return t.assigned_by_user_id === user?.id;
    if (filter === 'overdue') return !t.completed && t.due_date && isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date));
    return true;
  });

  const handleCreate = async () => {
    if (!user || !newTask.title.trim() || !newTask.assignedTo) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('tasks').insert({
        user_id: user.id,
        title: newTask.title.trim(),
        notes: newTask.notes.trim() || null,
        assigned_to_user_id: newTask.assignedTo,
        assigned_by_user_id: user.id,
        clinic_id: clinicId,
        priority: newTask.priority,
        due_date: newTask.dueDate ? format(newTask.dueDate, 'yyyy-MM-dd') : null,
        completed: false,
      });
      if (error) throw error;
      toast.success('Tarefa atribuída!');
      setDialogOpen(false);
      setNewTask({ title: '', notes: '', assignedTo: '', priority: 'medium', dueDate: undefined });
      loadAll();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao criar tarefa');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleDone = async (t: TeamTask) => {
    const { error } = await supabase.from('tasks').update({ completed: !t.completed }).eq('id', t.id);
    if (error) {
      toast.error('Erro ao atualizar');
      return;
    }
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, completed: !x.completed } : x)));
  };

  const removeTask = async (id: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao excluir');
      return;
    }
    setTasks((prev) => prev.filter((x) => x.id !== id));
  };

  const counts = {
    pending: tasks.filter((t) => !t.completed).length,
    mine: tasks.filter((t) => !t.completed && t.assigned_to_user_id === user?.id).length,
    overdue: tasks.filter((t) => !t.completed && t.due_date && isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date))).length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <ListTodo className="w-4 h-4 text-primary" />
            Tarefas da Equipe
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Delegue e acompanhe tarefas dos membros da equipe
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4" />
          Nova tarefa
        </Button>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'pending' as const, label: 'Pendentes', count: counts.pending },
          { key: 'mine' as const, label: 'Atribuídas a mim', count: counts.mine },
          { key: 'overdue' as const, label: 'Vencidas', count: counts.overdue },
          { key: 'created' as const, label: 'Criadas por mim', count: undefined },
          { key: 'completed' as const, label: 'Concluídas', count: undefined },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
              filter === f.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/70',
            )}
          >
            {f.label}
            {f.count !== undefined && f.count > 0 && (
              <span className="ml-1.5 opacity-80">({f.count})</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
            <ListTodo className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Nenhuma tarefa neste filtro.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => {
            const assignee = t.assigned_to_user_id ? memberMap[t.assigned_to_user_id] : undefined;
            const overdue = t.due_date && !t.completed && isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date));
            const canDelete = t.assigned_by_user_id === user?.id;
            return (
              <div
                key={t.id}
                className="flex items-start gap-3 p-3 rounded-xl bg-secondary/40 hover:bg-secondary/70 transition-colors group"
              >
                <button onClick={() => toggleDone(t)} className="mt-0.5 shrink-0">
                  {t.completed ? (
                    <CheckCircle2 className="w-5 h-5 text-success" />
                  ) : (
                    <Circle className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn('text-sm font-medium', t.completed && 'line-through text-muted-foreground')}>
                      {t.title}
                    </span>
                    <Badge variant="outline" className={cn('text-[10px] h-5 px-1.5 border-0', PRIORITY_COLORS[t.priority])}>
                      <Flag className="w-2.5 h-2.5 mr-1" />
                      {PRIORITY_LABELS[t.priority]}
                    </Badge>
                    {overdue && (
                      <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-0 bg-destructive/10 text-destructive">
                        <Clock className="w-2.5 h-2.5 mr-1" />
                        Vencida
                      </Badge>
                    )}
                  </div>
                  {t.notes && (
                    <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{t.notes}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                    {assignee && (
                      <span className="flex items-center gap-1">
                        Atribuída a <strong className="text-foreground">{assignee.name}</strong>
                      </span>
                    )}
                    {t.due_date && (
                      <span className="flex items-center gap-1">
                        <CalendarIcon className="w-3 h-3" />
                        {format(parseISO(t.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                      </span>
                    )}
                  </div>
                </div>
                {canDelete && (
                  <button
                    onClick={() => removeTask(t.id)}
                    className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" />
              Atribuir nova tarefa
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Título <span className="text-destructive">*</span></Label>
              <Input
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                placeholder="Ex: Confirmar agendamentos da semana"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Atribuir a <span className="text-destructive">*</span></Label>
              <Select value={newTask.assignedTo} onValueChange={(v) => setNewTask({ ...newTask, assignedTo: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione um membro" /></SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.name} {m.role_label ? `· ${m.role_label}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Prioridade</Label>
                <Select value={newTask.priority} onValueChange={(v) => setNewTask({ ...newTask, priority: v as 'low' | 'medium' | 'high' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Vencimento</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal h-10">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {newTask.dueDate ? format(newTask.dueDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Sem prazo'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={newTask.dueDate}
                      onSelect={(d) => setNewTask({ ...newTask, dueDate: d ?? undefined })}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notas (opcional)</Label>
              <Textarea
                value={newTask.notes}
                onChange={(e) => setNewTask({ ...newTask, notes: e.target.value })}
                placeholder="Detalhes ou instruções..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={submitting || !newTask.title.trim() || !newTask.assignedTo}>
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Atribuir tarefa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}