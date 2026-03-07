import { NavLink, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useUnreadNotices } from '@/hooks/useUnreadNotices';
import { useOrgPermissions } from '@/hooks/useOrgPermissions';
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
  HeadphonesIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ThemeToggle } from './ThemeToggle';

const mainNavItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Home',      perm: 'dashboard.view' as const },
  { to: '/clinics',   icon: Building2,       label: 'Clínicas',  perm: 'clinics.view'   as const },
  { to: '/patients',  icon: Users,           label: 'Pacientes', perm: 'patients.view'  as const },
  { to: '/calendar',  icon: Calendar,        label: 'Agenda',    perm: 'calendar.view'  as const },
];

const moreNavItems = [
  { to: '/financial',  icon: DollarSign,   label: 'Finanças',      perm: 'financial.view'  as const },
  { to: '/reports',    icon: BarChart3,    label: 'Relatórios',    perm: 'reports.view'    as const },
  { to: '/ai-reports', icon: Sparkles,     label: 'Relatórios IA', perm: 'ai_reports.view' as const },
  { to: '/tasks',      icon: ClipboardList,label: 'Tarefas',       perm: 'tasks.view'      as const },
  { to: '/mural',      icon: Megaphone,    label: 'Mural',         perm: 'mural.view'      as const, badge: true },
  { to: '/pricing',    icon: CreditCard,   label: 'Planos',        perm: null },
  { to: '/install',    icon: Smartphone,   label: 'Instalar App',  perm: null },
  { to: '/profile',    icon: User,         label: 'Perfil',        perm: null },
];

export function MobileNav() {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const { unreadCount } = useUnreadNotices();
  const { isOrgMember, isOwner, permissions } = useOrgPermissions();

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

  // Show Team for all non-org-members (owners/standalone see em breve or full page)
  const showTeam = !isOrgMember || isOwner || permissions.includes('team.view' as any);
  const teamItem = showTeam ? [{ to: '/team', icon: UsersRound, label: 'Equipe', perm: 'team.view' as const }] : [];
  const finalMore = [...allowedMore.filter(i => i.to !== '/profile'), ...teamItem, { to: '/profile', icon: User, label: 'Perfil', perm: null as any }];

  const isMoreActive = finalMore.some(item =>
    location.pathname === item.to ||
    (item.to !== '/' && location.pathname.startsWith(item.to))
  );

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
              <div className={cn(
                'p-1.5 rounded-lg transition-colors',
                isActive && 'bg-primary'
              )}>
                <Icon className={cn(
                  'w-5 h-5',
                  isActive ? 'text-primary-foreground' : 'text-muted-foreground'
                )} />
              </div>
              <span className={cn(
                'text-[10px] font-medium',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}>
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
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                    {unreadCount > 9 ? '9+' : unreadCount}
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
            <div className="py-2 space-y-2">
              {finalMore.map((item) => {
                const to = item.to;
                const Icon = item.icon;
                const label = item.label;
                const badge = 'badge' in item ? item.badge : false;
                const isActive = location.pathname === to || 
                  (to !== '/' && location.pathname.startsWith(to));
                const showBadge = badge && unreadCount > 0;
                
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
                    {showBadge && (
                      <span className="bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                        {unreadCount > 9 ? '9+' : unreadCount}
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
