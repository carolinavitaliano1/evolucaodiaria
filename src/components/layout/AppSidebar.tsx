import { NavLink, useLocation } from 'react-router-dom';
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
  Clock,
  Lock,
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const allNavItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard',    perm: 'dashboard.view' as const },
  { to: '/clinics',   icon: Building2,       label: 'Clínicas',     perm: 'clinics.view'   as const },
  { to: '/patients',  icon: Users,           label: 'Pacientes',    perm: 'patients.view'  as const, badge: 'pending' as const },
  { to: '/calendar',  icon: Calendar,        label: 'Agenda',       perm: 'calendar.view'  as const },
  { to: '/financial', icon: DollarSign,      label: 'Financeiro',   perm: 'financial.view' as const },
  { to: '/reports',   icon: BarChart3,       label: 'Relatórios',   perm: 'reports.view'   as const },
  { to: '/ai-reports',icon: Sparkles,        label: 'Relatórios IA',perm: 'ai_reports.view'as const },
  { to: '/tasks',     icon: ClipboardList,   label: 'Tarefas',      perm: 'tasks.view'     as const },
  { to: '/mural',     icon: Megaphone,       label: 'Mural',        perm: 'mural.view'     as const, badge: 'notices' as const },
  { to: '/suporte',   icon: HeadphonesIcon,  label: 'Suporte',      perm: null,            badge: 'support' as const },
  { to: '/pricing',   icon: CreditCard,      label: 'Planos',       perm: null             },
  { to: '/install',   icon: Smartphone,      label: 'Instalar App', perm: null             },
];

export function AppSidebar() {
  const location = useLocation();
  const { signOut } = useAuth();
  const { theme } = useTheme();
  const { unreadCount } = useUnreadNotices();
  const { unreadCount: supportUnread } = useUnreadSupportCount();
  const { count: pendingCount } = usePendingEnrollments();
  const { isOrgMember, isOwner, permissions } = useOrgPermissions();
  const { productId, subscriptionEnd } = useSubscription();

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

  // Build nav list: org members see all items but restricted ones are shown as locked
  // Non-org users / owners see everything normally; pricing/install hidden for org members
  const navItemsWithAccess = allNavItems.map(item => {
    if (!isOrgMember) return { ...item, locked: false, hidden: false };
    if (item.perm === null) return { ...item, locked: false, hidden: true }; // hide pricing/install
    const hasAccess = permissions.includes(item.perm as any);
    return { ...item, locked: !hasAccess, hidden: false };
  }).filter(i => !i.hidden);

  // Show /team for everyone (non-owners see "em breve" page)
  const showTeam = !isOrgMember || isOwner || permissions.includes('team.view' as any);

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

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {/* Perfil — primeiro item */}
        <NavLink
          to="/profile"
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
            'hover:bg-accent group',
            location.pathname === '/profile' && 'bg-primary text-primary-foreground'
          )}
        >
          <User className={cn(
            'w-[18px] h-[18px]',
            location.pathname === '/profile' ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-accent-foreground'
          )} />
          <span className={cn(
            'text-sm font-medium flex-1',
            location.pathname === '/profile' ? 'text-primary-foreground' : 'text-foreground group-hover:text-accent-foreground'
          )}>
            Meu Perfil
          </span>
        </NavLink>

        {navItemsWithAccess.map(({ to, icon: Icon, label, badge, locked }) => {
          const isActive = !locked && (location.pathname === to || 
            (to !== '/' && location.pathname.startsWith(to)));
          const badgeCount = badge === 'notices' ? unreadCount : badge === 'support' ? supportUnread : badge === 'pending' ? pendingCount : 0;
          const showBadge = badgeCount > 0 && !locked;
          
          return (
            <div key={to}>
              {locked ? (
                <Tooltip>
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
              ) : (
                <NavLink
                  to={to}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                    'hover:bg-accent group',
                    isActive && 'bg-primary text-primary-foreground'
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
                    'text-sm font-medium flex-1',
                    isActive ? 'text-primary-foreground' : 'text-foreground group-hover:text-accent-foreground'
                  )}>
                    {label}
                  </span>
                  {showBadge && (
                    <span className="ml-auto bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                      {badgeCount > 9 ? '9+' : badgeCount}
                    </span>
                  )}
                </NavLink>
              )}

              {/* Equipe — logo após Mural */}
              {to === '/mural' && showTeam && (
                <NavLink
                  to="/team"
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                    'hover:bg-accent group',
                    location.pathname.startsWith('/team') && 'bg-primary text-primary-foreground'
                  )}
                >
                  <UsersRound className={cn(
                    'w-[18px] h-[18px]',
                    location.pathname.startsWith('/team') ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-accent-foreground'
                  )} />
                  <span className={cn(
                    'text-sm font-medium flex-1',
                    location.pathname.startsWith('/team') ? 'text-primary-foreground' : 'text-foreground group-hover:text-accent-foreground'
                  )}>
                    Equipe
                  </span>
                </NavLink>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border space-y-0.5">
        {/* Trial badge */}
        {trialDaysLeft !== null && (
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
