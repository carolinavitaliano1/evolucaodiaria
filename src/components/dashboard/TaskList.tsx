import { CheckCircle2, Circle, Plus, Trash2, StickyNote, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';

export function TaskList() {
  const { tasks, addTask, toggleTask, deleteTask, updateTaskNotes } = useApp();
  const { theme } = useTheme();
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

  return (
    <div className={cn(
      "rounded-2xl p-6 shadow-lg border",
      theme === 'lilas' ? 'calendar-grid border-0' : 'bg-card border-border'
    )}>
      <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
        📝 Tarefas
        <span className="text-sm font-normal text-muted-foreground">
          ({pendingTasks.length} pendentes)
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
        {tasks.length === 0 ? (
          <p className="text-center text-muted-foreground py-4 text-sm">
            Nenhuma tarefa pendente 🎉
          </p>
        ) : (
          <>
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
