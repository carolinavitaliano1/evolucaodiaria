import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@^18";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const log = (s: string, d?: unknown) =>
  console.log(`[VERIFY-MODULE] ${s}${d ? " " + JSON.stringify(d) : ""}`);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autenticado");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: uerr } = await supabaseAnon.auth.getUser(token);
    if (uerr) throw uerr;
    const user = userData.user;
    if (!user?.email) throw new Error("Usuário sem e-mail");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) {
      return new Response(JSON.stringify({ modules: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    const customerId = customers.data[0].id;

    // Carrega todas as subs do cliente (todos status) para sincronizar
    const subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 50 });
    log("subs", { count: subs.data.length });

    const seen: string[] = [];
    for (const sub of subs.data) {
      const moduleId =
        sub.metadata?.module_id ||
        (sub.items?.data?.[0]?.price?.metadata as Record<string, string> | undefined)?.module_id;
      if (!moduleId) continue;

      const priceId = sub.items.data[0]?.price?.id ?? null;
      const status = sub.status;
      const startedAt = sub.start_date ? new Date(sub.start_date * 1000).toISOString() : null;
      const expiresAt = sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null;

      // upsert por (user_id, module_id, stripe_subscription_id)
      const { error: upErr } = await supabaseAdmin
        .from("module_subscriptions")
        .upsert(
          {
            user_id: user.id,
            module_id: moduleId,
            stripe_subscription_id: sub.id,
            stripe_price_id: priceId,
            status,
            started_at: startedAt,
            expires_at: expiresAt,
          },
          { onConflict: "stripe_subscription_id" },
        );
      if (upErr) log("upsert error", upErr);
      else seen.push(moduleId);
    }

    return new Response(JSON.stringify({ modules: seen }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
