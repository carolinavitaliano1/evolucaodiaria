import { createClient } from "npm:@supabase/supabase-js@2";

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

    // Validate the requesting user's identity
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

    // Admin client for privileged operations
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Delete user data from all tables (order matters due to FK constraints)
    // Tables with FK to patients/clinics will cascade, but we need to delete
    // top-level tables that reference user_id directly

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
      // Ignore errors for tables where user may have no data
      if (error) {
        console.log(`Note: could not clean ${table}: ${error.message}`);
      }
    }

    // Also clean tables where the user is referenced as owner_id
    await adminClient.from("organizations").delete().eq("owner_id", userId);

    // Clean internal notifications where user is recipient
    await adminClient
      .from("internal_notifications")
      .delete()
      .eq("recipient_user_id", userId);

    // Clean portal accounts where user is therapist
    await adminClient
      .from("patient_portal_accounts")
      .delete()
      .eq("therapist_user_id", userId);

    // Finally, delete the auth user
    const { error: deleteError } =
      await adminClient.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error("Failed to delete auth user:", deleteError.message);
      return new Response(
        JSON.stringify({ error: "Falha ao excluir conta de autenticação." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
