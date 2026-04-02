import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Authenticate and validate user
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    const userEmail = claimsData.claims.email as string | undefined;

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 2. Cancel Stripe subscription (if any) BEFORE deleting data
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (stripeKey && userEmail) {
      try {
        const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

        // Find customer by email
        const customers = await stripe.customers.list({ email: userEmail, limit: 1 });

        if (customers.data.length > 0) {
          const customerId = customers.data[0].id;
          console.log(`[DELETE-ACCOUNT] Found Stripe customer: ${customerId}`);

          // Cancel all active subscriptions
          const subscriptions = await stripe.subscriptions.list({
            customer: customerId,
            status: "active",
          });

          for (const sub of subscriptions.data) {
            console.log(`[DELETE-ACCOUNT] Canceling subscription: ${sub.id}`);
            await stripe.subscriptions.cancel(sub.id);
            console.log(`[DELETE-ACCOUNT] Subscription ${sub.id} canceled`);
          }

          // Also cancel trialing subscriptions
          const trialingSubs = await stripe.subscriptions.list({
            customer: customerId,
            status: "trialing",
          });

          for (const sub of trialingSubs.data) {
            console.log(`[DELETE-ACCOUNT] Canceling trialing subscription: ${sub.id}`);
            await stripe.subscriptions.cancel(sub.id);
          }
        }
      } catch (stripeError) {
        console.error("[DELETE-ACCOUNT] Stripe cancellation failed:", stripeError);
        // CRITICAL: Do NOT proceed with account deletion if Stripe fails
        return new Response(
          JSON.stringify({
            error:
              "Houve um erro ao cancelar sua cobrança automática. Por favor, tente novamente ou contate o suporte.",
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // 3. Delete user data from all tables
    const tablesToClean = [
      "evolution_feedbacks",
      "evolutions",
      "appointments",
      "patient_payment_records",
      "patient_contracts",
      "patient_portal_accounts",
      "patient_intake_forms",
      "feed_comments",
      "feed_reactions",
      "feed_posts",
      "portal_documents",
      "portal_messages",
      "portal_notices",
      "patients",
      "clinic_notes",
      "clinic_packages",
      "clinic_payment_records",
      "evolution_templates",
      "clinics",
      "tasks",
      "events",
      "stamps",
      "services",
      "private_appointments",
      "saved_reports",
      "notices",
      "notice_reads",
      "attachments",
      "custom_moods",
      "custom_service_types",
      "contract_templates",
      "message_templates",
      "intake_custom_questions",
      "internal_notifications",
      "support_messages",
      "support_chat_sessions",
      "google_calendar_tokens",
      "push_tokens",
      "organization_members",
      "organizations",
      "profiles",
    ];

    for (const table of tablesToClean) {
      const { error } = await adminClient
        .from(table)
        .delete()
        .eq("user_id", userId);
      if (error) {
        console.log(`[DELETE-ACCOUNT] Note: could not clean ${table}: ${error.message}`);
      }
    }

    await adminClient.from("organizations").delete().eq("owner_id", userId);
    await adminClient.from("internal_notifications").delete().eq("recipient_user_id", userId);
    await adminClient.from("patient_portal_accounts").delete().eq("therapist_user_id", userId);

    // 4. Delete auth user
    const { error: deleteError } =
      await adminClient.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error("[DELETE-ACCOUNT] Failed to delete auth user:", deleteError.message);
      return new Response(
        JSON.stringify({ error: "Falha ao excluir conta de autenticação." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[DELETE-ACCOUNT] Account ${userId} fully deleted`);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[DELETE-ACCOUNT] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
