import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TIPO_LABEL: Record<string, string> = {
  escola: "Relatório para a Escola",
  familia: "Relatório para a Família",
  encaminhamento: "Relatório de Encaminhamento",
  alta: "Relatório de Alta",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );
    const auth = req.headers.get("Authorization");
    if (!auth) throw new Error("Não autenticado");
    const { data: u, error: uerr } = await supabaseAnon.auth.getUser(auth.replace("Bearer ", ""));
    if (uerr) throw uerr;
    if (!u.user) throw new Error("Sem usuário");

    const body = await req.json();
    const { patient_id, tipo } = body as { patient_id: string; tipo: string };
    if (!patient_id || !TIPO_LABEL[tipo]) throw new Error("Parâmetros inválidos");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const [{ data: patient }, { data: avals }, { data: pdis }] =
      await Promise.all([
        supabaseAdmin.from("patients").select("name, birthdate").eq("id", patient_id).maybeSingle(),
        supabaseAdmin.from("psicom_avaliacoes").select("*").eq("patient_id", patient_id)
          .order("data_avaliacao", { ascending: false }).limit(3),
        supabaseAdmin.from("psicom_pdi").select("*").eq("patient_id", patient_id)
          .order("created_at", { ascending: false }).limit(5),
      ]);

    const contexto = {
      paciente: patient?.name ?? "Paciente",
      nascimento: patient?.birthdate ?? null,
      avaliacoes: avals ?? [],
      pdis: pdis ?? [],
    };

    const system = `Você é uma(o) psicomotricista experiente, redigindo um ${TIPO_LABEL[tipo]} com clareza, ética e linguagem acessível.
REGRAS:
- Fidelidade absoluta aos dados fornecidos; não invente diagnósticos ou números.
- Use tom profissional, respeitoso e centrado no paciente.
- 350–600 palavras, estrutura em parágrafos curtos.
- Inclua: identificação, contexto, avaliação (domínios e testes), evolução, recomendações.
- Não use emojis. Não inclua cabeçalho/rodapé institucional.`;

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        temperature: 0.4,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: `Gere o ${TIPO_LABEL[tipo]} com base nos dados a seguir (JSON):\n\n${JSON.stringify(contexto, null, 2)}`,
          },
        ],
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de uso da IA. Tente novamente em instantes." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429,
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no painel." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 402,
        });
      }
      throw new Error(`AI gateway: ${resp.status} ${txt}`);
    }

    const json = await resp.json();
    const conteudo: string =
      json.choices?.[0]?.message?.content ?? "Não foi possível gerar o relatório.";

    return new Response(JSON.stringify({ conteudo }), {
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
