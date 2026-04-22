import { useSubscription } from './useSubscription';
import { tierHasPro, tierHasTeam } from '@/lib/plans';

/**
 * Centralized helper for plan-based feature gating.
 *
 * Basic plan loses: AI features, Patient Portal, Team management.
 * Pro / Legacy / Trial / Owner keep everything.
 * Clínica Pro adds: multi-professional team management.
 */
export function useFeatureAccess() {
  const { tier, loading } = useSubscription();

  const isPro = tierHasPro(tier);
  const isClinicaPro = tier === 'clinica_pro';
  const hasTeam = tierHasTeam(tier);

  return {
    tier,
    loading,
    isPro,
    isBasic: tier === 'basic',
    isClinicaPro,
    hasAI: isPro,
    hasPortal: isPro,
    hasTeam,
  };
}
