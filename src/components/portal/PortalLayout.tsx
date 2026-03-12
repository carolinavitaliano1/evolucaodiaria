import { NavLink, useLocation } from 'react-router-dom';
import { Home, MessageSquare, FileText, LogOut, Bell, DollarSign, FolderOpen } from 'lucide-react';
import { usePortal } from '@/contexts/PortalContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/portal/home', icon: Home, label: 'Início' },
  { to: '/portal/mensagens', icon: MessageSquare, label: 'Chat' },
  { to: '/portal/avisos', icon: Bell, label: 'Avisos' },
  { to: '/portal/financeiro', icon: DollarSign, label: 'Financeiro' },
  { to: '/portal/ficha', icon: FileText, label: 'Ficha' },
  { to: '/portal/documentos', icon: FolderOpen, label: 'Docs' },
];

export function PortalLayout({ children }: { children: React.ReactNode }) {
  const { patient, unreadCount, portalAccount } = usePortal();
  const { signOut } = useAuth();
  const location = useLocation();
  const [unreadNotices, setUnreadNotices] = useState(0);

  useEffect(() => {
    if (!portalAccount) return;
    supabase
      .from('portal_notices')
      .select('id', { count: 'exact' })
      .eq('patient_id', portalAccount.patient_id)
      .eq('read_by_patient', false)
      .then(({ count }) => setUnreadNotices(count || 0));
  }, [portalAccount, location.pathname]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex flex-col">
      {/* Top header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-xs font-bold">ED</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-tight">Portal do Paciente</p>
              {patient && <p className="text-xs text-muted-foreground leading-tight">{patient.name}</p>}
            </div>
          </div>
          <button
            onClick={signOut}
            className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-muted"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 pb-24">
        {children}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur border-t border-border">
        <div className="max-w-lg mx-auto flex items-center justify-around h-16 px-2">
          {navItems.map(({ to, icon: Icon, label }) => {
            const active = location.pathname === to;
            const badge =
              to === '/portal/mensagens' && unreadCount > 0 ? unreadCount
              : to === '/portal/avisos' && unreadNotices > 0 ? unreadNotices
              : 0;
            return (
              <NavLink
                key={to}
                to={to}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all relative',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <div className="relative">
                  <Icon className={cn('w-5 h-5', active && 'text-primary')} />
                  {badge > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </div>
                <span className={cn('text-[10px] font-medium', active && 'text-primary')}>{label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
