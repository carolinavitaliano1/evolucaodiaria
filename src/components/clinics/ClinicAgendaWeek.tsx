import { useState, useMemo, useEffect, useCallback } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Plus, Filter, Trash2, CalendarOff, Bell, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useClinicOrg } from '@/hooks/useClinicOrg';
import { useCalendarBlocks } from '@/hooks/useCalendarBlocks';
import { CalendarBlockDialog } from '@/components/calendar/CalendarBlockDialog';
import { EventDialog } from '@/components/calendar/EventDialog';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format, addDays, startOfWeek, isSameDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { isPatientActiveOn } from '@/utils/dateHelpers';
import { AppointmentDialog, type AppointmentDraft } from './AppointmentDialog';
import { toast } from 'sonner';

interface ClinicAgendaWeekProps {
  clinicId: string;
  onOpenSettings?: () => void;
}

const ALL_STATUSES = [
  { value: 'agendado',   label: 'Agendado',   color: 'bg-primary/15 text-primary border-primary/30' },
  { value: 'confirmado', label: 'Confirmado', color: 'bg-success/15 text-success border-success/30' },
  { value: 'atendido',   label: 'Atendido',   color: 'bg-success/25 text-success border-success/40' },
  { value: 'faltou',     label: 'Faltou',     color: 'bg-destructive/15 text-destructive border-destructive/30' },
  { value: 'cancelado',  label: 'Cancelado',  color: 'bg-muted text-muted-foreground border-border line-through' },
  { value: 'remarcar',   label: 'Remarcar',   color: 'bg-warning/15 text-warning border-warning/30' },
];

function statusStyle(status: string) {
  return ALL_STATUSES.find(s => s.value === status)?.color || ALL_STATUSES[0].color;
}

function statusLabel(status: string) {
  return ALL_STATUSES.find(s => s.value === status)?.label || status;
}

function timeToMinutes(t: string): number {
  if (!t || !/^\d{1,2}:\d{2}/.test(t)) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

interface AppointmentRow {
  id: string;
  date: string;
  time: string;
  end_time: string | null;
  patient_id: string;
  therapist_user_id: string | null;
  status: string;
  room: string | null;
  convenio: string | null;
  notes: string | null;
  is_recurring: boolean;
  procedure_id?: string | null;
  package_id?: string | null;
}

const DAYS_PT = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];

export function ClinicAgendaWeek({ clinicId, onOpenSettings }: ClinicAgendaWeekProps) {
  const { patients } = useApp();
  const { user } = useAuth();
  const { members } = useClinicOrg(clinicId);
  const { getBlockForDate, load: reloadBlocks } = useCalendarBlocks();

  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Filtros
  const [statusFilter, setStatusFilter] = useState<string[]>([]); // [] = todos
  const [therapistFilter, setTherapistFilter] = useState<string[]>([]); // [] = todos
  const [patientSearch, setPatientSearch] = useState('');

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<AppointmentDraft | null>(null);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [eventDialogDate, setEventDialogDate] = useState<Date>(new Date());
  const [userEvents, setUserEvents] = useState<Array<{ id: string; date: string; time: string | null; title: string; type: string; color: string }>>([]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr = format(addDays(weekStart, 6), 'yyyy-MM-dd');

  const clinicPatients = useMemo(
    () => patients.filter(p => p.clinicId === clinicId),
    [patients, clinicId]
  );
  const patientOptions = useMemo(
    () => clinicPatients.map(p => ({ id: p.id, name: p.name })).sort((a, b) => a.name.localeCompare(b.name)),
    [clinicPatients]
  );
  const memberOptions = useMemo(
    () => members.map(m => ({ userId: m.userId, name: m.name || m.email || 'Sem nome' })),
    [members]
  );

  // Carrega agendamentos da semana visível
  const loadAppointments = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('appointments' as any)
      .select('id, date, time, end_time, patient_id, therapist_user_id, status, room, convenio, notes, is_recurring, procedure_id, package_id')
      .eq('clinic_id', clinicId)
      .gte('date', weekStartStr)
      .lte('date', weekEndStr);
    if (error) {
      toast.error('Erro ao carregar agenda: ' + error.message);
      setAppointments([]);
    } else {
      setAppointments((data || []) as AppointmentRow[]);
    }
    setLoading(false);
  }, [clinicId, weekStartStr, weekEndStr]);

  useEffect(() => { loadAppointments(); }, [loadAppointments]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`agenda-week-${clinicId}-${weekStartStr}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'appointments', filter: `clinic_id=eq.${clinicId}` },
        () => { loadAppointments(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [clinicId, weekStartStr, loadAppointments]);

  // Eventos pessoais (events) — espelha com /calendar
  const loadUserEvents = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('events')
      .select('id, date, time, title, type, color')
      .eq('user_id', user.id)
      .gte('date', weekStartStr)
      .lte('date', weekEndStr);
    setUserEvents((data || []) as any);
  }, [user?.id, weekStartStr, weekEndStr]);
  useEffect(() => { loadUserEvents(); }, [loadUserEvents]);

  // Realtime — eventos pessoais e bloqueios (espelhar com /calendar)
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`agenda-week-events-${clinicId}-${user.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'events', filter: `user_id=eq.${user.id}` },
        () => { loadUserEvents(); }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_blocks', filter: `user_id=eq.${user.id}` },
        () => { reloadBlocks(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [clinicId, user?.id, loadUserEvents, reloadBlocks]);

  // Inclui agendamentos recorrentes de outras semanas (replicar para semana atual)
  const recurringFromOtherWeeks = useMemo(() => {
    // Carregaremos separadamente para não duplicar — feito em outro effect abaixo
    return [] as AppointmentRow[];
  }, []);

  const [recurringSeed, setRecurringSeed] = useState<AppointmentRow[]>([]);

  useEffect(() => {
    // Carrega TODOS os agendamentos recorrentes da clínica e replica para a semana visível
    supabase
      .from('appointments' as any)
      .select('id, date, time, end_time, patient_id, therapist_user_id, status, room, convenio, notes, is_recurring, procedure_id, package_id')
      .eq('clinic_id', clinicId)
      .eq('is_recurring', true)
      .then(({ data }) => setRecurringSeed((data || []) as AppointmentRow[]));
  }, [clinicId]);

  // Aplica filtros
  const visibleByDay = useMemo(() => {
    const map: Record<string, AppointmentRow[]> = {};
    weekDays.forEach(d => { map[format(d, 'yyyy-MM-dd')] = []; });

    const matchFilters = (a: AppointmentRow) => {
      if (statusFilter.length > 0 && !statusFilter.includes(a.status)) return false;
      if (therapistFilter.length > 0 && (!a.therapist_user_id || !therapistFilter.includes(a.therapist_user_id))) return false;
      if (patientSearch) {
        const p = clinicPatients.find(p => p.id === a.patient_id);
        if (!p || !p.name.toLowerCase().includes(patientSearch.toLowerCase())) return false;
      }
      return true;
    };

    // 1) Agendamentos diretos da semana
    appointments.forEach(a => {
      if (!matchFilters(a)) return;
      if (map[a.date]) map[a.date].push(a);
    });

    // 2) Recorrentes: para cada dia da semana, se algum recurring tem o mesmo dia da semana
    //    e a data original é <= dia atual, criar uma instância virtual (id: rec:<id>:<date>)
    weekDays.forEach(d => {
      const dStr = format(d, 'yyyy-MM-dd');
      const dow = d.getDay();
      recurringSeed.forEach(r => {
        try {
          const origin = parseISO(r.date + 'T12:00:00');
          if (origin.getDay() !== dow) return;
          if (origin > d) return;
          // Se já existe um agendamento direto neste dia no mesmo horário+paciente, pular
          const dup = appointments.some(a =>
            a.date === dStr && a.time === r.time && a.patient_id === r.patient_id
          );
          if (dup) return;
          const virtual: AppointmentRow = { ...r, id: `rec:${r.id}:${dStr}`, date: dStr };
          if (matchFilters(virtual) && map[dStr]) map[dStr].push(virtual);
        } catch {}
      });
    });

    // Ordena por horário
    Object.keys(map).forEach(k => {
      map[k].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
    });
    return map;
  }, [appointments, recurringSeed, weekDays, statusFilter, therapistFilter, patientSearch, clinicPatients]);

  // Faixa de horários do grid (07h–18h por padrão)
  const hours = useMemo(() => {
    const list: string[] = [];
    for (let h = 7; h <= 18; h++) list.push(`${String(h).padStart(2, '0')}:00`);
    return list;
  }, []);

  const goPrevWeek = () => setWeekStart(d => addDays(d, -7));
  const goNextWeek = () => setWeekStart(d => addDays(d, 7));
  const goToday = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const openNew = () => {
    setDraft({
      date: format(new Date(), 'yyyy-MM-dd'),
      time: '08:00',
      therapist_user_id: therapistFilter.length === 1 ? therapistFilter[0] : '',
    });
    setDialogOpen(true);
  };

  const openSlot = (day: Date, hour: string) => {
    setDraft({
      date: format(day, 'yyyy-MM-dd'),
      time: hour,
      therapist_user_id: therapistFilter.length === 1 ? therapistFilter[0] : '',
    });
    setDialogOpen(true);
  };

  const openExisting = (a: AppointmentRow) => {
    // Instância virtual de recorrência: cria como novo agendamento concreto naquela data
    if (a.id.startsWith('rec:')) {
      setDraft({
        date: a.date,
        time: a.time,
        end_time: a.end_time || undefined,
        patient_id: a.patient_id,
        therapist_user_id: a.therapist_user_id || '',
        status: a.status,
        room: a.room || '',
        convenio: a.convenio || '',
        notes: a.notes || '',
        is_recurring: false,
        procedure_id: a.procedure_id || null,
        package_id: a.package_id || null,
      });
    } else {
      setDraft({
        id: a.id,
        date: a.date,
        time: a.time,
        end_time: a.end_time || undefined,
        patient_id: a.patient_id,
        therapist_user_id: a.therapist_user_id || '',
        status: a.status,
        room: a.room || '',
        convenio: a.convenio || '',
        notes: a.notes || '',
        is_recurring: a.is_recurring,
        procedure_id: a.procedure_id || null,
        package_id: a.package_id || null,
      });
    }
    setDialogOpen(true);
  };

  const patientName = (id: string) =>
    clinicPatients.find(p => p.id === id)?.name || 'Paciente';
  const therapistShort = (uid: string | null) => {
    if (!uid) return '';
    const m = memberOptions.find(m => m.userId === uid);
    if (!m) return '';
    const parts = m.name.split(' ');
    return parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0];
  };

  const toggleArr = (arr: string[], v: string, set: (a: string[]) => void) => {
    set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
  };

  const filterCount = statusFilter.length + therapistFilter.length + (patientSearch ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Filtros + botão novo */}
      <div className="flex flex-wrap items-center gap-2 bg-card rounded-xl p-3 border border-border">
        {/* Status */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Filter className="w-3.5 h-3.5" />
              Status {statusFilter.length > 0 && `(${statusFilter.length})`}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3" align="start">
            <div className="space-y-2">
              {ALL_STATUSES.map(s => (
                <label key={s.value} className="flex items-center gap-2 cursor-pointer text-sm">
                  <Checkbox
                    checked={statusFilter.includes(s.value)}
                    onCheckedChange={() => toggleArr(statusFilter, s.value, setStatusFilter)}
                  />
                  {s.label}
                </label>
              ))}
              {statusFilter.length > 0 && (
                <Button variant="ghost" size="sm" className="w-full" onClick={() => setStatusFilter([])}>
                  Limpar
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Profissionais */}
        {memberOptions.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Filter className="w-3.5 h-3.5" />
                Profissionais {therapistFilter.length > 0 && `(${therapistFilter.length})`}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="start">
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {memberOptions.map(m => (
                  <label key={m.userId} className="flex items-center gap-2 cursor-pointer text-sm">
                    <Checkbox
                      checked={therapistFilter.includes(m.userId)}
                      onCheckedChange={() => toggleArr(therapistFilter, m.userId, setTherapistFilter)}
                    />
                    {m.name}{m.userId === user?.id ? ' (você)' : ''}
                  </label>
                ))}
              </div>
              <div className="flex gap-1 mt-2">
                <Button variant="ghost" size="sm" className="flex-1"
                  onClick={() => setTherapistFilter(memberOptions.map(m => m.userId))}>
                  Todos
                </Button>
                <Button variant="ghost" size="sm" className="flex-1" onClick={() => setTherapistFilter([])}>
                  Limpar
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Paciente */}
        <Input
          placeholder="Buscar paciente..."
          value={patientSearch}
          onChange={(e) => setPatientSearch(e.target.value)}
          className="h-9 w-44"
        />

        {filterCount > 0 && (
          <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => {
            setStatusFilter([]); setTherapistFilter([]); setPatientSearch('');
          }}>
            <Trash2 className="w-3 h-3" /> Limpar filtros
          </Button>
        )}

        <div className="ml-auto">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setBlockDialogOpen(true)}>
              <CalendarOff className="w-4 h-4" /> Bloqueio
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setEventDialogDate(new Date()); setEventDialogOpen(true); }}>
              <Bell className="w-4 h-4" /> Evento
            </Button>
            <Button size="sm" className="gap-1.5" onClick={openNew}>
              <Plus className="w-4 h-4" /> Novo Agendamento
            </Button>
            {onOpenSettings && (
              <Button
                size="icon"
                variant="outline"
                className="h-9 w-9"
                onClick={onOpenSettings}
                title="Configurações da agenda"
                aria-label="Configurações da agenda"
              >
                <Settings2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Navegação semana */}
      <div className="flex items-center justify-between bg-card rounded-xl p-3 border border-border">
        <Button variant="ghost" size="icon" onClick={goPrevWeek}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="text-center">
          <h3 className="font-bold text-foreground">
            {format(weekStart, "d 'de' MMM", { locale: ptBR })} – {format(addDays(weekStart, 6), "d 'de' MMM 'de' yyyy", { locale: ptBR })}
          </h3>
          <Button variant="link" size="sm" className="text-xs p-0 h-auto" onClick={goToday}>
            Ir para semana atual
          </Button>
        </div>
        <Button variant="ghost" size="icon" onClick={goNextWeek}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Grid semanal */}
      <div className="bg-card rounded-xl border border-border overflow-x-auto">
        <div className="min-w-[760px]">
          {/* Header dias */}
          <div className="grid grid-cols-[60px_repeat(7,_1fr)] sticky top-0 bg-card z-10 border-b border-border">
            <div />
            {weekDays.map(d => {
              const today = isSameDay(d, new Date());
              const dStr = format(d, 'yyyy-MM-dd');
              const block = getBlockForDate(dStr, clinicId);
              return (
                <div key={d.toISOString()} className={cn(
                  "p-2 text-center border-l border-border",
                  today && "bg-primary/5",
                  block && "bg-muted/40"
                )}>
                  <div className="text-[10px] uppercase text-muted-foreground">
                    {format(d, 'EEE', { locale: ptBR })}
                  </div>
                  <div className={cn("text-sm font-bold", today && "text-primary")}>
                    {format(d, 'dd/MM')}
                  </div>
                  {block && (
                    <div className="mt-0.5 flex items-center justify-center gap-1 text-[9px] text-muted-foreground" title={block.description}>
                      <CalendarOff className="w-2.5 h-2.5" />
                      <span className="truncate max-w-[80px]">{block.block_type === 'feriado' ? 'Feriado' : 'Férias'}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Linhas de hora */}
          {hours.map(hour => (
            <div key={hour} className="grid grid-cols-[60px_repeat(7,_1fr)] border-b border-border">
              <div className="p-1 text-xs text-muted-foreground text-right pr-2 bg-muted/30 border-r border-border">
                {hour}
              </div>
              {weekDays.map(d => {
                const dStr = format(d, 'yyyy-MM-dd');
                const hourMin = timeToMinutes(hour);
                const apptsThisSlot = (visibleByDay[dStr] || []).filter(a => {
                  const m = timeToMinutes(a.time);
                  return m >= hourMin && m < hourMin + 60;
                });
                const eventsThisSlot = userEvents.filter(ev => {
                  if (ev.date !== dStr) return false;
                  if (!ev.time) return hour === '07:00';
                  const m = timeToMinutes(ev.time.slice(0, 5));
                  return m >= hourMin && m < hourMin + 60;
                });
                const blockHere = getBlockForDate(dStr, clinicId);
                return (
                  <div
                    key={d.toISOString()}
                    className={cn(
                      "border-l border-border min-h-[56px] p-0.5 hover:bg-secondary/30 cursor-pointer transition-colors relative",
                      blockHere && "bg-muted/30"
                    )}
                    onClick={(e) => {
                      // Não abrir slot se clicou em card
                      if ((e.target as HTMLElement).closest('[data-appt-card]')) return;
                      if (blockHere) {
                        toast.info(`Dia bloqueado: ${blockHere.description}`);
                        return;
                      }
                      openSlot(d, hour);
                    }}
                  >
                    {apptsThisSlot.map(a => (
                      <button
                        key={a.id}
                        data-appt-card
                        onClick={(e) => { e.stopPropagation(); openExisting(a); }}
                        className={cn(
                          "w-full text-left text-[11px] px-1.5 py-1 rounded border mb-0.5 truncate",
                          statusStyle(a.status)
                        )}
                        title={`${a.time}${a.end_time ? '–' + a.end_time : ''} ${patientName(a.patient_id)} • ${statusLabel(a.status)}`}
                      >
                        <div className="font-semibold truncate">
                          {a.time}{a.end_time ? `–${a.end_time}` : ''} {patientName(a.patient_id)}
                        </div>
                        {a.therapist_user_id && (
                          <div className="text-[10px] opacity-75 truncate">{therapistShort(a.therapist_user_id)}</div>
                        )}
                      </button>
                    ))}
                    {eventsThisSlot.map(ev => (
                      <button
                        key={ev.id}
                        data-appt-card
                        onClick={(e) => { e.stopPropagation(); setEventDialogDate(parseISO(ev.date + 'T12:00:00')); setEventDialogOpen(true); }}
                        className="w-full text-left text-[10px] px-1.5 py-0.5 rounded border mb-0.5 truncate flex items-center gap-1"
                        style={{ borderColor: ev.color, backgroundColor: ev.color + '22', color: ev.color }}
                        title={ev.title}
                      >
                        <Bell className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{ev.time ? ev.time.slice(0,5) + ' ' : ''}{ev.title}</span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {loading && (
        <p className="text-xs text-muted-foreground text-center">Carregando...</p>
      )}

      <AppointmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        clinicId={clinicId}
        draft={draft}
        members={memberOptions}
        patients={patientOptions}
        onSaved={loadAppointments}
      />

      <CalendarBlockDialog
        open={blockDialogOpen}
        onOpenChange={setBlockDialogOpen}
        hideClinicScope
        defaultClinicId={clinicId}
      />
      <EventDialog
        open={eventDialogOpen}
        onOpenChange={setEventDialogOpen}
        selectedDate={eventDialogDate}
        onEventSaved={loadUserEvents}
      />
    </div>
  );
}