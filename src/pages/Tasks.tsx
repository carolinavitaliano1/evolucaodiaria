import { CheckCircle2, Circle, Plus, Trash2, ChevronDown, ChevronUp, StickyNote } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useApp } from '@/contexts/AppContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Tasks() {
  const { tasks, addTask, toggleTask, deleteTask, updateTaskNotes } = useApp();
  const [newTask, setNewTask] = useState('');
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTask.trim()) {
      addTask(newTask.trim());
      setNewTask('');
    }
  };

  const pendingTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);

  const toggleExpand = (id: string) => {
    setExpandedTask(prev => prev === id ? null : id);
  };

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
          <span className="text-4xl">📝</span>
          Tarefas
        </h1>
        <p className="text-muted-foreground">
          {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
        </p>
      </div>

      {/* Add Task */}
      <form onSubmit={handleAddTask} className="mb-8">
        <div className="flex gap-3">
          <Input
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="Adicionar nova tarefa..."
            className="flex-1 h-12 text-lg"
          />
          <Button type="submit" className="gradient-primary h-12 px-6 gap-2">
            <Plus className="w-5 h-5" />
            Adicionar
          </Button>
        </div>
      </form>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-card rounded-2xl p-5 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-warning/10">
              <Circle className="w-6 h-6 text-warning" />
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Pendentes</p>
              <p className="text-2xl font-bold text-foreground">{pendingTasks.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-card rounded-2xl p-5 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-success/10">
              <CheckCircle2 className="w-6 h-6 text-success" />
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Concluídas</p>
              <p className="text-2xl font-bold text-foreground">{completedTasks.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Tasks */}
      {pendingTasks.length > 0 && (
        <div className="mb-8">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            ⏳ Pendentes
            <span className="text-sm font-normal text-muted-foreground">
              ({pendingTasks.length})
            </span>
          </h2>
          
          <div className="space-y-3">
            {pendingTasks.map((task, index) => (
              <div
                key={task.id}
                className={cn(
                  'rounded-xl bg-card border border-border',
                  'hover:shadow-md transition-all group animate-scale-in opacity-0',
                  `stagger-${(index % 5) + 1}`
                )}
                style={{ animationFillMode: 'forwards' }}
              >
                <div className="flex items-center gap-4 p-4">
                  <button
                    onClick={() => toggleTask(task.id)}
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Circle className="w-6 h-6" />
                  </button>
                  <span className="flex-1 text-foreground">{task.title}</span>
                  <button
                    onClick={() => toggleExpand(task.id)}
                    className="text-muted-foreground hover:text-primary transition-colors"
                    title="Notas"
                  >
                    {expandedTask === task.id ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <div className="relative">
                        <StickyNote className="w-5 h-5" />
                        {task.notes && <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />}
                      </div>
                    )}
                  </button>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
                {expandedTask === task.id && (
                  <div className="px-4 pb-4 pt-0">
                    <Textarea
                      value={task.notes || ''}
                      onChange={(e) => updateTaskNotes(task.id, e.target.value)}
                      placeholder="Adicionar notas..."
                      className="min-h-[60px] text-sm"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed Tasks */}
      {completedTasks.length > 0 && (
        <div>
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            ✅ Concluídas
            <span className="text-sm font-normal text-muted-foreground">
              ({completedTasks.length})
            </span>
          </h2>
          
          <div className="space-y-2">
            {completedTasks.map((task) => (
              <div
                key={task.id}
                className="rounded-xl bg-muted/50 group"
              >
                <div className="flex items-center gap-4 p-4">
                  <button
                    onClick={() => toggleTask(task.id)}
                    className="text-success"
                  >
                    <CheckCircle2 className="w-6 h-6" />
                  </button>
                  <span className="flex-1 text-muted-foreground line-through">{task.title}</span>
                  <button
                    onClick={() => toggleExpand(task.id)}
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    {expandedTask === task.id ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <div className="relative">
                        <StickyNote className="w-5 h-5" />
                        {task.notes && <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />}
                      </div>
                    )}
                  </button>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
                {expandedTask === task.id && (
                  <div className="px-4 pb-4 pt-0">
                    <Textarea
                      value={task.notes || ''}
                      onChange={(e) => updateTaskNotes(task.id, e.target.value)}
                      placeholder="Adicionar notas..."
                      className="min-h-[60px] text-sm"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {tasks.length === 0 && (
        <div className="text-center py-16">
          <div className="text-8xl mb-6 animate-float">🎉</div>
          <h2 className="text-xl font-bold text-foreground mb-2">Tudo em dia!</h2>
          <p className="text-muted-foreground">
            Nenhuma tarefa pendente. Aproveite para relaxar!
          </p>
        </div>
      )}
    </div>
  );
}
