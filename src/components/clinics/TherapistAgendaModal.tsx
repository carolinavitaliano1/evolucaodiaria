import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, CalendarDays, Clock, User, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Slot {
  id?: string;
  weekday: string;
  start_time: string;
  end_time: string;
  patient_id: string;
  patient_name?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  memberId: string | null;
  memberName: string;
  memberWeekdays: string[];
  memberScheduleByDay?: Record<string, { start: string; end: string }> | null;
  clinicId: string;
  organizationId?: string | null;
}

const WEEKDAYS = [
  { value: 'segunda', label: 'Segunda' },
  { value: 'terça', label: 'Terça' },
  { value: 'quarta', label: 'Quarta' },
  { value: 'quinta', label: 'Quinta' },
  { value: 'sexta', label: 'Sexta' },
  { value: 'sábado', label: 'Sábado' },
  { value: 'domingo', label: 'Domingo' },
];

const norm = (d: string) => d.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// Map between short keys (seg/ter/...) used in schedule_by_day and full names used in patient_schedule_slots
const SHORT_TO_FULL: Record<string, string> = {
  seg: 'segunda', ter: 'terça', qua: 'quarta', qui: 'quinta',
  sex: 'sexta', sab: 'sábado', dom: 'domingo',
};
function normDay(d: string) {
  const n = norm(d);
  return norm(SHORT_TO_FULL[n] || n);
}

function buildFreeWindows(busy: Slot[], day: string, dayStart = '08:00', dayEnd = '20:00') {
  const sorted = busy
    .filter(b => normDay(b.weekday) === normDay(day))
    .filter(b => b.end_time > dayStart && b.start_time < dayEnd)
    .map(b => ({
      ...b,
      start_time: b.start_time < dayStart ? dayStart : b.start_time,
      end_time: b.end_time > dayEnd ? dayEnd : b.end_time,
    }))
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  const windows: Array<{ start: string; end: string }> = [];
  let cursor = dayStart;
  for (const b of sorted) {
    if (b.start_time > cursor) windows.push({ start: cursor, end: b.start_time });
    if (b.end_time > cursor) cursor = b.end_time;
  }
  if (cursor < dayEnd) windows.push({ start: cursor, end: dayEnd });
  return windows;
}

export function TherapistAgendaModal({ open, onOpenChange, memberId, memberName, memberWeekdays, memberScheduleByDay, clinicId, organizationId }: Props) {
  const [loading, setLoading] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [patients, setPatients] = useState<Array<{ id: string; name: string }>>([]);
  const [newPatientId, setNewPatientId] = useState('');
  const [newWeekday, setNewWeekday] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [conflictSlots, setConflictSlots] = useState<Slot[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open || !memberId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('patient_schedule_slots' as any)
        .select('id, weekday, start_time, end_time, patient_id')
        .eq('member_id', memberId)
        .eq('clinic_id', clinicId);
      if (cancelled) return;
      if (error || !data) {
        setSlots([]);
        setLoading(false);
        return;
      }
      const patientIds = Array.from(new Set((data as any[]).map(d => d.patient_id)));
      let nameMap: Record<string, string> = {};
      if (patientIds.length > 0) {
        const { data: pats } = await supabase
          .from('patients')
          .select('id, name')
          .in('id', patientIds);
        (pats || []).forEach(p => { nameMap[p.id] = p.name; });
      }
      setSlots((data as any[]).map(s => ({
        id: s.id,
        weekday: s.weekday,
        start_time: (s.start_time || '').slice(0, 5),
        end_time: (s.end_time || '').slice(0, 5),
        patient_id: s.patient_id,
        patient_name: nameMap[s.patient_id] || 'Paciente',
      })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, memberId, clinicId, reloadKey]);

  // Load active patients of the clinic for the add-form selector
  useEffect(() => {
    if (!open || !clinicId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('patients')
        .select('id, name')
        .eq('clinic_id', clinicId)
        .or('is_archived.is.null,is_archived.eq.false')
        .order('name');
      if (!cancelled) setPatients((data || []) as any);
    })();
    return () => { cancelled = true; };
  }, [open, clinicId]);

  const availableDays = useMemo(() => {
    const setDays = new Set((memberWeekdays || []).map(normDay));
    return WEEKDAYS.filter(w => setDays.size === 0 || setDays.has(normDay(w.value)));
  }, [memberWeekdays]);

  // Lookup schedule range for a given full-name day from schedule_by_day (keyed by seg/ter/...)
  function getDayRange(dayValue: string): { start: string; end: string } {
    if (!memberScheduleByDay) return { start: '08:00', end: '20:00' };
    const entry = Object.entries(memberScheduleByDay).find(([k]) => normDay(k) === normDay(dayValue));
    return entry ? entry[1] : { start: '08:00', end: '20:00' };
  }

  async function handleRemove(slotId?: string) {
    if (!slotId) return;
    const { error } = await supabase.from('patient_schedule_slots' as any).delete().eq('id', slotId);
    if (error) { toast.error('Erro ao remover'); return; }
    toast.success('Horário removido');
    setReloadKey(k => k + 1);
  }

  async function performInsert() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const { error } = await supabase.from('patient_schedule_slots' as any).insert({
      patient_id: newPatientId,
      member_id: memberId,
      clinic_id: clinicId,
      organization_id: organizationId || null,
      weekday: newWeekday,
      start_time: newStart,
      end_time: newEnd,
      created_by: user.id,
    });
    setSaving(false);
    if (error) { toast.error(error.message || 'Erro ao adicionar'); return; }
    toast.success('Horário adicionado');
    setNewPatientId(''); setNewWeekday(''); setNewStart(''); setNewEnd('');
    setConflictSlots([]);
    setConfirmOpen(false);
    setReloadKey(k => k + 1);
  }

  async function handleAdd() {
    if (!memberId || !newPatientId || !newWeekday || !newStart || !newEnd) {
      toast.error('Preencha paciente, dia e horários');
      return;
    }
    if (newEnd <= newStart) {
      toast.error('Horário final deve ser após o inicial');
      return;
    }
    // Detect overlapping slots for the same therapist on the same weekday
    const overlaps = slots.filter(s =>
      normDay(s.weekday) === normDay(newWeekday) &&
      s.start_time < newEnd && s.end_time > newStart
    );
    if (overlaps.length > 0) {
      setConflictSlots(overlaps);
      setConfirmOpen(true);
      return;
    }
    await performInsert();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            Gerenciar agenda de {memberName}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Adicione, remova e visualize pacientes nos horários disponíveis do profissional.
          </p>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Add patient form */}
            <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Adicionar paciente à agenda
              </p>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                <div className="md:col-span-2">
                  <Label className="text-[10px] text-muted-foreground">Paciente</Label>
                  <Select value={newPatientId} onValueChange={setNewPatientId}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>
                      {patients.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Dia</Label>
                  <Select value={newWeekday} onValueChange={setNewWeekday}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Dia..." /></SelectTrigger>
                    <SelectContent>
                      {availableDays.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Início</Label>
                  <Input type="time" value={newStart} onChange={e => setNewStart(e.target.value)} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Fim</Label>
                  <Input type="time" value={newEnd} onChange={e => setNewEnd(e.target.value)} className="h-8 text-xs" />
                </div>
              </div>
              <Button size="sm" className="h-8 text-xs gap-1" onClick={handleAdd} disabled={saving}>
                <Plus className="w-3 h-3" /> {saving ? 'Adicionando...' : 'Adicionar horário'}
              </Button>
            </div>

            {availableDays.length === 0 && (
              <p className="text-sm text-muted-foreground italic text-center py-6">
                Este profissional não possui dias de atendimento marcados em "Gerenciar acesso".
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {availableDays.map(day => {
                const daySlots = slots
                  .filter(s => normDay(s.weekday) === normDay(day.value))
                  .sort((a, b) => a.start_time.localeCompare(b.start_time));
                const range = getDayRange(day.value);
                const free = buildFreeWindows(slots, day.value, range.start, range.end);
                return (
                  <div key={day.value} className="rounded-xl border bg-card p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">{day.label}</h4>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          Disponível {range.start}–{range.end}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {daySlots.length} {daySlots.length === 1 ? 'sessão' : 'sessões'}
                      </Badge>
                    </div>

                    {/* Busy slots */}
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
                        Horários preenchidos
                      </p>
                      {daySlots.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">Nenhum agendamento.</p>
                      ) : (
                        <ul className="space-y-1">
                          {daySlots.map((s, i) => (
                            <li key={s.id || i} className="flex items-center justify-between gap-2 text-xs bg-primary/5 border border-primary/20 rounded px-2 py-1.5 group">
                              <span className="flex items-center gap-1.5 font-mono text-primary">
                                <Clock className="w-3 h-3" />
                                {s.start_time}–{s.end_time}
                              </span>
                              <div className="flex items-center gap-1 min-w-0">
                                <span className="flex items-center gap-1 text-foreground/80 truncate min-w-0">
                                  <User className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{s.patient_name}</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemove(s.id)}
                                  className="text-destructive hover:bg-destructive/10 rounded p-0.5 shrink-0"
                                  title="Remover"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Free windows */}
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
                        Janelas disponíveis
                      </p>
                      {free.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">Sem janelas livres.</p>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {free.map((w, i) => (
                            <span
                              key={i}
                              className={cn(
                                'text-[11px] font-mono px-2 py-0.5 rounded border',
                                'bg-success/10 border-success/30 text-success'
                              )}
                            >
                              {w.start}–{w.end}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conflito de horário detectado</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  O horário {newStart}–{newEnd} ({newWeekday}) colide com {conflictSlots.length === 1 ? 'o agendamento' : 'os agendamentos'} abaixo desta terapeuta:
                </p>
                <ul className="space-y-1 bg-destructive/5 border border-destructive/20 rounded p-2">
                  {conflictSlots.map((s, i) => (
                    <li key={i} className="text-xs flex items-center justify-between gap-2">
                      <span className="font-mono text-destructive">{s.start_time}–{s.end_time}</span>
                      <span className="truncate text-foreground/80">{s.patient_name}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">Deseja realmente adicionar este paciente mesmo com o conflito?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); performInsert(); }}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? 'Adicionando...' : 'Confirmar mesmo assim'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}