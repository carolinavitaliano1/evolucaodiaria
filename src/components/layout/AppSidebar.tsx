import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  Calendar,
  DollarSign,
  ClipboardList,
  Heart,
  BarChart3,
  User
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
    <aside className="hidden lg:flex flex-col w-64 min-h-screen bg-card border-r border-border">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
            <Heart className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-foreground">Diário do</h1>
            <p className="text-sm text-primary font-semibold">Terapeuta</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname === to || 
            (to !== '/' && location.pathname.startsWith(to));
          
          return (
            <NavLink
              key={to}
              to={to}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
                'hover:bg-secondary/80 group',
                isActive && 'bg-primary text-primary-foreground shadow-glow'
              )}
            >
              <Icon className={cn(
                'w-5 h-5 transition-transform group-hover:scale-110',
                isActive ? 'text-primary-foreground' : 'text-muted-foreground'
              )} />
              <span className={cn(
                'font-medium',
                isActive ? 'text-primary-foreground' : 'text-foreground'
              )}>
                {label}
              </span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <NavLink
          to="/profile"
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-xl transition-all',
            'hover:bg-secondary/80 group',
            location.pathname === '/profile' && 'bg-primary text-primary-foreground'
          )}
        >
          <User className={cn(
            'w-5 h-5 transition-transform group-hover:scale-110',
            location.pathname === '/profile' ? 'text-primary-foreground' : 'text-muted-foreground'
          )} />
          <span className={cn(
            'font-medium',
            location.pathname === '/profile' ? 'text-primary-foreground' : 'text-foreground'
          )}>
            Meu Perfil
          </span>
        </NavLink>
      </div>
    </aside>
  );
}
