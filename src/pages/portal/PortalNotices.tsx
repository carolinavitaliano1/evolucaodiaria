import { PortalLayout } from '@/components/portal/PortalLayout';
import { usePortal } from '@/contexts/PortalContext';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, Bell, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface Notice {
  id: string;
  title: string;
  content: string | null;
  read_by_patient: boolean;
  created_at: string;
}

export default function PortalNotices() {
  const { portalAccount } = usePortal();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const loadNotices = useCallback(async () => {
    if (!portalAccount) return;
    const { data } = await supabase
      .from('portal_notices')
      .select('*')
      .eq('patient_id', portalAccount.patient_id)
      .not('title', 'ilike', '%Mural%')
      .order('created_at', { ascending: false });

    const list = (data || []) as Notice[];
    setNotices(list);
    setLoading(false);

    // Mark all as read
    if (list.some(n => !n.read_by_patient)) {
      await supabase
        .from('portal_notices')
        .update({ read_by_patient: true })
        .eq('patient_id', portalAccount.patient_id)
        .eq('read_by_patient', false);
    }
  }, [portalAccount]);

  useEffect(() => {
    if (!portalAccount) return;

    loadNotices();

    // Cleanup previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Realtime subscription for portal_notices
    const channel = supabase
      .channel(`portal-notices-${portalAccount.patient_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'portal_notices',
          filter: `patient_id=eq.${portalAccount.patient_id}`,
        },
        () => { loadNotices(); }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [portalAccount, loadNotices]);

  return (
    <PortalLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-lg font-bold text-foreground">Avisos</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Comunicados do seu terapeuta</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : notices.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-8 text-center">
            <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="font-semibold text-sm text-foreground">Sem avisos</p>
            <p className="text-xs text-muted-foreground mt-1">Nenhum comunicado por enquanto.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notices.map(notice => (
              <div key={notice.id} className="bg-card rounded-2xl border border-border p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="font-semibold text-sm text-foreground">{notice.title}</p>
                  {notice.read_by_patient && <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />}
                </div>
                {notice.content && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{notice.content}</p>
                )}
                <p className="text-[10px] text-muted-foreground mt-2">
                  {format(new Date(notice.created_at), "d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
