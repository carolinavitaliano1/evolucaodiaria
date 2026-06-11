import { NavLink, useLocation } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  Calendar,
  DollarSign,
  ClipboardList,
  BarChart3,
  User,
  BookOpen,
  LogOut,
  CreditCard,
  Sparkles,
  Smartphone,
  Megaphone,
  UsersRound,
  HeadphonesIcon,
  FileSignature,
  NotebookPen,
  Clock,
  Lock,
  Layers,
  Video,
  Search,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ThemeToggle } from './ThemeToggle';
import { useTheme } from '@/contexts/ThemeContext';
import { useUnreadNotices } from '@/hooks/useUnreadNotices';
import { useUnreadSupportCount } from '@/hooks/useUnreadSupport';
import { usePendingEnrollments } from '@/hooks/usePendingEnrollments';
import { useOrgPermissions } from '@/hooks/useOrgPermissions';
import { useSubscription } from '@/hooks/useSubscription';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { useTelehealthAccess } from '@/hooks/useTelehealthAccess';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';

// Destinos individuais (sem ordem). Agrupamento e ordem ficam em NAV_GROUPS abaixo.
type NavItem = {
  to: string;
  icon: any;
  label: string;
  perm: string | null;
  badge?: 'pending' | 'notices' | 'support';
  ai?: boolean;
};

const NAV_DEST: Record<string, NavItem> = {
  dashboard:    { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard',     perm: 'dashboard.view' },
  patients:     { to: '/patients',   icon: Users,           label: 'Pacientes',     perm: 'patients.view', badge: 'pending' },
  calendar:     { to: '/calendar',   icon: Calendar,        label: 'Agenda',        perm: 'calendar.view' },
  evolucoes:    { to: '/evolucoes',  icon: NotebookPen,     label: 'Evoluções',     perm: 'evolutions.view' },
  tasks:        { to: '/tasks',      icon: ClipboardList,   label: 'Tarefas',       perm: 'tasks.view' },
  telechamadas: { to: '/telechamadas', icon: Video,         label: 'Telechamadas',  perm: null },
  clinics:      { to: '/clinics',    icon: Building2,       label: 'Clínicas',      perm: 'clinics.view' },
  financial:    { to: '/financial',  icon: DollarSign,      label: 'Financeiro',    perm: 'financial.view' },
  reports:      { to: '/reports',    icon: BarChart3,       label: 'Relatórios',    perm: 'reports.view' },
  mural:        { to: '/mural',      icon: Megaphone,       label: 'Mural',         perm: 'mural.view', badge: 'notices' },
  aiReports:    { to: '/ai-reports', icon: Sparkles,        label: 'Relatórios IA', perm: 'ai_reports.view', ai: true },
  docIa:        { to: '/doc-ia',     icon: FileSignature,   label: 'Doc IA',        perm: null, ai: true },
  profile:      { to: '/profile',    icon: User,            label: 'Meu Perfil',    perm: null },
  modulos:      { to: '/modulos',    icon: Layers,          label: 'Módulos',       perm: null },
  pricing:      { to: '/pricing',    icon: CreditCard,      label: 'Planos',        perm: null },
  install:      { to: '/install',    icon: Smartphone,      label: 'Instalar App',  perm: null },
  suporte:      { to: '/suporte',    icon: HeadphonesIcon,  label: 'Suporte',       perm: null, badge: 'support' },
  admin:        { to: '/admin/usuarios', icon: Users,       label: 'Admin · Usuários', perm: null },
  minhasComissoes: { to: '/minhas-comissoes', icon: DollarSign, label: 'Minhas Comissões', perm: 'commissions.view' },
};

const NAV_GROUPS: { label: string; items: string[] }[] = [
  { label: 'Início',         items: ['dashboard'] },
  { label: 'Atendimento',    items: ['patients', 'calendar', 'evolucoes', 'tasks', 'telechamadas'] },
  { label: 'Gestão',         items: ['clinics', 'financial', 'reports', 'mural'] },
  { label: 'Inteligência',   items: ['aiReports', 'docIa'] },
  { label: 'Conta & Ajuda',  items: ['profile', 'modulos', 'pricing', 'install', 'suporte', 'admin'] },
];

const THERAPIST_GROUPS: { label: string; items: string[] }[] = [
  { label: 'Início',      items: ['dashboard'] },
  { label: 'Atendimento', items: ['patients', 'calendar', 'evolucoes', 'tasks'] },
  { label: 'Conta & Ajuda', items: ['profile', 'minhasComissoes', 'suporte'] },
];

export function AppSidebar() {
  const location = useLocation();
  const { signOut } = useAuth();
  const { theme } = useTheme();
  const { unreadCount } = useUnreadNotices();
  const { unreadCount: supportUnread } = useUnreadSupportCount();
  const { count: pendingCount } = usePendingEnrollments();
  const { isOrgMember, isOwner, role, permissions, loading: permsLoading } = useOrgPermissions();
  const { productId, subscriptionEnd } = useSubscription();
  const { hasAI, hasTeam } = useFeatureAccess();
  const telehealth = useTelehealthAccess();
  const { user } = useAuth();
  const forceIndividualPro = user?.email === 'carolinavitaliano1@gmail.com';
  const isClinicaProOnly = hasTeam && !forceIndividualPro;
  const OWNER_EMAILS = ['carolinavitaliano1@gmail.com'];
  const isAppOwner = !!user?.email && OWNER_EMAILS.includes(user.email.toLowerCase());
  const [query, setQuery] = useState('');

  // Calculate trial days remaining
  const trialDaysLeft = (() => {
    if (productId !== 'trial' || !subscriptionEnd) return null;
    const diff = new Date(subscriptionEnd).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : null;
  })();

  const handleLogout = async () => {
    await signOut();
    toast.success('Você saiu do sistema');
  };

  // Evita "flash" do menu de admin antes de sabermos a função real do usuário.
  // Renderiza um esqueleto até o hook de permissões resolver.
  if (permsLoading) {
    return (
      <aside className={cn(
        "hidden lg:flex flex-col w-60 min-h-screen border-r border-border",
        theme === 'lilas' ? 'sidebar-lilas' : 'bg-card'
      )}>
        <div className="p-5 border-b border-border">
          <Skeleton className="h-9 w-40" />
        </div>
        <div className="flex-1 p-3 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </aside>
    );
  }

  const isTherapistView = isOrgMember && !isOwner && role === 'professional';
  const sourceGroups = isTherapistView ? THERAPIST_GROUPS : NAV_GROUPS;

  // Decide visibilidade/bloqueio por id de destino, preservando regras existentes.
  const resolveItem = (id: string): (NavItem & { locked: boolean; hidden: boolean }) | null => {
    const base = NAV_DEST[id];
    if (!base) return null;
    let item = { ...base };

    if (id === 'clinics' && isClinicaProOnly) item.label = 'Clínica';
    if (id === 'admin' && !isAppOwner) return { ...item, locked: false, hidden: true };
    if (id === 'telechamadas' && !telehealth.enabled) return { ...item, locked: false, hidden: true };

    if (!isOrgMember) return { ...item, locked: false, hidden: false };

    // Itens utilitários sem permissão escondem para colaboradores (mantém comportamento antigo)
    if (item.perm === null) {
      const utilHidden = ['modulos', 'pricing', 'install'];
      if (utilHidden.includes(id)) return { ...item, locked: false, hidden: true };
      return { ...item, locked: false, hidden: false };
    }
    const hasAccess = permissions.includes(item.perm as any);
    if (isTherapistView && !hasAccess) return { ...item, locked: true, hidden: true };
    return { ...item, locked: !hasAccess, hidden: false };
  };

  const q = query.trim().toLowerCase();
  const groupsResolved = sourceGroups
    .map(g => ({
      label: g.label,
      items: g.items
        .map(resolveItem)
        .filter((i): i is NavItem & { locked: boolean; hidden: boolean } => !!i && !i.hidden)
        .filter(i => !q || i.label.toLowerCase().includes(q)),
    }))
    .filter(g => g.items.length > 0);

  return (
    <TooltipProvider delayDuration={200}>
      <aside className={cn(
        "hidden lg:flex flex-col w-60 min-h-screen border-r border-border",
        theme === 'lilas' ? 'sidebar-lilas' : 'bg-card'
      )}>
      {/* Logo */}
      <div className="p-5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-foreground text-base">Evolução Diária</h1>
          </div>
        </div>
        <ThemeToggle />
      </div>

      {/* Busca */}
      <div className="px-3 pt-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar no menu..."
            className="w-full h-9 pl-8 pr-2.5 text-sm rounded-lg bg-muted/50 border border-transparent focus:border-primary/40 focus:bg-background focus:outline-none placeholder:text-muted-foreground/70"
          />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 overflow-y-auto">
        {groupsResolved.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            Nada encontrado para "{query}"
          </p>
        )}
        {groupsResolved.map(group => (
          <div key={group.label} className="mb-3 last:mb-0">
            <div className="px-2 pb-1.5 text-[11px] font-bold tracking-[0.06em] uppercase text-muted-foreground/80">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map(({ to, icon: Icon, label, badge, locked, ai }) => {
                const isActive = !locked && (location.pathname === to ||
                  (to !== '/' && location.pathname.startsWith(to)));
                const badgeCount = badge === 'notices' ? unreadCount : badge === 'support' ? supportUnread : badge === 'pending' ? pendingCount : 0;
                const showBadge = badgeCount > 0 && !locked;

                if (locked) {
                  return (
                    <Tooltip key={to}>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg opacity-40 cursor-not-allowed select-none">
                          <Icon className="w-[18px] h-[18px] text-muted-foreground" />
                          <span className="text-sm font-medium flex-1 text-foreground">{label}</span>
                          <Lock className="w-3 h-3 text-muted-foreground shrink-0" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="text-xs">
                        Sem permissão para acessar {label}
                      </TooltipContent>
                    </Tooltip>
                  );
                }
                return (
                  <NavLink
                    key={to}
                    to={to}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors',
                      'hover:bg-accent group',
                      isActive && 'bg-primary text-primary-foreground shadow-[0_8px_20px_-8px_hsl(var(--primary)/0.6)]'
                    )}
                  >
                    <div className="relative shrink-0">
                      <Icon className={cn(
                        'w-[18px] h-[18px]',
                        isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-accent-foreground'
                      )} />
                      {showBadge && (
                        <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                          {badgeCount > 9 ? '9+' : badgeCount}
                        </span>
                      )}
                    </div>
                    <span className={cn(
                      'text-sm font-medium flex-1 truncate',
                      isActive ? 'text-primary-foreground' : 'text-foreground group-hover:text-accent-foreground'
                    )}>
                      {label}
                    </span>
                    {ai && (
                      <span className={cn(
                        'text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded',
                        isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-primary/10 text-primary'
                      )}>
                        IA
                      </span>
                    )}
                    {showBadge && (
                      <span className="ml-auto bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                        {badgeCount > 9 ? '9+' : badgeCount}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border space-y-0.5">
        {/* Trial badge — apenas para o dono da conta (não exibir para terapeutas/colaboradores) */}
        {trialDaysLeft !== null && (!isOrgMember || isOwner) && (
          <NavLink
            to="/pricing"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 border border-warning/30 mb-2 hover:bg-warning/20 transition-colors"
          >
            <Clock className="w-3.5 h-3.5 text-warning shrink-0" />
            <span className="text-xs font-semibold text-warning flex-1">
              {trialDaysLeft} {trialDaysLeft === 1 ? 'dia' : 'dias'} de teste
            </span>
            <span className="text-[10px] text-warning/70">Assinar</span>
          </NavLink>
        )}

        <button
          onClick={handleLogout}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors w-full',
            'hover:bg-destructive/10 group text-left'
          )}
        >
          <LogOut className="w-[18px] h-[18px] text-muted-foreground group-hover:text-destructive" />
          <span className="text-sm font-medium text-foreground group-hover:text-destructive">
            Sair
          </span>
        </button>
      </div>
    </aside>
    </TooltipProvider>
  );
}
