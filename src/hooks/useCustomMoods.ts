import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface CustomMood {
  id: string;
  emoji: string;
  label: string;
  score: number;
}

export function useCustomMoods() {
  const { user } = useAuth();
  const [customMoods, setCustomMoods] = useState<CustomMood[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMoods = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('custom_moods')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at');
    if (data) setCustomMoods(data);
  };

  useEffect(() => {
    fetchMoods();
  }, [user]);

  const addMood = async (emoji: string, label: string, score: number) => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from('custom_moods').insert({
      user_id: user.id, emoji, label, score,
    });
    if (error) toast.error('Erro ao criar humor');
    else { toast.success('Humor criado!'); await fetchMoods(); }
    setLoading(false);
  };

  const deleteMood = async (id: string) => {
    const { error } = await supabase.from('custom_moods').delete().eq('id', id);
    if (error) toast.error('Erro ao remover humor');
    else { toast.success('Humor removido'); await fetchMoods(); }
  };

  return { customMoods, loading, addMood, deleteMood };
}
