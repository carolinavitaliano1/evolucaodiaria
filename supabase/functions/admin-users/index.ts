import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OWNER_EMAILS = ["carolinavitaliano1@gmail.com"];
const APP_URL = "https://evolucaodiaria.app.br";

const BASIC_PRODUCT_ID = "prod_UN5zsXIUOrZTbq";
const PRO_PRODUCT_ID = "prod_UN67H1phk2js4F";
const CLINICA_PRO_PRODUCT_ID = "prod_UNv69FFEc8eE8h";
const LEGACY_PRICE_IDS = new Set([
  "price_1Sz87xDl2hex55TCI3ONELuq",
  "price_1Sz88ADl2hex55TCABAFO3OL",
  "price_1Sz88LDl2hex55TCwzGTUplF",
]);

function tierFromSub(sub: Stripe.Subscription): { tier: string; product_id: string | null } {
  const item = sub.items.data[0];
  const priceId = item?.price?.id ?? null;
  const productId = (item?.price?.product as string) ?? null;
  if (priceId && LEGACY_PRICE_IDS.has(priceId)) return { tier: "legacy", product_id: productId };
  if (productId === CLINICA_PRO_PRODUCT_ID) return { tier: "clinica_pro", product_id: productId };
  if (productId === PRO_PRODUCT_ID) return { tier: "pro", product_id: productId };
  if (productId === BASIC_PRODUCT_ID) return { tier: "basic", product_id: productId };
  return { tier: "legacy", product_id: productId };
}

const TIER_LABEL: Record<string, string> = {
  owner: "Owner",
  trial: "Trial",
  legacy: "Legacy",
  clinica_pro: "Clínica Pro",
  pro: "Pro",
  basic: "Basic",
  free: "Sem assinatura",
};

const buildHtml = (name: string, subject: string, message: string, mode: "text" | "html" = "text") => {
  const body =
    mode === "html"
      ? message
      : `<div style="font-size:15px;line-height:1.7;white-space:pre-wrap;color:#374151;margin-top:12px;">${message
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")}</div>`;
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f1f1f;">
  <div style="max-width:600px;margin:0 auto;padding:24px;background:#ffffff;">
    <div style="text-align:center;padding:16px 0;border-bottom:2px solid #7c3aed;">
      <h1 style="font-size:22px;color:#7c3aed;margin:0;">Evolução Diária 💜</h1>
    </div>
    <div style="padding:24px 0;">
      <p style="font-size:16px;line-height:1.6;">Olá <strong>${name || "usuário(a)"}</strong>,</p>
      <h2 style="font-size:18px;color:#5b21b6;margin-top:16px;">${subject}</h2>
      ${body}
    </div>
    <div style="text-align:center;margin:24px 0;">
      <a href="${APP_URL}" style="display:inline-block;background:#7c3aed;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Acessar o App</a>
    </div>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
    <p style="font-size:12px;color:#6b7280;text-align:center;">
      Equipe Evolução Diária<br/>
      <a href="${APP_URL}" style="color:#7c3aed;">${APP_URL}</a>
    </p>
  </div>
</body>
</html>
`;
};

const buildInviteHtml = (name: string) => `
<!DOCTYPE html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f1f1f;">
  <div style="max-width:600px;margin:0 auto;padding:24px;background:#ffffff;">
    <div style="text-align:center;padding:16px 0;border-bottom:2px solid #7c3aed;">
      <h1 style="font-size:22px;color:#7c3aed;margin:0;">Evolução Diária 💜</h1>
    </div>
    <div style="padding:24px 0;">
      <p style="font-size:16px;line-height:1.6;">Olá <strong>${name || "tudo bem"}</strong>,</p>
      <h2 style="font-size:20px;color:#5b21b6;margin-top:16px;">Você foi convidado(a) a conhecer a Evolução Diária ✨</h2>
      <p style="font-size:15px;line-height:1.7;color:#374151;">
        Sistema completo de gestão para psicólogos, fonoaudiólogos, terapeutas e clínicas:
        agenda, pacientes, evoluções, financeiro, portal do paciente e IA — tudo em um só lugar.
      </p>
      <ul style="font-size:14px;line-height:1.8;color:#374151;">
        <li>📅 Agenda inteligente e portal do paciente</li>
        <li>📝 Evoluções com IA</li>
        <li>💰 Controle financeiro completo</li>
        <li>🎁 <strong>15 dias grátis, sem cartão</strong></li>
      </ul>
    </div>
    <div style="text-align:center;margin:24px 0;">
      <a href="${APP_URL}/auth?ref=convite" style="display:inline-block;background:#7c3aed;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">Criar minha conta grátis</a>
    </div>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
    <p style="font-size:12px;color:#6b7280;text-align:center;">
      Equipe Evolução Diária<br/>
      <a href="${APP_URL}" style="color:#7c3aed;">${APP_URL}</a>
    </p>
  </div>
</body>
</html>
`;

async function sendOneEmail(resendKey: string, to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Evolução Diária <notify@evolucaodiaria.app.br>",
      to: [to],
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: userRes, error: userErr } = await userClient.auth.getUser(token);
    const callerEmail = userRes?.user?.email?.toLowerCase() ?? "";
    if (userErr || !callerEmail || !OWNER_EMAILS.includes(callerEmail)) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem acessar." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(url, serviceKey);
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    if (action === "list") {
      const { data, error } = await admin
        .from("profiles")
        .select("user_id, name, email, phone, trial_until, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Map active Stripe subscriptions per email
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      const emailToPlan = new Map<string, { tier: string; status: string; subscription_end: string | null; product_id: string | null }>();
      const emailToLastStatus = new Map<string, { status: string; ended_at: string | null }>();
      if (stripeKey) {
        try {
          const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
          // Pull active/trialing/past_due (for current plan) + canceled/incomplete_expired/unpaid (for last status).
          const ACTIVE_STATUSES = ["active", "trialing", "past_due"] as const;
          const INACTIVE_STATUSES = ["canceled", "incomplete_expired", "unpaid"] as const;
          for (const status of [...ACTIVE_STATUSES, ...INACTIVE_STATUSES] as const) {
            let startingAfter: string | undefined;
            for (let page = 0; page < 20; page++) {
              const res: Stripe.ApiList<Stripe.Subscription> = await stripe.subscriptions.list({
                status,
                limit: 100,
                starting_after: startingAfter,
                expand: ["data.customer"],
              });
              for (const sub of res.data) {
                const cust = sub.customer as Stripe.Customer | null;
                const email = (cust && "email" in cust ? cust.email : null)?.toLowerCase();
                if (!email) continue;
                const { tier, product_id } = tierFromSub(sub);
                const isActiveLike = (ACTIVE_STATUSES as readonly string[]).includes(sub.status);
                if (isActiveLike) {
                  const existing = emailToPlan.get(email);
                  const rank = (t: string) => ["free","basic","pro","clinica_pro","legacy","trial","owner"].indexOf(t);
                  if (!existing || rank(tier) > rank(existing.tier)) {
                    emailToPlan.set(email, {
                      tier,
                      status: sub.status,
                      subscription_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
                      product_id,
                    });
                  }
                } else {
                  const endedAt = (sub as any).ended_at ?? sub.canceled_at ?? sub.current_period_end ?? null;
                  const endedIso = endedAt ? new Date(endedAt * 1000).toISOString() : null;
                  const existing = emailToLastStatus.get(email);
                  if (!existing || (endedIso && (!existing.ended_at || endedIso > existing.ended_at))) {
                    emailToLastStatus.set(email, { status: sub.status, ended_at: endedIso });
                  }
                }
              }
              if (!res.has_more) break;
              startingAfter = res.data[res.data.length - 1]?.id;
              if (!startingAfter) break;
            }
          }
        } catch (e) {
          console.error("[admin-users] Stripe list error", e);
        }
      }

      const enriched = (data ?? []).map((u: any) => {
        const email = (u.email ?? "").toLowerCase();
        const isOwnerAcct = OWNER_EMAILS.includes(email);
        const trialActive = u.trial_until && new Date(u.trial_until) > new Date();
        const plan = emailToPlan.get(email);
        let tier = "free";
        let status: string | null = null;
        let subscription_end: string | null = null;
        let product_id: string | null = null;
        let last_status: string | null = null;
        let last_status_ended_at: string | null = null;
        if (isOwnerAcct) {
          tier = "owner";
        } else if (plan) {
          tier = plan.tier;
          status = plan.status;
          subscription_end = plan.subscription_end;
          product_id = plan.product_id;
        } else if (trialActive) {
          tier = "trial";
          status = "trialing";
          subscription_end = u.trial_until;
        } else {
          const last = emailToLastStatus.get(email);
          if (last) {
            last_status = last.status;
            last_status_ended_at = last.ended_at;
          }
        }
        return { ...u, tier, tier_label: TIER_LABEL[tier] ?? tier, status, subscription_end, product_id, last_status, last_status_ended_at };
      });

      return new Response(JSON.stringify({ users: enriched }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "send_email") {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (!resendKey) throw new Error("RESEND_API_KEY not set");
      const recipients = (body.recipients ?? []) as Array<{ email: string; name?: string }>;
      const subject = (body.subject ?? "").toString().trim();
      const message = (body.message ?? "").toString();
      const mode = body.mode === "html" ? "html" : "text";
      if (!recipients.length || !subject || !message) {
        return new Response(JSON.stringify({ error: "recipients, subject e message são obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const results: Array<{ email: string; ok: boolean; error?: string }> = [];
      for (const r of recipients) {
        if (!r.email) continue;
        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "Evolução Diária <notify@evolucaodiaria.app.br>",
              to: [r.email],
              subject,
              html: buildHtml(r.name ?? "", subject, message, mode),
            }),
          });
          if (!res.ok) {
            const txt = await res.text();
            results.push({ email: r.email, ok: false, error: txt });
          } else {
            results.push({ email: r.email, ok: true });
          }
        } catch (e) {
          results.push({ email: r.email, ok: false, error: (e as Error).message });
        }
      }
      const okCount = results.filter(r => r.ok).length;
      return new Response(JSON.stringify({ success: true, sent: okCount, total: results.length, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "send_contact_email") {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (!resendKey) throw new Error("RESEND_API_KEY not set");
      const contactIds = (body.contact_ids ?? []) as string[];
      const isInvite = !!body.is_invite;
      const subject = isInvite
        ? "Conheça a Evolução Diária — 15 dias grátis ✨"
        : (body.subject ?? "").toString().trim();
      const message = (body.message ?? "").toString();
      const mode = body.mode === "html" ? "html" : "text";

      if (!contactIds.length) {
        return new Response(JSON.stringify({ error: "contact_ids obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (!isInvite && (!subject || !message)) {
        return new Response(JSON.stringify({ error: "subject e message obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: contacts, error: cErr } = await admin
        .from("admin_contacts")
        .select("id, email, name, status")
        .in("id", contactIds);
      if (cErr) throw cErr;

      let sent = 0;
      const failures: Array<{ email: string; error: string }> = [];
      const nowIso = new Date().toISOString();
      for (const c of contacts ?? []) {
        if (!c.email) continue;
        if (c.status === "unsubscribed") continue;
        try {
          const html = isInvite
            ? buildInviteHtml(c.name ?? "")
            : buildHtml(c.name ?? "", subject, message, mode);
          await sendOneEmail(resendKey, c.email, subject, html);
          sent++;
          await admin.from("admin_contacts").update({
            status: isInvite ? "invited" : (c.status === "registered" ? c.status : c.status),
            invited_at: isInvite ? nowIso : undefined,
            last_email_at: nowIso,
            last_email_subject: subject,
          }).eq("id", c.id);
        } catch (e) {
          failures.push({ email: c.email, error: (e as Error).message });
        }
      }

      return new Response(JSON.stringify({ success: true, sent, total: contacts?.length ?? 0, failures }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[admin-users] Error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});