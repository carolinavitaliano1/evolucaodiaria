import { PortalLayout } from '@/components/portal/PortalLayout';
import { usePortal } from '@/contexts/PortalContext';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { Loader2, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Evolution {
  id: string;
  date: string;
  text: string;
  attendance_status: string;
}

export default function PortalEvolutions() {
  const { portalAccount } = usePortal();
  const [evolutions, setEvolutions] = useState<Evolution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!portalAccount) return;
    supabase
      .from('evolutions')
      .select('id, date, text, attendance_status')
      .eq('patient_id', portalAccount.patient_id)
      .eq('portal_visible', true)
      .order('date', { ascending: false })
      .then(({ data }) => {
        setEvolutions((data || []) as Evolution[]);
        setLoading(false);
      });
  }, [portalAccount]);

  const statusLabel = (s: string) => {
    const m: Record<string, string> = {
      presente: '✅ Presente',
      falta: '❌ Falta',
      falta_remunerada: '💰 Falta',
      reposicao: '🔄 Reposição',
      feriado_remunerado: '🎉 Feriado',
      feriado_nao_remunerado: '📅 Feriado',
    };
    return m[s] || s;
  };

  return (
    <PortalLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-lg font-bold text-foreground">Feedbacks da Sessão</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Registros compartilhados pelo seu terapeuta</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : evolutions.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-8 text-center">
            <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="font-semibold text-sm text-foreground">Nenhum registro disponível</p>
            <p className="text-xs text-muted-foreground mt-1">Seu terapeuta ainda não compartilhou nenhum feedback.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {evolutions.map(evo => (
              <div key={evo.id} className="bg-card rounded-2xl border border-border p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-foreground">
                    {format(new Date(evo.date + 'T12:00:00'), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                  <span className="text-xs text-muted-foreground">{statusLabel(evo.attendance_status)}</span>
                </div>
                {evo.text && (
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{evo.text}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
