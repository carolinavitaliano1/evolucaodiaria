import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import type { Supervisee } from './types';
import { WEEKDAYS } from './types';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  supervisee?: Supervisee | null;
  onSave: (payload: any, id?: string) => Promise<void>;
}

const empty = {
  name: '',
  email: '',
  whatsapp: '',
  education: '',
  council_registration: '',
  approach: '',
  link_type: 'externo',
  start_date: '',
  hours_goal: '',
  payment_type: 'sessao',
  payment_value: '',
  payment_due_day: '',
  recurrence_frequency: 'semanal',
  recurrence_time: '',
  recurrence_weekdays: [] as string[],
  status: 'ativo',
  notes: '',
};

export function SuperviseeDialog({ open, onOpenChange, supervisee, onSave }: Props) {
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (supervisee) {
      setForm({
        name: supervisee.name || '',
        email: supervisee.email || '',
        whatsapp: supervisee.whatsapp || '',
        education: supervisee.education || '',
        council_registration: supervisee.council_registration || '',
        approach: supervisee.approach || '',
        link_type: supervisee.link_type || 'externo',
        start_date: supervisee.start_date || '',
        hours_goal: supervisee.hours_goal != null ? String(supervisee.hours_goal) : '',
        payment_type: supervisee.payment_type || 'sessao',
        payment_value: supervisee.payment_value != null ? String(supervisee.payment_value) : '',
        payment_due_day: supervisee.payment_due_day != null ? String(supervisee.payment_due_day) : '',
        recurrence_frequency: supervisee.recurrence_frequency || 'semanal',
        recurrence_time: supervisee.recurrence_time || '',
        recurrence_weekdays: supervisee.recurrence_weekdays || [],
        status: supervisee.status || 'ativo',
        notes: supervisee.notes || '',
      });
    } else {
      setForm({ ...empty });
    }
  }, [open, supervisee]);

  const toggleDay = (d: string) =>
    setForm((f) => ({
      ...f,
      recurrence_weekdays: f.recurrence_weekdays.includes(d)
        ? f.recurrence_weekdays.filter((x) => x !== d)
        : [...f.recurrence_weekdays, d],
    }));

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error('Informe o nome do supervisionando');
      return;
    }
    setSaving(true);
    try {
      await onSave(
        {
          name: form.name.trim(),
          email: form.email || null,
          whatsapp: form.whatsapp || null,
          education: form.education || null,
          council_registration: form.council_registration || null,
          approach: form.approach || null,
          link_type: form.link_type,
          start_date: form.start_date || null,
          hours_goal: form.hours_goal ? Number(form.hours_goal) : null,
          payment_type: form.payment_type,
          payment_value: form.payment_value ? Number(form.payment_value) : 0,
          payment_due_day: form.payment_due_day ? Number(form.payment_due_day) : null,
          recurrence_frequency: form.recurrence_frequency,
          recurrence_time: form.recurrence_time || null,
          recurrence_weekdays: form.recurrence_weekdays.length ? form.recurrence_weekdays : null,
          status: form.status,
          notes: form.notes || null,
        },
        supervisee?.id,
      );
      toast.success(supervisee ? 'Supervisionando atualizado' : 'Supervisionando cadastrado');
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{supervisee ? 'Editar supervisionando' : 'Novo supervisionando'}</DialogTitle>
        </DialogHeader>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Nome *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>WhatsApp</Label>
            <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Formação</Label>
            <Input value={form.education} onChange={(e) => setForm({ ...form, education: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Conselho / Registro</Label>
            <Input
              placeholder="Ex.: CRP 06/12345"
              value={form.council_registration}
              onChange={(e) => setForm({ ...form, council_registration: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Abordagem</Label>
            <Input value={form.approach} onChange={(e) => setForm({ ...form, approach: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Vínculo</Label>
            <Select value={form.link_type} onValueChange={(v) => setForm({ ...form, link_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="externo">Externo</SelectItem>
                <SelectItem value="equipe">Membro da equipe</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Início</Label>
            <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Meta de horas</Label>
            <Input
              type="number"
              placeholder="Ex.: 60"
              value={form.hours_goal}
              onChange={(e) => setForm({ ...form, hours_goal: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Cobrança</Label>
            <Select value={form.payment_type} onValueChange={(v) => setForm({ ...form, payment_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sessao">Por sessão</SelectItem>
                <SelectItem value="mensal">Mensalidade</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Valor (R$)</Label>
            <Input
              type="number"
              value={form.payment_value}
              onChange={(e) => setForm({ ...form, payment_value: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Dia de vencimento</Label>
            <Input
              type="number"
              min={1}
              max={31}
              value={form.payment_due_day}
              onChange={(e) => setForm({ ...form, payment_due_day: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Frequência</Label>
            <Select
              value={form.recurrence_frequency}
              onValueChange={(v) => setForm({ ...form, recurrence_frequency: v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="semanal">Semanal</SelectItem>
                <SelectItem value="quinzenal">Quinzenal</SelectItem>
                <SelectItem value="mensal">Mensal</SelectItem>
                <SelectItem value="avulsa">Avulsa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Horário</Label>
            <Input type="time" value={form.recurrence_time} onChange={(e) => setForm({ ...form, recurrence_time: e.target.value })} />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Dias da semana</Label>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(d)}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                    form.recurrence_weekdays.includes(d)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card border-border text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="encerrado">Encerrado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Observações</Label>
            <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving} className="gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}