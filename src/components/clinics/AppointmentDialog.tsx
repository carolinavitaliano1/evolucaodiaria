import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CalendarBlockDialog } from '@/components/calendar/CalendarBlockDialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { ChevronsUpDown, Check, Link2, HelpCircle, Settings, Table as TableIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

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

interface MemberOption { userId: string; name: string; }
interface PatientOption { id: string; name: string; }

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

const PARTICULAR = '__particular__';
const NONE = '__none__';

function addOneHour(time: string): string {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return time;
  const [h, m] = time.split(':').map(Number);
  const next = (h + 1) % 24;
  return `${String(next).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function maskPhone(v: string): string {
  const d = (v || '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : '';
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// Tag helpers — guardam dados extras dentro de `notes`
const TAG_RE = /\[(encaixe|autorizacao:[^\]]*|procedimento:[^\]]*|lembrete_wa:[^\]]*|celular:[^\]]*|lancar_financeiro)\]/gi;

interface ParsedNotes {
  text: string;
  encaixe: boolean;
  autorizacao: string;
  procedimentoId: string;
  lembreteWa: string;
  celular: string;
  lancarFinanceiro: boolean;
}

function parseNotes(raw: string | null | undefined): ParsedNotes {
  const out: ParsedNotes = {
    text: '', encaixe: false, autorizacao: '', procedimentoId: '',
    lembreteWa: '', celular: '', lancarFinanceiro: false,
  };
  if (!raw) return out;
  const tags: string[] = [];
  raw.replace(TAG_RE, (m) => { tags.push(m); return m; });
  for (const t of tags) {
    const inner = t.slice(1, -1);
    if (inner === 'encaixe') out.encaixe = true;
    else if (inner === 'lancar_financeiro') out.lancarFinanceiro = true;
    else if (inner.startsWith('autorizacao:')) out.autorizacao = inner.slice(12);
    else if (inner.startsWith('procedimento:')) out.procedimentoId = inner.slice(13);
    else if (inner.startsWith('lembrete_wa:')) out.lembreteWa = inner.slice(12);
    else if (inner.startsWith('celular:')) out.celular = inner.slice(8);
  }
  // remove bloco de tags (tudo após '---' se contiver tags), senão remove as tags inline
  const sepIdx = raw.indexOf('\n---');
  if (sepIdx >= 0 && TAG_RE.test(raw.slice(sepIdx))) {
    out.text = raw.slice(0, sepIdx).trim();
  } else {
    out.text = raw.replace(TAG_RE, '').trim();
  }
  return out;
}

function buildNotes(p: ParsedNotes): string {
  const tags: string[] = [];
  if (p.encaixe) tags.push('[encaixe]');
  if (p.lancarFinanceiro) tags.push('[lancar_financeiro]');
  if (p.autorizacao.trim()) tags.push(`[autorizacao:${p.autorizacao.trim()}]`);
  if (p.procedimentoId) tags.push(`[procedimento:${p.procedimentoId}]`);
  if (p.lembreteWa) tags.push(`[lembrete_wa:${p.lembreteWa}]`);
  if (p.celular.trim()) tags.push(`[celular:${p.celular.replace(/\D/g, '')}]`);
  if (!tags.length) return p.text.trim();
  return `${p.text.trim()}\n---\n${tags.join('\n')}`.trim();
}

interface HealthPlan { id: string; name: string; }
interface ServiceItem { id: string; name: string; price: number | null; }

export function AppointmentDialog({
  open, onOpenChange, clinicId, draft, members, patients, onSaved,
}: AppointmentDialogProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [patientPopOpen, setPatientPopOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);

  const [healthPlans, setHealthPlans] = useState<HealthPlan[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [memberSpecialties, setMemberSpecialties] = useState<Record<string, string>>({});
  const [knownRooms, setKnownRooms] = useState<string[]>([]);
  const [patientPhones, setPatientPhones] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    id: undefined as string | undefined,
    date: '',
    time: '',
    end_time: '',
    patient_id: '',
    therapist_user_id: '',
    status: 'agendado',
    room: '',
    convenio: PARTICULAR,
    is_recurring: false,
    encaixe: false,
    autorizacao: '',
    procedimentoId: '',
    lancarFinanceiro: false,
    celular: '',
    lembreteSms: 'none',
    lembreteWa: 'none',
    obs: '',
  });

  // Carrega convênios, serviços, salas conhecidas, especialidades e telefones quando abre
  useEffect(() => {
    if (!open || !clinicId) return;
    (async () => {
      const [hp, sv, ap, prof, pts] = await Promise.all([
        supabase.from('health_plans').select('id, name').eq('clinic_id', clinicId).eq('is_active', true).order('name'),
        user?.id
          ? supabase.from('services').select('id, name, price').eq('user_id', user.id).eq('is_active', true).order('name')
          : Promise.resolve({ data: [], error: null } as any),
        supabase.from('appointments' as any).select('room').eq('clinic_id', clinicId).not('room', 'is', null),
        members.length
          ? supabase.from('profiles').select('user_id, specialty').in('user_id', members.map(m => m.userId))
          : Promise.resolve({ data: [], error: null } as any),
        patients.length
          ? supabase.from('patients').select('id, phone').in('id', patients.map(p => p.id))
          : Promise.resolve({ data: [], error: null } as any),
      ]);
      setHealthPlans((hp.data || []) as HealthPlan[]);
      setServices(((sv.data || []) as any).map((s: any) => ({ id: s.id, name: s.name, price: s.price })));
      const rooms = Array.from(new Set(((ap.data || []) as any[]).map(r => (r.room || '').trim()).filter(Boolean))).sort();
      setKnownRooms(rooms);
      const specMap: Record<string, string> = {};
      ((prof.data || []) as any[]).forEach(p => { if (p.specialty) specMap[p.user_id] = p.specialty; });
      setMemberSpecialties(specMap);
      const phMap: Record<string, string> = {};
      ((pts.data || []) as any[]).forEach(p => { if (p.phone) phMap[p.id] = p.phone; });
      setPatientPhones(phMap);
    })();
  }, [open, clinicId, members, patients, user?.id]);

  // Inicializa formulário ao abrir / trocar draft
  useEffect(() => {
    if (!open) return;
    const parsed = parseNotes(draft?.notes);
    setForm({
      id: draft?.id,
      date: draft?.date || '',
      time: draft?.time || '',
      end_time: draft?.end_time || (draft?.time ? addOneHour(draft.time) : ''),
      patient_id: draft?.patient_id || '',
      therapist_user_id: draft?.therapist_user_id || '',
      status: draft?.status || 'agendado',
      room: draft?.room || '',
      convenio: draft?.convenio || PARTICULAR,
      is_recurring: draft?.is_recurring ?? false,
      encaixe: parsed.encaixe,
      autorizacao: parsed.autorizacao,
      procedimentoId: parsed.procedimentoId,
      lancarFinanceiro: parsed.lancarFinanceiro,
      celular: parsed.celular ? maskPhone(parsed.celular) : '',
      lembreteSms: 'none',
      lembreteWa: parsed.lembreteWa || 'none',
      obs: parsed.text,
    });
  }, [open, draft]);

  // Auto-preenche celular quando troca paciente (se vazio)
  useEffect(() => {
    if (!form.patient_id) return;
    const ph = patientPhones[form.patient_id];
    if (ph && !form.celular) {
      setForm(f => ({ ...f, celular: maskPhone(ph) }));
    }
  }, [form.patient_id, patientPhones]); // eslint-disable-line

  const selectedPatient = useMemo(
    () => patients.find(p => p.id === form.patient_id),
    [patients, form.patient_id]
  );

  const memberOptionsWithSpec = useMemo(
    () => members.map(m => ({
      userId: m.userId,
      label: memberSpecialties[m.userId] ? `${m.name} (${memberSpecialties[m.userId]})` : m.name,
    })),
    [members, memberSpecialties]
  );

  const allRooms = useMemo(() => {
    const s = new Set(knownRooms);
    if (form.room && form.room.trim()) s.add(form.room.trim());
    return Array.from(s).sort();
  }, [knownRooms, form.room]);

  const handleAddRoom = () => {
    const name = window.prompt('Nome da sala:');
    if (!name?.trim()) return;
    const v = name.trim();
    setKnownRooms(prev => Array.from(new Set([...prev, v])).sort());
    setForm(f => ({ ...f, room: v }));
  };

  const handleSave = async () => {
    if (!user) return;
    if (!form.patient_id) { toast.error('Selecione o paciente'); return; }
    if (!form.date || !form.time) { toast.error('Informe data e horário'); return; }
    if (!form.therapist_user_id) { toast.error('Selecione o profissional'); return; }

    setSaving(true);

    const notes = buildNotes({
      text: form.obs,
      encaixe: form.encaixe,
      autorizacao: form.autorizacao,
      procedimentoId: form.procedimentoId,
      lembreteWa: form.lembreteWa === 'none' ? '' : form.lembreteWa,
      celular: form.celular,
      lancarFinanceiro: form.lancarFinanceiro,
    });

    const convenioToSave = form.convenio === PARTICULAR ? 'Particular' : (
      healthPlans.find(h => h.id === form.convenio)?.name || form.convenio
    );

    const payload: any = {
      clinic_id: clinicId,
      patient_id: form.patient_id,
      date: form.date,
      time: form.time,
      end_time: form.end_time || null,
      therapist_user_id: form.therapist_user_id || null,
      status: form.status || 'agendado',
      room: form.room || null,
      convenio: convenioToSave,
      notes: notes || null,
      is_recurring: !!form.is_recurring,
      user_id: user.id,
    };

    let error;
    let savedId = form.id;
    if (form.id) {
      ({ error } = await supabase.from('appointments').update(payload).eq('id', form.id));
    } else {
      const ins = await supabase.from('appointments').insert(payload).select('id').single();
      error = ins.error;
      savedId = ins.data?.id;
    }

    if (error) {
      setSaving(false);
      toast.error('Erro ao salvar agendamento: ' + error.message);
      return;
    }

    // Lançamento financeiro automático
    if (form.lancarFinanceiro && form.procedimentoId && !form.id) {
      const svc = services.find(s => s.id === form.procedimentoId);
      if (svc) {
        const { error: pErr } = await supabase.from('private_appointments').insert({
          user_id: user.id,
          clinic_id: clinicId,
          patient_id: form.patient_id,
          client_name: selectedPatient?.name || svc.name,
          date: form.date,
          time: form.time,
          price: svc.price || 0,
          status: 'agendado',
          notes: `${svc.name} (lançado pela agenda)`,
        });
        if (pErr) toast.warning('Agendamento salvo, mas falhou ao lançar no financeiro: ' + pErr.message);
      }
    }

    setSaving(false);
    toast.success(form.id ? 'Agendamento atualizado' : 'Agendamento criado');
    onSaved();
    onOpenChange(false);
  };

  return (
    <TooltipProvider>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto bg-background">
          <DialogHeader className="flex-row items-center justify-between gap-2 space-y-0 pr-8">
            <DialogTitle className="text-lg">
              {form.id ? 'Editar agendamento' : 'Novo agendamento'}
            </DialogTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setBlockOpen(true)}
              className="h-8 gap-1.5"
            >
              <Link2 className="w-3.5 h-3.5" />
              Bloquear horário
            </Button>
          </DialogHeader>

          <div className="space-y-4">
            {/* Linha 1: Data + Horário + Repetir */}
            <div className="grid grid-cols-1 md:grid-cols-[160px_1fr_auto] gap-3 items-end">
              <div>
                <Label className="text-xs">Data:*</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Horário:*</Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">das</span>
                  <Input
                    type="time"
                    value={form.time}
                    className="w-28"
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm(f => ({ ...f, time: v, end_time: f.end_time || addOneHour(v) }));
                    }}
                  />
                  <span className="text-xs text-muted-foreground">às</span>
                  <Input
                    type="time"
                    value={form.end_time}
                    className="w-28"
                    onChange={(e) => setForm(f => ({ ...f, end_time: e.target.value }))}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 pb-2 cursor-pointer">
                <Checkbox
                  checked={!!form.is_recurring}
                  onCheckedChange={(v) => setForm(f => ({ ...f, is_recurring: !!v }))}
                />
                <span className="text-sm">Repetir</span>
              </label>
            </div>

            {/* Linha 2: Encaixe */}
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={form.encaixe}
                onCheckedChange={(v) => setForm(f => ({ ...f, encaixe: !!v }))}
              />
              <span className="text-sm">Realizar encaixe de horário para o atendimento</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs text-xs">Permite agendar mesmo havendo conflito com outro atendimento neste horário.</p>
                </TooltipContent>
              </Tooltip>
            </label>

            {/* Linha 3: Profissional */}
            <div>
              <Label className="text-xs">Profissional:*</Label>
              <Select
                value={form.therapist_user_id || ''}
                onValueChange={(v) => setForm(f => ({ ...f, therapist_user_id: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Selecione um profissional" /></SelectTrigger>
                <SelectContent>
                  {memberOptionsWithSpec.map(m => (
                    <SelectItem key={m.userId} value={m.userId}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                onClick={() => navigate('/team')}
                className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <TableIcon className="w-3 h-3" />
                Verifique o horário de trabalho e o horário de intervalo de cada profissional.
              </button>
            </div>

            {/* Linha 4: Paciente */}
            <div>
              <Label className="text-xs">Paciente:*</Label>
              <Popover open={patientPopOpen} onOpenChange={setPatientPopOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    {selectedPatient ? selectedPatient.name : 'Nome do paciente'}
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

            {/* Linha 5: Convênio + Autorização */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Convênio:*</Label>
                <Select
                  value={form.convenio}
                  onValueChange={(v) => setForm(f => ({ ...f, convenio: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PARTICULAR}>Particular</SelectItem>
                    {healthPlans.map(h => (
                      <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1">
                  Senha/Autorização/Autenticador:
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs text-xs">Código de autorização do convênio para esta sessão.</p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input
                  value={form.autorizacao}
                  onChange={(e) => setForm(f => ({ ...f, autorizacao: e.target.value }))}
                  placeholder="Opcional"
                />
              </div>
            </div>

            {/* Linha 6: Procedimento + Lançar no financeiro */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
              <div>
                <Label className="text-xs">Procedimento:</Label>
                <Select
                  value={form.procedimentoId || NONE}
                  onValueChange={(v) => setForm(f => ({ ...f, procedimentoId: v === NONE ? '' : v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Nenhum</SelectItem>
                    {services.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}{s.price ? ` — R$ ${Number(s.price).toFixed(2)}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 pb-2 cursor-pointer">
                <Checkbox
                  checked={form.lancarFinanceiro}
                  onCheckedChange={(v) => setForm(f => ({ ...f, lancarFinanceiro: !!v }))}
                  disabled={!form.procedimentoId}
                />
                <span className={cn('text-sm', !form.procedimentoId && 'text-muted-foreground')}>
                  Lançar atendimento no financeiro
                </span>
              </label>
            </div>

            {/* Linha 7: Status + Sala */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Status:</Label>
                <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Sala:</Label>
                <Select
                  value={form.room || NONE}
                  onValueChange={(v) => setForm(f => ({ ...f, room: v === NONE ? '' : v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sem sala</SelectItem>
                    {allRooms.map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  onClick={handleAddRoom}
                  className="mt-1 inline-flex items-center text-xs text-primary hover:underline"
                >
                  + Cadastrar sala
                </button>
              </div>
            </div>

            {/* Linha 8: Celular + Lembretes */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Celular:</Label>
                <Input
                  value={form.celular}
                  onChange={(e) => setForm(f => ({ ...f, celular: maskPhone(e.target.value) }))}
                  placeholder="(  )      -    "
                />
              </div>
              <div>
                <Label className="text-xs">Lembrete SMS:</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Select value="none" disabled>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sem lembrete</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Em breve</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div>
                <Label className="text-xs">Lembrete WhatsApp:</Label>
                <Select
                  value={form.lembreteWa}
                  onValueChange={(v) => setForm(f => ({ ...f, lembreteWa: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem lembrete</SelectItem>
                    <SelectItem value="1h">1 hora antes</SelectItem>
                    <SelectItem value="1d">1 dia antes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Linha 9: Observações */}
            <div>
              <Label className="text-xs">Observações:</Label>
              <Textarea
                value={form.obs}
                onChange={(e) => setForm(f => ({ ...f, obs: e.target.value }))}
                rows={3}
              />
            </div>

            {/* Rodapé */}
            <div className="flex items-center justify-between pt-2 border-t">
              <button
                type="button"
                onClick={() => navigate('/profile#agenda')}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Settings className="w-3.5 h-3.5" />
                Configurações da agenda
              </button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                  Fechar
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CalendarBlockDialog open={blockOpen} onOpenChange={setBlockOpen} />
    </TooltipProvider>
  );
}
