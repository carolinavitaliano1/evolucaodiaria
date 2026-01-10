import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, User, MapPin, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export function Timeline() {
  const { selectedDate, appointments, patients, clinics, addEvolution, setCurrentPatient, setCurrentClinic } = useApp();
  const navigate = useNavigate();
  
  const dateAppointments = appointments
    .filter(a => a.date === format(selectedDate, 'yyyy-MM-dd'))
    .sort((a, b) => a.time.localeCompare(b.time));

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const isToday = format(now, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');

  const handleMarkPresent = (apt: typeof dateAppointments[0]) => {
    const patient = patients.find(p => p.id === apt.patientId);
    const clinic = clinics.find(c => c.id === apt.clinicId);
    
    if (patient && clinic) {
      addEvolution({
        patientId: apt.patientId,
        clinicId: apt.clinicId,
        date: apt.date,
        text: '',
        attendanceStatus: 'presente',
      });
      setCurrentClinic(clinic);
      setCurrentPatient(patient);
      navigate(`/patients/${patient.id}`);
    }
  };

  const handleMarkAbsent = (apt: typeof dateAppointments[0]) => {
    addEvolution({
      patientId: apt.patientId,
      clinicId: apt.clinicId,
      date: apt.date,
      text: 'Falta registrada.',
      attendanceStatus: 'falta',
    });
  };

  if (dateAppointments.length === 0) {
    return (
      <div className="bg-card rounded-2xl p-6 shadow-lg border border-border">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          Linha do Tempo
        </h3>
        
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📅</div>
          <p className="text-foreground font-medium mb-2">Nenhum atendimento agendado</p>
          <p className="text-muted-foreground text-sm">
            {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl p-6 shadow-lg border border-border">
      <h3 className="font-semibold text-foreground mb-6 flex items-center gap-2">
        <Clock className="w-5 h-5 text-primary" />
        Linha do Tempo
        <span className="text-sm font-normal text-muted-foreground ml-2">
          ({dateAppointments.length} atendimentos)
        </span>
      </h3>
      
      <div className="space-y-4">
        {dateAppointments.map((apt, index) => {
          const patient = patients.find(p => p.id === apt.patientId);
          const clinic = clinics.find(c => c.id === apt.clinicId);
          
          if (!patient || !clinic) return null;
          
          const [hours, minutes] = apt.time.split(':').map(Number);
          const aptMinutes = hours * 60 + minutes;
          
          const isCurrent = isToday && currentMinutes >= aptMinutes - 15 && currentMinutes <= aptMinutes + 60;
          const isPast = isToday && currentMinutes > aptMinutes + 60;
          
          return (
            <div
              key={apt.id}
              className={cn(
                'relative pl-8 pb-4 border-l-2 last:pb-0',
                isCurrent ? 'border-primary' : isPast ? 'border-muted' : 'border-muted'
              )}
            >
              {/* Timeline dot */}
              <div className={cn(
                'absolute left-0 -translate-x-1/2 w-4 h-4 rounded-full border-2 bg-card',
                isCurrent ? 'border-primary bg-primary' : isPast ? 'border-muted' : 'border-muted-foreground'
              )}>
                {isCurrent && (
                  <div className="absolute inset-0 rounded-full bg-primary animate-ping opacity-50" />
                )}
              </div>
              
              {/* Content */}
              <div className={cn(
                'rounded-xl p-4 transition-all',
                isCurrent ? 'bg-primary/10 border border-primary/30 shadow-glow' : 'bg-secondary/50'
              )}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={cn(
                        'text-lg font-bold',
                        isCurrent ? 'text-primary' : 'text-foreground'
                      )}>
                        {apt.time}
                      </span>
                      {isCurrent && (
                        <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full animate-pulse">
                          AGORA
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 text-foreground font-medium mb-1">
                      <User className="w-4 h-4 text-muted-foreground" />
                      {patient.name}
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      {clinic.name}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-success border-success hover:bg-success hover:text-success-foreground"
                      onClick={() => handleMarkPresent(apt)}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => handleMarkAbsent(apt)}
                    >
                      <XCircle className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
