import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@^18";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Plan IDs — keep in sync with src/lib/plans.ts
const BASIC_PRODUCT_ID = 'prod_UN5zsXIUOrZTbq';
const PRO_PRODUCT_ID = 'prod_UN67H1phk2js4F';
const CLINICA_PRO_PRODUCT_ID = 'prod_UNv69FFEc8eE8h';
const LEGACY_PRICE_IDS = new Set([
  'price_1Sz87xDl2hex55TCI3ONELuq',
  'price_1Sz88ADl2hex55TCABAFO3OL',
  'price_1Sz88LDl2hex55TCwzGTUplF',
]);

type Tier = 'basic' | 'pro' | 'clinica_pro' | 'legacy' | 'trial' | 'owner' | null;

function tierFromSubscription(subscription: any): { tier: Tier; productId: string | null } {
  const item = subscription.items.data[0];
  const priceId: string | null = item?.price?.id ?? null;
  const productId: string | null = item?.price?.product ?? null;

  if (priceId && LEGACY_PRICE_IDS.has(priceId)) return { tier: 'legacy', productId: 'legacy' };
  if (productId === CLINICA_PRO_PRODUCT_ID) return { tier: 'clinica_pro', productId };
  if (productId === PRO_PRODUCT_ID) return { tier: 'pro', productId };
  if (productId === BASIC_PRODUCT_ID) return { tier: 'basic', productId };
  // Unknown active subscription → treat as legacy to avoid locking paying users
  return { tier: 'legacy', productId: 'legacy' };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");

    // Owner bypass
    const OWNER_EMAILS = ["carolinavitaliano1@gmail.com"];
    if (OWNER_EMAILS.includes(user.email.toLowerCase())) {
      return new Response(JSON.stringify({
        subscribed: true,
        product_id: "owner",
        subscription_end: null,
        tier: "owner",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Trial bypass via profiles.trial_until
    const { data: profileData } = await supabaseClient
      .from("profiles")
      .select("trial_until")
      .eq("user_id", user.id)
      .single();

    if (profileData?.trial_until && new Date(profileData.trial_until) > new Date()) {
      return new Response(JSON.stringify({
        subscribed: true,
        product_id: "trial",
        subscription_end: profileData.trial_until,
        tier: "trial",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
      timeout: 8000,
    });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      return new Response(JSON.stringify({ subscribed: false, tier: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    const [activeSubs, trialingSubs] = await Promise.all([
      stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 }),
      stripe.subscriptions.list({ customer: customerId, status: "trialing", limit: 1 }),
    ]);

    const allSubs = [...activeSubs.data, ...trialingSubs.data];
    const hasActiveSub = allSubs.length > 0;
    let productId: string | null = null;
    let subscriptionEnd: string | null = null;
    let tier: Tier = null;

    if (hasActiveSub) {
      const subscription = allSubs[0];
      try {
        subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      } catch {
        subscriptionEnd = null;
      }
      const derived = tierFromSubscription(subscription);
      tier = derived.tier;
      productId = derived.productId;
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      product_id: productId,
      subscription_end: subscriptionEnd,
      tier,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("check-subscription error:", error);
    // On error, grant pro-level access to avoid blocking users
    return new Response(JSON.stringify({ subscribed: true, tier: "legacy", error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
