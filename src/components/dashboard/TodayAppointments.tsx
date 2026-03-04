import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { toLocalDateString } from '@/lib/utils';
import { CalendarCheck, Clock, User, Briefcase } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePrivateAppointments } from '@/hooks/usePrivateAppointments';
import { ServiceDialog } from '@/components/services/ServiceDialog';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { PrivateAppointment } from '@/hooks/usePrivateAppointments';

type ScheduleItem = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  subtitle?: string | null;
  time: string;
  isPrivate?: boolean;
  patientId?: string;
  privateAppointment?: PrivateAppointment;
};

export function TodayAppointments() {
  const { appointments, patients, evolutions } = useApp();
  const { privateAppointments, refetch } = usePrivateAppointments();
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedPrivateAppt, setSelectedPrivateAppt] = useState<PrivateAppointment | null>(null);
  const [services, setServices] = useState<{ id: string; name: string }[]>([]);

  const todayStr = toLocalDateString(new Date());
  const todayWeekday = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][new Date().getDay()];

  useEffect(() => {
    if (!user) return;
    supabase.from('services').select('id, name').eq('user_id', user.id).eq('is_active', true)
      .then(({ data }) => { if (data) setServices(data); });
  }, [user]);

  // Patients with recurring weekly schedule for today
  const weekdayPatients: ScheduleItem[] = patients
    .filter(p => !p.isArchived && p.weekdays?.includes(todayWeekday))
    .map(p => ({
      id: p.id,
      patientId: p.id,
      name: p.name,
      avatarUrl: p.avatarUrl,
      subtitle: p.clinicalArea,
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
        patientId: patient.id,
        name: patient.name,
        avatarUrl: patient.avatarUrl,
        subtitle: patient.clinicalArea,
        time: a.time || '00:00',
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // Private appointments for today
  const privateItems: ScheduleItem[] = privateAppointments
    .filter(a => a.date === todayStr && a.status !== 'cancelado')
    .map(a => {
      const serviceName = services.find(s => s.id === a.service_id)?.name;
      return {
        id: `private-${a.id}`,
        name: a.client_name,
        subtitle: serviceName || 'Particular',
        time: a.time || '00:00',
        isPrivate: true,
        privateAppointment: a,
      };
    });

  const allItems = [...weekdayPatients, ...oneOffItems, ...privateItems]
    .sort((a, b) => a.time.localeCompare(b.time));

  return (
    <>
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
              const hasEvolution = item.patientId
                ? evolutions.some(e => e.patientId === item.patientId && e.date === todayStr)
                : false;
              return (
                <button
                  key={`${item.id}-${idx}`}
                  onClick={() => {
                    if (item.privateAppointment) {
                      setSelectedPrivateAppt(item.privateAppointment);
                      setEditDialogOpen(true);
                    } else if (item.patientId) {
                      navigate(`/patients/${item.patientId}`);
                    }
                  }}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-primary/5 transition-colors text-left cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden border border-border">
                    {item.avatarUrl ? (
                      <img src={item.avatarUrl} alt={item.name} className="w-full h-full object-cover" />
                    ) : item.isPrivate ? (
                      <Briefcase className="w-4 h-4 text-primary" />
                    ) : (
                      <User className="w-4 h-4 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm truncate">{item.name}</p>
                    {item.subtitle && (
                      <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
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

      <ServiceDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        editAppointment={selectedPrivateAppt}
        onAppointmentSaved={refetch}
      />
    </>
  );
}
