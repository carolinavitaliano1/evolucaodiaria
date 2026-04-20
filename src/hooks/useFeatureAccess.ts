import { useSubscription } from './useSubscription';
import { tierHasPro } from '@/lib/plans';

/**
 * Centralized helper for plan-based feature gating.
 *
 * Basic plan loses: AI features, Patient Portal, Team management.
 * Pro / Legacy / Trial / Owner keep everything.
 */
export function useFeatureAccess() {
  const { tier, loading } = useSubscription();

  const isPro = tierHasPro(tier);

  return {
    tier,
    loading,
    isPro,
    isBasic: tier === 'basic',
    hasAI: isPro,
    hasPortal: isPro,
    hasTeam: isPro,
  };
}
