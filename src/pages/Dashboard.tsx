import { format } from 'date-fns';
import { toLocalDateString } from '@/lib/utils';
import { ptBR } from 'date-fns/locale';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { MiniCalendar } from '@/components/dashboard/MiniCalendar';
import { TaskList } from '@/components/dashboard/TaskList';
import { BirthdayCard } from '@/components/dashboard/BirthdayCard';
import { TodayAppointments } from '@/components/dashboard/TodayAppointments';
import { PaymentReminders } from '@/components/dashboard/PaymentReminders';
import { NotificationSettings } from '@/components/notifications/NotificationSettings';
import { MuralNoticesBell } from '@/components/dashboard/MuralNoticesBell';
import { InternalAlertsBell } from '@/components/dashboard/InternalAlertsBell';
import { MissingEvolutionsAlert } from '@/components/dashboard/MissingEvolutionsAlert';
import { PendingEnrollmentsCard } from '@/components/dashboard/PendingEnrollmentsCard';
import { ClinicAlertsCard } from '@/components/dashboard/ClinicAlertsCard';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useOrgPermissions } from '@/hooks/useOrgPermissions';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Crown, CalendarClock, DollarSign, ArrowRight } from 'lucide-react';
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
  const { selectedDate, appointments, tasks, evolutions, clinics, loadAllEvolutions } = useApp();
  const { user } = useAuth();
  const { subscribed, productId, subscriptionEnd, loading: subLoading } = useSubscription();
  const { isOrgMember, isOwner, role } = useOrgPermissions();
  const isTherapistView = isOrgMember && !isOwner && role === 'professional';

  const [todayPrivate, setTodayPrivate] = useState<number>(0);
  const todayStr = toLocalDateString(new Date());

  useEffect(() => {
    if (!user || clinics.length === 0) return;
    loadAllEvolutions();
  }, [user, clinics.length]);

  useEffect(() => {
    if (!user) return;
    supabase.from('private_appointments').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('date', todayStr)
      .then(({ count }) => { setTodayPrivate(count ?? 0); });
  }, [user, todayStr]);

  const planName = productId ? (PLAN_NAMES[productId] || 'Ativo') : null;
  const endDateStr = subscriptionEnd
    ? format(new Date(subscriptionEnd), "dd/MM/yyyy")
    : null;

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto pb-24 space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-semibold text-foreground mb-0.5">
            {getGreeting()}! 👋
          </h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <MuralNoticesBell />
          <InternalAlertsBell />

          {!subLoading && (
            <div className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl border text-sm",
              subscribed
                ? "bg-primary/5 border-primary/20 text-primary"
                : "bg-muted border-border text-muted-foreground"
            )}>
              <Crown className="w-4 h-4" />
              <span className="font-medium">
                {subscribed ? `Plano ${planName || 'Ativo'}` : 'Teste Gratuito'}
              </span>
              {subscribed && endDateStr && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarClock className="w-3 h-3" /> até {endDateStr}
                </span>
              )}
              {!subscribed && (
                <Badge variant="secondary" className="text-xs">30 dias</Badge>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Faixa de pendências (colapsa quando vazia) ─────────────────── */}
      {!isTherapistView && (
        <div className="space-y-3">
          {/* Cada componente abaixo só renderiza quando há pendências */}
          <MissingEvolutionsAlert />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PaymentReminders />
            <PendingEnrollmentsCard />
          </div>
          <ClinicAlertsCard />
        </div>
      )}

      {isTherapistView && (
        <Link
          to="/minhas-comissoes"
          className="block rounded-xl border border-primary/20 bg-primary/5 p-4 hover:bg-primary/10 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Minhas Comissões</p>
                <p className="text-xs text-muted-foreground">Veja seus ganhos e sessões do mês</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-primary" />
          </div>
        </Link>
      )}

      {/* ── Grade principal ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* Coluna principal — "Hoje" como herói */}
        <div className="lg:col-span-8 space-y-5">
          <TodayAppointments />
          <TaskList />
        </div>

        {/* Coluna lateral — stats + calendário + aniversários + notificações */}
        <div className="lg:col-span-4 space-y-5">
          <StatsCards />
          <MiniCalendar />
          <BirthdayCard />
          <NotificationSettings />
        </div>
      </div>
    </div>
  );
}
