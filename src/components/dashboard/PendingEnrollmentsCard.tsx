import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PendingPatient {
  id: string;
  name: string;
  clinic_id: string;
  clinic_name: string;
  created_at: string;
}

export function PendingEnrollmentsCard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState<PendingPatient[]>([]);

  const fetchPending = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('patients')
      .select('id, name, clinic_id, created_at, clinics(name)')
      .eq('user_id', user.id)
      .eq('status', 'pendente')
      .order('created_at', { ascending: false });

    if (data) {
      setPending(
        data.map((p: any) => ({
          id: p.id,
          name: p.name,
          clinic_id: p.clinic_id,
          clinic_name: p.clinics?.name ?? '',
          created_at: p.created_at,
        }))
      );
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchPending();

    const channel = supabase
      .channel('dashboard-pending-enrollments')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'patients', filter: `user_id=eq.${user.id}` },
        () => fetchPending()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  if (pending.length === 0) return null;

  return (
    <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ClipboardList className="w-4 h-4 text-warning" />
        <h3 className="text-sm font-semibold text-foreground">
          Matrículas Pendentes
        </h3>
        <span className="ml-auto inline-flex items-center justify-center rounded-full bg-warning/20 text-warning text-xs font-bold min-w-[20px] h-5 px-1.5">
          {pending.length}
        </span>
      </div>

      <div className="space-y-2">
        {pending.slice(0, 5).map((p) => (
          <div
            key={p.id}
            className={cn(
              "flex items-center justify-between gap-2 rounded-lg bg-background/60 px-3 py-2 border border-border"
            )}
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
              <p className="text-xs text-muted-foreground truncate">{p.clinic_name}</p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="shrink-0 text-xs text-primary"
              onClick={() => navigate(`/clinics/${p.clinic_id}`)}
            >
              Revisar <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        ))}
        {pending.length > 5 && (
          <p className="text-xs text-muted-foreground text-center">
            e mais {pending.length - 5} pendente{pending.length - 5 > 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  );
}
