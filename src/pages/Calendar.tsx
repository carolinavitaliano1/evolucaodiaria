import { useState, useEffect, useCallback, useRef } from 'react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday,
  addMonths, subMonths, isSameMonth, startOfWeek, addWeeks, subWeeks,
  addDays, subDays,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ChevronLeft, ChevronRight, Plus, Clock, User, Briefcase,
  CheckSquare, Bell, Calendar, Users, LayoutGrid, Columns, CalendarDays,
  Pencil, Trash2, X, MapPin,
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
import { toast } from 'sonner';

type ViewMode = 'month' | 'week' | 'day';

interface CalItem {
  id: string;
  time: string;
  title: string;
  sub?: string;
  type: string;
  color: string;
  bgColor: string;
  rawEvent?: any;
  isDraggable: boolean;
}

const EVENT_COLORS: Record<string, { bg: string; pill: string }> = {
  tarefa:      { bg: 'bg-emerald-500', pill: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  lembrete:    { bg: 'bg-amber-500',   pill: 'bg-amber-100 text-amber-800 border-amber-300' },
  evento:      { bg: 'bg-violet-500',  pill: 'bg-violet-100 text-violet-800 border-violet-300' },
  reuniao:     { bg: 'bg-pink-500',    pill: 'bg-pink-100 text-pink-800 border-pink-300' },
  atendimento: { bg: 'bg-blue-500',    pill: 'bg-blue-100 text-blue-800 border-blue-300' },
  particular:  { bg: 'bg-amber-500',   pill: 'bg-amber-100 text-amber-800 border-amber-300' },
};

const TYPE_LABELS: Record<string, string> = {
  tarefa: 'Tarefa', lembrete: 'Lembrete', evento: 'Evento',
  reuniao: 'Reunião', atendimento: 'Atendimento', particular: 'Particular',
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_H = 56; // px per hour
const WEEKDAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default function CalendarPage() {
  const { selectedDate, setSelectedDate, appointments, clinics, patients, addAppointment, evolutions } = useApp();
  const { user } = useAuth();
  const { getAppointmentsForDate, refetch: refetchPrivate } = usePrivateAppointments();
  const [viewDate, setViewDate] = useState(selectedDate);
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [isApptDialogOpen, setIsApptDialogOpen] = useState(false);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [popupItem, setPopupItem] = useState<CalItem | null>(null);
  const [popupAnchor, setPopupAnchor] = useState<{ x: number; y: number } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

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

  // Close popup on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setPopupItem(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // --- Data helpers ---
  const getAllForDay = useCallback((date: Date): CalItem[] => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayOfWeek = WEEKDAY_NAMES[date.getDay()];

    // Clinic appointments from appointments table
    const appts: CalItem[] = appointments
      .filter(a => a.date === dateStr)
      .map(a => {
        const patient = patients.find(p => p.id === a.patientId);
        const clinic = clinics.find(c => c.id === a.clinicId);
        return {
          id: a.id, time: a.time, title: patient?.name || '—',
          sub: clinic?.name, type: 'atendimento',
          color: EVENT_COLORS.atendimento.bg,
          bgColor: EVENT_COLORS.atendimento.pill,
          isDraggable: false,
        };
      });

    // Scheduled patients based on weekdays config (recurring schedule)
    const scheduledPatientIds = new Set(appointments.filter(a => a.date === dateStr).map(a => a.patientId));
    const scheduledPatients: CalItem[] = patients
      .filter(p => !p.isArchived && p.weekdays?.includes(dayOfWeek) && !scheduledPatientIds.has(p.id))
      .map(p => {
        const clinic = clinics.find(c => c.id === p.clinicId);
        const scheduleByDay = p.scheduleByDay as Record<string, { start?: string; end?: string }> | null;
        const time = scheduleByDay?.[dayOfWeek]?.start || p.scheduleTime || '';
        // Check if evolution exists for this patient on this date
        const hasEvolution = evolutions.some(e => e.patientId === p.id && e.date === dateStr);
        return {
          id: `sched-${p.id}-${dateStr}`, time, title: p.name,
          sub: clinic?.name + (hasEvolution ? ' ✓' : ''),
          type: 'atendimento',
          color: hasEvolution ? 'bg-emerald-500' : EVENT_COLORS.atendimento.bg,
          bgColor: hasEvolution ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : EVENT_COLORS.atendimento.pill,
          isDraggable: false,
        };
      });

    // Private appointments
    const privAppts: CalItem[] = getAppointmentsForDate(dateStr).map(a => ({
      id: a.id, time: a.time, title: a.client_name,
      sub: `R$ ${a.price.toFixed(2)}`, type: 'particular',
      color: EVENT_COLORS.particular.bg,
      bgColor: EVENT_COLORS.particular.pill,
      isDraggable: false,
    }));

    // Calendar events (tasks, reminders, etc.)
    const evts: CalItem[] = calendarEvents
      .filter(e => e.date === dateStr)
      .map(e => ({
        id: e.id, time: e.time || '', title: e.title, sub: e.description,
        type: e.type, rawEvent: e,
        color: (EVENT_COLORS[e.type] || EVENT_COLORS.evento).bg,
        bgColor: (EVENT_COLORS[e.type] || EVENT_COLORS.evento).pill,
        isDraggable: true,
      }));

    return [...appts, ...scheduledPatients, ...privAppts, ...evts].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  }, [appointments, patients, clinics, calendarEvents, getAppointmentsForDate, evolutions]);

  // --- Appointment form ---
  const clinicPatients = patients.filter(p => p.clinicId === formData.clinicId);
  const handleApptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clinicId || !formData.patientId || !formData.date || !formData.time) return;
    addAppointment({ clinicId: formData.clinicId, patientId: formData.patientId, date: formData.date, time: formData.time, notes: formData.notes });
    setFormData({ clinicId: '', patientId: '', date: format(selectedDate, 'yyyy-MM-dd'), time: '', notes: '' });
    setIsApptDialogOpen(false);
  };

  // --- Navigation ---
  const goToday = () => { const t = new Date(); setViewDate(t); setSelectedDate(t); };
  const goPrev = () => {
    if (viewMode === 'month') setViewDate(d => subMonths(d, 1));
    else if (viewMode === 'week') setViewDate(d => subWeeks(d, 1));
    else setViewDate(d => subDays(d, 1));
  };
  const goNext = () => {
    if (viewMode === 'month') setViewDate(d => addMonths(d, 1));
    else if (viewMode === 'week') setViewDate(d => addWeeks(d, 1));
    else setViewDate(d => addDays(d, 1));
  };

  const weekStart = startOfWeek(viewDate, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekDayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = startOfWeek(monthEnd, { weekStartsOn: 0 });
  // ensure we include the last partial week
  const calDays = eachDayOfInterval({ start: calStart, end: addDays(calEnd, 6) });

  const headerLabel =
    viewMode === 'month' ? format(viewDate, 'MMMM yyyy', { locale: ptBR }) :
    viewMode === 'week' ? `${format(weekStart, "d 'de' MMMM", { locale: ptBR })} – ${format(addDays(weekStart, 6), "d 'de' MMMM yyyy", { locale: ptBR })}` :
    format(viewDate, "EEEE, d 'de' MMMM yyyy", { locale: ptBR });

  // --- Event popup ---
  const openPopup = (item: CalItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPopupItem(item);
    setPopupAnchor({ x: rect.left, y: rect.bottom + 8 });
  };

  const handleDeleteEvent = async (id: string) => {
    await supabase.from('events').delete().eq('id', id);
    toast.success('Evento removido');
    setPopupItem(null);
    loadCalendarEvents();
  };

  const handleEditFromPopup = () => {
    if (!popupItem?.rawEvent) return;
    setSelectedDate(new Date(popupItem.rawEvent.date + 'T12:00:00'));
    setEventDialogOpen(true);
    setPopupItem(null);
  };

  // --- Drag & Drop (week/day view, calendar events only) ---
  const handleDragStart = (e: React.DragEvent, item: CalItem) => {
    if (!item.isDraggable) { e.preventDefault(); return; }
    setDraggingId(item.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetDateStr: string) => {
    e.preventDefault();
    setDragOverDate(null);
    if (!draggingId) return;
    const evt = calendarEvents.find(ev => ev.id === draggingId);
    if (!evt || evt.date === targetDateStr) { setDraggingId(null); return; }
    const { error } = await supabase.from('events').update({ date: targetDateStr }).eq('id', draggingId);
    if (error) { toast.error('Erro ao mover evento'); }
    else { toast.success('Evento reagendado!'); loadCalendarEvents(); }
    setDraggingId(null);
  };

  // ---- Shared: event pill component ----
  const EventPill = ({ item, day, compact = true }: { item: CalItem; day: Date; compact?: boolean }) => (
    <div
      draggable={item.isDraggable}
      onDragStart={e => handleDragStart(e, item)}
      onClick={e => openPopup(item, e)}
      className={cn(
        "flex items-center gap-1 px-1.5 rounded text-[11px] font-medium text-white truncate cursor-pointer transition-opacity select-none",
        compact ? "py-0.5" : "py-1",
        item.color,
        draggingId === item.id && "opacity-40",
        item.isDraggable && "cursor-grab active:cursor-grabbing"
      )}
      title={item.title}
    >
      {item.time && <span className="opacity-80 shrink-0 text-[10px]">{item.time.slice(0, 5)}</span>}
      <span className="truncate">{item.title}</span>
    </div>
  );

  // ---- Shared hourly grid (week + day) ----
  const HourlyGrid = ({ days }: { days: Date[] }) => (
    <div className="flex-1 overflow-y-auto">
      <div className="grid relative" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
        {HOURS.map(hour => (
          <>
            <div key={`lbl-${hour}`} className="border-r border-b border-border h-14 flex items-start justify-end pr-2 pt-0.5 sticky left-0 bg-background z-10">
              <span className="text-[10px] text-muted-foreground leading-none">{hour === 0 ? '' : `${String(hour).padStart(2, '0')}:00`}</span>
            </div>
            {days.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const hourItems = getAllForDay(day).filter(item => {
                if (!item.time) return false;
                return parseInt(item.time.slice(0, 2), 10) === hour;
              });
              return (
                <div
                  key={`${dateStr}-${hour}`}
                  className={cn(
                    "border-r border-b border-border h-14 p-0.5 space-y-0.5 transition-colors",
                    dragOverDate === dateStr ? "bg-primary/10" : isSameDay(day, selectedDate) ? "bg-primary/3" : "hover:bg-secondary/20"
                  )}
                  onClick={() => setSelectedDate(day)}
                  onDragOver={e => { e.preventDefault(); setDragOverDate(dateStr); }}
                  onDragLeave={() => setDragOverDate(null)}
                  onDrop={e => handleDrop(e, dateStr)}
                >
                  {hourItems.map(item => <EventPill key={item.id} item={item} day={day} />)}
                </div>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-background relative">
      {/* ── TOP BAR ── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card shrink-0 gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={goToday} className="text-xs font-medium h-7 px-2.5">Hoje</Button>
          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={goPrev}><ChevronLeft className="w-4 h-4" /></Button>
          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={goNext}><ChevronRight className="w-4 h-4" /></Button>
          <span className="font-semibold text-foreground text-sm capitalize ml-1 hidden sm:inline">{headerLabel}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {/* View toggles */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            {([
              { key: 'month', label: 'Mês', icon: LayoutGrid },
              { key: 'week',  label: 'Semana', icon: Columns },
              { key: 'day',   label: 'Dia', icon: CalendarDays },
            ] as const).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                className={cn(
                  "px-2.5 py-1.5 text-xs font-medium flex items-center gap-1 transition-colors border-l border-border first:border-l-0",
                  viewMode === key ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-secondary'
                )}
                onClick={() => { setViewMode(key); if (key === 'day') setViewDate(selectedDate); }}
              >
                <Icon className="w-3 h-3" /> <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
          <Button size="sm" className="gradient-primary gap-1 text-xs h-7 px-2.5" onClick={() => setEventDialogOpen(true)}>
            <Plus className="w-3.5 h-3.5" /> Evento
          </Button>
          <Dialog open={isApptDialogOpen} onOpenChange={setIsApptDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1 text-xs h-7 px-2.5">
                <Plus className="w-3.5 h-3.5" /> Atendimento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Agendar Atendimento</DialogTitle></DialogHeader>
              <form onSubmit={handleApptSubmit} className="space-y-4">
                <div>
                  <Label>Clínica *</Label>
                  <Select value={formData.clinicId} onValueChange={v => setFormData({ ...formData, clinicId: v, patientId: '' })}>
                    <SelectTrigger><SelectValue placeholder="Selecione a clínica" /></SelectTrigger>
                    <SelectContent>{clinics.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Paciente *</Label>
                  <Select value={formData.patientId} onValueChange={v => setFormData({ ...formData, patientId: v })} disabled={!formData.clinicId}>
                    <SelectTrigger><SelectValue placeholder={formData.clinicId ? "Selecione o paciente" : "Selecione a clínica primeiro"} /></SelectTrigger>
                    <SelectContent>{clinicPatients.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Data *</Label><Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} required /></div>
                  <div><Label>Horário *</Label><Input type="time" value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })} required /></div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="submit" className="flex-1 gradient-primary">Agendar</Button>
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setIsApptDialogOpen(false)}>Cancelar</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ══════════ MONTH VIEW ══════════ */}
      {viewMode === 'month' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border bg-card shrink-0">
            {weekDayNames.map(d => (
              <div key={d} className="text-center text-[11px] font-semibold text-muted-foreground py-2 uppercase tracking-wide">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 flex-1 overflow-y-auto" style={{ gridTemplateRows: `repeat(${calDays.length / 7}, minmax(0,1fr))` }}>
            {calDays.map(day => {
              const isSelected = isSameDay(day, selectedDate);
              const isCurrentMonth = isSameMonth(day, viewDate);
              const dayItems = getAllForDay(day);
              const visible = dayItems.slice(0, 3);
              const overflow = dayItems.length - 3;
              const dateStr = format(day, 'yyyy-MM-dd');

              return (
                <div
                  key={day.toISOString()}
                  onClick={() => { setSelectedDate(day); setViewDate(day); }}
                  onDragOver={e => { e.preventDefault(); setDragOverDate(dateStr); }}
                  onDragLeave={() => setDragOverDate(null)}
                  onDrop={e => handleDrop(e, dateStr)}
                  className={cn(
                    "border-r border-b border-border p-1 cursor-pointer transition-colors min-h-[80px]",
                    isCurrentMonth ? "bg-background hover:bg-secondary/30" : "bg-muted/20",
                    isSelected && "bg-primary/5",
                    dragOverDate === dateStr && "bg-primary/10"
                  )}
                >
                  <span className={cn(
                    "text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-0.5",
                    isToday(day) ? "bg-primary text-primary-foreground" : isCurrentMonth ? "text-foreground" : "text-muted-foreground/50"
                  )}>
                    {format(day, 'd')}
                  </span>
                  <div className="space-y-0.5">
                    {visible.map(item => <EventPill key={item.id} item={item} day={day} />)}
                    {overflow > 0 && (
                      <div
                        className="text-[10px] text-primary font-medium pl-1 hover:underline"
                        onClick={e => { e.stopPropagation(); setSelectedDate(day); setViewMode('day'); setViewDate(day); }}
                      >
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

      {/* ══════════ WEEK VIEW ══════════ */}
      {viewMode === 'week' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Day headers */}
          <div className="grid border-b border-border bg-card shrink-0" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
            <div className="border-r border-border" />
            {weekDays.map(day => (
              <div
                key={day.toISOString()}
                className={cn("text-center py-2 border-r border-border cursor-pointer hover:bg-secondary/30 transition-colors", isSameDay(day, selectedDate) && "bg-primary/5")}
                onClick={() => { setSelectedDate(day); setViewDate(day); setViewMode('day'); }}
              >
                <div className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide">{format(day, 'EEE', { locale: ptBR })}</div>
                <div className={cn("mx-auto mt-0.5 w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold", isToday(day) ? "bg-primary text-primary-foreground" : "text-foreground")}>
                  {format(day, 'd')}
                </div>
              </div>
            ))}
          </div>
          {/* All-day row */}
          <div className="grid border-b border-border bg-card shrink-0" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
            <div className="border-r border-border flex items-center justify-center px-1">
              <span className="text-[9px] text-muted-foreground text-center leading-tight">dia<br/>todo</span>
            </div>
            {weekDays.map(day => {
              const allDay = getAllForDay(day).filter(i => !i.time);
              const dateStr = format(day, 'yyyy-MM-dd');
              return (
                <div key={day.toISOString()} className="border-r border-border min-h-[28px] p-0.5 space-y-0.5"
                  onDragOver={e => { e.preventDefault(); setDragOverDate(dateStr); }}
                  onDragLeave={() => setDragOverDate(null)}
                  onDrop={e => handleDrop(e, dateStr)}
                >
                  {allDay.map(item => <EventPill key={item.id} item={item} day={day} />)}
                </div>
              );
            })}
          </div>
          <HourlyGrid days={weekDays} />
        </div>
      )}

      {/* ══════════ DAY VIEW ══════════ */}
      {viewMode === 'day' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Day header */}
          <div className="flex border-b border-border bg-card shrink-0 items-center px-4 py-2.5 gap-4">
            <div className="flex items-center gap-2">
              <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold", isToday(viewDate) ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground")}>
                {format(viewDate, 'd')}
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground capitalize">{format(viewDate, 'EEEE', { locale: ptBR })}</div>
                <div className="text-xs text-muted-foreground capitalize">{format(viewDate, "MMMM yyyy", { locale: ptBR })}</div>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-1 text-sm text-muted-foreground">
              <span>{getAllForDay(viewDate).length} evento(s)</span>
            </div>
          </div>
          {/* All-day */}
          {getAllForDay(viewDate).filter(i => !i.time).length > 0 && (
            <div className="flex border-b border-border bg-card shrink-0 items-start gap-3 px-4 py-2">
              <span className="text-[10px] text-muted-foreground w-12 text-right shrink-0 mt-0.5">dia todo</span>
              <div className="flex flex-wrap gap-1 flex-1">
                {getAllForDay(viewDate).filter(i => !i.time).map(item => (
                  <EventPill key={item.id} item={item} day={viewDate} compact={false} />
                ))}
              </div>
            </div>
          )}
          {/* Hourly */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid" style={{ gridTemplateColumns: '56px 1fr' }}>
              {HOURS.map(hour => {
                const hourItems = getAllForDay(viewDate).filter(item => {
                  if (!item.time) return false;
                  return parseInt(item.time.slice(0, 2), 10) === hour;
                });
                return (
                  <>
                    <div key={`lbl-${hour}`} className="border-r border-b border-border h-16 flex items-start justify-end pr-3 pt-1">
                      <span className="text-[11px] text-muted-foreground">{hour === 0 ? '' : `${String(hour).padStart(2, '0')}:00`}</span>
                    </div>
                    <div
                      key={`col-${hour}`}
                      className="border-b border-border h-16 p-1 space-y-1 hover:bg-secondary/20 transition-colors"
                      onClick={() => setEventDialogOpen(true)}
                    >
                      {hourItems.map(item => (
                        <div
                          key={item.id}
                          onClick={e => openPopup(item, e)}
                          className={cn(
                            "flex items-center gap-2 px-2 py-1 rounded-lg text-xs font-medium text-white cursor-pointer hover:opacity-90 transition-opacity",
                            item.color
                          )}
                        >
                          <Clock className="w-3 h-3 opacity-70 shrink-0" />
                          <span className="opacity-80 shrink-0">{item.time.slice(0, 5)}</span>
                          <span className="font-semibold">{item.title}</span>
                          {item.sub && <span className="opacity-70 ml-auto truncate">{item.sub}</span>}
                        </div>
                      ))}
                    </div>
                  </>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══════════ EVENT POPUP ══════════ */}
      {popupItem && popupAnchor && (
        <div
          ref={popupRef}
          className="fixed z-50 bg-card border border-border rounded-xl shadow-xl p-4 w-72"
          style={{
            top: Math.min(popupAnchor.y, window.innerHeight - 280),
            left: Math.min(popupAnchor.x, window.innerWidth - 300),
          }}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className={cn("w-3 h-3 rounded-full shrink-0", popupItem.color)} />
              <span className="font-semibold text-foreground text-sm truncate">{popupItem.title}</span>
            </div>
            <button onClick={() => setPopupItem(null)} className="text-muted-foreground hover:text-foreground shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-1 mb-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={cn("px-1.5 py-0.5 rounded-full text-[10px] font-medium border", popupItem.bgColor)}>
                {TYPE_LABELS[popupItem.type] || popupItem.type}
              </span>
            </div>
            {popupItem.time && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>{popupItem.time.slice(0, 5)}</span>
              </div>
            )}
            {popupItem.sub && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3" />
                <span className="truncate">{popupItem.sub}</span>
              </div>
            )}
          </div>
          {popupItem.isDraggable && (
            <div className="flex gap-2 pt-2 border-t border-border">
              <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-xs h-7" onClick={handleEditFromPopup}>
                <Pencil className="w-3 h-3" /> Editar
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7 text-destructive hover:text-destructive border-destructive/30"
                onClick={() => handleDeleteEvent(popupItem.id)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          )}
          {!popupItem.isDraggable && (
            <p className="text-[11px] text-muted-foreground text-center">Edite pelo perfil do paciente</p>
          )}
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
