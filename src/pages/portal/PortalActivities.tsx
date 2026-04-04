import { useState, useEffect } from 'react';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { usePortal } from '@/contexts/PortalContext';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, Circle, Clock, CalendarDays, Link2, Image, FileText, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ActivityItem {
  text: string;
  done: boolean;
}

interface ActivityAttachment {
  type: 'link' | 'image' | 'document';
  url: string;
  name: string;
}

interface Activity {
  id: string;
  title: string;
  items: ActivityItem[];
  attachments: ActivityAttachment[];
  due_date: string | null;
  status: string;
  created_at: string;
}

// Renders **bold** markdown as actual <strong> elements
function renderBoldText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

export default function PortalActivities() {
  const { portalAccount } = usePortal();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const loadActivities = async () => {
    if (!portalAccount) return;
    const { data } = await supabase
      .from('portal_activities')
      .select('*')
      .eq('patient_id', portalAccount.patient_id)
      .order('created_at', { ascending: false });
    if (data) setActivities(data.map(d => ({ ...d, attachments: (d as any).attachments || [] })) as Activity[]);
    setLoading(false);
  };

  useEffect(() => {
    loadActivities();
  }, [portalAccount]);

  useEffect(() => {
    if (!portalAccount) return;
    const channel = supabase
      .channel(`portal-activities-${portalAccount.patient_id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'portal_activities',
        filter: `patient_id=eq.${portalAccount.patient_id}`,
      }, () => loadActivities())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [portalAccount]);

  const toggleItem = async (activity: Activity, itemIndex: number) => {
    const updatedItems = activity.items.map((item, i) =>
      i === itemIndex ? { ...item, done: !item.done } : item
    );
    const allDone = updatedItems.every(i => i.done);
    await supabase
      .from('portal_activities')
      .update({
        items: updatedItems as any,
        status: allDone ? 'completed' : 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', activity.id);
    setActivities(prev => prev.map(a =>
      a.id === activity.id ? { ...a, items: updatedItems, status: allDone ? 'completed' : 'pending' } : a
    ));
  };

  const completedCount = (items: ActivityItem[]) => items.filter(i => i.done).length;

  const attachIcon = (type: string) => {
    if (type === 'link') return <Link2 className="w-3.5 h-3.5 text-primary" />;
    if (type === 'image') return <Image className="w-3.5 h-3.5 text-primary" />;
    return <FileText className="w-3.5 h-3.5 text-primary" />;
  };

  return (
    <PortalLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-lg font-bold text-foreground">Atividades</h1>
          <p className="text-xs text-muted-foreground">Tarefas e exercícios do seu terapeuta</p>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Carregando...</div>
        ) : activities.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-6 text-center">
            <div className="text-4xl mb-3">📋</div>
            <p className="font-semibold text-foreground text-sm">Nenhuma atividade</p>
            <p className="text-xs text-muted-foreground mt-1">
              Seu terapeuta ainda não enviou atividades.
            </p>
          </div>
        ) : (
          activities.map(activity => {
            const done = completedCount(activity.items);
            const total = activity.items.length;
            const isCompleted = activity.status === 'completed';
            return (
              <div
                key={activity.id}
                className={cn(
                  'bg-card rounded-2xl border p-4 space-y-3',
                  isCompleted ? 'border-green-500/30 bg-green-500/5' : 'border-border'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-sm text-foreground">{activity.title || 'Plano de Ação'}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(activity.created_at), "d MMM yyyy", { locale: ptBR })}
                      </span>
                      {activity.due_date && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          Prazo: {format(new Date(activity.due_date + 'T12:00:00'), "d MMM", { locale: ptBR })}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={cn(
                    'text-xs font-medium px-2 py-0.5 rounded-full',
                    isCompleted ? 'bg-green-500/15 text-green-700 dark:text-green-400' : 'bg-primary/10 text-primary'
                  )}>
                    {done}/{total}
                  </span>
                </div>

                {/* Progress bar */}
                {total > 0 && (
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', isCompleted ? 'bg-green-500' : 'bg-primary')}
                      style={{ width: `${(done / total) * 100}%` }}
                    />
                  </div>
                )}

                {/* Items */}
                <div className="space-y-1.5">
                  {activity.items.map((item, i) => (
                    <button
                      key={i}
                      onClick={() => toggleItem(activity, i)}
                      className="flex items-start gap-2.5 w-full text-left p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      {item.done ? (
                        <CheckCircle2 className="w-4.5 h-4.5 text-green-500 shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="w-4.5 h-4.5 text-muted-foreground shrink-0 mt-0.5" />
                      )}
                      <span className={cn(
                        'text-sm leading-relaxed',
                        item.done ? 'line-through text-muted-foreground' : 'text-foreground'
                      )}>
                        {renderBoldText(item.text)}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Attachments */}
                {activity.attachments && activity.attachments.length > 0 && (
                  <div className="border-t border-border pt-3 space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Materiais anexados</p>
                    {activity.attachments.map((att, i) => (
                      <a
                        key={i}
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 text-xs hover:bg-muted transition-colors"
                      >
                        {attachIcon(att.type)}
                        <span className="truncate flex-1 text-foreground">{att.name}</span>
                        <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </PortalLayout>
  );
}
