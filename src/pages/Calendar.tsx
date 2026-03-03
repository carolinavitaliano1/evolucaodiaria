import { useState, useEffect, useCallback } from 'react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday,
  addMonths, subMonths, isSameMonth, startOfWeek, endOfWeek, addWeeks, subWeeks,
  addDays, getHours, parseISO, eachHourOfInterval, startOfDay, endOfDay, setHours
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ChevronLeft, ChevronRight, Plus, Clock, User, Briefcase,
  CheckSquare, Bell, Calendar, Users, LayoutGrid, Columns
} from 'lucide-react';
import { EventDialog } from '@/components/calendar/EventDialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useApp } from '@/contexts/AppContext';
import { usePrivateAppointments } from '@/hooks/usePrivateAppointments';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

type ViewMode = 'month' | 'week';

const EVENT_COLORS: Record<string, string> = {
  tarefa: 'bg-emerald-500',
  lembrete: 'bg-amber-500',
  evento: 'bg-violet-500',
  reuniao: 'bg-pink-500',
  atendimento: 'bg-primary',
  particular: 'bg-amber-500',
};

const EVENT_LABELS: Record<string, string> = {
  tarefa: 'Tarefa',
  lembrete: 'Lembrete',
  evento: 'Evento',
  reuniao: 'Reunião',
};

export default function CalendarPage() {
  const { selectedDate, setSelectedDate, appointments, clinics, patients, addAppointment } = useApp();
  const { user } = useAuth();
  const { getAppointmentsForDate } = usePrivateAppointments();
  const [viewDate, setViewDate] = useState(selectedDate);
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    clinicId: '', patientId: '',
    date: format(selectedDate, 'yyyy-MM-dd'), time: '', notes: '',
  });

  const loadCalendarEvents = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('events').select('*').eq('user_id', user.id)
      .order('time', { ascending: true, nullsFirst: false });
    setCalendarEvents(data || []);
  }, [user?.id]);

  useEffect(() => { loadCalendarEvents(); }, [loadCalendarEvents]);

  // --- Data helpers ---
  const getClinicAppts = (dateStr: string) => appointments.filter(a => a.date === dateStr);
  const getPrivateAppts = (dateStr: string) => getAppointmentsForDate(dateStr);
  const getEvents = (dateStr: string) => calendarEvents.filter(e => e.date === dateStr);

  const getAllForDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return [
      ...getClinicAppts(dateStr).map(a => {
        const patient = patients.find(p => p.id === a.patientId);
        const clinic = clinics.find(c => c.id === a.clinicId);
        return { id: a.id, time: a.time, title: patient?.name || '—', sub: clinic?.name, type: 'atendimento', color: EVENT_COLORS.atendimento };
      }),
      ...getPrivateAppts(dateStr).map(a => ({
        id: a.id, time: a.time, title: a.client_name, sub: `R$ ${a.price.toFixed(2)}`, type: 'particular', color: EVENT_COLORS.particular,
      })),
      ...getEvents(dateStr).map(e => ({
        id: e.id, time: e.time || '', title: e.title, sub: e.description, type: e.type, color: EVENT_COLORS[e.type] || EVENT_COLORS.evento,
      })),
    ].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  };

  const clinicPatients = patients.filter(p => p.clinicId === formData.clinicId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clinicId || !formData.patientId || !formData.date || !formData.time) return;
    addAppointment({ clinicId: formData.clinicId, patientId: formData.patientId, date: formData.date, time: formData.time, notes: formData.notes });
    setFormData({ clinicId: '', patientId: '', date: format(selectedDate, 'yyyy-MM-dd'), time: '', notes: '' });
    setIsDialogOpen(false);
  };

  // --- Navigation ---
  const goToday = () => { setViewDate(new Date()); setSelectedDate(new Date()); };
  const goPrev = () => viewMode === 'month' ? setViewDate(subMonths(viewDate, 1)) : setViewDate(subWeeks(viewDate, 1));
  const goNext = () => viewMode === 'month' ? setViewDate(addMonths(viewDate, 1)) : setViewDate(addWeeks(viewDate, 1));

  const weekDayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // ============== MONTH VIEW ==============
  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calDays = eachDayOfInterval({ start: calStart, end: calEnd });

  // ============== WEEK VIEW ==============
  const weekStart = startOfWeek(viewDate, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const HOURS = Array.from({ length: 24 }, (_, i) => i);

  const MAX_VISIBLE_EVENTS = 3;

  // Header label
  const headerLabel = viewMode === 'month'
    ? format(viewDate, 'MMMM yyyy', { locale: ptBR })
    : `${format(weekStart, "d 'de' MMMM", { locale: ptBR })} – ${format(addDays(weekStart, 6), "d 'de' MMMM yyyy", { locale: ptBR })}`;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-background">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToday} className="text-xs font-medium">Hoje</Button>
          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={goPrev}><ChevronLeft className="w-4 h-4" /></Button>
          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={goNext}><ChevronRight className="w-4 h-4" /></Button>
          <span className="font-semibold text-foreground text-base capitalize ml-1">{headerLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggles */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              className={cn("px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors",
                viewMode === 'month' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-secondary')}
              onClick={() => setViewMode('month')}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Mês
            </button>
            <button
              className={cn("px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors border-l border-border",
                viewMode === 'week' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-secondary')}
              onClick={() => setViewMode('week')}
            >
              <Columns className="w-3.5 h-3.5" /> Semana
            </button>
          </div>
          {/* New event */}
          <Button
            size="sm"
            className="gradient-primary gap-1.5 text-xs"
            onClick={() => { setEventDialogOpen(true); }}
          >
            <Plus className="w-3.5 h-3.5" /> Novo Evento
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                <Plus className="w-3.5 h-3.5" /> Atendimento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Agendar Atendimento</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Clínica *</Label>
                  <Select value={formData.clinicId} onValueChange={(v) => setFormData({ ...formData, clinicId: v, patientId: '' })}>
                    <SelectTrigger><SelectValue placeholder="Selecione a clínica" /></SelectTrigger>
                    <SelectContent>{clinics.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Paciente *</Label>
                  <Select value={formData.patientId} onValueChange={(v) => setFormData({ ...formData, patientId: v })} disabled={!formData.clinicId}>
                    <SelectTrigger><SelectValue placeholder={formData.clinicId ? "Selecione o paciente" : "Selecione a clínica primeiro"} /></SelectTrigger>
                    <SelectContent>{clinicPatients.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Data *</Label>
                    <Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} required />
                  </div>
                  <div>
                    <Label>Horário *</Label>
                    <Input type="time" value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })} required />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="submit" className="flex-1 gradient-primary">Agendar</Button>
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ========== MONTH VIEW ========== */}
      {viewMode === 'month' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-border bg-card shrink-0">
            {weekDayNames.map(d => (
              <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2 uppercase tracking-wide">{d}</div>
            ))}
          </div>
          {/* Days grid */}
          <div className="grid grid-cols-7 flex-1 overflow-y-auto" style={{ gridTemplateRows: `repeat(${calDays.length / 7}, minmax(0, 1fr))` }}>
            {calDays.map(day => {
              const isSelected = isSameDay(day, selectedDate);
              const isCurrentMonth = isSameMonth(day, viewDate);
              const dayItems = getAllForDay(day);
              const visible = dayItems.slice(0, MAX_VISIBLE_EVENTS);
              const overflow = dayItems.length - MAX_VISIBLE_EVENTS;

              return (
                <div
                  key={day.toISOString()}
                  onClick={() => { setSelectedDate(day); setViewDate(day); }}
                  className={cn(
                    "border-r border-b border-border p-1 cursor-pointer transition-colors min-h-[90px]",
                    isCurrentMonth ? "bg-background hover:bg-secondary/40" : "bg-muted/20",
                    isSelected && "bg-primary/5 ring-1 ring-inset ring-primary"
                  )}
                >
                  {/* Day number */}
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={cn(
                      "text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full transition-colors",
                      isToday(day) ? "bg-primary text-primary-foreground" : isCurrentMonth ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {format(day, 'd')}
                    </span>
                  </div>
                  {/* Events */}
                  <div className="space-y-0.5">
                    {visible.map(item => (
                      <div
                        key={item.id}
                        className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-white truncate", item.color)}
                        onClick={e => { e.stopPropagation(); setSelectedDate(day); setEventDialogOpen(true); }}
                        title={item.title}
                      >
                        {item.time && <span className="opacity-80 shrink-0">{item.time.slice(0, 5)}</span>}
                        <span className="truncate">{item.title}</span>
                      </div>
                    ))}
                    {overflow > 0 && (
                      <div className="text-[10px] text-muted-foreground pl-1 font-medium">
                        +{overflow} mais
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========== WEEK VIEW ========== */}
      {viewMode === 'week' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Week day headers */}
          <div className="grid border-b border-border bg-card shrink-0" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
            <div className="border-r border-border" />
            {weekDays.map(day => (
              <div
                key={day.toISOString()}
                className={cn(
                  "text-center py-2 border-r border-border cursor-pointer hover:bg-secondary/40 transition-colors",
                  isSameDay(day, selectedDate) && "bg-primary/5"
                )}
                onClick={() => setSelectedDate(day)}
              >
                <div className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide">
                  {format(day, 'EEE', { locale: ptBR })}
                </div>
                <div className={cn(
                  "mx-auto mt-0.5 w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold",
                  isToday(day) ? "bg-primary text-primary-foreground" : "text-foreground"
                )}>
                  {format(day, 'd')}
                </div>
              </div>
            ))}
          </div>

          {/* All-day events row */}
          <div className="grid border-b border-border bg-card shrink-0" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
            <div className="border-r border-border flex items-center justify-center">
              <span className="text-[10px] text-muted-foreground">dia todo</span>
            </div>
            {weekDays.map(day => {
              const allDay = getAllForDay(day).filter(i => !i.time);
              return (
                <div key={day.toISOString()} className="border-r border-border min-h-[28px] p-0.5 space-y-0.5">
                  {allDay.map(item => (
                    <div key={item.id} className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium text-white truncate", item.color)}>
                      {item.title}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Hours grid */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid relative" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
              {/* Hour labels + rows */}
              {HOURS.map(hour => (
                <>
                  <div key={`h-${hour}`} className="border-r border-b border-border h-14 flex items-start justify-end pr-2 pt-0.5">
                    <span className="text-[10px] text-muted-foreground">{hour === 0 ? '' : `${String(hour).padStart(2, '0')}:00`}</span>
                  </div>
                  {weekDays.map(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const hourItems = getAllForDay(day).filter(item => {
                      if (!item.time) return false;
                      const h = parseInt(item.time.slice(0, 2), 10);
                      return h === hour;
                    });
                    return (
                      <div
                        key={`${day.toISOString()}-${hour}`}
                        className={cn(
                          "border-r border-b border-border h-14 p-0.5 relative",
                          isSameDay(day, selectedDate) ? "bg-primary/3" : "hover:bg-secondary/20"
                        )}
                        onClick={() => setSelectedDate(day)}
                      >
                        {hourItems.map(item => (
                          <div
                            key={item.id}
                            className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium text-white truncate mb-0.5", item.color)}
                            title={`${item.time?.slice(0, 5)} ${item.title}`}
                            onClick={e => { e.stopPropagation(); setSelectedDate(day); setEventDialogOpen(true); }}
                          >
                            <span className="opacity-80 mr-1">{item.time?.slice(0, 5)}</span>
                            {item.title}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </>
              ))}
            </div>
          </div>
        </div>
      )}

      <EventDialog
        open={eventDialogOpen}
        onOpenChange={setEventDialogOpen}
        selectedDate={selectedDate}
        onEventSaved={loadCalendarEvents}
      />
    </div>
  );
}
