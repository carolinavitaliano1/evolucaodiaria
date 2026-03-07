import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Returns whether the current user is an active member of any organization
 * (i.e., was invited by someone else and accepted the invite).
 * Org members bypass the subscription wall since they are guests of the paying owner.
 */
export function useOrgMembership() {
  const { user, sessionReady } = useAuth();
  const [isOrgMember, setIsOrgMember] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionReady || !user) {
      setIsOrgMember(false);
      setLoading(false);
      return;
    }

    supabase
      .from('organization_members')
      .select('id, role')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .neq('role', 'owner') // owners must have their own subscription
      .limit(1)
      .then(({ data }) => {
        setIsOrgMember((data?.length ?? 0) > 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user, sessionReady]);

  return { isOrgMember, loading };
}
