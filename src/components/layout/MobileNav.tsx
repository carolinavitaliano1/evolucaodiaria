import { NavLink, useLocation } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { useUnreadNotices } from '@/hooks/useUnreadNotices';
import { useUnreadSupportCount } from '@/hooks/useUnreadSupport';
import { usePendingEnrollments } from '@/hooks/usePendingEnrollments';
import { useOrgPermissions } from '@/hooks/useOrgPermissions';
import { useSubscription } from '@/hooks/useSubscription';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { useAuth } from '@/contexts/AuthContext';
import { useTelehealthAccess } from '@/hooks/useTelehealthAccess';
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
  Clock,
  FileSignature,
  Video,
  NotebookPen,
  Layers,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ThemeToggle } from './ThemeToggle';

type NavItem = {
  to: string;
  icon: any;
  label: string;
  perm: string | null;
  badge?: 'pending' | 'notices' | 'support' | null;
  ai?: boolean;
};

const NAV_DEST: Record<string, NavItem> = {
  dashboard:       { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard',     perm: 'dashboard.view' },
  patients:        { to: '/patients',   icon: Users,           label: 'Pacientes',     perm: 'patients.view', badge: 'pending' },
  calendar:        { to: '/calendar',   icon: Calendar,        label: 'Agenda',        perm: 'calendar.view' },
  evolucoes:       { to: '/evolucoes',  icon: NotebookPen,     label: 'Evoluções',     perm: 'evolutions.view' },
  tasks:           { to: '/tasks',      icon: ClipboardList,   label: 'Tarefas',       perm: 'tasks.view' },
  telechamadas:    { to: '/telechamadas', icon: Video,         label: 'Telechamadas',  perm: null },
  clinics:         { to: '/clinics',    icon: Building2,       label: 'Clínicas',      perm: 'clinics.view' },
  financial:       { to: '/financial',  icon: DollarSign,      label: 'Financeiro',    perm: 'financial.view' },
  reports:         { to: '/reports',    icon: BarChart3,       label: 'Relatórios',    perm: 'reports.view' },
  mural:           { to: '/mural',      icon: Megaphone,       label: 'Mural',         perm: 'mural.view', badge: 'notices' },
  aiReports:       { to: '/ai-reports', icon: Sparkles,        label: 'Relatórios IA', perm: 'ai_reports.view', ai: true },
  docIa:           { to: '/doc-ia',     icon: FileSignature,   label: 'Doc IA',        perm: null, ai: true },
  profile:         { to: '/profile',    icon: User,            label: 'Meu Perfil',    perm: null },
  modulos:         { to: '/modulos',    icon: Layers,          label: 'Módulos',       perm: null },
  pricing:         { to: '/pricing',    icon: CreditCard,      label: 'Planos',        perm: null },
  install:         { to: '/install',    icon: Smartphone,      label: 'Instalar App',  perm: null },
  suporte:         { to: '/suporte',    icon: HeadphonesIcon,  label: 'Suporte',       perm: null, badge: 'support' },
  admin:           { to: '/admin/usuarios', icon: Users,       label: 'Admin · Usuários', perm: null },
  minhasComissoes: { to: '/minhas-comissoes', icon: DollarSign, label: 'Minhas Comissões', perm: 'commissions.view' },
};

const NAV_GROUPS = [
  { label: 'Início',         items: ['dashboard'] },
  { label: 'Atendimento',    items: ['patients', 'calendar', 'evolucoes', 'tasks', 'telechamadas'] },
  { label: 'Gestão',         items: ['clinics', 'financial', 'reports', 'mural'] },
  { label: 'Inteligência',   items: ['aiReports', 'docIa'] },
  { label: 'Conta & Ajuda',  items: ['profile', 'modulos', 'pricing', 'install', 'suporte', 'admin'] },
];

const THERAPIST_GROUPS = [
  { label: 'Início',        items: ['dashboard'] },
  { label: 'Atendimento',   items: ['patients', 'calendar', 'evolucoes', 'tasks'] },
  { label: 'Conta & Ajuda', items: ['profile', 'minhasComissoes', 'suporte'] },
];

// Bottom bar: mesmos 4 atalhos para todos (terapeuta troca Financeiro por Comissões)
const BOTTOM_DEFAULT = ['dashboard', 'patients', 'calendar', 'financial'];
const BOTTOM_THERAPIST = ['dashboard', 'patients', 'calendar', 'minhasComissoes'];

export function MobileNav() {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { unreadCount: noticesCount } = useUnreadNotices();
  const { unreadCount: supportCount } = useUnreadSupportCount();
  const { count: pendingCount } = usePendingEnrollments();
  const { isOrgMember, isOwner, role, permissions, loading: permsLoading } = useOrgPermissions();
  const { productId, subscriptionEnd } = useSubscription();
  const { hasAI, hasTeam } = useFeatureAccess();
  const { user } = useAuth();
  const telehealth = useTelehealthAccess();
  const forceIndividualPro = user?.email === 'carolinavitaliano1@gmail.com';
  const isClinicaProOnly = hasTeam && !forceIndividualPro;
  const OWNER_EMAILS = ['carolinavitaliano1@gmail.com'];
  const isAppOwner = !!user?.email && OWNER_EMAILS.includes(user.email.toLowerCase());

  const trialDaysLeft = (() => {
    if (productId !== 'trial' || !subscriptionEnd) return null;
    const diff = new Date(subscriptionEnd).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : null;
  })();

  const isTherapistView = isOrgMember && !isOwner && role === 'professional';
  const sourceGroups = isTherapistView ? THERAPIST_GROUPS : NAV_GROUPS;

  // Esconde a navegação principal mobile quando o usuário está dentro do detalhe
  // de uma clínica — o menu interno da clínica assume a navegação.
  const isInsideClinicDetail = /^\/clinics\/[^/]+/.test(location.pathname);
  if (isInsideClinicDetail) return null;

  const resolveItem = (id: string): (NavItem & { locked: boolean; hidden: boolean }) | null => {
    const base = NAV_DEST[id];
    if (!base) return null;
    let item = { ...base };
    if (id === 'clinics' && isClinicaProOnly) item.label = 'Clínica';
    if (id === 'admin' && !isAppOwner) return { ...item, locked: false, hidden: true };
    if (id === 'telechamadas' && !telehealth.enabled) return { ...item, locked: false, hidden: true };
    if (!isOrgMember) return { ...item, locked: false, hidden: false };
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
        .filter((i): i is NavItem & { locked: boolean; hidden: boolean } => !!i && !i.hidden && !i.locked)
        .filter(i => !q || i.label.toLowerCase().includes(q)),
    }))
    .filter(g => g.items.length > 0);

  // Bottom bar: filtra ids do BOTTOM pelos itens visíveis ao usuário
  const bottomIds = isTherapistView ? BOTTOM_THERAPIST : BOTTOM_DEFAULT;
  const allowedMain = bottomIds
    .map(resolveItem)
    .filter((i): i is NavItem & { locked: boolean; hidden: boolean } => !!i && !i.hidden && !i.locked);

  const totalMoreUnread = noticesCount + supportCount;
  const bottomTos = new Set(allowedMain.map(i => i.to));
  const isMoreActive = !bottomTos.has(location.pathname) &&
    Array.from(bottomTos).every(to => !location.pathname.startsWith(to + '/'));

  // Evita flash da visão admin antes de sabermos a função real do usuário
  if (permsLoading) {
    return (
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/98 backdrop-blur-sm border-t border-border">
        <div className="flex justify-around items-center py-1.5 px-2 h-[62px]" />
      </nav>
    );
  }

  const getBadgeCount = (badge?: string | null) => {
    if (badge === 'notices') return noticesCount;
    if (badge === 'support') return supportCount;
    if (badge === 'pending') return pendingCount;
    return 0;
  };

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/98 backdrop-blur-sm border-t border-border">
      <div className="flex justify-around items-center py-1.5 px-2">
        {allowedMain.map(({ to, icon: Icon, label, badge }) => {
          const isActive = location.pathname === to || 
            (to !== '/' && location.pathname.startsWith(to));
          const badgeCount = getBadgeCount(badge);
          
          return (
            <NavLink
              key={to}
              to={to}
              className={cn(
                'flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-lg transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <div className={cn('relative p-1.5 rounded-lg transition-colors', isActive && 'bg-primary')}>
                <Icon className={cn('w-5 h-5', isActive ? 'text-primary-foreground' : 'text-muted-foreground')} />
                {badgeCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                    {badgeCount > 9 ? '9+' : badgeCount}
                  </span>
                )}
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
          <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl flex flex-col p-0">
            <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
              <span className="text-sm font-semibold text-foreground">Navegar</span>
              <ThemeToggle />
            </div>
            <div className="px-4 pb-2 shrink-0">
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
            <div className="flex-1 overflow-y-auto px-2 pb-6">
              {groupsResolved.length === 0 && (
                <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                  Nada encontrado para "{query}"
                </p>
              )}
              {groupsResolved.map(group => (
                <div key={group.label} className="mb-3">
                  <div className="px-3 pb-1.5 text-[11px] font-bold tracking-[0.06em] uppercase text-muted-foreground/80">
                    {group.label}
                  </div>
                  <div className="space-y-1">
                    {group.items.map(item => {
                      const { to, icon: Icon, label, badge, ai } = item;
                      const isActive = location.pathname === to ||
                        (to !== '/' && location.pathname.startsWith(to));
                      const badgeCount = getBadgeCount(badge);
                      return (
                        <NavLink
                          key={to}
                          to={to}
                          onClick={() => setMoreOpen(false)}
                          className={cn(
                            'flex items-center gap-3 px-3 py-3 rounded-xl transition-colors',
                            isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'
                          )}
                        >
                          <Icon className={cn('w-5 h-5', isActive ? 'text-primary-foreground' : 'text-muted-foreground')} />
                          <span className={cn('font-medium flex-1', isActive ? 'text-primary-foreground' : 'text-foreground')}>
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
                          {badgeCount > 0 && (
                            <span className="bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                              {badgeCount > 9 ? '9+' : badgeCount}
                            </span>
                          )}
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
