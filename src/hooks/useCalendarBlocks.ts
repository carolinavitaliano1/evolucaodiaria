import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface CalendarBlock {
  id: string;
  user_id: string;
  clinic_id: string | null;
  block_type: 'feriado' | 'ferias';
  start_date: string; // yyyy-MM-dd
  end_date: string;   // yyyy-MM-dd
  description: string;
  created_at: string;
  updated_at: string;
}

export function useCalendarBlocks() {
  const { user } = useAuth();
  const [blocks, setBlocks] = useState<CalendarBlock[]>([]);
  // Start as `true` so consumers wait for the first fetch before deciding
  // whether a date is blocked (prevents holiday flash on dashboards).
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('calendar_blocks')
      .select('*')
      .eq('user_id', user.id)
      .order('start_date', { ascending: false });
    setBlocks((data as CalendarBlock[]) || []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const create = async (input: {
    block_type: 'feriado' | 'ferias';
    start_date: string;
    end_date: string;
    description: string;
    clinic_id: string | null;
  }) => {
    if (!user?.id) return { error: new Error('Não autenticado') };
    const { error } = await supabase.from('calendar_blocks').insert({
      ...input,
      user_id: user.id,
    });
    if (!error) await load();
    return { error };
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('calendar_blocks').delete().eq('id', id);
    if (!error) await load();
    return { error };
  };

  /** Check if a given yyyy-MM-dd falls inside any block (optionally for a clinic). */
  const isDateBlocked = useCallback(
    (dateStr: string, clinicId?: string | null) => {
      return blocks.some(b => {
        if (dateStr < b.start_date || dateStr > b.end_date) return false;
        // Block applies to this clinic if it has no clinic_id (global) or matches
        if (b.clinic_id && clinicId && b.clinic_id !== clinicId) return false;
        return true;
      });
    },
    [blocks]
  );

  /** Get the block matching a date (first match), if any. */
  const getBlockForDate = useCallback(
    (dateStr: string, clinicId?: string | null): CalendarBlock | undefined => {
      return blocks.find(b => {
        if (dateStr < b.start_date || dateStr > b.end_date) return false;
        if (b.clinic_id && clinicId && b.clinic_id !== clinicId) return false;
        return true;
      });
    },
    [blocks]
  );

  return { blocks, loading, load, create, remove, isDateBlocked, getBlockForDate };
}
