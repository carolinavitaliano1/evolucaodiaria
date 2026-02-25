import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const CACHE_KEY = 'clinipro_subscription_cache';

interface SubscriptionState {
  subscribed: boolean;
  productId: string | null;
  subscriptionEnd: string | null;
  loading: boolean;
}

function getCachedSubscription(userId: string): Omit<SubscriptionState, 'loading'> | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    // Only use cache if it belongs to the same user and is less than 5 minutes old
    if (cached.userId === userId && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      return { subscribed: cached.subscribed, productId: cached.productId, subscriptionEnd: cached.subscriptionEnd };
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
  const { user } = useAuth();

  const [state, setState] = useState<SubscriptionState>(() => {
    if (user) {
      const cached = getCachedSubscription(user.id);
      if (cached) return { ...cached, loading: false };
    }
    return { subscribed: false, productId: null, subscriptionEnd: null, loading: true };
  });

  const checkSubscription = useCallback(async () => {
    if (!user) {
      setState({ subscribed: false, productId: null, subscriptionEnd: null, loading: false });
      localStorage.removeItem(CACHE_KEY);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      if (error) throw error;

      const result = {
        subscribed: data?.subscribed ?? false,
        productId: data?.product_id ?? null,
        subscriptionEnd: data?.subscription_end ?? null,
      };
      setCachedSubscription(user.id, result);
      setState({ ...result, loading: false });
    } catch (error) {
      console.error('Error checking subscription:', error);
      setState(prev => ({ ...prev, loading: false, subscribed: true }));
    }
  }, [user]);

  // Re-initialize from cache when user changes
  useEffect(() => {
    if (user) {
      const cached = getCachedSubscription(user.id);
      if (cached) {
        setState({ ...cached, loading: false });
      } else {
        setState({ subscribed: false, productId: null, subscriptionEnd: null, loading: true });
      }
    }
    checkSubscription();

    const interval = setInterval(checkSubscription, 60000);
    return () => clearInterval(interval);
  }, [checkSubscription]);

  return { ...state, refresh: checkSubscription };
}
