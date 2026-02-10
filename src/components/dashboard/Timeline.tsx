import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, User, MapPin, CheckCircle2, XCircle, Bell, Paperclip, ListTodo, Circle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '@/hooks/useNotifications';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileUpload, UploadedFile } from '@/components/ui/file-upload';

interface TimelineItem {
  id: string;
  type: 'appointment' | 'task';
  time: string;
  sortKey: string;
  data: any;
}

export function Timeline() {
  const { selectedDate, appointments, patients, clinics, tasks, toggleTask, addEvolution, setCurrentPatient, setCurrentClinic } = useApp();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { isNative, hasPermission, scheduleForAppointment } = useNotifications();
  
  const [attachDialog, setAttachDialog] = useState<{ open: boolean; apt: typeof appointments[0] | null }>({
    open: false,
    apt: null,
  });
  const [pendingFiles, setPendingFiles] = useState<UploadedFile[]>([]);
  
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  
  // Get appointments for selected date
  const dateAppointments = appointments
    .filter(a => a.date === dateStr)
    .map(apt => ({
      id: apt.id,
      type: 'appointment' as const,
      time: apt.time,
      sortKey: apt.time,
      data: apt,
    }));

  // Get pending tasks (show on all days)
  const pendingTasks = tasks
    .filter(t => !t.completed)
    .map(task => ({
      id: task.id,
      type: 'task' as const,
      time: '',
      sortKey: '99:99', // Tasks go to the end
      data: task,
    }));

  // Combine and sort
  const timelineItems: TimelineItem[] = [...dateAppointments, ...pendingTasks]
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const isToday = format(now, 'yyyy-MM-dd') === dateStr;

  const handleMarkPresent = (apt: typeof appointments[0], withAttachments = false) => {
    const patient = patients.find(p => p.id === apt.patientId);
    const clinic = clinics.find(c => c.id === apt.clinicId);
    
    if (withAttachments) {
      setAttachDialog({ open: true, apt });
      return;
    }
    
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

  const handleConfirmWithAttachments = () => {
    if (!attachDialog.apt) return;
    
    const patient = patients.find(p => p.id === attachDialog.apt!.patientId);
    const clinic = clinics.find(c => c.id === attachDialog.apt!.clinicId);
    
    if (patient && clinic) {
      addEvolution({
        patientId: attachDialog.apt.patientId,
        clinicId: attachDialog.apt.clinicId,
        date: attachDialog.apt.date,
        text: '',
        attendanceStatus: 'presente',
        attachments: pendingFiles.map(f => ({
          id: f.id,
          parentId: '',
          parentType: 'evolution' as const,
          name: f.name,
          data: f.filePath,
          type: f.fileType,
          createdAt: new Date().toISOString(),
        })),
      });
      setCurrentClinic(clinic);
      setCurrentPatient(patient);
      navigate(`/patients/${patient.id}`);
    }
    
    setAttachDialog({ open: false, apt: null });
    setPendingFiles([]);
  };

  const handleMarkAbsent = (apt: typeof appointments[0]) => {
    addEvolution({
      patientId: apt.patientId,
      clinicId: apt.clinicId,
      date: apt.date,
      text: 'Falta registrada.',
      attendanceStatus: 'falta',
    });
  };

  const appointmentCount = dateAppointments.length;
  const taskCount = pendingTasks.length;

  if (timelineItems.length === 0) {
    return (
      <div className={cn(
        "bg-card rounded-2xl p-4 sm:p-6 shadow-lg border border-border",
        theme === 'lilas' && "calendar-grid border-0"
      )}>
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          Linha do Tempo
        </h3>
        
        <div className="text-center py-8 sm:py-12">
          <div className="text-5xl sm:text-6xl mb-4">📅</div>
          <p className="text-foreground font-medium mb-2">Nenhum item para exibir</p>
          <p className="text-muted-foreground text-sm">
            {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "bg-card rounded-2xl p-4 sm:p-6 shadow-lg border border-border",
      theme === 'lilas' && "calendar-grid border-0"
    )}>
      <h3 className="font-semibold text-foreground mb-4 sm:mb-6 flex flex-wrap items-center gap-2">
        <Clock className="w-5 h-5 text-primary" />
        Linha do Tempo
        <div className="flex gap-2 text-xs sm:text-sm font-normal text-muted-foreground">
          {appointmentCount > 0 && (
            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              {appointmentCount} atendimento{appointmentCount !== 1 ? 's' : ''}
            </span>
          )}
          {taskCount > 0 && (
            <span className="bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full">
              {taskCount} tarefa{taskCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </h3>
      
      <div className="space-y-3 sm:space-y-4">
        {timelineItems.map((item, index) => {
          if (item.type === 'task') {
            const task = item.data;
            return (
              <div
                key={item.id}
                className="relative pl-6 sm:pl-8 pb-3 sm:pb-4 border-l-2 last:pb-0 border-amber-300"
              >
                {/* Timeline dot */}
                <div className="absolute left-0 -translate-x-1/2 w-4 h-4 rounded-full border-2 bg-card border-amber-400 flex items-center justify-center">
                  <ListTodo className="w-2 h-2 text-amber-500" />
                </div>
                
                {/* Task Content */}
                <div className="rounded-xl p-3 sm:p-4 bg-amber-500/10 border border-amber-300/30">
                  <div className="flex items-center justify-between gap-2 sm:gap-4">
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                      <button
                        onClick={() => toggleTask(task.id)}
                        className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-amber-400 flex items-center justify-center hover:bg-amber-100 transition-colors"
                      >
                        {task.completed && <Check className="w-3 h-3 text-amber-600" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <span className="text-xs text-amber-600 font-medium uppercase">Tarefa</span>
                        <p className={cn(
                          'text-sm sm:text-base text-foreground truncate',
                          task.completed && 'line-through text-muted-foreground'
                        )}>
                          {task.title}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-amber-600 hover:bg-amber-100 flex-shrink-0"
                      onClick={() => toggleTask(task.id)}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          }

          // Appointment item
          const apt = item.data;
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
                'relative pl-6 sm:pl-8 pb-3 sm:pb-4 border-l-2 last:pb-0',
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
                'rounded-xl p-3 sm:p-4 transition-all',
                isCurrent ? 'bg-primary/10 border border-primary/30 shadow-glow' : 'bg-secondary/50'
              )}>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={cn(
                        'text-base sm:text-lg font-bold',
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
                      <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">{patient.name}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{clinic.name}</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 flex-shrink-0">
                    {isNative && hasPermission && !isPast && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-amber-600 border-amber-300 hover:bg-amber-100"
                        onClick={() => scheduleForAppointment({
                          appointmentId: apt.id,
                          patientName: patient.name,
                          clinicName: clinic.name,
                          date: apt.date,
                          time: apt.time,
                        })}
                        title="Agendar lembrete"
                      >
                        <Bell className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-primary border-primary/30 hover:bg-primary/10"
                      onClick={() => handleMarkPresent(apt, true)}
                      title="Presente com anexo"
                    >
                      <Paperclip className="w-4 h-4" />
                    </Button>
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

      {/* Dialog for adding attachments */}
      <Dialog open={attachDialog.open} onOpenChange={(open) => {
        if (!open) {
          setAttachDialog({ open: false, apt: null });
          setPendingFiles([]);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anexar arquivos à evolução</DialogTitle>
          </DialogHeader>
          
          <FileUpload
            parentType="evolution"
            parentId={attachDialog.apt?.patientId}
            existingFiles={pendingFiles}
            onUpload={(files) => setPendingFiles(prev => [...prev, ...files])}
            onRemove={(id) => setPendingFiles(prev => prev.filter(f => f.id !== id))}
            maxFiles={5}
          />
          
          <div className="flex gap-2 mt-4">
            <Button
              onClick={handleConfirmWithAttachments}
              className="flex-1 gradient-primary"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Confirmar Presença
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setAttachDialog({ open: false, apt: null });
                setPendingFiles([]);
              }}
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
