import { CheckCircle2, Circle, Plus, Trash2, StickyNote, Users, Clock, Flag } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AssignedTask {
  id: string;
  title: string;
  notes: string | null;
  completed: boolean;
  due_date: string | null;
  priority: 'low' | 'medium' | 'high';
  assigned_by_user_id: string | null;
  assigner_name?: string;
}

export function TaskList() {
  const { tasks, addTask, toggleTask, deleteTask, updateTaskNotes } = useApp();
  const { theme } = useTheme();
  const { user } = useAuth();
  const [newTask, setNewTask] = useState('');
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [assignedTasks, setAssignedTasks] = useState<AssignedTask[]>([]);

  const loadAssigned = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('tasks')
      .select('id, title, notes, completed, due_date, priority, assigned_by_user_id')
      .eq('assigned_to_user_id', user.id)
      .eq('completed', false)
      .order('due_date', { ascending: true, nullsFirst: false });
    const list = (data ?? []) as AssignedTask[];
    const assignerIds = [...new Set(list.map((t) => t.assigned_by_user_id).filter(Boolean))] as string[];
    if (assignerIds.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', assignerIds);
      const nameMap = Object.fromEntries((profs ?? []).map((p) => [p.user_id, p.name ?? '']));
      list.forEach((t) => {
        if (t.assigned_by_user_id) t.assigner_name = nameMap[t.assigned_by_user_id] || 'Equipe';
      });
    }
    setAssignedTasks(list);
  }, [user]);

  useEffect(() => {
    loadAssigned();
  }, [loadAssigned]);

  const completeAssigned = async (id: string) => {
    await supabase.from('tasks').update({ completed: true }).eq('id', id);
    setAssignedTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTask.trim()) {
      addTask(newTask.trim());
      setNewTask('');
    }
  };

  // Hide assigned tasks from the "personal" list to avoid duplicates
  const assignedIds = new Set(assignedTasks.map((t) => t.id));
  const pendingTasks = tasks.filter(t => !t.completed && !assignedIds.has(t.id));
  const completedTasks = tasks.filter(t => t.completed);

  const priorityColor = (p: 'low' | 'medium' | 'high') =>
    p === 'high' ? 'text-destructive' : p === 'medium' ? 'text-primary' : 'text-muted-foreground';

  return (
    <div className={cn(
      "rounded-2xl p-6 shadow-lg border",
      theme === 'lilas' ? 'calendar-grid border-0' : 'bg-card border-border'
    )}>
      <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
        📝 Tarefas
        <span className="text-sm font-normal text-muted-foreground">
          ({pendingTasks.length + assignedTasks.length} pendentes)
        </span>
      </h3>

      {/* Add task form */}
      <form onSubmit={handleAddTask} className="flex gap-2 mb-4">
        <Input
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          placeholder="Nova tarefa..."
          className="flex-1"
        />
        <Button type="submit" size="icon" className="gradient-primary">
          <Plus className="w-4 h-4" />
        </Button>
      </form>

      {/* Tasks list */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {tasks.length === 0 && assignedTasks.length === 0 ? (
          <p className="text-center text-muted-foreground py-4 text-sm">
            Nenhuma tarefa pendente 🎉
          </p>
        ) : (
          <>
            {/* Team-assigned tasks (read-only complete) */}
            {assignedTasks.map((t) => {
              const overdue = t.due_date && isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date));
              return (
                <div
                  key={t.id}
                  className="flex items-start gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20 group"
                >
                  <button
                    onClick={() => completeAssigned(t.id)}
                    className="mt-0.5 text-muted-foreground hover:text-primary transition-colors shrink-0"
                  >
                    <Circle className="w-5 h-5" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-foreground font-medium">{t.title}</span>
                      <Flag className={cn('w-3 h-3', priorityColor(t.priority))} />
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {t.assigner_name || 'Equipe'}
                      </span>
                      {t.due_date && (
                        <span className={cn('flex items-center gap-1', overdue && 'text-destructive font-semibold')}>
                          <Clock className="w-3 h-3" />
                          {format(parseISO(t.due_date), 'dd/MM', { locale: ptBR })}
                          {overdue && ' · Vencida'}
                        </span>
                      )}
                    </div>
                    {t.notes && (
                      <p className="text-[11px] text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-2">{t.notes}</p>
                    )}
                  </div>
                </div>
              );
            })}

            {pendingTasks.map((task) => (
              <div key={task.id}>
                <div
                  className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors group"
                >
                  <button
                    onClick={() => toggleTask(task.id)}
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Circle className="w-5 h-5" />
                  </button>
                  <span className="flex-1 text-foreground text-sm">{task.title}</span>
                  <button
                    onClick={() => setExpandedTask(prev => prev === task.id ? null : task.id)}
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    <div className="relative">
                      <StickyNote className="w-4 h-4" />
                      {task.notes && <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-primary rounded-full" />}
                    </div>
                  </button>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {expandedTask === task.id && (
                  <div className="ml-8 mr-2 mt-1 mb-2">
                    <Textarea
                      value={task.notes || ''}
                      onChange={(e) => updateTaskNotes(task.id, e.target.value)}
                      placeholder="Notas..."
                      className="min-h-[50px] text-xs"
                    />
                  </div>
                )}
              </div>
            ))}
            
            {completedTasks.map((task) => (
              <div key={task.id}>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 group">
                  <button
                    onClick={() => toggleTask(task.id)}
                    className="text-success"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                  </button>
                  <span className="flex-1 text-muted-foreground text-sm line-through">
                    {task.title}
                  </span>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
