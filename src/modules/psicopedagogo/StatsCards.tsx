import { FileText, CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import type { Avaliacao } from './types';

interface Props {
  avaliacoes: Avaliacao[];
}

function avgScore(a: Avaliacao): number | null {
  const vals = [a.leitura, a.escrita, a.matematica, a.atencao, a.memoria, a.linguagem]
    .filter((v): v is number => typeof v === 'number');
  if (!vals.length) return null;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

export function StatsCards({ avaliacoes }: Props) {
  const total = avaliacoes.length;
  const concluidas = avaliacoes.filter((a) => a.status === 'concluida').length;
  const pendentes = avaliacoes.filter((a) => a.status === 'pendente').length;

  // Progresso médio: comparação entre a avaliação mais antiga e a mais recente concluídas
  let progresso = 0;
  const concluidasOrdenadas = [...avaliacoes]
    .filter((a) => a.status === 'concluida')
    .sort((a, b) => a.data_avaliacao.localeCompare(b.data_avaliacao));
  if (concluidasOrdenadas.length >= 2) {
    const first = avgScore(concluidasOrdenadas[0]);
    const last = avgScore(concluidasOrdenadas[concluidasOrdenadas.length - 1]);
    if (first !== null && last !== null && first > 0) {
      progresso = Math.round(((last - first) / first) * 100);
    }
  }

  const cards = [
    { label: 'Total registradas', value: total, Icon: FileText, color: 'text-primary bg-primary/10' },
    { label: 'Concluídas', value: concluidas, Icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-500/10' },
    { label: 'Pendentes', value: pendentes, Icon: Clock, color: 'text-amber-600 bg-amber-500/10' },
    {
      label: 'Progresso médio',
      value: concluidasOrdenadas.length >= 2 ? `${progresso > 0 ? '+' : ''}${progresso}%` : '—',
      Icon: TrendingUp,
      color: 'text-violet-600 bg-violet-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map(({ label, value, Icon, color }) => (
        <div key={label} className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground font-medium truncate">{label}</p>
            <p className="text-lg font-bold text-foreground tabular-nums">{value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}