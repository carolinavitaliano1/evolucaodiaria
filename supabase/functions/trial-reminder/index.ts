import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  console.log(`[TRIAL-REMINDER] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Starting trial reminder job");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY not set");

    // Find users whose trial expires in exactly 3 days (between 2d23h and 3d1h from now)
    const now = new Date();
    const windowStart = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000 + 23 * 60 * 60 * 1000); // +2d23h
    const windowEnd = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000);   // +3d1h

    logStep("Looking for trials expiring", { windowStart, windowEnd });

    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("user_id, email, name, trial_until")
      .gte("trial_until", windowStart.toISOString())
      .lte("trial_until", windowEnd.toISOString());

    if (error) throw error;

    logStep("Found profiles with expiring trials", { count: profiles?.length ?? 0 });

    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No trials expiring soon" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    let sent = 0;
    for (const profile of profiles) {
      const email = profile.email;
      if (!email) continue;

      const name = profile.name || "terapeuta";
      const trialEnd = new Date(profile.trial_until);
      const daysLeft = Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

      const html = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"></head>
        <body style="font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px;">
          <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
            <div style="background: #7c3aed; padding: 32px 32px 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">Evolução Diária</h1>
            </div>
            <div style="padding: 32px;">
              <h2 style="color: #1a1a1a; font-size: 18px; margin-top: 0;">Seu período de teste termina em ${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'} ⏰</h2>
              <p style="color: #555; line-height: 1.6;">Olá, <strong>${name}</strong>!</p>
              <p style="color: #555; line-height: 1.6;">
                Seu teste gratuito do <strong>Evolução Diária</strong> está quase no fim. Para continuar usando todos os recursos sem interrupção, adicione seu cartão de crédito e assine um plano.
              </p>
              <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 24px 0;">
                <p style="margin: 0; color: #92400e; font-size: 14px;">
                  ⚠️ Após o término do teste, seu acesso será suspenso até que uma forma de pagamento seja cadastrada.
                </p>
              </div>
              <div style="text-align: center; margin: 32px 0 16px;">
                <a href="https://evolucaodiaria.app.br/pricing" style="display: inline-block; background: #7c3aed; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Assinar agora
                </a>
              </div>
              <p style="color: #999; font-size: 13px; text-align: center;">
                Dúvidas? Fale conosco pelo suporte dentro do app.
              </p>
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
          to: [email],
          subject: `⏰ Seu teste gratuito termina em ${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'}`,
          html,
        }),
      });

      if (res.ok) {
        sent++;
        logStep("Email sent", { email, daysLeft });
      } else {
        const err = await res.text();
        logStep("Failed to send email", { email, err });
      }
    }

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
