import { NavLink, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { 
  LayoutDashboard, 
  Building2, 
  Calendar,
  DollarSign,
  User,
  MoreHorizontal,
  BarChart3,
  ClipboardList,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const mainNavItems = [
  { to: '/', icon: LayoutDashboard, label: 'Home' },
  { to: '/clinics', icon: Building2, label: 'Clínicas' },
  { to: '/calendar', icon: Calendar, label: 'Agenda' },
  { to: '/financial', icon: DollarSign, label: 'Finanças' },
];

const moreNavItems = [
  { to: '/reports', icon: BarChart3, label: 'Relatórios' },
  { to: '/tasks', icon: ClipboardList, label: 'Tarefas' },
  { to: '/profile', icon: User, label: 'Perfil' },
];

export function MobileNav() {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const isMoreActive = moreNavItems.some(item => 
    location.pathname === item.to || 
    (item.to !== '/' && location.pathname.startsWith(item.to))
  );

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/98 backdrop-blur-sm border-t border-border">
      <div className="flex justify-around items-center py-1.5 px-2">
        {mainNavItems.map(({ to, icon: Icon, label }) => {
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
              <div className={cn(
                'p-1.5 rounded-lg transition-colors',
                isMoreActive && 'bg-primary'
              )}>
                <MoreHorizontal className={cn(
                  'w-5 h-5',
                  isMoreActive ? 'text-primary-foreground' : 'text-muted-foreground'
                )} />
              </div>
              <span className={cn(
                'text-[10px] font-medium',
                isMoreActive ? 'text-primary' : 'text-muted-foreground'
              )}>
                Mais
              </span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto rounded-t-2xl">
            <div className="py-4 space-y-2">
              {moreNavItems.map(({ to, icon: Icon, label }) => {
                const isActive = location.pathname === to || 
                  (to !== '/' && location.pathname.startsWith(to));
                
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
                    <Icon className={cn(
                      'w-5 h-5',
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
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
