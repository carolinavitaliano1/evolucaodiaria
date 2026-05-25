import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSubscription } from '@/hooks/useSubscription';
import type { ModuleId } from './config';

export function useModuleAccess(moduleId: ModuleId) {
  const [hasAccess, setHasAccess] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const { tier, loading: subLoading } = useSubscription();

  // Plano mais caro (Clínica Pro) inclui todos os módulos de especialidade
  // gratuitamente, sem necessidade de assinatura adicional.
  const includedByPlan = tier === 'clinica_pro';

  const refresh = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('has_module_access', { _module_id: moduleId });
      if (error) throw error;
      setHasAccess(!!data);
    } catch (e) {
      console.error('[useModuleAccess]', e);
      setHasAccess(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId]);

  return {
    hasAccess: hasAccess || includedByPlan,
    loading: loading || subLoading,
    refresh,
  };
}