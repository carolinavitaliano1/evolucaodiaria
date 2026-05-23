import { useState } from 'react';
import { Radar, RadarChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, ChevronDown, ChevronUp, FileText, Clock, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DOMINIOS, type Avaliacao } from './types';

interface Props {
  avaliacao: Avaliacao;
  onEdit?: () => void;
  onDelete?: () => void;
}

const tipoLabel: Record<string, string> = { inicial: 'Inicial', reavaliacao: 'Reavaliação', alta: 'Alta' };
const tipoStyle: Record<string, string> = {
  inicial: 'bg-primary/10 text-primary',
  reavaliacao: 'bg-violet-500/10 text-violet-600',
  alta: 'bg-emerald-500/10 text-emerald-600',
};

export function AvaliacaoCard({ avaliacao, onEdit, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const data = DOMINIOS.map((d) => ({
    dominio: d.label,
    valor: avaliacao[d.key] ?? 0,
  }));
  const scores = DOMINIOS.map((d) => avaliacao[d.key]).filter((v): v is number => typeof v === 'number');
  const media = scores.length ? (scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(1) : '—';
  const isPendente = avaliacao.status === 'pendente';

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden transition-shadow hover:shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/40"
      >
        <div className={`shrink-0 p-2 rounded-lg ${tipoStyle[avaliacao.tipo] || 'bg-muted'}`}>
          <FileText className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">{tipoLabel[avaliacao.tipo]}</span>
            <span className="text-xs text-muted-foreground">
              {format(new Date(avaliacao.data_avaliacao + 'T12:00:00'), "d 'de' MMM yyyy", { locale: ptBR })}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase inline-flex items-center gap-1 ${
              isPendente ? 'bg-amber-500/10 text-amber-600' : 'bg-emerald-500/10 text-emerald-600'
            }`}>
              {isPendente ? <Clock className="w-2.5 h-2.5" /> : <CheckCircle2 className="w-2.5 h-2.5" />}
              {isPendente ? 'Pendente' : 'Concluída'}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
            <span>Média <span className="font-bold text-primary tabular-nums">{media}</span>/10</span>
            {avaliacao.testes_aplicados && avaliacao.testes_aplicados.length > 0 && (
              <span className="truncate">· {avaliacao.testes_aplicados.length} teste{avaliacao.testes_aplicados.length > 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          {onEdit && (
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          )}
          {onDelete && (
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onDelete}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border p-4 space-y-3 bg-muted/20">
          {avaliacao.testes_aplicados && avaliacao.testes_aplicados.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {avaliacao.testes_aplicados.map((t) => (
                <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
              ))}
            </div>
          )}
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={data}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="dominio" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <PolarRadiusAxis domain={[0, 10]} tick={{ fontSize: 9 }} />
                <Radar name="Avaliação" dataKey="valor"
                  stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.35} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          {avaliacao.observacoes && (
            <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed border-t pt-2">
              {avaliacao.observacoes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}