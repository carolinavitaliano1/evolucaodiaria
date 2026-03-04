import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { toLocalDateString } from '@/lib/utils';
import { CalendarCheck, Clock, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type ScheduleItem = {
  id: string;
  name: string;
  avatarUrl: string | null | undefined;
  clinicalArea: string | null | undefined;
  time: string;
};

export function TodayAppointments() {
  const { appointments, patients, evolutions } = useApp();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const todayStr = toLocalDateString(new Date());
  const todayWeekday = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][new Date().getDay()];

  // Patients with recurring weekly schedule for today
  const weekdayPatients: ScheduleItem[] = patients
    .filter(p => !p.isArchived && p.weekdays?.includes(todayWeekday))
    .map(p => ({
      id: p.id,
      name: p.name,
      avatarUrl: p.avatarUrl,
      clinicalArea: p.clinicalArea,
      time: p.scheduleTime || '00:00',
    }));

  // One-off appointments (not already covered by weekday schedule)
  const weekdayPatientIds = new Set(weekdayPatients.map(p => p.id));
  const oneOffItems: ScheduleItem[] = appointments
    .filter(a => a.date === todayStr && !weekdayPatientIds.has(a.patientId))
    .map(a => {
      const patient = patients.find(p => p.id === a.patientId);
      if (!patient) return null;
      return {
        id: patient.id,
        name: patient.name,
        avatarUrl: patient.avatarUrl,
        clinicalArea: patient.clinicalArea,
        time: a.time || '00:00',
      };
    })
    .filter((x): x is ScheduleItem => x !== null);

  const allItems = [...weekdayPatients, ...oneOffItems]
    .sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div className={cn(
      'rounded-xl p-4 border',
      theme === 'lilas' ? 'calendar-grid border-0 shadow-md' : 'bg-card border-border'
    )}>
      <h3 className="font-medium text-foreground mb-3 text-sm flex items-center gap-2">
        <CalendarCheck className="w-4 h-4 text-primary" />
        Atendimentos de Hoje
        <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
          {allItems.length}
        </span>
      </h3>
      {allItems.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">Nenhum atendimento agendado para hoje</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {allItems.map((item, idx) => {
            const hasEvolution = evolutions.some(e => e.patientId === item.id && e.date === todayStr);
            return (
              <button
                key={`${item.id}-${idx}`}
                onClick={() => navigate(`/patients/${item.id}`)}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-primary/5 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden border border-border">
                  {item.avatarUrl ? (
                    <img src={item.avatarUrl} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-4 h-4 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm truncate">{item.name}</p>
                  {item.clinicalArea && (
                    <p className="text-xs text-muted-foreground truncate">{item.clinicalArea}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {item.time && item.time !== '00:00' && (
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-0.5 bg-secondary px-2 py-1 rounded-full">
                      <Clock className="w-3 h-3" />{item.time.slice(0, 5)}
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
      )}
    </div>
  );
}
