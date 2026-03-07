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
  UsersRound
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ThemeToggle } from './ThemeToggle';
import { useTheme } from '@/contexts/ThemeContext';
import { useUnreadNotices } from '@/hooks/useUnreadNotices';
import { useOrgPermissions } from '@/hooks/useOrgPermissions';

const allNavItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard',    perm: 'dashboard.view' as const, orgOnly: false },
  { to: '/clinics',   icon: Building2,       label: 'Clínicas',     perm: 'clinics.view'   as const, orgOnly: false },
  { to: '/patients',  icon: Users,           label: 'Pacientes',    perm: 'patients.view'  as const, orgOnly: false },
  { to: '/calendar',  icon: Calendar,        label: 'Agenda',       perm: 'calendar.view'  as const, orgOnly: false },
  { to: '/financial', icon: DollarSign,      label: 'Financeiro',   perm: 'financial.view' as const, orgOnly: false },
  { to: '/reports',   icon: BarChart3,       label: 'Relatórios',   perm: 'reports.view'   as const, orgOnly: false },
  { to: '/ai-reports',icon: Sparkles,        label: 'Relatórios IA',perm: 'ai_reports.view'as const, orgOnly: false },
  { to: '/tasks',     icon: ClipboardList,   label: 'Tarefas',      perm: 'tasks.view'     as const, orgOnly: false },
  { to: '/mural',     icon: Megaphone,       label: 'Mural',        perm: 'mural.view'     as const, badge: true, orgOnly: false },
  { to: '/pricing',   icon: CreditCard,      label: 'Planos',       perm: null,                      orgOnly: false },
  { to: '/install',   icon: Smartphone,      label: 'Instalar App', perm: null,                      orgOnly: false },
];

export function AppSidebar() {
  const location = useLocation();
  const { signOut } = useAuth();
  const { theme } = useTheme();
  const { unreadCount } = useUnreadNotices();
  const { isOrgMember, isOwner, permissions } = useOrgPermissions();

  const handleLogout = async () => {
    await signOut();
    toast.success('Você saiu do sistema');
  };

  // For org members (non-owners), filter items by their permissions.
  // Owners and non-org users see everything.
  const navItems = allNavItems.filter(item => {
    if (!isOrgMember) return true;          // owner or standalone user
    if (item.perm === null) return false;   // hide pricing/install for org members
    return permissions.includes(item.perm as any);
  });

  // Show /team link only for org owners or org members with team.view permission
  const showTeam = isOwner || (isOrgMember && permissions.includes('team.view' as any));

  return (
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
        {navItems.map(({ to, icon: Icon, label, badge }) => {
          const isActive = location.pathname === to || 
            (to !== '/' && location.pathname.startsWith(to));
          const showBadge = badge && unreadCount > 0;
          
          return (
            <NavLink
              key={to}
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
                    {unreadCount > 9 ? '9+' : unreadCount}
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
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </NavLink>
          );
        })}

        {/* Equipe — exclusive section for org owners/members */}
        {showTeam && (
          <>
            <div className="pt-2 pb-1 px-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Equipe</p>
            </div>
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
                Gestão de Equipe
              </span>
            </NavLink>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border space-y-0.5">
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
            'text-sm font-medium',
            location.pathname === '/profile' ? 'text-primary-foreground' : 'text-foreground group-hover:text-accent-foreground'
          )}>
            Meu Perfil
          </span>
        </NavLink>

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
  );
}
