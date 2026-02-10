import { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Clock, User, MapPin, Briefcase } from 'lucide-react';
import { EventDialog } from '@/components/calendar/EventDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { usePrivateAppointments } from '@/hooks/usePrivateAppointments';

export default function CalendarPage() {
  const { selectedDate, setSelectedDate, appointments, clinics, patients, addAppointment } = useApp();
  const { theme } = useTheme();
  const { getAppointmentsForDate } = usePrivateAppointments();
  const [viewDate, setViewDate] = useState(selectedDate);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedClinic, setSelectedClinic] = useState('');
  const [eventDialogOpen, setEventDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    clinicId: '',
    patientId: '',
    date: format(selectedDate, 'yyyy-MM-dd'),
    time: '',
    notes: '',
  });

  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const firstDayOfMonth = monthStart.getDay();
  const emptyDays = Array(firstDayOfMonth).fill(null);

  const getAppointmentsForDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return appointments.filter(a => a.date === dateStr);
  };

  const getPrivateForDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return getAppointmentsForDate(dateStr);
  };

  const getAllAppointmentsForDay = (date: Date) => {
    const regular = getAppointmentsForDay(date);
    const privateAppts = getPrivateForDay(date);
    return { regular, private: privateAppts, total: regular.length + privateAppts.length };
  };

  const selectedDayData = getAllAppointmentsForDay(selectedDate);
  const selectedDayAppointments = selectedDayData.regular.sort((a, b) => a.time.localeCompare(b.time));
  const selectedDayPrivate = selectedDayData.private.sort((a, b) => a.time.localeCompare(b.time));

  const clinicPatients = patients.filter(p => p.clinicId === formData.clinicId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clinicId || !formData.patientId || !formData.date || !formData.time) return;

    addAppointment({
      clinicId: formData.clinicId,
      patientId: formData.patientId,
      date: formData.date,
      time: formData.time,
      notes: formData.notes,
    });

    setFormData({
      clinicId: '',
      patientId: '',
      date: format(selectedDate, 'yyyy-MM-dd'),
      time: '',
      notes: '',
    });
    setIsDialogOpen(false);
  };

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-1 flex items-center gap-3">
            <span className="text-4xl">📅</span>
            Agenda
          </h1>
          <p className="text-muted-foreground">
            Gerencie seus atendimentos
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary shadow-glow gap-2">
              <Plus className="w-4 h-4" />
              Novo Atendimento
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agendar Atendimento</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Clínica *</Label>
                <Select
                  value={formData.clinicId}
                  onValueChange={(v) => setFormData({ ...formData, clinicId: v, patientId: '' })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a clínica" />
                  </SelectTrigger>
                  <SelectContent>
                    {clinics.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Paciente *</Label>
                <Select
                  value={formData.patientId}
                  onValueChange={(v) => setFormData({ ...formData, patientId: v })}
                  disabled={!formData.clinicId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.clinicId ? "Selecione o paciente" : "Selecione a clínica primeiro"} />
                  </SelectTrigger>
                  <SelectContent>
                    {clinicPatients.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data *</Label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Horário *</Label>
                  <Input
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1 gradient-primary">
                  Agendar
                </Button>
                <Button type="button" variant="outline" className="flex-1" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className={cn(
          "lg:col-span-2 rounded-2xl p-6 shadow-lg border",
          theme === 'lilas' ? 'calendar-grid border-0' : 'bg-card border-border'
        )}>
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewDate(subMonths(viewDate, 1))}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            
            <h2 className="text-xl font-bold text-foreground capitalize">
              {format(viewDate, 'MMMM yyyy', { locale: ptBR })}
            </h2>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewDate(addMonths(viewDate, 1))}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          {/* Week days header */}
          <div className="grid grid-cols-7 gap-2 mb-4">
            {weekDays.map((day) => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-2">
            {emptyDays.map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}
            
            {days.map((day) => {
              const isSelected = isSameDay(day, selectedDate);
              const dayData = getAllAppointmentsForDay(day);
              const hasAppointments = dayData.total > 0;
              const hasPrivate = dayData.private.length > 0;
              
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => {
                    setSelectedDate(day);
                    setEventDialogOpen(true);
                  }}
                  className={cn(
                    'aspect-square rounded-xl p-2 transition-all relative flex flex-col items-center justify-center',
                    'hover:bg-secondary',
                    isToday(day) && !isSelected && 'bg-primary/10 font-bold',
                    isSelected && 'gradient-primary text-primary-foreground shadow-glow',
                    !isSameMonth(day, viewDate) && 'opacity-50'
                  )}
                >
                  <span className={cn(
                    'text-sm',
                    isSelected ? 'text-primary-foreground font-bold' : 'text-foreground'
                  )}>
                    {format(day, 'd')}
                  </span>
                  
                  {hasAppointments && (
                    <div className="flex gap-0.5 mt-1">
                      {dayData.regular.slice(0, 2).map((_, i) => (
                        <div
                          key={`r-${i}`}
                          className={cn(
                            'w-1.5 h-1.5 rounded-full',
                            isSelected ? 'bg-primary-foreground' : 'bg-primary'
                          )}
                        />
                      ))}
                      {hasPrivate && (
                        <div
                          className={cn(
                            'w-1.5 h-1.5 rounded-full',
                            isSelected ? 'bg-amber-200' : 'bg-amber-500'
                          )}
                        />
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day */}
        <div className={cn(
          "rounded-2xl p-6 shadow-lg border",
          theme === 'lilas' ? 'calendar-grid border-0' : 'bg-card border-border'
        )}>
          <h3 className="font-bold text-foreground mb-4">
            {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </h3>

          {selectedDayAppointments.length === 0 && selectedDayPrivate.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-5xl mb-3">📅</div>
              <p className="text-muted-foreground text-sm">Nenhum atendimento</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Regular Appointments */}
              {selectedDayAppointments.map((apt) => {
                const patient = patients.find(p => p.id === apt.patientId);
                const clinic = clinics.find(c => c.id === apt.clinicId);

                return (
                  <div key={apt.id} className="bg-secondary/50 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-primary font-bold mb-2">
                      <Clock className="w-4 h-4" />
                      {apt.time}
                    </div>
                    <div className="flex items-center gap-2 text-foreground mb-1">
                      <User className="w-4 h-4 text-muted-foreground" />
                      {patient?.name || 'Paciente não encontrado'}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      {clinic?.name || 'Clínica não encontrada'}
                    </div>
                  </div>
                );
              })}

              {/* Private Appointments */}
              {selectedDayPrivate.map((apt) => (
                <div key={apt.id} className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold">
                      <Clock className="w-4 h-4" />
                      {apt.time}
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-300 flex items-center gap-1">
                      <Briefcase className="w-3 h-3" />
                      Particular
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-foreground mb-1">
                    <User className="w-4 h-4 text-muted-foreground" />
                    {apt.client_name}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-success font-medium">
                    R$ {apt.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <EventDialog
        open={eventDialogOpen}
        onOpenChange={setEventDialogOpen}
        selectedDate={selectedDate}
      />
    </div>
  );
}
