import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useOrgPermissions } from '@/hooks/useOrgPermissions';
import { usePatientScheduleSlots } from '@/hooks/usePatientScheduleSlots';
import { usePatientPackages } from '@/hooks/usePatientPackages';
import { Plus, X, Clock, User, Package } from 'lucide-react';
import { toast } from 'sonner';

const WEEKDAYS = [
  { value: 'Segunda', label: 'Segunda' },
  { value: 'Terça', label: 'Terça' },
  { value: 'Quarta', label: 'Quarta' },
  { value: 'Quinta', label: 'Quinta' },
  { value: 'Sexta', label: 'Sexta' },
  { value: 'Sábado', label: 'Sábado' },
];

interface OrgMember {
  id: string;
  user_id: string | null;
  email: string;
  name?: string | null;
}

interface Props {
  patientId: string;
  clinicId: string;
  organizationId?: string | null;
  disabled?: boolean;
}

export function PatientScheduleSlotsManager({ patientId, clinicId, organizationId, disabled }: Props) {
  const { isOwner, role } = useOrgPermissions();
  const { slots, loading, addSlot, removeSlot } = usePatientScheduleSlots(patientId);
  const { links: packageLinks } = usePatientPackages(patientId);
  const [members, setMembers] = useState<OrgMember[]>([]);

  const [memberId, setMemberId] = useState('');
  const [weekday, setWeekday] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [packageLinkId, setPackageLinkId] = useState('none');
  const [adding, setAdding] = useState(false);

  const canManage = !disabled && (isOwner || role === 'admin' || !organizationId);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!organizationId) { setMembers([]); return; }
      const { data: m } = await supabase
        .from('organization_members')
        .select('id, user_id, email')
        .eq('organization_id', organizationId)
        .eq('status', 'active');
      if (cancelled) return;
      const userIds = (m || []).map((x: any) => x.user_id).filter(Boolean) as string[];
      const profileMap = new Map<string, string>();
      if (userIds.length) {
        const { data: profiles } = await supabase.from('profiles').select('user_id, name').in('user_id', userIds);
        (profiles || []).forEach((p: any) => { if (p.name) profileMap.set(p.user_id, p.name); });
      }
      setMembers((m || []).map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        email: row.email,
        name: row.user_id ? profileMap.get(row.user_id) : null,
      })));
    }
    load();
    return () => { cancelled = true; };
  }, [organizationId]);

  // Filter packages to those linked to selected therapist
  const availablePackages = packageLinks.filter(l => !memberId || l.memberId === memberId);

  const handleAdd = async () => {
    if (!memberId || !weekday || !startTime || !endTime) {
      toast.error('Preencha terapeuta, dia, início e fim');
      return;
    }
    if (endTime <= startTime) {
      toast.error('O horário de fim deve ser maior que o de início');
      return;
    }
    const conflict = slots.some(s =>
      s.memberId === memberId && s.weekday === weekday && s.startTime === startTime
    );
    if (conflict) {
      toast.error('Este terapeuta já tem um horário neste dia/início');
      return;
    }
    setAdding(true);
    try {
      await addSlot({
        clinicId,
        organizationId: organizationId || null,
        memberId,
        weekday,
        startTime,
        endTime,
        packageLinkId: packageLinkId !== 'none' ? packageLinkId : null,
      });
      setMemberId('');
      setWeekday('');
      setStartTime('');
      setEndTime('');
      setPackageLinkId('none');
      toast.success('Horário adicionado!');
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Erro ao adicionar horário');
    } finally {
      setAdding(false);
    }
  };

  // Group slots by weekday
  const groupedSlots = WEEKDAYS.map(d => ({
    day: d.value,
    label: d.label,
    slots: slots.filter(s => s.weekday === d.value),
  })).filter(g => g.slots.length > 0);

  return (
    <div className="space-y-3">
      <div>
        {loading ? (
          <div className="text-xs text-muted-foreground">Carregando...</div>
        ) : slots.length === 0 ? (
          <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            Nenhum horário cadastrado ainda. {canManage ? 'Adicione um abaixo.' : ''}
          </div>
        ) : (
          <div className="space-y-3">
            {groupedSlots.map(group => (
              <div key={group.day}>
                <div className="text-xs font-semibold text-foreground mb-1">{group.label}</div>
                <div className="space-y-1.5">
                  {group.slots.map(s => (
                    <div key={s.id} className="flex items-start justify-between gap-2 rounded-md border bg-muted/40 p-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <Clock className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                        <div className="flex-1 min-w-0 text-xs">
                          <div className="font-medium text-sm">
                            {s.startTime} – {s.endTime}
                          </div>
                          <div className="text-muted-foreground flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {s.therapistName || s.therapistEmail || 'Profissional'}
                          </div>
                          {s.packageName && (
                            <div className="text-muted-foreground flex items-center gap-1">
                              <Package className="w-3 h-3" />
                              {s.packageName}
                            </div>
                          )}
                        </div>
                      </div>
                      {canManage && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 shrink-0"
                          onClick={() => removeSlot(s.id)}
                          aria-label="Remover horário"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {canManage && (
        <div className="rounded-md border p-3 space-y-2">
          <Label className="text-xs">Adicionar horário</Label>
          {!organizationId || members.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Cadastre profissionais na equipe da clínica para vincular horários.
            </p>
          ) : (
            <>
              <div>
                <Label className="text-[11px]">Terapeuta</Label>
                <Select value={memberId} onValueChange={(v) => { setMemberId(v); setPackageLinkId('none'); }}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecione um profissional" /></SelectTrigger>
                  <SelectContent>
                    {members.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name || m.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-[11px]">Dia</Label>
                  <Select value={weekday} onValueChange={setWeekday}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Dia" /></SelectTrigger>
                    <SelectContent>
                      {WEEKDAYS.map(d => (
                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[11px]">Início</Label>
                  <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="h-9" />
                </div>
                <div>
                  <Label className="text-[11px]">Fim</Label>
                  <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="h-9" />
                </div>
              </div>
              {memberId && availablePackages.length > 0 && (
                <div>
                  <Label className="text-[11px]">Pacote (opcional)</Label>
                  <Select value={packageLinkId} onValueChange={setPackageLinkId}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem pacote vinculado</SelectItem>
                      {availablePackages.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.packageName} — R$ {(p.packagePrice ?? 0).toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button
                type="button"
                size="sm"
                onClick={handleAdd}
                disabled={adding}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-1" /> Adicionar horário
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}