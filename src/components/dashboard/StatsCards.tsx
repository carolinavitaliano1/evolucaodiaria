import { Building2, Users, Calendar, DollarSign } from 'lucide-react';
import { isPatientActiveOn } from '@/utils/dateHelpers';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';
import { toLocalDateString } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect, useMemo } from 'react';
import { startOfMonth } from 'date-fns';
import { calculateClinicMonthlyRevenue, type EvolutionLike } from '@/utils/financialHelpers';
import { type GroupBillingMap, type GroupMemberPaymentMap } from '@/utils/groupFinancial';

export function StatsCards() {
  const { clinics, patients, appointments, evolutions, clinicPackages } = useApp();
  const { user } = useAuth();

  const today = toLocalDateString(new Date());
  const todayWeekday = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][new Date().getDay()];
  const patientsScheduledToday = patients.filter(p => {
    if (!isPatientActiveOn(p)) return false;
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
  const [groupBillingMap, setGroupBillingMap] = useState<GroupBillingMap>({});
  const [memberPaymentMap, setMemberPaymentMap] = useState<GroupMemberPaymentMap>({});

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
        .select('price, status')
        .eq('user_id', user.id)
        .neq('status', 'cancelado')
        .gte('date', monthStart)
        .lt('date', monthEnd),
    ]);

    setPrivateToday(todayRes.count ?? 0);
    const revenue = (monthRes.data || []).reduce((sum, a) => sum + (a.price || 0), 0);
    setPrivateMonthlyRevenue(revenue);
  };

  // Load group billing data for accurate group session pricing
  useEffect(() => {
    if (!user) return;
    supabase.from('therapeutic_groups').select('id, default_price, financial_enabled, payment_type, package_id')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (!data) return;
        const map: GroupBillingMap = {};
        data.forEach((g: any) => {
          map[g.id] = {
            defaultPrice: g.default_price ?? null,
            paymentType: g.payment_type ?? null,
            packageId: g.package_id ?? null,
            financialEnabled: g.financial_enabled ?? false,
          };
        });
        setGroupBillingMap(map);
        if (data.length > 0) {
          const groupIds = data.map((g: any) => g.id);
          supabase.from('therapeutic_group_members')
            .select('group_id, patient_id, is_paying, member_payment_value')
            .in('group_id', groupIds)
            .eq('status', 'active')
            .then(({ data: membersData }) => {
              if (!membersData) return;
              const mmap: GroupMemberPaymentMap = {};
              membersData.forEach((m: any) => {
                if (!mmap[m.group_id]) mmap[m.group_id] = {};
                mmap[m.group_id][m.patient_id] = {
                  isPaying: m.is_paying ?? true,
                  value: m.member_payment_value ?? null,
                };
              });
              setMemberPaymentMap(mmap);
            });
        }
      });
  }, [user]);

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
    const date = new Date(`${e.date}T12:00:00`);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  });
  const periodStartDate = useMemo(
    () => startOfMonth(new Date(currentYear, currentMonth, 1)),
    [currentMonth, currentYear],
  );
  const patientIdsWithMonthlyActivity = useMemo(
    () => new Set(monthlyEvolutions.map(e => e.patientId)),
    [monthlyEvolutions],
  );
  const isPatientRelevantInCurrentMonth = (patient: typeof patients[number]) =>
    patientIdsWithMonthlyActivity.has(patient.id) || isPatientActiveOn(patient, periodStartDate);

  // 🔒 Faturamento da clínica delegado ao helper central — respeita modelo
  // fixo_mensal (salário fixo, independe de sessões), fixo_diario e variado.
  const clinicMonthlyRevenue = (() => {
    const patientsByClinic: Record<string, typeof patients> = {};
    for (const p of patients) {
      if (!isPatientRelevantInCurrentMonth(p)) continue;
      if (!patientsByClinic[p.clinicId]) patientsByClinic[p.clinicId] = [];
      patientsByClinic[p.clinicId].push(p);
    }

    let total = 0;
    for (const [cId, cPatients] of Object.entries(patientsByClinic)) {
      const clinic = clinics.find(c => c.id === cId);
      if (!clinic || clinic.isArchived) continue;

      const cEvos: EvolutionLike[] = monthlyEvolutions
        .filter(e => cPatients.some(p => p.id === e.patientId))
        .map(e => ({
          id: e.id, patientId: e.patientId, groupId: e.groupId, date: e.date,
          attendanceStatus: e.attendanceStatus, confirmedAttendance: e.confirmedAttendance,
        }));

      total += calculateClinicMonthlyRevenue({
        clinic, patients: cPatients, evolutions: cEvos,
        month: currentMonth, year: currentYear, packages: clinicPackages,
        groupBillingMap, memberPaymentMap,
      }).total;
    }
    return total;
  })();

  const monthlyRevenue = clinicMonthlyRevenue + privateMonthlyRevenue;

  const stats = [
    {
      label: 'Clínicas',
      value: clinics.filter(c => !c.isArchived).length,
      icon: Building2,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      label: 'Pacientes',
      value: patients.filter(p => isPatientActiveOn(p)).length,
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
