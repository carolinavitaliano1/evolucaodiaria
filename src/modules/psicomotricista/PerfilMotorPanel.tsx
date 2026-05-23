import { useEffect, useMemo, useState } from 'react';
import { Radar, RadarChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { AlertTriangle, CheckCircle2, BookOpen, Activity, ClipboardCheck, XCircle, HelpCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DOMINIOS, type Avaliacao } from './types';
import { MILESTONES_MOTORES } from './presets';
import { toast } from 'sonner';

interface Props {
  patientId: string;
  avaliacoes: Avaliacao[];
}

function calcAgeMonths(birthdate: string | null): number | null {
  if (!birthdate) return null;
  const b = new Date(birthdate + 'T12:00:00');
  if (isNaN(b.getTime())) return null;
  const now = new Date();
  return (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
}

export function PerfilMotorPanel({ patientId, avaliacoes }: Props) {
  const [birthdate, setBirthdate] = useState<string | null>(null);
  const [tracking, setTracking] = useState<Record<string, { status: string; notes?: string | null }>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('patients').select('birthdate').eq('id', patientId).maybeSingle();
      setBirthdate((data as any)?.birthdate ?? null);
    })();
  }, [patientId]);

  useEffect(() => {
    (async () => {
      setLoaded(false);
      const { data } = await supabase
        .from('psicomotor_milestone_tracking' as any)
        .select('milestone_key, status, notes')
        .eq('patient_id', patientId);
      const map: Record<string, { status: string; notes?: string | null }> = {};
      (data as any[] | null)?.forEach((r) => {
        map[r.milestone_key] = { status: r.status, notes: r.notes };
      });
      setTracking(map);
      setLoaded(true);
    })();
  }, [patientId]);

  async function upsertMilestone(key: string, status: string, notes?: string | null) {
    setSavingKey(key);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      toast.error('Sessão expirada');
      setSavingKey(null);
      return;
    }
    const payload: any = {
      patient_id: patientId,
      user_id: auth.user.id,
      milestone_key: key,
      status,
      notes: notes ?? tracking[key]?.notes ?? null,
      assessed_at: new Date().toISOString().slice(0, 10),
    };
    const { error } = await supabase
      .from('psicomotor_milestone_tracking' as any)
      .upsert(payload, { onConflict: 'patient_id,milestone_key' });
    if (error) {
      toast.error('Erro ao salvar marco: ' + error.message);
    } else {
      setTracking((t) => ({ ...t, [key]: { status, notes: payload.notes } }));
    }
    setSavingKey(null);
  }

  const ageMonths = calcAgeMonths(birthdate);
  const ageYears = ageMonths != null ? Math.floor(ageMonths / 12) : null;

  // Última avaliação concluída com métricas válidas
  const ultima = useMemo(() => {
    const concluidas = avaliacoes
      .filter((a) => a.status === 'concluida')
      .sort((a, b) => b.data_avaliacao.localeCompare(a.data_avaliacao));
    return concluidas[0] || null;
  }, [avaliacoes]);

  const radarData = useMemo(() => {
    if (!ultima) return [];
    return DOMINIOS.map((d) => ({ dominio: d.label, valor: (ultima as any)[d.key] ?? 0 }));
  }, [ultima]);

  const milestonesAvaliados = useMemo(() => {
    if (ageMonths == null) return [];
    return MILESTONES_MOTORES.map((m) => {
      const meses = m.unidade === 'anos' ? m.idade * 12 : m.idade;
      const aplicavel = ageMonths >= meses - 3;
      const idadeUltrapassada = ageMonths > meses + 3;
      const reg = tracking[m.key];
      const status = reg?.status ?? 'nao_avaliado';
      // Alerta APENAS quando o terapeuta marca explicitamente "não alcançado"
      // E a idade esperada já passou (com tolerância de 3 meses).
      const atrasado = status === 'nao_alcancado' && idadeUltrapassada;
      return { ...m, meses, atrasado, aplicavel, status, notes: reg?.notes ?? '', idadeUltrapassada };
    });
  }, [ageMonths, tracking]);

  const alertas = milestonesAvaliados.filter((m) => m.atrasado);
  const pendentes = milestonesAvaliados.filter((m) => m.aplicavel && m.status === 'nao_avaliado');

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> Perfil Psicomotor
          </h3>
          <p className="text-xs text-muted-foreground">
            {ageYears != null ? `${ageYears} anos${ageMonths! % 12 ? ` e ${ageMonths! % 12} m` : ''}` : 'Idade não informada'}
            {ultima && ` · última avaliação em ${ultima.data_avaliacao}`}
          </p>
        </div>
        {ultima?.instrumento && (
          <span className="text-[11px] px-2 py-1 rounded-full bg-primary/10 text-primary font-semibold">
            {ultima.instrumento}
          </span>
        )}
      </div>

      {/* Radar */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Gráfico radar — perfil psicomotor
        </h4>
        {!ultima ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Nenhuma avaliação concluída ainda. Registre uma avaliação para visualizar o perfil.
          </p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="dominio" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fontSize: 10 }} />
                <Radar
                  name="Score"
                  dataKey="valor"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.35}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Rastreio de marcos motores */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <ClipboardCheck className="w-3.5 h-3.5" /> Rastreio de marcos motores
          </h4>
          <div className="flex items-center gap-2 text-[11px]">
            {alertas.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {alertas.length} alerta{alertas.length > 1 ? 's' : ''}
              </span>
            )}
            {pendentes.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">
                {pendentes.length} pendente{pendentes.length > 1 ? 's' : ''} de avaliação
              </span>
            )}
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Marque, para cada marco, se o paciente <strong>alcançou</strong>, <strong>não alcançou</strong> ou se ainda <strong>não foi avaliado</strong>.
          Os alertas só são gerados a partir das marcações de "não alcançado" para marcos cuja idade esperada já passou.
        </p>

        {ageMonths == null && (
          <p className="text-xs text-amber-700 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2">
            Cadastre a data de nascimento do paciente para que o sistema indique quais marcos já são aplicáveis à idade atual.
          </p>
        )}

        {!loaded ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground text-xs">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Carregando rastreio...
          </div>
        ) : (
          <div className="space-y-2">
            {(milestonesAvaliados.length > 0 ? milestonesAvaliados : MILESTONES_MOTORES.map((m) => ({
              ...m,
              meses: m.unidade === 'anos' ? m.idade * 12 : m.idade,
              status: tracking[m.key]?.status ?? 'nao_avaliado',
              notes: tracking[m.key]?.notes ?? '',
              atrasado: false,
              aplicavel: false,
              idadeUltrapassada: false,
            }))).map((m) => {
              const isSaving = savingKey === m.key;
              const borderCls =
                m.atrasado
                  ? 'border-amber-500/40 bg-amber-500/5'
                  : m.status === 'alcancado'
                  ? 'border-emerald-500/30 bg-emerald-500/5'
                  : m.status === 'nao_alcancado'
                  ? 'border-rose-500/30 bg-rose-500/5'
                  : 'border-border bg-background';
              return (
                <div key={m.key} className={`rounded-lg border p-2.5 text-xs ${borderCls}`}>
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground flex items-center gap-1.5">
                        {m.atrasado && <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                        {m.status === 'alcancado' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                        {m.status === 'nao_alcancado' && !m.atrasado && <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
                        {m.status === 'nao_avaliado' && <HelpCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                        <span>{m.habilidade}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Esperado aos {m.idade} {m.unidade} · área: {m.area}
                        {m.aplicavel && m.status === 'nao_avaliado' && (
                          <span className="ml-2 text-amber-700">(idade aplicável — registre o rastreio)</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => upsertMilestone(m.key, 'alcancado')}
                        className={`px-2 py-1 rounded-md text-[11px] font-semibold border transition ${
                          m.status === 'alcancado'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-background hover:bg-emerald-500/10 border-border text-foreground'
                        }`}
                      >
                        Alcançou
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => upsertMilestone(m.key, 'nao_alcancado')}
                        className={`px-2 py-1 rounded-md text-[11px] font-semibold border transition ${
                          m.status === 'nao_alcancado'
                            ? 'bg-rose-600 text-white border-rose-600'
                            : 'bg-background hover:bg-rose-500/10 border-border text-foreground'
                        }`}
                      >
                        Não alcançou
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => upsertMilestone(m.key, 'nao_avaliado')}
                        className={`px-2 py-1 rounded-md text-[11px] font-semibold border transition ${
                          m.status === 'nao_avaliado'
                            ? 'bg-muted text-foreground border-border'
                            : 'bg-background hover:bg-muted border-border text-muted-foreground'
                        }`}
                      >
                        Não avaliado
                      </button>
                    </div>
                  </div>
                  <textarea
                    placeholder="Observações do rastreio (opcional)"
                    defaultValue={m.notes ?? ''}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if ((tracking[m.key]?.notes ?? '') !== v) {
                        upsertMilestone(m.key, m.status, v || null);
                      }
                    }}
                    rows={1}
                    className="mt-2 w-full rounded-md border border-border bg-background px-2 py-1 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-y"
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>


      <p className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1">
        <BookOpen className="w-3 h-3" /> Marcos baseados em referências da literatura em desenvolvimento psicomotor (apenas indicativos).
      </p>
    </div>
  );
}