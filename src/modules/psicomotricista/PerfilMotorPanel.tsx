import { useEffect, useMemo, useState } from 'react';
import { Radar, RadarChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { AlertTriangle, CheckCircle2, BookOpen, Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DOMINIOS, type Avaliacao } from './types';
import { MILESTONES_MOTORES } from './presets';

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

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('patients').select('birthdate').eq('id', patientId).maybeSingle();
      setBirthdate((data as any)?.birthdate ?? null);
    })();
  }, [patientId]);

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
      const atrasado = ageMonths > meses + 3; // tolerância de 3 meses
      const aplicavel = ageMonths >= meses - 3;
      return { ...m, meses, atrasado, aplicavel };
    });
  }, [ageMonths]);

  const alertas = milestonesAvaliados.filter((m) => m.aplicavel && m.atrasado);

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

      {/* Milestones */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" /> Alertas de marcos motores
        </h4>
        {ageMonths == null ? (
          <p className="text-xs text-muted-foreground">
            Cadastre a data de nascimento do paciente para análise de milestones.
          </p>
        ) : alertas.length === 0 ? (
          <p className="text-xs text-emerald-600 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Nenhum alerta de atraso motor para a faixa etária atual.
          </p>
        ) : (
          <div className="space-y-1.5">
            {alertas.map((m) => (
              <div key={m.habilidade} className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-foreground">{m.habilidade}</div>
                  <div className="text-muted-foreground">
                    Esperado aos {m.idade} {m.unidade} · área: {m.area}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>


      <p className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1">
        <BookOpen className="w-3 h-3" /> Marcos baseados em referências da literatura em desenvolvimento psicomotor (apenas indicativos).
      </p>
    </div>
  );
}