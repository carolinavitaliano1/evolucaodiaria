import { useEffect, useState } from 'react';
import { Calendar, Clock, User, Wallet, CalendarDays } from 'lucide-react';
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
          .select('id, date, time, end_time, status, room, therapist_user_id, notes')
          .eq('patient_id', patientId)
          .gte('date', todayStr)
          .neq('status', 'cancelado')
          .order('date', { ascending: true })
          .order('time', { ascending: true })
          .limit(20);
        if (error) throw error;
        const rows = (data || []) as any[];

        // join therapist names
        const userIds = Array.from(new Set(rows.map(r => r.therapist_user_id).filter(Boolean)));
        let nameMap = new Map<string, string>();
        if (userIds.length) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('user_id, name')
            .in('user_id', userIds as string[]);
          (profs || []).forEach((p: any) => nameMap.set(p.user_id, p.name));
        }
        const enriched = rows.map(r => ({
          ...r,
          therapistName: r.therapist_user_id ? nameMap.get(r.therapist_user_id) || null : null,
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
        <p className="text-sm text-muted-foreground">
          Nenhum horário cadastrado ainda. A agenda é gerenciada pela aba <strong>Equipe</strong> da clínica.
        </p>
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