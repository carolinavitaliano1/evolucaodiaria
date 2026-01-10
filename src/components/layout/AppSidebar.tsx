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
  Stethoscope
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/clinics', icon: Building2, label: 'Clínicas' },
  { to: '/patients', icon: Users, label: 'Pacientes' },
  { to: '/calendar', icon: Calendar, label: 'Agenda' },
  { to: '/financial', icon: DollarSign, label: 'Financeiro' },
  { to: '/reports', icon: BarChart3, label: 'Relatórios' },
  { to: '/tasks', icon: ClipboardList, label: 'Tarefas' },
];

export function AppSidebar() {
  const location = useLocation();

  return (
    <aside className="hidden lg:flex flex-col w-60 min-h-screen bg-card border-r border-border">
      {/* Logo */}
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <Stethoscope className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-semibold text-foreground text-sm">Diário do</h1>
            <p className="text-sm text-primary font-semibold">Terapeuta</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5">
        {navItems.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname === to || 
            (to !== '/' && location.pathname.startsWith(to));
          
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
              <Icon className={cn(
                'w-[18px] h-[18px]',
                isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-accent-foreground'
              )} />
              <span className={cn(
                'text-sm font-medium',
                isActive ? 'text-primary-foreground' : 'text-foreground group-hover:text-accent-foreground'
              )}>
                {label}
              </span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border">
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
      </div>
    </aside>
  );
}
