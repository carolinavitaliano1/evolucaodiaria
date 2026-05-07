import { useEffect, useState } from 'react';
import { Calendar, Clock, User, Wallet, CalendarDays, Package, Stethoscope } from 'lucide-react';
import { usePatientScheduleSlots } from '@/hooks/usePatientScheduleSlots';
import { supabase } from '@/integrations/supabase/client';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { countWeekdayOccurrencesInMonth } from '@/utils/dateHelpers';

interface Props {
  patientId: string;
  clinicId: string;
  organizationId?: string | null;
}

const WEEKDAY_ORDER = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

const WEEKDAY_FROM_DATE = (dateStr: string): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  const idx = dt.getDay(); // 0=Domingo
  const map = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return map[idx] || '';
};

const TAG_RE = /\[(encaixe|autorizacao:[^\]]*|procedimento:[^\]]*|pacote:[^\]]*|lembrete_wa:[^\]]*|celular:[^\]]*|lancar_financeiro)\]/gi;

function parseAppointmentTags(notes: string | null | undefined): { procedimentoId: string; pacoteId: string } {
  const out = { procedimentoId: '', pacoteId: '' };
  if (!notes) return out;
  const matches = notes.match(TAG_RE) || [];
  matches.forEach(tag => {
    const inner = tag.slice(1, -1);
    if (inner.startsWith('procedimento:')) out.procedimentoId = inner.slice(13);
    else if (inner.startsWith('pacote:')) out.pacoteId = inner.slice(7);
  });
  return out;
}

const normalizeWeekday = (w: string): number => {
  if (!w) return 99;
  const s = w.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (s.startsWith('seg')) return 0;
  if (s.startsWith('ter')) return 1;
  if (s.startsWith('qua')) return 2;
  if (s.startsWith('qui')) return 3;
  if (s.startsWith('sex')) return 4;
  if (s.startsWith('sab')) return 5;
  if (s.startsWith('dom')) return 6;
  return 99;
};

export function PatientScheduleCard({ patientId, clinicId, organizationId }: Props) {
  const { slots, loading } = usePatientScheduleSlots(patientId);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [apptLoading, setApptLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!patientId) { setAppointments([]); setApptLoading(false); return; }
      setApptLoading(true);
      try {
        const todayStr = new Date().toISOString().slice(0, 10);
        const { data, error } = await supabase
          .from('appointments')
          .select('id, date, time, end_time, status, room, therapist_user_id, notes, convenio, is_recurring')
          .eq('patient_id', patientId)
          .gte('date', todayStr)
          .neq('status', 'cancelado')
          .order('date', { ascending: true })
          .order('time', { ascending: true })
          .limit(20);
        if (error) throw error;
        const rows = (data || []) as any[];

        // Parse tags (procedimento/pacote vivem dentro de notes)
        const parsed = rows.map(r => ({ row: r, tags: parseAppointmentTags(r.notes) }));

        // join therapist names
        const userIds = Array.from(new Set(rows.map(r => r.therapist_user_id).filter(Boolean)));
        let nameMap = new Map<string, string>();
        if (userIds.length) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('user_id, name')
            .in('user_id', userIds as string[]);
          (profs || []).forEach((p: any) => nameMap.set(p.user_id, p.name));

          // Fallback: organization_members (membros sem profile próprio)
          const missing = userIds.filter(id => !nameMap.get(id as string));
          if (missing.length) {
            const { data: members } = await supabase
              .from('organization_members')
              .select('user_id, email')
              .in('user_id', missing as string[]);
            const memberEmails = new Map<string, string>();
            (members || []).forEach((m: any) => {
              if (m.user_id && m.email) memberEmails.set(m.user_id, m.email);
            });
            // Tenta achar profile pelo email (caso profile exista mas não esteja vinculado por user_id)
            const emails = Array.from(new Set(Array.from(memberEmails.values())));
            const emailToName = new Map<string, string>();
            if (emails.length) {
              const { data: profsByEmail } = await supabase
                .from('profiles')
                .select('email, name')
                .in('email', emails);
              (profsByEmail || []).forEach((p: any) => {
                if (p.email && p.name) emailToName.set(p.email, p.name);
              });
            }
            memberEmails.forEach((email, uid) => {
              const name = emailToName.get(email) || email;
              nameMap.set(uid, name);
            });
          }
        }

        // Lookup procedimentos
        const procIds = Array.from(new Set(parsed.map(p => p.tags.procedimentoId).filter(Boolean)));
        const procMap = new Map<string, string>();
        if (procIds.length) {
          const { data: procs } = await supabase
            .from('procedures' as any)
            .select('id, name')
            .in('id', procIds);
          (procs || []).forEach((p: any) => procMap.set(p.id, p.name));
        }

        // Lookup pacotes
        const pkgIds = Array.from(new Set(parsed.map(p => p.tags.pacoteId).filter(Boolean)));
        const pkgMap = new Map<string, string>();
        if (pkgIds.length) {
          const { data: pkgs } = await supabase
            .from('clinic_packages')
            .select('id, name')
            .in('id', pkgIds);
          (pkgs || []).forEach((p: any) => pkgMap.set(p.id, p.name));
        }

        const enriched = parsed.map(({ row: r, tags }) => ({
          ...r,
          therapistName: r.therapist_user_id ? nameMap.get(r.therapist_user_id) || null : null,
          procedimentoName: tags.procedimentoId ? procMap.get(tags.procedimentoId) || null : null,
          pacoteName: tags.pacoteId ? pkgMap.get(tags.pacoteId) || null : null,
        }));
        if (!cancelled) setAppointments(enriched);
      } catch (e) {
        console.error('PatientScheduleCard appointments error', e);
        if (!cancelled) setAppointments([]);
      } finally {
        if (!cancelled) setApptLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [patientId]);

  const therapistCount = new Set(slots.map(s => s.memberId)).size;
  const sortedSlots = [...slots].sort((a, b) => {
    const da = normalizeWeekday(a.weekday);
    const db = normalizeWeekday(b.weekday);
    if (da !== db) return da - db;
    return a.startTime.localeCompare(b.startTime);
  });

  // Slots derivados de agendamentos recorrentes (quando não houver
  // patient_schedule_slots cadastrado pela aba Equipe).
  const derivedRecurring = (() => {
    if (slots.length > 0) return [] as Array<{ key: string; weekday: string; startTime: string; endTime: string; therapistName: string | null; procedimentoName: string | null; pacoteName: string | null; }>;
    const seen = new Map<string, any>();
    appointments.forEach(a => {
      if (!a.is_recurring) return;
      const wd = WEEKDAY_FROM_DATE(a.date);
      const start = (a.time || '').slice(0, 5);
      const end = (a.end_time || '').slice(0, 5);
      const key = `${wd}|${start}|${end}|${a.therapist_user_id || ''}`;
      if (seen.has(key)) return;
      seen.set(key, {
        key,
        weekday: wd,
        startTime: start,
        endTime: end,
        therapistName: a.therapistName || null,
        procedimentoName: a.procedimentoName || null,
        pacoteName: a.pacoteName || null,
      });
    });
    return Array.from(seen.values()).sort((a, b) => {
      const da = normalizeWeekday(a.weekday);
      const db = normalizeWeekday(b.weekday);
      if (da !== db) return da - db;
      return a.startTime.localeCompare(b.startTime);
    });
  })();

  // Para pacotes "Mensal", calcula ocorrências totais (no mês atual) de TODOS
  // os slots vinculados ao mesmo plano de remuneração, para dividir o valor
  // proporcionalmente.
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  // Detecta pacote mensal por: (a) packageType vindo de clinic_packages OU
  // (b) nome do plano de remuneração contendo "mensal" (caso comum quando o
  //    plano é avulso, sem vínculo com clinic_packages).
  const isMensalPlan = (s: typeof slots[number]) => {
    if (s.remunerationPlanType !== 'pacote') return false;
    if (s.packageType === 'mensal') return true;
    const name = (s.remunerationPlanName || '').toLowerCase();
    return name.includes('mensal');
  };
  const occurrencesByPlan = new Map<string, number>();
  slots.forEach(s => {
    if (!isMensalPlan(s)) return;
    const key = s.remunerationPlanId || `${s.memberId}|${s.remunerationPlanName}`;
    const prev = occurrencesByPlan.get(key) || 0;
    occurrencesByPlan.set(key, prev + countWeekdayOccurrencesInMonth(s.weekday, month, year));
  });

  return (
    <div className="bg-card rounded-2xl p-5 border border-border">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <h3 className="font-bold text-foreground flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          Agenda do Paciente
        </h3>
        {slots.length > 0 && (
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">{slots.length}</strong> horário(s) com{' '}
            <strong className="text-foreground">{therapistCount}</strong> profissional(is)
          </p>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">
        Visualização somente leitura. Para alterar, acesse a aba <strong>Equipe</strong> da clínica.
      </p>

      {/* Próximos agendamentos vindos da Agenda da Clínica */}
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
          <CalendarDays className="w-4 h-4 text-primary" />
          Próximos agendamentos
          {appointments.length > 0 && (
            <span className="text-[11px] text-muted-foreground font-normal">
              ({appointments.length})
            </span>
          )}
        </h4>
        {apptLoading ? (
          <p className="text-sm text-muted-foreground">Carregando agendamentos...</p>
        ) : appointments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum agendamento futuro na agenda da clínica.
          </p>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">Data</TableHead>
                  <TableHead className="w-[140px]">Horário</TableHead>
                  <TableHead>Profissional</TableHead>
                  <TableHead>Procedimento / Pacote</TableHead>
                  <TableHead className="w-[100px]">Sala</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appointments.map(a => {
                  const [y, m, d] = (a.date as string).split('-');
                  const dateLabel = `${d}/${m}/${y.slice(2)}`;
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium text-sm">{dateLabel}</TableCell>
                      <TableCell className="text-sm">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                          {(a.time || '').slice(0, 5)}
                          {a.end_time ? ` – ${a.end_time}` : ''}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="inline-flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-muted-foreground" />
                          {a.therapistName || '—'}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">
                        {a.pacoteName ? (
                          <span className="inline-flex items-center gap-1.5 text-foreground">
                            <Package className="w-3.5 h-3.5 text-primary" />
                            {a.pacoteName}
                          </span>
                        ) : a.procedimentoName ? (
                          <span className="inline-flex items-center gap-1.5 text-foreground">
                            <Stethoscope className="w-3.5 h-3.5 text-primary" />
                            {a.procedimentoName}
                          </span>
                        ) : a.convenio ? (
                          <span className="text-muted-foreground">{a.convenio}</span>
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {a.room || '—'}
                      </TableCell>
                      <TableCell className="text-xs capitalize text-muted-foreground">
                        {a.status || '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Horários recorrentes (slots da Equipe) */}
      <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
        <Clock className="w-4 h-4 text-primary" />
        Horários recorrentes
      </h4>
      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando agenda...</p>
      ) : slots.length === 0 ? (
        derivedRecurring.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum horário cadastrado ainda. A agenda é gerenciada pela aba <strong>Equipe</strong> da clínica.
          </p>
        ) : (
          <>
            <p className="text-[11px] text-muted-foreground mb-2">
              Horários inferidos a partir de agendamentos recorrentes da agenda.
            </p>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[110px]">Dia</TableHead>
                    <TableHead className="w-[140px]">Horário</TableHead>
                    <TableHead>Profissional</TableHead>
                    <TableHead>Procedimento / Pacote</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {derivedRecurring.map(s => (
                    <TableRow key={s.key}>
                      <TableCell className="font-medium text-sm">{s.weekday}</TableCell>
                      <TableCell className="text-sm">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                          {s.startTime}{s.endTime ? ` – ${s.endTime}` : ''}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="inline-flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-muted-foreground" />
                          {s.therapistName || '—'}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">
                        {s.pacoteName ? (
                          <span className="inline-flex items-center gap-1.5 text-foreground">
                            <Package className="w-3.5 h-3.5 text-primary" />
                            {s.pacoteName}
                          </span>
                        ) : s.procedimentoName ? (
                          <span className="inline-flex items-center gap-1.5 text-foreground">
                            <Stethoscope className="w-3.5 h-3.5 text-primary" />
                            {s.procedimentoName}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )
      ) : (
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]">Dia</TableHead>
                <TableHead className="w-[140px]">Horário</TableHead>
                <TableHead>Profissional</TableHead>
                <TableHead>Plano de remuneração</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedSlots.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium text-sm">{s.weekday}</TableCell>
                  <TableCell className="text-sm">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                      {s.startTime} – {s.endTime}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    <span className="inline-flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                      {s.therapistName || s.therapistEmail || 'Profissional'}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {s.remunerationPlanName ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="inline-flex items-center gap-1.5 text-foreground">
                          <Wallet className="w-3.5 h-3.5" />
                          {s.remunerationPlanName}
                        </span>
                        {s.remunerationPlanValue != null && (
                          <span className="text-[11px] font-semibold text-success ml-5">
                            R$ {s.remunerationPlanValue.toFixed(2)}
                            {s.remunerationPlanType === 'por_sessao' && (
                              <span className="text-muted-foreground font-normal"> / sessão</span>
                            )}
                            {s.remunerationPlanType === 'fixo_mensal' && (
                              <span className="text-muted-foreground font-normal"> / mês</span>
                            )}
                            {s.remunerationPlanType === 'pacote' && (
                              <span className="text-muted-foreground font-normal"> (pacote)</span>
                            )}
                          </span>
                        )}
                        {/* Detalhamento dinâmico para pacote MENSAL — igual ao consultório */}
                        {isMensalPlan(s) && s.remunerationPlanValue != null && s.remunerationPlanValue > 0 && (() => {
                          const key = s.remunerationPlanId || `${s.memberId}|${s.remunerationPlanName}`;
                          const occ = occurrencesByPlan.get(key) || 0;
                          if (occ <= 0) return null;
                          const perSession = s.remunerationPlanValue! / occ;
                          return (
                            <span className="text-[11px] text-primary/80 ml-5">
                              Mês de {occ} {occ === 1 ? 'semana' : 'semanas'}: R$ {perSession.toFixed(2)}/sessão
                            </span>
                          );
                        })()}
                        {/* Detalhamento para pacote PERSONALIZADO (N sessões fixas) */}
                        {s.remunerationPlanType === 'pacote' && !isMensalPlan(s) && s.remunerationPlanValue != null && s.remunerationPlanValue > 0 && (() => {
                          // Usa session_limit do pacote vinculado, ou tenta extrair do nome do plano
                          let limit = s.packageSessionLimit || 0;
                          if (!limit) {
                            const m = (s.remunerationPlanName || '').match(/(\d+)\s*(sess|sessao|sessão|sessoes|sessões)/i);
                            if (m) limit = parseInt(m[1], 10);
                          }
                          if (limit <= 0) return null;
                          const perSession = s.remunerationPlanValue! / limit;
                          return (
                            <span className="text-[11px] text-primary/80 ml-5">
                              Pacote de Atendimento {limit} {limit === 1 ? 'sessão' : 'sessões'}: R$ {perSession.toFixed(2)}/sessão
                            </span>
                          );
                        })()}
                      </div>
                    ) : (
                      <span className="text-muted-foreground/60">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}