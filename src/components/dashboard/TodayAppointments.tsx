import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { toLocalDateString } from '@/lib/utils';
import { CalendarCheck, Clock, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function TodayAppointments() {
  const { appointments, patients, evolutions } = useApp();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const todayStr = toLocalDateString(new Date());

  const todayAppts = appointments
    .filter(a => a.date === todayStr)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  if (todayAppts.length === 0) return null;

  return (
    <div className={cn(
      'rounded-xl p-4 border',
      theme === 'lilas' ? 'calendar-grid border-0 shadow-md' : 'bg-card border-border'
    )}>
      <h3 className="font-medium text-foreground mb-3 text-sm flex items-center gap-2">
        <CalendarCheck className="w-4 h-4 text-primary" />
        Atendimentos de Hoje
        <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
          {todayAppts.length}
        </span>
      </h3>
      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {todayAppts.map(appt => {
          const patient = patients.find(p => p.id === appt.patientId);
          const hasEvolution = evolutions.some(e => e.patientId === appt.patientId && e.date === todayStr);
          if (!patient) return null;
          return (
            <button
              key={appt.id}
              onClick={() => navigate(`/patients/${appt.patientId}`)}
              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-primary/5 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {patient.avatarUrl ? (
                  <img src={patient.avatarUrl} alt={patient.name} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-4 h-4 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm truncate">{patient.name}</p>
                {patient.clinicalArea && (
                  <p className="text-xs text-muted-foreground truncate">{patient.clinicalArea}</p>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {appt.time && (
                  <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                    <Clock className="w-3 h-3" />{appt.time.slice(0, 5)}
                  </span>
                )}
                {hasEvolution && (
                  <span className="text-xs bg-success/10 text-success px-1.5 py-0.5 rounded-full">✓</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
