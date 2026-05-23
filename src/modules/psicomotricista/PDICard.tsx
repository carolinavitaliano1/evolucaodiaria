import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Pencil, Trash2, Target } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { PDI, PdiObjetivo } from './types';

interface Props {
  pdi: PDI;
  onEdit?: () => void;
  onDelete?: () => void;
  onChanged?: () => void;
}

const statusVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  ativo: 'default', concluido: 'outline', pausado: 'secondary',
};

export function PDICard({ pdi, onEdit, onDelete, onChanged }: Props) {
  const objetivos = (pdi.objetivos || []) as PdiObjetivo[];
  const done = objetivos.filter((o) => o.atingida).length;
  const total = objetivos.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  async function toggleObjetivo(idx: number) {
    const next = objetivos.map((o, i) => (i === idx ? { ...o, atingida: !o.atingida } : o));
    const { error } = await supabase.from('psicom_pdi').update({ objetivos: next as any }).eq('id', pdi.id);
    if (error) toast.error('Erro ao atualizar');
    else onChanged?.();
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Target className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm font-semibold text-foreground truncate">{pdi.titulo}</span>
            <Badge variant={statusVariant[pdi.status] || 'secondary'} className="text-[10px]">{pdi.status}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {format(new Date(pdi.periodo_inicio + 'T12:00:00'), 'dd MMM yyyy', { locale: ptBR })}
            {pdi.periodo_fim && ` → ${format(new Date(pdi.periodo_fim + 'T12:00:00'), 'dd MMM yyyy', { locale: ptBR })}`}
          </p>
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

      {total > 0 && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">{done}/{total} objetivos atingidos</span>
            <span className="font-medium text-primary">{pct}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {total > 0 && (
        <div className="space-y-1.5 border-t pt-2">
          {objetivos.map((o, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <Checkbox checked={o.atingida} onCheckedChange={() => toggleObjetivo(i)} className="mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className={`${o.atingida ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                  <span className="font-medium capitalize">{o.area}:</span> {o.meta}
                </span>
                {o.prazo && (
                  <span className="ml-2 text-[10px] text-muted-foreground">
                    até {format(new Date(o.prazo + 'T12:00:00'), 'dd/MM/yy')}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {pdi.observacoes && (
        <p className="text-xs text-muted-foreground whitespace-pre-wrap border-t pt-2">{pdi.observacoes}</p>
      )}
    </div>
  );
}