import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Supervisee, SupervisionGoal, SupervisionPayment, SupervisionSession } from './types';

export function useSupervisees() {
  const [supervisees, setSupervisees] = useState<Supervisee[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('supervisees')
      .select('*')
      .order('name');
    if (error) {
      console.error('[useSupervisees]', error);
      toast.error('Não foi possível carregar os supervisionandos');
    }
    setSupervisees((data as unknown as Supervisee[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (payload: Partial<Supervisee> & { name: string }, id?: string) => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) throw new Error('Sessão expirada');
    if (id) {
      const { error } = await supabase.from('supervisees').update(payload as any).eq('id', id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('supervisees').insert({ ...(payload as any), user_id: uid });
      if (error) throw error;
    }
    await load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('supervisees').delete().eq('id', id);
    if (error) throw error;
    await load();
  };

  return { supervisees, loading, reload: load, save, remove };
}

export function useSupervisionSessions(superviseeId?: string) {
  const [sessions, setSessions] = useState<SupervisionSession[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!superviseeId) {
      setSessions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('supervision_sessions')
      .select('*')
      .eq('supervisee_id', superviseeId)
      .order('date', { ascending: false });
    if (error) console.error('[useSupervisionSessions]', error);
    setSessions((data as unknown as SupervisionSession[]) || []);
    setLoading(false);
  }, [superviseeId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (payload: Partial<SupervisionSession>, id?: string) => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid || !superviseeId) throw new Error('Sessão expirada');
    if (id) {
      const { error } = await supabase.from('supervision_sessions').update(payload as any).eq('id', id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('supervision_sessions')
        .insert({ ...(payload as any), user_id: uid, supervisee_id: superviseeId });
      if (error) throw error;
    }
    await load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('supervision_sessions').delete().eq('id', id);
    if (error) throw error;
    await load();
  };

  return { sessions, loading, reload: load, save, remove };
}

export function useSupervisionGoals(superviseeId?: string) {
  const [goals, setGoals] = useState<SupervisionGoal[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!superviseeId) {
      setGoals([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('supervision_goals')
      .select('*')
      .eq('supervisee_id', superviseeId)
      .order('created_at');
    if (error) console.error('[useSupervisionGoals]', error);
    setGoals((data as unknown as SupervisionGoal[]) || []);
    setLoading(false);
  }, [superviseeId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (payload: Partial<SupervisionGoal>, id?: string) => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid || !superviseeId) throw new Error('Sessão expirada');
    if (id) {
      const { error } = await supabase.from('supervision_goals').update(payload as any).eq('id', id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('supervision_goals')
        .insert({ ...(payload as any), user_id: uid, supervisee_id: superviseeId });
      if (error) throw error;
    }
    await load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('supervision_goals').delete().eq('id', id);
    if (error) throw error;
    await load();
  };

  return { goals, loading, reload: load, save, remove };
}

export function useSupervisionPayments(superviseeId?: string) {
  const [payments, setPayments] = useState<SupervisionPayment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!superviseeId) {
      setPayments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('supervision_payments')
      .select('*')
      .eq('supervisee_id', superviseeId)
      .order('reference_year', { ascending: false })
      .order('reference_month', { ascending: false });
    if (error) console.error('[useSupervisionPayments]', error);
    setPayments((data as unknown as SupervisionPayment[]) || []);
    setLoading(false);
  }, [superviseeId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (payload: Partial<SupervisionPayment>, id?: string) => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid || !superviseeId) throw new Error('Sessão expirada');
    if (id) {
      const { error } = await supabase.from('supervision_payments').update(payload as any).eq('id', id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('supervision_payments')
        .insert({ ...(payload as any), user_id: uid, supervisee_id: superviseeId });
      if (error) throw error;
    }
    await load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('supervision_payments').delete().eq('id', id);
    if (error) throw error;
    await load();
  };

  return { payments, loading, reload: load, save, remove };
}