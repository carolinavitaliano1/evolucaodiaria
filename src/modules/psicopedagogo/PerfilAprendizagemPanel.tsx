import { useEffect, useMemo, useState } from 'react';
import { Radar, RadarChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertTriangle, CheckCircle2, BookOpen, Activity,
  Mail, Copy,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DOMINIOS, type Avaliacao } from './types';
import {
  REGRESSAO_LIMIAR, modeloCartaEncaminhamento,
} from './presets';

interface Props {
  patientId: string;
  avaliacoes: Avaliacao[];
}

export function PerfilAprendizagemPanel({ patientId, avaliacoes }: Props) {
  const [patientName, setPatientName] = useState<string>('');
  const [carta, setCarta] = useState('');
  const [especialidade, setEspecialidade] = useState('Neuropediatra');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('patients').select('name').eq('id', patientId).maybeSingle();
      setPatientName((data as any)?.name || '');
    })();
  }, [patientId]);

  const concluidas = useMemo(
    () => [...avaliacoes]
      .filter((a) => a.status === 'concluida')
      .sort((a, b) => a.data_avaliacao.localeCompare(b.data_avaliacao)),
    [avaliacoes],
  );

  const ultima = concluidas[concluidas.length - 1] || null;
  const penultima = concluidas.length >= 2 ? concluidas[concluidas.length - 2] : null;

  const radarData = useMemo(() => {
    if (!ultima) return [];
    return DOMINIOS.map((d) => ({ dominio: d.label, valor: (ultima as any)[d.key] ?? 0 }));
  }, [ultima]);

  // Regressão: domínio caiu >= REGRESSAO_LIMIAR pontos entre as duas últimas avaliações
  const regressoes = useMemo(() => {
    if (!ultima || !penultima) return [];
    return DOMINIOS
      .map((d) => {
        const prev = (penultima as any)[d.key];
        const cur = (ultima as any)[d.key];
        if (typeof prev !== 'number' || typeof cur !== 'number') return null;
        const delta = cur - prev;
        if (delta <= -REGRESSAO_LIMIAR) {
          return { dominio: d.label, prev, cur, delta };
        }
        return null;
      })
      .filter((x): x is { dominio: string; prev: number; cur: number; delta: number } => x !== null);
  }, [ultima, penultima]);

  function gerarCarta() {
    const texto = modeloCartaEncaminhamento({ patient_name: patientName || '[Nome do Paciente]', especialidade });
    setCarta(texto);
  }

  function copiar(texto: string) {
    navigator.clipboard.writeText(texto);
    toast.success('Copiado para a área de transferência');
  }

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> Perfil de Aprendizagem
          </h3>
          <p className="text-xs text-muted-foreground">
            {concluidas.length === 0
              ? 'Sem avaliações concluídas ainda.'
              : `${concluidas.length} avaliação${concluidas.length === 1 ? '' : 'ões'} concluída(s) · última em ${ultima?.data_avaliacao}`}
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
          Mapeamento do perfil cognitivo
        </h4>
        {!ultima ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Registre uma avaliação concluída para visualizar o radar.
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

      {/* Alertas de regressão */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" /> Alertas de regressão em habilidades
        </h4>
        {!penultima ? (
          <p className="text-xs text-muted-foreground">
            É necessário ao menos duas avaliações concluídas para comparar evolução.
          </p>
        ) : regressoes.length === 0 ? (
          <p className="text-xs text-emerald-600 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Nenhuma regressão significativa detectada entre as duas últimas avaliações.
          </p>
        ) : (
          <div className="space-y-1.5">
            {regressoes.map((r) => (
              <div key={r.dominio} className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-foreground">{r.dominio}</div>
                  <div className="text-muted-foreground">
                    De {r.prev} para {r.cur} (Δ {r.delta.toFixed(1)} pontos)
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>


      {/* Carta de encaminhamento */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Mail className="w-3.5 h-3.5" /> Modelo de carta de encaminhamento
        </h4>
        <div className="grid sm:grid-cols-[1fr_auto_auto] gap-2 items-end">
          <div className="space-y-1">
            <Label className="text-xs">Especialidade de destino</Label>
            <Input
              className="h-8 text-xs"
              value={especialidade}
              onChange={(e) => setEspecialidade(e.target.value)}
              placeholder="Neuropediatra, Fonoaudiólogo..."
            />
          </div>
          <Button size="sm" onClick={gerarCarta} className="gap-1.5 h-8">
            <Mail className="w-3.5 h-3.5" /> Gerar modelo
          </Button>
          {carta && (
            <Button size="sm" variant="outline" onClick={() => copiar(carta)} className="gap-1.5 h-8">
              <Copy className="w-3.5 h-3.5" /> Copiar
            </Button>
          )}
        </div>
        {carta && (
          <Textarea
            rows={14}
            value={carta}
            onChange={(e) => setCarta(e.target.value)}
            className="font-mono text-xs"
          />
        )}
      </div>

      <p className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1">
        <BookOpen className="w-3 h-3" /> Ferramentas de apoio à prática psicopedagógica (uso clínico complementar).
      </p>
    </div>
  );
}