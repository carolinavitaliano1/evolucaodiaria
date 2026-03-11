import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, EyeOff, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface Evolution {
  id: string;
  date: string;
  text: string;
  attendance_status: string;
  portal_visible: boolean;
}

interface SharedEvolutionsManagerProps {
  patientId: string;
}

export function SharedEvolutionsManager({ patientId }: SharedEvolutionsManagerProps) {
  const { user } = useAuth();
  const [evolutions, setEvolutions] = useState<Evolution[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('evolutions')
      .select('id, date, text, attendance_status, portal_visible')
      .eq('patient_id', patientId)
      .eq('user_id', user!.id)
      .order('date', { ascending: false })
      .limit(30);
    setEvolutions((data || []) as Evolution[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [patientId]);

  const toggleVisible = async (id: string, current: boolean) => {
    const { error } = await supabase
      .from('evolutions')
      .update({ portal_visible: !current })
      .eq('id', id);
    if (error) { toast.error('Erro ao atualizar'); return; }
    setEvolutions(ev => ev.map(e => e.id === id ? { ...e, portal_visible: !current } : e));
  };

  if (loading) return <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  const visibleCount = evolutions.filter(e => e.portal_visible).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          Evoluções compartilhadas
        </h3>
        <span className="text-xs text-muted-foreground">{visibleCount} visíveis no portal</span>
      </div>

      {evolutions.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">Nenhuma evolução registrada ainda.</p>
      ) : (
        <div className="space-y-2">
          {evolutions.map(evo => (
            <div key={evo.id} className="bg-card rounded-xl border border-border p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground">
                      {format(new Date(evo.date + 'T12:00:00'), "d 'de' MMMM", { locale: ptBR })}
                    </span>
                    <span className="text-[10px] text-muted-foreground capitalize">{evo.attendance_status}</span>
                  </div>
                  {evo.text && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{evo.text.substring(0, 80)}...</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {evo.portal_visible
                    ? <Eye className="w-3.5 h-3.5 text-primary" />
                    : <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                  }
                  <Switch
                    checked={evo.portal_visible}
                    onCheckedChange={() => toggleVisible(evo.id, evo.portal_visible)}
                    className="scale-75"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-[10px] text-muted-foreground">
        Ative o toggle para compartilhar a evolução no portal do paciente. Apenas o texto é exibido — campos internos não são mostrados.
      </p>
    </div>
  );
}
