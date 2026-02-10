import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { mode, patientId, clinicId, period, command } = await req.json();

    // Use service role for data fetching to avoid RLS issues in edge function
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let contextData = "";

    if (mode === "guided") {
      const { data: patient } = await serviceClient
        .from("patients")
        .select("*")
        .eq("id", patientId)
        .eq("user_id", user.id)
        .single();

      if (!patient) throw new Error("Paciente não encontrado");

      const { data: clinic } = await serviceClient
        .from("clinics")
        .select("name")
        .eq("id", patient.clinic_id || clinicId)
        .eq("user_id", user.id)
        .single();

      let query = serviceClient
        .from("evolutions")
        .select("*")
        .eq("patient_id", patientId)
        .eq("user_id", user.id)
        .order("date", { ascending: true });

      if (period === "month") {
        const start = new Date();
        start.setMonth(start.getMonth() - 1);
        query = query.gte("date", start.toISOString().split("T")[0]);
      } else if (period === "quarter") {
        const start = new Date();
        start.setMonth(start.getMonth() - 3);
        query = query.gte("date", start.toISOString().split("T")[0]);
      } else if (period === "semester") {
        const start = new Date();
        start.setMonth(start.getMonth() - 6);
        query = query.gte("date", start.toISOString().split("T")[0]);
      }

      const { data: evolutions } = await query;

      const totalSessions = evolutions?.length || 0;
      const present = evolutions?.filter((e: any) => e.attendance_status === "presente").length || 0;
      const absent = totalSessions - present;

      contextData = `
DADOS DO PACIENTE:
- Nome: ${patient?.name}
- Data de nascimento: ${patient?.birthdate}
- Clínica: ${clinic?.name || "N/A"}
- Área clínica: ${patient?.clinical_area || "N/A"}
- Diagnóstico: ${patient?.diagnosis || "N/A"}
- Profissionais: ${patient?.professionals || "N/A"}
- Observações: ${patient?.observations || "N/A"}

RESUMO DE FREQUÊNCIA (${period === "month" ? "Último mês" : period === "quarter" ? "Último trimestre" : period === "semester" ? "Último semestre" : "Todo o período"}):
- Total de sessões: ${totalSessions}
- Presenças: ${present}
- Faltas: ${absent}
- Taxa de presença: ${totalSessions > 0 ? Math.round((present / totalSessions) * 100) : 0}%

EVOLUÇÕES REGISTRADAS:
${evolutions?.map((e: any) => `- ${e.date}: [${e.attendance_status}] ${e.text}`).join("\n") || "Nenhuma evolução registrada."}
`;
    } else {
      const [{ data: clinics }, { data: patients }, { data: evolutions }] = await Promise.all([
        serviceClient.from("clinics").select("*").eq("user_id", user.id),
        serviceClient.from("patients").select("*").eq("user_id", user.id),
        serviceClient.from("evolutions").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(200),
      ]);

      contextData = `
DADOS DISPONÍVEIS:

CLÍNICAS (${clinics?.length || 0}):
${clinics?.map((c: any) => `- ${c.name} (${c.type})`).join("\n") || "Nenhuma"}

PACIENTES (${patients?.length || 0}):
${patients?.map((p: any) => `- ${p.name} | Clínica: ${clinics?.find((c: any) => c.id === p.clinic_id)?.name || "N/A"} | Área: ${p.clinical_area || "N/A"} | Diagnóstico: ${p.diagnosis || "N/A"}`).join("\n") || "Nenhum"}

ÚLTIMAS EVOLUÇÕES (${evolutions?.length || 0}):
${evolutions?.slice(0, 50).map((e: any) => {
  const pat = patients?.find((p: any) => p.id === e.patient_id);
  return `- ${e.date} | ${pat?.name || "?"} | [${e.attendance_status}] ${e.text.slice(0, 100)}`;
}).join("\n") || "Nenhuma"}
`;
    }

    const systemPrompt = `Você é um assistente especializado em gerar relatórios clínicos profissionais para terapeutas e profissionais de saúde.

REGRAS DE FORMATAÇÃO OBRIGATÓRIAS:
1. O relatório DEVE seguir padrão institucional profissional.
2. Estruture com seções numeradas (1., 2., 3., etc.) e subtítulos claros.
3. Use tabelas Markdown (com | e ---) para dados tabulares como identificação do paciente, resumo de frequência etc.
4. Use listas numeradas (1), 2), 3)) para recomendações e considerações.
5. Use bullet points (- item) para detalhamentos dentro de seções.
6. NÃO use linhas horizontais (---) como divisores visuais entre seções.
7. NÃO use ### markdown headers — use apenas texto em CAPS ou numeração.
8. Parágrafos curtos e objetivos. Linguagem técnica e profissional.
9. Inclua SEMPRE ao final uma seção "CONSIDERAÇÕES FINAIS E CONDUTA" com recomendações numeradas.
10. Inclua ao final: "Responsável Técnico: (Espaço para assinatura e carimbo do profissional)"
11. A primeira seção deve ser "CABEÇALHO E IDENTIFICAÇÃO" com uma tabela de dados do paciente.
12. Inclua uma seção "RESUMO EXECUTIVO" com dados de frequência.

Data atual: ${new Date().toLocaleDateString("pt-BR")}.`;

    const userPrompt = mode === "guided"
      ? `Gere um relatório clínico evolutivo institucional detalhado e profissional com base nos seguintes dados. Siga rigorosamente as regras de formatação do sistema:\n${contextData}`
      : `${command}\n\nSiga rigorosamente as regras de formatação institucional do sistema. Use os seguintes dados como base:\n${contextData}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos na sua conta." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("generate-report error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
