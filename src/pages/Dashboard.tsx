import { format } from 'date-fns';
import { toLocalDateString } from '@/lib/utils';
import { ptBR } from 'date-fns/locale';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { MiniCalendar } from '@/components/dashboard/MiniCalendar';
import { TaskList } from '@/components/dashboard/TaskList';
import { NotificationSettings } from '@/components/notifications/NotificationSettings';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useSubscription } from '@/hooks/useSubscription';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Crown, CalendarClock } from 'lucide-react';
import { useState, useEffect } from 'react';

const PLAN_NAMES: Record<string, string> = {
  'prod_Tx2Ctdcx5Gt6DS': 'Mensal',
  'prod_Tx2CuaO7IPAo8f': 'Bimestral',
  'prod_Tx2CjumgxfBFM6': 'Trimestral',
  'owner': 'Owner',
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function Dashboard() {
  const { selectedDate, appointments, tasks, evolutions } = useApp();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { subscribed, productId, subscriptionEnd, loading: subLoading } = useSubscription();

  const todayStr = toLocalDateString(new Date());
  const todayEvolutions = evolutions.filter(e => e.date === todayStr);
  const todayPresentes = todayEvolutions.filter(e => e.attendanceStatus === 'presente' || e.attendanceStatus === 'reposicao');
  const todayFaltas = todayEvolutions.filter(e => e.attendanceStatus === 'falta' || e.attendanceStatus === 'falta_remunerada');
  const pendingTasks = tasks.filter(t => !t.completed);

  // Load today's events
  const [todayEvents, setTodayEvents] = useState<any[]>([]);
  useEffect(() => {
    if (!user) return;
    supabase.from('events').select('*').eq('user_id', user.id).eq('date', todayStr)
      .then(({ data }) => { if (data) setTodayEvents(data); });
  }, [user, todayStr]);

  const planName = productId ? (PLAN_NAMES[productId] || 'Ativo') : null;
  const endDateStr = subscriptionEnd
    ? format(new Date(subscriptionEnd), "dd/MM/yyyy")
    : null;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto pb-24">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-semibold text-foreground mb-0.5">
            {getGreeting()}! 👋
          </h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>

        {/* Subscription badge */}
        {!subLoading && (
          <div className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl border text-sm",
            subscribed
              ? "bg-primary/5 border-primary/20 text-primary"
              : "bg-muted border-border text-muted-foreground"
          )}>
            <Crown className="w-4 h-4" />
            <span className="font-medium">
              {subscribed
                ? `Plano ${planName || 'Ativo'}`
                : 'Teste Gratuito'}
            </span>
            {subscribed && endDateStr && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarClock className="w-3 h-3" />
                até {endDateStr}
              </span>
            )}
            {!subscribed && (
              <Badge variant="secondary" className="text-xs">30 dias</Badge>
            )}
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="mb-6">
        <StatsCards />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column - Calendar */}
        <div className="lg:col-span-4 space-y-5">
          <MiniCalendar />
          
          {/* Day Summary */}
          <div className={cn(
            "rounded-xl p-4 border",
            theme === 'lilas' ? 'calendar-grid border-0' : 'bg-card border-border'
          )}>
            <h3 className="font-medium text-foreground mb-3 text-sm">Resumo do Dia</h3>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">✅ Atendimentos</span>
                <span className="text-foreground font-semibold">{todayPresentes.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">❌ Faltas</span>
                <span className="text-foreground font-semibold">{todayFaltas.length}</span>
              </div>
              {todayEvents.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">📅 Eventos</span>
                  <span className="text-foreground font-semibold">{todayEvents.length}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">📋 Tarefas Pendentes</span>
                <span className="text-foreground font-semibold">{pendingTasks.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Tasks & Notifications */}
        <div className="lg:col-span-8 space-y-5">
          <TaskList />
          <NotificationSettings />
        </div>
      </div>
    </div>
  );
}
