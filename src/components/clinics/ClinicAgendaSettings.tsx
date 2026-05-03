import { useEffect, useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Search, CalendarOff, Save, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCalendarBlocks } from '@/hooks/useCalendarBlocks';
import { Clinic, ScheduleByDay } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const WEEK_DAYS = [
  { key: 'Domingo',  short: 'Dom' },
  { key: 'Segunda',  short: 'Seg' },
  { key: 'Terça',    short: 'Ter' },
  { key: 'Quarta',   short: 'Qua' },
  { key: 'Quinta',   short: 'Qui' },
  { key: 'Sexta',    short: 'Sex' },
  { key: 'Sábado',   short: 'Sáb' },
];

const APPT_COLORS = [
  { value: 'verde',     label: 'Verde',     hex: '#22c55e' },
  { value: 'turquesa',  label: 'Turquesa',  hex: '#14b8a6' },
  { value: 'azul',      label: 'Azul',      hex: '#3b82f6' },
  { value: 'indigo',    label: 'Índigo',    hex: '#6366f1' },
  { value: 'roxo',      label: 'Roxo',      hex: '#8b5cf6' },
  { value: 'rosa',      label: 'Rosa',      hex: '#ec4899' },
  { value: 'vermelho',  label: 'Vermelho',  hex: '#ef4444' },
  { value: 'laranja',   label: 'Laranja',   hex: '#f97316' },
  { value: 'amarelo',   label: 'Amarelo',   hex: '#eab308' },
  { value: 'cinza',     label: 'Cinza',     hex: '#64748b' },
];

const REMINDER_OPTIONS = [
  { value: 'none', label: 'Sem lembrete' },
  { value: '1h',   label: '1h antes' },
  { value: '2h',   label: '2h antes' },
  { value: '4h',   label: '4h antes' },
  { value: '6h',   label: '6h antes' },
  { value: '12h',  label: '12h antes' },
  { value: '1d',   label: '1 dia antes' },
  { value: '1w',   label: '1 semana antes' },
];

const VIEW_OPTIONS = [
  { value: 'mes',          label: 'Mês' },
  { value: 'dia',          label: 'Dia' },
  { value: 'semana',       label: 'Semana' },
  { value: 'lista_dia',    label: 'Lista do dia' },
  { value: 'lista_semana', label: 'Lista da semana' },
  { value: 'profissionais',label: 'Profissionais' },
];

const FREQ_OPTIONS = [
  { value: 'diariamente', label: 'Diariamente' },
  { value: 'semanalmente',label: 'Semanalmente' },
  { value: 'quinzenal',   label: 'A cada 2 semanas' },
  { value: 'tres_semanas',label: 'A cada 3 semanas' },
  { value: 'quatro_semanas', label: 'A cada 4 semanas' },
  { value: 'mensalmente', label: 'Mensalmente' },
];

interface AgendaPrefs {
  defaultView: string;
  defaultDuration: number;
  displayInterval: number;
  appointmentColor: string;
  frequency: string;
  repetitions: number;
  showBirthdays: boolean;
  enableDragDrop: boolean;
  delimitTimes: boolean;
  showProfessionalName: boolean;
  dailyReports: boolean;
  limitPerSlot: boolean;
  adjustAfterBreak: boolean;
  reminderEmail: string;
  reminderSms: string;
  reminderWhatsapp: string;
}

const DEFAULT_PREFS: AgendaPrefs = {
  defaultView: 'semana',
  defaultDuration: 50,
  displayInterval: 30,
  appointmentColor: 'azul',
  frequency: 'semanalmente',
  repetitions: 4,
  showBirthdays: true,
  enableDragDrop: true,
  delimitTimes: true,
  showProfessionalName: true,
  dailyReports: false,
  limitPerSlot: false,
  adjustAfterBreak: false,
  reminderEmail: '1d',
  reminderSms: 'none',
  reminderWhatsapp: '2h',
};

interface DayConfig {
  active: boolean;
  workStart: string;
  workEnd: string;
  breakStart: string;
  breakEnd: string;
}

function buildDayConfigFromClinic(clinic: Clinic): Record<string, DayConfig> {
  const out: Record<string, DayConfig> = {};
  for (const d of WEEK_DAYS) {
    const sb = clinic.scheduleByDay?.[d.key];
    const active = (clinic.weekdays || []).includes(d.key) || !!sb;
    out[d.key] = {
      active,
      workStart: sb?.start || (active ? '08:00' : ''),
      workEnd:   sb?.end   || (active ? '18:00' : ''),
      breakStart: '',
      breakEnd: '',
    };
  }
  return out;
}

interface CustomStatus { id: string; label: string; description?: string }
const DEFAULT_STATUSES: CustomStatus[] = [
  { id: 'agendado',     label: 'Agendado',     description: 'Status inicial. Reserva o horário e dispara lembretes.' },
  { id: 'confirmado',   label: 'Presença confirmada', description: 'Paciente confirmou. Cancela lembretes pendentes.' },
  { id: 'atendido',     label: 'Atendido',     description: 'Sessão realizada. Conta para produtividade e desconta de pacotes.' },
  { id: 'cancelado',    label: 'Cancelado',    description: 'Cancelamento prévio. Não cobra do paciente nem paga o terapeuta.' },
  { id: 'faltou',       label: 'Faltou',       description: 'Falta sem justificativa. Pode gerar cobrança conforme regra da clínica.' },
  { id: 'faltou_aviso', label: 'Faltou (com aviso prévio)', description: 'Falta avisada. Cobrança pode ser dispensada conforme política.' },
  { id: 'faltou_sem',   label: 'Faltou (sem aviso prévio)', description: 'Falta não avisada. Cobrança integral conforme regra.' },
  { id: 'nao_atendido', label: 'Não atendido', description: 'Atendimento não ocorreu. Cancela lembretes futuros.' },
  { id: 'nao_atendido_sc', label: 'Não atendido (sem cobrança)', description: 'Não realizado por motivo da clínica. Sem cobrança.' },
  { id: 'remarcar',     label: 'Remarcar',     description: 'Sinaliza necessidade de reagendamento.' },
];

export default function ClinicAgendaSettings({ clinic }: { clinic: Clinic }) {
  const { user } = useAuth();
  const { updateClinic } = useApp();
  const { blocks, create: createBlock, remove: removeBlock } = useCalendarBlocks();

  const prefsKey = `agenda-prefs:${clinic.id}`;
  const statusKey = `agenda-statuses:${clinic.id}`;

  const [prefs, setPrefs] = useState<AgendaPrefs>(DEFAULT_PREFS);
  const [days, setDays] = useState<Record<string, DayConfig>>(() => buildDayConfigFromClinic(clinic));
  const [savingPrefs, setSavingPrefs] = useState(false);

  const [statuses, setStatuses] = useState<CustomStatus[]>(DEFAULT_STATUSES);
  const [statusSearch, setStatusSearch] = useState('');
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState<CustomStatus | null>(null);
  const [statusForm, setStatusForm] = useState({ label: '', description: '' });

  const [yearFilter, setYearFilter] = useState<string>(String(new Date().getFullYear()));
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [holidayDialogOpen, setHolidayDialogOpen] = useState(false);
  const [holidayForm, setHolidayForm] = useState({ description: '', date: '', allowSchedule: false });

  // Load prefs + statuses from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(prefsKey);
      if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
    } catch {}
    try {
      const raw = localStorage.getItem(statusKey);
      if (raw) {
        const parsed = JSON.parse(raw) as CustomStatus[];
        if (Array.isArray(parsed) && parsed.length) setStatuses(parsed);
      }
    } catch {}
  }, [prefsKey, statusKey]);

  // Sync days when clinic changes from outside
  useEffect(() => {
    setDays(buildDayConfigFromClinic(clinic));
  }, [clinic.id, clinic.weekdays, clinic.scheduleByDay]);

  const saveStatuses = (next: CustomStatus[]) => {
    setStatuses(next);
    try { localStorage.setItem(statusKey, JSON.stringify(next)); } catch {}
  };

  const handleSavePrefs = async () => {
    setSavingPrefs(true);
    try {
      // Persist agenda preferences locally per clinic
      localStorage.setItem(prefsKey, JSON.stringify(prefs));

      // Persist work hours into clinic schedule_by_day + weekdays
      const newScheduleByDay: ScheduleByDay = {};
      const newWeekdays: string[] = [];
      for (const d of WEEK_DAYS) {
        const cfg = days[d.key];
        if (cfg?.active && cfg.workStart && cfg.workEnd) {
          newScheduleByDay[d.key] = { start: cfg.workStart, end: cfg.workEnd };
          newWeekdays.push(d.key);
        }
      }
      await updateClinic(clinic.id, {
        scheduleByDay: newScheduleByDay,
        weekdays: newWeekdays,
      });
      toast.success('Configurações salvas');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSavingPrefs(false);
    }
  };

  // ----- STATUS handlers -----
  const openNewStatus = () => {
    setEditingStatus(null);
    setStatusForm({ label: '', description: '' });
    setStatusDialogOpen(true);
  };
  const openEditStatus = (s: CustomStatus) => {
    setEditingStatus(s);
    setStatusForm({ label: s.label, description: s.description || '' });
    setStatusDialogOpen(true);
  };
  const submitStatus = () => {
    const label = statusForm.label.trim();
    if (!label) return toast.error('Informe o nome do status');
    if (editingStatus) {
      saveStatuses(statuses.map(s => s.id === editingStatus.id ? { ...s, label, description: statusForm.description.trim() || undefined } : s));
      toast.success('Status atualizado');
    } else {
      const id = label.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '_' + Date.now().toString(36);
      saveStatuses([...statuses, { id, label, description: statusForm.description.trim() || undefined }]);
      toast.success('Status cadastrado');
    }
    setStatusDialogOpen(false);
  };
  const deleteStatus = (id: string) => {
    if (!confirm('Remover este status?')) return;
    saveStatuses(statuses.filter(s => s.id !== id));
  };

  const filteredStatuses = useMemo(() => {
    const q = statusSearch.trim().toLowerCase();
    if (!q) return statuses;
    return statuses.filter(s => s.label.toLowerCase().includes(q));
  }, [statuses, statusSearch]);

  // ----- HOLIDAYS -----
  const submitHoliday = async () => {
    if (!holidayForm.date) return toast.error('Informe a data');
    if (!holidayForm.description.trim()) return toast.error('Informe o nome do feriado');
    const { error } = await createBlock({
      block_type: 'feriado',
      start_date: holidayForm.date,
      end_date: holidayForm.date,
      description: holidayForm.description.trim(),
      clinic_id: clinic.id,
    });
    if (error) return toast.error('Erro ao salvar feriado');
    toast.success('Feriado adicionado');
    setHolidayDialogOpen(false);
    setHolidayForm({ description: '', date: '', allowSchedule: false });
  };

  const filteredHolidays = useMemo(() => {
    return blocks
      .filter(b => b.block_type === 'feriado')
      .filter(b => !b.clinic_id || b.clinic_id === clinic.id)
      .filter(b => {
        const [y, m] = b.start_date.split('-');
        if (yearFilter !== 'all' && y !== yearFilter) return false;
        if (monthFilter !== 'all' && m !== monthFilter) return false;
        return true;
      })
      .sort((a, b) => b.start_date.localeCompare(a.start_date));
  }, [blocks, yearFilter, monthFilter, clinic.id]);

  const years = useMemo(() => {
    const arr: string[] = [];
    for (let y = 2021; y <= 2030; y++) arr.push(String(y));
    return arr;
  }, []);
  const months = [
    { v: '01', l: 'Janeiro' }, { v: '02', l: 'Fevereiro' }, { v: '03', l: 'Março' },
    { v: '04', l: 'Abril' }, { v: '05', l: 'Maio' }, { v: '06', l: 'Junho' },
    { v: '07', l: 'Julho' }, { v: '08', l: 'Agosto' }, { v: '09', l: 'Setembro' },
    { v: '10', l: 'Outubro' }, { v: '11', l: 'Novembro' }, { v: '12', l: 'Dezembro' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base lg:text-lg">
          <Settings2 className="w-5 h-5 text-primary" /> Configurações da Agenda
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="opcoes" className="space-y-4">
          <TabsList className="grid grid-cols-3 w-full max-w-2xl">
            <TabsTrigger value="opcoes">Opções da Agenda</TabsTrigger>
            <TabsTrigger value="status">Status de Agendamento</TabsTrigger>
            <TabsTrigger value="feriados">Feriados</TabsTrigger>
          </TabsList>

          {/* ============= OPÇÕES ============= */}
          <TabsContent value="opcoes" className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="flex-1 max-w-md">
                <Label className="text-xs">Profissional / Secretária(o)</Label>
                <Select defaultValue="self">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="self">{user?.user_metadata?.full_name || user?.email || 'Profissional atual'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Card 1 — Visualização */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Configurações de visualização</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Visualização padrão</Label>
                  <Select value={prefs.defaultView} onValueChange={v => setPrefs({ ...prefs, defaultView: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {VIEW_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Cor dos agendamentos</Label>
                  <Select value={prefs.appointmentColor} onValueChange={v => setPrefs({ ...prefs, appointmentColor: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {APPT_COLORS.map(c => (
                        <SelectItem key={c.value} value={c.value}>
                          <span className="inline-flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full border border-border" style={{ background: c.hex }} />
                            {c.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Duração padrão (minutos)</Label>
                  <Input type="number" min={5} step={5} value={prefs.defaultDuration}
                    onChange={e => setPrefs({ ...prefs, defaultDuration: Number(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label className="text-xs">Intervalo de exibição (minutos)</Label>
                  <Input type="number" min={5} step={5} value={prefs.displayInterval}
                    onChange={e => setPrefs({ ...prefs, displayInterval: Number(e.target.value) || 0 })} />
                </div>
              </CardContent>
            </Card>

            {/* Card 2 — Repetições */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Repetições e comportamento visual</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Frequência</Label>
                    <Select value={prefs.frequency} onValueChange={v => setPrefs({ ...prefs, frequency: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FREQ_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Repetições (padrão)</Label>
                    <Input type="number" min={1} value={prefs.repetitions}
                      onChange={e => setPrefs({ ...prefs, repetitions: Number(e.target.value) || 0 })} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {([
                    ['showBirthdays', 'Mostrar aniversariantes'],
                    ['enableDragDrop', 'Habilitar arrasta e solta na agenda'],
                    ['delimitTimes', 'Delimitar horário de agendamentos'],
                    ['showProfessionalName', 'Mostrar nome do profissional'],
                  ] as const).map(([k, l]) => (
                    <label key={k} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                      <span className="text-sm">{l}</span>
                      <Switch checked={prefs[k] as boolean} onCheckedChange={v => setPrefs({ ...prefs, [k]: v })} />
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Card 3 — Expediente */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Horário de expediente</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">Dia</TableHead>
                        <TableHead className="w-16">Ativo</TableHead>
                        <TableHead>Expediente das</TableHead>
                        <TableHead>até</TableHead>
                        <TableHead>Intervalo das</TableHead>
                        <TableHead>até</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {WEEK_DAYS.map(d => {
                        const cfg = days[d.key];
                        return (
                          <TableRow key={d.key}>
                            <TableCell className="font-medium">{d.short}</TableCell>
                            <TableCell>
                              <Checkbox
                                checked={cfg.active}
                                onCheckedChange={(v) => setDays(prev => ({ ...prev, [d.key]: { ...prev[d.key], active: !!v } }))}
                              />
                            </TableCell>
                            <TableCell><Input type="time" disabled={!cfg.active} value={cfg.workStart}
                              onChange={e => setDays(p => ({ ...p, [d.key]: { ...p[d.key], workStart: e.target.value } }))} /></TableCell>
                            <TableCell><Input type="time" disabled={!cfg.active} value={cfg.workEnd}
                              onChange={e => setDays(p => ({ ...p, [d.key]: { ...p[d.key], workEnd: e.target.value } }))} /></TableCell>
                            <TableCell><Input type="time" disabled={!cfg.active} value={cfg.breakStart}
                              onChange={e => setDays(p => ({ ...p, [d.key]: { ...p[d.key], breakStart: e.target.value } }))} /></TableCell>
                            <TableCell><Input type="time" disabled={!cfg.active} value={cfg.breakEnd}
                              onChange={e => setDays(p => ({ ...p, [d.key]: { ...p[d.key], breakEnd: e.target.value } }))} /></TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Card 4 — Adicionais e lembretes */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Configurações adicionais e lembretes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                    <span className="text-sm">Relatórios diários</span>
                    <Switch checked={prefs.dailyReports} onCheckedChange={v => setPrefs({ ...prefs, dailyReports: v })} />
                  </label>
                  <label className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                    <span className="text-sm">Limite de atendimentos por horário</span>
                    <Switch checked={prefs.limitPerSlot} onCheckedChange={v => setPrefs({ ...prefs, limitPerSlot: v })} />
                  </label>
                </div>
                <label className="flex items-center gap-2">
                  <Checkbox checked={prefs.adjustAfterBreak} onCheckedChange={v => setPrefs({ ...prefs, adjustAfterBreak: !!v })} />
                  <span className="text-sm">Ajustar o horário posterior ao intervalo</span>
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                  {([
                    ['reminderEmail',    'Lembrete E-mail'],
                    ['reminderSms',      'Lembrete SMS'],
                    ['reminderWhatsapp', 'Lembrete WhatsApp'],
                  ] as const).map(([k, l]) => (
                    <div key={k}>
                      <Label className="text-xs">{l}</Label>
                      <Select value={prefs[k] as string} onValueChange={v => setPrefs({ ...prefs, [k]: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {REMINDER_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end pt-2">
              <Button onClick={handleSavePrefs} disabled={savingPrefs} className="gradient-primary">
                <Save className="w-4 h-4 mr-1" /> {savingPrefs ? 'Salvando…' : 'Salvar configurações'}
              </Button>
            </div>
          </TabsContent>

          {/* ============= STATUS ============= */}
          <TabsContent value="status" className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
              <div className="relative max-w-sm w-full">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="Buscar status…" value={statusSearch} onChange={e => setStatusSearch(e.target.value)} />
              </div>
              <Button onClick={openNewStatus} className="gradient-primary">
                <Plus className="w-4 h-4 mr-1" /> Cadastrar Status
              </Button>
            </div>

            <div className="border border-border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-32 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStatuses.length === 0 && (
                    <TableRow><TableCell colSpan={2} className="text-center text-sm text-muted-foreground py-6">Nenhum status encontrado.</TableCell></TableRow>
                  )}
                  {filteredStatuses.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.label}</TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => openEditStatus(s)}><Pencil className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteStatus(s.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Legenda / Regras de negócio</CardTitle></CardHeader>
              <CardContent className="space-y-1.5">
                {statuses.map(s => (
                  <p key={s.id} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{s.label}:</span>{' '}
                    {s.description || 'Sem regra específica configurada.'}
                  </p>
                ))}
              </CardContent>
            </Card>

            <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>{editingStatus ? 'Editar status' : 'Cadastrar status'}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Nome</Label>
                    <Input value={statusForm.label} onChange={e => setStatusForm({ ...statusForm, label: e.target.value })} placeholder="Ex: Em espera" />
                  </div>
                  <div>
                    <Label className="text-xs">Descrição (regra de negócio)</Label>
                    <Input value={statusForm.description} onChange={e => setStatusForm({ ...statusForm, description: e.target.value })} placeholder="Ex: Aguardando confirmação do paciente" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={submitStatus} className="gradient-primary">Salvar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* ============= FERIADOS ============= */}
          <TabsContent value="feriados" className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-end sm:justify-between">
              <div className="flex gap-2">
                <div>
                  <Label className="text-xs">Ano</Label>
                  <Select value={yearFilter} onValueChange={setYearFilter}>
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Mês</Label>
                  <Select value={monthFilter} onValueChange={setMonthFilter}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {months.map(m => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={() => setHolidayDialogOpen(true)} className="gradient-primary">
                <Plus className="w-4 h-4 mr-1" /> Novo Feriado
              </Button>
            </div>

            <div className="border border-border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead className="w-32">Data</TableHead>
                    <TableHead className="w-40">Permissão de agendamentos</TableHead>
                    <TableHead className="w-24 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHolidays.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">
                      <CalendarOff className="w-5 h-5 mx-auto mb-1 opacity-50" />
                      Nenhum feriado encontrado para este filtro.
                    </TableCell></TableRow>
                  )}
                  {filteredHolidays.map(b => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.description}</TableCell>
                      <TableCell>{format(new Date(b.start_date + 'T12:00:00'), 'dd/MM/yy', { locale: ptBR })}</TableCell>
                      <TableCell><Badge variant="outline" className="text-destructive border-destructive/40">Bloqueado</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={async () => {
                          if (!confirm('Remover este feriado?')) return;
                          const { error } = await removeBlock(b.id);
                          if (error) toast.error('Erro ao remover'); else toast.success('Feriado removido');
                        }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Dialog open={holidayDialogOpen} onOpenChange={setHolidayDialogOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Novo Feriado</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Nome</Label>
                    <Input value={holidayForm.description} onChange={e => setHolidayForm({ ...holidayForm, description: e.target.value })} placeholder="Ex: Natal" />
                  </div>
                  <div>
                    <Label className="text-xs">Data</Label>
                    <Input type="date" value={holidayForm.date} onChange={e => setHolidayForm({ ...holidayForm, date: e.target.value })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setHolidayDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={submitHoliday} className="gradient-primary">Salvar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}