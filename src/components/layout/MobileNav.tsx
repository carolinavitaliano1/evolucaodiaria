import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Building2, 
  Calendar,
  DollarSign,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Home' },
  { to: '/clinics', icon: Building2, label: 'Clínicas' },
  { to: '/calendar', icon: Calendar, label: 'Agenda' },
  { to: '/financial', icon: DollarSign, label: 'Finanças' },
  { to: '/profile', icon: User, label: 'Perfil' },
];

export function MobileNav() {
  const location = useLocation();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border safe-area-inset-bottom">
      <div className="flex justify-around items-center py-2 px-2">
        {navItems.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname === to || 
            (to !== '/' && location.pathname.startsWith(to));
          
          return (
            <NavLink
              key={to}
              to={to}
              className={cn(
                'flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-all',
                isActive && 'text-primary'
              )}
            >
              <div className={cn(
                'p-2 rounded-xl transition-all',
                isActive && 'gradient-primary shadow-glow'
              )}>
                <Icon className={cn(
                  'w-5 h-5',
                  isActive ? 'text-primary-foreground' : 'text-muted-foreground'
                )} />
              </div>
              <span className={cn(
                'text-xs font-medium',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}>
                {label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
