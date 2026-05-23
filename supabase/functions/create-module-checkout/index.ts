import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@^18";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Mapa de módulos pagos → Stripe price IDs.
// Apenas Psicopedagogo está ativo no primeiro release.
const MODULE_PRICES: Record<string, string> = {
  psicopedagogo: "price_1TaH8mDl2hex55TCgAZrPg9r",
  psicomotricista: "price_1TaI25Dl2hex55TCtn8gmcgX",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autenticado");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabaseClient.auth.getUser(token);
    if (userErr) throw userErr;
    const user = userData.user;
    if (!user?.email) throw new Error("Usuário sem e-mail");

    const { module_id } = await req.json();
    if (!module_id || !MODULE_PRICES[module_id]) {
      throw new Error("Módulo inválido ou indisponível");
    }
    const priceId = MODULE_PRICES[module_id];

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Localiza ou cria customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) customerId = customers.data[0].id;

    const origin = req.headers.get("origin") || "https://evolucaodiaria.app.br";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      payment_method_types: ["card"],
      subscription_data: {
        metadata: {
          module_id,
          user_id: user.id,
        },
      },
      metadata: {
        module_id,
        user_id: user.id,
        kind: "module_addon",
      },
      success_url: `${origin}/checkout-success?module=${module_id}`,
      cancel_url: `${origin}/modulos`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
