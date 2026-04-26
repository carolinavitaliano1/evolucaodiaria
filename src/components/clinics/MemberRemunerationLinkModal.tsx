import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, DollarSign, User, Clock } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

interface Plan {
  id: string;
  name: string;
  remuneration_type: string;
  remuneration_value: number;
  is_default: boolean;
}

interface SlotRow {
  id: string;
  weekday: string;
  start_time: string;
  end_time: string;
  patient_id: string;
  patient_name?: string;
  remuneration_plan_id: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  memberId: string | null;
  memberName: string;
  clinicId: string;
}

export function MemberRemunerationLinkModal({ open, onOpenChange, memberId, memberName, clinicId }: Props) {
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({}); // slot_id -> plan_id
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !memberId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: planData }, { data: slotData }] = await Promise.all([
        supabase.from('member_remuneration_plans' as any)
          .select('*')
          .eq('member_id', memberId)
          .order('is_default', { ascending: false }),
        supabase.from('patient_schedule_slots' as any)
          .select('id, weekday, start_time, end_time, patient_id, remuneration_plan_id')
          .eq('member_id', memberId)
          .eq('clinic_id', clinicId),
      ]);
      if (cancelled) return;
      const planList = (planData as any[]) || [];
      setPlans(planList);
      const rows = (slotData as any[]) || [];
      const ids = Array.from(new Set(rows.map(r => r.patient_id)));
      const nameMap: Record<string, string> = {};
      if (ids.length) {
        const { data: pats } = await supabase.from('patients').select('id, name').in('id', ids);
        (pats || []).forEach(p => { nameMap[p.id] = p.name; });
      }
      const mapped: SlotRow[] = rows.map(r => ({
        id: r.id,
        weekday: r.weekday,
        start_time: (r.start_time || '').slice(0, 5),
        end_time: (r.end_time || '').slice(0, 5),
        patient_id: r.patient_id,
        patient_name: nameMap[r.patient_id] || 'Paciente',
        remuneration_plan_id: r.remuneration_plan_id || null,
      }));
      setSlots(mapped);
      const initial: Record<string, string> = {};
      mapped.forEach(s => { initial[s.id] = s.remuneration_plan_id || '__default__'; });
      setEdits(initial);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, memberId, clinicId]);

  async function save() {
    setSaving(true);
    try {
      const updates = slots.filter(s => (edits[s.id] || '__default__') !== (s.remuneration_plan_id || '__default__'));
      for (const s of updates) {
        const v = edits[s.id];
        await supabase.from('patient_schedule_slots' as any).update({
          remuneration_plan_id: v === '__default__' ? null : v,
        }).eq('id', s.id);
      }
      toast.success('Vínculos salvos');
      onOpenChange(false);
    } catch (err: any) {
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Remuneração — {memberName}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Vincule um plano de remuneração específico para cada paciente agendado. Quando "padrão", será usado o plano marcado como padrão do profissional.
          </p>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {plans.length === 0 && (
              <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning-foreground">
                Este profissional ainda não possui planos de remuneração cadastrados. Adicione planos em "Gerenciar acesso → Profissional" antes de vincular.
              </div>
            )}
            {slots.length === 0 ? (
              <p className="text-sm text-muted-foreground italic text-center py-6">
                Nenhum paciente agendado. Adicione horários em "Gerenciar Agenda".
              </p>
            ) : (
              <div className="rounded-xl border bg-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="p-2.5">Paciente</th>
                      <th className="p-2.5">Dia</th>
                      <th className="p-2.5">Horário</th>
                      <th className="p-2.5">Plano de Remuneração</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {slots.map(s => (
                      <tr key={s.id} className="hover:bg-muted/20">
                        <td className="p-2.5">
                          <span className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-muted-foreground" />
                            {s.patient_name}
                          </span>
                        </td>
                        <td className="p-2.5 capitalize text-foreground/80">{s.weekday}</td>
                        <td className="p-2.5">
                          <span className="font-mono text-xs flex items-center gap-1 text-primary">
                            <Clock className="w-3 h-3" />
                            {s.start_time}–{s.end_time}
                          </span>
                        </td>
                        <td className="p-2.5">
                          <Select
                            value={edits[s.id] || '__default__'}
                            onValueChange={(v) => setEdits(prev => ({ ...prev, [s.id]: v }))}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__default__">
                                Usar plano padrão
                              </SelectItem>
                              {plans.map(p => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name} · R$ {Number(p.remuneration_value).toFixed(2).replace('.', ',')}
                                  {p.is_default ? ' (padrão)' : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {plans.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {plans.map(p => (
                  <Badge key={p.id} variant="outline" className="text-[10px]">
                    {p.name} · R$ {Number(p.remuneration_value).toFixed(2).replace('.', ',')}
                    {p.is_default && ' · padrão'}
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={save} disabled={saving || slots.length === 0} className="gap-2">
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Salvar vínculos
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
