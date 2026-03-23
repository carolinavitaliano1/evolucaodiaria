import { PortalLayout } from '@/components/portal/PortalLayout';
import { usePortal } from '@/contexts/PortalContext';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { Loader2, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface EvolutionFeedback {
  id: string;
  content: string;
  photo_urls: string[];
  is_bulk: boolean;
  created_at: string;
}

export default function PortalEvolutions() {
  const { portalAccount } = usePortal();
  const [feedbacks, setFeedbacks] = useState<EvolutionFeedback[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!portalAccount) return;
    supabase
      .from('evolution_feedbacks')
      .select('id, content, photo_urls, is_bulk, created_at')
      .eq('patient_id', portalAccount.patient_id)
      .eq('sent_to_portal', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const list = (data || []).map((item: any) => ({
          ...item,
          photo_urls: Array.isArray(item.photo_urls)
            ? item.photo_urls
            : typeof item.photo_urls === 'string'
              ? JSON.parse(item.photo_urls)
              : [],
        }));
        setFeedbacks(list);
        setLoading(false);
      });
  }, [portalAccount]);

  return (
    <PortalLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-lg font-bold text-foreground">Feedback da Sessão</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Registros compartilhados pelo seu terapeuta</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : feedbacks.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-8 text-center">
            <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="font-semibold text-sm text-foreground">Nenhum registro disponível</p>
            <p className="text-xs text-muted-foreground mt-1">Seu terapeuta ainda não compartilhou nenhum feedback.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {feedbacks.map(fb => (
              <div key={fb.id} className="bg-card rounded-2xl border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-primary">
                    {fb.is_bulk ? '📊 Resumo do período' : '💬 Feedback da sessão'}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(fb.created_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </span>
                </div>
                {fb.content && (
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{fb.content}</p>
                )}
                {fb.photo_urls.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {fb.photo_urls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={url}
                          alt={`Foto ${i + 1}`}
                          className="w-full h-32 object-cover rounded-xl border border-border hover:opacity-90 transition-opacity"
                        />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
