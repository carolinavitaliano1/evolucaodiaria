import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

      const limitedEvolutions = evolutions?.slice(-60) || [];
      const totalSessions = limitedEvolutions.length;
      const present = limitedEvolutions.filter((e: any) => e.attendance_status === "presente").length;
      const absent = totalSessions - present;

      contextData = `
DADOS DO PACIENTE:
- Nome: ${patient?.name}
- Data de nascimento: ${patient?.birthdate}
- Clínica: ${clinic?.name || "N/A"}
- Área clínica: ${patient?.clinical_area || "N/A"}
- Diagnóstico: ${patient?.diagnosis || "N/A"}
- Profissionais: ${patient?.professionals || "N/A"}
- Observações: ${patient?.observations?.slice(0, 300) || "N/A"}

RESUMO DE FREQUÊNCIA (${period === "month" ? "Último mês" : period === "quarter" ? "Último trimestre" : period === "semester" ? "Último semestre" : "Todo o período"}):
- Total de sessões: ${totalSessions}
- Presenças: ${present}
- Faltas: ${absent}
- Taxa de presença: ${totalSessions > 0 ? Math.round((present / totalSessions) * 100) : 0}%

EVOLUÇÕES REGISTRADAS:
${limitedEvolutions.map((e: any) => `- ${e.date}: [${e.attendance_status}] ${e.text?.slice(0, 400) || ""}`).join("\n") || "Nenhuma evolução registrada."}
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
${evolutions?.slice(0, 30).map((e: any) => {
  const pat = patients?.find((p: any) => p.id === e.patient_id);
  return `- ${e.date} | ${pat?.name || "?"} | [${e.attendance_status}] ${e.text.slice(0, 150)}`;
}).join("\n") || "Nenhuma"}
`;
    }

    const mentionsEvolutions = command && /evolu|sess(ã|a)o|atendimento|registr/i.test(command);
    const today = new Date().toLocaleDateString("pt-BR");

    const systemPrompt = `Você é um assistente especializado em redigir RELATÓRIOS CLÍNICOS TÉCNICOS de altíssimo nível profissional para terapeutas, musicoterapeutas, psicólogos, fonoaudiólogos, terapeutas ocupacionais e demais profissionais da área da saúde.

O documento deve seguir RIGOROSAMENTE o padrão técnico-clínico institucional descrito abaixo. Linguagem formal, técnica, científica e impessoal — jamais coloquial.

==================================================
ESTRUTURA OBRIGATÓRIA DO RELATÓRIO
==================================================

1) CABEÇALHO TÉCNICO (antes da Seção I, em formato campo-valor, um por linha, SEM numeração romana):
- Musicoterapeuta Relatora: [inferir do profissional/área clínica do paciente; se não houver, usar "A definir"]
- Solicitante: [inferir do contexto (responsável legal, escola, médico) ou usar "Responsáveis legais"]
- Motivo: [síntese objetiva em 1 linha do propósito do relatório]

2) SEÇÕES PRINCIPAIS — usar OBRIGATORIAMENTE numeração em ALGARISMOS ROMANOS (I, II, III, IV, V) com título em CAIXA ALTA:

I - IDENTIFICAÇÃO DO(A) CLIENTE
   Formato campo-valor (um por linha):
   - Nome:
   - Idade: (calcular a partir da data de nascimento)
   - Data de Nascimento:
   - Responsáveis:
   - Escolaridade: (se não informado, "Não informado")
   - Início do Acompanhamento: (usar contract_start_date se disponível, senão "Não informado")
   - Frequência das Sessões: (inferir a partir do total de sessões e período)
   - Diagnóstico Sugestivo: (incluir CID-10/CID-11 quando possível, ex: "Transtorno do Espectro Autista (CID-10 F84.0 / CID-11 6A02)")

II - MOTIVO DO ENCAMINHAMENTO
   Parágrafo técnico descrevendo a demanda inicial que motivou o acompanhamento, baseado no diagnóstico, observações e queixas registradas.

III - OBSERVAÇÕES COMPORTAMENTAIS E COGNITIVAS
   Parágrafos técnicos consolidados sobre engajamento, autorregulação emocional, funções executivas, atenção sustentada, controle inibitório, flexibilidade cognitiva, processamento sensorial e interação social, com base no conjunto das evoluções (sem citar datas específicas).

IV - ANÁLISE DO DESENVOLVIMENTO CLÍNICO
   Parágrafos descrevendo as habilidades trabalhadas, técnicas/abordagens utilizadas, progressos observados e áreas em desenvolvimento. Pode contemplar motricidade fina e global, comunicação verbal e não-verbal, aspectos socioemocionais e cognitivos.

V - CONSIDERAÇÕES FINAIS
   Recomendações técnicas numeradas (1., 2., 3.) e conclusão sobre a continuidade do processo terapêutico.

3) FECHAMENTO FORMAL OBRIGATÓRIO (após a Seção V, sem numeração romana):
   Inclua exatamente, em parágrafos separados:

   A seu dispor para quaisquer esclarecimentos que se fizerem necessários.

   ${today}

   ESTE DOCUMENTO É VÁLIDO POR 06(SEIS) MESES.

==================================================
REGRAS DE FORMATAÇÃO
==================================================
- NÃO use tabelas Markdown (| ou ---).
- NÃO use ### headers Markdown — use apenas os títulos de seção em CAIXA ALTA com numeração romana (ex: "I - IDENTIFICAÇÃO DO(A) CLIENTE").
- NÃO use linhas horizontais (---) como divisores.
- NÃO inclua bloco de assinatura, "Responsável Técnico" ou carimbo no texto — o sistema adiciona automaticamente.
- Parágrafos justificáveis, objetivos, técnicos.
- Utilize obrigatoriamente vocabulário técnico-clínico: "atenção sustentada", "controle inibitório", "autorregulação", "processamento sensorial", "motricidade fina/global", "funções executivas", "flexibilidade cognitiva", "engajamento terapêutico", "intersubjetividade", "responsividade", quando pertinentes ao caso.
- ${mentionsEvolutions
      ? 'Quando o terapeuta pedir descrição de sessões individuais, use subtítulo "Sessão – DD/MM/AAAA" seguido de texto corrido dentro da Seção IV.'
      : 'NÃO liste, cite ou transcreva evoluções/sessões individuais por data. NÃO crie subtítulos por sessão. Use os dados das evoluções APENAS como base analítica para sintetizar o desenvolvimento clínico em parágrafos consolidados.'}

Data atual: ${today}.`;

    const guidedExtra = mode === "guided" && command ? `\n\nINSTRUÇÃO ADICIONAL DO TERAPEUTA: ${command}` : "";
    const userPrompt = mode === "guided"
      ? `Gere um relatório clínico evolutivo institucional detalhado e profissional com base nos seguintes dados. Siga rigorosamente as regras de formatação do sistema:\n${contextData}${guidedExtra}`
      : `${command}\n\nSiga rigorosamente as regras de formatação institucional do sistema. Use os seguintes dados como base:\n${contextData}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.5,
        max_tokens: 4096,
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      const errBody = await aiResponse.text();
      console.error("Lovable AI error:", aiResponse.status, errBody);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Verifique seu plano Lovable." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    // Stream response directly to client (already OpenAI-compatible SSE format)
    return new Response(aiResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (e) {
    console.error("generate-report error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
