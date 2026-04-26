import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  console.log(`[NOTIFY-MURAL] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY not set");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Auth the calling user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Unauthorized");

    const { noticeTitle, noticeContent, noticeType } = await req.json();
    if (!noticeTitle) throw new Error("noticeTitle is required");

    logStep("Notice to broadcast", { noticeTitle, noticeType });

    // Get all profiles with emails (active subscribers or trial users)
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("email, name")
      .not("email", "is", null);

    if (profilesError) throw profilesError;
    if (!profiles || profiles.length === 0) {
      logStep("No profiles with emails found");
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const typeLabels: Record<string, string> = {
      aviso: "📢 Aviso",
      video: "🎥 Vídeo",
      tutorial: "📖 Tutorial",
      link: "🔗 Link",
    };
    const typeLabel = typeLabels[noticeType] || "📢 Aviso";

    let sent = 0;
    for (const profile of profiles) {
      if (!profile.email) continue;
      const name = profile.name || "terapeuta";

      const html = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"></head>
        <body style="font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px;">
          <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
            <div style="background: #7c3aed; padding: 32px 32px 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">Evolução Diária</h1>
              <p style="color: #e9d5ff; margin: 8px 0 0; font-size: 13px;">Mural de Avisos</p>
            </div>
            <div style="padding: 32px;">
              <div style="display: inline-block; background: #f3e8ff; border: 1px solid #d8b4fe; border-radius: 20px; padding: 4px 12px; font-size: 12px; color: #7c3aed; font-weight: 600; margin-bottom: 16px;">
                ${typeLabel}
              </div>
              <h2 style="color: #1a1a1a; font-size: 20px; margin: 0 0 12px; line-height: 1.3;">${noticeTitle}</h2>
              ${noticeContent ? `<p style="color: #555; line-height: 1.7; font-size: 15px; margin: 0 0 24px;">${noticeContent.replace(/\n/g, '<br/>')}</p>` : ''}
              <div style="text-align: center; margin: 24px 0 8px;">
                <a href="https://evolucaodiaria.app.br/mural" style="display: inline-block; background: #7c3aed; color: #ffffff; text-decoration: none; padding: 13px 28px; border-radius: 8px; font-weight: 600; font-size: 15px;">
                  Ver no Mural →
                </a>
              </div>
            </div>
            <div style="background: #f9f9f9; padding: 16px 32px; text-align: center; border-top: 1px solid #eee;">
              <p style="color: #aaa; font-size: 12px; margin: 0;">© 2025 Evolução Diária · evolucaodiaria.app.br</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Evolução Diária <notify@evolucaodiaria.app.br>",
          to: [profile.email],
          subject: `${typeLabel}: ${noticeTitle}`,
          html,
        }),
      });

      if (res.ok) {
        sent++;
        logStep("Email sent", { email: profile.email });
      } else {
        const err = await res.text();
        logStep("Failed to send", { email: profile.email, err });
      }
    }

    logStep("Done", { sent, total: profiles.length });
    return new Response(JSON.stringify({ sent, total: profiles.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
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
