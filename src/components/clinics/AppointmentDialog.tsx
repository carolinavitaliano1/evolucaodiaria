import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AppointmentDraft {
  id?: string;
  date: string;          // YYYY-MM-DD
  time: string;          // HH:mm
  end_time?: string | null;
  patient_id?: string;
  therapist_user_id?: string | null;
  status?: string;
  room?: string | null;
  convenio?: string | null;
  notes?: string | null;
  is_recurring?: boolean;
}

interface MemberOption {
  userId: string;
  name: string;
}

interface PatientOption {
  id: string;
  name: string;
}

interface AppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId: string;
  draft: AppointmentDraft | null;
  members: MemberOption[];
  patients: PatientOption[];
  onSaved: () => void;
}

const STATUS_OPTIONS = [
  { value: 'agendado',   label: 'Agendado' },
  { value: 'confirmado', label: 'Confirmado' },
  { value: 'atendido',   label: 'Atendido' },
  { value: 'faltou',     label: 'Faltou' },
  { value: 'cancelado',  label: 'Cancelado' },
  { value: 'remarcar',   label: 'Remarcar' },
];

function addOneHour(time: string): string {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return time;
  const [h, m] = time.split(':').map(Number);
  const next = (h + 1) % 24;
  return `${String(next).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function AppointmentDialog({
  open,
  onOpenChange,
  clinicId,
  draft,
  members,
  patients,
  onSaved,
}: AppointmentDialogProps) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [patientPopOpen, setPatientPopOpen] = useState(false);
  const [form, setForm] = useState<AppointmentDraft>({
    date: '',
    time: '',
    end_time: '',
    patient_id: '',
    therapist_user_id: '',
    status: 'agendado',
    room: '',
    convenio: '',
    notes: '',
    is_recurring: false,
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      id: draft?.id,
      date: draft?.date || '',
      time: draft?.time || '',
      end_time: draft?.end_time || (draft?.time ? addOneHour(draft.time) : ''),
      patient_id: draft?.patient_id || '',
      therapist_user_id: draft?.therapist_user_id || '',
      status: draft?.status || 'agendado',
      room: draft?.room || '',
      convenio: draft?.convenio || '',
      notes: draft?.notes || '',
      is_recurring: draft?.is_recurring ?? false,
    });
  }, [open, draft]);

  const selectedPatient = useMemo(
    () => patients.find(p => p.id === form.patient_id),
    [patients, form.patient_id]
  );

  const handleSave = async () => {
    if (!user) return;
    if (!form.patient_id) { toast.error('Selecione o paciente'); return; }
    if (!form.date || !form.time) { toast.error('Informe data e horário'); return; }

    setSaving(true);
    const payload: any = {
      clinic_id: clinicId,
      patient_id: form.patient_id,
      date: form.date,
      time: form.time,
      end_time: form.end_time || null,
      therapist_user_id: form.therapist_user_id || null,
      status: form.status || 'agendado',
      room: form.room || null,
      convenio: form.convenio || null,
      notes: form.notes || null,
      is_recurring: !!form.is_recurring,
      user_id: user.id,
    };

    let error;
    if (form.id) {
      ({ error } = await supabase.from('appointments').update(payload).eq('id', form.id));
    } else {
      ({ error } = await supabase.from('appointments').insert(payload));
    }

    setSaving(false);
    if (error) {
      toast.error('Erro ao salvar agendamento: ' + error.message);
      return;
    }
    toast.success(form.id ? 'Agendamento atualizado' : 'Agendamento criado');
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.id ? 'Editar Agendamento' : 'Novo Agendamento'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Data *</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div>
              <Label>Início *</Label>
              <Input
                type="time"
                value={form.time}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm(f => ({ ...f, time: v, end_time: f.end_time || addOneHour(v) }));
                }}
              />
            </div>
            <div>
              <Label>Término</Label>
              <Input
                type="time"
                value={form.end_time || ''}
                onChange={(e) => setForm(f => ({ ...f, end_time: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={!!form.is_recurring}
              onCheckedChange={(v) => setForm(f => ({ ...f, is_recurring: v }))}
              id="appt-recurring"
            />
            <Label htmlFor="appt-recurring" className="cursor-pointer text-sm">
              Repetir semanalmente neste mesmo dia/horário
            </Label>
          </div>

          <div>
            <Label>Profissional</Label>
            <Select
              value={form.therapist_user_id || ''}
              onValueChange={(v) => setForm(f => ({ ...f, therapist_user_id: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um terapeuta" />
              </SelectTrigger>
              <SelectContent>
                {members.map(m => (
                  <SelectItem key={m.userId} value={m.userId}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Paciente *</Label>
            <Popover open={patientPopOpen} onOpenChange={setPatientPopOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  {selectedPatient ? selectedPatient.name : 'Buscar paciente...'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Digite o nome..." />
                  <CommandList>
                    <CommandEmpty>Nenhum paciente encontrado.</CommandEmpty>
                    <CommandGroup>
                      {patients.map(p => (
                        <CommandItem
                          key={p.id}
                          value={p.name}
                          onSelect={() => {
                            setForm(f => ({ ...f, patient_id: p.id }));
                            setPatientPopOpen(false);
                          }}
                        >
                          <Check className={cn('mr-2 h-4 w-4', form.patient_id === p.id ? 'opacity-100' : 'opacity-0')} />
                          {p.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={form.status || 'agendado'} onValueChange={(v) => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sala</Label>
              <Input
                value={form.room || ''}
                onChange={(e) => setForm(f => ({ ...f, room: e.target.value }))}
                placeholder="Sala 1, Online..."
              />
            </div>
          </div>

          <div>
            <Label>Convênio</Label>
            <Input
              value={form.convenio || ''}
              onChange={(e) => setForm(f => ({ ...f, convenio: e.target.value }))}
              placeholder="Particular, Unimed..."
            />
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea
              value={form.notes || ''}
              onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}