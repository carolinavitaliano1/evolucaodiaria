import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  console.log(`[PUSH-SUPPORT] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Unauthorized");

    const { targetUserId, title, body } = await req.json();
    if (!targetUserId) throw new Error("targetUserId is required");

    logStep("Sending push to user", { targetUserId, title });

    // Get all push tokens for target user
    const { data: tokens, error: tokensError } = await supabase
      .from("push_tokens")
      .select("token, platform")
      .eq("user_id", targetUserId);

    if (tokensError) throw tokensError;
    if (!tokens || tokens.length === 0) {
      logStep("No tokens found for user", { targetUserId });
      return new Response(JSON.stringify({ sent: 0, reason: "no_tokens" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fcmKey = Deno.env.get("FCM_SERVER_KEY");
    if (!fcmKey) {
      logStep("No FCM_SERVER_KEY configured — skipping push");
      return new Response(JSON.stringify({ sent: 0, reason: "no_fcm_key" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;
    for (const { token: pushToken } of tokens) {
      const res = await fetch("https://fcm.googleapis.com/fcm/send", {
        method: "POST",
        headers: {
          Authorization: `key=${fcmKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: pushToken,
          notification: {
            title: title ?? "Suporte respondeu ✉️",
            body: body ?? "Você tem uma nova resposta do suporte.",
            sound: "default",
          },
          data: {
            route: "/suporte",
          },
          priority: "high",
        }),
      });

      if (res.ok) {
        const result = await res.json();
        if (result.success > 0) {
          sent++;
          logStep("Push sent", { pushToken: pushToken.slice(0, 20) });
        } else {
          logStep("FCM rejected token", { result });
          // Clean up invalid token
          if (result.results?.[0]?.error === "NotRegistered" || result.results?.[0]?.error === "InvalidRegistration") {
            await supabase.from("push_tokens").delete().eq("token", pushToken);
            logStep("Removed invalid token");
          }
        }
      } else {
        logStep("FCM request failed", await res.text());
      }
    }

    return new Response(JSON.stringify({ sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
