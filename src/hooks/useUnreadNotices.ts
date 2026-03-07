import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useUnreadNotices() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnread = useCallback(async () => {
    if (!user) return;
    // Total notices (all authenticated users can see all notices)
    const { count: total } = await supabase
      .from('notices')
      .select('*', { count: 'exact', head: true });

    // Notices already read by this user
    const { count: read } = await supabase
      .from('notice_reads')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    setUnreadCount(Math.max(0, (total ?? 0) - (read ?? 0)));
  }, [user]);

  useEffect(() => {
    fetchUnread();
  }, [fetchUnread]);

  const markAsRead = async (noticeId: string) => {
    if (!user) return;
    await supabase
      .from('notice_reads')
      .upsert({ user_id: user.id, notice_id: noticeId }, { onConflict: 'user_id,notice_id' });
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = async (noticeIds: string[]) => {
    if (!user || noticeIds.length === 0) return;
    await supabase.from('notice_reads').upsert(
      noticeIds.map(id => ({ user_id: user.id, notice_id: id })),
      { onConflict: 'user_id,notice_id' }
    );
    setUnreadCount(0);
  };

  return { unreadCount, markAsRead, markAllAsRead, refetch: fetchUnread };
}
