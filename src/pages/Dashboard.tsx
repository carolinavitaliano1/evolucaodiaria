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
import { Crown, CalendarClock, DollarSign, ArrowRight, TrendingUp, UserPlus, AlertTriangle, ChevronRight, Settings } from 'lucide-react';
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

type PendingId = 'evolucoes' | 'pagamentos' | 'precadastros' | 'alertas';

export default function Dashboard() {
  const { clinics, loadAllEvolutions } = useApp();
  const { user } = useAuth();
  const { subscribed, productId, subscriptionEnd, loading: subLoading } = useSubscription();
  const { isOrgMember, isOwner, role } = useOrgPermissions();
  const isTherapistView = isOrgMember && !isOwner && role === 'professional';

  // Faixa de pendências: contagem de cada componente + qual está expandido
  const [counts, setCounts] = useState<Record<PendingId, number>>({
    evolucoes: 0, pagamentos: 0, precadastros: 0, alertas: 0,
  });
  const [expanded, setExpanded] = useState<PendingId | null>(null);
  const setCount = (id: PendingId, n: number) =>
    setCounts(prev => (prev[id] === n ? prev : { ...prev, [id]: n }));

  useEffect(() => {
    if (!user || clinics.length === 0) return;
    loadAllEvolutions();
  }, [user, clinics.length]);

  const planName = productId ? (PLAN_NAMES[productId] || 'Ativo') : null;
  const endDateStr = subscriptionEnd ? format(new Date(subscriptionEnd), 'dd/MM/yyyy') : null;

  // Definição das 4 pendências (ícone, rótulo, descrição, tom)
  const PENDING: { id: PendingId; icon: typeof TrendingUp; label: string; desc: string; tone: 'warn' | 'info' }[] = [
    { id: 'evolucoes', icon: TrendingUp, label: 'Evoluções sem registro', desc: 'Atendimentos sem evolução', tone: 'warn' },
    { id: 'pagamentos', icon: DollarSign, label: 'Pagamentos a receber', desc: 'Vencendo em breve', tone: 'warn' },
    { id: 'precadastros', icon: UserPlus, label: 'Pré-cadastros', desc: 'Fichas aguardando revisão', tone: 'info' },
    { id: 'alertas', icon: AlertTriangle, label: 'Alertas da clínica', desc: 'Pendências e avisos', tone: 'info' },
  ];
  const visiblePending = PENDING.filter(p => counts[p.id] > 0);

  return (
    <div className="p-4 lg:p-6 max-w-[1180px] mx-auto pb-24 space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-foreground mb-0.5">
            {getGreeting()}, {(user?.user_metadata?.name as string)?.split(' ')[0] || 'bem-vindo'}! 👋
          </h1>
          <p className="text-sm text-muted-foreground capitalize">
            {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <MuralNoticesBell />
          <InternalAlertsBell />
          {!subLoading && (
            <div className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl border text-sm',
              subscribed ? 'bg-primary/5 border-primary/20 text-primary' : 'bg-muted border-border text-muted-foreground'
            )}>
              <Crown className="w-4 h-4" />
              <span className="font-medium">{subscribed ? `Plano ${planName || 'Ativo'}` : 'Teste Gratuito'}</span>
              {subscribed && endDateStr && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarClock className="w-3 h-3" /> até {endDateStr}
                </span>
              )}
              {!subscribed && <Badge variant="secondary" className="text-xs">30 dias</Badge>}
            </div>
          )}
        </div>
      </div>

      {/* ── Stats no topo (Clínicas, Pacientes, Hoje, Faturamento) ───── */}
      <StatsCards />

      {/* ── Faixa de pendências (colapsa quando vazia) ──────────────────── */}
      {!isTherapistView && (
        <>
          {visiblePending.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {visiblePending.map(p => {
                const Icon = p.icon;
                const isOpen = expanded === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setExpanded(isOpen ? null : p.id)}
                    className={cn(
                      'flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all hover:-translate-y-0.5',
                      p.tone === 'warn'
                        ? 'border-warning/40 bg-warning/[0.06] hover:shadow-md'
                        : 'border-primary/30 bg-primary/[0.05] hover:shadow-md',
                      isOpen && 'ring-2 ring-offset-1 ' + (p.tone === 'warn' ? 'ring-warning/40' : 'ring-primary/40')
                    )}
                  >
                    <span className={cn(
                      'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                      p.tone === 'warn' ? 'bg-warning/15 text-warning' : 'bg-primary/10 text-primary'
                    )}>
                      <Icon className="w-[18px] h-[18px]" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-1.5 text-[12.5px] font-bold text-foreground">
                        <span className="truncate">{p.label}</span>
                        <span className={cn(
                          'text-[10px] font-extrabold min-w-[18px] h-[18px] px-1 rounded-full inline-flex items-center justify-center text-white shrink-0',
                          p.tone === 'warn' ? 'bg-warning' : 'bg-primary'
                        )}>
                          {counts[p.id]}
                        </span>
                      </span>
                      <span className="block text-[11px] text-muted-foreground truncate">{p.desc}</span>
                    </span>
                    <ChevronRight className={cn('w-4 h-4 text-muted-foreground transition-transform shrink-0', isOpen && 'rotate-90')} />
                  </button>
                );
              })}
            </div>
          )}

          {/* Componentes ricos: sempre montados (para reportar contagem via onCount),
              mas visíveis só quando o card correspondente está expandido.
              `hidden` = display:none não desmonta, então a contagem continua atualizando. */}
          <div className={expanded === 'evolucoes' ? '' : 'hidden'}>
            <MissingEvolutionsAlert onCount={n => setCount('evolucoes', n)} />
          </div>
          <div className={expanded === 'pagamentos' ? '' : 'hidden'}>
            <PaymentReminders onCount={n => setCount('pagamentos', n)} />
          </div>
          <div className={expanded === 'precadastros' ? '' : 'hidden'}>
            <PendingEnrollmentsCard onCount={n => setCount('precadastros', n)} />
          </div>
          <div className={expanded === 'alertas' ? '' : 'hidden'}>
            <ClinicAlertsCard onCount={n => setCount('alertas', n)} />
          </div>
        </>
      )}

      {isTherapistView && (
        <Link
          to="/minhas-comissoes"
          className="block rounded-2xl border border-primary/20 bg-primary/5 p-4 hover:bg-primary/10 transition-colors"
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

      {/* ── Grade: Hoje (herói) + coluna lateral ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
        {/* Coluna principal */}
        <div className="flex flex-col gap-4 min-w-0">
          <TodayAppointments />
          <TaskList />
        </div>

        {/* Coluna lateral */}
        <div className="flex flex-col gap-4">
          <MiniCalendar />
          <BirthdayCard />
        </div>
      </div>
    </div>
  );
}

