import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';

const OWNER_EMAILS = new Set([
  'carolinavitaliano1@gmail.com',
]);

/**
 * Telehealth is available for Pro-tier users when atendendo em clinic.type
 * 'propria' (Consultório) ou 'terceirizada' (Contratante). 'clinica' (Clínica Pro)
 * NÃO recebe a feature. Owners sempre liberados.
 */
export function useTelehealthAccess(clinicType?: string | null) {
  const { user } = useAuth();
  const { tier, loading } = useSubscription();

  return useMemo(() => {
    const email = user?.email?.toLowerCase() ?? '';
    if (OWNER_EMAILS.has(email)) {
      return { enabled: true, loading: false, reason: '' as const };
    }
    if (loading) return { enabled: false, loading: true, reason: '' as const };

    const proLike = tier === 'pro' || tier === 'legacy' || tier === 'trial';
    if (!proLike) {
      return {
        enabled: false,
        loading: false,
        reason: 'Disponível no plano Pro.',
      };
    }
    if (clinicType === 'clinica') {
      return {
        enabled: false,
        loading: false,
        reason: 'Não disponível para clínicas no plano Clínica Pro.',
      };
    }
    return { enabled: true, loading: false, reason: '' };
  }, [user, tier, loading, clinicType]);
}