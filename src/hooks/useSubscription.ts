import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { deriveTier, type Tier } from '@/lib/plans';

const CACHE_KEY = 'evolucao_subscription_cache';

interface SubscriptionState {
  subscribed: boolean;
  productId: string | null;
  subscriptionEnd: string | null;
  tier: Tier;
  loading: boolean;
}

function getCachedSubscription(userId: string): Omit<SubscriptionState, 'loading'> | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (cached.userId === userId && Date.now() - cached.timestamp < 15 * 60 * 1000) {
      const productId = cached.productId ?? null;
      return {
        subscribed: cached.subscribed,
        productId,
        subscriptionEnd: cached.subscriptionEnd,
        tier: cached.tier ?? deriveTier(productId),
      };
    }
  } catch {}
  return null;
}

function setCachedSubscription(userId: string, data: Omit<SubscriptionState, 'loading'>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      userId,
      ...data,
      timestamp: Date.now(),
    }));
  } catch {}
}

export function useSubscription() {
  const { user, sessionReady } = useAuth();

  const [state, setState] = useState<SubscriptionState>(() => {
    if (user) {
      const cached = getCachedSubscription(user.id);
      if (cached) return { ...cached, loading: false };
    }
    return { subscribed: false, productId: null, subscriptionEnd: null, tier: null, loading: true };
  });

  const checkSubscription = useCallback(async () => {
    if (!user) {
      setState({ subscribed: false, productId: null, subscriptionEnd: null, tier: null, loading: false });
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem('clinipro_subscription_cache');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      if (error) throw error;

      const productId = data?.product_id ?? null;
      const tier: Tier = (data?.tier as Tier) ?? deriveTier(productId);
      const result = {
        subscribed: data?.subscribed ?? false,
        productId,
        subscriptionEnd: data?.subscription_end ?? null,
        tier,
      };
      setCachedSubscription(user.id, result);
      setState({ ...result, loading: false });
    } catch (error) {
      console.error('Error checking subscription:', error);
      const cached = user ? getCachedSubscription(user.id) : null;
      setState(prev => ({
        ...prev,
        loading: false,
        subscribed: cached?.subscribed ?? prev.subscribed,
        tier: cached?.tier ?? prev.tier,
      }));
    }
  }, [user]);

  useEffect(() => {
    if (!sessionReady) return;

    if (user) {
      const cached = getCachedSubscription(user.id);
      if (cached) {
        setState({ ...cached, loading: false });
        checkSubscription();
      } else {
        setState({ subscribed: false, productId: null, subscriptionEnd: null, tier: null, loading: true });
        checkSubscription();
      }
    } else {
      setState({ subscribed: false, productId: null, subscriptionEnd: null, tier: null, loading: false });
      return;
    }

    const interval = setInterval(() => checkSubscription(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user, sessionReady, checkSubscription]);

  return { ...state, refresh: checkSubscription };
}
