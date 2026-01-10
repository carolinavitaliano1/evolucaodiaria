import { Building2, Users, Calendar, DollarSign, TrendingUp } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';

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
      gradient: 'gradient-primary',
      change: null,
    },
    {
      label: 'Pacientes',
      value: patients.length,
      icon: Users,
      gradient: 'gradient-secondary',
      change: null,
    },
    {
      label: 'Hoje',
      value: todayAppointments.length,
      icon: Calendar,
      gradient: 'gradient-warm',
      suffix: 'atendimentos',
    },
    {
      label: 'Faturamento',
      value: monthlyRevenue,
      icon: DollarSign,
      gradient: 'gradient-success',
      prefix: 'R$',
      format: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <div
          key={stat.label}
          className={cn(
            'rounded-2xl p-5 text-primary-foreground relative overflow-hidden',
            stat.gradient,
            'animate-scale-in opacity-0',
            `stagger-${index + 1}`
          )}
          style={{ animationFillMode: 'forwards' }}
        >
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          
          <div className="relative z-10">
            <stat.icon className="w-8 h-8 mb-3 opacity-90" />
            
            <p className="text-sm opacity-90 mb-1">{stat.label}</p>
            
            <div className="flex items-baseline gap-1">
              {stat.prefix && <span className="text-lg">{stat.prefix}</span>}
              <span className="text-2xl lg:text-3xl font-bold">
                {stat.format 
                  ? stat.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                  : stat.value
                }
              </span>
            </div>
            
            {stat.suffix && (
              <p className="text-xs opacity-75 mt-1">{stat.suffix}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
