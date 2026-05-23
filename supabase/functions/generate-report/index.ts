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
- Terapeuta Relator(a): [usar EXATAMENTE o nome e especialidade fornecidos no contexto do profissional, se disponível; caso contrário usar "A definir"]
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
   Esta seção descreve a EVOLUÇÃO do paciente no período (mensal, bimestral ou trimestral). NÃO é diário sessão-a-sessão: identifique padrões, constâncias, avanços e barreiras observados ao longo de todo o ciclo. Organize em DOIS blocos com subtítulos em **negrito** (sem numeração romana). Aborde TODAS as subcategorias abaixo; se não houver dado para alguma, omita-a discretamente — NUNCA invente. Use tom técnico, imparcial e acolhedor, com termos de evolução contínua ("demonstrou avanços", "manteve constância", "apresentou flutuações", "está em processo de aquisição").

   **1. Aspectos Cognitivos (Evolução no período)**
   Descreva o perfil e os ganhos consolidados do paciente nas subcategorias abaixo, usando o nome de cada uma em **negrito** ao iniciar:
   - **Atenção**: sustentada, seletiva e alternada.
   - **Memória**: curto prazo, longo prazo e operacional (de trabalho).
   - **Funções Executivas**: planejamento, organização, controle inibitório e flexibilidade cognitiva.
   - **Linguagem e Comunicação**: aspectos receptivos e expressivos.
   - **Percepção e Habilidades Visuoespaciais**: interpretação sensorial e relações de espaço/lateralidade.
   - **Raciocínio e Resolução de Problemas**: abstração, categorização e pensamento lógico-dedutivo.

   **2. Aspectos Comportamentais e Socioemocionais (Padrões do período)**
   Descreva os padrões observados ao longo do ciclo, usando o nome de cada subcategoria em **negrito**:
   - **Regulação Emocional**: como lidou com frustrações ao longo do tempo, frequência de desorganização e modulação.
   - **Habilidades Sociais**: evolução na interação, reciprocidade, empatia e leitura social.
   - **Engajamento e Motivação**: flutuações de interesse, iniciativa e persistência.
   - **Autonomia e Independência**: avanços em AVDs e execução autônoma de tarefas.
   - **Comportamentos Desafiadores ou Atípicos**: frequência, gatilhos comuns e redução/aumento de estereotipias, rigidez ou agitação — OBRIGATÓRIA quando houver qualquer dado relacionado.

IV - RESUMO DOS ATENDIMENTOS (Desenvolvimento e Intervenções do Ciclo)
   Sintetize as estratégias clínicas utilizadas no período. Use subtítulos em **negrito** para destacar cada item. Deve conter:
   - **Objetivos terapêuticos** principais trabalhados nestes meses.
   - **Abordagens e recursos terapêuticos** mais eficazes (ex.: apoios visuais, mediação física, pistas verbais, modelagem, reforçamento positivo).
   - **Adesão e curva de aprendizagem** do paciente diante de novos desafios.
   - **Adaptações de manejo clínico** implementadas de forma recorrente para garantir engajamento.

V - CONSIDERAÇÕES FINAIS E PLANEJAMENTO
   Balanço do ciclo, com subtítulos em **negrito**. Deve conter OBRIGATORIAMENTE:
   - **Avaliação global**: os objetivos previstos foram alcançados, parcialmente alcançados ou não alcançados? Quais foram os principais marcos e maiores barreiras?
   - **Alinhamentos com a rede de apoio** (escola, família, equipe multidisciplinar) realizados no período.
   - **Plano de ação**: focos e metas terapêuticas estabelecidas para o próximo ciclo de acompanhamento.

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
