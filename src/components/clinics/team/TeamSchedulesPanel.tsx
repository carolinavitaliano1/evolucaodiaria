import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CalendarDays, Pencil, Clock } from 'lucide-react';
import { TherapistAgendaModal } from '@/components/clinics/TherapistAgendaModal';
import { cn } from '@/lib/utils';

interface Props {
  clinicId: string;
  organizationId: string | null;
}

interface MemberRow {
  id: string;
  user_id: string | null;
  email: string;
  role_label: string | null;
  weekdays: string[] | null;
  schedule_by_day: Record<string, { start: string; end: string }> | null;
  profile?: { name: string | null; avatar_url: string | null };
}

interface Slot {
  id: string;
  member_id: string;
  patient_id: string;
  weekday: string;
  start_time: string;
  end_time: string;
}

const WEEKDAYS = [
  { key: 'segunda', label: 'Seg' },
  { key: 'terça', label: 'Ter' },
  { key: 'quarta', label: 'Qua' },
  { key: 'quinta', label: 'Qui' },
  { key: 'sexta', label: 'Sex' },
  { key: 'sábado', label: 'Sáb' },
];

const norm = (d: string) => d.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function TeamSchedulesPanel({ clinicId, organizationId }: Props) {
  const { patients } = useApp();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMember, setFilterMember] = useState<string>('all');
  const [agendaMember, setAgendaMember] = useState<MemberRow | null>(null);

  useEffect(() => {
    if (!organizationId) { setLoading(false); return; }
    setLoading(true);
    (async () => {
      const { data: membersData } = await supabase
        .from('organization_members')
        .select('id, user_id, email, role_label, weekdays, schedule_by_day')
        .eq('organization_id', organizationId)
        .eq('status', 'active');

      const userIds = (membersData || []).filter(m => m.user_id).map(m => m.user_id!);
      const profilesMap: Record<string, any> = {};
      if (userIds.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, name, avatar_url')
          .in('user_id', userIds);
        profs?.forEach((p: any) => { profilesMap[p.user_id] = { name: p.name, avatar_url: p.avatar_url }; });
      }

      const enriched = (membersData || []).map((m: any) => ({
        ...m,
        profile: m.user_id ? profilesMap[m.user_id] : undefined,
      })) as MemberRow[];
      setMembers(enriched);

      const memberIds = enriched.map(m => m.id);
      if (memberIds.length) {
        const { data: slotsData } = await supabase
          .from('patient_schedule_slots' as any)
          .select('id, member_id, patient_id, weekday, start_time, end_time')
          .eq('clinic_id', clinicId)
          .in('member_id', memberIds);
        setSlots((slotsData || []) as any);
      }
      setLoading(false);
    })();
  }, [clinicId, organizationId]);

  const visibleMembers = useMemo(() => {
    if (filterMember === 'all') return members;
    return members.filter(m => m.id === filterMember);
  }, [members, filterMember]);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  if (members.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhum colaborador ativo nesta clínica.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <CalendarDays className="w-5 h-5 text-primary" />
        <span className="font-semibold">Agenda semanal por terapeuta</span>
        <div className="ml-auto w-56">
          <Select value={filterMember} onValueChange={setFilterMember}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os terapeutas</SelectItem>
              {members.map(m => (
                <SelectItem key={m.id} value={m.id}>{m.profile?.name || m.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-4">
        {visibleMembers.map(member => {
          const memberSlots = slots.filter(s => s.member_id === member.id);
          const slotsByDay: Record<string, Slot[]> = {};
          WEEKDAYS.forEach(d => { slotsByDay[d.key] = []; });
          memberSlots.forEach(s => {
            const key = norm(s.weekday);
            const matched = WEEKDAYS.find(d => norm(d.key) === key);
            if (matched) slotsByDay[matched.key].push(s);
          });
          // sort each day by start time
          Object.keys(slotsByDay).forEach(k => slotsByDay[k].sort((a, b) => a.start_time.localeCompare(b.start_time)));

          const initials = (member.profile?.name || member.email).slice(0, 2).toUpperCase();

          return (
            <div key={member.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-3 mb-4">
                <Avatar className="w-10 h-10">
                  {member.profile?.avatar_url && <AvatarImage src={member.profile.avatar_url} />}
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-semibold">{member.profile?.name || member.email}</p>
                  {member.role_label && <p className="text-xs text-muted-foreground">{member.role_label}</p>}
                </div>
                <Button size="sm" variant="outline" onClick={() => setAgendaMember(member)}>
                  <Pencil className="w-3.5 h-3.5 mr-1" />Editar agenda
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {WEEKDAYS.map(day => {
                  const daySlots = slotsByDay[day.key];
                  return (
                    <div key={day.key} className="rounded-lg border bg-muted/30 p-2 min-h-[100px]">
                      <p className="text-xs font-bold uppercase text-muted-foreground mb-2 text-center">{day.label}</p>
                      {daySlots.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground text-center italic">—</p>
                      ) : (
                        <div className="space-y-1">
                          {daySlots.map(s => {
                            const pat = patients.find(p => p.id === s.patient_id);
                            return (
                              <div key={s.id} className="rounded bg-background border px-2 py-1 text-[11px] leading-tight">
                                <div className="flex items-center gap-1 text-primary font-medium">
                                  <Clock className="w-3 h-3" />
                                  {s.start_time.slice(0, 5)}
                                </div>
                                <div className="truncate text-foreground">{pat?.name || '—'}</div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {agendaMember && (
        <TherapistAgendaModal
          open={!!agendaMember}
          onOpenChange={(v) => { if (!v) setAgendaMember(null); }}
          memberId={agendaMember.id}
          memberName={agendaMember.profile?.name || agendaMember.email}
          memberWeekdays={agendaMember.weekdays || []}
          memberScheduleByDay={agendaMember.schedule_by_day || null}
          clinicId={clinicId}
          organizationId={organizationId}
        />
      )}
    </div>
  );
}