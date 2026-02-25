import { useState, useMemo } from 'react';
import { Calendar, Clock, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApp } from '@/contexts/AppContext';
import { format, addDays, subDays, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface ClinicAgendaProps {
  clinicId: string;
}

export function ClinicAgenda({ clinicId }: ClinicAgendaProps) {
  const { patients, appointments, evolutions, setCurrentPatient } = useApp();
  const navigate = useNavigate();
  const [viewDate, setViewDate] = useState(new Date());

  const clinicPatients = patients.filter(p => p.clinicId === clinicId && !p.isArchived);

  const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const weekday = dayNames[viewDate.getDay()];
  const dateStr = format(viewDate, 'yyyy-MM-dd');

  // Patients scheduled by weekday
  const scheduledPatients = useMemo(() => {
    return clinicPatients
      .filter(p => p.weekdays?.includes(weekday))
      .sort((a, b) => (a.scheduleTime || '').localeCompare(b.scheduleTime || ''));
  }, [clinicPatients, weekday]);

  // Get evolution for a patient on view date
  const getEvolution = (patientId: string) => {
    return evolutions.find(e => e.patientId === patientId && e.clinicId === clinicId && e.date === dateStr);
  };

  const handleOpenPatient = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    if (patient) {
      setCurrentPatient(patient);
      navigate(`/patients/${patientId}`);
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'presente': return { label: '✅ Presente', cls: 'text-success' };
      case 'reposicao': return { label: '🔄 Reposição', cls: 'text-primary' };
      case 'falta': return { label: '❌ Falta', cls: 'text-destructive' };
      case 'falta_remunerada': return { label: '⚠️ Falta Rem.', cls: 'text-warning' };
      default: return { label: status, cls: 'text-muted-foreground' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Date navigation */}
      <div className="flex items-center justify-between bg-card rounded-2xl p-4 border border-border">
        <Button variant="ghost" size="icon" onClick={() => setViewDate(prev => subDays(prev, 1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="text-center">
          <h3 className="font-bold text-foreground">
            {weekday}, {format(viewDate, "dd 'de' MMMM", { locale: ptBR })}
          </h3>
          {!isToday(viewDate) && (
            <Button variant="link" size="sm" className="text-xs p-0 h-auto" onClick={() => setViewDate(new Date())}>
              Ir para hoje
            </Button>
          )}
          {isToday(viewDate) && <p className="text-xs text-primary font-medium">Hoje</p>}
        </div>
        <Button variant="ghost" size="icon" onClick={() => setViewDate(prev => addDays(prev, 1))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Schedule */}
      <div className="bg-card rounded-2xl p-6 border border-border">
        <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          Agenda do Dia ({scheduledPatients.length} pacientes)
        </h3>

        {scheduledPatients.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">📅</div>
            <p className="text-muted-foreground">Nenhum paciente agendado para {weekday}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {scheduledPatients.map(patient => {
              const evo = getEvolution(patient.id);
              const timeRange = patient.scheduleByDay?.[weekday];
              const timeDisplay = timeRange
                ? `${timeRange.start} - ${timeRange.end}`
                : patient.scheduleTime || '--:--';

              return (
                <div
                  key={patient.id}
                  className={cn(
                    "flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border transition-colors gap-2",
                    evo
                      ? evo.attendanceStatus === 'presente' || evo.attendanceStatus === 'reposicao'
                        ? "bg-success/10 border-success/30"
                        : evo.attendanceStatus === 'falta_remunerada'
                          ? "bg-warning/10 border-warning/30"
                          : "bg-destructive/10 border-destructive/30"
                      : "bg-secondary/50 border-border"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary font-bold text-sm">
                      <Clock className="w-4 h-4 mr-1" />
                      {patient.scheduleTime || '--'}
                    </div>
                    <div>
                      <p
                        className="font-semibold text-foreground cursor-pointer hover:text-primary transition-colors text-sm"
                        onClick={() => handleOpenPatient(patient.id)}
                      >
                        {patient.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {timeDisplay}
                        {patient.clinicalArea && ` • ${patient.clinicalArea}`}
                      </p>
                    </div>
                  </div>
                  <div>
                    {evo ? (
                      <span className={cn("text-xs font-medium", statusLabel(evo.attendanceStatus).cls)}>
                        {statusLabel(evo.attendanceStatus).label}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">⏳ Aguardando</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
