import { Building2, Users, Calendar, DollarSign } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';

export function StatsCards() {
  const { clinics, patients, appointments, evolutions } = useApp();

  const today = new Date().toISOString().split('T')[0];
  const todayAppointments = appointments.filter(a => a.date === today);
  
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthlyEvolutions = evolutions.filter(e => {
    const date = new Date(e.date);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  });

  // Calculate monthly revenue (simplified)
  const monthlyRevenue = patients.reduce((sum, p) => {
    if (p.paymentType === 'fixo' && p.paymentValue) {
      return sum + p.paymentValue;
    }
    if (p.paymentType === 'sessao' && p.paymentValue) {
      const patientEvolutions = monthlyEvolutions.filter(
        e => e.patientId === p.id && e.attendanceStatus === 'presente'
      );
      return sum + (patientEvolutions.length * p.paymentValue);
    }
    return sum;
  }, 0);

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
      value: todayAppointments.length,
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
