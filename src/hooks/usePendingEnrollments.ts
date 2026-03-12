import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function usePendingEnrollments() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const fetchCount = async () => {
    if (!user) return;
    const { count: c } = await supabase
      .from('patients')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'pendente');
    setCount(c ?? 0);
  };

  useEffect(() => {
    if (!user) return;
    fetchCount();

    // Realtime: listen for patient inserts/updates on this user's patients
    const channel = supabase
      .channel('pending-enrollments')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'patients', filter: `user_id=eq.${user.id}` },
        () => fetchCount()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  return { count };
}
