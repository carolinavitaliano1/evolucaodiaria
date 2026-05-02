import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, parseISO, differenceInHours } from 'date-fns';
import { Loader2, TrendingUp, CheckCircle2, Users, Clock, Trophy, LogOut } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface Props {
  organizationId: string;
  clinicId: string;
}

interface Stats {
  attendanceRate: number;
  totalSessions: number;
  presentSessions: number;
  onTimeRate: number;
  totalEvolutions: number;
  onTimeEvolutions: number;
  avgHoursToRegister: number;
  activePatientsByPro: { name: string; count: number }[];
  topPros: { name: string; sessions: number }[];
  departureReasons: { reason: string; count: number }[];
  totalDepartures: number;
}

const REASON_LABELS: Record<string, string> = {
  'Alta clínica': 'Alta clínica',
  Alta: 'Alta clínica',
  Transferência: 'Transferência',
  Desistência: 'Desistência',
  'Mudança de cidade': 'Mudança de cidade',
  Financeiro: 'Financeiro',
  Outro: 'Outro',
};

export function TeamIndicatorsTab({ organizationId, clinicId }: Props) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const start = startOfMonth(new Date());
      const end = endOfMonth(new Date());
      const startStr = start.toISOString().slice(0, 10);
      const endStr = end.toISOString().slice(0, 10);

      // 1. Members + profiles
      const { data: members } = await supabase
        .from('organization_members')
        .select('user_id, email, role_label')
        .eq('organization_id', organizationId)
        .eq('status', 'active');
      const memberIds = (members ?? []).map((m) => m.user_id).filter(Boolean) as string[];
      const { data: profs } = memberIds.length
        ? await supabase.from('profiles').select('user_id, name').in('user_id', memberIds)
        : { data: [] as { user_id: string; name: string | null }[] };
      const nameMap: Record<string, string> = {};
      (members ?? []).forEach((m) => {
        const p = (profs ?? []).find((x) => x.user_id === m.user_id);
        nameMap[m.user_id!] = p?.name || m.email.split('@')[0];
      });

      // 2. Evolutions this month in this clinic
      const { data: evolutions } = await supabase
        .from('evolutions')
        .select('id, user_id, patient_id, date, attendance_status, created_at')
        .eq('clinic_id', clinicId)
        .gte('date', startStr)
        .lte('date', endStr);
      const evos = evolutions ?? [];

      const presentStatuses = new Set(['presente', 'reposicao', 'falta_remunerada', 'feriado_remunerado']);
      const presentSessions = evos.filter((e) => presentStatuses.has(e.attendance_status)).length;
      const totalSessions = evos.length;
      const attendanceRate = totalSessions > 0 ? Math.round((presentSessions / totalSessions) * 100) : 0;

      // On-time = registered within 24h of session date
      let onTimeCount = 0;
      let totalHours = 0;
      let countedForAvg = 0;
      evos.forEach((e) => {
        const sessionDate = parseISO(`${e.date}T23:59:59`);
        const created = parseISO(e.created_at);
        const hours = differenceInHours(created, sessionDate);
        if (hours <= 24) onTimeCount++;
        if (hours >= 0 && hours < 24 * 30) {
          totalHours += Math.max(0, hours);
          countedForAvg++;
        }
      });
      const onTimeRate = evos.length > 0 ? Math.round((onTimeCount / evos.length) * 100) : 0;
      const avgHoursToRegister = countedForAvg > 0 ? Math.round(totalHours / countedForAvg) : 0;

      // 3. Active patients by professional
      const { data: clinicPatients } = await supabase
        .from('patients')
        .select('id, departure_date, is_archived')
        .eq('clinic_id', clinicId);
      const activePatientIds = new Set(
        (clinicPatients ?? []).filter((p) => !p.departure_date && !p.is_archived).map((p) => p.id),
      );

      const { data: assignments } = activePatientIds.size
        ? await supabase
            .from('therapist_patient_assignments')
            .select('patient_id, member_id')
            .in('patient_id', Array.from(activePatientIds))
        : { data: [] as { patient_id: string; member_id: string }[] };

      const { data: memRows } = (assignments ?? []).length
        ? await supabase
            .from('organization_members')
            .select('id, user_id')
            .in('id', (assignments ?? []).map((a) => a.member_id))
        : { data: [] as { id: string; user_id: string }[] };
      const memberIdToUser = Object.fromEntries((memRows ?? []).map((m) => [m.id, m.user_id]));

      const patientsByPro: Record<string, number> = {};
      (assignments ?? []).forEach((a) => {
        const uid = memberIdToUser[a.member_id];
        if (uid && nameMap[uid]) patientsByPro[uid] = (patientsByPro[uid] || 0) + 1;
      });
      const activePatientsByPro = Object.entries(patientsByPro)
        .map(([uid, count]) => ({ name: nameMap[uid], count }))
        .sort((a, b) => b.count - a.count);

      // 4. Top pros by sessions
      const sessionsByPro: Record<string, number> = {};
      evos.forEach((e) => {
        if (presentStatuses.has(e.attendance_status) && nameMap[e.user_id]) {
          sessionsByPro[e.user_id] = (sessionsByPro[e.user_id] || 0) + 1;
        }
      });
      const topPros = Object.entries(sessionsByPro)
        .map(([uid, sessions]) => ({ name: nameMap[uid], sessions }))
        .sort((a, b) => b.sessions - a.sessions)
        .slice(0, 3);

      // 5. Departure reasons (this clinic, all-time)
      const { data: departed } = await supabase
        .from('patients')
        .select('departure_reason, departure_date')
        .eq('clinic_id', clinicId)
        .not('departure_date', 'is', null);
      const reasonCounts: Record<string, number> = {};
      (departed ?? []).forEach((d) => {
        const raw = (d.departure_reason || 'Outro').trim();
        const key = REASON_LABELS[raw] || 'Outro';
        reasonCounts[key] = (reasonCounts[key] || 0) + 1;
      });
      const departureReasons = Object.entries(reasonCounts)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count);
      const totalDepartures = (departed ?? []).length;

      setStats({
        attendanceRate,
        totalSessions,
        presentSessions,
        onTimeRate,
        totalEvolutions: evos.length,
        onTimeEvolutions: onTimeCount,
        avgHoursToRegister,
        activePatientsByPro,
        topPros,
        departureReasons,
        totalDepartures,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [organizationId, clinicId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !stats) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          Indicadores da Equipe
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">Visão consolidada do mês atual</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Taxa de presença
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.attendanceRate}%</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {stats.presentSessions} de {stats.totalSessions} sessões
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Evoluções no prazo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.onTimeRate}%</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {stats.onTimeEvolutions} de {stats.totalEvolutions} em até 24h
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Tempo médio de registro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.avgHoursToRegister}h</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">após a sessão</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Pacientes ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {stats.activePatientsByPro.reduce((s, x) => s + x.count, 0)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              em {stats.activePatientsByPro.length} profissional(is)
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top pros */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Trophy className="w-4 h-4 text-primary" />
              Top profissionais (sessões realizadas)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.topPros.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Sem sessões registradas no mês.</p>
            ) : (
              <div className="space-y-2.5">
                {stats.topPros.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                      {i + 1}
                    </div>
                    <span className="flex-1 text-sm font-medium truncate">{p.name}</span>
                    <span className="text-xs font-semibold text-foreground">{p.sessions} sessões</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active patients by pro */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Pacientes ativos por profissional
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.activePatientsByPro.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma atribuição ativa.</p>
            ) : (
              <div className="space-y-2">
                {stats.activePatientsByPro.slice(0, 6).map((p) => (
                  <div key={p.name} className="flex items-center gap-3">
                    <span className="flex-1 text-sm truncate">{p.name}</span>
                    <span className="text-xs font-semibold text-foreground">{p.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Departure reasons */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <LogOut className="w-4 h-4 text-primary" />
            Motivos de saída
            <span className="text-xs font-normal text-muted-foreground">
              ({stats.totalDepartures} pacientes saíram no histórico)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.departureReasons.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Nenhum paciente saiu da clínica ainda.</p>
          ) : (
            <div className="space-y-3">
              {stats.departureReasons.map((r) => {
                const pct = stats.totalDepartures > 0 ? Math.round((r.count / stats.totalDepartures) * 100) : 0;
                return (
                  <div key={r.reason} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">{r.reason}</span>
                      <span className="text-muted-foreground">
                        {r.count} <span className="opacity-60">({pct}%)</span>
                      </span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}