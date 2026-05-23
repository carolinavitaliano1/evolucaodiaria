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

      // Prontuário completo: agrega TODAS as fontes de dados do paciente
      const [
        intakeRes,
        psicoAnamRes, psicomAnamRes,
        psicoAvalRes, psicomAvalRes,
        psicoPdiRes, psicomPdiRes,
        psicoEvoRes,
        psicoRegRes, psicomRegRes,
        psicoRelRes, psicomRelRes,
        psicoReunRes, psicomReunRes,
        feedbacksRes, savedRepRes, docsRes,
      ] = await Promise.all([
        serviceClient.from("patient_intake_forms").select("*").eq("patient_id", patientId).maybeSingle(),
        serviceClient.from("psico_anamnese").select("*").eq("patient_id", patientId),
        serviceClient.from("psicom_anamnese").select("*").eq("patient_id", patientId),
        serviceClient.from("psico_avaliacoes").select("*").eq("patient_id", patientId).order("data_avaliacao", { ascending: false }),
        serviceClient.from("psicom_avaliacoes").select("*").eq("patient_id", patientId).order("data_avaliacao", { ascending: false }),
        serviceClient.from("psico_pdi").select("*").eq("patient_id", patientId).order("created_at", { ascending: false }),
        serviceClient.from("psicom_pdi").select("*").eq("patient_id", patientId).order("created_at", { ascending: false }),
        serviceClient.from("psico_evolucoes").select("*").eq("patient_id", patientId).order("data_sessao", { ascending: false }).limit(30),
        serviceClient.from("psico_registros").select("*").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(15),
        serviceClient.from("psicom_registros").select("*").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(15),
        serviceClient.from("psico_relatorios").select("*").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(10),
        serviceClient.from("psicom_relatorios").select("*").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(10),
        serviceClient.from("psico_reunioes").select("*").eq("patient_id", patientId).order("data_reuniao", { ascending: false }).limit(10),
        serviceClient.from("psicom_reunioes").select("*").eq("patient_id", patientId).order("data_reuniao", { ascending: false }).limit(10),
        serviceClient.from("evolution_feedbacks").select("*").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(15),
        serviceClient.from("saved_reports").select("title,content,mode,created_at").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(10),
        serviceClient.from("patient_documents").select("name,description,created_at").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(20),
      ]);

      // Idade calculada
      let idade = "N/A";
      if (patient?.birthdate) {
        const b = new Date(patient.birthdate + "T12:00:00");
        const diff = Date.now() - b.getTime();
        idade = `${Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))} anos`;
      }

      const prontuario = {
        cadastro: {
          nome: patient?.name,
          idade,
          data_nascimento: patient?.birthdate,
          cpf: patient?.cpf,
          email: patient?.email,
          clinica: clinic?.name,
          area_clinica: patient?.clinical_area,
          diagnostico: patient?.diagnosis,
          profissionais: patient?.professionals,
          responsavel_legal: patient?.responsible_name,
          responsavel_financeiro: patient?.financial_responsible_name,
          plano_saude: patient?.health_plan,
          escolaridade: patient?.education_level,
          escola: patient?.school_name,
          inicio_acompanhamento: patient?.contract_start_date,
          observacoes: patient?.observations,
        },
        ficha_intake: intakeRes?.data ?? null,
        anamneses_especialidade: {
          psicopedagogia: psicoAnamRes?.data ?? [],
          psicomotricidade: psicomAnamRes?.data ?? [],
        },
        avaliacoes_especialidade: {
          psicopedagogia: psicoAvalRes?.data ?? [],
          psicomotricidade: psicomAvalRes?.data ?? [],
        },
        pdis: {
          psicopedagogia: psicoPdiRes?.data ?? [],
          psicomotricidade: psicomPdiRes?.data ?? [],
        },
        evolucoes_clinicas_gerais: limitedEvolutions,
        evolucoes_especialidade: {
          psicopedagogia: psicoEvoRes?.data ?? [],
        },
        registros_especialidade: {
          psicopedagogia: psicoRegRes?.data ?? [],
          psicomotricidade: psicomRegRes?.data ?? [],
        },
        relatorios_salvos_especialidade: {
          psicopedagogia: psicoRelRes?.data ?? [],
          psicomotricidade: psicomRelRes?.data ?? [],
        },
        reunioes_interdisciplinares: {
          psicopedagogia: psicoReunRes?.data ?? [],
          psicomotricidade: psicomReunRes?.data ?? [],
        },
        feedbacks_familia: feedbacksRes?.data ?? [],
        outros_relatorios_salvos: savedRepRes?.data ?? [],
        documentos_anexados: docsRes?.data ?? [],
        frequencia: {
          periodo: period,
          total: totalSessions,
          presencas: present,
          faltas: absent,
          taxa_presenca_pct: totalSessions > 0 ? Math.round((present / totalSessions) * 100) : 0,
        },
      };

      contextData = `
PRONTUÁRIO COMPLETO DO PACIENTE (JSON consolidado — use TODOS os dados disponíveis abaixo como base; NUNCA invente nada que não esteja aqui):

${JSON.stringify(prontuario, null, 2)}
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
   Esta seção descreve a EVOLUÇÃO do paciente no período (mensal, bimestral ou trimestral). NÃO é diário sessão-a-sessão: identifique padrões, constâncias, avanços e barreiras observados ao longo de todo o ciclo. Organize em DOIS PARÁGRAFOS CORRIDOS (texto fluente, SEM listas, SEM bullets, SEM marcadores), cada um precedido por um subtítulo em **negrito** em linha própria. Use tom técnico, imparcial e acolhedor, com termos de evolução contínua ("demonstrou avanços", "manteve constância", "apresentou flutuações", "está em processo de aquisição"). NUNCA invente dados — quando não houver informação suficiente sobre uma subcategoria, omita-a discretamente.

   **1. Aspectos Cognitivos (Evolução no período)**
   Redija UM ÚNICO PARÁGRAFO CORRIDO, em texto fluente e técnico, integrando ao longo da prosa a análise da atenção (sustentada, seletiva e alternada), memória (curto prazo, longo prazo e operacional), funções executivas (planejamento, organização, controle inibitório e flexibilidade cognitiva), linguagem e comunicação (receptiva e expressiva), percepção e habilidades visuoespaciais, e raciocínio e resolução de problemas. PROIBIDO usar bullets, hífens, asteriscos como marcadores ou quebrar em subitens — tudo deve fluir como um único parágrafo contínuo.

   **2. Aspectos Comportamentais e Socioemocionais (Padrões do período)**
   Redija UM ÚNICO PARÁGRAFO CORRIDO logo abaixo do anterior, em texto fluente e técnico, integrando ao longo da prosa a regulação emocional (manejo de frustrações, frequência de desorganização), habilidades sociais (interação, reciprocidade, empatia, leitura social), engajamento e motivação (flutuações de interesse, iniciativa e persistência), autonomia e independência (avanços em AVDs e execução autônoma) e comportamentos desafiadores ou atípicos (frequência, gatilhos, redução/aumento de estereotipias, rigidez ou agitação). PROIBIDO usar bullets, hífens, asteriscos como marcadores ou quebrar em subitens — tudo deve fluir como um único parágrafo contínuo.

IV - RESUMO DOS ATENDIMENTOS (Desenvolvimento e Intervenções do Ciclo)
   Sintetize as estratégias clínicas utilizadas no período em PARÁGRAFOS CORRIDOS (texto fluente, SEM bullets nem marcadores). Aborde, ao longo da prosa, os principais objetivos terapêuticos trabalhados nestes meses, as abordagens e recursos mais eficazes (ex.: apoios visuais, mediação física, pistas verbais, modelagem, reforçamento positivo), a adesão e curva de aprendizagem do paciente diante de novos desafios, e as adaptações de manejo clínico implementadas de forma recorrente para garantir engajamento.

V - CONSIDERAÇÕES FINAIS E PLANEJAMENTO
   Balanço do ciclo redigido OBRIGATORIAMENTE em PARÁGRAFOS CORRIDOS (texto fluente, SEM bullets, SEM listas numeradas, SEM marcadores nem subtítulos). Integre na prosa: a avaliação global do período (se os objetivos foram alcançados, parcialmente alcançados ou não alcançados, principais marcos e barreiras), os alinhamentos realizados com a rede de apoio (escola, família, equipe multidisciplinar) e o plano de ação com os focos e metas terapêuticas estabelecidas para o próximo ciclo de acompanhamento.

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
