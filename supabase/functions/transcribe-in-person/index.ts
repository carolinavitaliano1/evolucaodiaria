import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

function buildDiarizedTranscript(dgJson: any): string {
  try {
    const paragraphs =
      dgJson?.results?.channels?.[0]?.alternatives?.[0]?.paragraphs?.paragraphs;
    if (Array.isArray(paragraphs) && paragraphs.length > 0) {
      return paragraphs
        .map((p: any) => {
          const speaker = p.speaker !== undefined ? `Falante ${p.speaker + 1}` : 'Falante';
          const sentences = (p.sentences || []).map((s: any) => s.text).join(' ');
          return `**${speaker}:** ${sentences}`;
        })
        .join('\n\n');
    }
    const utterances = dgJson?.results?.utterances;
    if (Array.isArray(utterances) && utterances.length > 0) {
      return utterances
        .map((u: any) => `**Falante ${(u.speaker ?? 0) + 1}:** ${u.transcript}`)
        .join('\n\n');
    }
    return dgJson?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
  } catch {
    return dgJson?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!DEEPGRAM_API_KEY) throw new Error('DEEPGRAM_API_KEY not configured');

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) throw new Error('Missing Authorization');

    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: claimsRes, error: claimsErr } = await anonClient.auth.getClaims(token);
    if (claimsErr || !claimsRes?.claims?.sub) throw new Error('Invalid session');
    const userId = claimsRes.claims.sub as string;

    const { recording_id, language } = await req.json().catch(() => ({}));
    if (!recording_id) throw new Error('recording_id is required');

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: rec, error: recErr } = await admin
      .from('in_person_recordings')
      .select('id, storage_path, therapist_user_id, clinic_id, transcription_status, transcription_text')
      .eq('id', recording_id)
      .maybeSingle();
    if (recErr) throw recErr;
    if (!rec) throw new Error('Recording not found');

    // Permission: owner therapist OR clinic org owner
    let allowed = rec.therapist_user_id === userId;
    if (!allowed && rec.clinic_id) {
      const { data: ok } = await admin.rpc('is_clinic_org_owner', {
        _clinic_id: rec.clinic_id,
        _user_id: userId,
      });
      allowed = !!ok;
    }
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (rec.transcription_status === 'ready' && rec.transcription_text) {
      return new Response(
        JSON.stringify({ text: rec.transcription_text, cached: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await admin
      .from('in_person_recordings')
      .update({ transcription_status: 'processing', transcription_error: null })
      .eq('id', recording_id);

    try {
      // Download audio from storage
      const { data: blob, error: dlErr } = await admin.storage
        .from('session-recordings')
        .download(rec.storage_path);
      if (dlErr || !blob) throw new Error(`Storage download failed: ${dlErr?.message || 'no blob'}`);

      const langMap: Record<string, string> = { pt: 'pt-BR', en: 'en-US', es: 'es' };
      const langCode = langMap[(language || 'pt') as string] || 'pt-BR';

      const params = new URLSearchParams({
        model: 'nova-2',
        language: langCode,
        smart_format: 'true',
        punctuate: 'true',
        paragraphs: 'true',
        diarize: 'true',
        utterances: 'true',
      });

      const audioBuffer = await blob.arrayBuffer();
      const contentType = blob.type || 'audio/mpeg';

      const sttRes = await fetch(`https://api.deepgram.com/v1/listen?${params.toString()}`, {
        method: 'POST',
        headers: {
          Authorization: `Token ${DEEPGRAM_API_KEY}`,
          'Content-Type': contentType,
        },
        body: audioBuffer,
      });
      if (!sttRes.ok) {
        const err = await sttRes.text();
        throw new Error(`Deepgram STT error [${sttRes.status}]: ${err}`);
      }
      const sttJson = await sttRes.json();
      const text: string = buildDiarizedTranscript(sttJson);
      const speakers = sttJson?.results?.utterances
        ? { utterances: sttJson.results.utterances }
        : null;

      await admin
        .from('in_person_recordings')
        .update({
          transcription_status: 'ready',
          transcription_text: text,
          transcription_speakers: speakers,
        })
        .eq('id', recording_id);

      return new Response(JSON.stringify({ text, cached: false }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (inner) {
      const msg = inner instanceof Error ? inner.message : 'transcription failed';
      await admin
        .from('in_person_recordings')
        .update({ transcription_status: 'error', transcription_error: msg })
        .eq('id', recording_id);
      throw inner;
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('transcribe-in-person error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});