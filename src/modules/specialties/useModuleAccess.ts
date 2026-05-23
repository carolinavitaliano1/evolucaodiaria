import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ModuleId } from './config';

export function useModuleAccess(moduleId: ModuleId) {
  const [hasAccess, setHasAccess] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

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

  return { hasAccess, loading, refresh };
}