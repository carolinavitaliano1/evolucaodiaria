import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { patientId, especialidade, motivo } = await req.json();
    if (!patientId) {
      return new Response(JSON.stringify({ error: 'patientId é obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY não configurada');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    const [
      paciente, intake, anamnesePsico, anamnesePsicom,
      avalsPsico, avalsPsicom, pdisPsico, pdisPsicom,
      evosPsico, evosPsicom, evolucoesGerais,
      registrosPsico, registrosPsicom,
      relatoriosPsico, relatoriosPsicom,
      reunioesPsico, reunioesPsicom,
      feedbacks, savedReports, documentos,
    ] = await Promise.all([
      sb.from('patients').select('name, birthdate, cpf, email, phone, whatsapp, diagnosis, clinical_area, professionals, observations, responsible_name, responsible_whatsapp, guardian_name, guardian_kinship, is_minor, contract_start_date, health_plan_id, health_plan_authorized_sessions').eq('id', patientId).maybeSingle(),
        sb.from('patient_intake_forms').select('*').eq('patient_id', patientId).maybeSingle(),
        sb.from('psico_anamnese').select('escolar, familiar').eq('patient_id', patientId).maybeSingle(),
        sb.from('psicom_anamnese').select('motor, familiar').eq('patient_id', patientId).maybeSingle(),
        sb.from('psico_avaliacoes').select('*').eq('patient_id', patientId).order('data_avaliacao', { ascending: false }).limit(10),
        sb.from('psicom_avaliacoes').select('*').eq('patient_id', patientId).order('data_avaliacao', { ascending: false }).limit(10),
        sb.from('psico_pdi').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(5),
        sb.from('psicom_pdi').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(5),
        sb.from('psico_evolucoes').select('date, content').eq('patient_id', patientId).order('date', { ascending: false }).limit(20),
        // psicom_evolucoes can be absent; try generic via evolutions table instead
        sb.from('evolutions').select('date, content, ai_evolution, attendance_status').eq('patient_id', patientId).order('date', { ascending: false }).limit(30),
        sb.from('evolutions').select('date, content, attendance_status').eq('patient_id', patientId).order('date', { ascending: false }).limit(30),
        sb.from('psico_registros').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(10),
        sb.from('psicom_registros').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(10),
        sb.from('psico_relatorios').select('titulo, conteudo, created_at').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(5),
        sb.from('psicom_relatorios').select('titulo, conteudo, created_at').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(5),
        sb.from('psico_reunioes').select('data, modalidade, objetivos, conclusoes').eq('patient_id', patientId).order('data', { ascending: false }).limit(5),
        sb.from('psicom_reunioes').select('data, modalidade, objetivos, conclusoes').eq('patient_id', patientId).order('data', { ascending: false }).limit(5),
        sb.from('evolution_feedbacks').select('content, created_at').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(5),
        sb.from('saved_reports').select('title, content, mode, created_at').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(5),
        sb.from('patient_documents').select('name, document_type, created_at').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(10),
    ]);

    // Compute idade (anos) se houver birthdate
    let idade: number | null = null;
    const bd = (paciente.data as any)?.birthdate;
    if (bd) {
      const d = new Date(bd + 'T12:00:00');
      const diff = Date.now() - d.getTime();
      idade = Math.floor(diff / (365.25 * 24 * 3600 * 1000));
    }

    const prontuario = {
      paciente: paciente.data ? { ...paciente.data, idade_calculada_anos: idade } : null,
      ficha_admissao: intake.data || null,
      anamnese_psicopedagogica: anamnesePsico.data || null,
      anamnese_psicomotora: anamnesePsicom.data || null,
      avaliacoes_psicopedagogicas: avalsPsico.data || [],
      avaliacoes_psicomotoras: avalsPsicom.data || [],
      pdis_psicopedagogicos: pdisPsico.data || [],
      pdis_psicomotores: pdisPsicom.data || [],
      evolucoes_psicopedagogicas: evosPsico.data || [],
      evolucoes_clinicas: evolucoesGerais.data || [],
      evolucoes_complementares: evosPsicom.data || [],
      registros_psicopedagogicos: registrosPsico.data || [],
      registros_psicomotores: registrosPsicom.data || [],
      relatorios_psicopedagogicos: relatoriosPsico.data || [],
      relatorios_psicomotores: relatoriosPsicom.data || [],
      reunioes_psicopedagogicas: reunioesPsico.data || [],
      reunioes_psicomotoras: reunioesPsicom.data || [],
      feedbacks_familia: feedbacks.data || [],
      relatorios_salvos: savedReports.data || [],
      documentos_anexados: documentos.data || [],
    };

    const systemPrompt = `Você é um(a) psicopedagogo(a) experiente redigindo cartas formais de encaminhamento interdisciplinar.

REGRAS ABSOLUTAS DE FIDELIDADE CLÍNICA:
- Baseie-se EXCLUSIVAMENTE nas informações reais contidas no prontuário JSON fornecido. O prontuário inclui: cadastro do paciente, ficha de admissão, anamneses (psicopedagógica e psicomotora), avaliações, PDIs, evoluções clínicas, registros, relatórios, reuniões, feedbacks à família e documentos anexados — todo o histórico do paciente dentro do sistema.
- NUNCA invente diagnósticos, datas, escolas, profissionais, instrumentos, escores, medicações ou achados que não estejam explicitamente no JSON.
- Se uma informação não estiver disponível, OMITA o item da carta. Nunca preencha com "[...]", "a confirmar" ou placeholders.
- Use a idade calculada (idade_calculada_anos) e a data de nascimento reais; não estime.
- Cite o(s) instrumento(s) e datas de avaliação somente se constarem nos campos.
- Linguagem técnica, respeitosa, objetiva, português brasileiro. Entre 250 e 450 palavras.`;

    const userPrompt = `Gere uma carta de encaminhamento formal a partir do prontuário completo do paciente abaixo. Considere TODAS as seções do JSON (cadastro, ficha de admissão, anamneses, avaliações, PDIs, evoluções, registros, relatórios, reuniões, feedbacks e documentos) — não use apenas a anamnese familiar/escolar.

Destino: ${especialidade || 'profissional especialista'}
Motivo declarado pelo terapeuta: ${motivo || '(não informado — inferir a partir do prontuário)'}

Estruture a carta exatamente assim:
1. Cabeçalho: cidade e data atual.
2. Saudação ao profissional de destino.
3. Parágrafo de apresentação do paciente (nome, idade quando houver, escolaridade quando houver).
4. Parágrafo com síntese clínica: principais achados de avaliação (cite instrumentos quando existirem), histórico relevante da anamnese e evolução do trabalho psicopedagógico.
5. Parágrafo com motivo do encaminhamento e o que se espera da avaliação/intervenção do colega.
6. Parágrafo de fechamento colocando-se à disposição para troca interdisciplinar mediante autorização da família.
7. Linha de assinatura: "_________________________________________" e abaixo "Psicopedagogo(a) responsável".

Devolva APENAS o texto final da carta, sem comentários e sem markdown.

PRONTUÁRIO (JSON):
${JSON.stringify(prontuario).slice(0, 60000)}`;

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error('AI gateway error', resp.status, t);
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: 'Limite de requisições atingido. Tente novamente em instantes.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos esgotados no workspace de IA.' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      throw new Error('Falha no AI gateway');
    }

    const json = await resp.json();
    const carta = json.choices?.[0]?.message?.content || '';
    return new Response(JSON.stringify({ carta }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('generate-referral-letter error', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Erro desconhecido' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});