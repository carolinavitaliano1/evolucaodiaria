import { Radar, RadarChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DOMINIOS, type Avaliacao } from './types';

interface Props {
  avaliacao: Avaliacao;
  onEdit?: () => void;
  onDelete?: () => void;
}

const tipoLabel: Record<string, string> = { inicial: 'Inicial', reavaliacao: 'Reavaliação', alta: 'Alta' };
const tipoVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  inicial: 'default', reavaliacao: 'secondary', alta: 'outline',
};

export function AvaliacaoCard({ avaliacao, onEdit, onDelete }: Props) {
  const data = DOMINIOS.map((d) => ({
    dominio: d.label,
    valor: avaliacao[d.key] ?? 0,
  }));

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant={tipoVariant[avaliacao.tipo] || 'default'}>{tipoLabel[avaliacao.tipo]}</Badge>
            <span className="text-sm font-medium text-foreground">
              {format(new Date(avaliacao.data_avaliacao + 'T12:00:00'), "d 'de' MMMM yyyy", { locale: ptBR })}
            </span>
          </div>
          {avaliacao.testes_aplicados && avaliacao.testes_aplicados.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {avaliacao.testes_aplicados.map((t) => (
                <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          {onEdit && (
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onEdit}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          )}
          {onDelete && (
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={onDelete}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data}>
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis dataKey="dominio" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
            <PolarRadiusAxis domain={[0, 10]} tick={{ fontSize: 9 }} />
            <Radar
              name="Avaliação"
              dataKey="valor"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.35}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {avaliacao.observacoes && (
        <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed border-t pt-2">
          {avaliacao.observacoes}
        </p>
      )}
    </div>
  );
}