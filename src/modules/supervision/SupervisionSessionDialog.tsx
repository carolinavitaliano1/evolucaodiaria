import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import type { SupervisionSession } from './types';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  session?: SupervisionSession | null;
  onSave: (payload: any, id?: string) => Promise<void>;
}

function diffMinutes(start: string, end: string) {
  if (!start || !end) return 60;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const mins = eh * 60 + em - (sh * 60 + sm);
  return mins > 0 ? mins : 60;
}

export function SupervisionSessionDialog({ open, onOpenChange, session, onSave }: Props) {
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    start_time: '',
    end_time: '',
    duration_minutes: '60',
    modality: 'individual',
    format: 'online',
    attendance_status: 'presente',
    topics: '',
    content: '',
    referrals: '',
    ethics_notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (session) {
      setForm({
        date: session.date,
        start_time: session.start_time || '',
        end_time: session.end_time || '',
        duration_minutes: String(session.duration_minutes ?? 60),
        modality: session.modality || 'individual',
        format: session.format || 'online',
        attendance_status: session.attendance_status || 'presente',
        topics: session.topics || '',
        content: session.content || '',
        referrals: session.referrals || '',
        ethics_notes: session.ethics_notes || '',
      });
    } else {
      setForm({
        date: new Date().toISOString().slice(0, 10),
        start_time: '',
        end_time: '',
        duration_minutes: '60',
        modality: 'individual',
        format: 'online',
        attendance_status: 'presente',
        topics: '',
        content: '',
        referrals: '',
        ethics_notes: '',
      });
    }
  }, [open, session]);

  const onTimeChange = (field: 'start_time' | 'end_time', value: string) => {
    const next = { ...form, [field]: value };
    if (next.start_time && next.end_time) {
      next.duration_minutes = String(diffMinutes(next.start_time, next.end_time));
    }
    setForm(next);
  };

  const handleSubmit = async () => {
    if (!form.date) {
      toast.error('Informe a data da sessão');
      return;
    }
    setSaving(true);
    try {
      await onSave(
        {
          date: form.date,
          start_time: form.start_time || null,
          end_time: form.end_time || null,
          duration_minutes: Number(form.duration_minutes) || 60,
          modality: form.modality,
          format: form.format,
          attendance_status: form.attendance_status,
          topics: form.topics || null,
          content: form.content || null,
          referrals: form.referrals || null,
          ethics_notes: form.ethics_notes || null,
        },
        session?.id,
      );
      toast.success(session ? 'Sessão atualizada' : 'Sessão registrada');
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
          <DialogTitle>{session ? 'Editar sessão de supervisão' : 'Nova sessão de supervisão'}</DialogTitle>
        </DialogHeader>

        <div className="grid sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Data *</Label>
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Início</Label>
            <Input type="time" value={form.start_time} onChange={(e) => onTimeChange('start_time', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Fim</Label>
            <Input type="time" value={form.end_time} onChange={(e) => onTimeChange('end_time', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Duração (min)</Label>
            <Input
              type="number"
              value={form.duration_minutes}
              onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Modalidade</Label>
            <Select value={form.modality} onValueChange={(v) => setForm({ ...form, modality: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="individual">Individual</SelectItem>
                <SelectItem value="grupo">Grupo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Formato</Label>
            <Select value={form.format} onValueChange={(v) => setForm({ ...form, format: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="presencial">Presencial</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-3 space-y-1.5">
            <Label>Presença</Label>
            <Select value={form.attendance_status} onValueChange={(v) => setForm({ ...form, attendance_status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="presente">Presente</SelectItem>
                <SelectItem value="falta">Falta</SelectItem>
                <SelectItem value="falta_cobrada">Falta cobrada</SelectItem>
                <SelectItem value="remarcada">Remarcada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-3 space-y-1.5">
            <Label>Temas discutidos</Label>
            <Input value={form.topics} onChange={(e) => setForm({ ...form, topics: e.target.value })} />
          </div>
          <div className="sm:col-span-3 space-y-1.5">
            <Label>Registro da supervisão</Label>
            <Textarea rows={6} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          </div>
          <div className="sm:col-span-3 space-y-1.5">
            <Label>Encaminhamentos / tarefas</Label>
            <Textarea rows={3} value={form.referrals} onChange={(e) => setForm({ ...form, referrals: e.target.value })} />
          </div>
          <div className="sm:col-span-3 space-y-1.5">
            <Label>Observações de ética</Label>
            <Textarea rows={2} value={form.ethics_notes} onChange={(e) => setForm({ ...form, ethics_notes: e.target.value })} />
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