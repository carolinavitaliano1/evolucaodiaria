import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { fileBase64, mimeType, moduleKind } = await req.json();
    if (!fileBase64 || !mimeType) {
      return new Response(JSON.stringify({ error: 'fileBase64 e mimeType são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY não configurada');

    const isPsicom = moduleKind === 'psicom';
    const dominio = isPsicom
      ? 'psicomotricidade (desenvolvimento motor, equilíbrio, coordenação, esquema corporal, lateralidade, organização espacial, tonicidade, praxia)'
      : 'psicopedagogia (leitura, escrita, matemática, atenção, memória, linguagem, raciocínio, percepção)';

    const systemPrompt = `Você é um(a) especialista em ${dominio}. Sua tarefa é digitalizar e estruturar uma avaliação ${isPsicom ? 'psicomotora' : 'psicopedagógica'} previamente realizada (PDF, foto ou digitalização). Extraia com fidelidade absoluta os dados clínicos presentes no documento, sem inventar resultados. Quando um valor numérico não estiver presente, deixe-o ausente. Retorne pontuações sempre normalizadas para a escala de 0 a 100 (se o documento usa outra escala, converta proporcionalmente e indique a escala original em "observacoes").`;

    const userText = `Analise este documento e devolva os dados estruturados. Em "resumo_clinico" escreva um parágrafo (120-200 palavras) sintetizando os principais achados, hipóteses e sugestões em linguagem técnica e respeitosa. Em "relatorio" escreva um relatório clínico completo, organizado em seções (Identificação, Instrumento(s) aplicado(s), Resultados por área, Análise integrativa, Conclusão e Encaminhamentos).`;

    const tool = {
      type: 'function',
      function: {
        name: 'salvar_avaliacao_digitalizada',
        description: 'Estrutura os dados extraídos da avaliação digitalizada.',
        parameters: {
          type: 'object',
          properties: {
            titulo: { type: 'string', description: 'Título curto da avaliação.' },
            instrumento: { type: 'string', description: 'Instrumento/teste aplicado principal (ex: WISC-V, BPM Fonseca, EDM Rosa Neto).' },
            data_avaliacao: { type: 'string', description: 'Data da avaliação em formato YYYY-MM-DD, se identificada.' },
            testes_aplicados: { type: 'array', items: { type: 'string' }, description: 'Lista de todos os instrumentos/testes citados.' },
            metricas: {
              type: 'array',
              description: 'Lista de métricas/áreas avaliadas com pontuação 0-100.',
              items: {
                type: 'object',
                properties: {
                  nome: { type: 'string' },
                  valor: { type: 'number', minimum: 0, maximum: 100 },
                },
                required: ['nome', 'valor'],
              },
            },
            observacoes: { type: 'string', description: 'Observações clínicas relevantes extraídas do documento.' },
            resumo_clinico: { type: 'string', description: 'Resumo clínico em parágrafo (120-200 palavras).' },
            relatorio: { type: 'string', description: 'Relatório completo em markdown com seções.' },
          },
          required: ['titulo', 'metricas', 'resumo_clinico', 'relatorio'],
        },
      },
    };

    const dataUrl = `data:${mimeType};base64,${fileBase64}`;
    const isImage = mimeType.startsWith('image/');

    const userContent: any[] = [{ type: 'text', text: userText }];
    if (isImage) {
      userContent.push({ type: 'image_url', image_url: { url: dataUrl } });
    } else {
      // PDF e outros: gemini aceita via file
      userContent.push({ type: 'file', file: { file_data: dataUrl, filename: 'avaliacao.pdf' } });
    }

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        tools: [tool],
        tool_choice: { type: 'function', function: { name: 'salvar_avaliacao_digitalizada' } },
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
    const toolCall = json.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error('IA não retornou estrutura esperada');
    const args = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ data: args }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('digitize-assessment error', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Erro desconhecido' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});