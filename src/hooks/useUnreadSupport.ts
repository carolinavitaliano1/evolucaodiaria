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
    if (!user) return;

    if (isAdmin) {
      // Admin: count user messages that arrived AFTER the last time admin replied/seen
      const adminLastSeenKey = `support_admin_last_seen_${user.id}`;
      const lastSeen = localStorage.getItem(adminLastSeenKey) ?? '1970-01-01';
      const { count } = await supabase
        .from('support_messages')
        .select('*', { count: 'exact', head: true })
        .eq('is_admin_reply', false)
        .gt('created_at', lastSeen);
      setUnreadCount(count ?? 0);
    } else {
      // Regular user: count admin replies they haven't seen yet
      const lastSeenKey = `support_last_seen_${user.id}`;
      const lastSeen = localStorage.getItem(lastSeenKey) ?? '1970-01-01';
      const { count } = await supabase
        .from('support_messages')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_admin_reply', true)
        .gt('created_at', lastSeen);
      setUnreadCount(count ?? 0);
    }
  }, [user, isAdmin]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  // Realtime: refresh badge when a support message is inserted
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`sidebar-support-badge-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'support_messages',
        ...(isAdmin ? {} : { filter: `user_id=eq.${user.id}` }),
      }, () => {
        fetchCount();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, isAdmin, fetchCount]);

  // Realtime: clear user badge when chat is closed (session inserted)
  useEffect(() => {
    if (!user || isAdmin) return;
    const channel = supabase
      .channel(`support-session-close-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'support_chat_sessions',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        // Chat was closed — mark everything as seen and clear badge
        const lastSeenKey = `support_last_seen_${user.id}`;
        localStorage.setItem(lastSeenKey, new Date().toISOString());
        setUnreadCount(0);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, isAdmin]);

  /** Call this when the user opens the /suporte page to clear their badge */
  const markSupportSeen = useCallback(() => {
    if (!user || isAdmin) return;
    const lastSeenKey = `support_last_seen_${user.id}`;
    localStorage.setItem(lastSeenKey, new Date().toISOString());
    setUnreadCount(0);
  }, [user, isAdmin]);

  /** Call this when the admin replies or finalizes a chat to clear their badge */
  const markAdminSeen = useCallback(() => {
    if (!user || !isAdmin) return;
    const adminLastSeenKey = `support_admin_last_seen_${user.id}`;
    localStorage.setItem(adminLastSeenKey, new Date().toISOString());
    setUnreadCount(0);
  }, [user, isAdmin]);

  return { unreadCount, isAdmin, markSupportSeen, markAdminSeen };
}
