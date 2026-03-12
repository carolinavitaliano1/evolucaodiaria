import { NavLink, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useUnreadNotices } from '@/hooks/useUnreadNotices';
import { useUnreadSupportCount } from '@/hooks/useUnreadSupport';
import { usePendingEnrollments } from '@/hooks/usePendingEnrollments';
import { useOrgPermissions } from '@/hooks/useOrgPermissions';
import { useSubscription } from '@/hooks/useSubscription';
import { 
  LayoutDashboard, 
  Building2, 
  Calendar,
  DollarSign,
  User,
  MoreHorizontal,
  BarChart3,
  ClipboardList,
  Users,
  CreditCard,
  Sparkles,
  Smartphone,
  Megaphone,
  UsersRound,
  HeadphonesIcon,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ThemeToggle } from './ThemeToggle';

const mainNavItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Home',      perm: 'dashboard.view' as const },
  { to: '/clinics',   icon: Building2,       label: 'Clínicas',  perm: 'clinics.view'   as const },
  { to: '/patients',  icon: Users,           label: 'Pacientes', perm: 'patients.view'  as const, badge: 'pending' as const },
  { to: '/calendar',  icon: Calendar,        label: 'Agenda',    perm: 'calendar.view'  as const },
];

const moreNavItems = [
  { to: '/financial',  icon: DollarSign,     label: 'Finanças',      perm: 'financial.view'  as const, badge: null },
  { to: '/reports',    icon: BarChart3,      label: 'Relatórios',    perm: 'reports.view'    as const, badge: null },
  { to: '/ai-reports', icon: Sparkles,       label: 'Relatórios IA', perm: 'ai_reports.view' as const, badge: null },
  { to: '/tasks',      icon: ClipboardList,  label: 'Tarefas',       perm: 'tasks.view'      as const, badge: null },
  { to: '/mural',      icon: Megaphone,      label: 'Mural',         perm: 'mural.view'      as const, badge: 'notices' as const },
  { to: '/suporte',    icon: HeadphonesIcon, label: 'Suporte',       perm: null,                       badge: 'support' as const },
  { to: '/pricing',    icon: CreditCard,     label: 'Planos',        perm: null,                       badge: null },
  { to: '/install',    icon: Smartphone,     label: 'Instalar App',  perm: null,                       badge: null },
  { to: '/profile',    icon: User,           label: 'Perfil',        perm: null,                       badge: null },
];

export function MobileNav() {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const { unreadCount: noticesCount } = useUnreadNotices();
  const { unreadCount: supportCount } = useUnreadSupportCount();
  const { isOrgMember, isOwner, permissions } = useOrgPermissions();
  const { productId, subscriptionEnd } = useSubscription();

  const trialDaysLeft = (() => {
    if (productId !== 'trial' || !subscriptionEnd) return null;
    const diff = new Date(subscriptionEnd).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : null;
  })();

  const allowedMain = mainNavItems.filter(i => {
    if (!isOrgMember) return true;
    return permissions.includes(i.perm as any);
  });

  const allowedMore = moreNavItems.filter(i => {
    if (!isOrgMember) return true;
    if (i.to === '/profile') return true;
    if (i.perm === null) return false;
    return permissions.includes(i.perm as any);
  });

  const showTeam = !isOrgMember || isOwner || permissions.includes('team.view' as any);
  const teamItem = showTeam ? [{ to: '/team', icon: UsersRound, label: 'Equipe', perm: 'team.view' as const, badge: null as any }] : [];
  const baseMore = [{ to: '/profile', icon: User, label: 'Perfil', perm: null as any, badge: null as any }, ...allowedMore.filter(i => i.to !== '/profile')];
  const muralIdx = baseMore.findIndex(i => i.to === '/mural');
  const finalMore = muralIdx >= 0 && teamItem.length > 0
    ? [...baseMore.slice(0, muralIdx + 1), ...teamItem, ...baseMore.slice(muralIdx + 1)]
    : [...baseMore, ...teamItem];

  // Total unread for the "Mais" button dot
  const totalMoreUnread = noticesCount + supportCount;

  const isMoreActive = finalMore.some(item =>
    location.pathname === item.to ||
    (item.to !== '/' && location.pathname.startsWith(item.to))
  );

  const getBadgeCount = (badge: string | null) => {
    if (badge === 'notices') return noticesCount;
    if (badge === 'support') return supportCount;
    return 0;
  };

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/98 backdrop-blur-sm border-t border-border">
      <div className="flex justify-around items-center py-1.5 px-2">
        {allowedMain.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname === to || 
            (to !== '/' && location.pathname.startsWith(to));
          
          return (
            <NavLink
              key={to}
              to={to}
              className={cn(
                'flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-lg transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <div className={cn('p-1.5 rounded-lg transition-colors', isActive && 'bg-primary')}>
                <Icon className={cn('w-5 h-5', isActive ? 'text-primary-foreground' : 'text-muted-foreground')} />
              </div>
              <span className={cn('text-[10px] font-medium', isActive ? 'text-primary' : 'text-muted-foreground')}>
                {label}
              </span>
            </NavLink>
          );
        })}

        {/* More Button with Sheet */}
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <button
              className={cn(
                'flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-lg transition-colors',
                isMoreActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <div className={cn('relative p-1.5 rounded-lg transition-colors', isMoreActive && 'bg-primary')}>
                <MoreHorizontal className={cn('w-5 h-5', isMoreActive ? 'text-primary-foreground' : 'text-muted-foreground')} />
                {totalMoreUnread > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                    {totalMoreUnread > 9 ? '9+' : totalMoreUnread}
                  </span>
                )}
              </div>
              <span className={cn('text-[10px] font-medium', isMoreActive ? 'text-primary' : 'text-muted-foreground')}>
                Mais
              </span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto rounded-t-2xl">
            <div className="flex items-center justify-between px-4 mb-2">
              <span className="text-sm font-semibold text-muted-foreground">Mais opções</span>
              <ThemeToggle />
            </div>
            {trialDaysLeft !== null && (
              <NavLink
                to="/pricing"
                onClick={() => setMoreOpen(false)}
                className="mx-4 mb-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 border border-warning/30 hover:bg-warning/20 transition-colors"
              >
                <Clock className="w-3.5 h-3.5 text-warning shrink-0" />
                <span className="text-xs font-semibold text-warning flex-1">
                  {trialDaysLeft} {trialDaysLeft === 1 ? 'dia' : 'dias'} de teste restantes
                </span>
                <span className="text-[10px] text-warning/80">Assinar</span>
              </NavLink>
            )}
            <div className="py-2 space-y-2">
              {finalMore.map((item) => {
                const to = item.to;
                const Icon = item.icon;
                const label = item.label;
                const isActive = location.pathname === to || 
                  (to !== '/' && location.pathname.startsWith(to));
                const badgeCount = getBadgeCount(item.badge);
                
                return (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      'flex items-center gap-4 px-4 py-3 rounded-xl transition-colors',
                      isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'
                    )}
                  >
                    <Icon className={cn('w-5 h-5', isActive ? 'text-primary-foreground' : 'text-muted-foreground')} />
                    <span className={cn('font-medium flex-1', isActive ? 'text-primary-foreground' : 'text-foreground')}>
                      {label}
                    </span>
                    {badgeCount > 0 && (
                      <span className="bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                        {badgeCount > 9 ? '9+' : badgeCount}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
