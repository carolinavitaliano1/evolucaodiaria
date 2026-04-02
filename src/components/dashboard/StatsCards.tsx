import { Building2, Users, Calendar, DollarSign } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';
import { toLocalDateString } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { getDynamicSessionValue, calculateMensalRevenueWithDeductions } from '@/utils/dateHelpers';

export function StatsCards() {
  const { clinics, patients, appointments, evolutions, clinicPackages } = useApp();
  const { user } = useAuth();

  const today = toLocalDateString(new Date());
  const todayWeekday = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][new Date().getDay()];
  const patientsScheduledToday = patients.filter(p => {
    if (p.isArchived) return false;
    const schedByDay = p.scheduleByDay as Record<string, { start?: string }> | null;
    const scheduledDays = schedByDay ? Object.keys(schedByDay) : (p.weekdays || []);
    return scheduledDays.includes(todayWeekday);
  });
  const oneOffAppointments = appointments.filter(a => a.date === today);
  const oneOffPatientIds = new Set(oneOffAppointments.map(a => a.patientId));
  const weekdayPatientIds = new Set(patientsScheduledToday.map(p => p.id));
  const clinicTodayCount = new Set([...oneOffPatientIds, ...weekdayPatientIds]).size;

  const [privateToday, setPrivateToday] = useState(0);
  const [privateMonthlyRevenue, setPrivateMonthlyRevenue] = useState(0);

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const loadPrivateData = async () => {
    if (!user) return;
    const monthStart = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
    const nextMonth = currentMonth === 11 ? 1 : currentMonth + 2;
    const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    const [todayRes, monthRes] = await Promise.all([
      supabase
        .from('private_appointments')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('date', today),
      supabase
        .from('private_appointments')
        .select('price')
        .eq('user_id', user.id)
        .gte('date', monthStart)
        .lt('date', monthEnd),
    ]);

    setPrivateToday(todayRes.count ?? 0);
    const revenue = (monthRes.data || []).reduce((sum, a) => sum + (a.price || 0), 0);
    setPrivateMonthlyRevenue(revenue);
  };

  useEffect(() => {
    if (!user) return;
    loadPrivateData();

    // Realtime: re-fetch whenever private_appointments change
    const channel = supabase
      .channel('stats-private-appointments')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'private_appointments', filter: `user_id=eq.${user.id}` },
        () => loadPrivateData()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, today]);

  const totalTodayCount = clinicTodayCount + privateToday;

  const monthlyEvolutions = evolutions.filter(e => {
    const date = new Date(e.date);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  });

  // Helper: effective per-session value respecting personalizado packages
  const getEffectiveSessionValue = (p: typeof patients[0]) => {
    if (!p.paymentValue) return 0;
    const pkg = p.packageId ? clinicPackages.find(pk => pk.id === p.packageId) : null;
    const isPersonalizado = pkg?.packageType === 'personalizado' && (pkg?.sessionLimit ?? 0) > 0;
    return isPersonalizado ? p.paymentValue / pkg!.sessionLimit! : p.paymentValue;
  };

  // Clinic patient revenue — skip archived patients; use effective session value for personalizado packages
  const clinicMonthlyRevenue = patients.reduce((sum, p) => {
    // Fix 2: exclude archived patients
    if (p.isArchived) return sum;
    if (p.paymentType === 'fixo' && p.paymentValue) {
      return sum + p.paymentValue;
    }
    if (p.paymentType === 'sessao' && p.paymentValue) {
      const patientEvolutions = monthlyEvolutions.filter(
        e => e.patientId === p.id && (
          e.attendanceStatus === 'presente' ||
          e.attendanceStatus === 'reposicao' ||
          e.attendanceStatus === 'falta_remunerada' ||
          e.attendanceStatus === 'feriado_remunerado'
        )
      );
      // Fix 1 & 3: use fractionated value for personalizado packages
      return sum + (patientEvolutions.length * getEffectiveSessionValue(p));
    }
    return sum;
  }, 0);

  const monthlyRevenue = clinicMonthlyRevenue + privateMonthlyRevenue;

  const stats = [
    {
      label: 'Clínicas',
      value: clinics.length,
      icon: Building2,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      label: 'Pacientes',
      value: patients.length,
      icon: Users,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      label: 'Hoje',
      value: totalTodayCount,
      icon: Calendar,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      suffix: 'atendimentos',
    },
    {
      label: 'Faturamento',
      value: monthlyRevenue,
      icon: DollarSign,
      color: 'text-success',
      bgColor: 'bg-success/10',
      prefix: 'R$',
      format: true,
    },
  ];

  const { theme } = useTheme();
  const isLilas = theme === 'lilas';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <div
          key={stat.label}
          className={cn(
            'rounded-xl p-5 relative overflow-hidden',
            'animate-scale-in opacity-0 hover:shadow-md transition-shadow',
            `stagger-${index + 1}`,
            isLilas
              ? `stat-card-${index + 1} border-0 shadow-md`
              : 'bg-card border border-border'
          )}
          style={{ animationFillMode: 'forwards' }}
        >
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <p className={cn(
                'text-sm font-medium',
                isLilas ? 'text-foreground/70' : 'text-muted-foreground'
              )}>{stat.label}</p>
              <div className={cn(
                'w-9 h-9 rounded-lg flex items-center justify-center',
                isLilas ? 'bg-white/30' : stat.bgColor
              )}>
                <stat.icon className={cn(
                  'w-[18px] h-[18px]',
                  isLilas ? 'text-foreground' : stat.color
                )} />
              </div>
            </div>

            <div className="flex items-baseline gap-1">
              {stat.prefix && <span className={cn(
                'text-sm',
                isLilas ? 'text-foreground/60' : 'text-muted-foreground'
              )}>{stat.prefix}</span>}
              <span className="text-2xl font-semibold text-foreground">
                {stat.format
                  ? stat.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                  : stat.value
                }
              </span>
            </div>

            {stat.suffix && (
              <p className={cn(
                'text-xs mt-1',
                isLilas ? 'text-foreground/60' : 'text-muted-foreground'
              )}>{stat.suffix}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
