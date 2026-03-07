import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useUnreadSupportCount() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('is_support_admin')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => setIsAdmin(!!(data as any)?.is_support_admin));
  }, [user]);

  const fetchCount = useCallback(async () => {
    if (!isAdmin) return;
    // Count messages from users (not admin replies) — these are "pending" support messages
    const { count } = await supabase
      .from('support_messages')
      .select('*', { count: 'exact', head: true })
      .eq('is_admin_reply', false);
    setUnreadCount(count ?? 0);
  }, [isAdmin]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  // Realtime: update when new support messages come in
  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel('sidebar-support-badge')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages' }, () => {
        fetchCount();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAdmin, fetchCount]);

  return { unreadCount: isAdmin ? unreadCount : 0, isAdmin };
}
